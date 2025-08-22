# ChatGPT Helper - Chrome Extension

A Chrome extension that works exclusively on ChatGPT (chatgpt.com and chat.openai.com) to provide additional functionality and enhancements.

## Features

- **Domain Restriction**: Only active on ChatGPT domains for security and performance
- **Visual Indicator**: Shows a temporary notification when the extension loads on ChatGPT
- **Status Popup**: Click the extension icon to see current status and site information
- **Smart Icon**: Extension icon changes based on whether you're on ChatGPT or not
- **Property Link Analyzer**: Paste property links (Zillow, Realtor.com, etc.) and get comprehensive analysis from ChatGPT

## Installation

### Method 1: Developer Mode (Recommended for testing)

1. **Download/Clone** this repository to your local machine
2. **Generate Icons** (required):
   - Open `create-icons-simple.html` in your browser
   - Click each "Download" button to save the icon files
   - Save all files in the `icons/` folder with the exact names shown
3. **Open Chrome** and navigate to `chrome://extensions/`
4. **Enable Developer Mode** by toggling the switch in the top-right corner
5. **Click "Load unpacked"** and select the folder containing this extension
6. **Pin the extension** to your toolbar for easy access

### Method 2: Chrome Web Store (Future)
This extension will be available on the Chrome Web Store once published.

## Usage

### Basic Usage
1. **Navigate to ChatGPT**: Go to https://chatgpt.com or https://chat.openai.com
2. **Extension Activates**: You'll see a temporary "🤖 ChatGPT Helper Active" notification
3. **Check Status**: Click the extension icon to see detailed status information
4. **Other Sites**: The extension remains inactive on all other websites

### Property Link Analysis
1. **Open ChatGPT**: Navigate to ChatGPT in your browser
2. **Click Extension Icon**: The popup will show the Property Link Analyzer section
3. **Paste Property Link**: 
   - Manually paste a property URL, or
   - Click the "📋 Paste" button to paste from clipboard
4. **Click "🔍 Analyze"**: The extension will insert a comprehensive analysis prompt into ChatGPT
5. **Review Results**: ChatGPT will analyze the property and provide detailed insights

#### Supported Property Websites
- Zillow.com
- Realtor.com
- Redfin.com
- Homes.com
- Trulia.com
- Apartments.com
- Rent.com
- HotPads.com
- PadMapper.com
- LoopNet.com

## File Structure

```
├── manifest.json          # Extension configuration
├── content.js             # Content script (runs on ChatGPT pages)
├── background.js          # Background service worker
├── popup.html             # Extension popup interface
├── popup.js               # Popup functionality
├── styles.css             # Extension styles and animations
├── icons/                 # Extension icons (16px, 32px, 48px, 128px)
├── create-icons-simple.html  # Icon generator tool
├── generate-icons.html    # Advanced icon generator

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
5. Test property link analysis by pasting a valid property URL


### Adding Features
- Modify `content.js` for ChatGPT page interactions
- Update `popup.html` and `popup.js` for interface changes
- Add styles in `styles.css`
- Update permissions in `manifest.json` if needed

### Icon Management
- Use `create-icons-simple.html` for basic icon generation
- Use `generate-icons.html` for more detailed robot-themed icons
- Icons must be actual PNG files (not empty placeholders)

## Troubleshooting

### Common Issues

#### "Unable to communicate with ChatGPT" Error
If you see this error even when on the ChatGPT page:

1. **Reload the page**: Refresh the ChatGPT page and try again
2. **Reload the extension**: Go to `chrome://extensions/`, find the extension, and click the reload button
3. **Check permissions**: Ensure the extension has access to ChatGPT domains
4. **Disable conflicting extensions**: Other extensions might interfere with functionality
5. **Try incognito mode**: Test if the extension works in an incognito window
6. **Clear cache**: Clear browser cache and cookies for ChatGPT

#### Extension Not Showing Property Section
- Make sure you're on `chatgpt.com` or `chat.openai.com`
- The property section only appears when the extension detects ChatGPT
- Try refreshing the page if the section doesn't appear

#### Property Link Not Being Inserted
- Ensure the link is from a supported property website
- Wait for the ChatGPT page to fully load before using the extension
- Check that the ChatGPT input field is visible and accessible
- Try clicking directly in the ChatGPT input field first

### Debug Information
Open the browser console (F12) to see detailed logging from the extension. Look for:
- Content script loading messages
- Message passing between popup and content script
- Input field detection attempts
- Error messages with specific details

## Security

This extension:
- Only requests permissions for ChatGPT domains
- Does not collect or transmit any user data
- Runs only on specified domains for security
- Uses minimal permissions (activeTab, storage, clipboardRead, scripting)
- Validates property links before processing

## Version History

### v1.0.2
- Fixed communication issues between popup and content script
- Improved ChatGPT input field detection with more selectors
- Added retry logic for message passing
- Enhanced error handling and user feedback
- Added content script injection fallback
- Improved debugging with console logging

### v1.0.1
- Added Property Link Analyzer feature
- Support for major property websites
- Clipboard paste functionality
- Enhanced popup interface with property analysis section

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
5. For property analysis issues, verify the link is from a supported property website
6. Try disabling other extensions that might conflict

## License

This project is open source. Feel free to modify and distribute according to your needs.