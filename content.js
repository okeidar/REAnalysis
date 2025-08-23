// Content script for ChatGPT Helper Extension
console.log('ChatGPT Helper Extension loaded on:', window.location.href);

// Function to check if extension context is still valid
function isExtensionContextValid() {
  try {
    return chrome.runtime && chrome.runtime.id;
  } catch (err) {
    return false;
  }
}

// Safe wrapper for chrome API calls
function safeChromeFall(apiCall, fallbackValue = null) {
  try {
    if (!isExtensionContextValid()) {
      console.log('⚠️ Extension context invalidated, skipping chrome API call');
      return Promise.resolve(fallbackValue);
    }
    return apiCall();
  } catch (err) {
    if (err.message && err.message.includes('Extension context invalidated')) {
      console.log('⚠️ Extension context invalidated during API call');
      return Promise.resolve(fallbackValue);
    }
    throw err;
  }
}

// Global variable to track current property analysis
let currentPropertyAnalysis = null;

// Track processed messages per property URL to prevent cross-contamination
let processedMessagesPerProperty = new Map();

// Check if we're on ChatGPT
function isChatGPTSite() {
  return window.location.hostname === 'chatgpt.com' || 
         window.location.hostname === 'chat.openai.com';
}

// Function to extract key information from ChatGPT response
function extractPropertyAnalysisData(responseText) {
  if (!responseText || typeof responseText !== 'string') return null;
  
  console.log('🔍 Starting comprehensive property data extraction...');
  console.log('📝 Response length:', responseText.length, 'characters');
  
  const analysis = {
    fullResponse: responseText,
    fullAnalysis: responseText, // Store full analysis for Excel export
    extractedData: {},
    timestamp: Date.now()
  };
  
  // First, try to extract from the structured format sections
  const structuredSections = extractStructuredSections(responseText);
  if (structuredSections.propertyDetails) {
    console.log('✅ Found structured PROPERTY DETAILS section');
    extractFromPropertyDetails(structuredSections.propertyDetails, analysis);
  }
  
  if (structuredSections.locationAnalysis) {
    console.log('✅ Found structured LOCATION & NEIGHBORHOOD ANALYSIS section');
    extractFromLocationAnalysis(structuredSections.locationAnalysis, analysis);
  }
  
  if (structuredSections.rentalAnalysis) {
    console.log('✅ Found structured RENTAL INCOME ANALYSIS section');
    extractFromRentalAnalysis(structuredSections.rentalAnalysis, analysis);
  }
  
  if (structuredSections.investmentSummary) {
    console.log('✅ Found structured INVESTMENT SUMMARY section');
    extractFromInvestmentSummary(structuredSections.investmentSummary, analysis);
  }
  
  // Enhanced extraction with multiple strategies for each data type (fallback for unstructured responses)
  const extractors = {
    // Street name extraction with enhanced patterns
    streetName: {
      patterns: [
        /(?:street|address)[:\s]*([^\n,]+(?:street|avenue|road|drive|lane|way|boulevard|place|court|circle|parkway))/gi,
        /(?:located\s+at|address)[:\s]*([^\n,]+)/gi,
        /(\d+\s+[A-Za-z\s]+(?:street|avenue|road|drive|lane|way|boulevard|place|court|circle|parkway|st|ave|rd|dr|ln|blvd|pl|ct|cir|pkwy))/gi,
        /(?:property\s+address)[:\s]*([^\n,]+)/gi,
        /(?:listed\s+at)[:\s]*([^\n,]+)/gi
      ],
      validator: (value) => {
        return value && value.length > 5 && value.length < 150 && 
               /\d/.test(value) && // Should contain at least one number
               !/^(the|this|that|property|listing)$/i.test(value.trim());
      }
    },
    
    // Price extraction with comprehensive patterns
    price: {
      patterns: [
        /(?:price|cost|asking|listed|sale|selling|priced)[:\s]*\$?([\d,]+(?:\.\d{2})?)/gi,
        /\$\s*([\d,]+(?:\.\d{2})?)/g,
        /(?:for|at|around)\s*\$?([\d,]+(?:\.\d{2})?)/gi,
        /([\d,]+(?:\.\d{2})?)\s*(?:dollars?|USD)/gi
      ],
      validator: (value) => {
        const num = parseFloat(value.replace(/,/g, ''));
        return num >= 10000 && num <= 50000000; // Reasonable price range
      }
    },
    
    // Bedroom extraction
    bedrooms: {
      patterns: [
        /(?:bedroom)[s]?[:\s]*(\d+)/gi,
        /(?:bedrooms)[:\s]*(\d+)/gi,
        /(\d+)[\s-]*(?:bed(?:room)?s?|br\b)/gi,
        /(\d+)\s*(?:bedroom|bed)(?!room)/gi, // Avoid matching "bedroom" in "bathrooms"
        /\b(\d+)\s*bed\b/gi,
        /(\d+)\s*(?:bed)/gi
      ],
      validator: (value) => {
        const num = parseInt(value);
        return num >= 0 && num <= 20;
      }
    },
    
    // Bathroom extraction
    bathrooms: {
      patterns: [
        /(\d+(?:\.\d+)?)[\s-]*(?:bath(?:room)?s?|ba\b)/gi,
        /(?:bath(?:room)?s?|ba)[:\s]*(\d+(?:\.\d+)?)/gi,
        /(\d+(?:\.\d+)?)\s*(?:bathroom|bath)/gi
      ],
      validator: (value) => {
        const num = parseFloat(value);
        return num >= 0 && num <= 20;
      }
    },
    
    // Square feet extraction  
    squareFeet: {
      patterns: [
        /([\d,]+)\s*(?:sq\.?\s*ft\.?|square\s*feet|sqft)/gi,
        /(?:size|area)[:\s]*([\d,]+)\s*(?:sq\.?\s*ft\.?|square\s*feet|sqft)/gi,
        /([\d,]+)\s*(?:sf|sq\.ft\.)/gi
      ],
      validator: (value) => {
        const num = parseInt(value.replace(/,/g, ''));
        return num >= 100 && num <= 50000;
      }
    },
    
    // Year built extraction
    yearBuilt: {
      patterns: [
        /(?:built|constructed|year)[:\s]*(\d{4})/gi,
        /(\d{4})\s*(?:built|construction)/gi,
        /(?:built|constructed)\s*(?:in\s*)?(\d{4})/gi,
        /(?:year|date)[:\s]*(\d{4})/gi
      ],
      validator: (value) => {
        const year = parseInt(value);
        return year >= 1800 && year <= new Date().getFullYear();
      }
    },
    
    // Property type extraction
    propertyType: {
      patterns: [
        /(?:property\s*type|type)[:\s]*([^.\n,]+)/gi,
        /(single\s*family|condo|townhouse|apartment|duplex|house|home|villa|ranch|colonial|tudor|contemporary|modern)/gi,
        /(?:this|the)\s*(single\s*family|condo|townhouse|apartment|duplex|house|home|villa|ranch|colonial|tudor|contemporary|modern)/gi
      ],
      validator: (value) => value && value.length > 2 && value.length < 50
    },
    
    // Neighborhood extraction
    neighborhood: {
      patterns: [
        /(?:neighborhood|area|location|district)[:\s]*([^.\n,]+)/gi,
        /(?:located\s*in|in\s*the)[:\s]*([^.\n,]+?)(?:\s*neighborhood|\s*area|,|\.|$)/gi,
        /(?:in|near)\s*([A-Z][a-zA-Z\s]+?)(?:\s*area|\s*neighborhood|,|\.|$)/gi,
        /(?:community|subdivision)[:\s]*([^.\n,]+)/gi
      ],
      validator: (value) => {
        return value && value.length > 3 && value.length < 100 &&
               !value.match(/^(the|this|that|which|excellent|good|great|today|market|property|analysis|listing)$/i) &&
               !value.match(/^\d+/) &&
               !value.match(/^(and|or|but|with|for|from|very|quite|really)$/i);
      }
    },
    
    // Lot size extraction
    lotSize: {
      patterns: [
        /(?:lot|land)[:\s]*([\d.,]+)\s*(?:acres?|sq\.?\s*ft\.?|sqft)/gi,
        /([\d.,]+)\s*(?:acre|acres)\s*lot/gi
      ],
      validator: (value) => {
        const num = parseFloat(value.replace(/,/g, ''));
        return num > 0 && num < 1000;
      }
    },
    
    // Estimated rental income extraction
    estimatedRentalIncome: {
      patterns: [
        /(?:rental\s*income|estimated\s*rent|monthly\s*rent)[:\s]*\$?([\d,]+)/gi,
        /\$?([\d,]+)\s*(?:per\s*month|monthly|\/month)/gi,
        /(?:rent\s*for)[:\s]*\$?([\d,]+)/gi
      ],
      validator: (value) => {
        const num = parseFloat(value.replace(/,/g, ''));
        return num >= 500 && num <= 50000; // Reasonable rent range
      }
    },
    
    // Location score extraction
    locationScore: {
      patterns: [
        /(\d+)\/10/gi,
        /(?:location|neighborhood)[^0-9]*(\d+)\s*(?:out\s*of\s*10|\/10)/gi,
        /(?:score|rating)[:\s]*(\d+)\/10/gi
      ],
      validator: (value) => {
        const num = parseInt(value);
        return num >= 1 && num <= 10;
      }
    },
    
    // Rental growth potential extraction
    rentalGrowthPotential: {
      patterns: [
        /(?:rental\s*growth|growth\s*potential)[:\s]*(?:growth:\s*)?(high|strong|moderate|low|limited)/gi,
        /(?:growth)[:\s]*(high|strong|moderate|low|limited)/gi
      ],
      validator: (value) => {
        const validValues = ['high', 'strong', 'moderate', 'low', 'limited'];
        return validValues.includes(value.toLowerCase());
      }
    }
  };
  
  // Function to extract structured sections from the new prompt format
  function extractStructuredSections(text) {
    const sections = {};
    
    // Extract PROPERTY DETAILS section
    const propertyDetailsMatch = text.match(/\*\*PROPERTY\s+DETAILS:\*\*([\s\S]*?)(?=\*\*[A-Z\s&]+:|$)/i);
    if (propertyDetailsMatch) {
      sections.propertyDetails = propertyDetailsMatch[1].trim();
    }
    
    // Extract LOCATION & NEIGHBORHOOD ANALYSIS section
    const locationMatch = text.match(/\*\*LOCATION\s+&\s+NEIGHBORHOOD\s+ANALYSIS:\*\*([\s\S]*?)(?=\*\*[A-Z\s&]+:|$)/i);
    if (locationMatch) {
      sections.locationAnalysis = locationMatch[1].trim();
    }
    
    // Extract RENTAL INCOME ANALYSIS section
    const rentalMatch = text.match(/\*\*RENTAL\s+INCOME\s+ANALYSIS:\*\*([\s\S]*?)(?=\*\*[A-Z\s&]+:|$)/i);
    if (rentalMatch) {
      sections.rentalAnalysis = rentalMatch[1].trim();
    }
    
    // Extract INVESTMENT SUMMARY section
    const investmentMatch = text.match(/\*\*INVESTMENT\s+SUMMARY:\*\*([\s\S]*?)(?=\*\*[A-Z\s&]+:|$)/i);
    if (investmentMatch) {
      sections.investmentSummary = investmentMatch[1].trim();
    }
    
    return sections;
  }
  
  // Function to extract data from PROPERTY DETAILS section
  function extractFromPropertyDetails(text, analysis) {
    // Extract specific data points with enhanced patterns
    const patterns = {
      price: [
        /(?:price|asking)[:\s]*\$?([\d,]+(?:\.\d{2})?)/gi,
        /\$\s*([\d,]+(?:\.\d{2})?)/g
      ],
      bedrooms: [
        /(?:bedroom)[s]?[:\s]*(\d+)/gi,
        /(?:bedrooms)[:\s]*(\d+)/gi,
        /(\d+)[\s-]*(?:bed(?:room)?s?|br\b)/gi,
        /(\d+)\s*(?:bedroom|bed)(?!room)/gi, // Avoid matching "bedroom" in "bathrooms"
        /\b(\d+)\s*bed\b/gi
      ],
      bathrooms: [
        /(?:bathroom)[s]?[:\s]*(\d+(?:\.\d+)?)/gi,
        /(\d+(?:\.\d+)?)[\s-]*(?:bath(?:room)?s?|ba\b)/gi,
        /(\d+(?:\.\d+)?)\s*(?:bathroom|bath)/gi
      ],
      squareFeet: [
        /(?:square\s+footage)[:\s]*([\d,]+)/gi,
        /([\d,]+)\s*(?:sq\.?\s*ft\.?|square\s*feet|sqft)/gi
      ],
      yearBuilt: [
        /(?:year\s+built)[:\s]*(\d{4})/gi,
        /(?:built)[:\s]*(\d{4})/gi,
        /(\d{4})\s*(?:built)/gi
      ],
      propertyType: [
        /(?:property\s+type)[:\s]*([^\n,]+)/gi,
        /(?:type)[:\s]*(single\s+family|condo|townhouse|apartment|duplex|house|home)[^\n,]*/gi
      ]
    };
    
    for (const [key, patternArray] of Object.entries(patterns)) {
      if (!analysis.extractedData[key]) { // Only set if not already extracted
        let bestMatch = null;
        
        // Try each pattern until we find a match
        for (const pattern of patternArray) {
          pattern.lastIndex = 0; // Reset regex
          const match = pattern.exec(text);
          
          if (match && match[1]) {
            const value = match[1].trim();
            
            // Validate the extracted value
            if (validateExtractedValue(key, value)) {
              bestMatch = value;
              break; // Use the first valid match
            }
          }
        }
        
        if (bestMatch) {
          analysis.extractedData[key] = bestMatch;
          console.log(`✅ Extracted ${key} from Property Details:`, bestMatch);
        }
      }
    }
  }
  
  // Helper function to validate extracted values
  function validateExtractedValue(key, value) {
    switch (key) {
      case 'bedrooms':
        const bedrooms = parseInt(value);
        return bedrooms >= 0 && bedrooms <= 20;
      case 'bathrooms':
        const bathrooms = parseFloat(value);
        return bathrooms >= 0 && bathrooms <= 20;
      case 'squareFeet':
        const sqft = parseInt(value.replace(/,/g, ''));
        return sqft >= 100 && sqft <= 50000;
      case 'yearBuilt':
        const year = parseInt(value);
        return year >= 1800 && year <= new Date().getFullYear();
      case 'price':
        const price = parseFloat(value.replace(/,/g, ''));
        return price >= 10000 && price <= 50000000;
      default:
        return value && value.length > 0;
    }
  }
  
  // Function to extract data from LOCATION & NEIGHBORHOOD ANALYSIS section
  function extractFromLocationAnalysis(text, analysis) {
    // Extract location score in X/10 format
    const locationScoreMatch = text.match(/(\d+)\/10/);
    if (locationScoreMatch) {
      analysis.extractedData.locationScore = `${locationScoreMatch[1]}/10`;
      console.log(`✅ Extracted location score:`, analysis.extractedData.locationScore);
    }
    
    // Store the full location analysis
    analysis.extractedData.locationAnalysis = text.substring(0, 1000);
    console.log(`✅ Stored location analysis (${text.length} chars)`);
  }
  
  // Function to extract data from RENTAL INCOME ANALYSIS section
  function extractFromRentalAnalysis(text, analysis) {
    // Extract estimated monthly rental income
    const rentalIncomeMatch = text.match(/\$?([\d,]+)\s*(?:per\s+month|monthly|\/month)/gi);
    if (rentalIncomeMatch && rentalIncomeMatch[0]) {
      const match = rentalIncomeMatch[0].match(/\$?([\d,]+)/);
      if (match) {
        analysis.extractedData.estimatedRentalIncome = match[1].replace(/,/g, '');
        console.log(`✅ Extracted estimated rental income:`, analysis.extractedData.estimatedRentalIncome);
      }
    }
    
    // Extract rental growth potential with Excel-friendly format
    const growthMatch = text.match(/(?:rental\s+growth\s+potential|growth\s+potential)[:\s]*(?:"?Growth:\s*)?(high|strong|moderate|low|limited)(?:"?)/gi);
    if (growthMatch && growthMatch[0]) {
      // Check if it already has "Growth:" prefix
      if (growthMatch[0].toLowerCase().includes('growth:')) {
        analysis.extractedData.rentalGrowthPotential = growthMatch[0].replace(/.*growth:\s*/gi, 'Growth: ').replace(/[""]/g, '');
      } else {
        const match = growthMatch[0].match(/(high|strong|moderate|low|limited)/gi);
        if (match) {
          analysis.extractedData.rentalGrowthPotential = `Growth: ${match[0].charAt(0).toUpperCase() + match[0].slice(1)}`;
        }
      }
      console.log(`✅ Extracted rental growth potential:`, analysis.extractedData.rentalGrowthPotential);
    }
    
    // Store the full rental analysis
    analysis.extractedData.rentalAnalysis = text.substring(0, 1000);
    console.log(`✅ Stored rental analysis (${text.length} chars)`);
  }
  
  // Function to extract data from INVESTMENT SUMMARY section
  function extractFromInvestmentSummary(text, analysis) {
    // Extract pros (Top 3 advantages)
    const prosMatch = text.match(/(?:top\s+3\s+advantages|advantages)[:\s]*([\s\S]*?)(?=(?:top\s+3\s+concerns|concerns|cons|limitations)|$)/gi);
    if (prosMatch && prosMatch[0]) {
      analysis.extractedData.pros = prosMatch[0].replace(/(?:top\s+3\s+advantages|advantages)[:\s]*/gi, '').trim().substring(0, 500);
      console.log(`✅ Extracted pros from Investment Summary`);
    }
    
    // Extract cons (Top 3 concerns)
    const consMatch = text.match(/(?:top\s+3\s+concerns|concerns|limitations)[:\s]*([\s\S]*?)(?=(?:red\s+flags|recommendation)|$)/gi);
    if (consMatch && consMatch[0]) {
      analysis.extractedData.cons = consMatch[0].replace(/(?:top\s+3\s+concerns|concerns|limitations)[:\s]*/gi, '').trim().substring(0, 500);
      console.log(`✅ Extracted cons from Investment Summary`);
    }
    
    // Extract red flags
    const redFlagsMatch = text.match(/(?:red\s+flags|warning\s+signs)[:\s]*([\s\S]*?)(?=(?:price\s+comparison|recommendation)|$)/gi);
    if (redFlagsMatch && redFlagsMatch[0]) {
      analysis.extractedData.redFlags = redFlagsMatch[0].replace(/(?:red\s+flags|warning\s+signs)[:\s]*/gi, '').trim().substring(0, 500);
      console.log(`✅ Extracted red flags from Investment Summary`);
    }
    
    // Store the full investment summary
    analysis.extractedData.investmentSummary = text.substring(0, 1000);
    console.log(`✅ Stored investment summary (${text.length} chars)`);
  }
  
  // Extract data using multiple patterns per field (fallback for basic data)
  for (const [fieldName, extractor] of Object.entries(extractors)) {
    if (!analysis.extractedData[fieldName]) { // Only extract if not already found in structured sections
      let bestMatch = null;
      let bestScore = 0;
      
      for (const pattern of extractor.patterns) {
        pattern.lastIndex = 0; // Reset regex
        let match;
        while ((match = pattern.exec(responseText)) !== null) {
          for (let i = 1; i < match.length; i++) {
            if (match[i] && match[i].trim()) {
              const value = match[i].trim();
              if (extractor.validator(value)) {
                const score = calculateMatchScore(match, fieldName);
                if (score > bestScore) {
                  bestMatch = value;
                  bestScore = score;
                }
              }
            }
          }
        }
      }
      
      if (bestMatch) {
        analysis.extractedData[fieldName] = bestMatch;
        console.log(`✅ Extracted ${fieldName}:`, bestMatch);
      } else {
        console.log(`❌ Failed to extract ${fieldName}`);
      }
    }
  }
  
  // Helper function to score matches based on context
  function calculateMatchScore(match, fieldName) {
    let score = 1;
    const context = match.input.substring(Math.max(0, match.index - 50), match.index + match[0].length + 50).toLowerCase();
    
    // Boost score for relevant context keywords
    const contextBoosts = {
      price: ['listing', 'asking', 'sale', 'cost', 'priced'],
      bedrooms: ['bedroom', 'room', 'bed'],
      bathrooms: ['bathroom', 'bath', 'full', 'half'],
      squareFeet: ['square', 'footage', 'size', 'area'],
      yearBuilt: ['built', 'constructed', 'year', 'age'],
      propertyType: ['property', 'type', 'style'],
      lotSize: ['lot', 'land', 'acre']
    };
    
    const boosts = contextBoosts[fieldName] || [];
    for (const boost of boosts) {
      if (context.includes(boost)) {
        score += 0.5;
      }
    }
    
    return score;
  }
  
  // Function to calculate investment metrics
  function calculateInvestmentMetrics(analysis) {
    const data = analysis.extractedData;
    
    // Parse numeric values
    const price = parseFloat((data.price || '').replace(/[$,]/g, '')) || 0;
    const sqft = parseFloat((data.squareFeet || '').replace(/[,]/g, '')) || 0;
    const monthlyRent = parseFloat((data.estimatedRentalIncome || '').replace(/[$,]/g, '')) || 0;
    const yearBuilt = parseInt(data.yearBuilt || 0);
    
    // Calculate Price per Square Foot
    if (price > 0 && sqft > 0) {
      data.pricePerSqFt = Math.round(price / sqft);
      console.log(`✅ Calculated Price per Sq Ft: $${data.pricePerSqFt}`);
    }
    
    // Calculate Property Age
    if (yearBuilt > 0) {
      data.propertyAge = new Date().getFullYear() - yearBuilt;
      console.log(`✅ Calculated Property Age: ${data.propertyAge} years`);
    }
    
    // Calculate Cap Rate (Annual return percentage)
    if (monthlyRent > 0 && price > 0) {
      const annualRent = monthlyRent * 12;
      data.capRate = ((annualRent / price) * 100).toFixed(2);
      console.log(`✅ Calculated Cap Rate: ${data.capRate}%`);
    }
    
    // Calculate 1% Rule (Monthly rent to price ratio)
    if (monthlyRent > 0 && price > 0) {
      data.onePercentRule = ((monthlyRent / price) * 100).toFixed(2);
      console.log(`✅ Calculated 1% Rule: ${data.onePercentRule}%`);
    }
    
    // Calculate Gross Rent Multiplier
    if (monthlyRent > 0 && price > 0) {
      const annualRent = monthlyRent * 12;
      data.grossRentMultiplier = (price / annualRent).toFixed(1);
      console.log(`✅ Calculated Gross Rent Multiplier: ${data.grossRentMultiplier}`);
    }
    
    // Format rental growth potential if extracted
    if (data.rentalGrowthPotential && !data.rentalGrowthPotential.toLowerCase().startsWith('growth:')) {
      data.rentalGrowthPotential = `Growth: ${data.rentalGrowthPotential.charAt(0).toUpperCase() + data.rentalGrowthPotential.slice(1)}`;
    }
    
    // Format location score if extracted as number
    if (data.locationScore && !data.locationScore.includes('/10')) {
      const score = parseInt(data.locationScore);
      if (!isNaN(score) && score >= 1 && score <= 10) {
        data.locationScore = `${score}/10`;
      }
    }
    
    console.log('📊 Investment metrics calculated successfully');
  }
  
  // Calculate investment metrics based on extracted data
  calculateInvestmentMetrics(analysis);
  
  // Enhanced neighborhood extraction (only if not already extracted from structured sections)
  if (!analysis.extractedData.neighborhood) {
    const neighborhoodPatterns = [
      /(?:neighborhood|area|location|district)[:\s]*([^.\n,]+)/gi,
      /(?:located\s*in|in\s*the)[:\s]*([^.\n,]+?)(?:\s*neighborhood|\s*area|,|\.|$)/gi,
      /(?:in|near)\s*([A-Z][a-zA-Z\s]+?)(?:\s*area|\s*neighborhood|,|\.|$)/gi,
      /(?:community|subdivision)[:\s]*([^.\n,]+)/gi
    ];
    
    let bestNeighborhood = null;
    let bestNeighborhoodScore = 0;
    
    for (const pattern of neighborhoodPatterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(responseText)) !== null) {
        if (match[1]) {
          let neighborhood = match[1].trim();
          // Enhanced validation
          if (neighborhood.length > 3 && neighborhood.length < 100 &&
              !neighborhood.match(/^(the|this|that|which|excellent|good|great|today|market|property|analysis|listing)$/i) &&
              !neighborhood.match(/^\d+/) &&
              !neighborhood.match(/^(and|or|but|with|for|from|very|quite|really)$/i)) {
            
            const score = calculateMatchScore(match, 'neighborhood');
            if (score > bestNeighborhoodScore) {
              bestNeighborhood = neighborhood;
              bestNeighborhoodScore = score;
            }
          }
        }
      }
    }
    
    if (bestNeighborhood) {
      analysis.extractedData.neighborhood = bestNeighborhood;
      console.log(`✅ Extracted neighborhood:`, bestNeighborhood);
    } else {
      console.log(`❌ Failed to extract neighborhood`);
    }
  }
  
  console.log('📊 Final extraction summary:');
  console.log('Keys extracted:', Object.keys(analysis.extractedData));
  console.log('Total data points:', Object.keys(analysis.extractedData).length);
  
  // Log details of what was extracted
  for (const [key, value] of Object.entries(analysis.extractedData)) {
    console.log(`  ${key}: ${typeof value === 'string' ? value.substring(0, 100) + (value.length > 100 ? '...' : '') : value}`);
  }
  
  // More lenient validation - accept analysis if we have ANY meaningful data
  const hasPropertyData = analysis.extractedData.price || 
                         analysis.extractedData.bedrooms || 
                         analysis.extractedData.bathrooms || 
                         analysis.extractedData.squareFeet ||
                         analysis.extractedData.yearBuilt ||
                         analysis.extractedData.propertyType ||
                         analysis.extractedData.neighborhood ||
                         analysis.extractedData.pros ||
                         analysis.extractedData.cons ||
                         analysis.extractedData.marketAnalysis ||
                         analysis.extractedData.investmentPotential ||
                         analysis.extractedData.redFlags ||
                         analysis.extractedData.locationScore ||
                         analysis.extractedData.estimatedRentalIncome ||
                         analysis.extractedData.rentalGrowthPotential;
  
  if (!hasPropertyData) {
    console.log('⚠️ No meaningful data extracted from response');
    console.log('📝 Response preview for debugging:', responseText.substring(0, 500));
    // Still return the analysis with full response for manual review
    console.log('🔄 Returning analysis with full response for manual review');
    return analysis;
  }
  
  console.log('✅ Successfully extracted meaningful property analysis data');
  console.log('✅ Meaningful property data found, analysis ready for save');
  return analysis;
}

