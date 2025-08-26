// Popup script for RE Analyzer Extension

// DOM elements
let propertyHistoryList, clearHistoryBtn, exportHistoryBtn, propertyUrlInput, analyzeBtn, 
    statusElement, propertySection, siteInfoElement, connectionStatus, pasteBtn,
    successMessage, errorMessage, propertyLinkSection, infoElement, siteElement, urlElement,
    propertyHistorySection, settingsSection, settingsToggle, settingsContent,
    customPromptTextarea, savePromptBtn, resetPromptBtn, showDefaultBtn, defaultPromptDisplay,
    togglePromptBtn, promptContent, propertyCount;

// Tab system elements
let tabButtons, tabContents, activeTab = 'analyzer';

// Global variables
let currentTab = null;
let contentScriptReady = false;

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 RE Analyzer popup loaded');
  
  // Initialize tab system first
  initializeTabSystem();
  
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
  
  // Simple UI elements
  propertyCount = document.getElementById('propertyCount');
  
  // Settings elements
  customPromptTextarea = document.getElementById('customPrompt');
  savePromptBtn = document.getElementById('savePromptBtn');
  resetPromptBtn = document.getElementById('resetPromptBtn');
  showDefaultBtn = document.getElementById('showDefaultBtn');
  defaultPromptDisplay = document.getElementById('defaultPromptDisplay');
  togglePromptBtn = document.getElementById('togglePromptBtn');
  promptContent = document.getElementById('promptContent');

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
  await initializePromptSplittingSettings();
  await initializePopup();
  
  // Set up prompt splitting listeners
  addPromptSplittingEventListeners();
  
  // Set up periodic refresh for pending analyses
  setInterval(async () => {
    await loadPropertyHistory();
  }, 5000); // Refresh every 5 seconds to catch pending -> analyzed transitions
});

// Tab System Functions
function initializeTabSystem() {
  tabButtons = document.querySelectorAll('.tab-button');
  tabContents = document.querySelectorAll('.tab-content');
  
  // Add click listeners to tab buttons
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabId = button.getAttribute('data-tab');
      switchToTab(tabId);
    });
  });
  
  // Set initial active tab
  switchToTab('analyzer');
}

function switchToTab(tabId) {
  // Update active tab variable
  activeTab = tabId;
  
  // Update tab buttons
  tabButtons.forEach(button => {
    if (button.getAttribute('data-tab') === tabId) {
      button.classList.add('active');
    } else {
      button.classList.remove('active');
    }
  });
  
  // Update tab contents
  tabContents.forEach(content => {
    if (content.id === `${tabId}Tab`) {
      content.classList.add('active');
    } else {
      content.classList.remove('active');
    }
  });
  
  // Handle tab-specific logic
  handleTabSwitch(tabId);
}

function handleTabSwitch(tabId) {
  // Setup collapsibles for any tab that might have them
  setTimeout(() => {
    setupCollapsibles();
  }, 50);
  
  switch (tabId) {
    case 'analyzer':
      // Refresh connection status when switching to analyzer tab
      if (statusElement) {
        initializePopup();
      }
      break;
      
    case 'properties':
      // Refresh property history when switching to properties tab
      loadPropertyHistory();
      break;
      
    case 'settings':
      // Load settings when switching to settings tab
      loadCustomPrompt();
      initializePromptSplittingSettings();
      initializeAdvancedSettings();
      updateDebugInfo();
      break;
  }
}

// Get current active tab
function getCurrentTab() {
  return activeTab;
}

// Switch to specific tab (public function for external use)
function showTab(tabId) {
  switchToTab(tabId);
}

