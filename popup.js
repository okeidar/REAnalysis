// Popup script for RE Analyzer Extension

// DOM elements
let propertyHistoryList, clearHistoryBtn, exportHistoryBtn, propertyUrlInput, analyzeBtn, 
    statusElement, propertySection, siteInfoElement, connectionStatus, pasteBtn,
    successMessage, errorMessage, propertyLinkSection, infoElement, siteElement, urlElement,
    propertyHistorySection, settingsSection, settingsToggle, settingsContent,
    customPromptTextarea, savePromptBtn, resetPromptBtn, showDefaultBtn, defaultPromptDisplay,
    columnConfigList, selectAllColumnsBtn, deselectAllColumnsBtn, resetColumnsBtn,
    saveColumnsBtn, previewColumnsBtn, togglePromptBtn, promptContent,
    toggleCustomColumnBtn, customColumnForm, customColumnName, customColumnType,
    customColumnDescription, customColumnDefault, addCustomColumnBtn, cancelCustomColumnBtn;

// Global variables
let currentTab = null;
let contentScriptReady = false;

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 RE Analyzer popup loaded');
  
  // Get DOM elements with correct IDs from HTML
  propertyHistoryList = document.getElementById('propertyHistoryList');
  clearHistoryBtn = document.getElementById('clearHistoryBtn');
  exportHistoryBtn = document.getElementById('exportHistoryBtn');
  propertyUrlInput = document.getElementById('propertyLinkInput');
  analyzeBtn = document.getElementById('analyzeBtn');
  pasteBtn = document.getElementById('pasteBtn');
  statusElement = document.getElementById('status');
  successMessage = document.getElementById('successMessage');
  errorMessage = document.getElementById('errorMessage');
  propertyLinkSection = document.getElementById('propertyLinkSection');
  propertyHistorySection = document.getElementById('propertyHistorySection');
  infoElement = document.getElementById('info');
  siteElement = document.getElementById('site');
  urlElement = document.getElementById('url');
  
  // Settings elements
  settingsSection = document.getElementById('settingsCollapsible');
  settingsToggle = document.getElementById('settingsToggle');
  settingsContent = document.getElementById('settingsContent');
  customPromptTextarea = document.getElementById('customPrompt');
  savePromptBtn = document.getElementById('savePromptBtn');
  resetPromptBtn = document.getElementById('resetPromptBtn');
  showDefaultBtn = document.getElementById('showDefaultBtn');
  defaultPromptDisplay = document.getElementById('defaultPromptDisplay');
  
  // Column configuration elements
  columnConfigList = document.getElementById('columnConfigList');
  selectAllColumnsBtn = document.getElementById('selectAllColumnsBtn');
  deselectAllColumnsBtn = document.getElementById('deselectAllColumnsBtn');
  resetColumnsBtn = document.getElementById('resetColumnsBtn');
  saveColumnsBtn = document.getElementById('saveColumnsBtn');
  previewColumnsBtn = document.getElementById('previewColumnsBtn');
  togglePromptBtn = document.getElementById('togglePromptBtn');
  promptContent = document.getElementById('promptContent');
  
  // Custom column elements
  toggleCustomColumnBtn = document.getElementById('toggleCustomColumnBtn');
  customColumnForm = document.getElementById('customColumnForm');
  customColumnName = document.getElementById('customColumnName');
  customColumnType = document.getElementById('customColumnType');
  customColumnDescription = document.getElementById('customColumnDescription');
  customColumnDefault = document.getElementById('customColumnDefault');
  addCustomColumnBtn = document.getElementById('addCustomColumnBtn');
  cancelCustomColumnBtn = document.getElementById('cancelCustomColumnBtn');

  // Set up collapsible functionality
  setupCollapsibles();

  // Set up event listeners
  if (clearHistoryBtn) clearHistoryBtn.addEventListener('click', async function() {
    if (confirm('Are you sure you want to clear all property history?')) {
      await clearPropertyHistory();
    }
  });
  if (exportHistoryBtn) exportHistoryBtn.addEventListener('click', exportPropertyHistory);
  if (analyzeBtn) analyzeBtn.addEventListener('click', handleAnalyzeClick);
  if (pasteBtn) pasteBtn.addEventListener('click', async function() {
    try {
      const text = await navigator.clipboard.readText();
      if (propertyUrlInput) {
        propertyUrlInput.value = text;
        showSuccess('Link pasted successfully!');
      }
    } catch (err) {
      showError('Unable to paste from clipboard. Please paste manually.');
    }
  });

  // Settings event listeners
  if (savePromptBtn) savePromptBtn.addEventListener('click', saveCustomPrompt);
  if (resetPromptBtn) resetPromptBtn.addEventListener('click', resetToDefaultPrompt);
  if (showDefaultBtn) showDefaultBtn.addEventListener('click', toggleDefaultPrompt);
  
  // Column configuration event listeners
  if (selectAllColumnsBtn) selectAllColumnsBtn.addEventListener('click', selectAllColumns);
  if (deselectAllColumnsBtn) deselectAllColumnsBtn.addEventListener('click', deselectAllColumns);
  if (resetColumnsBtn) resetColumnsBtn.addEventListener('click', resetColumnsToDefault);
  if (saveColumnsBtn) saveColumnsBtn.addEventListener('click', saveColumnSettings);
  if (previewColumnsBtn) previewColumnsBtn.addEventListener('click', previewExportColumns);
  
  // Custom column event listeners
  if (addCustomColumnBtn) addCustomColumnBtn.addEventListener('click', addCustomColumn);
  if (cancelCustomColumnBtn) cancelCustomColumnBtn.addEventListener('click', clearCustomColumnForm);

  // Set up storage change listener for real-time updates
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.propertyHistory) {
      console.log('📊 Property history updated, refreshing display');
      const newHistory = changes.propertyHistory.newValue || [];
      displayPropertyHistory(newHistory);
    }
  });

  // Load initial data and check site status
  await loadPropertyHistory();
  await loadCustomPrompt();
  await loadColumnConfiguration();
  await initializePopup();
  
  // Set up periodic refresh for pending analyses
  setInterval(async () => {
    await loadPropertyHistory();
  }, 5000); // Refresh every 5 seconds to catch pending -> analyzed transitions
});

// Collapsible functionality
function setupCollapsibles() {
  const collapsibles = document.querySelectorAll('.collapsible');
  
  collapsibles.forEach(collapsible => {
    const header = collapsible.querySelector('.collapsible-header');
    const content = collapsible.querySelector('.collapsible-content');
    const icon = collapsible.querySelector('.collapsible-icon');
    
    if (header && content) {
      header.addEventListener('click', () => {
        const isExpanded = !content.classList.contains('hidden');
        
        if (isExpanded) {
          content.classList.add('hidden');
          collapsible.classList.remove('expanded');
        } else {
          content.classList.remove('hidden');
          collapsible.classList.add('expanded');
        }
      });
    }
  });
}

