# Testing Guide for ChatGPT Helper Extension

## Installation for Testing

1. **Open Chrome** and navigate to `chrome://extensions/`
2. **Enable Developer Mode** (toggle in top-right corner)
3. **Click "Load unpacked"** and select this folder
4. **Pin the extension** to your toolbar (puzzle piece icon → pin)

## Test Scenarios

### ✅ Test 1: Extension Active on ChatGPT

**Steps:**
1. Navigate to https://chatgpt.com
2. Wait for page to load completely
3. Look for the temporary "🤖 ChatGPT Helper Active" notification (top-right)
4. Click the extension icon in the toolbar
5. Verify popup shows "✅ Active on ChatGPT"

**Expected Results:**
- ✅ Temporary notification appears and disappears after 3 seconds
- ✅ Extension icon is colored/active
- ✅ Popup shows active status
- ✅ Site info shows "chatgpt.com"
- ✅ Console shows: "✅ ChatGPT Helper Extension is active on ChatGPT"

### ❌ Test 2: Extension Inactive on Other Sites

**Steps:**
1. Navigate to https://google.com (or any non-ChatGPT site)
2. Wait for page to load
3. Click the extension icon in the toolbar
4. Verify popup shows "❌ Not available on this site"

**Expected Results:**
- ❌ No notification appears
- ⚫ Extension icon is grayed out (if gray icons are available)
- ❌ Popup shows inactive status
- ✅ Site info shows the current domain (e.g., "google.com")
- ✅ Console shows: "❌ ChatGPT Helper Extension is not active on this site"

### 🔄 Test 3: Extension State Changes

**Steps:**
1. Start on a non-ChatGPT site
2. Navigate to https://chatgpt.com
3. Navigate back to another site
4. Check extension status at each step

**Expected Results:**
- ✅ Extension activates when entering ChatGPT
- ✅ Extension deactivates when leaving ChatGPT
- ✅ Icon changes appropriately (if gray icons available)
- ✅ Popup status updates correctly

## Debugging

### Console Messages
Open Developer Tools (F12) and check the Console tab for:

**On ChatGPT:**
```
ChatGPT Helper Extension loaded on: https://chatgpt.com/
✅ ChatGPT Helper Extension is active on ChatGPT
```

**On Other Sites:**
```
ChatGPT Helper Extension loaded on: https://google.com/
❌ ChatGPT Helper Extension is not active on this site
```

### Extension Console
1. Go to `chrome://extensions/`
2. Find "ChatGPT Helper Extension"
3. Click "Inspect views: background page"
4. Check for background script messages

### Common Issues

**Issue:** Extension doesn't load
- **Solution:** Check manifest.json syntax, reload extension

**Issue:** No notification on ChatGPT
- **Solution:** Check console for errors, verify content script is running

**Issue:** Popup doesn't show correct status
- **Solution:** Check background script and popup.js for communication issues

**Issue:** Icons don't change
- **Solution:** Create actual PNG icon files (currently using placeholders)

## Manual Verification Checklist

- [ ] Extension loads without errors in `chrome://extensions/`
- [ ] Content script runs only on ChatGPT domains
- [ ] Visual notification appears on ChatGPT
- [ ] Popup shows correct status on ChatGPT
- [ ] Popup shows inactive status on other sites
- [ ] Extension icon changes based on site (if icons available)
- [ ] No console errors in any scenario
- [ ] Extension doesn't interfere with ChatGPT functionality

## Notes for Development

- **Placeholder Icons:** The current icon files are empty placeholders. Create actual PNG files using the `create-icons.html` helper.
- **Permissions:** Extension only requests minimal permissions for ChatGPT domains.
- **Security:** Extension doesn't collect or transmit any data.
- **Performance:** Content script only runs on ChatGPT, no impact on other sites.

## Next Steps

After basic functionality is confirmed:
1. Add actual icon files
2. Implement specific ChatGPT enhancement features
3. Add user preferences/settings
4. Consider publishing to Chrome Web Store