# RE Analyzer - Tabular Format & UI Enhancement Implementation

## 🎯 **Implementation Requirements**

The background agent should implement the following three key enhancements:

### **1. Tabular Format Prompt Enhancement**
- **Requirement**: Modify the analysis prompt to clearly specify tabular output format
- **Goal**: Ensure ChatGPT responses are structured for easy data extraction and spreadsheet import

### **2. Column Selection UI Enhancement**
- **Requirement**: Allow users to edit which columns to include/exclude in the prompt
- **Goal**: Provide granular control over data extraction requirements

### **3. Saved Analysis UI Enhancement**
- **Requirement**: Maintain ChatGPT UI style but ensure black text on bright backgrounds
- **Goal**: Improve readability while preserving native ChatGPT appearance

## 🔧 **Technical Implementation Tasks**

### **Task 1: Tabular Format Prompt Enhancement**

#### **Research Current Prompt Structure**
- [ ] Analyze existing prompt templates in `content.js`
- [ ] Identify current prompt types (default, dynamic, tabular, custom)
- [ ] Review `getTabularDataExtractionPrompt()` function
- [ ] Examine prompt formatting and structure requirements

#### **Enhance Tabular Prompt Template**
- [ ] **Modify `getTabularDataExtractionPrompt()` function**
  - [ ] Add explicit tabular format instructions
  - [ ] Include structured output requirements
  - [ ] Specify data formatting standards
  - [ ] Add table structure guidelines

#### **Implementation Details**
```javascript
// Enhanced tabular prompt should include:
const TABULAR_PROMPT_ENHANCEMENTS = {
  formatRequirement: "Provide your analysis in a structured tabular format suitable for spreadsheet import and export",
  outputStructure: "Use clear column headers and consistent data formatting",
  dataFormatting: "Include currency symbols, proper number formatting, and standardized text",
  tableGuidelines: "Organize data in rows and columns with clear labels"
};
```

### **Task 2: Column Selection UI Enhancement**

#### **Research Current UI Structure**
- [ ] Analyze existing settings UI in `getChatGPTSettingsHTML()`
- [ ] Review tabular configuration section (`#re-tabular-columns-section`)
- [ ] Examine column management functions
- [ ] Identify current column selection mechanisms

#### **Default Columns Configuration**
- [ ] **Define Default Column Set**
  - [ ] Establish a core set of default columns that are always available
  - [ ] Include essential property data: Address, Price, Bedrooms, Bathrooms, Property Type
  - [ ] Add key investment metrics: Location Score, Estimated Rent, Investment Grade
  - [ ] Ensure default columns provide comprehensive basic analysis

#### **Enhanced Column Selection Interface**
- [ ] **Improve Column Selection UI**
  - [ ] Display default columns with clear "Default" indicators
  - [ ] Add individual column toggles for each data point
  - [ ] Implement category-based column grouping
  - [ ] Add select all/none functionality
  - [ ] Include column descriptions and examples
  - [ ] Show which columns are currently selected for the prompt

#### **Custom Column Addition Feature**
- [ ] **Add Custom Column Management**
  - [ ] Provide interface for users to add custom column definitions
  - [ ] Allow users to specify custom column name, category, and description
  - [ ] Include validation for custom column names and descriptions
  - [ ] Enable users to edit and delete custom columns
  - [ ] Store custom columns in user preferences

#### **Implementation Details**
```javascript
// Enhanced column selection should include:
const COLUMN_SELECTION_ENHANCEMENTS = {
  defaultColumns: "Core set of essential columns that are always available",
  individualToggles: "Checkbox for each column with clear labels and default indicators",
  categoryGrouping: "Group columns by: Core Info, Location, Financial, Features, Analysis, Market, Custom",
  bulkActions: "Select All, Clear All, Select Category buttons",
  descriptions: "Tooltip or description for each column explaining what data is extracted",
  customColumns: "Interface to add, edit, and manage custom column definitions",
  columnStatus: "Visual indicators showing which columns are included in current prompt"
};
```

#### **Dynamic Prompt Generation**
- [ ] **Enhance `getTabularDataExtractionPromptWithColumns()` function**
  - [ ] Generate prompts based on selected columns only (default + custom)
  - [ ] Include only relevant data extraction instructions
  - [ ] Maintain prompt coherence with fewer columns
  - [ ] Add validation for minimum required columns
  - [ ] Integrate custom column definitions into prompt generation
  - [ ] Ensure custom columns are properly formatted in the prompt

### **Task 3: Saved Analysis UI Enhancement**

#### **Research Current Analysis Display**
- [ ] Analyze `showAnalysisModal()` function in `content.js`
- [ ] Review modal styling in `addModalStyles()`
- [ ] Examine ChatGPT native styling variables
- [ ] Identify current text color implementation

#### **Enhance Analysis Display UI**
- [ ] **Improve Text Color Handling**
  - [ ] Ensure black text on bright backgrounds
  - [ ] Maintain ChatGPT UI style consistency
  - [ ] Add proper contrast validation
  - [ ] Implement responsive color adaptation

#### **Implementation Details**
```javascript
// Enhanced analysis display should include:
const ANALYSIS_UI_ENHANCEMENTS = {
  textColor: "Ensure black text (#000000) on bright backgrounds",
  chatgptStyle: "Maintain native ChatGPT appearance and feel",
  contrastValidation: "Check background brightness and adjust text color accordingly",
  responsiveDesign: "Adapt colors for different screen sizes and themes"
};
```

