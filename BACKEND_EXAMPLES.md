# TakeBack Notification System - Backend Implementation Examples
//examples that model is trained on
## Overview
This document provides example backend implementations for different frameworks and languages to help you integrate the TakeBack notification system.

## Node.js + Express Example

### 1. Basic Express Server
```javascript
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/takeback', limiter);

// Notification endpoint
app.post('/api/takeback/notification', async (req, res) => {
  try {
    const { action, data } = req.body;
    
    // Validate request
    if (!action || !data || !data.topic || !data.timestamp) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Missing required fields'
      });
    }
    
    // Process based on action
    switch (action) {
      case 'add-to-whitelist':
        await addToWhitelist(data);
        break;
      case 'ignore-now':
        await logIgnoreAction(data);
        break;
      case 'ignore-call':
        await ignoreForCall(data);
        break;
      default:
        return res.status(400).json({
          success: false,
          error: 'INVALID_ACTION',
          message: 'Invalid action type'
        });
    }
    
    res.json({
      success: true,
      message: 'Action processed successfully'
    });
    
  } catch (error) {
    console.error('Notification error:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred'
    });
  }
});

// Helper functions
async function addToWhitelist(data) {
  // Add to database
  console.log('Adding to whitelist:', data.topic);
  // Your database logic here
}

async function logIgnoreAction(data) {
  // Log the ignore action
  console.log('Ignoring topic:', data.topic);
  // Your logging logic here
}

async function ignoreForCall(data) {
  // Add to session ignore list
  console.log('Ignoring for call:', data.topic);
  // Your session management logic here
}

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

### 2. With Database Integration (MongoDB)
```javascript
const mongoose = require('mongoose');

// User schema
const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  whitelist: [String],
  blacklist: [String],
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Notification log schema
const notificationLogSchema = new mongoose.Schema({
  userId: String,
  sessionId: String,
  action: String,
  topic: String,
  timestamp: Date,
  createdAt: { type: Date, default: Date.now }
});

const NotificationLog = mongoose.model('NotificationLog', notificationLogSchema);

// Updated endpoint with database
app.post('/api/takeback/notification', async (req, res) => {
  try {
    const { action, data } = req.body;
    
    // Log the notification
    await NotificationLog.create({
      userId: data.userId,
      sessionId: data.sessionId,
      action: action,
      topic: data.topic,
      timestamp: new Date(data.timestamp)
    });
    
    // Process action
    if (action === 'add-to-whitelist') {
      await User.findOneAndUpdate(
        { userId: data.userId },
        { $addToSet: { whitelist: data.topic } },
        { upsert: true }
      );
    }
    
    res.json({ success: true, message: 'Action processed successfully' });
    
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({
      success: false,
      error: 'DATABASE_ERROR',
      message: 'Database operation failed'
    });
  }
});
```

## Python + Flask Example

### 1. Basic Flask Server
```python
from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime
import logging

app = Flask(__name__)
CORS(app)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@app.route('/api/takeback/notification', methods=['POST'])
def handle_notification():
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'VALIDATION_ERROR',
                'message': 'No JSON data provided'
            }), 400
        
        action = data.get('action')
        notification_data = data.get('data', {})
        
        # Validate required fields
        if not action or not notification_data.get('topic'):
            return jsonify({
                'success': False,
                'error': 'VALIDATION_ERROR',
                'message': 'Missing required fields'
            }), 400
        
        # Process action
        if action == 'add-to-whitelist':
            result = add_to_whitelist(notification_data)
        elif action == 'ignore-now':
            result = log_ignore_action(notification_data)
        elif action == 'ignore-call':
            result = ignore_for_call(notification_data)
        else:
            return jsonify({
                'success': False,
                'error': 'INVALID_ACTION',
                'message': 'Invalid action type'
            }), 400
        
        logger.info(f"Processed {action} for topic: {notification_data.get('topic')}")
        
        return jsonify({
            'success': True,
            'message': 'Action processed successfully',
            'data': result
        })
        
    except Exception as e:
        logger.error(f"Notification error: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'INTERNAL_ERROR',
            'message': 'An unexpected error occurred'
        }), 500

