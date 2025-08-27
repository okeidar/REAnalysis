# Context
The Chrome extension currently has two main prompts: a dynamic prompt that adapts based on user column selection, and a custom prompt that users can configure. We need to implement a third specialized prompt specifically designed for extracting tabular data with a comprehensive set of columns that will assist with real estate analysis. This third prompt will focus on extracting raw data from ChatGPT analysis output and include additional calculated metrics for enhanced property comparison and investment decision-making.

# Requirements
- **Comprehensive Tabular Data Extraction**: Extract structured data in a format suitable for spreadsheet analysis
- **Raw Data Capture**: Include all raw property data from ChatGPT analysis (price, bedrooms, bathrooms, etc.)
- **Calculated Metrics**: Include additional calculated fields for investment analysis
- **Standardized Format**: Ensure consistent data format for easy comparison and analysis
- **Investment-Focused Columns**: Include columns specifically designed for real estate investment analysis
- **Market Analysis Data**: Capture location and market-specific information
- **Risk Assessment Metrics**: Include columns for identifying potential risks and red flags
- **Performance Indicators**: Include calculated performance metrics for property comparison

# Research Tasks
- [ ] Analyze current prompt structure and data extraction patterns
- [ ] Research standard real estate investment analysis columns
- [ ] Study ChatGPT response patterns for structured data extraction
- [ ] Identify optimal column structure for property comparison
- [ ] Research calculated metrics formulas for real estate investment
- [ ] Analyze market data requirements for comprehensive analysis
- [ ] Study risk assessment frameworks for real estate investment

# Implementation Tasks

## Third Prompt: Tabular Data Extraction Prompt
- [ ] **Prompt Structure Design**
  - [ ] Create specialized prompt for tabular data extraction
  - [ ] Include specific formatting requirements for consistent output
  - [ ] Add data validation instructions for accuracy
  - [ ] Include fallback instructions for missing data
  - [ ] Add calculation instructions for derived metrics

- [ ] **Column Definition System**
  - [ ] Define comprehensive column set for real estate analysis
  - [ ] Include raw data columns from ChatGPT analysis
  - [ ] Add calculated metric columns with formulas
  - [ ] Include market analysis columns
  - [ ] Add risk assessment columns
  - [ ] Include performance indicator columns

- [ ] **Data Extraction Instructions**
  - [ ] Specify exact data extraction patterns
  - [ ] Include data type requirements for each column
  - [ ] Add validation rules for data accuracy
  - [ ] Include unit conversion instructions
  - [ ] Add currency formatting requirements

- [ ] **Calculation Instructions**
  - [ ] Define formulas for calculated metrics
  - [ ] Include step-by-step calculation instructions
  - [ ] Add validation checks for calculated values
  - [ ] Include range validation for reasonable values
  - [ ] Add error handling for missing input data

## Comprehensive Column Set Definition

