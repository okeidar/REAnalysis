// Content script for ChatGPT Helper Extension
console.log('ChatGPT Helper Extension loaded on:', window.location.href);

// Check if we're on ChatGPT
function isChatGPTSite() {
  return window.location.hostname === 'chatgpt.com' || 
         window.location.hostname === 'chat.openai.com';
}

// Function to find ChatGPT input field
function findChatGPTInput() {
  // Try different selectors for ChatGPT input
  const selectors = [
    'textarea[data-id="root"]',
    'textarea[placeholder*="Message"]',
    'textarea[placeholder*="message"]',
    'div[contenteditable="true"]',
    '#prompt-textarea',
    'textarea'
  ];
  
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element && element.offsetParent !== null) { // Check if visible
      return element;
    }
  }
  
  return null;
}

// Function to insert text into ChatGPT input
function insertPropertyAnalysisPrompt(propertyLink) {
  const inputField = findChatGPTInput();
  
  if (!inputField) {
    console.error('Could not find ChatGPT input field');
    return false;
  }
  
  const prompt = `Please analyze this property listing and provide a comprehensive analysis including:

1. Property details (price, size, location, etc.)
2. Market analysis and price evaluation
3. Neighborhood information
4. Pros and cons
5. Investment potential (if applicable)
6. Any red flags or concerns

Property Link: ${propertyLink}

Please visit the link and provide your analysis based on the property information.`;
  
  // Insert the text
  if (inputField.tagName === 'TEXTAREA') {
    inputField.value = prompt;
    inputField.dispatchEvent(new Event('input', { bubbles: true }));
  } else if (inputField.contentEditable === 'true') {
    inputField.textContent = prompt;
    inputField.dispatchEvent(new Event('input', { bubbles: true }));
  }
  
  // Focus the input field
  inputField.focus();
  
  // Try to trigger any change events
  inputField.dispatchEvent(new Event('change', { bubbles: true }));
  
  return true;
}

// Function to auto-submit the message (optional)
function submitMessage() {
  // Wait a bit for the input to be processed
  setTimeout(() => {
    // Try to find and click the send button
    const sendButtons = [
      'button[data-testid="send-button"]',
      'button[aria-label*="Send"]',
      'button[title*="Send"]',
      'svg[data-icon="send"]',
      '.send-button'
    ];
    
    for (const selector of sendButtons) {
      const button = document.querySelector(selector);
      if (button) {
        // Find the actual button element if we found an SVG
        const actualButton = button.tagName === 'BUTTON' ? button : button.closest('button');
        if (actualButton && !actualButton.disabled) {
          actualButton.click();
          return true;
        }
      }
    }
    
    // If no send button found, user will need to press Enter or click send manually
    console.log('Send button not found, user needs to send manually');
    return false;
  }, 500);
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
  
  // Listen for messages from popup or background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'checkStatus') {
      sendResponse({
        active: true,
        site: window.location.hostname,
        url: window.location.href
      });
    } else if (request.action === 'analyzeProperty') {
      console.log('Received property analysis request:', request.link);
      
      // Insert the property analysis prompt
      const success = insertPropertyAnalysisPrompt(request.link);
      
      if (success) {
        // Optionally auto-submit (uncomment the next line if desired)
        // submitMessage();
        
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'Could not find input field' });
      }
    }
  });
  
} else {
  console.log('❌ ChatGPT Helper Extension is not active on this site');
}