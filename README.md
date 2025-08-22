# ChatGPT Helper - Chrome Extension

A Chrome extension that works exclusively on ChatGPT (chatgpt.com and chat.openai.com) to provide additional functionality and enhancements.

## Features

- **Domain Restriction**: Only active on ChatGPT domains for security and performance
- **Visual Indicator**: Shows a temporary notification when the extension loads on ChatGPT
- **Status Popup**: Click the extension icon to see current status and site information
- **Smart Icon**: Extension icon changes based on whether you're on ChatGPT or not

## Installation

### Method 1: Developer Mode (Recommended for testing)

1. **Download/Clone** this repository to your local machine
2. **Open Chrome** and navigate to `chrome://extensions/`
3. **Enable Developer Mode** by toggling the switch in the top-right corner
4. **Click "Load unpacked"** and select the folder containing this extension
5. **Pin the extension** to your toolbar for easy access

### Method 2: Chrome Web Store (Future)
This extension will be available on the Chrome Web Store once published.

## Usage

1. **Navigate to ChatGPT**: Go to https://chatgpt.com or https://chat.openai.com
2. **Extension Activates**: You'll see a temporary "🤖 ChatGPT Helper Active" notification
3. **Check Status**: Click the extension icon to see detailed status information
4. **Other Sites**: The extension remains inactive on all other websites

## File Structure

```
├── manifest.json          # Extension configuration
├── content.js             # Content script (runs on ChatGPT pages)
├── background.js          # Background service worker
├── popup.html             # Extension popup interface
├── popup.js               # Popup functionality
├── styles.css             # Extension styles and animations
├── icons/                 # Extension icons (16px, 32px, 48px, 128px)
└── README.md              # This file
```

## Development

### Requirements
- Chrome browser (version 88+)
- Basic knowledge of Chrome Extensions Manifest V3

### Testing
1. Load the extension in developer mode
2. Navigate to ChatGPT - you should see the activation indicator
3. Navigate to any other website - the extension should remain inactive
4. Click the extension icon on both types of sites to verify status display

### Adding Features
- Modify `content.js` for ChatGPT page interactions
- Update `popup.html` and `popup.js` for interface changes
- Add styles in `styles.css`
- Update permissions in `manifest.json` if needed

## Security

This extension:
- Only requests permissions for ChatGPT domains
- Does not collect or transmit any user data
- Runs only on specified domains for security
- Uses minimal permissions (activeTab, storage)

## Version History

### v1.0.0
- Initial release
- Basic domain restriction functionality
- Visual status indicators
- Popup interface for status checking

## Support

If you encounter any issues:
1. Check the browser console for error messages
2. Verify you're on the correct ChatGPT domain
3. Try reloading the extension in `chrome://extensions/`
4. Ensure you're using a supported Chrome version

## License

This project is open source. Feel free to modify and distribute according to your needs.