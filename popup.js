// Popup script for RE Analyzer Extension

// DOM elements
let propertyHistoryList, clearHistoryBtn, propertyUrlInput, analyzeBtn, 
    statusElement, propertySection, siteInfoElement, connectionStatus, pasteBtn,
    successMessage, errorMessage, warningMessage, propertyLinkSection, infoElement, siteElement, urlElement,
    propertyHistorySection, settingsSection, settingsToggle, settingsContent,
    customPromptTextarea, savePromptBtn, resetPromptBtn, showDefaultBtn, defaultPromptDisplay,
    togglePromptBtn, promptContent, propertyCount, clearInputBtn;

// Tab system elements
let tabButtons, tabContents, activeTab = 'analyzer';

// Global variables
let currentTab = null;
let contentScriptReady = false;

// UX Enhancement Variables
let analysisTimer = null;
let analysisStartTime = 0;
let workflowSteps = {
  1: { id: 'step1Status', completed: false },
  2: { id: 'step2Status', completed: false },
  3: { id: 'step3Status', completed: false }
};

// Enhanced validation and progress tracking
let validationState = {
  isValid: false,
  message: '',
  type: 'none' // 'valid', 'invalid', 'warning', 'none'
};

// Progress tracking for analysis
let analysisProgress = {
  currentStep: 0,
  steps: ['validate', 'send', 'analyze', 'save'],
  stepStatus: {}
};

// Properties Tab State
let currentView = 'category'; // 'category' or 'list'
let selectedProperties = new Set();
let isSelectMode = false;
let selectedPropertyForCategorization = null;

// Property Category Manager Class
class PropertyCategoryManager {
  constructor() {
    this.categories = new Map();
    this.properties = new Map();
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      const result = await chrome.storage.local.get(['propertyCategories', 'propertyHistory']);
      
      // Load existing categories or create default ones
      const savedCategories = result.propertyCategories || this.getDefaultCategories();
      this.categories = new Map(Object.entries(savedCategories));
      
      // Load properties and ensure they have category assignments
      const properties = result.propertyHistory || [];
      this.properties = new Map();
      
      properties.forEach((property, index) => {
        // Ensure each property has a category (default to 'uncategorized')
        if (!property.categoryId) {
          property.categoryId = 'uncategorized';
        }
        this.properties.set(property.id || `property_${index}`, property);
      });
      
      this.initialized = true;
      console.log('🗂️ PropertyCategoryManager initialized');
    } catch (error) {
      console.error('Failed to initialize PropertyCategoryManager:', error);
    }
  }

  getDefaultCategories() {
    return {
      'uncategorized': {
        id: 'uncategorized',
        name: 'Uncategorized',
        description: 'Properties that haven\'t been categorized yet',
        color: '#6B7280',
        icon: '📋',
        createdAt: new Date().toISOString(),
        propertyCount: 0
      },
      'investment': {
        id: 'investment',
        name: 'Investment Properties',
        description: 'Properties being considered for investment',
        color: '#10B981',
        icon: '💰',
        createdAt: new Date().toISOString(),
        propertyCount: 0
      },
      'primary_residence': {
        id: 'primary_residence',
        name: 'Primary Residence',
        description: 'Properties for personal living',
        color: '#3B82F6',
        icon: '🏠',
        createdAt: new Date().toISOString(),
        propertyCount: 0
      },
      'rental': {
        id: 'rental',
        name: 'Rental Properties',
        description: 'Properties for rental income',
        color: '#8B5CF6',
        icon: '🏨',
        createdAt: new Date().toISOString(),
        propertyCount: 0
      },
      'favorites': {
        id: 'favorites',
        name: 'Favorites',
        description: 'Properties marked as favorites',
        color: '#F59E0B',
        icon: '⭐',
        createdAt: new Date().toISOString(),
        propertyCount: 0
      }
    };
  }

  async createCategory(categoryData) {
    const category = {
      id: categoryData.id || `category_${Date.now()}`,
      name: categoryData.name,
      description: categoryData.description || '',
      color: categoryData.color || '#6B7280',
      icon: categoryData.icon || '📁',
      createdAt: new Date().toISOString(),
      propertyCount: 0
    };

    this.categories.set(category.id, category);
    await this.saveCategories();
    return category;
  }

  async updateCategory(categoryId, updates) {
    const category = this.categories.get(categoryId);
    if (!category) throw new Error('Category not found');

    const updatedCategory = { ...category, ...updates, updatedAt: new Date().toISOString() };
    this.categories.set(categoryId, updatedCategory);
    await this.saveCategories();
    return updatedCategory;
  }

  async deleteCategory(categoryId) {
    if (categoryId === 'uncategorized') {
      throw new Error('Cannot delete the uncategorized folder');
    }

    // Move all properties from this category to uncategorized
    const propertiesToMove = Array.from(this.properties.values())
      .filter(property => property.categoryId === categoryId);
    
    for (const property of propertiesToMove) {
      await this.movePropertyToCategory(property.id || property.url, 'uncategorized');
    }

    this.categories.delete(categoryId);
    await this.saveCategories();
  }

  async movePropertyToCategory(propertyId, categoryId) {
    const property = this.properties.get(propertyId);
    if (!property) throw new Error('Property not found');

    const oldCategoryId = property.categoryId;
    property.categoryId = categoryId;
    property.updatedAt = new Date().toISOString();

    // Update property counts
    if (oldCategoryId && this.categories.has(oldCategoryId)) {
      const oldCategory = this.categories.get(oldCategoryId);
      oldCategory.propertyCount = Math.max(0, oldCategory.propertyCount - 1);
    }

    if (this.categories.has(categoryId)) {
      const newCategory = this.categories.get(categoryId);
      newCategory.propertyCount = (newCategory.propertyCount || 0) + 1;
    }

    await this.saveData();
  }

  async addPropertyToCategory(property, categoryId = 'uncategorized') {
    const propertyId = property.id || property.url || `property_${Date.now()}`;
    
    // Ensure property has required fields
    const enhancedProperty = {
      ...property,
      id: propertyId,
      categoryId,
      createdAt: property.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.properties.set(propertyId, enhancedProperty);

    // Update category property count
    if (this.categories.has(categoryId)) {
      const category = this.categories.get(categoryId);
      category.propertyCount = (category.propertyCount || 0) + 1;
    }

    await this.saveData();
    return enhancedProperty;
  }

  async removeProperty(propertyId) {
    const property = this.properties.get(propertyId);
    if (!property) return;

    // Update category property count
    if (property.categoryId && this.categories.has(property.categoryId)) {
      const category = this.categories.get(property.categoryId);
      category.propertyCount = Math.max(0, category.propertyCount - 1);
    }

    this.properties.delete(propertyId);
    await this.saveData();
  }

  getPropertiesByCategory(categoryId) {
    return Array.from(this.properties.values())
      .filter(property => property.categoryId === categoryId);
  }

  getAllCategories() {
    return Array.from(this.categories.values());
  }

  getCategory(categoryId) {
    return this.categories.get(categoryId);
  }

  async saveCategories() {
    const categoriesObj = Object.fromEntries(this.categories);
    await chrome.storage.local.set({ propertyCategories: categoriesObj });
  }

  async saveProperties() {
    const propertiesArray = Array.from(this.properties.values());
    await chrome.storage.local.set({ propertyHistory: propertiesArray });
  }

  async saveData() {
    // Debounce saves to prevent excessive storage writes
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    
    this.saveTimeout = setTimeout(async () => {
      try {
        await Promise.all([
          this.saveCategories(),
          this.saveProperties()
        ]);
      } catch (error) {
        console.error('Failed to save data:', error);
      }
    }, 100);
  }

  // Statistics and insights
  getCategoryStats() {
    const stats = {
      totalCategories: this.categories.size,
      totalProperties: this.properties.size,
      categoryBreakdown: {}
    };

    this.categories.forEach(category => {
      stats.categoryBreakdown[category.id] = {
        name: category.name,
        count: this.getPropertiesByCategory(category.id).length,
        percentage: this.properties.size > 0 ? 
          Math.round((this.getPropertiesByCategory(category.id).length / this.properties.size) * 100) : 0
      };
    });

    return stats;
  }
}

// Initialize the category manager globally
const categoryManager = new PropertyCategoryManager();

// Bulk operations state
let bulkSelectionMode = false;

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 RE Analyzer popup loaded');
  
  // Initialize category manager first
  await categoryManager.initialize();
  
  // Initialize tab system first
  initializeTabSystem();
  
  // Get DOM elements with correct IDs from HTML
  propertyHistoryList = document.getElementById('propertyHistoryList');
  clearHistoryBtn = document.getElementById('clearHistoryBtn');
  propertyUrlInput = document.getElementById('propertyLinkInput');
  analyzeBtn = document.getElementById('analyzeBtn');
  pasteBtn = document.getElementById('pasteBtn');
  statusElement = document.getElementById('status');
  successMessage = document.getElementById('successMessage');
  errorMessage = document.getElementById('errorMessage');
  warningMessage = document.getElementById('warningMessage');
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
  
  // Clear input button
  clearInputBtn = document.getElementById('clearInputBtn');
  
  // Set up collapsible functionality
  setupCollapsibles();

  // Set up event listeners
  if (clearHistoryBtn) clearHistoryBtn.addEventListener('click', async function() {
    if (confirm('Are you sure you want to clear all property history?')) {
      await clearPropertyHistory();
    }
  });
  
  // Word export button event listener
  const exportWordBtn = document.getElementById('exportWordBtn');
  if (exportWordBtn) exportWordBtn.addEventListener('click', async function() {
    try {
      const result = await chrome.storage.local.get(['propertyHistory']);
      const history = result.propertyHistory || [];
      const analyzedProperties = history.filter(item => item.analysis && item.analysis.fullResponse);
      
      if (analyzedProperties.length === 0) {
        showError('No analyzed properties available for Word export');
        return;
      }
      
      if (window.WordExportModule) {
        window.WordExportModule.showExportOptionsModal(analyzedProperties);
      } else {
        showError('Word export module not loaded. Please refresh the extension.');
      }
    } catch (error) {
      console.error('Error initiating Word export:', error);
      showError('Failed to initiate Word export');
    }
  });
  if (analyzeBtn) analyzeBtn.addEventListener('click', handleAnalyzeClick);
  if (pasteBtn) pasteBtn.addEventListener('click', async function() {
    try {
      const text = await navigator.clipboard.readText();
      if (propertyUrlInput) {
        propertyUrlInput.value = text;
        validatePropertyInput();
        updateWorkflowStep(2, true);
        showSuccess('Link pasted successfully!');
      }
    } catch (err) {
      showError('Unable to paste from clipboard. Please paste manually.');
    }
  });

  // Clear input button
  if (clearInputBtn) clearInputBtn.addEventListener('click', function() {
    if (propertyUrlInput) {
      propertyUrlInput.value = '';
      clearValidation();
      updateWorkflowStep(2, false);
      updateWorkflowStep(3, false);
    }
  });

  // Property input validation on change
  if (propertyUrlInput) {
    propertyUrlInput.addEventListener('input', validatePropertyInput);
    propertyUrlInput.addEventListener('paste', function() {
      // Validate after paste event completes
      setTimeout(validatePropertyInput, 100);
    });
  }

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

  // Initialize category UI
  initializeCategoryUI();
  
  // Initialize latest analysis section
  initializeLatestAnalysisSection();

  // Initialize UX enhancements
  initializeUXEnhancements();
  
  // Initialize enhanced Properties tab
  initializeEnhancedPropertiesTab();

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
      // Remove notification badge when switching to properties tab
      removePropertiesTabNotification();
      // Refresh property history when switching to properties tab
      loadPropertyHistory();
      // Check for latest analysis to show at the top
      checkForLatestAnalysis();
      // Update enhanced Properties tab
      updatePropertiesStats();
      updateViewDisplay();
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
    // Ensure category manager is initialized
    await categoryManager.initialize();
    
    // Check if property already exists
    const existingProperty = Array.from(categoryManager.properties.values())
      .find(item => item.url === url);
    
    if (existingProperty) {
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
    
    // Add to category manager (always start as uncategorized - user will decide)
    await categoryManager.addPropertyToCategory(newProperty, 'uncategorized');
    
    console.log('✅ Property saved to history');
    
    // Keep only the last 50 entries (optional - remove oldest if needed)
    const allProperties = Array.from(categoryManager.properties.values());
    if (allProperties.length > 50) {
      // Sort by timestamp and remove oldest
      const sortedProperties = allProperties.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      const propertiesToRemove = sortedProperties.slice(50);
      
      for (const property of propertiesToRemove) {
        const propertyId = property.id || property.url;
        await categoryManager.removeProperty(propertyId);
      }
    }
    
  } catch (error) {
    console.error('Failed to save property to history:', error);
  }
}

