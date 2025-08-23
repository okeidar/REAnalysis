# Context
The Chrome extension needs enhanced data extraction capabilities to pull comprehensive property information from ChatGPT responses and organize it clearly for users. The extension should extract structured data from ChatGPT's property analysis responses and present it in an organized format both in the extension UI and in exported Excel files. Users should be able to compare properties using popular real estate investment metrics.

# Requirements
- **Comprehensive Data Extraction**: Extract all relevant property data from ChatGPT responses
- **Structured Organization**: Organize data into logical categories (property details, financial metrics, location analysis, etc.)
- **Real Estate Investment Metrics**: Include standard investment metrics for property comparison
- **Clear UI Presentation**: Display extracted data in an organized, easy-to-read format
- **Excel Export Enhancement**: Ensure all extracted data is properly formatted for Excel export
- **Property Comparison**: Enable users to compare multiple properties using key metrics
- **Data Validation**: Ensure extracted data is accurate and properly formatted
- **Fallback Extraction**: Handle both structured and unstructured ChatGPT responses

# Research Tasks
- [ ] Analyze current data extraction patterns in content.js
- [ ] Research standard real estate investment metrics and formulas
- [ ] Study ChatGPT response patterns for property analysis
- [ ] Identify key data points needed for property comparison
- [ ] Research Excel export best practices for real estate data
- [ ] Analyze UI patterns for displaying complex property data
- [ ] Study data validation techniques for real estate information

# Implementation Tasks

## Enhanced Data Extraction Engine
- [ ] **Dynamic Prompt Generation**
  - [ ] Generate prompts based on user's enabled columns
  - [ ] Include only data extraction requests for selected columns
  - [ ] Adjust prompt structure based on column categories
  - [ ] Include custom column requirements in prompts
  - [ ] Maintain prompt efficiency by excluding unused data requests

- [ ] **Structured Section Extraction**
  - [ ] Extract PROPERTY DETAILS section with enhanced patterns
  - [ ] Extract LOCATION & NEIGHBORHOOD ANALYSIS section
  - [ ] Extract RENTAL INCOME ANALYSIS section
  - [ ] Extract INVESTMENT SUMMARY section
  - [ ] Handle fallback extraction for unstructured responses

- [ ] **Core Property Data Extraction**
  - [ ] Street name extraction with address parsing
  - [ ] Price extraction with currency handling
  - [ ] Bedrooms and bathrooms with half-bath support
  - [ ] Property type classification (House/Apartment focus)
  - [ ] Square footage with unit conversion
  - [ ] Year built with validation
  - [ ] Lot size extraction
  - [ ] Neighborhood/location identification

- [ ] **Financial Metrics Calculation**
  - [ ] Price per square foot calculation
  - [ ] Property age calculation
  - [ ] Estimated monthly rental income
  - [ ] Gross rent multiplier (GRM)
  - [ ] Cap rate estimation
  - [ ] Cash-on-cash return calculation
  - [ ] 1% rule assessment

- [ ] **Location & Market Analysis**
  - [ ] Location score extraction (X/10 format)
  - [ ] Rental growth potential assessment
  - [ ] Market analysis summary
  - [ ] Neighborhood safety indicators
  - [ ] Proximity to amenities scoring

- [ ] **Investment Analysis Data**
  - [ ] Pros and cons extraction
  - [ ] Red flags identification
  - [ ] Investment potential rating
  - [ ] Market value comparison
  - [ ] Risk assessment indicators

## UI Enhancement for Data Display
- [ ] **Property History Display**
  - [ ] Enhanced property cards with key metrics
  - [ ] Color-coded status indicators
  - [ ] Quick comparison view
  - [ ] Detailed analysis modal
  - [ ] Investment metrics dashboard

- [ ] **Data Organization**
  - [ ] Group data by categories (Property, Financial, Location, Investment)
  - [ ] Use icons and visual indicators
  - [ ] Implement collapsible sections
  - [ ] Add data validation indicators
  - [ ] Show confidence scores for extracted data

- [ ] **Column Configuration UI**
  - [ ] Drag-and-drop column reordering
  - [ ] Checkbox selection for enabled/disabled columns
  - [ ] Column category grouping (Core, Financial, Location, etc.)
  - [ ] Custom column creation interface
  - [ ] Column preview functionality
  - [ ] Export column selection preview
  - [ ] Automatic prompt updates when column configuration changes
  - [ ] Prompt preview showing what data will be requested

