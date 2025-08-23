// Popup script for ChatGPT Helper Extension

// DOM elements
let propertyHistoryList, clearHistoryBtn, exportHistoryBtn, propertyUrlInput, analyzeBtn, 
    statusElement, propertySection, siteInfoElement, connectionStatus, pasteBtn,
    successMessage, errorMessage, propertyLinkSection, infoElement, siteElement, urlElement,
    propertyHistorySection, settingsSection, settingsToggle, toggleSettingsBtn, settingsContent,
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
  
  // Settings elements
  settingsSection = document.getElementById('settingsSection');
  settingsToggle = document.getElementById('settingsToggle');
  toggleSettingsBtn = document.getElementById('toggleSettingsBtn');
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
  if (settingsToggle) settingsToggle.addEventListener('click', toggleSettings);
  if (toggleSettingsBtn) toggleSettingsBtn.addEventListener('click', toggleSettingsContent);
  if (savePromptBtn) savePromptBtn.addEventListener('click', saveCustomPrompt);
  if (resetPromptBtn) resetPromptBtn.addEventListener('click', resetToDefaultPrompt);
  if (showDefaultBtn) showDefaultBtn.addEventListener('click', toggleDefaultPrompt);
  if (togglePromptBtn) togglePromptBtn.addEventListener('click', togglePromptSection);
  
  // Column configuration event listeners
  if (selectAllColumnsBtn) selectAllColumnsBtn.addEventListener('click', selectAllColumns);
  if (deselectAllColumnsBtn) deselectAllColumnsBtn.addEventListener('click', deselectAllColumns);
  if (resetColumnsBtn) resetColumnsBtn.addEventListener('click', resetColumnsToDefault);
  if (saveColumnsBtn) saveColumnsBtn.addEventListener('click', saveColumnSettings);
  if (previewColumnsBtn) previewColumnsBtn.addEventListener('click', previewExportColumns);
  
  // Custom column event listeners
  if (toggleCustomColumnBtn) toggleCustomColumnBtn.addEventListener('click', toggleCustomColumnForm);
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
        <button class="edit-custom-data-btn" data-index="${index}">✏️ Edit Custom Data</button>
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

// Function to get custom column value for a property
function getCustomColumnValue(item, column) {
  // Check if the property has custom column data stored
  if (item.customColumns && item.customColumns[column.id]) {
    return item.customColumns[column.id];
  }
  
  // Return default value if available
  return column.defaultValue || '';
}

