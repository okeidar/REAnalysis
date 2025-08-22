// Content script for ChatGPT Helper Extension
console.log('ChatGPT Helper Extension loaded on:', window.location.href);

// Global variable to track current property analysis
let currentPropertyAnalysis = null;

// Check if we're on ChatGPT
function isChatGPTSite() {
  return window.location.hostname === 'chatgpt.com' || 
         window.location.hostname === 'chat.openai.com';
}

// Function to extract key information from ChatGPT response
function extractPropertyAnalysisData(responseText) {
  if (!responseText || typeof responseText !== 'string') return null;
  
  console.log('Extracting property analysis from response (first 200 chars):', responseText.substring(0, 200));
  
  const analysis = {
    fullResponse: responseText,
    extractedData: {},
    timestamp: Date.now()
  };
  
  // Helper function to extract year built with fallback methods
  function extractYearBuilt(text) {
    const patterns = [
      /(?:built|constructed|year)[:\s]*(\d{4})/i,
      /(\d{4})\s*(?:built|construction)/i,
      /built\s*in\s*(\d{4})/i,
      /was\s*built\s*in\s*(\d{4})/i
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const year = parseInt(match[1]);
        if (year >= 1800 && year <= new Date().getFullYear()) {
          return match[1];
        }
      }
    }
    return null;
  }
  
  // Helper function to extract neighborhood with better context
  function extractNeighborhood(text) {
    const patterns = [
      /(?:neighborhood|area|location|district)[:\s]*([^.\n,]+)/i,
      /(?:located\s*in|in\s*the)[:\s]*([^.\n,]+?)(?:\s*neighborhood|\s*area|,|\.|$)/i,
      /(?:in)\s*([A-Z][a-zA-Z\s]+?)(?:\s*area|\s*neighborhood|,|\.|$)/i
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        let neighborhood = match[1].trim();
        // Clean up common false matches
        if (neighborhood.length > 3 && 
            !neighborhood.match(/^(the|this|that|which|excellent|good|great|today|market)$/i) &&
            !neighborhood.match(/^\d+/)) {
          return neighborhood;
        }
      }
    }
    return null;
  }
  
  // Improved regex patterns to handle various formats
  const patterns = {
    // Price patterns - handle various formats
    price: /(?:price|cost|asking|listed|for|at)[:\s]*\$?([\d,]+(?:\.\d{2})?)/i,
    
    // Bedroom patterns - handle "3 bed", "3-bedroom", "3 bedrooms", etc.
    bedrooms: /(?:(\d+)[\s-]*(?:bed(?:room)?s?|br\b))|(?:(?:bed(?:room)?s?|br)[:\s]*(\d+))/i,
    
    // Bathroom patterns - similar flexibility
    bathrooms: /(?:(\d+(?:\.\d+)?)[\s-]*(?:bath(?:room)?s?|ba\b))|(?:(?:bath(?:room)?s?|ba)[:\s]*(\d+(?:\.\d+)?))/i,
    
    // Square feet patterns - handle "sqft", "sq ft", "square feet", etc.
    squareFeet: /(?:(\d{1,3}(?:,\d{3})*)\s*(?:sq\.?\s*ft\.?|square\s*feet|sqft))|(?:(?:size|spans)[:\s]*(\d{1,3}(?:,\d{3})*)\s*(?:sq\.?\s*ft\.?|square\s*feet|sqft))/i,
    
    // Lot size patterns
    lotSize: /(?:lot|land)[:\s]*(\d+(?:\.\d+)?)\s*(?:acres?|sq\.?\s*ft\.?)/i,
    
    // Property type patterns - more flexible
    propertyType: /(?:property\s*type|type)[:\s]*([^.\n,]+)|(?:(single\s*family|condo|townhouse|apartment|duplex|house|home))/i
  };
  
  // Extract structured data with improved matching
  for (const [key, pattern] of Object.entries(patterns)) {
    const match = responseText.match(pattern);
    if (match) {
      // Handle multiple capture groups - take the first non-empty one
      let value = '';
      for (let i = 1; i < match.length; i++) {
        if (match[i] && match[i].trim()) {
          value = match[i].trim();
          break;
        }
      }
      
      if (value) {
        analysis.extractedData[key] = value;
        console.log(`✅ Extracted ${key}:`, value);
      }
    } else {
      console.log(`❌ Failed to extract ${key} with regex`);
    }
  }
  
  // Use helper functions for complex extractions
  const yearBuilt = extractYearBuilt(responseText);
  if (yearBuilt) {
    analysis.extractedData.yearBuilt = yearBuilt;
    console.log(`✅ Extracted yearBuilt:`, yearBuilt);
  } else {
    console.log(`❌ Failed to extract yearBuilt`);
  }
  
  const neighborhood = extractNeighborhood(responseText);
  if (neighborhood) {
    analysis.extractedData.neighborhood = neighborhood;
    console.log(`✅ Extracted neighborhood:`, neighborhood);
  } else {
    console.log(`❌ Failed to extract neighborhood`);
  }
  
  // Improved section extraction with multiple strategies
  function extractSection(sectionName, keywords, text) {
    // Strategy 1: Look for section headers
    for (const keyword of keywords) {
      const headerPattern = new RegExp(`\\*\\*\\s*${keyword}\\s*:?\\*\\*\\s*([^]*?)(?=\\*\\*|$)`, 'i');
      const match = text.match(headerPattern);
      if (match && match[1]) {
        let content = match[1].trim();
        content = cleanSectionContent(content);
        if (content.length > 10) {
          return content;
        }
      }
    }
    
    // Strategy 2: Look for bullet point sections
    for (const keyword of keywords) {
      const bulletPattern = new RegExp(`${keyword}\\s*:?\\s*\\n([^]*?)(?=\\n\\s*(?:cons?|pros?|advantages?|disadvantages?|market|investment|red flags?)\\s*:|\\n\\n|$)`, 'i');
      const match = text.match(bulletPattern);
      if (match && match[1]) {
        let content = match[1].trim();
        content = cleanSectionContent(content);
        if (content.length > 10) {
          return content;
        }
      }
    }
    
    // Strategy 3: Look for inline mentions
    for (const keyword of keywords) {
      const inlinePattern = new RegExp(`(?:${keyword})\\s*(?:include|are)?:?\\s*([^.]*(?:\\.[^.]*){0,2})`, 'i');
      const match = text.match(inlinePattern);
      if (match && match[1]) {
        let content = match[1].trim();
        content = cleanSectionContent(content);
        if (content.length > 20) {
          return content;
        }
      }
    }
    
    return null;
  }
  
  function cleanSectionContent(content) {
    return content
      .replace(/^\*\*.*?\*\*\s*/gm, '') // Remove markdown headers
      .replace(/^[•\-\*]\s*/gm, '') // Remove bullet points
      .replace(/\n+/g, ' ') // Replace newlines with spaces
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/^[:\s]+/, '') // Remove leading colons and spaces
      .trim();
  }
  
  // Extract sections using improved logic
  const sections = {
    pros: ['pros', 'advantages', 'positives', 'strengths', 'benefits'],
    cons: ['cons', 'disadvantages', 'negatives', 'concerns', 'weaknesses', 'drawbacks'],
    marketAnalysis: ['market analysis', 'market assessment', 'price evaluation', 'market'],
    investmentPotential: ['investment potential', 'investment analysis', 'investment'],
    redFlags: ['red flags', 'concerns', 'warnings', 'issues', 'problems']
  };
  
  for (const [key, keywords] of Object.entries(sections)) {
    const content = extractSection(key, keywords, responseText);
    if (content) {
      analysis.extractedData[key] = content.substring(0, 500); // Limit length
      console.log(`✅ Extracted ${key} (${content.length} chars):`, content.substring(0, 100) + '...');
    } else {
      console.log(`❌ Failed to extract ${key}`);
    }
  }
  
  console.log('Final extracted data keys:', Object.keys(analysis.extractedData));
  console.log('Final extracted data count:', Object.keys(analysis.extractedData).length);
  
  // Only return analysis if we extracted meaningful property data
  const hasPropertyData = analysis.extractedData.price || 
                         analysis.extractedData.bedrooms || 
                         analysis.extractedData.bathrooms || 
                         analysis.extractedData.squareFeet ||
                         analysis.extractedData.yearBuilt ||
                         analysis.extractedData.propertyType;
  
  if (!hasPropertyData) {
    console.log('⚠️ No meaningful property data extracted, skipping save');
    return null;
  }
  
  console.log('✅ Meaningful property data found, analysis ready for save');
  return analysis;
}

