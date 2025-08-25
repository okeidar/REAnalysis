// Test script to verify the validation fix works correctly

console.log('🧪 Testing validation consistency...');

// Test data that should pass initial validation but was failing cleaning
const testData = {
  streetName: "123 Main Street",
  price: "450000",
  bedrooms: "3",
  bathrooms: "2.5",
  squareFeet: "1850",
  yearBuilt: "2015"
};

console.log('📝 Test data:', testData);

// Simulate the validation functions

// Street name validation (extraction validator)
function validateStreetNameExtraction(value) {
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

// Street name validation (cleaning validator - should match extraction)
function validateStreetNameCleaning(value) {
  let streetName = value.trim().replace(/["""]/g, '');
  
  let isValid = false;
  
  if (streetName && streetName.length >= 3 && streetName.length <= 120) {
    if (!streetName.match(/^(the|this|that|property|analysis|listing|located|address|street|asking|price|for|sale|rent)$/i) &&
        !streetName.match(/^(bedroom|bathroom|sqft|square|feet|bath|bed)$/i) &&
        !streetName.match(/^\$[\d,]+/) &&
        !streetName.match(/^\d+$/)) {
      
      if (streetName.match(/\d/)) {
        isValid = true;
      }
      else if (streetName.match(/(street|avenue|road|drive|lane|way|boulevard|place|court|circle|st|ave|rd|dr|ln|blvd|highway|route|trail|path|manor|estate|park|square|walk|green|commons|hill|valley|creek|river|lake|pond|wood|forest|meadow|field|garden|villa|residence|ranch|farm|cabin|cottage|house|home|center|plaza|market)(\s|$)/i)) {
        isValid = true;
      }
      else if (streetName.length >= 8 && streetName.match(/[A-Za-z]/) && !streetName.match(/(bedroom|bathroom|sqft|square|feet|price|asking|for|sale|rent|analysis|property|listing)/i)) {
        isValid = true;
      }
    }
  }
  
  return isValid;
}

// Price validation (extraction)
function validatePriceExtraction(value) {
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

// Price validation (cleaning)
function validatePriceCleaning(value) {
  let priceStr = value.toString().replace(/[\$,]/g, '');
  
  if (priceStr.match(/k$/i)) {
    priceStr = (parseFloat(priceStr.replace(/k$/i, '')) * 1000).toString();
  } else if (priceStr.match(/m$/i)) {
    priceStr = (parseFloat(priceStr.replace(/m$/i, '')) * 1000000).toString();
  }
  
  const priceNum = parseFloat(priceStr);
  return !isNaN(priceNum) && priceNum >= 5000 && priceNum <= 100000000;
}

console.log('\n✅ Testing validation consistency:');

// Test street name
const streetExtraction = validateStreetNameExtraction(testData.streetName);
const streetCleaning = validateStreetNameCleaning(testData.streetName);
console.log(`Street "${testData.streetName}": extraction=${streetExtraction ? '✅' : '❌'}, cleaning=${streetCleaning ? '✅' : '❌'} ${streetExtraction === streetCleaning ? '✅ CONSISTENT' : '❌ INCONSISTENT'}`);

// Test price
const priceExtraction = validatePriceExtraction(testData.price);
const priceCleaning = validatePriceCleaning(testData.price);
console.log(`Price "${testData.price}": extraction=${priceExtraction ? '✅' : '❌'}, cleaning=${priceCleaning ? '✅' : '❌'} ${priceExtraction === priceCleaning ? '✅ CONSISTENT' : '❌ INCONSISTENT'}`);

// Test edge cases
console.log('\n🔍 Testing edge cases:');

const edgeCases = [
  { streetName: "Main Street", price: "5000" },  // No number in street, minimum price
  { streetName: "123 Oak Ave", price: "999999" }, // Valid street, high price
  { streetName: "bedroom", price: "4000" },      // Invalid street, low price
  { streetName: "456 Pine Road", price: "450K" } // Valid street, K suffix
];

edgeCases.forEach((testCase, index) => {
  console.log(`\nEdge case ${index + 1}:`, testCase);
  
  if (testCase.streetName) {
    const streetExt = validateStreetNameExtraction(testCase.streetName);
    const streetClean = validateStreetNameCleaning(testCase.streetName);
    console.log(`  Street: extraction=${streetExt ? '✅' : '❌'}, cleaning=${streetClean ? '✅' : '❌'} ${streetExt === streetClean ? '✅' : '❌'}`);
  }
  
  if (testCase.price) {
    const priceExt = validatePriceExtraction(testCase.price);
    const priceClean = validatePriceCleaning(testCase.price);
    console.log(`  Price: extraction=${priceExt ? '✅' : '❌'}, cleaning=${priceClean ? '✅' : '❌'} ${priceExt === priceClean ? '✅' : '❌'}`);
  }
});

console.log('\n✅ Validation consistency test completed!');