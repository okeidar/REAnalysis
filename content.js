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
  
  const analysis = {
    fullResponse: responseText,
    extractedData: {},
    timestamp: Date.now()
  };
  
  // Extract key property information using regex patterns
  const patterns = {
    price: /(?:price|cost|asking)[:\s]*\$?([\d,]+(?:\.\d{2})?)/i,
    bedrooms: /(\d+)\s*(?:bed(?:room)?s?|br)/i,
    bathrooms: /(\d+(?:\.\d+)?)\s*(?:bath(?:room)?s?|ba)/i,
    squareFeet: /(\d{1,3}(?:,\d{3})*)\s*(?:sq\.?\s*ft\.?|square\s*feet)/i,
    yearBuilt: /(?:built|year)[:\s]*(\d{4})/i,
    lotSize: /(?:lot|land)[:\s]*(\d+(?:\.\d+)?)\s*(?:acres?|sq\.?\s*ft\.?)/i,
    propertyType: /(?:property\s*type|type)[:\s]*([^.\n]+)/i,
    neighborhood: /(?:neighborhood|area|location)[:\s]*([^.\n]+)/i
  };
  
  // Extract structured data
  for (const [key, pattern] of Object.entries(patterns)) {
    const match = responseText.match(pattern);
    if (match) {
      analysis.extractedData[key] = match[1].trim();
    }
  }
  
  // Extract sections like pros/cons, analysis, etc.
  const sections = {
    pros: /(?:pros?|advantages?|positives?)[:\s]*([^]*?)(?=cons?|disadvantages?|negatives?|investment|market|neighborhood|red flags|\n\n|$)/i,
    cons: /(?:cons?|disadvantages?|negatives?|concerns?)[:\s]*([^]*?)(?=pros?|advantages?|investment|market|neighborhood|red flags|\n\n|$)/i,
    marketAnalysis: /(?:market\s*analysis|price\s*evaluation)[:\s]*([^]*?)(?=neighborhood|pros?|cons?|investment|red flags|\n\n|$)/i,
    investmentPotential: /(?:investment\s*potential)[:\s]*([^]*?)(?=neighborhood|pros?|cons?|market|red flags|\n\n|$)/i,
    redFlags: /(?:red\s*flags?|concerns?|warnings?)[:\s]*([^]*?)(?=neighborhood|pros?|cons?|market|investment|\n\n|$)/i
  };
  
  for (const [key, pattern] of Object.entries(sections)) {
    const match = responseText.match(pattern);
    if (match) {
      analysis.extractedData[key] = match[1].trim().substring(0, 500); // Limit length
    }
  }
  
  return analysis;
}

// Function to monitor for new ChatGPT messages
function setupResponseMonitor() {
  let lastMessageCount = 0;
  
  const checkForNewMessages = () => {
    // Look for ChatGPT response containers
    const messageSelectors = [
      '[data-message-author-role="assistant"]',
      '.message.assistant',
      '.group.assistant',
      '[class*="assistant"]',
      '.prose'
    ];
    
    let messages = [];
    for (const selector of messageSelectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        messages = Array.from(elements);
        break;
      }
    }
    
    if (messages.length > lastMessageCount) {
      const newMessage = messages[messages.length - 1];
      const messageText = newMessage.textContent || newMessage.innerText;
      
      // Check if this appears to be a property analysis response
      if (currentPropertyAnalysis && 
          messageText && 
          (messageText.includes('property') || 
           messageText.includes('analysis') || 
           messageText.includes('listing') ||
           messageText.includes('bedroom') ||
           messageText.includes('bathroom') ||
           messageText.includes('price'))) {
        
        console.log('Detected property analysis response');
        const analysisData = extractPropertyAnalysisData(messageText);
        
        if (analysisData) {
          // Send the analysis data back to the popup/background
          chrome.runtime.sendMessage({
            action: 'savePropertyAnalysis',
            propertyUrl: currentPropertyAnalysis.url,
            analysisData: analysisData
          }).catch(err => console.log('Failed to send analysis data:', err));
        }
        
        // Reset the current analysis tracking
        currentPropertyAnalysis = null;
      }
      
      lastMessageCount = messages.length;
    }
  };
  
  // Check for new messages every 2 seconds
  setInterval(checkForNewMessages, 2000);
  
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
              node.querySelector('.message.assistant') ||
              node.querySelector('.group.assistant') ||
              node.matches('[data-message-author-role="assistant"]') ||
              node.matches('.message.assistant') ||
              node.matches('.group.assistant')
            );
            if (hasMessageClass) {
              shouldCheck = true;
              break;
            }
          }
        }
      }
    });
    
    if (shouldCheck) {
      setTimeout(checkForNewMessages, 1000); // Delay to allow content to fully load
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
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