// Function to load and display property history
async function loadPropertyHistory() {
  try {
    // Ensure category manager is initialized
    await categoryManager.initialize();
    
    // Get all properties from the category manager
    const allProperties = Array.from(categoryManager.properties.values());
    
    displayPropertyHistory(allProperties);
    
    // Check for latest analysis when properties are loaded
    await checkForLatestAnalysis();
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
    const category = categoryManager.getCategory(item.categoryId || 'uncategorized');
    const categoryName = category ? category.name : 'Uncategorized';
    const categoryIcon = category ? category.icon : '📋';
    
    return `
      <div class="history-item ${analysisStatus}" data-property-id="${item.id || item.url}">
        <div class="history-header">
          <a href="${item.url}" target="_blank" class="history-url">${item.domain}</a>
          <div class="history-meta">
            <div class="property-category" style="color: ${category?.color || '#6B7280'}; font-size: 12px; margin-bottom: 4px;">
              ${categoryIcon} ${categoryName}
            </div>
            <div class="history-status ${analysisStatus}">
              ${hasAnalysis ? '✅ Analyzed' : '⏳ Pending'}
            </div>
          </div>
        </div>
        ${hasAnalysis ? `
          <div class="analysis-preview-full">
            <div class="analysis-content">${item.analysis.fullResponse.substring(0, 300)}${item.analysis.fullResponse.length > 300 ? '...' : ''}</div>
          </div>
        ` : ''}
        <div class="history-actions">
          <select class="category-selector btn-sm" data-property-id="${item.id || item.url}" style="font-size: 11px; padding: 2px 4px; margin-right: 8px; border: 1px solid var(--border); border-radius: 4px;">
            ${categoryManager.getAllCategories().map(cat => 
              `<option value="${cat.id}" ${item.categoryId === cat.id ? 'selected' : ''}>${cat.icon} ${cat.name}</option>`
            ).join('')}
          </select>
          ${hasAnalysis ? `<button class="btn btn-ghost btn-sm view-analysis-btn" data-index="${index}">👁️ View Full Response</button>` : ''}
          ${hasAnalysis ? `<button class="btn btn-ghost btn-sm export-word-btn" data-index="${index}">📄 Export Word</button>` : ''}
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
  
  // Add event listeners for individual Word export buttons
  document.querySelectorAll('.export-word-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.getAttribute('data-index'));
      if (window.WordExportModule) {
        window.WordExportModule.showExportOptionsModal(history[index]);
      } else {
        showError('Word export module not loaded. Please refresh the extension.');
      }
    });
  });

  // Add event listeners for category selectors
  document.querySelectorAll('.category-selector').forEach(select => {
    select.addEventListener('change', async (e) => {
      const propertyId = e.target.getAttribute('data-property-id');
      const newCategoryId = e.target.value;
      
      try {
        await categoryManager.movePropertyToCategory(propertyId, newCategoryId);
        showSuccess(`Property moved to ${categoryManager.getCategory(newCategoryId)?.name || 'category'}`);
        
        // Refresh the display
        await loadPropertyHistory();
      } catch (error) {
        console.error('Failed to move property to category:', error);
        showError('Failed to update property category');
        
        // Reset the selector to previous value
        const property = categoryManager.properties.get(propertyId);
        if (property) {
          e.target.value = property.categoryId || 'uncategorized';
        }
      }
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
    // Get all properties to find the one at the given index
    const allProperties = Array.from(categoryManager.properties.values());
    
    if (index >= 0 && index < allProperties.length) {
      const propertyToRemove = allProperties[index];
      const propertyId = propertyToRemove.id || propertyToRemove.url;
      
      await categoryManager.removeProperty(propertyId);
      console.log('✅ Property removed from history');
      
      // Refresh the display
      await loadPropertyHistory();
    }
  } catch (error) {
    console.error('Failed to remove property from history:', error);
  }
}

async function clearPropertyHistory() {
  try {
    // Clear all properties from category manager
    categoryManager.properties.clear();
    
    // Reset property counts for all categories
    categoryManager.categories.forEach(category => {
      category.propertyCount = 0;
    });
    
    await categoryManager.saveData();
    console.log('✅ Property history cleared');
    showSuccess('History cleared successfully!');
    
    // Refresh the display
    await loadPropertyHistory();
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
  
  if (!validationState.isValid) {
    showError('Please enter a valid property link from a supported real estate website.');
    return;
  }
  
  // Start enhanced analysis progress
  startAnalysisProgress();
  
  // Disable button while processing
  if (analyzeBtn) {
    analyzeBtn.disabled = true;
    analyzeBtn.classList.add('loading');
    const btnText = analyzeBtn.querySelector('.btn-text');
    if (btnText) {
      btnText.innerHTML = '<div class="spinner"></div> Analyzing...';
    }
  }
  
  try {
    // Update progress - validating
    updateAnalysisStep('validate', 'completed');
    updateAnalysisStep('send', 'active');
    
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
      // Update progress - analyzing
      updateAnalysisStep('send', 'completed');
      updateAnalysisStep('analyze', 'active');
      
      // Save property to history
      updateAnalysisStep('save', 'active');
      await savePropertyToHistory(link);
      updateAnalysisStep('save', 'completed');
      
      // Complete analysis
      completeAnalysisProgress();
      
      showSuccess('Property sent to ChatGPT for analysis! Check the Properties tab to see results.');
      
      // Clear the input and reset validation
      if (propertyUrlInput) {
        propertyUrlInput.value = '';
        clearValidation();
        updateWorkflowStep(2, false);
        updateWorkflowStep(3, false);
      }
      
      // Auto-switch to properties tab after a delay
      setTimeout(() => {
        switchToTab('properties');
      }, 2000);
      
    } else {
      throw new Error(response?.error || 'Failed to send property link to ChatGPT.');
    }
    
  } catch (error) {
    console.error('Analysis failed:', error);
    hideAnalysisProgress();
    showError(`Unable to communicate with ChatGPT: ${error.message}`);
  } finally {
    if (analyzeBtn) {
      analyzeBtn.disabled = false;
      analyzeBtn.classList.remove('loading');
      const btnText = analyzeBtn.querySelector('.btn-text');
      if (btnText) {
        btnText.innerHTML = 'Analyze Property';
      }
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
          updateStatusWithProgress('Connected to ChatGPT', 'Ready to analyze properties', 100);
          contentScriptReady = true;
          updateWorkflowStep(1, true);
          
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
        updateStatusWithProgress('Ready on ChatGPT', 'Loading extension features...', 75);
        updateWorkflowStep(1, true);
        
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
            updateStatusWithProgress('Connected to ChatGPT', 'Ready to analyze properties', 100);
          } catch (injectError) {
            console.error('Failed to inject content script:', injectError);
            updateStatusWithProgress('Ready on ChatGPT', 'Some features may be limited', 75);
          }
      }
      
    } else {
      // Not on ChatGPT
      statusElement.className = 'status inactive';
      updateStatusWithProgress('Not Connected', 'Please open ChatGPT to use this extension', 0);
      
      // Show site info
      if (infoElement) infoElement.style.display = 'block';
      if (siteElement) siteElement.textContent = new URL(currentTab.url).hostname;
      if (urlElement) urlElement.textContent = currentTab.url;
    }
    
  } catch (error) {
    console.error('Failed to initialize popup:', error);
    statusElement.className = 'status inactive';
    updateStatusWithProgress('Connection Error', 'Unable to check status', 0);
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
                     version: "v1.1.1",
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
          version: "v1.1.1",
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
      <div style="padding: var(--space-sm); border-bottom: 1px solid var(--border); cursor: pointer;" data-action="restore-prompt" data-index="${index}">
        <div style="font-size: var(--font-size-sm); font-weight: var(--font-weight-medium);">
          ${new Date(item.timestamp).toLocaleDateString()} ${new Date(item.timestamp).toLocaleTimeString()}
        </div>
        <div style="font-size: var(--font-size-sm); color: var(--text-secondary); margin-top: var(--space-xs);">
          ${item.prompt.substring(0, 100)}${item.prompt.length > 100 ? '...' : ''}
        </div>
      </div>
    `).join('');
    
    historyDiv.innerHTML = historyHTML;
    
    // Add event listeners for prompt history
    historyDiv.addEventListener('click', (event) => {
      const target = event.target.closest('[data-action="restore-prompt"]');
      if (target) {
        const index = parseInt(target.dataset.index);
        restorePromptVersion(index);
      }
    });
    
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

// Function is now called via event listeners instead of onclick

// ============================================================================
// WORD EXPORT FUNCTIONALITY
// ============================================================================

// Word Export Module
const WordExportModule = {
  // Initialize Word export functionality
  async init() {
    try {
      // Load docx library dynamically
      await this.loadDocxLibrary();
      console.log('✅ Word export module initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Word export module:', error);
    }
  },

  // Dynamically load docx.js library
  async loadDocxLibrary() {
    return new Promise((resolve, reject) => {
      if (window.docx) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('docx.min.js');
      script.onload = () => {
        console.log('✅ Docx library loaded');
        resolve();
      };
      script.onerror = (error) => {
        console.error('❌ Failed to load docx library:', error);
        reject(error);
      };
      document.head.appendChild(script);
    });
  },

  // Extract ChatGPT conversation content with formatting
  extractConversationContent(propertyItem) {
    const analysis = propertyItem.analysis;
    if (!analysis || !analysis.fullResponse) {
      throw new Error('No analysis data available for export');
    }

    // Parse the response for structured content
    const content = {
      propertyUrl: propertyItem.url,
      domain: propertyItem.domain,
      analysisDate: propertyItem.date,
      fullResponse: analysis.fullResponse,
      extractedData: analysis.extractedData || {},
      structured: this.parseStructuredResponse(analysis.fullResponse)
    };

    return content;
  },

  // Parse structured response sections
  parseStructuredResponse(responseText) {
    const sections = {};
    
    // Common section patterns
    const sectionPatterns = [
      { key: 'propertyDetails', patterns: [/\*\*PROPERTY\s+DETAILS:\*\*([\s\S]*?)(?=\*\*[A-Z\s&]+:|$)/i] },
      { key: 'locationAnalysis', patterns: [/\*\*LOCATION\s+.*?ANALYSIS:\*\*([\s\S]*?)(?=\*\*[A-Z\s&]+:|$)/i] },
      { key: 'rentalAnalysis', patterns: [/\*\*RENTAL\s+.*?ANALYSIS:\*\*([\s\S]*?)(?=\*\*[A-Z\s&]+:|$)/i] },
      { key: 'investmentSummary', patterns: [/\*\*INVESTMENT\s+SUMMARY:\*\*([\s\S]*?)(?=\*\*[A-Z\s&]+:|$)/i] },
      { key: 'financialAnalysis', patterns: [/\*\*FINANCIAL\s+ANALYSIS:\*\*([\s\S]*?)(?=\*\*[A-Z\s&]+:|$)/i] }
    ];

    sectionPatterns.forEach(({ key, patterns }) => {
      for (const pattern of patterns) {
        const match = responseText.match(pattern);
        if (match && match[1]) {
          sections[key] = match[1].trim();
          break;
        }
      }
    });

    return sections;
  },

  // Generate Word document from conversation content
  async generateWordDocument(content, options = {}) {
    if (!window.docx) {
      await this.loadDocxLibrary();
    }

    const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = window.docx;

    // Document sections
    const children = [];

    // Title
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "ChatGPT Property Analysis Export",
            bold: true,
            size: 32,
          }),
        ],
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
      })
    );

    // Property Information Header
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "Property Information",
            bold: true,
            size: 24,
          }),
        ],
        heading: HeadingLevel.HEADING_1,
      })
    );

    // Property URL
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "Property URL: ",
            bold: true,
          }),
          new TextRun({
            text: content.propertyUrl,
            color: "0066CC",
          }),
        ],
      })
    );

    // Source and Date
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "Source: ",
            bold: true,
          }),
          new TextRun({
            text: content.domain,
          }),
          new TextRun({
            text: " | Analysis Date: ",
            bold: true,
          }),
          new TextRun({
            text: content.analysisDate,
          }),
        ],
      })
    );

    // Add space
    children.push(new Paragraph({ text: "" }));

    // Key Property Data (if available)
    if (content.extractedData && Object.keys(content.extractedData).length > 0) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "Key Property Data",
              bold: true,
              size: 20,
            }),
          ],
          heading: HeadingLevel.HEADING_2,
        })
      );

      const keyData = content.extractedData;
      const dataFields = [
        { key: 'price', label: 'Price' },
        { key: 'bedrooms', label: 'Bedrooms' },
        { key: 'bathrooms', label: 'Bathrooms' },
        { key: 'squareFeet', label: 'Square Feet' },
        { key: 'propertyType', label: 'Property Type' },
        { key: 'yearBuilt', label: 'Year Built' },
        { key: 'locationScore', label: 'Location Score' },
        { key: 'estimatedRentalIncome', label: 'Est. Monthly Rental Income' },
        { key: 'rentalGrowthPotential', label: 'Rental Growth Potential' }
      ];

      dataFields.forEach(({ key, label }) => {
        if (keyData[key]) {
          let value = keyData[key];
          if (key === 'price' && !value.includes('$')) {
            value = '$' + parseFloat(value).toLocaleString();
          }
          
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `${label}: `,
                  bold: true,
                }),
                new TextRun({
                  text: value.toString(),
                }),
              ],
            })
          );
        }
      });

      children.push(new Paragraph({ text: "" }));
    }

    // Full ChatGPT Analysis
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "Complete ChatGPT Analysis",
            bold: true,
            size: 20,
          }),
        ],
        heading: HeadingLevel.HEADING_2,
      })
    );

    // Process and add the full response with basic formatting preservation
    const responseLines = content.fullResponse.split('\n');
    for (const line of responseLines) {
      if (line.trim() === '') {
        children.push(new Paragraph({ text: "" }));
        continue;
      }

      // Check for headers (lines with ** around them)
      const headerMatch = line.match(/^\*\*(.+?)\*\*$/);
      if (headerMatch) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: headerMatch[1],
                bold: true,
                size: 18,
              }),
            ],
            heading: HeadingLevel.HEADING_3,
          })
        );
        continue;
      }

      // Check for bold text within lines
      const textRuns = [];
      let remainingText = line;
      let match;
      
      // Process bold text (**text**)
      while ((match = remainingText.match(/^(.*?)\*\*(.+?)\*\*(.*)/))) {
        // Add text before bold
        if (match[1]) {
          textRuns.push(new TextRun({ text: match[1] }));
        }
        // Add bold text
        textRuns.push(new TextRun({ text: match[2], bold: true }));
        // Continue with remaining text
        remainingText = match[3];
      }
      
      // Add any remaining text
      if (remainingText) {
        textRuns.push(new TextRun({ text: remainingText }));
      }

      // If no formatting was found, just add the plain text
      if (textRuns.length === 0) {
        textRuns.push(new TextRun({ text: line }));
      }

      children.push(new Paragraph({ children: textRuns }));
    }

    // Footer
    children.push(new Paragraph({ text: "" }));
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Generated by ChatGPT Helper Extension on ${new Date().toLocaleString()}`,
            italics: true,
            size: 16,
            color: "666666",
          }),
        ],
        alignment: AlignmentType.CENTER,
      })
    );

    // Create document
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: children,
        },
      ],
    });

    return doc;
  },

  // Export single property to Word
  async exportSingleProperty(propertyItem, options = {}) {
    try {
      showProgress('Preparing Word document...', 0);
      
      const content = this.extractConversationContent(propertyItem);
      showProgress('Generating document structure...', 30);
      
      const doc = await this.generateWordDocument(content, options);
      showProgress('Converting to Word format...', 70);
      
      const buffer = await window.docx.Packer.toBlob(doc);
      showProgress('Downloading file...', 90);
      
      // Generate filename
      const domain = propertyItem.domain.replace(/[^a-zA-Z0-9]/g, '-');
      const date = new Date().toISOString().split('T')[0];
      const filename = `ChatGPT-Analysis-${domain}-${date}.docx`;
      
      // Download file
      this.downloadBlob(buffer, filename);
      
      showProgress('Export complete!', 100);
      setTimeout(() => hideProgress(), 2000);
      
      showSuccess(`Word document exported: ${filename}`);
      
    } catch (error) {
      hideProgress();
      console.error('Error exporting to Word:', error);
      showError(`Failed to export Word document: ${error.message}`);
    }
  },

  // Export multiple properties to Word (batch export)
  async exportMultipleProperties(propertyItems, options = {}) {
    try {
      if (propertyItems.length === 0) {
        showError('No properties selected for export');
        return;
      }

      showProgress(`Preparing batch export of ${propertyItems.length} properties...`, 0);

      if (!window.docx) {
        await this.loadDocxLibrary();
      }

      const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak } = window.docx;
      
      const children = [];

      // Document title
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "ChatGPT Property Analysis - Batch Export",
              bold: true,
              size: 32,
            }),
          ],
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER,
        })
      );

      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${propertyItems.length} Properties Analyzed`,
              size: 20,
            }),
          ],
          alignment: AlignmentType.CENTER,
        })
      );

      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Generated on ${new Date().toLocaleString()}`,
              italics: true,
              size: 16,
            }),
          ],
          alignment: AlignmentType.CENTER,
        })
      );

      children.push(new Paragraph({ text: "" }));

      // Process each property
      for (let i = 0; i < propertyItems.length; i++) {
        const propertyItem = propertyItems[i];
        const progress = Math.round((i / propertyItems.length) * 80) + 10;
        showProgress(`Processing property ${i + 1} of ${propertyItems.length}...`, progress);

        try {
          const content = this.extractConversationContent(propertyItem);

          // Add page break for properties after the first
          if (i > 0) {
            children.push(new Paragraph({
              children: [new PageBreak()],
            }));
          }

          // Property header
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `Property ${i + 1}: ${content.domain}`,
                  bold: true,
                  size: 24,
                }),
              ],
              heading: HeadingLevel.HEADING_1,
            })
          );

          // Property URL and details
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: "URL: ",
                  bold: true,
                }),
                new TextRun({
                  text: content.propertyUrl,
                  color: "0066CC",
                }),
              ],
            })
          );

          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: "Analysis Date: ",
                  bold: true,
                }),
                new TextRun({
                  text: content.analysisDate,
                }),
              ],
            })
          );

          children.push(new Paragraph({ text: "" }));

          // Add abbreviated analysis (first 500 characters to keep document manageable)
          const shortAnalysis = content.fullResponse.length > 1000 
            ? content.fullResponse.substring(0, 1000) + "..."
            : content.fullResponse;

          const analysisLines = shortAnalysis.split('\n');
          for (const line of analysisLines) {
            if (line.trim() === '') {
              children.push(new Paragraph({ text: "" }));
              continue;
            }

            const headerMatch = line.match(/^\*\*(.+?)\*\*$/);
            if (headerMatch) {
              children.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: headerMatch[1],
                      bold: true,
                      size: 16,
                    }),
                  ],
                  heading: HeadingLevel.HEADING_3,
                })
              );
            } else {
              children.push(new Paragraph({
                children: [new TextRun({ text: line })],
              }));
            }
          }

        } catch (error) {
          console.error(`Error processing property ${i + 1}:`, error);
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `Error processing property: ${error.message}`,
                  color: "FF0000",
                  italics: true,
                }),
              ],
            })
          );
        }
      }

      showProgress('Generating Word document...', 90);

      const doc = new Document({
        sections: [
          {
            properties: {},
            children: children,
          },
        ],
      });

      const buffer = await window.docx.Packer.toBlob(doc);
      
      const date = new Date().toISOString().split('T')[0];
      const filename = `ChatGPT-Batch-Analysis-${propertyItems.length}-properties-${date}.docx`;
      
      this.downloadBlob(buffer, filename);
      
      showProgress('Batch export complete!', 100);
      setTimeout(() => hideProgress(), 2000);
      
      showSuccess(`Batch Word document exported: ${filename}`);
      
    } catch (error) {
      hideProgress();
      console.error('Error in batch export:', error);
      showError(`Failed to export batch Word document: ${error.message}`);
    }
  },

  // Download blob as file
  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  // Show export options modal
  showExportOptionsModal(propertyItems) {
    const isMultiple = Array.isArray(propertyItems) && propertyItems.length > 1;
    const title = isMultiple ? `Export ${propertyItems.length} Properties to Word` : 'Export to Word Document';
    
    const modal = document.createElement('div');
    modal.id = 'wordExportModal';
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
          <h3 style="margin: 0; font-size: var(--font-size-xl);">📄 ${title}</h3>
          <button class="close-btn" style="
            background: none;
            border: none;
            font-size: 20px;
            cursor: pointer;
            color: var(--text-secondary);
          ">✕</button>
        </div>
        
        <div style="padding: var(--space-lg);">
          <div style="margin-bottom: var(--space-lg);">
            <h4 style="margin: 0 0 var(--space-md) 0;">Export Options</h4>
            
            <label style="display: block; margin-bottom: var(--space-md);">
              <input type="checkbox" id="includeFormatting" checked style="margin-right: var(--space-sm);">
              Preserve text formatting (bold, headers)
            </label>
            
            <label style="display: block; margin-bottom: var(--space-md);">
              <input type="checkbox" id="includePropertyData" checked style="margin-right: var(--space-sm);">
              Include extracted property data summary
            </label>
            
            <label style="display: block; margin-bottom: var(--space-md);">
              <input type="checkbox" id="includeTimestamp" checked style="margin-right: var(--space-sm);">
              Include export timestamp
            </label>

            ${isMultiple ? `
              <label style="display: block; margin-bottom: var(--space-md);">
                <input type="checkbox" id="separatePages" checked style="margin-right: var(--space-sm);">
                Separate each property on new page
              </label>
            ` : ''}
          </div>

          <div style="
            background: #f0f9ff;
            padding: var(--space-md);
            border-radius: var(--radius-sm);
            margin-bottom: var(--space-lg);
            border-left: 4px solid var(--primary);
          ">
            <strong>Export Preview:</strong><br>
            ${isMultiple ? 
              `${propertyItems.length} properties will be exported to a single Word document.` :
              `Property from ${propertyItems.domain} will be exported with full ChatGPT analysis.`
            }
          </div>
        </div>
        
        <div style="
          padding: var(--space-lg);
          border-top: 1px solid var(--border);
          display: flex;
          gap: var(--space-md);
          justify-content: flex-end;
        ">
          <button class="cancel-btn btn btn-secondary btn-sm">❌ Cancel</button>
          <button class="export-btn btn btn-primary btn-sm">📄 Export to Word</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Event handlers
    const closeBtn = modal.querySelector('.close-btn');
    const cancelBtn = modal.querySelector('.cancel-btn');
    const exportBtn = modal.querySelector('.export-btn');

    const closeModal = () => modal.remove();

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    exportBtn.addEventListener('click', async () => {
      const options = {
        includeFormatting: modal.querySelector('#includeFormatting').checked,
        includePropertyData: modal.querySelector('#includePropertyData').checked,
        includeTimestamp: modal.querySelector('#includeTimestamp').checked,
        separatePages: modal.querySelector('#separatePages')?.checked ?? true
      };

      closeModal();

      if (isMultiple) {
        await this.exportMultipleProperties(propertyItems, options);
      } else {
        await this.exportSingleProperty(propertyItems, options);
      }
    });
  }
};

// Progress indicator functions
function showProgress(message, percentage) {
  let progressModal = document.getElementById('progressModal');
  
  if (!progressModal) {
    progressModal = document.createElement('div');
    progressModal.id = 'progressModal';
    progressModal.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: var(--background);
      border-radius: var(--radius-md);
      padding: var(--space-lg);
      box-shadow: var(--shadow-md);
      z-index: 10001;
      min-width: 300px;
      text-align: center;
    `;
    
    progressModal.innerHTML = `
      <div style="margin-bottom: var(--space-md);">
        <div style="font-weight: var(--font-weight-medium); margin-bottom: var(--space-sm);" id="progressMessage">Processing...</div>
        <div style="width: 100%; height: 8px; background: var(--border); border-radius: 4px; overflow: hidden;">
          <div id="progressBar" style="height: 100%; background: var(--primary); transition: width 0.3s ease; width: 0%;"></div>
        </div>
        <div style="font-size: var(--font-size-sm); color: var(--text-secondary); margin-top: var(--space-sm);" id="progressPercent">0%</div>
      </div>
    `;
    
    document.body.appendChild(progressModal);
  }
  
  const messageEl = progressModal.querySelector('#progressMessage');
  const barEl = progressModal.querySelector('#progressBar');
  const percentEl = progressModal.querySelector('#progressPercent');
  
  if (messageEl) messageEl.textContent = message;
  if (barEl) barEl.style.width = percentage + '%';
  if (percentEl) percentEl.textContent = Math.round(percentage) + '%';
}