// Function to monitor for new ChatGPT messages with completion detection
function setupResponseMonitor() {
  let lastMessageCount = 0;
  let responseBuffer = new Map(); // Buffer to track response completion
  let completionTimers = new Map(); // Timers for each property analysis
  
  // Function to detect if ChatGPT is still writing (streaming)
  const isResponseStreaming = () => {
    console.log('🔍 Checking if ChatGPT is still streaming...');
    
    // Primary check: Look for the stop generation button
    const stopSelectors = [
      'button[data-testid*="stop"]',
      'button[aria-label*="stop" i]',
      'button[title*="stop" i]',
      'button:has([data-icon="stop"])',
      '[role="button"][aria-label*="stop" i]'
    ];
    
    for (const selector of stopSelectors) {
      const stopButton = document.querySelector(selector);
      if (stopButton && 
          stopButton.offsetHeight > 0 && 
          !stopButton.disabled && 
          window.getComputedStyle(stopButton).visibility !== 'hidden' &&
          window.getComputedStyle(stopButton).display !== 'none') {
        console.log('🔍 Found active stop button:', selector, stopButton);
        return true;
      }
    }
    
    // Secondary check: Look for streaming indicators
    const streamingIndicators = [
      '.result-streaming',
      '[class*="streaming"]',
      '[class*="loading"]',
      '.animate-pulse',
      '[data-testid*="streaming"]'
    ];
    
    for (const indicator of streamingIndicators) {
      const element = document.querySelector(indicator);
      if (element && element.offsetHeight > 0) {
        console.log('🔍 Found streaming indicator:', indicator, element);
        return true;
      }
    }
    
    // Check for disabled regenerate button (indicates generation in progress)
    const regenerateSelectors = [
      'button[aria-label*="regenerate" i]',
      'button[title*="regenerate" i]',
      'button:has([data-icon="refresh"])',
      'button:has([data-icon="regenerate"])'
    ];
    
    for (const selector of regenerateSelectors) {
      const regenerateButton = document.querySelector(selector);
      if (regenerateButton && regenerateButton.disabled && regenerateButton.offsetHeight > 0) {
        console.log('🔍 Regenerate button is disabled, likely streaming:', regenerateButton);
        return true;
      }
    }
    
    console.log('✅ No streaming indicators found - ChatGPT appears to have finished');
    return false;
  };
  
  // Function to process completed response
  const processCompletedResponse = (messageText, currentUrl) => {
    console.log('🎯 Processing completed response for:', currentUrl);
    console.log('📝 Final response length:', messageText.length);
    
    // Clear any existing timer
    if (completionTimers.has(currentUrl)) {
      clearTimeout(completionTimers.get(currentUrl));
      completionTimers.delete(currentUrl);
    }
    
    // Process the analysis data
    const propertyKeywords = [
      'property', 'analysis', 'listing', 'bedroom', 'bathroom', 'price',
      'sqft', 'square feet', 'built', 'neighborhood', 'market', 'investment',
      'pros', 'cons', 'advantages', 'disadvantages', 'real estate',
      'zillow', 'realtor', 'mls', 'home', 'house', 'condo', 'townhouse',
      'apartment', 'duplex', 'villa', 'ranch', 'colonial', 'location',
      'area', 'district', 'community', 'lot', 'land', 'acre', 'value',
      'asking', 'listed', 'selling', 'sale', 'cost', 'mortgage',
      'financing', 'schools', 'commute', 'walkable', 'amenities'
    ];
    
    const keywordMatches = propertyKeywords.filter(keyword => 
      messageText.toLowerCase().includes(keyword)
    ).length;
    
    console.log(`Found ${keywordMatches} property keywords in completed response`);
    
    if (keywordMatches >= 2) {
      console.log('✅ Detected completed property analysis response for:', currentPropertyAnalysis.url);
      console.log('🔍 Session ID:', currentPropertyAnalysis.sessionId);
      console.log('🎯 Keywords matched:', keywordMatches, '/', propertyKeywords.length);
      const analysisData = extractPropertyAnalysisData(messageText);
      
      if (analysisData && Object.keys(analysisData.extractedData).length > 0) {
        console.log('✅ Successfully extracted analysis data for:', currentPropertyAnalysis.url);
        console.log('📊 Extracted data summary:', {
          propertyUrl: currentPropertyAnalysis.url,
          sessionId: currentPropertyAnalysis.sessionId,
          dataPoints: Object.keys(analysisData.extractedData).length,
          hasPrice: !!analysisData.extractedData.price,
          hasBedrooms: !!analysisData.extractedData.bedrooms,
          hasBathrooms: !!analysisData.extractedData.bathrooms,
          hasSquareFeet: !!analysisData.extractedData.squareFeet,
          keys: Object.keys(analysisData.extractedData)
        });
        
        // Send the analysis data back to the background script
        safeChromeFall(() => {
          return chrome.runtime.sendMessage({
            action: 'savePropertyAnalysis',
            propertyUrl: currentPropertyAnalysis.url,
            sessionId: currentPropertyAnalysis.sessionId,
            analysisData: analysisData
          });
        }).then(response => {
          if (response) {
            console.log('✅ Analysis data sent successfully:', response);
            if (response.success) {
              console.log('🎉 Property analysis saved and should now show as analyzed!');
            }
          }
        }).catch(err => {
          console.error('❌ Failed to send analysis data:', err);
        });
        
        // Track this message as processed for this property
        if (currentUrl) {
          if (!processedMessagesPerProperty.has(currentUrl)) {
            processedMessagesPerProperty.set(currentUrl, []);
          }
          processedMessagesPerProperty.get(currentUrl).push(messageText);
          
          // Limit stored messages per property to prevent memory bloat
          const messages = processedMessagesPerProperty.get(currentUrl);
          if (messages.length > 5) {
            messages.shift(); // Remove oldest message
          }
        }
        
        // Reset the current analysis tracking
        currentPropertyAnalysis = null;
      } else {
        console.log('⚠️ No extractable data found in completed response');
        console.log('📝 Response preview:', messageText.substring(0, 500) + '...');
      }
    } else {
      console.log('⚠️ Insufficient property keywords in completed response');
    }
    
    // Clean up buffer
    responseBuffer.delete(currentUrl);
  };
  
  const checkForNewMessages = () => {
    // Updated selectors for current ChatGPT interface (2024)
    const messageSelectors = [
      '[data-message-author-role="assistant"]',
      '[data-message-id] [data-message-author-role="assistant"]',
      '.group.w-full.text-token-text-primary',
      '.group.final-completion',
      '.prose.result-streaming',
      '.prose',
      '[class*="markdown"]',
      '[class*="message"][class*="assistant"]',
      '.message.assistant',
      '.group.assistant',
      '[class*="assistant"]'
    ];
    
    let messages = [];
    let foundSelector = null;
    
    for (const selector of messageSelectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        messages = Array.from(elements);
        foundSelector = selector;
        break;
      }
    }
    
    if (foundSelector) {
      console.log(`Found ${messages.length} messages using selector: ${foundSelector}`);
    }
    
    if (messages.length > lastMessageCount || messages.length > 0) {
      const newMessage = messages[messages.length - 1];
      if (!newMessage) return;
      
      const messageText = newMessage.textContent || newMessage.innerText || '';
      
      // Skip if we've already processed this exact message for this property
      const currentUrl = currentPropertyAnalysis?.url;
      if (currentUrl && processedMessagesPerProperty.has(currentUrl)) {
        const processedMessages = processedMessagesPerProperty.get(currentUrl);
        if (processedMessages.includes(messageText)) {
          return;
        }
      }
      
      // Only process if we have an active property analysis session
      if (currentPropertyAnalysis && messageText && messageText.length > 100) {
        console.log('📝 Monitoring response progress for:', currentPropertyAnalysis.url);
        console.log('📊 Current response length:', messageText.length);
        
        // Check if analysis session has timed out (10 minutes)
        const sessionAge = Date.now() - currentPropertyAnalysis.timestamp;
        if (sessionAge > 10 * 60 * 1000) {
          console.log('⏰ Property analysis session timed out, clearing...');
          currentPropertyAnalysis = null;
          return;
        }
        
        // Check if response length has changed from previous check
        const previousBuffer = responseBuffer.get(currentUrl);
        const currentTime = Date.now();
        let lengthStable = false;
        let lastLengthChangeTime = currentTime;
        
        if (previousBuffer) {
          if (previousBuffer.length === messageText.length) {
            // Length hasn't changed, use the previous length change time
            lastLengthChangeTime = previousBuffer.lastLengthChange || previousBuffer.lastUpdated;
            const stableTime = currentTime - lastLengthChangeTime;
            if (stableTime > 2000) { // Length hasn't changed for 2 seconds
              lengthStable = true;
              console.log('📏 Response length stable for', Math.round(stableTime/1000), 'seconds, likely complete');
            }
          } else {
            // Length has changed, update the change time
            lastLengthChangeTime = currentTime;
            console.log('📏 Response length changed:', previousBuffer.length, '->', messageText.length);
          }
        }
        
        // Store/update the current response in buffer
        const bufferEntry = {
          messageText: messageText,
          lastUpdated: currentTime,
          length: messageText.length,
          lastLengthChange: lastLengthChangeTime,
          firstSeen: previousBuffer ? previousBuffer.firstSeen : currentTime
        };
        responseBuffer.set(currentUrl, bufferEntry);
        
        // Fallback: If we've been monitoring this response for more than 30 seconds, process it anyway
        const monitoringTime = currentTime - bufferEntry.firstSeen;
        if (monitoringTime > 30000 && messageText.length > 500) {
          console.log('⏰ Fallback triggered - response has been monitored for 30+ seconds, processing anyway');
          processCompletedResponse(messageText, currentUrl);
          return;
        }
        
        // Check if ChatGPT is still streaming
        const isStreaming = isResponseStreaming();
        console.log('🔄 Is ChatGPT still streaming?', isStreaming);
        console.log('📏 Response length stable?', lengthStable);
        
        if (lengthStable || !isStreaming) {
          console.log('✅ Response appears complete - processing now');
          console.log('  - Length stable:', lengthStable);
          console.log('  - Not streaming:', !isStreaming);
          
          // Clear any existing timer since we're processing now
          if (completionTimers.has(currentUrl)) {
            clearTimeout(completionTimers.get(currentUrl));
            completionTimers.delete(currentUrl);
          }
          
          // Process immediately
          processCompletedResponse(messageText, currentUrl);
          
        } else if (isStreaming) {
          console.log('⏳ ChatGPT still writing, waiting for completion...');
          
          // Clear any existing completion timer
          if (completionTimers.has(currentUrl)) {
            clearTimeout(completionTimers.get(currentUrl));
          }
          
          // Set a shorter completion timer (2 seconds after last change)
          completionTimers.set(currentUrl, setTimeout(() => {
            console.log('⏰ Completion timer triggered - assuming response is complete');
            const bufferedResponse = responseBuffer.get(currentUrl);
            if (bufferedResponse) {
              processCompletedResponse(bufferedResponse.messageText, currentUrl);
            }
          }, 2000));
        }
      }
      
      lastMessageCount = messages.length;
    }
  };
  
  // Check for new messages every 500ms for better completion detection
  const intervalId = setInterval(checkForNewMessages, 500);
  
  // Also use MutationObserver for more immediate detection
  const observer = new MutationObserver((mutations) => {
    let shouldCheck = false;
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        // Check if any added nodes might be ChatGPT messages
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const hasMessageClass = node.querySelector && (
              node.querySelector('[data-message-author-role="assistant"]') ||
              node.querySelector('.prose') ||
              node.querySelector('[class*="message"]') ||
              node.classList.contains('group') ||
              node.classList.contains('prose')
            );
            
            if (hasMessageClass || 
                node.classList.contains('group') || 
                node.classList.contains('prose') ||
                node.getAttribute('data-message-author-role') === 'assistant') {
              shouldCheck = true;
              break;
            }
          }
        }
      }
    });
    
    if (shouldCheck) {
      console.log('🔍 MutationObserver detected potential message change');
      setTimeout(checkForNewMessages, 500); // Small delay to let content load
    }
  });
  
  // Observe the main chat container
  const chatContainers = [
    document.querySelector('main'),
    document.querySelector('[class*="conversation"]'),
    document.querySelector('[class*="chat"]'),
    document.body
  ].filter(Boolean);
  
  chatContainers.forEach(container => {
    if (container) {
      observer.observe(container, {
        childList: true,
        subtree: true
      });
      console.log('👀 Started observing container:', container.tagName);
    }
  });
  
  console.log('🚀 Response monitor setup complete');
  
  // Add periodic check for extension context validity
  const contextCheckInterval = setInterval(() => {
    if (!isExtensionContextValid()) {
      console.log('⚠️ Extension context invalidated - cleaning up content script');
      clearInterval(intervalId);
      clearInterval(contextCheckInterval);
      observer.disconnect();
      // Clear any remaining timers
      completionTimers.forEach(timer => clearTimeout(timer));
      completionTimers.clear();
      responseBuffer.clear();
      currentPropertyAnalysis = null;
    }
  }, 5000); // Check every 5 seconds
  
  // Cleanup function
  return () => {
    clearInterval(intervalId);
    clearInterval(contextCheckInterval);
    observer.disconnect();
  };
}