// Helper function to show success message
function showSuccess(message) {
  if (successMessage && errorMessage) {
    successMessage.textContent = message;
    successMessage.style.display = 'block';
    errorMessage.style.display = 'none';
    setTimeout(() => {
      successMessage.style.display = 'none';
    }, 3000);
  }
}

// Helper function to show error message
function showError(message) {
  if (errorMessage && successMessage) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    successMessage.style.display = 'none';
    setTimeout(() => {
      errorMessage.style.display = 'none';
    }, 5000);
  }
}

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
    propertyHistoryList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📄</div>
        <p>No properties analyzed yet</p>
      </div>
    `;
    return;
  }
  
  const historyHTML = history.map((item, index) => {
    const hasAnalysis = item.analysis && item.analysis.extractedData && 
                       Object.keys(item.analysis.extractedData).length > 0;
    const analysisPreview = hasAnalysis ? generateAnalysisPreview(item.analysis) : '';
    const analysisStatus = hasAnalysis ? 'analyzed' : 'pending';
    
    return `
      <div class="history-item ${analysisStatus}">
        <div class="history-header">
          <a href="${item.url}" target="_blank" class="history-url">${item.domain}</a>
          <div class="history-status ${analysisStatus}">
            ${hasAnalysis ? '✅ Analyzed' : '⏳ Pending'}
          </div>
        </div>
        ${analysisPreview}
        <div class="history-actions">
          ${hasAnalysis ? `<button class="btn btn-ghost btn-sm view-analysis-btn" data-index="${index}">👁️ View</button>` : ''}
          <button class="btn btn-ghost btn-sm edit-custom-data-btn" data-index="${index}">✏️ Edit</button>
          <button class="btn btn-ghost btn-sm history-item-remove" data-index="${index}">🗑️ Remove</button>
        </div>
        <button class="history-remove" data-index="${index}">×</button>
      </div>
    `;
  }).join('');
  
  propertyHistoryList.innerHTML = historyHTML;
  
  // Add event listeners for remove buttons
  document.querySelectorAll('.history-item-remove, .history-remove').forEach(btn => {
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
  
  // Add event listeners for edit custom data buttons
  document.querySelectorAll('.edit-custom-data-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.getAttribute('data-index'));
      showCustomDataEditor(history[index], index);
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
      ${data.pros ? `<div class="analysis-pros">👍 ${data.pros.substring(0, 80)}${data.pros.length > 80 ? '...' : ''}</div>` : ''}
      ${data.cons ? `<div class="analysis-cons">👎 ${data.cons.substring(0, 80)}${data.cons.length > 80 ? '...' : ''}</div>` : ''}
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
    <div class="analysis-modal-overlay" id="analysisModal" style="
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-lg);
    ">
      <div class="analysis-modal" style="
        background: var(--background);
        border-radius: var(--radius-md);
        max-width: 600px;
        max-height: 80vh;
        width: 100%;
        overflow: hidden;
        box-shadow: var(--shadow-md);
      ">
        <div class="analysis-modal-header" style="
          padding: var(--space-lg);
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: var(--secondary-background);
        ">
          <h3 style="margin: 0; font-size: var(--font-size-xl); color: var(--text-primary);">Property Analysis</h3>
          <button class="analysis-modal-close" style="
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: var(--text-secondary);
            padding: var(--space-sm);
            border-radius: var(--radius-sm);
          ">×</button>
        </div>
        <div class="analysis-modal-content" style="
          padding: var(--space-lg);
          max-height: calc(80vh - 80px);
          overflow-y: auto;
        ">
          <div class="property-url" style="
            margin-bottom: var(--space-md);
            padding: var(--space-md);
            background: #f0f9ff;
            border-radius: var(--radius-sm);
            border-left: 4px solid var(--primary);
          ">
            <strong>Property:</strong> <a href="${propertyItem.url}" target="_blank" style="color: var(--primary);">${propertyItem.domain}</a>
          </div>
          
          ${Object.keys(data).length > 0 ? `
            <div class="extracted-data" style="
              margin-bottom: var(--space-lg);
              padding: var(--space-md);
              background: var(--secondary-background);
              border-radius: var(--radius-sm);
              border: 1px solid var(--border);
            ">
              <h4 style="margin: 0 0 var(--space-md) 0; font-size: var(--font-size-lg); color: var(--text-primary);">Property Details</h4>
              ${data.price ? `<div style="margin: var(--space-xs) 0;"><strong>Price:</strong> $${data.price}</div>` : ''}
              ${data.bedrooms ? `<div style="margin: var(--space-xs) 0;"><strong>Bedrooms:</strong> ${data.bedrooms}</div>` : ''}
              ${data.bathrooms ? `<div style="margin: var(--space-xs) 0;"><strong>Bathrooms:</strong> ${data.bathrooms}</div>` : ''}
              ${data.squareFeet ? `<div style="margin: var(--space-xs) 0;"><strong>Square Feet:</strong> ${data.squareFeet}</div>` : ''}
              ${data.yearBuilt ? `<div style="margin: var(--space-xs) 0;"><strong>Year Built:</strong> ${data.yearBuilt}</div>` : ''}
              ${data.lotSize ? `<div style="margin: var(--space-xs) 0;"><strong>Lot Size:</strong> ${data.lotSize}</div>` : ''}
              ${data.propertyType ? `<div style="margin: var(--space-xs) 0;"><strong>Property Type:</strong> ${data.propertyType}</div>` : ''}
              ${data.neighborhood ? `<div style="margin: var(--space-xs) 0;"><strong>Neighborhood:</strong> ${data.neighborhood}</div>` : ''}
            </div>
          ` : ''}
          
          ${data.pros ? `
            <div class="analysis-section" style="
              margin-bottom: var(--space-lg);
              padding: var(--space-md);
              background: var(--background);
              border-radius: var(--radius-sm);
              border: 1px solid var(--border);
            ">
              <h4 style="margin: 0 0 var(--space-sm) 0; color: #16a34a;">Pros</h4>
              <p style="margin: 0; line-height: 1.5;">${data.pros}</p>
            </div>
          ` : ''}
          
          ${data.cons ? `
            <div class="analysis-section" style="
              margin-bottom: var(--space-lg);
              padding: var(--space-md);
              background: var(--background);
              border-radius: var(--radius-sm);
              border: 1px solid var(--border);
            ">
              <h4 style="margin: 0 0 var(--space-sm) 0; color: #dc2626;">Cons</h4>
              <p style="margin: 0; line-height: 1.5;">${data.cons}</p>
            </div>
          ` : ''}
          
          ${data.marketAnalysis ? `
            <div class="analysis-section" style="
              margin-bottom: var(--space-lg);
              padding: var(--space-md);
              background: var(--background);
              border-radius: var(--radius-sm);
              border: 1px solid var(--border);
            ">
              <h4 style="margin: 0 0 var(--space-sm) 0; color: var(--text-primary);">Market Analysis</h4>
              <p style="margin: 0; line-height: 1.5;">${data.marketAnalysis}</p>
            </div>
          ` : ''}
          
          ${data.investmentPotential ? `
            <div class="analysis-section" style="
              margin-bottom: var(--space-lg);
              padding: var(--space-md);
              background: var(--background);
              border-radius: var(--radius-sm);
              border: 1px solid var(--border);
            ">
              <h4 style="margin: 0 0 var(--space-sm) 0; color: var(--text-primary);">Investment Potential</h4>
              <p style="margin: 0; line-height: 1.5;">${data.investmentPotential}</p>
            </div>
          ` : ''}
          
          ${data.redFlags ? `
            <div class="analysis-section" style="
              margin-bottom: var(--space-lg);
              padding: var(--space-md);
              background: #fef2f2;
              border-radius: var(--radius-sm);
              border: 1px solid #fecaca;
            ">
              <h4 style="margin: 0 0 var(--space-sm) 0; color: #dc2626;">Red Flags</h4>
              <p style="margin: 0; line-height: 1.5;">${data.redFlags}</p>
            </div>
          ` : ''}
          
          <div class="full-response" style="
            margin-top: var(--space-lg);
            padding: var(--space-md);
            background: var(--secondary-background);
            border-radius: var(--radius-sm);
            border: 1px solid var(--border);
          ">
            <h4 style="margin: 0 0 var(--space-md) 0; color: var(--text-primary);">Full ChatGPT Response</h4>
            <div class="response-text" style="
              font-size: var(--font-size-sm);
              line-height: 1.6;
              color: var(--text-secondary);
              max-height: 300px;
              overflow-y: auto;
              padding: var(--space-sm);
              background: var(--background);
              border-radius: var(--radius-sm);
              border: 1px solid var(--border);
            ">${analysis.fullResponse.replace(/\n/g, '<br>')}</div>
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
    showSuccess('History cleared successfully!');
  } catch (error) {
    console.error('Failed to clear property history:', error);
    showError('Failed to clear history');
  }
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
    analyzeBtn.innerHTML = '<div class="spinner"></div> Analyzing...';
  }
  
  try {
    // First ensure content script is ready
    if (!contentScriptReady) {
      console.log('Content script not ready, attempting to inject...');
      await injectContentScript();
      contentScriptReady = true;
    }
    
    // Send message to content script with retry logic
    const response = await sendMessageWithRetry({
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
      analyzeBtn.innerHTML = '🔍 Analyze Property';
    }
  }
}

// Initialize popup functionality
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
          statusElement.innerHTML = '✅ Connected to ChatGPT';
          contentScriptReady = true;
          
          // Show site info
          if (infoElement) infoElement.style.display = 'block';
          if (siteElement) siteElement.textContent = response.site;
          if (urlElement) urlElement.textContent = response.url;
          
          // Show property link section
          if (propertyLinkSection) propertyLinkSection.style.display = 'block';
          
          // Show and load property history section
          if (propertyHistorySection) propertyHistorySection.style.display = 'block';
          
        } else {
          throw new Error('Content script not responding properly');
        }
        
      } catch (error) {
        console.log('Content script communication failed, will try to inject:', error.message);
        
        // Content script might not be loaded, show as active anyway since we're on ChatGPT
        statusElement.className = 'status active';
        statusElement.innerHTML = '✅ Ready on ChatGPT';
        
        // Show site info
        if (infoElement) infoElement.style.display = 'block';
        if (siteElement) siteElement.textContent = new URL(currentTab.url).hostname;
        if (urlElement) urlElement.textContent = currentTab.url;
        
        // Show property link section
        if (propertyLinkSection) propertyLinkSection.style.display = 'block';
        
        // Show and load property history section
        if (propertyHistorySection) propertyHistorySection.style.display = 'block';
        
        // Try to inject content script
        try {
          await injectContentScript();
          contentScriptReady = true;
          statusElement.innerHTML = '✅ Connected to ChatGPT';
        } catch (injectError) {
          console.error('Failed to inject content script:', injectError);
        }
      }
      
    } else {
      // Not on ChatGPT
      statusElement.className = 'status inactive';
      statusElement.innerHTML = '❌ Please open ChatGPT to use this extension';
      
      // Show site info
      if (infoElement) infoElement.style.display = 'block';
      if (siteElement) siteElement.textContent = new URL(currentTab.url).hostname;
      if (urlElement) urlElement.textContent = currentTab.url;
    }
    
  } catch (error) {
    console.error('Failed to initialize popup:', error);
    statusElement.className = 'status inactive';
    statusElement.innerHTML = '⚠️ Unable to check status';
  }
}

// Default prompt for property analysis
const DEFAULT_PROMPT = `You are a professional real estate investment analyst. Please analyze this property listing and provide a comprehensive assessment focusing on the following key data points that will be used for Excel export and comparison:

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