function hideProgress() {
  const progressModal = document.getElementById('progressModal');
  if (progressModal) {
    progressModal.remove();
  }
}

// Category UI Management Functions
function initializeCategoryUI() {
  // Get UI elements
  const categoryViewBtn = document.getElementById('categoryViewBtn');
  const listViewBtn = document.getElementById('listViewBtn');
  const manageCategoriesBtn = document.getElementById('manageCategoriesBtn');
  const categoryGridSection = document.getElementById('categoryGridSection');
  const propertyHistorySection = document.getElementById('propertyHistorySection');
  const categoryFilter = document.getElementById('categoryFilter');
  
  // Set up view toggle
  let currentView = 'category'; // Default to category view
  
  if (categoryViewBtn) {
    categoryViewBtn.addEventListener('click', () => {
      currentView = 'category';
      categoryViewBtn.classList.add('active');
      listViewBtn.classList.remove('active');
      categoryGridSection.style.display = 'block';
      propertyHistorySection.style.display = 'none';
      renderCategoryGrid();
    });
  }
  
  if (listViewBtn) {
    listViewBtn.addEventListener('click', () => {
      currentView = 'list';
      listViewBtn.classList.add('active');
      categoryViewBtn.classList.remove('active');
      categoryGridSection.style.display = 'none';
      propertyHistorySection.style.display = 'block';
      loadPropertyHistory();
    });
  }
  
  // Set up category management modal
  if (manageCategoriesBtn) {
    manageCategoriesBtn.addEventListener('click', openCategoryManagementModal);
  }
  
  // Set up category filter
  if (categoryFilter) {
    categoryFilter.addEventListener('change', (e) => {
      const selectedCategory = e.target.value;
      filterPropertiesByCategory(selectedCategory);
    });
  }
  
  // Initialize bulk operations
  initializeBulkOperations();
  
  // Initialize keyboard shortcuts
  initializeKeyboardShortcuts();
  
  // Initialize with category view
  renderCategoryGrid();
  updateCategoryFilter();
}

