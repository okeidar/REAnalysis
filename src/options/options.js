/**
 * Options Page JavaScript for Real Estate Analyzer Chrome Extension
 */

class OptionsManager {
  constructor() {
    this.currentTab = 'preferences';
    this.properties = [];
    this.folders = [];
    this.userProfile = null;
    this.init();
  }

  /**
   * Initialize options page
   */
  async init() {
    this.setupEventListeners();
    this.setupNavigation();
    await this.loadData();
    this.handleHashNavigation();
  }

  /**
   * Setup event listeners for all interactions
   */
  setupEventListeners() {
    // Navigation tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const tabName = e.currentTarget.dataset.tab;
        this.switchTab(tabName);
      });
    });

    // Preferences form
    document.getElementById('savePreferences').addEventListener('click', () => {
      this.savePreferences();
    });

    document.getElementById('resetPreferences').addEventListener('click', () => {
      this.resetPreferences();
    });

    // Property search and filter
    document.getElementById('propertySearch').addEventListener('input', (e) => {
      this.filterProperties(e.target.value);
    });

    document.getElementById('propertyFilter').addEventListener('change', (e) => {
      this.filterProperties(document.getElementById('propertySearch').value, e.target.value);
    });

    document.getElementById('propertySortBy').addEventListener('change', (e) => {
      this.sortProperties(e.target.value);
    });

    // Folder management
    document.getElementById('addFolderBtn').addEventListener('click', () => {
      this.showFolderModal();
    });

    document.getElementById('saveFolderBtn').addEventListener('click', () => {
      this.saveFolder();
    });

    // Export functions
    document.getElementById('exportCsvBtn').addEventListener('click', () => {
      this.exportCSV();
    });

    document.getElementById('exportSheetsBtn').addEventListener('click', () => {
      this.exportToSheets();
    });

    document.getElementById('backupDataBtn').addEventListener('click', () => {
      this.backupData();
    });

    document.getElementById('restoreDataBtn').addEventListener('click', () => {
      document.getElementById('restoreFileInput').click();
    });

    document.getElementById('restoreFileInput').addEventListener('change', (e) => {
      this.restoreData(e.target.files[0]);
    });

    // Modal controls
    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', () => {
        this.closeModals();
      });
    });

    // Close modal when clicking outside
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal')) {
        this.closeModals();
      }
    });
  }

  /**
   * Setup navigation handling
   */
  setupNavigation() {
    // Handle browser back/forward
    window.addEventListener('hashchange', () => {
      this.handleHashNavigation();
    });
  }

  /**
   * Handle navigation based on URL hash
   */
  handleHashNavigation() {
    const hash = window.location.hash.substring(1);
    if (hash && ['preferences', 'properties', 'folders', 'export'].includes(hash)) {
      this.switchTab(hash);
    }
  }

  /**
   * Switch between tabs
   * @param {string} tabName - Name of tab to switch to
   */
  switchTab(tabName) {
    // Update navigation
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Update content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    document.getElementById(tabName).classList.add('active');

    // Update URL hash
    window.location.hash = tabName;
    this.currentTab = tabName;

    // Load tab-specific data
    this.loadTabData(tabName);
  }

  /**
   * Load data for specific tab
   * @param {string} tabName - Tab name
   */
  async loadTabData(tabName) {
    switch (tabName) {
      case 'preferences':
        this.loadPreferences();
        break;
      case 'properties':
        await this.loadProperties();
        break;
      case 'folders':
        await this.loadFolders();
        break;
      case 'export':
        await this.loadStorageUsage();
        break;
    }
  }

  /**
   * Load all necessary data
   */
  async loadData() {
    try {
      this.showLoading('Loading data...');
      
      // Load user profile
      const profileResponse = await chrome.runtime.sendMessage({
        action: 'getUserProfile'
      });
      this.userProfile = profileResponse.success ? profileResponse.data : null;

      // Load properties
      const propertiesResponse = await chrome.runtime.sendMessage({
        action: 'getProperties'
      });
      this.properties = propertiesResponse.success ? propertiesResponse.data : [];

      // Load folders
      const foldersResponse = await chrome.runtime.sendMessage({
        action: 'getFolders'
      });
      this.folders = foldersResponse.success ? foldersResponse.data : [];

    } catch (error) {
      console.error('Error loading data:', error);
      this.showMessage('Error loading data', 'error');
    } finally {
      this.hideLoading();
    }
  }

  /**
   * Load preferences into form
   */
  loadPreferences() {
    if (!this.userProfile) return;

    const preferences = this.userProfile.preferences;
    const analysisSettings = this.userProfile.analysisSettings;

    // Investment preferences
    document.getElementById('targetCashFlow').value = preferences.targetCashFlow || 200;
    document.getElementById('targetCapRate').value = preferences.targetCapRate || 8;
    document.getElementById('targetCoCReturn').value = preferences.targetCoCReturn || 12;
    document.getElementById('riskTolerance').value = preferences.riskTolerance || 'medium';
    document.getElementById('investmentStrategy').value = preferences.investmentStrategy || 'balanced';

    // Loan parameters
    document.getElementById('downPaymentPercent').value = preferences.downPaymentPercent || 20;
    document.getElementById('interestRate').value = preferences.interestRate || 7.5;
    document.getElementById('loanTerm').value = preferences.loanTerm || 30;

    // Monthly expenses
    const expenses = preferences.monthlyExpenses || {};
    document.getElementById('maintenanceExpense').value = expenses.maintenance || 200;
    document.getElementById('vacancyExpense').value = expenses.vacancy || 150;
    document.getElementById('managementExpense').value = expenses.management || 100;
    document.getElementById('insuranceExpense').value = expenses.insurance || 100;
    document.getElementById('otherExpense').value = expenses.other || 50;

    // Analysis settings
    document.getElementById('includeMarketAnalysis').checked = analysisSettings.includeMarketAnalysis !== false;
    document.getElementById('autoCalculateRent').checked = analysisSettings.autoCalculateRent !== false;
    document.getElementById('showRedFlags').checked = analysisSettings.showRedFlags !== false;
  }

  /**
   * Save preferences from form
   */
  async savePreferences() {
    try {
      this.showLoading('Saving preferences...');

      const preferences = {
        targetCashFlow: parseFloat(document.getElementById('targetCashFlow').value) || 200,
        targetCapRate: parseFloat(document.getElementById('targetCapRate').value) || 8,
        targetCoCReturn: parseFloat(document.getElementById('targetCoCReturn').value) || 12,
        riskTolerance: document.getElementById('riskTolerance').value || 'medium',
        investmentStrategy: document.getElementById('investmentStrategy').value || 'balanced',
        downPaymentPercent: parseFloat(document.getElementById('downPaymentPercent').value) || 20,
        interestRate: parseFloat(document.getElementById('interestRate').value) || 7.5,
        loanTerm: parseFloat(document.getElementById('loanTerm').value) || 30,
        monthlyExpenses: {
          maintenance: parseFloat(document.getElementById('maintenanceExpense').value) || 200,
          vacancy: parseFloat(document.getElementById('vacancyExpense').value) || 150,
          management: parseFloat(document.getElementById('managementExpense').value) || 100,
          insurance: parseFloat(document.getElementById('insuranceExpense').value) || 100,
          other: parseFloat(document.getElementById('otherExpense').value) || 50
        }
      };

      const analysisSettings = {
        includeMarketAnalysis: document.getElementById('includeMarketAnalysis').checked,
        autoCalculateRent: document.getElementById('autoCalculateRent').checked,
        showRedFlags: document.getElementById('showRedFlags').checked,
        currency: 'USD'
      };

      const userProfile = {
        preferences: preferences,
        analysisSettings: analysisSettings
      };

      const response = await chrome.runtime.sendMessage({
        action: 'updateUserProfile',
        profile: userProfile
      });

      if (response.success) {
        this.userProfile = userProfile;
        this.showMessage('Preferences saved successfully!', 'success');
      } else {
        this.showMessage('Failed to save preferences', 'error');
      }

    } catch (error) {
      console.error('Error saving preferences:', error);
      this.showMessage('Error saving preferences', 'error');
    } finally {
      this.hideLoading();
    }
  }

  /**
   * Reset preferences to defaults
   */
  async resetPreferences() {
    if (!confirm('Are you sure you want to reset all preferences to defaults?')) {
      return;
    }

    try {
      this.showLoading('Resetting preferences...');

      const response = await chrome.runtime.sendMessage({
        action: 'updateUserProfile',
        profile: this.getDefaultProfile()
      });

      if (response.success) {
        this.userProfile = this.getDefaultProfile();
        this.loadPreferences();
        this.showMessage('Preferences reset to defaults', 'success');
      } else {
        this.showMessage('Failed to reset preferences', 'error');
      }

    } catch (error) {
      console.error('Error resetting preferences:', error);
      this.showMessage('Error resetting preferences', 'error');
    } finally {
      this.hideLoading();
    }
  }

  /**
   * Get default user profile
   * @returns {Object} Default profile
   */
  getDefaultProfile() {
    return {
      preferences: {
        targetCashFlow: 200,
        targetCapRate: 8,
        targetCoCReturn: 12,
        riskTolerance: 'medium',
        investmentStrategy: 'balanced',
        downPaymentPercent: 20,
        interestRate: 7.5,
        loanTerm: 30,
        monthlyExpenses: {
          maintenance: 200,
          vacancy: 150,
          management: 100,
          insurance: 100,
          other: 50
        }
      },
      analysisSettings: {
        includeMarketAnalysis: true,
        autoCalculateRent: true,
        showRedFlags: true,
        currency: 'USD'
      }
    };
  }

  /**
   * Load and display properties
   */
  async loadProperties() {
    const container = document.getElementById('propertiesGrid');
    
    if (this.properties.length === 0) {
      container.innerHTML = this.getEmptyState('🏠', 'No Properties Yet', 'Start analyzing properties to see them here.');
      return;
    }

    container.innerHTML = this.properties.map(property => this.createPropertyCard(property)).join('');
    this.attachPropertyEventListeners();
  }

  /**
   * Create property card HTML
   * @param {Object} property - Property data
   * @returns {string} HTML string
   */
  createPropertyCard(property) {
    const analysis = property.analysis || {};
    const financials = analysis.financials || {};
    const verdict = analysis.verdict || 'Not Analyzed';
    const verdictClass = this.getVerdictClass(verdict);

    return `
      <div class="property-card" data-property-id="${property.id}">
        <div class="property-card-header">
          <div>
            <div class="property-title">${property.address || 'Unknown Address'}</div>
            <div class="property-address">${property.site || 'Unknown'} • ${this.formatDate(property.createdAt)}</div>
          </div>
          <div class="property-actions">
            <button class="property-action-btn" data-action="view" title="View Details">👁️</button>
            <button class="property-action-btn" data-action="edit" title="Edit">✏️</button>
            <button class="property-action-btn" data-action="delete" title="Delete">🗑️</button>
          </div>
        </div>
        
        <div class="property-stats">
          <div class="property-stat">
            <div class="property-stat-label">Price</div>
            <div class="property-stat-value">$${(property.price || 0).toLocaleString()}</div>
          </div>
          <div class="property-stat">
            <div class="property-stat-label">Cash Flow</div>
            <div class="property-stat-value">$${(financials.cashFlow?.monthly || 0).toLocaleString()}/mo</div>
          </div>
          <div class="property-stat">
            <div class="property-stat-label">Cap Rate</div>
            <div class="property-stat-value">${(financials.capRate || 0).toFixed(1)}%</div>
          </div>
          <div class="property-stat">
            <div class="property-stat-label">CoC Return</div>
            <div class="property-stat-value">${(financials.cocReturn || 0).toFixed(1)}%</div>
          </div>
        </div>
        
        <div class="property-verdict ${verdictClass}">${verdict}</div>
      </div>
    `;
  }

  /**
   * Attach event listeners to property cards
   */
  attachPropertyEventListeners() {
    document.querySelectorAll('.property-action-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const action = e.currentTarget.dataset.action;
        const propertyId = e.currentTarget.closest('.property-card').dataset.propertyId;
        
        switch (action) {
          case 'view':
            this.viewProperty(propertyId);
            break;
          case 'edit':
            this.editProperty(propertyId);
            break;
          case 'delete':
            this.deleteProperty(propertyId);
            break;
        }
      });
    });
  }

  /**
   * Filter properties based on search and filter criteria
   * @param {string} searchTerm - Search term
   * @param {string} filterValue - Filter value
   */
  filterProperties(searchTerm = '', filterValue = '') {
    let filteredProperties = [...this.properties];

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filteredProperties = filteredProperties.filter(property =>
        (property.address || '').toLowerCase().includes(term) ||
        (property.description || '').toLowerCase().includes(term) ||
        (property.site || '').toLowerCase().includes(term)
      );
    }

    // Apply verdict filter
    if (filterValue) {
      filteredProperties = filteredProperties.filter(property =>
        property.analysis?.verdict === filterValue
      );
    }

    this.displayFilteredProperties(filteredProperties);
  }

  /**
   * Sort properties by specified criteria
   * @param {string} sortBy - Sort criteria
   */
  sortProperties(sortBy) {
    const sortedProperties = [...this.properties].sort((a, b) => {
      switch (sortBy) {
        case 'price':
          return (b.price || 0) - (a.price || 0);
        case 'cashFlow':
          return (b.analysis?.financials?.cashFlow?.monthly || 0) - 
                 (a.analysis?.financials?.cashFlow?.monthly || 0);
        case 'capRate':
          return (b.analysis?.financials?.capRate || 0) - 
                 (a.analysis?.financials?.capRate || 0);
        case 'date':
        default:
          return new Date(b.createdAt) - new Date(a.createdAt);
      }
    });

    this.properties = sortedProperties;
    this.displayFilteredProperties(sortedProperties);
  }

  /**
   * Display filtered properties
   * @param {Array} properties - Filtered properties
   */
  displayFilteredProperties(properties) {
    const container = document.getElementById('propertiesGrid');
    
    if (properties.length === 0) {
      container.innerHTML = this.getEmptyState('🔍', 'No Properties Found', 'Try adjusting your search or filter criteria.');
      return;
    }

    container.innerHTML = properties.map(property => this.createPropertyCard(property)).join('');
    this.attachPropertyEventListeners();
  }

  /**
   * View property details
   * @param {string} propertyId - Property ID
   */
  async viewProperty(propertyId) {
    const property = this.properties.find(p => p.id === propertyId);
    if (!property) return;

    // For now, just show an alert with property details
    // In a full implementation, this would open a detailed modal
    const analysis = property.analysis || {};
    const financials = analysis.financials || {};
    
    alert(`Property Details:
    
Address: ${property.address || 'Unknown'}
Price: $${(property.price || 0).toLocaleString()}
Beds/Baths: ${property.beds || 0}/${property.baths || 0}
Square Feet: ${(property.sqft || 0).toLocaleString()}

Analysis:
Monthly Cash Flow: $${(financials.cashFlow?.monthly || 0).toLocaleString()}
Cap Rate: ${(financials.capRate || 0).toFixed(2)}%
CoC Return: ${(financials.cocReturn || 0).toFixed(2)}%
Verdict: ${analysis.verdict || 'Not Analyzed'}

${analysis.recommendation || 'No recommendation available.'}`);
  }

  /**
   * Edit property (placeholder)
   * @param {string} propertyId - Property ID
   */
  editProperty(propertyId) {
    // Placeholder for edit functionality
    this.showMessage('Edit functionality coming soon!', 'info');
  }

  /**
   * Delete property
   * @param {string} propertyId - Property ID
   */
  async deleteProperty(propertyId) {
    const property = this.properties.find(p => p.id === propertyId);
    if (!property) return;

    if (!confirm(`Are you sure you want to delete "${property.address || 'this property'}"?`)) {
      return;
    }

    try {
      this.showLoading('Deleting property...');

      const response = await chrome.runtime.sendMessage({
        action: 'deleteProperty',
        propertyId: propertyId
      });

      if (response.success) {
        this.properties = this.properties.filter(p => p.id !== propertyId);
        this.loadProperties();
        this.showMessage('Property deleted successfully', 'success');
      } else {
        this.showMessage('Failed to delete property', 'error');
      }

    } catch (error) {
      console.error('Error deleting property:', error);
      this.showMessage('Error deleting property', 'error');
    } finally {
      this.hideLoading();
    }
  }

  /**
   * Load and display folders
   */
  async loadFolders() {
    const container = document.getElementById('foldersGrid');
    
    if (this.folders.length === 0) {
      container.innerHTML = this.getEmptyState('📁', 'No Custom Folders', 'Create folders to organize your properties.');
      return;
    }

    container.innerHTML = this.folders.map(folder => this.createFolderCard(folder)).join('');
    this.attachFolderEventListeners();
  }

  /**
   * Create folder card HTML
   * @param {Object} folder - Folder data
   * @returns {string} HTML string
   */
  createFolderCard(folder) {
    const propertyCount = this.properties.filter(p => p.folder === folder.id).length;
    const strongBuys = this.properties.filter(p => 
      p.folder === folder.id && p.analysis?.verdict === 'Strong Buy'
    ).length;

    return `
      <div class="folder-card" data-folder-id="${folder.id}" style="--folder-color: ${folder.color}">
        <div class="folder-header">
          <div class="folder-info">
            <h3>${folder.name}</h3>
            <div class="folder-count">${propertyCount} properties</div>
          </div>
          <div class="folder-actions">
            <button class="property-action-btn" data-action="edit" title="Edit Folder">✏️</button>
            <button class="property-action-btn" data-action="delete" title="Delete Folder">🗑️</button>
          </div>
        </div>
        
        <div class="folder-stats">
          <div class="folder-stat">
            <div class="folder-stat-label">Strong Buys</div>
            <div class="folder-stat-value">${strongBuys}</div>
          </div>
          <div class="folder-stat">
            <div class="folder-stat-label">Total Properties</div>
            <div class="folder-stat-value">${propertyCount}</div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Attach event listeners to folder cards
   */
  attachFolderEventListeners() {
    document.querySelectorAll('.folder-card .property-action-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const action = e.currentTarget.dataset.action;
        const folderId = e.currentTarget.closest('.folder-card').dataset.folderId;
        
        switch (action) {
          case 'edit':
            this.editFolder(folderId);
            break;
          case 'delete':
            this.deleteFolder(folderId);
            break;
        }
      });
    });
  }

  /**
   * Show folder modal for adding/editing
   * @param {string} folderId - Folder ID for editing
   */
  showFolderModal(folderId = null) {
    const modal = document.getElementById('folderModal');
    const title = document.getElementById('folderModalTitle');
    const nameInput = document.getElementById('folderName');
    const colorInput = document.getElementById('folderColor');

    if (folderId) {
      const folder = this.folders.find(f => f.id === folderId);
      if (folder) {
        title.textContent = 'Edit Folder';
        nameInput.value = folder.name;
        colorInput.value = folder.color;
      }
    } else {
      title.textContent = 'Add Folder';
      nameInput.value = '';
      colorInput.value = '#007bff';
    }

    modal.classList.add('active');
    nameInput.focus();
  }

  /**
   * Save folder
   */
  async saveFolder() {
    const nameInput = document.getElementById('folderName');
    const colorInput = document.getElementById('folderColor');
    const name = nameInput.value.trim();
    const color = colorInput.value;

    if (!name) {
      this.showMessage('Please enter a folder name', 'warning');
      return;
    }

    try {
      this.showLoading('Saving folder...');

      const folder = {
        id: Date.now().toString(),
        name: name,
        color: color
      };

      const updatedFolders = [...this.folders, folder];

      const response = await chrome.runtime.sendMessage({
        action: 'saveFolders',
        folders: updatedFolders
      });

      if (response.success) {
        this.folders = updatedFolders;
        this.loadFolders();
        this.closeModals();
        this.showMessage('Folder saved successfully!', 'success');
      } else {
        this.showMessage('Failed to save folder', 'error');
      }

    } catch (error) {
      console.error('Error saving folder:', error);
      this.showMessage('Error saving folder', 'error');
    } finally {
      this.hideLoading();
    }
  }

  /**
   * Edit folder
   * @param {string} folderId - Folder ID
   */
  editFolder(folderId) {
    this.showFolderModal(folderId);
  }

  /**
   * Delete folder
   * @param {string} folderId - Folder ID
   */
  async deleteFolder(folderId) {
    const folder = this.folders.find(f => f.id === folderId);
    if (!folder) return;

    if (!confirm(`Are you sure you want to delete "${folder.name}"?`)) {
      return;
    }

    try {
      this.showLoading('Deleting folder...');

      const updatedFolders = this.folders.filter(f => f.id !== folderId);

      const response = await chrome.runtime.sendMessage({
        action: 'saveFolders',
        folders: updatedFolders
      });

      if (response.success) {
        this.folders = updatedFolders;
        this.loadFolders();
        this.showMessage('Folder deleted successfully', 'success');
      } else {
        this.showMessage('Failed to delete folder', 'error');
      }

    } catch (error) {
      console.error('Error deleting folder:', error);
      this.showMessage('Error deleting folder', 'error');
    } finally {
      this.hideLoading();
    }
  }

  /**
   * Export data to CSV
   */
  async exportCSV() {
    try {
      this.showLoading('Exporting to CSV...');

      const response = await chrome.runtime.sendMessage({
        action: 'exportData',
        format: 'csv'
      });

      if (response.success) {
        const blob = new Blob([response.data], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `real-estate-analysis-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        
        URL.revokeObjectURL(url);
        
        this.showMessage('CSV exported successfully!', 'success');
      } else {
        this.showMessage('Failed to export CSV', 'error');
      }

    } catch (error) {
      console.error('Error exporting CSV:', error);
      this.showMessage('Error exporting CSV', 'error');
    } finally {
      this.hideLoading();
    }
  }

  /**
   * Export to Google Sheets (placeholder)
   */
  exportToSheets() {
    this.showMessage('Google Sheets export coming soon!', 'info');
  }

  /**
   * Backup all data
   */
  async backupData() {
    try {
      this.showLoading('Creating backup...');

      const response = await chrome.runtime.sendMessage({
        action: 'exportData',
        format: 'json'
      });

      if (response.success) {
        const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `real-estate-analyzer-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        
        this.showMessage('Backup created successfully!', 'success');
      } else {
        this.showMessage('Failed to create backup', 'error');
      }

    } catch (error) {
      console.error('Error creating backup:', error);
      this.showMessage('Error creating backup', 'error');
    } finally {
      this.hideLoading();
    }
  }

  /**
   * Restore data from backup file
   * @param {File} file - Backup file
   */
  async restoreData(file) {
    if (!file) return;

    try {
      this.showLoading('Restoring data...');

      const text = await file.text();
      const data = JSON.parse(text);

      const response = await chrome.runtime.sendMessage({
        action: 'importData',
        data: data
      });

      if (response.success) {
        await this.loadData();
        this.loadTabData(this.currentTab);
        this.showMessage('Data restored successfully!', 'success');
      } else {
        this.showMessage('Failed to restore data', 'error');
      }

    } catch (error) {
      console.error('Error restoring data:', error);
      this.showMessage('Error restoring data - invalid backup file', 'error');
    } finally {
      this.hideLoading();
    }
  }

  /**
   * Load storage usage information
   */
  async loadStorageUsage() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getStorageUsage'
      });

      if (response.success) {
        this.displayStorageUsage(response.data);
      }

    } catch (error) {
      console.error('Error loading storage usage:', error);
    }
  }

  /**
   * Display storage usage
   * @param {Object} usage - Storage usage data
   */
  displayStorageUsage(usage) {
    const container = document.getElementById('storageUsage');
    
    container.innerHTML = `
      <h3>Storage Usage</h3>
      <div class="storage-bar">
        <div class="storage-bar-fill" style="width: ${usage.percentage}%"></div>
      </div>
      <div class="storage-info">
        <span>Used: ${this.formatBytes(usage.used)}</span>
        <span>Available: ${this.formatBytes(usage.remaining)}</span>
      </div>
      <div class="storage-info">
        <span>${usage.percentage}% of ${this.formatBytes(usage.total)} used</span>
      </div>
    `;
  }

  /**
   * Format bytes to human readable format
   * @param {number} bytes - Bytes
   * @returns {string} Formatted string
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Close all modals
   */
  closeModals() {
    document.querySelectorAll('.modal').forEach(modal => {
      modal.classList.remove('active');
    });
  }

  /**
   * Get verdict CSS class
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
   * Format date for display
   * @param {string} dateString - Date string
   * @returns {string} Formatted date
   */
  formatDate(dateString) {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString();
  }

  /**
   * Get empty state HTML
   * @param {string} icon - Icon emoji
   * @param {string} title - Title text
   * @param {string} description - Description text
   * @returns {string} HTML string
   */
  getEmptyState(icon, title, description) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">${icon}</div>
        <div class="empty-state-title">${title}</div>
        <div class="empty-state-text">${description}</div>
      </div>
    `;
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
   * @param {string} type - Message type
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

// Initialize options manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new OptionsManager();
});
