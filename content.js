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
    extractedData: {},
    timestamp: Date.now()
  };
  
  // Enhanced extraction with multiple strategies for each data type
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
        /(\d+)[\s-]*(?:bed(?:room)?s?|br\b)/gi,
        /(?:bed(?:room)?s?|br)[:\s]*(\d+)/gi,
        /(\d+)\s*(?:bedroom|bed)/gi
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
  
  // Extract data using multiple patterns per field
  for (const [fieldName, extractor] of Object.entries(extractors)) {
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
  
  // Enhanced neighborhood extraction
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
  
  // Comprehensive section extraction with multiple strategies
  const sectionExtractors = {
    pros: {
      keywords: ['pros', 'advantages', 'positives', 'strengths', 'benefits', 'good', 'excellent', 'great'],
      patterns: [
        /(?:\*\*\s*)?(?:pros?|advantages?|positives?|strengths?|benefits?|good\s*points?|excellent\s*features?)[:\s]*(?:\*\*\s*)?\n?([^]*?)(?=\n\s*(?:\*\*\s*)?(?:cons?|disadvantages?|negatives?|market|investment|red\s*flags?|neighborhood|location|price|conclusion)[:\s]*(?:\*\*\s*)?|$)/gi,
        /(?:\*\*\s*)?(?:pros?|advantages?|positives?|strengths?|benefits?)[:\s]*(?:\*\*\s*)?([^]*?)(?=\n\n|\*\*|$)/gi,
        /(?:positive\s*aspects?|good\s*features?|advantages?)[:\s]*([^]*?)(?=\n\s*(?:negative|cons?|disadvantages?)|$)/gi
      ]
    },
    cons: {
      keywords: ['cons', 'disadvantages', 'negatives', 'concerns', 'weaknesses', 'drawbacks', 'issues'],
      patterns: [
        /(?:\*\*\s*)?(?:cons?|disadvantages?|negatives?|concerns?|weaknesses?|drawbacks?|issues?|problems?)[:\s]*(?:\*\*\s*)?\n?([^]*?)(?=\n\s*(?:\*\*\s*)?(?:pros?|advantages?|market|investment|red\s*flags?|neighborhood|location|price|conclusion)[:\s]*(?:\*\*\s*)?|$)/gi,
        /(?:\*\*\s*)?(?:cons?|disadvantages?|negatives?|concerns?|weaknesses?)[:\s]*(?:\*\*\s*)?([^]*?)(?=\n\n|\*\*|$)/gi,
        /(?:negative\s*aspects?|concerns?|issues?)[:\s]*([^]*?)(?=\n\s*(?:positive|pros?|advantages?)|$)/gi
      ]
    },
    marketAnalysis: {
      keywords: ['market analysis', 'market assessment', 'price evaluation', 'market', 'pricing', 'value'],
      patterns: [
        /(?:\*\*\s*)?(?:market\s*analysis|market\s*assessment|price\s*evaluation|market\s*value|pricing\s*analysis)[:\s]*(?:\*\*\s*)?\n?([^]*?)(?=\n\s*(?:\*\*\s*)?(?:pros?|cons?|investment|red\s*flags?|neighborhood|location|conclusion)[:\s]*(?:\*\*\s*)?|$)/gi,
        /(?:\*\*\s*)?(?:market|pricing|value)[:\s]*(?:\*\*\s*)?([^]*?)(?=\n\n|\*\*|$)/gi,
        /(?:price\s*(?:is|seems|appears)|market\s*(?:suggests|indicates|shows))[:\s]*([^]*?)(?=\n\s*\*\*|$)/gi
      ]
    },
    investmentPotential: {
      keywords: ['investment potential', 'investment analysis', 'investment', 'roi', 'return'],
      patterns: [
        /(?:\*\*\s*)?(?:investment\s*potential|investment\s*analysis|investment\s*outlook|roi|return\s*on\s*investment)[:\s]*(?:\*\*\s*)?\n?([^]*?)(?=\n\s*(?:\*\*\s*)?(?:pros?|cons?|market|red\s*flags?|neighborhood|location|conclusion)[:\s]*(?:\*\*\s*)?|$)/gi,
        /(?:\*\*\s*)?(?:investment|roi)[:\s]*(?:\*\*\s*)?([^]*?)(?=\n\n|\*\*|$)/gi,
        /(?:as\s*an\s*investment|investment\s*wise|good\s*investment)[:\s]*([^]*?)(?=\n\s*\*\*|$)/gi
      ]
    },
    redFlags: {
      keywords: ['red flags', 'concerns', 'warnings', 'issues', 'problems', 'caution'],
      patterns: [
        /(?:\*\*\s*)?(?:red\s*flags?|concerns?|warnings?|issues?|problems?|cautions?|potential\s*issues?)[:\s]*(?:\*\*\s*)?\n?([^]*?)(?=\n\s*(?:\*\*\s*)?(?:pros?|cons?|market|investment|neighborhood|location|conclusion)[:\s]*(?:\*\*\s*)?|$)/gi,
        /(?:\*\*\s*)?(?:red\s*flags?|warnings?|concerns?)[:\s]*(?:\*\*\s*)?([^]*?)(?=\n\n|\*\*|$)/gi,
        /(?:be\s*(?:careful|cautious|aware)\s*(?:of|about)|watch\s*out\s*for)[:\s]*([^]*?)(?=\n\s*\*\*|$)/gi
      ]
    },
    neighborhood: {
      keywords: ['neighborhood', 'location', 'area', 'community', 'district'],
      patterns: [
        /(?:\*\*\s*)?(?:neighborhood|location|area\s*analysis|community|district)[:\s]*(?:\*\*\s*)?\n?([^]*?)(?=\n\s*(?:\*\*\s*)?(?:pros?|cons?|market|investment|red\s*flags?|price|conclusion)[:\s]*(?:\*\*\s*)?|$)/gi,
        /(?:\*\*\s*)?(?:neighborhood|location|area)[:\s]*(?:\*\*\s*)?([^]*?)(?=\n\n|\*\*|$)/gi,
        /(?:the\s*(?:neighborhood|area|location)\s*(?:is|has|offers))[:\s]*([^]*?)(?=\n\s*\*\*|$)/gi
      ]
    }
  };
  
  // Enhanced section extraction function
  function extractSectionContent(extractor, text) {
    let bestMatch = null;
    let bestScore = 0;
    
    for (const pattern of extractor.patterns) {
      pattern.lastIndex = 0; // Reset regex
      let match;
      while ((match = pattern.exec(text)) !== null) {
        if (match[1] && match[1].trim()) {
          let content = cleanSectionContent(match[1].trim());
          if (content.length > 20) { // Minimum meaningful content length
            const score = calculateSectionScore(match, content, extractor.keywords);
            if (score > bestScore) {
              bestMatch = content;
              bestScore = score;
            }
          }
        }
      }
    }
    
    return bestMatch;
  }
  
  // Enhanced content cleaning function
  function cleanSectionContent(content) {
    return content
      .replace(/^\*\*.*?\*\*\s*/gm, '') // Remove markdown headers
      .replace(/^#+\s*/gm, '') // Remove markdown headers
      .replace(/^[•\-\*\+]\s*/gm, '') // Remove bullet points
      .replace(/^\d+\.\s*/gm, '') // Remove numbered lists
      .replace(/\n+/g, ' ') // Replace newlines with spaces
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/^[:\s\-\•]+/, '') // Remove leading punctuation and spaces
      .replace(/[:\s\-\•]+$/, '') // Remove trailing punctuation and spaces
      .trim();
  }
  
  // Function to score section matches
  function calculateSectionScore(match, content, keywords) {
    let score = content.length / 100; // Base score on content length
    
    // Boost score for keyword density
    const contentLower = content.toLowerCase();
    for (const keyword of keywords) {
      if (contentLower.includes(keyword.toLowerCase())) {
        score += 2;
      }
    }
    
    // Boost score for structured content (lists, multiple sentences)
    if (content.includes('.') && content.split('.').length > 2) {
      score += 1;
    }
    
    // Penalize very short content
    if (content.length < 50) {
      score *= 0.5;
    }
    
    return score;
  }
  
  // Extract all sections
  for (const [sectionName, extractor] of Object.entries(sectionExtractors)) {
    const content = extractSectionContent(extractor, responseText);
    if (content) {
      analysis.extractedData[sectionName] = content.substring(0, 1000); // Increased limit
      console.log(`✅ Extracted ${sectionName} (${content.length} chars):`, content.substring(0, 150) + '...');
    } else {
      console.log(`❌ Failed to extract ${sectionName}`);
      
      // Fallback: try to find any mention of the keywords
      for (const keyword of extractor.keywords) {
        const fallbackPattern = new RegExp(`(.*${keyword}.*)`, 'gi');
        const fallbackMatch = responseText.match(fallbackPattern);
        if (fallbackMatch && fallbackMatch[0] && fallbackMatch[0].length > 30) {
          const fallbackContent = cleanSectionContent(fallbackMatch[0]);
          if (fallbackContent.length > 20) {
            analysis.extractedData[sectionName] = fallbackContent.substring(0, 500);
            console.log(`🔄 Fallback extracted ${sectionName}:`, fallbackContent.substring(0, 100) + '...');
            break;
          }
        }
      }
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
                         analysis.extractedData.redFlags;
  
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
    const promptTemplate = result.customPrompt || `As a real estate investment expert, analyze this property for investment potential. Provide a detailed investment-focused analysis with the following sections:

**PROPERTY FUNDAMENTALS**
- Price: $XXX,XXX
- Bedrooms/Bathrooms: X bed / X bath
- Square Footage: XXXX sq ft (calculate price per sq ft)
- Year Built: XXXX (calculate property age)
- Property Type: Single Family/Condo/Townhouse/Multi-family
- Lot Size: XXXX sq ft (if available)
- HOA Fees: $XXX/month (if applicable)

**FINANCIAL ANALYSIS**
- List Price vs Market Value assessment
- Estimated Monthly Rental Income: $XXXX (research local rental rates)
- Estimated Monthly Expenses: $XXXX (taxes, insurance, maintenance, vacancy allowance)
- Estimated Net Cash Flow: $XXXX
- Cap Rate Estimate: X.X%
- Cash-on-Cash Return Estimate: X.X% (assuming 20% down)
- 1% Rule Analysis: Does monthly rent ≥ 1% of purchase price?
- Total Investment Required: Down payment + closing costs + initial repairs

**MARKET CONDITIONS**
- Current market trend (buyer's/seller's market)
- Days on Market vs area average
- Price History and adjustments
- Comparable sales in the area (recent 3-6 months)
- Area appreciation rates (historical)
- Economic indicators affecting the area

**LOCATION & NEIGHBORHOOD SCORING**
- Neighborhood Quality: Rate 1-10 (safety, desirability)
- Schools: Rate 1-10 (check school ratings)
- Walkability & Transportation: Rate 1-10
- Job Market & Employment Centers: Rate 1-10
- Future Development Plans: Any major projects nearby?
- Population Growth Trends: Growing/stable/declining

**RENTAL MARKET ANALYSIS**
- Rental Demand: High/Medium/Low
- Average Rent for Similar Properties: $XXXX
- Vacancy Rates in Area: X%
- Tenant Demographics: Professionals/families/students
- Rental Growth Potential: X% annually
- Competition Analysis: Number of similar rentals available

**INVESTMENT PROS**
List 5-7 key advantages:
- [Specific positive investment factors]

**INVESTMENT CONS & RED FLAGS**
List 5-7 concerns or risks:
- [Specific concerns or potential issues]

**CONDITION & MAINTENANCE**
- Property Condition: Excellent/Good/Fair/Poor
- Estimated Immediate Repair Costs: $XXXX
- Major Systems Age: HVAC, roof, plumbing, electrical
- Annual Maintenance Budget: $XXXX
- Capital Expenditure Reserves Needed: $XXXX (10-year outlook)

**INVESTMENT RECOMMENDATION**
- Overall Investment Grade: A/B/C/D/F
- Investment Strategy Fit: Buy & Hold/Fix & Flip/BRRRR/Avoid
- Risk Level: Low/Medium/High
- Expected Total Return (5-year): XX%
- Key Decision Factors: [Top 3 factors for/against]

**NEXT STEPS**
- Due Diligence Priorities: [What to investigate further]
- Negotiation Strategy: [Price/terms recommendations]
- Timeline Considerations: [Urgency factors]

Property Link: {PROPERTY_URL}
Analysis Date: {DATE}

**IMPORTANT**: Please copy and paste the key property details from the above link into this chat, then I'll provide my analysis. I need the following information to complete the investment analysis:

• Asking Price
• Bedrooms/Bathrooms
• Square Footage
• Year Built
• Property Type
• Address/Location
• Property Description
• Any HOA fees
• Days on Market
• Any photos or condition details you can share

Once you provide these details, I'll give you the comprehensive investment analysis using the framework above. Focus on actionable investment insights and concrete numbers based on the information you provide.`;

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