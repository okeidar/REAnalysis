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

// Extension context state tracking
let extensionContextValid = true;
let lastContextCheck = Date.now();
const CONTEXT_CHECK_INTERVAL = 5000; // Check every 5 seconds

// Function to check if extension context is still valid
function isExtensionContextValid() {
  const now = Date.now();
  
  // Only check periodically to avoid performance issues
  if (now - lastContextCheck < CONTEXT_CHECK_INTERVAL && extensionContextValid) {
    return extensionContextValid;
  }
  
  try {
    lastContextCheck = now;
    const isValid = !!(chrome && chrome.runtime && chrome.runtime.id);
    
    if (!isValid && extensionContextValid) {
      console.warn('🔄 Extension context invalidated - disabling Chrome API calls');
      extensionContextValid = false;
      handleContextInvalidation();
    } else if (isValid && !extensionContextValid) {
      console.log('✅ Extension context restored');
      extensionContextValid = true;
    }
    
    return isValid;
  } catch (err) {
    if (extensionContextValid) {
      console.warn('⚠️ Extension context validation failed:', err.message);
      extensionContextValid = false;
      handleContextInvalidation();
    }
    return false;
  }
}

// Handle extension context invalidation
function handleContextInvalidation() {
  console.warn('🔧 Handling extension context invalidation...');
  
  // Disable features that require chrome APIs
  if (typeof embeddedUI !== 'undefined' && embeddedUI) {
    try {
      embeddedUI.disableChromeFeatures();
    } catch (err) {
      console.warn('Failed to disable Chrome features:', err);
    }
  }
  
  // Show user notification about extension state
  showContextInvalidationNotice();
}

// Show notice about context invalidation
function showContextInvalidationNotice() {
  const existingNotice = document.getElementById('re-context-notice');
  if (existingNotice) return; // Don't show multiple notices
  
  const notice = document.createElement('div');
  notice.id = 're-context-notice';
  notice.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #ff6b6b;
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    font-family: system-ui, sans-serif;
    font-size: 14px;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    max-width: 300px;
    cursor: pointer;
  `;
  notice.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 4px;">🔄 Extension Reloaded</div>
    <div style="font-size: 12px;">RE Analyzer needs a page refresh to work properly. Click to refresh.</div>
  `;
  
  notice.addEventListener('click', () => {
    window.location.reload();
  });
  
  document.body.appendChild(notice);
  
  // Auto-remove after 10 seconds
  setTimeout(() => {
    if (notice.parentNode) {
      notice.remove();
    }
  }, 10000);
}

// Safe wrapper for chrome API calls with enhanced error handling
function safeChromeFall(apiCall, fallbackValue = null) {
  return new Promise((resolve) => {
    try {
      if (!isExtensionContextValid()) {
        console.warn('⚠️ Extension context invalidated, returning fallback value');
        resolve(fallbackValue);
        return;
      }
      
      const result = apiCall();
      
      // Handle both sync and async results
      if (result && typeof result.then === 'function') {
        result
          .then(resolve)
          .catch(err => {
            if (isContextInvalidationError(err)) {
              console.warn('⚠️ Extension context invalidated during async API call:', err.message);
              extensionContextValid = false;
              handleContextInvalidation();
              resolve(fallbackValue);
            } else {
              console.error('Chrome API call failed:', err);
              resolve(fallbackValue); // Resolve with fallback instead of throwing
            }
          });
      } else {
        resolve(result);
      }
    } catch (err) {
      if (isContextInvalidationError(err)) {
        console.warn('⚠️ Extension context invalidated during sync API call:', err.message);
        extensionContextValid = false;
        handleContextInvalidation();
        resolve(fallbackValue);
      } else {
        console.error('Chrome API call failed:', err);
        resolve(fallbackValue); // Resolve with fallback instead of throwing
      }
    }
  });
}

// Check if an error indicates context invalidation
function isContextInvalidationError(err) {
  if (!err || !err.message) return false;
  
  const invalidationMessages = [
    'Extension context invalidated',
    'Unexpected token',
    'runtime.lastError',
    'The message port closed before a response was received',
    'Could not establish connection'
  ];
  
  return invalidationMessages.some(msg => err.message.includes(msg));
}

// Progressive response saving function
function saveProgressiveResponse(messageText, propertyUrl, saveCount) {
  console.log(`💾 Saving progressive response #${saveCount} for:`, propertyUrl);
  
  // Extract analysis data from current response
  const analysisData = extractPropertyAnalysisData(messageText);
  
  if (analysisData && analysisData.fullResponse) {
    console.log(`📊 Progressive save #${saveCount} analysis data:`, {
      fullResponseLength: analysisData.fullResponse.length,
      extractedDataKeys: Object.keys(analysisData.extractedData || {}),
      timestamp: new Date().toLocaleTimeString()
    });
    
    // Save with progressive flag to indicate it's an interim save
    analysisData.progressive = true;
    analysisData.saveCount = saveCount;
    analysisData.progressiveTimestamp = Date.now();
    
    // Send to background script for saving
    safeChromeFall(() => {
      return chrome.runtime.sendMessage({
        action: 'savePropertyAnalysis',
        propertyUrl: propertyUrl,
        sessionId: `progressive_${Date.now()}_${saveCount}`,
        analysisData: analysisData
      });
    }).then(response => {
      if (response && response.success) {
        console.log(`✅ Progressive save #${saveCount} successful for:`, propertyUrl);
      }
    }).catch(err => {
      console.error(`❌ Progressive save #${saveCount} failed:`, err);
    });
  } else {
    console.log(`⚠️ Progressive save #${saveCount} skipped - no extractable data yet`);
  }
}

// Global variable to track current property analysis (already declared above with embedded UI variables)

// Track processed messages per property URL to prevent cross-contamination
let processedMessagesPerProperty = new Map();