// Settings Functions
async function loadCustomPrompt() {
  try {
    const result = await chrome.storage.local.get(['customPrompt']);
    const customPrompt = result.customPrompt || DEFAULT_PROMPT;
    if (customPromptTextarea) {
      customPromptTextarea.value = customPrompt;
    }
  } catch (error) {
    console.error('Error loading custom prompt:', error);
  }
}

async function saveCustomPrompt() {
  try {
    const customPrompt = customPromptTextarea.value.trim();
    if (!customPrompt) {
      showError('Prompt cannot be empty');
      return;
    }
    
    await chrome.storage.local.set({ customPrompt: customPrompt });
    showSuccess('Custom prompt saved successfully!');
  } catch (error) {
    console.error('Error saving custom prompt:', error);
    showError('Failed to save custom prompt');
  }
}

async function resetToDefaultPrompt() {
  if (confirm('Are you sure you want to reset to the default prompt? This will overwrite your current custom prompt.')) {
    try {
      await chrome.storage.local.set({ customPrompt: DEFAULT_PROMPT });
      if (customPromptTextarea) {
        customPromptTextarea.value = DEFAULT_PROMPT;
      }
      showSuccess('Prompt reset to default successfully!');
    } catch (error) {
      console.error('Error resetting prompt:', error);
      showError('Failed to reset prompt');
    }
  }
}

function toggleSettings() {
  if (settingsSection) {
    const isVisible = settingsSection.style.display !== 'none';
    settingsSection.style.display = isVisible ? 'none' : 'block';
    
    if (!isVisible) {
      // Show settings section and load current configurations
      loadCustomPrompt();
      loadColumnConfiguration();
    }
  }
}

