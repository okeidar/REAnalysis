/**
 * Content Script for Real Estate Analyzer - ChatGPT Integration
 * Provides real estate analysis tools within ChatGPT interface
 */

class ChatGPTRealEstateAnalyzer {
  constructor() {
    this.init();
  }

  /**
   * Initialize content script for ChatGPT
   */
  init() {
    this.setupMessageListener();
    this.injectAnalyzerInterface();
    this.observeChatInterface();
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
   * Inject real estate analyzer interface into ChatGPT
   */
  injectAnalyzerInterface() {
    // Wait for ChatGPT interface to load
    const checkInterface = () => {
      const chatContainer = document.querySelector('main') || document.querySelector('[role="main"]');
      if (chatContainer && !document.getElementById('re-analyzer-interface')) {
        this.createAnalyzerInterface();
      } else if (!chatContainer) {
        setTimeout(checkInterface, 1000);
      }
    };
    
    checkInterface();
  }

  /**
   * Create the real estate analyzer interface
   */
  createAnalyzerInterface() {
    const interface_ = document.createElement('div');
    interface_.id = 're-analyzer-interface';
    interface_.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        background: #ffffff;
        border: 2px solid #007bff;
        border-radius: 12px;
        padding: 16px;
        box-shadow: 0 4px 16px rgba(0,123,255,0.2);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        width: 280px;
        max-height: 400px;
        overflow-y: auto;
      ">
        <div style="
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 1px solid #eee;
        ">
          <h3 style="margin: 0; color: #007bff; font-size: 16px;">🏠 RE Analyzer</h3>
          <button id="toggle-analyzer" style="
            background: none;
            border: none;
            font-size: 18px;
            cursor: pointer;
            color: #666;
          ">−</button>
        </div>
        
        <div id="analyzer-content">
          <div style="margin-bottom: 12px;">
            <button id="quick-analysis-btn" style="
              width: 100%;
              background: #007bff;
              color: white;
              border: none;
              padding: 10px;
              border-radius: 6px;
              cursor: pointer;
              font-weight: bold;
              margin-bottom: 8px;
            ">📊 Quick Property Analysis</button>
            
            <button id="compare-properties-btn" style="
              width: 100%;
              background: #28a745;
              color: white;
              border: none;
              padding: 10px;
              border-radius: 6px;
              cursor: pointer;
              font-weight: bold;
              margin-bottom: 8px;
            ">⚖️ Compare Properties</button>
            
            <button id="market-analysis-btn" style="
              width: 100%;
              background: #ffc107;
              color: black;
              border: none;
              padding: 10px;
              border-radius: 6px;
              cursor: pointer;
              font-weight: bold;
              margin-bottom: 8px;
            ">📈 Market Analysis</button>
            
            <button id="saved-properties-btn" style="
              width: 100%;
              background: #6c757d;
              color: white;
              border: none;
              padding: 10px;
              border-radius: 6px;
              cursor: pointer;
              font-weight: bold;
            ">💾 Saved Properties</button>
          </div>
          
          <div style="
            font-size: 12px;
            color: #666;
            text-align: center;
            padding-top: 8px;
            border-top: 1px solid #eee;
          ">
            Paste property links to analyze
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(interface_);
    this.setupInterfaceEventListeners();
  }

  /**
   * Setup event listeners for the analyzer interface
   */
  setupInterfaceEventListeners() {
    // Toggle interface visibility
    document.getElementById('toggle-analyzer').addEventListener('click', () => {
      const content = document.getElementById('analyzer-content');
      const toggle = document.getElementById('toggle-analyzer');
      
      if (content.style.display === 'none') {
        content.style.display = 'block';
        toggle.textContent = '−';
      } else {
        content.style.display = 'none';
        toggle.textContent = '+';
      }
    });

    // Quick analysis button
    document.getElementById('quick-analysis-btn').addEventListener('click', () => {
      this.insertQuickAnalysisPrompt();
    });

    // Compare properties button
    document.getElementById('compare-properties-btn').addEventListener('click', () => {
      this.insertComparePropertiesPrompt();
    });

    // Market analysis button
    document.getElementById('market-analysis-btn').addEventListener('click', () => {
      this.insertMarketAnalysisPrompt();
    });

    // Saved properties button
    document.getElementById('saved-properties-btn').addEventListener('click', () => {
      this.showSavedProperties();
    });
  }

  /**
   * Observe ChatGPT interface for changes
   */
  observeChatInterface() {
    // Watch for new messages to detect property links
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          this.scanForPropertyLinks(mutation.addedNodes);
        }
      });
    });

    // Start observing the chat container
    const chatContainer = document.querySelector('main') || document.body;
    observer.observe(chatContainer, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Scan for property links in new content
   * @param {NodeList} nodes - Added nodes to scan
   */
  scanForPropertyLinks(nodes) {
    nodes.forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const links = node.querySelectorAll('a[href*="zillow.com"], a[href*="redfin.com"], a[href*="realtor.com"], a[href*="trulia.com"]');
        links.forEach(link => {
          this.enhancePropertyLink(link);
        });
      }
    });
  }

  /**
   * Enhance property links with quick action buttons
   * @param {Element} link - Property link element
   */
  enhancePropertyLink(link) {
    if (link.getAttribute('data-re-enhanced')) return;
    
    link.setAttribute('data-re-enhanced', 'true');
    
    const enhanceButton = document.createElement('span');
    enhanceButton.innerHTML = ' 📊';
    enhanceButton.style.cssText = `
      cursor: pointer;
      color: #007bff;
      font-weight: bold;
      margin-left: 4px;
    `;
    enhanceButton.title = 'Analyze this property';
    
    enhanceButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.analyzePropertyFromLink(link.href);
    });
    
    link.appendChild(enhanceButton);
  }

  /**
   * Insert quick analysis prompt into ChatGPT
   */
  insertQuickAnalysisPrompt() {
    const prompt = `I need help analyzing a real estate investment property. Please provide a comprehensive analysis including:

1. **Financial Analysis**:
   - Cash flow calculation (rent - expenses)
   - Cap rate (NOI ÷ purchase price)
   - Cash-on-cash return
   - Break-even analysis

2. **Risk Assessment**:
   - Market risks
   - Property condition concerns
   - Location factors
   - Financing risks

3. **Investment Recommendation**:
   - Overall verdict (Strong Buy/Worth Considering/Pass)
   - Key pros and cons
   - Suggested next steps

Please ask me for the property details (price, rent estimate, taxes, etc.) and I'll provide them.`;

    this.insertTextIntoChat(prompt);
  }

  /**
   * Insert compare properties prompt into ChatGPT
   */
  insertComparePropertiesPrompt() {
    const prompt = `I want to compare multiple real estate investment properties. Please help me create a detailed comparison including:

1. **Financial Metrics Comparison**:
   - Monthly cash flow
   - Cap rates
   - Cash-on-cash returns
   - Total ROI projections

2. **Risk Analysis**:
   - Market conditions for each location
   - Property-specific risks
   - Financing considerations

3. **Recommendation**:
   - Rank properties from best to worst investment
   - Explain reasoning for rankings
   - Highlight key differentiators

Please ask me for the details of each property I want to compare.`;

    this.insertTextIntoChat(prompt);
  }

  /**
   * Insert market analysis prompt into ChatGPT
   */
  insertMarketAnalysisPrompt() {
    const prompt = `I need a comprehensive real estate market analysis. Please help me understand:

1. **Market Conditions**:
   - Current trends (buyer's vs seller's market)
   - Price appreciation trends
   - Inventory levels

2. **Rental Market**:
   - Average rent prices
   - Vacancy rates
   - Rent growth trends

3. **Economic Factors**:
   - Local job market
   - Population growth
   - Major employers and industries

4. **Investment Outlook**:
   - Best neighborhoods for investment
   - Property types with highest returns
   - Potential risks and opportunities

Please ask me for the specific location/market I want to analyze.`;

    this.insertTextIntoChat(prompt);
  }

  /**
   * Insert text into ChatGPT input field
   * @param {string} text - Text to insert
   */
  insertTextIntoChat(text) {
    // Find ChatGPT input field (multiple possible selectors)
    const inputSelectors = [
      'textarea[placeholder*="Message"]',
      'textarea[data-id="root"]',
      '#prompt-textarea',
      'textarea',
      '[contenteditable="true"]'
    ];

    let inputField = null;
    for (const selector of inputSelectors) {
      inputField = document.querySelector(selector);
      if (inputField) break;
    }

    if (inputField) {
      // Clear existing content and insert new text
      inputField.value = text;
      inputField.textContent = text;
      
      // Trigger input events to ensure ChatGPT recognizes the change
      inputField.dispatchEvent(new Event('input', { bubbles: true }));
      inputField.dispatchEvent(new Event('change', { bubbles: true }));
      
      // Focus the input field
      inputField.focus();
      
      this.showNotification('Prompt inserted! You can edit it before sending.', 'success');
    } else {
      this.showNotification('Could not find ChatGPT input field', 'error');
    }
  }

  /**
   * Analyze property from a link
   * @param {string} url - Property URL
   */
  async analyzePropertyFromLink(url) {
    try {
      this.showNotification('Analyzing property...', 'info');
      
      const response = await chrome.runtime.sendMessage({
        action: 'parsePropertyFromUrl',
        url: url
      });

      if (response.success && response.data) {
        const propertyData = response.data;
        const analysisPrompt = `Please analyze this real estate investment property:

**Property Details:**
- Address: ${propertyData.address || 'Not available'}
- Price: $${propertyData.price?.toLocaleString() || 'Not available'}
- Beds/Baths: ${propertyData.beds || '?'}/${propertyData.baths || '?'}
- Square Feet: ${propertyData.sqft?.toLocaleString() || 'Not available'}
- Property Type: ${propertyData.propertyType || 'Not specified'}
- Year Built: ${propertyData.yearBuilt || 'Not available'}

**Property URL:** ${url}

Please provide a comprehensive investment analysis including cash flow potential, cap rate estimates, risks, and your overall recommendation.`;

        this.insertTextIntoChat(analysisPrompt);
        this.showNotification('Property analysis prompt generated!', 'success');
      } else {
        this.showNotification('Could not extract property data from link', 'error');
      }
    } catch (error) {
      console.error('Error analyzing property from link:', error);
      this.showNotification('Error analyzing property', 'error');
    }
  }

  /**
   * Show saved properties modal
   */
  async showSavedProperties() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getProperties'
      });

      if (response.success) {
        this.displaySavedPropertiesModal(response.data);
      } else {
        this.showNotification('Could not load saved properties', 'error');
      }
    } catch (error) {
      console.error('Error loading saved properties:', error);
      this.showNotification('Error loading properties', 'error');
    }
  }

  /**
   * Display saved properties in a modal
   * @param {Array} properties - Array of saved properties
   */
  displaySavedPropertiesModal(properties) {
    // Remove existing modal if present
    const existingModal = document.getElementById('saved-properties-modal');
    if (existingModal) {
      existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'saved-properties-modal';
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
          max-width: 800px;
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
            <h2 style="margin: 0; color: #333;">Saved Properties (${properties.length})</h2>
            <button id="close-properties-modal" style="
              background: #f8f9fa;
              border: none;
              border-radius: 50%;
              width: 32px;
              height: 32px;
              cursor: pointer;
              font-size: 18px;
            ">×</button>
          </div>
          
          <div id="properties-list">
            ${properties.length === 0 ? 
              '<p style="text-align: center; color: #666; font-style: italic;">No saved properties yet. Start by analyzing properties on real estate websites!</p>' :
              properties.map(property => this.createPropertyCard(property)).join('')
            }
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Add event listeners
    document.getElementById('close-properties-modal').addEventListener('click', () => {
      modal.remove();
    });

    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });

    // Add event listeners for property cards
    properties.forEach(property => {
      const analyzeBtn = document.getElementById(`analyze-${property.id}`);
      if (analyzeBtn) {
        analyzeBtn.addEventListener('click', () => {
          this.insertPropertyAnalysisPrompt(property);
          modal.remove();
        });
      }
    });
  }

  /**
   * Create property card HTML
   * @param {Object} property - Property data
   * @returns {string} Property card HTML
   */
  createPropertyCard(property) {
    const analysis = property.analysis || {};
    const financials = analysis.financials || {};
    const verdict = analysis.verdict || 'Not analyzed';
    
    return `
      <div style="
        border: 1px solid #ddd;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 12px;
        background: #f8f9fa;
      ">
        <div style="
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 8px;
        ">
          <h4 style="margin: 0; color: #333; font-size: 14px;">
            ${property.address || 'Unknown Address'}
          </h4>
          <span style="
            background: ${this.getVerdictColor(verdict)};
            color: white;
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: bold;
          ">${verdict}</span>
        </div>
        
        <div style="
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-bottom: 12px;
          font-size: 12px;
        ">
          <div><strong>Price:</strong> $${property.price?.toLocaleString() || 'N/A'}</div>
          <div><strong>Beds/Baths:</strong> ${property.beds || '?'}/${property.baths || '?'}</div>
          <div><strong>Cash Flow:</strong> $${financials.cashFlow?.monthly || 'N/A'}/mo</div>
          <div><strong>Cap Rate:</strong> ${financials.capRate?.toFixed(2) || 'N/A'}%</div>
        </div>
        
        <button id="analyze-${property.id}" style="
          background: #007bff;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          width: 100%;
        ">Analyze in ChatGPT</button>
      </div>
    `;
  }

  /**
   * Insert property analysis prompt for a saved property
   * @param {Object} property - Property data
   */
  insertPropertyAnalysisPrompt(property) {
    const analysis = property.analysis || {};
    const financials = analysis.financials || {};
    
    const prompt = `Please provide detailed analysis for this saved property:

**Property Details:**
- Address: ${property.address || 'Not available'}
- Price: $${property.price?.toLocaleString() || 'Not available'}
- Beds/Baths: ${property.beds || '?'}/${property.baths || '?'}
- Square Feet: ${property.sqft?.toLocaleString() || 'Not available'}
- Property Type: ${property.propertyType || 'Not specified'}

${analysis.verdict ? `**Previous Analysis:**
- Verdict: ${analysis.verdict}
- Monthly Cash Flow: $${financials.cashFlow?.monthly || 'N/A'}
- Cap Rate: ${financials.capRate?.toFixed(2) || 'N/A'}%
- Cash-on-Cash Return: ${financials.cocReturn?.toFixed(2) || 'N/A'}%

Please provide updated market analysis and any new insights.` : 'Please provide a comprehensive investment analysis.'}

**Property URL:** ${property.url || 'Not available'}`;

    this.insertTextIntoChat(prompt);
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
   * Handle messages from background script
   * @param {Object} request - Message request
   * @param {Object} sender - Message sender
   * @param {Function} sendResponse - Response callback
   */
  async handleMessage(request, sender, sendResponse) {
    try {
      switch (request.action) {
        case 'insertPrompt':
          this.insertTextIntoChat(request.prompt);
          sendResponse({ success: true });
          break;
        
        case 'analyzeProperty':
          // This would be called from context menu or other sources
          if (request.propertyData) {
            this.insertPropertyAnalysisPrompt(request.propertyData);
          }
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
   * Show notification to user
   * @param {string} message - Notification message
   * @param {string} type - Notification type (success, error, info)
   */
  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      z-index: 10002;
      background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#007bff'};
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      max-width: 300px;
      animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;

    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(notification);

    // Remove notification after 4 seconds
    setTimeout(() => {
      notification.remove();
      style.remove();
    }, 4000);
  }
}

// Initialize ChatGPT Real Estate Analyzer when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new ChatGPTRealEstateAnalyzer();
  });
} else {
  new ChatGPTRealEstateAnalyzer();
}
