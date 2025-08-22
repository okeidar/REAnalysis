# ChatGPT Real Estate Analyzer - Chrome Extension

Transform ChatGPT into a powerful real estate portfolio manager. Analyze, compare, and organize properties from Zillow, Redfin, Realtor.com, and Trulia directly from your browser.

## 🚀 Features

### 📊 Deal Analyzer
- **One-Click Analysis**: Extract property data from supported real estate websites
- **Financial Calculations**: Cash flow, Cap rate, Cash-on-Cash return, NOI
- **Risk Assessment**: Automated red flag detection and risk analysis
- **Plain-Language Recommendations**: Clear investment verdicts and insights

### 🏠 Property Management
- **Portfolio Organization**: Create custom folders and categorize properties
- **Comparison Tools**: Side-by-side property comparison with scoring
- **Search & Filter**: Find properties by address, price, metrics, or notes
- **Visual Dashboard**: Property cards with key metrics and status indicators

### 🤖 ChatGPT Integration
- **Pre-Built Prompts**: Ready-to-use analysis prompts for ChatGPT
- **Market Analysis**: Generate market insights and trend analysis
- **Scenario Planning**: "What-if" analysis for different investment scenarios
- **Automated Summaries**: Generate investment reports and presentations

### 📈 Market Insights
- **Rent Estimates**: Automatic rental income estimation
- **Market Trends**: Local market analysis and risk factors
- **Neighborhood Data**: Schools, walkability, and amenities
- **Investment Scoring**: Automated property ranking and recommendations

### 📤 Export & Sharing
- **Google Sheets Export**: One-click export to spreadsheets
- **CSV Downloads**: Download analysis data for Excel
- **Backup & Restore**: Complete data backup and restoration
- **Shareable Reports**: Generate professional investment reports

## 🎯 Supported Websites

- **Zillow** - Full property data extraction
- **Redfin** - Complete listing information
- **Realtor.com** - MLS data and property details
- **Trulia** - Property info with neighborhood insights

## 🛠 Installation

### Development Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/re-analyzer-extension.git
   cd re-analyzer-extension
   ```

2. **Load extension in Chrome**:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked" and select the project directory
   - The extension will appear in your toolbar

3. **Start analyzing properties**:
   - Visit any supported real estate website
   - Navigate to a property listing
   - Click the "📊 Analyze Property" button that appears
   - View detailed analysis results

### Production Installation

*Coming soon to Chrome Web Store*

## 📱 How to Use

### Quick Analysis
1. Navigate to a property listing on Zillow, Redfin, Realtor.com, or Trulia
2. Click the floating "📊 Analyze Property" button
3. Review the comprehensive analysis including:
   - Monthly cash flow projection
   - Cap rate and CoC return
   - Investment verdict (Strong Buy/Worth Considering/Pass)
   - Red flags and risk factors

### Property Management
1. Click the extension icon in your toolbar
2. View recent properties and portfolio stats
3. Access the full property manager via "View All"
4. Organize properties into custom folders
5. Compare multiple properties side-by-side

### ChatGPT Integration
1. Use the pre-built prompt buttons in the popup
2. Copy generated prompts to ChatGPT
3. Get detailed market analysis and investment insights
4. Run scenario analysis with "what-if" questions

## ⚙️ Configuration

### Investment Preferences
Set your investment criteria in the extension settings:
- Target monthly cash flow
- Minimum cap rate and CoC return
- Risk tolerance level
- Investment strategy (cash flow vs. appreciation)

### Loan Parameters
Configure your typical financing:
- Down payment percentage
- Interest rate
- Loan term
- Monthly expense estimates

### Analysis Settings
Customize the analysis engine:
- Include/exclude market analysis
- Auto-calculate rent estimates
- Show/hide red flag warnings
- Currency and formatting preferences

## 🔧 Technical Architecture

### Core Components
- **Manifest V3** Chrome extension
- **Content Scripts** for property data extraction
- **Background Service Worker** for analysis processing
- **Popup Interface** for quick actions
- **Options Page** for settings and property management

### Data Storage
- **Chrome Storage API** for local data persistence
- **JSON format** for data export/import
- **CSV export** for spreadsheet compatibility
- **Automatic backups** for data safety

### Security & Privacy
- **No external APIs** required for core functionality
- **Local data storage** - your data stays on your device
- **Minimal permissions** - only access to supported real estate sites
- **No tracking** or analytics collection

## 📊 Analysis Methodology

### Financial Calculations
```javascript
Cash Flow = Monthly Rent - (Mortgage + Taxes + Insurance + Expenses)
Cap Rate = Net Operating Income ÷ Purchase Price × 100
Cash-on-Cash Return = Annual Cash Flow ÷ Total Cash Invested × 100
```

### Risk Assessment
- Property age and condition indicators
- Market timing and pricing analysis
- Location-based risk factors
- Financial leverage analysis

### Verdict Criteria
- **Strong Buy**: Meets all target criteria with low risk
- **Worth Considering**: Meets most criteria with acceptable risk
- **Pass**: Below target criteria or high risk factors

## 🤝 Contributing

We welcome contributions! Here's how you can help:

1. **Bug Reports**: Found an issue? Report it on GitHub Issues
2. **Feature Requests**: Have an idea? Submit a feature request
3. **Code Contributions**: 
   - Fork the repository
   - Create a feature branch
   - Submit a pull request

### Development Guidelines
- Follow existing code style and conventions
- Add tests for new functionality
- Update documentation for changes
- Test on multiple real estate sites

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙋‍♂️ Support

- **Documentation**: Check this README and inline code comments
- **Issues**: Report bugs on GitHub Issues
- **Questions**: Use GitHub Discussions for general questions
- **Updates**: Watch the repository for new releases

## 🎯 Roadmap

### Version 1.1
- [ ] Additional real estate site support
- [ ] Advanced market data integration
- [ ] Mobile-responsive interface improvements
- [ ] Batch property analysis

### Version 1.2
- [ ] Real-time market alerts
- [ ] Advanced portfolio analytics
- [ ] Integration with popular CRM tools
- [ ] Multi-language support

### Version 2.0
- [ ] AI-powered market predictions
- [ ] Automated deal sourcing
- [ ] Partnership with lenders
- [ ] Professional investor tools

## 🏆 Acknowledgments

- Built for the real estate investor community
- Inspired by the need for better deal analysis tools
- Powered by Chrome Extensions API
- Designed for ChatGPT integration

---

**Transform your real estate investment workflow today!** 🏠📈
