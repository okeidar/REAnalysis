# Real Estate Data Extraction Prompt Instructions

## Objective
Extract real estate property data from web pages and present it in a clear, compact tabular format.

## Instructions

### Data Extraction Requirements
- Extract only the specified data points from the current web page
- Present data in a simple two-column table format
- Use clear, concise language
- Focus on accuracy over completeness

### Output Format
Present extracted data using this exact table structure:

```
Property Data | Value
Price | [extracted price]
Location | [extracted location]
Estimated Rent | [extracted rent amount]
Number of Rooms | [extracted room count]
```

### Extraction Guidelines
- **Price**: Look for purchase price, listing price, or asking price
- **Location**: Extract full address or neighborhood/area name
- **Estimated Rent**: Find rental income estimates or market rent values
- **Number of Rooms**: Count bedrooms, total rooms, or room specifications

### Response Format
- Use markdown table syntax
- If a data point is not found, use "Not specified" as the value
- Keep responses brief and focused
- Do not include explanations or additional commentary

### Example Output
```
Property Data | Value
Price | $450,000
Location | 123 Main Street, Downtown
Estimated Rent | $2,500/month
Number of Rooms | 3 bedrooms, 2 bathrooms
```

## Notes
- Prioritize accuracy over speed
- If multiple values exist for the same data point, use the most prominent or recent one
- Maintain consistency in formatting and terminology