// Function to find ChatGPT input field with more comprehensive selectors
function findChatGPTInput() {
  console.log('Searching for ChatGPT input field...');
  
  // Try different selectors for ChatGPT input (updated for 2024)
  const selectors = [
    // Most common current selectors
    'textarea[placeholder*="Message"]',
    'textarea[placeholder*="message"]',
    'div[contenteditable="true"][data-testid*="composer"]',
    'div[contenteditable="true"][role="textbox"]',
    'textarea[data-testid="composer-text-input"]',
    
    // Fallback selectors
    'textarea[data-id="root"]',
    'div[contenteditable="true"]',
    '#prompt-textarea',
    'textarea',
    
    // Try by class patterns
    'textarea[class*="composer"]',
    'textarea[class*="input"]',
    'div[class*="composer"][contenteditable="true"]',
    'div[class*="input"][contenteditable="true"]'
  ];
  
  for (const selector of selectors) {
    try {
      const elements = document.querySelectorAll(selector);
      console.log(`Found ${elements.length} elements for selector: ${selector}`);
      
      for (const element of elements) {
        // Check if element is visible and not disabled
        if (element.offsetParent !== null && 
            !element.disabled && 
            !element.readOnly &&
            element.style.display !== 'none') {
          
          console.log('Found suitable input element:', element);
          return element;
        }
      }
    } catch (e) {
      console.log(`Error with selector ${selector}:`, e);
    }
  }
  
  console.log('No suitable input field found');
  return null;
}