- [ ] **Comparison Features**
  - [ ] Side-by-side property comparison
  - [ ] Investment metrics comparison table
  - [ ] Visual charts and graphs
  - [ ] Ranking system for properties
  - [ ] Filter and sort capabilities

## Excel Export Enhancement
- [ ] **User-Selected Column Export**
  - [ ] Export only columns selected by user in extension UI
  - [ ] Respect column order as configured by user
  - [ ] Include custom columns added by user
  - [ ] Maintain column visibility settings
  - [ ] Export column descriptions as headers
  - [ ] Preview export columns before download
  - [ ] Save user's column preferences for future exports

- [ ] **Comprehensive Data Export**
  - [ ] All extracted property details (based on user selection)
  - [ ] Calculated investment metrics (based on user selection)
  - [ ] Location and market analysis (based on user selection)
  - [ ] Investment summary data (based on user selection)
  - [ ] Custom user-added data (based on user selection)

- [ ] **Excel Formatting**
  - [ ] Proper column headers matching user's column names
  - [ ] Data type formatting (currency, percentages, etc.)
  - [ ] Conditional formatting for key metrics
  - [ ] Multiple worksheet support
  - [ ] Summary statistics sheet

- [ ] **Investment Metrics Sheet**
  - [ ] Comparative analysis table
  - [ ] Key performance indicators
  - [ ] Risk assessment matrix
  - [ ] Investment ranking system
  - [ ] Market trend indicators

## Data Validation & Quality Assurance
- [ ] **Input Validation**
  - [ ] Price range validation
  - [ ] Bedroom/bathroom count validation
  - [ ] Square footage reasonableness check
  - [ ] Year built validation
  - [ ] Location data verification

- [ ] **Data Confidence Scoring**
  - [ ] Extraction confidence indicators
  - [ ] Data completeness scoring
  - [ ] Source reliability assessment
  - [ ] Manual override capabilities
  - [ ] Data correction interface

- [ ] **Error Handling**
  - [ ] Graceful handling of missing data
  - [ ] Fallback extraction methods
  - [ ] User notification of extraction issues
  - [ ] Manual data entry options
  - [ ] Data recovery mechanisms

## Real Estate Investment Metrics
- [ ] **Standard Metrics Implementation**
  - [ ] Price per square foot
  - [ ] Gross rent multiplier (GRM)
  - [ ] Cap rate calculation
  - [ ] Cash-on-cash return
  - [ ] 1% rule assessment
  - [ ] Price-to-rent ratio
  - [ ] Return on investment (ROI)

- [ ] **Advanced Metrics**
  - [ ] Internal rate of return (IRR)
  - [ ] Net operating income (NOI)
  - [ ] Debt service coverage ratio (DSCR)
  - [ ] Loan-to-value ratio (LTV)
  - [ ] Break-even analysis
  - [ ] Appreciation potential

- [ ] **Market Analysis Metrics**
  - [ ] Market value vs. asking price
  - [ ] Days on market analysis
  - [ ] Price trend indicators
  - [ ] Inventory levels assessment
  - [ ] Market cycle positioning

# Data Extraction Patterns

## Structured Response Patterns
```javascript
// PROPERTY DETAILS section extraction
const propertyDetailsPatterns = {
  streetName: [
    /(?:street|address)[:\s]*([^\n,]+(?:street|avenue|road|drive|lane|way|boulevard|place))/gi,
    /(?:located\s+at|address)[:\s]*([^\n,]+)/gi,
    /(\d+\s+[A-Za-z\s]+(?:street|avenue|road|drive|lane|way|boulevard|place))/gi
  ],
  price: [
    /(?:price|asking)[:\s]*\$?([\d,]+(?:\.\d{2})?)/gi,
    /\$\s*([\d,]+(?:\.\d{2})?)/g
  ],
  bedrooms: [
    /(?:bedroom)[s]?[:\s]*(\d+)/gi,
    /(\d+)[\s-]*(?:bed(?:room)?s?|br\b)/gi
  ],
  bathrooms: [
    /(?:bathroom)[s]?[:\s]*(\d+(?:\.\d+)?)/gi,
    /(\d+(?:\.\d+)?)[\s-]*(?:bath(?:room)?s?|ba\b)/gi
  ],
  squareFeet: [
    /(?:square\s+footage)[:\s]*([\d,]+)/gi,
    /([\d,]+)\s*(?:sq\.?\s*ft\.?|square\s*feet|sqft)/gi
  ],
  yearBuilt: [
    /(?:year\s+built)[:\s]*(\d{4})/gi,
    /(?:built)[:\s]*(\d{4})/gi
  ],
  propertyType: [
    /(?:property\s+type|type\s+of\s+property)[:\s]*([^\n,]+)/gi,
    /(?:type)[:\s]*(house|apartment|condo|townhouse|single\s+family|duplex)[^\n,]*/gi,
    /(?:this|the)\s+(house|apartment|condo|townhouse|single\s+family|duplex)/gi
  ]
};
```

