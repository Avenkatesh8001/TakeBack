# TakeBack Notification System - API Specification
//readme for api usage
## Overview
This document defines the API interface between the TakeBack notification system and your backend. The notification system sends user actions to your backend for processing.

## API Endpoints

### POST /api/takeback/notification

**Purpose**: Handle user actions from the notification popup

**Request Headers**:
```
Content-Type: application/json
Authorization: Bearer <token> (optional)
X-CSRF-Token: <token> (recommended)
```

**Request Body**:
```json
{
  "action": "string",
  "data": {
    "topic": "string",
    "timestamp": "string (ISO 8601)",
    "sessionId": "string (optional)",
    "userId": "string (optional)"
  }
}
```

## Action Types

### 1. add-to-whitelist
**Description**: User wants to add the detected topic to their whitelist

**Request Example**:
```json
{
  "action": "add-to-whitelist",
  "data": {
    "topic": "confidential information",
    "timestamp": "2024-01-01T12:00:00.000Z",
    "sessionId": "session_123",
    "userId": "user_456"
  }
}
```

**Backend Processing**:
- Add topic to user's whitelist
- Update user preferences
- Log the action for analytics

**Response**:
```json
{
  "success": true,
  "message": "Topic added to whitelist successfully",
  "data": {
    "whitelistUpdated": true,
    "newWhitelistSize": 15
  }
}
```

### 2. ignore-now
**Description**: User wants to ignore this specific instance of the topic

**Request Example**:
```json
{
  "action": "ignore-now",
  "data": {
    "topic": "confidential information",
    "timestamp": "2024-01-01T12:00:00.000Z",
    "sessionId": "session_123",
    "userId": "user_456"
  }
}
```

**Backend Processing**:
- Log the ignore action
- Continue monitoring for this topic
- No changes to whitelist/blacklist

**Response**:
```json
{
  "success": true,
  "message": "Topic ignored for this instance",
  "data": {
    "ignored": true,
    "continueMonitoring": true
  }
}
```

### 3. ignore-call
**Description**: User wants to ignore this topic for the entire call/session

**Request Example**:
```json
{
  "action": "ignore-call",
  "data": {
    "topic": "confidential information",
    "timestamp": "2024-01-01T12:00:00.000Z",
    "sessionId": "session_123",
    "userId": "user_456"
  }
}
```

**Backend Processing**:
- Add topic to session ignore list
- Stop monitoring this topic for current session
- Log the action

**Response**:
```json
{
  "success": true,
  "message": "Topic ignored for this call",
  "data": {
    "ignoredForSession": true,
    "sessionIgnoreList": ["confidential information", "other topic"]
  }
}
```

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "error": "INVALID_ACTION",
  "message": "Invalid action type provided",
  "details": {
    "validActions": ["add-to-whitelist", "ignore-now", "ignore-call"]
  }
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "error": "UNAUTHORIZED",
  "message": "Authentication required"
}
```

### 422 Unprocessable Entity
```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "Invalid request data",
  "details": {
    "field": "topic",
    "issue": "Topic cannot be empty"
  }
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "INTERNAL_ERROR",
  "message": "An unexpected error occurred",
  "requestId": "req_123456789"
}
```

## Data Validation

### Required Fields
- `action`: Must be one of the valid action types
- `data.topic`: Non-empty string, max 500 characters
- `data.timestamp`: Valid ISO 8601 timestamp

### Optional Fields
- `data.sessionId`: String identifier for the current session
- `data.userId`: String identifier for the user
- `data.callId`: String identifier for the call/meeting

### Validation Rules
```javascript
// Example validation logic
const validateRequest = (request) => {
  const validActions = ['add-to-whitelist', 'ignore-now', 'ignore-call'];
  
  if (!validActions.includes(request.action)) {
    throw new Error('Invalid action type');
  }
  
  if (!request.data.topic || request.data.topic.length === 0) {
    throw new Error('Topic cannot be empty');
  }
  
  if (request.data.topic.length > 500) {
    throw new Error('Topic too long');
  }
  
  if (!isValidTimestamp(request.data.timestamp)) {
    throw new Error('Invalid timestamp format');
  }
};
```

## Rate Limiting

**Recommended Limits**:
- 10 requests per minute per user
- 100 requests per hour per user
- 1000 requests per day per user

**Rate Limit Headers**:
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 9
X-RateLimit-Reset: 1640995200
```

## Authentication

### Option 1: Bearer Token
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Option 2: API Key
```
X-API-Key: your-api-key-here
```

### Option 3: Session Cookie
```
Cookie: session_id=abc123; user_token=xyz789
```

## Webhook Integration (Optional)

If you want real-time updates back to the notification system:

### POST /api/takeback/webhook
**Purpose**: Send updates back to the notification system

**Request Body**:
```json
{
  "type": "whitelist-updated",
  "data": {
    "userId": "user_456",
    "whitelist": ["topic1", "topic2", "topic3"],
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

## Database Schema Suggestions

### Users Table
```sql
CREATE TABLE users (
  id VARCHAR(255) PRIMARY KEY,
  email VARCHAR(255) UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Whitelist Table
```sql
CREATE TABLE user_whitelist (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(255),
  topic VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### Blacklist Table
```sql
CREATE TABLE user_blacklist (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(255),
  topic VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### Notification Logs Table
```sql
CREATE TABLE notification_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(255),
  session_id VARCHAR(255),
  action VARCHAR(50),
  topic VARCHAR(500),
  timestamp TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

## Testing

### Test Cases

1. **Valid add-to-whitelist request**
2. **Valid ignore-now request**
3. **Valid ignore-call request**
4. **Invalid action type**
5. **Missing required fields**
6. **Invalid timestamp format**
7. **Topic too long**
8. **Unauthorized request**
9. **Rate limit exceeded**

### Example Test Script
```javascript
// Test script for API endpoints
const testNotificationAPI = async () => {
  const baseURL = 'https://your-api.com/api/takeback';
  
  const testCases = [
    {
      name: 'Add to whitelist',
      action: 'add-to-whitelist',
      data: { topic: 'test topic', timestamp: new Date().toISOString() }
    },
    {
      name: 'Ignore now',
      action: 'ignore-now',
      data: { topic: 'test topic', timestamp: new Date().toISOString() }
    },
    {
      name: 'Ignore call',
      action: 'ignore-call',
      data: { topic: 'test topic', timestamp: new Date().toISOString() }
    }
  ];
  
  for (const testCase of testCases) {
    try {
      const response = await fetch(`${baseURL}/notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testCase)
      });
      
      const result = await response.json();
      console.log(`${testCase.name}:`, result);
    } catch (error) {
      console.error(`${testCase.name} failed:`, error);
    }
  }
};
```

## Security Considerations

1. **Input Sanitization**: Sanitize all input data
2. **SQL Injection Prevention**: Use parameterized queries
3. **XSS Prevention**: Escape output data
4. **CSRF Protection**: Implement CSRF tokens
5. **Rate Limiting**: Prevent abuse
6. **Authentication**: Verify user identity
7. **Authorization**: Check user permissions
8. **Logging**: Log all actions for audit trails