// Function to wait for input field to be available
function waitForInputField(maxWait = 10000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    function checkForInput() {
      const input = findChatGPTInput();
      if (input) {
        resolve(input);
        return;
      }
      
      if (Date.now() - startTime > maxWait) {
        reject(new Error('Timeout waiting for input field'));
        return;
      }
      
      // Try again in 500ms
      setTimeout(checkForInput, 500);
    }
    
    checkForInput();
  });
}

// Dynamic prompt generation for content script
async function generateDynamicPromptForContent(columnConfiguration) {
  try {
    const DEFAULT_COLUMNS = [
      // Core Property Information (Default Export Fields - Only these 4 enabled by default)
      { id: 'streetName', name: 'Street Name', description: 'Property street address', category: 'core', enabled: true, order: 1 },
      { id: 'price', name: 'Property Price', description: 'Property asking price', category: 'core', enabled: true, order: 2 },
      { id: 'bedrooms', name: 'Number of Bedrooms', description: 'Number of bedrooms', category: 'core', enabled: true, order: 3 },
      { id: 'propertyType', name: 'Type of Property', description: 'House/Apartment classification', category: 'core', enabled: true, order: 4 },
      
      // Additional Property Information (Disabled by Default)
      { id: 'bathrooms', name: 'Bathrooms', description: 'Number of bathrooms', category: 'core', enabled: false, order: 5 },
      { id: 'squareFeet', name: 'Square Footage', description: 'Property size in square feet', category: 'core', enabled: false, order: 6 },
      { id: 'yearBuilt', name: 'Year Built', description: 'Year the property was built', category: 'core', enabled: false, order: 7 },
      { id: 'neighborhood', name: 'Neighborhood', description: 'Property location/neighborhood name', category: 'core', enabled: false, order: 8 },
      
      // Financial Analysis (Disabled by Default)
      { id: 'estimatedRentalIncome', name: 'Estimated Monthly Rental Income', description: 'Estimated monthly rental income potential', category: 'financial', enabled: false, order: 9 },
      { id: 'pricePerSqFt', name: 'Price per Sq Ft', description: 'Calculated price per square foot', category: 'financial', enabled: false, order: 10 },
      { id: 'capRate', name: 'Cap Rate', description: 'Annual return percentage', category: 'financial', enabled: false, order: 11 },
      { id: 'onePercentRule', name: '1% Rule', description: 'Monthly rent to price ratio', category: 'financial', enabled: false, order: 12 },
      { id: 'grossRentMultiplier', name: 'Gross Rent Multiplier', description: 'Price to annual rent ratio', category: 'financial', enabled: false, order: 13 },
      
      // Location & Scoring (Disabled by Default)
      { id: 'locationScore', name: 'Location Score', description: 'Location quality score (X/10)', category: 'scoring', enabled: false, order: 14 },
      { id: 'rentalGrowthPotential', name: 'Rental Growth Potential', description: 'Growth potential assessment', category: 'scoring', enabled: false, order: 15 },
      
      // Investment Analysis (Disabled by Default)
      { id: 'pros', name: 'Top 3 Pros', description: 'Key property advantages', category: 'analysis', enabled: false, order: 16 },
      { id: 'cons', name: 'Top 3 Cons', description: 'Main property concerns', category: 'analysis', enabled: false, order: 17 },
      { id: 'redFlags', name: 'Red Flags', description: 'Warning indicators', category: 'analysis', enabled: false, order: 18 },
      { id: 'investmentPotential', name: 'Investment Potential', description: 'Investment summary', category: 'analysis', enabled: false, order: 19 },
      { id: 'marketAnalysis', name: 'Market Analysis', description: 'Market assessment', category: 'analysis', enabled: false, order: 20 },
      
      // Identification (Disabled by Default)
      { id: 'address', name: 'Property URL', description: 'Direct link to property', category: 'identification', enabled: false, order: 21 },
      { id: 'source', name: 'Source', description: 'Website source', category: 'identification', enabled: false, order: 22 },
      { id: 'analysisDate', name: 'Analysis Date', description: 'Date of analysis', category: 'identification', enabled: false, order: 23 }
    ];
    
    const columnConfig = columnConfiguration || DEFAULT_COLUMNS;
    
    // Filter to enabled columns
    const enabledColumns = columnConfig.filter(col => col.enabled);
    
    // Generate prompt sections based on enabled columns
    const promptSections = [];
    
    // Core property details
    const coreColumns = enabledColumns.filter(col => col.category === 'core');
    if (coreColumns.length > 0) {
      promptSections.push(generateCorePropertySectionContent(coreColumns));
    }
    
    // Financial metrics
    const financialColumns = enabledColumns.filter(col => col.category === 'financial');
    if (financialColumns.length > 0) {
      promptSections.push(generateFinancialSectionContent(financialColumns));
    }
    
    // Location and scoring
    const scoringColumns = enabledColumns.filter(col => col.category === 'scoring');
    if (scoringColumns.length > 0) {
      promptSections.push(generateLocationSectionContent(scoringColumns));
    }
    
    // Analysis data
    const analysisColumns = enabledColumns.filter(col => col.category === 'analysis');
    if (analysisColumns.length > 0) {
      promptSections.push(generateAnalysisSectionContent(analysisColumns));
    }
    
    // Custom columns
    const customColumns = enabledColumns.filter(col => col.isCustom);
    if (customColumns.length > 0) {
      promptSections.push(generateCustomColumnsSectionContent(customColumns));
    }
    
    // Combine sections into final prompt
    return combinePromptSectionsContent(promptSections);
  } catch (error) {
    console.error('Error generating dynamic prompt:', error);
    return getDefaultPrompt();
  }
}