### Raw Data Columns (From ChatGPT Analysis)
```javascript
const RAW_DATA_COLUMNS = [
  // Basic Property Information
  { id: 'propertyAddress', name: 'Property Address', type: 'text', source: 'chatgpt_raw', required: true },
  { id: 'askingPrice', name: 'Asking Price', type: 'currency', source: 'chatgpt_raw', required: true },
  { id: 'propertyType', name: 'Property Type', type: 'text', source: 'chatgpt_raw', required: true },
  { id: 'bedrooms', name: 'Bedrooms', type: 'number', source: 'chatgpt_raw', required: true },
  { id: 'bathrooms', name: 'Bathrooms', type: 'number', source: 'chatgpt_raw', required: true },
  { id: 'squareFootage', name: 'Square Footage', type: 'number', source: 'chatgpt_raw', required: false },
  { id: 'yearBuilt', name: 'Year Built', type: 'number', source: 'chatgpt_raw', required: false },
  { id: 'lotSize', name: 'Lot Size (sq ft)', type: 'number', source: 'chatgpt_raw', required: false },
  { id: 'neighborhood', name: 'Neighborhood', type: 'text', source: 'chatgpt_raw', required: false },
  { id: 'city', name: 'City', type: 'text', source: 'chatgpt_raw', required: true },
  { id: 'state', name: 'State', type: 'text', source: 'chatgpt_raw', required: true },
  { id: 'zipCode', name: 'ZIP Code', type: 'text', source: 'chatgpt_raw', required: false },
  
  // Market Data
  { id: 'estimatedRent', name: 'Estimated Monthly Rent', type: 'currency', source: 'chatgpt_analysis', required: false },
  { id: 'locationScore', name: 'Location Score (1-10)', type: 'number', source: 'chatgpt_analysis', required: false },
  { id: 'marketTrend', name: 'Market Trend', type: 'text', source: 'chatgpt_analysis', required: false },
  { id: 'daysOnMarket', name: 'Days on Market', type: 'number', source: 'chatgpt_raw', required: false },
  { id: 'priceHistory', name: 'Price History', type: 'text', source: 'chatgpt_raw', required: false },
  
  // Property Features
  { id: 'parkingSpaces', name: 'Parking Spaces', type: 'number', source: 'chatgpt_raw', required: false },
  { id: 'garageType', name: 'Garage Type', type: 'text', source: 'chatgpt_raw', required: false },
  { id: 'heatingType', name: 'Heating Type', type: 'text', source: 'chatgpt_raw', required: false },
  { id: 'coolingType', name: 'Cooling Type', type: 'text', source: 'chatgpt_raw', required: false },
  { id: 'appliances', name: 'Appliances Included', type: 'text', source: 'chatgpt_raw', required: false },
  { id: 'amenities', name: 'Amenities', type: 'text', source: 'chatgpt_raw', required: false },
  
  // Analysis Data
  { id: 'pros', name: 'Key Advantages', type: 'text', source: 'chatgpt_analysis', required: false },
  { id: 'cons', name: 'Key Concerns', type: 'text', source: 'chatgpt_analysis', required: false },
  { id: 'redFlags', name: 'Red Flags', type: 'text', source: 'chatgpt_analysis', required: false },
  { id: 'investmentGrade', name: 'Investment Grade', type: 'text', source: 'chatgpt_analysis', required: false },
  { id: 'rentalPotential', name: 'Rental Potential', type: 'text', source: 'chatgpt_analysis', required: false },
  { id: 'appreciationPotential', name: 'Appreciation Potential', type: 'text', source: 'chatgpt_analysis', required: false }
];
```

### Calculated Metrics Columns
```javascript
const CALCULATED_METRICS_COLUMNS = [
  // Basic Calculations
  { id: 'pricePerSqFt', name: 'Price per Sq Ft', type: 'currency', formula: 'askingPrice / squareFootage', required: false },
  { id: 'rentPerSqFt', name: 'Rent per Sq Ft', type: 'currency', formula: 'estimatedRent / squareFootage', required: false },
  { id: 'propertyAge', name: 'Property Age (Years)', type: 'number', formula: 'currentYear - yearBuilt', required: false },
  { id: 'bedroomRatio', name: 'Bedroom Ratio', type: 'number', formula: 'bedrooms / (bedrooms + bathrooms)', required: false },
  
  // Investment Metrics
  { id: 'grossRentMultiplier', name: 'Gross Rent Multiplier', type: 'number', formula: 'askingPrice / (estimatedRent * 12)', required: false },
  { id: 'capRate', name: 'Cap Rate (%)', type: 'percentage', formula: '(estimatedRent * 12) / askingPrice * 100', required: false },
  { id: 'onePercentRule', name: '1% Rule Ratio', type: 'percentage', formula: 'estimatedRent / askingPrice * 100', required: false },
  { id: 'priceToRentRatio', name: 'Price-to-Rent Ratio', type: 'number', formula: 'askingPrice / (estimatedRent * 12)', required: false },
  
  // Cash Flow Analysis
  { id: 'monthlyCashFlow', name: 'Monthly Cash Flow', type: 'currency', formula: 'estimatedRent - monthlyExpenses', required: false },
  { id: 'annualCashFlow', name: 'Annual Cash Flow', type: 'currency', formula: 'monthlyCashFlow * 12', required: false },
  { id: 'cashOnCashReturn', name: 'Cash-on-Cash Return (%)', type: 'percentage', formula: 'annualCashFlow / downPayment * 100', required: false },
  { id: 'returnOnInvestment', name: 'ROI (%)', type: 'percentage', formula: '(annualCashFlow + appreciation) / totalInvestment * 100', required: false },
  
  // Risk Metrics
  { id: 'vacancyRisk', name: 'Vacancy Risk Score', type: 'number', formula: 'calculateVacancyRisk()', required: false },
  { id: 'maintenanceRisk', name: 'Maintenance Risk Score', type: 'number', formula: 'calculateMaintenanceRisk()', required: false },
  { id: 'marketRisk', name: 'Market Risk Score', type: 'number', formula: 'calculateMarketRisk()', required: false },
  { id: 'overallRiskScore', name: 'Overall Risk Score', type: 'number', formula: '(vacancyRisk + maintenanceRisk + marketRisk) / 3', required: false },
  
  // Market Analysis
  { id: 'marketValueRatio', name: 'Market Value Ratio', type: 'number', formula: 'askingPrice / estimatedMarketValue', required: false },
  { id: 'daysOnMarketScore', name: 'Days on Market Score', type: 'number', formula: 'calculateDOMScore()', required: false },
  { id: 'priceTrendScore', name: 'Price Trend Score', type: 'number', formula: 'calculatePriceTrendScore()', required: false },
  { id: 'locationPremium', name: 'Location Premium (%)', type: 'percentage', formula: '(locationScore - 5) * 2', required: false }
];
```