async function exportPropertyHistory() {
  try {
    // Get both property history and column configuration
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
    
    // Create headers from enabled columns
    const headers = enabledColumns.map(col => col.name);
    
    const csvRows = history.map((item, index) => {
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
      
      // Enhanced scoring functions (1-10 scale)
      const calculateOverallScore = () => {
        if (!analysis) return '';
        let score = 5; // Base score
        
        const pros = (data.pros || '').toLowerCase();
        const cons = (data.cons || '').toLowerCase();
        const redFlags = (data.redFlags || '').toLowerCase();
        
        // Positive indicators
        if (pros.includes('excellent') || pros.includes('great')) score += 2;
        else if (pros.includes('good') || pros.includes('nice')) score += 1;
        
        // Negative indicators
        if (cons.includes('poor') || cons.includes('bad')) score -= 2;
        else if (cons.includes('concern') || cons.includes('issue')) score -= 1;
        
        // Red flags impact
        if (redFlags.length > 100) score -= 2;
        else if (redFlags.length > 50) score -= 1;
        
        return Math.max(1, Math.min(10, score));
      };
      
      const calculateInvestmentScore = () => {
        if (!data.investmentPotential) return '';
        const text = data.investmentPotential.toLowerCase();
        if (text.includes('excellent') || text.includes('strong')) return 9;
        if (text.includes('very good') || text.includes('high potential')) return 8;
        if (text.includes('good') || text.includes('positive')) return 7;
        if (text.includes('decent') || text.includes('fair')) return 6;
        if (text.includes('moderate') || text.includes('average')) return 5;
        if (text.includes('poor') || text.includes('weak')) return 3;
        if (text.includes('bad') || text.includes('avoid')) return 2;
        return 5;
      };
      
      const calculateMarketScore = () => {
        if (!data.marketAnalysis) return '';
        const text = data.marketAnalysis.toLowerCase();
        if (text.includes('undervalued') || text.includes('great deal')) return 9;
        if (text.includes('good value') || text.includes('fair price')) return 7;
        if (text.includes('market value') || text.includes('reasonable')) return 6;
        if (text.includes('overpriced') || text.includes('expensive')) return 3;
        if (text.includes('overvalued') || text.includes('too high')) return 2;
        return 5;
      };
      
      const calculateLocationScore = () => {
        if (!data.neighborhood) return '';
        const text = (data.neighborhood + ' ' + (data.pros || '')).toLowerCase();
        if (text.includes('excellent location') || text.includes('prime area')) return 9;
        if (text.includes('good location') || text.includes('desirable')) return 7;
        if (text.includes('decent area') || text.includes('convenient')) return 6;
        if (text.includes('remote') || text.includes('far from')) return 4;
        if (text.includes('poor location') || text.includes('undesirable')) return 3;
        return 5;
      };
      
      const calculateConditionScore = () => {
        if (!data.pros && !data.cons) return '';
        const text = ((data.pros || '') + ' ' + (data.cons || '')).toLowerCase();
        if (text.includes('excellent condition') || text.includes('move-in ready')) return 9;
        if (text.includes('good condition') || text.includes('well maintained')) return 7;
        if (text.includes('fair condition') || text.includes('some updates')) return 6;
        if (text.includes('needs work') || text.includes('outdated')) return 4;
        if (text.includes('poor condition') || text.includes('major repairs')) return 3;
        return 5;
      };
      
      // Financial calculations
      const estimateMonthlyPayment = () => {
        if (!price) return '';
        const downPayment = price * 0.2; // 20% down
        const loanAmount = price - downPayment;
        const monthlyRate = 0.07 / 12; // Assume 7% interest
        const numPayments = 30 * 12; // 30 years
        const monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);
        return Math.round(monthlyPayment);
      };
      
      // Extract top points for summary
      const extractTopPoints = (text, count = 3) => {
        if (!text) return '';
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
        return sentences.slice(0, count).map(s => s.trim()).join(' | ');
      };
      
      const countRedFlags = () => {
        if (!data.redFlags) return 0;
        const text = data.redFlags.toLowerCase();
        let count = 0;
        const flagIndicators = ['concern', 'issue', 'problem', 'warning', 'avoid', 'risk', 'poor', 'bad'];
        flagIndicators.forEach(flag => {
          if (text.includes(flag)) count++;
        });
        return count;
      };
      
      // Generate data for enabled columns in the correct order
      const rowData = enabledColumns.map(column => {
        switch (column.id) {
          case 'propertyId':
            return `"PROP-${(index + 1).toString().padStart(3, '0')}"`;
          case 'address':
            return `"${item.url}"`;
          case 'source':
            return `"${item.domain}"`;
          case 'analysisDate':
            return `"${new Date(item.date).toLocaleDateString()}"`;
          case 'price':
            return price || '';
          case 'bedrooms':
            return bedrooms || '';
          case 'bathrooms':
            return bathrooms || '';
          case 'squareFeet':
            return sqft || '';
          case 'pricePerSqFt':
            return pricePerSqFt || '';
          case 'yearBuilt':
            return yearBuilt || '';
          case 'propertyAge':
            return propertyAge || '';
          case 'propertyType':
            return `"${data.propertyType || ''}"`;
          case 'neighborhood':
            return `"${data.neighborhood || ''}"`;
          case 'overallScore':
            return analysis ? calculateOverallScore() : '';
          case 'investmentScore':
            return analysis ? calculateInvestmentScore() : '';
          case 'marketScore':
            return analysis ? calculateMarketScore() : '';
          case 'locationScore':
            return analysis ? calculateLocationScore() : '';
          case 'conditionScore':
            return analysis ? calculateConditionScore() : '';
          case 'monthlyPayment':
            return price ? estimateMonthlyPayment() : '';
          case 'priceVsMarket':
            return analysis ? getInvestmentScore(data.marketAnalysis) : '';
          case 'investmentPotential':
            return `"${data.investmentPotential ? cleanText(data.investmentPotential).substring(0, 100) : ''}"`;
          case 'valueRating':
            return analysis ? getInvestmentScore(data.investmentPotential) : '';
          case 'topPros':
            return `"${extractTopPoints(data.pros, 3)}"`;
          case 'topCons':
            return `"${extractTopPoints(data.cons, 3)}"`;
          case 'redFlagsCount':
            return analysis ? countRedFlags() : 0;
          case 'keyConcerns':
            return `"${data.redFlags ? cleanText(data.redFlags).substring(0, 100) : ''}"`;
          case 'marketAnalysis':
            return `"${cleanText(data.marketAnalysis)}"`;
          case 'investmentDetails':
            return `"${cleanText(data.investmentPotential)}"`;
          case 'allPros':
            return `"${cleanText(data.pros)}"`;
          case 'allCons':
            return `"${cleanText(data.cons)}"`;
          case 'redFlagsDetail':
            return `"${cleanText(data.redFlags)}"`;
          default:
            // Handle custom columns
            if (column.isCustom) {
              const customValue = getCustomColumnValue(item, column);
              const formattedValue = formatCustomColumnValue(customValue, column.type);
              
              // For numeric types, don't quote the value for Excel calculations
              if (['number', 'currency', 'percentage', 'rating'].includes(column.type)) {
                const numericValue = parseFloat(formattedValue.replace(/[$%,]/g, ''));
                return isNaN(numericValue) ? '""' : numericValue;
              } else {
                return `"${formattedValue}"`;
              }
            }
            return '""';
        }
      });
      
      return rowData.join(',');
    });
    
    // Add summary row with enabled columns
    const analyzedProperties = history.filter(item => item.analysis);
    if (analyzedProperties.length > 0) {
      const prices = analyzedProperties.map(item => {
        const price = extractNumber(item.analysis.extractedData.price);
        return price || 0;
      }).filter(p => p > 0);
      
      const avgPrice = prices.length > 0 ? (prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(0) : '';
      const minPrice = prices.length > 0 ? Math.min(...prices) : '';
      const maxPrice = prices.length > 0 ? Math.max(...prices) : '';
      
      // Generate summary row data for enabled columns
      const summaryData = enabledColumns.map(column => {
        switch (column.id) {
          case 'propertyId':
            return '"SUMMARY"';
          case 'address':
            return '""';
          case 'source':
            return '"Summary Statistics"';
          case 'analysisDate':
            return `"${new Date().toLocaleDateString()}"`;
          case 'price':
            return avgPrice || '';
          case 'topPros':
            return `"${analyzedProperties.length} properties analyzed"`;
          case 'topCons':
            return `"Price range: $${minPrice}-$${maxPrice}"`;
          default:
            // For custom columns, show empty value in summary
            if (column.isCustom) {
              return '""';
            }
            return '""';
        }
      });
      
      csvRows.push(summaryData.join(','));
    }
    
    const csvContent = headers.join(',') + '\n' + csvRows.join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `property-analysis-excel-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showSuccess(`Enhanced Excel comparison table exported with ${enabledColumns.length} columns!`);
  } catch (error) {
    console.error('Error exporting property history:', error);
    showError('Failed to export property history');
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

// Default prompt template
const DEFAULT_PROMPT = `Please analyze this property listing and provide a comprehensive analysis including:

1. **Property Details**: Extract key information like price, size, bedrooms, bathrooms, year built, property type, and location.

2. **Market Analysis**: Evaluate the pricing compared to market value, comparable properties, and current market conditions.

3. **Neighborhood Assessment**: Analyze the location, amenities, schools, transportation, and area developments.

4. **Pros and Cons**: List the main advantages and disadvantages of this property.

5. **Investment Potential**: Assess the investment viability, potential appreciation, rental income possibilities, and ROI.

6. **Red Flags**: Identify any concerns, issues, or potential problems to be aware of.

Property Link: {PROPERTY_URL}

Please visit the link and provide your analysis based on the property information. Structure your response with clear sections for easy extraction and comparison.

Analysis Date: {DATE}`;

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
  if (settingsContent && toggleSettingsBtn) {
    const isVisible = settingsContent.style.display !== 'none';
    settingsContent.style.display = isVisible ? 'none' : 'block';
    toggleSettingsBtn.textContent = isVisible ? '▼' : '▲';
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
    const isVisible = defaultPromptDisplay.style.display !== 'none';
    defaultPromptDisplay.style.display = isVisible ? 'none' : 'block';
    showDefaultBtn.textContent = isVisible ? '📄 View Default Prompt' : '📄 Hide Default Prompt';
    
    if (!isVisible) {
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
  // Property Identification
  { id: 'propertyId', name: 'Property ID', description: 'Unique identifier for the property', category: 'identification', enabled: true },
  { id: 'address', name: 'Address/URL', description: 'Property address or listing URL', category: 'identification', enabled: true },
  { id: 'source', name: 'Source', description: 'Website source (Zillow, Realtor.com, etc.)', category: 'identification', enabled: true },
  { id: 'analysisDate', name: 'Analysis Date', description: 'Date when analysis was performed', category: 'identification', enabled: true },
  
  // Core Property Metrics
  { id: 'price', name: 'Price ($)', description: 'Property listing price', category: 'metrics', enabled: true },
  { id: 'bedrooms', name: 'Bedrooms', description: 'Number of bedrooms', category: 'metrics', enabled: true },
  { id: 'bathrooms', name: 'Bathrooms', description: 'Number of bathrooms', category: 'metrics', enabled: true },
  { id: 'squareFeet', name: 'Square Feet', description: 'Property size in square feet', category: 'metrics', enabled: true },
  { id: 'pricePerSqFt', name: 'Price per Sq Ft', description: 'Calculated price per square foot', category: 'metrics', enabled: true },
  { id: 'yearBuilt', name: 'Year Built', description: 'Year the property was built', category: 'metrics', enabled: true },
  { id: 'propertyAge', name: 'Property Age', description: 'Age of the property in years', category: 'metrics', enabled: true },
  { id: 'propertyType', name: 'Property Type', description: 'Type of property (house, condo, etc.)', category: 'metrics', enabled: true },
  { id: 'neighborhood', name: 'Neighborhood', description: 'Property location/neighborhood', category: 'metrics', enabled: true },
  
  // Value Analysis Scores
  { id: 'overallScore', name: 'Overall Score', description: 'Overall property score (1-10)', category: 'scores', enabled: true },
  { id: 'investmentScore', name: 'Investment Score', description: 'Investment potential score (1-10)', category: 'scores', enabled: true },
  { id: 'marketScore', name: 'Market Score', description: 'Market value score (1-10)', category: 'scores', enabled: true },
  { id: 'locationScore', name: 'Location Score', description: 'Location quality score (1-10)', category: 'scores', enabled: true },
  { id: 'conditionScore', name: 'Condition Score', description: 'Property condition score (1-10)', category: 'scores', enabled: true },
  
  // Financial Metrics
  { id: 'monthlyPayment', name: 'Est. Monthly Payment', description: 'Estimated monthly mortgage payment', category: 'financial', enabled: true },
  { id: 'priceVsMarket', name: 'Price vs Market', description: 'Price comparison to market value', category: 'financial', enabled: true },
  { id: 'investmentPotential', name: 'Investment Potential', description: 'Investment potential summary', category: 'financial', enabled: false },
  { id: 'valueRating', name: 'Value Rating', description: 'Overall value rating', category: 'financial', enabled: true },
  
  // Analysis Summary
  { id: 'topPros', name: 'Top 3 Pros', description: 'Key property advantages', category: 'analysis', enabled: true },
  { id: 'topCons', name: 'Top 3 Cons', description: 'Main property concerns', category: 'analysis', enabled: true },
  { id: 'redFlagsCount', name: 'Red Flags Count', description: 'Number of warning indicators', category: 'analysis', enabled: true },
  { id: 'keyConcerns', name: 'Key Concerns', description: 'Primary issues summary', category: 'analysis', enabled: false },
  
  // Detailed Analysis
  { id: 'marketAnalysis', name: 'Market Analysis', description: 'Detailed market assessment', category: 'analysis', enabled: false },
  { id: 'investmentDetails', name: 'Investment Details', description: 'Complete investment analysis', category: 'analysis', enabled: false },
  { id: 'allPros', name: 'All Pros', description: 'Complete advantages list', category: 'analysis', enabled: false },
  { id: 'allCons', name: 'All Cons', description: 'Complete disadvantages list', category: 'analysis', enabled: false },
  { id: 'redFlagsDetail', name: 'Red Flags Detail', description: 'Detailed warning information', category: 'analysis', enabled: false }
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
    columnItem.draggable = true;
    columnItem.dataset.columnId = column.id;
    columnItem.dataset.index = index;
    
    const deleteButton = column.isCustom ? `<button class="column-delete-btn" data-column-id="${column.id}">🗑️</button>` : '';
    
    columnItem.innerHTML = `
      <div class="column-drag-handle">⋮⋮</div>
      <input type="checkbox" class="column-checkbox" ${column.enabled ? 'checked' : ''}>
      <div class="column-info">
        <div class="column-name">${column.name}${column.isCustom ? ' (Custom)' : ''}</div>
        <div class="column-description">${column.description}</div>
      </div>
      <div class="column-category ${column.category || 'custom'}">${column.category || 'custom'}</div>
      <div class="column-count">${index + 1}</div>
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
  e.target.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/html', e.target.outerHTML);
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  
  const targetItem = e.target.closest('.column-item');
  if (targetItem && targetItem !== draggedElement) {
    targetItem.classList.add('drag-over');
  }
}

function handleDrop(e) {
  e.preventDefault();
  
  const targetItem = e.target.closest('.column-item');
  if (targetItem && targetItem !== draggedElement) {
    const container = targetItem.parentNode;
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
  
  // Clean up drag classes
  document.querySelectorAll('.column-item').forEach(item => {
    item.classList.remove('drag-over');
  });
}

function handleDragEnd(e) {
  e.target.classList.remove('dragging');
  draggedElement = null;
  
  // Clean up any remaining drag classes
  document.querySelectorAll('.column-item').forEach(item => {
    item.classList.remove('drag-over');
  });
}

function reorderColumns() {
  const columnItems = Array.from(columnConfigList.querySelectorAll('.column-item'));
  columnItems.forEach((item, index) => {
    item.dataset.index = index;
    const countElement = item.querySelector('.column-count');
    if (countElement) {
      countElement.textContent = index + 1;
    }
  });
}

function updateColumnCount() {
  const enabledCount = columnConfigList.querySelectorAll('.column-checkbox:checked').length;
  const totalCount = columnConfigList.querySelectorAll('.column-checkbox').length;
  
  // Update any count displays if needed
  console.log(`Columns: ${enabledCount}/${totalCount} enabled`);
}

// Column Action Functions
function selectAllColumns() {
  const checkboxes = columnConfigList.querySelectorAll('.column-checkbox');
  checkboxes.forEach(checkbox => {
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));
  });
  showSuccess('All columns selected');
}