#### **Modal Styling Improvements**
- [ ] **Enhance `addModalStyles()` function**
  - [ ] Add proper text color variables
  - [ ] Implement background brightness detection
  - [ ] Add contrast ratio validation
  - [ ] Ensure accessibility compliance

## 📋 **Specific Code Changes Required**

### **1. Prompt Enhancement Changes**

#### **File: `content.js`**
- [ ] **Function: `getTabularDataExtractionPrompt()`**
  - [ ] Add explicit tabular format instructions
  - [ ] Include structured output requirements
  - [ ] Specify data formatting standards

#### **File: `content.js`**
- [ ] **Function: `getTabularDataExtractionPromptWithColumns()`**
  - [ ] Enhance dynamic column-based prompt generation
  - [ ] Improve prompt coherence with selected columns
  - [ ] Add validation for minimum required columns

### **2. UI Enhancement Changes**

#### **File: `content.js`**
- [ ] **Function: `getChatGPTSettingsHTML()`**
  - [ ] Enhance column selection interface
  - [ ] Add individual column toggles
  - [ ] Implement category-based grouping
  - [ ] Add bulk selection actions

#### **File: `content.js`**
- [ ] **Function: `showAnalysisModal()`**
  - [ ] Ensure proper text color handling
  - [ ] Maintain ChatGPT UI style
  - [ ] Add contrast validation

#### **File: `content.js`**
- [ ] **Function: `addModalStyles()`**
  - [ ] Add text color variables
  - [ ] Implement background brightness detection
  - [ ] Add contrast ratio validation

### **3. CSS Enhancement Changes**

#### **File: `chatgpt-native-styles.css`**
- [ ] **Add text color variables**
  - [ ] Define proper text colors for different backgrounds
  - [ ] Add contrast validation styles
  - [ ] Implement responsive color adaptation

## 🎨 **Design Requirements**

### **ChatGPT Native Integration**
- **Colors**: Use ChatGPT's exact color palette (`--chatgpt-primary`, `--chatgpt-background`, etc.)
- **Typography**: Match ChatGPT's font family and sizing
- **Spacing**: Use ChatGPT's spacing system (4px, 8px, 12px, 16px, etc.)
- **Components**: Match ChatGPT's button, input, and card styles

### **Accessibility Standards**
- **Contrast Ratio**: Ensure minimum 4.5:1 contrast ratio for text
- **Color Independence**: Don't rely solely on color for information
- **Keyboard Navigation**: Full keyboard accessibility
- **Screen Reader Support**: Proper ARIA labels and semantic HTML

### **Responsive Design**
- **Desktop**: Full sidebar with all features
- **Tablet**: Optimized layout with touch-friendly controls
- **Mobile**: Full-screen overlay with simplified interface

## 🔍 **Testing Requirements**

### **Functionality Testing**
- [ ] **Tabular Format**: Verify ChatGPT responses are properly structured
- [ ] **Column Selection**: Test individual column toggles and bulk actions
- [ ] **Dynamic Prompts**: Validate prompt generation with different column selections
- [ ] **Analysis Display**: Test text color on various backgrounds

### **UI/UX Testing**
- [ ] **ChatGPT Integration**: Verify seamless appearance with ChatGPT interface
- [ ] **Responsive Design**: Test on different screen sizes
- [ ] **Accessibility**: Validate keyboard navigation and screen reader support
- [ ] **Performance**: Ensure smooth animations and interactions

### **Cross-Browser Testing**
- [ ] **Chrome**: Primary browser for extension
- [ ] **Firefox**: Secondary browser compatibility
- [ ] **Safari**: Mac user compatibility
- [ ] **Edge**: Windows user compatibility

## 📝 **Implementation Notes**

### **Code Quality Standards**
- **Consistency**: Follow existing code patterns and naming conventions
- **Documentation**: Add clear comments for complex logic
- **Error Handling**: Implement proper error handling and user feedback
- **Performance**: Optimize for smooth user experience

### **Integration Points**
- **Storage**: Use existing Chrome storage mechanisms
- **Messaging**: Maintain current content script communication
- **Styling**: Integrate with existing CSS architecture
- **Events**: Preserve current event handling patterns

### **Backward Compatibility**
- **Existing Data**: Ensure existing saved analyses continue to work
- **User Settings**: Preserve current user preferences
- **API Compatibility**: Maintain existing function signatures where possible
- **Migration**: Provide smooth transition for existing users

## 🚀 **Success Criteria**

### **Tabular Format Enhancement**
- [ ] ChatGPT responses are consistently structured in tabular format
- [ ] Data is properly formatted for spreadsheet import
- [ ] Output includes clear column headers and consistent formatting
- [ ] Users can easily copy and paste data into Excel/Google Sheets

### **Column Selection Enhancement**
- [ ] Users can individually select/deselect columns
- [ ] Column selection affects prompt generation
- [ ] Bulk selection actions work properly
- [ ] Column descriptions help users understand what data is extracted

### **Analysis Display Enhancement**
- [ ] Text is clearly readable on all background colors
- [ ] UI maintains ChatGPT's native appearance
- [ ] Modal displays properly on all screen sizes
- [ ] Accessibility standards are met

### **Overall User Experience**
- [ ] Interface feels like a natural part of ChatGPT
- [ ] All features work smoothly without performance issues
- [ ] Users can easily understand and use all functionality
- [ ] Extension provides clear value for real estate analysis