function initializeBulkOperations() {
  const selectModeBtn = document.getElementById('selectModeBtn');
  const bulkActionsDiv = document.querySelector('.bulk-actions');
  const bulkCategoryAction = document.getElementById('bulkCategoryAction');
  const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
  const bulkDeselectBtn = document.getElementById('bulkDeselectBtn');
  
  if (selectModeBtn) {
    selectModeBtn.addEventListener('click', toggleSelectMode);
  }
  
  if (bulkCategoryAction) {
    bulkCategoryAction.addEventListener('change', handleBulkCategoryMove);
  }
  
  if (bulkDeleteBtn) {
    bulkDeleteBtn.addEventListener('click', handleBulkDelete);
  }
  
  if (bulkDeselectBtn) {
    bulkDeselectBtn.addEventListener('click', deselectAllProperties);
  }
}

function toggleSelectMode() {
  bulkSelectionMode = !bulkSelectionMode;
  selectedProperties.clear();
  
  const selectModeBtn = document.getElementById('selectModeBtn');
  const bulkActionsDiv = document.querySelector('.bulk-actions');
  const propertyItems = document.querySelectorAll('.history-item');
  
  if (bulkSelectionMode) {
    selectModeBtn.classList.add('active');
    selectModeBtn.title = 'Exit select mode (Esc)';
    if (bulkActionsDiv) bulkActionsDiv.style.display = 'flex';
    
    propertyItems.forEach(item => {
      item.classList.add('select-mode');
      item.addEventListener('click', handlePropertySelection);
    });
    
    updateBulkCategorySelector();
  } else {
    selectModeBtn.classList.remove('active');
    selectModeBtn.title = 'Select multiple (S)';
    if (bulkActionsDiv) bulkActionsDiv.style.display = 'none';
    
    propertyItems.forEach(item => {
      item.classList.remove('select-mode', 'selected');
      item.removeEventListener('click', handlePropertySelection);
    });
  }
  
  updateSelectedCount();
}

function handlePropertySelection(event) {
  if (!bulkSelectionMode) return;
  
  // Prevent default click behavior
  event.preventDefault();
  event.stopPropagation();
  
  const propertyItem = event.currentTarget;
  const propertyId = propertyItem.dataset.propertyId;
  
  if (selectedProperties.has(propertyId)) {
    selectedProperties.delete(propertyId);
    propertyItem.classList.remove('selected');
  } else {
    selectedProperties.add(propertyId);
    propertyItem.classList.add('selected');
  }
  
  updateSelectedCount();
}

function updateSelectedCount() {
  const selectedCountEl = document.getElementById('selectedCount');
  if (selectedCountEl) {
    const count = selectedProperties.size;
    selectedCountEl.textContent = `${count} selected`;
  }
}

async function updateBulkCategorySelector() {
  const bulkCategoryAction = document.getElementById('bulkCategoryAction');
  if (!bulkCategoryAction) return;
  
  await categoryManager.initialize();
  const categories = categoryManager.getAllCategories();
  
  bulkCategoryAction.innerHTML = `
    <option value="">Move to...</option>
    ${categories.map(cat => 
      `<option value="${cat.id}">${cat.icon} ${cat.name}</option>`
    ).join('')}
  `;
}

async function handleBulkCategoryMove(event) {
  const targetCategoryId = event.target.value;
  if (!targetCategoryId || selectedProperties.size === 0) return;
  
  const category = categoryManager.getCategory(targetCategoryId);
  if (!category) return;
  
  try {
    const promises = Array.from(selectedProperties).map(propertyId =>
      categoryManager.movePropertyToCategory(propertyId, targetCategoryId)
    );
    
    await Promise.all(promises);
    
    showSuccess(`${selectedProperties.size} properties moved to ${category.name}`);
    
    // Clear selection and refresh
    selectedProperties.clear();
    await loadPropertyHistory();
    await renderCategoryGrid();
    updateSelectedCount();
    
    // Reset selector
    event.target.value = '';
  } catch (error) {
    console.error('Bulk category move failed:', error);
    showError('Failed to move properties');
  }
}

async function handleBulkDelete() {
  if (selectedProperties.size === 0) return;
  
  const confirmMessage = `Delete ${selectedProperties.size} selected properties?`;
  if (!confirm(confirmMessage)) return;
  
  try {
    const promises = Array.from(selectedProperties).map(propertyId =>
      categoryManager.removeProperty(propertyId)
    );
    
    await Promise.all(promises);
    
    showSuccess(`${selectedProperties.size} properties deleted`);
    
    // Clear selection and refresh
    selectedProperties.clear();
    await loadPropertyHistory();
    await renderCategoryGrid();
    updateSelectedCount();
  } catch (error) {
    console.error('Bulk delete failed:', error);
    showError('Failed to delete properties');
  }
}

function deselectAllProperties() {
  selectedProperties.clear();
  document.querySelectorAll('.history-item.selected').forEach(item => {
    item.classList.remove('selected');
  });
  updateSelectedCount();
}

function initializeKeyboardShortcuts() {
  let shortcutsVisible = false;
  
  document.addEventListener('keydown', (event) => {
    // Don't handle shortcuts when typing in inputs
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
      return;
    }
    
    switch (event.key.toLowerCase()) {
      case 's':
        event.preventDefault();
        if (document.getElementById('listViewBtn').classList.contains('active')) {
          toggleSelectMode();
        }
        break;
        
      case 'escape':
        event.preventDefault();
        if (bulkSelectionMode) {
          toggleSelectMode();
        }
        break;
        
      case 'a':
        event.preventDefault();
        if (bulkSelectionMode && event.ctrlKey) {
          selectAllProperties();
        }
        break;
        
      case 'c':
        event.preventDefault();
        if (activeTab === 'properties') {
          const categoryViewBtn = document.getElementById('categoryViewBtn');
          if (categoryViewBtn) categoryViewBtn.click();
        }
        break;
        
      case 'l':
        event.preventDefault();
        if (activeTab === 'properties') {
          const listViewBtn = document.getElementById('listViewBtn');
          if (listViewBtn) listViewBtn.click();
        }
        break;
        
      case 'm':
        event.preventDefault();
        if (activeTab === 'properties') {
          openCategoryManagementModal();
        }
        break;
        
      case 'h':
      case '?':
        event.preventDefault();
        toggleShortcutsTooltip();
        shortcutsVisible = !shortcutsVisible;
        break;
    }
  });
}

function selectAllProperties() {
  if (!bulkSelectionMode) return;
  
  const propertyItems = document.querySelectorAll('.history-item[data-property-id]');
  selectedProperties.clear();
  
  propertyItems.forEach(item => {
    const propertyId = item.dataset.propertyId;
    selectedProperties.add(propertyId);
    item.classList.add('selected');
  });
  
  updateSelectedCount();
}

function toggleShortcutsTooltip() {
  let tooltip = document.getElementById('shortcutsTooltip');
  
  if (tooltip) {
    tooltip.remove();
    return;
  }
  
  tooltip = document.createElement('div');
  tooltip.id = 'shortcutsTooltip';
  tooltip.className = 'shortcuts-tooltip';
  tooltip.innerHTML = `
    <h4>Keyboard Shortcuts</h4>
    <div class="shortcut">
      <span>Select mode</span>
      <span class="key">S</span>
    </div>
    <div class="shortcut">
      <span>Exit/Cancel</span>
      <span class="key">Esc</span>
    </div>
    <div class="shortcut">
      <span>Select all</span>
      <span class="key">Ctrl+A</span>
    </div>
    <div class="shortcut">
      <span>Category view</span>
      <span class="key">C</span>
    </div>
    <div class="shortcut">
      <span>List view</span>
      <span class="key">L</span>
    </div>
    <div class="shortcut">
      <span>Manage categories</span>
      <span class="key">M</span>
    </div>
    <div class="shortcut">
      <span>Show shortcuts</span>
      <span class="key">H or ?</span>
    </div>
  `;
  
  document.body.appendChild(tooltip);
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    if (tooltip) tooltip.remove();
  }, 5000);
}