function generateCorePropertySectionContent(columns) {
  const dataPoints = [];
  
  columns.forEach(col => {
    switch (col.id) {
      case 'streetName':
        dataPoints.push('**Street Name**: Property street address (e.g., "123 Main Street")');
        break;
      case 'price':
        dataPoints.push('**Property Price**: Exact asking price (include currency symbol)');
        break;
      case 'bedrooms':
        dataPoints.push('**Number of Bedrooms**: Number of bedrooms (numeric)');
        break;
      case 'bathrooms':
        dataPoints.push('**Bathrooms**: Number of bathrooms (numeric, include half baths as .5)');
        break;
      case 'squareFeet':
        dataPoints.push('**Square Footage**: Total square footage (numeric)');
        break;
      case 'yearBuilt':
        dataPoints.push('**Year Built**: Construction year (4-digit year)');
        break;
      case 'propertyType':
        dataPoints.push('**Type of Property**: Classify as "House" or "Apartment" (or specific type like "Condo", "Townhouse", etc.)');
        break;
      case 'neighborhood':
        dataPoints.push('**Neighborhood**: Property location/neighborhood name');
        break;
    }
  });
  
  return dataPoints.length > 0 ? `**REQUIRED DATA EXTRACTION:**\n${dataPoints.map((point, index) => `${index + 1}. ${point}`).join('\n')}` : '';
}