### Market Analysis Columns
```javascript
const MARKET_ANALYSIS_COLUMNS = [
  // Market Data
  { id: 'marketType', name: 'Market Type', type: 'text', source: 'chatgpt_analysis', required: false },
  { id: 'marketCycle', name: 'Market Cycle', type: 'text', source: 'chatgpt_analysis', required: false },
  { id: 'inventoryLevel', name: 'Inventory Level', type: 'text', source: 'chatgpt_analysis', required: false },
  { id: 'demandLevel', name: 'Demand Level', type: 'text', source: 'chatgpt_analysis', required: false },
  
  // Economic Indicators
  { id: 'jobGrowth', name: 'Job Growth Rate', type: 'percentage', source: 'chatgpt_analysis', required: false },
  { id: 'populationGrowth', name: 'Population Growth Rate', type: 'percentage', source: 'chatgpt_analysis', required: false },
  { id: 'incomeGrowth', name: 'Income Growth Rate', type: 'percentage', source: 'chatgpt_analysis', required: false },
  { id: 'unemploymentRate', name: 'Unemployment Rate', type: 'percentage', source: 'chatgpt_analysis', required: false },
  
  // Development Indicators
  { id: 'newConstruction', name: 'New Construction Level', type: 'text', source: 'chatgpt_analysis', required: false },
  { id: 'infrastructureDevelopment', name: 'Infrastructure Development', type: 'text', source: 'chatgpt_analysis', required: false },
  { id: 'commercialDevelopment', name: 'Commercial Development', type: 'text', source: 'chatgpt_analysis', required: false },
  { id: 'schoolQuality', name: 'School Quality Rating', type: 'number', source: 'chatgpt_analysis', required: false }
];
```

## Third Prompt Template
```javascript
const TABULAR_DATA_EXTRACTION_PROMPT = `You are a professional real estate data analyst specializing in extracting structured property data for investment analysis. Please analyze the provided property listing and extract the following data points in a structured format suitable for spreadsheet analysis.

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

**OUTPUT FORMAT:**
Please provide your analysis in the following structured format:

**PROPERTY DATA SUMMARY:**
[Extract all requested data points with clear labels]

**CALCULATED METRICS:**
[Provide all calculated metrics with formulas shown]

**RISK ASSESSMENT:**
[Provide risk scores with justification]

**MARKET ANALYSIS:**
[Provide market analysis data with supporting information]

**INVESTMENT RECOMMENDATION:**
[Overall investment assessment with key factors]

Property Link: {PROPERTY_URL}
Analysis Date: {DATE}

Focus on data accuracy and provide specific, measurable values that can be used for property comparison and investment decision-making.`;
```

## Implementation Strategy