async function renderCategoryGrid() {
  const categoryGrid = document.getElementById('categoryGrid');
  if (!categoryGrid) return;
  
  try {
    await categoryManager.initialize();
    const categories = categoryManager.getAllCategories();
  
  if (categories.length === 0) {
         categoryGrid.innerHTML = `
       <div class="empty-state">
         <div class="empty-state-icon">🗂️</div>
         <p>No categories found</p>
         <button class="btn btn-primary btn-sm" data-action="add-category">
           ➕ Add Category
         </button>
       </div>
     `;
     
     // Add event listener for the add category button
     const addCategoryBtn = categoryGrid.querySelector('[data-action="add-category"]');
     if (addCategoryBtn) {
       addCategoryBtn.addEventListener('click', openCategoryManagementModal);
     }
    return;
  }
  
  const categoryHTML = categories.map(category => {
    const properties = categoryManager.getPropertiesByCategory(category.id);
    const propertyCount = properties.length;
    
    return `
      <div class="category-card" data-action="open-category" data-category-id="${category.id}" style="border-color: ${category.color}20;">
        <div class="category-header">
          <div style="display: flex; align-items: center;">
            <span class="category-icon">${category.icon}</span>
            <h3 class="category-title" style="color: ${category.color};">${category.name}</h3>
          </div>
          <span class="category-count">${propertyCount}</span>
        </div>
        <p class="category-description">${category.description}</p>
        <div class="category-actions">
          <button class="btn btn-ghost btn-sm" data-action="edit-category" data-category-id="${category.id}" title="Edit">
            ✏️
          </button>
          ${category.id !== 'uncategorized' ? `
            <button class="btn btn-ghost btn-sm" data-action="delete-category" data-category-id="${category.id}" title="Delete">
              🗑️
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
  
  categoryGrid.innerHTML = categoryHTML;
  
  // Add event listeners for category cards
  setupCategoryCardEventListeners();
  } catch (error) {
    console.error('Failed to render category grid:', error);
    categoryGrid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <p>Failed to load categories</p>
        <button class="btn btn-primary btn-sm" data-action="retry-categories">
          🔄 Retry
        </button>
      </div>
    `;
    
    // Add event listener for retry button
    const retryBtn = categoryGrid.querySelector('[data-action="retry-categories"]');
    if (retryBtn) {
      retryBtn.addEventListener('click', renderCategoryGrid);
    }
  }
}

function setupCategoryCardEventListeners() {
  const categoryGrid = document.getElementById('categoryGrid');
  if (!categoryGrid) return;
  
  // Use event delegation for better performance
  categoryGrid.addEventListener('click', (event) => {
    const target = event.target;
    const action = target.dataset.action;
    const categoryId = target.dataset.categoryId;
    
    // Handle category card actions
    if (action === 'open-category' || target.closest('[data-action="open-category"]')) {
      const cardElement = target.closest('[data-action="open-category"]');
      if (cardElement) {
        const cardCategoryId = cardElement.dataset.categoryId;
        openCategoryView(cardCategoryId);
      }
    } else if (action === 'edit-category') {
      event.stopPropagation();
      editCategory(categoryId);
    } else if (action === 'delete-category') {
      event.stopPropagation();
      deleteCategory(categoryId);
    }
  });
}

function openCategoryView(categoryId) {
  // Switch to list view and filter by category
  const listViewBtn = document.getElementById('listViewBtn');
  const categoryFilter = document.getElementById('categoryFilter');
  
  if (listViewBtn) listViewBtn.click();
  if (categoryFilter) {
    categoryFilter.value = categoryId;
    filterPropertiesByCategory(categoryId);
  }
}

async function filterPropertiesByCategory(categoryId) {
  await categoryManager.initialize();
  
  let propertiesToShow;
  if (categoryId === 'all') {
    propertiesToShow = Array.from(categoryManager.properties.values());
  } else {
    propertiesToShow = categoryManager.getPropertiesByCategory(categoryId);
  }
  
  displayPropertyHistory(propertiesToShow);
}

async function updateCategoryFilter() {
  const categoryFilter = document.getElementById('categoryFilter');
  if (!categoryFilter) return;
  
  await categoryManager.initialize();
  const categories = categoryManager.getAllCategories();
  
  categoryFilter.innerHTML = `
    <option value="all">All Categories</option>
    ${categories.map(cat => 
      `<option value="${cat.id}">${cat.icon} ${cat.name}</option>`
    ).join('')}
  `;
}

function openCategoryManagementModal() {
  const modal = document.getElementById('categoryManagementModal');
  if (modal) {
    modal.style.display = 'flex';
    setupCategoryModal();
    populateExistingCategories();
  }
}

function setupCategoryModal() {
  const modal = document.getElementById('categoryManagementModal');
  const closeBtn = document.getElementById('categoryModalClose');
  const addBtn = document.getElementById('addCategoryBtn');
  
  // Close modal (remove existing listeners first to avoid duplicates)
  if (closeBtn) {
    closeBtn.removeEventListener('click', closeCategoryManagementModal);
    closeBtn.addEventListener('click', closeCategoryManagementModal);
  }
  
  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeCategoryManagementModal();
    }
  });
  
  // Icon selector
  document.querySelectorAll('.icon-option').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.icon-option').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });
  
  // Color selector
  document.querySelectorAll('.color-option').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.color-option').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });
  
  // Add category button (remove existing listeners first)
  if (addBtn) {
    addBtn.removeEventListener('click', addNewCategory);
    addBtn.addEventListener('click', addNewCategory);
  }
}

function closeCategoryManagementModal() {
  const modal = document.getElementById('categoryManagementModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

async function addNewCategory() {
  const nameInput = document.getElementById('newCategoryName');
  const descriptionInput = document.getElementById('newCategoryDescription');
  const selectedIcon = document.querySelector('.icon-option.selected');
  const selectedColor = document.querySelector('.color-option.selected');
  
  if (!nameInput || !nameInput.value.trim()) {
    showError('Please enter a category name');
    return;
  }
  
  const categoryData = {
    name: nameInput.value.trim(),
    description: descriptionInput ? descriptionInput.value.trim() : '',
    icon: selectedIcon ? selectedIcon.dataset.icon : '📁',
    color: selectedColor ? selectedColor.dataset.color : '#6B7280'
  };
  
  try {
    await categoryManager.createCategory(categoryData);
    showSuccess(`Category "${categoryData.name}" created successfully!`);
    
    // Clear form
    nameInput.value = '';
    if (descriptionInput) descriptionInput.value = '';
    
    // Refresh UI
    await renderCategoryGrid();
    await updateCategoryFilter();
    populateExistingCategories();
  } catch (error) {
    console.error('Failed to create category:', error);
    showError('Failed to create category');
  }
}

async function populateExistingCategories() {
  const container = document.getElementById('existingCategoriesList');
  if (!container) return;
  
  await categoryManager.initialize();
  const categories = categoryManager.getAllCategories();
  
  const categoriesHTML = categories.map(category => `
    <div class="existing-category-item">
      <div class="existing-category-info">
        <span class="existing-category-icon" style="color: ${category.color};">${category.icon}</span>
        <div class="existing-category-details">
          <h5 style="color: ${category.color};">${category.name}</h5>
          <p>${category.description || 'No description'}</p>
        </div>
      </div>
      <div class="existing-category-actions">
        <button class="btn btn-ghost btn-sm" data-action="edit-category" data-category-id="${category.id}" title="Edit">
          ✏️
        </button>
        ${category.id !== 'uncategorized' ? `
          <button class="btn btn-ghost btn-sm" data-action="delete-category" data-category-id="${category.id}" title="Delete">
            🗑️
          </button>
        ` : ''}
      </div>
    </div>
  `).join('');
  
  container.innerHTML = categoriesHTML;
  
  // Add event listeners for existing category actions
  setupExistingCategoriesEventListeners();
}

function setupExistingCategoriesEventListeners() {
  const container = document.getElementById('existingCategoriesList');
  if (!container) return;
  
  // Use event delegation
  container.addEventListener('click', (event) => {
    const target = event.target;
    const action = target.dataset.action;
    const categoryId = target.dataset.categoryId;
    
    if (action === 'edit-category') {
      editCategory(categoryId);
    } else if (action === 'delete-category') {
      deleteCategory(categoryId);
    }
  });
}

async function editCategory(categoryId) {
  // Simple implementation - could be enhanced with inline editing
  const category = categoryManager.getCategory(categoryId);
  if (!category) return;
  
  const newName = prompt('Enter new category name:', category.name);
  if (newName && newName.trim() !== category.name) {
    try {
      await categoryManager.updateCategory(categoryId, { name: newName.trim() });
      showSuccess('Category updated successfully!');
      await renderCategoryGrid();
      await updateCategoryFilter();
      populateExistingCategories();
    } catch (error) {
      console.error('Failed to update category:', error);
      showError('Failed to update category');
    }
  }
}

async function deleteCategory(categoryId) {
  const category = categoryManager.getCategory(categoryId);
  if (!category) return;
  
  const properties = categoryManager.getPropertiesByCategory(categoryId);
  const confirmMessage = properties.length > 0 
    ? `Delete "${category.name}"? ${properties.length} properties will be moved to Uncategorized.`
    : `Delete "${category.name}"?`;
  
  if (confirm(confirmMessage)) {
    try {
      await categoryManager.deleteCategory(categoryId);
      showSuccess('Category deleted successfully!');
      await renderCategoryGrid();
      await updateCategoryFilter();
      populateExistingCategories();
      await loadPropertyHistory(); // Refresh property display
    } catch (error) {
      console.error('Failed to delete category:', error);
      showError('Failed to delete category');
    }
  }
}

// Smart categorization suggestions
function suggestCategoryForProperty(property) {
  if (!property.url || !property.domain) return 'uncategorized';
  
  const url = property.url.toLowerCase();
  const domain = property.domain.toLowerCase();
  
  // URL-based categorization patterns
  const patterns = {
    'rental': [
      'rent', 'rental', 'lease', 'apartment', 'condo'
    ],
    'investment': [
      'investment', 'flip', 'commercial', 'multi-family', 'duplex', 'triplex'
    ],
    'primary_residence': [
      'single-family', 'townhouse', 'home', 'house'
    ]
  };
  
  // Check URL content for keywords
  for (const [categoryId, keywords] of Object.entries(patterns)) {
    if (categoryManager.getCategory(categoryId)) {
      for (const keyword of keywords) {
        if (url.includes(keyword)) {
          return categoryId;
        }
      }
    }
  }
  
  // Domain-based suggestions
  if (domain.includes('apartments.com') || domain.includes('rent.com')) {
    return categoryManager.getCategory('rental') ? 'rental' : 'uncategorized';
  }
  
  // Default to uncategorized
  return 'uncategorized';
}

// Enhanced smart suggestions based on analysis content
function suggestCategoryBasedOnAnalysis(property) {
  if (!property.analysis || !property.analysis.fullResponse) {
    return suggestCategoryForProperty(property);
  }
  
  const analysisText = property.analysis.fullResponse.toLowerCase();
  
  // Analysis-based patterns
  const analysisPatterns = {
    'investment': [
      'investment potential', 'roi', 'cash flow', 'cap rate', 'rental income',
      'appreciation', 'investment grade', 'profitable', 'return on investment'
    ],
    'rental': [
      'rental property', 'rent estimate', 'rental income', 'tenant', 'lease',
      'rental market', 'rental yield', 'rental value'
    ],
    'favorites': [
      'excellent', 'outstanding', 'perfect', 'ideal', 'highly recommended',
      'exceptional', 'premium', 'luxury', 'stunning'
    ]
  };
  
  // Score each category based on keyword matches
  const scores = {};
  for (const [categoryId, keywords] of Object.entries(analysisPatterns)) {
    if (categoryManager.getCategory(categoryId)) {
      scores[categoryId] = 0;
      for (const keyword of keywords) {
        const matches = (analysisText.match(new RegExp(keyword, 'g')) || []).length;
        scores[categoryId] += matches;
      }
    }
  }
  
  // Find the category with the highest score
  let bestCategory = 'uncategorized';
  let bestScore = 0;
  
  for (const [categoryId, score] of Object.entries(scores)) {
    if (score > bestScore && score >= 2) { // Require at least 2 keyword matches
      bestScore = score;
      bestCategory = categoryId;
    }
  }
  
  return bestCategory;
}

// Process property analysis (preserve data, no auto-categorization)
async function processPropertyAnalysis(propertyUrl, analysis) {
  try {
    await categoryManager.initialize();
    
    // Find the property
    const property = Array.from(categoryManager.properties.values())
      .find(p => p.url === propertyUrl);
    
    if (!property) return;
    
    // Update property with analysis - preserve all existing data
    property.analysis = analysis;
    property.updatedAt = new Date().toISOString();
    
    // Save the updated property (preserve category assignment)
    await categoryManager.saveProperties();
    
    console.log('✅ Property analysis saved, category preserved');
    
  } catch (error) {
    console.error('Failed to process property analysis:', error);
  }
}

// Latest Analysis Management
let latestAnalyzedProperty = null;
let latestAnalysisShown = false;

function initializeLatestAnalysisSection() {
  const dismissBtn = document.getElementById('dismissLatestBtn');
  
  if (dismissBtn) {
    dismissBtn.addEventListener('click', dismissLatestAnalysis);
  }
}

async function checkForLatestAnalysis() {
  try {
    await categoryManager.initialize();
    const allProperties = Array.from(categoryManager.properties.values());
    
    // Find the most recently analyzed property
    const analyzedProperties = allProperties
      .filter(prop => prop.analysis && prop.analysis.fullResponse)
      .sort((a, b) => {
        const timeA = new Date(a.updatedAt || a.timestamp || 0).getTime();
        const timeB = new Date(b.updatedAt || b.timestamp || 0).getTime();
        return timeB - timeA;
      });
    
    if (analyzedProperties.length === 0) {
      hideLatestAnalysis();
      return;
    }
    
    const mostRecent = analyzedProperties[0];
    
    // Check if this is a new analysis (within last 5 minutes and not dismissed)
    const analysisTime = new Date(mostRecent.updatedAt || mostRecent.timestamp || 0);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    if (analysisTime > fiveMinutesAgo && !latestAnalysisShown) {
      latestAnalyzedProperty = mostRecent;
      await showLatestAnalysis(mostRecent);
      latestAnalysisShown = true;
    } else {
      hideLatestAnalysis();
    }
  } catch (error) {
    console.error('Failed to check for latest analysis:', error);
  }
}

async function showLatestAnalysis(property) {
  const latestSection = document.getElementById('latestAnalysisSection');
  const latestContent = document.getElementById('latestAnalysisContent');
  
  if (!latestSection || !latestContent) return;
  
  await categoryManager.initialize();
  const currentCategory = categoryManager.getCategory(property.categoryId || 'uncategorized');
  const suggestedCategory = suggestCategoryBasedOnAnalysis(property);
  const suggestedCategoryObj = categoryManager.getCategory(suggestedCategory);
  
  // Get all categories for quick selection
  const allCategories = categoryManager.getAllCategories();
  
  latestContent.innerHTML = `
    <div class="latest-analysis-content">
      <div class="latest-property-header">
        <div class="latest-property-info">
          <a href="${property.url}" target="_blank" class="latest-property-url">
            ${property.domain || new URL(property.url).hostname}
          </a>
          <div class="latest-property-meta">
            <div class="latest-property-timestamp">
              <span>🕒</span>
              <span>Analyzed ${getTimeAgo(property.updatedAt || property.timestamp)}</span>
            </div>
            <div class="current-category" style="color: ${currentCategory?.color || '#6B7280'};">
              ${currentCategory?.icon || '📋'} ${currentCategory?.name || 'Uncategorized'}
            </div>
          </div>
        </div>
      </div>
      
      <div class="latest-analysis-preview">
        <div class="latest-analysis-text">
          ${property.analysis.fullResponse.substring(0, 300)}${property.analysis.fullResponse.length > 300 ? '...' : ''}
        </div>
      </div>
      
      <div class="latest-categorization-section">
        <div class="categorization-header">
          <span>🏷️</span>
          Quick Categorization
          ${suggestedCategory !== 'uncategorized' && suggestedCategory !== property.categoryId ? 
            `<span style="font-size: var(--font-size-sm); color: var(--text-secondary); font-weight: normal;">AI suggests: ${suggestedCategoryObj?.icon} ${suggestedCategoryObj?.name}</span>` : ''}
        </div>
        
        <div class="quick-categorization">
          ${allCategories.map(category => `
            <button class="quick-category-btn ${category.id === suggestedCategory && category.id !== property.categoryId ? 'suggested' : ''}" 
                    data-action="quick-categorize" 
                    data-property-id="${property.id || property.url}" 
                    data-category-id="${category.id}"
                    style="color: ${category.color};">
              ${category.icon} ${category.name}
            </button>
          `).join('')}
        </div>
        
        <div class="custom-categorization">
          <select class="category-select-latest" id="latestCategorySelect">
            ${allCategories.map(cat => 
              `<option value="${cat.id}" ${property.categoryId === cat.id ? 'selected' : ''}>${cat.icon} ${cat.name}</option>`
            ).join('')}
          </select>
          <button class="btn btn-primary btn-sm" data-action="apply-category" data-property-id="${property.id || property.url}">
            Apply
          </button>
        </div>
      </div>
      
      <div class="latest-actions">
        <button class="btn btn-ghost btn-sm" data-action="view-full-analysis" data-property-id="${property.id || property.url}">
          👁️ View Full Analysis
        </button>
        <button class="btn btn-ghost btn-sm" data-action="export-property" data-property-id="${property.id || property.url}">
          📄 Export to Word
        </button>
      </div>
    </div>
  `;
  
  // Show the section with smooth animation
  latestSection.style.display = 'block';
  
  // Smooth scroll to the latest analysis section
  setTimeout(() => {
    latestSection.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'start' 
    });
  }, 100);
  
  // Set up event listeners for the latest analysis section
  setupLatestAnalysisEventListeners();
}

function hideLatestAnalysis() {
  const latestSection = document.getElementById('latestAnalysisSection');
  if (latestSection) {
    latestSection.style.display = 'none';
  }
}

function dismissLatestAnalysis() {
  hideLatestAnalysis();
  latestAnalysisShown = true; // Mark as shown to prevent re-showing
  removePropertiesTabNotification();
}

function addPropertiesTabNotification() {
  const propertiesTabBtn = document.querySelector('[data-tab="properties"]');
  if (propertiesTabBtn && !propertiesTabBtn.querySelector('.notification-badge')) {
    const badge = document.createElement('div');
    badge.className = 'notification-badge';
    propertiesTabBtn.appendChild(badge);
  }
}

function removePropertiesTabNotification() {
  const propertiesTabBtn = document.querySelector('[data-tab="properties"]');
  if (propertiesTabBtn) {
    const badge = propertiesTabBtn.querySelector('.notification-badge');
    if (badge) {
      badge.remove();
    }
  }
}

function setupLatestAnalysisEventListeners() {
  const latestContent = document.getElementById('latestAnalysisContent');
  if (!latestContent) return;
  
  // Use event delegation for all actions
  latestContent.addEventListener('click', async (event) => {
    const target = event.target;
    const action = target.dataset.action;
    const propertyId = target.dataset.propertyId;
    
    if (action === 'quick-categorize') {
      const categoryId = target.dataset.categoryId;
      await handleQuickCategorization(propertyId, categoryId);
    } else if (action === 'apply-category') {
      const categorySelect = document.getElementById('latestCategorySelect');
      if (categorySelect) {
        await handleQuickCategorization(propertyId, categorySelect.value);
      }
    } else if (action === 'view-full-analysis') {
      const property = categoryManager.properties.get(propertyId);
      if (property) {
        showFullResponse(property);
      }
    } else if (action === 'export-property') {
      const property = categoryManager.properties.get(propertyId);
      if (property && window.WordExportModule) {
        window.WordExportModule.showExportOptionsModal(property);
      }
    }
  });
}

async function handleQuickCategorization(propertyId, categoryId) {
  try {
    await categoryManager.movePropertyToCategory(propertyId, categoryId);
    const category = categoryManager.getCategory(categoryId);
    showSuccess(`Property moved to ${category?.name || 'category'}!`);
    
    // Update the UI
    await renderCategoryGrid();
    await loadPropertyHistory();
    
    // Auto-dismiss after successful categorization
    setTimeout(() => {
      dismissLatestAnalysis();
    }, 1500);
    
  } catch (error) {
    console.error('Failed to categorize property:', error);
    showError('Failed to update property category');
  }
}

function getTimeAgo(timestamp) {
  if (!timestamp) return 'recently';
  
  const now = new Date();
  const time = new Date(timestamp);
  const diffMs = now - time;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  
  return time.toLocaleDateString();
}

// Enhanced processPropertyAnalysis to show latest analysis
async function processPropertyAnalysisEnhanced(propertyUrl, analysis) {
  // Call the original function
  await processPropertyAnalysis(propertyUrl, analysis);
  
  // Reset the latest analysis shown flag so new analysis appears
  latestAnalysisShown = false;
  
  // If not on Properties tab, add notification badge
  if (activeTab !== 'properties') {
    addPropertiesTabNotification();
    // Auto-switch to Properties tab to show the new analysis
    switchToTab('properties');
  }
  
  // Check if we should show this as the latest analysis
  await checkForLatestAnalysis();
}

// Make functions available globally for other modules
window.processPropertyAnalysis = processPropertyAnalysisEnhanced;
window.checkForLatestAnalysis = checkForLatestAnalysis;

// Initialize Word export module when popup loads
document.addEventListener('DOMContentLoaded', () => {
  WordExportModule.init();
});

// Export functions to global scope for UI handlers
window.WordExportModule = WordExportModule;
window.showProgress = showProgress;
window.hideProgress = hideProgress;

// ===============================================
// ENHANCED UX FUNCTIONS
// ===============================================

// Enhanced message system
function showMessage(message, type = 'success', duration = 3000) {
  const messageElements = {
    success: successMessage,
    error: errorMessage,
    warning: warningMessage
  };

  const messageElement = messageElements[type];
  if (!messageElement) return;

  // Hide all other messages first
  Object.values(messageElements).forEach(el => {
    if (el && el !== messageElement) {
      el.classList.remove('show');
      el.style.display = 'none';
    }
  });

  // Show the message
  const contentEl = messageElement.querySelector('.message-content');
  if (contentEl) {
    contentEl.textContent = message;
  } else {
    messageElement.textContent = message;
  }
  
  messageElement.classList.add('show');
  messageElement.style.display = 'flex';

  // Auto-hide after duration
  if (duration > 0) {
    setTimeout(() => {
      messageElement.classList.remove('show');
      messageElement.style.display = 'none';
    }, duration);
  }
}

// Enhanced success/error/warning functions (override existing)
function showSuccess(message, duration = 3000) {
  showMessage(message, 'success', duration);
}

function showError(message, duration = 5000) {
  showMessage(message, 'error', duration);
}

function showWarning(message, duration = 4000) {
  showMessage(message, 'warning', duration);
}

// Workflow step management
function updateWorkflowStep(stepNumber, completed) {
  const step = workflowSteps[stepNumber];
  if (!step) return;

  step.completed = completed;
  const stepElement = document.getElementById(step.id);
  
  if (stepElement) {
    if (completed) {
      stepElement.textContent = '✅';
      stepElement.className = 'step-status completed';
    } else {
      stepElement.textContent = '⏳';
      stepElement.className = 'step-status';
    }
  }

  // Update analysis badge
  updateAnalysisBadge();
}

function updateAnalysisBadge() {
  const analysisBadge = document.getElementById('analysisBadge');
  if (!analysisBadge) return;

  const completedSteps = Object.values(workflowSteps).filter(step => step.completed).length;
  const totalSteps = Object.keys(workflowSteps).length;

  if (completedSteps === 0) {
    analysisBadge.textContent = 'Ready';
    analysisBadge.className = 'section-badge';
  } else if (completedSteps === totalSteps) {
    analysisBadge.textContent = 'Ready to Analyze';
    analysisBadge.className = 'section-badge ready';
    analysisBadge.style.background = 'var(--primary)';
    analysisBadge.style.color = 'white';
  } else {
    analysisBadge.textContent = `${completedSteps}/${totalSteps} Steps`;
    analysisBadge.className = 'section-badge progress';
    analysisBadge.style.background = '#fef3c7';
    analysisBadge.style.color = '#92400e';
  }
}

// Property URL validation
function validatePropertyInput() {
  const input = propertyUrlInput?.value?.trim() || '';
  const validationElement = document.getElementById('urlValidation');
  
  if (!validationElement) return;

  if (input === '') {
    clearValidation();
    return;
  }

  // Check if it's a valid URL
  let url;
  try {
    url = new URL(input);
  } catch (e) {
    setValidationState('invalid', 'Please enter a valid URL starting with http:// or https://');
    return;
  }

  const hostname = url.hostname.toLowerCase();
  
  // Check for supported property sites
  const supportedSites = [
    'zillow.com', 'realtor.com', 'redfin.com', 'homes.com', 'trulia.com',
    'apartments.com', 'rent.com', 'hotpads.com', 'padmapper.com', 'loopnet.com',
    'yad2.co.il', 'madlan.co.il', 'spitogatos.gr', 'zoopla.co.uk', 'rightmove.co.uk',
    'homestra.com', 'boligportal.dk', 'lejebolig.dk', 'zyprus.com', 'bazaraki.com'
  ];

  const isSupported = supportedSites.some(site => hostname.includes(site));
  
  if (isSupported) {
    setValidationState('valid', `✓ Valid ${hostname} property link`);
    updateWorkflowStep(2, true);
  } else {
    setValidationState('warning', `⚠ ${hostname} - may work but not fully tested`);
    updateWorkflowStep(2, true);
  }
}

function setValidationState(type, message) {
  validationState.type = type;
  validationState.message = message;
  validationState.isValid = type === 'valid' || type === 'warning';

  const validationElement = document.getElementById('urlValidation');
  const inputElement = propertyUrlInput;

  if (validationElement) {
    validationElement.textContent = message;
    validationElement.className = `input-validation ${type}`;
  }

  if (inputElement) {
    inputElement.className = `form-input ${type}`;
  }
}

function clearValidation() {
  validationState = { isValid: false, message: '', type: 'none' };
  
  const validationElement = document.getElementById('urlValidation');
  const inputElement = propertyUrlInput;

  if (validationElement) {
    validationElement.textContent = '';
    validationElement.className = 'input-validation';
  }

  if (inputElement) {
    inputElement.className = 'form-input';
  }
}

// Enhanced analysis progress tracking
function startAnalysisProgress() {
  const tracker = document.getElementById('analysisTracker');
  const timeElement = document.getElementById('analysisTime');
  
  if (tracker) {
    tracker.style.display = 'block';
  }

  // Reset all steps
  analysisProgress.currentStep = 0;
  analysisProgress.stepStatus = {};
  
  analysisProgress.steps.forEach(step => {
    const stepElement = document.querySelector(`.tracker-step[data-step="${step}"]`);
    if (stepElement) {
      stepElement.classList.remove('active', 'completed');
    }
  });

  // Start timer
  analysisStartTime = Date.now();
  analysisTimer = setInterval(() => {
    if (timeElement) {
      const elapsed = Math.floor((Date.now() - analysisStartTime) / 1000);
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      timeElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
  }, 1000);

  // Start first step
  updateAnalysisStep('validate', 'active');
}

function updateAnalysisStep(stepName, status) {
  const stepElement = document.querySelector(`.tracker-step[data-step="${stepName}"]`);
  const iconElement = document.getElementById(`${stepName}Icon`);
  
  if (!stepElement) return;

  // Remove all status classes
  stepElement.classList.remove('active', 'completed');
  
  if (status === 'active') {
    stepElement.classList.add('active');
    if (iconElement) iconElement.textContent = '⏳';
  } else if (status === 'completed') {
    stepElement.classList.add('completed');
    if (iconElement) iconElement.textContent = '✅';
  }

  analysisProgress.stepStatus[stepName] = status;
}

function completeAnalysisProgress() {
  // Complete all remaining steps
  analysisProgress.steps.forEach(step => {
    updateAnalysisStep(step, 'completed');
  });

  // Stop timer
  if (analysisTimer) {
    clearInterval(analysisTimer);
    analysisTimer = null;
  }

  // Hide tracker after a delay
  setTimeout(() => {
    const tracker = document.getElementById('analysisTracker');
    if (tracker) {
      tracker.style.display = 'none';
    }
  }, 2000);

  updateWorkflowStep(3, true);
}

function hideAnalysisProgress() {
  const tracker = document.getElementById('analysisTracker');
  if (tracker) {
    tracker.style.display = 'none';
  }

  if (analysisTimer) {
    clearInterval(analysisTimer);
    analysisTimer = null;
  }
}

// Enhanced status updates with progress
function updateStatusWithProgress(title, subtitle, progress = 0) {
  const statusTitle = document.querySelector('.status-title');
  const statusSubtitle = document.querySelector('.status-subtitle');
  const progressFill = document.getElementById('statusProgress');

  if (statusTitle) statusTitle.textContent = title;
  if (statusSubtitle) statusSubtitle.textContent = subtitle;
  if (progressFill) progressFill.style.width = `${progress}%`;
}

// Initialize UX enhancements
function initializeUXEnhancements() {
  // Check initial workflow state
  checkWorkflowSteps();
  
  // Initialize validation if input has content
  if (propertyUrlInput && propertyUrlInput.value.trim()) {
    validatePropertyInput();
  }
}

function checkWorkflowSteps() {
  // Check if we're on ChatGPT (step 1)
  if (currentTab && (currentTab.url?.includes('chatgpt.com') || currentTab.url?.includes('chat.openai.com'))) {
    updateWorkflowStep(1, true);
  }

  // Check if there's content in the input (step 2)
  if (propertyUrlInput && propertyUrlInput.value.trim()) {
    updateWorkflowStep(2, true);
  }
}

// ===============================================
// ENHANCED PROPERTIES TAB FUNCTIONS
// ===============================================

// Initialize enhanced Properties tab
function initializeEnhancedPropertiesTab() {
  setupPropertiesEventListeners();
  setupViewToggle();
  setupCategorization();
  updatePropertiesStats();
}

// Setup event listeners for Properties tab
function setupPropertiesEventListeners() {
  // View toggle buttons
  const categoryViewBtn = document.getElementById('categoryViewBtn');
  const listViewBtn = document.getElementById('listViewBtn');
  
  if (categoryViewBtn) {
    categoryViewBtn.addEventListener('click', () => switchView('category'));
  }
  
  if (listViewBtn) {
    listViewBtn.addEventListener('click', () => switchView('list'));
  }
  
  // Organize now button
  const organizeNowBtn = document.getElementById('organizeNowBtn');
  if (organizeNowBtn) {
    organizeNowBtn.addEventListener('click', startCategorization);
  }
  
  // Dismiss alert button
  const dismissAlertBtn = document.getElementById('dismissAlertBtn');
  if (dismissAlertBtn) {
    dismissAlertBtn.addEventListener('click', dismissUncategorizedAlert);
  }
  
  // Clear history button
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');
  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', handleClearHistory);
  }
  
  // Latest analysis dismiss button
  const dismissLatestBtn = document.getElementById('dismissLatestBtn');
  if (dismissLatestBtn) {
    dismissLatestBtn.addEventListener('click', dismissLatestAnalysis);
  }
  
  // Categorization modal events
  setupCategorizationModal();
}

// Setup view toggle functionality
function setupViewToggle() {
  currentView = 'category'; // Default view
  updateViewDisplay();
}

// Switch between category and list views
function switchView(view) {
  currentView = view;
  
  // Update button states
  const categoryBtn = document.getElementById('categoryViewBtn');
  const listBtn = document.getElementById('listViewBtn');
  
  if (categoryBtn && listBtn) {
    categoryBtn.classList.toggle('active', view === 'category');
    listBtn.classList.toggle('active', view === 'list');
  }
  
  updateViewDisplay();
}

// Update view display based on current view
function updateViewDisplay() {
  const categorySection = document.getElementById('categoryViewSection');
  const listSection = document.getElementById('listViewSection');
  
  if (currentView === 'category') {
    if (categorySection) categorySection.style.display = 'block';
    if (listSection) listSection.style.display = 'none';
    renderEnhancedCategoryGrid();
  } else {
    if (categorySection) categorySection.style.display = 'none';
    if (listSection) listSection.style.display = 'block';
    renderPropertiesList();
  }
}

// Render enhanced category grid
async function renderEnhancedCategoryGrid() {
  await categoryManager.initialize();
  
  const categoryGrid = document.getElementById('categoryGrid');
  if (!categoryGrid) return;
  
  const categories = categoryManager.getAllCategories();
  const allProperties = Array.from(categoryManager.properties.values());
  
  if (categories.length === 0) {
    categoryGrid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📁</div>
        <p>No categories created yet</p>
        <button class="btn btn-primary btn-sm" onclick="document.getElementById('manageCategoriesBtn').click()">
          Create Categories
        </button>
      </div>
    `;
    return;
  }
  
  const categoryCards = categories.map(category => {
    const properties = allProperties.filter(p => p.categoryId === category.id);
    const hasProperties = properties.length > 0;
    
    return `
      <div class="category-card ${hasProperties ? 'has-properties' : ''}" data-category-id="${category.id}">
        <div class="category-header">
          <div class="category-info">
            <div class="category-icon" style="color: ${category.color}">${category.icon}</div>
            <div class="category-details">
              <h3>${category.name}</h3>
              <p>${category.description}</p>
            </div>
          </div>
          <div class="category-count">${properties.length}</div>
        </div>
        
        <div class="category-properties">
          ${properties.length > 0 ? `
            <div class="category-properties-list">
              ${properties.slice(0, 4).map(property => `
                <div class="category-property-item" data-property-id="${property.id || property.url}">
                  <span class="property-status-icon ${property.analysis ? 'analyzed' : 'pending'}">
                    ${property.analysis ? '●' : '○'}
                  </span>
                  <span class="property-domain">${property.domain || new URL(property.url).hostname}</span>
                </div>
              `).join('')}
              ${properties.length > 4 ? `
                <div class="category-property-item">
                  <span style="color: var(--text-secondary); font-style: italic;">
                    +${properties.length - 4} more...
                  </span>
                </div>
              ` : ''}
            </div>
          ` : `
            <div class="empty-state" style="padding: var(--space-md); text-align: center;">
              <p style="color: var(--text-secondary); font-size: var(--font-size-sm); margin: 0;">
                No properties in this category
              </p>
            </div>
          `}
        </div>
      </div>
    `;
  }).join('');
  
  categoryGrid.innerHTML = categoryCards;
  
  // Add click handlers for category cards
  categoryGrid.querySelectorAll('.category-card').forEach(card => {
    card.addEventListener('click', (e) => {
      const categoryId = card.dataset.categoryId;
      if (e.target.closest('.category-property-item')) {
        // Clicked on a property item
        const propertyId = e.target.closest('.category-property-item').dataset.propertyId;
        if (propertyId) {
          showPropertyDetails(propertyId);
        }
      } else {
        // Clicked on category - show category details
        showCategoryDetails(categoryId);
      }
    });
  });
}

// Render properties list view
async function renderPropertiesList() {
  await categoryManager.initialize();
  
  const propertiesList = document.getElementById('propertiesList');
  const filteredCountElement = document.getElementById('filteredPropertiesCount');
  
  if (!propertiesList) return;
  
  const allProperties = Array.from(categoryManager.properties.values());
  
  if (allProperties.length === 0) {
    propertiesList.innerHTML = `
      <div class="empty-state" style="padding: var(--space-xl);">
        <div class="empty-state-icon">📄</div>
        <p>No properties analyzed yet</p>
        <p style="font-size: var(--font-size-sm); color: var(--text-secondary);">
          Go to the Analyzer tab to add your first property
        </p>
      </div>
    `;
    if (filteredCountElement) filteredCountElement.textContent = '0 properties';
    return;
  }
  
  // Sort by most recent first
  const sortedProperties = allProperties.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  
  const propertyItems = sortedProperties.map(property => {
    const category = categoryManager.getCategory(property.categoryId || 'uncategorized');
    const hasAnalysis = property.analysis && property.analysis.fullResponse;
    
    return `
      <div class="property-item ${selectedProperties.has(property.id || property.url) ? 'selected' : ''}" 
           data-property-id="${property.id || property.url}">
        ${isSelectMode ? `
          <input type="checkbox" class="property-checkbox" 
                 ${selectedProperties.has(property.id || property.url) ? 'checked' : ''}>
        ` : ''}
        
        <div class="property-status ${hasAnalysis ? 'analyzed' : 'pending'}"></div>
        
        <div class="property-info">
          <a href="${property.url}" target="_blank" class="property-url" title="${property.url}">
            ${property.domain || new URL(property.url).hostname}
          </a>
          <div class="property-meta">
            ${property.date || new Date(property.timestamp).toLocaleDateString()} • 
            <span class="property-category" style="background-color: ${category?.color}22;">
              ${category?.icon || '📋'} ${category?.name || 'Uncategorized'}
            </span>
          </div>
        </div>
        
        <div class="property-actions">
          <button class="btn btn-ghost btn-sm categorize-btn" title="Categorize">📁</button>
          ${hasAnalysis ? `
            <button class="btn btn-ghost btn-sm view-btn" title="View Analysis">👁️</button>
          ` : ''}
          <button class="btn btn-ghost btn-sm delete-btn" title="Delete">🗑️</button>
        </div>
      </div>
    `;
  }).join('');
  
  propertiesList.innerHTML = propertyItems;
  
  // Update count
  if (filteredCountElement) {
    filteredCountElement.textContent = `${sortedProperties.length} properties`;
  }
  
  // Add event listeners
  propertiesList.querySelectorAll('.property-item').forEach(item => {
    const propertyId = item.dataset.propertyId;
    
    // Checkbox for selection
    const checkbox = item.querySelector('.property-checkbox');
    if (checkbox) {
      checkbox.addEventListener('click', (e) => {
        e.stopPropagation();
        handlePropertySelection(propertyId, checkbox.checked);
      });
    }
    
    // Categorize button
    const categorizeBtn = item.querySelector('.categorize-btn');
    if (categorizeBtn) {
      categorizeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openCategorizationModal(propertyId);
      });
    }
    
    // View button
    const viewBtn = item.querySelector('.view-btn');
    if (viewBtn) {
      viewBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showPropertyDetails(propertyId);
      });
    }
    
    // Delete button
    const deleteBtn = item.querySelector('.delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteProperty(propertyId);
      });
    }
    
    // Click on item to view details (if not in select mode)
    if (!isSelectMode) {
      item.addEventListener('click', () => {
        showPropertyDetails(propertyId);
      });
    }
  });
}

