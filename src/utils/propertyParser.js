/**
 * Property Parser for Real Estate Websites
 * Extracts property data from major real estate sites
 */

class PropertyParser {
  constructor() {
    this.SUPPORTED_SITES = {
      ZILLOW: 'zillow.com',
      REDFIN: 'redfin.com',
      REALTOR: 'realtor.com',
      TRULIA: 'trulia.com'
    };
  }

  /**
   * Parse property data from any supported site
   * @param {string} url - Property URL
   * @returns {Promise<Object>} Parsed property data
   */
  async parsePropertyFromUrl(url) {
    try {
      const site = this.identifySite(url);
      if (!site) {
        throw new Error('Unsupported website');
      }

      // In a Chrome extension, we'll use content scripts to extract data
      // For now, we'll simulate the extraction
      return await this.extractPropertyData(url, site);
    } catch (error) {
      console.error('Error parsing property:', error);
      return this.getEmptyProperty(url);
    }
  }

  /**
   * Identify which real estate site the URL belongs to
   * @param {string} url - Property URL
   * @returns {string|null} Site identifier
   */
  identifySite(url) {
    const domain = new URL(url).hostname.toLowerCase();
    
    if (domain.includes(this.SUPPORTED_SITES.ZILLOW)) return this.SUPPORTED_SITES.ZILLOW;
    if (domain.includes(this.SUPPORTED_SITES.REDFIN)) return this.SUPPORTED_SITES.REDFIN;
    if (domain.includes(this.SUPPORTED_SITES.REALTOR)) return this.SUPPORTED_SITES.REALTOR;
    if (domain.includes(this.SUPPORTED_SITES.TRULIA)) return this.SUPPORTED_SITES.TRULIA;
    
    return null;
  }

  /**
   * Extract property data based on the site
   * @param {string} url - Property URL
   * @param {string} site - Site identifier
   * @returns {Promise<Object>} Property data
   */
  async extractPropertyData(url, site) {
    switch (site) {
      case this.SUPPORTED_SITES.ZILLOW:
        return this.parseZillowProperty(url);
      case this.SUPPORTED_SITES.REDFIN:
        return this.parseRedfinProperty(url);
      case this.SUPPORTED_SITES.REALTOR:
        return this.parseRealtorProperty(url);
      case this.SUPPORTED_SITES.TRULIA:
        return this.parseTruliaProperty(url);
      default:
        return this.parseGenericProperty(url);
    }
  }

  /**
   * Parse Zillow property data
   * @param {string} url - Zillow property URL
   * @returns {Promise<Object>} Property data
   */
  async parseZillowProperty(url) {
    // This will be implemented in the content script
    // For now, return a template structure
    return {
      url: url,
      site: 'Zillow',
      address: '',
      price: 0,
      beds: 0,
      baths: 0,
      sqft: 0,
      lotSize: 0,
      yearBuilt: null,
      propertyType: '',
      description: '',
      taxes: 0,
      hoa: 0,
      pricePerSqft: 0,
      daysOnMarket: 0,
      mlsNumber: '',
      images: [],
      coordinates: { lat: 0, lng: 0 },
      neighborhood: '',
      schools: [],
      walkScore: 0,
      transitScore: 0,
      bikeScore: 0,
      amenities: [],
      listingAgent: {
        name: '',
        phone: '',
        email: ''
      },
      zestimate: 0,
      rentZestimate: 0,
      priceHistory: [],
      nearbyComps: []
    };
  }