function deselectAllColumns() {
  const checkboxes = columnConfigList.querySelectorAll('.column-checkbox');
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
    const columnItems = Array.from(columnConfigList.querySelectorAll('.column-item'));
    const columnConfig = columnItems.map((item, index) => {
      const columnId = item.dataset.columnId;
      const checkbox = item.querySelector('.column-checkbox');
      const defaultColumn = DEFAULT_COLUMNS.find(col => col.id === columnId);
      
      return {
        ...defaultColumn,
        enabled: checkbox.checked,
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
  const columnItems = Array.from(columnConfigList.querySelectorAll('.column-item'));
  const enabledColumns = columnItems
    .filter(item => item.querySelector('.column-checkbox').checked)
    .map(item => {
      const columnId = item.dataset.columnId;
      const defaultColumn = DEFAULT_COLUMNS.find(col => col.id === columnId);
      return defaultColumn.name;
    });
  
  if (enabledColumns.length === 0) {
    showError('No columns selected for export');
    return;
  }
  
  const previewText = `Export Preview (${enabledColumns.length} columns):\n\n${enabledColumns.join(', ')}`;
  
  // Create or update preview display
  let previewDiv = document.querySelector('.column-preview');
  if (!previewDiv) {
    previewDiv = document.createElement('div');
    previewDiv.className = 'column-preview';
    columnConfigList.parentNode.appendChild(previewDiv);
  }
  
  previewDiv.innerHTML = `
    <div class="column-preview-title">Export Preview (${enabledColumns.length} columns)</div>
    ${enabledColumns.join(' • ')}
  `;
  
  showSuccess(`Preview generated for ${enabledColumns.length} columns`);
}

// Custom Column Management Functions
function toggleCustomColumnForm() {
  if (customColumnForm && toggleCustomColumnBtn) {
    const isVisible = customColumnForm.style.display !== 'none';
    customColumnForm.style.display = isVisible ? 'none' : 'block';
    toggleCustomColumnBtn.textContent = isVisible ? '▼' : '▲';
    
    if (!isVisible) {
      clearCustomColumnForm();
    }
  }
}

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
    
    // Clear form and hide it
    clearCustomColumnForm();
    toggleCustomColumnForm();
    
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
     
     // Create modal
     const modal = document.createElement('div');
     modal.className = 'modal-overlay';
     modal.innerHTML = `
       <div class="custom-data-modal">
         <div class="custom-data-modal-header">
           <h3>✏️ Edit Custom Data</h3>
           <button class="custom-data-modal-close">✕</button>
         </div>
         <div class="custom-data-modal-content">
           <div class="property-info">
             <strong>Property:</strong> ${propertyItem.url}
           </div>
           <form id="customDataForm" class="custom-data-form">
             ${customColumns.map(column => `
               <div class="form-group">
                 <label for="custom_${column.id}">${column.name}:</label>
                 <input 
                   type="${getInputType(column.type)}" 
                   id="custom_${column.id}" 
                   class="form-input" 
                   placeholder="${column.description}"
                   value="${getCustomColumnValue(propertyItem, column)}"
                   ${column.type === 'rating' ? 'min="1" max="10"' : ''}
                 >
                 <small class="form-help">Type: ${column.type}${column.defaultValue ? ` (Default: ${column.defaultValue})` : ''}</small>
               </div>
             `).join('')}
           </form>
         </div>
         <div class="custom-data-modal-actions">
           <button id="saveCustomDataBtn" class="btn btn-primary">💾 Save Changes</button>
           <button id="cancelCustomDataBtn" class="btn btn-secondary">❌ Cancel</button>
         </div>
       </div>
     `;
     
     document.body.appendChild(modal);
     
     // Add event listeners
     const closeBtn = modal.querySelector('.custom-data-modal-close');
     const saveBtn = modal.querySelector('#saveCustomDataBtn');
     const cancelBtn = modal.querySelector('#cancelCustomDataBtn');
     
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
         customColumns.forEach(column => {
           const input = document.getElementById(`custom_${column.id}`);
           if (input && input.value.trim()) {
             customData[column.id] = input.value.trim();
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