function generateFinancialSectionContent(columns) {
  const dataPoints = [];
  
  columns.forEach(col => {
    switch (col.id) {
      case 'estimatedRentalIncome':
        dataPoints.push('**Estimated Monthly Rental Income**: Your professional estimate based on local market rates');
        break;
      case 'pricePerSqFt':
        dataPoints.push('**Price per Square Foot**: Calculated value for investment analysis');
        break;
      case 'capRate':
        dataPoints.push('**Cap Rate**: Annual return percentage based on rental income');
        break;
      case 'onePercentRule':
        dataPoints.push('**1% Rule Assessment**: Monthly rent to price ratio for quick investment evaluation');
        break;
      case 'grossRentMultiplier':
        dataPoints.push('**Gross Rent Multiplier**: Price to annual rent ratio for comparison');
        break;
    }
  });
  
  return dataPoints.length > 0 ? `**FINANCIAL ANALYSIS:**\n${dataPoints.join('\n')}` : '';
}

function generateLocationSectionContent(columns) {
  const dataPoints = [];
  
  columns.forEach(col => {
    switch (col.id) {
      case 'locationScore':
        dataPoints.push('**Location & Neighborhood Scoring**: Rate the location quality as X/10 (e.g., 7/10, 9/10) considering schools, safety, amenities, transportation');
        break;
      case 'rentalGrowthPotential':
        dataPoints.push('**Rental Growth Potential**: Assess as "Growth: High", "Growth: Strong", "Growth: Moderate", "Growth: Low", or "Growth: Limited" based on area development and market trends');
        break;
    }
  });
  
  return dataPoints.length > 0 ? `**LOCATION & MARKET ANALYSIS:**\n${dataPoints.join('\n')}` : '';
}