def add_to_whitelist(data):
    """Add topic to user's whitelist"""
    topic = data.get('topic')
    user_id = data.get('userId')
    
    # Your database logic here
    logger.info(f"Adding '{topic}' to whitelist for user {user_id}")
    
    return {'whitelistUpdated': True}

def log_ignore_action(data):
    """Log ignore action"""
    topic = data.get('topic')
    user_id = data.get('userId')
    
    # Your logging logic here
    logger.info(f"Ignoring '{topic}' for user {user_id}")
    
    return {'ignored': True}

def ignore_for_call(data):
    """Ignore topic for entire call"""
    topic = data.get('topic')
    session_id = data.get('sessionId')
    
    # Your session management logic here
    logger.info(f"Ignoring '{topic}' for session {session_id}")
    
    return {'ignoredForSession': True}

if __name__ == '__main__':
    app.run(debug=True, port=5000)
```

### 2. With SQLAlchemy (PostgreSQL)
```python
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from datetime import datetime

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://user:password@localhost/takeback'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
CORS(app)

# Models
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(255), unique=True, nullable=False)
    whitelist = db.Column(db.JSON, default=list)
    blacklist = db.Column(db.JSON, default=list)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class NotificationLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(255))
    session_id = db.Column(db.String(255))
    action = db.Column(db.String(50))
    topic = db.Column(db.String(500))
    timestamp = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

@app.route('/api/takeback/notification', methods=['POST'])
def handle_notification():
    try:
        data = request.get_json()
        action = data.get('action')
        notification_data = data.get('data', {})
        
        # Log the notification
        log_entry = NotificationLog(
            user_id=notification_data.get('userId'),
            session_id=notification_data.get('sessionId'),
            action=action,
            topic=notification_data.get('topic'),
            timestamp=datetime.fromisoformat(notification_data.get('timestamp').replace('Z', '+00:00'))
        )
        db.session.add(log_entry)
        
        # Process action
        if action == 'add-to-whitelist':
            user = User.query.filter_by(user_id=notification_data.get('userId')).first()
            if not user:
                user = User(user_id=notification_data.get('userId'))
                db.session.add(user)
            
            if notification_data.get('topic') not in user.whitelist:
                user.whitelist.append(notification_data.get('topic'))
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Action processed successfully'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': 'INTERNAL_ERROR',
            'message': str(e)
        }), 500
