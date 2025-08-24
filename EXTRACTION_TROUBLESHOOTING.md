# ChatGPT Data Extraction Troubleshooting Guide

## 🚀 Quick Diagnosis

If the data extraction isn't working, run this command in the browser console on ChatGPT:

```javascript
diagnoseProblem()
```

This will check:
- ✅ Extension status
- ✅ ChatGPT message detection  
- ✅ Keyword matching
- ✅ Extraction testing
- ✅ Session state

## 🔧 Common Issues & Solutions

### 1. **No Extraction at All**

**Symptoms**: No data appears in the extension, no console logs
**Diagnosis**: Run `diagnoseProblem()`

**Possible Causes**:
- Extension not properly loaded
- Wrong ChatGPT site (check URL)
- Content script injection failed

**Solutions**:
- Reload the extension
- Refresh the ChatGPT page
- Check if you're on `chatgpt.com`

### 2. **Extraction Runs But No Data Found**

**Symptoms**: Console shows extraction logs but extractedData is empty
**Diagnosis**: Run `testCurrentExtraction()`

**Possible Causes**:
- ChatGPT response format different than expected
- Validation rules too strict
- Pattern matching failures

**Solutions**:
- Check console for validation failure logs
- Look for `❌ Street name validation failed` or `❌ Price validation failed`
- Use `forceExtractCurrent()` to bypass session tracking

### 3. **Partial Data Extraction**

**Symptoms**: Some fields extracted, others missing
**Diagnosis**: Check validation logs in console

**Possible Causes**:
- Specific field validation failures
- Pattern not matching ChatGPT format
- Text formatting issues

**Solutions**:
- Look at the detailed validation logs
- Test with `quickTestPatterns()` for common formats

### 4. **Session Tracking Issues**

**Symptoms**: Console shows "No active property analysis session"
**Diagnosis**: Run `forceExtractCurrent()` to bypass

**Possible Causes**:
- Property analysis session not initiated properly
- URL tracking confusion
- Prompt splitting state issues

**Solutions**:
- Use manual extraction: `forceExtractCurrent()`
- Analyze property again through the extension popup

## 🧪 Debug Tools Available

### `diagnoseProblem()`
Comprehensive diagnosis of the entire extraction system
```javascript
diagnoseProblem()
```

### `testCurrentExtraction()`
Test extraction on the current ChatGPT response
```javascript
testCurrentExtraction()
```

### `forceExtractCurrent()`
Force extraction bypassing all session tracking
```javascript
forceExtractCurrent()
```

### `quickTestPatterns()`
Test pattern matching with common examples
```javascript
quickTestPatterns()
```

### `testPropertyExtraction(text)`
Test extraction on custom text
```javascript
testPropertyExtraction("Your custom ChatGPT response text here")
```

## 📋 Step-by-Step Troubleshooting

### Step 1: Basic Check
1. Open browser console (F12)
2. Run: `diagnoseProblem()`
3. Check the output for any obvious issues

### Step 2: Message Detection
1. Verify "Total assistant messages found" > 0
2. Check "Last message length" > 100
3. Ensure "Keyword count" >= 2

### Step 3: Manual Extraction Test
1. Run: `testCurrentExtraction()`
2. Look for extraction logs starting with 🔍, ✅, ❌
3. Check if validation passes or fails

### Step 4: Force Extraction (if needed)
1. Run: `forceExtractCurrent()`
2. Enter a property URL when prompted
3. This bypasses all session tracking

### Step 5: Pattern Testing
1. Run: `quickTestPatterns()`
2. Test specific patterns that aren't working
3. Compare with your ChatGPT response format

## 🔍 What to Look For in Console

### ✅ **Good Signs**:
```
✅ Found structured PROPERTY DETAILS section
✅ Extracted streetName from Property Details: 123 Main Street
✅ Extracted price from Property Details: 450000
✅ Street name validation passed for "123 Main Street"  
✅ Price validation passed for "450000" → 450000
```

### ❌ **Problem Signs**:
```
❌ Failed to extract streetName from Property Details section
❌ Street name validation failed for "property": hasNumber: false
❌ Price validation failed for "asking": isNumber: false
⚠️ No active property analysis session
⚠️ Insufficient property keywords in completed response
```

## 🐛 Common Response Format Issues

### Issue: Address Not Found
**ChatGPT says**: "The property is located in downtown"
**Problem**: No street number or street name
**Solution**: Ask ChatGPT to be more specific about the address

### Issue: Price Format Not Recognized
**ChatGPT says**: "This costs four hundred fifty thousand"
**Problem**: Written numbers not recognized
**Solution**: Patterns expect numeric format like $450,000 or 450K

### Issue: Missing Structured Sections
**ChatGPT gives**: Unstructured response
**Problem**: Expected **PROPERTY DETAILS:** section format
**Solution**: Ensure you're using the extension's prompt or ask ChatGPT to structure the response

## 🚀 Advanced Debugging

### Check Raw Response Text
```javascript
const messages = document.querySelectorAll('[data-message-author-role="assistant"]');
const lastMessage = messages[messages.length - 1];
const text = lastMessage.textContent;
console.log('Raw response:', text);
```

### Test Specific Patterns
```javascript
const text = "Property Price: $450,000";
const patterns = [
  /(?:property\s+price|price)[:\s-]*\$?\s*([\d,]+(?:\.\d{2})?)/gi,
  /\$\s*([\d,]+(?:\.\d{2})?)\b/g
];
patterns.forEach((p, i) => {
  console.log(`Pattern ${i+1}:`, text.match(p));
});
```

### Check Validation Rules
```javascript
// Test street name validation
const testAddress = "123 Main Street";
const hasNumber = testAddress.match(/\d/);
const validLength = testAddress.length >= 5 && testAddress.length <= 120;
console.log('Address validation:', { testAddress, hasNumber: !!hasNumber, validLength });
```

## 💡 Pro Tips

1. **Always check the browser console** - It shows detailed extraction logs
2. **Use the diagnostic functions** - They're specifically designed to find issues
3. **Test extraction manually** - Use `forceExtractCurrent()` to bypass automation
4. **Check ChatGPT response format** - Ensure it includes structured data
5. **Look for validation failures** - Most issues are validation-related, not pattern-related

## 📞 Still Having Issues?

If none of these steps help:

1. Run `diagnoseProblem()` and copy the full console output
2. Copy the ChatGPT response text that's not working
3. Note what specific fields are failing to extract
4. Check for any JavaScript errors in the console

The detailed console logs will show exactly where the extraction is failing and why.