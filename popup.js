// Popup script for ChatGPT Helper Extension

// DOM elements
let propertyHistoryList, clearHistoryBtn, exportHistoryBtn, propertyUrlInput, analyzeBtn, 
    statusElement, propertySection, siteInfoElement, connectionStatus, pasteBtn,
    successMessage, errorMessage, propertyLinkSection, infoElement, siteElement, urlElement,
    propertyHistorySection;

// Global variables
let currentTab = null;
let contentScriptReady = false;

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 ChatGPT Helper popup loaded');
  
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
  await initializePopup();
  
  // Set up periodic refresh for pending analyses
  setInterval(async () => {
    await loadPropertyHistory();
  }, 5000); // Refresh every 5 seconds to catch pending -> analyzed transitions
});

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
    
    // Helper function to clean text for Excel
    const cleanText = (text) => {
      if (!text) return '';
      return text
        .replace(/"/g, '""')  // Escape quotes
        .replace(/[\r\n]+/g, ' | ')  // Replace line breaks with separator
        .replace(/\s+/g, ' ')  // Normalize whitespace
        .trim()
        .substring(0, 500);  // Limit length
    };
    
    // Helper function to extract numeric value
    const extractNumber = (str) => {
      if (!str) return '';
      const match = str.toString().replace(/[,$]/g, '').match(/[\d.]+/);
      return match ? parseFloat(match[0]) : '';
    };
    
    // Create simplified scoring for investment potential
    const getInvestmentScore = (investmentText) => {
      if (!investmentText) return '';
      const text = investmentText.toLowerCase();
      if (text.includes('excellent') || text.includes('strong')) return 'A';
      if (text.includes('good') || text.includes('positive')) return 'B';
      if (text.includes('fair') || text.includes('moderate')) return 'C';
      if (text.includes('poor') || text.includes('weak')) return 'D';
      return 'TBD';
    };
    
    // Create CSV with optimized Excel format
    const headers = [
      // Basic Property Info
      'Property URL', 'Source Website', 'Analysis Date', 'Status',
      
      // Key Metrics (for easy comparison)
      'Price ($)', 'Bedrooms', 'Bathrooms', 'Square Feet', 'Price per Sq Ft',
      'Year Built', 'Property Age', 'Property Type', 'Neighborhood',
      
      // Analysis Summary (cleaned for Excel)
      'Key Pros', 'Key Cons', 'Market Analysis Summary', 
      'Investment Rating', 'Red Flags', 'Overall Score'
    ];
    
    const csvRows = history.map(item => {
      const analysis = item.analysis;
      const data = analysis ? analysis.extractedData : {};
      
      // Extract and format numeric values
      const price = extractNumber(data.price);
      const sqft = extractNumber(data.squareFeet);
      const bedrooms = extractNumber(data.bedrooms);
      const bathrooms = extractNumber(data.bathrooms);
      const yearBuilt = extractNumber(data.yearBuilt);
      
      // Calculate derived metrics
      const pricePerSqFt = (price && sqft) ? (price / sqft).toFixed(2) : '';
      const propertyAge = yearBuilt ? new Date().getFullYear() - yearBuilt : '';
      
      return [
        `"${item.url}"`,
        `"${item.domain}"`,
        `"${new Date(item.date).toLocaleDateString()}"`,
        `"${analysis ? 'Analyzed' : 'Pending'}"`,
        
        // Numeric values (no quotes for Excel calculations)
        price || '',
        bedrooms || '',
        bathrooms || '',
        sqft || '',
        pricePerSqFt || '',
        yearBuilt || '',
        propertyAge || '',
        
        `"${data.propertyType || ''}"`,
        `"${data.neighborhood || ''}"`,
        
        // Cleaned text analysis
        `"${cleanText(data.pros)}"`,
        `"${cleanText(data.cons)}"`,
        `"${cleanText(data.marketAnalysis)}"`,
        `"${getInvestmentScore(data.investmentPotential)}"`,
        `"${cleanText(data.redFlags)}"`,
        `"${getInvestmentScore(data.investmentPotential)}"`
      ].join(',');
    });
    
    // Add summary statistics row
    const analyzedProperties = history.filter(item => item.analysis);
    if (analyzedProperties.length > 0) {
      const prices = analyzedProperties.map(item => {
        const price = extractNumber(item.analysis.extractedData.price);
        return price || 0;
      }).filter(p => p > 0);
      
      const avgPrice = prices.length > 0 ? (prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(0) : '';
      
      csvRows.push([
        '"SUMMARY"', '""', '""', '""',
        avgPrice ? `"Average: $${avgPrice}"` : '""',
        '""', '""', '""', '""', '""', '""', '""', '""',
        '""', '""', '""', '""', '""', '""'
      ].join(','));
    }
    
    const csvContent = headers.join(',') + '\n' + csvRows.join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `property-comparison-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showSuccess('Property comparison table exported for Excel!');
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
      analyzeBtn.textContent = '🔍 Analyze';
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
          statusElement.textContent = '✅ Active on ChatGPT';
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
        statusElement.textContent = '✅ Active on ChatGPT (initializing...)';
        
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
      if (infoElement) infoElement.style.display = 'block';
      if (siteElement) siteElement.textContent = new URL(currentTab.url).hostname;
      if (urlElement) urlElement.textContent = currentTab.url;
    }
    
  } catch (error) {
    console.error('Failed to initialize popup:', error);
    statusElement.className = 'status inactive';
    statusElement.textContent = '⚠️ Unable to check status';
  }
}