// Content script for ChatGPT Helper Extension
console.log('ChatGPT Helper Extension loaded on:', window.location.href);

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
      console.warn('⚠️ Extension context invalidated, skipping chrome API call');
      return Promise.resolve(fallbackValue);
    }
    return apiCall();
  } catch (err) {
    if (err && (err.message && err.message.includes('Extension context invalidated') || 
               err.message && err.message.includes('Unexpected token'))) {
      console.warn('⚠️ Extension context invalidated during API call:', err.message);
      return Promise.resolve(fallbackValue);
    }
    console.error('Chrome API call failed:', err);
    throw err;
  }
}

// Global variable to track current property analysis
let currentPropertyAnalysis = null;

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

// Prompt splitting utility functions
function shouldSplitPrompt(prompt) {
  return promptSplittingState.enabled && 
         prompt.length > promptSplittingState.lengthThreshold;
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
    
    if (keywordMatches >= 2) {
      // Add null check for currentPropertyAnalysis
      if (!currentPropertyAnalysis) {
        console.log('⚠️ No active property analysis session, but detected property keywords');
        console.log('🔍 This might be a response from prompt splitting or a different analysis');
        console.log('🔍 Response preview:', messageText.substring(0, 500) + '...');
        
        // If we're in prompt splitting mode, this could be the analysis response
        if (promptSplittingState.currentPhase === 'complete' || 
            promptSplittingState.currentPhase === 'sending_link') {
          console.log('📝 Processing response from prompt splitting flow...');
          
          const analysisData = extractPropertyAnalysisData(messageText);
          if (analysisData && Object.keys(analysisData.extractedData).length > 0 && 
              promptSplittingState.pendingPropertyLink) {
            
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
      
      console.log('✅ Detected completed property analysis response for:', currentPropertyAnalysis.url);
      console.log('🔍 Session ID:', currentPropertyAnalysis.sessionId);
      console.log('🎯 Keywords matched:', keywordMatches, '/', propertyKeywords.length);
      const analysisData = extractPropertyAnalysisData(messageText);
      
      if (analysisData && Object.keys(analysisData.extractedData).length > 0) {
        console.log('✅ Successfully extracted analysis data for:', currentPropertyAnalysis.url);
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
            }
          }
        }).catch(err => {
          console.error('❌ Failed to send analysis data:', err);
        });
        
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
        console.log('🔍 Found message while waiting for confirmation:', messageText.substring(0, 100));
        processCompletedResponse(messageText, currentUrl);
        return; // Don't process as regular property analysis
      }
      
      // Only process if we have an active property analysis session
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
  const intervalId = setInterval(checkForNewMessages, 500);
  
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

// Function to find ChatGPT input field with more comprehensive selectors
function findChatGPTInput() {
  console.log('Searching for ChatGPT input field...');
  
  // Try different selectors for ChatGPT input (updated for 2024)
  const selectors = [
    // Most common current selectors
    'textarea[placeholder*="Message"]',
    'textarea[placeholder*="message"]',
    'div[contenteditable="true"][data-testid*="composer"]',
    'div[contenteditable="true"][role="textbox"]',
    'textarea[data-testid="composer-text-input"]',
    
    // Fallback selectors
    'textarea[data-id="root"]',
    'div[contenteditable="true"]',
    '#prompt-textarea',
    'textarea',
    
    // Try by class patterns
    'textarea[class*="composer"]',
    'textarea[class*="input"]',
    'div[class*="composer"][contenteditable="true"]',
    'div[class*="input"][contenteditable="true"]'
  ];
  
  for (const selector of selectors) {
    try {
      const elements = document.querySelectorAll(selector);
      console.log(`Found ${elements.length} elements for selector: ${selector}`);
      
      for (const element of elements) {
        // Check if element is visible and not disabled
        if (element.offsetParent !== null && 
            !element.disabled && 
            !element.readOnly &&
            element.style.display !== 'none') {
          
          console.log('Found suitable input element:', element);
          return element;
        }
      }
    } catch (e) {
      console.log(`Error with selector ${selector}:`, e);
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
  
  // Track this property analysis with enhanced metadata
  currentPropertyAnalysis = {
    url: propertyLink,
    timestamp: Date.now(),
    sessionId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  };
  
  console.log('🎯 New property analysis session started:', currentPropertyAnalysis.sessionId);
  
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
  
  if (analysisData && Object.keys(analysisData.extractedData).length > 0) {
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