function toggleSettingsContent() {
  if (settingsContent && settingsToggle) {
    const isVisible = settingsContent.style.display !== 'none';
    settingsContent.style.display = isVisible ? 'none' : 'block';
    settingsToggle.textContent = isVisible ? '▼' : '▲';
  }
}

function togglePromptSection() {
  if (promptContent && togglePromptBtn) {
    const isVisible = promptContent.style.display !== 'none';
    promptContent.style.display = isVisible ? 'none' : 'block';
    togglePromptBtn.textContent = isVisible ? '▼' : '▲';
    
    if (!isVisible) {
      // Load prompt when expanding
      loadCustomPrompt();
    }
  }
}

function toggleDefaultPrompt() {
  if (defaultPromptDisplay && showDefaultBtn) {
    const isVisible = !defaultPromptDisplay.classList.contains('hidden');
    
    if (isVisible) {
      defaultPromptDisplay.classList.add('hidden');
      showDefaultBtn.textContent = '📄 View Default';
    } else {
      defaultPromptDisplay.classList.remove('hidden');
      showDefaultBtn.textContent = '📄 Hide Default';
      defaultPromptDisplay.textContent = DEFAULT_PROMPT;
    }
  }
}

// Function to get the current prompt (custom or default)
async function getCurrentPrompt() {
  try {
    const result = await chrome.storage.local.get(['customPrompt']);
    return result.customPrompt || DEFAULT_PROMPT;
  } catch (error) {
    console.error('Error getting current prompt:', error);
    return DEFAULT_PROMPT;
  }
}

// Default column configuration
const DEFAULT_COLUMNS = [
  // Core Property Information
  { id: 'price', name: 'Price', description: 'Property asking price', category: 'core', enabled: true, order: 1 },
  { id: 'bedrooms', name: 'Bedrooms', description: 'Number of bedrooms', category: 'core', enabled: true, order: 2 },
  { id: 'bathrooms', name: 'Bathrooms', description: 'Number of bathrooms', category: 'core', enabled: true, order: 3 },
  { id: 'squareFeet', name: 'Square Footage', description: 'Property size in square feet', category: 'core', enabled: true, order: 4 },
  { id: 'yearBuilt', name: 'Year Built', description: 'Year the property was built', category: 'core', enabled: true, order: 5 },
  { id: 'propertyType', name: 'Property Type', description: 'Type of property (house, condo, apartment, etc.)', category: 'core', enabled: true, order: 6 },
  
  // Financial Analysis
  { id: 'estimatedRentalIncome', name: 'Estimated Monthly Rental Income', description: 'Estimated monthly rental income potential', category: 'financial', enabled: true, order: 7 },
  
  // Location & Scoring
  { id: 'locationScore', name: 'Location & Neighborhood Scoring', description: 'Location quality score (e.g., 7/10, 2/10)', category: 'scoring', enabled: true, order: 8 },
  { id: 'rentalGrowthPotential', name: 'Rental Growth Potential', description: 'Assessment of rental income growth potential (Growth: High/Strong/Moderate/Low/Limited)', category: 'analysis', enabled: true, order: 9 },
  
  // Additional Optional Columns (disabled by default)
  { id: 'address', name: 'Address/URL', description: 'Property address or property URL', category: 'identification', enabled: false, order: 10 },
  { id: 'source', name: 'Source', description: 'Website source (Zillow, Realtor.com, etc.)', category: 'identification', enabled: false, order: 11 },
  { id: 'analysisDate', name: 'Analysis Date', description: 'Date when analysis was performed', category: 'identification', enabled: false, order: 12 },
  { id: 'pricePerSqFt', name: 'Price per Sq Ft', description: 'Calculated price per square foot', category: 'metrics', enabled: false, order: 13 },
  { id: 'propertyAge', name: 'Property Age', description: 'Age of the property in years', category: 'metrics', enabled: false, order: 14 },
  { id: 'neighborhood', name: 'Neighborhood', description: 'Property location/neighborhood name', category: 'metrics', enabled: false, order: 15 },
  { id: 'overallScore', name: 'Overall Score', description: 'Overall property score (1-10)', category: 'scores', enabled: false, order: 16 },
  { id: 'investmentScore', name: 'Investment Score', description: 'Investment potential score (1-10)', category: 'scores', enabled: false, order: 17 },
  { id: 'marketScore', name: 'Market Score', description: 'Market value score (1-10)', category: 'scores', enabled: false, order: 18 },
  { id: 'conditionScore', name: 'Condition Score', description: 'Property condition score (1-10)', category: 'scores', enabled: false, order: 19 },
  { id: 'monthlyPayment', name: 'Est. Monthly Payment', description: 'Estimated monthly mortgage payment', category: 'financial', enabled: false, order: 20 },
  { id: 'priceVsMarket', name: 'Price vs Market', description: 'Price comparison to market value', category: 'financial', enabled: false, order: 21 },
  { id: 'investmentPotential', name: 'Investment Potential', description: 'Investment potential summary', category: 'financial', enabled: false, order: 22 },
  { id: 'valueRating', name: 'Value Rating', description: 'Overall value rating', category: 'financial', enabled: false, order: 23 },
  { id: 'topPros', name: 'Top 3 Pros', description: 'Key property advantages', category: 'analysis', enabled: false, order: 24 },
  { id: 'topCons', name: 'Top 3 Cons', description: 'Main property concerns', category: 'analysis', enabled: false, order: 25 },
  { id: 'redFlagsCount', name: 'Red Flags Count', description: 'Number of warning indicators', category: 'analysis', enabled: false, order: 26 },
  { id: 'keyConcerns', name: 'Key Concerns', description: 'Primary issues summary', category: 'analysis', enabled: false, order: 27 },
  { id: 'marketAnalysis', name: 'Market Analysis', description: 'Detailed market assessment', category: 'analysis', enabled: false, order: 28 },
  { id: 'investmentDetails', name: 'Investment Details', description: 'Complete investment analysis', category: 'analysis', enabled: false, order: 29 },
  { id: 'allPros', name: 'All Pros', description: 'Complete advantages list', category: 'analysis', enabled: false, order: 30 },
  { id: 'allCons', name: 'All Cons', description: 'Complete disadvantages list', category: 'analysis', enabled: false, order: 31 },
  { id: 'redFlagsDetail', name: 'Red Flags Detail', description: 'Detailed warning information', category: 'analysis', enabled: false, order: 32 }
];

