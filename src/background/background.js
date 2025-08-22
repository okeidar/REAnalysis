/**
 * Background Script for Real Estate Analyzer Chrome Extension
 * Handles extension lifecycle, messaging, and data coordination
 */

// Import utility modules with error handling
try {
  importScripts('../utils/storageManager.js');
  importScripts('../utils/analysisEngine.js');
  importScripts('../utils/propertyParser.js');
  
  console.log('Real Estate Analyzer: Scripts imported successfully');
} catch (error) {
  console.error('Real Estate Analyzer: Error importing scripts:', error);
}

// Create global instances for service worker
let storageManager, analysisEngine, propertyParser;

try {
  storageManager = new StorageManager();
  analysisEngine = new AnalysisEngine();
  propertyParser = new PropertyParser();
  
  console.log('Real Estate Analyzer: All modules loaded successfully');
} catch (error) {
  console.error('Real Estate Analyzer: Error creating instances:', error);
}

class BackgroundManager {
  constructor() {
    this.init();
  }

  /**
   * Initialize background script
   */
  init() {
    this.setupEventListeners();
    this.setupContextMenus();
    console.log('Real Estate Analyzer Extension loaded');
  }

  /**
   * Setup event listeners for extension events
   */
  setupEventListeners() {
    // Extension install/update events
    chrome.runtime.onInstalled.addListener((details) => {
      this.handleInstalled(details);
    });

    // Message handling between components
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // Keep message channel open for async responses
    });

    // Tab update events for property detection
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      this.handleTabUpdate(tabId, changeInfo, tab);
    });

    // Storage change events
    chrome.storage.onChanged.addListener((changes, areaName) => {
      this.handleStorageChange(changes, areaName);
    });
  }

  /**
   * Setup context menus for right-click actions
   */
  setupContextMenus() {
    // Check if contextMenus API is available
    if (!chrome.contextMenus) {
      console.warn('Context menus API not available');
      return;
    }

    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: 'analyzeProperty',
        title: 'Analyze Property with Real Estate Analyzer',
        contexts: ['link'],
        documentUrlPatterns: [
          'https://chat.openai.com/*'
        ]
      });

      chrome.contextMenus.create({
        id: 'analyzeCurrentPage',
        title: 'Use Real Estate Analyzer',
        contexts: ['page'],
        documentUrlPatterns: [
          'https://chat.openai.com/*'
        ]
      });
    });

    chrome.contextMenus.onClicked.addListener((info, tab) => {
      this.handleContextMenuClick(info, tab);
    });
  }

  /**
   * Handle extension installation and updates
   * @param {Object} details - Installation details
   */
  async handleInstalled(details) {
    if (details.reason === 'install') {
      // First time installation
      await this.initializeExtension();
      chrome.tabs.create({
        url: chrome.runtime.getURL('src/options/options.html')
      });
    } else if (details.reason === 'update') {
      // Extension update
      await this.handleExtensionUpdate(details.previousVersion);
    }
  }

  /**
   * Initialize extension data and settings
   */
  async initializeExtension() {
    try {
      // Initialize default user profile if not exists
      const profile = await storageManager.getUserProfile();
      if (!profile.preferences) {
        await storageManager.saveUserProfile(storageManager.getDefaultProfile());
      }

      // Initialize default folders if not exist
      const folders = await storageManager.getFolders();
      if (folders.length === 0) {
        await storageManager.saveFolders([
          { id: 'default', name: 'All Properties', color: '#007bff' },
          { id: 'favorites', name: 'Favorites', color: '#28a745' },
          { id: 'watchlist', name: 'Watch List', color: '#ffc107' }
        ]);
      }

      console.log('Extension initialized successfully');
    } catch (error) {
      console.error('Error initializing extension:', error);
    }
  }

  /**
   * Handle extension updates
   * @param {string} previousVersion - Previous version number
   */
  async handleExtensionUpdate(previousVersion) {
    console.log(`Extension updated from ${previousVersion} to ${chrome.runtime.getManifest().version}`);
    
    // Handle data migration if needed
    try {
      // Add version-specific migration logic here
      if (previousVersion < '1.0.0') {
        // Migration logic for versions before 1.0.0
      }
    } catch (error) {
      console.error('Error during extension update:', error);
    }
  }

  /**
   * Handle messages from other parts of the extension
   * @param {Object} request - Message request
   * @param {Object} sender - Message sender
   * @param {Function} sendResponse - Response callback
   */
  async handleMessage(request, sender, sendResponse) {
    try {
      switch (request.action) {
        case 'ping':
          sendResponse({ success: true, message: 'Extension is active' });
          break;

        case 'analyzeProperty':
          const analysis = await this.analyzeProperty(request.propertyData);
          sendResponse({ success: true, data: analysis });
          break;

        case 'saveProperty':
          const saved = await this.saveProperty(request.propertyData);
          sendResponse({ success: saved });
          break;

        case 'getProperties':
          const properties = await this.getProperties(request.filters);
          sendResponse({ success: true, data: properties });
          break;

        case 'deleteProperty':
          const deleted = await storageManager.deleteProperty(request.propertyId);
          sendResponse({ success: deleted });
          break;

        case 'updateUserProfile':
          const profileUpdated = await storageManager.saveUserProfile(request.profile);
          sendResponse({ success: profileUpdated });
          break;

        case 'exportData':
          const exportData = await this.exportData(request.format);
          sendResponse({ success: true, data: exportData });
          break;

        case 'parsePropertyFromUrl':
          const propertyData = await this.parsePropertyFromUrl(request.url);
          sendResponse({ success: true, data: propertyData });
          break;

        case 'compareProperties':
          const comparison = await this.compareProperties(request.propertyIds);
          sendResponse({ success: true, data: comparison });
          break;

        case 'generateChatGPTPrompt':
          const prompt = await this.generateChatGPTPrompt(request.type, request.data);
          sendResponse({ success: true, data: prompt });
          break;

        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Handle tab updates to detect property pages
   * @param {number} tabId - Tab ID
   * @param {Object} changeInfo - Change information
   * @param {Object} tab - Tab object
   */
  async handleTabUpdate(tabId, changeInfo, tab) {
    if (changeInfo.status === 'complete' && tab.url) {
      // Check if this is a ChatGPT page
      if (tab.url.includes('chat.openai.com')) {
        // Enable page action for ChatGPT pages
        chrome.action.setBadgeText({
          tabId: tabId,
          text: '📊'
        });
        chrome.action.setBadgeBackgroundColor({
          tabId: tabId,
          color: '#007bff'
        });
      }
    }
  }

  /**
   * Handle storage changes
   * @param {Object} changes - Storage changes
   * @param {string} areaName - Storage area name
   */
  handleStorageChange(changes, areaName) {
    // Notify other parts of the extension about data changes
    chrome.runtime.sendMessage({
      action: 'storageChanged',
      changes: changes,
      areaName: areaName
    }).catch(() => {
      // Ignore errors if no listeners
    });
  }

  /**
   * Handle context menu clicks
   * @param {Object} info - Click info
   * @param {Object} tab - Tab object
   */
  async handleContextMenuClick(info, tab) {
    try {
      if (info.menuItemId === 'analyzeProperty') {
        // Analyze property from link
        const propertyData = await this.parsePropertyFromUrl(info.linkUrl);
        if (propertyData) {
          const analysis = await this.analyzeProperty(propertyData);
          this.showAnalysisNotification(analysis);
        }
      } else if (info.menuItemId === 'analyzeCurrentPage') {
        // Analyze current page
        chrome.tabs.sendMessage(tab.id, {
          action: 'extractPropertyData'
        });
      }
    } catch (error) {
      console.error('Error handling context menu click:', error);
    }
  }

  /**
   * Analyze a property using the analysis engine
   * @param {Object} propertyData - Property data
   * @returns {Promise<Object>} Analysis results
   */
  async analyzeProperty(propertyData) {
    try {
      const userProfile = await storageManager.getUserProfile();
      const analysis = analysisEngine.analyzeProperty(propertyData, userProfile);
      
      // Add analysis to property data
      propertyData.analysis = analysis;
      propertyData.analyzedAt = new Date().toISOString();
      
      return {
        property: propertyData,
        analysis: analysis
      };
    } catch (error) {
      console.error('Error analyzing property:', error);
      throw error;
    }
  }

  /**
   * Save property to storage
   * @param {Object} propertyData - Property data to save
   * @returns {Promise<boolean>} Success status
   */
  async saveProperty(propertyData) {
    try {
      // Ensure property has required fields
      if (!propertyData.id) {
        propertyData.id = storageManager.generateId();
      }
      propertyData.createdAt = propertyData.createdAt || new Date().toISOString();
      propertyData.updatedAt = new Date().toISOString();
      propertyData.folder = propertyData.folder || 'default';
      
      return await storageManager.saveProperty(propertyData);
    } catch (error) {
      console.error('Error saving property:', error);
      return false;
    }
  }

  /**
   * Get properties with optional filtering
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} Filtered properties
   */
  async getProperties(filters = {}) {
    try {
      const allProperties = await storageManager.getProperties();
      let properties = Object.values(allProperties);

      // Apply filters
      if (filters.folder) {
        properties = properties.filter(p => p.folder === filters.folder);
      }
      
      if (filters.verdict) {
        properties = properties.filter(p => 
          p.analysis && p.analysis.verdict === filters.verdict
        );
      }
      
      if (filters.minCashFlow) {
        properties = properties.filter(p => 
          p.analysis && p.analysis.financials.cashFlow.monthly >= filters.minCashFlow
        );
      }

      // Sort properties
      if (filters.sortBy) {
        properties.sort((a, b) => {
          switch (filters.sortBy) {
            case 'price':
              return (b.price || 0) - (a.price || 0);
            case 'cashFlow':
              return (b.analysis?.financials.cashFlow.monthly || 0) - 
                     (a.analysis?.financials.cashFlow.monthly || 0);
            case 'capRate':
              return (b.analysis?.financials.capRate || 0) - 
                     (a.analysis?.financials.capRate || 0);
            case 'date':
              return new Date(b.createdAt) - new Date(a.createdAt);
            default:
              return 0;
          }
        });
      }

      return properties;
    } catch (error) {
      console.error('Error getting properties:', error);
      return [];
    }
  }

  /**
   * Parse property data from URL
   * @param {string} url - Property URL
   * @returns {Promise<Object>} Parsed property data
   */
  async parsePropertyFromUrl(url) {
    try {
      return await propertyParser.parsePropertyFromUrl(url);
    } catch (error) {
      console.error('Error parsing property from URL:', error);
      return null;
    }
  }

  /**
   * Compare multiple properties
   * @param {Array} propertyIds - Array of property IDs
   * @returns {Promise<Object>} Comparison results
   */
  async compareProperties(propertyIds) {
    try {
      const properties = [];
      for (const id of propertyIds) {
        const property = await storageManager.getProperty(id);
        if (property) {
          properties.push(property);
        }
      }

      return analysisEngine.compareProperties(properties);
    } catch (error) {
      console.error('Error comparing properties:', error);
      return [];
    }
  }

  /**
   * Generate ChatGPT prompt for analysis
   * @param {string} type - Prompt type
   * @param {Object} data - Data for prompt
   * @returns {Promise<string>} Generated prompt
   */
  async generateChatGPTPrompt(type, data) {
    const prompts = {
      analyze: `Analyze this real estate investment property:
      
Address: ${data.address}
Price: $${data.price?.toLocaleString()}
Beds/Baths: ${data.beds}/${data.baths}
Square Feet: ${data.sqft?.toLocaleString()}
Property Taxes: $${data.taxes?.toLocaleString()}/year

Please provide insights on:
1. Investment potential
2. Market conditions in the area
3. Potential risks and red flags
4. Renovation or improvement opportunities
5. Overall recommendation`,

      compare: `Compare these real estate investment properties:

${data.properties?.map((p, i) => `
Property ${i + 1}:
- Address: ${p.address}
- Price: $${p.price?.toLocaleString()}
- Cash Flow: $${p.analysis?.financials?.cashFlow?.monthly}/month
- Cap Rate: ${p.analysis?.financials?.capRate?.toFixed(2)}%
- Verdict: ${p.analysis?.verdict}
`).join('\n')}

Which property offers the best investment opportunity and why?`,

      market: `Provide market analysis for ${data.location}:

1. Current rent trends
2. Vacancy rates
3. Job market and economic indicators
4. Population growth
5. Investment outlook for real estate
6. Potential risks and opportunities`,

      scenario: `Run investment scenarios for this property:

Property: ${data.address}
Current Analysis:
- Monthly Cash Flow: $${data.analysis?.financials?.cashFlow?.monthly}
- Cap Rate: ${data.analysis?.financials?.capRate?.toFixed(2)}%
- CoC Return: ${data.analysis?.financials?.cocReturn?.toFixed(2)}%

Analyze these scenarios:
1. Interest rates increase by 1%
2. Rent increases by 10%
3. Property value appreciates 5% annually
4. Major repair needed ($10,000)`
    };

    return prompts[type] || 'Please analyze this real estate investment opportunity.';
  }

  /**
   * Export data in specified format
   * @param {string} format - Export format (json, csv, etc.)
   * @returns {Promise<Object>} Export data
   */
  async exportData(format = 'json') {
    try {
      const data = await storageManager.exportData();
      
      if (format === 'csv') {
        return this.convertToCSV(data);
      }
      
      return data;
    } catch (error) {
      console.error('Error exporting data:', error);
      return null;
    }
  }

  /**
   * Convert data to CSV format
   * @param {Object} data - Data to convert
   * @returns {string} CSV string
   */
  convertToCSV(data) {
    const properties = Object.values(data.properties || {});
    if (properties.length === 0) return '';

    const headers = [
      'Address', 'Price', 'Beds', 'Baths', 'Sqft', 'Monthly Cash Flow',
      'Cap Rate', 'CoC Return', 'Verdict', 'Created Date'
    ];

    const rows = properties.map(p => [
      p.address || '',
      p.price || 0,
      p.beds || 0,
      p.baths || 0,
      p.sqft || 0,
      p.analysis?.financials?.cashFlow?.monthly || 0,
      p.analysis?.financials?.capRate || 0,
      p.analysis?.financials?.cocReturn || 0,
      p.analysis?.verdict || '',
      p.createdAt || ''
    ]);

    return [headers, ...rows].map(row => 
      row.map(cell => `"${cell}"`).join(',')
    ).join('\n');
  }

  /**
   * Show analysis notification
   * @param {Object} analysis - Analysis results
   */
  showAnalysisNotification(analysis) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'assets/icons/icon48.png',
      title: 'Property Analysis Complete',
      message: `Verdict: ${analysis.analysis.verdict} | Cash Flow: $${analysis.analysis.financials.cashFlow.monthly}/month`
    });
  }
}

// Initialize background manager
const backgroundManager = new BackgroundManager();