// Continuous response tracking for progressive saving
let continuousResponseTracker = {
  activeTracking: new Map(), // url -> {lastLength, lastSaved, saveCount, maxLength}
  saveInterval: 2000, // Save every 2 seconds if response is growing
  minLengthDifference: 200 // Save if response grew by 200+ characters
};

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
    this.chromeApiEnabled = true;
    this.settingsDisabled = false;
    this.contextCheckInterval = null;
    
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
      
      // Set up event delegation for property actions
      this.setupEventDelegation();
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Start context monitoring
      this.startContextMonitoring();
      
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
    if (this.settingsDisabled || !this.chromeApiEnabled) {
      console.log('⚠️ Settings disabled due to context invalidation, using defaults');
      this.uiSettings = { ...uiSettings };
      return;
    }
    
    try {
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
          const localSettings = localStorage.getItem('reAnalyzerSettings');
          if (localSettings) {
            const parsedSettings = JSON.parse(localSettings);
            uiSettings = { ...uiSettings, ...parsedSettings };
            settingsLoaded = true;
            console.log('📋 Loaded UI settings from localStorage fallback:', uiSettings);
          }
        } catch (localError) {
          console.warn('Failed to load settings from localStorage:', localError);
        }
      }
      
      if (!settingsLoaded) {
        console.log('📋 Using default UI settings:', uiSettings);
      }
      
    } catch (error) {
      console.warn('Failed to load UI settings:', error);
    }
  }

  createFloatingActionButton() {
    // Remove existing FAB if it exists
    const existingFab = document.getElementById('re-analyzer-toggle');
    if (existingFab) {
      existingFab.remove();
    }

    // Create ChatGPT-style floating toggle
    this.fab = document.createElement('button');
    this.fab.id = 're-analyzer-toggle';
    this.fab.className = 're-floating-toggle re-chatgpt-native';
    this.fab.title = 'RE Analyzer';
    this.fab.innerHTML = '🏠';

    // Add to page
    document.body.appendChild(this.fab);

    // FAB click handler
    this.fab.addEventListener('click', () => {
      this.togglePanel();
    });

    console.log('🎯 Created ChatGPT-style floating toggle');
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
            <div style="font-size: 12px; color: var(--chatgpt-text-secondary); margin-top: 4px;">
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
            <div style="font-size: 12px; color: var(--chatgpt-text-secondary); margin-top: 4px;">
              Automatically switch to Properties tab after analysis
            </div>
          </div>

          <div class="re-form-group">
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
              <input type="checkbox" id="re-notifications-toggle" style="margin: 0;" checked>
              <span class="re-form-label" style="margin: 0;">Show Notifications</span>
            </label>
            <div style="font-size: 12px; color: var(--chatgpt-text-secondary); margin-top: 4px;">
              Display notifications when analysis completes
            </div>
          </div>
        </div>

        <!-- Custom Prompt Settings -->
        <div class="re-section">
          <div class="re-section-header">
            <div class="re-section-title">Custom Analysis Prompt</div>
            <div class="re-section-subtitle">Customize the AI analysis instructions</div>
          </div>
          
          <div class="re-form-group">
            <label class="re-form-label">Analysis Prompt Template</label>
            <textarea id="re-custom-prompt" class="re-form-input" rows="8" 
                      placeholder="Enter your custom prompt template here...">
            </textarea>
            <div style="font-size: 12px; color: var(--chatgpt-text-secondary); margin-top: 4px;">
              Use {PROPERTY_URL} for the property link and {DATE} for current date
            </div>
          </div>
          
          <div style="display: flex; gap: 8px;">
            <button class="re-btn re-btn-primary" id="re-save-prompt">
              <div>💾</div>
              <span>Save Prompt</span>
            </button>
            <button class="re-btn re-btn-ghost" id="re-reset-prompt">
              <div>🔄</div>
              <span>Reset to Default</span>
            </button>
          </div>
        </div>

        <!-- Actions -->
        <div class="re-section">
          <div class="re-section-header">
            <div class="re-section-title">Data Management</div>
          </div>
          
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <button class="re-btn re-btn-secondary re-btn-full" id="re-export-all">
              <div>📄</div>
              <span>Export All Properties</span>
            </button>
            <button class="re-btn re-btn-secondary re-btn-full" id="re-test-analysis">
              <div>🧪</div>
              <span>Test Analysis</span>
            </button>
            <label class="re-setting-item" style="margin: 8px 0; font-size: 14px; cursor: pointer;">
              <input type="checkbox" id="re-allow-any-url" style="margin-right: 8px;">
              <span>Allow any URL (bypass domain validation)</span>
            </label>
            <button class="re-btn re-btn-ghost re-btn-full" id="re-clear-data">
              <div>🗑️</div>
              <span>Clear All Data</span>
            </button>
          </div>
        </div>

        <!-- Version Info -->
        <div style="text-align: center; padding: 16px; color: var(--chatgpt-text-tertiary); font-size: 12px;">
          RE Analyzer v2.0.0 - Native Integration
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
              <span class="re-btn-icon">📄</span>
              Export
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
              <p class="re-setting-description">Automatically suggest categories for new properties</p>
            </div>
            <div class="re-setting-item">
              <label class="re-setting-label">
                <input type="checkbox" id="re-show-notifications" class="re-checkbox" checked>
                <span class="re-setting-title">Show analysis notifications</span>
              </label>
              <p class="re-setting-description">Display notifications when analysis is complete</p>
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
              <p class="re-setting-description">Use smaller interface elements</p>
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
              <select id="re-export-format" class="re-select">
                <option value="word">Word Document</option>
                <option value="csv">CSV Spreadsheet</option>
                <option value="json">JSON Data</option>
              </select>
            </div>
            <div class="re-setting-item">
              <label class="re-setting-label">
                <input type="checkbox" id="re-include-full-analysis" class="re-checkbox" checked>
                <span class="re-setting-title">Include full analysis text</span>
              </label>
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
    
    // Custom prompt handling
    this.setupCustomPromptSettings();

    // Action buttons
    const exportBtn = this.panel.querySelector('#re-export-all');
    const testBtn = this.panel.querySelector('#re-test-analysis');
    const clearBtn = this.panel.querySelector('#re-clear-data');

    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportAllProperties());
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
  }
  
  async setupCustomPromptSettings() {
    const promptTextarea = this.panel.querySelector('#re-custom-prompt');
    const savePromptBtn = this.panel.querySelector('#re-save-prompt');
    const resetPromptBtn = this.panel.querySelector('#re-reset-prompt');
    
    if (!promptTextarea) return;
    
    try {
      // Load existing custom prompt
      const result = await safeChromeFall(
        () => chrome.storage.local.get(['customPrompt']),
        { customPrompt: null }
      );
      
      if (result.customPrompt) {
        promptTextarea.value = result.customPrompt;
      } else {
        // Load default prompt
        const defaultPrompt = getDefaultPromptTemplate();
        promptTextarea.placeholder = defaultPrompt;
      }
      
    } catch (error) {
      console.warn('Failed to load custom prompt:', error);
    }
    
    if (savePromptBtn) {
      savePromptBtn.addEventListener('click', async () => {
        const promptText = promptTextarea.value.trim();
        
        if (!promptText) {
          this.showChatGPTMessage('warning', 'Please enter a prompt template');
          return;
        }
        
        if (!promptText.includes('{PROPERTY_URL}')) {
          this.showChatGPTMessage('error', 'Prompt must include {PROPERTY_URL} placeholder');
          return;
        }
        
        try {
          await safeChromeFall(
            () => chrome.storage.local.set({ customPrompt: promptText }),
            null
          );
          
          this.showChatGPTMessage('success', 'Custom prompt saved successfully!');
          
        } catch (error) {
          console.error('Failed to save custom prompt:', error);
          this.showChatGPTMessage('error', 'Failed to save custom prompt');
        }
      });
    }
    
    if (resetPromptBtn) {
      resetPromptBtn.addEventListener('click', async () => {
        if (confirm('Reset to default prompt? This will overwrite your custom prompt.')) {
          try {
            await safeChromeFall(
              () => chrome.storage.local.remove(['customPrompt']),
              null
            );
            
            const defaultPrompt = getDefaultPromptTemplate();
            promptTextarea.value = defaultPrompt;
            
            this.showChatGPTMessage('success', 'Prompt reset to default');
            
          } catch (error) {
            console.error('Failed to reset prompt:', error);
            this.showChatGPTMessage('error', 'Failed to reset prompt');
          }
        }
      });
    }
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
    
    // Tab-specific logic
    if (tabId === 'properties') {
      this.loadChatGPTPropertyData();
    } else if (tabId === 'analyzer') {
      this.updateChatGPTConnectionStatus();
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
    
    // Check if we're on ChatGPT
    if (isChatGPTSite()) {
      statusElement.className = 're-status re-status-connected';
      if (statusIcon) statusIcon.textContent = '✅';
      if (statusTitle) statusTitle.textContent = 'Connected to ChatGPT';
      if (statusSubtitle) statusSubtitle.textContent = 'Ready to analyze properties';
    } else {
      statusElement.className = 're-status re-status-error';
      if (statusIcon) statusIcon.textContent = '❌';
      if (statusTitle) statusTitle.textContent = 'Not on ChatGPT';
      if (statusSubtitle) statusSubtitle.textContent = 'Please open ChatGPT to use this extension';
    }
  }

  async loadChatGPTPropertyData() {
    if (!this.chromeApiEnabled) {
      console.log('⚠️ Property data loading disabled due to context invalidation');
      this.displayNoDataMessage('Extension needs refresh to load property data');
      return;
    }
    
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
      } else {
        // If extension context is invalidated, show a message but continue with empty state
        console.log('📚 Extension context invalidated, showing empty property state');
        this.showChatGPTMessage('warning', 'Extension context lost. Please reload the page to access saved properties.');
      }
      
      // Update stats
      const analyzedCount = properties.filter(p => p.analysis && p.analysis.extractedData).length;
      const sources = [...new Set(properties.map(p => p.domain))].length;
      
      this.updateChatGPTStats(properties.length, analyzedCount, sources);
      
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
    
    if (totalElement) totalElement.textContent = total.toString();
    if (analyzedElement) analyzedElement.textContent = analyzed.toString();
    if (sourcesElement) sourcesElement.textContent = sources.toString();
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
      
      // Extract key property details for display
      let propertyDetails = '';
      if (hasAnalysis && property.analysis.extractedData) {
        const data = property.analysis.extractedData;
        const details = [];
        
        if (data.bedrooms) details.push(`${data.bedrooms} bed`);
        if (data.bathrooms) details.push(`${data.bathrooms} bath`);
        if (data.squareFeet) details.push(`${parseInt(data.squareFeet).toLocaleString()} sqft`);
        
        if (details.length > 0) {
          propertyDetails = `<div class="re-property-details">${details.join(' • ')}</div>`;
        }
      }
      
      const propertyCard = document.createElement('div');
      propertyCard.className = 're-property-card';
      propertyCard.innerHTML = `
        <div class="re-property-header">
          <div class="re-property-title">${title}</div>
          <div class="re-property-status ${hasAnalysis ? 're-analyzed' : 're-pending'}">
            ${hasAnalysis ? '✅ Analyzed' : '⏳ Pending'}
          </div>
        </div>
        ${propertyDetails}
        <div class="re-property-meta">
          <div class="re-property-domain">${domain}</div>
          <div>${property.date || 'Unknown date'}</div>
        </div>
        <div class="re-property-actions">
          <button class="re-btn re-btn-ghost re-btn-sm" onclick="embeddedUI.viewProperty('${property.url}')">
            🔍 View Analysis
          </button>
          ${hasAnalysis ? `
            <button class="re-btn re-btn-secondary re-btn-sm" onclick="embeddedUI.exportProperty('${property.url}')">
              📄 Export
            </button>
          ` : `
            <button class="re-btn re-btn-primary re-btn-sm" onclick="embeddedUI.analyzeExistingProperty('${property.url}')">
              🔍 Analyze
            </button>
          `}
        </div>
      `;
      
      propertiesList.appendChild(propertyCard);
    });

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
        badge.textContent = count.toString();
        badge.classList.remove('re-hidden');
      } else {
        badge.classList.add('re-hidden');
      }
    }
  }

  async exportAllProperties() {
    try {
      // Load all property data from storage
      const result = await safeChromeFall(
        () => chrome.storage.local.get(['propertyHistory']),
        { propertyHistory: [] }
      );
      
      const properties = result.propertyHistory || [];
      
      if (properties.length === 0) {
        this.showChatGPTMessage('warning', 'No properties to export');
        return;
      }
      
      // Create comprehensive export data
      const exportData = {
        exportDate: new Date().toISOString(),
        totalProperties: properties.length,
        analyzedProperties: properties.filter(p => p.analysis && p.analysis.extractedData).length,
        properties: properties.map(property => ({
          propertyUrl: property.url,
          domain: property.domain,
          dateAnalyzed: property.date,
          extractedData: property.analysis?.extractedData || {},
          fullAnalysis: property.analysis?.fullResponse || property.analysis?.fullAnalysis || '',
          timestamp: property.timestamp || Date.now(),
          hasAnalysis: !!(property.analysis && property.analysis.extractedData)
        }))
      };
      
      // Create and download JSON file
      const jsonData = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonData], { type: 'application/json' });
      const downloadUrl = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `re-analyzer-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
      
      this.showChatGPTMessage('success', `Exported ${properties.length} properties successfully!`);
      
    } catch (error) {
      console.error('❌ Failed to export all properties:', error);
      this.showChatGPTMessage('error', 'Failed to export properties');
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
      const testUrl = prompt(`Choose a test URL (enter 1, 2, 3, 4, or 5):