// Column Configuration Functions
async function loadColumnConfiguration() {
  try {
    const result = await chrome.storage.local.get(['columnConfiguration']);
    const savedConfig = result.columnConfiguration;
    
    let columnConfig;
    if (savedConfig && Array.isArray(savedConfig)) {
      // Merge saved config with default columns (in case new columns were added)
      columnConfig = DEFAULT_COLUMNS.map(defaultCol => {
        const saved = savedConfig.find(col => col.id === defaultCol.id);
        return saved ? { ...defaultCol, ...saved } : defaultCol;
      });
      
      // Add any saved columns that aren't in defaults (shouldn't happen, but just in case)
      savedConfig.forEach(savedCol => {
        if (!DEFAULT_COLUMNS.find(col => col.id === savedCol.id)) {
          columnConfig.push(savedCol);
        }
      });
    } else {
      columnConfig = [...DEFAULT_COLUMNS];
    }
    
    renderColumnConfiguration(columnConfig);
    return columnConfig;
  } catch (error) {
    console.error('Error loading column configuration:', error);
    renderColumnConfiguration(DEFAULT_COLUMNS);
    return DEFAULT_COLUMNS;
  }
}

function renderColumnConfiguration(columns) {
  if (!columnConfigList) return;
  
  columnConfigList.innerHTML = '';
  
  columns.forEach((column, index) => {
    const columnItem = document.createElement('div');
    columnItem.className = `column-item ${column.isCustom ? 'custom-column' : ''}`;
    columnItem.style.cssText = `
      display: flex;
      align-items: center;
      padding: var(--space-sm);
      margin-bottom: var(--space-sm);
      background: var(--secondary-background);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      gap: var(--space-sm);
      cursor: move;
    `;
    columnItem.draggable = true;
    columnItem.dataset.columnId = column.id;
    columnItem.dataset.index = index;
    
    const deleteButton = column.isCustom ? 
      `<button class="btn btn-ghost btn-sm column-delete-btn" data-column-id="${column.id}" style="color: #dc2626;">🗑️</button>` : '';
    
    columnItem.innerHTML = `
      <div style="color: var(--text-secondary); cursor: move;">⋮⋮</div>
      <input type="checkbox" class="column-checkbox" ${column.enabled ? 'checked' : ''} style="margin: 0;">
      <div style="flex: 1; min-width: 0;">
        <div style="font-weight: var(--font-weight-medium); font-size: var(--font-size-sm); color: var(--text-primary);">
          ${column.name}${column.isCustom ? ' (Custom)' : ''}
        </div>
        <div style="font-size: var(--font-size-sm); color: var(--text-secondary); opacity: 0.8;">
          ${column.description}
        </div>
      </div>
      <div style="font-size: var(--font-size-sm); padding: 2px 6px; background: var(--border); border-radius: 3px; color: var(--text-secondary);">
        ${column.category || 'custom'}
      </div>
      <div style="font-size: var(--font-size-sm); color: var(--text-secondary); min-width: 20px; text-align: center;">
        ${index + 1}
      </div>
      ${deleteButton}
    `;
    
    // Add event listeners
    const checkbox = columnItem.querySelector('.column-checkbox');
    checkbox.addEventListener('change', () => {
      column.enabled = checkbox.checked;
      updateColumnCount();
    });
    
    // Delete button for custom columns
    if (column.isCustom) {
      const deleteBtn = columnItem.querySelector('.column-delete-btn');
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteCustomColumn(column.id);
      });
    }
    
    // Drag and drop functionality
    columnItem.addEventListener('dragstart', handleDragStart);
    columnItem.addEventListener('dragover', handleDragOver);
    columnItem.addEventListener('drop', handleDrop);
    columnItem.addEventListener('dragend', handleDragEnd);
    
    columnConfigList.appendChild(columnItem);
  });
  
  updateColumnCount();
}

// Drag and Drop Functions
let draggedElement = null;

function handleDragStart(e) {
  draggedElement = e.target;
  e.target.style.opacity = '0.5';
  e.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function handleDrop(e) {
  e.preventDefault();
  
  const targetItem = e.target.closest('.column-item');
  if (targetItem && targetItem !== draggedElement && columnConfigList) {
    const container = columnConfigList;
    const draggedIndex = parseInt(draggedElement.dataset.index);
    const targetIndex = parseInt(targetItem.dataset.index);
    
    if (draggedIndex < targetIndex) {
      container.insertBefore(draggedElement, targetItem.nextSibling);
    } else {
      container.insertBefore(draggedElement, targetItem);
    }
    
    // Update the configuration order
    reorderColumns();
  }
}

function handleDragEnd(e) {
  e.target.style.opacity = '1';
  draggedElement = null;
}

function reorderColumns() {
  if (!columnConfigList) return;
  
  const columnItems = Array.from(columnConfigList.querySelectorAll('.column-item'));
  columnItems.forEach((item, index) => {
    item.dataset.index = index;
    const countElement = item.querySelector('[data-count]');
    if (countElement) {
      countElement.textContent = index + 1;
    }
  });
}

function updateColumnCount() {
  const enabledCount = columnConfigList ? columnConfigList.querySelectorAll('.column-checkbox:checked').length : 0;
  const totalCount = columnConfigList ? columnConfigList.querySelectorAll('.column-checkbox').length : 0;
  
  // Update any count displays if needed
  console.log(`Columns: ${enabledCount}/${totalCount} enabled`);
}

// Column Action Functions
function selectAllColumns() {
  const checkboxes = columnConfigList ? columnConfigList.querySelectorAll('.column-checkbox') : [];
  checkboxes.forEach(checkbox => {
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));
  });
  showSuccess('All columns selected');
}

function deselectAllColumns() {
  const checkboxes = columnConfigList ? columnConfigList.querySelectorAll('.column-checkbox') : [];
  checkboxes.forEach(checkbox => {
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change'));
  });
  showSuccess('All columns deselected');
}

async function resetColumnsToDefault() {
  if (confirm('Are you sure you want to reset column configuration to default? This will overwrite your current settings.')) {
    try {
      await chrome.storage.local.set({ columnConfiguration: DEFAULT_COLUMNS });
      renderColumnConfiguration(DEFAULT_COLUMNS);
      showSuccess('Column configuration reset to default');
    } catch (error) {
      console.error('Error resetting columns:', error);
      showError('Failed to reset column configuration');
    }
  }
}

async function saveColumnSettings() {
  try {
    if (!columnConfigList) {
      showError('Column configuration not available');
      return;
    }
    
    const columnItems = Array.from(columnConfigList.querySelectorAll('.column-item'));
    const columnConfig = columnItems.map((item, index) => {
      const columnId = item.dataset.columnId;
      const checkbox = item.querySelector('.column-checkbox');
      const defaultColumn = DEFAULT_COLUMNS.find(col => col.id === columnId);
      
      return {
        ...defaultColumn,
        enabled: checkbox ? checkbox.checked : false,
        order: index
      };
    });
    
    await chrome.storage.local.set({ columnConfiguration: columnConfig });
    showSuccess('Column settings saved successfully!');
  } catch (error) {
    console.error('Error saving column settings:', error);
    showError('Failed to save column settings');
  }
}