function generateAnalysisSectionContent(columns) {
  const dataPoints = [];
  
  columns.forEach(col => {
    switch (col.id) {
      case 'pros':
        dataPoints.push('**Top 3 Advantages**: Key property advantages for investment');
        break;
      case 'cons':
        dataPoints.push('**Top 3 Cons**: Main property limitations or concerns');
        break;
      case 'redFlags':
        dataPoints.push('**Red Flags**: Any warning signs or risk indicators');
        break;
      case 'investmentPotential':
        dataPoints.push('**Investment Potential**: Overall investment grade and reasoning');
        break;
      case 'marketAnalysis':
        dataPoints.push('**Market Analysis**: Detailed market assessment and trends');
        break;
    }
  });
  
  return dataPoints.length > 0 ? `**INVESTMENT ANALYSIS:**\n${dataPoints.join('\n')}` : '';
}

function generateCustomColumnsSectionContent(customColumns) {
  const dataPoints = customColumns.map(col => 
    `**${col.name}**: ${col.description || 'Custom data point'}`
  );
  
  return dataPoints.length > 0 ? `**CUSTOM DATA POINTS:**\n${dataPoints.join('\n')}` : '';
}

function combinePromptSectionsContent(sections) {
  const validSections = sections.filter(section => section.length > 0);
  
  if (validSections.length === 0) {
    return getDefaultPrompt();
  }
  
  return `You are a professional real estate investment analyst. Please analyze this property listing and provide a comprehensive assessment focusing on the following key data points that will be used for Excel export and comparison:

${validSections.join('\n\n')}

**ANALYSIS STRUCTURE:**
Please organize your response with clear sections based on the data points requested above.

**FORMAT REQUIREMENTS:**
- Use clear headings and bullet points
- Include specific numbers and percentages where possible
- Provide location score in X/10 format if requested
- Categorize rental growth potential clearly if requested
- Be concise but thorough in your analysis

Focus on data accuracy and practical investment considerations that would be valuable for property comparison and decision-making.

Property Link: {PROPERTY_URL}`;
}