// Collapsible functionality
function setupCollapsibles() {
  const collapsibles = document.querySelectorAll('.collapsible');
  
  collapsibles.forEach((collapsible, index) => {
    const header = collapsible.querySelector('.collapsible-header');
    const content = collapsible.querySelector('.collapsible-content');
    
    if (header && content) {
      // Skip if already has our event listener
      if (header.hasAttribute('data-collapsible-setup')) {
        return;
      }
      
      header.setAttribute('data-collapsible-setup', 'true');
      const icon = header.querySelector('.collapsible-icon');
      
      header.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const isExpanded = !content.classList.contains('hidden');
        
        if (isExpanded) {
          content.classList.add('hidden');
          collapsible.classList.remove('expanded');
          if (icon) icon.textContent = '▼';
        } else {
          content.classList.remove('hidden');
          collapsible.classList.add('expanded');
          if (icon) icon.textContent = '▲';
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
  
  // Update property count
  if (propertyCount) {
    propertyCount.textContent = `${history.length}`;
  }
  
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
    const hasAnalysis = item.analysis && item.analysis.fullResponse;
    const analysisStatus = hasAnalysis ? 'analyzed' : 'pending';
    
    return `
      <div class="history-item ${analysisStatus}">
        <div class="history-header">
          <a href="${item.url}" target="_blank" class="history-url">${item.domain}</a>
          <div class="history-status ${analysisStatus}">
            ${hasAnalysis ? '✅ Analyzed' : '⏳ Pending'}
          </div>
        </div>
        ${hasAnalysis ? `
          <div class="analysis-preview-full">
            <div class="analysis-content">${item.analysis.fullResponse.substring(0, 300)}${item.analysis.fullResponse.length > 300 ? '...' : ''}</div>
          </div>
        ` : ''}
        <div class="history-actions">
          ${hasAnalysis ? `<button class="btn btn-ghost btn-sm view-analysis-btn" data-index="${index}">👁️ View Full Response</button>` : ''}
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
      showFullResponse(history[index]);
    });
  });
}

// Function to show simplified response preview
function generateAnalysisPreview(analysis) {
  if (!analysis || !analysis.fullResponse) return '';
  
  return `
    <div class="analysis-preview-full">
      <div class="analysis-content">${analysis.fullResponse.substring(0, 300)}${analysis.fullResponse.length > 300 ? '...' : ''}</div>
    </div>
  `;
}

// Helper function to get quality indicator
function getQualityIndicator(score) {
  if (!score) return '';
  
  let indicator = '';
  let color = '';
  
  if (score >= 90) {
    indicator = '🟢';
    color = '#16a34a';
  } else if (score >= 75) {
    indicator = '🟡';
    color = '#ca8a04';
  } else if (score >= 60) {
    indicator = '🟠';
    color = '#ea580c';
  } else {
    indicator = '🔴';
    color = '#dc2626';
  }
  
  return ` <span style="font-size: var(--font-size-sm); color: ${color};" title="Data Quality: ${score}%">${indicator}</span>`;
}

// Function to show full ChatGPT response in a modal
function showFullResponse(propertyItem) {
  if (!propertyItem.analysis || !propertyItem.analysis.fullResponse) return;
  
  const analysis = propertyItem.analysis;
  
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
        max-width: 800px;
        max-height: 90vh;
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
          <h3 style="margin: 0; font-size: var(--font-size-xl); color: var(--text-primary);">ChatGPT Analysis Response</h3>
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
          max-height: calc(90vh - 100px);
          overflow-y: auto;
        ">
          <div class="property-url" style="
            margin-bottom: var(--space-lg);
            padding: var(--space-md);
            background: #f0f9ff;
            border-radius: var(--radius-sm);
            border-left: 4px solid var(--primary);
          ">
            <strong>Property:</strong> <a href="${propertyItem.url}" target="_blank" style="color: var(--primary);">${propertyItem.url}</a>
          </div>
          
          <div class="full-response" style="
            background: var(--background);
            border: 1px solid var(--border);
            border-radius: var(--radius-sm);
            padding: var(--space-lg);
          ">
            <div class="response-text" style="
              font-size: var(--font-size-base);
              line-height: 1.6;
              color: var(--text-primary);
              white-space: pre-wrap;
              font-family: inherit;
            ">${analysis.fullResponse}</div>
          </div>
          
          <div class="response-actions" style="
            margin-top: var(--space-lg);
            display: flex;
            gap: var(--space-md);
            justify-content: flex-end;
          ">
            <button class="btn btn-secondary btn-sm copy-response-btn">
              📋 Copy Response
            </button>
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
  const copyBtn = modal.querySelector('.copy-response-btn');
  
  closeBtn.addEventListener('click', () => {
    modal.remove();
  });
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
  
  // Copy functionality
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(analysis.fullResponse);
      copyBtn.textContent = '✅ Copied!';
      setTimeout(() => {
        copyBtn.textContent = '📋 Copy Response';
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
      copyBtn.textContent = '❌ Failed';
      setTimeout(() => {
        copyBtn.textContent = '📋 Copy Response';
      }, 2000);
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

async function saveCustomPrompt(silent = false) {
  try {
    const customPrompt = customPromptTextarea.value.trim();
    if (!customPrompt) {
      if (!silent) showError('Prompt cannot be empty');
      return;
    }
    
    // Save current prompt
    await chrome.storage.local.set({ customPrompt: customPrompt });
    
    // Save to prompt history
    const result = await chrome.storage.local.get(['promptHistory']);
    const history = result.promptHistory || [];
    
    // Only save if different from last version
    if (history.length === 0 || history[0].prompt !== customPrompt) {
      history.unshift({
        prompt: customPrompt,
        timestamp: new Date().toISOString()
      });
      
      // Keep only last 10 versions
      if (history.length > 10) {
        history.splice(10);
      }
      
      await chrome.storage.local.set({ promptHistory: history });
    }
    
    if (!silent) {
      showSuccess('Custom prompt saved successfully!');
      loadPromptHistory(); // Refresh history display
    }
  } catch (error) {
    console.error('Error saving custom prompt:', error);
    if (!silent) showError('Failed to save custom prompt');
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

// Note: Settings toggle functions removed - now handled by tab system

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

// Default column configuration matching specification requirements
const DEFAULT_COLUMNS = [
  // Core Property Information (Default Export Fields - according to spec)
  { id: 'streetName', name: 'Street Name', description: 'Property street address', category: 'core', enabled: true, order: 1 },
  { id: 'price', name: 'Property Price', description: 'Property asking price', category: 'core', enabled: true, order: 2 },
  { id: 'bedrooms', name: 'Number of Bedrooms', description: 'Number of bedrooms', category: 'core', enabled: true, order: 3 },
  { id: 'propertyType', name: 'Type of Property', description: 'House/Apartment classification', category: 'core', enabled: true, order: 4 },
  
  // Additional Property Information (Disabled by Default)
  { id: 'bathrooms', name: 'Bathrooms', description: 'Number of bathrooms', category: 'core', enabled: false, order: 5 },
  { id: 'squareFeet', name: 'Square Footage', description: 'Property size in square feet', category: 'core', enabled: false, order: 6 },
  { id: 'yearBuilt', name: 'Year Built', description: 'Year the property was built', category: 'core', enabled: false, order: 7 },
  { id: 'neighborhood', name: 'Neighborhood', description: 'Property location/neighborhood name', category: 'core', enabled: false, order: 8 },
  
  // Financial Analysis (Disabled by Default)
  { id: 'estimatedRentalIncome', name: 'Estimated Monthly Rental Income', description: 'Estimated monthly rental income potential', category: 'financial', enabled: false, order: 9 },
  { id: 'pricePerSqFt', name: 'Price per Sq Ft', description: 'Calculated price per square foot', category: 'financial', enabled: false, order: 10 },
  { id: 'capRate', name: 'Cap Rate', description: 'Annual return percentage', category: 'financial', enabled: false, order: 11 },
  { id: 'onePercentRule', name: '1% Rule', description: 'Monthly rent to price ratio', category: 'financial', enabled: false, order: 12 },
  { id: 'grossRentMultiplier', name: 'Gross Rent Multiplier', description: 'Price to annual rent ratio', category: 'financial', enabled: false, order: 13 },
  
  // Location & Scoring (Disabled by Default)
  { id: 'locationScore', name: 'Location Score', description: 'Location quality score (X/10)', category: 'scoring', enabled: false, order: 14 },
  { id: 'rentalGrowthPotential', name: 'Rental Growth Potential', description: 'Growth potential assessment', category: 'scoring', enabled: false, order: 15 },
  
  // Investment Analysis (Disabled by Default)
  { id: 'pros', name: 'Top 3 Pros', description: 'Key property advantages', category: 'analysis', enabled: false, order: 16 },
  { id: 'cons', name: 'Top 3 Cons', description: 'Main property concerns', category: 'analysis', enabled: false, order: 17 },
  { id: 'redFlags', name: 'Red Flags', description: 'Warning indicators', category: 'analysis', enabled: false, order: 18 },
  { id: 'investmentPotential', name: 'Investment Potential', description: 'Investment summary', category: 'analysis', enabled: false, order: 19 },
  { id: 'marketAnalysis', name: 'Market Analysis', description: 'Market assessment', category: 'analysis', enabled: false, order: 20 },
  
  // Identification (Disabled by Default)
  { id: 'address', name: 'Property URL', description: 'Direct link to property', category: 'identification', enabled: false, order: 21 },
  { id: 'source', name: 'Source', description: 'Website source', category: 'identification', enabled: false, order: 22 },
  { id: 'analysisDate', name: 'Analysis Date', description: 'Date of analysis', category: 'identification', enabled: false, order: 23 }
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

// Helper function to get custom column value from property item
function getCustomColumnValue(propertyItem, column) {
  if (!propertyItem.customColumns || !propertyItem.customColumns[column.id]) {
    return column.defaultValue || '';
  }
  return propertyItem.customColumns[column.id];
}

// Export function (simplified for full response export)
async function exportPropertyHistory() {
  try {
    const historyResult = await chrome.storage.local.get(['propertyHistory']);
    const history = historyResult.propertyHistory || [];
    
    if (history.length === 0) {
      showError('No properties to export');
      return;
    }
    
    // Simple columns for full response export
    const columns = [
      { id: 'url', name: 'Property URL' },
      { id: 'domain', name: 'Source' },
      { id: 'date', name: 'Analysis Date' },
      { id: 'response', name: 'ChatGPT Response' }
    ];
    
    // Helper function to clean text for CSV
    const cleanTextForCSV = (text) => {
      if (!text) return '';
      return text.replace(/"/g, '""'); // Escape quotes for CSV
    };
    
    // Create CSV content with simplified structure
    const headers = columns.map(col => col.name);
    const csvRows = history.map(item => {
      return columns.map(column => {
        switch (column.id) {
          case 'url':
            return `"${cleanTextForCSV(item.url)}"`;
            
          case 'domain':
            return `"${cleanTextForCSV(item.domain)}"`;
            
          case 'date':
            return `"${cleanTextForCSV(item.date)}"`;
            
          case 'response':
            const response = item.analysis?.fullResponse || 'No analysis available';
            return `"${cleanTextForCSV(response)}"`;
            
          default:
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
    
    showSuccess(`Excel file exported with ${columns.length} columns containing full ChatGPT responses!`);
  } catch (error) {
    console.error('Error exporting property history:', error);
    showError('Failed to export property history');
  }
}

// Prompt Splitting Settings Management
async function initializePromptSplittingSettings() {
  try {
    // Load settings from storage
    const settings = await new Promise((resolve) => {
      chrome.storage.local.get(['promptSplittingSettings'], (result) => {
        resolve(result.promptSplittingSettings || {
          enabled: true,
          lengthThreshold: 200, // lowered for dynamic prompts
          confirmationTimeout: 15000,
          stats: {
            totalAttempts: 0,
            successfulSplits: 0,
            fallbacksUsed: 0
          }
        });
      });
    });
    
    // Update UI elements
    const enableCheckbox = document.getElementById('enablePromptSplitting');
    const thresholdSlider = document.getElementById('promptLengthThreshold');
    const timeoutSlider = document.getElementById('confirmationTimeout');
    const thresholdValue = document.getElementById('thresholdValue');
    const timeoutValue = document.getElementById('timeoutValue');
    const successRate = document.getElementById('splittingSuccessRate');
    const attempts = document.getElementById('splittingAttempts');
    
    if (enableCheckbox) enableCheckbox.checked = settings.enabled;
    if (thresholdSlider) thresholdSlider.value = settings.lengthThreshold;
    if (timeoutSlider) timeoutSlider.value = settings.confirmationTimeout / 1000;
    if (thresholdValue) thresholdValue.textContent = settings.lengthThreshold;
    if (timeoutValue) timeoutValue.textContent = Math.round(settings.confirmationTimeout / 1000);
    
    // Update stats
    if (settings.stats.totalAttempts > 0) {
      const rate = Math.round((settings.stats.successfulSplits / settings.stats.totalAttempts) * 100);
      if (successRate) successRate.textContent = `${rate}% (${settings.stats.successfulSplits}/${settings.stats.totalAttempts})`;
    } else {
      if (successRate) successRate.textContent = 'No data yet';
    }
    if (attempts) attempts.textContent = settings.stats.totalAttempts;
    
    // Add event listeners for sliders
    if (thresholdSlider) {
      thresholdSlider.addEventListener('input', (e) => {
        if (thresholdValue) thresholdValue.textContent = e.target.value;
      });
    }
    
    if (timeoutSlider) {
      timeoutSlider.addEventListener('input', (e) => {
        if (timeoutValue) timeoutValue.textContent = e.target.value;
      });
    }
    
  } catch (error) {
    console.error('Error initializing prompt splitting settings:', error);
  }
}

async function savePromptSplittingSettings() {
  try {
    const enableCheckbox = document.getElementById('enablePromptSplitting');
    const thresholdSlider = document.getElementById('promptLengthThreshold');
    const timeoutSlider = document.getElementById('confirmationTimeout');
    
    // Get current stats
    const currentSettings = await new Promise((resolve) => {
      chrome.storage.local.get(['promptSplittingSettings'], (result) => {
        resolve(result.promptSplittingSettings || { stats: { totalAttempts: 0, successfulSplits: 0, fallbacksUsed: 0 } });
      });
    });
    
    const settings = {
      enabled: enableCheckbox ? enableCheckbox.checked : true,
      lengthThreshold: thresholdSlider ? parseInt(thresholdSlider.value) : 200, // lowered for dynamic prompts
      confirmationTimeout: timeoutSlider ? parseInt(timeoutSlider.value) * 1000 : 15000,
      stats: currentSettings.stats || { totalAttempts: 0, successfulSplits: 0, fallbacksUsed: 0 }
    };
    
    // Save to storage
    await new Promise((resolve) => {
      chrome.storage.local.set({ promptSplittingSettings: settings }, resolve);
    });
    
    // Send settings to content script
    try {
      const tabs = await new Promise((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, resolve);
      });
      
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'updatePromptSplittingSettings',
          settings: settings
        });
      }
    } catch (err) {
      console.log('Could not send settings to content script:', err);
    }
    
    showPromptSplittingMessage('Settings saved successfully!', 'success');
    
  } catch (error) {
    console.error('Error saving prompt splitting settings:', error);
    showPromptSplittingMessage('Failed to save settings', 'error');
  }
}

async function resetPromptSplittingStats() {
  try {
    const currentSettings = await new Promise((resolve) => {
      chrome.storage.local.get(['promptSplittingSettings'], (result) => {
        resolve(result.promptSplittingSettings || {});
      });
    });
    
    currentSettings.stats = {
      totalAttempts: 0,
      successfulSplits: 0,
      fallbacksUsed: 0
    };
    
    await new Promise((resolve) => {
      chrome.storage.local.set({ promptSplittingSettings: currentSettings }, resolve);
    });
    
    // Update UI
    const successRate = document.getElementById('splittingSuccessRate');
    const attempts = document.getElementById('splittingAttempts');
    if (successRate) successRate.textContent = 'No data yet';
    if (attempts) attempts.textContent = '0';
    
    showPromptSplittingMessage('Statistics reset successfully!', 'success');
    
  } catch (error) {
    console.error('Error resetting prompt splitting stats:', error);
    showPromptSplittingMessage('Failed to reset statistics', 'error');
  }
}

function showPromptSplittingMessage(message, type = 'success') {
  const messageElement = document.getElementById('splittingMessage');
  if (!messageElement) return;
  
  messageElement.textContent = message;
  messageElement.className = `message ${type}`;
  messageElement.style.display = 'block';
  
  setTimeout(() => {
    messageElement.style.display = 'none';
  }, 3000);
}

// Add prompt splitting settings event listeners
function addPromptSplittingEventListeners() {
  // Save settings button
  const saveBtn = document.getElementById('saveSplittingSettingsBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', savePromptSplittingSettings);
  }
  
  // Reset stats button
  const resetBtn = document.getElementById('resetSplittingStatsBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to reset all prompt splitting statistics?')) {
        resetPromptSplittingStats();
      }
    });
  }
}

// Enhanced Settings Variables
let autoSaveTimeout = null;
let promptValidationEnabled = true;
let autoSaveEnabled = true;
let debugModeEnabled = false;
let promptPreviewEnabled = false;

// Prompt Templates
const PROMPT_TEMPLATES = {
  basic: `Please analyze this property listing and provide a brief overview including:

1. Property details (price, bedrooms, bathrooms, size)
2. Location assessment
3. Key pros and cons
4. Investment potential rating

Property Link: {PROPERTY_URL}`,

  detailed: `You are a professional real estate investment analyst. Please analyze this property listing and provide a comprehensive assessment focusing on the following key data points that will be used for Excel export and comparison:

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
- Assess rental growth potential with specific factors

**INVESTMENT SUMMARY:**
- Overall investment grade and reasoning
- Top 3 advantages (pros)
- Top 3 concerns or limitations (cons)
- Any red flags or warning signs
- Price comparison to market value
- Recommendation for this property as a rental investment

Property Link: {PROPERTY_URL}`,

  investment: `As an investment analyst, evaluate this property for investment potential. Focus on:

**FINANCIAL ANALYSIS:**
- Purchase price and financing options
- Estimated rental income and cap rate
- Cash flow projections
- Market appreciation potential
- Investment return timeline

**RISK ASSESSMENT:**
- Market conditions and trends
- Property condition concerns
- Location risks and opportunities
- Competition analysis

**RECOMMENDATION:**
- Investment grade (A, B, C, D)
- Expected ROI and timeline
- Action recommendation (Buy, Pass, Watch)

Property Link: {PROPERTY_URL}`,

  rental: `Analyze this property specifically for rental investment potential:

**RENTAL MARKET ANALYSIS:**
- Comparable rental rates in area
- Tenant demand and vacancy rates
- Seasonal rental patterns
- Target tenant demographics

**PROPERTY SUITABILITY:**
- Rental-friendly features and layout
- Maintenance requirements and costs
- Property management considerations
- Parking and amenities

**FINANCIAL PROJECTIONS:**
- Monthly rental income estimate
- Operating expenses breakdown
- Cash flow after expenses
- Break-even analysis

**RENTAL STRATEGY RECOMMENDATIONS:**
- Optimal rental approach (long-term, short-term, etc.)
- Suggested improvements for rental appeal
- Marketing and tenant screening advice

Property Link: {PROPERTY_URL}`
};

// Enhanced Settings Functions
async function initializeAdvancedSettings() {
  try {
    // Load advanced settings from storage
    const result = await chrome.storage.local.get(['advancedSettings']);
    const settings = result.advancedSettings || {
      autoSaveEnabled: true,
      promptValidationEnabled: true,
      debugModeEnabled: false,
      promptPreviewEnabled: false,
      maxPromptLength: 2000
    };
    
    // Update global variables
    autoSaveEnabled = settings.autoSaveEnabled;
    promptValidationEnabled = settings.promptValidationEnabled;
    debugModeEnabled = settings.debugModeEnabled;
    promptPreviewEnabled = settings.promptPreviewEnabled;
    
    // Update UI elements
    const autoSaveCheckbox = document.getElementById('enableAutoSave');
    const validationCheckbox = document.getElementById('enablePromptValidation');
    const debugCheckbox = document.getElementById('enableDebugMode');
    const previewCheckbox = document.getElementById('enablePromptPreview');
    const maxLengthSlider = document.getElementById('maxPromptLength');
    const maxLengthValue = document.getElementById('maxLengthValue');
    
    if (autoSaveCheckbox) autoSaveCheckbox.checked = settings.autoSaveEnabled;
    if (validationCheckbox) validationCheckbox.checked = settings.promptValidationEnabled;
    if (debugCheckbox) debugCheckbox.checked = settings.debugModeEnabled;
    if (previewCheckbox) previewCheckbox.checked = settings.promptPreviewEnabled;
    if (maxLengthSlider) maxLengthSlider.value = settings.maxPromptLength;
    if (maxLengthValue) maxLengthValue.textContent = settings.maxPromptLength;
    
    // Add event listeners for new elements
    setupAdvancedSettingsListeners();
    
    // Initialize prompt character counter
    updatePromptCharCount();
    
    // Load prompt history
    loadPromptHistory();
    
  } catch (error) {
    console.error('Error initializing advanced settings:', error);
  }
}

function setupAdvancedSettingsListeners() {
  // Character counter for prompt
  const customPrompt = document.getElementById('customPrompt');
  if (customPrompt) {
    customPrompt.addEventListener('input', () => {
      updatePromptCharCount();
      handleAutoSave();
      if (promptValidationEnabled) {
        validatePrompt();
      }
    });
  }
  
  // Template buttons
  const templateButtons = {
    'templateBasicBtn': 'basic',
    'templateDetailedBtn': 'detailed', 
    'templateInvestmentBtn': 'investment',
    'templateRentalBtn': 'rental'
  };
  
  Object.entries(templateButtons).forEach(([buttonId, templateKey]) => {
    const button = document.getElementById(buttonId);
    if (button) {
      button.addEventListener('click', () => loadTemplate(templateKey));
    }
  });
  
  // Validation button
  const validateBtn = document.getElementById('validatePromptBtn');
  if (validateBtn) {
    validateBtn.addEventListener('click', validatePrompt);
  }
  
  // Advanced settings sliders
  const maxLengthSlider = document.getElementById('maxPromptLength');
  if (maxLengthSlider) {
    maxLengthSlider.addEventListener('input', (e) => {
      const maxLengthValue = document.getElementById('maxLengthValue');
      if (maxLengthValue) {
        maxLengthValue.textContent = e.target.value;
      }
    });
  }
  
  // Import/Export buttons
  const exportPromptBtn = document.getElementById('exportPromptBtn');
  const importPromptBtn = document.getElementById('importPromptBtn');
  const promptFileInput = document.getElementById('promptFileInput');
  
  if (exportPromptBtn) {
    exportPromptBtn.addEventListener('click', exportPrompt);
  }
  
  if (importPromptBtn) {
    importPromptBtn.addEventListener('click', () => {
      if (promptFileInput) promptFileInput.click();
    });
  }
  
  if (promptFileInput) {
    promptFileInput.addEventListener('change', importPrompt);
  }
  
  // Save buttons
  const saveAdvancedBtn = document.getElementById('saveAdvancedSettingsBtn');
  const saveDebugBtn = document.getElementById('saveDebugSettingsBtn');
  
  if (saveAdvancedBtn) {
    saveAdvancedBtn.addEventListener('click', saveAdvancedSettings);
  }
  
  if (saveDebugBtn) {
    saveDebugBtn.addEventListener('click', saveDebugSettings);
  }
  
  // Debug buttons
  const clearDebugBtn = document.getElementById('clearDebugBtn');
  const exportDebugBtn = document.getElementById('exportDebugBtn');
  
  if (clearDebugBtn) {
    clearDebugBtn.addEventListener('click', () => {
      console.clear();
      showSuccess('Console cleared');
    });
  }
  
  if (exportDebugBtn) {
    exportDebugBtn.addEventListener('click', exportDebugInfo);
  }
}

function updatePromptCharCount() {
  const customPrompt = document.getElementById('customPrompt');
  const charCount = document.getElementById('promptCharCount');
  
  if (customPrompt && charCount) {
    const count = customPrompt.value.length;
    charCount.textContent = `${count} characters`;
    
    // Color coding based on length
    if (count > 2500) {
      charCount.style.color = '#dc2626'; // Red
    } else if (count > 2000) {
      charCount.style.color = '#f59e0b'; // Orange
    } else {
      charCount.style.color = 'var(--text-secondary)'; // Normal
    }
  }
}

function handleAutoSave() {
  if (!autoSaveEnabled) return;
  
  // Clear existing timeout
  if (autoSaveTimeout) {
    clearTimeout(autoSaveTimeout);
  }
  
  // Set new timeout for auto-save
  autoSaveTimeout = setTimeout(async () => {
    await saveCustomPrompt(true); // true = silent save
    showAutoSaveIndicator();
  }, 3000);
}

function showAutoSaveIndicator() {
  const indicator = document.getElementById('autoSaveIndicator');
  if (indicator) {
    indicator.classList.remove('hidden');
    setTimeout(() => {
      indicator.classList.add('hidden');
    }, 2000);
  }
}

function loadTemplate(templateKey) {
  const customPrompt = document.getElementById('customPrompt');
  if (customPrompt && PROMPT_TEMPLATES[templateKey]) {
    if (customPrompt.value.trim() && !confirm('This will replace your current prompt. Continue?')) {
      return;
    }
    
    customPrompt.value = PROMPT_TEMPLATES[templateKey];
    updatePromptCharCount();
    
    if (promptValidationEnabled) {
      validatePrompt();
    }
    
    showSuccess(`${templateKey.charAt(0).toUpperCase() + templateKey.slice(1)} template loaded`);
  }
}

function validatePrompt() {
  const customPrompt = document.getElementById('customPrompt');
  const validationDiv = document.getElementById('promptValidation');
  const validationMessages = document.getElementById('validationMessages');
  
  if (!customPrompt || !validationDiv || !validationMessages) return;
  
  const prompt = customPrompt.value.trim();
  const issues = [];
  
  // Validation checks
  if (prompt.length === 0) {
    issues.push('Prompt is empty');
  }
  
  if (prompt.length < 50) {
    issues.push('Prompt is very short (less than 50 characters)');
  }
  
  if (prompt.length > 3000) {
    issues.push('Prompt is very long (over 3000 characters) - may cause issues');
  }
  
  if (!prompt.includes('{PROPERTY_URL}')) {
    issues.push('Missing {PROPERTY_URL} placeholder');
  }
  
  if (prompt.includes('http://') || prompt.includes('https://')) {
    issues.push('Contains hard-coded URLs - use {PROPERTY_URL} placeholder instead');
  }
  
  // Word count check
  const wordCount = prompt.split(/\s+/).length;
  if (wordCount > 500) {
    issues.push(`Very long prompt (${wordCount} words) - consider shortening for better performance`);
  }
  
  // Update validation display
  if (issues.length > 0) {
    validationMessages.innerHTML = issues.map(issue => `<li>${issue}</li>`).join('');
    validationDiv.classList.remove('hidden');
  } else {
    validationDiv.classList.add('hidden');
    showSuccess('Prompt validation passed ✅');
  }
}

async function exportPrompt() {
  try {
    const customPrompt = document.getElementById('customPrompt');
    if (!customPrompt) return;
    
    const promptData = {
      prompt: customPrompt.value,
      timestamp: new Date().toISOString(),
             version: "v1.1.0",
      type: "RE Analyzer Custom Prompt"
    };
    
    const blob = new Blob([JSON.stringify(promptData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `re-analyzer-prompt-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showSuccess('Prompt exported successfully!');
  } catch (error) {
    console.error('Error exporting prompt:', error);
    showError('Failed to export prompt');
  }
}

async function importPrompt(event) {
  try {
    const file = event.target.files[0];
    if (!file) return;
    
    const text = await file.text();
    let promptData;
    
    if (file.name.endsWith('.json')) {
      promptData = JSON.parse(text);
      if (promptData.prompt) {
        loadImportedPrompt(promptData.prompt);
      } else {
        throw new Error('Invalid JSON format');
      }
    } else {
      // Plain text file
      loadImportedPrompt(text);
    }
    
    event.target.value = ''; // Clear file input
    
  } catch (error) {
    console.error('Error importing prompt:', error);
    showError('Failed to import prompt - check file format');
  }
}

function loadImportedPrompt(promptText) {
  const customPrompt = document.getElementById('customPrompt');
  if (!customPrompt) return;
  
  if (customPrompt.value.trim() && !confirm('This will replace your current prompt. Continue?')) {
    return;
  }
  
  customPrompt.value = promptText;
  updatePromptCharCount();
  
  if (promptValidationEnabled) {
    validatePrompt();
  }
  
  showSuccess('Prompt imported successfully!');
}

async function saveAdvancedSettings() {
  try {
    const settings = {
      autoSaveEnabled: document.getElementById('enableAutoSave')?.checked ?? true,
      promptValidationEnabled: document.getElementById('enablePromptValidation')?.checked ?? true,
      debugModeEnabled: document.getElementById('enableDebugMode')?.checked ?? false,
      promptPreviewEnabled: document.getElementById('enablePromptPreview')?.checked ?? false,
      maxPromptLength: parseInt(document.getElementById('maxPromptLength')?.value ?? 2000)
    };
    
    // Update global variables
    autoSaveEnabled = settings.autoSaveEnabled;
    promptValidationEnabled = settings.promptValidationEnabled;
    debugModeEnabled = settings.debugModeEnabled;
    promptPreviewEnabled = settings.promptPreviewEnabled;
    
    await chrome.storage.local.set({ advancedSettings: settings });
    showSuccess('Advanced settings saved successfully!');
    
  } catch (error) {
    console.error('Error saving advanced settings:', error);
    showError('Failed to save advanced settings');
  }
}

async function saveDebugSettings() {
  try {
    const settings = {
      debugModeEnabled: document.getElementById('enableDebugMode')?.checked ?? false,
      promptPreviewEnabled: document.getElementById('enablePromptPreview')?.checked ?? false
    };
    
    debugModeEnabled = settings.debugModeEnabled;
    promptPreviewEnabled = settings.promptPreviewEnabled;
    
    const result = await chrome.storage.local.get(['advancedSettings']);
    const advancedSettings = result.advancedSettings || {};
    
    await chrome.storage.local.set({ 
      advancedSettings: { ...advancedSettings, ...settings }
    });
    
    showSuccess('Debug settings saved successfully!');
    updateDebugInfo();
    
  } catch (error) {
    console.error('Error saving debug settings:', error);
    showError('Failed to save debug settings');
  }
}

function updateDebugInfo() {
  const debugActiveTab = document.getElementById('debugActiveTab');
  const debugTime = document.getElementById('debugTime');
  
  if (debugActiveTab) {
    debugActiveTab.textContent = `Active Tab: ${activeTab}`;
  }
  
  if (debugTime) {
    debugTime.textContent = new Date().toLocaleTimeString();
  }
}

async function exportDebugInfo() {
  try {
    const debugData = {
      timestamp: new Date().toISOString(),
      activeTab: activeTab,
      userAgent: navigator.userAgent,
      extension: {
        version: "v1.1.0",
        tabSystem: "active",
        settingsTab: "loaded"
      },
      settings: {
        autoSaveEnabled,
        promptValidationEnabled,
        debugModeEnabled,
        promptPreviewEnabled
      },
      storage: await chrome.storage.local.get()
    };
    
    const blob = new Blob([JSON.stringify(debugData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `re-analyzer-debug-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showSuccess('Debug info exported successfully!');
  } catch (error) {
    console.error('Error exporting debug info:', error);
    showError('Failed to export debug info');
  }
}

async function loadPromptHistory() {
  try {
    const result = await chrome.storage.local.get(['promptHistory']);
    const history = result.promptHistory || [];
    
    const historyDiv = document.getElementById('promptHistory');
    if (!historyDiv) return;
    
    if (history.length === 0) {
      historyDiv.innerHTML = `
        <div class="empty-state" style="padding: var(--space-md);">
          <p style="font-size: var(--font-size-sm); color: var(--text-secondary);">No previous versions saved</p>
        </div>
      `;
      return;
    }
    
    const historyHTML = history.slice(0, 5).map((item, index) => `
      <div style="padding: var(--space-sm); border-bottom: 1px solid var(--border); cursor: pointer;" onclick="restorePromptVersion(${index})">
        <div style="font-size: var(--font-size-sm); font-weight: var(--font-weight-medium);">
          ${new Date(item.timestamp).toLocaleDateString()} ${new Date(item.timestamp).toLocaleTimeString()}
        </div>
        <div style="font-size: var(--font-size-sm); color: var(--text-secondary); margin-top: var(--space-xs);">
          ${item.prompt.substring(0, 100)}${item.prompt.length > 100 ? '...' : ''}
        </div>
      </div>
    `).join('');
    
    historyDiv.innerHTML = historyHTML;
    
  } catch (error) {
    console.error('Error loading prompt history:', error);
  }
}

async function restorePromptVersion(index) {
  try {
    const result = await chrome.storage.local.get(['promptHistory']);
    const history = result.promptHistory || [];
    
    if (history[index]) {
      const customPrompt = document.getElementById('customPrompt');
      if (customPrompt) {
        if (customPrompt.value.trim() && !confirm('This will replace your current prompt. Continue?')) {
          return;
        }
        
        customPrompt.value = history[index].prompt;
        updatePromptCharCount();
        
        if (promptValidationEnabled) {
          validatePrompt();
        }
        
        showSuccess('Prompt version restored successfully!');
      }
    }
  } catch (error) {
    console.error('Error restoring prompt version:', error);
    showError('Failed to restore prompt version');
  }
}

// Make function globally accessible for onclick handlers
window.restorePromptVersion = restorePromptVersion;

