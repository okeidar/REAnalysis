// Popup script for ChatGPT Helper Extension

// DOM elements
let propertyHistoryList, clearHistoryBtn, exportHistoryBtn, propertyUrlInput, analyzeBtn, 
    statusElement, propertySection, siteInfoElement, connectionStatus;

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 ChatGPT Helper popup loaded');
  
  // Get DOM elements
  propertyHistoryList = document.getElementById('property-history-list');
  clearHistoryBtn = document.getElementById('clear-history-btn');
  exportHistoryBtn = document.getElementById('export-history-btn');
  propertyUrlInput = document.getElementById('property-url-input');
  analyzeBtn = document.getElementById('analyze-btn');
  statusElement = document.getElementById('status');
  propertySection = document.querySelector('.property-section');
  siteInfoElement = document.getElementById('site-info');
  connectionStatus = document.getElementById('connection-status');

  // Set up event listeners
  if (clearHistoryBtn) clearHistoryBtn.addEventListener('click', clearPropertyHistory);
  if (exportHistoryBtn) exportHistoryBtn.addEventListener('click', exportPropertyHistory);
  if (analyzeBtn) analyzeBtn.addEventListener('click', handleAnalyzeClick);

  // Set up storage change listener for real-time updates
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.propertyHistory) {
      console.log('📊 Property history updated, refreshing display');
      const newHistory = changes.propertyHistory.newValue || [];
      displayPropertyHistory(newHistory);
    }
  });

  // Load initial data
  await loadPropertyHistory();
  await checkSiteStatus();
  
  // Set up periodic refresh for pending analyses
  setInterval(async () => {
    await loadPropertyHistory();
  }, 5000); // Refresh every 5 seconds to catch pending -> analyzed transitions
});

// Function to save property to history
async function savePropertyToHistory(url) {
  try {
    const result = await chrome.storage.local.get(['propertyHistory']);
    const history = result.propertyHistory || [];
    
    // Check if property already exists
    const existingIndex = history.findIndex(item => item.url === url);
    if (existingIndex !== -1) {
      console.log('Property already exists in history');
      return;
    }
    
    // Create new property entry
    const newProperty = {
      url: url,
      timestamp: Date.now(),
      date: new Date().toLocaleDateString(),
      domain: new URL(url).hostname,
      analysis: null // Will be populated when ChatGPT responds
    };
    
    // Add to beginning of array
    history.unshift(newProperty);
    
    // Keep only the last 50 entries
    if (history.length > 50) {
      history.splice(50);
    }
    
    await chrome.storage.local.set({ propertyHistory: history });
    console.log('✅ Property saved to history');
    
  } catch (error) {
    console.error('Failed to save property to history:', error);
  }
}

// Function to load and display property history
async function loadPropertyHistory() {
  try {
    const result = await chrome.storage.local.get(['propertyHistory']);
    const history = result.propertyHistory || [];
    
    displayPropertyHistory(history);
  } catch (error) {
    console.error('Failed to load property history:', error);
  }
}

function displayPropertyHistory(history) {
  if (!propertyHistoryList) return;
  
  if (history.length === 0) {
    propertyHistoryList.innerHTML = '<div class="empty-history">No properties analyzed yet.</div>';
    return;
  }
  
  const historyHTML = history.map((item, index) => {
    const hasAnalysis = item.analysis && item.analysis.extractedData && 
                       Object.keys(item.analysis.extractedData).length > 0;
    const analysisPreview = hasAnalysis ? generateAnalysisPreview(item.analysis) : '';
    const analysisStatus = hasAnalysis ? 'analyzed' : 'pending';
    
    // Add timestamp info for debugging
    const debugInfo = item.analysisTimestamp ? 
      `Analysis saved: ${new Date(item.analysisTimestamp).toLocaleTimeString()}` : 
      'No analysis timestamp';
    
    return `
      <div class="history-item ${analysisStatus}" title="${debugInfo}">
        <div class="history-item-header">
          <button class="history-item-remove" data-index="${index}" title="Remove">×</button>
          <a href="${item.url}" target="_blank" class="history-item-url">${item.domain}</a>
          <div class="history-item-date">${item.date}</div>
          <div class="analysis-status ${analysisStatus}">${hasAnalysis ? '✅ Analyzed' : '⏳ Pending'}</div>
        </div>
        ${analysisPreview}
        ${hasAnalysis ? `<button class="view-analysis-btn" data-index="${index}">View Full Analysis</button>` : ''}
      </div>
    `;
  }).join('');
  
  propertyHistoryList.innerHTML = historyHTML;
  
  // Add event listeners for remove buttons
  document.querySelectorAll('.history-item-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.getAttribute('data-index'));
      removePropertyFromHistory(index);
    });
  });
  
  // Add event listeners for view analysis buttons
  document.querySelectorAll('.view-analysis-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.getAttribute('data-index'));
      showFullAnalysis(history[index]);
    });
  });
}

