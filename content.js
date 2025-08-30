// Content script for RE Analyzer Embedded Extension
console.log('🏠 RE Analyzer Embedded v2.0 loaded on:', window.location.href);

// Prevent multiple script execution
if (window.reAnalyzerLoaded) {
  console.log('🏠 RE Analyzer already loaded, skipping initialization');
} else {
  window.reAnalyzerLoaded = true;

// Embedded UI state management
let embeddedUI = null;
let isUIInitialized = false;
let currentPropertyAnalysis = null;
let uiSettings = {
  position: 'right',
  compactMode: false,
  autoShow: true,
  showNotifications: true,
  allowAnyUrl: false
};

// Function to check if extension context is still valid
function isExtensionContextValid() {
  try {
    return !!(chrome && chrome.runtime && chrome.runtime.id);
  } catch (err) {
    console.warn('Extension context validation failed:', err);
    return false;
  }
}

// Safe wrapper for chrome API calls
function safeChromeFall(apiCall, fallbackValue = null) {
  try {
    if (!isExtensionContextValid()) {
      console.warn('⚠️ Extension context invalidated, using fallback value');
      // Notify user about context invalidation
      notifyContextInvalidation();
      return Promise.resolve(fallbackValue);
    }
    return apiCall();
  } catch (err) {
    if (err && (err.message && err.message.includes('Extension context invalidated') || 
               err.message && err.message.includes('Unexpected token'))) {
      console.warn('⚠️ Extension context invalidated during API call:', err.message);
      notifyContextInvalidation();
      return Promise.resolve(fallbackValue);
    }
    console.error('Chrome API call failed:', err);
    throw err;
  }
}



// Track if we've already notified about context invalidation to avoid spam
let contextInvalidationNotified = false;

// Function to notify user about context invalidation
function notifyContextInvalidation() {
  if (contextInvalidationNotified) return;
  contextInvalidationNotified = true;
  
  console.log('🔄 Extension context invalidated - switching to fallback mode');
  
  // Show user-friendly message in UI if available
  if (window.embeddedUI && window.embeddedUI.showChatGPTMessage) {
    window.embeddedUI.showChatGPTMessage('warning', 
      'Extension context lost. Please refresh the page to restore full functionality.');
  }
  
  // Try to save current state to localStorage as backup
  try {
    backupStateToLocalStorage();
  } catch (backupError) {
    console.warn('Failed to backup state to localStorage:', backupError);
  }
  
  // Show enhanced user notification with auto-refresh option
  showContextInvalidationBanner();
}

// Enhanced context invalidation banner with auto-refresh
function showContextInvalidationBanner() {
  // Remove existing banner if any
  const existingBanner = document.getElementById('re-context-banner');
  if (existingBanner) {
    existingBanner.remove();
  }

  // Create enhanced banner
  const banner = document.createElement('div');
  banner.id = 're-context-banner';
  banner.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: linear-gradient(90deg, #ff6b6b, #ffa726);
    color: white;
    padding: 12px 16px;
    text-align: center;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 14px;
    font-weight: 500;
    z-index: 10001;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    border-bottom: 2px solid rgba(255,255,255,0.3);
    animation: slideDown 0.3s ease-out;
  `;
  
  banner.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; gap: 12px; flex-wrap: wrap;">
      <span>⚠️ RE Analyzer: Extension context lost - some features may not work</span>
      <button id="re-auto-refresh" style="
        background: rgba(255,255,255,0.2);
        border: 1px solid rgba(255,255,255,0.4);
        color: white;
        padding: 6px 12px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 500;
        transition: all 0.2s;
      " onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">
        🔄 Auto-Refresh in <span id="re-countdown">10</span>s
      </button>
      <button onclick="window.location.reload()" style="
        background: rgba(255,255,255,0.2);
        border: 1px solid rgba(255,255,255,0.4);
        color: white;
        padding: 6px 12px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 500;
        transition: all 0.2s;
      " onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">
        🔄 Refresh Now
      </button>
      <button onclick="document.getElementById('re-context-banner').remove()" style="
        background: transparent;
        border: none;
        color: white;
        padding: 6px;
        cursor: pointer;
        font-size: 16px;
        opacity: 0.8;
        transition: opacity 0.2s;
      " onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.8'">
        ×
      </button>
    </div>
  `;
  
  // Add CSS animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideDown {
      from { transform: translateY(-100%); }
      to { transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);
  
  document.body.appendChild(banner);
  
  // Auto-refresh countdown
  let countdown = 10;
  const countdownElement = document.getElementById('re-countdown');
  const autoRefreshBtn = document.getElementById('re-auto-refresh');
  
  const countdownInterval = setInterval(() => {
    countdown--;
    if (countdownElement) {
      countdownElement.textContent = countdown;
    }
    
    if (countdown <= 0) {
      clearInterval(countdownInterval);
      console.log('🔄 Auto-refreshing page to restore extension functionality...');
      window.location.reload();
    }
  }, 1000);
  
  // Allow user to cancel auto-refresh
  if (autoRefreshBtn) {
    autoRefreshBtn.addEventListener('click', () => {
      clearInterval(countdownInterval);
      if (autoRefreshBtn) {
        autoRefreshBtn.textContent = '❌ Auto-refresh cancelled';
        autoRefreshBtn.disabled = true;
        autoRefreshBtn.style.opacity = '0.6';
      }
    });
  }
  
  console.log('📢 Context invalidation banner displayed with 10-second auto-refresh');
}

// Backup current state to localStorage as fallback
function backupStateToLocalStorage() {
  try {
    // Backup UI settings
    if (uiSettings) {
      localStorage.setItem('reAnalyzer_backup_uiSettings', JSON.stringify(uiSettings));
    }
    
    // Backup current property analysis if available
    if (currentPropertyAnalysis) {
      localStorage.setItem('reAnalyzer_backup_currentAnalysis', JSON.stringify(currentPropertyAnalysis));
    }
    
    console.log('💾 State backed up to localStorage');
  } catch (error) {
    console.warn('Failed to backup to localStorage:', error);
  }
}

// Restore state from localStorage fallback
function restoreStateFromLocalStorage() {
  try {
    // Restore UI settings
    const backupSettings = localStorage.getItem('reAnalyzer_backup_uiSettings');
    if (backupSettings) {
      const parsedSettings = JSON.parse(backupSettings);
      uiSettings = { ...uiSettings, ...parsedSettings };
      console.log('📋 Restored UI settings from localStorage backup');
    }
    
    // Restore current analysis
    const backupAnalysis = localStorage.getItem('reAnalyzer_backup_currentAnalysis');
    if (backupAnalysis) {
      currentPropertyAnalysis = JSON.parse(backupAnalysis);
      console.log('📋 Restored current analysis from localStorage backup');
    }
    
  } catch (error) {
    console.warn('Failed to restore from localStorage:', error);
  }
}

// Global variable to track current property analysis (already declared above with embedded UI variables)

// Track processed messages per property URL to prevent cross-contamination
let processedMessagesPerProperty = new Map();

// Prompt splitting state management
let promptSplittingState = {
  enabled: true,
  lengthThreshold: 200, // characters - lowered for dynamic prompts
  confirmationTimeout: 15000, // 15 seconds
  currentPhase: null, // 'instructions', 'waiting_confirmation', 'sending_link', 'complete'
  pendingPropertyLink: null,
  confirmationStartTime: null,
  fallbackAttempted: false
};

// Check if we're on ChatGPT
function isChatGPTSite() {
  return window.location.hostname === 'chatgpt.com' || 
         window.location.hostname === 'chat.openai.com';
}

// ============================================================================
// EMBEDDED UI IMPLEMENTATION
// ============================================================================

// Main embedded UI class
class REAnalyzerEmbeddedUI {
  constructor() {
    this.fab = null;
    this.panel = null;
    this.isVisible = false;
    this.currentTab = 'analyzer';
    this.dragState = { isDragging: false, startX: 0, startY: 0 };
    this.analysisTimer = null;
    this.analysisStartTime = 0;
    
    this.initialize();
  }

  async initialize() {
    try {
      console.log('🚀 Initializing RE Analyzer Embedded UI...');
      
      // Load settings
      await this.loadSettings();
      
      // Create UI elements
      this.createFloatingActionButton();
      this.createEmbeddedPanel();
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Set up adaptive positioning
      this.setupAdaptivePositioning();
      
      // Set up keyboard shortcuts
      this.setupKeyboardShortcuts();
      
      // Initialize status
      this.updateChatGPTConnectionStatus();
      
      // Check extension context and warn user if needed
      this.checkExtensionContext();
      
      // Load initial data
      await this.loadChatGPTPropertyData();
      
      console.log('✅ RE Analyzer ChatGPT Native UI initialized successfully');
      isUIInitialized = true;
      
    } catch (error) {
      console.error('❌ Failed to initialize embedded UI:', error);
    }
  }

  async loadSettings() {
    try {
      // Try extension storage first
      const result = await safeChromeFall(
        () => chrome.storage.local.get(['embeddedUISettings']),
        null
      );
      
      let settingsLoaded = false;
      
      if (result && result.embeddedUISettings) {
        uiSettings = { ...uiSettings, ...result.embeddedUISettings };
        settingsLoaded = true;
        console.log('📋 Loaded UI settings from extension storage:', uiSettings);
      } else {
        // Fallback to localStorage if extension context is invalidated
        try {
          // First try the backup from context invalidation
          const backupSettings = localStorage.getItem('reAnalyzer_backup_uiSettings');
          if (backupSettings) {
            const parsedSettings = JSON.parse(backupSettings);
            uiSettings = { ...uiSettings, ...parsedSettings };
            settingsLoaded = true;
            console.log('📋 Loaded UI settings from context invalidation backup:', uiSettings);
          } else {
            // Try regular localStorage fallback
            const localSettings = localStorage.getItem('reAnalyzerSettings');
            if (localSettings) {
              const parsedSettings = JSON.parse(localSettings);
              uiSettings = { ...uiSettings, ...parsedSettings };
              settingsLoaded = true;
              console.log('📋 Loaded UI settings from localStorage fallback:', uiSettings);
            }
          }
        } catch (localError) {
          console.warn('Failed to load settings from localStorage:', localError);
        }
      }
      
      if (!settingsLoaded) {
        console.log('📋 Using default UI settings:', uiSettings);
      }
      
      // Always backup current settings to localStorage for future fallback
      try {
        localStorage.setItem('reAnalyzerSettings', JSON.stringify(uiSettings));
      } catch (backupError) {
        console.warn('Failed to backup settings to localStorage:', backupError);
      }
      
    } catch (error) {
      console.warn('Failed to load UI settings:', error);
      // Try to restore from localStorage backup as last resort
      restoreStateFromLocalStorage();
    }
  }

  createFloatingActionButton() {
    // Remove existing FAB if it exists
    const existingFab = document.getElementById('re-analyzer-toggle');
    if (existingFab) {
      existingFab.remove();
    }

    // Try to integrate into ChatGPT UI first
    const integratedSuccessfully = this.integrateIntoChatGPTUI();
    
    if (!integratedSuccessfully) {
      // Fallback to floating action button
      this.createFallbackFAB();
    }
  }

  integrateIntoChatGPTUI() {
    try {
      // Find the ChatGPT input area or form container
      const inputContainer = this.findChatGPTInputContainer();
      
      if (inputContainer) {
        this.createIntegratedIcon(inputContainer);
        return true;
      }
      
      // If not found immediately, try again after a short delay
      setTimeout(() => {
        const delayedContainer = this.findChatGPTInputContainer();
        if (delayedContainer && !document.querySelector('#re-analyzer-integrated')) {
          console.log('🔄 Retrying ChatGPT UI integration after delay');
          this.createIntegratedIcon(delayedContainer);
        }
      }, 2000);
      
      return false;
    } catch (error) {
      console.warn('❌ Failed to integrate into ChatGPT UI:', error);
      return false;
    }
  }

  findChatGPTInputContainer() {
    // First, try to find the input field itself
    const inputField = document.querySelector('textarea[placeholder*="Message"], textarea, [contenteditable="true"]');
    
    if (inputField) {
      // Look for the container that holds the input area
      const containers = [
        inputField.closest('main'),
        inputField.closest('form'),
        inputField.closest('div[class*="flex"][class*="col"]'),
        inputField.closest('div[class*="relative"]'),
        inputField.parentElement,
        document.querySelector('main')
      ];
      
      for (const container of containers) {
        if (container && this.isValidIntegrationTarget(container)) {
          console.log('✅ Found ChatGPT integration target via input field');
          return container;
        }
      }
    }
    
    // Fallback: Look for main chat interface area
    const selectors = [
      'main',
      'div[class*="conversation"]',
      'div[class*="chat"]',
      'body'
    ];

    for (const selector of selectors) {
      try {
        const element = document.querySelector(selector);
        if (element && this.isValidIntegrationTarget(element)) {
          console.log('✅ Found ChatGPT integration target:', selector);
          return element;
        }
      } catch (e) {
        continue;
      }
    }

    console.warn('❌ Could not find suitable ChatGPT integration target');
    return null;
  }

  isValidIntegrationTarget(element) {
    const rect = element.getBoundingClientRect();
    
    // Check if element is visible and has reasonable dimensions
    return rect.width > 200 && 
           rect.height > 100 && 
           element.offsetParent !== null &&
           !element.classList.contains('re-analyzer-element') && // Avoid our own elements
           !element.id?.includes('re-analyzer'); // Avoid our own elements
  }

  createIntegratedIcon(container) {
    // Create the integrated icon/button
    this.fab = document.createElement('div');
    this.fab.id = 're-analyzer-integrated';
    this.fab.className = 're-integrated-button';
    this.fab.title = 'Open RE Analyzer';
    this.fab.setAttribute('role', 'button');
    this.fab.setAttribute('tabindex', '0');
    this.fab.setAttribute('aria-label', 'Open Real Estate Analyzer');
    
    this.fab.innerHTML = `
      <div class="re-integrated-content">
        <div class="re-integrated-icon">🏠</div>
        <div class="re-integrated-text">
          <div class="re-integrated-title">RE Analyzer</div>
          <div class="re-integrated-subtitle">Analyze real estate properties with ChatGPT</div>
        </div>
        <div class="re-integrated-arrow">→</div>
      </div>
      <div class="re-fab-notification" id="re-fab-notification" aria-label="Pending analyses count"></div>
    `;

    // Insert the icon in the ChatGPT UI
    this.insertIntegratedIcon(container);

    // Add event handlers
    this.fab.addEventListener('click', () => {
      this.togglePanel();
    });
    
    this.fab.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.togglePanel();
      }
    });

    console.log('🎯 Created integrated ChatGPT UI button');
    
    // Set up observer to maintain integration if ChatGPT UI changes
    this.setupUIIntegrationObserver();
  }

  setupUIIntegrationObserver() {
    // Watch for changes in the ChatGPT UI that might affect our integration
    const observer = new MutationObserver((mutations) => {
      let shouldReintegrate = false;
      
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          // Check if ChatGPT UI has changed significantly
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // If a form or main content area was added, we might need to reintegrate
              if (node.tagName === 'FORM' || 
                  node.tagName === 'MAIN' ||
                  node.querySelector?.('textarea, [contenteditable="true"]')) {
                shouldReintegrate = true;
                break;
              }
            }
          }
        }
      });
      
      // Check if our integrated button is still in the DOM
      const ourButton = document.querySelector('#re-analyzer-integrated, #re-analyzer-fab');
      if (!ourButton && shouldReintegrate) {
        console.log('🔄 ChatGPT UI changed, attempting reintegration');
        setTimeout(() => {
          if (!document.querySelector('#re-analyzer-integrated, #re-analyzer-fab')) {
            this.createFloatingActionButton();
          }
        }, 1000);
      }
    });
    
    // Observe the document body for changes
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    console.log('👀 Set up UI integration observer');
  }

  insertIntegratedIcon(container) {
    // Strategy: Place the RE Analyzer button below the ChatGPT input area
    const inputField = document.querySelector('textarea, [contenteditable="true"]');
    
    if (inputField) {
      // Find the form or input container
      const inputForm = inputField.closest('form');
      const inputContainer = inputField.closest('div[class*="relative"], div[class*="flex"]');
      
      // Try to place after the form first
      if (inputForm && inputForm.parentNode) {
        inputForm.parentNode.insertBefore(this.fab, inputForm.nextSibling);
        console.log('✅ Integrated icon placed after ChatGPT form');
        return;
      }
      
      // Try to place after the input container
      if (inputContainer && inputContainer.parentNode) {
        inputContainer.parentNode.insertBefore(this.fab, inputContainer.nextSibling);
        console.log('✅ Integrated icon placed after input container');
        return;
      }
      
      // Try to place within the main content area
      const mainContent = inputField.closest('main');
      if (mainContent) {
        mainContent.appendChild(this.fab);
        console.log('✅ Integrated icon placed in main content area');
        return;
      }
    }
    
    // Alternative: Look for specific ChatGPT UI elements to position relative to
    const chatElements = [
      document.querySelector('div[class*="conversation"]'),
      document.querySelector('div[class*="chat"]'),
      document.querySelector('main'),
      document.querySelector('body')
    ];
    
    for (const element of chatElements) {
      if (element) {
        element.appendChild(this.fab);
        if (element === document.body) {
          this.fab.classList.add('re-integrated-fallback');
        }
        console.log('✅ Integrated icon placed in:', element.tagName);
        return;
      }
    }
    
    console.warn('❌ Could not find suitable insertion point');
  }

  createFallbackFAB() {
    // Create floating action button as fallback
    this.fab = document.createElement('div');
    this.fab.id = 're-analyzer-fab';
    this.fab.className = 're-fab';
    this.fab.title = 'Open RE Analyzer';
    this.fab.setAttribute('role', 'button');
    this.fab.setAttribute('tabindex', '0');
    this.fab.setAttribute('aria-label', 'Open Real Estate Analyzer');
    this.fab.innerHTML = `
      <div class="re-fab-icon">🏠</div>
      <div class="re-fab-notification" id="re-fab-notification" aria-label="Pending analyses count"></div>
    `;

    // Add to page
    document.body.appendChild(this.fab);

    // FAB click and keyboard handlers
    this.fab.addEventListener('click', () => {
      this.togglePanel();
    });
    
    this.fab.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.togglePanel();
      }
    });

    console.log('🎯 Created fallback floating action button');
  }

  createEmbeddedPanel() {
    // Remove existing panel if it exists
    const existingPanel = document.getElementById('re-analyzer-sidebar');
    if (existingPanel) {
      existingPanel.remove();
    }

    // Create ChatGPT-style sidebar container
    this.panel = document.createElement('div');
    this.panel.id = 're-analyzer-sidebar';
    this.panel.className = 're-sidebar-container re-chatgpt-native';
    
    // Set native ChatGPT-style content
    this.panel.innerHTML = this.getChatGPTNativeSidebarHTML();

    // Add to page
    document.body.appendChild(this.panel);

    // Apply compact mode if enabled
    if (uiSettings.compactMode) {
      this.panel.classList.add('re-compact');
    }

    console.log('🎨 Created ChatGPT-style native sidebar');
  }

  getChatGPTNativeSidebarHTML() {
    return `
      <!-- Sidebar Header -->
      <div class="re-sidebar-header">
        <div class="re-sidebar-header-content">
          <div class="re-sidebar-title">
            <div class="re-sidebar-logo">🏠</div>
            <span>RE Analyzer</span>
          </div>
          <button class="re-sidebar-close" id="re-sidebar-close" title="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>

      <!-- Sidebar Navigation -->
      <div class="re-sidebar-nav">
        <button class="re-nav-item re-nav-active" data-tab="analyzer" id="re-nav-analyzer">
          <div class="re-nav-icon">🔍</div>
          <div class="re-nav-label">Analyzer</div>
        </button>
        <button class="re-nav-item" data-tab="properties" id="re-nav-properties">
          <div class="re-nav-icon">📊</div>
          <div class="re-nav-label">Properties</div>
          <div class="re-nav-badge re-hidden" id="re-properties-badge">0</div>
        </button>
        <button class="re-nav-item" data-tab="settings" id="re-nav-settings">
          <div class="re-nav-icon">⚙️</div>
          <div class="re-nav-label">Settings</div>
        </button>
      </div>

      <!-- Sidebar Content -->
      <div class="re-sidebar-content">
        ${this.getChatGPTAnalyzerHTML()}
        ${this.getChatGPTPropertiesHTML()}
        ${this.getChatGPTSettingsHTML()}
      </div>
    `;
  }

  getChatGPTAnalyzerHTML() {
    return `
      <!-- Analyzer Section -->
      <div class="re-section" id="re-analyzer-section">
        <!-- Connection Status -->
        <div class="re-status" id="re-connection-status">
          <div class="re-status-icon">⏳</div>
          <div class="re-status-content">
            <div class="re-status-title">Checking Connection...</div>
            <div class="re-status-subtitle">Verifying ChatGPT access</div>
          </div>
        </div>

        <!-- Quick Action -->
        <div class="re-section">
          <button class="re-btn re-btn-primary re-btn-full re-btn-lg" id="re-quick-analyze">
            <div>📋</div>
            <span>Paste & Analyze Property</span>
          </button>
        </div>

        <!-- Manual Input -->
        <div class="re-section" id="re-manual-section">
          <div class="re-section-header">
            <div class="re-section-title">Property Analysis</div>
            <div class="re-section-subtitle">Enter a property URL from any major real estate website</div>
          </div>
          
          <div class="re-form-group">
            <label class="re-form-label">Property URL</label>
            <div class="re-input-group">
              <input type="text" class="re-form-input" id="re-property-input" 
                     placeholder="https://zillow.com/property/...">
              <div class="re-input-addon" id="re-paste-addon" title="Paste from clipboard">📋</div>
            </div>
            <div class="re-form-validation" id="re-input-validation"></div>
          </div>

          <div class="re-form-group">
            <button class="re-btn re-btn-primary re-btn-full" id="re-analyze-btn">
              <div>🔍</div>
              <span>Analyze Property</span>
            </button>
          </div>
        </div>

        <!-- Analysis Progress -->
        <div class="re-progress re-hidden" id="re-analysis-progress">
          <div class="re-progress-header">
            <div class="re-progress-title">Analysis in Progress</div>
            <div class="re-progress-time" id="re-progress-timer">0:00</div>
          </div>
          <div class="re-progress-steps">
            <div class="re-progress-step" data-step="validate">
              <div class="re-step-icon">⏳</div>
              <span>Validating URL</span>
            </div>
            <div class="re-progress-step" data-step="send">
              <div class="re-step-icon">⏳</div>
              <span>Sending to ChatGPT</span>
            </div>
            <div class="re-progress-step" data-step="analyze">
              <div class="re-step-icon">⏳</div>
              <span>AI Analysis</span>
            </div>
            <div class="re-progress-step" data-step="save">
              <div class="re-step-icon">⏳</div>
              <span>Saving Results</span>
            </div>
          </div>
        </div>

        <!-- Messages -->
        <div id="re-messages-container">
          <div class="re-message re-message-success re-hidden" id="re-success-msg">
            <div class="re-message-icon">✅</div>
            <div class="re-message-content"></div>
          </div>
          <div class="re-message re-message-error re-hidden" id="re-error-msg">
            <div class="re-message-icon">❌</div>
            <div class="re-message-content"></div>
          </div>
          <div class="re-message re-message-warning re-hidden" id="re-warning-msg">
            <div class="re-message-icon">⚠️</div>
            <div class="re-message-content"></div>
          </div>
        </div>
      </div>
    `;
  }

  getChatGPTPropertiesHTML() {
    return `
      <!-- Properties Section -->
      <div class="re-section re-hidden" id="re-properties-section">
        <!-- Properties Stats -->
        <div class="re-section">
          <div class="re-section-header">
            <div class="re-section-title">Property Portfolio</div>
            <div class="re-section-subtitle">Your analyzed properties and insights</div>
          </div>
          
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px;">
            <div style="text-align: center; padding: 12px; background: var(--chatgpt-hover-bg); border-radius: 6px;">
              <div style="font-size: 18px; font-weight: 600; color: var(--chatgpt-primary);" id="re-total-count">0</div>
              <div style="font-size: 12px; color: var(--chatgpt-text-secondary);">Total</div>
            </div>
            <div style="text-align: center; padding: 12px; background: var(--chatgpt-hover-bg); border-radius: 6px;">
              <div style="font-size: 18px; font-weight: 600; color: var(--chatgpt-primary);" id="re-analyzed-count">0</div>
              <div style="font-size: 12px; color: var(--chatgpt-text-secondary);">Analyzed</div>
            </div>
            <div style="text-align: center; padding: 12px; background: var(--chatgpt-hover-bg); border-radius: 6px;">
              <div style="font-size: 18px; font-weight: 600; color: var(--chatgpt-primary);" id="re-sources-count">0</div>
              <div style="font-size: 12px; color: var(--chatgpt-text-secondary);">Sources</div>
            </div>
          </div>
        </div>

        <!-- Properties List -->
        <div class="re-section">
          <div class="re-section-header">
            <div class="re-section-title">Recent Properties</div>
          </div>
          
          <div id="re-properties-list">
            <!-- Properties will be populated here -->
          </div>

          <!-- Empty State -->
          <div id="re-empty-properties" class="re-hidden" style="text-align: center; padding: 32px 16px; color: var(--chatgpt-text-secondary);">
            <div style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;">📄</div>
            <div style="font-size: 16px; font-weight: 500; margin-bottom: 8px;">No Properties Yet</div>
            <div style="font-size: 14px; line-height: 1.4; margin-bottom: 20px;">Start by analyzing your first property using the tool above</div>
            <button class="re-btn re-btn-primary" id="re-start-first-analysis">
              <div>🔍</div>
              <span>Analyze First Property</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  getChatGPTSettingsHTML() {
    return `
      <!-- Settings Section -->
      <div class="re-section re-hidden" id="re-settings-section">
        
        <!-- Interface Settings -->
        <div class="re-section">
          <div class="re-section-header">
            <div class="re-section-title">Interface</div>
            <div class="re-section-subtitle">Customize your RE Analyzer experience</div>
          </div>
          
          <div class="re-form-group">
            <label class="re-form-label">Panel Position</label>
            <select class="re-form-input" id="re-position-select">
              <option value="left">Left Side</option>
              <option value="right">Right Side</option>
              <option value="bottom">Bottom</option>
            </select>
          </div>

          <div class="re-form-group">
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
              <input type="checkbox" id="re-compact-toggle" style="margin: 0;">
              <span class="re-form-label" style="margin: 0;">Compact Mode</span>
            </label>
            <div class="re-text-description">
              Use smaller interface elements to save space
            </div>
          </div>
        </div>

        <!-- Analysis Settings -->
        <div class="re-section">
          <div class="re-section-header">
            <div class="re-section-title">Analysis</div>
            <div class="re-section-subtitle">Configure analysis behavior</div>
          </div>
          
          <div class="re-form-group">
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
              <input type="checkbox" id="re-auto-show-toggle" style="margin: 0;" checked>
              <span class="re-form-label" style="margin: 0;">Auto-show Results</span>
            </label>
            <div class="re-text-description">
              Automatically switch to Properties tab after analysis
            </div>
          </div>

          <div class="re-form-group">
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
              <input type="checkbox" id="re-notifications-toggle" style="margin: 0;" checked>
              <span class="re-form-label" style="margin: 0;">Show Notifications</span>
            </label>
            <div class="re-text-description">
              Display notifications when analysis completes
            </div>
          </div>
        </div>
        
        <!-- Prompt Configuration -->
        <div class="re-section">
          <div class="re-section-header">
            <div class="re-section-title">Analysis Prompts</div>
            <div class="re-section-subtitle">Choose how ChatGPT analyzes properties</div>
          </div>
          
          <div class="re-form-group">
            <label class="re-form-label">Prompt Type</label>
            <select class="re-form-input" id="re-prompt-type-select">
              <option value="default">Default - Standard Analysis</option>
              <option value="dynamic">Dynamic - Column-Based</option>
              <option value="tabular">Tabular - Data Extraction</option>
              <option value="custom">Custom - User-Defined</option>
            </select>
            <div class="re-text-description">
              Select the type of analysis prompt to use
            </div>
          </div>

          <div class="re-form-group" id="re-prompt-description">
            <div id="re-prompt-desc-content" class="re-prompt-description">
              Standard real estate investment analysis with basic property data extraction
            </div>
          </div>
          
          <div class="re-form-group" id="re-custom-prompt-group" style="display: none;">
            <label class="re-form-label">Custom Prompt Template</label>
            <textarea id="re-custom-prompt" class="re-form-input" rows="6" 
                      placeholder="Enter your custom prompt template. Use {PROPERTY_URL} for the property link and {DATE} for current date."
                      style="resize: vertical; font-family: monospace; font-size: 12px;"></textarea>
            <div class="re-text-description">
              Variables: {PROPERTY_URL}, {DATE}
            </div>
          </div>
          
          <div class="re-prompt-actions">
            <button class="re-btn re-btn-secondary re-btn-sm" id="re-save-prompt-selection">
              <div>💾</div>
              <span>Save</span>
            </button>
            <button class="re-btn re-btn-ghost re-btn-sm" id="re-reset-prompt">
              <div>🔄</div>
              <span>Reset</span>
            </button>
            <button class="re-btn re-btn-ghost re-btn-sm" id="re-preview-prompt">
              <div>👁️</div>
              <span>Preview</span>
            </button>
          </div>
        </div>

        <!-- Advanced Prompt Editing -->
        <div class="re-section">
          <div class="re-section-header">
            <div class="re-section-title">Advanced Prompt Editing</div>
            <div class="re-section-subtitle">Customize prompt templates</div>
          </div>
          
          <div class="re-advanced-prompt-buttons">
            <button class="re-btn re-btn-ghost re-btn-sm" id="re-edit-default-prompt">
              📄 Edit Default
            </button>
            <button class="re-btn re-btn-ghost re-btn-sm" id="re-edit-dynamic-prompt">
              🔄 Edit Dynamic
            </button>
            <button class="re-btn re-btn-ghost re-btn-sm" id="re-goto-tabular-config">
              📊 Configure Tabular
            </button>
          </div>
          
          <!-- Default Prompt Editor -->
          <div id="re-default-editor" class="re-prompt-editor" style="display: none;">
            <div class="re-form-group">
              <label class="re-form-label">Default Analysis Prompt</label>
              <textarea id="re-default-prompt-template" class="re-form-input" rows="8" 
                        placeholder="Enter your default analysis prompt..."
                        style="resize: vertical; font-family: monospace; font-size: 11px;"></textarea>
            </div>
            
            <div class="re-editor-actions">
              <button class="re-btn re-btn-secondary re-btn-sm" id="re-save-default-prompt">Save</button>
              <button class="re-btn re-btn-ghost re-btn-sm" id="re-reset-default-prompt">Reset</button>
              <button class="re-btn re-btn-ghost re-btn-sm" id="re-preview-default-prompt">Preview</button>
            </div>
          </div>
          
          <!-- Dynamic Prompt Editor -->
          <div id="re-dynamic-editor" class="re-prompt-editor" style="display: none;">
            <div class="re-form-group">
              <label class="re-form-label">Dynamic Prompt Template</label>
              <textarea id="re-dynamic-prompt-template" class="re-form-input" rows="6" 
                        placeholder="Enter dynamic template with {{COLUMNS}} placeholder..."
                        style="resize: vertical; font-family: monospace; font-size: 11px;"></textarea>
            </div>
            
            <div class="re-form-group">
              <label class="re-form-label">Data Points</label>
              <div id="re-dynamic-columns-container" style="max-height: 120px; overflow-y: auto; border: 1px solid var(--chatgpt-border-light); border-radius: 6px; padding: 6px; font-size: 12px;">
                <!-- Dynamic columns will be populated here -->
              </div>
            </div>
            
            <div class="re-editor-actions">
              <button class="re-btn re-btn-secondary re-btn-sm" id="re-save-dynamic-prompt">Save</button>
              <button class="re-btn re-btn-ghost re-btn-sm" id="re-reset-dynamic-prompt">Reset</button>
              <button class="re-btn re-btn-ghost re-btn-sm" id="re-preview-dynamic-prompt">Preview</button>
            </div>
          </div>
        </div>

        <!-- Tabular Data Configuration -->
        <div class="re-section" id="re-tabular-columns-section" style="display: none;">
          <div class="re-section-header">
            <div class="re-section-title">Tabular Data Configuration</div>
            <div class="re-section-subtitle">Advanced data extraction settings</div>
          </div>
          
          <!-- Tabular Configuration Tabs -->
          <div class="re-tabular-tabs" style="display: flex; border-bottom: 1px solid var(--chatgpt-border-light); margin-bottom: 12px;">
            <button class="re-tabular-tab re-tabular-tab-active" data-tab="columns">
              📊 Columns
            </button>
            <button class="re-tabular-tab" data-tab="prompt">
              📝 Template
            </button>
            <button class="re-tabular-tab" data-tab="custom-columns">
              ➕ Custom
            </button>
          </div>
          
          <!-- Data Columns Tab -->
          <div id="re-tabular-columns-tab" class="re-tabular-tab-content">
            <div class="re-form-group">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <div class="re-text-muted">
                  Select data points to extract
                </div>
                <div class="re-column-selection-buttons">
                  <button class="re-btn re-btn-ghost re-btn-sm" id="re-columns-select-all" style="font-size: 11px; padding: 4px 8px;">
                    ✅ All
                  </button>
                  <button class="re-btn re-btn-ghost re-btn-sm" id="re-columns-clear-all" style="font-size: 11px; padding: 4px 8px;">
                    ❌ None
                  </button>
                  <button class="re-btn re-btn-ghost re-btn-sm" id="re-columns-select-defaults" style="font-size: 11px; padding: 4px 8px;">
                    🏠 Defaults
                  </button>
                </div>
              </div>
              
              <div id="re-columns-stats" class="re-text-muted">
                Loading columns...
              </div>
            </div>
            
            <!-- Column Categories -->
            <div id="re-columns-container">
              <!-- Categories will be dynamically populated -->
            </div>
          </div>
          
          <!-- Prompt Template Tab -->
          <div id="re-tabular-prompt-tab" class="re-tabular-tab-content" style="display: none;">
            <div class="re-form-group">
              <label class="re-form-label">Tabular Prompt Template</label>
              <textarea id="re-tabular-prompt-template" class="re-form-input" rows="8" 
                        placeholder="Enter tabular prompt template..."
                        style="resize: vertical; font-family: monospace; font-size: 11px;"></textarea>
              <div class="re-text-description">
                Variables: {{COLUMNS}}, {PROPERTY_URL}, {DATE}
              </div>
            </div>
            
            <div class="re-editor-actions">
              <button class="re-btn re-btn-secondary re-btn-sm" id="re-save-tabular-template">Save</button>
              <button class="re-btn re-btn-ghost re-btn-sm" id="re-reset-tabular-template">Reset</button>
              <button class="re-btn re-btn-ghost re-btn-sm" id="re-preview-tabular-template">Preview</button>
            </div>
          </div>
          
          <!-- Custom Columns Tab -->
          <div id="re-custom-columns-tab" class="re-tabular-tab-content" style="display: none;">
            <div class="re-form-group">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <div class="re-section-subtitle">Custom Data Columns</div>
                <button class="re-btn re-btn-secondary re-btn-sm" id="re-add-custom-column" style="font-size: 11px; padding: 4px 8px;">
                  ➕ Add
                </button>
              </div>
            </div>
            
            <!-- Custom Columns List -->
            <div id="re-custom-columns-list">
              <!-- Custom columns will be populated here -->
            </div>
            
            <!-- Add Custom Column Form -->
            <div id="re-add-column-form" class="re-form-group" style="display: none; border: 1px solid var(--chatgpt-border-light); border-radius: 6px; padding: 12px; margin-top: 8px; background: var(--chatgpt-surface-primary);">
              <div class="re-form-header">
                <span>➕</span>
                <span id="re-form-title">Add Custom Column</span>
              </div>
              
              <div class="re-custom-column-inputs">
                <div>
                  <label class="re-form-label" style="font-size: 11px;">Column Name *</label>
                  <input type="text" id="re-new-column-name" class="re-form-input" placeholder="e.g., HOA Fees, Pet Policy" style="font-size: 11px;" maxlength="50">
                  <div class="re-input-help">Letters, numbers, spaces, hyphens, underscores only</div>
                </div>
                <div>
                  <label class="re-form-label" style="font-size: 11px;">Category</label>
                  <select id="re-new-column-category" class="re-form-input" style="font-size: 11px;">
                    <option value="core">🏠 Core Info</option>
                    <option value="location">📍 Location</option>
                    <option value="financial">💰 Financial</option>
                    <option value="features">🔧 Features</option>
                    <option value="analysis">📊 Analysis</option>
                    <option value="market">📈 Market</option>
                    <option value="custom" selected>➕ Custom</option>
                  </select>
                </div>
              </div>
              
              <div class="re-form-group">
                <label class="re-form-label" style="font-size: 11px;">Description</label>
                <textarea id="re-new-column-description" class="re-form-input" rows="2" 
                          placeholder="Describe what ChatGPT should extract for this data point..."
                          style="font-size: 11px;" maxlength="200"></textarea>
                <div class="re-input-help">Help ChatGPT understand what to look for</div>
              </div>
              
              <div class="re-custom-column-actions">
                <button class="re-btn re-btn-ghost re-btn-sm" id="re-cancel-custom-column" style="font-size: 11px;">
                  Cancel
                </button>
                <button class="re-btn re-btn-secondary re-btn-sm" id="re-save-custom-column" style="font-size: 11px;">
                  💾 Save Column
                </button>
              </div>
            </div>
          </div>
          
          <!-- Tabular Action Buttons -->
          <div class="re-tabular-actions">
            <button class="re-btn re-btn-secondary re-btn-sm" id="re-save-all-tabular">
              💾 Save All
            </button>
            <button class="re-btn re-btn-ghost re-btn-sm" id="re-reset-all-tabular">
              🔄 Reset All
            </button>
            <button class="re-btn re-btn-ghost re-btn-sm" id="re-preview-complete-tabular">
              👁️ Preview
            </button>
          </div>
        </div>

        <!-- Data Management -->
        <div class="re-section">
          <div class="re-section-header">
            <div class="re-section-title">Data Management</div>
          </div>
          
          <div class="re-export-buttons-grid">
            <button class="re-btn re-btn-secondary re-btn-full" id="re-export-all">
              <div>📄</div>
              <span>Export JSON</span>
            </button>
            <button class="re-btn re-btn-secondary re-btn-full" id="re-export-csv">
              <div>📊</div>
              <span>Export CSV</span>
            </button>
            <button class="re-btn re-btn-secondary re-btn-full" id="re-export-prompts">
              <div>📤</div>
              <span>Export Settings</span>
            </button>
            <button class="re-btn re-btn-secondary re-btn-full" id="re-import-prompts">
              <div>📥</div>
              <span>Import Settings</span>
            </button>
          </div>
          
          <div class="re-data-management-actions">
            <button class="re-btn re-btn-secondary re-btn-full" id="re-test-analysis">
              <div>🧪</div>
              <span>Test Analysis</span>
            </button>
            
            <label class="re-url-bypass-setting">
              <input type="checkbox" id="re-allow-any-url" style="margin: 0;">
              <span>Allow any URL (bypass validation)</span>
            </label>
            
            <button class="re-btn re-btn-ghost re-btn-full" id="re-clear-data" style="color: #ff6b6b; border-color: #ff6b6b;">
              <div>🗑️</div>
              <span>Clear All Data</span>
            </button>
          </div>
        </div>

        <!-- Version Info -->
        <div class="re-version-info">
          RE Analyzer v2.0.0
        </div>
      </div>
    `;
  }

  getAnalyzerTabHTML() {
    return `
      <!-- Analyzer Tab -->
      <div id="analyzer-tab" class="re-tab-content re-tab-active">
        <!-- Quick Actions -->
        <div class="re-quick-actions">
          <button id="re-paste-analyze-btn" class="re-btn re-btn-primary re-btn-large">
            <span class="re-btn-icon">📋</span>
            <span class="re-btn-text">Paste & Analyze</span>
          </button>
          <button id="re-manual-input-btn" class="re-btn re-btn-secondary">
            <span class="re-btn-icon">✏️</span>
            <span class="re-btn-text">Manual Input</span>
          </button>
        </div>

        <!-- Property Input Section -->
        <div id="re-property-input" class="re-section re-hidden">
          <div class="re-section-header">
            <h3>Property Analysis</h3>
          </div>
          <div class="re-form-group">
            <label for="re-property-url" class="re-label">Property URL</label>
            <div class="re-input-group">
              <input type="text" id="re-property-url" class="re-input" 
                     placeholder="Paste property link from Zillow, Realtor.com, etc.">
              <button id="re-paste-btn" class="re-btn re-btn-icon" title="Paste from clipboard">
                📋
              </button>
            </div>
            <div class="re-input-validation" id="re-url-validation"></div>
          </div>
          <div class="re-form-actions">
            <button id="re-analyze-btn" class="re-btn re-btn-primary">
              <span class="re-btn-icon">🔍</span>
              <span class="re-btn-text">Analyze Property</span>
            </button>
            <button id="re-clear-btn" class="re-btn re-btn-ghost">Clear</button>
          </div>
        </div>

        <!-- Status Section -->
        <div class="re-status-section">
          <div id="re-status" class="re-status re-status-checking">
            <div class="re-status-icon">
              <div class="re-spinner"></div>
            </div>
            <div class="re-status-content">
              <div class="re-status-title">Checking Connection...</div>
              <div class="re-status-subtitle">Verifying ChatGPT access</div>
            </div>
          </div>
        </div>

        <!-- Analysis Progress -->
        <div id="re-analysis-progress" class="re-progress-section re-hidden">
          <div class="re-progress-header">
            <h4>Analysis in Progress</h4>
            <span class="re-progress-time" id="re-progress-time">0:00</span>
          </div>
          <div class="re-progress-steps">
            <div class="re-progress-step" data-step="validate">
              <div class="re-step-icon">⏳</div>
              <span>Validating URL</span>
            </div>
            <div class="re-progress-step" data-step="send">
              <div class="re-step-icon">⏳</div>
              <span>Sending to ChatGPT</span>
            </div>
            <div class="re-progress-step" data-step="analyze">
              <div class="re-step-icon">⏳</div>
              <span>AI Analysis</span>
            </div>
            <div class="re-progress-step" data-step="save">
              <div class="re-step-icon">⏳</div>
              <span>Saving Results</span>
            </div>
          </div>
          <div class="re-progress-tip">
            <span class="re-tip-icon">💡</span>
            <span>Analysis typically takes 30-60 seconds</span>
          </div>
        </div>

        <!-- Messages -->
        <div class="re-messages" id="re-messages">
          <div id="re-success-message" class="re-message re-message-success re-hidden">
            <div class="re-message-icon">✅</div>
            <div class="re-message-content"></div>
          </div>
          <div id="re-error-message" class="re-message re-message-error re-hidden">
            <div class="re-message-icon">❌</div>
            <div class="re-message-content"></div>
          </div>
          <div id="re-warning-message" class="re-message re-message-warning re-hidden">
            <div class="re-message-icon">⚠️</div>
            <div class="re-message-content"></div>
          </div>
        </div>
      </div>
    `;
  }

  getPropertiesTabHTML() {
    return `
      <!-- Properties Tab -->
      <div id="properties-tab" class="re-tab-content">
        <!-- Properties Overview -->
        <div class="re-properties-overview">
          <div class="re-overview-stats">
            <div class="re-stat-item">
              <span class="re-stat-number" id="re-total-properties">0</span>
              <span class="re-stat-label">Properties</span>
            </div>
            <div class="re-stat-item">
              <span class="re-stat-number" id="re-analyzed-count">0</span>
              <span class="re-stat-label">Analyzed</span>
            </div>
            <div class="re-stat-item">
              <span class="re-stat-number" id="re-categories-count">0</span>
              <span class="re-stat-label">Categories</span>
            </div>
          </div>
        </div>

        <!-- View Controls -->
        <div class="re-view-controls">
          <div class="re-view-toggle">
            <button class="re-view-btn re-view-active" data-view="category">
              <span class="re-view-icon">📁</span>
              Categories
            </button>
            <button class="re-view-btn" data-view="list">
              <span class="re-view-icon">📋</span>
              List
            </button>
          </div>
          <div class="re-view-actions">
            <button id="re-export-btn" class="re-btn re-btn-secondary re-btn-sm">
              <span class="re-btn-icon">📊</span>
              Export CSV
            </button>
            <button id="re-manage-categories-btn" class="re-btn re-btn-ghost re-btn-sm">
              <span class="re-btn-icon">⚙️</span>
              Manage
            </button>
          </div>
        </div>

        <!-- Properties Content -->
        <div class="re-properties-content">
          <!-- Category View -->
          <div id="re-category-view" class="re-view-content re-view-active">
            <div id="re-categories-grid" class="re-categories-grid">
              <!-- Categories will be populated by JavaScript -->
            </div>
          </div>

          <!-- List View -->
          <div id="re-list-view" class="re-view-content">
            <div id="re-properties-list" class="re-properties-list">
              <!-- Properties will be populated by JavaScript -->
            </div>
          </div>

          <!-- Empty State -->
          <div id="re-empty-state" class="re-empty-state">
            <div class="re-empty-icon">📄</div>
            <h3>No properties analyzed yet</h3>
            <p>Start by analyzing your first property in the Analyzer tab</p>
            <button class="re-btn re-btn-primary" id="re-start-analyzing">
              <span class="re-btn-icon">🔍</span>
              Start Analyzing
            </button>
          </div>
        </div>
      </div>
    `;
  }

  getSettingsTabHTML() {
    return `
      <!-- Settings Tab -->
      <div id="settings-tab" class="re-tab-content">
        <!-- Settings Overview -->
        <div class="re-settings-overview">
          <h2>Settings</h2>
          <p>Configure your RE Analyzer preferences</p>
        </div>

        <!-- Settings Sections -->
        <div class="re-settings-sections">
          <!-- Analysis Settings -->
          <div class="re-settings-section">
            <h3>
              <span class="re-settings-icon">🔍</span>
              Analysis Settings
            </h3>
            <div class="re-setting-item">
              <label class="re-setting-label">
                <input type="checkbox" id="re-auto-categorize" class="re-checkbox">
                <span class="re-setting-title">Auto-categorize properties</span>
              </label>
              <p class="re-setting-description">Automatically organize properties by source website for better management</p>
            </div>
            <div class="re-setting-item">
              <label class="re-setting-label">
                <input type="checkbox" id="re-show-notifications" class="re-checkbox" checked>
                <span class="re-setting-title">Show analysis notifications</span>
              </label>
              <p class="re-setting-description">Display success/error messages when property analysis completes</p>
            </div>
            <div class="re-setting-item">
              <label class="re-setting-label">
                <input type="checkbox" id="re-auto-switch-tab" class="re-checkbox" checked>
                <span class="re-setting-title">Auto-switch to Properties tab</span>
              </label>
              <p class="re-setting-description">Automatically navigate to Properties tab after successful analysis</p>
            </div>
          </div>

          <!-- UI Settings -->
          <div class="re-settings-section">
            <h3>
              <span class="re-settings-icon">🎨</span>
              Interface Settings
            </h3>
            <div class="re-setting-item">
              <label class="re-setting-label">
                <span class="re-setting-title">Panel Position</span>
              </label>
              <p class="re-setting-description">Choose where the analyzer panel appears on your screen</p>
              <select id="re-panel-position" class="re-select">
                <option value="right">Right Side</option>
                <option value="left">Left Side</option>
                <option value="bottom">Bottom</option>
              </select>
            </div>
            <div class="re-setting-item">
              <label class="re-setting-label">
                <input type="checkbox" id="re-compact-mode" class="re-checkbox">
                <span class="re-setting-title">Compact mode</span>
              </label>
              <p class="re-setting-description">Use smaller interface elements to save screen space</p>
            </div>
            <div class="re-setting-item">
              <label class="re-setting-label">
                <input type="checkbox" id="re-high-contrast" class="re-checkbox">
                <span class="re-setting-title">High contrast mode</span>
              </label>
              <p class="re-setting-description">Increase color contrast for better accessibility</p>
            </div>
          </div>

          <!-- Export Settings -->
          <div class="re-settings-section">
            <h3>
              <span class="re-settings-icon">📄</span>
              Export Settings
            </h3>
            <div class="re-setting-item">
              <label class="re-setting-label">
                <span class="re-setting-title">Default Export Format</span>
              </label>
              <p class="re-setting-description">Choose the default file format for property exports</p>
              <select id="re-export-format" class="re-select">
                <option value="word">Word Document (.docx)</option>
                <option value="csv">CSV Spreadsheet (.csv)</option>
                <option value="json">JSON Data (.json)</option>
              </select>
            </div>
            <div class="re-setting-item">
              <label class="re-setting-label">
                <input type="checkbox" id="re-include-full-analysis" class="re-checkbox" checked>
                <span class="re-setting-title">Include full analysis text</span>
              </label>
              <p class="re-setting-description">Include complete ChatGPT analysis in exported documents</p>
            </div>
          </div>
        </div>

        <!-- Settings Actions -->
        <div class="re-settings-actions">
          <button id="re-save-settings-btn" class="re-btn re-btn-primary">
            <span class="re-btn-icon">💾</span>
            Save Settings
          </button>
          <button id="re-reset-settings-btn" class="re-btn re-btn-ghost">
            Reset to Defaults
          </button>
        </div>

        <!-- Version Info -->
        <div class="re-version-info">
          <small>RE Analyzer v2.0.0 - Embedded UI</small>
        </div>
      </div>
    `;
  }

  setupEventListeners() {
    if (!this.panel) return;

    // Sidebar close button
    const closeBtn = this.panel.querySelector('#re-sidebar-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hidePanel());
    }

    // Navigation items
    const navItems = this.panel.querySelectorAll('.re-nav-item');
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        const tabId = item.getAttribute('data-tab');
        this.switchTab(tabId);
      });
    });

    // Analyzer events
    this.setupChatGPTAnalyzerEvents();
    
    // Properties events  
    this.setupChatGPTPropertiesEvents();
    
    // Settings events
    this.setupChatGPTSettingsEvents();

    console.log('🎮 ChatGPT-style event listeners set up');
  }

  setupChatGPTAnalyzerEvents() {
    // Quick analyze button
    const quickAnalyzeBtn = this.panel.querySelector('#re-quick-analyze');
    if (quickAnalyzeBtn) {
      quickAnalyzeBtn.addEventListener('click', async () => {
        try {
          const text = await navigator.clipboard.readText();
          if (this.isValidPropertyLink(text)) {
            await this.analyzeProperty(text);
          } else {
            this.showChatGPTMessage('error', 'Clipboard does not contain a valid property link');
          }
        } catch (err) {
          this.showChatGPTMessage('error', 'Unable to access clipboard. Please use manual input below.');
        }
      });
    }

    // Manual input elements
    const propertyInput = this.panel.querySelector('#re-property-input');
    const pasteAddon = this.panel.querySelector('#re-paste-addon');
    const analyzeBtn = this.panel.querySelector('#re-analyze-btn');

    if (propertyInput) {
      propertyInput.addEventListener('input', () => {
        this.validateChatGPTInput();
      });
    }

    if (pasteAddon) {
      pasteAddon.addEventListener('click', async () => {
        try {
          const text = await navigator.clipboard.readText();
          if (propertyInput) {
            propertyInput.value = text;
            this.validateChatGPTInput();
          }
        } catch (err) {
          this.showChatGPTMessage('error', 'Unable to paste from clipboard');
        }
      });
    }

    if (analyzeBtn) {
      analyzeBtn.addEventListener('click', () => {
        const url = propertyInput ? propertyInput.value.trim() : '';
        if (url && this.isValidPropertyLink(url)) {
          this.analyzeProperty(url);
        } else {
          this.showChatGPTMessage('error', 'Please enter a valid property URL');
        }
      });
    }
  }

  setupChatGPTPropertiesEvents() {
    // Start first analysis button
    const startBtn = this.panel.querySelector('#re-start-first-analysis');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        this.switchTab('analyzer');
      });
    }
  }

  setupChatGPTSettingsEvents() {
    // Position selector
    const positionSelect = this.panel.querySelector('#re-position-select');
    if (positionSelect) {
      positionSelect.value = uiSettings.position;
      positionSelect.addEventListener('change', () => {
        this.updatePanelPosition(positionSelect.value);
      });
    }

    // Settings toggles
    const compactToggle = this.panel.querySelector('#re-compact-toggle');
    const autoShowToggle = this.panel.querySelector('#re-auto-show-toggle');
    const notificationsToggle = this.panel.querySelector('#re-notifications-toggle');

    if (compactToggle) {
      compactToggle.checked = uiSettings.compactMode;
      compactToggle.addEventListener('change', () => {
        this.toggleCompactMode(compactToggle.checked);
      });
    }

    if (autoShowToggle) {
      autoShowToggle.checked = uiSettings.autoShow;
      autoShowToggle.addEventListener('change', () => {
        uiSettings.autoShow = autoShowToggle.checked;
        this.saveSettings();
      });
    }

    if (notificationsToggle) {
      notificationsToggle.checked = uiSettings.showNotifications;
      notificationsToggle.addEventListener('change', () => {
        uiSettings.showNotifications = notificationsToggle.checked;
        this.saveSettings();
      });
    }

    // Action buttons
    const exportBtn = this.panel.querySelector('#re-export-all');
    const exportCsvBtn = this.panel.querySelector('#re-export-csv');
    const testBtn = this.panel.querySelector('#re-test-analysis');
    const clearBtn = this.panel.querySelector('#re-clear-data');
    const clearAllDataBtn = this.panel.querySelector('#re-clear-all-data-btn');

    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportAllProperties());
    }

    if (exportCsvBtn) {
      exportCsvBtn.addEventListener('click', () => this.exportPropertiesToCSV());
    }

    if (testBtn) {
      testBtn.addEventListener('click', () => this.testAnalysis());
    }
    
    // Bypass URL validation checkbox
    const allowAnyUrlCheckbox = this.panel.querySelector('#re-allow-any-url');
    if (allowAnyUrlCheckbox) {
      // Load saved setting
      allowAnyUrlCheckbox.checked = uiSettings.allowAnyUrl || false;
      
      allowAnyUrlCheckbox.addEventListener('change', () => {
        uiSettings.allowAnyUrl = allowAnyUrlCheckbox.checked;
        this.saveSettings();
        console.log('🔓 Allow any URL setting:', allowAnyUrlCheckbox.checked);
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearAllData());
    }

    if (clearAllDataBtn) {
      clearAllDataBtn.addEventListener('click', () => this.clearAllDataWithConfirmation());
    }

    // Settings checkboxes
    const autoSwitchTabCheckbox = this.panel.querySelector('#re-auto-switch-tab');
    const highContrastCheckbox = this.panel.querySelector('#re-high-contrast');

    if (autoSwitchTabCheckbox) {
      autoSwitchTabCheckbox.checked = uiSettings.autoShow !== false;
      autoSwitchTabCheckbox.addEventListener('change', () => {
        uiSettings.autoShow = autoSwitchTabCheckbox.checked;
        this.saveSettings();
      });
    }

    if (highContrastCheckbox) {
      highContrastCheckbox.checked = uiSettings.highContrast || false;
      highContrastCheckbox.addEventListener('change', () => {
        uiSettings.highContrast = highContrastCheckbox.checked;
        this.saveSettings();
        this.applyHighContrastMode(highContrastCheckbox.checked);
      });
      
      // Apply on initialization
      this.applyHighContrastMode(highContrastCheckbox.checked);
    }
    
    // Fix any remaining contrast issues
    this.fixTextContrast();
    
    // Custom prompt events
    this.setupCustomPromptEvents();
  }

  setupAnalyzerEvents() {
    // Quick action buttons
    const pasteAnalyzeBtn = this.panel.querySelector('#re-paste-analyze-btn');
    const manualInputBtn = this.panel.querySelector('#re-manual-input-btn');
    const propertyInput = this.panel.querySelector('#re-property-input');
    
    if (pasteAnalyzeBtn) {
      pasteAnalyzeBtn.addEventListener('click', async () => {
        try {
          const text = await navigator.clipboard.readText();
          if (this.isValidPropertyLink(text)) {
            await this.analyzeProperty(text);
          } else {
            this.showMessage('error', 'Clipboard does not contain a valid property link');
          }
        } catch (err) {
          this.showMessage('error', 'Unable to access clipboard. Please use manual input.');
          this.showManualInput();
        }
      });
    }

    if (manualInputBtn) {
      manualInputBtn.addEventListener('click', () => {
        this.showManualInput();
      });
    }

    // Manual input form
    const propertyUrlInput = this.panel.querySelector('#re-property-url');
    const pasteBtn = this.panel.querySelector('#re-paste-btn');
    const analyzeBtn = this.panel.querySelector('#re-analyze-btn');
    const clearBtn = this.panel.querySelector('#re-clear-btn');

    if (propertyUrlInput) {
      propertyUrlInput.addEventListener('input', () => {
        this.validatePropertyInput();
      });
    }

    if (pasteBtn) {
      pasteBtn.addEventListener('click', async () => {
        try {
          const text = await navigator.clipboard.readText();
          if (propertyUrlInput) {
            propertyUrlInput.value = text;
            this.validatePropertyInput();
          }
        } catch (err) {
          this.showMessage('error', 'Unable to paste from clipboard');
        }
      });
    }

    if (analyzeBtn) {
      analyzeBtn.addEventListener('click', () => {
        const url = propertyUrlInput ? propertyUrlInput.value.trim() : '';
        if (url && this.isValidPropertyLink(url)) {
          this.analyzeProperty(url);
        } else {
          this.showMessage('error', 'Please enter a valid property URL');
        }
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (propertyUrlInput) {
          propertyUrlInput.value = '';
          this.clearValidation();
        }
      });
    }
  }

  setupPropertiesEvents() {
    // View toggle
    const viewButtons = this.panel.querySelectorAll('.re-view-btn');
    viewButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.getAttribute('data-view');
        this.switchPropertiesView(view);
      });
    });

    // Action buttons
    const exportBtn = this.panel.querySelector('#re-export-btn');
    const manageCategoriesBtn = this.panel.querySelector('#re-manage-categories-btn');
    const startAnalyzingBtn = this.panel.querySelector('#re-start-analyzing');

    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportProperties());
    }

    if (manageCategoriesBtn) {
      manageCategoriesBtn.addEventListener('click', () => this.manageCategories());
    }

    if (startAnalyzingBtn) {
      startAnalyzingBtn.addEventListener('click', () => this.switchTab('analyzer'));
    }
  }

  setupSettingsEvents() {
    // Settings form elements
    const panelPositionSelect = this.panel.querySelector('#re-panel-position');
    const compactModeCheckbox = this.panel.querySelector('#re-compact-mode');
    const saveSettingsBtn = this.panel.querySelector('#re-save-settings-btn');
    const resetSettingsBtn = this.panel.querySelector('#re-reset-settings-btn');

    if (panelPositionSelect) {
      panelPositionSelect.value = uiSettings.position;
      panelPositionSelect.addEventListener('change', () => {
        this.updatePanelPosition(panelPositionSelect.value);
      });
    }

    if (compactModeCheckbox) {
      compactModeCheckbox.checked = uiSettings.compactMode;
      compactModeCheckbox.addEventListener('change', () => {
        this.toggleCompactMode(compactModeCheckbox.checked);
      });
    }

    if (saveSettingsBtn) {
      saveSettingsBtn.addEventListener('click', () => this.saveSettings());
    }

    if (resetSettingsBtn) {
      resetSettingsBtn.addEventListener('click', () => this.resetSettings());
    }
  }

  setupPanelDragging() {
    const header = this.panel.querySelector('.re-panel-header');
    if (!header) return;

    let isDragging = false;
    let startX, startY, startLeft, startTop;

    header.addEventListener('mousedown', (e) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      
      const rect = this.panel.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      
      header.style.cursor = 'grabbing';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      
      const newLeft = Math.max(0, Math.min(window.innerWidth - this.panel.offsetWidth, startLeft + deltaX));
      const newTop = Math.max(0, Math.min(window.innerHeight - this.panel.offsetHeight, startTop + deltaY));
      
      this.panel.style.left = newLeft + 'px';
      this.panel.style.top = newTop + 'px';
      this.panel.style.right = 'auto';
      this.panel.style.bottom = 'auto';
      
      // Update position setting based on where the panel ends up
      this.updatePositionFromCoordinates(newLeft, newTop);
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        header.style.cursor = 'move';
        
        // Save the new position
        this.saveSettings();
      }
    });
  }

  // Adaptive positioning based on viewport and content
  setupAdaptivePositioning() {
    // Listen for window resize
    window.addEventListener('resize', () => {
      this.adaptToViewport();
    });
    
    // Listen for ChatGPT content changes that might affect layout
    const observer = new MutationObserver(() => {
      this.checkForLayoutConflicts();
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style']
    });
    
    // Initial adaptation
    this.adaptToViewport();
  }

  adaptToViewport() {
    if (!this.panel) return;
    
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    };
    
    // For ChatGPT-style sidebar, we don't need to change position as much
    // Just adjust for mobile
    if (viewport.width < 768) {
      this.panel.classList.add('re-mobile-mode');
      // Don't call updatePanelPosition to avoid saving settings repeatedly
      uiSettings.position = 'mobile';
    } else {
      this.panel.classList.remove('re-mobile-mode');
      // Restore position without saving
      if (uiSettings.position === 'mobile') {
        uiSettings.position = 'left'; // Default for ChatGPT-style sidebar
      }
    }
    
    console.log(`📱 Adapted to viewport: ${viewport.width}x${viewport.height}`);
  }

  detectOptimalSide() {
    // Check for conflicts with ChatGPT's sidebar and other elements
    const chatGptSidebar = document.querySelector('[data-radix-scroll-area-viewport]');
    const chatGptMain = document.querySelector('main');
    
    if (chatGptSidebar && chatGptMain) {
      const sidebarRect = chatGptSidebar.getBoundingClientRect();
      const mainRect = chatGptMain.getBoundingClientRect();
      
      // If sidebar is on the left and takes significant space, prefer right
      if (sidebarRect.left < 100 && sidebarRect.width > 200) {
        return 'right';
      }
      
      // If main content is centered, prefer right
      if (mainRect.left > 200) {
        return 'right';
      }
    }
    
    // Default to right side
    return 'right';
  }

  checkForLayoutConflicts() {
    if (!this.panel || !this.isVisible) return;
    
    // Check if panel overlaps with important ChatGPT elements
    const panelRect = this.panel.getBoundingClientRect();
    const chatInput = document.querySelector('[data-id="root"] textarea');
    const sendButton = document.querySelector('[data-testid="send-button"]');
    
    let hasConflict = false;
    
    if (chatInput) {
      const inputRect = chatInput.getBoundingClientRect();
      if (this.rectsOverlap(panelRect, inputRect)) {
        hasConflict = true;
      }
    }
    
    if (sendButton) {
      const buttonRect = sendButton.getBoundingClientRect();
      if (this.rectsOverlap(panelRect, buttonRect)) {
        hasConflict = true;
      }
    }
    
    if (hasConflict) {
      console.log('⚠️ Layout conflict detected, adjusting position');
      this.resolveLayoutConflict();
    }
  }

  rectsOverlap(rect1, rect2) {
    return !(rect1.right < rect2.left || 
             rect1.left > rect2.right || 
             rect1.bottom < rect2.top || 
             rect1.top > rect2.bottom);
  }

  resolveLayoutConflict() {
    // Try different positions to resolve conflicts
    const positions = ['right', 'left', 'bottom'];
    const currentPosition = uiSettings.position;
    
    for (const position of positions) {
      if (position !== currentPosition) {
        this.updatePanelPosition(position);
        
        // Check if conflict is resolved
        setTimeout(() => {
          this.checkForLayoutConflicts();
        }, 100);
        
        break;
      }
    }
  }

  updatePositionFromCoordinates(left, top) {
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    };
    
    const centerX = viewport.width / 2;
    const centerY = viewport.height / 2;
    
    // Determine position based on where the panel is
    if (top > viewport.height * 0.7) {
      uiSettings.position = 'bottom';
    } else if (left < centerX) {
      uiSettings.position = 'left';
    } else {
      uiSettings.position = 'right';
    }
  }

  // Keyboard shortcuts setup
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Only handle shortcuts when not typing in input fields
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
      }
      
      // Ctrl/Cmd + Shift + R: Toggle RE Analyzer
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'R') {
        e.preventDefault();
        this.togglePanel();
        console.log('⌨️ Toggled panel via keyboard shortcut');
      }
      
      // Ctrl/Cmd + Shift + A: Focus on analyzer tab
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        this.showPanel();
        this.switchTab('analyzer');
        console.log('⌨️ Switched to analyzer via keyboard shortcut');
      }
      
      // Ctrl/Cmd + Shift + P: Focus on properties tab  
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        this.showPanel();
        this.switchTab('properties');
        console.log('⌨️ Switched to properties via keyboard shortcut');
      }
      
      // Escape: Close panel
      if (e.key === 'Escape' && this.isVisible) {
        e.preventDefault();
        this.hidePanel();
        console.log('⌨️ Closed panel via Escape key');
      }
      
      // Ctrl/Cmd + Shift + V: Paste and analyze
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'V') {
        e.preventDefault();
        this.quickPasteAndAnalyze();
        console.log('⌨️ Quick paste and analyze via keyboard shortcut');
      }
    });
    
    console.log('⌨️ Keyboard shortcuts enabled');
  }

  async quickPasteAndAnalyze() {
    try {
      const text = await navigator.clipboard.readText();
      const cleanText = text.trim();
      
      if (!cleanText) {
        this.showChatGPTMessage('error', 'Clipboard is empty');
        return;
      }
      
      try {
        if (this.isValidPropertyLink(cleanText)) {
          this.showPanel();
          this.switchTab('analyzer');
          await this.analyzeProperty(cleanText);
        } else {
          this.showChatGPTMessage('error', 'Clipboard does not contain a valid property link');
        }
      } catch (validationError) {
        console.error('❌ Validation error in quick paste:', validationError);
        this.showChatGPTMessage('error', 'Invalid URL format in clipboard');
      }
    } catch (err) {
      console.error('❌ Clipboard access error:', err);
      this.showChatGPTMessage('error', 'Unable to access clipboard');
    }
  }

  // UI Control Methods
  showPanel() {
    if (!this.panel) return;
    
    this.panel.classList.add('re-sidebar-open');
    this.isVisible = true;
    
    // Update notification
    if (this.fab) {
      this.fab.classList.remove('re-has-notification');
    }
    
    console.log('👁️ ChatGPT-style sidebar shown');
  }

  hidePanel() {
    if (!this.panel) return;
    
    this.panel.classList.remove('re-sidebar-open');
    this.isVisible = false;
    
    console.log('👁️ ChatGPT-style sidebar hidden');
  }

  togglePanel() {
    if (this.isVisible) {
      this.hidePanel();
    } else {
      this.showPanel();
    }
  }

  minimizePanel() {
    if (!this.panel) return;
    
    if (this.panel.classList.contains('re-panel-minimized')) {
      this.panel.classList.remove('re-panel-minimized');
    } else {
      this.panel.classList.add('re-panel-minimized');
    }
  }

  switchTab(tabId) {
    if (!this.panel) return;
    
    // Update navigation items
    const navItems = this.panel.querySelectorAll('.re-nav-item');
    navItems.forEach(item => {
      if (item.getAttribute('data-tab') === tabId) {
        item.classList.add('re-nav-active');
      } else {
        item.classList.remove('re-nav-active');
      }
    });
    
    // Update section visibility
    const sections = ['analyzer', 'properties', 'settings'];
    sections.forEach(section => {
      const sectionElement = this.panel.querySelector(`#re-${section}-section`);
      if (sectionElement) {
        if (section === tabId) {
          sectionElement.classList.remove('re-hidden');
        } else {
          sectionElement.classList.add('re-hidden');
        }
      }
    });
    
    this.currentTab = tabId;
    
    // Update tab buttons (new tab structure)
    const tabButtons = this.panel.querySelectorAll('.re-tab-btn');
    tabButtons.forEach(btn => {
      btn.classList.remove('re-tab-active');
      btn.setAttribute('aria-selected', 'false');
      if (btn.dataset.tab === tabId) {
        btn.classList.add('re-tab-active');
        btn.setAttribute('aria-selected', 'true');
      }
    });

    // Update tab content (new tab structure)
    const tabContents = this.panel.querySelectorAll('.re-tab-content');
    tabContents.forEach(content => {
      content.classList.remove('re-tab-active');
      if (content.id === `${tabId}-tab`) {
        content.classList.add('re-tab-active');
      }
    });
    
    // Tab-specific logic
    if (tabId === 'properties') {
      this.loadChatGPTPropertyData();
    } else if (tabId === 'analyzer') {
      this.updateChatGPTConnectionStatus();
    } else if (tabId === 'settings') {
      // Fix contrast issues when settings tab is loaded
      setTimeout(() => this.fixTextContrast(), 100);
    }
    
    console.log(`📑 Switched to ChatGPT-style ${tabId} section`);
  }

  // ChatGPT-style helper methods
  validateChatGPTInput() {
    const input = this.panel.querySelector('#re-property-input');
    const validation = this.panel.querySelector('#re-input-validation');
    
    if (!input || !validation) return;
    
    const url = input.value.trim();
    
    if (!url) {
      validation.textContent = '';
      validation.className = 're-form-validation';
      return;
    }
    
    // Only validate if the input looks like it might be a complete URL
    // This prevents errors while user is still typing
    if (url.length < 5 || (!url.includes('.') && !url.startsWith('http'))) {
      validation.textContent = '';
      validation.className = 're-form-validation';
      return;
    }
    
    try {
      if (this.isValidPropertyLink(url)) {
        validation.textContent = '✓ Valid property URL';
        validation.className = 're-form-validation re-valid';
      } else {
        validation.textContent = '⚠ Please enter a valid property URL from a supported site';
        validation.className = 're-form-validation re-invalid';
      }
    } catch (error) {
      // Don't show validation errors while user is still typing
      validation.textContent = '';
      validation.className = 're-form-validation';
      console.log('⏸️ Validation skipped for incomplete input:', url);
    }
  }

  showChatGPTMessage(type, message) {
    const messageElement = this.panel.querySelector(`#re-${type}-msg`);
    const messageContent = messageElement?.querySelector('.re-message-content');
    
    if (messageElement && messageContent) {
      // Hide all messages first
      const allMessages = this.panel.querySelectorAll('.re-message');
      allMessages.forEach(msg => msg.classList.add('re-hidden'));
      
      // Show the specific message
      messageContent.textContent = message;
      messageElement.classList.remove('re-hidden');
      messageElement.classList.add('re-fade-in');
      
      // Auto-hide after 5 seconds
      setTimeout(() => {
        messageElement.classList.add('re-hidden');
        messageElement.classList.remove('re-fade-in');
      }, 5000);
    }
  }

  updateChatGPTConnectionStatus() {
    const statusElement = this.panel.querySelector('#re-connection-status');
    const statusIcon = statusElement?.querySelector('.re-status-icon');
    const statusTitle = statusElement?.querySelector('.re-status-title');
    const statusSubtitle = statusElement?.querySelector('.re-status-subtitle');
    
    if (!statusElement) return;
    
    // Check extension context first
    if (!isExtensionContextValid()) {
      statusElement.className = 're-status re-status-warning';
      if (statusIcon) statusIcon.textContent = '⚠️';
      if (statusTitle) statusTitle.textContent = 'Limited Functionality';
      if (statusSubtitle) statusSubtitle.textContent = 'Extension context lost - refresh page to restore features';
      
      // Add visual warning styling
      statusElement.style.borderLeft = '3px solid #ffa726';
      statusElement.style.backgroundColor = 'rgba(255, 167, 38, 0.1)';
    } else if (isChatGPTSite()) {
      statusElement.className = 're-status re-status-connected';
      if (statusIcon) statusIcon.textContent = '✅';
      if (statusTitle) statusTitle.textContent = 'Connected to ChatGPT';
      if (statusSubtitle) statusSubtitle.textContent = 'Ready to analyze properties';
      
      // Remove any warning styling
      statusElement.style.borderLeft = '';
      statusElement.style.backgroundColor = '';
    } else {
      statusElement.className = 're-status re-status-error';
      if (statusIcon) statusIcon.textContent = '❌';
      if (statusTitle) statusTitle.textContent = 'Not on ChatGPT';
      if (statusSubtitle) statusSubtitle.textContent = 'Please open ChatGPT to use this extension';
      
      // Remove any warning styling
      statusElement.style.borderLeft = '';
      statusElement.style.backgroundColor = '';
    }
  }

  async loadChatGPTPropertyData() {
    try {
      // Load property history from storage
      const result = await safeChromeFall(
        () => chrome.storage.local.get(['propertyHistory']),
        null
      );
      
      let properties = [];
      
      if (result && result.propertyHistory) {
        properties = result.propertyHistory;
        console.log(`📚 Loaded ${properties.length} properties from extension storage`);
        
        // Backup to localStorage for future fallback
        try {
          localStorage.setItem('reAnalyzer_backup_properties', JSON.stringify(properties));
        } catch (backupError) {
          console.warn('Failed to backup properties to localStorage:', backupError);
        }
      } else {
        // Try localStorage fallback for properties
        try {
          const localProperties = localStorage.getItem('reAnalyzer_backup_properties');
          if (localProperties) {
            properties = JSON.parse(localProperties);
            console.log(`📚 Loaded ${properties.length} properties from localStorage backup`);
            
            if (properties.length > 0) {
              this.showChatGPTMessage('warning', 
                `Loaded ${properties.length} properties from backup. Please refresh to restore full functionality.`);
            }
          } else {
            console.log('📚 No properties found in storage or backup');
            this.showChatGPTMessage('warning', 'Extension context lost. Please reload the page to access saved properties.');
          }
        } catch (localError) {
          console.warn('Failed to load properties from localStorage:', localError);
          this.showChatGPTMessage('warning', 'Extension context lost. Please reload the page to access saved properties.');
        }
      }
      
      // Update stats
      const analyzedCount = properties.filter(p => p.analysis && p.analysis.extractedData).length;
      const sources = [...new Set(properties.map(p => p.domain))].length;
      
      this.updateChatGPTStats(properties.length, analyzedCount, sources);
      this.updatePropertiesStats();
      
      // Show properties or empty state
      if (properties.length > 0) {
        this.displayChatGPTProperties(properties);
        this.hideChatGPTEmptyState();
      } else {
        this.showChatGPTEmptyState();
      }
      
      // Update badge
      this.updatePropertiesBadge(properties.length);
      
    } catch (error) {
      console.error('❌ Failed to load property data:', error);
      this.updateChatGPTStats(0, 0, 0);
      this.showChatGPTEmptyState();
    }
  }

  updateChatGPTStats(total, analyzed, sources) {
    const totalElement = this.panel.querySelector('#re-total-count');
    const analyzedElement = this.panel.querySelector('#re-analyzed-count');
    const sourcesElement = this.panel.querySelector('#re-sources-count');
    
    // Add null checks before calling toString()
    if (totalElement) totalElement.textContent = (total || 0).toString();
    if (analyzedElement) analyzedElement.textContent = (analyzed || 0).toString();
    if (sourcesElement) sourcesElement.textContent = (sources || 0).toString();
  }

  displayChatGPTProperties(properties) {
    const propertiesList = this.panel.querySelector('#re-properties-list');
    if (!propertiesList) return;

    // Clear existing content
    propertiesList.innerHTML = '';

    // Sort properties by timestamp (newest first)
    const sortedProperties = [...properties].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    // Show only the most recent 10 properties in the sidebar
    const recentProperties = sortedProperties.slice(0, 10);

    recentProperties.forEach(property => {
      const hasAnalysis = property.analysis && property.analysis.extractedData;
      const domain = this.getDomainDisplayName(property.domain);
      const title = this.getPropertyTitle(property);
      
      const propertyCard = document.createElement('div');
      propertyCard.className = 're-property-card';
      propertyCard.innerHTML = `
        <div class="re-property-header">
          <div class="re-property-title">${title}</div>
          <div class="re-property-status ${hasAnalysis ? 're-analyzed' : 're-pending'}">
            ${hasAnalysis ? '✅' : '⏳'}
          </div>
        </div>
        <div class="re-property-meta">
          <div class="re-property-domain">${domain}</div>
          <div>${property.date || 'Unknown date'}</div>
        </div>
        <div class="re-property-actions">
          <button class="re-btn re-btn-ghost re-btn-sm re-view-btn" data-property-url="${property.url}">
            View Analysis
          </button>
                      ${hasAnalysis ? `
              <button class="re-btn re-btn-secondary re-btn-sm re-export-btn" data-property-url="${property.url}">
                📊 CSV
              </button>
            ` : `
            <button class="re-btn re-btn-primary re-btn-sm re-analyze-btn" data-property-url="${property.url}">
              Analyze
            </button>
          `}
        </div>
      `;
      
      propertiesList.appendChild(propertyCard);
    });

    // Event listeners handled by global delegation

    // Add "View All" button if there are more properties
    if (properties.length > 10) {
      const viewAllCard = document.createElement('div');
      viewAllCard.style.textAlign = 'center';
      viewAllCard.style.padding = '16px';
      viewAllCard.innerHTML = `
        <div style="color: var(--chatgpt-text-secondary); font-size: 14px; margin-bottom: 8px;">
          ${properties.length - 10} more properties
        </div>
        <button class="re-btn re-btn-ghost re-btn-sm">
          View All Properties
        </button>
      `;
      propertiesList.appendChild(viewAllCard);
    }
  }

  showChatGPTEmptyState() {
    const emptyState = this.panel.querySelector('#re-empty-properties');
    const propertiesList = this.panel.querySelector('#re-properties-list');
    
    if (emptyState) emptyState.classList.remove('re-hidden');
    if (propertiesList) propertiesList.innerHTML = '';
  }

  hideChatGPTEmptyState() {
    const emptyState = this.panel.querySelector('#re-empty-properties');
    if (emptyState) emptyState.classList.add('re-hidden');
  }

  updatePropertiesBadge(count) {
    const badge = this.panel.querySelector('#re-properties-badge');
    if (badge) {
      if (count > 0) {
        badge.textContent = (count || 0).toString();
        badge.classList.remove('re-hidden');
      } else {
        badge.classList.add('re-hidden');
      }
    }
  }

  async exportAllProperties() {
    try {
      // Load all property data
      const result = await safeChromeFall(
        () => chrome.storage.local.get(['propertyHistory']),
        { propertyHistory: [] }
      );
      
      const properties = result.propertyHistory || [];
      
      if (properties.length === 0) {
        this.showChatGPTMessage('warning', 'No properties to export');
        return;
      }
      
      // Create comprehensive export data with calculated metrics
      const exportData = {
        exportDate: new Date().toISOString(),
        totalProperties: properties.length,
        analyzedCount: properties.filter(p => p.analysis && p.analysis.extractedData).length,
        calculatedMetricsCount: properties.filter(p => p.analysis && p.analysis.calculatedMetrics).length,
        properties: properties.map(property => ({
          url: property.url,
          domain: property.domain,
          date: property.date,
          timestamp: property.timestamp,
          extractedData: property.analysis?.extractedData || {},
          calculatedMetrics: property.analysis?.calculatedMetrics || {},
          fullAnalysis: property.analysis?.fullResponse || property.analysis?.fullAnalysis || 'No analysis available',
          hasAnalysis: !!(property.analysis && property.analysis.extractedData),
          hasCalculatedMetrics: !!(property.analysis && property.analysis.calculatedMetrics)
        }))
      };
      
      // Create and download file
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], {type: 'application/json'});
      
      const link = document.createElement('a');
      link.href = URL.createObjectURL(dataBlob);
      link.download = `all-properties-analysis-${Date.now()}.json`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      const metricsCount = properties.filter(p => p.analysis && p.analysis.calculatedMetrics).length;
      this.showChatGPTMessage('success', `Exported ${properties.length} properties with ${metricsCount} having calculated metrics!`);
      
    } catch (error) {
      console.error('❌ Failed to export all properties:', error);
      this.showChatGPTMessage('error', 'Failed to export properties');
    }
  }

  async exportPropertiesToCSV() {
    try {
      // Load all property data
      const result = await safeChromeFall(
        () => chrome.storage.local.get(['propertyHistory']),
        { propertyHistory: [] }
      );
      
      const properties = result.propertyHistory || [];
      
      if (properties.length === 0) {
        this.showChatGPTMessage('warning', 'No properties to export');
        return;
      }
      
      // Get comprehensive column set for tabular data
      const columns = getTabularDataColumns();
      
      // Create CSV headers
      const headers = [
        'URL',
        'Domain', 
        'Analysis Date',
        ...columns.map(col => col.name)
      ];
      
      // Create CSV rows
      const rows = [headers];
      
      properties.forEach(property => {
        if (property.analysis) {
          const row = [
            property.url || '',
            property.domain || '',
            property.date || ''
          ];
          
          // Add extracted data columns
          columns.forEach(col => {
            let value = '';
            
            if (col.isCalculated) {
              // Get from calculated metrics
              value = property.analysis.calculatedMetrics?.[col.id] || '';
            } else {
              // Get from extracted data
              value = property.analysis.extractedData?.[col.id] || '';
            }
            
            // Format value for CSV
            if (typeof value === 'number') {
              value = value.toString();
            } else if (typeof value === 'string') {
              // Escape commas and quotes for CSV
              if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                value = `"${value.replace(/"/g, '""')}"`;
              }
            }
            
            row.push(value);
          });
          
          rows.push(row);
        }
      });
      
      // Convert to CSV string
      const csvContent = rows.map(row => row.join(',')).join('\n');
      
      // Create and download file
      const dataBlob = new Blob([csvContent], {type: 'text/csv'});
      
      const link = document.createElement('a');
      link.href = URL.createObjectURL(dataBlob);
      link.download = `property-analysis-comprehensive-${Date.now()}.csv`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      const analyzedCount = properties.filter(p => p.analysis && p.analysis.extractedData).length;
      this.showChatGPTMessage('success', `Exported ${analyzedCount} analyzed properties to CSV with ${columns.length} columns!`);
      
    } catch (error) {
      console.error('❌ Failed to export properties to CSV:', error);
      this.showChatGPTMessage('error', 'Failed to export properties to CSV');
    }
  }

  async testAnalysis() {
    console.log('🧪 Testing analysis functionality...');
    
    const testUrls = [
      'https://www.zillow.com/homedetails/123-Main-St-Anytown-CA-12345/123456789_zpid/',
      'https://www.realtor.com/realestateandhomes-detail/123-Main-St_Anytown_CA_12345',
      'https://www.redfin.com/CA/Anytown/123-Main-St-12345/home/123456789'
    ];
    
    try {
      // First test if we can find the input field
      const inputField = findChatGPTInput();
      if (!inputField) {
        this.showChatGPTMessage('error', 'Could not find ChatGPT input field. Please make sure the page is fully loaded.');
        return;
      }
      
      this.showChatGPTMessage('success', 'ChatGPT input field found successfully!');
      console.log('✅ Found input field:', inputField);
      
      // Show which input field was found
      const fieldInfo = inputField.tagName + (inputField.getAttribute('data-id') ? `[data-id="${inputField.getAttribute('data-id')}"]` : '') + (inputField.placeholder ? ` placeholder="${inputField.placeholder}"` : '');
      console.log('📋 Field details:', fieldInfo);
      
      // Let user choose a test URL
      const testUrl = prompt(`Choose a test URL (enter 1, 2, 3, 4, 5, or 6):
1. Zillow Test URL
2. Realtor.com Test URL  
3. Redfin Test URL
4. Monitor ChatGPT responses (for debugging)
5. Debug saved analysis data
6. Test View Analysis functionality
      
Or enter your own property URL:`);
      
      let urlToTest;
      
      // Special debugging option
      if (testUrl === '4') {
        this.showChatGPTMessage('info', 'Now monitoring ChatGPT responses. Check console for detailed logs about what responses are being detected and saved.');
        console.log('🔍 RESPONSE MONITORING ACTIVATED');
        console.log('🔍 Send a property link to ChatGPT and watch the console for:');
        console.log('🔍 - "FIRST response (confirmation)" - this should NOT be saved');
        console.log('🔍 - "SECOND response (analysis)" - this SHOULD be saved');
        return;
      }
      
      // Special debug option to inspect saved data
      if (testUrl === '5') {
        this.debugSavedAnalyses();
        return;
      }
      
      // Test View Analysis functionality
      if (testUrl === '6') {
        if (window.testViewAnalysis) {
          window.testViewAnalysis();
        } else {
          console.log('❌ testViewAnalysis function not available');
        }
        return;
      }
      

      if (testUrl === '1') {
        urlToTest = testUrls[0];
      } else if (testUrl === '2') {
        urlToTest = testUrls[1];
      } else if (testUrl === '3') {
        urlToTest = testUrls[2];
      } else if (testUrl && testUrl.trim()) {
        urlToTest = testUrl.trim();
        // If it doesn't start with http, add https://
        if (!urlToTest.startsWith('http')) {
          urlToTest = 'https://' + urlToTest;
        }
      } else {
        this.showChatGPTMessage('warning', 'Test cancelled');
        return;
      }
      
      // Test URL validation first
      console.log('🧪 Testing URL validation for:', urlToTest);
      const isValid = this.isValidPropertyLink(urlToTest);
      
      if (!isValid) {
        this.showChatGPTMessage('error', `URL validation failed for: ${urlToTest}. Check console for details.`);
        console.log('❌ The URL did not pass validation. This is likely why analysis is not working.');
        console.log('💡 Try adding the domain to the supported domains list or use a different property site.');
        return;
      } else {
        this.showChatGPTMessage('success', `URL validation passed for: ${urlToTest}`);
      }
      
      // Test the analysis with the selected URL
      console.log('🔍 Testing analysis with:', urlToTest);
      this.showChatGPTMessage('info', `Testing analysis with: ${urlToTest}`);
      
      await this.analyzeProperty(urlToTest);
      
    } catch (error) {
      console.error('❌ Test failed:', error);
      this.showChatGPTMessage('error', `Test failed: ${error.message}`);
    }
  }

  clearAllData() {
    if (confirm('Are you sure you want to clear all property data? This action cannot be undone.')) {
      safeChromeFall(
        () => chrome.storage.local.remove(['propertyHistory']),
        null
      ).then(() => {
        this.showChatGPTMessage('success', 'All property data has been cleared');
        this.loadChatGPTPropertyData();
      });
    }
  }

  clearAllDataWithConfirmation() {
    this.showConfirmationDialog({
      title: 'Clear All Property Data',
      message: 'Are you sure you want to delete all property analyses? This action cannot be undone.',
      confirmText: 'Clear All Data',
      cancelText: 'Cancel',
      onConfirm: () => {
        safeChromeFall(
          () => chrome.storage.local.remove(['propertyHistory']),
          null
        ).then(() => {
          this.showChatGPTMessage('success', 'All property data has been cleared');
          this.loadChatGPTPropertyData();
          this.updatePropertiesStats();
          
          // Update display immediately
          this.displayProperties();
        });
      }
    });
  }

  deleteProperty(propertyUrl) {
    this.showConfirmationDialog({
      title: 'Delete Property',
      message: 'Are you sure you want to delete this property analysis? This action cannot be undone.',
      confirmText: 'Delete Property',
      cancelText: 'Cancel',
      onConfirm: () => {
        safeChromeFall(
          () => chrome.storage.local.get(['propertyHistory']),
          { propertyHistory: [] }
        ).then(result => {
          const properties = result.propertyHistory || [];
          const updatedProperties = properties.filter(p => p.url !== propertyUrl);
          
          return safeChromeFall(
            () => chrome.storage.local.set({ propertyHistory: updatedProperties }),
            null
          );
        }).then(() => {
          this.showChatGPTMessage('success', 'Property deleted successfully');
          this.loadChatGPTPropertyData();
          this.updatePropertiesStats();
          
          // Update display immediately
          this.displayProperties();
        }).catch(error => {
          this.showChatGPTMessage('error', 'Failed to delete property: ' + error.message);
        });
      }
    });
  }

  showConfirmationDialog(options) {
    const modal = document.createElement('div');
    modal.className = 're-modal-overlay';
    modal.innerHTML = `
      <div class="re-confirmation-modal">
        <div class="re-modal-header">
          <h3>${options.title}</h3>
          <button class="re-modal-close-btn">×</button>
        </div>
        <div class="re-modal-body">
          <p>${options.message}</p>
        </div>
        <div class="re-modal-footer">
          <button class="re-btn re-btn-ghost re-modal-cancel-btn">${options.cancelText}</button>
          <button class="re-btn re-btn-danger re-modal-confirm-btn">${options.confirmText}</button>
        </div>
      </div>
    `;

    // Add event listeners
    const closeBtn = modal.querySelector('.re-modal-close-btn');
    const cancelBtn = modal.querySelector('.re-modal-cancel-btn');
    const confirmBtn = modal.querySelector('.re-modal-confirm-btn');

    const closeModal = () => modal.remove();
    
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    confirmBtn.addEventListener('click', () => {
      options.onConfirm();
      closeModal();
    });

    // Close on overlay click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    document.body.appendChild(modal);
  }

  applyHighContrastMode(enabled) {
    const panel = document.querySelector('#re-analyzer-panel');
    if (panel) {
      if (enabled) {
        panel.classList.add('re-high-contrast-mode');
      } else {
        panel.classList.remove('re-high-contrast-mode');
      }
    }
  }

  fixTextContrast() {
    // Fix any remaining inline styles that cause contrast issues
    const panel = this.panel;
    if (!panel) return;
    
    // Find all elements with problematic inline colors
    const problematicElements = panel.querySelectorAll('[style*="color: #d1d5db"], [style*="color: #9ca3af"], [style*="color: #ffffff"]');
    
    problematicElements.forEach(element => {
      const style = element.getAttribute('style') || '';
      
      // Replace problematic colors with CSS variables
      let newStyle = style
        .replace(/color:\s*#d1d5db/gi, 'color: var(--re-text-secondary)')
        .replace(/color:\s*#9ca3af/gi, 'color: var(--re-text-muted)')
        .replace(/color:\s*#ffffff/gi, 'color: var(--re-text-primary)');
      
      // Only update if we made changes and it's not a button
      if (newStyle !== style && !element.classList.contains('re-btn')) {
        element.setAttribute('style', newStyle);
      }
    });
    
    console.log('🎨 Fixed text contrast for', problematicElements.length, 'elements');
  }

  fixModalContrast(modal) {
    if (!modal) return;
    
    // Find all elements with hardcoded colors that might cause contrast issues
    const problematicElements = modal.querySelectorAll('[style*="color: #"], [style*="color:#"]');
    
    problematicElements.forEach(element => {
      const style = element.getAttribute('style') || '';
      
      // Replace problematic colors with CSS variables
      let newStyle = style
        .replace(/color:\s*#000000/gi, 'color: var(--re-text-primary)')
        .replace(/color:\s*#666666/gi, 'color: var(--re-text-secondary)')
        .replace(/color:\s*#888888/gi, 'color: var(--re-text-muted)')
        .replace(/color:\s*#ffffff/gi, 'color: var(--re-text-primary)')
        .replace(/color:\s*#d1d5db/gi, 'color: var(--re-text-secondary)')
        .replace(/color:\s*#9ca3af/gi, 'color: var(--re-text-muted)');
      
      if (newStyle !== style) {
        element.setAttribute('style', newStyle);
      }
    });
    
    // Ensure modal background adapts to theme
    const modalElement = modal.querySelector('.re-modal');
    if (modalElement) {
      modalElement.style.background = 'var(--re-background)';
      modalElement.style.color = 'var(--re-text-primary)';
    }
    
    console.log('🎨 Fixed modal contrast for', problematicElements.length, 'elements');
  }

  updatePropertiesStats() {
    safeChromeFall(
      () => chrome.storage.local.get(['propertyHistory']),
      { propertyHistory: [] }
    ).then(result => {
      try {
        const properties = result.propertyHistory || [];
        const analyzedCount = properties.filter(p => p && p.analysis && p.analysis.extractedData).length;
        const pendingCount = Math.max(0, properties.length - analyzedCount);
        
        // Update stats in properties tab
        const totalElement = this.panel.querySelector('#re-total-properties');
        const analyzedElement = this.panel.querySelector('#re-analyzed-count');
        const pendingElement = this.panel.querySelector('#re-pending-count');
        
        if (totalElement) totalElement.textContent = (properties.length || 0).toString();
        if (analyzedElement) analyzedElement.textContent = (analyzedCount || 0).toString();
        if (pendingElement) pendingElement.textContent = (pendingCount || 0).toString();
        
        // Update notification badge
        const notification = this.panel.querySelector('#properties-notification');
        if (notification) {
          if (pendingCount > 0) {
            notification.textContent = (pendingCount || 0).toString();
            notification.classList.add('re-show');
          } else {
            notification.classList.remove('re-show');
          }
        }
      } catch (error) {
        console.error('❌ Error updating properties stats:', error);
      }
    }).catch(error => {
      console.error('❌ Error loading property history for stats:', error);
    });
  }

  checkExtensionContext() {
    if (!isExtensionContextValid()) {
      console.warn('⚠️ Extension context invalidated during initialization');
      this.showChatGPTMessage('warning', 'Extension was updated. Please reload the page for full functionality.');
      
      // Show persistent warning banner
      this.showExtensionContextWarning();
      
      // Add a reload button to the warning message
      setTimeout(() => {
        const warningMsg = this.panel.querySelector('#re-warning-msg');
        if (warningMsg && !warningMsg.classList.contains('re-hidden')) {
          const reloadBtn = document.createElement('button');
          reloadBtn.className = 're-btn re-btn-secondary re-btn-sm';
          reloadBtn.innerHTML = '<span>🔄</span><span>Reload Page</span>';
          reloadBtn.style.marginTop = '8px';
          reloadBtn.onclick = () => window.location.reload();
          
          const content = warningMsg.querySelector('.re-message-content');
          if (content) {
            content.appendChild(reloadBtn);
          }
        }
      }, 100);
    }
  }

  showExtensionContextWarning() {
    // Remove existing warning if any
    const existingWarning = document.getElementById('re-context-warning');
    if (existingWarning) {
      existingWarning.remove();
    }

    // Create warning banner
    const warningBanner = document.createElement('div');
    warningBanner.id = 're-context-warning';
    warningBanner.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: linear-gradient(90deg, #ff6b6b, #ffa726);
      color: white;
      padding: 12px 16px;
      text-align: center;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      font-weight: 500;
      z-index: 10001;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      border-bottom: 2px solid rgba(255,255,255,0.3);
    `;
    
    warningBanner.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; gap: 12px;">
        <span>⚠️ RE Analyzer: Extension context lost - some features may not work</span>
        <button onclick="window.location.reload()" style="
          background: rgba(255,255,255,0.2);
          border: 1px solid rgba(255,255,255,0.4);
          color: white;
          padding: 6px 12px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 500;
        ">
          🔄 Refresh Page
        </button>
        <button onclick="document.getElementById('re-context-warning').remove()" style="
          background: transparent;
          border: none;
          color: white;
          padding: 6px;
          cursor: pointer;
          font-size: 16px;
          opacity: 0.8;
        ">
          ×
        </button>
      </div>
    `;
    
    document.body.appendChild(warningBanner);
    
    // Auto-fade after 10 seconds to be less intrusive
    setTimeout(() => {
      if (document.getElementById('re-context-warning')) {
        warningBanner.style.opacity = '0.8';
      }
    }, 10000);
    
    console.log('📢 Context invalidation warning banner displayed');
  }

  // Helper methods for UI functionality will be added in the next part...
  
  showManualInput() {
    const propertyInput = this.panel.querySelector('#re-property-input');
    if (propertyInput) {
      propertyInput.classList.remove('re-hidden');
    }
  }

  isValidPropertyLink(url) {
    try {
      // Check if URL is empty, null, or undefined
      if (!url || typeof url !== 'string' || url.trim().length === 0) {
        console.log('❌ Empty or invalid URL provided');
        return false;
      }
      
      // Clean the URL
      url = url.trim();
      
      // Check if bypass is enabled
      const allowAnyUrl = this.panel?.querySelector('#re-allow-any-url')?.checked;
      if (allowAnyUrl) {
        console.log('🔓 URL validation bypassed - allowing any URL');
        // Still need to validate it's a proper URL format for bypass mode
        try {
          new URL(url);
          return true;
        } catch (e) {
          // Try adding https:// if it doesn't have a protocol
          try {
            new URL('https://' + url);
            return true;
          } catch (e2) {
            console.log('❌ Invalid URL format even with bypass enabled');
            return false;
          }
        }
      }
      
      // Try to construct URL, add https:// if missing
      let urlObj;
      try {
        urlObj = new URL(url);
      } catch (e) {
        // If URL construction fails, try adding https://
        try {
          urlObj = new URL('https://' + url);
          console.log('🔧 Added https:// prefix to URL');
        } catch (e2) {
          console.log('❌ Invalid URL format:', url);
          return false;
        }
      }
      
      const hostname = urlObj.hostname.toLowerCase();
      
      console.log('🔍 Validating URL:', url);
      console.log('🌐 Hostname:', hostname);
      
      const propertyDomains = [
        // Major US platforms
        'zillow.com', 'realtor.com', 'redfin.com', 'homes.com', 'trulia.com',
        'apartments.com', 'rent.com', 'hotpads.com', 'padmapper.com', 'loopnet.com',
        'compass.com', 'coldwellbanker.com', 'century21.com', 'remax.com',
        'kw.com', 'sothebysrealty.com', 'movoto.com', 'homefinder.com',
        'crexi.com', 'propertyradar.com', 'rocketmortgage.com',
        
        // International platforms
        'rightmove.co.uk', 'zoopla.co.uk', 'onthemarket.com', 'primelocation.com',
        'realestate.com.au', 'domain.com.au', 'realtor.ca', 'royallepage.ca',
        'centris.ca', 'mls.ca', 'immoweb.be', 'immobilienscout24.de',
        'leboncoin.fr', 'seloger.com', 'logic-immo.com', 'bienici.com',
        'idealista.com', 'fotocasa.es', 'habitaclia.com', 'yapo.cl',
        'mercadolibre.com', 'olx.com', 'trovit.com', 'mitula.com',
        'kyero.com', 'thinkspain.com', 'greekpropertyportal.com',
        
        // Israeli platforms
        'yad2.co.il', 'madlan.co.il',
        
        // Greek platforms
        'spitogatos.gr', 'green-acres.gr',
        
        // Cyprus platforms
        'zyprus.com', 'bazaraki.com',
        
        // Regional/Local platforms
        'mls.com', 'mlslistings.com', 'paragonrels.com', 'northstarmlscom',
        'matrix.neren.com', 'flexmls.com', 'carets.com', 'listhub.com',
        'propertyshark.com', 'streeteasy.com', 'renthop.com', 'zumper.com',
        'forrent.com', 'apartmentguide.com', 'rentals.com', 'apartments24.com'
      ];
      
      const isValid = propertyDomains.some(domain => hostname.includes(domain)) || 
                     hostname.includes('mls') || // Generic MLS sites
                     hostname.includes('realty') || // Realty sites
                     hostname.includes('property') || // Property sites
                     hostname.includes('real-estate') || // Real estate sites
                     hostname.includes('homes') || // Homes sites
                     hostname.includes('rent'); // Rental sites
      
      console.log('✅ URL validation result:', isValid);
      
      if (!isValid) {
        console.log('❌ URL not recognized as property listing site');
        console.log('🔍 Supported domains include:', propertyDomains.slice(0, 5).join(', '), '+ many more');
      }
      
      return isValid;
    } catch (e) {
      console.error('❌ URL validation error:', e);
      return false;
    }
  }

  validatePropertyInput() {
    const propertyUrlInput = this.panel.querySelector('#re-property-url');
    const validation = this.panel.querySelector('#re-url-validation');
    
    if (!propertyUrlInput || !validation) return;
    
    const url = propertyUrlInput.value.trim();
    
    if (!url) {
      validation.textContent = '';
      validation.className = 're-input-validation';
      return;
    }
    
    if (this.isValidPropertyLink(url)) {
      validation.textContent = '✅ Valid property URL';
      validation.className = 're-input-validation re-valid';
    } else {
      validation.textContent = '❌ Please enter a valid property URL from a supported site';
      validation.className = 're-input-validation re-invalid';
    }
  }

  clearValidation() {
    const validation = this.panel.querySelector('#re-url-validation');
    if (validation) {
      validation.textContent = '';
      validation.className = 're-input-validation';
    }
  }

  showMessage(type, message) {
    const messageElement = this.panel.querySelector(`#re-${type}-message`);
    const messageContent = messageElement?.querySelector('.re-message-content');
    
    if (messageElement && messageContent) {
      // Hide all messages first
      const allMessages = this.panel.querySelectorAll('.re-message');
      allMessages.forEach(msg => msg.classList.remove('re-show'));
      
      // Show the specific message
      messageContent.textContent = message;
      messageElement.classList.add('re-show');
      
      // Auto-hide after 5 seconds
      setTimeout(() => {
        messageElement.classList.remove('re-show');
      }, 5000);
    }
  }

  updateConnectionStatus() {
    const statusElement = this.panel.querySelector('#re-status');
    const statusIcon = statusElement?.querySelector('.re-status-icon');
    const statusTitle = statusElement?.querySelector('.re-status-title');
    const statusSubtitle = statusElement?.querySelector('.re-status-subtitle');
    
    if (!statusElement) return;
    
    // Check if we're on ChatGPT
    if (isChatGPTSite()) {
      statusElement.className = 're-status re-status-connected';
      if (statusIcon) statusIcon.innerHTML = '✅';
      if (statusTitle) statusTitle.textContent = 'Connected to ChatGPT';
      if (statusSubtitle) statusSubtitle.textContent = 'Ready to analyze properties';
    } else {
      statusElement.className = 're-status re-status-error';
      if (statusIcon) statusIcon.innerHTML = '❌';
      if (statusTitle) statusTitle.textContent = 'Not on ChatGPT';
      if (statusSubtitle) statusSubtitle.textContent = 'Please open ChatGPT to use this extension';
    }
  }

  async analyzeProperty(url) {
    try {
      console.log('🔍 Starting property analysis:', url);
      
      // Show progress
      this.showAnalysisProgress();
      
      // Start timer
      this.analysisStartTime = Date.now();
      this.analysisTimer = setInterval(() => {
        this.updateAnalysisTimer();
      }, 1000);
      
      // Update progress steps
      this.updateAnalysisStep('validate', 'completed');
      this.updateAnalysisStep('send', 'active');
      
      // Use existing analysis functionality from the original content script
      const response = await this.sendAnalysisToBackground(url);
      
      if (response && response.success) {
        this.updateAnalysisStep('send', 'completed');
        this.updateAnalysisStep('analyze', 'active');
        
        // Simulate analysis time
        setTimeout(() => {
          this.updateAnalysisStep('analyze', 'completed');
          this.updateAnalysisStep('save', 'completed');
          this.completeAnalysis();
          this.showMessage('success', 'Property analysis completed successfully!');
        }, 2000);
        
      } else {
        throw new Error(response?.error || 'Analysis failed');
      }
      
    } catch (error) {
      console.error('❌ Analysis failed:', error);
      this.hideAnalysisProgress();
      this.showMessage('error', `Analysis failed: ${error.message}`);
    }
  }

  async sendAnalysisToBackground(url) {
    try {
      // Check extension context before analysis
      if (!isExtensionContextValid()) {
        throw new Error('Extension context invalidated. Please reload the page.');
      }
      
      // First, test if we can find the ChatGPT input field
      console.log('🔍 Testing ChatGPT input field detection...');
      let testInput = findChatGPTInput();
      
      // If not found immediately, wait for page to load
      if (!testInput) {
        console.log('⏳ Input field not found immediately, waiting for page to load...');
        testInput = await waitForInputField(15000); // Wait up to 15 seconds
      }
      
      if (!testInput) {
        // Offer manual selection as last resort
        console.log('🎯 Attempting manual input field selection...');
        const userChoice = confirm('Automatic input field detection failed. Would you like to manually select the ChatGPT input field? (Click OK to select manually, or Cancel to abort)');
        
        if (userChoice) {
          testInput = await manuallySelectChatGPTInput();
          if (!testInput) {
            throw new Error('Manual input field selection was cancelled or timed out. Please try again or refresh the page.');
          }
        } else {
          throw new Error('Could not find ChatGPT input field. Make sure you are on the ChatGPT page (https://chatgpt.com) and it has loaded completely. Try refreshing the page. For debugging, run debugChatGPTInput() in the console.');
        }
      }
      console.log('✅ ChatGPT input field found:', testInput);
      
      // Use the existing insertPropertyAnalysisPrompt function from the original content script
      console.log('🔗 Connecting to existing analysis functionality...');
      
      // Store the URL in the embedded UI context
      currentPropertyAnalysis = { url, startTime: Date.now() };
      
      // Call the existing insertPropertyAnalysisPrompt function
      if (typeof insertPropertyAnalysisPrompt !== 'function') {
        throw new Error('insertPropertyAnalysisPrompt function not available. Extension may not be properly loaded.');
      }
      
      console.log('📤 Calling insertPropertyAnalysisPrompt with URL:', url);
      const result = await insertPropertyAnalysisPrompt(url);
      console.log('📥 insertPropertyAnalysisPrompt result:', result);
      
      if (!result) {
        throw new Error('Failed to insert property analysis prompt into ChatGPT');
      }
      
      return { success: result, result };
    } catch (error) {
      console.error('❌ Analysis integration failed:', error);
      return { success: false, error: error.message };
    }
  }

  showAnalysisProgress() {
    const progressSection = this.panel.querySelector('#re-analysis-progress');
    if (progressSection) {
      progressSection.classList.remove('re-hidden');
      
      // Update progress property info if currentPropertyAnalysis is available
      if (currentPropertyAnalysis && currentPropertyAnalysis.url) {
        const urlElement = this.panel.querySelector('#re-progress-url');
        const domainElement = this.panel.querySelector('#re-progress-domain');
        
        if (urlElement) {
          urlElement.textContent = this.truncateUrl(currentPropertyAnalysis.url, 50);
        }
        if (domainElement) {
          domainElement.textContent = this.extractDomainFromUrl(currentPropertyAnalysis.url);
        }
      }
      
      // Start progress timer
      this.startProgressTimer();
    }
    
    // Also update the properties tab to show pending status
    this.updatePendingAnalysisInProperties();
  }

  startProgressTimer() {
    const timeElement = this.panel.querySelector('#re-progress-time');
    const etaElement = this.panel.querySelector('#re-progress-eta');
    
    if (!timeElement) return;
    
    let seconds = 0;
    const timer = setInterval(() => {
      seconds++;
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      timeElement.textContent = `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
      
      // Update ETA
      if (etaElement) {
        const estimatedTotal = 45; // 45 seconds average
        const remaining = Math.max(0, estimatedTotal - seconds);
        if (remaining > 0) {
          etaElement.textContent = `~${remaining}s remaining`;
        } else {
          etaElement.textContent = 'Finishing up...';
        }
      }
    }, 1000);
    
    // Store timer to clear it later
    this.progressTimer = timer;
  }

  hideAnalysisProgress() {
    const progressSection = this.panel.querySelector('#re-analysis-progress');
    if (progressSection) {
      progressSection.classList.add('re-hidden');
    }
    
    // Clear progress timer
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
  }

  truncateUrl(url, maxLength) {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength - 3) + '...';
  }
  
  updatePendingAnalysisInProperties() {
    // Add a pending property entry to the properties list
    if (currentPropertyAnalysis && currentPropertyAnalysis.url) {
      console.log('📊 Adding pending analysis indicator for:', currentPropertyAnalysis.url);
      
      // Create a temporary property object for the pending analysis
      const pendingProperty = {
        url: currentPropertyAnalysis.url,
        domain: this.extractDomainFromUrl(currentPropertyAnalysis.url),
        date: new Date().toLocaleDateString(),
        timestamp: Date.now(),
        isPending: true // Special flag for pending analysis
      };
      
      // Add to the properties display temporarily
      this.addPendingPropertyToDisplay(pendingProperty);
    }
  }
  
  extractDomainFromUrl(url) {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch (e) {
      return 'unknown';
    }
  }
  
  addPendingPropertyToDisplay(pendingProperty) {
    const propertiesList = this.panel.querySelector('#re-properties-list');
    if (!propertiesList) return;
    
    // Remove any existing pending entries for this URL
    const existingPending = propertiesList.querySelector(`[data-pending-url="${pendingProperty.url}"]`);
    if (existingPending) {
      existingPending.remove();
    }
    
    // Create pending property card
    const pendingCard = document.createElement('div');
    pendingCard.className = 're-property-card re-pending-analysis';
    pendingCard.setAttribute('data-pending-url', pendingProperty.url);
    pendingCard.innerHTML = `
      <div class="re-property-header">
        <div class="re-property-title">🔄 Analyzing Property...</div>
        <div class="re-property-status re-pending">
          <div class="re-analysis-spinner"></div>
        </div>
      </div>
      <div class="re-property-meta">
        <div class="re-property-domain">${this.getDomainDisplayName(pendingProperty.domain)}</div>
        <div>Started: ${pendingProperty.date}</div>
      </div>
      <div class="re-property-actions">
        <div class="re-progress-indicator">Analysis in progress...</div>
      </div>
    `;
    
    // Insert at the top of the list
    propertiesList.insertBefore(pendingCard, propertiesList.firstChild);
    
    // Hide empty state if showing
    this.hideChatGPTEmptyState();
  }
  
  removePendingPropertyFromDisplay(url) {
    const pendingElement = this.panel.querySelector(`[data-pending-url="${url}"]`);
    if (pendingElement) {
      pendingElement.remove();
      console.log('🗑️ Removed pending analysis indicator for:', url);
    }
  }
  
  // Method to be called when analysis is completed externally
  onAnalysisCompleted(propertyUrl) {
    console.log('🎉 Analysis completed notification received for:', propertyUrl);
    
    // Remove pending indicator
    this.removePendingPropertyFromDisplay(propertyUrl);
    
    // Trigger complete analysis workflow
    this.completeAnalysis();
    
    // Show success message specific to the completed property
    this.showChatGPTMessage('success', `✅ Analysis completed for property! Switch to Properties tab to view results.`);
  }

  hideAnalysisProgress() {
    const progressSection = this.panel.querySelector('#re-analysis-progress');
    if (progressSection) {
      progressSection.classList.add('re-hidden');
    }
    
    if (this.analysisTimer) {
      clearInterval(this.analysisTimer);
      this.analysisTimer = null;
    }
    
    // Remove pending analysis indicator
    if (currentPropertyAnalysis && currentPropertyAnalysis.url) {
      this.removePendingPropertyFromDisplay(currentPropertyAnalysis.url);
    }
  }

  updateAnalysisTimer() {
    const timeElement = this.panel.querySelector('#re-progress-time');
    if (timeElement && this.analysisStartTime) {
      const elapsed = Math.floor((Date.now() - this.analysisStartTime) / 1000);
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      timeElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
  }

  updateAnalysisStep(step, status) {
    const stepElement = this.panel.querySelector(`[data-step="${step}"]`);
    const stepIcon = stepElement?.querySelector('.re-step-icon');
    
    if (!stepElement || !stepIcon) return;
    
    // Remove previous status classes
    stepElement.classList.remove('re-active', 're-completed');
    
    switch (status) {
      case 'active':
        stepElement.classList.add('re-active');
        stepIcon.textContent = '⏳';
        break;
      case 'completed':
        stepElement.classList.add('re-completed');
        stepIcon.textContent = '✅';
        break;
      default:
        stepIcon.textContent = '⏳';
    }
  }

  completeAnalysis() {
    this.hideAnalysisProgress();
    
    // Show notification on FAB
    this.showFabNotification();
    
    // Update properties stats immediately
    this.updatePropertiesStats();
    
    // Reload property data to show the new analysis
    this.loadChatGPTPropertyData();
    
    // Auto-switch to properties tab if enabled
    if (uiSettings.autoShow) {
      setTimeout(() => {
        this.switchTab('properties');
        // Ensure properties are refreshed on the tab
        this.loadChatGPTPropertyData();
      }, 1000);
    }
    
    // Show success message
    this.showChatGPTMessage('success', '✅ Property analysis completed! Check the Properties tab.');
  }

  showFabNotification() {
    const notification = document.querySelector('#re-fab-notification');
    if (notification) {
      notification.classList.add('re-show');
      notification.textContent = '1';
    }
  }

  hideFabNotification() {
    const notification = document.querySelector('#re-fab-notification');
    if (notification) {
      notification.classList.remove('re-show');
    }
  }

  async loadPropertyData() {
    try {
      // Load property history from storage
      const result = await safeChromeFall(
        () => chrome.storage.local.get(['propertyHistory']),
        { propertyHistory: [] }
      );
      
      const properties = result.propertyHistory || [];
      console.log(`📚 Loaded ${properties.length} properties from storage`);
      
      // Count analyzed properties (those with analysis data)
      const analyzedCount = properties.filter(p => p.analysis && p.analysis.extractedData).length;
      
      // Get unique categories/domains
      const domains = [...new Set(properties.map(p => p.domain))];
      const categories = domains.length || 5; // Default to 5 categories
      
      // Update stats
      this.updatePropertiesStats(properties.length, analyzedCount, categories);
      
      // Show properties or empty state
      if (properties.length > 0) {
        this.displayProperties(properties);
        this.hideEmptyState();
      } else {
        this.showEmptyState();
      }
      
      // Update notifications
      this.updatePropertiesNotifications(properties);
      
    } catch (error) {
      console.error('❌ Failed to load property data:', error);
      this.updatePropertiesStats(0, 0, 5);
      this.showEmptyState();
    }
  }

  updatePropertiesStats(total, analyzed, categories) {
    const totalElement = this.panel.querySelector('#re-total-properties');
    const analyzedElement = this.panel.querySelector('#re-analyzed-count');
    const categoriesElement = this.panel.querySelector('#re-categories-count');
    
    // Add null checks before calling toString()
    if (totalElement) totalElement.textContent = (total || 0).toString();
    if (analyzedElement) analyzedElement.textContent = (analyzed || 0).toString();
    if (categoriesElement) categoriesElement.textContent = (categories || 0).toString();
  }

  showEmptyState() {
    const emptyState = this.panel.querySelector('#re-empty-state');
    const categoryView = this.panel.querySelector('#re-category-view');
    const listView = this.panel.querySelector('#re-list-view');
    
    if (emptyState) emptyState.style.display = 'block';
    if (categoryView) categoryView.style.display = 'none';
    if (listView) listView.style.display = 'none';
  }

  hideEmptyState() {
    const emptyState = this.panel.querySelector('#re-empty-state');
    if (emptyState) emptyState.style.display = 'none';
  }

  displayProperties(properties) {
    // Display properties in both category and list views
    this.displayCategoryView(properties);
    this.displayListView(properties);
  }

  displayCategoryView(properties) {
    const categoriesGrid = this.panel.querySelector('#re-categories-grid');
    if (!categoriesGrid) return;

    // Group properties by domain
    const groupedProperties = properties.reduce((groups, property) => {
      const domain = property.domain || 'unknown';
      if (!groups[domain]) {
        groups[domain] = [];
      }
      groups[domain].push(property);
      return groups;
    }, {});

    // Clear existing content
    categoriesGrid.innerHTML = '';

    // Create category cards
    Object.entries(groupedProperties).forEach(([domain, domainProperties]) => {
      const analyzedCount = domainProperties.filter(p => p.analysis && p.analysis.extractedData).length;
      
      const categoryCard = document.createElement('div');
      categoryCard.className = 're-category-card';
      categoryCard.innerHTML = `
        <div class="re-category-header">
          <h4>${this.getDomainDisplayName(domain)}</h4>
          <span class="re-category-count">${domainProperties.length}</span>
        </div>
        <div class="re-category-stats">
          <span class="re-analyzed">${analyzedCount} analyzed</span>
          <span class="re-pending">${domainProperties.length - analyzedCount} pending</span>
        </div>
        <div class="re-category-actions">
          <button class="re-btn re-btn-ghost re-btn-sm" onclick="embeddedUI.viewCategoryProperties('${domain}')">
            View All
          </button>
        </div>
      `;
      
      categoriesGrid.appendChild(categoryCard);
    });
  }

  displayListView(properties) {
    const propertiesList = this.panel.querySelector('#re-properties-list');
    if (!propertiesList) return;

    // Clear existing content
    propertiesList.innerHTML = '';

    // Sort properties by timestamp (newest first)
    const sortedProperties = [...properties].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    // Create property items
    sortedProperties.forEach(property => {
      const hasAnalysis = property.analysis && property.analysis.extractedData;
      const analysisDate = property.analysisTimestamp ? new Date(property.analysisTimestamp).toLocaleDateString() : '';
      
      const propertyItem = document.createElement('div');
      propertyItem.className = `re-property-item ${hasAnalysis ? 're-analyzed' : 're-pending'}`;
      const propertyInfo = this.getPropertyDisplayInfo(property);
      
      propertyItem.innerHTML = `
        <div class="re-property-content">
          <div class="re-property-header">
            <div class="re-property-main-info">
              <h5 class="re-property-title">${propertyInfo.title}</h5>
              ${propertyInfo.keyDetails ? `
                <div class="re-property-key-details">
                  ${propertyInfo.keyDetails}
                </div>
              ` : ''}
            </div>
            <span class="re-property-status ${hasAnalysis ? 're-status-analyzed' : 're-status-pending'}">
              ${hasAnalysis ? '✅ Analyzed' : '⏳ Pending'}
            </span>
          </div>
          <div class="re-property-details">
            <span class="re-property-domain">${this.getDomainDisplayName(property.domain)}</span>
            <span class="re-property-date">${property.date || 'Unknown date'}</span>
            ${hasAnalysis ? `<span class="re-analysis-date">Analyzed: ${analysisDate}</span>` : ''}
          </div>
          <div class="re-property-actions">
            <button class="re-btn re-btn-ghost re-btn-sm re-view-btn" data-property-url="${property.url}">
              View
            </button>
            ${hasAnalysis ? `
              <button class="re-btn re-btn-secondary re-btn-sm re-export-btn" data-property-url="${property.url}">
                📊 CSV
              </button>
            ` : `
              <button class="re-btn re-btn-primary re-btn-sm re-analyze-btn" data-property-url="${property.url}">
                Analyze
              </button>
            `}
            <button class="re-btn re-btn-danger re-btn-sm re-delete-btn" data-property-url="${property.url}" title="Delete property">
              🗑️
            </button>
          </div>
        </div>
      `;
      
      propertiesList.appendChild(propertyItem);
    });

    // Event listeners handled by global delegation
  }



  getDomainDisplayName(domain) {
    const domainNames = {
      'zillow.com': 'Zillow',
      'realtor.com': 'Realtor.com',
      'redfin.com': 'Redfin',
      'homes.com': 'Homes.com',
      'trulia.com': 'Trulia',
      'apartments.com': 'Apartments.com',
      'rent.com': 'Rent.com',
      'unknown': 'Other Sources'
    };
    
    return domainNames[domain] || domain.charAt(0).toUpperCase() + domain.slice(1);
  }

  getPropertyDisplayInfo(property) {
    const hasAnalysis = property.analysis && property.analysis.extractedData;
    let title = '';
    let keyDetails = '';

    if (hasAnalysis) {
      const data = property.analysis.extractedData;
      
      // Prioritize address, then bedrooms, then price
      if (data.address || data['Property Address'] || data['Street Name']) {
        title = data.address || data['Property Address'] || data['Street Name'];
      } else if (data.bedrooms || data['Number of Bedrooms'] || data['Bedrooms']) {
        const bedrooms = data.bedrooms || data['Number of Bedrooms'] || data['Bedrooms'];
        title = `${bedrooms} Bedroom Property`;
      } else if (data.price || data['Property Price'] || data['Asking Price']) {
        const price = data.price || data['Property Price'] || data['Asking Price'];
        title = `Property - ${price}`;
      } else {
        title = this.getPropertyTitle(property);
      }

      // Build key details string
      const details = [];
      
      // Add price if available
      const price = data.price || data['Property Price'] || data['Asking Price'];
      if (price) {
        details.push(`💰 ${price}`);
      }
      
      // Add bedrooms/bathrooms if available
      const bedrooms = data.bedrooms || data['Number of Bedrooms'] || data['Bedrooms'];
      const bathrooms = data.bathrooms || data['Bathrooms'];
      if (bedrooms) {
        if (bathrooms) {
          details.push(`🛏️ ${bedrooms}bd/${bathrooms}ba`);
        } else {
          details.push(`🛏️ ${bedrooms} bedrooms`);
        }
      }
      
      // Add square footage if available
      const sqft = data.squareFootage || data['Square Footage'] || data.sqft;
      if (sqft) {
        details.push(`📐 ${sqft} sq ft`);
      }

      keyDetails = details.join(' • ');
    } else {
      title = this.getPropertyTitle(property);
    }

    return { title, keyDetails };
  }

  getPropertyTitle(property) {
    // First priority: Check if we have extracted address and bedrooms data
    if (property.analysis && property.analysis.extractedData) {
      const data = property.analysis.extractedData;
      let title = '';
      
      // Use address if available
      if (data.address) {
        title = data.address;
      } else if (data.location) {
        title = data.location;
      } else if (data.neighborhood) {
        title = data.neighborhood;
      }
      
      // Add bedrooms if available
      if (data.bedrooms) {
        title += title ? ` • ${data.bedrooms} bed` : `${data.bedrooms} bed`;
      }
      
      // Add price if available and no address
      if (!data.address && data.price) {
        title = title ? `${title} • ${data.price}` : data.price;
      }
      
      if (title) {
        return title;
      }
    }
    
    // Fallback: Try to extract a title from the URL
    try {
      const url = new URL(property.url);
      const pathParts = url.pathname.split('/').filter(part => part);
      
      // Look for property-specific identifiers in the URL
      if (pathParts.length > 0) {
        const lastPart = pathParts[pathParts.length - 1];
        if (lastPart && lastPart.length > 5) {
          return lastPart.replace(/-/g, ' ').replace(/_/g, ' ');
        }
      }
      
      return `Property on ${property.domain}`;
    } catch (e) {
      return `Property #${property.url.slice(-8)}`;
    }
  }

  updatePropertiesNotifications(properties) {
    // Update tab notification for new properties
    const recentProperties = properties.filter(p => 
      (Date.now() - p.timestamp) < 24 * 60 * 60 * 1000 && // Within 24 hours
      (!p.analysis || !p.analysis.extractedData) // Not yet analyzed
    );
    
    const notification = this.panel.querySelector('#properties-notification');
    if (notification && recentProperties.length > 0) {
      notification.textContent = (recentProperties.length || 0).toString();
      notification.style.display = 'flex';
    } else if (notification) {
      notification.style.display = 'none';
    }
  }

  // Property action methods
  async viewProperty(url) {
    try {
      const result = await safeChromeFall(
        () => chrome.storage.local.get(['propertyHistory']),
        { propertyHistory: [] }
      );
      
      const properties = result.propertyHistory || [];
      const property = properties.find(p => p.url === url);
      
      if (!property) {
        this.showChatGPTMessage('error', 'Property not found in saved data');
        return;
      }
      
      if (!property.analysis) {
        this.showChatGPTMessage('warning', 'No analysis data found for this property. Click "Analyze" to generate analysis.');
        return;
      }
      
      if (!property.analysis.fullResponse && !property.analysis.fullAnalysis) {
        this.showChatGPTMessage('warning', 'No saved ChatGPT response found for this property. The analysis may not have completed properly. Try analyzing again.');
        return;
      }
      
      this.showAnalysisModal(property);
      
    } catch (error) {
      console.error('❌ Failed to load property analysis:', error);
      this.showChatGPTMessage('error', 'Failed to load saved analysis');
    }
  }

  showAnalysisModal(property) {
    // Remove existing modal if any
    const existingModal = document.querySelector('#re-analysis-modal');
    if (existingModal) {
      existingModal.remove();
    }
    
    // Create modal HTML
    const modal = document.createElement('div');
    modal.id = 're-analysis-modal';
    modal.className = 're-modal-overlay';
    
    const analysisData = property.analysis;
    const extractedData = analysisData.extractedData || {};
    
    // Format the analysis data for display
    const propertyDetails = this.formatPropertyDetails(extractedData);
    const analysisText = analysisData.fullResponse || analysisData.fullAnalysis || 'No full analysis text available';
    
    // Log analysis text length for verification
    console.log(`📏 Analysis text length: ${analysisText.length} characters`);
    
    modal.innerHTML = `
      <div class="re-modal">
        <div class="re-modal-header">
          <h3>Saved ChatGPT Analysis</h3>
          <button class="re-modal-close re-close-modal-btn">×</button>
        </div>
        
        <div class="re-modal-content">
          <!-- Property URL -->
          <div class="re-analysis-section">
            <h4>🔗 Property</h4>
            <a href="${property.url}" target="_blank" class="re-property-link">${property.url}</a>
          </div>
          
          <!-- Extracted Data -->
          ${propertyDetails ? `
            <div class="re-analysis-section">
              <h4>📊 Extracted Key Data</h4>
              <div class="re-property-grid">
                ${propertyDetails}
              </div>
            </div>
          ` : ''}
          
          <!-- Full Analysis -->
          <div class="re-analysis-section">
            <h4>🤖 Full ChatGPT Analysis</h4>
            <div class="re-analysis-text">
              ${analysisText === 'No full analysis text available' ? `
                <div class="re-modal-empty-state">
                  <div class="re-empty-icon">🤔</div>
                  <div class="re-empty-title">No ChatGPT Analysis Found</div>
                  <div class="re-empty-description">
                    The full ChatGPT response wasn't saved for this property.<br>
                    This can happen if the analysis was interrupted or if you're viewing an older property.
                  </div>
                  <div class="re-empty-help">
                    Try re-analyzing this property to get the full ChatGPT response.
                  </div>
                </div>
              ` : this.formatAnalysisText(analysisText)}
            </div>
          </div>
          
          <!-- Analysis Metadata -->
          <div class="re-analysis-section">
            <h4>📅 Analysis Details</h4>
            <div class="re-analysis-meta">
              <div><strong style="color: var(--re-text-primary);">Date:</strong> <span style="color: var(--re-text-secondary);">${property.date || 'Unknown'}</span></div>
              <div><strong style="color: var(--re-text-primary);">Domain:</strong> <span style="color: var(--re-text-secondary);">${property.domain || 'Unknown'}</span></div>
              <div><strong style="color: var(--re-text-primary);">Data Points:</strong> <span style="color: var(--re-text-secondary);">${Object.keys(extractedData).length}</span></div>
              <div><strong style="color: var(--re-text-primary);">Analysis Length:</strong> <span style="color: var(--re-text-secondary);">${analysisText.length} characters</span></div>
            </div>
          </div>
        </div>
        
        <div class="re-modal-footer">
          ${analysisText === 'No full analysis text available' ? `
            <button class="re-btn re-btn-primary re-reanalyze-btn" data-property-url="${property.url}">
              🔍 Re-analyze Property
            </button>
          ` : `
            <button class="re-btn re-btn-secondary re-copy-btn" data-property-url="${property.url}">
              📋 Copy Analysis
            </button>
          `}
          <button class="re-btn re-btn-secondary re-open-listing-btn" data-property-url="${property.url}">
            🔗 Open Original Listing
          </button>
          <button class="re-btn re-btn-primary re-close-modal-btn">
            Close
          </button>
        </div>
      </div>
    `;
    
    // Add modal styles if they don't exist
    this.addModalStyles();
    
    // Add modal to page
    document.body.appendChild(modal);
    
    // Fix any remaining contrast issues in the modal
    setTimeout(() => this.fixModalContrast(modal), 100);
    
    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  formatPropertyDetails(extractedData) {
    const details = [];
    
    // Key property details
    const fields = [
      { key: 'price', label: '💰 Price', format: (val) => val },
      { key: 'bedrooms', label: '🛏️ Bedrooms', format: (val) => val },
      { key: 'bathrooms', label: '🚿 Bathrooms', format: (val) => val },
      { key: 'squareFeet', label: '📐 Sq Ft', format: (val) => val },
      { key: 'yearBuilt', label: '🏗️ Year Built', format: (val) => val },
      { key: 'propertyType', label: '🏠 Type', format: (val) => val },
      { key: 'neighborhood', label: '📍 Neighborhood', format: (val) => val },
      { key: 'locationScore', label: '⭐ Location Score', format: (val) => val },
      { key: 'estimatedRentalIncome', label: '💵 Est. Rental Income', format: (val) => val }
    ];
    
    fields.forEach(field => {
      if (extractedData[field.key]) {
        details.push(`
          <div class="re-property-detail">
            <span class="re-detail-label">${field.label}</span>
            <span class="re-detail-value">${field.format(extractedData[field.key])}</span>
          </div>
        `);
      }
    });
    
    return details.join('');
  }

  formatAnalysisText(text) {
    // Basic formatting to make the analysis more readable with proper contrast
    const formatted = text
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/^/, '<p>')
      .replace(/$/, '</p>')
      .replace(/\*\*(.*?)\*\*/g, '<strong style="color: var(--re-text-primary); font-weight: 600;">$1</strong>') // Bold text with proper contrast
      .replace(/\*(.*?)\*/g, '<em style="color: var(--re-text-primary);">$1</em>'); // Italic text with proper contrast
    
    return `<div style="color: var(--re-text-primary); line-height: 1.6;">${formatted}</div>`;
  }

  addModalStyles() {
    // Check if styles already exist
    if (document.querySelector('#re-modal-styles')) {
      return;
    }
    
    const styles = document.createElement('style');
    styles.id = 're-modal-styles';
    styles.textContent = `
      .re-modal-overlay {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        background: rgba(0, 0, 0, 0.5) !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        z-index: 2147483647 !important;
        padding: 20px !important;
        visibility: visible !important;
        opacity: 1 !important;
      }
      
      .re-modal {
        background: var(--re-background) !important;
        border-radius: 12px !important;
        max-width: 800px !important;
        max-height: 90vh !important;
        width: 100% !important;
        overflow: hidden !important;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3) !important;
        display: flex !important;
        flex-direction: column !important;
        position: relative !important;
        z-index: 1 !important;
        color: var(--re-text-primary) !important;
        border: 1px solid var(--re-border) !important;
      }
      
      .re-modal-header {
        padding: 20px;
        border-bottom: 1px solid var(--re-border-light);
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: var(--re-background-secondary);
      }
      
      .re-modal-header h3 {
        margin: 0;
        font-size: 18px;
        color: var(--re-text-primary) !important;
        font-weight: 600;
      }
      
      .re-modal-close {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: var(--re-text-secondary) !important;
        padding: 0;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        transition: background 0.2s;
      }
      
      .re-modal-close:hover {
        background: var(--re-background-secondary);
        color: var(--re-text-primary) !important;
      }
      
      .re-modal-content {
        padding: 20px;
        overflow-y: auto;
        flex: 1;
        max-height: 70vh;
        color: var(--re-text-primary) !important;
        background: var(--re-background);
      }
      
      .re-analysis-section {
        margin-bottom: 24px;
      }
      
      .re-analysis-section h4 {
        margin: 0 0 12px 0;
        font-size: 16px;
        color: var(--re-text-primary) !important;
        border-bottom: 2px solid var(--re-primary);
        padding-bottom: 4px;
        font-weight: 600;
      }
      
      .re-property-link {
        color: var(--re-primary) !important;
        text-decoration: none;
        word-break: break-all;
        font-size: 14px;
      }
      
      .re-property-link:hover {
        text-decoration: underline;
      }
      
      .re-property-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 12px;
      }
      
      .re-property-detail {
        background: var(--re-background-secondary);
        padding: 12px;
        border-radius: 8px;
        display: flex;
        flex-direction: column;
        gap: 4px;
        border: 1px solid var(--re-border-light);
      }
      
      .re-detail-label {
        font-size: 12px;
        color: var(--re-text-secondary) !important;
        font-weight: 500;
      }
      
      .re-detail-value {
        font-size: 14px;
        color: var(--re-text-primary) !important;
        font-weight: 600;
      }
      
      .re-analysis-text {
        background: var(--re-background-secondary);
        border-radius: 8px;
        padding: 16px;
        font-size: 14px;
        line-height: 1.6;
        color: var(--re-text-primary) !important;
        white-space: pre-wrap;
        border: 1px solid var(--re-border-light);
      }
      
      .re-analysis-text p {
        margin: 0 0 12px 0;
      }
      
      .re-analysis-text p:last-child {
        margin-bottom: 0;
      }
      
      .re-analysis-meta {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 8px;
        font-size: 14px;
        color: var(--re-text-secondary) !important;
      }
      
      .re-modal-footer {
        padding: 20px;
        border-top: 1px solid var(--re-border-light);
        display: flex;
        gap: 12px;
        justify-content: flex-end;
        background: var(--re-background-secondary);
      }
      
      @media (max-width: 768px) {
        .re-modal {
          margin: 10px;
          max-height: 95vh;
        }
        
        .re-property-grid {
          grid-template-columns: 1fr;
        }
        
        .re-modal-footer {
          flex-direction: column;
        }
      }
      
      /* Modal empty state styling */
      .re-modal-empty-state {
        text-align: center;
        padding: 40px;
        color: var(--re-text-primary);
      }
      
      .re-empty-icon {
        font-size: 48px;
        margin-bottom: 16px;
      }
      
      .re-empty-title {
        font-size: 16px;
        font-weight: 500;
        margin-bottom: 8px;
        color: var(--re-text-primary) !important;
      }
      
      .re-empty-description {
        font-size: 14px;
        line-height: 1.4;
        margin-bottom: 20px;
        color: var(--re-text-secondary) !important;
      }
      
      .re-empty-help {
        font-size: 13px;
        color: var(--re-text-muted) !important;
      }
      
      /* Force proper contrast for all modal text */
      .re-modal * {
        color: var(--re-text-primary);
      }
      
      .re-modal .re-detail-label,
      .re-modal .re-analysis-meta,
      .re-modal .re-empty-description {
        color: var(--re-text-secondary) !important;
      }
      
      .re-modal .re-empty-help {
        color: var(--re-text-muted) !important;
      }
      
      /* Dark mode support for modal */
      @media (prefers-color-scheme: dark) {
        .re-modal {
          background: var(--re-background) !important;
          color: var(--re-text-primary) !important;
          border-color: var(--re-border) !important;
        }
        
        .re-modal-header {
          background: var(--re-background-secondary) !important;
          border-bottom-color: var(--re-border-light) !important;
        }
        
        .re-modal-footer {
          background: var(--re-background-secondary) !important;
          border-top-color: var(--re-border-light) !important;
        }
        
        .re-property-detail {
          background: var(--re-background-secondary) !important;
          border-color: var(--re-border-light) !important;
        }
        
        .re-analysis-text {
          background: var(--re-background-secondary) !important;
          border-color: var(--re-border-light) !important;
        }
      }
      
      /* Ensure proper button contrast in modal */
      .re-modal .re-btn {
        color: inherit;
      }
      
      .re-modal .re-btn-primary {
        color: var(--re-text-on-primary) !important;
        background: var(--re-primary) !important;
      }
      
      .re-modal .re-btn-secondary {
        color: var(--re-text-primary) !important;
        background: var(--re-background-secondary) !important;
        border-color: var(--re-border) !important;
      }
      
      .re-modal .re-btn-ghost {
        color: var(--re-text-secondary) !important;
      }
    `;
    
    document.head.appendChild(styles);
  }

  async debugSavedAnalyses() {
    try {
      this.showChatGPTMessage('info', 'Debugging saved analysis data. Check console for detailed information.');
      
      const result = await safeChromeFall(
        () => chrome.storage.local.get(['propertyHistory']),
        { propertyHistory: [] }
      );
      
      const properties = result.propertyHistory || [];
      
      console.log('🔍 =================================');
      console.log('🔍 DEBUGGING SAVED ANALYSIS DATA');
      console.log('🔍 =================================');
      console.log('📊 Total properties in storage:', properties.length);
      
      if (properties.length === 0) {
        console.log('❌ No properties found in storage');
        return;
      }
      
      properties.forEach((property, index) => {
        console.log(`\n🏠 Property ${index + 1}:`);
        console.log('  📍 URL:', property.url);
        console.log('  📅 Date:', property.date);
        console.log('  🌐 Domain:', property.domain);
        console.log('  📊 Has analysis object:', !!property.analysis);
        
        if (property.analysis) {
          console.log('  🔍 Analysis keys:', Object.keys(property.analysis));
          console.log('  📄 Has fullResponse:', !!property.analysis.fullResponse);
          console.log('  📏 fullResponse length:', property.analysis.fullResponse?.length || 0);
          console.log('  📄 Has fullAnalysis:', !!property.analysis.fullAnalysis);
          console.log('  📏 fullAnalysis length:', property.analysis.fullAnalysis?.length || 0);
          console.log('  📊 Extracted data keys:', Object.keys(property.analysis.extractedData || {}));
          console.log('  📄 fullResponse preview:', property.analysis.fullResponse?.substring(0, 200) || 'No fullResponse');
          console.log('  📄 fullAnalysis preview:', property.analysis.fullAnalysis?.substring(0, 200) || 'No fullAnalysis');
        } else {
          console.log('  ❌ No analysis data');
        }
      });
      
      console.log('\n🔍 =================================');
      console.log('🔍 END DEBUG INFO');
      console.log('🔍 =================================');
      
    } catch (error) {
      console.error('❌ Failed to debug saved analyses:', error);
      this.showChatGPTMessage('error', 'Failed to load saved analysis data for debugging');
    }
  }

  async copyAnalysisToClipboard(url) {
    try {
      // Load property data
      const result = await safeChromeFall(
        () => chrome.storage.local.get(['propertyHistory']),
        { propertyHistory: [] }
      );
      
      const properties = result.propertyHistory || [];
      const property = properties.find(p => p.url === url);
      
      if (property && property.analysis) {
        const analysisText = property.analysis.fullResponse || property.analysis.fullAnalysis || 'No analysis available';
        await navigator.clipboard.writeText(analysisText);
        this.showChatGPTMessage('success', 'Analysis copied to clipboard!');
      }
    } catch (error) {
      console.error('❌ Failed to copy analysis:', error);
      this.showChatGPTMessage('error', 'Failed to copy analysis to clipboard');
    }
  }

  viewCategoryProperties(domain) {
    console.log('📁 View category:', domain);
    // Switch to list view and filter by domain
    this.switchPropertiesView('list');
    // TODO: Implement domain filtering
  }

  async analyzeExistingProperty(url) {
    console.log('🔄 Re-analyze property:', url);
    // Switch to analyzer tab and pre-fill the URL
    this.switchTab('analyzer');
    
    const propertyUrlInput = this.panel.querySelector('#re-property-url');
    if (propertyUrlInput) {
      propertyUrlInput.value = url;
      this.showManualInput();
      this.validatePropertyInput();
    }
  }

  async reAnalyzeProperty(url) {
    console.log('🔄 Re-analyzing property from modal:', url);
    // Use the existing analyzeExistingProperty function and auto-start analysis
    await this.analyzeExistingProperty(url);
    
    // Show message
    this.showChatGPTMessage('info', 'Starting fresh analysis...');
    
    // Auto-start analysis after a short delay
    setTimeout(() => {
      const analyzeBtn = this.panel.querySelector('#re-analyze-btn');
      if (analyzeBtn && this.isValidPropertyLink(url)) {
        analyzeBtn.click();
      }
    }, 1000);
  }

  async exportProperty(url) {
    console.log('📊 Export property to CSV:', url);
    
    try {
      // Load property data
      const result = await safeChromeFall(
        () => chrome.storage.local.get(['propertyHistory']),
        { propertyHistory: [] }
      );
      
      const properties = result.propertyHistory || [];
      const property = properties.find(p => p.url === url);
      
      if (!property) {
        this.showChatGPTMessage('error', 'Property not found');
        return;
      }
      
      if (!property.analysis || !property.analysis.extractedData) {
        this.showChatGPTMessage('warning', 'No analysis data to export. Please analyze this property first.');
        return;
      }
      
      // Create CSV headers
      const headers = [
        'Property URL',
        'Domain',
        'Analysis Date',
        'Address',
        'Price',
        'Bedrooms',
        'Bathrooms',
        'Square Feet',
        'Property Type',
        'Year Built',
        'Neighborhood',
        'Location Score',
        'Estimated Rental Income',
        'Investment Grade',
        'Key Advantages',
        'Key Concerns'
      ];
      
      const data = property.analysis.extractedData || {};
      
      // Create single property row
      const row = [
        property.url || '',
        property.domain || '',
        property.date || '',
        data.address || data['Property Address'] || data['Street Name'] || '',
        data.price || data['Property Price'] || data['Asking Price'] || '',
        data.bedrooms || data['Number of Bedrooms'] || data['Bedrooms'] || '',
        data.bathrooms || data['Bathrooms'] || '',
        data.squareFootage || data['Square Footage'] || data.sqft || '',
        data.propertyType || data['Type of Property'] || data['Property Type'] || '',
        data.yearBuilt || data['Year Built'] || '',
        data.neighborhood || data['Neighborhood'] || '',
        data.locationScore || data['Location Score'] || '',
        data.estimatedRentalIncome || data['Estimated Monthly Rent'] || '',
        data.investmentGrade || data['Investment Grade'] || '',
        data.pros || data['Key Advantages'] || '',
        data.cons || data['Key Concerns'] || ''
      ];
      
      // Escape CSV values that contain commas or quotes
      const escapedRow = row.map(value => {
        const strValue = String(value || '');
        if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
          return `"${strValue.replace(/"/g, '""')}"`;
        }
        return strValue;
      });
      
      // Create CSV content with headers and single row
      const csvContent = [headers, escapedRow].map(row => row.join(',')).join('\n');
      
      // Create and download file
      const dataBlob = new Blob([csvContent], {type: 'text/csv;charset=utf-8;'});
      
      // Generate filename from property data
      const domain = property.domain?.replace(/\./g, '-') || 'property';
      const date = new Date().toISOString().split('T')[0];
      
      const link = document.createElement('a');
      link.href = URL.createObjectURL(dataBlob);
      link.download = `property-${domain}-${date}.csv`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      this.showChatGPTMessage('success', 'Property exported to CSV successfully!');
      
    } catch (error) {
      console.error('❌ Failed to export property:', error);
      this.showChatGPTMessage('error', 'Failed to export property to CSV');
    }
  }

  switchPropertiesView(view) {
    const viewButtons = this.panel.querySelectorAll('.re-view-btn');
    const categoryView = this.panel.querySelector('#re-category-view');
    const listView = this.panel.querySelector('#re-list-view');
    
    // Update button states
    viewButtons.forEach(btn => {
      if (btn.getAttribute('data-view') === view) {
        btn.classList.add('re-view-active');
      } else {
        btn.classList.remove('re-view-active');
      }
    });
    
    // Update view visibility
    if (view === 'category') {
      if (categoryView) categoryView.classList.add('re-view-active');
      if (listView) listView.classList.remove('re-view-active');
    } else {
      if (listView) listView.classList.add('re-view-active');
      if (categoryView) categoryView.classList.remove('re-view-active');
    }
  }

  updatePanelPosition(position) {
    if (!this.panel) return;
    
    // Remove old position classes (not needed for ChatGPT-style sidebar)
    this.panel.classList.remove('re-panel-right', 're-panel-left', 're-panel-bottom');
    
    // For ChatGPT-style sidebar, position is mainly handled by CSS
    // Just update the setting
    uiSettings.position = position;
    
    // Only save settings if the extension context is valid, otherwise just update locally
    if (isExtensionContextValid()) {
      this.saveSettings();
    } else {
      // Store in localStorage as fallback
      localStorage.setItem('reAnalyzerSettings', JSON.stringify(uiSettings));
      console.log('💾 Position updated in local cache:', position);
    }
  }

  toggleCompactMode(enabled) {
    if (enabled) {
      document.body.classList.add('re-compact-mode');
    } else {
      document.body.classList.remove('re-compact-mode');
    }
    
    uiSettings.compactMode = enabled;
    this.saveSettings();
  }

  async saveSettings() {
    try {
      const result = await safeChromeFall(
        () => chrome.storage.local.set({ embeddedUISettings: uiSettings }),
        null
      );
      
      if (result !== null) {
        this.showChatGPTMessage('success', 'Settings saved successfully!');
        console.log('💾 Settings saved:', uiSettings);
      } else {
        console.log('💾 Settings saved to local cache (extension context invalidated)');
        // Store settings in localStorage as fallback
        localStorage.setItem('reAnalyzerSettings', JSON.stringify(uiSettings));
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      this.showChatGPTMessage('error', 'Failed to save settings');
    }
  }
  
  setupCustomPromptEvents() {
    const customPromptTextarea = this.panel.querySelector('#re-custom-prompt');
    const savePromptBtn = this.panel.querySelector('#re-save-prompt');
    const resetPromptBtn = this.panel.querySelector('#re-reset-prompt');
    const previewPromptBtn = this.panel.querySelector('#re-preview-prompt');
    const promptTypeSelect = this.panel.querySelector('#re-prompt-type-select');
    const customPromptGroup = this.panel.querySelector('#re-custom-prompt-group');
    const promptDescContent = this.panel.querySelector('#re-prompt-desc-content');
    
    // Load existing settings
    this.loadPromptSettings();
    
    // Prompt type selection handler
    if (promptTypeSelect) {
      promptTypeSelect.addEventListener('change', (e) => {
        this.handlePromptTypeChange(e.target.value);
      });
    }
    
    if (savePromptBtn) {
      savePromptBtn.addEventListener('click', () => this.savePromptSettings());
    }
    
    if (resetPromptBtn) {
      resetPromptBtn.addEventListener('click', () => this.resetPromptSettings());
    }
    
    if (previewPromptBtn) {
      previewPromptBtn.addEventListener('click', () => this.previewPrompt());
    }
    
    // Setup simplified prompt editor events
    this.setupSimplifiedPromptEvents();
    
    // Column configuration event listeners
    this.setupColumnConfigurationEvents();
  }
  
  async loadPromptSettings() {
    try {
      const result = await safeChromeFall(
        () => chrome.storage.local.get(['customPrompt', 'promptType']),
        { customPrompt: null, promptType: 'default' }
      );
      
      const promptTypeSelect = this.panel.querySelector('#re-prompt-type-select');
      const customPromptTextarea = this.panel.querySelector('#re-custom-prompt');
      
      // Set prompt type
      if (promptTypeSelect) {
        promptTypeSelect.value = result.promptType || 'default';
      }
      
      // Set custom prompt content
      if (customPromptTextarea && result.customPrompt) {
        customPromptTextarea.value = result.customPrompt;
      }
      
      // Update UI based on prompt type
      this.handlePromptTypeChange(result.promptType || 'default');
      
    } catch (error) {
      console.error('Failed to load prompt settings:', error);
    }
  }

  handlePromptTypeChange(promptType) {
    const customPromptGroup = this.panel.querySelector('#re-custom-prompt-group');
    const promptDescContent = this.panel.querySelector('#re-prompt-desc-content');
    const tabularColumnsSection = this.panel.querySelector('#re-tabular-columns-section');
    
    // Show/hide custom prompt textarea
    if (customPromptGroup) {
      customPromptGroup.style.display = promptType === 'custom' ? 'block' : 'none';
    }
    
    // Show/hide tabular columns configuration
    if (tabularColumnsSection) {
      tabularColumnsSection.style.display = promptType === 'tabular' ? 'block' : 'none';
      
      // Load columns when tabular is selected
      if (promptType === 'tabular') {
        this.loadTabularColumns();
      }
    }
    
    // Update description
    if (promptDescContent) {
      const descriptions = {
        'default': 'Standard real estate investment analysis with basic property data extraction',
        'dynamic': 'Adaptive prompt that generates based on your selected column configuration',
        'tabular': 'Comprehensive data extraction with customizable data points for detailed spreadsheet analysis',
        'custom': 'Use your own custom prompt template with full control over analysis structure'
      };
      
      promptDescContent.textContent = descriptions[promptType] || descriptions.default;
    }
  }

  async loadCustomPrompt() {
    // This method is kept for backward compatibility
    await this.loadPromptSettings();
  }
  
  async savePromptSettings() {
    try {
      const promptTypeSelect = this.panel.querySelector('#re-prompt-type-select');
      const customPromptTextarea = this.panel.querySelector('#re-custom-prompt');
      
      const promptType = promptTypeSelect ? promptTypeSelect.value : 'default';
      const customPrompt = customPromptTextarea ? customPromptTextarea.value.trim() : null;
      
      await safeChromeFall(
        () => chrome.storage.local.set({ 
          promptType: promptType,
          customPrompt: customPrompt || null 
        }),
        null
      );
      
      this.showChatGPTMessage('success', 'Prompt settings saved successfully!');
      console.log('💾 Prompt settings saved:', { promptType, hasCustomPrompt: !!customPrompt });
    } catch (error) {
      console.error('Failed to save prompt settings:', error);
      this.showChatGPTMessage('error', 'Failed to save prompt settings');
    }
  }

  async saveCustomPrompt() {
    // This method is kept for backward compatibility
    await this.savePromptSettings();
  }
  
  async resetPromptSettings() {
    if (confirm('Are you sure you want to reset all prompt settings to default?')) {
      try {
        await safeChromeFall(
          () => chrome.storage.local.remove(['customPrompt', 'promptType']),
          null
        );
        
        const promptTypeSelect = this.panel.querySelector('#re-prompt-type-select');
        const customPromptTextarea = this.panel.querySelector('#re-custom-prompt');
        
        if (promptTypeSelect) {
          promptTypeSelect.value = 'default';
        }
        
        if (customPromptTextarea) {
          customPromptTextarea.value = '';
        }
        
        this.handlePromptTypeChange('default');
        
        this.showChatGPTMessage('success', 'Prompt settings reset to default');
        console.log('🔄 Prompt settings reset');
      } catch (error) {
        console.error('Failed to reset prompt settings:', error);
        this.showChatGPTMessage('error', 'Failed to reset prompt settings');
      }
    }
  }

  async resetCustomPrompt() {
    // This method is kept for backward compatibility
    await this.resetPromptSettings();
  }
  
  async previewPrompt() {
    try {
      const promptTypeSelect = this.panel.querySelector('#re-prompt-type-select');
      const customPromptTextarea = this.panel.querySelector('#re-custom-prompt');
      
      const promptType = promptTypeSelect ? promptTypeSelect.value : 'default';
      const customPrompt = customPromptTextarea ? customPromptTextarea.value.trim() : null;
      
      // Get the actual prompt that would be used
      const promptTemplate = await getSelectedPrompt(promptType, customPrompt, null);
      
      if (!promptTemplate) {
        this.showChatGPTMessage('warning', 'No prompt to preview');
        return;
      }
      
      // Show preview with example data
      const exampleUrl = 'https://www.zillow.com/homedetails/123-Main-St-Anytown-CA-12345/123456789_zpid/';
      const previewText = promptTemplate
        .replace('{PROPERTY_URL}', exampleUrl)
        .replace('{DATE}', new Date().toLocaleDateString());
      
      // Create and show preview modal with prompt type info
      this.showPromptPreviewModal(previewText, promptType);
    } catch (error) {
      console.error('Failed to preview prompt:', error);
      this.showChatGPTMessage('error', 'Failed to generate prompt preview');
    }
  }

  previewCustomPrompt() {
    // This method is kept for backward compatibility
    this.previewPrompt();
  }

  // Simplified Prompt Configuration Events
  setupSimplifiedPromptEvents() {
    // Advanced prompt editor toggles
    const editDefaultBtn = this.panel.querySelector('#re-edit-default-prompt');
    const editDynamicBtn = this.panel.querySelector('#re-edit-dynamic-prompt');
    const defaultEditor = this.panel.querySelector('#re-default-editor');
    const dynamicEditor = this.panel.querySelector('#re-dynamic-editor');
    
    if (editDefaultBtn) {
      editDefaultBtn.addEventListener('click', () => {
        const isVisible = defaultEditor.style.display !== 'none';
        defaultEditor.style.display = isVisible ? 'none' : 'block';
        editDefaultBtn.textContent = isVisible ? '📄 Edit Default' : '📄 Hide Editor';
        
        if (!isVisible) {
          this.loadDefaultPrompt();
          // Hide other editors
          if (dynamicEditor) {
            dynamicEditor.style.display = 'none';
            if (editDynamicBtn) editDynamicBtn.textContent = '🔄 Edit Dynamic';
          }
        }
      });
    }
    
    if (editDynamicBtn) {
      editDynamicBtn.addEventListener('click', () => {
        const isVisible = dynamicEditor.style.display !== 'none';
        dynamicEditor.style.display = isVisible ? 'none' : 'block';
        editDynamicBtn.textContent = isVisible ? '🔄 Edit Dynamic' : '🔄 Hide Editor';
        
        if (!isVisible) {
          this.loadDynamicPrompt();
          // Hide other editors
          if (defaultEditor) {
            defaultEditor.style.display = 'none';
            if (editDefaultBtn) editDefaultBtn.textContent = '📄 Edit Default';
          }
        }
      });
    }
    
    // Update existing button event handlers to use correct IDs
    const savePromptBtn = this.panel.querySelector('#re-save-prompt-selection');
    if (savePromptBtn) {
      savePromptBtn.addEventListener('click', () => this.savePromptSettings());
    }
  }

  // Settings Navigation Management
  setupSettingsNavigation() {
    // Main settings navigation
    const navButtons = this.panel.querySelectorAll('.re-settings-nav-btn');
    const contentSections = this.panel.querySelectorAll('.re-settings-content');
    
    navButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetSection = btn.dataset.section;
        
        // Update navigation buttons
        navButtons.forEach(b => {
          b.classList.remove('re-settings-nav-active');
          b.style.background = 'transparent';
          b.style.boxShadow = 'none';
        });
        
        btn.classList.add('re-settings-nav-active');
        btn.style.background = 'var(--chatgpt-surface-primary)';
        btn.style.boxShadow = '0 1px 2px rgba(0,0,0,0.1)';
        
        // Show/hide content sections
        contentSections.forEach(section => {
          section.style.display = 'none';
        });
        
        const targetContent = this.panel.querySelector(`#re-${targetSection}-settings`);
        if (targetContent) {
          targetContent.style.display = 'block';
          
          // Load content when switching sections
          if (targetSection === 'prompts') {
            this.loadPromptSettings();
            this.updatePromptTypeUI();
          } else if (targetSection === 'basic') {
            this.updateConfigurationSummary();
          }
        }
      });
    });
    
    // Prompt type radio buttons
    const promptOptions = this.panel.querySelectorAll('.re-prompt-option');
    promptOptions.forEach(option => {
      option.addEventListener('click', () => {
        // Update radio button states
        promptOptions.forEach(opt => {
          opt.style.borderColor = 'var(--chatgpt-border-light)';
          opt.style.background = 'var(--chatgpt-surface-primary)';
          const radio = opt.querySelector('input[type="radio"]');
          if (radio) radio.checked = false;
        });
        
        option.style.borderColor = 'var(--chatgpt-accent)';
        option.style.background = 'var(--chatgpt-hover-bg)';
        const radio = option.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;
        
        // Update prompt type selector
        const promptType = option.dataset.type;
        const quickSelector = this.panel.querySelector('#re-quick-prompt-type');
        if (quickSelector) {
          quickSelector.value = promptType;
        }
      });
    });
    
    // Prompt customization tabs
    const customizeBtns = this.panel.querySelectorAll('.re-customize-btn');
    const customizeContents = this.panel.querySelectorAll('.re-customize-content');
    
    customizeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetCustomize = btn.dataset.customize;
        
        // Update customize buttons
        customizeBtns.forEach(b => {
          b.classList.remove('re-customize-active');
          b.style.background = 'transparent';
        });
        
        btn.classList.add('re-customize-active');
        btn.style.background = 'var(--chatgpt-surface-primary)';
        
        // Show/hide customize content
        customizeContents.forEach(content => {
          content.style.display = 'none';
        });
        
        const targetContent = this.panel.querySelector(`#re-customize-${targetCustomize}`);
        if (targetContent) {
          targetContent.style.display = 'block';
          
          // Load content when switching to customization tabs
          if (targetCustomize === 'default') {
            this.loadDefaultPrompt();
          } else if (targetCustomize === 'dynamic') {
            this.loadDynamicPrompt();
          }
        }
      });
    });
    
    // Quick setup synchronization
    const quickPromptType = this.panel.querySelector('#re-quick-prompt-type');
    if (quickPromptType) {
      quickPromptType.addEventListener('change', () => {
        const selectedType = quickPromptType.value;
        
        // Update prompt option selection
        promptOptions.forEach(option => {
          option.style.borderColor = 'var(--chatgpt-border-light)';
          option.style.background = 'var(--chatgpt-surface-primary)';
          const radio = option.querySelector('input[type="radio"]');
          if (radio) radio.checked = false;
        });
        
        const matchingOption = this.panel.querySelector(`.re-prompt-option[data-type="${selectedType}"]`);
        if (matchingOption) {
          matchingOption.style.borderColor = 'var(--chatgpt-accent)';
          matchingOption.style.background = 'var(--chatgpt-hover-bg)';
          const radio = matchingOption.querySelector('input[type="radio"]');
          if (radio) radio.checked = true;
        }
      });
    }
  }

  updateConfigurationSummary() {
    // Update the current configuration display
    const promptTypeDisplay = this.panel.querySelector('#re-current-prompt-type');
    if (promptTypeDisplay) {
      // Get current prompt type from storage or UI
      const quickSelector = this.panel.querySelector('#re-quick-prompt-type');
      if (quickSelector) {
        const promptType = quickSelector.value;
        const typeNames = {
          'default': 'Standard Analysis',
          'tabular': 'Data Extraction',
          'dynamic': 'Custom Data Points'
        };
        promptTypeDisplay.textContent = typeNames[promptType] || 'Standard Analysis';
      }
    }
  }

  updatePromptTypeUI() {
    // Sync prompt type across different UI elements
    this.loadPromptSettings().then(() => {
      const promptTypeSelect = this.panel.querySelector('#re-prompt-type-select');
      const quickPromptType = this.panel.querySelector('#re-quick-prompt-type');
      
      if (promptTypeSelect && quickPromptType) {
        quickPromptType.value = promptTypeSelect.value;
        
        // Update radio buttons
        const promptOptions = this.panel.querySelectorAll('.re-prompt-option');
        promptOptions.forEach(option => {
          option.style.borderColor = 'var(--chatgpt-border-light)';
          option.style.background = 'var(--chatgpt-surface-primary)';
          const radio = option.querySelector('input[type="radio"]');
          if (radio) radio.checked = false;
        });
        
        const matchingOption = this.panel.querySelector(`.re-prompt-option[data-type="${promptTypeSelect.value}"]`);
        if (matchingOption) {
          matchingOption.style.borderColor = 'var(--chatgpt-accent)';
          matchingOption.style.background = 'var(--chatgpt-hover-bg)';
          const radio = matchingOption.querySelector('input[type="radio"]');
          if (radio) radio.checked = true;
        }
      }
      
      this.updateConfigurationSummary();
    });
  }

  // Enhanced Prompt Configuration Management
  setupPromptConfigurationEvents() {
    // Prompt configuration tab switching
    this.setupPromptTabs();
    
    // Default prompt management
    const saveDefaultBtn = this.panel.querySelector('#re-save-default-prompt');
    const resetDefaultBtn = this.panel.querySelector('#re-reset-default-prompt');
    const previewDefaultBtn = this.panel.querySelector('#re-preview-default-prompt');
    
    if (saveDefaultBtn) {
      saveDefaultBtn.addEventListener('click', () => this.saveDefaultPrompt());
    }
    
    if (resetDefaultBtn) {
      resetDefaultBtn.addEventListener('click', () => this.resetDefaultPrompt());
    }
    
    if (previewDefaultBtn) {
      previewDefaultBtn.addEventListener('click', () => this.previewDefaultPrompt());
    }
    
    // Dynamic prompt management
    const saveDynamicBtn = this.panel.querySelector('#re-save-dynamic-prompt');
    const resetDynamicBtn = this.panel.querySelector('#re-reset-dynamic-prompt');
    const previewDynamicBtn = this.panel.querySelector('#re-preview-dynamic-prompt');
    
    if (saveDynamicBtn) {
      saveDynamicBtn.addEventListener('click', () => this.saveDynamicPrompt());
    }
    
    if (resetDynamicBtn) {
      resetDynamicBtn.addEventListener('click', () => this.resetDynamicPrompt());
    }
    
    if (previewDynamicBtn) {
      previewDynamicBtn.addEventListener('click', () => this.previewDynamicPrompt());
    }
    
    // Prompt selection management
    const saveSelectionBtn = this.panel.querySelector('#re-save-prompt-selection');
    const previewCurrentBtn = this.panel.querySelector('#re-preview-current-prompt');
    
    if (saveSelectionBtn) {
      saveSelectionBtn.addEventListener('click', () => this.savePromptSettings());
    }
    
    if (previewCurrentBtn) {
      previewCurrentBtn.addEventListener('click', () => this.previewPrompt());
    }
    
    // Global prompt actions
    const saveAllPromptsBtn = this.panel.querySelector('#re-save-all-prompts');
    const resetAllPromptsBtn = this.panel.querySelector('#re-reset-all-prompts');
    const exportPromptsBtn = this.panel.querySelector('#re-export-prompts');
    const importPromptsBtn = this.panel.querySelector('#re-import-prompts');
    const gotoTabularBtn = this.panel.querySelector('#re-goto-tabular-config');
    
    if (saveAllPromptsBtn) {
      saveAllPromptsBtn.addEventListener('click', () => this.saveAllPrompts());
    }
    
    if (resetAllPromptsBtn) {
      resetAllPromptsBtn.addEventListener('click', () => this.resetAllPrompts());
    }
    
    if (exportPromptsBtn) {
      exportPromptsBtn.addEventListener('click', () => this.exportPrompts());
    }
    
    if (importPromptsBtn) {
      importPromptsBtn.addEventListener('click', () => this.importPrompts());
    }
    
    if (gotoTabularBtn) {
      gotoTabularBtn.addEventListener('click', () => this.scrollToTabularConfig());
    }
  }

  setupPromptTabs() {
    const tabs = this.panel.querySelectorAll('.re-prompt-tab');
    const tabContents = this.panel.querySelectorAll('.re-prompt-tab-content');
    
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetTab = tab.dataset.tab;
        
        // Update tab styles
        tabs.forEach(t => {
          t.classList.remove('re-prompt-tab-active');
          t.style.borderBottomColor = 'transparent';
          t.style.fontWeight = 'normal';
        });
        
        tab.classList.add('re-prompt-tab-active');
        tab.style.borderBottomColor = 'var(--chatgpt-accent)';
        tab.style.fontWeight = '500';
        
        // Show/hide content
        tabContents.forEach(content => {
          content.style.display = 'none';
        });
        
        const targetContent = this.panel.querySelector(`#re-prompt-${targetTab}-tab`);
        if (targetContent) {
          targetContent.style.display = 'block';
          
          // Load content when switching to tabs
          if (targetTab === 'default') {
            this.loadDefaultPrompt();
          } else if (targetTab === 'dynamic') {
            this.loadDynamicPrompt();
          }
        }
      });
    });
  }

  // Default Prompt Management
  async loadDefaultPrompt() {
    try {
      const result = await safeChromeFall(
        () => chrome.storage.local.get(['defaultPromptTemplate']),
        { defaultPromptTemplate: null }
      );
      
      const templateTextarea = this.panel.querySelector('#re-default-prompt-template');
      if (templateTextarea) {
        if (result.defaultPromptTemplate) {
          templateTextarea.value = result.defaultPromptTemplate;
        } else {
          // Load built-in default template
          templateTextarea.value = getDefaultPromptTemplate();
        }
      }
      
    } catch (error) {
      console.error('Failed to load default prompt:', error);
    }
  }

  async saveDefaultPrompt() {
    try {
      const templateTextarea = this.panel.querySelector('#re-default-prompt-template');
      if (!templateTextarea) return;
      
      const template = templateTextarea.value.trim();
      
      await safeChromeFall(
        () => chrome.storage.local.set({ defaultPromptTemplate: template || null }),
        null
      );
      
      this.showChatGPTMessage('success', 'Default prompt template saved successfully!');
      console.log('💾 Default prompt template saved');
      
    } catch (error) {
      console.error('Failed to save default prompt:', error);
      this.showChatGPTMessage('error', 'Failed to save default prompt template');
    }
  }

  async resetDefaultPrompt() {
    if (confirm('Are you sure you want to reset the default prompt template?')) {
      try {
        await safeChromeFall(
          () => chrome.storage.local.remove(['defaultPromptTemplate']),
          null
        );
        
        // Reload with built-in default
        this.loadDefaultPrompt();
        
        this.showChatGPTMessage('success', 'Default prompt template reset');
        console.log('🔄 Default prompt template reset');
        
      } catch (error) {
        console.error('Failed to reset default prompt:', error);
        this.showChatGPTMessage('error', 'Failed to reset default prompt template');
      }
    }
  }

  async previewDefaultPrompt() {
    try {
      const templateTextarea = this.panel.querySelector('#re-default-prompt-template');
      if (!templateTextarea) return;
      
      const template = templateTextarea.value.trim();
      if (!template) {
        this.showChatGPTMessage('warning', 'No template to preview');
        return;
      }
      
      // Replace template variables
      const previewText = template
        .replace(/\{PROPERTY_URL\}/g, 'https://www.zillow.com/homedetails/123-Main-St-Anytown-CA-12345/123456789_zpid/')
        .replace(/\{DATE\}/g, new Date().toLocaleDateString());
      
      // Show preview modal
      this.showPromptPreviewModal(previewText, 'default prompt');
      
    } catch (error) {
      console.error('Failed to preview default prompt:', error);
      this.showChatGPTMessage('error', 'Failed to preview default prompt');
    }
  }

  // Dynamic Prompt Management
  async loadDynamicPrompt() {
    try {
      const result = await safeChromeFall(
        () => chrome.storage.local.get(['dynamicPromptTemplate', 'dynamicPromptColumns']),
        { dynamicPromptTemplate: null, dynamicPromptColumns: null }
      );
      
      // Load template
      const templateTextarea = this.panel.querySelector('#re-dynamic-prompt-template');
      if (templateTextarea) {
        if (result.dynamicPromptTemplate) {
          templateTextarea.value = result.dynamicPromptTemplate;
        } else {
          // Load built-in dynamic template
          templateTextarea.value = getDefaultDynamicPromptTemplate();
        }
      }
      
      // Load and render column selection
      await this.loadDynamicColumnsSelection(result.dynamicPromptColumns);
      
    } catch (error) {
      console.error('Failed to load dynamic prompt:', error);
    }
  }

  async loadDynamicColumnsSelection(savedColumns) {
    try {
      const container = this.panel.querySelector('#re-dynamic-columns-container');
      if (!container) return;
      
      // Get all available columns
      const allColumns = getTabularDataColumns();
      const customColumns = await this.getCustomColumns();
      const availableColumns = [...allColumns, ...customColumns];
      
      // Create column checkboxes
      container.innerHTML = '';
      
      availableColumns.forEach(column => {
        const isEnabled = savedColumns ? 
          savedColumns.includes(column.id) : 
          column.enabled !== false; // Default to enabled unless explicitly disabled
        
        const columnDiv = document.createElement('div');
        columnDiv.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 4px; padding: 4px 8px; border-radius: 4px; transition: background-color 0.2s;';
        columnDiv.innerHTML = `
          <input type="checkbox" id="dynamic-col-${column.id}" ${isEnabled ? 'checked' : ''} 
                 style="margin: 0;" data-column-id="${column.id}">
          <label for="dynamic-col-${column.id}" style="flex: 1; font-size: 12px; cursor: pointer; margin: 0;">
            ${column.name}
            ${column.required ? '<span style="color: var(--chatgpt-accent); font-size: 10px;">[REQUIRED]</span>' : ''}
            ${column.isCalculated ? '<span style="color: var(--chatgpt-text-secondary); font-size: 10px;">[CALCULATED]</span>' : ''}
          </label>
        `;
        
        // Add hover effect
        columnDiv.addEventListener('mouseenter', () => {
          columnDiv.style.backgroundColor = 'var(--chatgpt-hover-bg)';
        });
        columnDiv.addEventListener('mouseleave', () => {
          columnDiv.style.backgroundColor = 'transparent';
        });
        
        container.appendChild(columnDiv);
      });
      
    } catch (error) {
      console.error('Failed to load dynamic columns selection:', error);
    }
  }

  async saveDynamicPrompt() {
    try {
      const templateTextarea = this.panel.querySelector('#re-dynamic-prompt-template');
      if (!templateTextarea) return;
      
      const template = templateTextarea.value.trim();
      
      // Get selected columns
      const selectedColumns = Array.from(this.panel.querySelectorAll('#re-dynamic-columns-container input[type="checkbox"]:checked'))
        .map(cb => cb.dataset.columnId);
      
      await safeChromeFall(
        () => chrome.storage.local.set({ 
          dynamicPromptTemplate: template || null,
          dynamicPromptColumns: selectedColumns
        }),
        null
      );
      
      this.showChatGPTMessage('success', 'Dynamic prompt configuration saved successfully!');
      console.log('💾 Dynamic prompt configuration saved');
      
    } catch (error) {
      console.error('Failed to save dynamic prompt:', error);
      this.showChatGPTMessage('error', 'Failed to save dynamic prompt configuration');
    }
  }

  async resetDynamicPrompt() {
    if (confirm('Are you sure you want to reset the dynamic prompt configuration?')) {
      try {
        await safeChromeFall(
          () => chrome.storage.local.remove(['dynamicPromptTemplate', 'dynamicPromptColumns']),
          null
        );
        
        // Reload with defaults
        this.loadDynamicPrompt();
        
        this.showChatGPTMessage('success', 'Dynamic prompt configuration reset');
        console.log('🔄 Dynamic prompt configuration reset');
        
      } catch (error) {
        console.error('Failed to reset dynamic prompt:', error);
        this.showChatGPTMessage('error', 'Failed to reset dynamic prompt configuration');
      }
    }
  }

  async previewDynamicPrompt() {
    try {
      const templateTextarea = this.panel.querySelector('#re-dynamic-prompt-template');
      if (!templateTextarea) return;
      
      const template = templateTextarea.value.trim();
      if (!template) {
        this.showChatGPTMessage('warning', 'No template to preview');
        return;
      }
      
      // Get selected columns
      const selectedColumns = Array.from(this.panel.querySelectorAll('#re-dynamic-columns-container input[type="checkbox"]:checked'))
        .map(cb => cb.dataset.columnId);
      
      // Generate columns section
      let columnsSection = 'No columns selected';
      if (selectedColumns.length > 0) {
        const allColumns = [...getTabularDataColumns(), ...await this.getCustomColumns()];
        const enabledColumns = allColumns.filter(col => selectedColumns.includes(col.id));
        columnsSection = generateColumnsSectionForPrompt(enabledColumns);
      }
      
      // Replace template variables
      const previewText = template
        .replace(/\{\{COLUMNS\}\}/g, columnsSection)
        .replace(/\{PROPERTY_URL\}/g, 'https://www.zillow.com/homedetails/123-Main-St-Anytown-CA-12345/123456789_zpid/')
        .replace(/\{DATE\}/g, new Date().toLocaleDateString());
      
      // Show preview modal
      this.showPromptPreviewModal(previewText, `dynamic prompt (${selectedColumns.length} columns)`);
      
    } catch (error) {
      console.error('Failed to preview dynamic prompt:', error);
      this.showChatGPTMessage('error', 'Failed to preview dynamic prompt');
    }
  }

  // Global Prompt Management
  async saveAllPrompts() {
    try {
      // Save all prompt configurations
      await this.saveDefaultPrompt();
      await this.saveDynamicPrompt();
      await this.saveTabularTemplate();
      await this.savePromptSettings();
      
      this.showChatGPTMessage('success', 'All prompt configurations saved successfully!');
      
    } catch (error) {
      console.error('Failed to save all prompts:', error);
      this.showChatGPTMessage('error', 'Failed to save all prompt configurations');
    }
  }

  async resetAllPrompts() {
    if (confirm('Are you sure you want to reset ALL prompt configurations to default?')) {
      try {
        await safeChromeFall(
          () => chrome.storage.local.remove([
            'defaultPromptTemplate',
            'dynamicPromptTemplate', 
            'dynamicPromptColumns',
            'tabularPromptTemplate',
            'customPrompt',
            'promptType'
          ]),
          null
        );
        
        // Reload all tabs
        this.loadDefaultPrompt();
        this.loadDynamicPrompt();
        this.loadTabularTemplate();
        this.loadPromptSettings();
        
        this.showChatGPTMessage('success', 'All prompt configurations reset to default');
        
      } catch (error) {
        console.error('Failed to reset all prompts:', error);
        this.showChatGPTMessage('error', 'Failed to reset all prompt configurations');
      }
    }
  }

  async exportPrompts() {
    try {
      // Get all prompt configurations
      const result = await safeChromeFall(
        () => chrome.storage.local.get([
          'defaultPromptTemplate',
          'dynamicPromptTemplate',
          'dynamicPromptColumns', 
          'tabularPromptTemplate',
          'customPrompt',
          'promptType',
          'customColumns',
          'tabularColumnConfiguration'
        ]),
        {}
      );
      
      const exportData = {
        exportDate: new Date().toISOString(),
        version: '2.0.0',
        prompts: result
      };
      
      // Create and download file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `re-analyzer-prompts-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      this.showChatGPTMessage('success', 'Prompt configurations exported successfully!');
      
    } catch (error) {
      console.error('Failed to export prompts:', error);
      this.showChatGPTMessage('error', 'Failed to export prompt configurations');
    }
  }

  async importPrompts() {
    try {
      // Create file input
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      
      input.onchange = async (event) => {
        try {
          const file = event.target.files[0];
          if (!file) return;
          
          const text = await file.text();
          const importData = JSON.parse(text);
          
          if (!importData.prompts) {
            throw new Error('Invalid prompt configuration file');
          }
          
          // Confirm import
          if (!confirm('This will overwrite your current prompt configurations. Continue?')) {
            return;
          }
          
          // Save imported data
          await safeChromeFall(
            () => chrome.storage.local.set(importData.prompts),
            null
          );
          
          // Reload all configurations
          this.loadDefaultPrompt();
          this.loadDynamicPrompt();
          this.loadTabularTemplate();
          this.loadPromptSettings();
          this.loadTabularColumns();
          this.loadCustomColumns();
          
          this.showChatGPTMessage('success', 'Prompt configurations imported successfully!');
          
        } catch (error) {
          console.error('Failed to import prompts:', error);
          this.showChatGPTMessage('error', 'Failed to import prompt configurations');
        }
      };
      
      input.click();
      
    } catch (error) {
      console.error('Failed to import prompts:', error);
      this.showChatGPTMessage('error', 'Failed to import prompt configurations');
    }
  }

  scrollToTabularConfig() {
    const tabularSection = this.panel.querySelector('#re-tabular-columns-section');
    if (tabularSection) {
      // Show the tabular section first
      tabularSection.style.display = 'block';
      
      // Scroll to it
      tabularSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      
      // Switch to settings tab if not already there
      this.switchTab('settings');
      
      this.showChatGPTMessage('success', 'Scrolled to Tabular Data Configuration');
    }
  }

  // Enhanced Tabular Configuration Methods
  setupColumnConfigurationEvents() {
    // Tab switching
    this.setupTabularTabs();
    
    // Column management (existing)
    const selectAllBtn = this.panel.querySelector('#re-columns-select-all');
    const clearAllBtn = this.panel.querySelector('#re-columns-clear-all');
    const selectDefaultsBtn = this.panel.querySelector('#re-columns-select-defaults');
    
    if (selectAllBtn) {
      selectAllBtn.addEventListener('click', () => this.selectAllColumns());
    }
    
    if (clearAllBtn) {
      clearAllBtn.addEventListener('click', () => this.clearAllColumns());
    }
    
    if (selectDefaultsBtn) {
      selectDefaultsBtn.addEventListener('click', () => this.selectDefaultColumns());
    }
    
    // Prompt template management
    const saveTemplateBtn = this.panel.querySelector('#re-save-tabular-template');
    const resetTemplateBtn = this.panel.querySelector('#re-reset-tabular-template');
    const previewTemplateBtn = this.panel.querySelector('#re-preview-tabular-template');
    
    if (saveTemplateBtn) {
      saveTemplateBtn.addEventListener('click', () => this.saveTabularTemplate());
    }
    
    if (resetTemplateBtn) {
      resetTemplateBtn.addEventListener('click', () => this.resetTabularTemplate());
    }
    
    if (previewTemplateBtn) {
      previewTemplateBtn.addEventListener('click', () => this.previewTabularTemplate());
    }
    
    // Custom columns management
    const addColumnBtn = this.panel.querySelector('#re-add-custom-column');
    const saveCustomColumnBtn = this.panel.querySelector('#re-save-custom-column');
    const cancelCustomColumnBtn = this.panel.querySelector('#re-cancel-custom-column');
    
    if (addColumnBtn) {
      addColumnBtn.addEventListener('click', () => this.showAddColumnForm());
    }
    
    if (saveCustomColumnBtn) {
      saveCustomColumnBtn.addEventListener('click', () => this.saveCustomColumn());
    }
    
    if (cancelCustomColumnBtn) {
      cancelCustomColumnBtn.addEventListener('click', () => this.hideAddColumnForm());
    }
    
    // Global actions
    const saveAllBtn = this.panel.querySelector('#re-save-all-tabular');
    const resetAllBtn = this.panel.querySelector('#re-reset-all-tabular');
    const previewCompleteBtn = this.panel.querySelector('#re-preview-complete-tabular');
    
    if (saveAllBtn) {
      saveAllBtn.addEventListener('click', () => this.saveAllTabularConfiguration());
    }
    
    if (resetAllBtn) {
      resetAllBtn.addEventListener('click', () => this.resetAllTabularConfiguration());
    }
    
    if (previewCompleteBtn) {
      previewCompleteBtn.addEventListener('click', () => this.previewCompleteTabularConfiguration());
    }
  }

  setupTabularTabs() {
    const tabs = this.panel.querySelectorAll('.re-tabular-tab');
    const tabContents = this.panel.querySelectorAll('.re-tabular-tab-content');
    
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetTab = tab.dataset.tab;
        
        // Update tab styles
        tabs.forEach(t => {
          t.classList.remove('re-tabular-tab-active');
          t.style.borderBottomColor = 'transparent';
          t.style.fontWeight = 'normal';
          t.classList.add('re-tabular-tab');
        });
        
        tab.classList.add('re-tabular-tab-active');
        tab.style.borderBottomColor = 'var(--chatgpt-accent)';
        tab.style.fontWeight = '500';
        
        // Show/hide content
        tabContents.forEach(content => {
          content.style.display = 'none';
        });
        
        const targetContent = this.panel.querySelector(`#re-tabular-${targetTab}-tab`);
        if (targetContent) {
          targetContent.style.display = 'block';
          
          // Load content when switching to tabs
          if (targetTab === 'prompt') {
            this.loadTabularTemplate();
          } else if (targetTab === 'custom-columns') {
            this.loadCustomColumns();
          }
        }
      });
    });
  }

  async loadTabularColumns() {
    try {
      // Load saved column configuration and custom columns
      const result = await safeChromeFall(
        () => chrome.storage.local.get(['tabularColumnConfiguration', 'customColumns']),
        { tabularColumnConfiguration: null, customColumns: [] }
      );
      
      // Get default columns
      const defaultColumns = getTabularDataColumns();
      
      // Get custom columns
      const customColumns = result.customColumns || [];
      
      // Combine all columns
      const allColumns = [...defaultColumns, ...customColumns];
      
      // Merge with saved configuration
      let columns = allColumns;
      if (result.tabularColumnConfiguration) {
        columns = this.mergeColumnConfigurations(allColumns, result.tabularColumnConfiguration);
      }
      
      // Render columns UI
      this.renderColumnsUI(columns);
      this.updateColumnStats();
      
    } catch (error) {
      console.error('Failed to load tabular columns:', error);
    }
  }

  mergeColumnConfigurations(defaultColumns, savedConfig) {
    return defaultColumns.map(defaultCol => {
      const savedCol = savedConfig.find(saved => saved.id === defaultCol.id);
      return savedCol ? { ...defaultCol, ...savedCol } : defaultCol;
    });
  }

  renderColumnsUI(columns) {
    const container = this.panel.querySelector('#re-columns-container');
    if (!container) return;
    
    // Group columns by category
    const categorizedColumns = this.groupColumnsByCategory(columns);
    
    container.innerHTML = '';
    
    // Render each category
    Object.entries(categorizedColumns).forEach(([category, categoryColumns]) => {
      const categorySection = this.createCategorySection(category, categoryColumns);
      container.appendChild(categorySection);
    });
  }

  groupColumnsByCategory(columns) {
    const categories = {};
    const categoryNames = {
      'core': '🏠 Core Property Information',
      'location': '📍 Location & Geography', 
      'financial': '💰 Financial Data',
      'features': '🔧 Property Features',
      'analysis': '📊 Analysis Data',
      'market': '📈 Market Analysis',
      'calculated': '🧮 Calculated Metrics',
      'risk': '⚠️ Risk Assessment',
      'scoring': '⭐ Scoring & Ratings'
    };
    
    columns.forEach(column => {
      const category = column.category || 'other';
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(column);
    });
    
    // Sort categories in logical order
    const sortedCategories = {};
    const categoryOrder = ['core', 'location', 'financial', 'features', 'analysis', 'market', 'calculated', 'risk', 'scoring'];
    
    categoryOrder.forEach(cat => {
      if (categories[cat]) {
        sortedCategories[categoryNames[cat] || cat] = categories[cat];
      }
    });
    
    // Add any remaining categories
    Object.entries(categories).forEach(([cat, cols]) => {
      if (!categoryOrder.includes(cat)) {
        sortedCategories[categoryNames[cat] || cat] = cols;
      }
    });
    
    return sortedCategories;
  }

  createCategorySection(categoryName, columns) {
    const section = document.createElement('div');
    section.className = 're-column-category';
    section.style.cssText = `
      margin-bottom: 16px; 
      border: 1px solid var(--chatgpt-border-light); 
      border-radius: 8px; 
      overflow: hidden;
    `;
    
    // Category header
    const header = document.createElement('div');
    header.style.cssText = `
      background: var(--chatgpt-surface-secondary); 
      padding: 8px 12px; 
      font-weight: 500; 
      font-size: 14px;
      color: #ffffff;
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
    `;
    
    const enabledCount = columns.filter(col => col.enabled).length;
    const headerContent = document.createElement('div');
    headerContent.style.cssText = 'display: flex; align-items: center; gap: 8px; width: 100%;';
    
    headerContent.innerHTML = `
      <span style="flex: 1;">${categoryName}</span>
      <div style="display: flex; gap: 4px; align-items: center;">
        <button class="re-category-select-all re-category-btn" data-category="${categoryName}" title="Select all in category">All</button>
        <button class="re-category-clear-all re-category-btn" data-category="${categoryName}" title="Clear all in category">None</button>
        <span class="re-category-count">${enabledCount}/${columns.length}</span>
      </div>
    `;
    
    // Add category bulk actions
    headerContent.querySelector('.re-category-select-all').addEventListener('click', (e) => {
      e.stopPropagation();
      columns.forEach(col => {
        col.enabled = true;
        const checkbox = content.querySelector(`input[data-column-id="${col.id}"]`);
        if (checkbox) checkbox.checked = true;
      });
      this.updateColumnStats();
      this.updateCategoryHeader(header, categoryName, columns);
    });
    
    headerContent.querySelector('.re-category-clear-all').addEventListener('click', (e) => {
      e.stopPropagation();
      columns.forEach(col => {
        if (!col.required) { // Don't disable required columns
          col.enabled = false;
          const checkbox = content.querySelector(`input[data-column-id="${col.id}"]`);
          if (checkbox) checkbox.checked = false;
        }
      });
      this.updateColumnStats();
      this.updateCategoryHeader(header, categoryName, columns);
    });
    
    header.appendChild(headerContent);
    
    // Category content
    const content = document.createElement('div');
    content.style.cssText = `
      padding: 8px; 
      display: grid; 
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); 
      gap: 4px;
    `;
    
    columns.forEach(column => {
      const columnItem = this.createColumnItem(column);
      content.appendChild(columnItem);
    });
    
    // Toggle category
    let isExpanded = true;
    header.addEventListener('click', (e) => {
      // Don't toggle if clicking on buttons
      if (e.target.tagName === 'BUTTON') return;
      
      isExpanded = !isExpanded;
      content.style.display = isExpanded ? 'grid' : 'none';
      header.style.opacity = isExpanded ? '1' : '0.7';
    });
    
    section.appendChild(header);
    section.appendChild(content);
    
    return section;
  }

  updateCategoryHeader(header, categoryName, columns) {
    const enabledCount = columns.filter(col => col.enabled).length;
    const countSpan = header.querySelector('span:last-child');
    if (countSpan) {
      countSpan.textContent = `${enabledCount}/${columns.length}`;
    }
  }

  createColumnItem(column) {
    const item = document.createElement('label');
    item.className = 're-column-item';
    item.style.cssText = `
      display: flex; 
      align-items: flex-start; 
      gap: 8px; 
      padding: 6px 8px; 
      border-radius: 4px; 
      cursor: pointer;
      font-size: 13px;
      transition: background-color 0.2s;
    `;
    
    item.addEventListener('mouseenter', () => {
      item.style.backgroundColor = 'var(--chatgpt-surface-secondary)';
    });
    
    item.addEventListener('mouseleave', () => {
      item.style.backgroundColor = 'transparent';
    });
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = column.enabled !== false;
    checkbox.dataset.columnId = column.id;
    checkbox.style.cssText = 'margin: 2px 0 0 0; flex-shrink: 0;';
    
    checkbox.addEventListener('change', () => {
      column.enabled = checkbox.checked;
      this.updateColumnStats();
    });
    
    const label = document.createElement('div');
    label.style.cssText = 'flex: 1; line-height: 1.3;';
    
    const badges = [];
    
    // Add default indicator for built-in columns
    const defaultColumns = getTabularDataColumns();
    const isDefaultColumn = defaultColumns.some(defaultCol => defaultCol.id === column.id);
    if (isDefaultColumn) {
      badges.push('<span style="background: #10a37f; color: white; padding: 1px 4px; border-radius: 2px; font-size: 10px;">DEFAULT</span>');
    }
    
    if (column.required) badges.push('<span style="background: #ef4444; color: white; padding: 1px 4px; border-radius: 2px; font-size: 10px;">REQUIRED</span>');
    if (column.isCalculated) badges.push('<span style="background: #3b82f6; color: white; padding: 1px 4px; border-radius: 2px; font-size: 10px;">CALCULATED</span>');
    
    // Add custom indicator for user-added columns
    if (!isDefaultColumn) {
      badges.push('<span style="background: #8b5cf6; color: white; padding: 1px 4px; border-radius: 2px; font-size: 10px;">CUSTOM</span>');
    }
    
    label.innerHTML = `
      <div class="re-column-label">
        <span>${column.name}</span>
        ${badges.join(' ')}
      </div>
      ${column.description ? `<div class="re-column-description">${column.description || ''}</div>` : ''}
    `;
    
    item.appendChild(checkbox);
    item.appendChild(label);
    
    return item;
  }

  updateColumnStats() {
    const statsElement = this.panel.querySelector('#re-columns-stats');
    if (!statsElement) return;
    
    const checkboxes = this.panel.querySelectorAll('#re-columns-container input[type="checkbox"]');
    const enabledCount = Array.from(checkboxes).filter(cb => cb.checked).length;
    const totalCount = checkboxes.length;
    
    // Count defaults vs custom columns
    const defaultColumns = getTabularDataColumns();
    let defaultEnabledCount = 0;
    let customEnabledCount = 0;
    
    Array.from(checkboxes).forEach(checkbox => {
      if (checkbox.checked) {
        const columnId = checkbox.dataset.columnId;
        const isDefaultColumn = defaultColumns.some(col => col.id === columnId);
        if (isDefaultColumn) {
          defaultEnabledCount++;
        } else {
          customEnabledCount++;
        }
      }
    });
    
    statsElement.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span>${enabledCount} of ${totalCount} columns selected</span>
        <span style="font-size: 10px; color: #9ca3af;">
          🏠 ${defaultEnabledCount} default • ➕ ${customEnabledCount} custom
        </span>
      </div>
    `;
  }

  selectAllColumns() {
    const checkboxes = this.panel.querySelectorAll('#re-columns-container input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event('change'));
    });
    
    // Update all category headers
    this.updateAllCategoryHeaders();
    this.showChatGPTMessage('success', 'All columns selected');
  }

  clearAllColumns() {
    const checkboxes = this.panel.querySelectorAll('#re-columns-container input[type="checkbox"]');
    const defaultColumns = getTabularDataColumns();
    
    checkboxes.forEach(checkbox => {
      const columnId = checkbox.dataset.columnId;
      // Find the column to check if it's required
      const column = defaultColumns.find(col => col.id === columnId);
      
      // Only clear non-required columns
      if (!column || !column.required) {
        checkbox.checked = false;
        checkbox.dispatchEvent(new Event('change'));
      }
    });
    
    // Update all category headers
    this.updateAllCategoryHeaders();
    this.showChatGPTMessage('success', 'All non-required columns cleared');
  }

  selectDefaultColumns() {
    const checkboxes = this.panel.querySelectorAll('#re-columns-container input[type="checkbox"]');
    const defaultColumns = getTabularDataColumns();
    
    checkboxes.forEach(checkbox => {
      const columnId = checkbox.dataset.columnId;
      // Check if this is a default column
      const isDefaultColumn = defaultColumns.some(col => col.id === columnId);
      
      checkbox.checked = isDefaultColumn;
      checkbox.dispatchEvent(new Event('change'));
    });
    
    // Update all category headers
    this.updateAllCategoryHeaders();
    this.showChatGPTMessage('success', 'Default columns selected');
  }

  updateAllCategoryHeaders() {
    const categories = this.panel.querySelectorAll('.re-column-category');
    categories.forEach(categoryElement => {
      const categoryHeader = categoryElement.querySelector('div:first-child');
      const checkboxes = categoryElement.querySelectorAll('input[type="checkbox"]');
      const enabledCount = Array.from(checkboxes).filter(cb => cb.checked).length;
      
      const countSpan = categoryHeader.querySelector('span:last-child');
      if (countSpan) {
        countSpan.textContent = `${enabledCount}/${checkboxes.length}`;
      }
    });
  }

  async saveColumnConfiguration() {
    try {
      const checkboxes = this.panel.querySelectorAll('#re-columns-container input[type="checkbox"]');
      const columnConfig = Array.from(checkboxes).map(checkbox => ({
        id: checkbox.dataset.columnId,
        enabled: checkbox.checked
      }));
      
      await safeChromeFall(
        () => chrome.storage.local.set({ tabularColumnConfiguration: columnConfig }),
        null
      );
      
      this.showChatGPTMessage('success', 'Column configuration saved successfully!');
      console.log('💾 Tabular column configuration saved:', columnConfig);
      
    } catch (error) {
      console.error('Failed to save column configuration:', error);
      this.showChatGPTMessage('error', 'Failed to save column configuration');
    }
  }

  async resetColumnConfiguration() {
    if (confirm('Are you sure you want to reset all columns to default settings?')) {
      try {
        await safeChromeFall(
          () => chrome.storage.local.remove(['tabularColumnConfiguration']),
          null
        );
        
        // Reload columns with defaults
        this.loadTabularColumns();
        
        this.showChatGPTMessage('success', 'Column configuration reset to default');
        console.log('🔄 Tabular column configuration reset');
        
      } catch (error) {
        console.error('Failed to reset column configuration:', error);
        this.showChatGPTMessage('error', 'Failed to reset column configuration');
      }
    }
  }

  async previewTabularPrompt() {
    try {
      // Get current column configuration
      const checkboxes = this.panel.querySelectorAll('#re-columns-container input[type="checkbox"]');
      const enabledColumns = Array.from(checkboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.dataset.columnId);
      
      if (enabledColumns.length === 0) {
        this.showChatGPTMessage('warning', 'No columns selected. Please select at least one column to preview.');
        return;
      }
      
      // Generate tabular prompt with selected columns
      const promptTemplate = await getTabularDataExtractionPromptWithColumns(enabledColumns);
      
      if (!promptTemplate) {
        this.showChatGPTMessage('warning', 'Failed to generate prompt preview');
        return;
      }
      
      // Show preview with sample data
      const exampleUrl = 'https://www.zillow.com/homedetails/123-Main-St-Anytown-CA-12345/123456789_zpid/';
      const previewText = promptTemplate
        .replace('{PROPERTY_URL}', exampleUrl)
        .replace('{DATE}', new Date().toLocaleDateString());
      
      // Show preview modal with column info
      this.showPromptPreviewModal(previewText, `tabular (${enabledColumns.length} columns)`);
      
    } catch (error) {
      console.error('Failed to preview tabular prompt:', error);
      this.showChatGPTMessage('error', 'Failed to generate prompt preview');
    }
  }

  // Tabular Template Management
  async loadTabularTemplate() {
    try {
      const result = await safeChromeFall(
        () => chrome.storage.local.get(['tabularPromptTemplate']),
        { tabularPromptTemplate: null }
      );
      
      const templateTextarea = this.panel.querySelector('#re-tabular-prompt-template');
      if (templateTextarea) {
        if (result.tabularPromptTemplate) {
          templateTextarea.value = result.tabularPromptTemplate;
        } else {
          // Load default template
          templateTextarea.value = getDefaultTabularPromptTemplate();
        }
      }
      
    } catch (error) {
      console.error('Failed to load tabular template:', error);
    }
  }

  async saveTabularTemplate() {
    try {
      const templateTextarea = this.panel.querySelector('#re-tabular-prompt-template');
      if (!templateTextarea) return;
      
      const template = templateTextarea.value.trim();
      
      await safeChromeFall(
        () => chrome.storage.local.set({ tabularPromptTemplate: template || null }),
        null
      );
      
      this.showChatGPTMessage('success', 'Tabular prompt template saved successfully!');
      console.log('💾 Tabular prompt template saved');
      
    } catch (error) {
      console.error('Failed to save tabular template:', error);
      this.showChatGPTMessage('error', 'Failed to save tabular prompt template');
    }
  }

  async resetTabularTemplate() {
    if (confirm('Are you sure you want to reset the tabular prompt template to default?')) {
      try {
        await safeChromeFall(
          () => chrome.storage.local.remove(['tabularPromptTemplate']),
          null
        );
        
        // Reload with default template
        this.loadTabularTemplate();
        
        this.showChatGPTMessage('success', 'Tabular prompt template reset to default');
        console.log('🔄 Tabular prompt template reset');
        
      } catch (error) {
        console.error('Failed to reset tabular template:', error);
        this.showChatGPTMessage('error', 'Failed to reset tabular prompt template');
      }
    }
  }

  async previewTabularTemplate() {
    try {
      const templateTextarea = this.panel.querySelector('#re-tabular-prompt-template');
      if (!templateTextarea) return;
      
      const template = templateTextarea.value.trim();
      if (!template) {
        this.showChatGPTMessage('warning', 'No template to preview');
        return;
      }
      
      // Get enabled columns for preview
      const checkboxes = this.panel.querySelectorAll('#re-columns-container input[type="checkbox"]');
      const enabledColumns = Array.from(checkboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.dataset.columnId);
      
      // Generate column sections
      let columnsSection = 'No columns selected';
      if (enabledColumns.length > 0) {
        const allColumns = [...getTabularDataColumns(), ...await this.getCustomColumns()];
        const selectedColumns = allColumns.filter(col => enabledColumns.includes(col.id));
        columnsSection = this.generateColumnsSectionForTemplate(selectedColumns);
      }
      
      // Replace template variables
      const previewText = template
        .replace(/\{\{COLUMNS\}\}/g, columnsSection)
        .replace(/\{PROPERTY_URL\}/g, 'https://www.zillow.com/homedetails/123-Main-St-Anytown-CA-12345/123456789_zpid/')
        .replace(/\{DATE\}/g, new Date().toLocaleDateString());
      
      // Show preview modal
      this.showPromptPreviewModal(previewText, `tabular template (${enabledColumns.length} columns)`);
      
    } catch (error) {
      console.error('Failed to preview tabular template:', error);
      this.showChatGPTMessage('error', 'Failed to preview template');
    }
  }

  // Custom Columns Management
  async loadCustomColumns() {
    try {
      const result = await safeChromeFall(
        () => chrome.storage.local.get(['customColumns']),
        { customColumns: [] }
      );
      
      const customColumns = result.customColumns || [];
      this.renderCustomColumnsList(customColumns);
      
    } catch (error) {
      console.error('Failed to load custom columns:', error);
    }
  }

  renderCustomColumnsList(customColumns) {
    const container = this.panel.querySelector('#re-custom-columns-list');
    if (!container) return;
    
    if (customColumns.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 24px; color: var(--chatgpt-text-secondary);">
          <div style="font-size: 48px; margin-bottom: 8px;">📋</div>
          <div>No custom columns yet</div>
          <div style="font-size: 12px; margin-top: 4px;">Click "Add Column" to create your first custom data point</div>
        </div>
      `;
      return;
    }
    
    container.innerHTML = '';
    
    customColumns.forEach((column, index) => {
      const columnElement = this.createCustomColumnElement(column, index);
      container.appendChild(columnElement);
    });
  }

  createCustomColumnElement(column, index) {
    const element = document.createElement('div');
    element.className = 're-custom-column-item';
    element.style.cssText = `
      border: 1px solid var(--chatgpt-border-light);
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 8px;
      background: var(--chatgpt-surface-primary);
      transition: all 0.2s ease;
    `;
    
    // Add hover effect
    element.addEventListener('mouseenter', () => {
      element.style.borderColor = 'var(--chatgpt-primary)';
      element.style.boxShadow = '0 2px 8px rgba(16, 163, 127, 0.1)';
    });
    
    element.addEventListener('mouseleave', () => {
      element.style.borderColor = 'var(--chatgpt-border-light)';
      element.style.boxShadow = 'none';
    });
    
    // Get category display name and color
    const categoryInfo = this.getCategoryDisplayInfo(column.category || 'custom');
    
    element.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div style="flex: 1;">
          <div style="font-weight: 500; margin-bottom: 4px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <span style="color: #ffffff;">${column.name}</span>
            <span style="font-size: 11px; background: ${categoryInfo.color}; color: white; padding: 2px 6px; border-radius: 4px;">
              ${categoryInfo.icon} ${categoryInfo.name}
            </span>
            <span style="font-size: 10px; background: #8b5cf6; color: white; padding: 1px 4px; border-radius: 2px;">CUSTOM</span>
          </div>
          <div class="re-column-description">
            ${column.description || 'No description provided'}
          </div>
          <div class="re-column-meta">
            Type: ${column.type || 'text'} • ID: ${column.id}
          </div>
        </div>
        <div style="display: flex; gap: 4px; margin-left: 12px;">
          <button class="re-btn re-btn-ghost re-btn-sm" onclick="reAnalyzer.editCustomColumn(${index})" title="Edit custom column">
            ✏️
          </button>
          <button class="re-btn re-btn-ghost re-btn-sm" onclick="reAnalyzer.deleteCustomColumn(${index})" title="Delete custom column" style="color: #ef4444;">
            🗑️
          </button>
        </div>
      </div>
    `;
    
    return element;
  }

  getCategoryDisplayInfo(category) {
    const categoryMap = {
      'core': { name: 'Core Info', icon: '🏠', color: '#10a37f' },
      'location': { name: 'Location', icon: '📍', color: '#3b82f6' },
      'financial': { name: 'Financial', icon: '💰', color: '#f59e0b' },
      'features': { name: 'Features', icon: '🔧', color: '#8b5cf6' },
      'analysis': { name: 'Analysis', icon: '📊', color: '#ef4444' },
      'market': { name: 'Market', icon: '📈', color: '#06b6d4' },
      'calculated': { name: 'Calculated', icon: '🧮', color: '#84cc16' },
      'risk': { name: 'Risk', icon: '⚠️', color: '#f97316' },
      'scoring': { name: 'Scoring', icon: '⭐', color: '#eab308' },
      'custom': { name: 'Custom', icon: '➕', color: '#8b5cf6' }
    };
    
    return categoryMap[category] || categoryMap['custom'];
  }

  showAddColumnForm() {
    const form = this.panel.querySelector('#re-add-column-form');
    if (form) {
      form.style.display = 'block';
      
      // Clear form
      this.panel.querySelector('#re-new-column-name').value = '';
      this.panel.querySelector('#re-new-column-category').value = 'custom';
      this.panel.querySelector('#re-new-column-description').value = '';
      
      // Focus on name field
      this.panel.querySelector('#re-new-column-name').focus();
    }
  }

  hideAddColumnForm() {
    const form = this.panel.querySelector('#re-add-column-form');
    if (form) {
      form.style.display = 'none';
    }
  }

  async saveCustomColumn() {
    try {
      const nameField = this.panel.querySelector('#re-new-column-name');
      const categoryField = this.panel.querySelector('#re-new-column-category');
      const descriptionField = this.panel.querySelector('#re-new-column-description');
      const saveBtn = this.panel.querySelector('#re-save-custom-column');
      
      const name = nameField.value.trim();
      const category = categoryField.value;
      const description = descriptionField.value.trim();
      const editIndex = saveBtn.dataset.editIndex;
      const isEditing = editIndex !== undefined;
      
      if (!name) {
        this.showChatGPTMessage('warning', 'Please enter a column name');
        nameField.focus();
        return;
      }
      
      // Validate column name format
      if (!/^[a-zA-Z0-9\s\-_()]+$/.test(name)) {
        this.showChatGPTMessage('warning', 'Column name can only contain letters, numbers, spaces, hyphens, underscores, and parentheses');
        nameField.focus();
        return;
      }
      
      // Load existing custom columns
      const result = await safeChromeFall(
        () => chrome.storage.local.get(['customColumns']),
        { customColumns: [] }
      );
      
      const customColumns = result.customColumns || [];
      
      // Check for duplicate names (excluding current column when editing)
      const duplicateCheck = customColumns.some((col, index) => {
        if (isEditing && index === parseInt(editIndex)) return false; // Skip current column when editing
        return col.name.toLowerCase() === name.toLowerCase();
      });
      
      if (duplicateCheck) {
        this.showChatGPTMessage('warning', 'A column with this name already exists');
        nameField.focus();
        return;
      }
      
      if (isEditing) {
        // Update existing column
        const columnIndex = parseInt(editIndex);
        customColumns[columnIndex] = {
          ...customColumns[columnIndex],
          name: name,
          category: category,
          description: description
        };
        
        this.showChatGPTMessage('success', `Custom column "${name}" updated successfully!`);
      } else {
        // Create new column
        const newColumn = {
          id: `custom_${Date.now()}`,
          name: name,
          category: category,
          description: description,
          type: 'text',
          isCustom: true,
          enabled: true,
          required: false
        };
        
        // Add to list
        customColumns.push(newColumn);
        
        this.showChatGPTMessage('success', `Custom column "${name}" added successfully!`);
      }
      
      // Save
      await safeChromeFall(
        () => chrome.storage.local.set({ customColumns: customColumns }),
        null
      );
      
      // Reload the list
      this.loadCustomColumns();
      
      // Hide form and reset save button
      this.hideAddColumnForm();
      saveBtn.innerHTML = '💾 Save Column';
      delete saveBtn.dataset.editIndex;
      
      // Reset form title
      const formTitle = this.panel.querySelector('#re-form-title');
      if (formTitle) {
        formTitle.textContent = 'Add Custom Column';
      }
      
      // Reload columns in the main tab
      this.loadTabularColumns();
      
    } catch (error) {
      console.error('Failed to save custom column:', error);
      this.showChatGPTMessage('error', 'Failed to save custom column');
    }
  }

  async getCustomColumns() {
    try {
      const result = await safeChromeFall(
        () => chrome.storage.local.get(['customColumns']),
        { customColumns: [] }
      );
      return result.customColumns || [];
    } catch (error) {
      console.error('Failed to get custom columns:', error);
      return [];
    }
  }

  async editCustomColumn(index) {
    try {
      const result = await safeChromeFall(
        () => chrome.storage.local.get(['customColumns']),
        { customColumns: [] }
      );
      
      const customColumns = result.customColumns || [];
      const column = customColumns[index];
      
      if (!column) {
        this.showChatGPTMessage('error', 'Custom column not found');
        return;
      }
      
      // Show form with existing values
      this.showAddColumnForm();
      
      // Populate form with existing values
      this.panel.querySelector('#re-new-column-name').value = column.name;
      this.panel.querySelector('#re-new-column-category').value = column.category || 'custom';
      this.panel.querySelector('#re-new-column-description').value = column.description || '';
      
      // Change save button to update mode
      const saveBtn = this.panel.querySelector('#re-save-custom-column');
      const formTitle = this.panel.querySelector('#re-form-title');
      if (saveBtn) {
        saveBtn.innerHTML = '✏️ Update Column';
        saveBtn.dataset.editIndex = index;
      }
      if (formTitle) {
        formTitle.textContent = 'Edit Custom Column';
      }
      
    } catch (error) {
      console.error('Failed to edit custom column:', error);
      this.showChatGPTMessage('error', 'Failed to load column for editing');
    }
  }

  async deleteCustomColumn(index) {
    if (confirm('Are you sure you want to delete this custom column?')) {
      try {
        const result = await safeChromeFall(
          () => chrome.storage.local.get(['customColumns']),
          { customColumns: [] }
        );
        
        const customColumns = result.customColumns || [];
        const columnName = customColumns[index]?.name || 'Unknown';
        customColumns.splice(index, 1);
        
        await safeChromeFall(
          () => chrome.storage.local.set({ customColumns: customColumns }),
          null
        );
        
        this.loadCustomColumns();
        this.loadTabularColumns(); // Refresh main columns list
        
        this.showChatGPTMessage('success', `Custom column "${columnName}" deleted`);
        
      } catch (error) {
        console.error('Failed to delete custom column:', error);
        this.showChatGPTMessage('error', 'Failed to delete custom column');
      }
    }
  }

  generateColumnsSectionForTemplate(columns) {
    // Group columns by category for organized output
    const categorized = {};
    columns.forEach(col => {
      const category = col.category || 'other';
      if (!categorized[category]) {
        categorized[category] = [];
      }
      categorized[category].push(col);
    });
    
    const sections = [];
    const categoryNames = {
      'core': 'BASIC PROPERTY INFORMATION',
      'location': 'LOCATION & GEOGRAPHY', 
      'financial': 'FINANCIAL DATA',
      'features': 'PROPERTY FEATURES',
      'analysis': 'INVESTMENT ANALYSIS',
      'market': 'MARKET ANALYSIS',
      'calculated': 'CALCULATED METRICS',
      'risk': 'RISK ASSESSMENT',
      'scoring': 'SCORING & RATINGS',
      'custom': 'CUSTOM DATA POINTS'
    };
    
    Object.entries(categorized).forEach(([category, cols]) => {
      const sectionName = categoryNames[category] || category.toUpperCase();
      const dataPoints = cols.map((col, index) => {
        const description = col.description || `Extract ${col.name}`;
        return `${index + 1}. ${col.name}: ${description}`;
      });
      
      sections.push(`**${sectionName}:**\n${dataPoints.join('\n')}`);
    });
    
    return sections.join('\n\n');
  }

  // Global Tabular Configuration Management
  async saveAllTabularConfiguration() {
    try {
      // Save all components
      await this.saveColumnConfiguration();
      await this.saveTabularTemplate();
      
      this.showChatGPTMessage('success', 'All tabular configuration saved successfully!');
      
    } catch (error) {
      console.error('Failed to save all tabular configuration:', error);
      this.showChatGPTMessage('error', 'Failed to save configuration');
    }
  }

  async resetAllTabularConfiguration() {
    if (confirm('Are you sure you want to reset ALL tabular configuration (columns, template, and custom columns) to default?')) {
      try {
        await safeChromeFall(
          () => chrome.storage.local.remove(['tabularColumnConfiguration', 'tabularPromptTemplate', 'customColumns']),
          null
        );
        
        // Reload all components
        this.loadTabularColumns();
        this.loadTabularTemplate();
        this.loadCustomColumns();
        
        this.showChatGPTMessage('success', 'All tabular configuration reset to default');
        
      } catch (error) {
        console.error('Failed to reset all tabular configuration:', error);
        this.showChatGPTMessage('error', 'Failed to reset configuration');
      }
    }
  }

  async previewCompleteTabularConfiguration() {
    try {
      // Get the complete configuration
      const promptTemplate = await this.getCompleteTabularPrompt();
      
      if (!promptTemplate) {
        this.showChatGPTMessage('warning', 'Failed to generate complete configuration preview');
        return;
      }
      
      // Show preview with sample data
      const exampleUrl = 'https://www.zillow.com/homedetails/123-Main-St-Anytown-CA-12345/123456789_zpid/';
      const previewText = promptTemplate
        .replace('{PROPERTY_URL}', exampleUrl)
        .replace('{DATE}', new Date().toLocaleDateString());
      
      // Count enabled columns
      const checkboxes = this.panel.querySelectorAll('#re-columns-container input[type="checkbox"]');
      const enabledCount = Array.from(checkboxes).filter(cb => cb.checked).length;
      
      // Show preview modal
      this.showPromptPreviewModal(previewText, `complete tabular (${enabledCount} columns)`);
      
    } catch (error) {
      console.error('Failed to preview complete tabular configuration:', error);
      this.showChatGPTMessage('error', 'Failed to generate preview');
    }
  }

  async getCompleteTabularPrompt() {
    try {
      // Get custom template if available
      const templateResult = await safeChromeFall(
        () => chrome.storage.local.get(['tabularPromptTemplate']),
        { tabularPromptTemplate: null }
      );
      
      let template = templateResult.tabularPromptTemplate;
      if (!template) {
        template = getDefaultTabularPromptTemplate();
      }
      
      // Get enabled columns
      const checkboxes = this.panel.querySelectorAll('#re-columns-container input[type="checkbox"]');
      const enabledColumns = Array.from(checkboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.dataset.columnId);
      
      if (enabledColumns.length === 0) {
        return template; // Return template without columns replacement
      }
      
      // Get all columns (built-in + custom)
      const allColumns = [...getTabularDataColumns(), ...await this.getCustomColumns()];
      const selectedColumns = allColumns.filter(col => enabledColumns.includes(col.id));
      
      // Generate columns section
      const columnsSection = this.generateColumnsSectionForTemplate(selectedColumns);
      
      // Replace template variables
      return template.replace(/\{\{COLUMNS\}\}/g, columnsSection);
      
    } catch (error) {
      console.error('Error generating complete tabular prompt:', error);
      return null;
    }
  }
  
  showPromptPreviewModal(previewText, promptType = 'custom') {
    // Remove existing modal if any
    const existingModal = document.querySelector('#re-prompt-preview-modal');
    if (existingModal) {
      existingModal.remove();
    }
    
    const modal = document.createElement('div');
    modal.id = 're-prompt-preview-modal';
    modal.className = 're-modal-overlay';
    modal.innerHTML = `
      <div class="re-modal">
        <div class="re-modal-header">
          <h3>Prompt Preview</h3>
          <button class="re-modal-close" onclick="this.closest('.re-modal-overlay').remove()">×</button>
        </div>
        <div class="re-modal-content">
          <div style="margin-bottom: 16px; padding: 8px; background: var(--chatgpt-surface-secondary); border-radius: 6px;">
            <strong>Prompt Type:</strong> ${promptType.toUpperCase()}<br>
            <strong>Length:</strong> ${previewText.length} characters
          </div>
          <p style="margin-bottom: 16px; color: var(--chatgpt-text-secondary);">This is how your ${promptType} prompt will appear when sent to ChatGPT:</p>
          <div class="re-analysis-text" style="max-height: 400px;">
            ${previewText.replace(/\n/g, '<br>')}
          </div>
        </div>
        <div class="re-modal-footer">
          <button class="re-btn re-btn-primary" onclick="this.closest('.re-modal-overlay').remove()">
            Close
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  resetSettings() {
    uiSettings = {
      position: 'right',
      compactMode: false,
      autoShow: true,
      showNotifications: true
    };
    
    // Update UI elements
    const panelPositionSelect = this.panel.querySelector('#re-panel-position');
    const compactModeCheckbox = this.panel.querySelector('#re-compact-mode');
    
    if (panelPositionSelect) panelPositionSelect.value = 'right';
    if (compactModeCheckbox) compactModeCheckbox.checked = false;
    
    this.updatePanelPosition('right');
    this.toggleCompactMode(false);
    
    this.showMessage('success', 'Settings reset to defaults');
  }

  async exportProperties() {
    // Use the existing CSV export functionality
    await this.exportPropertiesToCSV();
  }

  manageCategories() {
    // Placeholder for category management
    this.showMessage('warning', 'Category management will be implemented in the next update');
  }

  // Cleanup method
  destroy() {
    if (this.fab) {
      this.fab.remove();
    }
    
    if (this.panel) {
      this.panel.remove();
    }
    
    if (this.analysisTimer) {
      clearInterval(this.analysisTimer);
    }
    
    document.body.classList.remove('re-compact-mode');
    
    console.log('🧹 Embedded UI destroyed');
  }
}

// Load ChatGPT native styles
function loadChatGPTNativeStyles() {
  // Inject ChatGPT-style native styles
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = chrome.runtime.getURL('chatgpt-native-styles.css');
  document.head.appendChild(link);
  console.log('📄 ChatGPT native styles loaded');
}

// ============================================================================
// CONTEXTUAL INTEGRATION
// ============================================================================

// Detect if we're on a property page
function isPropertyPage() {
  const url = window.location.href;
  const hostname = window.location.hostname.toLowerCase();
  
  const propertyDomains = [
    'zillow.com', 'realtor.com', 'redfin.com', 'homes.com', 'trulia.com',
    'apartments.com', 'rent.com', 'hotpads.com', 'padmapper.com', 'loopnet.com'
  ];
  
  return propertyDomains.some(domain => hostname.includes(domain));
}

// Add contextual quick action button on property pages
function addPropertyPageIntegration() {
  if (!isPropertyPage()) return;
  
  console.log('🏠 Property page detected, adding quick action button');
  
  // Remove existing button if present
  const existingButton = document.getElementById('re-quick-action');
  if (existingButton) {
    existingButton.remove();
  }
  
  // Create quick action button
  const quickAction = document.createElement('div');
  quickAction.id = 're-quick-action';
  quickAction.className = 're-quick-action-btn';
  quickAction.innerHTML = `
    <div class="re-quick-icon">🔍</div>
    <div class="re-quick-text">Analyze with ChatGPT</div>
  `;
  
  // Add click handler
  quickAction.addEventListener('click', () => {
    // Open ChatGPT with this property URL
    const currentUrl = window.location.href;
    const chatGptUrl = `https://chatgpt.com/?q=${encodeURIComponent(`Analyze this property: ${currentUrl}`)}`;
    window.open(chatGptUrl, '_blank');
  });
  
  // Add to page
  document.body.appendChild(quickAction);
  
  // Add styles for quick action button
  if (!document.getElementById('re-quick-action-styles')) {
    const style = document.createElement('style');
    style.id = 're-quick-action-styles';
    style.textContent = `
      .re-quick-action-btn {
        position: fixed;
        top: 120px;
        right: 24px;
        background: #10a37f;
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        cursor: pointer;
        z-index: 999999;
        box-shadow: 0 4px 12px rgba(16, 163, 127, 0.3);
        transition: all 0.3s ease;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
        user-select: none;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        font-weight: 500;
      }
      
      .re-quick-action-btn:hover {
        background: #0d8a69;
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(16, 163, 127, 0.4);
      }
      
      .re-quick-icon {
        font-size: 16px;
      }
      
      @media (max-width: 768px) {
        .re-quick-action-btn {
          right: 16px;
          top: 80px;
          padding: 10px 14px;
          font-size: 13px;
        }
      }
    `;
    document.head.appendChild(style);
  }
}

// Initialize embedded UI when on ChatGPT
if (isChatGPTSite()) {
  // Load ChatGPT native styles first
  loadChatGPTNativeStyles();
  
  // Wait for page to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => {
        embeddedUI = new REAnalyzerEmbeddedUI();
        window.embeddedUI = embeddedUI; // Make globally available
        window.reAnalyzer = embeddedUI; // Make accessible for custom column management
        
        // Setup global event delegation for CSP-compliant button handling
        setupGlobalEventDelegation();
      }, 1000);
    });
  } else {
    // Page already loaded
    setTimeout(() => {
      embeddedUI = new REAnalyzerEmbeddedUI();
      window.embeddedUI = embeddedUI; // Make globally available
      window.reAnalyzer = embeddedUI; // Make accessible for custom column management
      
      // Setup global event delegation for CSP-compliant button handling
      setupGlobalEventDelegation();
    }, 1000);
  }
} else {
  // Add contextual integration on property pages
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(addPropertyPageIntegration, 1000);
    });
  } else {
    setTimeout(addPropertyPageIntegration, 1000);
  }
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'toggleEmbeddedUI') {
    console.log('🎮 Toggle UI requested from background script');
    if (embeddedUI && embeddedUI.togglePanel) {
      embeddedUI.togglePanel();
      sendResponse({ success: true });
    } else {
      console.warn('Embedded UI not yet initialized');
      sendResponse({ success: false, error: 'UI not initialized' });
    }
    return true; // Keep message channel open for async response
  }
});

// Initialize settings on load
if (isChatGPTSite()) {
  updatePromptSplittingSettings();
}

// Prompt splitting utility functions
function shouldSplitPrompt(prompt) {
  return promptSplittingState.enabled && 
         prompt.length > promptSplittingState.lengthThreshold;
}

// Update prompt splitting settings from storage
async function updatePromptSplittingSettings() {
  try {
    const result = await safeChromeFall(
      () => chrome.storage.local.get(['promptSplittingSettings']),
      { promptSplittingSettings: null }
    );
    
    if (result.promptSplittingSettings) {
      const settings = result.promptSplittingSettings;
      promptSplittingState.enabled = settings.enabled !== false;
      promptSplittingState.lengthThreshold = settings.lengthThreshold || 200;
      promptSplittingState.confirmationTimeout = settings.confirmationTimeout || 15000;
      
      console.log('🔄 Prompt splitting settings updated:', promptSplittingState);
    }
  } catch (error) {
    console.error('Error updating prompt splitting settings:', error);
  }
}

function splitPromptContent(promptTemplate, propertyLink) {
  // Split the prompt into instructions and link parts
  const instructionsPart = promptTemplate.replace('{PROPERTY_URL}', '[PROPERTY_LINK_PLACEHOLDER]')
                                        .replace('{DATE}', new Date().toLocaleDateString())
                                        .replace('Property Link: [PROPERTY_LINK_PLACEHOLDER]', '')
                                        .trim();
  
  const confirmationRequest = '\n\nSay "Yes, I understand" if you understand these instructions and are ready to analyze a property listing.';
  
  return {
    instructions: instructionsPart + confirmationRequest,
    linkMessage: propertyLink  // Send only the raw link, no additional text
  };
}

function detectConfirmation(responseText) {
  if (!responseText || typeof responseText !== 'string') {
    console.log('🔍 detectConfirmation: No response text provided');
    return false;
  }
  
  const confirmationPatterns = [
    /yes,?\s*i\s*understand/i,
    /yes\s*i\s*understand/i,
    /i\s*understand/i,
    /understood/i,
    /ready\s*to\s*analyze/i,
    /ready/i,
    /yes,?\s*i.{0,20}understand/i, // More flexible matching
    /understand.{0,20}ready/i,
    /ready.{0,20}analyze/i,
    /yes.{0,50}ready/i,
    /\byes\b/i // Word boundary to avoid matching "yesterday" etc.
  ];
  
  const result = confirmationPatterns.some(pattern => {
    const matches = pattern.test(responseText.trim());
    if (matches) {
      console.log('🔍 detectConfirmation: Pattern matched:', pattern.source);
    }
    return matches;
  });
  
  // Always log what we're testing for debugging
  console.log('🔍 detectConfirmation: Testing response:', responseText.substring(0, 200));
  console.log('🔍 detectConfirmation result:', result);
  
  // If no pattern matched, show what patterns we tried
  if (!result) {
    console.log('🔍 detectConfirmation: No patterns matched. Tried:', confirmationPatterns.map(p => p.source));
  }
  
  return result;
}

// Helper function to validate property links
function isValidPropertyLink(link) {
  if (!link || 
      link === 'null' || 
      link === 'undefined' || 
      link === null || 
      link === undefined ||
      typeof link !== 'string' ||
      link.trim().length === 0) {
    return false;
  }
  
  // Additional URL format validation
  const trimmedLink = link.trim();
  try {
    new URL(trimmedLink);
    return true;
  } catch (e) {
    // Not a valid URL format
    console.warn('⚠️ Property link is not a valid URL format:', trimmedLink);
    return false;
  }
}

function resetPromptSplittingState() {
  promptSplittingState.currentPhase = null;
  promptSplittingState.pendingPropertyLink = null;
  promptSplittingState.confirmationStartTime = null;
  promptSplittingState.fallbackAttempted = false;
  removePromptSplittingIndicator();
}

// Visual indicator functions for prompt splitting status
function showPromptSplittingIndicator(phase, message) {
  removePromptSplittingIndicator();
  
  const indicator = document.createElement('div');
  indicator.id = 'prompt-splitting-indicator';
  indicator.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px;">
      <div class="spinner" style="width: 16px; height: 16px; border: 2px solid #e2e8f0; border-top: 2px solid #10a37f; border-radius: 50%; animation: spin 1s linear infinite;"></div>
      <span>${message}</span>
    </div>
  `;
  indicator.style.cssText = `
    position: fixed;
    top: 60px;
    right: 10px;
    background: #ffffff;
    color: #2d3748;
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 14px;
    font-family: system-ui, -apple-system, sans-serif;
    z-index: 10001;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    border: 1px solid #e2e8f0;
    max-width: 250px;
  `;
  
  // Add spinner animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
  
  document.body.appendChild(indicator);
  
  console.log(`🔄 Showing prompt splitting indicator: ${phase} - ${message}`);
}

function removePromptSplittingIndicator() {
  const indicator = document.getElementById('prompt-splitting-indicator');
  if (indicator) {
    indicator.remove();
  }
}

// Handler for when confirmation is received
async function handleConfirmationReceived() {
  console.log('🔗 Checking pending property link:', promptSplittingState.pendingPropertyLink);
  console.log('🔗 Prompt splitting state:', promptSplittingState);
  
  // Enhanced validation for property link
  const propertyLink = promptSplittingState.pendingPropertyLink;
  
  if (!isValidPropertyLink(propertyLink)) {
    console.error('❌ Invalid or missing property link detected:', propertyLink);
    console.error('❌ Property link type:', typeof propertyLink);
    console.error('❌ Current prompt splitting state:', promptSplittingState);
    
    // Reset state and exit gracefully
    resetPromptSplittingState();
    removePromptSplittingIndicator();
    return;
  }
  
  try {
    promptSplittingState.currentPhase = 'sending_link';
    console.log('📤 Sending property link:', promptSplittingState.pendingPropertyLink);
    
    // Show status indicator
    showPromptSplittingIndicator('sending_link', 'Sending property link...');
    
    // Track successful split
    await updatePromptSplittingStats('success');
    
    // Wait a moment for UI to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const inputField = await waitForInputField(5000);
    if (!inputField) {
      throw new Error('Could not find input field for sending link');
    }
    
    const propertyLink = promptSplittingState.pendingPropertyLink;
    console.log('🔗 About to create link message with:', propertyLink);
    
    // Double-check property link validation before using it
    if (!isValidPropertyLink(propertyLink)) {
      console.error('❌ Invalid property link detected at link creation:', propertyLink);
      console.error('❌ Property link type:', typeof propertyLink);
      
      // Reset state and exit gracefully instead of fallback
      resetPromptSplittingState();
      removePromptSplittingIndicator();
      return;
    }
    
    // For split prompt: start tracking NOW since we're about to send the property link
    currentPropertyAnalysis = {
      url: propertyLink,
      timestamp: Date.now(),
      sessionId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
    console.log('🎯 Split prompt analysis session started (sending property link):', currentPropertyAnalysis.sessionId);
    
    const linkMessage = propertyLink;  // Send only the raw link
    
    console.log('🔍 DEBUG: About to insert link message:', linkMessage);
    console.log('🔍 DEBUG: Input field type:', inputField.tagName);
    console.log('🔍 DEBUG: Input field contentEditable:', inputField.contentEditable);
    console.log('🔍 DEBUG: Input field current value/content:', inputField.tagName === 'TEXTAREA' ? inputField.value : inputField.textContent);
    
    // Insert the link message with enhanced React compatibility
    if (inputField.tagName === 'TEXTAREA') {
      // Clear field first
      inputField.value = '';
      inputField.focus();
      
      // Set the link
      inputField.value = linkMessage;
      
      // Trigger React state updates
      inputField.dispatchEvent(new Event('input', { bubbles: true }));
      inputField.dispatchEvent(new Event('change', { bubbles: true }));
      
      console.log('🔍 DEBUG: After setting textarea value:', inputField.value);
    } else if (inputField.contentEditable === 'true') {
      // Clear field first
      inputField.textContent = '';
      inputField.innerHTML = '';
      inputField.focus();
      
      // Set the link using multiple methods for better compatibility
      inputField.textContent = linkMessage;
      
      // Also try innerHTML as backup
      if (inputField.textContent !== linkMessage) {
        inputField.innerHTML = linkMessage;
      }
      
      // Trigger React state updates with more events
      inputField.dispatchEvent(new Event('input', { bubbles: true }));
      inputField.dispatchEvent(new Event('change', { bubbles: true }));
      inputField.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));
      inputField.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter' }));
      
      // Modern React sometimes uses these events
      inputField.dispatchEvent(new Event('beforeinput', { bubbles: true }));
      inputField.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
      inputField.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
      
      console.log('🔍 DEBUG: After setting contentEditable content:', inputField.textContent);
      console.log('🔍 DEBUG: contentEditable innerHTML:', inputField.innerHTML);
    }
    
    // Wait a moment for React state to update
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Verify the content was set
    const finalContent = inputField.tagName === 'TEXTAREA' ? inputField.value : inputField.textContent;
    console.log('🔍 DEBUG: Final content in input field:', finalContent);
    
    if (finalContent !== linkMessage) {
      console.warn('⚠️ WARNING: Link may not have been set correctly in input field');
      console.warn('⚠️ Expected:', linkMessage);
      console.warn('⚠️ Actual:', finalContent);
      
      // Try alternative method with direct manipulation
      try {
        if (inputField.contentEditable === 'true') {
          // Try using document.execCommand as fallback
          inputField.focus();
          document.execCommand('selectAll', false, null);
          document.execCommand('delete', false, null);
          document.execCommand('insertText', false, linkMessage);
          
          console.log('🔄 RETRY: Attempted alternative content setting method');
          console.log('🔍 DEBUG: Content after retry:', inputField.textContent);
        }
      } catch (execError) {
        console.warn('⚠️ Alternative content setting method failed:', execError);
      }
    }
    
    inputField.focus();
    
    // Auto-submit the link with additional delay to ensure content is ready
    setTimeout(() => {
      console.log('🚀 DEBUG: About to submit message');
      console.log('🔍 DEBUG: Input content before submit:', inputField.tagName === 'TEXTAREA' ? inputField.value : inputField.textContent);
      
      submitMessage();
      promptSplittingState.currentPhase = 'complete';
      showPromptSplittingIndicator('complete', 'Analysis request sent successfully!');
      
      // Remove indicator after completion
      setTimeout(() => {
        removePromptSplittingIndicator();
      }, 3000);
    }, 500);
    
  } catch (error) {
    console.error('❌ Error sending property link:', error);
    await handleSplittingFallback();
  }
}

// Handler for confirmation timeout
async function handleConfirmationTimeout() {
  if (promptSplittingState.fallbackAttempted) {
    console.log('❌ Fallback already attempted, giving up');
    resetPromptSplittingState();
    return;
  }
  
  console.log('⏰ Confirmation timeout - attempting fallback to single prompt');
  await handleSplittingFallback();
}

// Fallback to single prompt approach
async function handleSplittingFallback() {
  const propertyLink = promptSplittingState.pendingPropertyLink;
  
  // Enhanced validation for property link in fallback
  if (!isValidPropertyLink(propertyLink)) {
    console.error('❌ Invalid or missing property link for fallback:', propertyLink);
    console.error('❌ Property link type:', typeof propertyLink);
    console.error('❌ Cannot proceed with fallback - no valid property link');
    
    // Reset state and exit gracefully
    resetPromptSplittingState();
    removePromptSplittingIndicator();
    return;
  }
  
  try {
    promptSplittingState.fallbackAttempted = true;
    console.log('🔄 Falling back to single prompt approach');
    
    // Show fallback status
    showPromptSplittingIndicator('fallback', 'Using fallback approach...');
    
    // Track fallback usage
    await updatePromptSplittingStats('fallback');
    
    // Clear the current conversation and start fresh with full prompt
    const inputField = await waitForInputField(5000);
    if (!inputField) {
      throw new Error('Could not find input field for fallback');
    }
    
    // Get the original prompt template  
    // Get prompt selection and configuration
    const result = await safeChromeFall(
      () => chrome.storage.local.get(['customPrompt', 'promptType', 'columnConfiguration']),
      { customPrompt: null, promptType: 'default', columnConfiguration: null }
    );
    
    const promptTemplate = await getSelectedPrompt(result.promptType, result.customPrompt, result.columnConfiguration);
    
    // Create the full prompt with link
    const fullPrompt = promptTemplate
      .replace('{PROPERTY_URL}', promptSplittingState.pendingPropertyLink)
      .replace('{DATE}', new Date().toLocaleDateString());
    
    // Insert the full prompt with enhanced React compatibility
    console.log('🔄 DEBUG FALLBACK: About to insert full prompt:', fullPrompt.substring(0, 100) + '...');
    console.log('🔄 DEBUG FALLBACK: Input field type:', inputField.tagName);
    
    if (inputField.tagName === 'TEXTAREA') {
      inputField.value = '';
      inputField.focus();
      inputField.value = fullPrompt;
      inputField.dispatchEvent(new Event('input', { bubbles: true }));
      inputField.dispatchEvent(new Event('change', { bubbles: true }));
      
      console.log('🔄 DEBUG FALLBACK: Textarea value set to length:', inputField.value.length);
    } else if (inputField.contentEditable === 'true') {
      inputField.textContent = '';
      inputField.innerHTML = '';
      inputField.focus();
      
      // Set the content using multiple methods
      inputField.textContent = fullPrompt;
      
      // Also try innerHTML as backup
      if (inputField.textContent !== fullPrompt) {
        inputField.innerHTML = fullPrompt;
      }
      
      // Trigger comprehensive React state updates
      inputField.dispatchEvent(new Event('input', { bubbles: true }));
      inputField.dispatchEvent(new Event('change', { bubbles: true }));
      inputField.dispatchEvent(new Event('beforeinput', { bubbles: true }));
      
      console.log('🔄 DEBUG FALLBACK: ContentEditable content set to length:', inputField.textContent.length);
    }
    
    inputField.focus();
    
    // Auto-submit the fallback prompt
    setTimeout(() => {
      submitMessage();
      resetPromptSplittingState();
    }, 1000);
    
  } catch (error) {
    console.error('❌ Error in splitting fallback:', error);
    resetPromptSplittingState();
    throw error;
  }
}

// Helper function to get default prompt template
function getDefaultPromptTemplate() {
  return `You are a professional real estate investment analyst. Please analyze this property listing and provide a comprehensive assessment focusing on the following key data points that will be used for Excel export and comparison:

**REQUIRED DATA EXTRACTION:**
1. **Street Name**: Property street address (e.g., "123 Main Street")
2. **Property Price**: Exact asking price (include currency symbol)
3. **Number of Bedrooms**: Number of bedrooms (numeric)
4. **Type of Property**: Classify as "House" or "Apartment" (or specific type like "Condo", "Townhouse", etc.)

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
}

// Third prompt: Tabular Data Extraction Template
function getTabularDataExtractionPrompt() {
  return `You are a professional real estate data analyst specializing in extracting structured property data for investment analysis. Please analyze the provided property listing and extract the following data points in a structured tabular format suitable for spreadsheet import and export.

**TABULAR OUTPUT FORMAT REQUIREMENTS:**
- Provide your analysis in a structured tabular format suitable for spreadsheet import and export
- Use clear column headers and consistent data formatting
- Include currency symbols, proper number formatting, and standardized text
- Organize data in rows and columns with clear labels
- Format output as a table that can be easily copied into Excel or Google Sheets

**PROPERTY DATA EXTRACTION REQUIREMENTS:**

**BASIC PROPERTY INFORMATION:**
1. Property Address: Extract the complete street address
2. Asking Price: Extract the exact asking price (include currency symbol)
3. Property Type: Classify as House, Apartment, Condo, Townhouse, etc.
4. Bedrooms: Number of bedrooms (numeric only)
5. Bathrooms: Number of bathrooms (include half baths as .5)
6. Square Footage: Total square footage (numeric only)
7. Year Built: Construction year (4-digit year)
8. Lot Size: Lot size in square feet (if available)
9. Neighborhood: Property neighborhood or area name
10. City: City name
11. State: State name
12. ZIP Code: ZIP code (if available)

**MARKET DATA:**
13. Estimated Monthly Rent: Your professional estimate based on local market rates
14. Location Score: Rate location quality 1-10 (consider schools, safety, amenities, transportation)
15. Market Trend: Current market direction (Rising, Stable, Declining)
16. Days on Market: Number of days listed (if available)
17. Price History: Any price changes (if available)

**PROPERTY FEATURES:**
18. Parking Spaces: Number of parking spaces
19. Garage Type: Attached, Detached, None
20. Heating Type: Type of heating system
21. Cooling Type: Type of cooling system
22. Appliances Included: List of included appliances
23. Amenities: Property amenities and features

**INVESTMENT ANALYSIS:**
24. Key Advantages: Top 3 property advantages for investment
25. Key Concerns: Top 3 property limitations or concerns
26. Red Flags: Any warning signs or risk indicators
27. Investment Grade: Overall investment grade (A, B, C, D)
28. Rental Potential: Rental market assessment
29. Appreciation Potential: Long-term appreciation outlook

**MARKET ANALYSIS:**
30. Market Type: Buyer's market, Seller's market, or Balanced
31. Market Cycle: Current market cycle phase
32. Inventory Level: Current inventory level (Low, Medium, High)
33. Demand Level: Current demand level (Low, Medium, High)
34. Job Growth Rate: Local job growth percentage
35. Population Growth Rate: Local population growth percentage
36. Income Growth Rate: Local income growth percentage
37. Unemployment Rate: Local unemployment rate
38. New Construction Level: Level of new construction activity
39. Infrastructure Development: Infrastructure development status
40. Commercial Development: Commercial development activity
41. School Quality Rating: Local school quality (1-10)

**DATA FORMAT REQUIREMENTS:**
- Use exact numbers and percentages where applicable
- Include currency symbols for monetary values
- Use consistent text formatting for categorical data
- Mark unavailable data as "N/A" or leave blank
- Ensure all numeric values are properly formatted
- Use standardized abbreviations for consistency

**CALCULATION INSTRUCTIONS:**
For the following calculated metrics, provide the calculation steps:

**Basic Calculations:**
- Price per Square Foot = Asking Price ÷ Square Footage
- Rent per Square Foot = Estimated Monthly Rent ÷ Square Footage
- Property Age = Current Year - Year Built
- Bedroom Ratio = Bedrooms ÷ (Bedrooms + Bathrooms)

**Investment Metrics:**
- Gross Rent Multiplier = Asking Price ÷ (Estimated Monthly Rent × 12)
- Cap Rate = (Estimated Monthly Rent × 12) ÷ Asking Price × 100
- 1% Rule Ratio = Estimated Monthly Rent ÷ Asking Price × 100
- Price-to-Rent Ratio = Asking Price ÷ (Estimated Monthly Rent × 12)

**Risk Assessment:**
- Vacancy Risk Score: 1-10 based on market demand and property appeal
- Maintenance Risk Score: 1-10 based on property age and condition
- Market Risk Score: 1-10 based on market stability and trends
- Overall Risk Score = (Vacancy Risk + Maintenance Risk + Market Risk) ÷ 3

**Market Analysis:**
- Location Premium = (Location Score - 5) × 2
- Days on Market Score: 1-10 based on DOM relative to market average
- Price Trend Score: 1-10 based on price history and market direction

**TABULAR OUTPUT FORMAT:**
Please provide your analysis in the following structured tabular format:

**PROPERTY DATA TABLE:**
| Data Point | Value |
|------------|-------|
| Property Address | [Extract complete address] |
| Asking Price | [Include currency symbol] |
| Property Type | [House/Apartment/Condo/etc.] |
| Bedrooms | [Numeric value] |
| Bathrooms | [Include .5 for half baths] |
| Square Footage | [Numeric value] |
| Year Built | [4-digit year] |
| Lot Size | [Square feet or N/A] |
| Neighborhood | [Area name] |
| City | [City name] |
| State | [State name] |
| ZIP Code | [ZIP code or N/A] |
| Estimated Monthly Rent | [Professional estimate with $] |
| Location Score | [1-10 rating] |
| Market Trend | [Rising/Stable/Declining] |
| Days on Market | [Number or N/A] |
| Price History | [Changes or N/A] |
| Parking Spaces | [Number] |
| Garage Type | [Attached/Detached/None] |
| Heating Type | [System type] |
| Cooling Type | [System type] |
| Appliances Included | [List] |
| Amenities | [Features list] |
| Key Advantages | [Top 3 for investment] |
| Key Concerns | [Top 3 limitations] |
| Red Flags | [Warning signs] |
| Investment Grade | [A/B/C/D] |
| Rental Potential | [Assessment] |
| Appreciation Potential | [Outlook] |

**CALCULATED METRICS TABLE:**
| Metric | Value | Calculation |
|--------|-------|-------------|
| Price per Sq Ft | [Value] | [Asking Price ÷ Square Footage] |
| Rent per Sq Ft | [Value] | [Monthly Rent ÷ Square Footage] |
| Property Age | [Years] | [Current Year - Year Built] |
| Gross Rent Multiplier | [Value] | [Price ÷ (Monthly Rent × 12)] |
| Cap Rate | [%] | [(Monthly Rent × 12) ÷ Price × 100] |
| 1% Rule Ratio | [%] | [Monthly Rent ÷ Price × 100] |

**MARKET ANALYSIS TABLE:**
| Market Factor | Value | Assessment |
|---------------|-------|------------|
| Market Type | [Buyer's/Seller's/Balanced] | [Analysis] |
| Inventory Level | [Low/Medium/High] | [Current state] |
| Demand Level | [Low/Medium/High] | [Current demand] |
| Job Growth Rate | [%] | [Local rate] |
| Population Growth | [%] | [Local rate] |
| School Quality | [1-10] | [Rating] |

**RISK ASSESSMENT TABLE:**
| Risk Factor | Score (1-10) | Justification |
|-------------|--------------|---------------|
| Vacancy Risk | [Score] | [Market demand factors] |
| Maintenance Risk | [Score] | [Age and condition factors] |
| Market Risk | [Score] | [Market stability factors] |
| Overall Risk | [Average] | [Combined assessment] |

Property Link: {PROPERTY_URL}
Analysis Date: {DATE}

Focus on data accuracy and provide specific, measurable values in tabular format that can be easily imported into spreadsheets for property comparison and investment decision-making.`;
}

// Default dynamic prompt template with column placeholders
function getDefaultDynamicPromptTemplate() {
  return `You are a professional real estate analyst. Please analyze the provided property listing and extract the following specific data points for investment analysis.

**PROPERTY ANALYSIS REQUEST:**

Please extract the following information from the property listing:

{{COLUMNS}}

**INSTRUCTIONS:**
- Provide accurate, specific data for each requested field
- Use "N/A" if information is not available in the listing
- Include currency symbols for monetary values ($)
- Use consistent formats for dates, percentages, and numbers
- Focus on extracting factual data rather than subjective assessments

**OUTPUT FORMAT:**
Please organize your response with clear labels for each data point, making it easy to extract the specific information requested.

Property URL: {PROPERTY_URL}
Analysis Date: {DATE}

Thank you for providing accurate, structured data for investment analysis.`;
}

// Default tabular prompt template with placeholder for columns
function getDefaultTabularPromptTemplate() {
  return `You are a professional real estate data analyst specializing in extracting structured property data for investment analysis. Please analyze the provided property listing and extract the following data points in a structured tabular format suitable for spreadsheet import and export.

**TABULAR OUTPUT FORMAT REQUIREMENTS:**
- Provide your analysis in a structured tabular format suitable for spreadsheet import and export
- Use clear column headers and consistent data formatting
- Include currency symbols, proper number formatting, and standardized text
- Organize data in rows and columns with clear labels
- Format output as a table that can be easily copied into Excel or Google Sheets

**PROPERTY DATA EXTRACTION REQUIREMENTS:**

{{COLUMNS}}

**DATA FORMAT REQUIREMENTS:**
- Use exact numbers and percentages where applicable
- Include currency symbols for monetary values
- Use consistent text formatting for categorical data
- Mark unavailable data as "N/A" or leave blank
- Ensure all numeric values are properly formatted
- Use standardized abbreviations for consistency

**TABULAR OUTPUT FORMAT:**
Please provide your analysis in a structured tabular format with the following structure:

**PROPERTY DATA TABLE:**
| Data Point | Value |
|------------|-------|
[For each requested data point above, create a row with the data point name and extracted value]

**CALCULATED METRICS TABLE:** (if applicable)
| Metric | Value | Calculation |
|--------|-------|-------------|
[Include any calculated metrics with their values and formulas]

**ANALYSIS SUMMARY TABLE:** (if applicable)
| Analysis Factor | Assessment | Details |
|-----------------|------------|---------|
[Include qualitative analysis points in tabular format]

Property Link: {PROPERTY_URL}
Analysis Date: {DATE}

Focus on data accuracy and provide specific, measurable values in tabular format that can be easily imported into spreadsheets for property comparison and investment decision-making.`;
}

// Function to generate tabular prompt with selected columns
async function getTabularDataExtractionPromptWithColumns(enabledColumnIds) {
  try {
    // Get all available columns
    const allColumns = getTabularDataColumns();
    
    // Filter to enabled columns
    const enabledColumns = allColumns.filter(col => enabledColumnIds.includes(col.id));
    
    if (enabledColumns.length === 0) {
      return getTabularDataExtractionPrompt(); // Fallback to full prompt
    }
    
    // Group columns by category for organized prompt
    const categorizedColumns = {};
    enabledColumns.forEach(col => {
      const category = col.category || 'other';
      if (!categorizedColumns[category]) {
        categorizedColumns[category] = [];
      }
      categorizedColumns[category].push(col);
    });
    
    // Build prompt sections
    let promptSections = [];
    
    // Build sections based on enabled columns
    if (categorizedColumns.core) {
      promptSections.push(buildBasicPropertySection(categorizedColumns.core));
    }
    
    if (categorizedColumns.location) {
      promptSections.push(buildLocationSection(categorizedColumns.location));
    }
    
    if (categorizedColumns.financial || categorizedColumns.market) {
      const marketCols = [...(categorizedColumns.financial || []), ...(categorizedColumns.market || [])];
      promptSections.push(buildMarketDataSection(marketCols));
    }
    
    if (categorizedColumns.features) {
      promptSections.push(buildPropertyFeaturesSection(categorizedColumns.features));
    }
    
    if (categorizedColumns.analysis) {
      promptSections.push(buildInvestmentAnalysisSection(categorizedColumns.analysis));
    }
    
    if (categorizedColumns.calculated || categorizedColumns.risk || categorizedColumns.scoring) {
      const analysisCols = [...(categorizedColumns.calculated || []), ...(categorizedColumns.risk || []), ...(categorizedColumns.scoring || [])];
      promptSections.push(buildCalculatedMetricsSection(analysisCols));
    }
    
    // Build complete prompt
    const customPrompt = `You are a professional real estate data analyst specializing in extracting structured property data for investment analysis. Please analyze the provided property listing and extract the following data points in a structured tabular format suitable for spreadsheet import and export.

**TABULAR OUTPUT FORMAT REQUIREMENTS:**
- Provide your analysis in a structured tabular format suitable for spreadsheet import and export
- Use clear column headers and consistent data formatting
- Include currency symbols, proper number formatting, and standardized text
- Organize data in rows and columns with clear labels
- Format output as a table that can be easily copied into Excel or Google Sheets

**PROPERTY DATA EXTRACTION REQUIREMENTS:**

${promptSections.join('\n\n')}

**DATA FORMAT REQUIREMENTS:**
- Use exact numbers and percentages where applicable
- Include currency symbols for monetary values
- Use consistent text formatting for categorical data
- Mark unavailable data as "N/A" or leave blank
- Ensure all numeric values are properly formatted
- Use standardized abbreviations for consistency

**TABULAR OUTPUT FORMAT:**
Please provide your analysis in the following structured tabular format:

**PROPERTY DATA TABLE:**
| Data Point | Value |
|------------|-------|
[Create a row for each requested data point above with the data point name and extracted value]

**CALCULATED METRICS TABLE:** (if applicable)
| Metric | Value | Calculation |
|--------|-------|-------------|
[Include any calculated metrics with their values and formulas]

**ANALYSIS SUMMARY TABLE:** (if applicable)
| Analysis Factor | Assessment | Details |
|-----------------|------------|---------|
[Include qualitative analysis points in tabular format]

Property Link: {PROPERTY_URL}
Analysis Date: {DATE}

Focus on data accuracy and provide specific, measurable values in tabular format that can be easily imported into spreadsheets for property comparison and investment decision-making.`;

    return customPrompt;
    
  } catch (error) {
    console.error('Error generating custom tabular prompt:', error);
    return getTabularDataExtractionPrompt(); // Fallback
  }
}

// Helper functions to build prompt sections
function buildBasicPropertySection(columns) {
  const dataPoints = columns.map((col, index) => {
    const descriptions = {
      'propertyAddress': 'Property Address: Extract the complete street address',
      'askingPrice': 'Asking Price: Extract the exact asking price (include currency symbol)',
      'propertyType': 'Property Type: Classify as House, Apartment, Condo, Townhouse, etc.',
      'bedrooms': 'Bedrooms: Number of bedrooms (numeric only)',
      'bathrooms': 'Bathrooms: Number of bathrooms (include half baths as .5)',
      'squareFootage': 'Square Footage: Total square footage (numeric only)',
      'yearBuilt': 'Year Built: Construction year (4-digit year)',
      'lotSize': 'Lot Size: Lot size in square feet (if available)'
    };
    
    const description = descriptions[col.id] || `${col.name}: ${col.description || 'Extract this data point'}`;
    return `${index + 1}. ${description}`;
  });
  
  return `**BASIC PROPERTY INFORMATION:**\n${dataPoints.join('\n')}`;
}

function buildLocationSection(columns) {
  const dataPoints = columns.map((col, index) => {
    const descriptions = {
      'neighborhood': 'Neighborhood: Property neighborhood or area name',
      'city': 'City: City name',
      'state': 'State: State name',
      'zipCode': 'ZIP Code: ZIP code (if available)',
      'schoolQuality': 'School Quality Rating: Local school quality (1-10)'
    };
    
    const description = descriptions[col.id] || `${col.name}: ${col.description || 'Extract this data point'}`;
    return `${index + 1}. ${description}`;
  });
  
  return `**LOCATION & GEOGRAPHY:**\n${dataPoints.join('\n')}`;
}

function buildMarketDataSection(columns) {
  const dataPoints = columns.map((col, index) => {
    const descriptions = {
      'estimatedRent': 'Estimated Monthly Rent: Your professional estimate based on local market rates',
      'locationScore': 'Location Score: Rate location quality 1-10 (consider schools, safety, amenities, transportation)',
      'marketTrend': 'Market Trend: Current market direction (Rising, Stable, Declining)',
      'daysOnMarket': 'Days on Market: Number of days listed (if available)',
      'priceHistory': 'Price History: Any price changes (if available)',
      'marketType': 'Market Type: Buyer\'s market, Seller\'s market, or Balanced',
      'jobGrowth': 'Job Growth Rate: Local job growth percentage',
      'populationGrowth': 'Population Growth Rate: Local population growth percentage'
    };
    
    const description = descriptions[col.id] || `${col.name}: ${col.description || 'Extract this data point'}`;
    return `${index + 1}. ${description}`;
  });
  
  return `**MARKET DATA:**\n${dataPoints.join('\n')}`;
}

function buildPropertyFeaturesSection(columns) {
  const dataPoints = columns.map((col, index) => {
    const descriptions = {
      'parkingSpaces': 'Parking Spaces: Number of parking spaces',
      'garageType': 'Garage Type: Attached, Detached, None',
      'heatingType': 'Heating Type: Type of heating system',
      'coolingType': 'Cooling Type: Type of cooling system',
      'appliances': 'Appliances Included: List of included appliances',
      'amenities': 'Amenities: Property amenities and features'
    };
    
    const description = descriptions[col.id] || `${col.name}: ${col.description || 'Extract this data point'}`;
    return `${index + 1}. ${description}`;
  });
  
  return `**PROPERTY FEATURES:**\n${dataPoints.join('\n')}`;
}

function buildInvestmentAnalysisSection(columns) {
  const dataPoints = columns.map((col, index) => {
    const descriptions = {
      'keyAdvantages': 'Key Advantages: Top 3 property advantages for investment',
      'keyConcerns': 'Key Concerns: Top 3 property limitations or concerns',
      'redFlags': 'Red Flags: Any warning signs or risk indicators',
      'investmentGrade': 'Investment Grade: Overall investment grade (A, B, C, D)',
      'rentalPotential': 'Rental Potential: Rental market assessment',
      'appreciationPotential': 'Appreciation Potential: Long-term appreciation outlook'
    };
    
    const description = descriptions[col.id] || `${col.name}: ${col.description || 'Extract this data point'}`;
    return `${index + 1}. ${description}`;
  });
  
  return `**INVESTMENT ANALYSIS:**\n${dataPoints.join('\n')}`;
}

function buildCalculatedMetricsSection(columns) {
  const calculationInstructions = [];
  
  columns.forEach(col => {
    if (col.isCalculated) {
      const instructions = {
        'pricePerSqFt': 'Price per Square Foot = Asking Price ÷ Square Footage',
        'capRate': 'Cap Rate = (Estimated Monthly Rent × 12) ÷ Asking Price × 100',
        'onePercentRule': '1% Rule Ratio = Estimated Monthly Rent ÷ Asking Price × 100',
        'vacancyRisk': 'Vacancy Risk Score: 1-10 based on market demand and property appeal',
        'maintenanceRisk': 'Maintenance Risk Score: 1-10 based on property age and condition',
        'locationPremium': 'Location Premium = (Location Score - 5) × 2'
      };
      
      if (instructions[col.id]) {
        calculationInstructions.push(`- ${instructions[col.id]}`);
      }
    }
  });
  
  if (calculationInstructions.length > 0) {
    return `**CALCULATED METRICS:**\nFor the following metrics, provide the calculation steps:\n${calculationInstructions.join('\n')}`;
  }
  
  return '';
}

// Helper function to generate columns section for prompt templates
function generateColumnsSectionForPrompt(columns) {
  // Group columns by category for organized output
  const categorized = {};
  columns.forEach(col => {
    const category = col.category || 'other';
    if (!categorized[category]) {
      categorized[category] = [];
    }
    categorized[category].push(col);
  });
  
  const sections = [];
  const categoryNames = {
    'core': 'BASIC PROPERTY INFORMATION',
    'location': 'LOCATION & GEOGRAPHY', 
    'financial': 'FINANCIAL DATA',
    'features': 'PROPERTY FEATURES',
    'analysis': 'INVESTMENT ANALYSIS',
    'market': 'MARKET ANALYSIS',
    'calculated': 'CALCULATED METRICS',
    'risk': 'RISK ASSESSMENT',
    'scoring': 'SCORING & RATINGS',
    'custom': 'CUSTOM DATA POINTS'
  };
  
  Object.entries(categorized).forEach(([category, cols]) => {
    const sectionName = categoryNames[category] || category.toUpperCase();
    const dataPoints = cols.map((col, index) => {
      const description = col.description || `Extract ${col.name}`;
      return `${index + 1}. ${col.name}: ${description}`;
    });
    
    sections.push(`**${sectionName}:**\n${dataPoints.join('\n')}`);
  });
  
  return sections.join('\n\n');
}

// Helper function to get custom columns statically (for use in non-UI contexts)
async function getCustomColumnsStatic() {
  try {
    const result = await safeChromeFall(
      () => chrome.storage.local.get(['customColumns']),
      { customColumns: [] }
    );
    return result.customColumns || [];
  } catch (error) {
    console.error('Failed to get custom columns:', error);
    return [];
  }
}

// Function to get the selected prompt based on user preference
async function getSelectedPrompt(promptType, customPrompt, columnConfiguration) {
  try {
    switch (promptType) {
      case 'tabular':
        // Check if we have a custom template
        const templateResult = await safeChromeFall(
          () => chrome.storage.local.get(['tabularPromptTemplate', 'tabularColumnConfiguration', 'customColumns']),
          { tabularPromptTemplate: null, tabularColumnConfiguration: null, customColumns: [] }
        );
        
        // Use custom template if available
        if (templateResult.tabularPromptTemplate) {
          // Get enabled columns
          let enabledColumns = [];
          if (templateResult.tabularColumnConfiguration) {
            enabledColumns = templateResult.tabularColumnConfiguration
              .filter(col => col.enabled)
              .map(col => col.id);
          }
          
          // Get all columns (built-in + custom)
          const defaultColumns = getTabularDataColumns();
          const customColumns = templateResult.customColumns || [];
          const allColumns = [...defaultColumns, ...customColumns];
          
          // Generate columns section if we have enabled columns
          if (enabledColumns.length > 0) {
            const selectedColumns = allColumns.filter(col => enabledColumns.includes(col.id));
            const columnsSection = generateColumnsSectionForPrompt(selectedColumns);
            
            // Replace template placeholders
            return templateResult.tabularPromptTemplate.replace(/\{\{COLUMNS\}\}/g, columnsSection);
          } else {
            // Return template without columns replacement
            return templateResult.tabularPromptTemplate;
          }
        }
        
        // Check if we have saved column configuration for default prompt
        if (templateResult.tabularColumnConfiguration) {
          // Use columns selected by user with default prompt structure
          const enabledColumns = templateResult.tabularColumnConfiguration
            .filter(col => col.enabled)
            .map(col => col.id);
          
          if (enabledColumns.length > 0) {
            return await getTabularDataExtractionPromptWithColumns(enabledColumns);
          }
        }
        
        // Fallback to full tabular prompt
        return getTabularDataExtractionPrompt();
        
      case 'dynamic':
        // Check if user has custom dynamic template
        const dynamicResult = await safeChromeFall(
          () => chrome.storage.local.get(['dynamicPromptTemplate', 'dynamicPromptColumns']),
          { dynamicPromptTemplate: null, dynamicPromptColumns: null }
        );
        
        if (dynamicResult.dynamicPromptTemplate) {
          // Get enabled columns
          const enabledColumns = dynamicResult.dynamicPromptColumns || [];
          
          // Generate columns section
          let columnsSection = '';
          if (enabledColumns.length > 0) {
            const allColumns = [...getTabularDataColumns(), ...await getCustomColumnsStatic()];
            const selectedColumns = allColumns.filter(col => enabledColumns.includes(col.id));
            columnsSection = generateColumnsSectionForPrompt(selectedColumns);
          }
          
          // Replace template placeholders
          return dynamicResult.dynamicPromptTemplate.replace(/\{\{COLUMNS\}\}/g, columnsSection);
        }
        
        // Fallback to default dynamic generation
        return await generateDynamicPrompt();
        
      case 'custom':
        return customPrompt || getDefaultPromptTemplate();
        
      case 'default':
      default:
        // Check if user has custom default template
        const defaultResult = await safeChromeFall(
          () => chrome.storage.local.get(['defaultPromptTemplate']),
          { defaultPromptTemplate: null }
        );
        
        if (defaultResult.defaultPromptTemplate) {
          return defaultResult.defaultPromptTemplate;
        }
        
        // Check if user has custom prompt set, otherwise use built-in default
        return customPrompt || getDefaultPromptTemplate();
    }
  } catch (error) {
    console.error('Error selecting prompt:', error);
    return getDefaultPromptTemplate();
  }
}

// Dynamic prompt generation based on user's column selection
async function generateDynamicPrompt() {
  try {
    // Get user's column configuration
    const columnResult = await safeChromeFall(
      () => chrome.storage.local.get(['columnConfiguration']),
      { columnConfiguration: null }
    );
    const columnConfig = columnResult.columnConfiguration || getDefaultColumns();
    
    // Filter to enabled columns
    const enabledColumns = columnConfig.filter(col => col.enabled);
    
    // Generate prompt sections based on enabled columns
    const promptSections = [];
    
    // Core property details
    const coreColumns = enabledColumns.filter(col => col.category === 'core');
    if (coreColumns.length > 0) {
      promptSections.push(generateCorePropertySection(coreColumns));
    }
    
    // Financial metrics
    const financialColumns = enabledColumns.filter(col => col.category === 'financial');
    if (financialColumns.length > 0) {
      promptSections.push(generateFinancialSection(financialColumns));
    }
    
    // Location and scoring
    const scoringColumns = enabledColumns.filter(col => col.category === 'scoring');
    if (scoringColumns.length > 0) {
      promptSections.push(generateLocationSection(scoringColumns));
    }
    
    // Analysis data
    const analysisColumns = enabledColumns.filter(col => col.category === 'analysis');
    if (analysisColumns.length > 0) {
      promptSections.push(generateAnalysisSection(analysisColumns));
    }
    
    // Custom columns
    const customColumns = enabledColumns.filter(col => col.isCustom);
    if (customColumns.length > 0) {
      promptSections.push(generateCustomColumnsSection(customColumns));
    }
    
    // Combine sections into final prompt
    const dynamicPrompt = combinePromptSections(promptSections);
    
    return dynamicPrompt;
  } catch (error) {
    console.error('Error generating dynamic prompt:', error);
    return getDefaultPromptTemplate();
  }
}

function getDefaultColumns() {
  // Default columns matching popup.js specification
  return [
    { id: 'streetName', name: 'Street Name', category: 'core', enabled: true },
    { id: 'price', name: 'Property Price', category: 'core', enabled: true },
    { id: 'bedrooms', name: 'Number of Bedrooms', category: 'core', enabled: true },
    { id: 'propertyType', name: 'Type of Property', category: 'core', enabled: true }
  ];
}

// Comprehensive column set for tabular data extraction
function getTabularDataColumns() {
  return [
    // Basic Property Information
    { id: 'propertyAddress', name: 'Property Address', description: 'Complete street address of the property', type: 'text', category: 'core', enabled: true, required: true },
    { id: 'askingPrice', name: 'Asking Price', description: 'Listed price with currency symbol', type: 'currency', category: 'core', enabled: true, required: true },
    { id: 'propertyType', name: 'Property Type', description: 'Classification (House, Condo, Apartment, etc.)', type: 'text', category: 'core', enabled: true, required: true },
    { id: 'bedrooms', name: 'Bedrooms', description: 'Number of bedrooms in the property', type: 'number', category: 'core', enabled: true, required: true },
    { id: 'bathrooms', name: 'Bathrooms', description: 'Number of bathrooms (include half baths as .5)', type: 'number', category: 'core', enabled: true, required: true },
    { id: 'squareFootage', name: 'Square Footage', description: 'Total interior square footage', type: 'number', category: 'core', enabled: true, required: false },
    { id: 'yearBuilt', name: 'Year Built', description: 'Year the property was constructed', type: 'number', category: 'core', enabled: true, required: false },
    { id: 'lotSize', name: 'Lot Size (sq ft)', description: 'Size of the lot in square feet', type: 'number', category: 'core', enabled: true, required: false },
    { id: 'neighborhood', name: 'Neighborhood', description: 'Name of the neighborhood or area', type: 'text', category: 'location', enabled: true, required: false },
    { id: 'city', name: 'City', description: 'City where the property is located', type: 'text', category: 'location', enabled: true, required: true },
    { id: 'state', name: 'State', description: 'State where the property is located', type: 'text', category: 'location', enabled: true, required: true },
    { id: 'zipCode', name: 'ZIP Code', description: 'Postal ZIP code of the property', type: 'text', category: 'location', enabled: true, required: false },
    
    // Market Data
    { id: 'estimatedRent', name: 'Estimated Monthly Rent', description: 'Professional estimate of monthly rental income', type: 'currency', category: 'financial', enabled: true, required: false },
    { id: 'locationScore', name: 'Location Score (1-10)', description: 'Rating of location quality (schools, safety, amenities)', type: 'number', category: 'scoring', enabled: true, required: false },
    { id: 'marketTrend', name: 'Market Trend', description: 'Current market direction (Rising, Stable, Declining)', type: 'text', category: 'analysis', enabled: true, required: false },
    { id: 'daysOnMarket', name: 'Days on Market', description: 'Number of days the property has been listed', type: 'number', category: 'market', enabled: true, required: false },
    { id: 'priceHistory', name: 'Price History', description: 'Any recent price changes or reductions', type: 'text', category: 'market', enabled: true, required: false },
    
    // Property Features
    { id: 'parkingSpaces', name: 'Parking Spaces', description: 'Number of available parking spaces', type: 'number', category: 'features', enabled: true, required: false },
    { id: 'garageType', name: 'Garage Type', description: 'Type of garage (Attached, Detached, None)', type: 'text', category: 'features', enabled: true, required: false },
    { id: 'heatingType', name: 'Heating Type', description: 'Type of heating system in the property', type: 'text', category: 'features', enabled: true, required: false },
    { id: 'coolingType', name: 'Cooling Type', description: 'Type of cooling/AC system in the property', type: 'text', category: 'features', enabled: true, required: false },
    { id: 'appliances', name: 'Appliances Included', description: 'List of appliances that come with the property', type: 'text', category: 'features', enabled: true, required: false },
    { id: 'amenities', name: 'Amenities', description: 'Property amenities and special features', type: 'text', category: 'features', enabled: true, required: false },
    
    // Analysis Data
    { id: 'keyAdvantages', name: 'Key Advantages', description: 'Top 3 advantages for investment purposes', type: 'text', category: 'analysis', enabled: true, required: false },
    { id: 'keyConcerns', name: 'Key Concerns', description: 'Top 3 concerns or potential issues', type: 'text', category: 'analysis', enabled: true, required: false },
    { id: 'redFlags', name: 'Red Flags', description: 'Warning signs or serious risk indicators', type: 'text', category: 'analysis', enabled: true, required: false },
    { id: 'investmentGrade', name: 'Investment Grade', description: 'Overall investment quality grade (A, B, C, D)', type: 'text', category: 'analysis', enabled: true, required: false },
    { id: 'rentalPotential', name: 'Rental Potential', description: 'Assessment of rental market viability', type: 'text', category: 'analysis', enabled: true, required: false },
    { id: 'appreciationPotential', name: 'Appreciation Potential', description: 'Long-term property value growth outlook', type: 'text', category: 'analysis', enabled: true, required: false },
    
    // Market Analysis
    { id: 'marketType', name: 'Market Type', description: 'Current market condition (Buyer\'s, Seller\'s, Balanced)', type: 'text', category: 'market', enabled: true, required: false },
    { id: 'marketCycle', name: 'Market Cycle', description: 'Current phase of the real estate market cycle', type: 'text', category: 'market', enabled: true, required: false },
    { id: 'inventoryLevel', name: 'Inventory Level', description: 'Current housing inventory level (Low, Medium, High)', type: 'text', category: 'market', enabled: true, required: false },
    { id: 'demandLevel', name: 'Demand Level', description: 'Current buyer demand level (Low, Medium, High)', type: 'text', category: 'market', enabled: true, required: false },
    { id: 'jobGrowth', name: 'Job Growth Rate', description: 'Local employment growth rate percentage', type: 'percentage', category: 'market', enabled: true, required: false },
    { id: 'populationGrowth', name: 'Population Growth Rate', description: 'Local population growth rate percentage', type: 'percentage', category: 'market', enabled: true, required: false },
    { id: 'incomeGrowth', name: 'Income Growth Rate', description: 'Local median income growth rate percentage', type: 'percentage', category: 'market', enabled: true, required: false },
    { id: 'unemploymentRate', name: 'Unemployment Rate', description: 'Local unemployment rate percentage', type: 'percentage', category: 'market', enabled: true, required: false },
    { id: 'newConstruction', name: 'New Construction Level', description: 'Level of new construction activity in the area', type: 'text', category: 'market', enabled: true, required: false },
    { id: 'infrastructureDev', name: 'Infrastructure Development', description: 'Status of infrastructure development projects', type: 'text', category: 'market', enabled: true, required: false },
    { id: 'commercialDev', name: 'Commercial Development', description: 'Commercial development activity in the area', type: 'text', category: 'market', enabled: true, required: false },
    { id: 'schoolQuality', name: 'School Quality Rating', description: 'Local school quality rating (1-10 scale)', type: 'number', category: 'location', enabled: true, required: false },
    
    // Calculated Metrics
    { id: 'pricePerSqFt', name: 'Price per Sq Ft', description: 'Asking price divided by square footage', type: 'currency', category: 'calculated', enabled: true, required: false, isCalculated: true },
    { id: 'rentPerSqFt', name: 'Rent per Sq Ft', description: 'Estimated monthly rent divided by square footage', type: 'currency', category: 'calculated', enabled: true, required: false, isCalculated: true },
    { id: 'propertyAge', name: 'Property Age (Years)', description: 'Current year minus year built', type: 'number', category: 'calculated', enabled: true, required: false, isCalculated: true },
    { id: 'bedroomRatio', name: 'Bedroom Ratio', description: 'Bedrooms divided by total rooms (bed+bath)', type: 'number', category: 'calculated', enabled: true, required: false, isCalculated: true },
    { id: 'grossRentMultiplier', name: 'Gross Rent Multiplier', description: 'Price divided by annual rent (investment metric)', type: 'number', category: 'calculated', enabled: true, required: false, isCalculated: true },
    { id: 'capRate', name: 'Cap Rate (%)', description: 'Annual rental income divided by property price', type: 'percentage', category: 'calculated', enabled: true, required: false, isCalculated: true },
    { id: 'onePercentRule', name: '1% Rule Ratio', description: 'Monthly rent as percentage of purchase price', type: 'percentage', category: 'calculated', enabled: true, required: false, isCalculated: true },
    { id: 'priceToRentRatio', name: 'Price-to-Rent Ratio', description: 'Purchase price divided by annual rent', type: 'number', category: 'calculated', enabled: true, required: false, isCalculated: true },
    
    // Risk Metrics
    { id: 'vacancyRisk', name: 'Vacancy Risk Score', description: 'Risk of vacancy based on demand and appeal (1-10)', type: 'number', category: 'risk', enabled: true, required: false, isCalculated: true },
    { id: 'maintenanceRisk', name: 'Maintenance Risk Score', description: 'Risk of high maintenance costs based on age/condition (1-10)', type: 'number', category: 'risk', enabled: true, required: false, isCalculated: true },
    { id: 'marketRisk', name: 'Market Risk Score', description: 'Risk from market instability and trends (1-10)', type: 'number', category: 'risk', enabled: true, required: false, isCalculated: true },
    { id: 'overallRiskScore', name: 'Overall Risk Score', description: 'Average of all risk scores (1-10)', type: 'number', category: 'risk', enabled: true, required: false, isCalculated: true },
    
    // Market Analysis Calculated
    { id: 'locationPremium', name: 'Location Premium (%)', description: 'Premium/discount based on location score', type: 'percentage', category: 'calculated', enabled: true, required: false, isCalculated: true },
    { id: 'daysOnMarketScore', name: 'Days on Market Score', description: 'Score based on days on market vs. average (1-10)', type: 'number', category: 'calculated', enabled: true, required: false, isCalculated: true },
    { id: 'priceTrendScore', name: 'Price Trend Score', description: 'Score based on price history and market direction (1-10)', type: 'number', category: 'calculated', enabled: true, required: false, isCalculated: true }
  ];
}

function generateCorePropertySection(columns) {
  const dataPoints = [];
  
  columns.forEach(col => {
    switch (col.id) {
      case 'streetName':
        dataPoints.push('**Street Name**: Property street address (e.g., "123 Main Street")');
        break;
      case 'price':
        dataPoints.push('**Property Price**: Exact asking price (include currency symbol)');
        break;
      case 'bedrooms':
        dataPoints.push('**Number of Bedrooms**: Number of bedrooms (numeric)');
        break;
      case 'bathrooms':
        dataPoints.push('**Bathrooms**: Number of bathrooms (numeric, include half baths as .5)');
        break;
      case 'squareFeet':
        dataPoints.push('**Square Footage**: Total square footage (numeric)');
        break;
      case 'yearBuilt':
        dataPoints.push('**Year Built**: Construction year (4-digit year)');
        break;
      case 'propertyType':
        dataPoints.push('**Type of Property**: Classify as "House" or "Apartment" (or specific type like "Condo", "Townhouse", etc.)');
        break;
      case 'neighborhood':
        dataPoints.push('**Neighborhood**: Property location/neighborhood name');
        break;
    }
  });
  
  return dataPoints.length > 0 ? `**REQUIRED DATA EXTRACTION:**\n${dataPoints.map((point, index) => `${index + 1}. ${point}`).join('\n')}` : '';
}

function generateFinancialSection(columns) {
  const dataPoints = [];
  
  columns.forEach(col => {
    switch (col.id) {
      case 'estimatedRentalIncome':
        dataPoints.push('**Estimated Monthly Rental Income**: Your professional estimate based on local market rates');
        break;
      case 'pricePerSqFt':
        dataPoints.push('**Price per Square Foot**: Calculated value for investment analysis');
        break;
      case 'capRate':
        dataPoints.push('**Cap Rate**: Annual return percentage based on rental income');
        break;
      case 'onePercentRule':
        dataPoints.push('**1% Rule Assessment**: Monthly rent to price ratio for quick investment evaluation');
        break;
    }
  });
  
  return dataPoints.length > 0 ? `**FINANCIAL ANALYSIS:**\n${dataPoints.join('\n')}` : '';
}

function generateLocationSection(columns) {
  const dataPoints = [];
  
  columns.forEach(col => {
    switch (col.id) {
      case 'locationScore':
        dataPoints.push('**Location & Neighborhood Scoring**: Rate the location quality as X/10 (e.g., 7/10, 9/10) considering schools, safety, amenities, transportation');
        break;
      case 'rentalGrowthPotential':
        dataPoints.push('**Rental Growth Potential**: Assess as "Growth: High", "Growth: Strong", "Growth: Moderate", "Growth: Low", or "Growth: Limited" based on area development and market trends');
        break;
    }
  });
  
  return dataPoints.length > 0 ? `**LOCATION & MARKET ANALYSIS:**\n${dataPoints.join('\n')}` : '';
}

function generateAnalysisSection(columns) {
  const dataPoints = [];
  
  columns.forEach(col => {
    switch (col.id) {
      case 'pros':
        dataPoints.push('**Top 3 Advantages**: Key property advantages for investment');
        break;
      case 'cons':
        dataPoints.push('**Top 3 Concerns**: Main property limitations or concerns');
        break;
      case 'redFlags':
        dataPoints.push('**Red Flags**: Any warning signs or risk indicators');
        break;
      case 'investmentPotential':
        dataPoints.push('**Investment Potential**: Overall investment grade and reasoning');
        break;
      case 'marketAnalysis':
        dataPoints.push('**Market Analysis**: Detailed market assessment and trends');
        break;
    }
  });
  
  return dataPoints.length > 0 ? `**INVESTMENT ANALYSIS:**\n${dataPoints.join('\n')}` : '';
}

function generateCustomColumnsSection(customColumns) {
  const dataPoints = customColumns.map(col => 
    `**${col.name}**: ${col.description || 'Custom data point'}`
  );
  
  return dataPoints.length > 0 ? `**CUSTOM DATA POINTS:**\n${dataPoints.join('\n')}` : '';
}

function combinePromptSections(sections) {
  const validSections = sections.filter(section => section.length > 0);
  
  if (validSections.length === 0) {
    return getDefaultPromptTemplate();
  }
  
  return `You are a professional real estate investment analyst. Please analyze this property listing and provide a comprehensive assessment focusing on the following key data points that will be used for Excel export and comparison:

${validSections.join('\n\n')}

**ANALYSIS STRUCTURE:**
Please organize your response with clear sections based on the data points requested above.

**FORMAT REQUIREMENTS:**
- Use clear headings and bullet points
- Include specific numbers and percentages where possible
- Provide location score in X/10 format if requested
- Categorize rental growth potential clearly if requested
- Be concise but thorough in your analysis

Focus on data accuracy and practical investment considerations that would be valuable for property comparison and decision-making.

Property Link: {PROPERTY_URL}`;
}

// Performance tracking functions for prompt splitting
async function updatePromptSplittingStats(type) {
  try {
    const result = await safeChromeFall(
      () => chrome.storage.local.get(['promptSplittingSettings']),
      { promptSplittingSettings: null }
    );
    
    const settings = result.promptSplittingSettings || {
      enabled: true,
      lengthThreshold: 200, // lowered for dynamic prompts
      confirmationTimeout: 15000,
      stats: { totalAttempts: 0, successfulSplits: 0, fallbacksUsed: 0 }
    };
    
    // Update stats based on type
    switch (type) {
      case 'attempt':
        settings.stats.totalAttempts++;
        console.log('📊 Tracked prompt splitting attempt');
        break;
      case 'success':
        settings.stats.successfulSplits++;
        console.log('📊 Tracked successful prompt split');
        break;
      case 'fallback':
        settings.stats.fallbacksUsed++;
        console.log('📊 Tracked fallback usage');
        break;
    }
    
    // Save updated stats
    await safeChromeFall(
      () => chrome.storage.local.set({ promptSplittingSettings: settings }),
      null
    );
    
  } catch (error) {
    console.warn('Failed to update prompt splitting stats:', error);
  }
}

async function loadPromptSplittingSettings() {
  try {
    const result = await safeChromeFall(
      () => chrome.storage.local.get(['promptSplittingSettings']),
      { promptSplittingSettings: null }
    );
    
    const settings = result.promptSplittingSettings || {
      enabled: true,
      lengthThreshold: 200, // lowered for dynamic prompts  
      confirmationTimeout: 15000,
      stats: { totalAttempts: 0, successfulSplits: 0, fallbacksUsed: 0 }
    };
    
    // Update global state
    promptSplittingState.enabled = settings.enabled;
    promptSplittingState.lengthThreshold = settings.lengthThreshold;
    promptSplittingState.confirmationTimeout = settings.confirmationTimeout;
    
    console.log('✅ Loaded prompt splitting settings:', {
      enabled: settings.enabled,
      threshold: settings.lengthThreshold,
      timeout: settings.confirmationTimeout,
      stats: settings.stats
    });
    
    return settings;
  } catch (error) {
    console.warn('Failed to load prompt splitting settings:', error);
    return null;
  }
}

// Function to extract key information from ChatGPT response
function extractPropertyAnalysisData(responseText) {
  if (!responseText || typeof responseText !== 'string') {
    console.error('❌ Invalid input to extractPropertyAnalysisData:', typeof responseText);
    return null;
  }
  
  // Check cache first for performance optimization
  const cachedResult = getCachedExtraction(responseText);
  if (cachedResult) {
    console.log('🚀 Returning cached extraction result');
    return cachedResult;
  }
  
  // Performance monitoring
  const startTime = performance.now();
  console.log('🔍 Starting comprehensive property data extraction...');
  console.log('📝 Response length:', responseText.length, 'characters');
  
  // Performance warning for very large responses
  if (responseText.length > 50000) {
    console.warn('⚠️ Large response detected:', responseText.length, 'characters - extraction may be slower');
  }
  
      // Update analytics
    extractionAnalytics.totalExtractions++;
    
    const analysis = {
      fullResponse: responseText,
      fullAnalysis: responseText, // Store full analysis for Excel export
      extractedData: {},
      calculatedMetrics: {}, // Store calculated metrics
      timestamp: Date.now(),
      errors: [], // Track any errors during extraction
      warnings: [] // Track any warnings during extraction
    };
  
  try {
  
  // First, try to extract from the structured format sections
  const structuredSections = extractStructuredSections(responseText);
  if (structuredSections.propertyDetails) {
    console.log('✅ Found structured PROPERTY DETAILS section');
    extractFromPropertyDetails(structuredSections.propertyDetails, analysis);
  }
  
  if (structuredSections.locationAnalysis) {
    console.log('✅ Found structured LOCATION & NEIGHBORHOOD ANALYSIS section');
    extractFromLocationAnalysis(structuredSections.locationAnalysis, analysis);
  }
  
  if (structuredSections.rentalAnalysis) {
    console.log('✅ Found structured RENTAL INCOME ANALYSIS section');
    extractFromRentalAnalysis(structuredSections.rentalAnalysis, analysis);
  }
  
  if (structuredSections.investmentSummary) {
    console.log('✅ Found structured INVESTMENT SUMMARY section');
    extractFromInvestmentSummary(structuredSections.investmentSummary, analysis);
  }
  
  // Enhanced extraction with multiple strategies for each data type (fallback for unstructured responses)
  // Pattern performance optimization: Most specific patterns first, broad patterns last
  const extractors = {
    // Street name extraction with comprehensive patterns
    streetName: {
      patterns: [
        // Standard address patterns with street types (with source link support)
        /(?:street\s+name|property\s+address|address)[:\s-]*([^\n,;]+?(?:street|avenue|road|drive|lane|way|boulevard|place|court|circle|st|ave|rd|dr|ln|blvd|pl|ct|cir))(?:\s*[\[\(](?:source|src|from)[:\s]*[^\]\)]+[\]\)])?/gi,
        /(?:located\s+at|property\s+address|situated\s+at)[:\s-]*([^\n,;\[\]]+?)(?:\s*[\[\(](?:source|src|from)[:\s]*[^\]\)]+[\]\)])?/gi,
        /(\d+\s+[A-Za-z0-9\s]+?(?:street|avenue|road|drive|lane|way|boulevard|place|court|circle|st|ave|rd|dr|ln|blvd|pl|ct|cir))(?:\s*[\[\(](?:source|src|from)[:\s]*[^\]\)]+[\]\)])?/gi,
        
        // Apartment/Unit address patterns
        /(\d+\s+[A-Za-z0-9\s]+?(?:street|avenue|road|drive|lane|way|boulevard|place|court|circle|st|ave|rd|dr|ln|blvd|pl|ct|cir),?\s*(?:apt|apartment|unit|suite|ste|#)\s*[A-Za-z0-9-]+)(?:\s*[\[\(](?:source|src|from)[:\s]*[^\]\)]+[\]\)])?/gi,
        /(\d+\s+[A-Za-z0-9\s]+?,?\s*apt\s*[A-Za-z0-9-]+)(?:\s*[\[\(](?:source|src|from)[:\s]*[^\]\)]+[\]\)])?/gi,
        /(\d+\s+[A-Za-z0-9\s]+?,?\s*unit\s*[A-Za-z0-9-]+)(?:\s*[\[\(](?:source|src|from)[:\s]*[^\]\)]+[\]\)])?/gi,
        
        // Directional addresses (N, S, E, W)
        /(\d+\s+[NSEW]\.?\s+[A-Za-z0-9\s]+?(?:street|avenue|road|drive|lane|way|boulevard|place|court|circle|st|ave|rd|dr|ln|blvd|pl|ct|cir))(?:\s*[\[\(](?:source|src|from)[:\s]*[^\]\)]+[\]\)])?/gi,
        /(\d+\s+(?:north|south|east|west)\s+[A-Za-z0-9\s]+?(?:street|avenue|road|drive|lane|way|boulevard|place|court|circle|st|ave|rd|dr|ln|blvd|pl|ct|cir))(?:\s*[\[\(](?:source|src|from)[:\s]*[^\]\)]+[\]\)])?/gi,
        
        // Highway and route addresses
        /(\d+\s+(?:highway|hwy|route|rt|state\s+route|sr|county\s+road|cr)\s+[A-Za-z0-9-]+)(?:\s*[\[\(](?:source|src|from)[:\s]*[^\]\)]+[\]\)])?/gi,
        /(\d+\s+[A-Za-z0-9\s]+\s+highway)(?:\s*[\[\(](?:source|src|from)[:\s]*[^\]\)]+[\]\)])?/gi,
        
        // Rural and named property addresses
        /((?:old|new|historic|heritage|vintage)\s+[A-Za-z0-9\s]+?(?:road|rd|lane|ln|trail|path|way))(?:\s*[\[\(](?:source|src|from)[:\s]*[^\]\)]+[\]\)])?/gi,
        /([A-Za-z0-9\s]+?(?:estates|manor|ranch|farm|acres|hills|heights|view|ridge|creek|river|lake|pond|woods|forest|meadow|grove|gardens|park|square|commons|crossing|bend|valley))(?:\s*[\[\(](?:source|src|from)[:\s]*[^\]\)]+[\]\)])?/gi,
        
        // International format addresses
        /(\d+\s+[A-Za-z0-9\s\-'\.]+?(?:street|avenue|road|drive|lane|way|boulevard|place|court|circle|crescent|close|terrace|row|mews|square|gardens|park|green|walk|path|trail|hill|mount|vista|point))(?:\s*[\[\(](?:source|src|from)[:\s]*[^\]\)]+[\]\)])?/gi,
        
        // Bullet point and structured formats (with source link support)
        /[-•*]\s*(?:address|street\s+name)[:\s-]*([^\n,;\[\]]+?)(?:\s*[\[\(](?:source|src|from)[:\s]*[^\]\)]+[\]\)])?/gi,
        /(?:^|\n)\s*(?:address|street\s+name)[:\s-]*([^\n,;\[\]]+?)(?:\s*[\[\(](?:source|src|from)[:\s]*[^\]\)]+[\]\)])?/gim,
        
        // Full address patterns (number + street name) (with source link support)
        /(?:^|\n|\.)\s*(\d+\s+[A-Za-z0-9\s]+?(?:street|avenue|road|drive|lane|way|boulevard|place|court|circle|st|ave|rd|dr|ln|blvd|pl|ct|cir))(?:\s*[\[\(](?:source|src|from)[:\s]*[^\]\)]+[\]\)])?/gi,
        
        // Address in quotes (avoiding conflict with source links in parentheses/brackets)
        /["']([^"']+(?:street|avenue|road|drive|lane|way|boulevard|place|court|circle|st|ave|rd|dr|ln|blvd|pl|ct|cir))['"]/gi,
        
        // PO Box patterns
        /(po\s+box\s+\d+)(?:\s*[\[\(](?:source|src|from)[:\s]*[^\]\)]+[\]\)])?/gi,
        /(p\.?o\.?\s+box\s+\d+)(?:\s*[\[\(](?:source|src|from)[:\s]*[^\]\)]+[\]\)])?/gi,
        
        // Building/Complex addresses
        /(\d+\s+[A-Za-z0-9\s]+?,?\s*(?:building|bldg|tower|complex)\s*[A-Za-z0-9]*)(?:\s*[\[\(](?:source|src|from)[:\s]*[^\]\)]+[\]\)])?/gi,
        
        // Simple address patterns without requiring street types (with source link support)
        /(?:address|located)[:\s-]*([^\n,;\[\]]{10,80}?)(?:\s*[\[\(](?:source|src|from)[:\s]*[^\]\)]+[\]\)])?/gi,
        
        // Address with zip code - extract just the street part (with source link support)
        /(\d+\s+[A-Za-z0-9\s]+?)(?:,\s*[A-Za-z\s]+,?\s*\d{5})(?:\s*[\[\(](?:source|src|from)[:\s]*[^\]\)]+[\]\)])?/gi,
        
        // Legacy patterns without source link support (fallback)
        /(?:street\s+name|property\s+address|address)[:\s-]*([^\n,;]+(?:street|avenue|road|drive|lane|way|boulevard|place|court|circle|st|ave|rd|dr|ln|blvd|pl|ct|cir))/gi,
        /(?:located\s+at|property\s+address|situated\s+at)[:\s-]*([^\n,;]+)/gi,
        /(\d+\s+[A-Za-z\s]+(?:street|avenue|road|drive|lane|way|boulevard|place|court|circle|st|ave|rd|dr|ln|blvd|pl|ct|cir))/gi,
        /[-•*]\s*(?:address|street\s+name)[:\s-]*([^\n,;]+)/gi,
        /(?:address|located)[:\s-]*([^\n,;]{10,80})/gi
      ],
      validator: (value) => {
        // Clean up the value
        const cleaned = value.trim().replace(/["""]/g, '');
        return cleaned && 
               cleaned.length >= 5 && 
               cleaned.length <= 120 && 
               !cleaned.match(/^(the|this|that|property|analysis|listing|located|address|street)$/i) &&
               !cleaned.match(/^(asking|price|for|sale|rent)$/i) &&
               cleaned.match(/\d/) && // Must contain at least one number
               !cleaned.match(/^\d+$/) && // Not just a number
               !cleaned.match(/^\$/) && // Not a price
               !cleaned.match(/bedroom|bathroom|sqft|square|feet/i); // Not a property feature
      }
    },
    
    // Price extraction with comprehensive patterns
    price: {
      patterns: [
        // Standard price patterns with various labels (with source link support)
        /(?:property\s+price|asking\s+price|sale\s+price|list\s+price|price|cost|asking|listed|sale|selling|priced)[:\s-]*\$?\s*([\d,]+(?:\.\d{2})?)(?:\s*[\[\(](?:source|src|from)[:\s]*[^\]\)]+[\]\)])?/gi,
        
        // Dollar sign patterns (with source link support)
        /\$\s*([\d,]+(?:\.\d{2})?)(?:\s*[\[\(](?:source|src|from)[:\s]*[^\]\)]+[\]\)])?\b/g,
        /(?:^|\s)\$\s*([\d,]+(?:\.\d{2})?)(?:\s*[\[\(](?:source|src|from)[:\s]*[^\]\)]+[\]\)])?/gm,
        
        // Context-based price patterns (with source link support)
        /(?:for|at|around|approximately|about)\s*\$?\s*([\d,]+(?:\.\d{2})?)(?:\s*[\[\(](?:source|src|from)[:\s]*[^\]\)]+[\]\)])?/gi,
        /([\d,]+(?:\.\d{2})?)\s*(?:dollars?|USD|usd)(?:\s*[\[\(](?:source|src|from)[:\s]*[^\]\)]+[\]\)])?/gi,
        
        // Bullet point and structured formats (with source link support)
        /[-•*]\s*(?:price|asking\s+price|sale\s+price|property\s+price)[:\s-]*\$?\s*([\d,]+(?:\.\d{2})?)(?:\s*[\[\(](?:source|src|from)[:\s]*[^\]\)]+[\]\)])?/gi,
        /(?:^|\n)\s*(?:price|asking\s+price|sale\s+price|property\s+price)[:\s-]*\$?\s*([\d,]+(?:\.\d{2})?)(?:\s*[\[\(](?:source|src|from)[:\s]*[^\]\)]+[\]\)])?/gim,
        
        // Colon and dash separated formats (with source link support)
        /(?:price|asking|sale|cost|listed)[:\s-]+\$?\s*([\d,]+(?:\.\d{2})?)(?:\s*[\[\(](?:source|src|from)[:\s]*[^\]\)]+[\]\)])?/gi,
        
        // Number followed by currency indicators or context (with source link support)
        /\$?\s*([\d,]+(?:\.\d{2})?)\s*(?:asking|listed|sale|selling|property\s+price|price)(?:\s*[\[\(](?:source|src|from)[:\s]*[^\]\)]+[\]\)])?/gi,
        
        // Price in quotes or parentheses (without conflicting with source links)
        /["']\$?\s*([\d,]+(?:\.\d{2})?)['"]/gi,
        
        // Price with K/M suffixes (with source link support)
        /\$?\s*([\d,]+(?:\.\d+)?)\s*[kK](?:\s*[\[\(](?:source|src|from)[:\s]*[^\]\)]+[\]\)])?\b/g,
        /\$?\s*([\d,]+(?:\.\d+)?)\s*[mM](?:illion)?(?:\s*[\[\(](?:source|src|from)[:\s]*[^\]\)]+[\]\)])?\b/g,
        
        // Price ranges (extract first value)
        /\$?\s*([\d,]+(?:\.\d{2})?)\s*[-–—]\s*\$?\s*[\d,]+(?:\.\d{2})?(?:\s*[\[\(](?:source|src|from)[:\s]*[^\]\)]+[\]\)])?/gi,
        /(?:between|from)\s*\$?\s*([\d,]+(?:\.\d{2})?)\s*(?:to|and|\-)\s*\$?\s*[\d,]+(?:\.\d{2})?(?:\s*[\[\(](?:source|src|from)[:\s]*[^\]\)]+[\]\)])?/gi,
        
        // Approximation patterns
        /(?:around|approximately|about|roughly|near|close\s+to|estimated\s+at)\s*\$?\s*([\d,]+(?:\.\d{2})?)[kKmM]?(?:\s*[\[\(](?:source|src|from)[:\s]*[^\]\)]+[\]\)])?/gi,
        /\$?\s*([\d,]+(?:\.\d{2})?)[kKmM]?\s*(?:or\s+so|give\s+or\s+take|ish|thereabouts)(?:\s*[\[\(](?:source|src|from)[:\s]*[^\]\)]+[\]\)])?/gi,
        
        // International currencies (convert to approximate USD)
        /£\s*([\d,]+(?:\.\d{2})?)(?:\s*[\[\(](?:source|src|from)[:\s]*[^\]\)]+[\]\)])?\b/g, // British Pound
        /€\s*([\d,]+(?:\.\d{2})?)(?:\s*[\[\(](?:source|src|from)[:\s]*[^\]\)]+[\]\)])?\b/g, // Euro
        /¥\s*([\d,]+(?:\.\d{2})?)(?:\s*[\[\(](?:source|src|from)[:\s]*[^\]\)]+[\]\)])?\b/g, // Yen
        /CAD?\s*\$?\s*([\d,]+(?:\.\d{2})?)(?:\s*[\[\(](?:source|src|from)[:\s]*[^\]\)]+[\]\)])?\b/gi, // Canadian Dollar
        /AUD?\s*\$?\s*([\d,]+(?:\.\d{2})?)(?:\s*[\[\(](?:source|src|from)[:\s]*[^\]\)]+[\]\)])?\b/gi, // Australian Dollar
        
        // Written numbers (limited set for common property prices)
        /((?:one|two|three|four|five|six|seven|eight|nine)\s+hundred\s+(?:thousand|million)?)(?:\s*dollars?)?(?:\s*[\[\(](?:source|src|from)[:\s]*[^\]\)]+[\]\)])?/gi,
        /((?:ten|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)\s+thousand)(?:\s*dollars?)?(?:\s*[\[\(](?:source|src|from)[:\s]*[^\]\)]+[\]\)])?/gi,
        
        // Scientific notation patterns
        /([\d.]+)[eE][+-]?(\d+)(?:\s*[\[\(](?:source|src|from)[:\s]*[^\]\)]+[\]\)])?/gi,
        
        // Handle spacing variations (with source link support)
        /(?:for|priced\s+at)\s+\$\s*([\d,]+(?:\.\d{2})?)(?:\s*[\[\(](?:source|src|from)[:\s]*[^\]\)]+[\]\)])?/gi,
        
        // Numbers with explicit currency mentions (with source link support)
        /([\d,]+(?:\.\d{2})?)\s*(?:dollar|USD|usd|US\s+dollar)(?:\s*[\[\(](?:source|src|from)[:\s]*[^\]\)]+[\]\)])?/gi,
        
        // Legacy patterns without source link support (fallback)
        /\$\s*([\d,]+(?:\.\d{2})?)\b/g,
        /(?:^|\s)\$\s*([\d,]+(?:\.\d{2})?)/gm,
        /(?:for|at|around|approximately|about)\s*\$?\s*([\d,]+(?:\.\d{2})?)/gi,
        /([\d,]+(?:\.\d{2})?)\s*(?:dollars?|USD|usd)/gi
      ],
      validator: (value) => {
        let cleaned = value.replace(/[,$]/g, '');
        
        // Handle K and M suffixes
        if (cleaned.match(/k$/i)) {
          cleaned = (parseFloat(cleaned.replace(/k$/i, '')) * 1000).toString();
        } else if (cleaned.match(/m$/i)) {
          cleaned = (parseFloat(cleaned.replace(/m$/i, '')) * 1000000).toString();
        }
        
        const num = parseFloat(cleaned);
        return !isNaN(num) && num >= 10000 && num <= 50000000; // Reasonable price range
      }
    },
    
    // Bedroom extraction
    bedrooms: {
      patterns: [
        // Basic bedroom patterns
        /(?:bedroom)[s]?[:\s]*(\d+)/gi,
        /(?:bedrooms)[:\s]*(\d+)/gi,
        /(\d+)[\s-]*(?:bed(?:room)?s?|br\b)/gi,
        /(\d+)\s*(?:bedroom|bed)(?!room)/gi, // Avoid matching "bedroom" in "bathrooms"
        /\b(\d+)\s*bed\b/gi,
        /(\d+)\s*(?:bed)/gi,
        
        // Range patterns (extract first number)
        /(\d+)[-–—]\d+\s*(?:bed(?:room)?s?|br\b)/gi,
        /(?:between\s+)?(\d+)\s*(?:to|and|\-)\s*\d+\s*(?:bed(?:room)?s?|br\b)/gi,
        
        // Complex descriptions
        /(\d+)\s*(?:bed(?:room)?s?)?\s*\+\s*(?:den|office|study|flex)/gi,
        /(\d+)\s*(?:bed(?:room)?s?)\s*(?:plus|with)\s*(?:den|office|study|flex)/gi,
        
        // Studio handling (0 bedrooms)
        /studio(?:\s*apartment|\s*unit|\s*condo)?(?:\s*[\[\(](?:source|src|from)[:\s]*[^\]\)]+[\]\)])?/gi, // Special case - returns "0"
        
        // Bullet points and structured formats
        /[-•*]\s*(?:bedroom|bed)[s]?[:\s]*(\d+)/gi,
        /(?:^|\n)\s*(?:bedroom|bed)[s]?[:\s]*(\d+)/gim,
        
        // Number spelled out (basic cases)
        /(?:one|1)\s*(?:bed(?:room)?s?|br\b)/gi, // Returns "1"
        /(?:two|2)\s*(?:bed(?:room)?s?|br\b)/gi, // Returns "2"
        /(?:three|3)\s*(?:bed(?:room)?s?|br\b)/gi, // Returns "3"
        /(?:four|4)\s*(?:bed(?:room)?s?|br\b)/gi // Returns "4"
      ],
      validator: (value) => {
        // Handle special studio case
        if (value.toLowerCase().includes('studio')) return 0;
        
        // Handle spelled out numbers
        const spellMap = {'one': 1, 'two': 2, 'three': 3, 'four': 4};
        const lower = value.toLowerCase();
        for (const [word, num] of Object.entries(spellMap)) {
          if (lower.includes(word)) return num;
        }
        
        const num = parseInt(value);
        return num >= 0 && num <= 50; // Expanded range
      }
    },
    
    // Bathroom extraction
    bathrooms: {
      patterns: [
        // Basic bathroom patterns
        /(\d+(?:\.\d+)?)[\s-]*(?:bath(?:room)?s?|ba\b)/gi,
        /(?:bath(?:room)?s?|ba)[:\s]*(\d+(?:\.\d+)?)/gi,
        /(\d+(?:\.\d+)?)\s*(?:bathroom|bath)/gi,
        
        // Half bath patterns
        /(\d+)(?:\.\d+)?\s*(?:full|complete)?\s*(?:bath(?:room)?s?)\s*(?:and|plus|\+)\s*(\d+)\s*(?:half|partial)\s*(?:bath(?:room)?s?)/gi,
        /(\d+)\s*full\s*(?:bath(?:room)?s?)\s*(?:and|plus|\+)\s*(\d+)\s*half/gi,
        /(\d+(?:\.\d+)?)\s*(?:bath(?:room)?s?)\s*\((\d+)\s*full,?\s*(\d+)\s*half\)/gi,
        
        // Range patterns (extract first number)
        /(\d+(?:\.\d+)?)[-–—]\d+(?:\.\d+)?\s*(?:bath(?:room)?s?|ba\b)/gi,
        /(?:between\s+)?(\d+(?:\.\d+)?)\s*(?:to|and|\-)\s*\d+(?:\.\d+)?\s*(?:bath(?:room)?s?|ba\b)/gi,
        
        // Specific formats
        /(\d+(?:\.\d+)?)\s*(?:bath(?:room)?s?)\s*(?:plus|with)\s*(?:powder|guest|half)/gi,
        
        // Bullet points and structured formats
        /[-•*]\s*(?:bathroom|bath)[s]?[:\s]*(\d+(?:\.\d+)?)/gi,
        /(?:^|\n)\s*(?:bathroom|bath)[s]?[:\s]*(\d+(?:\.\d+)?)/gim,
        
        // Number spelled out (basic cases)
        /(?:one|1)\s*(?:bath(?:room)?s?|ba\b)/gi, // Returns "1"
        /(?:two|2)\s*(?:bath(?:room)?s?|ba\b)/gi, // Returns "2"
        /(?:three|3)\s*(?:bath(?:room)?s?|ba\b)/gi, // Returns "3"
        /(?:one\s+and\s+half|1\.5)\s*(?:bath(?:room)?s?|ba\b)/gi // Returns "1.5"
      ],
      validator: (value) => {
        // Handle spelled out numbers
        const spellMap = {'one': 1, 'two': 2, 'three': 3, 'one and half': 1.5};
        const lower = value.toLowerCase();
        for (const [word, num] of Object.entries(spellMap)) {
          if (lower.includes(word)) return num;
        }
        
        const num = parseFloat(value);
        return num >= 0 && num <= 50; // Expanded range
      }
    },
    
    // Square feet extraction  
    squareFeet: {
      patterns: [
        /([\d,]+)\s*(?:sq\.?\s*ft\.?|square\s*feet|sqft)/gi,
        /(?:size|area)[:\s]*([\d,]+)\s*(?:sq\.?\s*ft\.?|square\s*feet|sqft)/gi,
        /([\d,]+)\s*(?:sf|sq\.ft\.)/gi
      ],
      validator: (value) => {
        const num = parseInt(value.replace(/,/g, ''));
        return num >= 100 && num <= 50000;
      }
    },
    
    // Year built extraction
    yearBuilt: {
      patterns: [
        /(?:built|constructed|year)[:\s]*(\d{4})/gi,
        /(\d{4})\s*(?:built|construction)/gi,
        /(?:built|constructed)\s*(?:in\s*)?(\d{4})/gi,
        /(?:year|date)[:\s]*(\d{4})/gi
      ],
      validator: (value) => {
        const year = parseInt(value);
        return year >= 1800 && year <= new Date().getFullYear();
      }
    },
    
    // Property type extraction
    propertyType: {
      patterns: [
        // Standard property type patterns
        /(?:property\s*type|type\s*of\s*property|property\s*classification)[:\s-]*([^.\n,;]+)/gi,
        /(?:type)[:\s-]*([^.\n,;]+)/gi,
        // Specific property types with context
        /(single\s*family\s*home?|single\s*family|detached\s*home|detached\s*house)/gi,
        /(condominium|condo|apartment|flat|unit)/gi,
        /(townhouse|townhome|row\s*house)/gi,
        /(duplex|triplex|multi\s*family)/gi,
        /(house|home|residence)/gi,
        /(villa|ranch|colonial|tudor|contemporary|modern|bungalow)/gi,
        // Bullet point and structured formats
        /[-•*]\s*(?:property\s*type|type)[:\s-]*([^.\n,;]+)/gi,
        /(?:^|\n)\s*(?:property\s*type|type)[:\s-]*([^.\n,;]+)/gim,
        // Context-based extraction
        /(?:this|the|a)\s*(single\s*family|condo|townhouse|apartment|duplex|house|home|villa|ranch)/gi,
        /(?:is\s*a?|classified\s*as)\s*(single\s*family|condo|townhouse|apartment|duplex|house|home|villa|ranch)/gi,
        // Common real estate terms
        /(studio|loft|penthouse|cottage|cabin|mobile\s*home|manufactured\s*home)/gi
      ],
      validator: (value) => {
        return value && value.length > 2 && value.length < 100 && 
               !value.match(/^(the|this|that|property|analysis|listing|located|built|year|bedroom|bathroom)$/i);
      }
    },
    
    // Lot size extraction
    lotSize: {
      patterns: [
        /(?:lot|land)[:\s]*([\d.,]+)\s*(?:acres?|sq\.?\s*ft\.?|sqft)/gi,
        /([\d.,]+)\s*(?:acre|acres)\s*lot/gi
      ],
      validator: (value) => {
        const num = parseFloat(value.replace(/,/g, ''));
        return num > 0 && num < 1000;
      }
    }
  };
  
  // Function to extract structured sections from the new prompt format
  function extractStructuredSections(text) {
    const sections = {};
    
    // Enhanced section detection with multiple format patterns
    
    // Extract PROPERTY DETAILS section (multiple formats)
    const propertyDetailPatterns = [
      /\*\*PROPERTY\s+DETAILS:\*\*([\s\S]*?)(?=\*\*[A-Z\s&]+:|$)/i,
      /##\s*PROPERTY\s+DETAILS\s*:?\s*([\s\S]*?)(?=##|$)/i,
      /#\s*PROPERTY\s+DETAILS\s*:?\s*([\s\S]*?)(?=#|$)/i,
      /PROPERTY\s+DETAILS\s*:?\s*([\s\S]*?)(?=(?:LOCATION|RENTAL|INVESTMENT|[A-Z\s&]+:)|$)/i,
      /\*\*PROPERTY\s+INFORMATION:\*\*([\s\S]*?)(?=\*\*[A-Z\s&]+:|$)/i,
      /\*\*LISTING\s+DETAILS:\*\*([\s\S]*?)(?=\*\*[A-Z\s&]+:|$)/i,
      /\*\*PROPERTY\s+OVERVIEW:\*\*([\s\S]*?)(?=\*\*[A-Z\s&]+:|$)/i,
      /\*\*PROPERTY\s+SPECIFICATIONS:\*\*([\s\S]*?)(?=\*\*[A-Z\s&]+:|$)/i
    ];
    
    for (const pattern of propertyDetailPatterns) {
      const match = text.match(pattern);
      if (match) {
        sections.propertyDetails = match[1].trim();
        console.log('✅ Found PROPERTY DETAILS using pattern:', pattern.source);
        break;
      }
    }
    
    // Extract LOCATION & NEIGHBORHOOD ANALYSIS section (multiple formats)
    const locationPatterns = [
      /\*\*LOCATION\s+&\s+NEIGHBORHOOD\s+ANALYSIS:\*\*([\s\S]*?)(?=\*\*[A-Z\s&]+:|$)/i,
      /\*\*LOCATION\s+ANALYSIS:\*\*([\s\S]*?)(?=\*\*[A-Z\s&]+:|$)/i,
      /\*\*NEIGHBORHOOD\s+ANALYSIS:\*\*([\s\S]*?)(?=\*\*[A-Z\s&]+:|$)/i,
      /##\s*LOCATION\s+.*?ANALYSIS\s*:?\s*([\s\S]*?)(?=##|$)/i,
      /#\s*LOCATION\s+.*?ANALYSIS\s*:?\s*([\s\S]*?)(?=#|$)/i,
      /LOCATION\s+(?:&\s+NEIGHBORHOOD\s+)?ANALYSIS\s*:?\s*([\s\S]*?)(?=(?:RENTAL|INVESTMENT|[A-Z\s&]+:)|$)/i,
      /\*\*LOCATION\s+INFORMATION:\*\*([\s\S]*?)(?=\*\*[A-Z\s&]+:|$)/i,
      /\*\*AREA\s+ANALYSIS:\*\*([\s\S]*?)(?=\*\*[A-Z\s&]+:|$)/i
    ];
    
    for (const pattern of locationPatterns) {
      const match = text.match(pattern);
      if (match) {
        sections.locationAnalysis = match[1].trim();
        console.log('✅ Found LOCATION ANALYSIS using pattern:', pattern.source);
        break;
      }
    }
    
    // Extract RENTAL INCOME ANALYSIS section (multiple formats)
    const rentalPatterns = [
      /\*\*RENTAL\s+INCOME\s+ANALYSIS:\*\*([\s\S]*?)(?=\*\*[A-Z\s&]+:|$)/i,
      /\*\*RENTAL\s+ANALYSIS:\*\*([\s\S]*?)(?=\*\*[A-Z\s&]+:|$)/i,
      /\*\*INCOME\s+ANALYSIS:\*\*([\s\S]*?)(?=\*\*[A-Z\s&]+:|$)/i,
      /##\s*RENTAL\s+.*?ANALYSIS\s*:?\s*([\s\S]*?)(?=##|$)/i,
      /#\s*RENTAL\s+.*?ANALYSIS\s*:?\s*([\s\S]*?)(?=#|$)/i,
      /RENTAL\s+(?:INCOME\s+)?ANALYSIS\s*:?\s*([\s\S]*?)(?=(?:INVESTMENT|[A-Z\s&]+:)|$)/i,
      /\*\*CASH\s+FLOW\s+ANALYSIS:\*\*([\s\S]*?)(?=\*\*[A-Z\s&]+:|$)/i,
      /\*\*FINANCIAL\s+ANALYSIS:\*\*([\s\S]*?)(?=\*\*[A-Z\s&]+:|$)/i
    ];
    
    for (const pattern of rentalPatterns) {
      const match = text.match(pattern);
      if (match) {
        sections.rentalAnalysis = match[1].trim();
        console.log('✅ Found RENTAL ANALYSIS using pattern:', pattern.source);
        break;
      }
    }
    
    // Extract INVESTMENT SUMMARY section (multiple formats)
    const investmentPatterns = [
      /\*\*INVESTMENT\s+SUMMARY:\*\*([\s\S]*?)(?=\*\*[A-Z\s&]+:|$)/i,
      /\*\*SUMMARY:\*\*([\s\S]*?)(?=\*\*[A-Z\s&]+:|$)/i,
      /\*\*CONCLUSION:\*\*([\s\S]*?)(?=\*\*[A-Z\s&]+:|$)/i,
      /##\s*INVESTMENT\s+SUMMARY\s*:?\s*([\s\S]*?)(?=##|$)/i,
      /#\s*INVESTMENT\s+SUMMARY\s*:?\s*([\s\S]*?)(?=#|$)/i,
      /INVESTMENT\s+SUMMARY\s*:?\s*([\s\S]*?)(?=(?:[A-Z\s&]+:)|$)/i,
      /\*\*RECOMMENDATION:\*\*([\s\S]*?)(?=\*\*[A-Z\s&]+:|$)/i,
      /\*\*FINAL\s+ASSESSMENT:\*\*([\s\S]*?)(?=\*\*[A-Z\s&]+:|$)/i,
      /\*\*PROS\s+AND\s+CONS:\*\*([\s\S]*?)(?=\*\*[A-Z\s&]+:|$)/i
    ];
    
    for (const pattern of investmentPatterns) {
      const match = text.match(pattern);
      if (match) {
        sections.investmentSummary = match[1].trim();
        console.log('✅ Found INVESTMENT SUMMARY using pattern:', pattern.source);
        break;
      }
    }
    
    console.log('📊 Structured sections found:', Object.keys(sections));
    return sections;
  }
  
  // Function to extract data from PROPERTY DETAILS section
  function extractFromPropertyDetails(text, analysis) {
    // Extract specific data points with enhanced patterns
    const patterns = {
      streetName: [
        /(?:street\s+name|property\s+address|address)[:\s-]*([^\n,;]+?(?:street|avenue|road|drive|lane|way|boulevard|place|court|circle|st|ave|rd|dr|ln|blvd|pl|ct|cir))(?:\s*[\[\(](?:source|src|from)[:\s]*[^\]\)]+[\]\)])?/gi,
        /(?:located\s+at|property\s+address|situated\s+at)[:\s-]*([^\n,;\[\]]+?)(?:\s*[\[\(](?:source|src|from)[:\s]*[^\]\)]+[\]\)])?/gi,
        /(\d+\s+[A-Za-z0-9\s]+?(?:street|avenue|road|drive|lane|way|boulevard|place|court|circle|st|ave|rd|dr|ln|blvd|pl|ct|cir))(?:\s*[\[\(](?:source|src|from)[:\s]*[^\]\)]+[\]\)])?/gi,
        /[-•*]\s*(?:address|street\s+name)[:\s-]*([^\n,;\[\]]+?)(?:\s*[\[\(](?:source|src|from)[:\s]*[^\]\)]+[\]\)])?/gi,
        /(?:^|\n)\s*(?:address|street\s+name)[:\s-]*([^\n,;\[\]]+?)(?:\s*[\[\(](?:source|src|from)[:\s]*[^\]\)]+[\]\)])?/gim,
        /(?:address|located)[:\s-]*([^\n,;\[\]]{10,80}?)(?:\s*[\[\(](?:source|src|from)[:\s]*[^\]\)]+[\]\)])?/gi
      ],
      price: [
        /(?:property\s+price|asking\s+price|sale\s+price|list\s+price|price|asking)[:\s-]*\$?\s*([\d,]+(?:\.\d{2})?)(?:\s*[\[\(](?:source|src|from)[:\s]*[^\]\)]+[\]\)])?/gi,
        /\$\s*([\d,]+(?:\.\d{2})?)(?:\s*[\[\(](?:source|src|from)[:\s]*[^\]\)]+[\]\)])?\b/g,
        /[-•*]\s*(?:price|asking\s+price|sale\s+price|property\s+price)[:\s-]*\$?\s*([\d,]+(?:\.\d{2})?)(?:\s*[\[\(](?:source|src|from)[:\s]*[^\]\)]+[\]\)])?/gi,
        /(?:^|\n)\s*(?:price|asking\s+price|sale\s+price|property\s+price)[:\s-]*\$?\s*([\d,]+(?:\.\d{2})?)(?:\s*[\[\(](?:source|src|from)[:\s]*[^\]\)]+[\]\)])?/gim,
        /(?:for|at|around)\s*\$?\s*([\d,]+(?:\.\d{2})?)(?:\s*[\[\(](?:source|src|from)[:\s]*[^\]\)]+[\]\)])?/gi,
        /([\d,]+(?:\.\d{2})?)\s*(?:dollars?|USD)(?:\s*[\[\(](?:source|src|from)[:\s]*[^\]\)]+[\]\)])?/gi,
        /\$?\s*([\d,]+(?:\.\d+)?)\s*[kK](?:\s*[\[\(](?:source|src|from)[:\s]*[^\]\)]+[\]\)])?\b/g,
        /\$?\s*([\d,]+(?:\.\d+)?)\s*[mM](?:illion)?(?:\s*[\[\(](?:source|src|from)[:\s]*[^\]\)]+[\]\)])?\b/g
      ],
      bedrooms: [
        /(?:bedroom)[s]?[:\s]*(\d+)/gi,
        /(?:bedrooms)[:\s]*(\d+)/gi,
        /(\d+)[\s-]*(?:bed(?:room)?s?|br\b)/gi,
        /(\d+)\s*(?:bedroom|bed)(?!room)/gi, // Avoid matching "bedroom" in "bathrooms"
        /\b(\d+)\s*bed\b/gi
      ],
      bathrooms: [
        /(?:bathroom)[s]?[:\s]*(\d+(?:\.\d+)?)/gi,
        /(\d+(?:\.\d+)?)[\s-]*(?:bath(?:room)?s?|ba\b)/gi,
        /(\d+(?:\.\d+)?)\s*(?:bathroom|bath)/gi
      ],
      squareFeet: [
        /(?:square\s+footage)[:\s]*([\d,]+)/gi,
        /([\d,]+)\s*(?:sq\.?\s*ft\.?|square\s*feet|sqft)/gi
      ],
      yearBuilt: [
        /(?:year\s+built)[:\s]*(\d{4})/gi,
        /(?:built)[:\s]*(\d{4})/gi,
        /(\d{4})\s*(?:built)/gi
      ],
      propertyType: [
        /(?:property\s+type|type\s+of\s+property)[:\s-]*([^\n,;]+)/gi,
        /(?:type)[:\s-]*([^\n,;]+)/gi,
        /[-•*]\s*(?:property\s+type|type)[:\s-]*([^\n,;]+)/gi,
        /(?:^|\n)\s*(?:property\s+type|type)[:\s-]*([^\n,;]+)/gim,
        /(single\s+family\s+home?|single\s+family|detached\s+home|detached\s+house)/gi,
        /(condominium|condo|apartment|flat|unit)/gi,
        /(townhouse|townhome|row\s+house)/gi,
        /(duplex|triplex|multi\s+family)/gi,
        /(house|home|residence)/gi,
        /(villa|ranch|colonial|tudor|contemporary|modern|bungalow)/gi
      ]
    };
    
    for (const [key, patternArray] of Object.entries(patterns)) {
      if (!analysis.extractedData[key]) { // Only set if not already extracted
        let bestMatch = null;
        
        // Try each pattern until we find a match
        for (const pattern of patternArray) {
          pattern.lastIndex = 0; // Reset regex
          const match = pattern.exec(text);
          
          if (match && match[1]) {
            const value = match[1].trim();
            
            // Validate the extracted value
            if (validateExtractedValue(key, value)) {
              bestMatch = value;
              break; // Use the first valid match
            }
          }
        }
        
        if (bestMatch) {
          analysis.extractedData[key] = bestMatch;
          console.log(`✅ Extracted ${key} from Property Details:`, bestMatch);
        } else {
          console.log(`❌ Failed to extract ${key} from Property Details section`);
          if (key === 'streetName' || key === 'price') {
            console.log(`🔍 Property Details text for ${key}:`, text.substring(0, 800));
            // Show what patterns were tried
            console.log(`🔍 Patterns tested for ${key}:`, patterns[key].length);
          }
        }
      }
    }
  }
  
  // Helper function to validate extracted values
  function validateExtractedValue(key, value) {
    if (!value) {
      console.log(`❌ Validation failed for ${key}: value is empty/null`);
      return false;
    }
    
    switch (key) {
      case 'streetName':
        const streetCleaned = value.trim().replace(/["""]/g, '');
        
        // Basic length and content checks
        const streetValidLength = streetCleaned.length >= 3 && streetCleaned.length <= 150; // Relaxed from 5-120
        const streetNotJustKeywords = !streetCleaned.match(/^(the|this|that|property|analysis|listing|located|address|street|asking|price|for|sale|rent)$/i);
        const streetNotFeature = !streetCleaned.match(/^(bedroom|bathroom|sqft|square|feet|bath|bed)$/i); // Only reject if ENTIRE string is a feature
        const streetNotPrice = !streetCleaned.match(/^\$[\d,]+/); // Only reject if starts with price format
        const streetNotJustNumber = !streetCleaned.match(/^\d+$/);
        
        // Street indicators - either has number OR contains street-related words
        const streetHasNumber = streetCleaned.match(/\d/);
        const streetHasStreetWords = streetCleaned.match(/(street|avenue|road|drive|lane|way|boulevard|place|court|circle|st|ave|rd|dr|ln|blvd|pl|ct|cir|highway|route|trail|path|row|terrace|crescent|grove|close|view|heights|estates|manor|park|square|walk|green|commons|crossing|bend|ridge|hill|valley|creek|river|lake|pond|wood|forest|meadow|field|garden|villa|residence|manor|estate|ranch|farm|cabin|cottage|house|home|mill|bridge|station|center|plaza|market|town|city|village|north|south|east|west|old|new|main|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)(\s|$)/i);
        const streetHasIndicators = streetHasNumber || streetHasStreetWords;
        
        // More lenient validation - warn instead of reject for some cases
        const streetIsLikelyValid = streetCleaned && streetValidLength && streetNotKeywords && streetNotJustNumber && streetNotPrice && streetNotFeature;
        
        if (streetIsLikelyValid && !streetHasIndicators) {
          console.log(`⚠️ Street name "${streetCleaned}" passed basic validation but lacks typical street indicators (numbers or street words) - accepting anyway`);
        }
        
        if (!streetIsLikelyValid) {
          console.log(`❌ Street name validation failed for "${value}":`, {
            cleaned: streetCleaned,
            validLength: streetValidLength,
            hasNumber: !!streetHasNumber,
            hasStreetWords: !!streetHasStreetWords,
            hasIndicators: streetHasIndicators,
            isNotJustKeywords: streetNotKeywords,
            isNotPropertyFeature: streetNotFeature,
            isNotPrice: streetNotPrice,
            isNotJustNumber: streetNotJustNumber
          });
        } else {
          console.log(`✅ Street name validation passed for "${streetCleaned}"`);
        }
        
        return streetIsLikelyValid;
               
      case 'bedrooms':
        const bedrooms = parseInt(value);
        // Expanded from 0-20 to 0-50 for large commercial/multi-family properties
        const bedroomValid = bedrooms >= 0 && bedrooms <= 50;
        if (!bedroomValid) {
          console.log(`❌ Bedrooms validation failed for "${value}": parsed=${bedrooms}, range=0-50`);
        }
        return bedroomValid;
        
      case 'bathrooms':
        const bathrooms = parseFloat(value);
        // Expanded from 0-20 to 0-50 for large commercial/multi-family properties
        const bathroomValid = bathrooms >= 0 && bathrooms <= 50;
        if (!bathroomValid) {
          console.log(`❌ Bathrooms validation failed for "${value}": parsed=${bathrooms}, range=0-50`);
        }
        return bathroomValid;
        
      case 'squareFeet':
        const sqft = parseInt(value.replace(/,/g, ''));
        // Expanded from 100-50K to 50-500K to support tiny homes and large commercial
        const sqftValid = sqft >= 50 && sqft <= 500000;
        if (!sqftValid) {
          console.log(`❌ Square feet validation failed for "${value}": parsed=${sqft}, range=50-500,000`);
        }
        return sqftValid;
        
      case 'yearBuilt':
        const year = parseInt(value);
        // Expanded from 1800 to 1600 for historic properties
        const yearValid = year >= 1600 && year <= new Date().getFullYear();
        if (!yearValid) {
          console.log(`❌ Year built validation failed for "${value}": parsed=${year}, range=1600-${new Date().getFullYear()}`);
        }
        return yearValid;
        
      case 'price':
        let priceStr = value.replace(/[,$£€¥]/g, ''); // Support more currencies
        
        // Handle K and M suffixes
        if (priceStr.match(/k$/i)) {
          priceStr = (parseFloat(priceStr.replace(/k$/i, '')) * 1000).toString();
        } else if (priceStr.match(/m$/i)) {
          priceStr = (parseFloat(priceStr.replace(/m$/i, '')) * 1000000).toString();
        }
        
        const price = parseFloat(priceStr);
        // Relaxed price range: $1,000 to $100,000,000 (was $10K-$50M)
        const priceValid = !isNaN(price) && price >= 1000 && price <= 100000000;
        
        if (!priceValid) {
          console.log(`❌ Price validation failed for "${value}":`, {
            original: value,
            cleaned: priceStr,
            parsed: price,
            isNumber: !isNaN(price),
            inRange: price >= 1000 && price <= 100000000,
            note: 'Expanded range: $1K - $100M to support more property types'
          });
        } else {
          console.log(`✅ Price validation passed for "${value}" → ${price}`);
        }
        
        return priceValid;
        
      case 'propertyType':
        const typeClean = value.trim();
        const typeValidLength = typeClean.length > 2 && typeClean.length < 150; // Increased from 100
        const typeNotJustKeywords = !typeClean.match(/^(the|this|that|property|analysis|listing|located|built|year|bedroom|bathroom|price|asking)$/i);
        
        // Expanded property type keywords to be more inclusive
        const typeHasPropertyKeywords = typeClean.match(/(single|family|house|home|condo|condominium|apartment|townhouse|duplex|villa|ranch|colonial|tudor|contemporary|modern|bungalow|studio|loft|penthouse|cottage|cabin|mobile|manufactured|detached|residence|flat|unit|triplex|multi|dwelling|building|estate|property|tiny|micro|prefab|modular|residential|commercial|mixed|use|office|retail|warehouse|industrial|land|lot|parcel|farm|agricultural|historic|heritage|luxury|executive|starter|investment|rental|vacation|second|primary|main|guest|accessory|adu|carriage|coach|granny|suite|basement|garage|conversion|new|construction|custom|spec|model|development|subdivision|community|gated|waterfront|beachfront|lakefront|oceanfront|mountain|view|golf|course|acre|acres|stories|story|level|split|bi|traditional|craftsman|victorian|mediterranean|spanish|french|greek|revival|cape|cod|farmhouse|log|timber|frame|brick|stone|stucco|siding|shingle|metal|concrete|block|adobe|rammed|earth|green|sustainable|eco|friendly|energy|efficient|solar|smart|tech|luxury|premium|high|end|mid|century|antique|historic|restored|renovated|updated|remodeled|original|character|charm|unique|custom|designed|architect|built|quality|construction|solid|well|maintained|move|ready|turnkey|fixer|upper|handyman|special|as|is|sold|where|stands)/i);
        
        // Accept if it has basic property indicators OR common real estate terms
        const typeIsValid = typeValidLength && typeNotJustKeywords && (typeHasPropertyKeywords || 
          // Additional acceptance for common terms that might not match above
          typeClean.match(/(house|home|apartment|condo|unit|building|property|residence|dwelling)/i) ||
          // Accept single words that are clearly property types
          typeClean.match(/^(house|home|apartment|condo|townhouse|duplex|villa|ranch|bungalow|studio|loft|cottage|cabin|flat|unit)$/i)
        );
        
        if (!typeIsValid) {
          console.log(`❌ Property type validation failed for "${value}":`, {
            original: value,
            cleaned: typeClean,
            validLength: typeValidLength,
            notJustKeywords: typeNotJustKeywords,
            hasPropertyKeywords: !!typeHasPropertyKeywords,
            note: 'Expanded property type recognition'
          });
        } else {
          console.log(`✅ Property type validation passed for "${typeClean}"`);
        }
        
        return typeIsValid;
               
      default:
        return value && value.length > 0;
    }
  }
  
  // Function to extract data from LOCATION & NEIGHBORHOOD ANALYSIS section
  function extractFromLocationAnalysis(text, analysis) {
    // Extract location score in X/10 format
    const locationScoreMatch = text.match(/(\d+)\/10/);
    if (locationScoreMatch) {
      analysis.extractedData.locationScore = `${locationScoreMatch[1]}/10`;
      console.log(`✅ Extracted location score:`, analysis.extractedData.locationScore);
    }
    
    // Store the full location analysis
    analysis.extractedData.locationAnalysis = text.substring(0, 1000);
    console.log(`✅ Stored location analysis (${text.length} chars)`);
  }
  
  // Function to extract data from RENTAL INCOME ANALYSIS section
  function extractFromRentalAnalysis(text, analysis) {
    try {
      // Extract estimated monthly rental income
      const rentalIncomeMatch = text.match(/\$?([\d,]+)\s*(?:per\s+month|monthly|\/month)/gi);
      if (rentalIncomeMatch && rentalIncomeMatch[0]) {
        const match = rentalIncomeMatch[0].match(/\$?([\d,]+)/);
        if (match) {
          analysis.extractedData.estimatedRentalIncome = match[1].replace(/,/g, '');
          console.log(`✅ Extracted estimated rental income:`, analysis.extractedData.estimatedRentalIncome);
        }
      }
    } catch (error) {
      console.warn('Error in rental income extraction:', error.message);
    }
    
    try {
      // Extract rental growth potential with Excel-friendly format
      const growthMatch = text.match(/(?:rental\s+growth\s+potential|growth\s+potential)[:\s]*(?:"?Growth:\s*)?(high|strong|moderate|low|limited)(?:"?)/gi);
      if (growthMatch && growthMatch[0]) {
        // Check if it already has "Growth:" prefix
        if (growthMatch[0].toLowerCase().includes('growth:')) {
          analysis.extractedData.rentalGrowthPotential = growthMatch[0].replace(/.*growth:\s*/gi, 'Growth: ').replace(/[""]/g, '');
        } else {
          const match = growthMatch[0].match(/(high|strong|moderate|low|limited)/gi);
          if (match) {
            analysis.extractedData.rentalGrowthPotential = `Growth: ${match[0].charAt(0).toUpperCase() + match[0].slice(1)}`;
          }
        }
        console.log(`✅ Extracted rental growth potential:`, analysis.extractedData.rentalGrowthPotential);
      }
      
      // Store the full rental analysis
      analysis.extractedData.rentalAnalysis = text.substring(0, 1000);
      console.log(`✅ Stored rental analysis (${text.length} chars)`);
    } catch (error) {
      console.warn('Error in rental growth potential extraction:', error.message);
    }
  }
  
  // Function to extract data from INVESTMENT SUMMARY section
  function extractFromInvestmentSummary(text, analysis) {
    // Extract pros (Top 3 advantages)
    const prosMatch = text.match(/(?:top\s+3\s+advantages|advantages)[:\s]*([\s\S]*?)(?=(?:top\s+3\s+concerns|concerns|cons|limitations)|$)/gi);
    if (prosMatch && prosMatch[0]) {
      analysis.extractedData.pros = prosMatch[0].replace(/(?:top\s+3\s+advantages|advantages)[:\s]*/gi, '').trim().substring(0, 500);
      console.log(`✅ Extracted pros from Investment Summary`);
    }
    
    // Extract cons (Top 3 concerns)
    const consMatch = text.match(/(?:top\s+3\s+concerns|concerns|limitations)[:\s]*([\s\S]*?)(?=(?:red\s+flags|recommendation)|$)/gi);
    if (consMatch && consMatch[0]) {
      analysis.extractedData.cons = consMatch[0].replace(/(?:top\s+3\s+concerns|concerns|limitations)[:\s]*/gi, '').trim().substring(0, 500);
      console.log(`✅ Extracted cons from Investment Summary`);
    }
    
    // Extract red flags
    const redFlagsMatch = text.match(/(?:red\s+flags|warning\s+signs)[:\s]*([\s\S]*?)(?=(?:price\s+comparison|recommendation)|$)/gi);
    if (redFlagsMatch && redFlagsMatch[0]) {
      analysis.extractedData.redFlags = redFlagsMatch[0].replace(/(?:red\s+flags|warning\s+signs)[:\s]*/gi, '').trim().substring(0, 500);
      console.log(`✅ Extracted red flags from Investment Summary`);
    }
    
    // Store the full investment summary
    analysis.extractedData.investmentSummary = text.substring(0, 1000);
    console.log(`✅ Stored investment summary (${text.length} chars)`);
  }
  
  // Extract data using multiple patterns per field (fallback for basic data)
  for (const [fieldName, extractor] of Object.entries(extractors)) {
    if (!analysis.extractedData[fieldName]) { // Only extract if not already found in structured sections
      let bestMatch = null;
      let bestScore = 0;
      
      for (const pattern of extractor.patterns) {
        pattern.lastIndex = 0; // Reset regex
        let match;
        while ((match = pattern.exec(responseText)) !== null) {
          for (let i = 1; i < match.length; i++) {
            if (match[i] && match[i].trim()) {
              const value = match[i].trim();
              if (extractor.validator(value)) {
                const score = calculateMatchScore(match, fieldName);
                if (score > bestScore) {
                  bestMatch = value;
                  bestScore = score;
                }
              }
            }
          }
        }
      }
      
      if (bestMatch) {
        analysis.extractedData[fieldName] = bestMatch;
        console.log(`✅ Extracted ${fieldName} (fallback):`, bestMatch);
      } else {
        console.log(`❌ Failed to extract ${fieldName} from full response`);
        // Show sample text around potential matches for debugging
        if (fieldName === 'price') {
          const priceContext = responseText.match(/.{0,50}(?:price|asking|\$[\d,]+).{0,50}/gi);
          if (priceContext) {
            console.log(`🔍 Price context found:`, priceContext.slice(0, 3));
          }
        }
        if (fieldName === 'streetName') {
          const addressContext = responseText.match(/.{0,50}(?:address|street|located|\d+\s+[A-Za-z]+).{0,50}/gi);
          if (addressContext && addressContext.length > 0) {
            console.log(`🔍 Address context found:`, addressContext.slice(0, 3));
          } else {
            console.log(`🔍 No address context found in response`);
          }
        }
        if (fieldName === 'propertyType') {
          const typeContext = responseText.match(/.{0,50}(?:type|house|home|condo|apartment|family).{0,50}/gi);
          if (typeContext) {
            console.log(`🔍 Property type context found:`, typeContext.slice(0, 3));
          }
        }
      }
    }
  }
  
  // Helper function to score matches based on context
  function calculateMatchScore(match, fieldName) {
    let score = 1;
    const context = match.input.substring(Math.max(0, match.index - 50), match.index + match[0].length + 50).toLowerCase();
    
    // Boost score for relevant context keywords
    const contextBoosts = {
      price: ['listing', 'asking', 'sale', 'cost', 'priced'],
      bedrooms: ['bedroom', 'room', 'bed'],
      bathrooms: ['bathroom', 'bath', 'full', 'half'],
      squareFeet: ['square', 'footage', 'size', 'area'],
      yearBuilt: ['built', 'constructed', 'year', 'age'],
      propertyType: ['property', 'type', 'style'],
      lotSize: ['lot', 'land', 'acre']
    };
    
    const boosts = contextBoosts[fieldName] || [];
    for (const boost of boosts) {
      if (context.includes(boost)) {
        score += 0.5;
      }
    }
    
    return score;
  }
  
  // Enhanced neighborhood extraction (only if not already extracted from structured sections)
  if (!analysis.extractedData.neighborhood) {
    const neighborhoodPatterns = [
      /(?:neighborhood|area|location|district)[:\s]*([^.\n,]+)/gi,
      /(?:located\s*in|in\s*the)[:\s]*([^.\n,]+?)(?:\s*neighborhood|\s*area|,|\.|$)/gi,
      /(?:in|near)\s*([A-Z][a-zA-Z\s]+?)(?:\s*area|\s*neighborhood|,|\.|$)/gi,
      /(?:community|subdivision)[:\s]*([^.\n,]+)/gi
    ];
    
    let bestNeighborhood = null;
    let bestNeighborhoodScore = 0;
    
    for (const pattern of neighborhoodPatterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(responseText)) !== null) {
        if (match[1]) {
          let neighborhood = match[1].trim();
          // Enhanced validation
          if (neighborhood.length > 3 && neighborhood.length < 100 &&
              !neighborhood.match(/^(the|this|that|which|excellent|good|great|today|market|property|analysis|listing)$/i) &&
              !neighborhood.match(/^\d+/) &&
              !neighborhood.match(/^(and|or|but|with|for|from|very|quite|really)$/i)) {
            
            const score = calculateMatchScore(match, 'neighborhood');
            if (score > bestNeighborhoodScore) {
              bestNeighborhood = neighborhood;
              bestNeighborhoodScore = score;
            }
          }
        }
      }
    }
    
    if (bestNeighborhood) {
      analysis.extractedData.neighborhood = bestNeighborhood;
      console.log(`✅ Extracted neighborhood:`, bestNeighborhood);
    } else {
      console.log(`❌ Failed to extract neighborhood`);
    }
  }
  
  console.log('📊 Final extraction summary:');
  console.log('Keys extracted:', Object.keys(analysis.extractedData));
  console.log('Total data points:', Object.keys(analysis.extractedData).length);
  
  // Log details of what was extracted
  for (const [key, value] of Object.entries(analysis.extractedData)) {
    console.log(`  ${key}: ${typeof value === 'string' ? value.substring(0, 100) + (value.length > 100 ? '...' : '') : value}`);
  }
  
  // More lenient validation - accept analysis if we have ANY meaningful data
  const hasPropertyData = analysis.extractedData.price || 
                         analysis.extractedData.bedrooms || 
                         analysis.extractedData.bathrooms || 
                         analysis.extractedData.squareFeet ||
                         analysis.extractedData.yearBuilt ||
                         analysis.extractedData.propertyType ||
                         analysis.extractedData.neighborhood ||
                         analysis.extractedData.pros ||
                         analysis.extractedData.cons ||
                         analysis.extractedData.marketAnalysis ||
                         analysis.extractedData.investmentPotential ||
                         analysis.extractedData.redFlags ||
                         analysis.extractedData.locationScore ||
                         analysis.extractedData.estimatedRentalIncome ||
                         analysis.extractedData.rentalGrowthPotential;
  
  if (!hasPropertyData) {
    console.log('⚠️ No meaningful data extracted from response');
    console.log('📝 Response preview for debugging:', responseText.substring(0, 500));
    // Still return the analysis with full response for manual review
    console.log('🔄 Returning analysis with full response for manual review');
    return analysis;
  }
  
  // Validate and clean extracted data
  analysis.extractedData = validateAndCleanData(analysis.extractedData);
  
  // Normalize international formats and currencies
  analysis.extractedData = normalizeInternationalData(analysis.extractedData);
  
  // Add data consistency validation
  const consistencyIssues = validateDataConsistency(analysis.extractedData);
  if (consistencyIssues.length > 0) {
    analysis.warnings.push(...consistencyIssues);
    console.warn('⚠️ Data consistency issues detected:', consistencyIssues);
  }
  
  // AI-assisted fallback extraction for missing critical fields
  const criticalFields = ['streetName', 'price', 'propertyType', 'bedrooms'];
  const missingFields = criticalFields.filter(field => !analysis.extractedData[field]);
  
  if (missingFields.length > 0) {
    console.log('🤖 Attempting AI-assisted fallback extraction for missing fields:', missingFields);
    const fallbackData = performAIAssistedExtraction(responseText, missingFields);
    
    // Merge fallback data with existing data
    Object.assign(analysis.extractedData, fallbackData);
    
    if (Object.keys(fallbackData).length > 0) {
      console.log('✅ AI-assisted extraction recovered:', Object.keys(fallbackData));
      analysis.warnings.push({
        type: 'ai_fallback_used',
        message: `AI fallback extraction used for: ${Object.keys(fallbackData).join(', ')}`,
        severity: 'info'
      });
    }
  }
  
  // Calculate data confidence score
  analysis.dataQuality = calculateDataQuality(analysis.extractedData);
  
  // Calculate investment metrics if we have the necessary data
  if (analysis.extractedData.price && analysis.extractedData.estimatedRentalIncome) {
    const metrics = calculateInvestmentMetrics(analysis.extractedData);
    Object.assign(analysis.extractedData, metrics);
    console.log('✅ Calculated investment metrics:', Object.keys(metrics));
  }
  
  // Performance monitoring completion
  const endTime = performance.now();
  const extractionTime = endTime - startTime;
  console.log(`⏱️ Extraction completed in ${extractionTime.toFixed(2)}ms`);
  
  // Performance metrics
  const extractedFieldsCount = Object.keys(analysis.extractedData).length;
  const responseLength = responseText.length;
  const efficiency = extractedFieldsCount / (responseLength / 1000); // fields per KB
  
  console.log('📊 Extraction Performance:', {
    extractionTime: `${extractionTime.toFixed(2)}ms`,
    responseLength: `${responseLength} characters`,
    extractedFields: extractedFieldsCount,
    efficiency: `${efficiency.toFixed(2)} fields/KB`,
    dataQuality: analysis.dataQuality?.score || 'N/A'
  });
  
  // Performance warnings
  if (extractionTime > 1000) {
    console.warn('⚠️ Slow extraction detected:', extractionTime.toFixed(2), 'ms');
  }
  if (efficiency < 0.1) {
    console.warn('⚠️ Low extraction efficiency:', efficiency.toFixed(2), 'fields/KB');
  }
  
  console.log('✅ Successfully extracted meaningful property analysis data');
  console.log('✅ Meaningful property data found, analysis ready for save');
  
  // Calculate comprehensive metrics
  console.log('🧮 Calculating property metrics...');
  analysis.calculatedMetrics = calculatePropertyMetrics(analysis.extractedData);
  console.log(`✅ Calculated ${Object.keys(analysis.calculatedMetrics).length} metrics`);
  
  // Update analytics for successful extraction
  extractionAnalytics.successfulExtractions++;
  extractionAnalytics.averageExtractionTime = (extractionAnalytics.averageExtractionTime + extractionTime) / 2;
  
  // Cache the successful result
  setCachedExtraction(responseText, analysis);
  
  return analysis;
  
  } catch (error) {
    console.error('❌ Critical error during property data extraction:', error);
    analysis.errors.push({
      type: 'extraction_error',
      message: error.message,
      stack: error.stack,
      timestamp: Date.now()
    });
    
    // Return partial analysis even if there was an error
    const endTime = performance.now();
    console.log(`⏱️ Extraction failed after ${(endTime - startTime).toFixed(2)}ms`);
    
    // Try to salvage any data that was extracted before the error
    const extractedFieldsCount = Object.keys(analysis.extractedData).length;
    if (extractedFieldsCount > 0) {
      console.log(`🔄 Returning partial analysis with ${extractedFieldsCount} fields despite error`);
      return analysis;
    } else {
      console.log('💥 Complete extraction failure - no data could be extracted');
      return null;
    }
  }
}

// Comprehensive calculation engine for property metrics
function calculatePropertyMetrics(data) {
  const metrics = {};
  
  try {
    // Parse core data fields with better handling
    const price = parseFloat(String(data.askingPrice || data.price || '').replace(/[\$,£€¥]/g, ''));
    const sqft = parseFloat(String(data.squareFootage || data.squareFeet || '').replace(/[,]/g, ''));
    const monthlyRent = parseFloat(String(data.estimatedRent || data.estimatedRentalIncome || '').replace(/[\$,£€¥]/g, ''));
    const yearBuilt = parseInt(data.yearBuilt || 0);
    const bedrooms = parseInt(data.bedrooms || 0);
    const bathrooms = parseFloat(data.bathrooms || 0);
    const locationScore = parseFloat(data.locationScore || 0);
    const daysOnMarket = parseInt(data.daysOnMarket || 0);
    
    console.log('🔢 Calculating metrics from data:', {
      price, sqft, monthlyRent, yearBuilt, bedrooms, bathrooms, locationScore, daysOnMarket
    });
    
    // Basic Calculations
    if (price > 0 && sqft > 0) {
      metrics.pricePerSqFt = parseFloat((price / sqft).toFixed(2));
    }
    
    if (monthlyRent > 0 && sqft > 0) {
      metrics.rentPerSqFt = parseFloat((monthlyRent / sqft).toFixed(2));
    }
    
    if (yearBuilt > 0) {
      metrics.propertyAge = new Date().getFullYear() - yearBuilt;
    }
    
    if (bedrooms > 0 && bathrooms > 0) {
      metrics.bedroomRatio = parseFloat((bedrooms / (bedrooms + bathrooms)).toFixed(3));
    }
    
    // Investment Metrics
    if (price > 0 && monthlyRent > 0) {
      metrics.grossRentMultiplier = parseFloat((price / (monthlyRent * 12)).toFixed(2));
      metrics.capRate = parseFloat((((monthlyRent * 12) / price) * 100).toFixed(2));
      metrics.onePercentRule = parseFloat(((monthlyRent / price) * 100).toFixed(3));
      metrics.priceToRentRatio = parseFloat((price / (monthlyRent * 12)).toFixed(2));
    }
    
    // Cash Flow Analysis (simplified assumptions)
    if (price > 0 && monthlyRent > 0) {
      const downPayment = price * 0.20; // 20% down
      const loanAmount = price * 0.80;
      const monthlyMortgage = calculateMortgagePayment(loanAmount, 0.07, 30); // 7% rate, 30 years
      const monthlyExpenses = price * 0.001; // Estimated 0.1% of price for expenses
      
      metrics.monthlyCashFlow = parseFloat((monthlyRent - monthlyMortgage - monthlyExpenses).toFixed(2));
      metrics.annualCashFlow = parseFloat((metrics.monthlyCashFlow * 12).toFixed(2));
      
      if (downPayment > 0) {
        metrics.cashOnCashReturn = parseFloat(((metrics.annualCashFlow / downPayment) * 100).toFixed(2));
      }
    }
    
    // Risk Assessment Scores (1-10 scale)
    metrics.vacancyRisk = calculateVacancyRisk(data);
    metrics.maintenanceRisk = calculateMaintenanceRisk(data, yearBuilt);
    metrics.marketRisk = calculateMarketRisk(data);
    
    if (metrics.vacancyRisk && metrics.maintenanceRisk && metrics.marketRisk) {
      metrics.overallRiskScore = parseFloat(((metrics.vacancyRisk + metrics.maintenanceRisk + metrics.marketRisk) / 3).toFixed(2));
    }
    
    // Market Analysis Calculated Metrics
    if (locationScore > 0) {
      metrics.locationPremium = parseFloat(((locationScore - 5) * 2).toFixed(2));
    }
    
    if (daysOnMarket > 0) {
      metrics.daysOnMarketScore = calculateDOMScore(daysOnMarket);
    }
    
    metrics.priceTrendScore = calculatePriceTrendScore(data);
    
    console.log('📊 Calculated comprehensive metrics:', metrics);
    
  } catch (error) {
    console.warn('Error calculating property metrics:', error);
  }
  
  return metrics;
}

// Helper function to calculate mortgage payment
function calculateMortgagePayment(loanAmount, annualRate, years) {
  const monthlyRate = annualRate / 12;
  const numberOfPayments = years * 12;
  
  if (monthlyRate === 0) return loanAmount / numberOfPayments;
  
  const monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) / 
                        (Math.pow(1 + monthlyRate, numberOfPayments) - 1);
  
  return parseFloat(monthlyPayment.toFixed(2));
}

// Risk assessment functions
function calculateVacancyRisk(data) {
  let score = 5; // Default medium risk
  
  try {
    const propertyType = (data.propertyType || '').toLowerCase();
    const location = (data.neighborhood || data.city || '').toLowerCase();
    
    // Adjust based on property type
    if (propertyType.includes('single family') || propertyType.includes('house')) {
      score -= 1; // Lower vacancy risk for houses
    } else if (propertyType.includes('studio') || propertyType.includes('efficiency')) {
      score += 1; // Higher vacancy risk for studios
    }
    
    // Adjust based on location indicators (simplified)
    if (location.includes('downtown') || location.includes('university')) {
      score -= 0.5; // Lower risk in high-demand areas
    }
    
    // Ensure score stays within 1-10 range
    score = Math.max(1, Math.min(10, score));
    
  } catch (error) {
    console.warn('Error calculating vacancy risk:', error);
  }
  
  return parseFloat(score.toFixed(1));
}

function calculateMaintenanceRisk(data, yearBuilt) {
  let score = 5; // Default medium risk
  
  try {
    if (yearBuilt > 0) {
      const age = new Date().getFullYear() - yearBuilt;
      
      if (age < 10) {
        score = 2; // Low maintenance risk for new properties
      } else if (age < 25) {
        score = 4; // Moderate risk
      } else if (age < 50) {
        score = 6; // Higher risk
      } else {
        score = 8; // High risk for old properties
      }
    }
    
    // Adjust based on property type
    const propertyType = (data.propertyType || '').toLowerCase();
    if (propertyType.includes('condo') || propertyType.includes('apartment')) {
      score -= 1; // Lower maintenance burden
    }
    
    // Ensure score stays within 1-10 range
    score = Math.max(1, Math.min(10, score));
    
  } catch (error) {
    console.warn('Error calculating maintenance risk:', error);
  }
  
  return parseFloat(score.toFixed(1));
}

function calculateMarketRisk(data) {
  let score = 5; // Default medium risk
  
  try {
    const marketTrend = (data.marketTrend || '').toLowerCase();
    
    if (marketTrend.includes('rising') || marketTrend.includes('stable')) {
      score -= 1; // Lower risk in stable/rising markets
    } else if (marketTrend.includes('declining')) {
      score += 2; // Higher risk in declining markets
    }
    
    // Adjust based on location score if available
    const locationScore = parseFloat(data.locationScore || 0);
    if (locationScore > 7) {
      score -= 1; // Lower risk in good locations
    } else if (locationScore < 4) {
      score += 1; // Higher risk in poor locations
    }
    
    // Ensure score stays within 1-10 range
    score = Math.max(1, Math.min(10, score));
    
  } catch (error) {
    console.warn('Error calculating market risk:', error);
  }
  
  return parseFloat(score.toFixed(1));
}

function calculateDOMScore(daysOnMarket) {
  // Score based on days on market (1-10, where 10 is best)
  if (daysOnMarket <= 7) return 10;
  if (daysOnMarket <= 14) return 9;
  if (daysOnMarket <= 30) return 8;
  if (daysOnMarket <= 60) return 6;
  if (daysOnMarket <= 90) return 4;
  if (daysOnMarket <= 180) return 2;
  return 1;
}

function calculatePriceTrendScore(data) {
  let score = 5; // Default neutral
  
  try {
    const priceHistory = (data.priceHistory || '').toLowerCase();
    
    if (priceHistory.includes('reduced') || priceHistory.includes('lowered')) {
      score = 3; // Price reductions indicate weaker market position
    } else if (priceHistory.includes('increased') || priceHistory.includes('raised')) {
      score = 7; // Price increases indicate strong market position
    }
    
  } catch (error) {
    console.warn('Error calculating price trend score:', error);
  }
  
  return parseFloat(score.toFixed(1));
}

// Legacy function for backward compatibility
function calculateInvestmentMetrics(data) {
  return calculatePropertyMetrics(data);
}

// Data validation and cleaning function
function validateAndCleanData(data) {
  const cleanedData = { ...data };
  
  try {
    // Clean and validate price
    if (cleanedData.price) {
      let priceStr = String(cleanedData.price || '').replace(/[\$,]/g, '');
      
      // Handle K and M suffixes
      if (priceStr.match(/k$/i)) {
        priceStr = (parseFloat(priceStr.replace(/k$/i, '')) * 1000).toString();
      } else if (priceStr.match(/m$/i)) {
        priceStr = (parseFloat(priceStr.replace(/m$/i, '')) * 1000000).toString();
      }
      
      const priceNum = parseFloat(priceStr);
      if (!isNaN(priceNum) && priceNum >= 10000 && priceNum <= 50000000) {
        cleanedData.price = priceNum.toString();
      } else {
        console.warn('❌ Invalid price detected:', cleanedData.price, '→', priceNum);
        delete cleanedData.price;
      }
    }
    
    // Clean and validate bedrooms
    if (cleanedData.bedrooms) {
      const beds = parseInt(cleanedData.bedrooms);
      if (beds >= 0 && beds <= 20) {
        cleanedData.bedrooms = beds.toString();
      } else {
        console.warn('❌ Invalid bedrooms count:', cleanedData.bedrooms);
        delete cleanedData.bedrooms;
      }
    }
    
    // Clean and validate bathrooms
    if (cleanedData.bathrooms) {
      const baths = parseFloat(cleanedData.bathrooms);
      if (baths >= 0 && baths <= 20) {
        cleanedData.bathrooms = baths.toString();
      } else {
        console.warn('❌ Invalid bathrooms count:', cleanedData.bathrooms);
        delete cleanedData.bathrooms;
      }
    }
    
    // Clean and validate square feet
    if (cleanedData.squareFeet) {
      const sqft = parseInt(String(cleanedData.squareFeet || '').replace(/[,]/g, ''));
      if (sqft >= 100 && sqft <= 50000) {
        cleanedData.squareFeet = sqft.toString();
      } else {
        console.warn('❌ Invalid square footage:', cleanedData.squareFeet);
        delete cleanedData.squareFeet;
      }
    }
    
    // Clean and validate year built
    if (cleanedData.yearBuilt) {
      const year = parseInt(cleanedData.yearBuilt);
      const currentYear = new Date().getFullYear();
      if (year >= 1800 && year <= currentYear) {
        cleanedData.yearBuilt = year.toString();
      } else {
        console.warn('❌ Invalid year built:', cleanedData.yearBuilt);
        delete cleanedData.yearBuilt;
      }
    }
    
    // Clean and validate estimated rental income
    if (cleanedData.estimatedRentalIncome) {
      const rental = parseFloat(String(cleanedData.estimatedRentalIncome || '').replace(/[\$,]/g, ''));
      if (rental >= 100 && rental <= 50000) {
        cleanedData.estimatedRentalIncome = rental.toString();
      } else {
        console.warn('❌ Invalid rental income:', cleanedData.estimatedRentalIncome);
        delete cleanedData.estimatedRentalIncome;
      }
    }
    
    // Clean property type
    if (cleanedData.propertyType) {
      let propType = cleanedData.propertyType.trim().replace(/["""]/g, '');
      
      // Standardize common property types
      propType = propType.toLowerCase();
      if (propType.match(/single\s*family/i)) {
        propType = 'Single Family Home';
      } else if (propType.match(/condo|condominium/i)) {
        propType = 'Condominium';
      } else if (propType.match(/townhouse|townhome|row\s*house/i)) {
        propType = 'Townhouse';
      } else if (propType.match(/apartment|flat|unit/i)) {
        propType = 'Apartment';
      } else if (propType.match(/duplex/i)) {
        propType = 'Duplex';
      } else if (propType.match(/triplex/i)) {
        propType = 'Triplex';
      } else if (propType.match(/house|home|residence/i) && !propType.match(/single/i)) {
        propType = 'House';
      } else if (propType.match(/villa/i)) {
        propType = 'Villa';
      } else if (propType.match(/ranch/i)) {
        propType = 'Ranch';
      } else if (propType.match(/colonial/i)) {
        propType = 'Colonial';
      } else if (propType.match(/tudor/i)) {
        propType = 'Tudor';
      } else if (propType.match(/contemporary|modern/i)) {
        propType = 'Contemporary';
      } else if (propType.match(/bungalow/i)) {
        propType = 'Bungalow';
      } else if (propType.match(/studio/i)) {
        propType = 'Studio';
      } else if (propType.match(/loft/i)) {
        propType = 'Loft';
      } else if (propType.match(/penthouse/i)) {
        propType = 'Penthouse';
      } else if (propType.match(/cottage/i)) {
        propType = 'Cottage';
      } else if (propType.match(/cabin/i)) {
        propType = 'Cabin';
      } else if (propType.match(/mobile|manufactured/i)) {
        propType = 'Mobile Home';
      } else {
        // Capitalize first letter of each word
        propType = propType.split(' ').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
      }
      
      cleanedData.propertyType = propType;
    }
    
    // Clean street name
    if (cleanedData.streetName) {
      let streetName = cleanedData.streetName.trim().replace(/["""]/g, '');
      
      // Additional validation checks
      const hasNumber = streetName.match(/\d/);
      const isNotJustKeywords = !streetName.match(/^(the|this|that|property|analysis|listing|located|address|street|asking|price|for|sale|rent)$/i);
      const isNotPropertyFeature = !streetName.match(/bedroom|bathroom|sqft|square|feet/i);
      const isNotPrice = !streetName.match(/^\$/);
      
      if (streetName.length >= 5 && 
          streetName.length <= 120 && 
          hasNumber && 
          isNotJustKeywords && 
          isNotPropertyFeature && 
          isNotPrice) {
        cleanedData.streetName = streetName;
      } else {
        console.warn('❌ Invalid street name - failed validation:', {
          streetName: streetName,
          length: streetName.length,
          hasNumber: !!hasNumber,
          isNotJustKeywords: isNotJustKeywords,
          isNotPropertyFeature: isNotPropertyFeature,
          isNotPrice: isNotPrice
        });
        delete cleanedData.streetName;
      }
    } // Fixed: Added missing closing brace
    
    console.log('✅ Data validation completed');
    
  } catch (error) {
    console.warn('Error during data validation:', error);
  }
  
  return cleanedData;
}

// Data relationship validation and consistency checks
function validateDataConsistency(data) {
  const issues = [];
  
  try {
    // Price vs Property Type consistency
    if (data.price && data.propertyType) {
      const price = parseFloat(String(data.price || '').replace(/[,$]/g, ''));
      const propertyType = String(data.propertyType || '').toLowerCase();
      
      // Luxury property type with low price
      if ((propertyType.includes('luxury') || propertyType.includes('premium') || 
           propertyType.includes('executive') || propertyType.includes('penthouse')) && 
          price < 200000) {
        issues.push({
          type: 'price_property_mismatch',
          message: `Luxury property type "${data.propertyType}" but low price $${price.toLocaleString()}`,
          severity: 'warning'
        });
      }
      
      // Tiny home with high price
      if ((propertyType.includes('tiny') || propertyType.includes('micro')) && price > 200000) {
        issues.push({
          type: 'price_property_mismatch',
          message: `Tiny/micro property but high price $${price.toLocaleString()}`,
          severity: 'warning'
        });
      }
    }
    
    // Bedrooms vs Square Footage consistency
    if (data.bedrooms && data.squareFeet) {
      const bedrooms = parseInt(data.bedrooms);
      const sqft = parseInt(String(data.squareFeet || '').replace(/,/g, ''));
      
      // Very small space with many bedrooms
      if (sqft < 500 && bedrooms > 2) {
        issues.push({
          type: 'bedroom_size_mismatch',
          message: `${bedrooms} bedrooms in only ${sqft} sq ft seems inconsistent`,
          severity: 'warning'
        });
      }
      
      // Very large space with few bedrooms
      if (sqft > 5000 && bedrooms < 3) {
        issues.push({
          type: 'bedroom_size_mismatch',
          message: `Only ${bedrooms} bedrooms in ${sqft} sq ft seems low`,
          severity: 'info'
        });
      }
    }
    
    // Price vs Square Footage consistency (price per sqft analysis)
    if (data.price && data.squareFeet) {
      const price = parseFloat(String(data.price || '').replace(/[,$]/g, ''));
      const sqft = parseInt(String(data.squareFeet || '').replace(/,/g, ''));
      const pricePerSqft = price / sqft;
      
      // Extremely high price per sqft
      if (pricePerSqft > 1000) {
        issues.push({
          type: 'high_price_per_sqft',
          message: `Very high price per sq ft: $${pricePerSqft.toFixed(2)}/sq ft`,
          severity: 'warning'
        });
      }
      
      // Extremely low price per sqft
      if (pricePerSqft < 20) {
        issues.push({
          type: 'low_price_per_sqft',
          message: `Very low price per sq ft: $${pricePerSqft.toFixed(2)}/sq ft`,
          severity: 'warning'
        });
      }
    }
    
    // Rental Income vs Price consistency (1% rule check)
    if (data.price && data.estimatedRentalIncome) {
      const price = parseFloat(String(data.price || '').replace(/[,$]/g, ''));
      const monthlyRent = parseFloat(String(data.estimatedRentalIncome || '').replace(/[,$]/g, ''));
      const rentToPrice = (monthlyRent * 12) / price;
      
      // Very low rental yield
      if (rentToPrice < 0.03) {
        issues.push({
          type: 'low_rental_yield',
          message: `Low rental yield: ${(rentToPrice * 100).toFixed(1)}% annually`,
          severity: 'info'
        });
      }
      
      // Unrealistically high rental yield
      if (rentToPrice > 0.20) {
        issues.push({
          type: 'high_rental_yield',
          message: `Unusually high rental yield: ${(rentToPrice * 100).toFixed(1)}% annually`,
          severity: 'warning'
        });
      }
    }
    
    // Year Built vs Property Type consistency
    if (data.yearBuilt && data.propertyType) {
      const year = parseInt(data.yearBuilt);
      const propertyType = data.propertyType.toLowerCase();
      
      // Modern property type with old year
      if ((propertyType.includes('contemporary') || propertyType.includes('modern')) && 
          year < 1980) {
        issues.push({
          type: 'style_year_mismatch',
          message: `"${data.propertyType}" style but built in ${year}`,
          severity: 'info'
        });
      }
      
      // Historic property type with recent year
      if ((propertyType.includes('victorian') || propertyType.includes('colonial') || 
           propertyType.includes('historic')) && year > 1950) {
        issues.push({
          type: 'style_year_mismatch',
          message: `"${data.propertyType}" style but built in ${year}`,
          severity: 'info'
        });
      }
    }
    
    // Bathroom vs Bedroom ratio
    if (data.bathrooms && data.bedrooms) {
      const bathrooms = parseFloat(data.bathrooms);
      const bedrooms = parseInt(data.bedrooms);
      
      // More bathrooms than bedrooms + 2
      if (bathrooms > bedrooms + 2) {
        issues.push({
          type: 'bathroom_bedroom_ratio',
          message: `${bathrooms} bathrooms for ${bedrooms} bedrooms seems high`,
          severity: 'info'
        });
      }
    }
    
  } catch (error) {
    console.warn('Error during data consistency validation:', error);
    issues.push({
      type: 'validation_error',
      message: `Error validating data consistency: ${error.message}`,
      severity: 'error'
    });
  }
  
  return issues;
}

// International format support and currency conversion
function normalizeInternationalData(data) {
  const normalized = { ...data };
  
  try {
    // Currency conversion (approximate rates - in production, use real API)
    if (normalized.price && typeof normalized.price === 'string') {
      let price = normalized.price;
      let convertedPrice = null;
      
      // British Pound to USD (approximate)
      if (price.includes('£')) {
        const amount = parseFloat(price.replace(/[£,]/g, ''));
        convertedPrice = Math.round(amount * 1.27); // Approximate GBP to USD
        console.log(`💱 Converted £${amount.toLocaleString()} to $${convertedPrice.toLocaleString()} USD`);
      }
      
      // Euro to USD (approximate)
      else if (price.includes('€')) {
        const amount = parseFloat(price.replace(/[€,]/g, ''));
        convertedPrice = Math.round(amount * 1.09); // Approximate EUR to USD
        console.log(`💱 Converted €${amount.toLocaleString()} to $${convertedPrice.toLocaleString()} USD`);
      }
      
      // Japanese Yen to USD (approximate)
      else if (price.includes('¥')) {
        const amount = parseFloat(price.replace(/[¥,]/g, ''));
        convertedPrice = Math.round(amount * 0.0067); // Approximate JPY to USD
        console.log(`💱 Converted ¥${amount.toLocaleString()} to $${convertedPrice.toLocaleString()} USD`);
      }
      
      // Canadian Dollar to USD (approximate)
      else if (price.match(/CAD|C\$/)) {
        const amount = parseFloat(price.replace(/[CAD$C,]/g, ''));
        convertedPrice = Math.round(amount * 0.74); // Approximate CAD to USD
        console.log(`💱 Converted CAD$${amount.toLocaleString()} to $${convertedPrice.toLocaleString()} USD`);
      }
      
      // Australian Dollar to USD (approximate)
      else if (price.match(/AUD|A\$/)) {
        const amount = parseFloat(price.replace(/[AUD$A,]/g, ''));
        convertedPrice = Math.round(amount * 0.66); // Approximate AUD to USD
        console.log(`💱 Converted AUD$${amount.toLocaleString()} to $${convertedPrice.toLocaleString()} USD`);
      }
      
      if (convertedPrice) {
        normalized.price = convertedPrice.toString();
        normalized.originalPrice = price;
        normalized.currencyConversion = true;
      }
    }
    
    // Square meter to square feet conversion
    if (normalized.squareFeet && typeof normalized.squareFeet === 'string') {
      const sqftText = normalized.squareFeet.toLowerCase();
      if (sqftText.includes('m²') || sqftText.includes('sq m') || sqftText.includes('square meter')) {
        const sqm = parseFloat(sqftText.replace(/[^0-9.]/g, ''));
        const sqft = Math.round(sqm * 10.764); // Square meters to square feet
        normalized.squareFeet = sqft.toString();
        normalized.originalSquareFeet = normalized.squareFeet;
        normalized.metricConversion = true;
        console.log(`📏 Converted ${sqm} m² to ${sqft} sq ft`);
      }
    }
    
    // Normalize address formats for international addresses
    if (normalized.streetName) {
      let address = normalized.streetName;
      
      // Common international street type conversions
      const streetTypeMap = {
        'rue': 'street',
        'avenue': 'avenue', 
        'boulevard': 'boulevard',
        'place': 'place',
        'strada': 'street',
        'via': 'street',
        'calle': 'street',
        'strasse': 'street',
        'gasse': 'lane',
        'platz': 'square',
        'weg': 'way',
        'laan': 'lane',
        'straat': 'street'
      };
      
      // Add note for international addresses but keep original
      for (const [foreign, english] of Object.entries(streetTypeMap)) {
        if (address.toLowerCase().includes(foreign)) {
          console.log(`🌍 International address detected: ${address}`);
          normalized.internationalAddress = true;
          break;
        }
      }
    }
    
  } catch (error) {
    console.warn('Error during international data normalization:', error);
  }
  
  return normalized;
}

// Pattern performance tracking and optimization
let patternPerformanceStats = new Map();
let extractionAnalytics = {
  totalExtractions: 0,
  successfulExtractions: 0,
  fieldSuccessRates: {},
  averageExtractionTime: 0,
  patternEfficiency: {}
};

function trackPatternSuccess(fieldName, patternIndex, executionTime = 0) {
  try {
    const key = `${fieldName}_${patternIndex}`;
    
    if (!patternPerformanceStats.has(key)) {
      patternPerformanceStats.set(key, {
        fieldName,
        patternIndex,
        successCount: 0,
        totalAttempts: 0,
        averageTime: 0,
        successRate: 0
      });
    }
    
    const stats = patternPerformanceStats.get(key);
    stats.successCount++;
    stats.totalAttempts++;
    stats.averageTime = (stats.averageTime + executionTime) / 2;
    stats.successRate = stats.successCount / stats.totalAttempts;
    
    // Update field-level analytics
    if (!extractionAnalytics.fieldSuccessRates[fieldName]) {
      extractionAnalytics.fieldSuccessRates[fieldName] = { successes: 0, attempts: 0 };
    }
    extractionAnalytics.fieldSuccessRates[fieldName].successes++;
    extractionAnalytics.fieldSuccessRates[fieldName].attempts++;
    
    console.log(`📊 Pattern success: ${fieldName}[${patternIndex}] - ${stats.successRate.toFixed(2)} success rate`);
  } catch (error) {
    console.warn('Error tracking pattern success:', error);
  }
}

function trackExtractionFailure(fieldName, responseText) {
  try {
    // Update field-level analytics
    if (!extractionAnalytics.fieldSuccessRates[fieldName]) {
      extractionAnalytics.fieldSuccessRates[fieldName] = { successes: 0, attempts: 0 };
    }
    extractionAnalytics.fieldSuccessRates[fieldName].attempts++;
    
    // Store failure context for analysis
    const failureKey = `${fieldName}_failures`;
    if (!window.extractionFailures) {
      window.extractionFailures = new Map();
    }
    
    if (!window.extractionFailures.has(failureKey)) {
      window.extractionFailures.set(failureKey, []);
    }
    
    window.extractionFailures.get(failureKey).push({
      timestamp: Date.now(),
      responseLength: responseText.length,
      sampleText: responseText.substring(0, 500),
      fieldName
    });
    
    // Keep only last 10 failures per field
    const failures = window.extractionFailures.get(failureKey);
    if (failures.length > 10) {
      failures.splice(0, failures.length - 10);
    }
    
  } catch (error) {
    console.warn('Error tracking extraction failure:', error);
  }
}

function getExtractionAnalytics() {
  const analytics = {
    ...extractionAnalytics,
    topPatterns: [],
    fieldPerformance: {}
  };
  
  // Calculate field performance
  for (const [fieldName, stats] of Object.entries(extractionAnalytics.fieldSuccessRates)) {
    analytics.fieldPerformance[fieldName] = {
      successRate: stats.attempts > 0 ? (stats.successes / stats.attempts * 100).toFixed(1) + '%' : '0%',
      attempts: stats.attempts,
      successes: stats.successes
    };
  }
  
  // Get top performing patterns
  const patternArray = Array.from(patternPerformanceStats.values());
  analytics.topPatterns = patternArray
    .filter(p => p.totalAttempts >= 3) // Only patterns with enough attempts
    .sort((a, b) => b.successRate - a.successRate)
    .slice(0, 10)
    .map(p => ({
      pattern: `${p.fieldName}[${p.patternIndex}]`,
      successRate: (p.successRate * 100).toFixed(1) + '%',
      attempts: p.totalAttempts,
      avgTime: p.averageTime.toFixed(2) + 'ms'
    }));
  
  return analytics;
}

// Intelligent caching system for repeated extractions
let extractionCache = new Map();
const CACHE_MAX_SIZE = 100;
const CACHE_EXPIRY_TIME = 30 * 60 * 1000; // 30 minutes

function getCacheKey(responseText) {
  // Create a hash-like key from response text
  let hash = 0;
  for (let i = 0; i < responseText.length; i++) {
    const char = responseText.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString();
}

function getCachedExtraction(responseText) {
  try {
    const cacheKey = getCacheKey(responseText);
    const cached = extractionCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < CACHE_EXPIRY_TIME) {
      console.log('🚀 Using cached extraction result');
      return cached.data;
    }
    
    // Clean expired entries
    if (cached && (Date.now() - cached.timestamp) >= CACHE_EXPIRY_TIME) {
      extractionCache.delete(cacheKey);
    }
    
    return null;
  } catch (error) {
    console.warn('Error accessing extraction cache:', error);
    return null;
  }
}

function setCachedExtraction(responseText, extractionResult) {
  try {
    const cacheKey = getCacheKey(responseText);
    
    // Implement LRU cache
    if (extractionCache.size >= CACHE_MAX_SIZE) {
      const firstKey = extractionCache.keys().next().value;
      extractionCache.delete(firstKey);
    }
    
    extractionCache.set(cacheKey, {
      data: extractionResult,
      timestamp: Date.now()
    });
    
    console.log('💾 Cached extraction result');
  } catch (error) {
    console.warn('Error caching extraction result:', error);
  }
}

// AI-assisted fallback extraction using semantic analysis
function performAIAssistedExtraction(responseText, missingFields) {
  const extractedData = {};
  
  try {
    console.log('🤖 Performing AI-assisted extraction for:', missingFields);
    
    for (const field of missingFields) {
      let value = null;
      
      switch (field) {
        case 'streetName':
          value = extractAddressWithAI(responseText);
          break;
        case 'price':
          value = extractPriceWithAI(responseText);
          break;
        case 'propertyType':
          value = extractPropertyTypeWithAI(responseText);
          break;
        case 'bedrooms':
          value = extractBedroomsWithAI(responseText);
          break;
        case 'bathrooms':
          value = extractBathroomsWithAI(responseText);
          break;
        case 'squareFeet':
          value = extractSquareFeetWithAI(responseText);
          break;
      }
      
      if (value) {
        extractedData[field] = value;
        console.log(`🤖 AI extracted ${field}:`, value);
      }
    }
    
  } catch (error) {
    console.warn('Error in AI-assisted extraction:', error);
  }
  
  return extractedData;
}

// AI-assisted address extraction using context analysis
function extractAddressWithAI(text) {
  try {
    // Look for any numeric + text combinations that could be addresses
    const addressCandidates = text.match(/\b\d+\s+[A-Za-z][A-Za-z0-9\s]{3,30}\b/g);
    
    if (addressCandidates) {
      // Score candidates based on context clues
      let bestCandidate = null;
      let bestScore = 0;
      
      for (const candidate of addressCandidates) {
        let score = 0;
        const context = text.substring(
          Math.max(0, text.indexOf(candidate) - 100),
          text.indexOf(candidate) + candidate.length + 100
        ).toLowerCase();
        
        // Context scoring
        if (context.includes('property') || context.includes('address') || 
            context.includes('located') || context.includes('street')) score += 3;
        if (context.includes('house') || context.includes('home')) score += 2;
        if (candidate.match(/\b(street|avenue|road|drive|lane|way|st|ave|rd|dr|ln)\b/i)) score += 4;
        if (candidate.length >= 8 && candidate.length <= 40) score += 2;
        
        // Avoid obvious non-addresses
        if (candidate.match(/\$|price|bedroom|bathroom|sqft|year/i)) score -= 5;
        
        if (score > bestScore && score > 3) {
          bestScore = score;
          bestCandidate = candidate.trim();
        }
      }
      
      return bestCandidate;
    }
    
    return null;
  } catch (error) {
    console.warn('Error in AI address extraction:', error);
    return null;
  }
}

// AI-assisted price extraction using context analysis
function extractPriceWithAI(text) {
  try {
    // Look for any price-like patterns
    const priceCandidates = text.match(/\$[\d,]+(?:\.\d{2})?|\b[\d,]+(?:\.\d+)?\s*[kKmM]\b|\b[\d,]{3,}\b/g);
    
    if (priceCandidates) {
      let bestCandidate = null;
      let bestScore = 0;
      
      for (const candidate of priceCandidates) {
        let score = 0;
        const context = text.substring(
          Math.max(0, text.indexOf(candidate) - 50),
          text.indexOf(candidate) + candidate.length + 50
        ).toLowerCase();
        
        // Context scoring for price
        if (context.includes('price') || context.includes('asking') || 
            context.includes('cost') || context.includes('listed')) score += 4;
        if (context.includes('property') || context.includes('home')) score += 2;
        if (candidate.includes('$')) score += 3;
        if (candidate.match(/[kKmM]$/)) score += 2;
        
        // Price range validation
        let numericValue = parseFloat(candidate.replace(/[,$kKmM]/g, ''));
        if (candidate.match(/[kK]$/)) numericValue *= 1000;
        if (candidate.match(/[mM]$/)) numericValue *= 1000000;
        
        if (numericValue >= 10000 && numericValue <= 10000000) score += 3;
        else if (numericValue < 1000 || numericValue > 50000000) score -= 3;
        
        // Avoid rental prices
        if (context.includes('monthly') || context.includes('rent')) score -= 2;
        
        if (score > bestScore && score > 4) {
          bestScore = score;
          bestCandidate = candidate;
        }
      }
      
      return bestCandidate;
    }
    
    return null;
  } catch (error) {
    console.warn('Error in AI price extraction:', error);
    return null;
  }
}

// AI-assisted property type extraction
function extractPropertyTypeWithAI(text) {
  try {
    const propertyKeywords = [
      'single family', 'townhouse', 'condo', 'condominium', 'apartment',
      'duplex', 'triplex', 'house', 'home', 'villa', 'ranch', 'colonial',
      'contemporary', 'modern', 'bungalow', 'cottage', 'cabin', 'loft',
      'penthouse', 'studio', 'mobile home', 'manufactured home', 'tiny home'
    ];
    
    let bestMatch = null;
    let bestScore = 0;
    
    for (const keyword of propertyKeywords) {
      const regex = new RegExp(keyword.replace(/\s+/g, '\\s+'), 'gi');
      const matches = text.match(regex);
      
      if (matches) {
        let score = matches.length;
        
        // Context scoring
        for (const match of matches) {
          const context = text.substring(
            Math.max(0, text.indexOf(match) - 30),
            text.indexOf(match) + match.length + 30
          ).toLowerCase();
          
          if (context.includes('type') || context.includes('property')) score += 2;
          if (context.includes('style') || context.includes('building')) score += 1;
        }
        
        if (score > bestScore) {
          bestScore = score;
          bestMatch = keyword;
        }
      }
    }
    
    return bestMatch ? bestMatch.split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ') : null;
    
  } catch (error) {
    console.warn('Error in AI property type extraction:', error);
    return null;
  }
}

// AI-assisted bedroom extraction
function extractBedroomsWithAI(text) {
  try {
    // Look for numeric patterns that could be bedrooms
    const candidates = text.match(/\b[0-9]\s*(?:bed|bedroom)/gi);
    
    if (candidates && candidates.length > 0) {
      const bedroom = candidates[0].match(/\d+/)[0];
      const num = parseInt(bedroom);
      
      if (num >= 0 && num <= 10) {
        return bedroom;
      }
    }
    
    // Fallback: look for studio mentions
    if (text.toLowerCase().includes('studio')) {
      return '0';
    }
    
    return null;
  } catch (error) {
    console.warn('Error in AI bedroom extraction:', error);
    return null;
  }
}

// AI-assisted bathroom extraction
function extractBathroomsWithAI(text) {
  try {
    const candidates = text.match(/\b[0-9](?:\.[0-9])?\s*(?:bath|bathroom)/gi);
    
    if (candidates && candidates.length > 0) {
      const bathroom = candidates[0].match(/[\d.]+/)[0];
      const num = parseFloat(bathroom);
      
      if (num >= 0 && num <= 10) {
        return bathroom;
      }
    }
    
    return null;
  } catch (error) {
    console.warn('Error in AI bathroom extraction:', error);
    return null;
  }
}

// AI-assisted square feet extraction
function extractSquareFeetWithAI(text) {
  try {
    const candidates = text.match(/\b[\d,]+\s*(?:sq\.?\s*ft\.?|square\s*feet|sqft)/gi);
    
    if (candidates && candidates.length > 0) {
      const sqft = candidates[0].match(/[\d,]+/)[0];
      const num = parseInt(sqft.replace(/,/g, ''));
      
      if (num >= 100 && num <= 20000) {
        return sqft;
      }
    }
    
    return null;
  } catch (error) {
    console.warn('Error in AI square feet extraction:', error);
    return null;
  }
}

// Data quality assessment function
function calculateDataQuality(data) {
  const quality = {
    score: 0,
    completeness: 0,
    accuracy: 0,
    reliability: 0,
    missingFields: [],
    issues: []
  };
  
  // Add null check for data parameter
  if (!data || typeof data !== 'object') {
    console.warn('calculateDataQuality: Invalid or null data provided');
    return quality;
  }
  
  try {
    // Core fields for completeness assessment
    const coreFields = ['streetName', 'price', 'bedrooms', 'propertyType'];
    const financialFields = ['estimatedRentalIncome', 'pricePerSqFt', 'capRate'];
    const detailFields = ['bathrooms', 'squareFeet', 'yearBuilt', 'neighborhood'];
    const analysisFields = ['locationScore', 'pros', 'cons', 'investmentPotential'];
    
    // Calculate completeness score
    let foundCoreFields = 0;
    let foundFinancialFields = 0;
    let foundDetailFields = 0;
    let foundAnalysisFields = 0;
    
    coreFields.forEach(field => {
      if (data && data[field] && data[field] !== null && data[field] !== undefined && String(data[field]).trim()) {
        foundCoreFields++;
      } else {
        quality.missingFields.push(field);
      }
    });
    
    financialFields.forEach(field => {
      if (data && data[field] && data[field] !== null && data[field] !== undefined && String(data[field]).trim()) {
        foundFinancialFields++;
      }
    });
    
    detailFields.forEach(field => {
      if (data && data[field] && data[field] !== null && data[field] !== undefined && String(data[field]).trim()) {
        foundDetailFields++;
      }
    });
    
    analysisFields.forEach(field => {
      if (data && data[field] && data[field] !== null && data[field] !== undefined && String(data[field]).trim()) {
        foundAnalysisFields++;
      }
    });
    
    // Weighted completeness calculation
    quality.completeness = Math.round(
      (foundCoreFields / coreFields.length * 0.4) +
      (foundFinancialFields / financialFields.length * 0.3) +
      (foundDetailFields / detailFields.length * 0.2) +
      (foundAnalysisFields / analysisFields.length * 0.1)
    * 100);
    
    // Calculate accuracy score based on data consistency
    quality.accuracy = 100; // Start with perfect score
    
    // Check for logical inconsistencies
    if (data.price && data.estimatedRentalIncome) {
      const price = parseFloat(String(data.price || '').replace(/[\$,]/g, ''));
      const rent = parseFloat(String(data.estimatedRentalIncome || '').replace(/[\$,]/g, ''));
      const priceToRentRatio = price / (rent * 12);
      
      if (priceToRentRatio < 5 || priceToRentRatio > 50) {
        quality.accuracy -= 20;
        quality.issues.push('Unusual price-to-rent ratio');
      }
    }
    
    if (data.bedrooms && data.bathrooms) {
      const beds = parseInt(data.bedrooms);
      const baths = parseFloat(data.bathrooms);
      
      if (baths > beds + 1) {
        quality.accuracy -= 10;
        quality.issues.push('More bathrooms than expected for bedroom count');
      }
    }
    
    if (data.yearBuilt && data.price && data.squareFeet) {
      const year = parseInt(data.yearBuilt);
      const currentYear = new Date().getFullYear();
      const age = currentYear - year;
      const price = parseFloat(String(data.price || '').replace(/[\$,]/g, ''));
      const sqft = parseInt(String(data.squareFeet || '').replace(/[,]/g, ''));
      
      // Very basic sanity check for price per sqft based on age
      const pricePerSqft = price / sqft;
      if (age > 100 && pricePerSqft > 500) {
        quality.accuracy -= 10;
        quality.issues.push('High price for very old property');
      }
    }
    
    // Reliability based on source quality and extraction confidence
    quality.reliability = 85; // Base reliability score
    
    if (quality.missingFields.length === 0) {
      quality.reliability += 10;
    } else if (quality.missingFields.length > 2) {
      quality.reliability -= 15;
    }
    
    if (quality.issues.length > 0) {
      quality.reliability -= (quality.issues.length * 5);
    }
    
    // Overall score calculation
    quality.score = Math.round(
      (quality.completeness * 0.4) +
      (quality.accuracy * 0.4) +
      (quality.reliability * 0.2)
    );
    
    quality.score = Math.max(0, Math.min(100, quality.score));
    
    console.log('📊 Data quality assessment:', quality);
    
  } catch (error) {
    console.warn('Error calculating data quality:', error);
    quality.score = 50; // Default moderate score on error
  }
  
  return quality;
}

// Function to monitor for new ChatGPT messages with completion detection
function setupResponseMonitor() {
  let lastMessageCount = 0;
  let responseBuffer = new Map(); // Buffer to track response completion
  let completionTimers = new Map(); // Timers for each property analysis
  
  // Enhanced function to detect if ChatGPT is still writing (streaming)
  const isResponseStreaming = () => {
    console.log('🔍 Checking if ChatGPT is still streaming...');
    
    // Primary check: Look for the stop generation button (most reliable)
    const stopSelectors = [
      'button[data-testid*="stop"]',
      'button[aria-label*="stop" i]',
      'button[title*="stop" i]',
      'button:has([data-icon="stop"])',
      '[role="button"][aria-label*="stop" i]',
      'button[class*="stop"]',
      '[data-state="stop"]',
      'button:has(svg[class*="stop"])',
      '[aria-label*="Stop generating"]',
      '[title*="Stop generating"]'
    ];
    
    for (const selector of stopSelectors) {
      try {
        const stopButton = document.querySelector(selector);
        if (stopButton && 
            stopButton.offsetHeight > 0 && 
            !stopButton.disabled && 
            window.getComputedStyle(stopButton).visibility !== 'hidden' &&
            window.getComputedStyle(stopButton).display !== 'none') {
          console.log('🔍 Found active stop button:', selector, stopButton);
          return true;
        }
      } catch (e) {
        // Skip selector if it causes errors
        continue;
      }
    }
    
    // Secondary check: Look for streaming indicators and visual cues
    const streamingIndicators = [
      '.result-streaming',
      '[class*="streaming"]',
      '[class*="loading"]',
      '.animate-pulse',
      '[data-testid*="streaming"]',
      '[data-state="streaming"]',
      '.thinking',
      '.generating',
      '.typing',
      '[class*="dots"]',
      '[class*="ellipsis"]',
      '.cursor-blink'
    ];
    
    for (const indicator of streamingIndicators) {
      const element = document.querySelector(indicator);
      if (element && element.offsetHeight > 0) {
        console.log('🔍 Found streaming indicator:', indicator, element);
        return true;
      }
    }
    
    // Check for disabled regenerate button (indicates generation in progress)
    const regenerateSelectors = [
      'button[aria-label*="regenerate" i]',
      'button[title*="regenerate" i]',
      'button:has([data-icon="refresh"])',
      'button:has([data-icon="regenerate"])'
    ];
    
    for (const selector of regenerateSelectors) {
      const regenerateButton = document.querySelector(selector);
      if (regenerateButton && regenerateButton.disabled && regenerateButton.offsetHeight > 0) {
        console.log('🔍 Regenerate button is disabled, likely streaming:', regenerateButton);
        return true;
      }
    }
    
    console.log('✅ No streaming indicators found - ChatGPT appears to have finished');
    return false;
  };
  
  // Function to process completed response
  const processCompletedResponse = (messageText, currentUrl) => {
    console.log('🎯 Processing completed response for:', currentUrl);
    console.log('📝 Final response length:', messageText.length);
    
    // Clear any existing timer
    if (completionTimers.has(currentUrl)) {
      clearTimeout(completionTimers.get(currentUrl));
      completionTimers.delete(currentUrl);
    }
    
    // Check if we're waiting for confirmation in prompt splitting mode
    if (promptSplittingState.currentPhase === 'waiting_confirmation') {
      console.log('🔍 ===== CONFIRMATION DETECTION DEBUG =====');
      console.log('🔍 Current phase:', promptSplittingState.currentPhase);
      console.log('🔍 Pending property link:', promptSplittingState.pendingPropertyLink);
      console.log('🔍 Full response text:', messageText);
      console.log('🔍 Response length:', messageText.length);
      console.log('🔍 Response text preview:', messageText.substring(0, 300));
      console.log('🔍 Testing confirmation detection...');
      
      if (detectConfirmation(messageText)) {
        console.log('✅ Confirmation detected! Proceeding to send property link...');
        handleConfirmationReceived();
        return;
      } else {
        console.log('❌ No confirmation detected in response');
        console.log('❌ Testing each pattern individually:');
        
        // Test each pattern individually for debugging
        const patterns = [
          /yes,?\s*i\s*understand/i,
          /yes\s*i\s*understand/i,
          /i\s*understand/i,
          /understood/i,
          /ready\s*to\s*analyze/i,
          /ready/i,
          /yes,?\s*i.{0,20}understand/i,
          /understand.{0,20}ready/i,
          /ready.{0,20}analyze/i,
          /yes.{0,50}ready/i,
          /\byes\b/i
        ];
        
        patterns.forEach((pattern, index) => {
          const matches = pattern.test(messageText.trim());
          console.log(`❌ Pattern ${index + 1} (${pattern.source}): ${matches ? '✅ MATCH' : '❌ no match'}`);
          if (matches) {
            console.log(`❌ But detectConfirmation still returned false for pattern: ${pattern.source}`);
          }
        });
        
        const timeElapsed = Date.now() - promptSplittingState.confirmationStartTime;
        console.log('⏰ Time elapsed:', timeElapsed, 'ms, timeout:', promptSplittingState.confirmationTimeout, 'ms');
        if (timeElapsed > promptSplittingState.confirmationTimeout) {
          console.log('⏰ Confirmation timeout, falling back to single prompt...');
          handleConfirmationTimeout();
          return;
        } else {
          console.log('⏰ Still within timeout window, will continue waiting');
        }
      }
      console.log('🔍 ===== END CONFIRMATION DEBUG =====');
      
      // During waiting_confirmation phase, we ONLY handle confirmation - don't save any analysis
      console.log('⏩ Skipping analysis save during waiting_confirmation phase - will only save response to property link');
      return;
    }
    
    // Process the analysis data
    const propertyKeywords = [
      'property', 'analysis', 'listing', 'bedroom', 'bathroom', 'price',
      'sqft', 'square feet', 'built', 'neighborhood', 'market', 'investment',
      'pros', 'cons', 'advantages', 'disadvantages', 'real estate',
      'zillow', 'realtor', 'mls', 'home', 'house', 'condo', 'townhouse',
      'apartment', 'duplex', 'villa', 'ranch', 'colonial', 'location',
      'area', 'district', 'community', 'lot', 'land', 'acre', 'value',
      'asking', 'listed', 'selling', 'sale', 'cost', 'mortgage',
      'financing', 'schools', 'commute', 'walkable', 'amenities'
    ];
    
    const keywordMatches = propertyKeywords.filter(keyword => 
      messageText.toLowerCase().includes(keyword)
    ).length;
    
    console.log(`Found ${keywordMatches} property keywords in completed response`);
    console.log('🔍 Keywords found:', propertyKeywords.filter(keyword => 
      messageText.toLowerCase().includes(keyword)
    ));
    
    // Check if this is a confirmation response and skip it
    if (detectConfirmation(messageText) && messageText.length < 500) {
      console.log('🔍 Detected confirmation response, skipping save - waiting for actual analysis');
      return;
    }
    
    if (keywordMatches >= 2) {
      // Add null check for currentPropertyAnalysis
      if (!currentPropertyAnalysis) {
        console.log('⚠️ No active property analysis session, but detected property keywords');
        console.log('🔍 This might be a response from prompt splitting or a different analysis');
        console.log('🔍 Response preview:', messageText.substring(0, 500) + '...');
        
        // FALLBACK: If we're in prompt splitting mode, this could be the analysis response
        // NOTE: This should normally not be needed anymore since currentPropertyAnalysis 
        // is now set consistently when the property link is sent
        if (promptSplittingState.currentPhase === 'complete' || 
            promptSplittingState.currentPhase === 'sending_link') {
          console.log('📝 FALLBACK: Processing response from prompt splitting flow (THIS IS THE SECOND RESPONSE TO THE PROPERTY LINK - SAVING!)...');
          console.log('🎯 CRITICAL: This is the ChatGPT analysis response that should be saved!');
          console.log('🔗 Property URL:', promptSplittingState.pendingPropertyLink);
          console.log('📊 Response length:', messageText.length);
          console.log('📄 Response preview:', messageText.substring(0, 300));
          
          const analysisData = extractPropertyAnalysisData(messageText);
          console.log('🔍 Extracted analysis data preview:', {
            extractedDataKeys: Object.keys(analysisData?.extractedData || {}),
            hasFullResponse: !!(analysisData?.fullResponse),
            fullResponseLength: analysisData?.fullResponse?.length || 0
          });
          
          if (analysisData && (Object.keys(analysisData.extractedData).length > 0 || analysisData.fullResponse) && 
              promptSplittingState.pendingPropertyLink) {
            
            console.log('✅ SECOND RESPONSE: Successfully extracted analysis data from split prompt response');
            console.log('🔍 ANALYSIS DATA BEING SAVED:', {
              url: promptSplittingState.pendingPropertyLink,
              hasFullResponse: !!analysisData.fullResponse,
              fullResponseLength: analysisData.fullResponse?.length || 0,
              hasFullAnalysis: !!analysisData.fullAnalysis,
              fullAnalysisLength: analysisData.fullAnalysis?.length || 0,
              extractedDataKeys: Object.keys(analysisData.extractedData || {}),
              fullResponsePreview: analysisData.fullResponse?.substring(0, 200) || 'No fullResponse'
            });
            
            // Send the analysis data with the pending property link
            safeChromeFall(() => {
              return chrome.runtime.sendMessage({
                action: 'savePropertyAnalysis',
                propertyUrl: promptSplittingState.pendingPropertyLink,
                sessionId: `split_${Date.now()}`,
                analysisData: analysisData
              });
            }).then(response => {
              if (response) {
                console.log('✅ Split prompt analysis data sent successfully:', response);
                if (response.success) {
                  console.log('🎉 Split prompt property analysis saved!');
                  
                  // Notify embedded UI about completed analysis
                  if (window.embeddedUI && typeof window.embeddedUI.onAnalysisCompleted === 'function') {
                    window.embeddedUI.onAnalysisCompleted(promptSplittingState.pendingPropertyLink);
                  }
                }
              }
            }).catch(err => {
              console.error('❌ Failed to send split prompt analysis data:', err);
            });
            
            // Reset prompt splitting state
            resetPromptSplittingState();
          }
        }
        return;
      }
      
      // CRITICAL: If we're in prompt splitting mode, redirect to fallback logic
      // to ensure we save with the correct property URL from promptSplittingState
      if (promptSplittingState.currentPhase === 'complete' || 
          promptSplittingState.currentPhase === 'sending_link') {
        console.log('🔄 Redirecting to prompt splitting fallback logic for proper URL handling');
        
        // Trigger the fallback logic by temporarily clearing currentPropertyAnalysis
        const tempCurrentPropertyAnalysis = currentPropertyAnalysis;
        currentPropertyAnalysis = null;
        
        // This will trigger the fallback logic above
        if (promptSplittingState.pendingPropertyLink) {
          console.log('📝 PROMPT SPLITTING: Processing response from property link (THIS IS THE SECOND RESPONSE TO SAVE!)...');
          console.log('🎯 CRITICAL: This is the ChatGPT analysis response that should be saved!');
          console.log('🔗 Property URL:', promptSplittingState.pendingPropertyLink);
          console.log('📊 Response length:', messageText.length);
          
          const analysisData = extractPropertyAnalysisData(messageText);
          if (analysisData && (Object.keys(analysisData.extractedData).length > 0 || analysisData.fullResponse)) {
            
            console.log('✅ Successfully extracted analysis data from split prompt response');
            
            // Send the analysis data with the pending property link
            safeChromeFall(() => {
              return chrome.runtime.sendMessage({
                action: 'savePropertyAnalysis',
                propertyUrl: promptSplittingState.pendingPropertyLink,
                sessionId: `split_${Date.now()}`,
                analysisData: analysisData
              });
            }).then(response => {
              if (response) {
                console.log('✅ Split prompt analysis data sent successfully:', response);
                if (response.success) {
                  console.log('🎉 Split prompt property analysis saved!');
                  
                  // Notify embedded UI about completed analysis
                  if (window.embeddedUI && typeof window.embeddedUI.onAnalysisCompleted === 'function') {
                    window.embeddedUI.onAnalysisCompleted(promptSplittingState.pendingPropertyLink);
                  }
                }
              }
            }).catch(err => {
              console.error('❌ Failed to send split prompt analysis data:', err);
            });
            
            // Reset prompt splitting state
            resetPromptSplittingState();
          }
        }
        return;
      }
      
      if (currentPropertyAnalysis) {
        console.log('✅ Detected completed property analysis response for:', currentPropertyAnalysis.url);
        console.log('🔍 Session ID:', currentPropertyAnalysis.sessionId);
      } else {
        console.log('✅ Detected completed property analysis response (no current analysis tracking)');
      }
      console.log('🎯 Keywords matched:', keywordMatches, '/', propertyKeywords.length);
      const analysisData = extractPropertyAnalysisData(messageText);
      
      if (analysisData && (Object.keys(analysisData.extractedData).length > 0 || analysisData.fullResponse)) {
        const propertyUrl = currentPropertyAnalysis?.url || 'Unknown URL';
        const sessionId = currentPropertyAnalysis?.sessionId || 'Unknown Session';
        
        console.log('✅ Successfully extracted analysis data (REGULAR PROPERTY ANALYSIS - SAVING!):', propertyUrl);
        console.log('🔍 ANALYSIS DATA BEING SAVED:', {
          url: propertyUrl,
          hasFullResponse: !!analysisData.fullResponse,
          fullResponseLength: analysisData.fullResponse?.length || 0,
          hasFullAnalysis: !!analysisData.fullAnalysis,
          fullAnalysisLength: analysisData.fullAnalysis?.length || 0,
          extractedDataKeys: Object.keys(analysisData.extractedData || {}),
          fullResponsePreview: analysisData.fullResponse?.substring(0, 200) || 'No fullResponse'
        });
        console.log('📊 Extracted data summary:', {
          propertyUrl: propertyUrl,
          sessionId: sessionId,
          dataPoints: Object.keys(analysisData.extractedData).length,
          hasPrice: !!analysisData.extractedData.price,
          hasBedrooms: !!analysisData.extractedData.bedrooms,
          hasBathrooms: !!analysisData.extractedData.bathrooms,
          hasSquareFeet: !!analysisData.extractedData.squareFeet,
          keys: Object.keys(analysisData.extractedData)
        });
        
        // Send the analysis data back to the background script
        if (currentPropertyAnalysis && currentPropertyAnalysis.url) {
          safeChromeFall(() => {
            return chrome.runtime.sendMessage({
              action: 'savePropertyAnalysis',
              propertyUrl: currentPropertyAnalysis.url,
              sessionId: currentPropertyAnalysis.sessionId,
              analysisData: analysisData
            });
          }).then(response => {
            if (response) {
              console.log('✅ Analysis data sent successfully:', response);
              if (response.success) {
                console.log('🎉 Property analysis saved and should now show as analyzed!');
                
                // Notify embedded UI about completed analysis
                if (window.embeddedUI && typeof window.embeddedUI.onAnalysisCompleted === 'function') {
                  if (currentPropertyAnalysis && currentPropertyAnalysis.url) {
                    window.embeddedUI.onAnalysisCompleted(currentPropertyAnalysis.url);
                  }
                }
              }
            }
          }).catch(err => {
            console.error('❌ Failed to send analysis data:', err);
          });
        } else {
          console.warn('⚠️ Cannot save analysis: currentPropertyAnalysis is null or missing URL');
          console.log('🔍 This might be a response from prompt splitting - checking fallback handling...');
          
          // Try to handle as split prompt response if we have pending property link
          if (promptSplittingState.pendingPropertyLink && promptSplittingState.currentPhase) {
            console.log('🔄 Attempting to save as split prompt response with pending link:', promptSplittingState.pendingPropertyLink);
            
            safeChromeFall(() => {
              return chrome.runtime.sendMessage({
                action: 'savePropertyAnalysis',
                propertyUrl: promptSplittingState.pendingPropertyLink,
                sessionId: `fallback_${Date.now()}`,
                analysisData: analysisData
              });
            }).then(response => {
              if (response && response.success) {
                console.log('✅ Fallback save successful for split prompt response');
                resetPromptSplittingState();
              }
            }).catch(err => {
              console.error('❌ Fallback save also failed:', err);
            });
          }
        }
        
        // Track this message as processed for this property
        if (currentUrl) {
          if (!processedMessagesPerProperty.has(currentUrl)) {
            processedMessagesPerProperty.set(currentUrl, []);
          }
          processedMessagesPerProperty.get(currentUrl).push(messageText);
          
          // Limit stored messages per property to prevent memory bloat
          const messages = processedMessagesPerProperty.get(currentUrl);
          if (messages.length > 5) {
            messages.shift(); // Remove oldest message
          }
        }
        
        // Reset the current analysis tracking
        currentPropertyAnalysis = null;
      } else {
        console.log('⚠️ No extractable data found in completed response');
        console.log('📝 Response preview:', messageText.substring(0, 500) + '...');
      }
        } else {
      console.log('⚠️ Insufficient property keywords in completed response');
    }
    
    // Clean up buffer
    responseBuffer.delete(currentUrl);
  };
  
  const checkForNewMessages = () => {
    // Comprehensive selectors for ChatGPT interface with fallbacks for interface changes
    const messageSelectors = [
      // Current primary selectors (December 2024)
      '[data-message-author-role="assistant"]',
      '[data-message-id] [data-message-author-role="assistant"]',
      
      // Alternative data attributes
      '[data-author="assistant"]',
      '[data-role="assistant"]',
      '[role="assistant"]',
      
      // Class-based selectors (current)
      '.group.w-full.text-token-text-primary',
      '.group.final-completion',
      '.prose.result-streaming',
      '.prose',
      '[class*="markdown"]',
      
      // Message container patterns
      '[class*="message"][class*="assistant"]',
      '.message.assistant',
      '.group.assistant',
      '[class*="assistant"]',
      '.assistant-message',
      '.bot-message',
      '.ai-message',
      '.response-message',
      
      // Generic conversation patterns
      '.conversation-turn[data-author="assistant"]',
      '.conversation-item[data-role="assistant"]',
      '.chat-message.assistant',
      '.message[data-sender="assistant"]',
      '.turn.assistant',
      
      // Fallback content-based selectors
      '[class*="response"]',
      '[class*="reply"]',
      '[class*="bot"]',
      '[class*="ai"]',
      
      // Structure-based fallbacks (look for even-numbered message groups)
      '.group:nth-child(even)',
      '.message:nth-child(even)',
      '.conversation-turn:nth-child(even)',
      
      // Last resort: any element with substantial text that's not user input
      'div[class*="prose"]:not([class*="user"]):not([class*="human"]):not(textarea):not(input)',
      'div[class*="text"]:not([class*="user"]):not([class*="human"]):not(textarea):not(input)',
      
      // OpenAI specific patterns (alternative domains)
      '.result-thinking',
      '.result-content',
      '.completion-content',
      '.generated-text'
    ];
    
    let messages = [];
    let foundSelector = null;
    
    for (const selector of messageSelectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        messages = Array.from(elements);
        foundSelector = selector;
        break;
      }
    }
    
    if (foundSelector) {
      console.log(`Found ${messages.length} messages using selector: ${foundSelector}`);
    }
    
    if (messages.length > lastMessageCount || messages.length > 0) {
      const newMessage = messages[messages.length - 1];
      if (!newMessage) return;
      
      const messageText = newMessage.textContent || newMessage.innerText || '';
      
      // Debug logging for all messages when waiting for confirmation
      if (promptSplittingState.currentPhase === 'waiting_confirmation') {
        console.log('📨 New message detected while waiting for confirmation:');
        console.log('  - Message length:', messageText.length);
        console.log('  - Current phase:', promptSplittingState.currentPhase);
        console.log('  - Message preview:', messageText.substring(0, 150));
      }
      
      // Skip if we've already processed this exact message for this property
      const currentUrl = currentPropertyAnalysis?.url;
      if (currentUrl && processedMessagesPerProperty.has(currentUrl)) {
        const processedMessages = processedMessagesPerProperty.get(currentUrl);
        if (processedMessages.includes(messageText)) {
          return;
        }
      }
      
      // Check for prompt splitting first, regardless of property analysis session
      if (promptSplittingState.currentPhase === 'waiting_confirmation' && messageText && messageText.length > 10) {
        console.log('🔍 Found FIRST response while waiting for confirmation (NOT SAVING - this is just the confirmation):', messageText.substring(0, 100));
        console.log('⚠️ IMPORTANT: This is the FIRST response (confirmation). We will save the SECOND response (after property link).');
        // Don't save this response - we only want the response AFTER the property link is sent
        // Just continue to trigger sending the property link
        processCompletedResponse(messageText, currentUrl);
        return; // Don't process as regular property analysis
      }
      
      // Only process if we have an active property analysis session
      if (currentPropertyAnalysis && messageText && messageText.length > 100) {
        console.log('📝 Monitoring response progress for:', currentPropertyAnalysis?.url || 'Unknown URL');
        console.log('📊 Current response length:', messageText.length);
        
        // Check if analysis session has timed out (10 minutes)
        const sessionAge = Date.now() - currentPropertyAnalysis.timestamp;
        if (sessionAge > 10 * 60 * 1000) {
          console.log('⏰ Property analysis session timed out, clearing...');
          currentPropertyAnalysis = null;
          return;
        }
        
        // Check if response length has changed from previous check
        const previousBuffer = responseBuffer.get(currentUrl);
        const currentTime = Date.now();
        let lengthStable = false;
        let lastLengthChangeTime = currentTime;
        
        if (previousBuffer) {
          if (previousBuffer.length === messageText.length) {
            // Length hasn't changed, use the previous length change time
            lastLengthChangeTime = previousBuffer.lastLengthChange || previousBuffer.lastUpdated;
            const stableTime = currentTime - lastLengthChangeTime;
            // More aggressive completion detection for faster processing
            if (stableTime > 1500) { // Reduced from 2000ms to 1500ms for faster detection
              lengthStable = true;
              console.log('📏 Response length stable for', Math.round(stableTime/1000), 'seconds, likely complete');
            }
          } else {
            // Length has changed, update the change time
            lastLengthChangeTime = currentTime;
            console.log('📏 Response length changed:', previousBuffer.length, '->', messageText.length);
          }
        }
        
        // Store/update the current response in buffer
        const bufferEntry = {
          messageText: messageText,
          lastUpdated: currentTime,
          length: messageText.length,
          lastLengthChange: lastLengthChangeTime,
          firstSeen: previousBuffer ? previousBuffer.firstSeen : currentTime
        };
        responseBuffer.set(currentUrl, bufferEntry);
        
        // Fallback: If we've been monitoring this response for more than 30 seconds, process it anyway
        const monitoringTime = currentTime - bufferEntry.firstSeen;
        if (monitoringTime > 30000 && messageText.length > 500) {
          console.log('⏰ Fallback triggered - response has been monitored for 30+ seconds, processing anyway');
          processCompletedResponse(messageText, currentUrl);
          return;
        }
        
        // Check if ChatGPT is still streaming
        const isStreaming = isResponseStreaming();
        console.log('🔄 Is ChatGPT still streaming?', isStreaming);
        console.log('📏 Response length stable?', lengthStable);
        
        if (lengthStable || !isStreaming) {
          console.log('✅ Response appears complete - processing now');
          console.log('  - Length stable:', lengthStable);
          console.log('  - Not streaming:', !isStreaming);
          
          // Clear any existing timer since we're processing now
          if (completionTimers.has(currentUrl)) {
            clearTimeout(completionTimers.get(currentUrl));
            completionTimers.delete(currentUrl);
          }
          
          // Process immediately
          processCompletedResponse(messageText, currentUrl);
          
        } else if (isStreaming) {
          console.log('⏳ ChatGPT still writing, waiting for completion...');
          
          // Clear any existing completion timer
          if (completionTimers.has(currentUrl)) {
            clearTimeout(completionTimers.get(currentUrl));
          }
          
          // Set a shorter completion timer (1.5 seconds after last change for faster processing)
          completionTimers.set(currentUrl, setTimeout(() => {
            console.log('⏰ Completion timer triggered - assuming response is complete');
            const bufferedResponse = responseBuffer.get(currentUrl);
            if (bufferedResponse) {
              processCompletedResponse(bufferedResponse.messageText, currentUrl);
            }
          }, 1500)); // Reduced from 2000ms to 1500ms
        }
      }
      
      lastMessageCount = messages.length;
    }
  };
  
  // Check for new messages every 500ms for better completion detection
  // Only run when we have an active analysis session or prompt splitting
  const intervalId = setInterval(() => {
    // Only check if we have an active session
    if (currentPropertyAnalysis || promptSplittingState.currentPhase !== 'idle') {
      checkForNewMessages();
    }
  }, 500);
  
  // Also use MutationObserver for more immediate detection
  const observer = new MutationObserver((mutations) => {
    let shouldCheck = false;
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        // Check if any added nodes might be ChatGPT messages
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const hasMessageClass = node.querySelector && (
              node.querySelector('[data-message-author-role="assistant"]') ||
              node.querySelector('.prose') ||
              node.querySelector('[class*="message"]') ||
              node.classList.contains('group') ||
              node.classList.contains('prose')
            );
            
            if (hasMessageClass || 
                node.classList.contains('group') || 
                node.classList.contains('prose') ||
                node.getAttribute('data-message-author-role') === 'assistant') {
              shouldCheck = true;
              break;
            }
          }
        }
      }
    });
    
    if (shouldCheck && (currentPropertyAnalysis || promptSplittingState.currentPhase !== 'idle')) {
      console.log('🔍 MutationObserver detected potential message change');
      setTimeout(checkForNewMessages, 500); // Small delay to let content load
    }
  });
  
  // Observe the main chat container
  const chatContainers = [
    document.querySelector('main'),
    document.querySelector('[class*="conversation"]'),
    document.querySelector('[class*="chat"]'),
    document.body
  ].filter(Boolean);
  
  chatContainers.forEach(container => {
    if (container) {
      observer.observe(container, {
        childList: true,
        subtree: true
      });
      console.log('👀 Started observing container:', container.tagName);
    }
  });
  
  console.log('🚀 Response monitor setup complete');
  
  // Add periodic check for extension context validity
  const contextCheckInterval = setInterval(() => {
    if (!isExtensionContextValid()) {
      console.log('⚠️ Extension context invalidated - cleaning up content script');
      clearInterval(intervalId);
      clearInterval(contextCheckInterval);
      observer.disconnect();
      // Clear any remaining timers
      completionTimers.forEach(timer => clearTimeout(timer));
      completionTimers.clear();
      responseBuffer.clear();
      currentPropertyAnalysis = null;
    }
  }, 5000); // Check every 5 seconds
  
  // Cleanup function
  return () => {
    clearInterval(intervalId);
    clearInterval(contextCheckInterval);
    observer.disconnect();
  };
}

// Enhanced text insertion function for modern ChatGPT input compatibility
async function insertTextInChatGPTInput(inputField, text, description = 'text') {
  console.log(`🔤 Enhanced text insertion (${description}):`, text.substring(0, 100) + (text.length > 100 ? '...' : ''));
  console.log(`🔤 Input field type: ${inputField.tagName}, contentEditable: ${inputField.contentEditable}`);
  
  // Clear field first
  if (inputField.tagName === 'TEXTAREA') {
    inputField.value = '';
  } else if (inputField.contentEditable === 'true') {
    inputField.textContent = '';
    inputField.innerHTML = '';
  }
  
  // Focus the field
  inputField.focus();
  
  // Wait a moment for focus to take effect
  await new Promise(resolve => setTimeout(resolve, 100));
  
  if (inputField.tagName === 'TEXTAREA') {
    // For textarea elements
    inputField.value = text;
    
    // Trigger React state updates
    inputField.dispatchEvent(new Event('input', { bubbles: true }));
    inputField.dispatchEvent(new Event('change', { bubbles: true }));
    
    console.log(`🔤 Textarea content set (${description}), length:`, inputField.value.length);
    
  } else if (inputField.contentEditable === 'true') {
    // For contentEditable elements (modern ChatGPT)
    
    // Method 1: Direct property assignment
    inputField.textContent = text;
    
    // Method 2: If textContent fails, try innerHTML
    if (inputField.textContent !== text) {
      console.log('🔄 Trying innerHTML method as fallback...');
      inputField.innerHTML = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    
    // Method 3: If both fail, try execCommand
    if (inputField.textContent !== text && document.queryCommandSupported && document.queryCommandSupported('insertText')) {
      console.log('🔄 Trying execCommand method as fallback...');
      try {
        inputField.focus();
        document.execCommand('selectAll', false, null);
        document.execCommand('delete', false, null);
        document.execCommand('insertText', false, text);
      } catch (execError) {
        console.warn('⚠️ execCommand method failed:', execError);
      }
    }
    
    // Method 4: Modern alternative using clipboard API
    if (inputField.textContent !== text && navigator.clipboard) {
      console.log('🔄 Trying clipboard API method as final fallback...');
      try {
        await navigator.clipboard.writeText(text);
        inputField.focus();
        document.execCommand('selectAll', false, null);
        document.execCommand('paste', false, null);
      } catch (clipError) {
        console.warn('⚠️ Clipboard API method failed:', clipError);
      }
    }
    
    // Trigger comprehensive React state updates
    const events = [
      new Event('beforeinput', { bubbles: true }),
      new Event('input', { bubbles: true }),
      new Event('change', { bubbles: true }),
      new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }),
      new KeyboardEvent('keyup', { bubbles: true, key: 'Enter' })
    ];
    
    // Add composition events for international input support
    try {
      events.push(new CompositionEvent('compositionstart', { bubbles: true }));
      events.push(new CompositionEvent('compositionend', { bubbles: true }));
    } catch (compError) {
      // CompositionEvent might not be supported in all browsers
    }
    
    events.forEach(event => {
      try {
        inputField.dispatchEvent(event);
      } catch (eventError) {
        console.warn('⚠️ Event dispatch failed:', eventError);
      }
    });
    
    console.log(`🔤 ContentEditable content set (${description}), length:`, inputField.textContent.length);
  }
  
  // Final verification
  const finalContent = inputField.tagName === 'TEXTAREA' ? inputField.value : inputField.textContent;
  const success = finalContent === text;
  
  console.log(`🔤 Text insertion ${success ? 'SUCCESS' : 'FAILED'} (${description})`);
  if (!success) {
    console.warn(`⚠️ Expected length: ${text.length}, Actual length: ${finalContent.length}`);
    console.warn(`⚠️ Expected start: "${text.substring(0, 50)}"`);
    console.warn(`⚠️ Actual start: "${finalContent.substring(0, 50)}"`);
  }
  
  return success;
}

// Function to find ChatGPT input field with more comprehensive selectors
function findChatGPTInput() {
  console.log('🔍 Searching for ChatGPT input field...');
  console.log('📍 Current URL:', window.location.href);
  console.log('📱 Viewport:', window.innerWidth + 'x' + window.innerHeight);
  console.log('📋 Page title:', document.title);
  console.log('📋 Document ready state:', document.readyState);
  
  // First, let's see what input elements exist on the page
  const allInputs = document.querySelectorAll('input, textarea, [contenteditable="true"]');
  console.log(`📋 Found ${allInputs.length} total input/editable elements on page`);
  
  // Log all input elements for debugging
  allInputs.forEach((input, index) => {
    console.log(`📝 Input ${index + 1}:`, {
      tag: input.tagName,
      id: input.id,
      classes: input.className,
      placeholder: input.placeholder,
      type: input.type,
      contentEditable: input.contentEditable,
      visible: input.offsetParent !== null,
      disabled: input.disabled,
      readOnly: input.readOnly
    });
  });
  
  // Try different selectors for ChatGPT input (comprehensive list for 2024)
  const selectors = [
    // Most current ChatGPT interface selectors (December 2024)
    '#prompt-textarea',                                    // Primary ID-based selector
    'textarea[id*="prompt"]',                             // Any textarea with prompt in ID
    'textarea[placeholder*="Message ChatGPT"]',            // Current placeholder text
    'textarea[placeholder*="Send a message"]',             // Alternative placeholder
    'textarea[placeholder*="Type a message"]',             // Another variant
    'textarea[data-id="root"]',                           // Data-id based
    'div[contenteditable="true"][data-id="root"]',        // Contenteditable version
    
    // Role and aria-based selectors (more reliable)
    'textarea[role="textbox"]',
    'div[contenteditable="true"][role="textbox"]',
    'textarea[aria-label*="message"]',
    'textarea[aria-label*="Message"]',
    'div[contenteditable="true"][aria-label*="message"]',
    'div[contenteditable="true"][aria-label*="Message"]',
    
    // Modern input patterns with more variations
    'textarea[placeholder*="Message"]',
    'textarea[placeholder*="message"]',
    'textarea[placeholder*="Ask"]',
    'textarea[placeholder*="Type"]',
    'div[contenteditable="true"][class*="ProseMirror"]',   // ProseMirror editor
    'textarea[data-testid="composer-text-input"]',
    'textarea[data-testid*="message"]',
    'textarea[data-testid*="input"]',
    'div[contenteditable="true"][data-testid*="composer"]',
    'div[contenteditable="true"][data-testid*="message"]',
    'div[contenteditable="true"][data-testid*="input"]',
    
    // Class-based patterns (more comprehensive)
    'textarea[class*="prose"]',
    'div[contenteditable="true"][class*="prose"]',
    'textarea[class*="composer"]',
    'textarea[class*="input"]',
    'textarea[class*="text"]',
    'textarea[class*="message"]',
    'div[class*="composer"][contenteditable="true"]',
    'div[class*="input"][contenteditable="true"]',
    'div[class*="text"][contenteditable="true"]',
    'div[class*="message"][contenteditable="true"]',
    
    // Container-based searches (find input inside specific containers)
    'main textarea',
    'main div[contenteditable="true"]',
    'form textarea:not([disabled]):not([readonly])',
    'form div[contenteditable="true"]',
    '[role="main"] textarea',
    '[role="main"] div[contenteditable="true"]',
    
    // Broad fallback selectors with better filtering
    'textarea:not([disabled]):not([readonly]):not([style*="display: none"])',
    'div[contenteditable="true"]:not([style*="display: none"])',
    
    // Last resort - any visible input
    'textarea',
    'div[contenteditable="true"]'
  ];
  
  // Collect all potential inputs with scoring
  const candidates = [];
  
  for (const selector of selectors) {
    try {
      const elements = document.querySelectorAll(selector);
      console.log(`🔍 Testing selector: ${selector} -> ${elements.length} elements found`);
      
      for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        
        // Skip if we already have this element
        if (candidates.some(c => c.element === element)) {
          continue;
        }
        
        const elementInfo = {
          tag: element.tagName,
          id: element.id,
          classes: element.className,
          placeholder: element.placeholder,
          dataId: element.getAttribute('data-id'),
          ariaLabel: element.getAttribute('aria-label'),
          visible: element.offsetParent !== null,
          disabled: element.disabled,
          readOnly: element.readOnly,
          display: element.style.display
        };
        
        console.log(`  📍 Element ${i + 1}:`, elementInfo);
        
        // Enhanced visibility and suitability check
        const isVisible = element.offsetParent !== null && 
                         element.style.display !== 'none' &&
                         element.style.visibility !== 'hidden' &&
                         element.style.opacity !== '0';
        
        const isInteractable = !element.disabled && 
                              !element.readOnly &&
                              !element.hasAttribute('disabled') &&
                              !element.hasAttribute('readonly');
        
        const hasValidDimensions = element.offsetWidth > 0 && element.offsetHeight > 0;
        
        const isInViewport = element.getBoundingClientRect().width > 0 && 
                            element.getBoundingClientRect().height > 0;
        
        // Calculate a score for this element
        let score = 0;
        
        // High priority identifiers
        if (element.id === 'prompt-textarea') score += 100;
        if (element.id && element.id.includes('prompt')) score += 50;
        if (element.placeholder && element.placeholder.includes('Message ChatGPT')) score += 80;
        if (element.placeholder && element.placeholder.includes('message')) score += 30;
        if (element.getAttribute('aria-label') && element.getAttribute('aria-label').includes('message')) score += 40;
        
        // Tag preferences
        if (element.tagName === 'TEXTAREA') score += 20;
        if (element.contentEditable === 'true') score += 15;
        
        // Container context
        if (element.closest('main')) score += 10;
        if (element.closest('form')) score += 10;
        
        // Visibility and interactability
        if (isVisible) score += 30;
        if (isInteractable) score += 30;
        if (hasValidDimensions) score += 20;
        if (isInViewport) score += 20;
        
        // Penalize hidden or problematic elements
        if (!isVisible) score -= 50;
        if (!isInteractable) score -= 50;
        if (!hasValidDimensions) score -= 30;
        
        console.log(`  📊 Element score: ${score}`);
        
        candidates.push({
          element,
          score,
          info: elementInfo,
          checks: {
            visible: isVisible,
            interactable: isInteractable,
            validDimensions: hasValidDimensions,
            inViewport: isInViewport
          }
        });
      }
    } catch (e) {
      console.log(`❌ Error with selector ${selector}:`, e);
    }
  }
  
  // Sort candidates by score
  candidates.sort((a, b) => b.score - a.score);
  
  console.log('🏆 Top input field candidates:');
  candidates.slice(0, 5).forEach((candidate, index) => {
    console.log(`  ${index + 1}. Score: ${candidate.score}`, candidate.info);
  });
  
  // Return the best candidate that meets basic requirements
  for (const candidate of candidates) {
    if (candidate.score >= 50 && 
        candidate.checks.visible && 
        candidate.checks.interactable && 
        candidate.checks.validDimensions) {
      console.log('✅ Selected best input element:', candidate.element);
      console.log('📋 Element details:', candidate.info);
      console.log('📊 Final score:', candidate.score);
      return candidate.element;
    }
  }
  
  // If no good candidates, return the highest scoring one if it exists
  if (candidates.length > 0) {
    const bestCandidate = candidates[0];
    console.log('⚠️ No ideal candidate found, using best available:', bestCandidate.element);
    console.log('📋 Element details:', bestCandidate.info);
    console.log('📊 Score:', bestCandidate.score);
    console.log('⚠️ Checks:', bestCandidate.checks);
    return bestCandidate.element;
  }
  
  console.log('❌ No suitable input field found with current selectors');
  console.log('💡 This could mean:');
  console.log('   - ChatGPT page is still loading');
  console.log('   - ChatGPT interface has changed');
  console.log('   - User is not on the correct ChatGPT page');
  console.log('   - Page has errors or is blocked');
  
  // Log page state for debugging
  console.log('📋 Page debug info:', {
    url: window.location.href,
    readyState: document.readyState,
    title: document.title,
    bodyClasses: document.body?.className || 'No body',
    totalElements: document.querySelectorAll('*').length
  });
  
  return null;
}

// Manual input field selector for when automatic detection fails
function manuallySelectChatGPTInput() {
  console.log('🖱️ Starting manual input field selection...');
  
  return new Promise((resolve) => {
    // Highlight all potential input fields
    const allInputs = document.querySelectorAll('input, textarea, [contenteditable="true"]');
    const highlights = [];
    
    allInputs.forEach((input, index) => {
      if (input.offsetParent !== null) { // Only highlight visible elements
        const highlight = document.createElement('div');
        highlight.style.cssText = `
          position: absolute;
          z-index: 10001;
          border: 3px solid #ff4444;
          background: rgba(255, 68, 68, 0.2);
          pointer-events: none;
          border-radius: 4px;
          font-family: monospace;
          font-size: 12px;
          color: #ff4444;
          font-weight: bold;
          padding: 2px 4px;
        `;
        
        const rect = input.getBoundingClientRect();
        highlight.style.left = (rect.left + window.scrollX) + 'px';
        highlight.style.top = (rect.top + window.scrollY) + 'px';
        highlight.style.width = rect.width + 'px';
        highlight.style.height = rect.height + 'px';
        highlight.textContent = `Input ${index + 1}`;
        
        document.body.appendChild(highlight);
        highlights.push(highlight);
        
        // Add click handler to the input element
        input.style.cursor = 'pointer';
        input.style.border = '3px solid #ff4444';
        
        const clickHandler = (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          // Clean up
          highlights.forEach(h => h.remove());
          allInputs.forEach(inp => {
            inp.style.cursor = '';
            inp.style.border = '';
            inp.removeEventListener('click', clickHandler);
          });
          
          console.log('✅ User selected input field:', input);
          resolve(input);
        };
        
        input.addEventListener('click', clickHandler);
      }
    });
    
    // Show instructions
    const instructions = document.createElement('div');
    instructions.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #333;
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      z-index: 10002;
      font-family: system-ui, sans-serif;
      font-size: 14px;
      max-width: 500px;
      text-align: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    instructions.innerHTML = `
      <div style="margin-bottom: 8px;"><strong>🎯 Manual Input Selection</strong></div>
      <div>Click on the ChatGPT text input field you want to use.</div>
      <div style="margin-top: 8px; font-size: 12px; opacity: 0.8;">Highlighted inputs are clickable</div>
    `;
    
    document.body.appendChild(instructions);
    
    // Auto-cleanup after 30 seconds
    setTimeout(() => {
      if (document.body.contains(instructions)) {
        instructions.remove();
        highlights.forEach(h => h.remove());
        allInputs.forEach(inp => {
          inp.style.cursor = '';
          inp.style.border = '';
        });
        console.log('⏰ Manual selection timed out');
        resolve(null);
      }
    }, 30000);
  });
}

// Debug helper function for users to run in console
function debugChatGPTInput() {
  console.log('🔧 CHATGPT INPUT DEBUG HELPER');
  console.log('============================');
  
  // Page info
  console.log('📍 Current URL:', window.location.href);
  console.log('📋 Page title:', document.title);
  console.log('📋 Document ready state:', document.readyState);
  console.log('📱 Viewport:', window.innerWidth + 'x' + window.innerHeight);
  
  // Try to find input
  const result = findChatGPTInput();
  
  if (result) {
    console.log('✅ SUCCESS: Found ChatGPT input field');
    console.log('📋 Element:', result);
    console.log('📋 Tag:', result.tagName);
    console.log('📋 ID:', result.id);
    console.log('📋 Classes:', result.className);
    console.log('📋 Placeholder:', result.placeholder);
    console.log('📋 Data attributes:', Array.from(result.attributes).filter(attr => attr.name.startsWith('data-')));
    
    // Test if we can focus and type in it
    try {
      result.focus();
      const originalValue = result.value || result.textContent || '';
      result.value = 'TEST';
      result.textContent = 'TEST';
      
      setTimeout(() => {
        result.value = originalValue;
        result.textContent = originalValue;
        console.log('✅ Input field is functional (focus and typing works)');
      }, 1000);
      
    } catch (e) {
      console.log('⚠️ Input field found but may not be functional:', e.message);
    }
    
    return result;
  } else {
    console.log('❌ FAILED: Could not find ChatGPT input field');
    console.log('💡 Try these solutions:');
    console.log('   1. Are you on https://chatgpt.com?');
    console.log('   2. Is the page fully loaded?');
    console.log('   3. Can you see the text input box?');
    console.log('   4. Try refreshing the page');
    console.log('   5. Run manuallySelectChatGPTInput() to manually select the input field');
    console.log('   6. Run listAllInputs() to see all available inputs');
    return null;
  }
}

// Additional helper to list all inputs
function listAllInputs() {
  console.log('📝 ALL INPUT ELEMENTS ON PAGE');
  console.log('=============================');
  
  const allInputs = document.querySelectorAll('input, textarea, [contenteditable="true"]');
  console.log(`Found ${allInputs.length} total input/editable elements:`);
  
  allInputs.forEach((input, index) => {
    const rect = input.getBoundingClientRect();
    const info = {
      index: index + 1,
      tag: input.tagName,
      id: input.id,
      classes: input.className,
      placeholder: input.placeholder,
      type: input.type,
      contentEditable: input.contentEditable,
      visible: input.offsetParent !== null,
      disabled: input.disabled,
      readOnly: input.readOnly,
      dimensions: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
      position: `${Math.round(rect.left)},${Math.round(rect.top)}`
    };
    
    console.log(`${index + 1}.`, info);
  });
  
  return allInputs;
}

// Make functions globally available
window.debugChatGPTInput = debugChatGPTInput;
window.manuallySelectChatGPTInput = manuallySelectChatGPTInput;
window.listAllInputs = listAllInputs;

// Function to wait for input field to be available
function waitForInputField(maxWait = 10000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    let attempts = 0;
    
    console.log(`⏳ Waiting for ChatGPT input field (max ${maxWait}ms)...`);
    
    function checkForInput() {
      attempts++;
      const elapsed = Date.now() - startTime;
      console.log(`🔍 Attempt ${attempts} after ${elapsed}ms...`);
      
      const input = findChatGPTInput();
      if (input) {
        console.log(`✅ Input field found after ${elapsed}ms (${attempts} attempts)`);
        resolve(input);
        return;
      }
      
      if (elapsed > maxWait) {
        console.log(`❌ Timeout after ${elapsed}ms (${attempts} attempts)`);
        resolve(null); // Resolve with null instead of rejecting
        return;
      }
      
      // Try again in 500ms
      setTimeout(checkForInput, 500);
    }
    
    checkForInput();
  });
}

// Function to insert text into ChatGPT input
async function insertPropertyAnalysisPrompt(propertyLink) {
  console.log('Starting property analysis insertion for:', propertyLink);
  console.log('🔍 Property link type:', typeof propertyLink);
  console.log('🔍 Property link length:', propertyLink ? propertyLink.length : 'null/undefined');
  
  // Early validation to prevent null property links from proceeding
  if (!isValidPropertyLink(propertyLink)) {
    console.error('❌ Invalid property link provided to insertPropertyAnalysisPrompt:', propertyLink);
    console.error('❌ Property link type:', typeof propertyLink);
    throw new Error('Invalid property link provided for analysis');
  }
  
  // Clear any previous analysis tracking to prevent cross-contamination
  if (currentPropertyAnalysis) {
    console.log('⚠️ Clearing previous property analysis for:', currentPropertyAnalysis?.url || 'Unknown URL');
  }
  
  // We'll set currentPropertyAnalysis later depending on the prompt approach
  // For consistency: only start tracking AFTER the property link is sent
  
  // Clear any previous processed messages for this property to allow fresh analysis
  if (processedMessagesPerProperty.has(propertyLink)) {
    processedMessagesPerProperty.delete(propertyLink);
    console.log('🧹 Cleared previous message history for property');
  }
  
  try {
    // Wait for input field to be available
    const inputField = await waitForInputField(5000);
    
    // Get prompt selection and configuration
    const result = await safeChromeFall(
      () => chrome.storage.local.get(['customPrompt', 'promptType', 'columnConfiguration']),
      { customPrompt: null, promptType: 'default', columnConfiguration: null }
    );
    
    // Use selected prompt type or custom prompt
    const promptTemplate = await getSelectedPrompt(result.promptType, result.customPrompt, result.columnConfiguration);

    // Check if we should use prompt splitting
    const fullPrompt = promptTemplate
      .replace('{PROPERTY_URL}', propertyLink)
      .replace('{DATE}', new Date().toLocaleDateString());
      
    console.log('📏 Full prompt length:', fullPrompt.length, 'characters');
    console.log('🔧 Prompt splitting threshold:', promptSplittingState.lengthThreshold);
    console.log('⚙️ Prompt splitting enabled:', promptSplittingState.enabled);
      
    if (shouldSplitPrompt(fullPrompt)) {
      console.log('📝 Using prompt splitting approach for better link processing');
      
      // Track attempt
      await updatePromptSplittingStats('attempt');
      
      // Reset any existing state
      resetPromptSplittingState();
      
      // Split the prompt
      const splitPrompt = splitPromptContent(promptTemplate, propertyLink);
      
      // Validate property link before setting up splitting state
      if (!isValidPropertyLink(propertyLink)) {
        console.error('❌ Invalid property link for prompt splitting:', propertyLink);
        console.error('❌ Property link type:', typeof propertyLink);
        throw new Error('Invalid property link provided for analysis');
      }
      
      // Set up state for the splitting process
      promptSplittingState.currentPhase = 'instructions';
      promptSplittingState.pendingPropertyLink = propertyLink.trim();
      
      console.log('📤 Sending instructions first...');
      console.log('📝 Instructions length:', splitPrompt.instructions.length);
      console.log('🔗 Pending property link:', promptSplittingState.pendingPropertyLink);
      
      // Insert instructions first
      if (inputField.tagName === 'TEXTAREA') {
        inputField.value = '';
        inputField.focus();
        inputField.value = splitPrompt.instructions;
        inputField.dispatchEvent(new Event('input', { bubbles: true }));
        inputField.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (inputField.contentEditable === 'true') {
        inputField.textContent = '';
        inputField.focus();
        inputField.textContent = splitPrompt.instructions;
        inputField.dispatchEvent(new Event('input', { bubbles: true }));
        inputField.dispatchEvent(new Event('change', { bubbles: true }));
      }
      
      inputField.focus();
      
      // Submit instructions and wait for confirmation
      promptSplittingState.currentPhase = 'waiting_confirmation';
      promptSplittingState.confirmationStartTime = Date.now();
      
      console.log('⏰ Starting confirmation timer...');
      console.log('🔗 Pending property link set to:', promptSplittingState.pendingPropertyLink);
      console.log('📋 Prompt splitting state after setup:', promptSplittingState);
      showPromptSplittingIndicator('waiting_confirmation', 'Waiting for ChatGPT confirmation...');
      
      setTimeout(() => {
        console.log('📤 Submitting instructions message...');
        submitMessage();
      }, 500);
      
      return true;
    } else {
      console.log('📝 Using single prompt approach (below threshold)');
      
      // For single prompt: start tracking now since the prompt contains the property link
      currentPropertyAnalysis = {
        url: propertyLink,
        timestamp: Date.now(),
        sessionId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      };
      console.log('🎯 Single prompt analysis session started:', currentPropertyAnalysis.sessionId);
      
      // Use the original single prompt approach
      const prompt = fullPrompt;
      console.log('Inserting prompt into input field:', inputField);
    
    // Clear existing content first and insert with enhanced React compatibility
    console.log('🔀 DEBUG SINGLE: About to insert single prompt:', prompt.substring(0, 100) + '...');
    console.log('🔀 DEBUG SINGLE: Input field type:', inputField.tagName);
    
    if (inputField.tagName === 'TEXTAREA') {
      inputField.value = '';
      inputField.focus();
      inputField.value = prompt;
      
      // Trigger input events
      inputField.dispatchEvent(new Event('input', { bubbles: true }));
      inputField.dispatchEvent(new Event('change', { bubbles: true }));
      
      console.log('🔀 DEBUG SINGLE: Textarea value set to length:', inputField.value.length);
      
    } else if (inputField.contentEditable === 'true') {
      inputField.textContent = '';
      inputField.innerHTML = '';
      inputField.focus();
      
      // Set the content using multiple methods for better compatibility
      inputField.textContent = prompt;
      
      // Also try innerHTML as backup
      if (inputField.textContent !== prompt) {
        inputField.innerHTML = prompt;
      }
      
      // Trigger comprehensive React state updates
      inputField.dispatchEvent(new Event('input', { bubbles: true }));
      inputField.dispatchEvent(new Event('change', { bubbles: true }));
      inputField.dispatchEvent(new Event('beforeinput', { bubbles: true }));
      
      // Also try composition events which some modern inputs use
      inputField.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
      inputField.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
      
      console.log('🔀 DEBUG SINGLE: ContentEditable content set to length:', inputField.textContent.length);
      
      // Verify the content was set correctly
      if (inputField.textContent !== prompt) {
        console.warn('⚠️ WARNING: Single prompt may not have been set correctly');
        console.warn('⚠️ Expected length:', prompt.length);
        console.warn('⚠️ Actual length:', inputField.textContent.length);
        
        // Try alternative method with direct manipulation
        try {
          inputField.focus();
          document.execCommand('selectAll', false, null);
          document.execCommand('delete', false, null);
          document.execCommand('insertText', false, prompt);
          
          console.log('🔄 RETRY SINGLE: Attempted alternative content setting method');
        } catch (execError) {
          console.warn('⚠️ Alternative single prompt setting method failed:', execError);
        }
      }
    }
    
      // Ensure the field has focus
      inputField.focus();
      
      console.log('Prompt inserted successfully');
      return true;
    }
    
  } catch (error) {
    console.error('Failed to insert prompt:', error);
    resetPromptSplittingState(); // Clean up state on error
    return false;
  }
}

// Function to auto-submit the message (optional)
function submitMessage() {
  console.log('Attempting to auto-submit message...');
  
  // Wait a bit for the input to be processed
  setTimeout(() => {
    // Try to find and click the send button
    const sendButtonSelectors = [
      // Updated selectors for current ChatGPT
      'button[data-testid="send-button"]',
      'button[aria-label*="Send"]',
      'button[title*="Send"]',
      'button[class*="send"]',
      
      // Look for buttons with send icons
      'button svg[data-icon="send"]',
      'button svg[class*="send"]',
      
      // Fallback selectors
      '.send-button',
      'button[type="submit"]'
    ];
    
    for (const selector of sendButtonSelectors) {
      try {
        const button = document.querySelector(selector);
        if (button) {
          // Find the actual button element if we found an SVG
          const actualButton = button.tagName === 'BUTTON' ? button : button.closest('button');
          if (actualButton && !actualButton.disabled && actualButton.offsetParent !== null) {
            console.log('Found send button, clicking:', actualButton);
            actualButton.click();
            return true;
          }
        }
      } catch (e) {
        console.log(`Error with send button selector ${selector}:`, e);
      }
    }
    
    // If no send button found, user will need to press Enter or click send manually
    console.log('Send button not found, user needs to send manually');
    return false;
  }, 1000);
}

// Global error handler for uncaught syntax errors
window.addEventListener('error', function(event) {
  if (event.error && event.error.message && event.error.message.includes('Unexpected token')) {
    console.warn('ChatGPT Helper: Caught syntax error (likely extension context invalidation):', event.error.message);
    event.preventDefault(); // Prevent the error from propagating
    return true;
  }
});

// Initialize extension only on ChatGPT
if (isChatGPTSite()) {
  try {
    console.log('✅ ChatGPT Helper Extension is active on ChatGPT');
    
    // Add debug function for testing prompt splitting
    window.debugPromptSplitting = function(testResponse) {
      console.log('🧪 Testing prompt splitting with:', testResponse);
      const result = detectConfirmation(testResponse || "Yes, I understand");
      console.log('🧪 Test result:', result);
      if (result && promptSplittingState.currentPhase === 'waiting_confirmation') {
        console.log('🧪 Triggering handleConfirmationReceived');
        handleConfirmationReceived();
      }
    };
    
    // Load prompt splitting settings asynchronously
    loadPromptSplittingSettings().catch(error => {
      console.warn('Failed to load prompt splitting settings:', error);
    });
    
    // Add a visual indicator that the extension is active
    function addExtensionIndicator() {
    // Check if indicator already exists
    if (document.getElementById('chatgpt-helper-indicator')) {
      return;
    }
    
    const indicator = document.createElement('div');
    indicator.id = 'chatgpt-helper-indicator';
    indicator.textContent = '🤖 ChatGPT Helper Active';
    indicator.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: #10a37f;
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-family: system-ui, -apple-system, sans-serif;
      z-index: 10000;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      animation: slideIn 0.3s ease-out;
    `;
    
    document.body.appendChild(indicator);
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
      if (indicator && indicator.parentNode) {
        indicator.style.opacity = '0';
        indicator.style.transform = 'translateX(100%)';
        setTimeout(() => {
          if (indicator && indicator.parentNode) {
            indicator.remove();
          }
        }, 300);
      }
    }, 3000);
  }
  
  // Wait for page to load then add indicator
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addExtensionIndicator);
  } else {
    addExtensionIndicator();
  }

  // Setup global event delegation for CSP-compliant button handling
function setupGlobalEventDelegation() {
  document.body.addEventListener('click', function(e) {
    const target = e.target;
    const propertyUrl = target.getAttribute('data-property-url');
    
    // Close modal buttons
    if (target.classList.contains('re-close-modal-btn')) {
      e.preventDefault();
      const modal = target.closest('.re-modal-overlay');
      if (modal) modal.remove();
      return;
    }
    
    if (!propertyUrl) return;
    
    // View Analysis buttons
    if (target.classList.contains('re-view-btn')) {
      e.preventDefault();
      window.embeddedUI?.viewProperty(propertyUrl);
      return;
    }
    
    // Export buttons
    if (target.classList.contains('re-export-btn')) {
      e.preventDefault();
      window.embeddedUI?.exportProperty(propertyUrl);
      return;
    }
    
    // Analyze buttons
    if (target.classList.contains('re-analyze-btn')) {
      e.preventDefault();
      window.embeddedUI?.analyzeExistingProperty(propertyUrl);
      return;
    }
    
    // Copy analysis buttons
    if (target.classList.contains('re-copy-btn')) {
      e.preventDefault();
      window.embeddedUI?.copyAnalysisToClipboard(propertyUrl);
      return;
    }
    
    // Re-analyze buttons
    if (target.classList.contains('re-reanalyze-btn')) {
      e.preventDefault();
      window.embeddedUI?.reAnalyzeProperty(propertyUrl);
      const modal = target.closest('.re-modal-overlay');
      if (modal) modal.remove();
      return;
    }
    
    // Open listing buttons
    if (target.classList.contains('re-open-listing-btn')) {
      e.preventDefault();
      window.open(propertyUrl, '_blank');
      return;
    }
    
    // Delete property buttons
    if (target.classList.contains('re-delete-btn')) {
      e.preventDefault();
      window.embeddedUI?.deleteProperty(propertyUrl);
      return;
    }
  });
}

// Setup response monitoring
  setupResponseMonitor();
  
  // Listen for messages from popup or background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Content script received message:', request);
    
    if (request.action === 'checkStatus') {
      console.log('Responding to status check');
      sendResponse({
        active: true,
        site: window.location.hostname,
        url: window.location.href
      });
      
    } else if (request.action === 'updatePromptSplittingSettings') {
      console.log('Updating prompt splitting settings:', request.settings);
      updatePromptSplittingSettings();
      sendResponse({ success: true });
      
    } else if (request.action === 'analyzeProperty') {
      console.log('Received property analysis request:', request.link);
      console.log('🔍 Request object:', request);
      console.log('🔍 Link type:', typeof request.link);
      console.log('🔍 Link value:', request.link);
      
      // Validate property link before processing
      if (!isValidPropertyLink(request.link)) {
        console.error('❌ Invalid property link received in message handler:', request.link);
        console.error('❌ Link type:', typeof request.link);
        sendResponse({ success: false, error: 'Invalid property link provided' });
        return true;
      }
      
      // Handle async operation properly
      (async () => {
        try {
          const success = await insertPropertyAnalysisPrompt(request.link.trim());
          
          if (success) {
            // Optionally auto-submit (uncomment the next line if desired)
            // submitMessage();
            
            sendResponse({ success: true });
          } else {
            sendResponse({ success: false, error: 'Could not find or access input field' });
          }
        } catch (error) {
          console.error('Error in property analysis:', error);
          sendResponse({ success: false, error: error.message });
        }
      })();
      
      // Return true to indicate we'll send response asynchronously
      return true;
      
    } else if (request.action === 'updatePromptSplittingSettings') {
      console.log('Received prompt splitting settings update:', request.settings);
      
      // Update local settings
      if (request.settings) {
        promptSplittingState.enabled = request.settings.enabled;
        promptSplittingState.lengthThreshold = request.settings.lengthThreshold;
        promptSplittingState.confirmationTimeout = request.settings.confirmationTimeout;
        
        console.log('✅ Updated prompt splitting settings:', {
          enabled: promptSplittingState.enabled,
          threshold: promptSplittingState.lengthThreshold,
          timeout: promptSplittingState.confirmationTimeout
        });
      }
      
      sendResponse({ success: true });
    }
  });
  
  // Listen for messages from background script (for saving analysis data)
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'savePropertyAnalysis') {
      console.log('Received request to save analysis data:', request);
      // This will be handled by the background script or popup
      return false;
    }
  });
  
  } catch (initError) {
    console.error('ChatGPT Helper Extension initialization failed:', initError);
    if (initError.message && initError.message.includes('Unexpected token')) {
      console.warn('This error may be due to Chrome extension context invalidation. Try reloading the page.');
    }
  }
} else {
  console.log('❌ ChatGPT Helper Extension is not active on this site');
}

// Debug function to check current prompt splitting state
window.debugPromptSplitting = function(testResponse) {
  console.log('🧪 Testing prompt splitting with:', testResponse);
  const result = detectConfirmation(testResponse || "Yes, I understand");
  console.log('🧪 Test result:', result);
  if (result && promptSplittingState.currentPhase === 'waiting_confirmation') {
    console.log('🧪 Triggering handleConfirmationReceived');
    handleConfirmationReceived();
  }
};

// Advanced debugging and testing utilities
window.getExtractionAnalytics = function() {
  const analytics = getExtractionAnalytics();
  console.log('📊 Extraction Analytics:', analytics);
  return analytics;
};

window.clearExtractionCache = function() {
  extractionCache.clear();
  console.log('🗑️ Extraction cache cleared');
};

window.getPatternPerformance = function() {
  const patterns = Array.from(patternPerformanceStats.entries()).map(([key, stats]) => ({
    pattern: key,
    ...stats,
    successRate: (stats.successRate * 100).toFixed(1) + '%'
  }));
  console.log('📊 Pattern Performance:', patterns);
  return patterns;
};

window.analyzeExtractionFailures = function(fieldName = null) {
  if (!window.extractionFailures) {
    console.log('No extraction failures recorded');
    return {};
  }
  
  const analysis = {};
  
  for (const [key, failures] of window.extractionFailures.entries()) {
    if (fieldName && !key.includes(fieldName)) continue;
    
    analysis[key] = {
      totalFailures: failures.length,
      recentFailures: failures.slice(-5),
      commonCharacteristics: {
        averageLength: failures.reduce((sum, f) => sum + f.responseLength, 0) / failures.length,
        timePattern: failures.map(f => new Date(f.timestamp).toLocaleTimeString())
      }
    };
  }
  
  console.log('🔍 Extraction Failure Analysis:', analysis);
  return analysis;
};

window.testExtractionPerformance = function(iterations = 10) {
  const testResponse = `**PROPERTY DETAILS:**
- Address: 123 Main Street
- Property Price: $450,000
- Bedrooms: 3
- Bathrooms: 2
- Property Type: Single Family Home
- Square Footage: 1,500

**LOCATION & NEIGHBORHOOD ANALYSIS:**
- Location Score: 8/10
- Great neighborhood with excellent schools

**RENTAL INCOME ANALYSIS:**
- Estimated Monthly Rental Income: $2,200

**INVESTMENT SUMMARY:**
- Strong investment potential
- Good location and pricing`;

  console.log(`🧪 Running performance test with ${iterations} iterations...`);
  
  const startTime = performance.now();
  const results = [];
  
  for (let i = 0; i < iterations; i++) {
    const iterationStart = performance.now();
    const result = extractPropertyAnalysisData(testResponse);
    const iterationTime = performance.now() - iterationStart;
    
    results.push({
      iteration: i + 1,
      extractionTime: iterationTime,
      fieldsExtracted: Object.keys(result.extractedData).length,
      success: Object.keys(result.extractedData).length > 0
    });
  }
  
  const totalTime = performance.now() - startTime;
  const avgTime = totalTime / iterations;
  const successRate = results.filter(r => r.success).length / iterations * 100;
  
  const performanceReport = {
    totalTime: totalTime.toFixed(2) + 'ms',
    averageTime: avgTime.toFixed(2) + 'ms',
    successRate: successRate.toFixed(1) + '%',
    iterations,
    results: results.slice(0, 5) // Show first 5 results
  };
  
  console.log('⚡ Performance Test Results:', performanceReport);
  return performanceReport;
};

window.validateExtractionAccuracy = function(expectedData, actualResponse) {
  console.log('🎯 Validating extraction accuracy...');
  
  const extracted = extractPropertyAnalysisData(actualResponse);
  if (!extracted) {
    console.log('❌ Extraction failed completely');
    return { accuracy: 0, details: 'Complete extraction failure' };
  }
  
  const accuracy = {};
  let totalFields = 0;
  let correctFields = 0;
  
  for (const [field, expectedValue] of Object.entries(expectedData)) {
    totalFields++;
    const extractedValue = extracted.extractedData[field];
    
    if (extractedValue && extractedValue.toString().toLowerCase().includes(expectedValue.toString().toLowerCase())) {
      correctFields++;
      accuracy[field] = { expected: expectedValue, extracted: extractedValue, correct: true };
    } else {
      accuracy[field] = { expected: expectedValue, extracted: extractedValue || 'NOT_FOUND', correct: false };
    }
  }
  
  const accuracyPercentage = (correctFields / totalFields * 100).toFixed(1);
  
  const report = {
    accuracyPercentage: accuracyPercentage + '%',
    correctFields,
    totalFields,
    fieldAccuracy: accuracy
  };
  
  console.log('🎯 Accuracy Report:', report);
  return report;
};

// Add comprehensive debugging function
window.testPropertyExtraction = function(sampleResponse) {
  console.log('🧪=== TESTING PROPERTY EXTRACTION ===');
  console.log('📝 Input text length:', sampleResponse ? sampleResponse.length : 0);
  
  if (!sampleResponse) {
    sampleResponse = `**PROPERTY DETAILS:**
- Address: 123 Main Street
- Property Price: $450,000
- Bedrooms: 3
- Bathrooms: 2
- Property Type: Single Family Home
- Square Footage: 1,500

**LOCATION & NEIGHBORHOOD ANALYSIS:**
- Location Score: 8/10
- Great neighborhood with excellent schools

**RENTAL INCOME ANALYSIS:**
- Estimated Monthly Rental Income: $2,200

**INVESTMENT SUMMARY:**
- Strong investment potential
- Good location and pricing`;
  }
  
  console.log('📝 Sample text (first 400 chars):', sampleResponse.substring(0, 400) + '...');
  
  // Test extraction
  console.log('🔍=== RUNNING FULL EXTRACTION ===');
  const result = extractPropertyAnalysisData(sampleResponse);
  
  console.log('📊 EXTRACTION RESULTS:');
  console.log('   Total data points extracted:', Object.keys(result.extractedData).length);
  console.log('   Extracted data:', result.extractedData);
  console.log('   Has streetName:', !!result.extractedData.streetName);
  console.log('   Has price:', !!result.extractedData.price);
  console.log('   Has propertyType:', !!result.extractedData.propertyType);
  
  return result;
};

// Quick test with common patterns
window.quickTestPatterns = function() {
  const testCases = [
    'Address: 123 Main Street',
    'Property Price: $450,000',
    '• Address: 456 Oak Avenue',
    '• Price: 350K',
    'This property at 789 Pine Road is priced at $400,000',
    'Located at 321 Elm Street for approximately $425,000'
  ];
  
  console.log('🧪=== QUICK PATTERN TESTS ===');
  
  testCases.forEach((testCase, index) => {
    console.log(`\n📋 Test ${index + 1}: "${testCase}"`);
    const result = extractPropertyAnalysisData(testCase);
    console.log('   Result:', result.extractedData);
  });
};

// Test patterns with source links
window.testSourceLinks = function() {
  const testCases = [
    'Address: 123 Main Street [Source: Zillow.com]',
    'Property Price: $450,000 [Source: Realtor.com]',
    '• Address: 456 Oak Avenue (Source: MLS)',
    '• Price: 350K [Source: Zillow]',
    'This property at 789 Pine Road is priced at $400,000 [Source: Trulia]',
    'Located at 321 Elm Street for approximately $425,000 (From: Realtor.com)',
    'Price: $299,000 [Src: RedFin]',
    'Address: 555 Elm Drive (Source: Property Records)'
  ];
  
  console.log('🧪=== SOURCE LINK PATTERN TESTS ===');
  
  testCases.forEach((testCase, index) => {
    console.log(`\n📋 Test ${index + 1}: "${testCase}"`);
    const result = extractPropertyAnalysisData(testCase);
    console.log('   Result:', result.extractedData);
  });
};

// Test function for current webpage
window.testCurrentExtraction = function() {
  const messages = document.querySelectorAll('[data-message-author-role="assistant"]');
  if (messages.length > 0) {
    const lastMessage = messages[messages.length - 1];
    const messageText = lastMessage.textContent || lastMessage.innerText || '';
    console.log('🧪 Testing extraction on current ChatGPT response');
    return window.testPropertyExtraction(messageText);
  } else {
    console.log('❌ No ChatGPT messages found on current page');
    return null;
  }
};

// Comprehensive diagnostic function
window.diagnoseProblem = function() {
  console.log('🔍=== COMPREHENSIVE EXTRACTION DIAGNOSIS ===');
  
  // 1. Check if extension is properly loaded
  console.log('📋 1. Extension Status:');
  console.log('   Extension active:', typeof extractPropertyAnalysisData === 'function');
  console.log('   Current URL:', window.location.href);
  console.log('   Is ChatGPT site:', window.location.hostname.includes('chatgpt.com') || window.location.hostname.includes('openai.com'));
  
  // 2. Check for ChatGPT messages
  console.log('📋 2. ChatGPT Messages:');
  const messages = document.querySelectorAll('[data-message-author-role="assistant"]');
  console.log('   Total assistant messages found:', messages.length);
  
  if (messages.length > 0) {
    const lastMessage = messages[messages.length - 1];
    const messageText = lastMessage.textContent || lastMessage.innerText || '';
    console.log('   Last message length:', messageText.length);
    console.log('   Last message preview:', messageText.substring(0, 200) + '...');
    
    // 3. Check keyword detection
    console.log('📋 3. Keyword Detection:');
    const propertyKeywords = [
      'property', 'analysis', 'listing', 'bedroom', 'bathroom', 'price',
      'sqft', 'square feet', 'built', 'neighborhood', 'market', 'investment'
    ];
    
    const keywordMatches = propertyKeywords.filter(keyword => 
      messageText.toLowerCase().includes(keyword)
    );
    
    console.log('   Keywords found:', keywordMatches);
    console.log('   Keyword count:', keywordMatches.length, '(needs >= 2)');
    
    // 4. Test extraction
    console.log('📋 4. Extraction Test:');
    const result = extractPropertyAnalysisData(messageText);
    console.log('   Extraction result:', result);
    console.log('   Data points extracted:', Object.keys(result?.extractedData || {}).length);
    console.log('   Extracted data:', result?.extractedData);
    
    return result;
  } else {
    console.log('   ❌ No assistant messages found');
  }
  
  // 5. Check current property analysis state
  console.log('📋 5. Property Analysis State:');
  console.log('   currentPropertyAnalysis:', typeof currentPropertyAnalysis !== 'undefined' ? currentPropertyAnalysis : 'undefined');
  console.log('   promptSplittingState:', typeof promptSplittingState !== 'undefined' ? promptSplittingState : 'undefined');
  
  // 6. Check for any console errors
  console.log('📋 6. Recent Console Activity:');
  console.log('   Check above for any error messages or warnings');
  console.log('   Look for extraction-related logs starting with 🔍, ✅, or ❌');
  
  console.log('🔍=== END DIAGNOSIS ===');
  
  return {
    extensionActive: typeof extractPropertyAnalysisData === 'function',
    messagesFound: messages.length,
    keywordMatches: messages.length > 0 ? keywordMatches : [],
    extractionResult: messages.length > 0 ? result : null
  };
};

// Force extraction on current message (bypasses all session tracking)
window.forceExtractCurrent = function() {
  console.log('🚀 FORCING EXTRACTION ON CURRENT MESSAGE');
  
  const messages = document.querySelectorAll('[data-message-author-role="assistant"]');
  if (messages.length === 0) {
    console.log('❌ No assistant messages found');
    return null;
  }
  
  const lastMessage = messages[messages.length - 1];
  const messageText = lastMessage.textContent || lastMessage.innerText || '';
  
  console.log('📝 Message length:', messageText.length);
  console.log('📝 Message preview:', messageText.substring(0, 300) + '...');
  
  // Force extraction
  const analysisData = extractPropertyAnalysisData(messageText);
  
  if (analysisData && (Object.keys(analysisData.extractedData).length > 0 || analysisData.fullResponse)) {
    console.log('✅ Extraction successful!');
    console.log('📊 Extracted data:', analysisData.extractedData);
    
    // Try to save it (using dummy URL if needed)
    const propertyUrl = prompt('Enter property URL for this analysis:') || `manual_${Date.now()}`;
    
    chrome.runtime.sendMessage({
      action: 'savePropertyAnalysis',
      propertyUrl: propertyUrl,
      sessionId: `manual_${Date.now()}`,
      analysisData: analysisData
    }).then(response => {
      console.log('💾 Save response:', response);
    }).catch(err => {
      console.error('❌ Save failed:', err);
    });
    
    return analysisData;
  } else {
    console.log('❌ No data extracted');
    return null;
  }
};
window.debugPromptSplittingState = function() {
  console.log('=== PROMPT SPLITTING DEBUG INFO ===');
  console.log('🔧 Current state:', promptSplittingState);
  console.log('🔧 Enabled:', promptSplittingState.enabled);
  console.log('🔧 Length threshold:', promptSplittingState.lengthThreshold);
  console.log('🔧 Current phase:', promptSplittingState.currentPhase);
  console.log('🔧 Pending property link:', promptSplittingState.pendingPropertyLink);
  console.log('🔧 Fallback attempted:', promptSplittingState.fallbackAttempted);
  
  // Test dynamic prompt length
  generateDynamicPrompt().then(prompt => {
    const testPrompt = prompt.replace('{PROPERTY_URL}', 'https://example.com/test-property')
                            .replace('{DATE}', new Date().toLocaleDateString());
    console.log('🔧 Sample dynamic prompt length:', testPrompt.length);
    console.log('🔧 Would trigger splitting:', shouldSplitPrompt(testPrompt));
    console.log('🔧 Sample prompt preview:', testPrompt.substring(0, 200) + '...');
  });
  
  // Check input field status
  const inputField = document.querySelector('textarea[data-id="root"]') || 
                    document.querySelector('#prompt-textarea') ||
                    document.querySelector('textarea') ||
                    document.querySelector('[contenteditable="true"]');
  console.log('🔧 Input field found:', !!inputField);
  console.log('🔧 Input field type:', inputField ? inputField.tagName : 'none');
  
  console.log('=== END DEBUG INFO ===');
};

// Add function to manually test prompt splitting with a property link
window.testPromptSplitting = function(propertyLink) {
  const testLink = propertyLink || 'https://example.com/test-property';
  console.log('🧪 Testing prompt splitting with link:', testLink);
  insertPropertyAnalysisPrompt(testLink);
};



// Test View Analysis functionality
window.testViewAnalysis = async function() {
  console.log('🧪 Testing View Analysis functionality...');
  
  try {
    const result = await chrome.storage.local.get(['propertyHistory']);
    const properties = result.propertyHistory || [];
    
    console.log('📊 Found', properties.length, 'properties in storage');
    
    if (properties.length === 0) {
      console.log('❌ No properties found. Analyze some properties first.');
      return;
    }
    
    properties.forEach((property, index) => {
      console.log(`\n🏠 Property ${index + 1}:`);
      console.log('   URL:', property.url);
      console.log('   Has analysis:', !!property.analysis);
      console.log('   Has fullResponse:', !!(property.analysis?.fullResponse));
      console.log('   Has fullAnalysis:', !!(property.analysis?.fullAnalysis));
      console.log('   fullResponse length:', property.analysis?.fullResponse?.length || 0);
      console.log('   fullAnalysis length:', property.analysis?.fullAnalysis?.length || 0);
      console.log('   extractedData keys:', Object.keys(property.analysis?.extractedData || {}));
      
      if (property.analysis?.fullResponse) {
        console.log('   fullResponse preview:', property.analysis.fullResponse.substring(0, 200) + '...');
      } else if (property.analysis?.fullAnalysis) {
        console.log('   fullAnalysis preview:', property.analysis.fullAnalysis.substring(0, 200) + '...');
      }
    });
    
    // Test the first property with analysis
    const propertyWithAnalysis = properties.find(p => p.analysis && (p.analysis.fullResponse || p.analysis.fullAnalysis));
    
    if (propertyWithAnalysis) {
      console.log('\n🔍 Testing View Analysis modal with:', propertyWithAnalysis.url);
      if (window.embeddedUI) {
        window.embeddedUI.viewProperty(propertyWithAnalysis.url);
      } else {
        console.log('❌ embeddedUI not available');
      }
    } else {
      console.log('\n❌ No properties found with saved analysis text');
      console.log('💡 Try analyzing a property first, then test this function');
    }
    
  } catch (error) {
    console.error('❌ Error testing View Analysis:', error);
  }
};



} // End of multiple execution prevention block