// Update properties statistics
async function updatePropertiesStats() {
  await categoryManager.initialize();
  
  const allProperties = Array.from(categoryManager.properties.values());
  const analyzedProperties = allProperties.filter(p => p.analysis && p.analysis.fullResponse);
  const categories = categoryManager.getAllCategories();
  const uncategorizedProperties = allProperties.filter(p => p.categoryId === 'uncategorized');
  
  // Update stat numbers
  const totalCountElement = document.getElementById('totalPropertiesCount');
  const analyzedCountElement = document.getElementById('analyzedPropertiesCount');
  const categoriesCountElement = document.getElementById('categoriesCount');
  
  if (totalCountElement) totalCountElement.textContent = allProperties.length;
  if (analyzedCountElement) analyzedCountElement.textContent = analyzedProperties.length;
  if (categoriesCountElement) categoriesCountElement.textContent = categories.length;
  
  // Show/hide uncategorized alert
  const uncategorizedAlert = document.getElementById('uncategorizedAlert');
  const uncategorizedCount = document.getElementById('uncategorizedCount');
  
  if (uncategorizedProperties.length > 0) {
    if (uncategorizedAlert) uncategorizedAlert.style.display = 'block';
    if (uncategorizedCount) uncategorizedCount.textContent = uncategorizedProperties.length;
  } else {
    if (uncategorizedAlert) uncategorizedAlert.style.display = 'none';
  }
}

