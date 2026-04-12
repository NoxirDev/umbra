# UMBRA API v2 Documentation

**Professional REST + WebSocket API for stream overlays**

Base URL: `http://127.0.0.1:4587`
WebSocket: `ws://127.0.0.1:4587`

---

## 🔑 Authentication

All requests require API key authentication:

**HTTP Headers:**
```
X-API-Key: your_api_key_here
```

Or:
```
Authorization: Bearer your_api_key_here
```

**WebSocket:**
```
ws://127.0.0.1:4587?key=your_api_key_here
```

Get your API key from UMBRA Settings → API tab.

---

## 📡 REST API Endpoints

### General

#### `GET /v2`
Get API information and available endpoints.

**Response:**
```json
{
  "ok": true,
  "data": {
    "name": "UMBRA API",
    "version": "2.0.0",
    "endpoints": {
      "rest": "http://127.0.0.1:4587/v2",
      "websocket": "ws://127.0.0.1:4587"
    },
    "features": ["REST API", "WebSocket", "Webhooks", "OBS Integration"]
  }
}
```

#### `GET /v2/health`
Health check endpoint.

**Response:**
```json
{
  "ok": true,
  "data": {
    "status": "healthy",
    "uptime": 12345.67,
    "overlay": true,
    "websocket_clients": 2
  }
}
```

#### `GET /v2/status`
Get current overlay status.

**Response:**
```json
{
  "ok": true,
  "data": {
    "overlay": {
      "visible": true,
      "opacity": 85,
      "theme": "neon"
    },
    "connections": {
      "twitch": true,
      "donationalerts": true
    },
    "api": {
      "port": 4587,
      "websocket_clients": 2,
      "webhooks": 1
    }
  }
}
```

#### `GET /v2/stats`
Get statistics and goal progress.

**Response:**
```json
{
  "ok": true,
  "data": {
    "goal": {
      "current": 1500,
      "target": 5000,
      "title": "New PC",
      "percentage": "30.00"
    },
    "history": {
      "donations": 42,
      "messages": 156,
      "events": 198
    },
    "session": {
      "total_donations": 1500,
      "total_messages": 156
    }
  }
}
```

---

### Donations

#### `POST /v2/donations`
Send a donation alert.

**Request:**
```json
{
  "name": "John Doe",
  "amount": "100",
  "message": "Great stream!",
  "currency": "RUB",
  "platform": "api"
}
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "id": "uuid-here",
    "name": "John Doe",
    "amount": "100",
    "message": "Great stream!",
    "currency": "RUB",
    "platform": "api",
    "timestamp": "2026-04-10T12:00:00.000Z"
  }
}
```

#### `GET /v2/donations?limit=50`
Get donation history.

**Response:**
```json
{
  "ok": true,
  "data": {
    "donations": [...],
    "total": 42
  }
}
```

---

### Messages

#### `POST /v2/messages`
Send a chat message.

**Request:**
```json
{
  "platform": "api",
  "author": "ChatBot",
  "text": "Hello from API!",
  "color": "#00ff00"
}
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "id": "uuid-here",
    "platform": "api",
    "author": "ChatBot",
    "text": "Hello from API!",
    "color": "#00ff00",
    "timestamp": "2026-04-10T12:00:00.000Z"
  }
}
```

#### `GET /v2/messages?limit=100`
Get message history.

---

### Alerts

#### `POST /v2/alerts`
Show a custom alert.

**Request:**
```json
{
  "title": "NEW FOLLOWER",
  "text": "Thanks for following!",
  "icon": "⭐",
  "duration": 5000
}
```

---

### Goal

#### `GET /v2/goal`
Get current goal progress.

#### `PATCH /v2/goal`
Update goal.

**Request:**
```json
{
  "current": 1500,
  "target": 5000,
  "title": "New PC"
}
```

#### `POST /v2/goal/reset`
Reset goal progress to 0.

---

### Chat

#### `DELETE /v2/chat`
Clear all chat messages.

---

### Settings

#### `GET /v2/settings`
Get current overlay settings.

#### `PATCH /v2/settings`
Update overlay settings.

**Request:**
```json
{
  "theme": "neon",
  "opacity": 90,
  "donationSound": true,
  "donationDuration": 8
}
```

---

### Events

#### `GET /v2/events?limit=100`
Get all events (donations + messages) sorted by time.

---

### Webhooks

#### `GET /v2/webhooks`
List all webhooks.

#### `POST /v2/webhooks`
Create a webhook.

**Request:**
```json
{
  "url": "https://your-server.com/webhook",
  "events": ["donation", "message", "alert"],
  "enabled": true
}
```

#### `DELETE /v2/webhooks/{id}`
Delete a webhook.

---

### OBS Integration

#### `GET /v2/obs/config`
Get OBS Browser Source URLs.

**Response:**
```json
{
  "ok": true,
  "data": {
    "overlay_url": "http://127.0.0.1:4587/obs/overlay?key=...",
    "chat_url": "http://127.0.0.1:4587/obs/chat?key=...",
    "donations_url": "http://127.0.0.1:4587/obs/donations?key=...",
    "goal_url": "http://127.0.0.1:4587/obs/goal?key=..."
  }
}
```

---

## 🔌 WebSocket API

Connect to `ws://127.0.0.1:4587?key=YOUR_API_KEY`

### Events