```

## PHP + Laravel Example

### 1. Controller
```php
<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class TakeBackController extends Controller
{
    public function handleNotification(Request $request)
    {
        // Validate request
        $validator = Validator::make($request->all(), [
            'action' => 'required|in:add-to-whitelist,ignore-now,ignore-call',
            'data.topic' => 'required|string|max:500',
            'data.timestamp' => 'required|date',
            'data.userId' => 'nullable|string',
            'data.sessionId' => 'nullable|string'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'VALIDATION_ERROR',
                'message' => 'Invalid request data',
                'details' => $validator->errors()
            ], 400);
        }

        try {
            $action = $request->input('action');
            $data = $request->input('data');

            // Log the notification
            DB::table('notification_logs')->insert([
                'user_id' => $data['userId'] ?? null,
                'session_id' => $data['sessionId'] ?? null,
                'action' => $action,
                'topic' => $data['topic'],
                'timestamp' => $data['timestamp'],
                'created_at' => now()
            ]);

            // Process action
            switch ($action) {
                case 'add-to-whitelist':
                    $this->addToWhitelist($data);
                    break;
                case 'ignore-now':
                    $this->logIgnoreAction($data);
                    break;
                case 'ignore-call':
                    $this->ignoreForCall($data);
                    break;
            }

            return response()->json([
                'success' => true,
                'message' => 'Action processed successfully'
            ]);

        } catch (\Exception $e) {
            Log::error('TakeBack notification error: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'error' => 'INTERNAL_ERROR',
                'message' => 'An unexpected error occurred'
            ], 500);
        }
    }

    private function addToWhitelist($data)
    {
        $userId = $data['userId'] ?? null;
        $topic = $data['topic'];

        if ($userId) {
            $user = DB::table('users')->where('user_id', $userId)->first();
            
            if ($user) {
                $whitelist = json_decode($user->whitelist, true) ?? [];
                if (!in_array($topic, $whitelist)) {
                    $whitelist[] = $topic;
                    DB::table('users')
                        ->where('user_id', $userId)
                        ->update(['whitelist' => json_encode($whitelist)]);
                }
            } else {
                DB::table('users')->insert([
                    'user_id' => $userId,
                    'whitelist' => json_encode([$topic]),
                    'created_at' => now()
                ]);
            }
        }
    }

    private function logIgnoreAction($data)
    {
        Log::info('Topic ignored for now', [
            'topic' => $data['topic'],
            'userId' => $data['userId'] ?? null
        ]);
    }

    private function ignoreForCall($data)
    {
        $sessionId = $data['sessionId'] ?? null;
        $topic = $data['topic'];

        if ($sessionId) {
            // Add to session ignore list
            DB::table('session_ignores')->insert([
                'session_id' => $sessionId,
                'topic' => $topic,
                'created_at' => now()
            ]);
        }
    }
}
```

### 2. Routes
```php
<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\TakeBackController;

Route::post('/api/takeback/notification', [TakeBackController::class, 'handleNotification']);
```

## Go + Gin Example

```go
package main

import (
    "net/http"
    "time"
    "log"
    
    "github.com/gin-gonic/gin"
    "github.com/gin-contrib/cors"
)

type NotificationRequest struct {
    Action string `json:"action" binding:"required"`
    Data   struct {
        Topic     string `json:"topic" binding:"required"`
        Timestamp string `json:"timestamp" binding:"required"`
        UserID    string `json:"userId,omitempty"`
        SessionID string `json:"sessionId,omitempty"`
    } `json:"data" binding:"required"`
}

type NotificationResponse struct {
    Success bool   `json:"success"`
    Message string `json:"message"`
    Error   string `json:"error,omitempty"`
}

func main() {
    r := gin.Default()
    
    // CORS middleware
    r.Use(cors.Default())
    
    // Rate limiting middleware
    r.Use(rateLimitMiddleware())
    
    r.POST("/api/takeback/notification", handleNotification)
    
    r.Run(":8080")
}

func handleNotification(c *gin.Context) {
    var req NotificationRequest
    
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, NotificationResponse{
            Success: false,
            Error:   "VALIDATION_ERROR",
            Message: "Invalid request data",
        })
        return
    }
    
    // Validate action
    validActions := map[string]bool{
        "add-to-whitelist": true,
        "ignore-now":       true,
        "ignore-call":      true,
    }
    
    if !validActions[req.Action] {
        c.JSON(http.StatusBadRequest, NotificationResponse{
            Success: false,
            Error:   "INVALID_ACTION",
            Message: "Invalid action type",
        })
        return
    }
    
    // Process action
    switch req.Action {
    case "add-to-whitelist":
        addToWhitelist(req.Data)
    case "ignore-now":
        logIgnoreAction(req.Data)
    case "ignore-call":
        ignoreForCall(req.Data)
    }
    
    log.Printf("Processed %s for topic: %s", req.Action, req.Data.Topic)
    
    c.JSON(http.StatusOK, NotificationResponse{
        Success: true,
        Message: "Action processed successfully",
    })
}