## Investment Metrics Calculation
```javascript
// Key investment metrics calculations
const calculateInvestmentMetrics = (data) => {
  const price = parseFloat(data.price?.replace(/[$,]/g, '') || 0);
  const sqft = parseFloat(data.squareFeet?.replace(/[$,]/g, '') || 0);
  const monthlyRent = parseFloat(data.estimatedRentalIncome?.replace(/[$,]/g, '') || 0);
  const yearBuilt = parseInt(data.yearBuilt || 0);
  
  return {
    pricePerSqFt: sqft > 0 ? price / sqft : 0,
    grossRentMultiplier: monthlyRent > 0 ? price / (monthlyRent * 12) : 0,
    capRate: monthlyRent > 0 ? ((monthlyRent * 12) / price) * 100 : 0,
    propertyAge: yearBuilt > 0 ? new Date().getFullYear() - yearBuilt : 0,
    onePercentRule: monthlyRent > 0 ? (monthlyRent / price) * 100 : 0
  };
};
```

## Dynamic Prompt Generation
```javascript
// Generate prompts based on user's column selection
async function generateDynamicPrompt() {
  try {
    // Get user's column configuration
    const columnResult = await chrome.storage.local.get(['columnConfiguration']);
    const columnConfig = columnResult.columnConfiguration || DEFAULT_COLUMNS;
    
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
    return DEFAULT_PROMPT;
  }
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
    return DEFAULT_PROMPT;
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
```

# UI Components Design

## Property Card Component
```html
<div class="property-card">
  <div class="property-header">
    <h3 class="property-title">Property Details</h3>
    <div class="property-status ${analysisStatus}">
      ${hasAnalysis ? '✅ Analyzed' : '⏳ Pending'}
    </div>
  </div>
  
  <div class="property-metrics">
    <div class="metric-group core-metrics">
      <div class="metric">
        <span class="metric-label">Price:</span>
        <span class="metric-value">$${price}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Beds/Baths:</span>
        <span class="metric-value">${bedrooms}/${bathrooms}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Sq Ft:</span>
        <span class="metric-value">${squareFeet}</span>
      </div>
    </div>
    
    <div class="metric-group investment-metrics">
      <div class="metric">
        <span class="metric-label">Price/Sq Ft:</span>
        <span class="metric-value">$${pricePerSqFt}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Cap Rate:</span>
        <span class="metric-value">${capRate}%</span>
      </div>
      <div class="metric">
        <span class="metric-label">1% Rule:</span>
        <span class="metric-value ${onePercentRule >= 1 ? 'positive' : 'negative'}">${onePercentRule}%</span>
      </div>
    </div>
  </div>
  
  <div class="property-analysis">
    <div class="location-score">
      <span class="score-label">Location Score:</span>
      <span class="score-value">${locationScore}</span>
    </div>
    <div class="rental-potential">
      <span class="potential-label">Rental Growth:</span>
      <span class="potential-value ${growthPotentialClass}">${rentalGrowthPotential}</span>
    </div>
  </div>
</div>
```

## Comparison Table Component
```html
<div class="comparison-table">
  <table>
    <thead>
      <tr>
        <th>Property</th>
        <th>Price</th>
        <th>Price/Sq Ft</th>
        <th>Cap Rate</th>
        <th>1% Rule</th>
        <th>Location Score</th>
        <th>Investment Grade</th>
      </tr>
    </thead>
    <tbody>
      ${properties.map(prop => `
        <tr>
          <td>${prop.domain}</td>
          <td>$${prop.price}</td>
          <td>$${prop.pricePerSqFt}</td>
          <td>${prop.capRate}%</td>
          <td class="${prop.onePercentRule >= 1 ? 'positive' : 'negative'}">${prop.onePercentRule}%</td>
          <td>${prop.locationScore}</td>
          <td class="grade-${prop.investmentGrade}">${prop.investmentGrade}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