// Function to generate analysis preview
function generateAnalysisPreview(analysis) {
  if (!analysis || !analysis.extractedData) return '';
  
  const data = analysis.extractedData;
  const preview = [];
  
  if (data.price) preview.push(`💰 ${data.price}`);
  if (data.bedrooms) preview.push(`🛏️ ${data.bedrooms} bed`);
  if (data.bathrooms) preview.push(`🚿 ${data.bathrooms} bath`);
  if (data.squareFeet) preview.push(`📐 ${data.squareFeet} sq ft`);
  
  const previewText = preview.join(' • ');
  
  return previewText ? `
    <div class="analysis-preview">
      <div class="analysis-summary">${previewText}</div>
      ${data.pros ? `<div class="analysis-pros">👍 ${data.pros.substring(0, 100)}${data.pros.length > 100 ? '...' : ''}</div>` : ''}
      ${data.cons ? `<div class="analysis-cons">👎 ${data.cons.substring(0, 100)}${data.cons.length > 100 ? '...' : ''}</div>` : ''}
    </div>
  ` : '';
}

// Function to show full analysis in a modal or detailed view
function showFullAnalysis(propertyItem) {
  if (!propertyItem.analysis) return;
  
  const analysis = propertyItem.analysis;
  const data = analysis.extractedData;
  
  // Create modal content
  const modalContent = `
    <div class="analysis-modal-overlay" id="analysisModal">
      <div class="analysis-modal">
        <div class="analysis-modal-header">
          <h3>Property Analysis</h3>
          <button class="analysis-modal-close">×</button>
        </div>
        <div class="analysis-modal-content">
          <div class="property-url">
            <strong>Property:</strong> <a href="${propertyItem.url}" target="_blank">${propertyItem.domain}</a>
          </div>
          
          ${Object.keys(data).length > 0 ? `
            <div class="extracted-data">
              <h4>Property Details</h4>
              ${data.price ? `<div><strong>Price:</strong> $${data.price}</div>` : ''}
              ${data.bedrooms ? `<div><strong>Bedrooms:</strong> ${data.bedrooms}</div>` : ''}
              ${data.bathrooms ? `<div><strong>Bathrooms:</strong> ${data.bathrooms}</div>` : ''}
              ${data.squareFeet ? `<div><strong>Square Feet:</strong> ${data.squareFeet}</div>` : ''}
              ${data.yearBuilt ? `<div><strong>Year Built:</strong> ${data.yearBuilt}</div>` : ''}
              ${data.lotSize ? `<div><strong>Lot Size:</strong> ${data.lotSize}</div>` : ''}
              ${data.propertyType ? `<div><strong>Property Type:</strong> ${data.propertyType}</div>` : ''}
              ${data.neighborhood ? `<div><strong>Neighborhood:</strong> ${data.neighborhood}</div>` : ''}
            </div>
          ` : ''}
          
          ${data.pros ? `
            <div class="analysis-section">
              <h4>Pros</h4>
              <p>${data.pros}</p>
            </div>
          ` : ''}
          
          ${data.cons ? `
            <div class="analysis-section">
              <h4>Cons</h4>
              <p>${data.cons}</p>
            </div>
          ` : ''}
          
          ${data.marketAnalysis ? `
            <div class="analysis-section">
              <h4>Market Analysis</h4>
              <p>${data.marketAnalysis}</p>
            </div>
          ` : ''}
          
          ${data.investmentPotential ? `
            <div class="analysis-section">
              <h4>Investment Potential</h4>
              <p>${data.investmentPotential}</p>
            </div>
          ` : ''}
          
          ${data.redFlags ? `
            <div class="analysis-section red-flags">
              <h4>Red Flags</h4>
              <p>${data.redFlags}</p>
            </div>
          ` : ''}
          
          <div class="full-response">
            <h4>Full ChatGPT Response</h4>
            <div class="response-text">${analysis.fullResponse.replace(/\n/g, '<br>')}</div>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Add modal to page
  document.body.insertAdjacentHTML('beforeend', modalContent);
  
  // Add close functionality
  const modal = document.getElementById('analysisModal');
  const closeBtn = modal.querySelector('.analysis-modal-close');
  
  closeBtn.addEventListener('click', () => {
    modal.remove();
  });
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

async function removePropertyFromHistory(index) {
  try {
    const result = await chrome.storage.local.get(['propertyHistory']);
    const history = result.propertyHistory || [];
    
    history.splice(index, 1);
    
    await chrome.storage.local.set({ propertyHistory: history });
    console.log('✅ Property removed from history');
  } catch (error) {
    console.error('Failed to remove property from history:', error);
  }
}

async function clearPropertyHistory() {
  try {
    await chrome.storage.local.set({ propertyHistory: [] });
    console.log('✅ Property history cleared');
  } catch (error) {
    console.error('Failed to clear property history:', error);
    showError('Failed to clear history');
  }
}

function exportPropertyHistory() {
  chrome.storage.local.get(['propertyHistory'], (result) => {
    const history = result.propertyHistory || [];
    
    if (history.length === 0) {
      showError('No properties to export');
      return;
    }
    
    // Create CSV with analysis data
    const headers = [
      'URL', 'Domain', 'Date', 'Analysis Status', 'Price', 'Bedrooms', 'Bathrooms', 
      'Square Feet', 'Year Built', 'Property Type', 'Neighborhood', 'Pros', 'Cons', 
      'Market Analysis', 'Investment Potential', 'Red Flags', 'Full Analysis'
    ];
    
    const csvRows = history.map(item => {
      const analysis = item.analysis;
      const data = analysis ? analysis.extractedData : {};
      
      return [
        `"${item.url}"`,
        `"${item.domain}"`,
        `"${item.date}"`,
        `"${analysis ? 'Analyzed' : 'Pending'}"`,
        `"${data.price || ''}"`,
        `"${data.bedrooms || ''}"`,
        `"${data.bathrooms || ''}"`,
        `"${data.squareFeet || ''}"`,
        `"${data.yearBuilt || ''}"`,
        `"${data.propertyType || ''}"`,
        `"${data.neighborhood || ''}"`,
        `"${data.pros ? data.pros.replace(/"/g, '""') : ''}"`,
        `"${data.cons ? data.cons.replace(/"/g, '""') : ''}"`,
        `"${data.marketAnalysis ? data.marketAnalysis.replace(/"/g, '""') : ''}"`,
        `"${data.investmentPotential ? data.investmentPotential.replace(/"/g, '""') : ''}"`,
        `"${data.redFlags ? data.redFlags.replace(/"/g, '""') : ''}"`,
        `"${analysis ? analysis.fullResponse.replace(/"/g, '""').substring(0, 1000) : ''}"`
      ].join(',');
    });
    
    const csvContent = headers.join(',') + '\n' + csvRows.join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `property-analysis-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showSuccess('Property analysis data exported!');
  });
}

// Helper function to validate property link
function isValidPropertyLink(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    // Common property websites
    const propertyDomains = [
      'zillow.com',
      'realtor.com',
      'redfin.com',
      'homes.com',
      'trulia.com',
      'apartments.com',
      'rent.com',
      'hotpads.com',
      'padmapper.com',
      'loopnet.com',
      'yad2.co.il',
      'madlan.co.il',
      'spitogatos.gr',
      'zoopla.co.uk',
      'rightmove.co.uk',
      'homestra.com',
      'boligportal.dk',
      'lejebolig.dk',
      'zyprus.com',
      'bazaraki.com'
    ];
    
    return propertyDomains.some(domain => hostname.includes(domain));
  } catch (e) {
    return false;
  }
}

// Function to send message with retry logic
function sendMessageWithRetry(message, maxRetries = 3, delay = 1000) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    
    function attemptSend() {
      attempts++;
      console.log(`Attempt ${attempts} to send message:`, message);
      
      if (!currentTab) {
        reject(new Error('No active tab found'));
        return;
      }
      
      chrome.tabs.sendMessage(currentTab.id, message, function(response) {
        if (chrome.runtime.lastError) {
          console.log(`Attempt ${attempts} failed:`, chrome.runtime.lastError.message);
          
          if (attempts < maxRetries) {
            setTimeout(attemptSend, delay);
          } else {
            reject(new Error(chrome.runtime.lastError.message));
          }
        } else {
          console.log(`Attempt ${attempts} succeeded:`, response);
          resolve(response);
        }
      });
    }
    
    attemptSend();
  });
}

// Function to inject content script if needed
function injectContentScript() {
  return new Promise((resolve, reject) => {
    if (!currentTab) {
      reject(new Error('No active tab'));
      return;
    }
    
    // Check if we're on ChatGPT
    const isChatGPT = currentTab.url && (
      currentTab.url.includes('chatgpt.com') || 
      currentTab.url.includes('chat.openai.com')
    );
    
    if (!isChatGPT) {
      reject(new Error('Not on ChatGPT'));
      return;
    }
    
    // Try to inject the content script
    chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      files: ['content.js']
    }, function() {
      if (chrome.runtime.lastError) {
        // Content script might already be injected, that's okay
        console.log('Content script injection result:', chrome.runtime.lastError.message);
      }
      
      // Wait a bit for the script to initialize
      setTimeout(() => {
        resolve();
      }, 500);
    });
  });
}

// Property history button event listeners
// clearHistoryBtn.addEventListener('click', async function() {
//   if (confirm('Are you sure you want to clear all property history?')) {
//     await clearPropertyHistory();
//   }
// });
  
// exportHistoryBtn.addEventListener('click', function() {
//   exportPropertyHistory();
// });
  
// Paste button functionality
// pasteBtn.addEventListener('click', async function() {
//   try {
//     const text = await navigator.clipboard.readText();
//     propertyLinkInput.value = text;
//     showSuccess('Link pasted successfully!');
//   } catch (err) {
//     showError('Unable to paste from clipboard. Please paste manually.');
//   }
// });
  
// Analyze button functionality
// analyzeBtn.addEventListener('click', async function() {
//   const link = propertyLinkInput.value.trim();
  
//   if (!link) {
//     showError('Please enter a property link first.');
//     return;
//   }
  
//   if (!isValidPropertyLink(link)) {
//     showError('Please enter a valid property link (Zillow, Realtor.com, etc.)');
//     return;
//   }
  
//   // Disable button while processing
//   analyzeBtn.disabled = true;
//   analyzeBtn.textContent = '🔄 Analyzing...';
  
//   try {
//     // First ensure content script is ready
//     if (!contentScriptReady) {
//       console.log('Content script not ready, attempting to inject...');
//       await injectContentScript();
//     }
    
//     // Send message to content script with retry logic
//     const response = await sendMessageWithRetry({
//       action: 'analyzeProperty',
//       link: link
//     });
    
//     if (response && response.success) {
//       // Save property to history
//       await savePropertyToHistory(link);
//       showSuccess('Property link sent to ChatGPT for analysis!');
//       propertyLinkInput.value = ''; // Clear the input
//     } else {
//       throw new Error(response?.error || 'Failed to send property link to ChatGPT.');
//     }
    
//   } catch (error) {
//     console.error('Analysis failed:', error);
//     showError(`Unable to communicate with ChatGPT: ${error.message}`);
//   } finally {
//     analyzeBtn.disabled = false;
//     analyzeBtn.textContent = '🔍 Analyze';
//   }
// });
  
// Initialize popup
async function initializePopup() {
  try {
    // Get current tab
    const tabs = await new Promise((resolve) => {
      chrome.tabs.query({active: true, currentWindow: true}, resolve);
    });
    
    currentTab = tabs[0];
    
    if (!currentTab) {
      throw new Error('No active tab found');
    }
    
    console.log('Current tab:', currentTab.url);
    
    // Check if we're on ChatGPT
    const isChatGPT = currentTab.url && (
      currentTab.url.includes('chatgpt.com') || 
      currentTab.url.includes('chat.openai.com')
    );
    
    if (isChatGPT) {
      // Try to communicate with content script
      try {
        const response = await sendMessageWithRetry({action: 'checkStatus'}, 2, 500);
        
        if (response && response.active) {
          // Content script is active
          statusElement.className = 'status active';
          statusElement.textContent = '✅ Active on ChatGPT';
          contentScriptReady = true;
          
          // Show site info
          infoElement.style.display = 'block';
          siteElement.textContent = response.site;
          urlElement.textContent = response.url;
          
          // Show property link section
          propertyLinkSection.style.display = 'block';
          
          // Show and load property history section
          propertyHistorySection.style.display = 'block';
          await loadPropertyHistory();
          
        } else {
          throw new Error('Content script not responding properly');
        }
        
      } catch (error) {
        console.log('Content script communication failed, will try to inject:', error.message);
        
        // Content script might not be loaded, show as active anyway since we're on ChatGPT
        statusElement.className = 'status active';
        statusElement.textContent = '✅ Active on ChatGPT (initializing...)';
        
        // Show site info
        infoElement.style.display = 'block';
        siteElement.textContent = new URL(currentTab.url).hostname;
        urlElement.textContent = currentTab.url;
        
        // Show property link section
        propertyLinkSection.style.display = 'block';
        
        // Show and load property history section
        propertyHistorySection.style.display = 'block';
        await loadPropertyHistory();
        
        // Try to inject content script
        try {
          await injectContentScript();
          contentScriptReady = true;
          statusElement.textContent = '✅ Active on ChatGPT';
        } catch (injectError) {
          console.error('Failed to inject content script:', injectError);
        }
      }
      
    } else {
      // Not on ChatGPT
      statusElement.className = 'status inactive';
      statusElement.textContent = '❌ Not available on this site';
      
      // Show site info
      infoElement.style.display = 'block';
      siteElement.textContent = new URL(currentTab.url).hostname;
      urlElement.textContent = currentTab.url;
    }
    
  } catch (error) {
    console.error('Failed to initialize popup:', error);
    statusElement.className = 'status inactive';
    statusElement.textContent = '⚠️ Unable to check status';
  }
}
  
// Initialize the popup
// initializePopup();

// Helper functions for UI
function showSuccess(message) {
  console.log('✅ Success:', message);
  // You can implement a toast notification here if needed
}

function showError(message) {
  console.error('❌ Error:', message);
  // You can implement a toast notification here if needed
}

// Function to handle analyze button click
async function handleAnalyzeClick() {
  if (!propertyUrlInput) return;
  
  const link = propertyUrlInput.value.trim();
  
  if (!link) {
    showError('Please enter a property link first.');
    return;
  }
  
  if (!isValidPropertyLink(link)) {
    showError('Please enter a valid property link (Zillow, Realtor.com, etc.)');
    return;
  }
  
  // Disable button while processing
  if (analyzeBtn) {
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = '🔄 Analyzing...';
  }
  
  try {
    // Get current tab
    const tabs = await new Promise((resolve) => {
      chrome.tabs.query({active: true, currentWindow: true}, resolve);
    });
    
    const currentTab = tabs[0];
    if (!currentTab) {
      throw new Error('No active tab found');
    }
    
    // Check if we're on ChatGPT
    const isChatGPT = currentTab.url && (
      currentTab.url.includes('chatgpt.com') || 
      currentTab.url.includes('chat.openai.com')
    );
    
    if (!isChatGPT) {
      throw new Error('Please navigate to ChatGPT first');
    }
    
    // Send message to content script
    const response = await chrome.tabs.sendMessage(currentTab.id, {
      action: 'analyzeProperty',
      link: link
    });
    
    if (response && response.success) {
      // Save property to history
      await savePropertyToHistory(link);
      showSuccess('Property link sent to ChatGPT for analysis!');
      if (propertyUrlInput) propertyUrlInput.value = ''; // Clear the input
    } else {
      throw new Error(response?.error || 'Failed to send property link to ChatGPT.');
    }
    
  } catch (error) {
    console.error('Analysis failed:', error);
    showError(`Unable to communicate with ChatGPT: ${error.message}`);
  } finally {
    if (analyzeBtn) {
      analyzeBtn.disabled = false;
      analyzeBtn.textContent = '🔍 Analyze';
    }
  }
}

// Function to check site status
async function checkSiteStatus() {
  try {
    const tabs = await new Promise((resolve) => {
      chrome.tabs.query({active: true, currentWindow: true}, resolve);
    });
    
    const currentTab = tabs[0];
    if (!currentTab) return;
    
    const isChatGPT = currentTab.url && (
      currentTab.url.includes('chatgpt.com') || 
      currentTab.url.includes('chat.openai.com')
    );
    
    if (statusElement) {
      if (isChatGPT) {
        statusElement.className = 'status active';
        statusElement.textContent = '✅ Active on ChatGPT';
        
        if (propertySection) {
          propertySection.style.display = 'block';
        }
      } else {
        statusElement.className = 'status inactive';
        statusElement.textContent = '❌ Not available on this site';
        
        if (propertySection) {
          propertySection.style.display = 'none';
        }
      }
    }
    
    if (siteInfoElement) {
      siteInfoElement.textContent = `Site: ${new URL(currentTab.url).hostname}`;
    }
    
  } catch (error) {
    console.error('Failed to check site status:', error);
    if (statusElement) {
      statusElement.className = 'status inactive';
      statusElement.textContent = '⚠️ Unable to check status';
    }
  }
}