func addToWhitelist(data struct {
    Topic     string `json:"topic"`
    Timestamp string `json:"timestamp"`
    UserID    string `json:"userId,omitempty"`
    SessionID string `json:"sessionId,omitempty"`
}) {
    // Your database logic here
    log.Printf("Adding '%s' to whitelist for user %s", data.Topic, data.UserID)
}

func logIgnoreAction(data struct {
    Topic     string `json:"topic"`
    Timestamp string `json:"timestamp"`
    UserID    string `json:"userId,omitempty"`
    SessionID string `json:"sessionId,omitempty"`
}) {
    // Your logging logic here
    log.Printf("Ignoring '%s' for user %s", data.Topic, data.UserID)
}

func ignoreForCall(data struct {
    Topic     string `json:"topic"`
    Timestamp string `json:"timestamp"`
    UserID    string `json:"userId,omitempty"`
    SessionID string `json:"sessionId,omitempty"`
}) {
    // Your session management logic here
    log.Printf("Ignoring '%s' for session %s", data.Topic, data.SessionID)
}

func rateLimitMiddleware() gin.HandlerFunc {
    // Simple rate limiting implementation
    return gin.HandlerFunc(func(c *gin.Context) {
        // Your rate limiting logic here
        c.Next()
    })
}
```

## Testing Examples

### 1. cURL Tests
```bash
# Test add-to-whitelist
curl -X POST http://localhost:3000/api/takeback/notification \
  -H "Content-Type: application/json" \
  -d '{
    "action": "add-to-whitelist",
    "data": {
      "topic": "confidential information",
      "timestamp": "2024-01-01T12:00:00.000Z",
      "userId": "user123"
    }
  }'

# Test ignore-now
curl -X POST http://localhost:3000/api/takeback/notification \
  -H "Content-Type: application/json" \
  -d '{
    "action": "ignore-now",
    "data": {
      "topic": "test topic",
      "timestamp": "2024-01-01T12:00:00.000Z"
    }
  }'

# Test ignore-call
curl -X POST http://localhost:3000/api/takeback/notification \
  -H "Content-Type: application/json" \
  -d '{
    "action": "ignore-call",
    "data": {
      "topic": "test topic",
      "timestamp": "2024-01-01T12:00:00.000Z",
      "sessionId": "session123"
    }
  }'
```

### 2. JavaScript Test Suite
```javascript
const testAPI = async () => {
  const baseURL = 'http://localhost:3000/api/takeback';
  
  const testCases = [
    {
      name: 'Add to whitelist',
      data: {
        action: 'add-to-whitelist',
        data: {
          topic: 'confidential information',
          timestamp: new Date().toISOString(),
          userId: 'test-user-123'
        }
      }
    },
    {
      name: 'Ignore now',
      data: {
        action: 'ignore-now',
        data: {
          topic: 'test topic',
          timestamp: new Date().toISOString()
        }
      }
    },
    {
      name: 'Ignore call',
      data: {
        action: 'ignore-call',
        data: {
          topic: 'test topic',
          timestamp: new Date().toISOString(),
          sessionId: 'test-session-123'
        }
      }
    }
  ];
  
  for (const testCase of testCases) {
    try {
      const response = await fetch(`${baseURL}/notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testCase.data)
      });
      
      const result = await response.json();
      console.log(`${testCase.name}:`, result);
    } catch (error) {
      console.error(`${testCase.name} failed:`, error);
    }
  }
};

// Run tests
testAPI();
```

## Deployment Considerations

### 1. Environment Variables
```bash
# Database
DATABASE_URL=postgresql://user:password@localhost/takeback
REDIS_URL=redis://localhost:6379

# API
API_PORT=3000
API_HOST=0.0.0.0

# Security
JWT_SECRET=your-jwt-secret
CORS_ORIGIN=https://yourdomain.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 2. Docker Configuration
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
```

### 3. Health Check Endpoint
```javascript
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});
```

These examples provide a solid foundation for integrating the TakeBack notification system with your backend. Choose the language and framework that best fits your existing infrastructure.