function previewExportColumns() {
  if (!columnConfigList) {
    showError('Column configuration not available');
    return;
  }
  
  const columnItems = Array.from(columnConfigList.querySelectorAll('.column-item'));
  const enabledColumns = columnItems
    .filter(item => {
      const checkbox = item.querySelector('.column-checkbox');
      return checkbox && checkbox.checked;
    })
    .map(item => {
      const columnId = item.dataset.columnId;
      const defaultColumn = DEFAULT_COLUMNS.find(col => col.id === columnId);
      return defaultColumn ? defaultColumn.name : 'Unknown';
    });
  
  if (enabledColumns.length === 0) {
    showError('No columns selected for export');
    return;
  }
  
  showSuccess(`Preview: ${enabledColumns.length} columns selected - ${enabledColumns.slice(0, 3).join(', ')}${enabledColumns.length > 3 ? '...' : ''}`);
}

// Custom Column Management Functions
function clearCustomColumnForm() {
  if (customColumnName) customColumnName.value = '';
  if (customColumnType) customColumnType.value = 'text';
  if (customColumnDescription) customColumnDescription.value = '';
  if (customColumnDefault) customColumnDefault.value = '';
}

async function addCustomColumn() {
  try {
    if (!customColumnName || !customColumnType) {
      showError('Form elements not found. Please refresh the extension.');
      return;
    }
    
    const name = customColumnName.value.trim();
    const type = customColumnType.value;
    const description = customColumnDescription.value.trim();
    const defaultValue = customColumnDefault.value.trim();
    
    // Validation
    if (!name) {
      showError('Column name is required');
      return;
    }
    
    if (name.length > 50) {
      showError('Column name must be 50 characters or less');
      return;
    }
    
    // Check for duplicate names
    const result = await chrome.storage.local.get(['columnConfiguration']);
    const existingColumns = result.columnConfiguration || DEFAULT_COLUMNS;
    
    if (existingColumns.some(col => col.name.toLowerCase() === name.toLowerCase())) {
      showError('A column with this name already exists');
      return;
    }
    
    // Create custom column
    const customColumn = {
      id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: name,
      description: description || `Custom ${type} column`,
      category: 'custom',
      enabled: true,
      isCustom: true,
      type: type,
      defaultValue: defaultValue,
      order: existingColumns.length
    };
    
    // Add to configuration
    const updatedColumns = [...existingColumns, customColumn];
    await chrome.storage.local.set({ columnConfiguration: updatedColumns });
    
    // Re-render the column list
    renderColumnConfiguration(updatedColumns);
    
    // Clear form
    clearCustomColumnForm();
    
    showSuccess(`Custom column "${name}" added successfully!`);
    
  } catch (error) {
    console.error('Error adding custom column:', error);
    showError('Failed to add custom column');
  }
}

async function deleteCustomColumn(columnId) {
  if (!confirm('Are you sure you want to delete this custom column? This action cannot be undone.')) {
    return;
  }
  
  try {
    const result = await chrome.storage.local.get(['columnConfiguration']);
    const existingColumns = result.columnConfiguration || DEFAULT_COLUMNS;
    
    const updatedColumns = existingColumns.filter(col => col.id !== columnId);
    await chrome.storage.local.set({ columnConfiguration: updatedColumns });
    
    // Re-render the column list
    renderColumnConfiguration(updatedColumns);
    
    showSuccess('Custom column deleted successfully');
    
  } catch (error) {
    console.error('Error deleting custom column:', error);
    showError('Failed to delete custom column');
  }
}

// Function to format custom column values based on type
function formatCustomColumnValue(value, type) {
  if (!value && value !== 0) return '';
  
  switch (type) {
    case 'currency':
      const numValue = parseFloat(value);
      return isNaN(numValue) ? value : `$${numValue.toLocaleString()}`;
    case 'percentage':
      const pctValue = parseFloat(value);
      return isNaN(pctValue) ? value : `${pctValue}%`;
    case 'rating':
      const ratingValue = parseFloat(value);
      return isNaN(ratingValue) ? value : Math.min(10, Math.max(1, ratingValue));
    case 'boolean':
      if (typeof value === 'boolean') return value ? 'Yes' : 'No';
      const lowerValue = value.toString().toLowerCase();
      return ['true', 'yes', '1', 'on'].includes(lowerValue) ? 'Yes' : 'No';
    case 'date':
      try {
        const dateValue = new Date(value);
        return isNaN(dateValue.getTime()) ? value : dateValue.toLocaleDateString();
      } catch {
        return value;
      }
    case 'number':
      const numberValue = parseFloat(value);
      return isNaN(numberValue) ? value : numberValue.toLocaleString();
    case 'text':
    default:
      return value.toString();
  }
}

