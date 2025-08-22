// Popup script for ChatGPT Helper Extension
document.addEventListener('DOMContentLoaded', function() {
  console.log('Popup loaded');
  
  const statusElement = document.getElementById('status');
  const infoElement = document.getElementById('info');
  const siteElement = document.getElementById('site');
  const urlElement = document.getElementById('url');
  const propertyLinkSection = document.getElementById('propertyLinkSection');
  const propertyLinkInput = document.getElementById('propertyLinkInput');
  const pasteBtn = document.getElementById('pasteBtn');
  const analyzeBtn = document.getElementById('analyzeBtn');
  const successMessage = document.getElementById('successMessage');
  const errorMessage = document.getElementById('errorMessage');
  
  // Helper function to show success message
  function showSuccess(message) {
    successMessage.textContent = message;
    successMessage.style.display = 'block';
    errorMessage.style.display = 'none';
    setTimeout(() => {
      successMessage.style.display = 'none';
    }, 3000);
  }
  
  // Helper function to show error message
  function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    successMessage.style.display = 'none';
    setTimeout(() => {
      errorMessage.style.display = 'none';
    }, 5000);
  }
  
  // Helper function to validate property link
  function isValidPropertyLink(url) {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      
      // Common property websites
      const propertyDomains = [
        'zillow.com',
        'realtor.com',
        'redfin.com',
        'homes.com',
        'trulia.com',
        'apartments.com',
        'rent.com',
        'hotpads.com',
        'padmapper.com',
        'loopnet.com'
      ];
      
      return propertyDomains.some(domain => hostname.includes(domain));
    } catch (e) {
      return false;
    }
  }
  
  // Paste button functionality
  pasteBtn.addEventListener('click', async function() {
    try {
      const text = await navigator.clipboard.readText();
      propertyLinkInput.value = text;
      showSuccess('Link pasted successfully!');
    } catch (err) {
      showError('Unable to paste from clipboard. Please paste manually.');
    }
  });
  
  // Analyze button functionality
  analyzeBtn.addEventListener('click', function() {
    const link = propertyLinkInput.value.trim();
    
    if (!link) {
      showError('Please enter a property link first.');
      return;
    }
    
    if (!isValidPropertyLink(link)) {
      showError('Please enter a valid property link (Zillow, Realtor.com, etc.)');
      return;
    }
    
    // Disable button while processing
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = '🔄 Analyzing...';
    
    // Send message to content script to insert the link
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'analyzeProperty',
          link: link
        }, function(response) {
          analyzeBtn.disabled = false;
          analyzeBtn.textContent = '🔍 Analyze';
          
          if (chrome.runtime.lastError) {
            showError('Unable to communicate with ChatGPT. Make sure you\'re on the ChatGPT page.');
          } else if (response && response.success) {
            showSuccess('Property link sent to ChatGPT for analysis!');
            propertyLinkInput.value = ''; // Clear the input
          } else {
            showError('Failed to send property link to ChatGPT.');
          }
        });
      }
    });
  });
  
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
      
      // Show property link section when on ChatGPT
      propertyLinkSection.style.display = 'block';
      
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
          
          // Show property link section when content script is active
          propertyLinkSection.style.display = 'block';
        }
      });
    }
  });
});