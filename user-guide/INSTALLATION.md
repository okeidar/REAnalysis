# Installation & Testing Guide

## 🚀 Quick Start

### Prerequisites
- Google Chrome browser (version 88 or higher)
- Chrome Developer Mode enabled

### Installation Steps

1. **Download the Extension**
   ```bash
   # If cloning from repository
   git clone https://github.com/your-username/re-analyzer-extension.git
   cd re-analyzer-extension
   
   # Or download and extract the ZIP file
   ```

2. **Load Extension in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" toggle in the top-right corner
   - Click "Load unpacked" button
   - Select the project directory (the folder containing `manifest.json`)
   - The extension should now appear in your extensions list

3. **Verify Installation**
   - Look for the "📊 RE" icon in your Chrome toolbar
   - Click the icon to open the popup interface
   - Navigate to extension settings to configure preferences

## 🧪 Testing the Extension

### Test 1: Basic Property Analysis

1. **Navigate to a Property Listing**
   - Go to [Zillow](https://www.zillow.com)
   - Search for properties in your area
   - Click on any property listing to view details

2. **Analyze the Property**
   - Look for the floating "📊 Analyze Property" button (appears in top-right)
   - Click the button to start analysis
   - Review the analysis modal with financial metrics

3. **Expected Results**
   - Property data should be extracted automatically
   - Financial calculations should display (cash flow, cap rate, CoC return)
   - A verdict should be assigned (Strong Buy/Worth Considering/Pass)
   - Red flags and recommendations should be shown

### Test 2: Popup Interface

1. **Open Extension Popup**
   - Click the extension icon in the toolbar
   - The popup should display recent properties and quick stats

2. **Test Quick Actions**
   - Try "Analyze Current Page" (should work on property pages)
   - Try "Analyze from URL" with a property link
   - Test the ChatGPT prompt generation buttons

3. **Expected Results**
   - Current page analysis should work on supported sites
   - URL analysis should parse and analyze property links
   - Prompts should copy to clipboard and open ChatGPT

### Test 3: Property Management

1. **Access Settings Page**
   - Click the settings gear in the popup
   - Or click "View All" to see properties manager

2. **Configure Preferences**
   - Set investment targets (cash flow, cap rate, etc.)
   - Configure loan parameters
   - Adjust analysis settings
   - Save preferences

3. **Manage Properties**
   - View analyzed properties in the Properties tab
   - Create custom folders for organization
   - Test search and filter functionality
   - Try exporting data to CSV

### Test 4: Multi-Site Support

Test the extension on all supported sites:

1. **Zillow.com**
   - Navigate to: https://www.zillow.com/homedetails/
   - Test property data extraction

2. **Redfin.com**
   - Navigate to: https://www.redfin.com/*/home/
   - Test property data extraction

3. **Realtor.com**
   - Navigate to: https://www.realtor.com/realestateandhomes-detail/
   - Test property data extraction

4. **Trulia.com**
   - Navigate to: https://www.trulia.com/p/
   - Test property data extraction

## 🐛 Troubleshooting

### Common Issues

**Extension Icon Not Visible**
- Ensure Developer Mode is enabled
- Check that the extension is loaded and enabled
- Pin the extension to toolbar if needed

**Property Data Not Extracting**
- Verify you're on a property detail page (not search results)
- Check browser console for JavaScript errors (F12 → Console)
- Try refreshing the page and analyzing again

**Analysis Button Not Appearing**
- Confirm you're on a supported website
- Check that content script loaded (look for console messages)
- Disable other extensions that might interfere

**Popup Not Loading**
- Check for JavaScript errors in extension popup
- Try reloading the extension (chrome://extensions/)
- Clear browser cache and cookies

### Debug Mode

1. **Enable Extension Debugging**
   - Go to `chrome://extensions/`
   - Find the Real Estate Analyzer extension
   - Click "Inspect views → background page" for background script debugging
   - Click "Inspect views → popup.html" for popup debugging

2. **Check Console Logs**
   - Open Developer Tools (F12) on property pages
   - Look for extension-related console messages
   - Check for error messages or warnings

3. **Verify Permissions**
   - Ensure extension has permissions for real estate sites
   - Check that storage permissions are granted
   - Verify scripting permissions are active

## 🔧 Configuration Tips

### Optimal Settings

**Investment Preferences**
- Set realistic targets based on your market
- Consider local rental rates and property taxes
- Adjust risk tolerance based on experience

**Analysis Parameters**
- Enable market analysis for comprehensive insights
- Use auto-rent calculation for quick estimates
- Keep red flag warnings enabled for safety

**Export Settings**
- Regularly backup your data
- Export to CSV for spreadsheet analysis
- Use Google Sheets integration for collaboration

### Performance Optimization

**Browser Settings**
- Keep Chrome updated to latest version
- Disable unnecessary extensions
- Clear cache regularly for optimal performance

**Extension Settings**
- Limit number of stored properties if experiencing slowness
- Export old data and archive if needed
- Regular backups prevent data loss

## 📞 Support

### Getting Help

**Check Documentation**
- Review README.md for feature overview
- Check code comments for technical details
- Browse example configurations

**Report Issues**
- Open GitHub Issues for bugs
- Include browser version and error messages
- Provide steps to reproduce problems

**Feature Requests**
- Use GitHub Discussions for new ideas
- Check existing requests before submitting
- Provide detailed use case descriptions

### Contact Information

- **GitHub**: [Repository Issues](https://github.com/your-username/re-analyzer-extension/issues)
- **Documentation**: [README.md](README.md)
- **License**: [MIT License](LICENSE)

---

**Happy Real Estate Investing! 🏠📈**