// Setup categorization functionality
function setupCategorization() {
  // This function sets up the categorization modal and related functionality
  // The actual modal setup is handled in setupCategorizationModal()
}

// Open categorization modal for a property
function openCategorizationModal(propertyId) {
  selectedPropertyForCategorization = propertyId;
  const property = categoryManager.properties.get(propertyId);
  
  if (!property) return;
  
  // Populate property preview
  const propertyPreview = document.getElementById('categorizationPropertyPreview');
  if (propertyPreview) {
    propertyPreview.innerHTML = `
      <div class="preview-url">${property.url}</div>
      <div class="preview-meta">
        ${property.domain || new URL(property.url).hostname} • 
        ${property.date || new Date(property.timestamp).toLocaleDateString()}
        ${property.analysis ? ' • Analyzed' : ' • Pending Analysis'}
      </div>
    `;
  }
  
  // Populate category options
  populateCategoryOptions();
  
  // Show modal
  const modal = document.getElementById('categorizationModal');
  if (modal) {
    modal.style.display = 'flex';
  }
}

// Populate category options in modal
function populateCategoryOptions() {
  const categoryOptions = document.getElementById('categoryOptions');
  if (!categoryOptions) return;
  
  const categories = categoryManager.getAllCategories();
  const currentProperty = categoryManager.properties.get(selectedPropertyForCategorization);
  const currentCategoryId = currentProperty?.categoryId;
  
  const optionsHTML = categories.map(category => `
    <div class="category-option ${category.id === currentCategoryId ? 'selected' : ''}" 
         data-category-id="${category.id}">
      <div class="category-option-icon" style="color: ${category.color}">${category.icon}</div>
      <div class="category-option-info">
        <h5>${category.name}</h5>
        <p>${category.description}</p>
      </div>
    </div>
  `).join('');
  
  categoryOptions.innerHTML = optionsHTML;
  
  // Add click handlers
  categoryOptions.querySelectorAll('.category-option').forEach(option => {
    option.addEventListener('click', () => {
      // Remove previous selection
      categoryOptions.querySelectorAll('.category-option').forEach(opt => 
        opt.classList.remove('selected'));
      
      // Select this option
      option.classList.add('selected');
      
      // Enable confirm button
      const confirmBtn = document.getElementById('confirmCategorizationBtn');
      if (confirmBtn) {
        confirmBtn.disabled = false;
      }
    });
  });
}