**Connection:**
```json
{
  "type": "connected",
  "message": "Connected to UMBRA API v2",
  "timestamp": "2026-04-10T12:00:00.000Z"
}
```

**Donation:**
```json
{
  "type": "donation",
  "data": {
    "id": "uuid",
    "name": "John Doe",
    "amount": "100",
    "message": "Great stream!",
    "currency": "RUB",
    "timestamp": "2026-04-10T12:00:00.000Z"
  }
}
```

**Message:**
```json
{
  "type": "message",
  "data": {
    "id": "uuid",
    "platform": "twitch",
    "author": "viewer123",
    "text": "Hello!",
    "color": "#ff0000",
    "timestamp": "2026-04-10T12:00:00.000Z"
  }
}
```

**Alert:**
```json
{
  "type": "alert",
  "data": {
    "title": "NEW FOLLOWER",
    "text": "Thanks!",
    "icon": "⭐"
  }
}
```

**Goal Update:**
```json
{
  "type": "goal_update",
  "data": {
    "current": 1500,
    "target": 5000,
    "title": "New PC"
  }
}
```

**Chat Cleared:**
```json
{
  "type": "chat_cleared"
}
```

### Ping/Pong

Send:
```json
{
  "type": "ping"
}
```

Receive:
```json
{
  "type": "pong",
  "timestamp": "2026-04-10T12:00:00.000Z"
}
```

---

## 📦 Code Examples

### JavaScript (Browser)

```javascript
// REST API
const API_KEY = 'your_api_key_here';
const BASE_URL = 'http://127.0.0.1:4587/v2';

async function sendDonation(name, amount, message) {
  const response = await fetch(`${BASE_URL}/donations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY
    },
    body: JSON.stringify({ name, amount, message })
  });
  return await response.json();
}

// WebSocket
const ws = new WebSocket(`ws://127.0.0.1:4587?key=${API_KEY}`);

ws.onopen = () => {
  console.log('Connected to UMBRA');
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Event:', data.type, data);

  if (data.type === 'donation') {
    console.log(`New donation: ${data.data.name} - ${data.data.amount}`);
  }
};

// Send ping every 30 seconds
setInterval(() => {
  ws.send(JSON.stringify({ type: 'ping' }));
}, 30000);
```

### Python

```python
import requests
import json

API_KEY = 'your_api_key_here'
BASE_URL = 'http://127.0.0.1:4587/v2'

headers = {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY
}

# Send donation
def send_donation(name, amount, message):
    response = requests.post(
        f'{BASE_URL}/donations',
        headers=headers,
        json={
            'name': name,
            'amount': str(amount),
            'message': message
        }
    )
    return response.json()

# Get stats
def get_stats():
    response = requests.get(f'{BASE_URL}/stats', headers=headers)
    return response.json()

# WebSocket
import websocket

def on_message(ws, message):
    data = json.loads(message)
    print(f"Event: {data['type']}")
    if data['type'] == 'donation':
        print(f"Donation: {data['data']['name']} - {data['data']['amount']}")

ws = websocket.WebSocketApp(
    f"ws://127.0.0.1:4587?key={API_KEY}",
    on_message=on_message
)
ws.run_forever()
```

### Node.js

```javascript
const axios = require('axios');
const WebSocket = require('ws');

const API_KEY = 'your_api_key_here';
const BASE_URL = 'http://127.0.0.1:4587/v2';

// REST API
async function sendDonation(name, amount, message) {
  const response = await axios.post(`${BASE_URL}/donations`, {
    name,
    amount: String(amount),
    message
  }, {
    headers: { 'X-API-Key': API_KEY }
  });
  return response.data;
}

// WebSocket
const ws = new WebSocket(`ws://127.0.0.1:4587?key=${API_KEY}`);

ws.on('open', () => {
  console.log('Connected to UMBRA');
});

ws.on('message', (data) => {
  const event = JSON.parse(data);
  console.log('Event:', event.type);

  if (event.type === 'donation') {
    console.log(`Donation: ${event.data.name} - ${event.data.amount}`);
  }
});
```

---

## 🎯 Use Cases

### 1. Custom Donation Widget
Create your own donation widget that sends alerts to UMBRA.

### 2. Chat Bot Integration
Send bot messages to overlay chat.

### 3. External Statistics Dashboard
Build a web dashboard showing real-time stats via WebSocket.

### 4. Webhook Notifications
Get notified on Discord/Telegram when donations arrive.

### 5. OBS Browser Source
Add UMBRA overlay directly to OBS without separate window.

### 6. Stream Deck Integration
Control overlay (clear chat, test donation) via Stream Deck buttons.

---

## 🔒 Security

- API runs on `127.0.0.1` (localhost only) by default
- API key required for all requests
- Rate limiting: 100 requests per minute per IP
- Max payload size: 1MB
- CORS enabled for local development

---

## 🐛 Error Responses

```json
{
  "ok": false,
  "error": "Error message here",
  "timestamp": "2026-04-10T12:00:00.000Z"
}
```

**Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request (invalid JSON)
- `401` - Unauthorized (invalid API key)
- `404` - Not Found
- `405` - Method Not Allowed
- `413` - Payload Too Large
- `429` - Too Many Requests (rate limit)
- `503` - Service Unavailable (overlay not ready)

---

## 📞 Support

- GitHub: https://github.com/NoxirDev/umbra
- Issues: https://github.com/NoxirDev/umbra/issues

---

**Made with ❤️ by Noxir (KayROSir)**
