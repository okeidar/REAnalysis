// Background script for ChatGPT Helper Extension
console.log('ChatGPT Helper Extension background script loaded');

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log('ChatGPT Helper Extension installed:', details.reason);
  
  if (details.reason === 'install') {
    console.log('Extension installed for the first time');
  } else if (details.reason === 'update') {
    console.log('Extension updated');
  }
});

// Handle tab updates to check if we're on ChatGPT
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const isChatGPT = tab.url.includes('chatgpt.com') || tab.url.includes('chat.openai.com');
    
    // Update extension icon based on whether we're on ChatGPT
    if (isChatGPT) {
      chrome.action.setIcon({
        tabId: tabId,
        path: {
          "16": "icons/icon16.png",
          "32": "icons/icon32.png",
          "48": "icons/icon48.png",
          "128": "icons/icon128.png"
        }
      });
      chrome.action.setTitle({
        tabId: tabId,
        title: "ChatGPT Helper - Active"
      });
    } else {
      // Set a grayed out icon for non-ChatGPT sites
      chrome.action.setIcon({
        tabId: tabId,
        path: {
          "16": "icons/icon16-gray.png",
          "32": "icons/icon32-gray.png", 
          "48": "icons/icon48-gray.png",
          "128": "icons/icon128-gray.png"
        }
      });
      chrome.action.setTitle({
        tabId: tabId,
        title: "ChatGPT Helper - Not available on this site"
      });
    }
  }
});

// Handle messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request);
  
  if (request.action === 'getTabInfo') {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      const currentTab = tabs[0];
      const isChatGPT = currentTab.url && (
        currentTab.url.includes('chatgpt.com') || 
        currentTab.url.includes('chat.openai.com')
      );
      
      sendResponse({
        url: currentTab.url,
        title: currentTab.title,
        isChatGPT: isChatGPT
      });
    });
    return true; // Keep message channel open for async response
  }
  
  // Handle saving property analysis data
  if (request.action === 'savePropertyAnalysis') {
    console.log('Background script saving property analysis:', request.propertyUrl);
    
    (async () => {
      try {
        // Get existing property history
        const result = await chrome.storage.local.get(['propertyHistory']);
        const history = result.propertyHistory || [];
        
        // Find the property entry to update
        const propertyIndex = history.findIndex(item => item.url === request.propertyUrl);
        
        if (propertyIndex !== -1) {
          // Update existing entry with analysis data
          history[propertyIndex].analysis = request.analysisData;
          history[propertyIndex].analysisTimestamp = Date.now();
          
          // Save updated history
          await chrome.storage.local.set({ propertyHistory: history });
          
          console.log('Property analysis data saved successfully');
          sendResponse({ success: true });
        } else {
          console.log('Property not found in history, creating new entry');
          
          // Create new entry with analysis data
          const newEntry = {
            url: request.propertyUrl,
            timestamp: Date.now(),
            date: new Date().toLocaleDateString(),
            domain: new URL(request.propertyUrl).hostname,
            analysis: request.analysisData,
            analysisTimestamp: Date.now()
          };
          
          history.unshift(newEntry);
          
          // Keep only the last 50 entries
          if (history.length > 50) {
            history.splice(50);
          }
          
          await chrome.storage.local.set({ propertyHistory: history });
          
          console.log('New property entry with analysis created');
          sendResponse({ success: true });
        }
        
      } catch (error) {
        console.error('Failed to save property analysis:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    
    return true; // Keep message channel open for async response
  }
});