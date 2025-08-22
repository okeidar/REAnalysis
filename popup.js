// Popup script for ChatGPT Helper Extension
document.addEventListener('DOMContentLoaded', function() {
  console.log('Popup loaded');
  
  const statusElement = document.getElementById('status');
  const infoElement = document.getElementById('info');
  const siteElement = document.getElementById('site');
  const urlElement = document.getElementById('url');
  
  // Get current tab information
  chrome.runtime.sendMessage({action: 'getTabInfo'}, function(response) {
    console.log('Tab info received:', response);
    
    if (response && response.isChatGPT) {
      // Extension is active on ChatGPT
      statusElement.className = 'status active';
      statusElement.textContent = '✅ Active on ChatGPT';
      
      // Show site info
      infoElement.style.display = 'block';
      siteElement.textContent = new URL(response.url).hostname;
      urlElement.textContent = response.url;
      
    } else if (response && response.url) {
      // Extension is not active on this site
      statusElement.className = 'status inactive';
      statusElement.textContent = '❌ Not available on this site';
      
      // Show site info
      infoElement.style.display = 'block';
      siteElement.textContent = new URL(response.url).hostname;
      urlElement.textContent = response.url;
      
    } else {
      // Unable to get tab info
      statusElement.className = 'status inactive';
      statusElement.textContent = '⚠️ Unable to check status';
    }
  });
  
  // Also try to communicate directly with content script if available
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {action: 'checkStatus'}, function(response) {
        if (chrome.runtime.lastError) {
          console.log('No content script available:', chrome.runtime.lastError.message);
        } else if (response && response.active) {
          console.log('Content script confirmed active:', response);
          
          // Update status if we got a response from content script
          statusElement.className = 'status active';
          statusElement.textContent = '✅ Active on ChatGPT';
          
          infoElement.style.display = 'block';
          siteElement.textContent = response.site;
          urlElement.textContent = response.url;
        }
      });
    }
  });
});