### Prompt Integration
- [ ] **Add Third Prompt Option**
  - [ ] Create new prompt type in the UI
  - [ ] Add prompt selection dropdown
  - [ ] Include prompt preview functionality
  - [ ] Add prompt customization options
  - [ ] Include prompt performance tracking

- [ ] **Dynamic Column Generation**
  - [ ] Generate columns based on prompt type
  - [ ] Include calculated metric columns
  - [ ] Add market analysis columns
  - [ ] Include risk assessment columns
  - [ ] Add performance indicator columns

- [ ] **Data Processing Pipeline**
  - [ ] Extract raw data from ChatGPT response
  - [ ] Calculate derived metrics
  - [ ] Validate data accuracy
  - [ ] Format data for export
  - [ ] Include data confidence scores

### UI Enhancements
- [ ] **Prompt Selection Interface**
  - [ ] Add prompt type selector
  - [ ] Include prompt descriptions
  - [ ] Add prompt preview modal
  - [ ] Include prompt performance metrics
  - [ ] Add prompt customization options

- [ ] **Column Management**
  - [ ] Dynamic column generation based on prompt
  - [ ] Calculated metric column display
  - [ ] Column validation indicators
  - [ ] Column grouping by category
  - [ ] Column export selection

- [ ] **Data Display**
  - [ ] Enhanced property cards with calculated metrics
  - [ ] Risk assessment visualization
  - [ ] Market analysis charts
  - [ ] Performance indicator dashboard
  - [ ] Comparison table with all metrics

### Export Enhancement
- [ ] **Comprehensive Data Export**
  - [ ] Include all raw data columns
  - [ ] Include all calculated metrics
  - [ ] Include market analysis data
  - [ ] Include risk assessment scores
  - [ ] Include performance indicators

- [ ] **Multiple Export Formats**
  - [ ] Excel export with multiple sheets
  - [ ] CSV export with all columns
  - [ ] JSON export for API integration
  - [ ] PDF report with charts
  - [ ] Summary dashboard export

- [ ] **Export Customization**
  - [ ] Column selection for export
  - [ ] Data filtering options
  - [ ] Format customization
  - [ ] Template selection
  - [ ] Automated export scheduling

## Success Criteria
- [ ] Third prompt successfully extracts comprehensive tabular data
- [ ] All raw data columns are accurately populated
- [ ] Calculated metrics are correctly computed
- [ ] Market analysis data is included
- [ ] Risk assessment scores are provided
- [ ] Performance indicators are calculated
- [ ] Data format is consistent and export-ready
- [ ] UI clearly displays all extracted data
- [ ] Export includes all requested columns
- [ ] Prompt performance is tracked and optimized
- [ ] Users can effectively compare properties using all metrics
- [ ] Data validation ensures accuracy and completeness
- [ ] Fallback extraction handles missing data gracefully
- [ ] Performance is maintained with enhanced data processing
- [ ] Export preview shows exactly what data will be included

## Technical Notes
- Third prompt focuses on structured data extraction for spreadsheet analysis
- Calculated metrics follow standard real estate investment formulas
- Risk assessment uses industry-standard scoring methods
- Market analysis includes comprehensive economic indicators
- Data validation ensures reliability of extracted information
- Performance optimizations maintain extension responsiveness
- Export functionality supports multiple formats and customization
- Column management dynamically adapts to prompt selection
- Data confidence scoring indicates reliability of extracted information
- Fallback extraction methods handle incomplete or missing data
- Real-time calculation engine processes derived metrics
- Market data integration provides comprehensive analysis context

# Status: 📋 PLANNED
The third prompt for tabular data extraction is being designed and planned. This comprehensive prompt will extract raw property data, calculate investment metrics, assess risks, and provide market analysis in a structured format suitable for spreadsheet analysis and property comparison.

# Next Steps
1. Implement the third prompt template
2. Create dynamic column generation system
3. Develop calculated metrics engine
4. Build risk assessment framework
5. Integrate market analysis data
6. Enhance UI for prompt selection
7. Implement comprehensive export functionality
8. Add data validation and confidence scoring
9. Test and optimize prompt performance
10. Deploy and monitor user feedback
