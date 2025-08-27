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
  
  // Utility function to handle large analysis responses
  function compressAnalysisData(analysisData, maxSize = 2 * 1024 * 1024) { // 2MB limit
    const fullDataSize = JSON.stringify(analysisData).length;
    
    if (fullDataSize <= maxSize) {
      return analysisData; // No compression needed
    }
    
    console.log('📦 Compressing analysis data:', {
      originalSize: fullDataSize,
      maxSize: maxSize,
      needsCompression: true
    });
    
    // Create compressed version
    const compressed = { ...analysisData };
    
    if (compressed.fullResponse && compressed.fullResponse.length > 10000) {
      // Keep first 5000 and last 5000 characters
      const original = compressed.fullResponse;
      compressed.fullResponse = original.substring(0, 5000) + 
        '\n\n... [Analysis truncated due to size limits] ...\n\n' + 
        original.substring(original.length - 5000);
      compressed.truncated = true;
      compressed.originalLength = original.length;
    }
    
    if (compressed.fullAnalysis && compressed.fullAnalysis !== compressed.fullResponse) {
      // Same compression for fullAnalysis
      const original = compressed.fullAnalysis;
      compressed.fullAnalysis = original.substring(0, 5000) + 
        '\n\n... [Analysis truncated due to size limits] ...\n\n' + 
        original.substring(original.length - 5000);
    }
    
    const compressedSize = JSON.stringify(compressed).length;
    console.log('📦 Compression complete:', {
      originalSize: fullDataSize,
      compressedSize: compressedSize,
      compressionRatio: ((fullDataSize - compressedSize) / fullDataSize * 100).toFixed(1) + '%'
    });
    
    return compressed;
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
      extractedDataCount: Object.keys(request.analysisData?.extractedData || {}).length
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
          
          // Compress analysis data if needed
          const compressedAnalysisData = compressAnalysisData(request.analysisData);
          
          history[propertyIndex].analysis = compressedAnalysisData;
          history[propertyIndex].analysisTimestamp = Date.now();
          history[propertyIndex].sessionId = request.sessionId;
          
          // Check storage size before saving
          const dataToSave = { propertyHistory: history };
          const dataSize = JSON.stringify(dataToSave).length;
          console.log('💾 Storage size check:', {
            historyEntries: history.length,
            dataSize: dataSize,
            dataSizeMB: (dataSize / 1024 / 1024).toFixed(2),
            analysisSize: JSON.stringify(request.analysisData).length,
            fullResponseLength: request.analysisData?.fullResponse?.length || 0
          });
          
          if (dataSize > 4 * 1024 * 1024) { // 4MB warning threshold
            console.warn('⚠️ Storage approaching quota limit:', (dataSize / 1024 / 1024).toFixed(2) + 'MB');
          }
          
          // Save updated history
          try {
            await chrome.storage.local.set({ propertyHistory: history });
          } catch (storageError) {
            console.error('❌ Storage error while saving:', storageError);
            if (storageError.message && storageError.message.includes('QUOTA_EXCEEDED')) {
              console.error('💾 QUOTA EXCEEDED: Analysis data too large for storage');
              // Try saving without fullResponse to reduce size
              const compactAnalysisData = { ...request.analysisData };
              delete compactAnalysisData.fullResponse;
              delete compactAnalysisData.fullAnalysis;
              history[propertyIndex].analysis = compactAnalysisData;
              await chrome.storage.local.set({ propertyHistory: history });
              console.log('✅ Saved analysis without full text due to quota limits');
            } else {
              throw storageError;
            }
          }
          
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
          
          // Compress analysis data if needed
          const compressedAnalysisData = compressAnalysisData(request.analysisData);
          
          // Create new entry with analysis data
          const newEntry = {
            url: request.propertyUrl,
            timestamp: Date.now(),
            date: new Date().toLocaleDateString(),
            domain: new URL(request.propertyUrl).hostname,
            analysis: compressedAnalysisData,
            analysisTimestamp: Date.now(),
            sessionId: request.sessionId
          };
          
          history.unshift(newEntry);
          
          // Keep only the last 50 entries
          if (history.length > 50) {
            history.splice(50);
          }
          
          // Check storage size before saving
          const dataToSave = { propertyHistory: history };
          const dataSize = JSON.stringify(dataToSave).length;
          console.log('💾 Storage size check (new entry):', {
            historyEntries: history.length,
            dataSize: dataSize,
            dataSizeMB: (dataSize / 1024 / 1024).toFixed(2),
            analysisSize: JSON.stringify(request.analysisData).length,
            fullResponseLength: request.analysisData?.fullResponse?.length || 0
          });
          
          if (dataSize > 4 * 1024 * 1024) { // 4MB warning threshold
            console.warn('⚠️ Storage approaching quota limit:', (dataSize / 1024 / 1024).toFixed(2) + 'MB');
          }
          
          try {
            await chrome.storage.local.set({ propertyHistory: history });
          } catch (storageError) {
            console.error('❌ Storage error while saving new entry:', storageError);
            if (storageError.message && storageError.message.includes('QUOTA_EXCEEDED')) {
              console.error('💾 QUOTA EXCEEDED: Analysis data too large for storage');
              // Try saving without fullResponse to reduce size
              const compactAnalysisData = { ...request.analysisData };
              delete compactAnalysisData.fullResponse;
              delete compactAnalysisData.fullAnalysis;
              newEntry.analysis = compactAnalysisData;
              await chrome.storage.local.set({ propertyHistory: history });
              console.log('✅ Saved new entry without full text due to quota limits');
            } else {
              throw storageError;
            }
          }
          
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