1. Zillow Test URL
2. Realtor.com Test URL  
3. Redfin Test URL
4. Monitor ChatGPT responses (for debugging)
5. Debug saved analysis data
      
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

  checkExtensionContext() {
    if (!isExtensionContextValid()) {
      console.warn('⚠️ Extension context invalidated during initialization');
      this.showChatGPTMessage('warning', 'Extension was updated. Please reload the page for full functionality.');
      
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
        
        // Keep progress visible while waiting for ChatGPT response
        console.log('✅ Analysis sent to ChatGPT, waiting for response...');
        this.showChatGPTMessage('info', 'Analysis sent to ChatGPT. Waiting for response...');
        
        // Don't hide progress here - it will be hidden when the analysis completes
        // The response monitor will handle completion detection
        
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
      const testInput = findChatGPTInput();
      if (!testInput) {
        throw new Error('Could not find ChatGPT input field. Make sure you are on the ChatGPT page and it has loaded completely.');
      }
      console.log('✅ ChatGPT input field found:', testInput);
      
      // Use the existing insertPropertyAnalysisPrompt function from the original content script
      console.log('🔗 Connecting to existing analysis functionality...');
      
      // Store the URL in the embedded UI context
      currentPropertyAnalysis = { url, startTime: Date.now() };
      
      // Call the existing insertPropertyAnalysisPrompt function
      const result = await insertPropertyAnalysisPrompt(url);
      
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
    }
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
    // Update final progress steps
    this.updateAnalysisStep('analyze', 'completed');
    this.updateAnalysisStep('save', 'completed');
    
    // Show completion message
    this.showChatGPTMessage('success', 'Property analysis completed successfully!');
    
    // Hide progress after a brief delay
    setTimeout(() => {
      this.hideAnalysisProgress();
    }, 2000);
    
    // Show notification on FAB
    this.showFabNotification();
    
    // Auto-switch to properties tab if enabled
    if (uiSettings.autoShow) {
      console.log('🔄 Auto-switching to Properties tab after analysis completion');
      setTimeout(() => {
        this.switchTab('properties');
        // Reload property data to show the new analysis
        this.loadChatGPTPropertyData();
      }, 2000);
    }
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
    
    if (totalElement) totalElement.textContent = total.toString();
    if (analyzedElement) analyzedElement.textContent = analyzed.toString();
    if (categoriesElement) categoriesElement.textContent = categories.toString();
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
      propertyItem.innerHTML = `
        <div class="re-property-content">
          <div class="re-property-header">
            <h5 class="re-property-title">${this.getPropertyTitle(property)}</h5>
            <span class="re-property-status ${hasAnalysis ? 're-status-analyzed' : 're-status-pending'}">
              ${hasAnalysis ? '✅ Analyzed' : '⏳ Pending'}
            </span>
          </div>
          <div class="re-property-details">
            <span class="re-property-domain">${property.domain}</span>
            <span class="re-property-date">${property.date || 'Unknown date'}</span>
            ${hasAnalysis ? `<span class="re-analysis-date">Analyzed: ${analysisDate}</span>` : ''}
          </div>
          <div class="re-property-actions">
            <button class="re-btn re-btn-ghost re-btn-sm" onclick="embeddedUI.viewProperty('${property.url}')">
              View
            </button>
            ${hasAnalysis ? `
              <button class="re-btn re-btn-secondary re-btn-sm" onclick="embeddedUI.exportProperty('${property.url}')">
                Export
              </button>
            ` : `
              <button class="re-btn re-btn-primary re-btn-sm" onclick="embeddedUI.analyzeExistingProperty('${property.url}')">
                Analyze
              </button>
            `}
          </div>
        </div>
      `;
      
      propertiesList.appendChild(propertyItem);
    });
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

  getPropertyTitle(property) {
    // Extract meaningful property data from analysis for display
    try {
      if (property.analysis && property.analysis.extractedData) {
        const data = property.analysis.extractedData;
        
        // Try to build a meaningful title from extracted data
        const address = data.streetName || data.address;
        const price = data.price;
        const bedrooms = data.bedrooms;
        const propertyType = data.propertyType;
        
        // Priority 1: Address + price
        if (address && price) {
          return `${address} - $${parseInt(price).toLocaleString()}`;
        }
        
        // Priority 2: Address + bedrooms
        if (address && bedrooms) {
          return `${address} (${bedrooms} bed)`;
        }
        
        // Priority 3: Address only
        if (address) {
          return address;
        }
        
        // Priority 4: Property type + price
        if (propertyType && price) {
          return `${propertyType} - $${parseInt(price).toLocaleString()}`;
        }
        
        // Priority 5: Property type + bedrooms
        if (propertyType && bedrooms) {
          return `${propertyType} (${bedrooms} bed)`;
        }
        
        // Priority 6: Just property type
        if (propertyType) {
          return propertyType;
        }
      }
      
      // Fallback to URL-based title
      const url = new URL(property.url);
      const pathParts = url.pathname.split('/').filter(part => part);
      
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
      notification.textContent = recentProperties.length.toString();
      notification.style.display = 'flex';
    } else if (notification) {
      notification.style.display = 'none';
    }
  }

  // Property action methods
  async viewProperty(url) {
    console.log('📖 View saved analysis for property:', url);
    console.log('🔍 DEBUG: embeddedUI object available:', !!window.embeddedUI);
    console.log('🔍 DEBUG: viewProperty method called from:', new Error().stack?.split('\n')[1]);
    
    try {
      // Load property data from storage
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
      
      // Debug what analysis data we have
      console.log('🔍 DEBUG: Property found:', property.url);
      console.log('🔍 DEBUG: Has analysis object:', !!property.analysis);
      console.log('🔍 DEBUG: Analysis keys:', property.analysis ? Object.keys(property.analysis) : 'No analysis');
      console.log('🔍 DEBUG: Has fullResponse:', !!(property.analysis?.fullResponse));
      console.log('🔍 DEBUG: fullResponse length:', property.analysis?.fullResponse?.length || 0);
      console.log('🔍 DEBUG: fullResponse preview:', property.analysis?.fullResponse?.substring(0, 200) || 'No fullResponse');
      console.log('🔍 DEBUG: All analysis data:', property.analysis);
      
      if (!property.analysis) {
        this.showChatGPTMessage('warning', 'No analysis data found for this property. Click "Analyze" to generate analysis.');
        return;
      }
      
      if (!property.analysis.fullResponse && !property.analysis.fullAnalysis) {
        this.showChatGPTMessage('warning', 'No saved ChatGPT response found for this property. The analysis may not have completed properly. Try analyzing again.');
        console.log('🔍 DEBUG: Available analysis fields:', Object.keys(property.analysis));
        return;
      }
      
      // Show the saved ChatGPT analysis in a modal
      this.showAnalysisModal(property);
      
    } catch (error) {
      console.error('❌ Failed to load property analysis:', error);
      this.showChatGPTMessage('error', 'Failed to load saved analysis');
    }
  }

  showAnalysisModal(property) {
    console.log('🖼️ Showing analysis modal for:', property.url);
    
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
    
    // Check if content was truncated
    const wasTruncated = analysisData.truncated || false;
    const originalLength = analysisData.originalLength || 0;
    
    modal.innerHTML = `
      <div class="re-modal">
        <div class="re-modal-header">
          <h3>Saved ChatGPT Analysis</h3>
          <button class="re-modal-close" onclick="this.closest('.re-modal-overlay').remove()">×</button>
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
            ${wasTruncated ? `
              <div class="re-truncation-notice">
                ⚠️ <strong>Content Truncated:</strong> This analysis was truncated due to storage size limits. 
                Original length: ${originalLength.toLocaleString()} characters. 
                Showing first and last portions of the analysis.
              </div>
            ` : ''}
            <div class="re-analysis-text">
              ${this.formatAnalysisText(analysisText)}
            </div>
          </div>
          
          <!-- Analysis Metadata -->
          <div class="re-analysis-section">
            <h4>📅 Analysis Details</h4>
            <div class="re-analysis-meta">
              <div><strong>Date:</strong> ${property.date || 'Unknown'}</div>
              <div><strong>Domain:</strong> ${property.domain || 'Unknown'}</div>
              <div><strong>Data Points:</strong> ${Object.keys(extractedData).length}</div>
              <div><strong>Analysis Length:</strong> ${analysisText.length} characters</div>
            </div>
          </div>
        </div>
        
        <div class="re-modal-footer">
          <button class="re-btn re-btn-secondary" onclick="embeddedUI.copyAnalysisToClipboard('${property.url}')">
            📋 Copy Analysis
          </button>
          <button class="re-btn re-btn-secondary" onclick="window.open('${property.url}', '_blank')">
            🔗 Open Original Listing
          </button>
          <button class="re-btn re-btn-primary" onclick="this.closest('.re-modal-overlay').remove()">
            Close
          </button>
        </div>
      </div>
    `;
    
    // Add modal styles if they don't exist
    this.addModalStyles();
    
    // Add modal to page
    document.body.appendChild(modal);
    
    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
    
    console.log('✅ Analysis modal displayed');
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
    // Basic formatting to make the analysis more readable
    return text
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/^/, '<p>')
      .replace(/$/, '</p>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold text
      .replace(/\*(.*?)\*/g, '<em>$1</em>'); // Italic text
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
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        padding: 20px;
      }
      
      .re-modal {
        background: var(--chatgpt-bg-primary, white);
        border-radius: 12px;
        max-width: 800px;
        max-height: 90vh;
        width: 100%;
        overflow: hidden;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
        display: flex;
        flex-direction: column;
      }
      
      .re-modal-header {
        padding: 20px;
        border-bottom: 1px solid var(--chatgpt-border-light, #e5e5e5);
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: var(--chatgpt-bg-secondary, #f7f7f7);
      }
      
      .re-modal-header h3 {
        margin: 0;
        font-size: 18px;
        color: var(--chatgpt-text-primary, #333);
      }
      
      .re-modal-close {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: var(--chatgpt-text-secondary, #666);
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
        background: var(--chatgpt-bg-hover, #e5e5e5);
      }
      
      .re-modal-content {
        padding: 20px;
        overflow-y: auto;
        flex: 1;
      }
      
      .re-analysis-section {
        margin-bottom: 24px;
      }
      
      .re-analysis-section h4 {
        margin: 0 0 12px 0;
        font-size: 16px;
        color: var(--chatgpt-text-primary, #333);
        border-bottom: 2px solid var(--chatgpt-accent, #10a37f);
        padding-bottom: 4px;
      }
      
      .re-property-link {
        color: var(--chatgpt-accent, #10a37f);
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
        background: var(--chatgpt-bg-secondary, #f7f7f7);
        padding: 12px;
        border-radius: 8px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      
      .re-detail-label {
        font-size: 12px;
        color: var(--chatgpt-text-secondary, #666);
        font-weight: 500;
      }
      
      .re-detail-value {
        font-size: 14px;
        color: var(--chatgpt-text-primary, #333);
        font-weight: 600;
      }
      
      .re-analysis-text {
        background: var(--chatgpt-bg-secondary, #f7f7f7);
        border-radius: 8px;
        padding: 16px;
        font-size: 14px;
        line-height: 1.6;
        color: var(--chatgpt-text-primary, #333);
        max-height: 400px;
        overflow-y: auto;
        white-space: pre-wrap;
      }
      
      .re-truncation-notice {
        background: #fff3cd;
        border: 1px solid #ffeaa7;
        border-radius: 6px;
        padding: 12px;
        margin-bottom: 16px;
        font-size: 13px;
        color: #856404;
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
        color: var(--chatgpt-text-secondary, #666);
      }
      
      .re-modal-footer {
        padding: 20px;
        border-top: 1px solid var(--chatgpt-border-light, #e5e5e5);
        display: flex;
        gap: 12px;
        justify-content: flex-end;
        background: var(--chatgpt-bg-secondary, #f7f7f7);
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
    `;
    
    document.head.appendChild(styles);
  }

  setupEventDelegation() {
    // Set up event delegation for property action buttons
    document.addEventListener('click', (e) => {
      // Handle viewProperty button clicks
      if (e.target.closest('button[onclick*="viewProperty"]')) {
        e.preventDefault();
        const button = e.target.closest('button');
        const onclickAttr = button.getAttribute('onclick');
        const urlMatch = onclickAttr.match(/viewProperty\('([^']+)'\)/);
        if (urlMatch && urlMatch[1]) {
          console.log('🔍 Event delegation: viewProperty clicked for:', urlMatch[1]);
          this.viewProperty(urlMatch[1]);
        }
        return;
      }
      
      // Handle exportProperty button clicks
      if (e.target.closest('button[onclick*="exportProperty"]')) {
        e.preventDefault();
        const button = e.target.closest('button');
        const onclickAttr = button.getAttribute('onclick');
        const urlMatch = onclickAttr.match(/exportProperty\('([^']+)'\)/);
        if (urlMatch && urlMatch[1]) {
          console.log('📄 Event delegation: exportProperty clicked for:', urlMatch[1]);
          this.exportProperty(urlMatch[1]);
        }
        return;
      }
      
      // Handle analyzeExistingProperty button clicks
      if (e.target.closest('button[onclick*="analyzeExistingProperty"]')) {
        e.preventDefault();
        const button = e.target.closest('button');
        const onclickAttr = button.getAttribute('onclick');
        const urlMatch = onclickAttr.match(/analyzeExistingProperty\('([^']+)'\)/);
        if (urlMatch && urlMatch[1]) {
          console.log('🔍 Event delegation: analyzeExistingProperty clicked for:', urlMatch[1]);
          this.analyzeExistingProperty(urlMatch[1]);
        }
        return;
      }
    });
  }

  disableChromeFeatures() {
    console.log('🔧 Disabling Chrome-dependent features due to context invalidation');
    
    // Disable any features that require chrome APIs
    this.chromeApiEnabled = false;
    
    // Show notice in the UI if panel is visible
    if (this.panel && this.isVisible) {
      this.showChatGPTMessage('warning', '🔄 Extension needs refresh - some features disabled');
    }
    
    // Stop any timers or intervals that might make chrome API calls
    clearInterval(this.contextCheckInterval);
    
    // Disable settings loading/saving
    this.settingsDisabled = true;
  }

  startContextMonitoring() {
    // Check extension context periodically
    this.contextCheckInterval = setInterval(() => {
      const wasEnabled = this.chromeApiEnabled;
      const isValid = isExtensionContextValid();
      
      if (!wasEnabled && isValid && extensionContextValid) {
        console.log('✅ Extension context restored - re-enabling features');
        this.chromeApiEnabled = true;
        this.settingsDisabled = false;
        
        // Remove any context invalidation notices
        const notice = document.getElementById('re-context-notice');
        if (notice) notice.remove();
        
        // Show success message
        this.showChatGPTMessage('success', '✅ Extension reconnected - all features restored');
      }
    }, 10000); // Check every 10 seconds
  }

  displayNoDataMessage(message) {
    const propertiesList = this.panel.querySelector('#re-properties-list');
    if (propertiesList) {
      propertiesList.innerHTML = `
        <div style="text-align: center; padding: 20px; color: #666;">
          <div style="font-size: 18px; margin-bottom: 8px;">⚠️</div>
          <div>${message}</div>
        </div>
      `;
    }
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

  async exportProperty(url) {
    console.log('📄 Export property:', url);
    
    try {
      // Load property data from storage
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
        this.showChatGPTMessage('warning', 'No analysis data to export for this property');
        return;
      }
      
      // Create export data
      const exportData = {
        propertyUrl: property.url,
        domain: property.domain,
        dateAnalyzed: property.date,
        extractedData: property.analysis.extractedData || {},
        fullAnalysis: property.analysis.fullResponse || property.analysis.fullAnalysis || '',
        timestamp: property.timestamp || Date.now()
      };
      
      // Create and download JSON file
      const jsonData = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonData], { type: 'application/json' });
      const downloadUrl = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `property-analysis-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
      
      this.showChatGPTMessage('success', 'Property analysis exported successfully!');
      
    } catch (error) {
      console.error('❌ Failed to export property:', error);
      this.showChatGPTMessage('error', 'Failed to export property analysis');
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
    if (this.settingsDisabled || !this.chromeApiEnabled) {
      console.log('⚠️ Settings save disabled due to context invalidation');
      return;
    }
    
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

  exportProperties() {
    // Placeholder for export functionality
    this.showMessage('warning', 'Export functionality will be implemented in the next update');
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
  
  // Wait for page to be ready and ensure extension context is valid
  const initializeWithValidation = () => {
    // Double-check context before initialization
    if (isExtensionContextValid()) {
      embeddedUI = new REAnalyzerEmbeddedUI();
      window.embeddedUI = embeddedUI; // Make globally accessible for onclick handlers
    } else {
      console.warn('🔄 Extension context invalid during initialization - showing refresh notice');
      showContextInvalidationNotice();
    }
  };
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(initializeWithValidation, 1000);
    });
  } else {
    // Page already loaded
    setTimeout(initializeWithValidation, 1000);
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
  
  if (!promptSplittingState.pendingPropertyLink) {
    console.error('❌ No pending property link to send');
    console.error('❌ Current prompt splitting state:', promptSplittingState);
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
    
    if (!propertyLink || propertyLink === 'null' || propertyLink === 'undefined') {
      console.error('❌ Invalid property link detected:', propertyLink);
      await handleSplittingFallback();
      return;
    }
    
    // Clear any existing analysis session to prevent conflicts
    currentPropertyAnalysis = null;
    console.log('🎯 Cleared existing analysis session for prompt splitting');
    
    const linkMessage = propertyLink;  // Send only the raw link
    
    // Insert the link message
    if (inputField.tagName === 'TEXTAREA') {
      inputField.value = '';
      inputField.focus();
      inputField.value = linkMessage;
      inputField.dispatchEvent(new Event('input', { bubbles: true }));
      inputField.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (inputField.contentEditable === 'true') {
      inputField.textContent = '';
      inputField.focus();
      inputField.textContent = linkMessage;
      inputField.dispatchEvent(new Event('input', { bubbles: true }));
      inputField.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    inputField.focus();
    
    // Auto-submit the link
    setTimeout(() => {
      submitMessage();
      promptSplittingState.currentPhase = 'complete';
      showPromptSplittingIndicator('complete', 'Property link sent! Waiting for analysis...');
      
      console.log('🎯 Property link sent - phase set to complete');
      console.log('🔍 Now waiting for ChatGPT analysis response...');
      
      // Remove indicator after a longer delay to show we're waiting
      setTimeout(() => {
        removePromptSplittingIndicator();
      }, 5000);
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
  if (!promptSplittingState.pendingPropertyLink) {
    console.error('❌ No pending property link for fallback');
    resetPromptSplittingState();
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
    const result = await safeChromeFall(
      () => chrome.storage.local.get(['customPrompt']),
      { customPrompt: null }
    );
    const promptTemplate = result.customPrompt || await generateDynamicPrompt();
    
    // Create the full prompt with link
    const fullPrompt = promptTemplate
      .replace('{PROPERTY_URL}', promptSplittingState.pendingPropertyLink)
      .replace('{DATE}', new Date().toLocaleDateString());
    
    // Insert the full prompt
    if (inputField.tagName === 'TEXTAREA') {
      inputField.value = '';
      inputField.focus();
      inputField.value = fullPrompt;
      inputField.dispatchEvent(new Event('input', { bubbles: true }));
      inputField.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (inputField.contentEditable === 'true') {
      inputField.textContent = '';
      inputField.focus();
      inputField.textContent = fullPrompt;
      inputField.dispatchEvent(new Event('input', { bubbles: true }));
      inputField.dispatchEvent(new Event('change', { bubbles: true }));
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

// Investment metrics calculation function
function calculateInvestmentMetrics(data) {
  const metrics = {};
  
  try {
    const price = parseFloat((data.price || '').toString().replace(/[\$,]/g, ''));
    const sqft = parseFloat((data.squareFeet || '').toString().replace(/[\$,]/g, ''));
    const monthlyRent = parseFloat((data.estimatedRentalIncome || '').toString().replace(/[\$,]/g, ''));
    const yearBuilt = parseInt(data.yearBuilt || 0);
    
    // Price per square foot
    if (price > 0 && sqft > 0) {
      metrics.pricePerSqFt = (price / sqft).toFixed(2);
    }
    
    // Cap Rate (Annual return percentage)
    if (price > 0 && monthlyRent > 0) {
      metrics.capRate = (((monthlyRent * 12) / price) * 100).toFixed(2);
    }
    
    // 1% Rule (Monthly rent to price ratio)
    if (price > 0 && monthlyRent > 0) {
      metrics.onePercentRule = ((monthlyRent / price) * 100).toFixed(2);
    }
    
    // Gross Rent Multiplier
    if (price > 0 && monthlyRent > 0) {
      metrics.grossRentMultiplier = (price / (monthlyRent * 12)).toFixed(2);
    }
    
    // Property Age
    if (yearBuilt > 0) {
      metrics.propertyAge = new Date().getFullYear() - yearBuilt;
    }
    
    // Cash-on-Cash Return (assuming 20% down payment)
    if (price > 0 && monthlyRent > 0) {
      const downPayment = price * 0.20;
      const annualCashFlow = monthlyRent * 12;
      // Simplified calculation - actual would include mortgage payments, taxes, insurance, etc.
      metrics.estimatedCashOnCashReturn = ((annualCashFlow / downPayment) * 100).toFixed(2);
    }
    
    console.log('📊 Calculated investment metrics:', metrics);
    
  } catch (error) {
    console.warn('Error calculating investment metrics:', error);
  }
  
  return metrics;
}

// Data validation and cleaning function
function validateAndCleanData(data) {
  const cleanedData = { ...data };
  
  try {
    // Clean and validate price
    if (cleanedData.price) {
      let priceStr = cleanedData.price.toString().replace(/[\$,]/g, '');
      
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
      const sqft = parseInt(cleanedData.squareFeet.toString().replace(/[,]/g, ''));
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
      const rental = parseFloat(cleanedData.estimatedRentalIncome.toString().replace(/[\$,]/g, ''));
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
      const price = parseFloat(data.price.toString().replace(/[,$]/g, ''));
      const propertyType = data.propertyType.toLowerCase();
      
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
      const sqft = parseInt(data.squareFeet.toString().replace(/,/g, ''));
      
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
      const price = parseFloat(data.price.toString().replace(/[,$]/g, ''));
      const sqft = parseInt(data.squareFeet.toString().replace(/,/g, ''));
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
      const price = parseFloat(data.price.toString().replace(/[,$]/g, ''));
      const monthlyRent = parseFloat(data.estimatedRentalIncome.toString().replace(/[,$]/g, ''));
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
      if (data[field] && data[field].toString().trim()) {
        foundCoreFields++;
      } else {
        quality.missingFields.push(field);
      }
    });
    
    financialFields.forEach(field => {
      if (data[field] && data[field].toString().trim()) {
        foundFinancialFields++;
      }
    });
    
    detailFields.forEach(field => {
      if (data[field] && data[field].toString().trim()) {
        foundDetailFields++;
      }
    });
    
    analysisFields.forEach(field => {
      if (data[field] && data[field].toString().trim()) {
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
      const price = parseFloat(data.price.toString().replace(/[\$,]/g, ''));
      const rent = parseFloat(data.estimatedRentalIncome.toString().replace(/[\$,]/g, ''));
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
      const price = parseFloat(data.price.toString().replace(/[\$,]/g, ''));
      const sqft = parseInt(data.squareFeet.toString().replace(/[,]/g, ''));
      
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
      '[title*="Stop generating"]',
      // Additional selectors for ChatGPT UI variations
      'button[class*="btn-stop"]',
      '[data-testid="stop-button"]',
      'button:has(span:contains("Stop"))',
      'button[class*="regenerate"][disabled]', // Disabled regenerate during generation
      'form button[disabled]:last-child' // Often the last button in the form
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
    
    // Final check: Look for cursor or typing indicators in the message
    const messages = document.querySelectorAll('[data-message-author-role="assistant"]');
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      const messageText = lastMessage.textContent || lastMessage.innerText || '';
      
      // Check for common streaming indicators in the text itself
      const streamingPatterns = [
        /\.\.\.$/, // Ends with ellipsis
        /…$/, // Ends with unicode ellipsis
        /\|$/, // Ends with cursor
        /▌$/, // Ends with block cursor
        /\s$/ // Ends with whitespace (often added during streaming)
      ];
      
      for (const pattern of streamingPatterns) {
        if (pattern.test(messageText)) {
          console.log('🔍 Text-based streaming indicator found:', pattern);
          return true;
        }
      }
      
      // Check if the message element has streaming-related classes
      if (lastMessage.classList.contains('result-streaming') || 
          lastMessage.querySelector('.streaming') ||
          lastMessage.querySelector('.animate-pulse') ||
          lastMessage.querySelector('[class*="typing"]')) {
        console.log('🔍 Element-based streaming indicator found');
        return true;
      }
    }
    
    console.log('✅ No streaming indicators found - ChatGPT appears to have finished');
    return false;
  };
  
  // Function to process completed response
  const processCompletedResponse = (messageText, propertyUrl) => {
    console.log('🎯 Processing completed response for:', propertyUrl);
    console.log('📝 Final response length:', messageText.length);
    console.log('🔍 Current prompt splitting phase:', promptSplittingState.currentPhase);
    console.log('🔍 Current property analysis:', currentPropertyAnalysis?.url || 'None');
    
    // Check for potential incomplete responses with more detailed analysis
    if (messageText.length < 50) {
      console.warn('⚠️ Warning: Response seems very short (' + messageText.length + ' characters) - might be incomplete');
      console.log('🔍 SHORT RESPONSE DEBUG:', {
        messageLength: messageText.length,
        messagePreview: messageText,
        extractionMethod: extractionMethod || 'unknown',
        elementInfo: {
          tagName: newMessage?.tagName,
          className: newMessage?.className,
          childrenCount: newMessage?.children?.length
        }
      });
      
      // Don't process responses that are extremely short (likely UI elements)
      if (messageText.length < 20) {
        console.log('❌ Skipping extremely short response - likely UI text, not ChatGPT content');
        return;
      }
    } else if (messageText.length < 200) {
      console.warn('⚠️ Response is shorter than expected (' + messageText.length + ' characters) but proceeding...');
    }
    
    if (messageText.endsWith('...') || messageText.endsWith('…')) {
      console.warn('⚠️ Warning: Response ends with ellipsis - might be cut off');
    }
    
    // Log response quality indicators
    console.log('📊 Response quality indicators:', {
      length: messageText.length,
      endsWithPeriod: messageText.endsWith('.'),
      endsWithEllipsis: messageText.endsWith('...') || messageText.endsWith('…'),
      containsPropertyKeywords: /property|bedroom|bathroom|price|sqft/i.test(messageText),
      looksComplete: messageText.length > 500 && (messageText.endsWith('.') || messageText.endsWith('!') || messageText.endsWith('?'))
    });
    
    // Clear any existing timer
    if (completionTimers.has(propertyUrl)) {
      clearTimeout(completionTimers.get(propertyUrl));
      completionTimers.delete(propertyUrl);
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
    
    // Special handling for prompt splitting second response (the actual analysis)
    if (promptSplittingState.currentPhase === 'complete' && promptSplittingState.pendingPropertyLink) {
      console.log('🎯 PROCESSING SECOND RESPONSE FROM PROMPT SPLITTING (ACTUAL ANALYSIS)');
      console.log('🔗 Property URL:', promptSplittingState.pendingPropertyLink);
      console.log('📊 Response length:', messageText.length);
      
      // Process this as the analysis response
      const analysisData = extractPropertyAnalysisData(messageText);
      
      if (analysisData && (Object.keys(analysisData.extractedData).length > 0 || analysisData.fullResponse)) {
        console.log('✅ Successfully extracted analysis data from split prompt second response');
        console.log('🔍 Extracted data keys:', Object.keys(analysisData.extractedData));
        
        // Save the analysis with the correct URL from prompt splitting
        safeChromeFall(() => {
          return chrome.runtime.sendMessage({
            action: 'savePropertyAnalysis',
            propertyUrl: promptSplittingState.pendingPropertyLink,
            sessionId: `split_${Date.now()}`,
            analysisData: analysisData
          });
        }).then(response => {
          if (response && response.success) {
            console.log('🎉 Split prompt analysis saved successfully!');
            
            // Debug: Verify the saved data immediately
            setTimeout(() => {
              console.log('🔍 SPLIT VERIFICATION: Checking saved data...');
              chrome.storage.local.get(['propertyHistory']).then(result => {
                const properties = result.propertyHistory || [];
                const savedProperty = properties.find(p => p.url === promptSplittingState.pendingPropertyLink);
                if (savedProperty) {
                  console.log('🔍 SPLIT VERIFICATION: Saved property found:', {
                    url: savedProperty.url,
                    hasAnalysis: !!savedProperty.analysis,
                    hasFullResponse: !!(savedProperty.analysis?.fullResponse),
                    fullResponseLength: savedProperty.analysis?.fullResponse?.length || 0,
                    fullResponsePreview: savedProperty.analysis?.fullResponse?.substring(0, 100) || 'No fullResponse'
                  });
                } else {
                  console.log('❌ SPLIT VERIFICATION: Property not found in saved data');
                }
              });
            }, 500);
            
            // Trigger embedded UI completion
            if (typeof embeddedUI !== 'undefined' && embeddedUI && embeddedUI.completeAnalysis) {
              embeddedUI.completeAnalysis();
            }
          }
        }).catch(err => {
          console.error('❌ Failed to save split prompt analysis:', err);
        });
        
        // Clean up progressive tracking for prompt splitting
        if (promptSplittingState.pendingPropertyLink && 
            continuousResponseTracker.activeTracking.has(promptSplittingState.pendingPropertyLink)) {
          const tracking = continuousResponseTracker.activeTracking.get(promptSplittingState.pendingPropertyLink);
          console.log('🧹 Cleaning up progressive tracking for prompt splitting:', promptSplittingState.pendingPropertyLink, {
            totalSaves: tracking.saveCount,
            maxLength: tracking.maxLength
          });
          continuousResponseTracker.activeTracking.delete(promptSplittingState.pendingPropertyLink);
        }
        
        // Reset prompt splitting state
        resetPromptSplittingState();
        return; // Exit early - we've handled this response
      } else {
        console.log('⚠️ No extractable data in split prompt second response');
      }
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
        console.log('🔍 This might be a stray response - ignoring to prevent duplicate saves');
        console.log('🔍 Response preview:', messageText.substring(0, 200) + '...');
        
        // Skip processing if we don't have an active analysis session
        // This prevents duplicate saves from prompt splitting fallback logic
        return;
      }
      
      // Note: We've already handled prompt splitting responses above
      // This section is only for regular single-prompt analysis
      
      console.log('✅ Detected completed property analysis response for:', currentPropertyAnalysis.url);
      console.log('🔍 Session ID:', currentPropertyAnalysis.sessionId);
      console.log('🎯 Keywords matched:', keywordMatches, '/', propertyKeywords.length);
      const analysisData = extractPropertyAnalysisData(messageText);
      
      if (analysisData && (Object.keys(analysisData.extractedData).length > 0 || analysisData.fullResponse)) {
        console.log('✅ Successfully extracted analysis data (REGULAR PROPERTY ANALYSIS - SAVING!):', currentPropertyAnalysis.url);
        console.log('🔍 ANALYSIS DATA BEING SAVED:', {
          url: currentPropertyAnalysis.url,
          hasFullResponse: !!analysisData.fullResponse,
          fullResponseLength: analysisData.fullResponse?.length || 0,
          hasFullAnalysis: !!analysisData.fullAnalysis,
          fullAnalysisLength: analysisData.fullAnalysis?.length || 0,
          extractedDataKeys: Object.keys(analysisData.extractedData || {}),
          fullResponsePreview: analysisData.fullResponse?.substring(0, 200) || 'No fullResponse'
        });
        console.log('📊 Extracted data summary:', {
          propertyUrl: currentPropertyAnalysis.url,
          sessionId: currentPropertyAnalysis.sessionId,
          dataPoints: Object.keys(analysisData.extractedData).length,
          hasPrice: !!analysisData.extractedData.price,
          hasBedrooms: !!analysisData.extractedData.bedrooms,
          hasBathrooms: !!analysisData.extractedData.bathrooms,
          hasSquareFeet: !!analysisData.extractedData.squareFeet,
          keys: Object.keys(analysisData.extractedData)
        });
        
        // Send the analysis data back to the background script
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
              
              // Debug: Verify the saved data immediately
              setTimeout(() => {
                console.log('🔍 VERIFICATION: Checking saved data...');
                chrome.storage.local.get(['propertyHistory']).then(result => {
                  const properties = result.propertyHistory || [];
                  const savedProperty = properties.find(p => p.url === currentPropertyAnalysis.url);
                  if (savedProperty) {
                    console.log('🔍 VERIFICATION: Saved property found:', {
                      url: savedProperty.url,
                      hasAnalysis: !!savedProperty.analysis,
                      hasFullResponse: !!(savedProperty.analysis?.fullResponse),
                      fullResponseLength: savedProperty.analysis?.fullResponse?.length || 0,
                      fullResponsePreview: savedProperty.analysis?.fullResponse?.substring(0, 100) || 'No fullResponse'
                    });
                  } else {
                    console.log('❌ VERIFICATION: Property not found in saved data');
                  }
                });
              }, 500);
              
              // Trigger embedded UI completion if available
              if (typeof embeddedUI !== 'undefined' && embeddedUI && embeddedUI.completeAnalysis) {
                embeddedUI.completeAnalysis();
              }
            }
          }
        }).catch(err => {
          console.error('❌ Failed to send analysis data:', err);
        });
        
        // Track this message as processed for this property
        if (propertyUrl) {
          if (!processedMessagesPerProperty.has(propertyUrl)) {
            processedMessagesPerProperty.set(propertyUrl, []);
          }
          processedMessagesPerProperty.get(propertyUrl).push(messageText);
          
          // Limit stored messages per property to prevent memory bloat
          const messages = processedMessagesPerProperty.get(propertyUrl);
          if (messages.length > 5) {
            messages.shift(); // Remove oldest message
          }
        }
        
        // Reset the current analysis tracking
        currentPropertyAnalysis = null;
        
        // Clean up progressive tracking for this property
        if (propertyUrl && continuousResponseTracker.activeTracking.has(propertyUrl)) {
          const tracking = continuousResponseTracker.activeTracking.get(propertyUrl);
          console.log('🧹 Cleaning up progressive tracking for:', propertyUrl, {
            totalSaves: tracking.saveCount,
            maxLength: tracking.maxLength
          });
          continuousResponseTracker.activeTracking.delete(propertyUrl);
        }
      } else {
        console.log('⚠️ No extractable data found in completed response');
        console.log('📝 Response preview:', messageText.substring(0, 500) + '...');
      }
        } else {
      console.log('⚠️ Insufficient property keywords in completed response');
    }
    
    // Clean up buffer
    responseBuffer.delete(propertyUrl);
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
      
      // ENHANCED TEXT EXTRACTION SYSTEM - Multiple robust methods
      let messageText = '';
      let extractionMethod = '';
      
      console.log('🔍 EXTRACTION DEBUG: Starting text extraction from element:', newMessage);
      console.log('🔍 Element tag:', newMessage.tagName);
      console.log('🔍 Element classes:', newMessage.className);
      console.log('🔍 Element children count:', newMessage.children.length);
      
      // Method 1: Direct content extraction
      const directText = newMessage.textContent || '';
      console.log('🔍 Method 1 (textContent):', directText.length, 'chars');
      if (directText.length > messageText.length) {
        messageText = directText;
        extractionMethod = 'textContent';
      }
      
      // Method 2: InnerText fallback
      const innerText = newMessage.innerText || '';
      console.log('🔍 Method 2 (innerText):', innerText.length, 'chars');
      if (innerText.length > messageText.length) {
        messageText = innerText;
        extractionMethod = 'innerText';
      }
      
      // Method 3: Look for specific content containers within the message
      const contentSelectors = [
        '.prose', '.markdown', '.message-content', '.content',
        '[class*="prose"]', '[class*="markdown"]', '[class*="content"]',
        'div:not([class*="button"]):not([class*="icon"]):not([class*="header"])'
      ];
      
      for (const selector of contentSelectors) {
        const contentEl = newMessage.querySelector(selector);
        if (contentEl) {
          const selectorText = contentEl.textContent || contentEl.innerText || '';
          console.log(`🔍 Method 3 (${selector}):`, selectorText.length, 'chars');
          if (selectorText.length > messageText.length) {
            messageText = selectorText;
            extractionMethod = `selector: ${selector}`;
          }
        }
      }
      
      // Method 4: Advanced TreeWalker with filtering
      if (messageText.length < 100) {
        console.log('🔍 Method 4: Advanced TreeWalker extraction');
        const textParts = [];
        const walker = document.createTreeWalker(
          newMessage,
          NodeFilter.SHOW_TEXT,
          {
            acceptNode: function(node) {
              // Skip empty text nodes and nodes in buttons/controls
              const text = node.textContent.trim();
              if (!text) return NodeFilter.FILTER_REJECT;
              
              // Skip text in UI elements
              const parent = node.parentElement;
              if (parent && (
                parent.tagName === 'BUTTON' ||
                parent.classList.contains('button') ||
                parent.classList.contains('icon') ||
                parent.getAttribute('role') === 'button'
              )) {
                return NodeFilter.FILTER_REJECT;
              }
              
              return NodeFilter.FILTER_ACCEPT;
            }
          },
          false
        );
        
        let textNode;
        while (textNode = walker.nextNode()) {
          const text = textNode.textContent.trim();
          if (text.length > 3) { // Only include substantial text
            textParts.push(text);
          }
        }
        
        const walkerText = textParts.join(' ');
        console.log('🔍 Method 4 (TreeWalker):', walkerText.length, 'chars');
        if (walkerText.length > messageText.length) {
          messageText = walkerText;
          extractionMethod = 'TreeWalker';
        }
      }
      
      // Method 5: Paragraph-by-paragraph extraction
      if (messageText.length < 100) {
        console.log('🔍 Method 5: Paragraph extraction');
        const paragraphs = newMessage.querySelectorAll('p, div, span');
        const paragraphTexts = [];
        
        paragraphs.forEach((p, index) => {
          const pText = (p.textContent || '').trim();
          if (pText.length > 10 && !pText.match(/^(Copy|Share|Edit|Delete|Regenerate|Stop)$/i)) {
            paragraphTexts.push(pText);
            console.log(`🔍 Paragraph ${index}:`, pText.substring(0, 50) + '...');
          }
        });
        
        const paragraphText = paragraphTexts.join('\n\n');
        console.log('🔍 Method 5 (paragraphs):', paragraphText.length, 'chars');
        if (paragraphText.length > messageText.length) {
          messageText = paragraphText;
          extractionMethod = 'paragraphs';
        }
      }
      
      // Method 6: Look for the actual content area more specifically
      if (messageText.length < 100) {
        console.log('🔍 Method 6: Specific ChatGPT content extraction');
        
        // Try to find the main content area by looking for common patterns
        const specificSelectors = [
          '[data-message-author-role="assistant"] .prose',
          '[data-message-author-role="assistant"] > div > div',
          '[data-message-author-role="assistant"] [class*="whitespace-pre-wrap"]',
          '.group .prose',
          '.markdown-prose',
          '.result-content'
        ];
        
        for (const selector of specificSelectors) {
          const specificEl = document.querySelector(selector);
          if (specificEl) {
            const specificText = specificEl.textContent || specificEl.innerText || '';
            console.log(`🔍 Method 6 (${selector}):`, specificText.length, 'chars');
            if (specificText.length > messageText.length) {
              messageText = specificText;
              extractionMethod = `specific: ${selector}`;
            }
          }
        }
      }
      
      console.log('🔍 EXTRACTION RESULT:', {
        method: extractionMethod,
        length: messageText.length,
        preview: messageText.substring(0, 200) + '...',
        element: newMessage
      });
      
      console.log('📝 Message extraction stats:', {
        length: messageText.length,
        preview: messageText.substring(0, 100) + '...',
        hasContent: messageText.length > 10
      });
      
      // CRITICAL DEBUG: Track response growth in real-time
      if (currentPropertyAnalysis) {
        console.log('🔍 RESPONSE TRACKING:', {
          propertyUrl: currentPropertyAnalysis.url,
          currentLength: messageText.length,
          timestamp: new Date().toLocaleTimeString(),
          isStreaming: isResponseStreaming(),
          phase: promptSplittingState.currentPhase
        });
        
        // PROGRESSIVE SAVING: Save response incrementally as it grows
        const url = currentPropertyAnalysis.url;
        const currentLength = messageText.length;
        const now = Date.now();
        
        if (!continuousResponseTracker.activeTracking.has(url)) {
          continuousResponseTracker.activeTracking.set(url, {
            lastLength: 0,
            lastSaved: 0,
            saveCount: 0,
            maxLength: 0,
            lastSaveTime: now
          });
        }
        
        const tracking = continuousResponseTracker.activeTracking.get(url);
        tracking.maxLength = Math.max(tracking.maxLength, currentLength);
        
        // Save if response has grown significantly OR enough time has passed
        const lengthGrowth = currentLength - tracking.lastSaved;
        const timeSinceLastSave = now - tracking.lastSaveTime;
        
        if (currentLength > 500 && // Minimum length threshold
            (lengthGrowth >= continuousResponseTracker.minLengthDifference || 
             timeSinceLastSave >= continuousResponseTracker.saveInterval) &&
            currentLength > tracking.lastSaved) {
          
          console.log('💾 PROGRESSIVE SAVE triggered:', {
            url: url,
            currentLength: currentLength,
            previousSaved: tracking.lastSaved,
            growth: lengthGrowth,
            saveCount: tracking.saveCount + 1
          });
          
          // Save this version of the response
          saveProgressiveResponse(messageText, url, tracking.saveCount + 1);
          
          // Update tracking
          tracking.lastSaved = currentLength;
          tracking.saveCount++;
          tracking.lastSaveTime = now;
        }
      }
      
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
        processCompletedResponse(messageText, null); // Pass null for confirmation responses
        return; // Don't process as regular property analysis
      }
      
      // Check for prompt splitting second response (the actual analysis)
      if (promptSplittingState.currentPhase === 'complete' && promptSplittingState.pendingPropertyLink && messageText && messageText.length > 100) {
        console.log('🎯 Found SECOND response in prompt splitting (ACTUAL ANALYSIS):', messageText.substring(0, 100));
        console.log('📊 Response length:', messageText.length);
        console.log('🔗 Property URL:', promptSplittingState.pendingPropertyLink);
        
        // PROGRESSIVE SAVING for prompt splitting responses too
        const url = promptSplittingState.pendingPropertyLink;
        const currentLength = messageText.length;
        const now = Date.now();
        
        if (!continuousResponseTracker.activeTracking.has(url)) {
          continuousResponseTracker.activeTracking.set(url, {
            lastLength: 0,
            lastSaved: 0,
            saveCount: 0,
            maxLength: 0,
            lastSaveTime: now
          });
        }
        
        const tracking = continuousResponseTracker.activeTracking.get(url);
        tracking.maxLength = Math.max(tracking.maxLength, currentLength);
        
        const lengthGrowth = currentLength - tracking.lastSaved;
        const timeSinceLastSave = now - tracking.lastSaveTime;
        
        if (currentLength > 500 && 
            (lengthGrowth >= continuousResponseTracker.minLengthDifference || 
             timeSinceLastSave >= continuousResponseTracker.saveInterval) &&
            currentLength > tracking.lastSaved) {
          
          console.log('💾 PROGRESSIVE SAVE (Prompt Splitting) triggered:', {
            url: url,
            currentLength: currentLength,
            growth: lengthGrowth,
            saveCount: tracking.saveCount + 1
          });
          
          saveProgressiveResponse(messageText, url, tracking.saveCount + 1);
          
          tracking.lastSaved = currentLength;
          tracking.saveCount++;
          tracking.lastSaveTime = now;
        }
        
        // Process this as the analysis response immediately
        processCompletedResponse(messageText, promptSplittingState.pendingPropertyLink);
        return; // Exit early - we've handled this response
      }
      
      // Only process if we have an active property analysis session (for single prompt mode)
      if (currentPropertyAnalysis && messageText && messageText.length > 100) {
        console.log('📝 Monitoring response progress for:', currentPropertyAnalysis.url);
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
            // Conservative completion detection to ensure full responses are captured
            if (stableTime > 4000) { // Increased to 4 seconds to avoid cutting off long responses
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
          processCompletedResponse(messageText, currentPropertyAnalysis.url);
          return;
        }
        
        // Check if ChatGPT is still streaming
        const isStreaming = isResponseStreaming();
        console.log('🔄 Is ChatGPT still streaming?', isStreaming);
        console.log('📏 Response length stable?', lengthStable);
        
        if (lengthStable && !isStreaming) {
          console.log('✅ Response appears complete - processing now');
          console.log('  - Length stable:', lengthStable);
          console.log('  - Not streaming:', !isStreaming);
          
          // Clear any existing timer since we're processing now
          if (completionTimers.has(currentUrl)) {
            clearTimeout(completionTimers.get(currentUrl));
            completionTimers.delete(currentUrl);
          }
          
          // Process immediately
          processCompletedResponse(messageText, currentPropertyAnalysis.url);
          
        } else if (isStreaming) {
          console.log('⏳ ChatGPT still writing, waiting for completion...');
          
          // Clear any existing completion timer
          if (completionTimers.has(currentUrl)) {
            clearTimeout(completionTimers.get(currentUrl));
          }
          
          // Set a conservative completion timer to allow full responses to complete
          completionTimers.set(currentUrl, setTimeout(() => {
            console.log('⏰ Completion timer triggered - checking final state before processing');
            const bufferedResponse = responseBuffer.get(currentUrl);
            if (bufferedResponse && currentPropertyAnalysis) {
              // Final check: only process if not streaming
              const finalStreamCheck = isResponseStreaming();
              if (!finalStreamCheck) {
                console.log('✅ Final check confirmed response is complete');
                processCompletedResponse(bufferedResponse.messageText, currentPropertyAnalysis.url);
              } else {
                console.log('⏳ Still streaming during timer check - extending timer');
                // Extend timer by another 3 seconds
                completionTimers.set(currentUrl, setTimeout(() => {
                  console.log('⏰ Extended timer triggered - processing regardless of state');
                  const extendedResponse = responseBuffer.get(currentUrl);
                  if (extendedResponse && currentPropertyAnalysis) {
                    processCompletedResponse(extendedResponse.messageText, currentPropertyAnalysis.url);
                  }
                }, 3000));
              }
            }
          }, 5000)); // Increased to 5 seconds to allow more time
        }
      }
      
      lastMessageCount = messages.length;
    }
  };
  
  // Check for new messages every 500ms for better completion detection
  const intervalId = setInterval(checkForNewMessages, 500);
  
  // Enhanced MutationObserver for real-time response tracking
  const observer = new MutationObserver((mutations) => {
    let shouldCheck = false;
    let hasTextChanges = false;
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
      
      // Track text content changes in assistant messages
      if (mutation.type === 'characterData' || mutation.type === 'childList') {
        const target = mutation.target;
        if (target && (target.closest('[data-message-author-role="assistant"]') || 
                      target.querySelector('[data-message-author-role="assistant"]'))) {
          hasTextChanges = true;
          shouldCheck = true;
          
          // Log text changes for debugging during active analysis
          if (currentPropertyAnalysis || promptSplittingState.currentPhase === 'complete') {
            console.log('📝 REAL-TIME: Text change detected in assistant message:', {
              type: mutation.type,
              targetLength: target.textContent?.length || 0,
              timestamp: new Date().toLocaleTimeString(),
              isActiveAnalysis: !!currentPropertyAnalysis,
              promptPhase: promptSplittingState.currentPhase
            });
          }
        }
      }
    });
    
    if (shouldCheck) {
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
        subtree: true,
        characterData: true, // Track text changes
        characterDataOldValue: true
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
  
  // Add periodic content checker for debugging
  const contentChecker = setInterval(() => {
    if (currentPropertyAnalysis || promptSplittingState.currentPhase === 'complete') {
      const messages = document.querySelectorAll('[data-message-author-role="assistant"]');
      if (messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        const currentText = lastMessage.textContent || lastMessage.innerText || '';
        
        console.log('🔍 PERIODIC CHECK:', {
          timestamp: new Date().toLocaleTimeString(),
          messageLength: currentText.length,
          preview: currentText.substring(0, 150) + '...',
          isStreaming: isResponseStreaming(),
          activeAnalysis: !!currentPropertyAnalysis,
          promptPhase: promptSplittingState.currentPhase
        });
        
        // If we have a very long response, log a warning about potential truncation
        if (currentText.length > 3000) {
          console.log('📏 LONG RESPONSE detected:', currentText.length, 'characters');
        }
      }
    }
  }, 3000); // Check every 3 seconds during active analysis
  
  // Cleanup function
  return () => {
    clearInterval(intervalId);
    clearInterval(contextCheckInterval);
    clearInterval(contentChecker);
    observer.disconnect();
  };
}

// Function to find ChatGPT input field with more comprehensive selectors
function findChatGPTInput() {
  console.log('🔍 Searching for ChatGPT input field...');
  console.log('📍 Current URL:', window.location.href);
  console.log('📱 Viewport:', window.innerWidth + 'x' + window.innerHeight);
  
  // First, let's see what input elements exist on the page
  const allInputs = document.querySelectorAll('input, textarea, [contenteditable="true"]');
  console.log(`📋 Found ${allInputs.length} total input/editable elements on page`);
  
  // Try different selectors for ChatGPT input (updated for 2024)
  const selectors = [
    // Latest ChatGPT interface selectors (2024)
    'textarea[data-id="root"]',
    'div[contenteditable="true"][data-id="root"]', 
    'textarea[placeholder*="Message"]',
    'textarea[placeholder*="message"]',
    'div[contenteditable="true"][role="textbox"]',
    'textarea[data-testid="composer-text-input"]',
    
    // Common modern selectors
    'div[contenteditable="true"][data-testid*="composer"]',
    'textarea[class*="prose"]',
    'div[contenteditable="true"][class*="prose"]',
    
    // Fallback selectors
    'div[contenteditable="true"]',
    '#prompt-textarea',
    'textarea',
    
    // Try by class patterns
    'textarea[class*="composer"]',
    'textarea[class*="input"]',
    'div[class*="composer"][contenteditable="true"]',
    'div[class*="input"][contenteditable="true"]',
    
    // Additional modern patterns
    'textarea[spellcheck="false"]',
    'div[contenteditable="true"][spellcheck="false"]'
  ];
  
  for (const selector of selectors) {
    try {
      const elements = document.querySelectorAll(selector);
      console.log(`🔍 Testing selector: ${selector} -> ${elements.length} elements found`);
      
      for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        const elementInfo = {
          tag: element.tagName,
          id: element.id,
          classes: element.className,
          placeholder: element.placeholder,
          dataId: element.getAttribute('data-id'),
          visible: element.offsetParent !== null,
          disabled: element.disabled,
          readOnly: element.readOnly,
          display: element.style.display
        };
        
        console.log(`  📍 Element ${i + 1}:`, elementInfo);
        
        // Check if element is visible and not disabled
        if (element.offsetParent !== null && 
            !element.disabled && 
            !element.readOnly &&
            element.style.display !== 'none') {
          
          console.log('✅ Found suitable input element:', element);
          console.log('📋 Element details:', elementInfo);
          return element;
        } else {
          console.log('❌ Element not suitable:', {
            visible: element.offsetParent !== null,
            notDisabled: !element.disabled,
            notReadOnly: !element.readOnly,
            notHidden: element.style.display !== 'none'
          });
        }
      }
    } catch (e) {
      console.log(`❌ Error with selector ${selector}:`, e);
    }
  }
  
  console.log('No suitable input field found');
  return null;
}

// Function to wait for input field to be available
function waitForInputField(maxWait = 10000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    function checkForInput() {
      const input = findChatGPTInput();
      if (input) {
        resolve(input);
        return;
      }
      
      if (Date.now() - startTime > maxWait) {
        reject(new Error('Timeout waiting for input field'));
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
  
  // Clear any previous analysis tracking to prevent cross-contamination
  if (currentPropertyAnalysis) {
    console.log('⚠️ Clearing previous property analysis for:', currentPropertyAnalysis.url);
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
    
    // Get custom prompt from storage or generate dynamic prompt
    const result = await safeChromeFall(
      () => chrome.storage.local.get(['customPrompt']),
      { customPrompt: null }
    );
    
    // Use custom prompt if available, otherwise generate dynamic prompt based on column selection
    const promptTemplate = result.customPrompt || await generateDynamicPrompt();

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
      
      // Set up state for the splitting process
      promptSplittingState.currentPhase = 'instructions';
      promptSplittingState.pendingPropertyLink = propertyLink;
      
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
    
    // Clear existing content first
    if (inputField.tagName === 'TEXTAREA') {
      inputField.value = '';
      inputField.focus();
      inputField.value = prompt;
      
      // Trigger input events
      inputField.dispatchEvent(new Event('input', { bubbles: true }));
      inputField.dispatchEvent(new Event('change', { bubbles: true }));
      
    } else if (inputField.contentEditable === 'true') {
      inputField.textContent = '';
      inputField.focus();
      inputField.textContent = prompt;
      
      // Trigger input events for contenteditable
      inputField.dispatchEvent(new Event('input', { bubbles: true }));
      inputField.dispatchEvent(new Event('change', { bubbles: true }));
      
      // Also try composition events which some modern inputs use
      inputField.dispatchEvent(new CompositionEvent('compositionstart'));
      inputField.dispatchEvent(new CompositionEvent('compositionend'));
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
      
      // Handle async operation properly
      (async () => {
        try {
          const success = await insertPropertyAnalysisPrompt(request.link);
          
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

// MANUAL CAPTURE FUNCTION - for immediate testing
window.captureCurrentResponse = function(propertyUrl) {
  console.log('🚀 MANUAL CAPTURE: Capturing current ChatGPT response...');
  
  // Get all assistant messages
  const messages = document.querySelectorAll('[data-message-author-role="assistant"]');
  if (messages.length === 0) {
    console.error('❌ No ChatGPT messages found');
    return null;
  }
  
  const lastMessage = messages[messages.length - 1];
  console.log('📍 Found message element:', lastMessage);
  
  // Use the same robust extraction system as the main monitoring
  let messageText = '';
  let extractionMethod = '';
  
  // Method 1: Direct content extraction
  const directText = lastMessage.textContent || '';
  console.log('🔍 Manual Method 1 (textContent):', directText.length, 'chars');
  if (directText.length > messageText.length) {
    messageText = directText;
    extractionMethod = 'textContent';
  }
  
  // Method 2: InnerText fallback
  const innerText = lastMessage.innerText || '';
  console.log('🔍 Manual Method 2 (innerText):', innerText.length, 'chars');
  if (innerText.length > messageText.length) {
    messageText = innerText;
    extractionMethod = 'innerText';
  }
  
  // Method 3: Look for specific content containers
  const contentSelectors = [
    '.prose', '.markdown', '.message-content', '.content',
    '[class*="prose"]', '[class*="markdown"]', '[class*="content"]'
  ];
  
  for (const selector of contentSelectors) {
    const contentEl = lastMessage.querySelector(selector);
    if (contentEl) {
      const selectorText = contentEl.textContent || contentEl.innerText || '';
      console.log(`🔍 Manual Method 3 (${selector}):`, selectorText.length, 'chars');
      if (selectorText.length > messageText.length) {
        messageText = selectorText;
        extractionMethod = `selector: ${selector}`;
      }
    }
  }
  
  // Method 4: Advanced TreeWalker if still not enough content
  if (messageText.length < 100) {
    console.log('🔍 Manual Method 4: TreeWalker extraction');
    const textParts = [];
    const walker = document.createTreeWalker(
      lastMessage,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          const text = node.textContent.trim();
          if (!text) return NodeFilter.FILTER_REJECT;
          
          const parent = node.parentElement;
          if (parent && (
            parent.tagName === 'BUTTON' ||
            parent.classList.contains('button') ||
            parent.classList.contains('icon')
          )) {
            return NodeFilter.FILTER_REJECT;
          }
          
          return NodeFilter.FILTER_ACCEPT;
        }
      },
      false
    );
    
    let textNode;
    while (textNode = walker.nextNode()) {
      const text = textNode.textContent.trim();
      if (text.length > 3) {
        textParts.push(text);
      }
    }
    
    const walkerText = textParts.join(' ');
    console.log('🔍 Manual Method 4 (TreeWalker):', walkerText.length, 'chars');
    if (walkerText.length > messageText.length) {
      messageText = walkerText;
      extractionMethod = 'TreeWalker';
    }
  }
  
  console.log(`✅ Manual capture using ${extractionMethod} method: ${messageText.length} characters`);
  
  if (!messageText || messageText.length < 50) {
    console.error('❌ Captured text is too short:', messageText.length);
    return null;
  }
  
  // Extract analysis data
  const analysisData = extractPropertyAnalysisData(messageText);
  console.log('📊 Analysis extraction result:', {
    hasData: !!analysisData,
    fullResponseLength: analysisData?.fullResponse?.length || 0,
    extractedKeys: Object.keys(analysisData?.extractedData || {}),
    analysisPreview: analysisData?.fullResponse?.substring(0, 200) || 'No fullResponse'
  });
  
  if (!analysisData || !analysisData.fullResponse) {
    console.error('❌ Failed to extract analysis data');
    return null;
  }
  
  // Save the analysis
  const url = propertyUrl || prompt('Enter property URL for this analysis:') || `manual_${Date.now()}`;
  
  console.log('💾 Saving manual capture for:', url);
  
  safeChromeFall(() => {
    return chrome.runtime.sendMessage({
      action: 'savePropertyAnalysis',
      propertyUrl: url,
      sessionId: `manual_${Date.now()}`,
      analysisData: {
        ...analysisData,
        manualCapture: true,
        captureMethod: bestMethod.name,
        captureTimestamp: Date.now()
      }
    });
  }).then(response => {
    if (response && response.success) {
      console.log('✅ Manual capture saved successfully!');
      console.log('📊 Saved data:', {
        url: url,
        responseLength: analysisData.fullResponse.length,
        extractedFields: Object.keys(analysisData.extractedData).length
      });
    } else {
      console.error('❌ Failed to save manual capture:', response);
    }
  }).catch(err => {
    console.error('❌ Manual capture save error:', err);
  });
  
  return {
    messageText: messageText,
    analysisData: analysisData,
    captureMethod: bestMethod.name,
    url: url
  };
};

// DIAGNOSTIC FUNCTION - Inspect ChatGPT DOM structure
window.inspectChatGPTDOM = function() {
  console.log('🔍 CHATGPT DOM INSPECTION');
  console.log('========================');
  
  // Try all possible selectors
  const allSelectors = [
    '[data-message-author-role="assistant"]',
    '[data-author="assistant"]',
    '[data-role="assistant"]',
    '.group.w-full',
    '.prose',
    '[class*="message"]',
    '[class*="assistant"]',
    '.conversation-turn',
    '.chat-message'
  ];
  
  allSelectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    console.log(`📋 ${selector}: ${elements.length} elements found`);
    
    if (elements.length > 0) {
      const lastEl = elements[elements.length - 1];
      console.log(`  Last element:`, lastEl);
      console.log(`  Text length: ${(lastEl.textContent || '').length}`);
      console.log(`  Inner length: ${(lastEl.innerText || '').length}`);
      console.log(`  Children: ${lastEl.children.length}`);
      console.log(`  Classes: ${lastEl.className}`);
      console.log(`  Preview: ${(lastEl.textContent || '').substring(0, 100)}...`);
      
      // Check for content within
      const contentElements = lastEl.querySelectorAll('div, p, span');
      console.log(`  Content sub-elements: ${contentElements.length}`);
      contentElements.forEach((el, i) => {
        if (i < 5) { // Show first 5
          const text = el.textContent || '';
          if (text.length > 20) {
            console.log(`    [${i}] ${el.tagName} (${text.length} chars): ${text.substring(0, 50)}...`);
          }
        }
      });
    }
  });
  
  console.log('========================');
  return 'DOM inspection complete - check console for details';
};

// EMERGENCY TEXT EXTRACTION - Last resort method
window.emergencyExtraction = function() {
  console.log('🚨 EMERGENCY EXTRACTION ATTEMPT');
  
  // Get all text content from the page and try to find the ChatGPT response
  const allTextElements = document.querySelectorAll('*');
  const candidateTexts = [];
  
  allTextElements.forEach(el => {
    const text = el.textContent || '';
    // Look for substantial text that might be a ChatGPT response
    if (text.length > 500 && text.length < 20000) {
      const hasPropertyKeywords = /property|bedroom|bathroom|price|sqft|real estate|analysis/i.test(text);
      if (hasPropertyKeywords) {
        candidateTexts.push({
          element: el,
          text: text,
          length: text.length,
          keywords: (text.match(/property|bedroom|bathroom|price|sqft|real estate|analysis/gi) || []).length
        });
      }
    }
  });
  
  // Sort by keyword count and length
  candidateTexts.sort((a, b) => (b.keywords * 100 + b.length) - (a.keywords * 100 + a.length));
  
  console.log('🚨 Found', candidateTexts.length, 'potential ChatGPT responses:');
  candidateTexts.slice(0, 3).forEach((candidate, i) => {
    console.log(`${i + 1}. Length: ${candidate.length}, Keywords: ${candidate.keywords}`);
    console.log(`   Preview: ${candidate.text.substring(0, 200)}...`);
    console.log(`   Element:`, candidate.element);
  });
  
  if (candidateTexts.length > 0) {
    const best = candidateTexts[0];
    console.log('🚨 Best candidate selected, attempting to save...');
    
    // Try to save this text
    const url = prompt('Enter property URL for this analysis:') || `emergency_${Date.now()}`;
    const analysisData = extractPropertyAnalysisData(best.text);
    
    if (analysisData) {
      safeChromeFall(() => {
        return chrome.runtime.sendMessage({
          action: 'savePropertyAnalysis',
          propertyUrl: url,
          sessionId: `emergency_${Date.now()}`,
          analysisData: {
            ...analysisData,
            emergencyExtraction: true,
            extractionMethod: 'emergency'
          }
        });
      }).then(response => {
        if (response && response.success) {
          console.log('🚨 Emergency extraction saved successfully!');
        }
      });
    }
    
    return best.text;
  }
  
  return null;
};

// Debug function to check progressive tracking status
window.checkProgressiveTracking = function() {
  console.log('🔍 Progressive Tracking Status:');
  console.log('📊 Active tracking entries:', continuousResponseTracker.activeTracking.size);
  
  for (const [url, tracking] of continuousResponseTracker.activeTracking.entries()) {
    console.log(`📄 ${url}:`, {
      saveCount: tracking.saveCount,
      maxLength: tracking.maxLength,
      lastSaved: tracking.lastSaved,
      timeSinceLastSave: Date.now() - tracking.lastSaveTime
    });
  }
  
  console.log('🎯 Current property analysis:', currentPropertyAnalysis?.url || 'None');
  console.log('📝 Prompt splitting state:', promptSplittingState.currentPhase);
  console.log('🔗 Pending property link:', promptSplittingState.pendingPropertyLink);
  
  return {
    activeTracking: Array.from(continuousResponseTracker.activeTracking.entries()),
    currentPropertyAnalysis: currentPropertyAnalysis,
    promptSplittingState: promptSplittingState
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

} // End of multiple execution prevention block