  /**
   * Parse Redfin property data
   * @param {string} url - Redfin property URL
   * @returns {Promise<Object>} Property data
   */
  async parseRedfinProperty(url) {
    return {
      url: url,
      site: 'Redfin',
      address: '',
      price: 0,
      beds: 0,
      baths: 0,
      sqft: 0,
      lotSize: 0,
      yearBuilt: null,
      propertyType: '',
      description: '',
      taxes: 0,
      hoa: 0,
      pricePerSqft: 0,
      daysOnMarket: 0,
      mlsNumber: '',
      images: [],
      coordinates: { lat: 0, lng: 0 },
      neighborhood: '',
      schools: [],
      walkScore: 0,
      transitScore: 0,
      bikeScore: 0,
      amenities: [],
      listingAgent: {
        name: '',
        phone: '',
        email: ''
      },
      redfinEstimate: 0,
      rentEstimate: 0,
      priceHistory: [],
      nearbyComps: []
    };
  }

  /**
   * Parse Realtor.com property data
   * @param {string} url - Realtor.com property URL
   * @returns {Promise<Object>} Property data
   */
  async parseRealtorProperty(url) {
    return {
      url: url,
      site: 'Realtor.com',
      address: '',
      price: 0,
      beds: 0,
      baths: 0,
      sqft: 0,
      lotSize: 0,
      yearBuilt: null,
      propertyType: '',
      description: '',
      taxes: 0,
      hoa: 0,
      pricePerSqft: 0,
      daysOnMarket: 0,
      mlsNumber: '',
      images: [],
      coordinates: { lat: 0, lng: 0 },
      neighborhood: '',
      schools: [],
      walkScore: 0,
      transitScore: 0,
      bikeScore: 0,
      amenities: [],
      listingAgent: {
        name: '',
        phone: '',
        email: ''
      },
      estimatedValue: 0,
      rentEstimate: 0,
      priceHistory: [],
      nearbyComps: []
    };
  }

  /**
   * Parse Trulia property data
   * @param {string} url - Trulia property URL
   * @returns {Promise<Object>} Property data
   */
  async parseTruliaProperty(url) {
    return {
      url: url,
      site: 'Trulia',
      address: '',
      price: 0,
      beds: 0,
      baths: 0,
      sqft: 0,
      lotSize: 0,
      yearBuilt: null,
      propertyType: '',
      description: '',
      taxes: 0,
      hoa: 0,
      pricePerSqft: 0,
      daysOnMarket: 0,
      mlsNumber: '',
      images: [],
      coordinates: { lat: 0, lng: 0 },
      neighborhood: '',
      schools: [],
      walkScore: 0,
      transitScore: 0,
      bikeScore: 0,
      amenities: [],
      listingAgent: {
        name: '',
        phone: '',
        email: ''
      },
      estimatedValue: 0,
      rentEstimate: 0,
      priceHistory: [],
      nearbyComps: [],
      crimeData: {},
      localInsights: {}
    };
  }

  /**
   * Parse property from unsupported/generic sites
   * @param {string} url - Property URL
   * @returns {Promise<Object>} Basic property data
   */
  async parseGenericProperty(url) {
    return {
      url: url,
      site: 'Other',
      address: '',
      price: 0,
      beds: 0,
      baths: 0,
      sqft: 0,
      description: '',
      images: []
    };
  }

  /**
   * Get empty property template
   * @param {string} url - Property URL
   * @returns {Object} Empty property structure
   */
  getEmptyProperty(url) {
    return {
      id: null,
      url: url,
      site: 'Unknown',
      address: '',
      price: 0,
      beds: 0,
      baths: 0,
      sqft: 0,
      description: '',
      images: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      folder: 'default',
      notes: '',
      tags: [],
      analysis: null
    };
  }

  /**
   * Validate parsed property data
   * @param {Object} property - Property data to validate
   * @returns {Object} Validation result
   */
  validatePropertyData(property) {
    const errors = [];
    const warnings = [];

    // Required fields
    if (!property.url) errors.push('URL is required');
    if (!property.address) warnings.push('Address not found');
    if (!property.price || property.price <= 0) warnings.push('Price not found or invalid');
    if (!property.beds || property.beds < 0) warnings.push('Bedroom count not found');
    if (!property.baths || property.baths < 0) warnings.push('Bathroom count not found');
    if (!property.sqft || property.sqft <= 0) warnings.push('Square footage not found');

    // Data validation
    if (property.price > 10000000) warnings.push('Price seems unusually high');
    if (property.beds > 20) warnings.push('Bedroom count seems unusually high');
    if (property.sqft > 20000) warnings.push('Square footage seems unusually high');

    return {
      isValid: errors.length === 0,
      errors: errors,
      warnings: warnings
    };
  }

