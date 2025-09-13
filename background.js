// Background script for ChatGPT Helper Extension
console.log('ChatGPT Helper Extension background script loaded');

// Handle installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log('ChatGPT Helper Extension installed:', details.reason);
  
  // Set initial badge with error handling
  try {
    if (chrome.action && chrome.action.setBadgeText) {
      chrome.action.setBadgeText({ text: '' });
    }
  } catch (error) {
    console.log('Could not set initial badge text:', error.message);
  }
});

// Handle tab updates to check if we're on ChatGPT
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const isChatGPT = tab.url.includes('chatgpt.com') || tab.url.includes('chat.openai.com');
    
    // Update extension icon based on whether we're on ChatGPT
    try {
      if (isChatGPT) {
        // Set active icon for ChatGPT sites
        if (chrome.action && chrome.action.setIcon) {
          chrome.action.setIcon({
            tabId: tabId,
            path: {
              "16": "icons/icon16.png",
              "48": "icons/icon48.png",
              "128": "icons/icon128.png"
            }
          }).catch(() => {
            // Fallback if custom icons aren't available
            console.log('Custom icons not found, using default');
          });
        }
        
        if (chrome.action && chrome.action.setBadgeText) {
          chrome.action.setBadgeText({
            tabId: tabId,
            text: ''
          }).catch(() => {
            console.log('Could not set badge text for tab', tabId);
          });
        }
        
        if (chrome.action && chrome.action.setTitle) {
          chrome.action.setTitle({
            tabId: tabId,
            title: "RE Analyzer - Active"
          }).catch(() => {
            console.log('Could not set title for tab', tabId);
          });
        }
      } else {
        // Set a grayed out icon for non-ChatGPT sites
        if (chrome.action && chrome.action.setIcon) {
          chrome.action.setIcon({
            tabId: tabId,
            path: {
              "16": "icons/icon16-inactive.png",
              "48": "icons/icon48-inactive.png",
              "128": "icons/icon128-inactive.png"
            }
          }).catch(() => {
            // Fallback if custom icons aren't available
            console.log('Custom inactive icons not found, using default');
          });
        }
        
        if (chrome.action && chrome.action.setBadgeText) {
          chrome.action.setBadgeText({
            tabId: tabId,
            text: ''
          }).catch(() => {
            console.log('Could not set badge text for tab', tabId);
          });
        }
        
        if (chrome.action && chrome.action.setTitle) {
          chrome.action.setTitle({
            tabId: tabId,
            title: "RE Analyzer - Not available on this site"
          }).catch(() => {
            console.log('Could not set title for tab', tabId);
          });
        }
      }
    } catch (error) {
      console.log('Error updating extension UI:', error.message);
    }
  }
});

// Handle extension icon clicks (since we don't have a popup)
chrome.action.onClicked.addListener((tab) => {
  console.log('Extension icon clicked');
  
  // Check if we're already on ChatGPT
  const isChatGPT = tab.url && (tab.url.includes('chatgpt.com') || tab.url.includes('chat.openai.com'));
  
  if (isChatGPT) {
    // If on ChatGPT, send message to content script to toggle the embedded UI
    chrome.tabs.sendMessage(tab.id, { action: 'toggleEmbeddedUI' })
      .catch(error => {
        console.log('Could not communicate with content script:', error.message);
      });
  } else {
    // If not on ChatGPT, open ChatGPT in a new tab
    chrome.tabs.create({ url: 'https://chatgpt.com' });
  }
});

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request.action);
  
  // Handle popup requesting current tab info
  if (request.action === 'getCurrentTab') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const currentTab = tabs[0];
      const isChatGPT = currentTab.url && (
        currentTab.url.includes('chatgpt.com') || 
        currentTab.url.includes('chat.openai.com')
      );
      
      sendResponse({
        tab: currentTab,
        isChatGPT: isChatGPT
      });
    });
    return true; // Keep message channel open for async response
  }
  
  // Handle saving property analysis data with enhanced logging
  if (request.action === 'savePropertyAnalysis') {
    console.log('🔄 Background script saving property analysis for:', request.propertyUrl);
    console.log('🔍 Session ID:', request.sessionId);
    console.log('📊 Analysis data received:', {
      sessionId: request.sessionId,
      hasFullResponse: !!request.analysisData?.fullResponse,
      responseLength: request.analysisData?.fullResponse?.length || 0,
      extractedDataKeys: Object.keys(request.analysisData?.extractedData || {}),
      extractedDataCount: Object.keys(request.analysisData?.extractedData || {}).length,
      promptType: request.analysisData?.promptType || 'unknown'
    });
    
    (async () => {
      try {
        // Get existing property history
        const result = await chrome.storage.local.get(['propertyHistory']);
        const history = result.propertyHistory || [];
        console.log(`📚 Current history has ${history.length} entries`);
        
        // Find the property entry to update
        const propertyIndex = history.findIndex(item => item.url === request.propertyUrl);
        console.log(`🔍 Property index in history: ${propertyIndex}`);
        
        if (propertyIndex !== -1) {
          // Update existing entry with analysis data
          const oldEntry = { ...history[propertyIndex] };
          history[propertyIndex].analysis = request.analysisData;
          history[propertyIndex].analysisTimestamp = Date.now();
          history[propertyIndex].sessionId = request.sessionId;
          
          // Save updated history
          await chrome.storage.local.set({ propertyHistory: history });
          
          console.log('✅ Property analysis data saved successfully');
          console.log('📝 Updated entry:', {
            url: history[propertyIndex].url,
            hadAnalysisBefore: !!oldEntry.analysis,
            hasAnalysisNow: !!history[propertyIndex].analysis,
            extractedKeys: Object.keys(history[propertyIndex].analysis?.extractedData || {})
          });
          sendResponse({ success: true, updated: true });
        } else {
          console.log('⚠️ Property not found in history, creating new entry');
          
          // Create new entry with analysis data
          const newEntry = {
            url: request.propertyUrl,
            timestamp: Date.now(),
            date: new Date().toLocaleDateString(),
            domain: new URL(request.propertyUrl).hostname,
            analysis: request.analysisData,
            analysisTimestamp: Date.now(),
            sessionId: request.sessionId
          };
          
          history.unshift(newEntry);
          
          // Keep only the last 50 entries
          if (history.length > 50) {
            history.splice(50);
          }
          
          await chrome.storage.local.set({ propertyHistory: history });
          
          console.log('✅ New property entry with analysis created');
          console.log('📝 New entry:', {
            url: newEntry.url,
            domain: newEntry.domain,
            hasAnalysis: !!newEntry.analysis,
            extractedKeys: Object.keys(newEntry.analysis?.extractedData || {})
          });
          sendResponse({ success: true, created: true });
        }
        
        // Verify the save was successful
        const verificationResult = await chrome.storage.local.get(['propertyHistory']);
        const verificationHistory = verificationResult.propertyHistory || [];
        const verificationEntry = verificationHistory.find(item => item.url === request.propertyUrl);
        
        if (verificationEntry && verificationEntry.analysis) {
          console.log('✅ Save verification successful - analysis data is present');
        } else {
          console.error('❌ Save verification failed - analysis data is missing');
        }
        
      } catch (error) {
        console.error('❌ Failed to save property analysis:', error);
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          propertyUrl: request.propertyUrl,
          hasAnalysisData: !!request.analysisData
        });
        sendResponse({ success: false, error: error.message });
      }
    })();
    
    return true; // Keep message channel open for async response
  }
});