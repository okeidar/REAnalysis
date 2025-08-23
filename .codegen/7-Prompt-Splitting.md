# Context
When embedding property links into long, detailed prompts, ChatGPT often fails to fetch the website data properly. This is because the long prompt context overwhelms the link processing mechanism. We need to implement a solution that splits the prompt into two parts: instructions and link, while maintaining synchronization and ensuring the analysis is still performed correctly.

# Requirements
- **Split Prompt Strategy**: Separate instructions from the property link
- **Synchronization**: Ensure both parts work together seamlessly
- **Reliability**: Improve success rate of website data fetching
- **User Experience**: Maintain smooth workflow without manual intervention
- **Fallback Handling**: Handle cases where the split approach fails
- **Monitoring**: Track success rates and prompt delivery status

# Research Tasks
- [ ] Analyze ChatGPT's link processing limitations with long prompts
- [ ] Study optimal prompt length for link fetching
- [ ] Research ChatGPT's response patterns to "Say yes if you understand"
- [ ] Identify timing requirements for prompt splitting
- [ ] Analyze ChatGPT's context window limitations
- [ ] Study alternative prompt splitting strategies
- [ ] Research error handling patterns for failed link fetching

# Implementation Tasks

## Prompt Splitting Strategy
- [ ] **Two-Phase Approach**
  - [ ] Phase 1: Send instructions with "Say yes if you understand"
  - [ ] Phase 2: Send property link after confirmation
  - [ ] Implement confirmation detection
  - [ ] Handle timeout scenarios

- [ ] **Alternative Strategies**
  - [ ] Progressive prompt building
  - [ ] Context window optimization
  - [ ] Link preprocessing
  - [ ] Retry mechanisms

## Synchronization System
- [ ] **State Management**
  - [ ] Track prompt delivery status
  - [ ] Monitor ChatGPT responses
  - [ ] Handle response timing
  - [ ] Manage conversation flow

- [ ] **Confirmation Detection**
  - [ ] Parse ChatGPT responses for confirmation
  - [ ] Handle various confirmation formats
  - [ ] Implement timeout handling
  - [ ] Detect failed confirmations

## Enhanced Content Script
- [ ] **Prompt Splitting Logic**
  - [ ] Split long prompts into manageable chunks
  - [ ] Implement instruction-first approach
  - [ ] Add confirmation waiting mechanism
  - [ ] Handle link delivery timing

- [ ] **Response Monitoring**
  - [ ] Enhanced message detection
  - [ ] Confirmation response parsing
  - [ ] Link processing status tracking
  - [ ] Error detection and recovery

## Error Handling & Recovery
- [ ] **Failure Scenarios**
  - [ ] ChatGPT doesn't respond to confirmation
  - [ ] Link fetching still fails after splitting
  - [ ] Response parsing errors
  - [ ] Timeout scenarios

- [ ] **Recovery Mechanisms**
  - [ ] Automatic retry with different strategies
  - [ ] Fallback to single prompt approach
  - [ ] User notification of issues
  - [ ] Manual intervention options

# Technical Implementation

## Prompt Splitting Strategy
- **Two-Phase Delivery**: Implement a system that sends instructions first, then property link after confirmation
- **Confirmation Detection**: Create logic to detect ChatGPT's acknowledgment responses
- **Timeout Handling**: Implement configurable timeout for confirmation waiting
- **Retry Logic**: Add retry mechanisms with different strategies

## Content Script Enhancements
- **Strategy Selection**: Implement logic to determine when prompt splitting is beneficial
- **Prompt Analysis**: Create functions to analyze prompt length and complexity
- **State Management**: Track the current phase of prompt delivery
- **Response Monitoring**: Enhanced monitoring for confirmation responses

## Settings and Configuration
- **User Preferences**: Allow users to enable/disable prompt splitting
- **Threshold Configuration**: Configurable prompt length threshold for splitting
- **Timeout Settings**: Adjustable confirmation wait time
- **Fallback Options**: Settings for automatic fallback behavior

## Performance Tracking
- **Success Metrics**: Track success rates of different strategies
- **Strategy Analytics**: Monitor effectiveness of split vs single approaches
- **Recommendation Engine**: Suggest optimal strategy based on historical data
- **Performance Reporting**: Provide insights on system effectiveness

# UI Components

## Status Indicators
- **Phase Display**: Show current phase of prompt delivery process
- **Progress Indicators**: Visual feedback for each step (instructions, confirmation, link, analysis)
- **Status Messages**: Clear text descriptions of current activity
- **Error States**: Visual indicators for failed attempts or timeouts

## Settings Panel
- **Enable/Disable Toggle**: Allow users to turn prompt splitting on/off
- **Length Threshold Slider**: Configurable prompt length for splitting decision
- **Timeout Configuration**: Adjustable confirmation wait time
- **Fallback Options**: Settings for automatic fallback behavior
- **Performance Metrics**: Display success rates and recommendations

# Success Criteria
- [ ] Prompt splitting successfully improves link fetching success rate
- [ ] Synchronization between instruction and link prompts works reliably
- [ ] Confirmation detection accurately identifies ChatGPT's responses
- [ ] Fallback mechanisms handle edge cases gracefully
- [ ] User experience remains smooth and intuitive
- [ ] Success rates are tracked and reported
- [ ] Settings allow users to configure splitting behavior
- [ ] Performance impact is minimal
- [ ] Error handling provides clear feedback to users
- [ ] System automatically chooses optimal strategy based on prompt length

# Status: 🔄 IN PROGRESS
The prompt splitting enhancement project is being designed and implemented. The goal is to solve the issue where long prompts with embedded links cause ChatGPT to fail fetching website data by implementing a two-phase approach that separates instructions from property links.

# Technical Notes
- Prompt splitting uses a "Say yes if you understand" confirmation approach
- System monitors ChatGPT responses for confirmation before sending property link
- Fallback mechanisms ensure reliability when splitting fails
- Success tracking helps optimize strategy selection
- Settings allow users to configure splitting behavior
- Performance monitoring tracks success rates of different approaches
- Error handling provides graceful degradation to single prompt method
- UI indicators show current phase of the prompt delivery process
