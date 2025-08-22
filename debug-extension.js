/**
 * Debug Script for Chrome Extension
 * Run this in the browser console to check extension status
 */

console.log('🔍 Chrome Extension Debug Tool');
console.log('================================');

// Check Chrome version
const chromeVersion = navigator.userAgent.match(/Chrome\/(\d+)/);
console.log(`Chrome Version: ${chromeVersion ? chromeVersion[1] : 'Unknown'}`);

// Check if extension APIs are available
console.log('\n📋 Extension API Availability:');
console.log('chrome object:', typeof chrome !== 'undefined' ? '✅ Available' : '❌ Not Available');
console.log('chrome.runtime:', typeof chrome?.runtime !== 'undefined' ? '✅ Available' : '❌ Not Available');
console.log('chrome.storage:', typeof chrome?.storage !== 'undefined' ? '✅ Available' : '❌ Not Available');
console.log('chrome.tabs:', typeof chrome?.tabs !== 'undefined' ? '✅ Available' : '❌ Not Available');
console.log('chrome.contextMenus:', typeof chrome?.contextMenus !== 'undefined' ? '✅ Available' : '❌ Not Available');

// Try to get extension manifest
if (typeof chrome !== 'undefined' && chrome.runtime) {
  try {
    const manifest = chrome.runtime.getManifest();
    console.log('\n📦 Extension Manifest:');
    console.log('Name:', manifest.name);
    console.log('Version:', manifest.version);
    console.log('Manifest Version:', manifest.manifest_version);
    console.log('Permissions:', manifest.permissions);
  } catch (error) {
    console.log('\n❌ Error getting manifest:', error.message);
  }
}

// Test storage functionality
if (typeof chrome !== 'undefined' && chrome.storage) {
  console.log('\n🗄️ Testing Storage...');
  
  const testData = { debugTest: true, timestamp: Date.now() };
  
  chrome.storage.local.set(testData, function() {
    if (chrome.runtime.lastError) {
      console.log('❌ Storage write failed:', chrome.runtime.lastError.message);
    } else {
      console.log('✅ Storage write successful');
      
      chrome.storage.local.get(['debugTest'], function(data) {
        if (chrome.runtime.lastError) {
          console.log('❌ Storage read failed:', chrome.runtime.lastError.message);
        } else {
          console.log('✅ Storage read successful:', data);
          
          // Clean up
          chrome.storage.local.remove(['debugTest', 'timestamp'], function() {
            console.log('🧹 Test data cleaned up');
          });
        }
      });
    }
  });
} else {
  console.log('\n❌ Storage API not available');
}

// Check current URL for supported sites
const currentUrl = window.location.href;
const supportedSites = [
  'zillow.com',
  'redfin.com', 
  'realtor.com',
  'trulia.com'
];

console.log('\n🏠 Current Site Analysis:');
console.log('Current URL:', currentUrl);

const matchingSite = supportedSites.find(site => currentUrl.includes(site));
if (matchingSite) {
  console.log(`✅ Supported site detected: ${matchingSite}`);
  
  // Check if it's a property page
  const propertyPatterns = [
    '/homedetails/',  // Zillow
    '/home/',         // Redfin
    '/realestateandhomes-detail/', // Realtor.com
    '/p/'             // Trulia
  ];
  
  const isPropertyPage = propertyPatterns.some(pattern => currentUrl.includes(pattern));
  console.log('Property page:', isPropertyPage ? '✅ Yes' : '❌ No (search results or other page)');
  
  if (isPropertyPage) {
    console.log('💡 The "📊 Analyze Property" button should appear on this page');
  }
} else {
  console.log('ℹ️ Not on a supported real estate site');
}

// Instructions
console.log('\n🔧 Troubleshooting Steps:');
console.log('1. Go to chrome://extensions/');
console.log('2. Find "ChatGPT Real Estate Analyzer"');
console.log('3. Click "Reload" button');
console.log('4. Click "Inspect views → background page"');
console.log('5. Check console for errors');
console.log('\n📖 For more help, see TROUBLESHOOTING.md');

// Export results for easy copying
window.extensionDebugResults = {
  chromeVersion: chromeVersion ? chromeVersion[1] : null,
  apis: {
    chrome: typeof chrome !== 'undefined',
    runtime: typeof chrome?.runtime !== 'undefined',
    storage: typeof chrome?.storage !== 'undefined',
    tabs: typeof chrome?.tabs !== 'undefined',
    contextMenus: typeof chrome?.contextMenus !== 'undefined'
  },
  currentUrl,
  supportedSite: matchingSite || null,
  timestamp: new Date().toISOString()
};

console.log('\n💾 Debug results saved to window.extensionDebugResults');