// Function to show custom data editor
async function showCustomDataEditor(propertyItem, propertyIndex) {
  try {
    // Get current column configuration to find custom columns
    const result = await chrome.storage.local.get(['columnConfiguration']);
    const columnConfig = result.columnConfiguration || DEFAULT_COLUMNS;
    const customColumns = columnConfig.filter(col => col.isCustom && col.enabled);
    
    if (customColumns.length === 0) {
      showError('No custom columns are configured. Add custom columns in settings first.');
      return;
    }
    
    // Create modal (simplified for space)
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-lg);
    `;
    
    modal.innerHTML = `
      <div style="
        background: var(--background);
        border-radius: var(--radius-md);
        max-width: 500px;
        width: 100%;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: var(--shadow-md);
      ">
        <div style="
          padding: var(--space-lg);
          border-bottom: 1px solid var(--border);
          display: flex;
          justify-content: space-between;
          align-items: center;
        ">
          <h3 style="margin: 0; font-size: var(--font-size-xl);">✏️ Edit Custom Data</h3>
          <button class="close-btn" style="
            background: none;
            border: none;
            font-size: 20px;
            cursor: pointer;
            color: var(--text-secondary);
          ">✕</button>
        </div>
        <div style="padding: var(--space-lg);">
          <div style="
            background: #f0f9ff;
            padding: var(--space-md);
            border-radius: var(--radius-sm);
            margin-bottom: var(--space-lg);
            border-left: 4px solid var(--primary);
          ">
            <strong>Property:</strong> ${propertyItem.url}
          </div>
          <form class="custom-form">
            ${customColumns.map(column => `
              <div style="margin-bottom: var(--space-md);">
                <label style="
                  display: block;
                  font-weight: var(--font-weight-medium);
                  margin-bottom: var(--space-sm);
                ">${column.name}:</label>
                <input 
                  type="${getInputType(column.type)}" 
                  data-column-id="${column.id}"
                  value="${getCustomColumnValue(propertyItem, column)}"
                  placeholder="${column.description}"
                  style="
                    width: 100%;
                    padding: var(--space-md);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                    font-family: inherit;
                  "
                  ${column.type === 'rating' ? 'min="1" max="10"' : ''}
                >
                <small style="color: var(--text-secondary); font-size: var(--font-size-sm);">
                  Type: ${column.type}${column.defaultValue ? ` (Default: ${column.defaultValue})` : ''}
                </small>
              </div>
            `).join('')}
          </form>
        </div>
        <div style="
          padding: var(--space-lg);
          border-top: 1px solid var(--border);
          display: flex;
          gap: var(--space-md);
          justify-content: flex-end;
        ">
          <button class="cancel-btn btn btn-secondary btn-sm">❌ Cancel</button>
          <button class="save-btn btn btn-primary btn-sm">💾 Save Changes</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add event listeners
    const closeBtn = modal.querySelector('.close-btn');
    const saveBtn = modal.querySelector('.save-btn');
    const cancelBtn = modal.querySelector('.cancel-btn');
    
    const closeModal = () => modal.remove();
    
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
    
    saveBtn.addEventListener('click', async () => {
      try {
        // Collect form data
        const customData = {};
        const inputs = modal.querySelectorAll('input[data-column-id]');
        inputs.forEach(input => {
          if (input.value.trim()) {
            customData[input.dataset.columnId] = input.value.trim();
          }
        });
        
        // Update property with custom data
        const historyResult = await chrome.storage.local.get(['propertyHistory']);
        const history = historyResult.propertyHistory || [];
        
        if (history[propertyIndex]) {
          history[propertyIndex].customColumns = customData;
          await chrome.storage.local.set({ propertyHistory: history });
          
          // Refresh the display
          displayPropertyHistory(history);
          
          closeModal();
          showSuccess('Custom data saved successfully!');
        }
        
      } catch (error) {
        console.error('Error saving custom data:', error);
        showError('Failed to save custom data');
      }
    });
    
  } catch (error) {
    console.error('Error showing custom data editor:', error);
    showError('Failed to open custom data editor');
  }
}

// Helper function to get appropriate input type for column type
function getInputType(columnType) {
  switch (columnType) {
    case 'number':
    case 'currency':
    case 'percentage':
    case 'rating':
      return 'number';
    case 'date':
      return 'date';
    case 'boolean':
      return 'checkbox';
    default:
      return 'text';
  }
}