  /**
   * Clean and normalize property data
   * @param {Object} property - Raw property data
   * @returns {Object} Cleaned property data
   */
  cleanPropertyData(property) {
    const cleaned = { ...property };

    // Clean numeric values
    cleaned.price = this.parseNumeric(cleaned.price);
    cleaned.beds = this.parseNumeric(cleaned.beds);
    cleaned.baths = this.parseNumeric(cleaned.baths);
    cleaned.sqft = this.parseNumeric(cleaned.sqft);
    cleaned.taxes = this.parseNumeric(cleaned.taxes);
    cleaned.hoa = this.parseNumeric(cleaned.hoa);
    cleaned.yearBuilt = this.parseNumeric(cleaned.yearBuilt);

    // Clean strings
    cleaned.address = this.cleanString(cleaned.address);
    cleaned.description = this.cleanString(cleaned.description);
    cleaned.neighborhood = this.cleanString(cleaned.neighborhood);

    // Calculate derived values
    if (cleaned.price > 0 && cleaned.sqft > 0) {
      cleaned.pricePerSqft = Math.round((cleaned.price / cleaned.sqft) * 100) / 100;
    }

    // Add timestamps if missing
    if (!cleaned.createdAt) cleaned.createdAt = new Date().toISOString();
    if (!cleaned.updatedAt) cleaned.updatedAt = new Date().toISOString();

    return cleaned;
  }

  /**
   * Parse numeric value from string or number
   * @param {any} value - Value to parse
   * @returns {number} Parsed number or 0
   */
  parseNumeric(value) {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      // Remove common non-numeric characters
      const cleaned = value.replace(/[$,\s]/g, '');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }

  /**
   * Clean string value
   * @param {string} value - String to clean
   * @returns {string} Cleaned string
   */
  cleanString(value) {
    if (typeof value !== 'string') return '';
    return value.trim().replace(/\s+/g, ' ');
  }

  /**
   * Extract coordinates from address or map data
   * @param {string} address - Property address
   * @returns {Promise<Object>} Coordinates {lat, lng}
   */
  async extractCoordinates(address) {
    // In a real implementation, this would use a geocoding API
    // For now, return placeholder coordinates
    return { lat: 0, lng: 0 };
  }

  /**
   * Extract image URLs from property page
   * @param {Document} doc - Page document
   * @param {string} site - Site identifier
   * @returns {Array} Array of image URLs
   */
  extractImages(doc, site) {
    const images = [];
    let selectors = [];

    switch (site) {
      case this.SUPPORTED_SITES.ZILLOW:
        selectors = ['.media-stream img', '.hdp-photo img', '.photo-carousel img'];
        break;
      case this.SUPPORTED_SITES.REDFIN:
        selectors = ['.photo-carousel img', '.bp-Carousel img'];
        break;
      case this.SUPPORTED_SITES.REALTOR:
        selectors = ['.photo-list img', '.carousel img'];
        break;
      case this.SUPPORTED_SITES.TRULIA:
        selectors = ['.media-stream img', '.photo-carousel img'];
        break;
    }

    selectors.forEach(selector => {
      const imgElements = doc.querySelectorAll(selector);
      imgElements.forEach(img => {
        if (img.src && !images.includes(img.src)) {
          images.push(img.src);
        }
      });
    });

    return images.slice(0, 20); // Limit to 20 images
  }
}

// Note: Instance will be created in background script for service worker compatibility
