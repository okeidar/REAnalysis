// Console diagnostic script for testing property extraction
// Copy and paste this into the browser console on a ChatGPT page

console.log('🔧 RE Analyzer Extension Diagnostic Tool');
console.log('==========================================');

// Test if the extension is loaded
if (typeof extractPropertyAnalysisData === 'function') {
  console.log('✅ Extension is loaded and ready');
} else {
  console.log('❌ Extension not found. Please reload the page.');
  
  // Try to check if content script is injected
  const scripts = Array.from(document.querySelectorAll('script')).filter(s => s.src && s.src.includes('content.js'));
  if (scripts.length > 0) {
    console.log('⚠️ Content script found but functions not available. Extension may be loading...');
  } else {
    console.log('❌ Content script not found. Extension may not be installed or enabled.');
  }
}

// Test with sample ChatGPT response
const sampleAnalysis = `**PROPERTY DETAILS:**
- Address: 123 Main Street, Anytown, CA
- Property Price: $450,000
- Bedrooms: 3
- Bathrooms: 2.5
- Square Footage: 1850 sq ft
- Year Built: 2015
- Property Type: Single Family Home

**FINANCIAL ANALYSIS:**
- Estimated Monthly Rental Income: $2,800
- Location Score: 8/10
- Rental Growth Potential: Growth: Strong

This is a great investment property in a desirable neighborhood.`;

console.log('\n🧪 Testing extraction with sample data...');
console.log('Sample text length:', sampleAnalysis.length);

if (typeof extractPropertyAnalysisData === 'function') {
  try {
    const result = extractPropertyAnalysisData(sampleAnalysis);
    console.log('\n📊 EXTRACTION RESULTS:');
    console.log('Result object:', result);
    
    if (result && result.extractedData) {
      console.log('✅ Extraction successful!');
      console.log('Data points found:', Object.keys(result.extractedData).length);
      console.log('Extracted data:', result.extractedData);
      
      // Check specific fields
      const expectedFields = ['streetName', 'price', 'bedrooms', 'bathrooms', 'propertyType'];
      expectedFields.forEach(field => {
        const value = result.extractedData[field];
        console.log(`  ${field}: ${value ? `✅ "${value}"` : '❌ not found'}`);
      });
      
      console.log('\n🎯 Quick Fix Test: If data is extracted but not showing in UI, the issue was likely the validation mismatch which has been fixed.');
      
    } else {
      console.log('❌ Extraction failed - no data returned');
    }
  } catch (error) {
    console.log('❌ Extraction error:', error);
  }
} else {
  console.log('⚠️ Cannot test extraction - function not available');
}

// Check for real ChatGPT messages
console.log('\n🔍 Checking for ChatGPT messages on this page...');
const messages = document.querySelectorAll('[data-message-author-role="assistant"]');
console.log(`Found ${messages.length} ChatGPT messages`);

if (messages.length > 0) {
  const lastMessage = messages[messages.length - 1];
  const messageText = lastMessage.textContent || lastMessage.innerText || '';
  
  console.log('Last message length:', messageText.length);
  console.log('Last message preview:', messageText.substring(0, 200) + '...');
  
  // Check if it looks like a property analysis
  const propertyKeywords = ['property', 'price', 'bedroom', 'bathroom', 'address', 'house', 'home', 'investment', 'rental'];
  const keywordMatches = propertyKeywords.filter(keyword => 
    messageText.toLowerCase().includes(keyword)
  );
  
  console.log('Property keywords found:', keywordMatches);
  
  if (keywordMatches.length >= 2) {
    console.log('✅ This looks like a property analysis response');
    
    if (typeof extractPropertyAnalysisData === 'function') {
      console.log('\n🔬 Testing extraction on actual ChatGPT response...');
      try {
        const realResult = extractPropertyAnalysisData(messageText);
        console.log('Real extraction result:', realResult);
        
        if (realResult && realResult.extractedData && Object.keys(realResult.extractedData).length > 0) {
          console.log('✅ Real data extraction successful!');
          console.log('Real extracted data:', realResult.extractedData);
        } else {
          console.log('❌ Real data extraction failed');
          console.log('💡 Try asking ChatGPT to use the exact format from the prompt');
        }
      } catch (error) {
        console.log('❌ Real extraction error:', error);
      }
    }
  } else {
    console.log('⚠️ Last message doesn\'t look like property analysis');
  }
} else {
  console.log('⚠️ No ChatGPT messages found. Make sure you\'re on a ChatGPT conversation page.');
}

// Instructions
console.log('\n📋 DIAGNOSTIC SUMMARY:');
console.log('1. If extension is loaded and sample extraction works: ✅ Extension is working');
console.log('2. If real message extraction fails: Try asking ChatGPT to use the exact format');
console.log('3. If data extracts but doesn\'t show in UI: Check the popup for property history');
console.log('4. If nothing works: Try reloading the page and running this again');

console.log('\n🔧 Manual Test Instructions:');
console.log('1. Open the extension popup');
console.log('2. Add a property URL and click "Analyze Property"');
console.log('3. Check browser console for extraction logs (look for 🔍, ✅, ❌ messages)');
console.log('4. Check if property appears in the extension popup\'s history section');

console.log('\n==========================================');
console.log('🔧 Diagnostic complete!');