// Setup categorization modal event listeners
function setupCategorizationModal() {
  const modal = document.getElementById('categorizationModal');
  const closeBtn = document.getElementById('categorizationModalClose');
  const cancelBtn = document.getElementById('cancelCategorizationBtn');
  const confirmBtn = document.getElementById('confirmCategorizationBtn');
  
  // Close modal handlers
  [closeBtn, cancelBtn].forEach(btn => {
    if (btn) {
      btn.addEventListener('click', () => {
        modal.style.display = 'none';
        selectedPropertyForCategorization = null;
      });
    }
  });
  
  // Confirm categorization
  if (confirmBtn) {
    confirmBtn.addEventListener('click', async () => {
      const selectedOption = document.querySelector('.category-option.selected');
      if (!selectedOption || !selectedPropertyForCategorization) return;
      
      const categoryId = selectedOption.dataset.categoryId;
      
      try {
        await categoryManager.movePropertyToCategory(selectedPropertyForCategorization, categoryId);
        const category = categoryManager.getCategory(categoryId);
        showSuccess(`Property moved to "${category?.name || 'category'}"!`);
        
        // Close modal
        modal.style.display = 'none';
        selectedPropertyForCategorization = null;
        
        // Refresh views
        updatePropertiesStats();
        updateViewDisplay();
        
      } catch (error) {
        console.error('Failed to categorize property:', error);
        showError('Failed to update property category');
      }
    });
  }
  
  // Close on background click
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
        selectedPropertyForCategorization = null;
      }
    });
  }
}

// Helper functions
function startCategorization() {
  // Switch to list view and show properties that need categorization
  switchView('list');
  // Could add filtering here to show only uncategorized properties
}

function dismissUncategorizedAlert() {
  const alert = document.getElementById('uncategorizedAlert');
  if (alert) {
    alert.style.display = 'none';
  }
}

function handleClearHistory() {
  if (confirm('Are you sure you want to clear all property history? This action cannot be undone.')) {
    categoryManager.properties.clear();
    categoryManager.saveProperties();
    updatePropertiesStats();
    updateViewDisplay();
    showSuccess('Property history cleared successfully');
  }
}

function exportSingleProperty(propertyId) {
  const property = categoryManager.properties.get(propertyId);
  if (!property || !property.analysis) {
    showError('No analysis data available for export');
    return;
  }

  // Create a temporary array with just this property for export
  const tempProperties = [property];
  const originalProperties = Array.from(categoryManager.properties.values());
  
  // Temporarily replace the properties for export
  categoryManager.properties.clear();
  tempProperties.forEach(p => categoryManager.properties.set(p.id || p.url, p));
  
  // Trigger export
  const exportWordBtn = document.getElementById('exportWordBtn');
  if (exportWordBtn) {
    exportWordBtn.click();
  }
  
  // Restore original properties
  setTimeout(() => {
    categoryManager.properties.clear();
    originalProperties.forEach(p => categoryManager.properties.set(p.id || p.url, p));
  }, 1000);
}

function showPropertyDetails(propertyId) {
  const property = categoryManager.properties.get(propertyId);
  if (!property) {
    showError('Property not found');
    return;
  }

  // Populate modal content
  const modalPropertyUrl = document.getElementById('modalPropertyUrl');
  const modalPropertyMeta = document.getElementById('modalPropertyMeta');
  const modalAnalysisStatus = document.getElementById('modalAnalysisStatus');
  const modalAnalysisContent = document.getElementById('modalAnalysisContent');

  if (modalPropertyUrl) {
    modalPropertyUrl.textContent = property.url;
  }

  if (modalPropertyMeta) {
    const category = categoryManager.getCategory(property.categoryId || 'uncategorized');
    modalPropertyMeta.innerHTML = `
      <span>${property.domain || new URL(property.url).hostname}</span>
      <span>${property.date || new Date(property.timestamp).toLocaleDateString()}</span>
      <span style="background-color: ${category?.color}22; padding: 4px 8px; border-radius: 4px;">
        ${category?.icon || '📋'} ${category?.name || 'Uncategorized'}
      </span>
    `;
  }

  // Handle analysis content
  const hasAnalysis = property.analysis && property.analysis.fullResponse;
  
  if (modalAnalysisStatus) {
    modalAnalysisStatus.className = `analysis-status ${hasAnalysis ? 'analyzed' : 'pending'}`;
    modalAnalysisStatus.textContent = hasAnalysis ? 'Analyzed' : 'Pending Analysis';
  }

  if (modalAnalysisContent) {
    if (hasAnalysis) {
      modalAnalysisContent.innerHTML = `
        <pre>${property.analysis.fullResponse}</pre>
      `;
    } else {
      modalAnalysisContent.innerHTML = `
        <div class="analysis-empty">
          <div class="analysis-empty-icon">⏳</div>
          <p><strong>Analysis Pending</strong></p>
          <p>This property hasn't been analyzed yet or the analysis is still processing.</p>
        </div>
      `;
    }
  }

  // Setup modal action buttons
  setupPropertyModalActions(propertyId);

  // Show modal
  const modal = document.getElementById('propertyDetailsModal');
  if (modal) {
    modal.style.display = 'flex';
  }
}

function setupPropertyModalActions(propertyId) {
  // Recategorize button
  const recategorizeBtn = document.getElementById('recategorizePropertyBtn');
  if (recategorizeBtn) {
    recategorizeBtn.onclick = () => {
      // Close details modal and open categorization modal
      document.getElementById('propertyDetailsModal').style.display = 'none';
      openCategorizationModal(propertyId);
    };
  }

  // Export single property button
  const exportSingleBtn = document.getElementById('exportSinglePropertyBtn');
  if (exportSingleBtn) {
    exportSingleBtn.onclick = () => {
      exportSingleProperty(propertyId);
    };
  }

  // Delete property button
  const deleteModalBtn = document.getElementById('deletePropertyModalBtn');
  if (deleteModalBtn) {
    deleteModalBtn.onclick = () => {
      if (confirm('Are you sure you want to delete this property?')) {
        categoryManager.removeProperty(propertyId);
        document.getElementById('propertyDetailsModal').style.display = 'none';
        updatePropertiesStats();
        updateViewDisplay();
        showSuccess('Property deleted successfully');
      }
    };
  }

  // Close modal button
  const closeBtn = document.getElementById('propertyModalClose');
  if (closeBtn) {
    closeBtn.onclick = () => {
      document.getElementById('propertyDetailsModal').style.display = 'none';
    };
  }

  // Close modal when clicking outside
  const modal = document.getElementById('propertyDetailsModal');
  if (modal) {
    modal.onclick = (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    };
  }
}

function showCategoryDetails(categoryId) {
  // Show category details (could filter list view to this category)
  console.log('Show category details for:', categoryId);
}

function handlePropertySelection(propertyId, selected) {
  if (selected) {
    selectedProperties.add(propertyId);
  } else {
    selectedProperties.delete(propertyId);
  }
  
  updateBulkActionsBar();
}

function updateBulkActionsBar() {
  const bulkActionsBar = document.getElementById('bulkActionsBar');
  const selectedCount = document.querySelector('.selected-count');
  
  if (selectedProperties.size > 0) {
    if (bulkActionsBar) bulkActionsBar.style.display = 'flex';
    if (selectedCount) selectedCount.textContent = `${selectedProperties.size} selected`;
  } else {
    if (bulkActionsBar) bulkActionsBar.style.display = 'none';
  }
}

function deleteProperty(propertyId) {
  if (confirm('Are you sure you want to delete this property?')) {
    categoryManager.removeProperty(propertyId);
    updatePropertiesStats();
    updateViewDisplay();
    showSuccess('Property deleted successfully');
  }
}

