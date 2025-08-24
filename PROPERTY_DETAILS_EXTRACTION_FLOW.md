# Property Details Extraction Flow

## Overview
This document explains how the ChatGPT Helper Extension ensures that property details are properly extracted from ChatGPT's response **after** the property link is sent, especially with the new prompt splitting feature.

## Enhanced Flow with Prompt Splitting

### 1. Initial Setup
When a user clicks "Analyze Property":
```javascript
// Track the property analysis session
currentPropertyAnalysis = {
  url: propertyLink,
  timestamp: Date.now(),
  sessionId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
};
```

### 2. Prompt Delivery Decision
The system checks if prompt splitting should be used:
```javascript
if (shouldSplitPrompt(fullPrompt)) {
  // Use two-phase approach
} else {
  // Use traditional single prompt
}
```

### 3. Two-Phase Approach (When Splitting)

#### Phase 1: Instructions
- **Action**: Send analysis instructions + confirmation request
- **Phase**: `promptSplittingState.currentPhase = 'waiting_confirmation'`
- **User Sees**: "Waiting for ChatGPT confirmation..."

#### Phase 2: Property Link
- **Trigger**: ChatGPT responds with "Yes, I understand" or similar
- **Action**: Send property link for analysis
- **Phase**: `promptSplittingState.currentPhase = 'analyzing'`
- **User Sees**: "Waiting for property analysis..."

### 4. Response Processing Logic

The `processCompletedResponse` function handles different phases:

```javascript
// 1. Check for confirmation (Phase 1 response)
if (promptSplittingState.currentPhase === 'waiting_confirmation') {
  if (detectConfirmation(messageText)) {
    handleConfirmationReceived(); // Send property link
    return; // DON'T process as property analysis
  }
}

// 2. Process property analysis (Phase 2 response)
if (promptSplittingState.currentPhase === 'analyzing') {
  // Continue to property extraction below
}

// 3. Extract property details ONLY from analysis response
if (keywordMatches >= 2 && currentPropertyAnalysis) {
  const analysisData = extractPropertyAnalysisData(messageText);
  // Save extracted data
}
```

## Key Safeguards

### 1. Session Tracking
- **`currentPropertyAnalysis`** is set once at the beginning and persists through all phases
- Only responses with an active session are processed for property data
- Session includes URL, timestamp, and unique session ID

### 2. Phase-Aware Processing
- **Confirmation responses** are handled separately and NOT processed for property data
- **Only the final analysis response** (after property link) is processed for extraction
- Clear phase transitions prevent confusion

### 3. Response Validation
```javascript
// Multiple validation layers:
if (keywordMatches >= 2 && currentPropertyAnalysis) {
  // Has property keywords AND active session
  const analysisData = extractPropertyAnalysisData(messageText);
  
  if (analysisData && Object.keys(analysisData.extractedData).length > 0) {
    // Successfully extracted meaningful data
    savePropertyAnalysis(analysisData);
  }
}
```

## Property Data Extraction Process

### 1. Structured Section Extraction
The system first looks for structured sections:
- **PROPERTY DETAILS**: Price, bedrooms, bathrooms, sqft, year built
- **LOCATION & NEIGHBORHOOD ANALYSIS**: Location score, neighborhood info
- **RENTAL INCOME ANALYSIS**: Rental income estimates, growth potential
- **INVESTMENT SUMMARY**: Pros, cons, red flags

### 2. Fallback Pattern Matching
If structured sections aren't found, uses regex patterns:
```javascript
const extractors = {
  price: {
    patterns: [
      /(?:price|cost|asking|listed)[:\s]*\$?([\d,]+(?:\.\d{2})?)/gi,
      /\$\s*([\d,]+(?:\.\d{2})?)/g
    ],
    validator: (value) => {
      const num = parseFloat(value.replace(/,/g, ''));
      return num >= 10000 && num <= 50000000;
    }
  }
  // ... more extractors
};
```

### 3. Data Validation
Each extracted value is validated:
- **Price**: $10,000 - $50,000,000
- **Bedrooms**: 0-20
- **Bathrooms**: 0-20 (including .5 for half baths)
- **Square Feet**: 100-50,000
- **Year Built**: 1800-current year

## Timeline Example (Prompt Splitting)

```
Time 0:00 - User clicks "Analyze Property"
         ↓
Time 0:01 - Phase 1: Send instructions + confirmation request
         ↓ (currentPropertyAnalysis maintained)
Time 0:05 - ChatGPT responds: "Yes, I understand"
         ↓ (Confirmation detected, NOT processed as property data)
Time 0:06 - Phase 2: Send property link
         ↓ (currentPropertyAnalysis still maintained)
Time 0:30 - ChatGPT responds with property analysis
         ↓ (Property keywords detected, HAS active session)
Time 0:31 - Extract property details from analysis response
         ↓
Time 0:32 - Save extracted data and reset session
```

## Advantages of This Approach

### 1. **Accurate Data Source**
- Property details come ONLY from the response after the property link
- Confirmation responses are ignored for data extraction
- No cross-contamination between different response types

### 2. **Robust Session Management**
- Each property analysis has a unique session ID
- Session persists through all phases of prompt splitting
- Clear cleanup after successful extraction

### 3. **Better Link Processing**
- ChatGPT can focus on link fetching without instruction overload
- Separate phases reduce context confusion
- Fallback to single prompt if confirmation fails

### 4. **Enhanced Reliability**
- Multiple validation layers ensure data quality
- Timeout handling prevents stuck states
- Visual indicators show current phase

## Error Handling

### 1. **Confirmation Timeout**
```javascript
if (timeElapsed > promptSplittingState.confirmationTimeout) {
  handleConfirmationTimeout(); // Fall back to single prompt
}
```

### 2. **Analysis Timeout**
```javascript
setTimeout(() => {
  if (promptSplittingState.currentPhase === 'analyzing') {
    showPromptSplittingIndicator('timeout', 'Analysis timeout - please check manually');
    resetPromptSplittingState();
  }
}, 120000); // 2 minutes
```

### 3. **No Active Session**
```javascript
if (keywordMatches >= 2 && !currentPropertyAnalysis) {
  console.log('⚠️ Found property keywords but no active analysis session');
  // Don't process orphaned responses
}
```

## Verification

The system provides extensive logging to verify correct behavior:
- **Session Creation**: Unique session ID logged
- **Phase Transitions**: Each phase change logged with indicators
- **Response Processing**: Keyword matches and extraction results logged
- **Data Validation**: Validation results for each extracted field
- **Success/Failure**: Clear indicators of successful data extraction

## Status: ✅ ENHANCED

The property details extraction flow has been enhanced to:
- ✅ **Ensure data comes from property analysis responses only**
- ✅ **Maintain session tracking through prompt splitting phases**
- ✅ **Provide clear visual feedback on current phase**
- ✅ **Include robust error handling and timeouts**
- ✅ **Validate all extracted data for accuracy**

Property details are now guaranteed to be extracted from ChatGPT's response **after** the property link is sent, regardless of whether prompt splitting is used or not.