function getDefaultPrompt() {
  return `You are a professional real estate investment analyst. Please analyze this property listing and provide a comprehensive assessment focusing on the following key data points that will be used for Excel export and comparison:

**REQUIRED DATA EXTRACTION:**
1. **Street Name**: Property street address (e.g., "123 Main Street")
2. **Property Price**: Exact asking price (include currency symbol)
3. **Number of Bedrooms**: Number of bedrooms (numeric)
4. **Type of Property**: Classify as "House" or "Apartment" (or specific type like "Condo", "Townhouse", etc.)

**ANALYSIS STRUCTURE:**
Please organize your response with clear sections based on the data points requested above.

**FORMAT REQUIREMENTS:**
- Use clear headings and bullet points
- Include specific numbers and percentages where possible
- Be concise but thorough in your analysis

Focus on data accuracy and practical investment considerations that would be valuable for property comparison and decision-making.

Property Link: {PROPERTY_URL}`;
}

// Function to insert text into ChatGPT input
async function insertPropertyAnalysisPrompt(propertyLink) {
  console.log('Starting property analysis insertion for:', propertyLink);
  
  // Clear any previous analysis tracking to prevent cross-contamination
  if (currentPropertyAnalysis) {
    console.log('⚠️ Clearing previous property analysis for:', currentPropertyAnalysis.url);
  }
  
  // Track this property analysis with enhanced metadata
  currentPropertyAnalysis = {
    url: propertyLink,
    timestamp: Date.now(),
    sessionId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  };
  
  console.log('🎯 New property analysis session started:', currentPropertyAnalysis.sessionId);
  
  // Clear any previous processed messages for this property to allow fresh analysis
  if (processedMessagesPerProperty.has(propertyLink)) {
    processedMessagesPerProperty.delete(propertyLink);
    console.log('🧹 Cleared previous message history for property');
  }
  
  try {
    // Wait for input field to be available
    const inputField = await waitForInputField(5000);
    
    // Get dynamic prompt based on column configuration
    let promptTemplate;
    try {
      // Try to get custom prompt first, then generate dynamic prompt based on columns
      const result = await safeChromeFall(
        () => chrome.storage.local.get(['customPrompt', 'columnConfiguration']),
        { customPrompt: null, columnConfiguration: null }
      );
      
      if (result.customPrompt) {
        // Use custom prompt if available
        promptTemplate = result.customPrompt;
      } else {
        // Generate dynamic prompt based on enabled columns
        promptTemplate = await generateDynamicPromptForContent(result.columnConfiguration);
      }
    } catch (error) {
      console.error('Error getting prompt configuration:', error);
      promptTemplate = getDefaultPrompt();
    }

    // Replace variables in the prompt
    const prompt = promptTemplate
      .replace('{PROPERTY_URL}', propertyLink)
      .replace('{DATE}', new Date().toLocaleDateString());
    
    console.log('Inserting prompt into input field:', inputField);
    
    // Clear existing content first
    if (inputField.tagName === 'TEXTAREA') {
      inputField.value = '';
      inputField.focus();
      inputField.value = prompt;
      
      // Trigger input events
      inputField.dispatchEvent(new Event('input', { bubbles: true }));
      inputField.dispatchEvent(new Event('change', { bubbles: true }));
      
    } else if (inputField.contentEditable === 'true') {
      inputField.textContent = '';
      inputField.focus();
      inputField.textContent = prompt;
      
      // Trigger input events for contenteditable
      inputField.dispatchEvent(new Event('input', { bubbles: true }));
      inputField.dispatchEvent(new Event('change', { bubbles: true }));
      
      // Also try composition events which some modern inputs use
      inputField.dispatchEvent(new CompositionEvent('compositionstart'));
      inputField.dispatchEvent(new CompositionEvent('compositionend'));
    }
    
    // Ensure the field has focus
    inputField.focus();
    
    console.log('Prompt inserted successfully');
    return true;
    
  } catch (error) {
    console.error('Failed to insert prompt:', error);
    return false;
  }
}

// Function to auto-submit the message (optional)
function submitMessage() {
  console.log('Attempting to auto-submit message...');
  
  // Wait a bit for the input to be processed
  setTimeout(() => {
    // Try to find and click the send button
    const sendButtonSelectors = [
      // Updated selectors for current ChatGPT
      'button[data-testid="send-button"]',
      'button[aria-label*="Send"]',
      'button[title*="Send"]',
      'button[class*="send"]',
      
      // Look for buttons with send icons
      'button svg[data-icon="send"]',
      'button svg[class*="send"]',
      
      // Fallback selectors
      '.send-button',
      'button[type="submit"]'
    ];
    
    for (const selector of sendButtonSelectors) {
      try {
        const button = document.querySelector(selector);
        if (button) {
          // Find the actual button element if we found an SVG
          const actualButton = button.tagName === 'BUTTON' ? button : button.closest('button');
          if (actualButton && !actualButton.disabled && actualButton.offsetParent !== null) {
            console.log('Found send button, clicking:', actualButton);
            actualButton.click();
            return true;
          }
        }
      } catch (e) {
        console.log(`Error with send button selector ${selector}:`, e);
      }
    }
    
    // If no send button found, user will need to press Enter or click send manually
    console.log('Send button not found, user needs to send manually');
    return false;
  }, 1000);
}

// Initialize extension only on ChatGPT
if (isChatGPTSite()) {
  console.log('✅ ChatGPT Helper Extension is active on ChatGPT');
  
  // Add a visual indicator that the extension is active
  function addExtensionIndicator() {
    // Check if indicator already exists
    if (document.getElementById('chatgpt-helper-indicator')) {
      return;
    }
    
    const indicator = document.createElement('div');
    indicator.id = 'chatgpt-helper-indicator';
    indicator.textContent = '🤖 ChatGPT Helper Active';
    indicator.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: #10a37f;
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-family: system-ui, -apple-system, sans-serif;
      z-index: 10000;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      animation: slideIn 0.3s ease-out;
    `;
    
    document.body.appendChild(indicator);
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
      if (indicator && indicator.parentNode) {
        indicator.style.opacity = '0';
        indicator.style.transform = 'translateX(100%)';
        setTimeout(() => {
          if (indicator && indicator.parentNode) {
            indicator.remove();
          }
        }, 300);
      }
    }, 3000);
  }
  
  // Wait for page to load then add indicator
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addExtensionIndicator);
  } else {
    addExtensionIndicator();
  }

  // Setup response monitoring
  setupResponseMonitor();
  
  // Listen for messages from popup or background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Content script received message:', request);
    
    if (request.action === 'checkStatus') {
      console.log('Responding to status check');
      sendResponse({
        active: true,
        site: window.location.hostname,
        url: window.location.href
      });
      
    } else if (request.action === 'analyzeProperty') {
      console.log('Received property analysis request:', request.link);
      
      // Handle async operation properly
      (async () => {
        try {
          const success = await insertPropertyAnalysisPrompt(request.link);
          
          if (success) {
            // Optionally auto-submit (uncomment the next line if desired)
            // submitMessage();
            
            sendResponse({ success: true });
          } else {
            sendResponse({ success: false, error: 'Could not find or access input field' });
          }
        } catch (error) {
          console.error('Error in property analysis:', error);
          sendResponse({ success: false, error: error.message });
        }
      })();
      
      // Return true to indicate we'll send response asynchronously
      return true;
    }
  });
  
  // Listen for messages from background script (for saving analysis data)
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'savePropertyAnalysis') {
      console.log('Received request to save analysis data:', request);
      // This will be handled by the background script or popup
      return false;
    }
  });
  
} else {
  console.log('❌ ChatGPT Helper Extension is not active on this site');
}