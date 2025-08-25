// Test script for property data extraction
// This can be run in the browser console to test the extraction logic

// Sample ChatGPT response for testing
const sampleResponse = `**PROPERTY DETAILS:**
- Address: 123 Main Street, Anytown, USA
- Property Price: $450,000
- Bedrooms: 3
- Bathrooms: 2.5
- Square Footage: 1,850 sq ft
- Year Built: 2015
- Property Type: Single Family Home

**FINANCIAL ANALYSIS:**
- Estimated Monthly Rental Income: $2,800
- Location Score: 8/10
- Rental Growth Potential: Growth: Strong

**LOCATION & NEIGHBORHOOD ANALYSIS:**
This property is located in a desirable suburban neighborhood with excellent schools nearby. The location scores 8/10 due to its proximity to shopping centers, good schools, and easy access to major highways. The area is safe with low crime rates and features well-maintained parks and recreational facilities.

**RENTAL INCOME ANALYSIS:**
Based on comparable rentals in the area, this property should generate approximately $2,800 per month in rental income. The rental market in this area shows strong growth potential due to ongoing economic development and population growth.

**INVESTMENT SUMMARY:**
Overall, this is a solid investment opportunity with good rental potential and appreciation prospects.

Pros:
1. Excellent location with top-rated schools
2. Strong rental demand in the area
3. Well-maintained property with modern amenities

Cons:
1. Higher property taxes due to good school district
2. Competition from new construction nearby
3. HOA fees of $150/month

No major red flags identified. The asking price appears fair compared to recent sales in the area.`;

// Test extraction function
function testExtraction() {
  console.log('🧪 Testing property data extraction...');
  console.log('📝 Sample response length:', sampleResponse.length);
  
  // Test streetName extraction
  console.log('\n🏠 Testing street name extraction:');
  const streetPatterns = [
    /(?:address|street\s+name|property\s+address)[:\s-]*([^\n,;]{5,80})/gi,
    /(?:located\s+at|situated\s+at)[:\s-]*([^\n,;]{5,80})/gi,
    /(\d+\s+[A-Za-z][A-Za-z\s]{2,40}(?:street|avenue|road|drive|lane|way|boulevard|place|court|circle|st|ave|rd|dr|ln|blvd|pl|ct|cir))/gi,
    /(\d+\s+[A-Za-z][A-Za-z\s]{5,50})/g
  ];
  
  streetPatterns.forEach((pattern, index) => {
    pattern.lastIndex = 0;
    const matches = [];
    let match;
    while ((match = pattern.exec(sampleResponse)) !== null) {
      if (match[1] && match[1].trim()) {
        matches.push(match[1].trim());
      }
    }
    if (matches.length > 0) {
      console.log(`  Pattern ${index + 1}: Found ${matches.length} matches:`, matches);
    } else {
      console.log(`  Pattern ${index + 1}: No matches`);
    }
  });
  
  // Test price extraction
  console.log('\n💰 Testing price extraction:');
  const pricePatterns = [
    /(?:price|asking\s+price|sale\s+price|property\s+price|cost)[:\s-]*\$?\s*([\d,]+(?:\.\d{2})?)/gi,
    /\$\s*([\d,]+(?:\.\d{2})?)\b/g,
    /(?:for|at|around|approximately|about|priced\s+at)\s*\$?\s*([\d,]+(?:\.\d{2})?)/gi,
    /\$[\d,]+(?:\.\d{2})?/g
  ];
  
  pricePatterns.forEach((pattern, index) => {
    pattern.lastIndex = 0;
    const matches = [];
    let match;
    while ((match = pattern.exec(sampleResponse)) !== null) {
      if (match[1]) {
        matches.push(match[1]);
      } else if (match[0]) {
        matches.push(match[0].replace('$', ''));
      }
    }
    if (matches.length > 0) {
      console.log(`  Pattern ${index + 1}: Found ${matches.length} matches:`, matches);
    } else {
      console.log(`  Pattern ${index + 1}: No matches`);
    }
  });
  
  // Test validation
  console.log('\n✅ Testing validation:');
  
  // Street validation
  const testAddresses = [
    "123 Main Street, Anytown, USA",
    "123 Main Street",
    "Main Street",
    "123",
    "$450,000",
    "bedrooms"
  ];
  
  testAddresses.forEach(addr => {
    const isValid = validateStreetName(addr);
    console.log(`  "${addr}" → ${isValid ? '✅' : '❌'}`);
  });
  
  // Price validation
  const testPrices = [
    "450,000",
    "450000",
    "450K",
    "0.45M",
    "50",
    "50000000000"
  ];
  
  testPrices.forEach(price => {
    const isValid = validatePrice(price);
    console.log(`  "$${price}" → ${isValid ? '✅' : '❌'}`);
  });
}

// Validation functions for testing
function validateStreetName(value) {
  const cleaned = value.trim().replace(/["""]/g, '');
  
  if (!cleaned || cleaned.length < 3 || cleaned.length > 120) {
    return false;
  }
  
  if (cleaned.match(/^(the|this|that|property|analysis|listing|located|address|street|asking|price|for|sale|rent)$/i)) {
    return false;
  }
  
  if (cleaned.match(/^(bedroom|bathroom|sqft|square|feet|bath|bed)$/i)) {
    return false;
  }
  
  if (cleaned.match(/^\$[\d,]+/)) {
    return false;
  }
  
  if (cleaned.match(/^\d+$/)) {
    return false;
  }
  
  if (cleaned.match(/\d/)) {
    return true;
  }
  
  if (cleaned.match(/(street|avenue|road|drive|lane|way|boulevard|place|court|circle|st|ave|rd|dr|ln|blvd|highway|route|trail|path|manor|estate|park|square|walk|green|commons|hill|valley|creek|river|lake|pond|wood|forest|meadow|field|garden|villa|residence|ranch|farm|cabin|cottage|house|home|center|plaza|market)(\s|$)/i)) {
    return true;
  }
  
  if (cleaned.length >= 8 && cleaned.match(/[A-Za-z]/) && !cleaned.match(/(bedroom|bathroom|sqft|square|feet|price|asking|for|sale|rent|analysis|property|listing)/i)) {
    return true;
  }
  
  return false;
}

function validatePrice(value) {
  let cleaned = value.replace(/[,$]/g, '');
  
  if (cleaned.match(/k$/i)) {
    const baseNum = parseFloat(cleaned.replace(/k$/i, ''));
    if (!isNaN(baseNum)) {
      cleaned = (baseNum * 1000).toString();
    }
  } else if (cleaned.match(/m$/i)) {
    const baseNum = parseFloat(cleaned.replace(/m$/i, ''));
    if (!isNaN(baseNum)) {
      cleaned = (baseNum * 1000000).toString();
    }
  }
  
  const num = parseFloat(cleaned);
  return !isNaN(num) && num >= 5000 && num <= 100000000;
}

// Run the test
console.log('🚀 Starting extraction tests...');
testExtraction();
console.log('✅ Tests completed!');