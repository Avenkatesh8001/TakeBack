# TakeBack Notification System
//Takeback notifications

A complete notification system for handling microphone muting notifications when users discuss blacklisted or non-whitelisted topics.

## 🚀 Quick Start

1. **Copy the files** to your project:
   - `notification.html`
   - `notification.css` 
   - `notification.js`

2. **Open `notification.html`** in your browser to test

3. **Integrate with your backend** by modifying the `sendToBackend()` method in `notification.js`

## 📁 Files Overview

| File | Purpose |
|------|---------|
| `notification.html` | Main HTML structure for the notification popup |
| `notification.css` | Dark theme styling with purple accents |
| `notification.js` | JavaScript functionality and API integration |
| `INTEGRATION_GUIDE.md` | Complete integration documentation |
| `API_SPECIFICATION.md` | Detailed API specification |
| `BACKEND_EXAMPLES.md` | Backend implementation examples |

## 🎯 Features

- **Dark theme** with purple accents matching your design
- **Three notification types**: blacklisted, non-whitelisted, flagged content
- **Interactive transcript panel** with show/hide functionality
- **Keyboard shortcuts** (Escape to close, Enter to confirm)
- **Responsive design** that works on all screen sizes
- **Backend integration ready** with multiple communication options

## 🔧 Integration

### Basic Usage
```javascript
// Show a blacklisted topic notification
window.takebackNotification.showBlacklistedTopic('confidential information', transcriptData);

// Show a non-whitelisted topic notification  
window.takebackNotification.showNonWhitelistedTopic('new topic', transcriptData);

// Show flagged content notification
window.takebackNotification.showFlaggedContent('sensitive content', transcriptData);
```

### Backend Integration
Replace the `sendToBackend()` method in `notification.js` with your API calls:

```javascript
sendToBackend(action, data) {
  fetch('/api/takeback/notification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, data })
  });
}
```

## 📋 API Actions

The system sends these actions to your backend:

- `add-to-whitelist` - User wants to add topic to whitelist
- `ignore-now` - User wants to ignore this instance
- `ignore-call` - User wants to ignore for entire call

## 🎨 Customization

### Colors
Modify CSS variables in `notification.css`:
```css
:root {
  --primary-bg: #282828;
  --accent-color: #8b5cf6;
  --text-color: #e2e8f0;
}
```

### Layout
Adjust the flexbox layout in the CSS for different arrangements.

## 🧪 Testing

1. **Manual Testing**: Open `notification.html` and uncomment the test line in `notification.js`
2. **API Testing**: Use the provided cURL examples in `BACKEND_EXAMPLES.md`
3. **Integration Testing**: Test with your actual backend endpoints

## 📚 Documentation

- **[Integration Guide](INTEGRATION_GUIDE.md)** - Complete setup and integration instructions
- **[API Specification](API_SPECIFICATION.md)** - Detailed API documentation
- **[Backend Examples](BACKEND_EXAMPLES.md)** - Implementation examples for Node.js, Python, PHP, Go

## 🔒 Security

- Input validation on all user data
- CSRF protection support
- Rate limiting recommendations
- XSS prevention measures

## 🌐 Browser Support

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## 📦 Dependencies

- **None!** Pure vanilla JavaScript, HTML, and CSS
- No external libraries required
- Lightweight (~15KB total)

## 🤝 Support

For integration help:
1. Check the documentation files
2. Review the backend examples
3. Test with the provided examples

## 📄 License

This notification system is ready for integration into your TakeBack application.