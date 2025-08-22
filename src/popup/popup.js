/**
 * Popup JavaScript for Real Estate Analyzer Chrome Extension
 */

class PopupManager {
  constructor() {
    this.currentTab = null;
    this.init();
  }

  /**
   * Initialize popup functionality
   */
  async init() {
    await this.getCurrentTab();
    this.setupEventListeners();
    await this.loadRecentProperties();
    await this.loadQuickStats();
    this.checkCurrentPage();
  }

  /**
   * Get current active tab
   */
  async getCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      this.currentTab = tab;
    } catch (error) {
      console.error('Error getting current tab:', error);
    }
  }

  /**
   * Setup event listeners for popup interactions
   */
  setupEventListeners() {
    // Quick action buttons
    document.getElementById('analyzeCurrentBtn').addEventListener('click', () => {
      this.analyzeCurrentPage();
    });

    document.getElementById('pasteUrlBtn').addEventListener('click', () => {
      this.toggleUrlInput();
    });

    document.getElementById('analyzeUrlBtn').addEventListener('click', () => {
      this.analyzeFromUrl();
    });

    // URL input
    document.getElementById('propertyUrl').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.analyzeFromUrl();
      }
    });

    // Settings and navigation
    document.getElementById('settingsBtn').addEventListener('click', () => {
      this.openSettings();
    });

    document.getElementById('viewAllBtn').addEventListener('click', () => {
      this.openPropertiesManager();
    });

    // Prompt buttons
    document.querySelectorAll('.prompt-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const promptType = e.currentTarget.dataset.prompt;
        this.generateChatGPTPrompt(promptType);
      });
    });

    // Footer buttons
    document.getElementById('exportBtn').addEventListener('click', () => {
      this.exportData();
    });

    document.getElementById('helpBtn').addEventListener('click', () => {
      this.openHelp();
    });

    document.getElementById('aboutBtn').addEventListener('click', () => {
      this.showAbout();
    });
  }

  /**
   * Check if current page is a supported property site
   */
  checkCurrentPage() {
    if (!this.currentTab) return;

    const url = this.currentTab.url;
    const isPropertySite = this.isPropertySite(url);
    const isPropertyPage = this.isPropertyPage(url);

    const analyzeCurrentBtn = document.getElementById('analyzeCurrentBtn');
    
    if (isPropertyPage) {
      analyzeCurrentBtn.classList.remove('disabled');
      analyzeCurrentBtn.innerHTML = `
        <span class="btn-icon">📊</span>
        <span>Analyze Current Property</span>
      `;
    } else if (isPropertySite) {
      analyzeCurrentBtn.classList.add('disabled');
      analyzeCurrentBtn.innerHTML = `
        <span class="btn-icon">❓</span>
        <span>Navigate to Property Page</span>
      `;
    } else {
      analyzeCurrentBtn.classList.add('disabled');
      analyzeCurrentBtn.innerHTML = `
        <span class="btn-icon">🔍</span>
        <span>Visit Real Estate Site</span>
      `;
    }
  }

  /**
   * Check if URL is from supported property site
   * @param {string} url - URL to check
   * @returns {boolean} True if supported site
   */
  isPropertySite(url) {
    const supportedSites = [
      'zillow.com',
      'redfin.com',
      'realtor.com',
      'trulia.com'
    ];
    
    return supportedSites.some(site => url.includes(site));
  }

  /**
   * Check if URL is a property detail page
   * @param {string} url - URL to check
   * @returns {boolean} True if property page
   */
  isPropertyPage(url) {
    const propertyPatterns = [
      '/homedetails/',  // Zillow
      '/home/',         // Redfin
      '/realestateandhomes-detail/', // Realtor.com
      '/p/'             // Trulia
    ];
    
    return propertyPatterns.some(pattern => url.includes(pattern));
  }

  /**
   * Analyze current page property
   */
  async analyzeCurrentPage() {
    if (!this.currentTab || !this.isPropertyPage(this.currentTab.url)) {
      this.showMessage('Please navigate to a property page first', 'warning');
      return;
    }

    try {
      this.showLoading('Analyzing current property...');
      
      // Send message to content script
      const response = await chrome.tabs.sendMessage(this.currentTab.id, {
        action: 'extractPropertyData'
      });

      if (response.success) {
        // Send to background for analysis
        const analysisResponse = await chrome.runtime.sendMessage({
          action: 'analyzeProperty',
          propertyData: response.data
        });

        if (analysisResponse.success) {
          this.showAnalysisResults(analysisResponse.data);
        } else {
          this.showMessage('Failed to analyze property', 'error');
        }
      } else {
        this.showMessage('Failed to extract property data', 'error');
      }
    } catch (error) {
      console.error('Error analyzing current page:', error);
      this.showMessage('Error analyzing property', 'error');
    } finally {
      this.hideLoading();
    }
  }

  /**
   * Toggle URL input section visibility
   */
  toggleUrlInput() {
    const urlSection = document.getElementById('urlInputSection');
    const isHidden = urlSection.classList.contains('hidden');
    
    if (isHidden) {
      urlSection.classList.remove('hidden');
      document.getElementById('propertyUrl').focus();
    } else {
      urlSection.classList.add('hidden');
      document.getElementById('propertyUrl').value = '';
    }
  }

  /**
   * Analyze property from URL input
   */
  async analyzeFromUrl() {
    const urlInput = document.getElementById('propertyUrl');
    const url = urlInput.value.trim();

    if (!url) {
      this.showMessage('Please enter a property URL', 'warning');
      return;
    }

    if (!this.isPropertySite(url)) {
      this.showMessage('Please enter a URL from Zillow, Redfin, Realtor.com, or Trulia', 'warning');
      return;
    }

    try {
      this.showLoading('Analyzing property from URL...');
      
      const response = await chrome.runtime.sendMessage({
        action: 'parsePropertyFromUrl',
        url: url
      });

      if (response.success) {
        const analysisResponse = await chrome.runtime.sendMessage({
          action: 'analyzeProperty',
          propertyData: response.data
        });

        if (analysisResponse.success) {
          this.showAnalysisResults(analysisResponse.data);
          urlInput.value = '';
          this.toggleUrlInput();
        } else {
          this.showMessage('Failed to analyze property', 'error');
        }
      } else {
        this.showMessage('Failed to parse property URL', 'error');
      }
    } catch (error) {
      console.error('Error analyzing from URL:', error);
      this.showMessage('Error analyzing property', 'error');
    } finally {
      this.hideLoading();
    }
  }

  /**
   * Load recent properties into popup
   */
  async loadRecentProperties() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getProperties',
        filters: { sortBy: 'date' }
      });

      if (response.success) {
        this.displayRecentProperties(response.data.slice(0, 5)); // Show last 5
      }
    } catch (error) {
      console.error('Error loading recent properties:', error);
    }
  }

  /**
   * Display recent properties in the list
   * @param {Array} properties - Recent properties
   */
  displayRecentProperties(properties) {
    const container = document.getElementById('recentList');
    
    if (properties.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🏠</div>
          <div class="empty-state-text">No properties analyzed yet</div>
          <div class="empty-state-subtext">Start by analyzing a property above</div>
        </div>
      `;
      return;
    }

    container.innerHTML = properties.map(property => `
      <div class="property-item" data-property-id="${property.id}">
        <div class="property-icon">${this.getPropertyIcon(property.site)}</div>
        <div class="property-info">
          <div class="property-address">${property.address || 'Unknown Address'}</div>
          <div class="property-details">
            $${(property.price || 0).toLocaleString()} • 
            ${property.beds || 0}bd/${property.baths || 0}ba • 
            ${(property.sqft || 0).toLocaleString()}sqft
          </div>
        </div>
        <div class="property-verdict ${this.getVerdictClass(property.analysis?.verdict)}">
          ${property.analysis?.verdict || 'Not Analyzed'}
        </div>
      </div>
    `).join('');

    // Add click listeners to property items
    container.querySelectorAll('.property-item').forEach(item => {
      item.addEventListener('click', () => {
        const propertyId = item.dataset.propertyId;
        this.viewProperty(propertyId);
      });
    });
  }

  /**
   * Get icon for property site
   * @param {string} site - Site name
   * @returns {string} Icon emoji
   */
  getPropertyIcon(site) {
    const icons = {
      'zillow': '🏠',
      'redfin': '🏡',
      'realtor': '🏘️',
      'trulia': '🏛️'
    };
    return icons[site?.toLowerCase()] || '🏢';
  }

  /**
   * Get CSS class for verdict
   * @param {string} verdict - Verdict string
   * @returns {string} CSS class
   */
  getVerdictClass(verdict) {
    switch (verdict) {
      case 'Strong Buy': return 'strong-buy';
      case 'Worth Considering': return 'worth-considering';
      case 'Pass': return 'pass';
      default: return '';
    }
  }

  /**
   * Load quick stats for portfolio overview
   */
  async loadQuickStats() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getProperties'
      });

      if (response.success) {
        this.displayQuickStats(response.data);
      }
    } catch (error) {
      console.error('Error loading quick stats:', error);
    }
  }

  /**
   * Display quick stats in overview section
   * @param {Array} properties - All properties
   */
  displayQuickStats(properties) {
    const totalProperties = properties.length;
    const strongBuys = properties.filter(p => p.analysis?.verdict === 'Strong Buy').length;
    
    const cashFlows = properties
      .filter(p => p.analysis?.financials?.cashFlow?.monthly)
      .map(p => p.analysis.financials.cashFlow.monthly);
    const avgCashFlow = cashFlows.length > 0 
      ? cashFlows.reduce((a, b) => a + b, 0) / cashFlows.length 
      : 0;

    const capRates = properties
      .filter(p => p.analysis?.financials?.capRate)
      .map(p => p.analysis.financials.capRate);
    const avgCapRate = capRates.length > 0
      ? capRates.reduce((a, b) => a + b, 0) / capRates.length
      : 0;

    // Update DOM elements
    document.getElementById('totalProperties').textContent = totalProperties;
    document.getElementById('strongBuys').textContent = strongBuys;
    document.getElementById('avgCashFlow').textContent = `$${Math.round(avgCashFlow).toLocaleString()}`;
    document.getElementById('avgCapRate').textContent = `${avgCapRate.toFixed(1)}%`;
  }

  /**
   * Generate ChatGPT prompt for specific analysis type
   * @param {string} promptType - Type of prompt to generate
   */
  async generateChatGPTPrompt(promptType) {
    try {
      let promptData = {};

      // Get current property data if on property page
      if (this.currentTab && this.isPropertyPage(this.currentTab.url)) {
        const response = await chrome.tabs.sendMessage(this.currentTab.id, {
          action: 'extractPropertyData'
        });
        if (response.success) {
          promptData = response.data;
        }
      }

      // Generate prompt based on type
      const promptResponse = await chrome.runtime.sendMessage({
        action: 'generateChatGPTPrompt',
        type: promptType,
        data: promptData
      });

      if (promptResponse.success) {
        // Copy prompt to clipboard
        await navigator.clipboard.writeText(promptResponse.data);
        this.showMessage('Prompt copied to clipboard! Paste it in ChatGPT', 'success');
        
        // Open ChatGPT in new tab
        chrome.tabs.create({ url: 'https://chat.openai.com' });
      } else {
        this.showMessage('Failed to generate prompt', 'error');
      }
    } catch (error) {
      console.error('Error generating prompt:', error);
      this.showMessage('Error generating prompt', 'error');
    }
  }

  /**
   * View detailed property information
   * @param {string} propertyId - Property ID
   */
  async viewProperty(propertyId) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getProperty',
        propertyId: propertyId
      });

      if (response.success && response.data) {
        this.showAnalysisResults({
          property: response.data,
          analysis: response.data.analysis
        });
      }
    } catch (error) {
      console.error('Error viewing property:', error);
      this.showMessage('Error loading property details', 'error');
    }
  }

  /**
   * Show analysis results in a modal-like view
   * @param {Object} analysisData - Analysis results
   */
  showAnalysisResults(analysisData) {
    // For now, just show a summary message
    const { property, analysis } = analysisData;
    const verdict = analysis.verdict;
    const cashFlow = analysis.financials.cashFlow.monthly;
    const capRate = analysis.financials.capRate;

    this.showMessage(
      `Analysis complete! ${verdict} - Cash Flow: $${cashFlow.toLocaleString()}/mo, Cap Rate: ${capRate.toFixed(2)}%`,
      verdict === 'Strong Buy' ? 'success' : verdict === 'Pass' ? 'error' : 'warning'
    );

    // Refresh the recent properties list
    this.loadRecentProperties();
    this.loadQuickStats();
  }

  /**
   * Open settings page
   */
  openSettings() {
    chrome.tabs.create({
      url: chrome.runtime.getURL('src/options/options.html')
    });
  }

  /**
   * Open properties manager
   */
  openPropertiesManager() {
    chrome.tabs.create({
      url: chrome.runtime.getURL('src/options/options.html#properties')
    });
  }

  /**
   * Export data
   */
  async exportData() {
    try {
      this.showLoading('Exporting data...');
      
      const response = await chrome.runtime.sendMessage({
        action: 'exportData',
        format: 'csv'
      });

      if (response.success) {
        // Create and download CSV file
        const blob = new Blob([response.data], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `real-estate-analysis-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        
        URL.revokeObjectURL(url);
        
        this.showMessage('Data exported successfully!', 'success');
      } else {
        this.showMessage('Failed to export data', 'error');
      }
    } catch (error) {
      console.error('Error exporting data:', error);
      this.showMessage('Error exporting data', 'error');
    } finally {
      this.hideLoading();
    }
  }

  /**
   * Open help documentation
   */
  openHelp() {
    chrome.tabs.create({
      url: 'https://github.com/your-username/re-analyzer-extension/blob/main/README.md'
    });
  }

  /**
   * Show about information
   */
  showAbout() {
    const manifest = chrome.runtime.getManifest();
    alert(`Real Estate Analyzer v${manifest.version}\n\nTransform ChatGPT into a real estate portfolio manager. Analyze, compare, and organize properties from major real estate sites.\n\nDeveloped with ❤️ for real estate investors.`);
  }

  /**
   * Show loading overlay
   * @param {string} message - Loading message
   */
  showLoading(message = 'Loading...') {
    const overlay = document.getElementById('loadingOverlay');
    const text = overlay.querySelector('.loading-text');
    text.textContent = message;
    overlay.classList.remove('hidden');
  }

  /**
   * Hide loading overlay
   */
  hideLoading() {
    document.getElementById('loadingOverlay').classList.add('hidden');
  }

  /**
   * Show status message
   * @param {string} message - Message text
   * @param {string} type - Message type (success, error, warning, info)
   */
  showMessage(message, type = 'info') {
    const container = document.getElementById('statusMessages');
    
    const messageEl = document.createElement('div');
    messageEl.className = `status-message ${type}`;
    messageEl.textContent = message;
    
    container.appendChild(messageEl);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (messageEl.parentNode) {
        messageEl.parentNode.removeChild(messageEl);
      }
    }, 5000);
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});
