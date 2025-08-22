/**
 * Content Script for Real Estate Analyzer
 * Extracts property data from real estate websites
 */

class ContentExtractor {
  constructor() {
    this.currentSite = this.identifyCurrentSite();
    this.init();
  }

  /**
   * Initialize content script
   */
  init() {
    this.setupMessageListener();
    this.setupPropertyDetection();
    this.injectAnalyzeButton();
  }

  /**
   * Setup message listener for background script communication
   */
  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true;
    });
  }

  /**
   * Setup automatic property detection
   */
  setupPropertyDetection() {
    // Detect if this is a property detail page
    if (this.isPropertyPage()) {
      this.extractAndAnalyzeProperty();
    }
  }

  /**
   * Inject analyze button into property pages
   */
  injectAnalyzeButton() {
    if (!this.isPropertyPage()) return;

    const button = document.createElement('div');
    button.id = 're-analyzer-button';
    button.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        background: #007bff;
        color: white;
        padding: 12px 20px;
        border-radius: 25px;
        cursor: pointer;
        font-family: Arial, sans-serif;
        font-size: 14px;
        font-weight: bold;
        box-shadow: 0 4px 12px rgba(0,123,255,0.3);
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        gap: 8px;
      ">
        <span>📊</span>
        <span>Analyze Property</span>
      </div>
    `;

    button.addEventListener('click', () => {
      this.extractAndAnalyzeProperty();
    });

    button.addEventListener('mouseenter', (e) => {
      e.target.style.transform = 'translateY(-2px)';
      e.target.style.boxShadow = '0 6px 16px rgba(0,123,255,0.4)';
    });

    button.addEventListener('mouseleave', (e) => {
      e.target.style.transform = 'translateY(0)';
      e.target.style.boxShadow = '0 4px 12px rgba(0,123,255,0.3)';
    });

    document.body.appendChild(button);
  }

  /**
   * Identify current real estate site
   * @returns {string|null} Site identifier
   */
  identifyCurrentSite() {
    const hostname = window.location.hostname.toLowerCase();
    
    if (hostname.includes('zillow.com')) return 'zillow';
    if (hostname.includes('redfin.com')) return 'redfin';
    if (hostname.includes('realtor.com')) return 'realtor';
    if (hostname.includes('trulia.com')) return 'trulia';
    
    return null;
  }

  /**
   * Check if current page is a property detail page
   * @returns {boolean} True if property page
   */
  isPropertyPage() {
    const url = window.location.href;
    const pathname = window.location.pathname;

    switch (this.currentSite) {
      case 'zillow':
        return pathname.includes('/homedetails/');
      case 'redfin':
        return pathname.includes('/home/');
      case 'realtor':
        return pathname.includes('/realestateandhomes-detail/');
      case 'trulia':
        return pathname.includes('/p/');
      default:
        return false;
    }
  }

  /**
   * Handle messages from background script
   * @param {Object} request - Message request
   * @param {Object} sender - Message sender
   * @param {Function} sendResponse - Response callback
   */
  async handleMessage(request, sender, sendResponse) {
    try {
      switch (request.action) {
        case 'extractPropertyData':
          const propertyData = await this.extractPropertyData();
          sendResponse({ success: true, data: propertyData });
          break;
        
        case 'analyzeProperty':
          await this.extractAndAnalyzeProperty();
          sendResponse({ success: true });
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
   * Extract property data from current page
   * @returns {Promise<Object>} Property data
   */
  async extractPropertyData() {
    try {
      let propertyData = {
        url: window.location.href,
        site: this.currentSite,
        extractedAt: new Date().toISOString()
      };

      switch (this.currentSite) {
        case 'zillow':
          propertyData = { ...propertyData, ...this.extractZillowData() };
          break;
        case 'redfin':
          propertyData = { ...propertyData, ...this.extractRedfinData() };
          break;
        case 'realtor':
          propertyData = { ...propertyData, ...this.extractRealtorData() };
          break;
        case 'trulia':
          propertyData = { ...propertyData, ...this.extractTruliaData() };
          break;
        default:
          propertyData = { ...propertyData, ...this.extractGenericData() };
      }

      // Clean and validate data
      propertyData = this.cleanPropertyData(propertyData);
      
      return propertyData;
    } catch (error) {
      console.error('Error extracting property data:', error);
      return this.getEmptyPropertyData();
    }
  }

  /**
   * Extract data from Zillow property page
   * @returns {Object} Zillow property data
   */
  extractZillowData() {
    const data = {};

    try {
      // Address
      data.address = this.getText('.summary-container h1') || 
                    this.getText('[data-testid="property-address"]') ||
                    this.getText('.street-address');

      // Price
      data.price = this.getNumeric('.summary-container .notranslate') ||
                  this.getNumeric('[data-testid="price"]') ||
                  this.getNumeric('.price-range');

      // Beds/Baths
      const bedsBaths = this.getText('.summary-container .summary-table') ||
                       this.getText('[data-testid="bed-bath-info"]');
      if (bedsBaths) {
        const bedsMatch = bedsBaths.match(/(\d+)\s*(?:bed|bd)/i);
        const bathsMatch = bedsBaths.match(/(\d+(?:\.\d+)?)\s*(?:bath|ba)/i);
        data.beds = bedsMatch ? parseInt(bedsMatch[1]) : 0;
        data.baths = bathsMatch ? parseFloat(bathsMatch[1]) : 0;
      }

      // Square footage
      data.sqft = this.getNumeric('.summary-container') ||
                 this.getNumericFromText('[data-testid="floor-size"]', 'sqft');

      // Year built
      data.yearBuilt = this.getNumericFromText('.summary-table', 'built') ||
                      this.getNumericFromText('[data-testid="built-year"]');

      // Property type
      data.propertyType = this.getText('.summary-container .property-type') ||
                         this.getText('[data-testid="property-type"]');

      // Description
      data.description = this.getText('.description-container') ||
                        this.getText('[data-testid="description"]') ||
                        this.getText('.property-description');

      // Property taxes
      data.taxes = this.getNumericFromText('.tax-info', '$') ||
                  this.getNumericFromText('[data-testid="tax-info"]', '$');

      // HOA fees
      data.hoa = this.getNumericFromText('.hoa-info', '$') ||
                this.getNumericFromText('[data-testid="hoa-info"]', '$');

      // Zestimate
      data.zestimate = this.getNumeric('.zestimate-container') ||
                      this.getNumeric('[data-testid="zestimate"]');

      // Rent estimate
      data.rentZestimate = this.getNumeric('.rent-zestimate') ||
                          this.getNumeric('[data-testid="rent-zestimate"]');

      // Images
      data.images = this.extractImages([
        '.media-stream img',
        '.hdp-photo-carousel img',
        '[data-testid="property-image"]'
      ]);

      // Days on market
      data.daysOnMarket = this.getNumericFromText('.price-history', 'days') ||
                         this.getNumericFromText('[data-testid="days-on-market"]');

    } catch (error) {
      console.error('Error extracting Zillow data:', error);
    }

    return data;
  }

  /**
   * Extract data from Redfin property page
   * @returns {Object} Redfin property data
   */
  extractRedfinData() {
    const data = {};

    try {
      // Address
      data.address = this.getText('.street-address') ||
                    this.getText('[data-rf-test-id="abp-streetLine"]');

      // Price
      data.price = this.getNumeric('.statsValue') ||
                  this.getNumeric('[data-rf-test-id="abp-price"]');

      // Beds/Baths from stats section
      const bedsElement = this.getElementByText('.stats .stat-value', 'bed');
      const bathsElement = this.getElementByText('.stats .stat-value', 'bath');
      data.beds = bedsElement ? this.getNumeric(bedsElement) : 0;
      data.baths = bathsElement ? this.getNumeric(bathsElement) : 0;

      // Square footage
      data.sqft = this.getNumericFromText('.statsValue', 'sq ft') ||
                 this.getNumericFromText('[data-rf-test-id="abp-sqFt"]');

      // Year built
      data.yearBuilt = this.getNumericFromText('.amenities', 'Built') ||
                      this.getNumericFromText('.keyDetails', 'Built');

      // Property type
      data.propertyType = this.getText('.property-type') ||
                         this.getText('[data-rf-test-id="abp-propertyType"]');

      // Description
      data.description = this.getText('.remarks') ||
                        this.getText('[data-rf-test-id="abp-remarks"]');

      // Property taxes
      data.taxes = this.getNumericFromText('.keyDetails', 'Property Tax') ||
                  this.getNumericFromText('.tax-records', '$');

      // HOA fees
      data.hoa = this.getNumericFromText('.keyDetails', 'HOA') ||
                this.getNumericFromText('.hoa-info', '$');

      // Images
      data.images = this.extractImages([
        '.bp-Carousel img',
        '.photo-carousel img'
      ]);

    } catch (error) {
      console.error('Error extracting Redfin data:', error);
    }

    return data;
  }

  /**
   * Extract data from Realtor.com property page
   * @returns {Object} Realtor.com property data
   */
  extractRealtorData() {
    const data = {};

    try {
      // Address
      data.address = this.getText('[data-testid="property-address"]') ||
                    this.getText('.address');

      // Price
      data.price = this.getNumeric('[data-testid="property-price"]') ||
                  this.getNumeric('.price');

      // Beds/Baths
      data.beds = this.getNumeric('[data-testid="property-beds"]') ||
                 this.getNumericFromText('.property-meta', 'bed');
      data.baths = this.getNumeric('[data-testid="property-baths"]') ||
                  this.getNumericFromText('.property-meta', 'bath');

      // Square footage
      data.sqft = this.getNumeric('[data-testid="property-sqft"]') ||
                 this.getNumericFromText('.property-meta', 'sqft');

      // Year built
      data.yearBuilt = this.getNumericFromText('.property-details', 'Built') ||
                      this.getNumericFromText('.key-facts', 'Built');

      // Property type
      data.propertyType = this.getText('[data-testid="property-type"]') ||
                         this.getText('.property-type');

      // Description
      data.description = this.getText('[data-testid="property-description"]') ||
                        this.getText('.description');

      // Property taxes
      data.taxes = this.getNumericFromText('.tax-info', '$') ||
                  this.getNumericFromText('.financial-info', 'Tax');

      // Images
      data.images = this.extractImages([
        '.photo-list img',
        '.carousel img'
      ]);

    } catch (error) {
      console.error('Error extracting Realtor.com data:', error);
    }

    return data;
  }

  /**
   * Extract data from Trulia property page
   * @returns {Object} Trulia property data
   */
  extractTruliaData() {
    const data = {};

    try {
      // Address
      data.address = this.getText('[data-testid="property-street"]') ||
                    this.getText('.address-container h1');

      // Price
      data.price = this.getNumeric('[data-testid="property-price"]') ||
                  this.getNumeric('.price-container');

      // Beds/Baths
      data.beds = this.getNumericFromText('.property-features', 'bed') ||
                 this.getNumeric('[data-testid="property-beds"]');
      data.baths = this.getNumericFromText('.property-features', 'bath') ||
                  this.getNumeric('[data-testid="property-baths"]');

      // Square footage
      data.sqft = this.getNumericFromText('.property-features', 'sqft') ||
                 this.getNumeric('[data-testid="property-sqft"]');

      // Description
      data.description = this.getText('.property-description') ||
                        this.getText('[data-testid="property-description"]');

      // Images
      data.images = this.extractImages([
        '.media-stream img',
        '.photo-carousel img'
      ]);

    } catch (error) {
      console.error('Error extracting Trulia data:', error);
    }

    return data;
  }

  /**
   * Extract basic data from any property page
   * @returns {Object} Generic property data
   */
  extractGenericData() {
    const data = {};

    try {
      // Try common selectors for address
      data.address = this.getText('h1') ||
                    this.getText('.address') ||
                    this.getText('[class*="address"]');

      // Try common selectors for price
      data.price = this.getNumeric('.price') ||
                  this.getNumeric('[class*="price"]') ||
                  this.getNumericFromPageText('$');

      // Try to find beds/baths in text
      const pageText = document.body.textContent;
      const bedsMatch = pageText.match(/(\d+)\s*(?:bed|bedroom)/i);
      const bathsMatch = pageText.match(/(\d+(?:\.\d+)?)\s*(?:bath|bathroom)/i);
      data.beds = bedsMatch ? parseInt(bedsMatch[1]) : 0;
      data.baths = bathsMatch ? parseFloat(bathsMatch[1]) : 0;

      // Try to find square footage
      const sqftMatch = pageText.match(/(\d{1,3}(?:,\d{3})*)\s*(?:sq\.?\s*ft|sqft|square feet)/i);
      data.sqft = sqftMatch ? parseInt(sqftMatch[1].replace(/,/g, '')) : 0;

      // Get all images
      data.images = this.extractImages(['img']);

    } catch (error) {
      console.error('Error extracting generic data:', error);
    }

    return data;
  }

  /**
   * Get text content from element
   * @param {string} selector - CSS selector
   * @returns {string} Text content
   */
  getText(selector) {
    const element = document.querySelector(selector);
    return element ? element.textContent.trim() : '';
  }

  /**
   * Get numeric value from element
   * @param {string} selector - CSS selector
   * @returns {number} Numeric value
   */
  getNumeric(selector) {
    const text = this.getText(selector);
    return this.parseNumeric(text);
  }

  /**
   * Get numeric value from text containing specific substring
   * @param {string} selector - CSS selector
   * @param {string} contains - Text to search for
   * @returns {number} Numeric value
   */
  getNumericFromText(selector, contains) {
    const elements = document.querySelectorAll(selector);
    for (const element of elements) {
      if (element.textContent.toLowerCase().includes(contains.toLowerCase())) {
        return this.parseNumeric(element.textContent);
      }
    }
    return 0;
  }

  /**
   * Get numeric value from page text
   * @param {string} pattern - Pattern to search for
   * @returns {number} Numeric value
   */
  getNumericFromPageText(pattern) {
    const text = document.body.textContent;
    const regex = new RegExp(`\\${pattern}([\\d,]+)`, 'g');
    const matches = [...text.matchAll(regex)];
    
    if (matches.length > 0) {
      // Return the largest number found (likely the price)
      return Math.max(...matches.map(m => this.parseNumeric(m[1])));
    }
    
    return 0;
  }

  /**
   * Get element containing specific text
   * @param {string} selector - CSS selector
   * @param {string} text - Text to search for
   * @returns {Element|null} Found element
   */
  getElementByText(selector, text) {
    const elements = document.querySelectorAll(selector);
    for (const element of elements) {
      if (element.textContent.toLowerCase().includes(text.toLowerCase())) {
        return element;
      }
    }
    return null;
  }

  /**
   * Extract images from page
   * @param {Array} selectors - CSS selectors for images
   * @returns {Array} Array of image URLs
   */
  extractImages(selectors) {
    const images = [];
    
    selectors.forEach(selector => {
      const imgElements = document.querySelectorAll(selector);
      imgElements.forEach(img => {
        if (img.src && !images.includes(img.src)) {
          // Filter out small icons and placeholder images
          if (img.naturalWidth > 100 && img.naturalHeight > 100) {
            images.push(img.src);
          }
        }
      });
    });

    return images.slice(0, 20); // Limit to 20 images
  }

  /**
   * Parse numeric value from string
   * @param {string} text - Text to parse
   * @returns {number} Parsed number
   */
  parseNumeric(text) {
    if (typeof text === 'number') return text;
    if (typeof text !== 'string') return 0;
    
    // Remove common non-numeric characters
    const cleaned = text.replace(/[$,\s]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }

  /**
   * Clean property data
   * @param {Object} data - Raw property data
   * @returns {Object} Cleaned property data
   */
  cleanPropertyData(data) {
    // Calculate price per sqft
    if (data.price && data.sqft) {
      data.pricePerSqft = Math.round((data.price / data.sqft) * 100) / 100;
    }

    // Ensure numeric fields are numbers
    ['price', 'beds', 'baths', 'sqft', 'taxes', 'hoa', 'yearBuilt'].forEach(field => {
      if (data[field]) {
        data[field] = this.parseNumeric(data[field]);
      }
    });

    return data;
  }

  /**
   * Get empty property data structure
   * @returns {Object} Empty property data
   */
  getEmptyPropertyData() {
    return {
      url: window.location.href,
      site: this.currentSite,
      address: '',
      price: 0,
      beds: 0,
      baths: 0,
      sqft: 0,
      description: '',
      images: [],
      extractedAt: new Date().toISOString()
    };
  }

  /**
   * Extract and analyze property from current page
   */
  async extractAndAnalyzeProperty() {
    try {
      // Show loading indicator
      this.showLoadingIndicator();

      // Extract property data
      const propertyData = await this.extractPropertyData();
      
      // Send to background script for analysis
      const response = await chrome.runtime.sendMessage({
        action: 'analyzeProperty',
        propertyData: propertyData
      });

      if (response.success) {
        this.showAnalysisModal(response.data);
      } else {
        this.showError('Failed to analyze property');
      }

    } catch (error) {
      console.error('Error extracting and analyzing property:', error);
      this.showError('Error analyzing property');
    } finally {
      this.hideLoadingIndicator();
    }
  }

  /**
   * Show loading indicator
   */
  showLoadingIndicator() {
    const button = document.getElementById('re-analyzer-button');
    if (button) {
      button.innerHTML = `
        <div style="
          display: flex;
          align-items: center;
          gap: 8px;
        ">
          <span>⏳</span>
          <span>Analyzing...</span>
        </div>
      `;
    }
  }

  /**
   * Hide loading indicator
   */
  hideLoadingIndicator() {
    const button = document.getElementById('re-analyzer-button');
    if (button) {
      button.innerHTML = `
        <div style="
          display: flex;
          align-items: center;
          gap: 8px;
        ">
          <span>📊</span>
          <span>Analyze Property</span>
        </div>
      `;
    }
  }

  /**
   * Show analysis results modal
   * @param {Object} analysis - Analysis results
   */
  showAnalysisModal(analysis) {
    // Create modal overlay
    const modal = document.createElement('div');
    modal.id = 're-analyzer-modal';
    modal.innerHTML = `
      <div style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        z-index: 10001;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          background: white;
          border-radius: 12px;
          padding: 24px;
          max-width: 600px;
          max-height: 80vh;
          overflow-y: auto;
          margin: 20px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        ">
          <div style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            border-bottom: 2px solid #eee;
            padding-bottom: 16px;
          ">
            <h2 style="margin: 0; color: #333;">Property Analysis</h2>
            <button id="close-modal" style="
              background: #f8f9fa;
              border: none;
              border-radius: 50%;
              width: 32px;
              height: 32px;
              cursor: pointer;
              font-size: 18px;
            ">×</button>
          </div>
          
          <div style="
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin-bottom: 20px;
          ">
            <div style="background: #f8f9fa; padding: 16px; border-radius: 8px;">
              <h4 style="margin: 0 0 8px 0; color: #007bff;">Monthly Cash Flow</h4>
              <div style="font-size: 24px; font-weight: bold; color: ${analysis.analysis.financials.cashFlow.monthly >= 0 ? '#28a745' : '#dc3545'};">
                $${analysis.analysis.financials.cashFlow.monthly.toLocaleString()}
              </div>
            </div>
            
            <div style="background: #f8f9fa; padding: 16px; border-radius: 8px;">
              <h4 style="margin: 0 0 8px 0; color: #007bff;">Cap Rate</h4>
              <div style="font-size: 24px; font-weight: bold; color: #333;">
                ${analysis.analysis.financials.capRate.toFixed(2)}%
              </div>
            </div>
            
            <div style="background: #f8f9fa; padding: 16px; border-radius: 8px;">
              <h4 style="margin: 0 0 8px 0; color: #007bff;">CoC Return</h4>
              <div style="font-size: 24px; font-weight: bold; color: #333;">
                ${analysis.analysis.financials.cocReturn.toFixed(2)}%
              </div>
            </div>
            
            <div style="background: #f8f9fa; padding: 16px; border-radius: 8px;">
              <h4 style="margin: 0 0 8px 0; color: #007bff;">Verdict</h4>
              <div style="font-size: 18px; font-weight: bold; color: ${this.getVerdictColor(analysis.analysis.verdict)};">
                ${this.getVerdictEmoji(analysis.analysis.verdict)} ${analysis.analysis.verdict}
              </div>
            </div>
          </div>
          
          <div style="margin-bottom: 20px;">
            <h4 style="color: #333; margin-bottom: 12px;">Recommendation</h4>
            <p style="margin: 0; line-height: 1.6; color: #666;">
              ${analysis.analysis.recommendation}
            </p>
          </div>
          
          ${analysis.analysis.redFlags.length > 0 ? `
            <div style="margin-bottom: 20px;">
              <h4 style="color: #dc3545; margin-bottom: 12px;">⚠️ Red Flags</h4>
              <ul style="margin: 0; padding-left: 20px; color: #666;">
                ${analysis.analysis.redFlags.map(flag => `<li style="margin-bottom: 8px;">${flag}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          
          <div style="display: flex; gap: 12px; justify-content: flex-end;">
            <button id="save-property" style="
              background: #28a745;
              color: white;
              border: none;
              padding: 12px 24px;
              border-radius: 6px;
              cursor: pointer;
              font-weight: bold;
            ">Save Property</button>
            
            <button id="export-analysis" style="
              background: #007bff;
              color: white;
              border: none;
              padding: 12px 24px;
              border-radius: 6px;
              cursor: pointer;
              font-weight: bold;
            ">Export Analysis</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Add event listeners
    document.getElementById('close-modal').addEventListener('click', () => {
      modal.remove();
    });

    document.getElementById('save-property').addEventListener('click', () => {
      this.saveProperty(analysis.property);
      modal.remove();
    });

    document.getElementById('export-analysis').addEventListener('click', () => {
      this.exportAnalysis(analysis);
    });

    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  /**
   * Get color for verdict
   * @param {string} verdict - Verdict string
   * @returns {string} Color code
   */
  getVerdictColor(verdict) {
    switch (verdict) {
      case 'Strong Buy': return '#28a745';
      case 'Worth Considering': return '#ffc107';
      case 'Pass': return '#dc3545';
      default: return '#6c757d';
    }
  }

  /**
   * Get emoji for verdict
   * @param {string} verdict - Verdict string
   * @returns {string} Emoji
   */
  getVerdictEmoji(verdict) {
    switch (verdict) {
      case 'Strong Buy': return '✅';
      case 'Worth Considering': return '🤔';
      case 'Pass': return '❌';
      default: return '❓';
    }
  }

  /**
   * Save property to extension storage
   * @param {Object} property - Property data
   */
  async saveProperty(property) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'saveProperty',
        propertyData: property
      });

      if (response.success) {
        this.showNotification('Property saved successfully!', 'success');
      } else {
        this.showNotification('Failed to save property', 'error');
      }
    } catch (error) {
      console.error('Error saving property:', error);
      this.showNotification('Error saving property', 'error');
    }
  }

  /**
   * Export analysis results
   * @param {Object} analysis - Analysis data
   */
  exportAnalysis(analysis) {
    const csvData = this.convertAnalysisToCSV(analysis);
    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `property-analysis-${Date.now()}.csv`;
    a.click();
    
    URL.revokeObjectURL(url);
    this.showNotification('Analysis exported successfully!', 'success');
  }

  /**
   * Convert analysis to CSV format
   * @param {Object} analysis - Analysis data
   * @returns {string} CSV string
   */
  convertAnalysisToCSV(analysis) {
    const { property, analysis: analysisData } = analysis;
    const financials = analysisData.financials;
    
    const headers = [
      'Address', 'Price', 'Beds', 'Baths', 'Sqft', 'Monthly Cash Flow',
      'Cap Rate', 'CoC Return', 'Verdict', 'Recommendation'
    ];
    
    const values = [
      property.address || '',
      property.price || 0,
      property.beds || 0,
      property.baths || 0,
      property.sqft || 0,
      financials.cashFlow.monthly || 0,
      financials.capRate || 0,
      financials.cocReturn || 0,
      analysisData.verdict || '',
      analysisData.recommendation || ''
    ];
    
    return [
      headers.join(','),
      values.map(v => `"${v}"`).join(',')
    ].join('\n');
  }

  /**
   * Show notification to user
   * @param {string} message - Notification message
   * @param {string} type - Notification type (success, error, info)
   */
  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 10002;
      background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#007bff'};
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      font-family: Arial, sans-serif;
      font-weight: bold;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      animation: slideDown 0.3s ease;
    `;
    notification.textContent = message;

    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideDown {
        from { transform: translateX(-50%) translateY(-100%); opacity: 0; }
        to { transform: translateX(-50%) translateY(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(notification);

    // Remove notification after 3 seconds
    setTimeout(() => {
      notification.remove();
      style.remove();
    }, 3000);
  }

  /**
   * Show error notification
   * @param {string} message - Error message
   */
  showError(message) {
    this.showNotification(message, 'error');
  }
}

// Initialize content extractor when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new ContentExtractor();
  });
} else {
  new ContentExtractor();
}
