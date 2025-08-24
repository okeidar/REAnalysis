// Content script for ChatGPT Helper Extension
console.log('ChatGPT Helper Extension loaded on:', window.location.href);

// Function to check if extension context is still valid
function isExtensionContextValid() {
  try {
    return !!(chrome && chrome.runtime && chrome.runtime.id);
  } catch (err) {
    console.warn('Extension context validation failed:', err);
    return false;
  }
}

// Safe wrapper for chrome API calls
function safeChromeFall(apiCall, fallbackValue = null) {
  try {
    if (!isExtensionContextValid()) {
      console.warn('⚠️ Extension context invalidated, skipping chrome API call');
      return Promise.resolve(fallbackValue);
    }
    return apiCall();
  } catch (err) {
    if (err && (err.message && err.message.includes('Extension context invalidated') || 
               err.message && err.message.includes('Unexpected token'))) {
      console.warn('⚠️ Extension context invalidated during API call:', err.message);
      return Promise.resolve(fallbackValue);
    }
    console.error('Chrome API call failed:', err);
    throw err;
  }
}

// Global variable to track current property analysis
let currentPropertyAnalysis = null;

// Track processed messages per property URL to prevent cross-contamination
let processedMessagesPerProperty = new Map();

// Prompt splitting state management
let promptSplittingState = {
  enabled: true,
  lengthThreshold: 500, // characters
  confirmationTimeout: 15000, // 15 seconds
  currentPhase: null, // 'instructions', 'waiting_confirmation', 'sending_link', 'complete'
  pendingPropertyLink: null,
  confirmationStartTime: null,
  fallbackAttempted: false
};

// Check if we're on ChatGPT
function isChatGPTSite() {
  return window.location.hostname === 'chatgpt.com' || 
         window.location.hostname === 'chat.openai.com';
}

// Prompt splitting utility functions
function shouldSplitPrompt(prompt) {
  return promptSplittingState.enabled && 
         prompt.length > promptSplittingState.lengthThreshold;
}

function splitPromptContent(promptTemplate, propertyLink) {
  // Split the prompt into instructions and link parts
  const instructionsPart = promptTemplate.replace('{PROPERTY_URL}', '[PROPERTY_LINK_PLACEHOLDER]')
                                        .replace('{DATE}', new Date().toLocaleDateString())
                                        .replace('Property Link: [PROPERTY_LINK_PLACEHOLDER]', '')
                                        .trim();
  
  const confirmationRequest = '\n\nSay "Yes, I understand" if you understand these instructions and are ready to analyze a property listing.';
  
  return {
    instructions: instructionsPart + confirmationRequest,
    linkMessage: `Please analyze this property listing: ${propertyLink}`
  };
}

function detectConfirmation(responseText) {
  if (!responseText || typeof responseText !== 'string') return false;
  
  const confirmationPatterns = [
    /yes,?\s*i\s*understand/i,
    /yes\s*i\s*understand/i,
    /i\s*understand/i,
    /understood/i,
    /ready\s*to\s*analyze/i,
    /ready/i,
    /yes/i
  ];
  
  return confirmationPatterns.some(pattern => pattern.test(responseText.trim()));
}

function resetPromptSplittingState() {
  promptSplittingState.currentPhase = null;
  promptSplittingState.pendingPropertyLink = null;
  promptSplittingState.confirmationStartTime = null;
  promptSplittingState.fallbackAttempted = false;
  removePromptSplittingIndicator();
}

