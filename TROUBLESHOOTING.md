# Troubleshooting Guide

## 🔧 Common Issues and Solutions

### Service Worker Registration Failed (Status Code 15)

**Error:** `Service worker registration failed. Status code: 15`

**Cause:** This error typically occurs when:
- There are JavaScript syntax errors in the background script
- Missing dependencies or incorrect file paths
- Issues with `importScripts()` in service workers

**Solution:**
1. Check browser console for detailed error messages
2. Verify all file paths are correct in the background script
3. Ensure utility classes don't reference `window` object (fixed in v1.0.1)

**Fixed in this version:** ✅
- Removed `window` object references from utility classes
- Properly instantiated classes in service worker context

### "window is not defined" Error

**Error:** `Uncaught ReferenceError: window is not defined`

**Cause:** Service workers (Manifest V3) don't have access to the `window` object, which is only available in browser contexts.

**Solution:**
```javascript
// ❌ Wrong - Don't do this in service workers
window.storageManager = new StorageManager();

// ✅ Correct - Create instances in service worker global scope
const storageManager = new StorageManager();
```

**Fixed in this version:** ✅
- Removed `window.*` assignments from all utility files
- Created proper global instances in background script

### Extension Not Loading

**Symptoms:**
- Extension doesn't appear in toolbar
- "Load unpacked" fails
- Manifest errors

**Solutions:**

1. **Check Manifest Syntax**
   ```bash
   # Validate JSON syntax
   python3 -c "import json; json.load(open('manifest.json'))"
   ```

2. **Verify File Structure**
   ```
   RE Analyzer Extension/
   ├── manifest.json ✓
   ├── src/
   │   ├── background/background.js ✓
   │   ├── content/content.js ✓
   │   └── popup/popup.html ✓
   └── assets/icons/*.png ✓
   ```

3. **Enable Developer Mode**
   - Go to `chrome://extensions/`
   - Toggle "Developer mode" ON
   - Click "Load unpacked"

### Icon Display Issues

**Problem:** Icons not showing properly in Chrome

**Cause:** Chrome extensions don't support SVG icons in Manifest V3

**Solution:** ✅ **Fixed**
- Converted all icons from SVG to PNG format
- Updated manifest.json to reference PNG files

### Content Script Not Injecting

**Symptoms:**
- "Analyze Property" button doesn't appear
- Property data not extracting

**Debugging Steps:**

1. **Check if on supported site:**
   - Zillow.com ✓
   - Redfin.com ✓
   - Realtor.com ✓
   - Trulia.com ✓

2. **Verify you're on property detail page:**
   - URL should contain patterns like `/homedetails/`, `/home/`, etc.
   - Not on search results or listing pages

3. **Check browser console:**
   ```javascript
   // Open DevTools (F12) and look for:
   console.log('Content script loaded'); // Should appear
   ```

4. **Reload extension if needed:**
   - Go to `chrome://extensions/`
   - Click reload button for the extension

### Storage/Data Issues

**Problem:** Properties not saving or loading

**Debugging:**
1. Check Chrome storage quota:
   ```javascript
   chrome.storage.local.getBytesInUse().then(console.log);
   ```

2. Inspect stored data:
   ```javascript
   chrome.storage.local.get(null).then(console.log);
   ```

3. Clear storage if corrupted:
   ```javascript
   chrome.storage.local.clear();
   ```

### Background Script Debugging

**Enable Background Script Debugging:**
1. Go to `chrome://extensions/`
2. Find "Real Estate Analyzer"
3. Click "Inspect views → background page"
4. Check console for errors

**Common Background Script Issues:**
- Missing `await` keywords for async operations
- Incorrect message passing between scripts
- Storage quota exceeded

## 🐛 Debug Mode

### Enable Detailed Logging

Add this to background script for verbose logging:
```javascript
// Debug mode
const DEBUG = true;

function debugLog(message, data = '') {
  if (DEBUG) {
    console.log(`[RE Analyzer] ${message}`, data);
  }
}
```

### Test Extension Step by Step

1. **Load Extension:**
   ```bash
   # Should see no errors in chrome://extensions/
   ```

2. **Test Background Script:**
   ```javascript
   // In background script console
   console.log('Background script active:', chrome.runtime.id);
   ```

3. **Test Content Script:**
   ```javascript
   // On property page console
   console.log('Content script loaded');
   ```

4. **Test Property Analysis:**
   - Navigate to Zillow property
   - Click analyze button
   - Check for analysis modal

### Performance Monitoring

**Monitor Extension Performance:**
```javascript
// In background script
chrome.runtime.onStartup.addListener(() => {
  console.log('Extension startup time:', Date.now());
});
```

**Check Memory Usage:**
```javascript
// In background script console
console.log('Memory usage:', performance.memory);
```

## 📞 Getting Help

### Before Reporting Issues

1. **Try these first:**
   - Reload the extension
   - Restart Chrome browser
   - Clear browser cache
   - Check Chrome version (need 88+)

2. **Gather debug information:**
   - Chrome version
   - Extension version
   - Error messages from console
   - Steps to reproduce

3. **Test on clean profile:**
   - Create new Chrome profile
   - Test extension without other extensions

### Report a Bug

**Include this information:**
- Chrome version
- Operating system
- Extension version
- Exact error messages
- Steps to reproduce
- Screenshots if applicable

### Contact Channels

- **GitHub Issues:** For bugs and feature requests
- **Chrome Web Store:** For user support
- **Documentation:** Check README.md and code comments

---

**Most common issues have been resolved in this version! 🎉**

If you're still experiencing problems, please check the GitHub Issues page or create a new issue with detailed information.