</div>
```

# Excel Export Structure

## User-Selected Column Export
The Excel export will dynamically generate columns based on the user's selection in the extension UI:

### Column Selection Process
1. **Load User Configuration**: Read column configuration from storage
2. **Filter Enabled Columns**: Only include columns marked as `enabled: true`
3. **Respect Column Order**: Maintain the order specified by user's drag-and-drop arrangement
4. **Include Custom Columns**: Add any custom columns created by the user
5. **Generate Headers**: Use column names as Excel headers
6. **Preview Before Export**: Show user which columns will be included

### Export Function Implementation
```javascript
async function exportPropertyHistory() {
  // Get user's column configuration
  const columnResult = await chrome.storage.local.get(['columnConfiguration']);
  const columnConfig = columnResult.columnConfiguration || DEFAULT_COLUMNS;
  
  // Filter to only enabled columns and sort by user-defined order
  const enabledColumns = columnConfig
    .filter(col => col.enabled)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  
  // Generate headers from user's column names
  const headers = enabledColumns.map(col => col.name);
  
  // Generate CSV rows with only selected columns
  const csvRows = history.map(item => {
    return enabledColumns.map(column => {
      return extractColumnValue(item, column);
    }).join(',');
  });
  
  // Create and download CSV with user's selected columns
  const csvContent = headers.join(',') + '\n' + csvRows.join('\n');
  // ... download logic
}
```

## Available Columns (User-Selectable)
| Column ID | Column Name | Data Source | Format | Description |
|-----------|-------------|-------------|--------|-------------|
| streetName | Street Name | extractedData.streetName | Text | Property street address |
| price | Property Price | extractedData.price | Currency | Asking price |
| bedrooms | Number of Bedrooms | extractedData.bedrooms | Number | Number of bedrooms |
| propertyType | Type of Property | extractedData.propertyType | Text | House/Apartment classification |
| bathrooms | Bathrooms | extractedData.bathrooms | Number | Number of bathrooms |
| squareFeet | Square Feet | extractedData.squareFeet | Number | Property size |
| yearBuilt | Year Built | extractedData.yearBuilt | Number | Construction year |
| pricePerSqFt | Price per Sq Ft | Calculated | Currency | Price/square footage |
| propertyAge | Property Age | Calculated | Number | Years since built |
| estimatedRentalIncome | Estimated Monthly Rent | extractedData.estimatedRentalIncome | Currency | Rental income potential |
| locationScore | Location Score | extractedData.locationScore | Text | X/10 format |
| rentalGrowthPotential | Rental Growth Potential | extractedData.rentalGrowthPotential | Text | Growth assessment |
| capRate | Cap Rate | Calculated | Percentage | Annual return rate |
| onePercentRule | 1% Rule | Calculated | Percentage | Monthly rent/price ratio |
| grossRentMultiplier | Gross Rent Multiplier | Calculated | Number | Price/annual rent ratio |
| investmentGrade | Investment Grade | Calculated | Text | A-F rating |
| address | Property URL | item.url | Text | Direct link to property |
| source | Source | item.domain | Text | Website source |
| analysisDate | Analysis Date | item.date | Date | Date of analysis |
| neighborhood | Neighborhood | extractedData.neighborhood | Text | Location name |
| pros | Top 3 Pros | extractedData.pros | Text | Key advantages |
| cons | Top 3 Cons | extractedData.cons | Text | Main concerns |
| redFlags | Red Flags | extractedData.redFlags | Text | Warning indicators |
| marketAnalysis | Market Analysis | extractedData.marketAnalysis | Text | Market assessment |
| investmentPotential | Investment Potential | extractedData.investmentPotential | Text | Investment summary |
| custom_* | Custom Columns | item.customColumns | Various | User-defined data |

## Default Export Configuration
The UI exported data will include only the following essential fields by default:
- **Street Name**: Property street address
- **Property Price**: Asking price
- **Number of Bedrooms**: Bedroom count
- **Type of Property**: House/Apartment classification

### Default Column Configuration
```javascript
const DEFAULT_COLUMNS = [
  // Core Property Information (Default Export Fields)
  { id: 'streetName', name: 'Street Name', description: 'Property street address', category: 'core', enabled: true, order: 1 },
  { id: 'price', name: 'Property Price', description: 'Property asking price', category: 'core', enabled: true, order: 2 },
  { id: 'bedrooms', name: 'Number of Bedrooms', description: 'Number of bedrooms', category: 'core', enabled: true, order: 3 },
  { id: 'propertyType', name: 'Type of Property', description: 'House/Apartment classification', category: 'core', enabled: true, order: 4 },
  
  // Additional Property Information (Disabled by Default)
  { id: 'bathrooms', name: 'Bathrooms', description: 'Number of bathrooms', category: 'core', enabled: false, order: 5 },
  { id: 'squareFeet', name: 'Square Footage', description: 'Property size in square feet', category: 'core', enabled: false, order: 6 },
  { id: 'yearBuilt', name: 'Year Built', description: 'Year the property was built', category: 'core', enabled: false, order: 7 },
  { id: 'neighborhood', name: 'Neighborhood', description: 'Property location/neighborhood name', category: 'metrics', enabled: false, order: 8 },
  
  // Financial Analysis (Disabled by Default)
  { id: 'estimatedRentalIncome', name: 'Estimated Monthly Rental Income', description: 'Estimated monthly rental income potential', category: 'financial', enabled: false, order: 9 },
  { id: 'pricePerSqFt', name: 'Price per Sq Ft', description: 'Calculated price per square foot', category: 'metrics', enabled: false, order: 10 },
  { id: 'capRate', name: 'Cap Rate', description: 'Annual return percentage', category: 'financial', enabled: false, order: 11 },
  { id: 'onePercentRule', name: '1% Rule', description: 'Monthly rent to price ratio', category: 'financial', enabled: false, order: 12 },
  { id: 'grossRentMultiplier', name: 'Gross Rent Multiplier', description: 'Price to annual rent ratio', category: 'financial', enabled: false, order: 13 },
  
  // Location & Scoring (Disabled by Default)
  { id: 'locationScore', name: 'Location Score', description: 'Location quality score (X/10)', category: 'scoring', enabled: false, order: 14 },
  { id: 'rentalGrowthPotential', name: 'Rental Growth Potential', description: 'Growth potential assessment', category: 'analysis', enabled: false, order: 15 },
  
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
```

## Investment Metrics Sheet
| Metric | Formula | Description |
|--------|---------|-------------|
| Price per Sq Ft | Price ÷ Square Feet | Cost per square foot |
| Cap Rate | (Annual Rent ÷ Price) × 100 | Annual return percentage |
| 1% Rule | (Monthly Rent ÷ Price) × 100 | Monthly rent to price ratio |
| Gross Rent Multiplier | Price ÷ Annual Rent | Years to pay off with rent |
| Property Age | Current Year - Year Built | Age in years |
| Cash-on-Cash Return | (Annual Cash Flow ÷ Down Payment) × 100 | Return on cash invested |

# Success Criteria
- [ ] All key property data is successfully extracted from ChatGPT responses
- [ ] Investment metrics are accurately calculated and displayed
- [ ] UI clearly presents organized property information
- [ ] Excel export matches user's column selection exactly
- [ ] Column configuration is saved and persists between sessions
- [ ] Prompt automatically adjusts based on user's column selection
- [ ] Users can effectively compare properties using investment metrics
- [ ] Data validation ensures accuracy and completeness
- [ ] Fallback extraction handles unstructured responses
- [ ] Performance is maintained with enhanced data processing
- [ ] Export preview shows exactly what columns will be included
- [ ] ChatGPT is only asked to extract data for selected columns
- [ ] Default export includes only: Street Name, Property Price, Number of Bedrooms, Type of Property
- [ ] Street name extraction accurately captures property addresses
- [ ] Property type classification focuses on House/Apartment distinction

# Status: 🔄 IN PROGRESS
The data extraction enhancement project is being planned and designed. The goal is to create a comprehensive system that extracts, organizes, and presents property analysis data in a user-friendly format with standard real estate investment metrics for effective property comparison and decision-making.

# Technical Notes
- Enhanced extraction patterns handle both structured and unstructured ChatGPT responses
- Investment metrics follow standard real estate industry calculations
- UI components are designed for clarity and comparison
- Excel export dynamically generates columns based on user's UI selection
- Column configuration is stored in chrome.storage.local for persistence
- Export function reads user's column preferences before generating CSV
- Dynamic prompt generation creates ChatGPT requests based on user's column selection
- Prompt automatically updates when column configuration changes
- Data validation ensures reliability of extracted information
- Performance optimizations maintain extension responsiveness
- Column selection UI provides real-time preview of export contents
- ChatGPT is only asked to extract data that will actually be used in exports