// Export function (updated for comprehensive data extraction)
async function exportPropertyHistory() {
  try {
    const [historyResult, columnResult] = await Promise.all([
      chrome.storage.local.get(['propertyHistory']),
      chrome.storage.local.get(['columnConfiguration'])
    ]);
    
    const history = historyResult.propertyHistory || [];
    const columnConfig = columnResult.columnConfiguration || DEFAULT_COLUMNS;
    
    if (history.length === 0) {
      showError('No properties to export');
      return;
    }
    
    // Get enabled columns in the correct order
    const enabledColumns = columnConfig
      .filter(col => col.enabled)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    
    // Enhanced helper function to extract data from ChatGPT analysis
    const extractFromAnalysis = (analysisText) => {
      if (!analysisText) return {};
      
      const text = analysisText.toLowerCase();
      const originalText = analysisText;
      
      // Extract price
      const priceMatch = originalText.match(/price[:\-\s]*\$?([\d,]+)/i) || 
                         originalText.match(/asking[:\-\s]*\$?([\d,]+)/i) ||
                         originalText.match(/\$([0-9,]+)/);
      const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : null;
      
      // Extract bedrooms
      const bedroomMatch = originalText.match(/bedroom[s]?[:\-\s]*(\d+(?:\.\d+)?)/i) ||
                          originalText.match(/(\d+)[:\-\s]*bedroom/i);
      const bedrooms = bedroomMatch ? parseFloat(bedroomMatch[1]) : null;
      
      // Extract bathrooms
      const bathroomMatch = originalText.match(/bathroom[s]?[:\-\s]*(\d+(?:\.\d+)?)/i) ||
                           originalText.match(/(\d+(?:\.\d+)?)[:\-\s]*bathroom/i);
      const bathrooms = bathroomMatch ? parseFloat(bathroomMatch[1]) : null;
      
      // Extract square footage
      const sqftMatch = originalText.match(/square\s+footage?[:\-\s]*([\d,]+)/i) ||
                       originalText.match(/sq\.?\s*ft\.?[:\-\s]*([\d,]+)/i) ||
                       originalText.match(/([\d,]+)\s*sq\.?\s*ft\.?/i);
      const squareFeet = sqftMatch ? parseInt(sqftMatch[1].replace(/,/g, '')) : null;
      
      // Extract year built
      const yearMatch = originalText.match(/year\s+built[:\-\s]*(\d{4})/i) ||
                       originalText.match(/built[:\-\s]*(\d{4})/i) ||
                       originalText.match(/(\d{4})\s*built/i);
      const yearBuilt = yearMatch ? parseInt(yearMatch[1]) : null;
      
      // Extract property type
      const typeMatch = originalText.match(/property\s+type[:\-\s]*([^\n\r,.;]+)/i) ||
                       originalText.match(/type[:\-\s]*(single family|condo|townhouse|apartment|duplex|house)[^\n\r,.;]*/i);
      const propertyType = typeMatch ? typeMatch[1].trim() : null;
      
      // Extract rental income
      const rentalMatch = originalText.match(/rental\s+income[:\-\s]*\$?([\d,]+)/i) ||
                         originalText.match(/estimated\s+monthly\s+rental[:\-\s]*\$?([\d,]+)/i) ||
                         originalText.match(/monthly\s+rent[:\-\s]*\$?([\d,]+)/i);
      const rentalIncome = rentalMatch ? parseInt(rentalMatch[1].replace(/,/g, '')) : null;
      
      // Extract location score
      const locationMatch = originalText.match(/location[^0-9]*(\d+)\/10/i) ||
                           originalText.match(/neighborhood[^0-9]*(\d+)\/10/i) ||
                           originalText.match(/(\d+)\/10[^0-9]*location/i);
      const locationScore = locationMatch ? `${locationMatch[1]}/10` : null;
      
      // Extract rental growth potential
      const growthMatch = originalText.match(/rental\s+growth\s+potential[:\-\s]*(high|strong|moderate|low|limited)/i) ||
                         originalText.match(/growth\s+potential[:\-\s]*(high|strong|moderate|low|limited)/i);
      const growthPotential = growthMatch ? growthMatch[1] : null;
      
      // Extract neighborhood name
      const neighborhoodMatch = originalText.match(/neighborhood[:\-\s]*([^\n\r,.;]+)/i) ||
                               originalText.match(/area[:\-\s]*([^\n\r,.;]+)/i);
      const neighborhood = neighborhoodMatch ? neighborhoodMatch[1].trim() : null;
      
      return {
        price,
        bedrooms,
        bathrooms,
        squareFeet,
        yearBuilt,
        propertyType,
        rentalIncome,
        locationScore,
        growthPotential,
        neighborhood
      };
    };
    
    // Helper function to extract numeric value with fallback
    const extractNumber = (str) => {
      if (!str) return '';
      const match = str.toString().replace(/[,$]/g, '').match(/[\d.]+/);
      return match ? parseFloat(match[0]) : '';
    };
    
    // Helper function to estimate rental income (fallback)
    const estimateRentalIncome = (data, price) => {
      if (!price) return '';
      
      // Basic rental estimation: 1% rule as starting point
      let monthlyRent = price * 0.01;
      
      // Adjust based on property type
      if (data.propertyType) {
        const type = data.propertyType.toLowerCase();
        if (type.includes('apartment') || type.includes('condo')) {
          monthlyRent *= 0.9;
        } else if (type.includes('single family') || type.includes('house')) {
          monthlyRent *= 1.1;
        }
      }
      
      // Adjust based on bedrooms
      const bedrooms = data.bedrooms || extractNumber(data.bedrooms);
      if (bedrooms) {
        if (bedrooms <= 1) monthlyRent *= 0.8;
        else if (bedrooms >= 4) monthlyRent *= 1.2;
      }
      
      return Math.round(monthlyRent);
    };
    
    // Helper function to infer location score (fallback)
    const inferLocationScore = (analysis) => {
      if (!analysis) return '';
      
      const text = analysis.toLowerCase();
      let score = 5; // Default neutral score
      
      if (text.includes('excellent location') || text.includes('prime location')) score = 9;
      else if (text.includes('great location') || text.includes('desirable')) score = 8;
      else if (text.includes('good location') || text.includes('convenient')) score = 7;
      else if (text.includes('decent location') || text.includes('accessible')) score = 6;
      else if (text.includes('average location') || text.includes('moderate')) score = 5;
      else if (text.includes('poor location') || text.includes('remote')) score = 3;
      else if (text.includes('bad location') || text.includes('undesirable')) score = 2;
      
      // Positive indicators
      if (text.includes('near schools') || text.includes('good schools')) score += 1;
      if (text.includes('public transport') || text.includes('transit')) score += 1;
      if (text.includes('shopping') || text.includes('restaurants')) score += 0.5;
      if (text.includes('safe') || text.includes('low crime')) score += 1;
      
      // Negative indicators
      if (text.includes('high crime') || text.includes('unsafe')) score -= 2;
      if (text.includes('noisy') || text.includes('busy road')) score -= 1;
      if (text.includes('far from') || text.includes('isolated')) score -= 1;
      
      score = Math.max(1, Math.min(10, Math.round(score)));
      return `${score}/10`;
    };
    
    // Helper function to assess rental growth potential
    const inferRentalGrowthPotential = (analysis) => {
      if (!analysis) return 'Growth: Moderate';
      
      const text = analysis.toLowerCase();
      
      if (text.includes('growing area') || text.includes('development') || 
          text.includes('gentrification') || text.includes('upcoming')) return 'Growth: High';
      
      if (text.includes('strong rental market') || text.includes('high demand') ||
          text.includes('good investment') || text.includes('appreciating')) return 'Growth: Strong';
      
      if (text.includes('declining') || text.includes('saturated market') ||
          text.includes('poor prospects') || text.includes('stagnant')) return 'Growth: Low';
      
      if (text.includes('limited') || text.includes('slow growth') ||
          text.includes('mature market')) return 'Growth: Limited';
      
      return 'Growth: Moderate';
    };
    
    // Create CSV content
    const headers = enabledColumns.map(col => col.name);
    const csvRows = history.map(item => {
      return enabledColumns.map(column => {
        // First try to extract from analysis text, then fall back to stored data
        const analysisData = extractFromAnalysis(item.analysis?.fullAnalysis || '');
        const storedData = item.analysis?.extractedData || {};
        
        // Merge analysis data with stored data (analysis takes priority)
        const data = { ...storedData, ...analysisData };
        
        switch (column.id) {
          case 'price':
            const price = data.price || extractNumber(storedData.price);
            return price ? `$${price.toLocaleString()}` : '';
            
          case 'bedrooms':
            return data.bedrooms || extractNumber(storedData.bedrooms) || '';
            
          case 'bathrooms':
            return data.bathrooms || extractNumber(storedData.bathrooms) || '';
            
          case 'squareFeet':
            const sqft = data.squareFeet || extractNumber(storedData.squareFeet);
            return sqft ? sqft.toLocaleString() : '';
            
          case 'yearBuilt':
            return data.yearBuilt || extractNumber(storedData.yearBuilt) || '';
            
          case 'propertyType':
            return `"${data.propertyType || storedData.propertyType || ''}"`;
            
          case 'estimatedRentalIncome':
            const rental = data.rentalIncome || estimateRentalIncome(data, data.price || extractNumber(storedData.price));
            return rental ? `$${rental.toLocaleString()}` : '';
            
          case 'locationScore':
            return data.locationScore || inferLocationScore(item.analysis?.fullAnalysis || '');
            
          case 'rentalGrowthPotential':
            return `"${data.growthPotential || data.rentalGrowthPotential || inferRentalGrowthPotential(item.analysis?.fullAnalysis || '')}"`;
            
          case 'address':
            return `"${item.url}"`;
            
          case 'source':
            return `"${item.domain}"`;
            
          case 'analysisDate':
            return `"${item.date}"`;
            
          case 'pricePerSqFt':
            const priceForCalc = data.price || extractNumber(storedData.price);
            const sqftForCalc = data.squareFeet || extractNumber(storedData.squareFeet);
            return (priceForCalc && sqftForCalc) ? `$${(priceForCalc / sqftForCalc).toFixed(2)}` : '';
            
          case 'propertyAge':
            const yearBuilt = data.yearBuilt || extractNumber(storedData.yearBuilt);
            return yearBuilt ? new Date().getFullYear() - yearBuilt : '';
            
          case 'neighborhood':
            return `"${data.neighborhood || storedData.neighborhood || ''}"`;
            
          default:
            if (column.isCustom) {
              const customValue = getCustomColumnValue(item, column);
              return `"${formatCustomColumnValue(customValue, column.type)}"`;
            }
            return '""';
        }
      }).join(',');
    });
    
    const csvContent = headers.join(',') + '\n' + csvRows.join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `property-analysis-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showSuccess(`Excel file exported with ${enabledColumns.length} columns and enhanced data extraction!`);
  } catch (error) {
    console.error('Error exporting property history:', error);
    showError('Failed to export property history');
  }
}