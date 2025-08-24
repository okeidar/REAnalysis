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
