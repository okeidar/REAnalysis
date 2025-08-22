/**
 * Storage Manager for Chrome Extension
 * Handles all data persistence using Chrome Storage API
 */

class StorageManager {
  constructor() {
    this.STORAGE_KEYS = {
      PROPERTIES: 'properties',
      FOLDERS: 'folders', 
      USER_PROFILE: 'userProfile',
      ANALYSIS_HISTORY: 'analysisHistory',
      SETTINGS: 'settings'
    };
  }

  /**
   * Save a property to storage
   * @param {Object} property - Property object to save
   * @returns {Promise<boolean>} Success status
   */
  async saveProperty(property) {
    try {
      const properties = await this.getProperties();
      property.id = property.id || this.generateId();
      property.updatedAt = new Date().toISOString();
      
      properties[property.id] = property;
      await chrome.storage.local.set({ [this.STORAGE_KEYS.PROPERTIES]: properties });
      return true;
    } catch (error) {
      console.error('Error saving property:', error);
      return false;
    }
  }

  /**
   * Get all properties from storage
   * @returns {Promise<Object>} Properties object
   */
  async getProperties() {
    try {
      const result = await chrome.storage.local.get([this.STORAGE_KEYS.PROPERTIES]);
      return result[this.STORAGE_KEYS.PROPERTIES] || {};
    } catch (error) {
      console.error('Error getting properties:', error);
      return {};
    }
  }

  /**
   * Get a specific property by ID
   * @param {string} propertyId - Property ID
   * @returns {Promise<Object|null>} Property object or null
   */
  async getProperty(propertyId) {
    try {
      const properties = await this.getProperties();
      return properties[propertyId] || null;
    } catch (error) {
      console.error('Error getting property:', error);
      return null;
    }
  }

  /**
   * Delete a property from storage
   * @param {string} propertyId - Property ID to delete
   * @returns {Promise<boolean>} Success status
   */
  async deleteProperty(propertyId) {
    try {
      const properties = await this.getProperties();
      delete properties[propertyId];
      await chrome.storage.local.set({ [this.STORAGE_KEYS.PROPERTIES]: properties });
      return true;
    } catch (error) {
      console.error('Error deleting property:', error);
      return false;
    }
  }

  /**
   * Save user profile/preferences
   * @param {Object} profile - User profile object
   * @returns {Promise<boolean>} Success status
   */
  async saveUserProfile(profile) {
    try {
      await chrome.storage.local.set({ [this.STORAGE_KEYS.USER_PROFILE]: profile });
      return true;
    } catch (error) {
      console.error('Error saving user profile:', error);
      return false;
    }
  }

  /**
   * Get user profile/preferences
   * @returns {Promise<Object>} User profile object
   */
  async getUserProfile() {
    try {
      const result = await chrome.storage.local.get([this.STORAGE_KEYS.USER_PROFILE]);
      return result[this.STORAGE_KEYS.USER_PROFILE] || this.getDefaultProfile();
    } catch (error) {
      console.error('Error getting user profile:', error);
      return this.getDefaultProfile();
    }
  }

  /**
   * Save folders to storage
   * @param {Array} folders - Array of folder objects
   * @returns {Promise<boolean>} Success status
   */
  async saveFolders(folders) {
    try {
      await chrome.storage.local.set({ [this.STORAGE_KEYS.FOLDERS]: folders });
      return true;
    } catch (error) {
      console.error('Error saving folders:', error);
      return false;
    }
  }

  /**
   * Get folders from storage
   * @returns {Promise<Array>} Array of folder objects
   */
  async getFolders() {
    try {
      const result = await chrome.storage.local.get([this.STORAGE_KEYS.FOLDERS]);
      return result[this.STORAGE_KEYS.FOLDERS] || [{ id: 'default', name: 'All Properties', color: '#007bff' }];
    } catch (error) {
      console.error('Error getting folders:', error);
      return [{ id: 'default', name: 'All Properties', color: '#007bff' }];
    }
  }

  /**
   * Export all data for backup
   * @returns {Promise<Object>} All stored data
   */
  async exportData() {
    try {
      const result = await chrome.storage.local.get(null);
      return {
        ...result,
        exportDate: new Date().toISOString(),
        version: '1.0.0'
      };
    } catch (error) {
      console.error('Error exporting data:', error);
      return null;
    }
  }

  /**
   * Import data from backup
   * @param {Object} data - Data to import
   * @returns {Promise<boolean>} Success status
   */
  async importData(data) {
    try {
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid data format');
      }
      
      // Remove metadata before importing
      const { exportDate, version, ...importData } = data;
      await chrome.storage.local.clear();
      await chrome.storage.local.set(importData);
      return true;
    } catch (error) {
      console.error('Error importing data:', error);
      return false;
    }
  }

  /**
   * Clear all stored data
   * @returns {Promise<boolean>} Success status
   */
  async clearAllData() {
    try {
      await chrome.storage.local.clear();
      return true;
    } catch (error) {
      console.error('Error clearing data:', error);
      return false;
    }
  }

  /**
   * Generate a unique ID
   * @returns {string} Unique identifier
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Get default user profile
   * @returns {Object} Default profile object
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
   * Get storage usage statistics
   * @returns {Promise<Object>} Storage usage info
   */
  async getStorageUsage() {
    try {
      const usage = await chrome.storage.local.getBytesInUse();
      const quota = chrome.storage.local.QUOTA_BYTES;
      return {
        used: usage,
        total: quota,
        percentage: Math.round((usage / quota) * 100),
        remaining: quota - usage
      };
    } catch (error) {
      console.error('Error getting storage usage:', error);
      return null;
    }
  }
}

// Note: Instance will be created in background script for service worker compatibility
