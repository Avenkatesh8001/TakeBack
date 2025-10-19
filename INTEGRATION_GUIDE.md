# TakeBack Notification System - Backend Integration Guide

## Overview
This notification system provides a user interface for handling microphone muting notifications when users discuss blacklisted or non-whitelisted topics. The system is designed to be easily integrated with any backend API.

## Files Structure
```
notification.html          # Main HTML structure
notification.css           # Styling (dark theme with purple accents)
notification.js            # JavaScript functionality and API calls
INTEGRATION_GUIDE.md       # This documentation
BACKEND_EXAMPLES.md        # Example backend implementations
API_SPECIFICATION.md       # Detailed API specification
```

## Quick Start

### 1. Basic Integration
```javascript
// Initialize the notification system
const notification = new TakeBackNotification();

// Show a notification when a blacklisted topic is detected
notification.showBlacklistedTopic('confidential information', transcriptData);
```

### 2. Backend Integration Points
The system sends data to your backend via the `sendToBackend()` method. You need to replace this method with your actual API calls.

**Current placeholder method:**
```javascript
sendToBackend(action, data) {
  // REPLACE THIS WITH YOUR ACTUAL API CALLS
  fetch('/api/takeback/notification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, data })
  });
}
```

## API Actions

The notification system sends these actions to your backend:

| Action | Description | Data Structure |
|--------|-------------|----------------|
| `add-to-whitelist` | User wants to add topic to whitelist | `{ topic: string, timestamp: string }` |
| `ignore-now` | User wants to ignore this instance | `{ topic: string, timestamp: string }` |
| `ignore-call` | User wants to ignore for entire call | `{ topic: string, timestamp: string }` |

## Notification Types

### 1. Blacklisted Topic
```javascript
notification.showBlacklistedTopic('confidential information', transcriptData);
```
- Shows: "We automatically muted your microphone because you talked about a blacklisted topic."
- Primary action: "Add topic to whitelist"

### 2. Non-Whitelisted Topic
```javascript
notification.showNonWhitelistedTopic('new topic', transcriptData);
```
- Shows: "We noticed that you talked about a non-whitelisted topic. Do you want to whitelist it?"
- Primary action: "Add topic to whitelist"

### 3. Flagged Content
```javascript
notification.showFlaggedContent('sensitive content', transcriptData);
```
- Shows: "We detected potentially sensitive content in your conversation."
- Primary action: "Add topic to whitelist"

## Transcript Data Format

The transcript can be provided in two formats:

### Simple String
```javascript
const transcript = "User said: This is confidential information about our project.";
notification.showBlacklistedTopic('confidential', transcript);
```

### Array of Lines (with flagging)
```javascript
const transcript = [
  { text: "This is normal conversation", flagged: false },
  { text: "This is confidential information", flagged: true },
  { text: "Back to normal conversation", flagged: false }
];
notification.showBlacklistedTopic('confidential', transcript);
```

## Backend Requirements

Your backend should handle these endpoints:

### POST /api/takeback/notification
**Request Body:**
```json
{
  "action": "add-to-whitelist",
  "data": {
    "topic": "confidential information",
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Topic added to whitelist successfully"
}
```

## Integration Steps

1. **Copy the files** to your project
2. **Replace the `sendToBackend()` method** in `notification.js` with your API calls
3. **Implement the backend endpoints** to handle the notification actions
4. **Test the integration** with different notification types
5. **Customize styling** if needed in `notification.css`

## Customization

### Styling
- **Colors**: Modify CSS variables in `notification.css`
- **Layout**: Adjust the flexbox layout in the CSS
- **Animations**: Customize the keyframe animations

### Functionality
- **Add new notification types**: Extend the `show()` method
- **Add new actions**: Add new buttons and handlers
- **Modify transcript display**: Update the `setTranscriptContent()` method

## Error Handling

The system includes basic error handling, but you should add your own:

```javascript
sendToBackend(action, data) {
  fetch('/api/takeback/notification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, data })
  })
  .then(response => response.json())
  .then(result => {
    if (!result.success) {
      console.error('Backend error:', result.message);
      // Handle error (show user feedback, retry, etc.)
    }
  })
  .catch(error => {
    console.error('Network error:', error);
    // Handle network error
  });
}
```

## Testing

### Manual Testing
1. Open `notification.html` in a browser
2. Uncomment the test line in `notification.js`:
   ```javascript
   setTimeout(showExampleNotification, 1000);
   ```
3. Test all buttons and interactions

### Automated Testing
Create unit tests for the `TakeBackNotification` class methods.

## Browser Compatibility

- **Modern browsers**: Chrome, Firefox, Safari, Edge (latest versions)
- **Features used**: ES6 classes, fetch API, CSS Grid, Flexbox
- **Fallbacks**: Basic functionality works without modern features

## Security Considerations

- **Input validation**: Validate all data sent to backend
- **XSS prevention**: Sanitize transcript content before display
- **CSRF protection**: Include CSRF tokens in API requests
- **Rate limiting**: Implement rate limiting on backend endpoints

## Performance

- **Lightweight**: ~15KB total (HTML + CSS + JS)
- **No external dependencies**: Pure vanilla JavaScript
- **Efficient rendering**: Uses CSS transforms for animations
- **Memory management**: Properly cleans up event listeners

## Support

For questions or issues:
1. Check the API specification in `API_SPECIFICATION.md`
2. Review the backend examples in `BACKEND_EXAMPLES.md`
3. Test with the provided example code