// Visual indicator functions for prompt splitting status
function showPromptSplittingIndicator(phase, message) {
  removePromptSplittingIndicator();
  
  const indicator = document.createElement('div');
  indicator.id = 'prompt-splitting-indicator';
  indicator.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px;">
      <div class="spinner" style="width: 16px; height: 16px; border: 2px solid #e2e8f0; border-top: 2px solid #10a37f; border-radius: 50%; animation: spin 1s linear infinite;"></div>
      <span>${message}</span>
    </div>
  `;
  indicator.style.cssText = `
    position: fixed;
    top: 60px;
    right: 10px;
    background: #ffffff;
    color: #2d3748;
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 14px;
    font-family: system-ui, -apple-system, sans-serif;
    z-index: 10001;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    border: 1px solid #e2e8f0;
    max-width: 250px;
  `;
  
  // Add spinner animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
  
  document.body.appendChild(indicator);
  
  console.log(`🔄 Showing prompt splitting indicator: ${phase} - ${message}`);
}

function removePromptSplittingIndicator() {
  const indicator = document.getElementById('prompt-splitting-indicator');
  if (indicator) {
    indicator.remove();
  }
}

// Handler for when confirmation is received
async function handleConfirmationReceived() {
  if (!promptSplittingState.pendingPropertyLink) {
    console.error('❌ No pending property link to send');
    return;
  }
  
  try {
    promptSplittingState.currentPhase = 'sending_link';
    console.log('📤 Sending property link:', promptSplittingState.pendingPropertyLink);
    
    // Show status indicator
    showPromptSplittingIndicator('sending_link', 'Sending property link...');
    
    // Track successful split
    await updatePromptSplittingStats('success');
    
    // Wait a moment for UI to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const inputField = await waitForInputField(5000);
    if (!inputField) {
      throw new Error('Could not find input field for sending link');
    }
    
    const linkMessage = `Please analyze this property listing: ${promptSplittingState.pendingPropertyLink}`;
    
    // Insert the link message
    if (inputField.tagName === 'TEXTAREA') {
      inputField.value = '';
      inputField.focus();
      inputField.value = linkMessage;
      inputField.dispatchEvent(new Event('input', { bubbles: true }));
      inputField.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (inputField.contentEditable === 'true') {
      inputField.textContent = '';
      inputField.focus();
      inputField.textContent = linkMessage;
      inputField.dispatchEvent(new Event('input', { bubbles: true }));
      inputField.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    inputField.focus();
    
    // Auto-submit the link
        setTimeout(() => {
      submitMessage();
      promptSplittingState.currentPhase = 'complete';
      showPromptSplittingIndicator('complete', 'Analysis request sent successfully!');
      
      // Remove indicator after completion
      setTimeout(() => {
        removePromptSplittingIndicator();
      }, 3000);
    }, 500);
    
  } catch (error) {
    console.error('❌ Error sending property link:', error);
    await handleSplittingFallback();
  }
}

// Handler for confirmation timeout
async function handleConfirmationTimeout() {
  if (promptSplittingState.fallbackAttempted) {
    console.log('❌ Fallback already attempted, giving up');
    resetPromptSplittingState();
    return;
  }
  
  console.log('⏰ Confirmation timeout - attempting fallback to single prompt');
  await handleSplittingFallback();
}

// Fallback to single prompt approach
async function handleSplittingFallback() {
  if (!promptSplittingState.pendingPropertyLink) {
    console.error('❌ No pending property link for fallback');
    resetPromptSplittingState();
    return;
  }
  
  try {
    promptSplittingState.fallbackAttempted = true;
    console.log('🔄 Falling back to single prompt approach');
    
    // Show fallback status
    showPromptSplittingIndicator('fallback', 'Using fallback approach...');
    
    // Track fallback usage
    await updatePromptSplittingStats('fallback');
    
    // Clear the current conversation and start fresh with full prompt
    const inputField = await waitForInputField(5000);
    if (!inputField) {
      throw new Error('Could not find input field for fallback');
    }
    
    // Get the original prompt template
    const result = await safeChromeFall(
      () => chrome.storage.local.get(['customPrompt']),
      { customPrompt: null }
    );
    const promptTemplate = result.customPrompt || getDefaultPromptTemplate();
    
    // Create the full prompt with link
    const fullPrompt = promptTemplate
      .replace('{PROPERTY_URL}', promptSplittingState.pendingPropertyLink)
      .replace('{DATE}', new Date().toLocaleDateString());
    
    // Insert the full prompt
    if (inputField.tagName === 'TEXTAREA') {
      inputField.value = '';
      inputField.focus();
      inputField.value = fullPrompt;
      inputField.dispatchEvent(new Event('input', { bubbles: true }));
      inputField.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (inputField.contentEditable === 'true') {
      inputField.textContent = '';
      inputField.focus();
      inputField.textContent = fullPrompt;
      inputField.dispatchEvent(new Event('input', { bubbles: true }));
      inputField.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    inputField.focus();
    
    // Auto-submit the fallback prompt
    setTimeout(() => {
      submitMessage();
      resetPromptSplittingState();
    }, 1000);
    
  } catch (error) {
    console.error('❌ Error in splitting fallback:', error);
    resetPromptSplittingState();
    throw error;
  }
}

// Helper function to get default prompt template
function getDefaultPromptTemplate() {
  return `You are a professional real estate investment analyst. Please analyze this property listing and provide a comprehensive assessment focusing on the following key data points that will be used for Excel export and comparison:

**REQUIRED DATA EXTRACTION:**
1. **Price**: Exact asking price (include currency symbol)
2. **Bedrooms**: Number of bedrooms (numeric)
3. **Bathrooms**: Number of bathrooms (numeric, include half baths as .5)
4. **Square Footage**: Total square footage (numeric)
5. **Year Built**: Construction year (4-digit year)
6. **Property Type**: Specific type (Single Family Home, Condo, Townhouse, Apartment, etc.)
7. **Estimated Monthly Rental Income**: Your professional estimate based on local market rates
8. **Location & Neighborhood Scoring**: Rate the location quality as X/10 (e.g., 7/10, 9/10) considering schools, safety, amenities, transportation
9. **Rental Growth Potential**: Assess as "Growth: High", "Growth: Strong", "Growth: Moderate", "Growth: Low", or "Growth: Limited" based on area development and market trends

**ANALYSIS STRUCTURE:**
Please organize your response with clear sections:

**PROPERTY DETAILS:**
- List all the required data points above in a clear format
- Include any additional relevant specifications (lot size, parking, etc.)

**LOCATION & NEIGHBORHOOD ANALYSIS:**
- Provide your location score (X/10) with detailed justification
- Analyze proximity to schools, shopping, transportation, employment centers
- Assess neighborhood safety, walkability, and future development plans
- Comment on property taxes, HOA fees, and local regulations

**RENTAL INCOME ANALYSIS:**
- Provide your estimated monthly rental income with reasoning
- Compare to local rental comps if possible
- Assess rental growth potential ("Growth: High", "Growth: Strong", "Growth: Moderate", "Growth: Low", or "Growth: Limited") with specific factors:
  * Population growth trends
  * Economic development in the area
  * New construction and inventory levels
  * Employment opportunities and job market
  * Infrastructure improvements planned

**INVESTMENT SUMMARY:**
- Overall investment grade and reasoning
- Top 3 advantages (pros)
- Top 3 concerns or limitations (cons)
- Any red flags or warning signs
- Price comparison to market value
- Recommendation for this property as a rental investment

**FORMAT REQUIREMENTS:**
- Use clear headings and bullet points
- Include specific numbers and percentages where possible
- Provide location score in X/10 format
- Categorize rental growth potential clearly
- Be concise but thorough in your analysis

Focus on data accuracy and practical investment considerations that would be valuable for property comparison and decision-making.

Property Link: {PROPERTY_URL}`;
}

// Performance tracking functions for prompt splitting
async function updatePromptSplittingStats(type) {
  try {
    const result = await safeChromeFall(
      () => chrome.storage.local.get(['promptSplittingSettings']),
      { promptSplittingSettings: null }
    );
    
    const settings = result.promptSplittingSettings || {
      enabled: true,
      lengthThreshold: 500,
      confirmationTimeout: 15000,
      stats: { totalAttempts: 0, successfulSplits: 0, fallbacksUsed: 0 }
    };
    
    // Update stats based on type
    switch (type) {
      case 'attempt':
        settings.stats.totalAttempts++;
        console.log('📊 Tracked prompt splitting attempt');
        break;
      case 'success':
        settings.stats.successfulSplits++;
        console.log('📊 Tracked successful prompt split');
        break;
      case 'fallback':
        settings.stats.fallbacksUsed++;
        console.log('📊 Tracked fallback usage');
        break;
    }
    
    // Save updated stats
    await safeChromeFall(
      () => chrome.storage.local.set({ promptSplittingSettings: settings }),
      null
    );
    
  } catch (error) {
    console.warn('Failed to update prompt splitting stats:', error);
  }
}

async function loadPromptSplittingSettings() {
  try {
    const result = await safeChromeFall(
      () => chrome.storage.local.get(['promptSplittingSettings']),
      { promptSplittingSettings: null }
    );
    
    const settings = result.promptSplittingSettings || {
      enabled: true,
      lengthThreshold: 500,
      confirmationTimeout: 15000,
      stats: { totalAttempts: 0, successfulSplits: 0, fallbacksUsed: 0 }
    };
    
    // Update global state
    promptSplittingState.enabled = settings.enabled;
    promptSplittingState.lengthThreshold = settings.lengthThreshold;
    promptSplittingState.confirmationTimeout = settings.confirmationTimeout;
    
    console.log('✅ Loaded prompt splitting settings:', {
      enabled: settings.enabled,
      threshold: settings.lengthThreshold,
      timeout: settings.confirmationTimeout,
      stats: settings.stats
    });
    
    return settings;
  } catch (error) {
    console.warn('Failed to load prompt splitting settings:', error);
    return null;
  }
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
    try {
      // Extract estimated monthly rental income
      const rentalIncomeMatch = text.match(/\$?([\d,]+)\s*(?:per\s+month|monthly|\/month)/gi);
      if (rentalIncomeMatch && rentalIncomeMatch[0]) {
        const match = rentalIncomeMatch[0].match(/\$?([\d,]+)/);
        if (match) {
          analysis.extractedData.estimatedRentalIncome = match[1].replace(/,/g, '');
          console.log(`✅ Extracted estimated rental income:`, analysis.extractedData.estimatedRentalIncome);
        }
      }
    } catch (error) {
      console.warn('Error in rental income extraction:', error.message);
    }
    
    try {
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
    } catch (error) {
      console.warn('Error in rental growth potential extraction:', error.message);
    }
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
    
    // Check if we're waiting for confirmation in prompt splitting mode
    if (promptSplittingState.currentPhase === 'waiting_confirmation') {
      console.log('🔍 Checking for confirmation in response...');
      if (detectConfirmation(messageText)) {
        console.log('✅ Confirmation detected! Proceeding to send property link...');
        handleConfirmationReceived();
        return;
      } else {
        console.log('❌ No confirmation detected, checking timeout...');
        const timeElapsed = Date.now() - promptSplittingState.confirmationStartTime;
        if (timeElapsed > promptSplittingState.confirmationTimeout) {
          console.log('⏰ Confirmation timeout, falling back to single prompt...');
          handleConfirmationTimeout();
          return;
        }
      }
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
    
    // Get custom prompt from storage or use default
    const result = await safeChromeFall(
      () => chrome.storage.local.get(['customPrompt']),
      { customPrompt: null }
    );
    const promptTemplate = result.customPrompt || getDefaultPromptTemplate();

    // Check if we should use prompt splitting
    const fullPrompt = promptTemplate
      .replace('{PROPERTY_URL}', propertyLink)
      .replace('{DATE}', new Date().toLocaleDateString());
      
    if (shouldSplitPrompt(fullPrompt)) {
      console.log('📝 Using prompt splitting approach for better link processing');
      
      // Track attempt
      await updatePromptSplittingStats('attempt');
      
      // Reset any existing state
      resetPromptSplittingState();
      
      // Split the prompt
      const splitPrompt = splitPromptContent(promptTemplate, propertyLink);
      
      // Set up state for the splitting process
      promptSplittingState.currentPhase = 'instructions';
      promptSplittingState.pendingPropertyLink = propertyLink;
      
      console.log('📤 Sending instructions first...');
      console.log('📝 Instructions length:', splitPrompt.instructions.length);
      
      // Insert instructions first
      if (inputField.tagName === 'TEXTAREA') {
        inputField.value = '';
        inputField.focus();
        inputField.value = splitPrompt.instructions;
        inputField.dispatchEvent(new Event('input', { bubbles: true }));
        inputField.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (inputField.contentEditable === 'true') {
        inputField.textContent = '';
        inputField.focus();
        inputField.textContent = splitPrompt.instructions;
        inputField.dispatchEvent(new Event('input', { bubbles: true }));
        inputField.dispatchEvent(new Event('change', { bubbles: true }));
      }
      
      inputField.focus();
      
      // Submit instructions and wait for confirmation
      promptSplittingState.currentPhase = 'waiting_confirmation';
      promptSplittingState.confirmationStartTime = Date.now();
      
      console.log('⏰ Starting confirmation timer...');
      showPromptSplittingIndicator('waiting_confirmation', 'Waiting for ChatGPT confirmation...');
      
      setTimeout(() => {
        submitMessage();
      }, 500);
      
      return true;
    } else {
      console.log('📝 Using single prompt approach (below threshold)');
      
      // Use the original single prompt approach
      const prompt = fullPrompt;
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
    }
    
  } catch (error) {
    console.error('Failed to insert prompt:', error);
    resetPromptSplittingState(); // Clean up state on error
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

// Global error handler for uncaught syntax errors
window.addEventListener('error', function(event) {
  if (event.error && event.error.message && event.error.message.includes('Unexpected token')) {
    console.warn('ChatGPT Helper: Caught syntax error (likely extension context invalidation):', event.error.message);
    event.preventDefault(); // Prevent the error from propagating
    return true;
  }
});

// Initialize extension only on ChatGPT
if (isChatGPTSite()) {
  try {
    console.log('✅ ChatGPT Helper Extension is active on ChatGPT');
    
    // Load prompt splitting settings asynchronously
    loadPromptSplittingSettings().catch(error => {
      console.warn('Failed to load prompt splitting settings:', error);
    });
    
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
      
    } else if (request.action === 'updatePromptSplittingSettings') {
      console.log('Received prompt splitting settings update:', request.settings);
      
      // Update local settings
      if (request.settings) {
        promptSplittingState.enabled = request.settings.enabled;
        promptSplittingState.lengthThreshold = request.settings.lengthThreshold;
        promptSplittingState.confirmationTimeout = request.settings.confirmationTimeout;
        
        console.log('✅ Updated prompt splitting settings:', {
          enabled: promptSplittingState.enabled,
          threshold: promptSplittingState.lengthThreshold,
          timeout: promptSplittingState.confirmationTimeout
        });
      }
      
      sendResponse({ success: true });
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
  
  } catch (initError) {
    console.error('ChatGPT Helper Extension initialization failed:', initError);
    if (initError.message && initError.message.includes('Unexpected token')) {
      console.warn('This error may be due to Chrome extension context invalidation. Try reloading the page.');
    }
  }
} else {
  console.log('❌ ChatGPT Helper Extension is not active on this site');
}