// Function to monitor for new ChatGPT messages with improved detection
function setupResponseMonitor() {
  let lastMessageCount = 0;
  let lastProcessedMessage = '';
  
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
      
      // Skip if we've already processed this exact message
      if (messageText === lastProcessedMessage) {
        return;
      }
      
      // Check if this appears to be a property analysis response
      if (currentPropertyAnalysis && messageText && messageText.length > 100) {
        console.log('Checking message for property analysis content...');
        
        // More comprehensive property analysis detection
        const propertyKeywords = [
          'property', 'analysis', 'listing', 'bedroom', 'bathroom', 'price',
          'sqft', 'square feet', 'built', 'neighborhood', 'market', 'investment',
          'pros', 'cons', 'advantages', 'disadvantages', 'real estate',
          'zillow', 'realtor', 'mls', 'home', 'house', 'condo', 'townhouse'
        ];
        
        const keywordMatches = propertyKeywords.filter(keyword => 
          messageText.toLowerCase().includes(keyword)
        ).length;
        
        console.log(`Found ${keywordMatches} property keywords in response`);
        
        // Require at least 3 property-related keywords for a match
        if (keywordMatches >= 3) {
          console.log('✅ Detected property analysis response');
          const analysisData = extractPropertyAnalysisData(messageText);
          
          if (analysisData && Object.keys(analysisData.extractedData).length > 0) {
            console.log('✅ Successfully extracted analysis data, sending to background...');
            console.log('📊 Extracted data summary:', {
              dataPoints: Object.keys(analysisData.extractedData).length,
              hasPrice: !!analysisData.extractedData.price,
              hasBedrooms: !!analysisData.extractedData.bedrooms,
              hasBathrooms: !!analysisData.extractedData.bathrooms,
              hasSquareFeet: !!analysisData.extractedData.squareFeet,
              keys: Object.keys(analysisData.extractedData)
            });
            
            // Send the analysis data back to the background script
            chrome.runtime.sendMessage({
              action: 'savePropertyAnalysis',
              propertyUrl: currentPropertyAnalysis.url,
              analysisData: analysisData
            }).then(response => {
              console.log('✅ Analysis data sent successfully:', response);
              if (response && response.success) {
                console.log('🎉 Property analysis saved and should now show as analyzed!');
              }
            }).catch(err => {
              console.error('❌ Failed to send analysis data:', err);
            });
            
            // Reset the current analysis tracking
            currentPropertyAnalysis = null;
            lastProcessedMessage = messageText;
          } else {
            console.log('⚠️ No extractable data found in response, response may be incomplete');
            console.log('📝 Response preview:', messageText.substring(0, 300) + '...');
            
            // If response is long enough, it might be complete but just not matching our patterns
            if (messageText.length > 500) {
              console.log('🔄 Response is substantial, will retry extraction in a few seconds...');
              // Don't reset currentPropertyAnalysis yet, allow for retry
            }
          }
        } else if (messageText.length > 200) {
          // If we have a substantial response but not enough keywords, log for debugging
          console.log(`⚠️ Substantial response (${messageText.length} chars) but only ${keywordMatches} property keywords found`);
          console.log('🔍 Keywords found:', propertyKeywords.filter(keyword => 
            messageText.toLowerCase().includes(keyword)
          ));
          console.log('📝 Response preview:', messageText.substring(0, 200) + '...');
        } else {
          console.log('⚠️ Insufficient property keywords, waiting for more content...');
        }
      }
      
      lastMessageCount = messages.length;
    }
  };
  
  // Check for new messages every 1 second (more frequent)
  const intervalId = setInterval(checkForNewMessages, 1000);
  
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
  
  // Cleanup function
  return () => {
    clearInterval(intervalId);
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
  
  // Track this property analysis
  currentPropertyAnalysis = {
    url: propertyLink,
    timestamp: Date.now()
  };
  
  try {
    // Wait for input field to be available
    const inputField = await waitForInputField(5000);
    
    const prompt = `Please analyze this property listing and provide a comprehensive analysis including:

1. Property details (price, size, location, etc.)
2. Market analysis and price evaluation
3. Neighborhood information
4. Pros and cons
5. Investment potential (if applicable)
6. Any red flags or concerns

Property Link: ${propertyLink}

Please visit the link and provide your analysis based on the property information.`;
    
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