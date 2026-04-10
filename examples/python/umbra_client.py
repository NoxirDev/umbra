"""
UMBRA API Client for Python
Simple client for integrating UMBRA into Python applications
"""

import requests
import json
import websocket
import threading
import time
from typing import Optional, Callable, Dict, Any, List


class UmbraClient:
    def __init__(self, api_key: str, base_url: str = "http://127.0.0.1:4587/v2"):
        self.api_key = api_key
        self.base_url = base_url
        self.ws = None
        self.ws_thread = None
        self.event_handlers = {}
        self.running = False

    # ═══════════════════════════════════════════════════════════
    # REST API Methods
    # ═══════════════════════════════════════════════════════════

    def _request(self, method: str, endpoint: str, data: Optional[Dict] = None) -> Dict[str, Any]:
        """Make HTTP request to API"""
        headers = {
            "Content-Type": "application/json",
            "X-API-Key": self.api_key
        }

        url = f"{self.base_url}{endpoint}"

        if method == "GET":
            response = requests.get(url, headers=headers)
        elif method == "POST":
            response = requests.post(url, headers=headers, json=data)
        elif method == "PATCH":
            response = requests.patch(url, headers=headers, json=data)
        elif method == "DELETE":
            response = requests.delete(url, headers=headers)
        else:
            raise ValueError(f"Unsupported method: {method}")

        result = response.json()

        if not result.get("ok"):
            raise Exception(result.get("error", "API request failed"))

        return result.get("data")

    # Donations
    def send_donation(self, name: str, amount: float, message: str = "", currency: str = "RUB") -> Dict:
        """Send a donation alert"""
        return self._request("POST", "/donations", {
            "name": name,
            "amount": str(amount),
            "message": message,
            "currency": currency
        })

    def get_donations(self, limit: int = 50) -> Dict:
        """Get donation history"""
        return self._request("GET", f"/donations?limit={limit}")

    # Messages
    def send_message(self, author: str, text: str, platform: str = "api", color: str = "#a8a8b3") -> Dict:
        """Send a chat message"""
        return self._request("POST", "/messages", {
            "platform": platform,
            "author": author,
            "text": text,
            "color": color
        })

    def get_messages(self, limit: int = 100) -> Dict:
        """Get message history"""
        return self._request("GET", f"/messages?limit={limit}")

    # Alerts
    def send_alert(self, title: str, text: str = "", icon: str = "📢", duration: int = 5000) -> Dict:
        """Show a custom alert"""
        return self._request("POST", "/alerts", {
            "title": title,
            "text": text,
            "icon": icon,
            "duration": duration
        })

    # Goal
    def get_goal(self) -> Dict:
        """Get current goal progress"""
        return self._request("GET", "/goal")

    def update_goal(self, current: Optional[float] = None, target: Optional[float] = None,
                   title: Optional[str] = None) -> Dict:
        """Update goal"""
        data = {}
        if current is not None:
            data["current"] = current
        if target is not None:
            data["target"] = target
        if title is not None:
            data["title"] = title
        return self._request("PATCH", "/goal", data)

    def reset_goal(self) -> Dict:
        """Reset goal progress to 0"""
        return self._request("POST", "/goal/reset")

    # Chat
    def clear_chat(self) -> Dict:
        """Clear all chat messages"""
        return self._request("DELETE", "/chat")

    # Settings
    def get_settings(self) -> Dict:
        """Get current overlay settings"""
        return self._request("GET", "/settings")

    def update_settings(self, **settings) -> Dict:
        """Update overlay settings"""
        return self._request("PATCH", "/settings", settings)

    # Stats
    def get_stats(self) -> Dict:
        """Get statistics and goal progress"""
        return self._request("GET", "/stats")

    def get_status(self) -> Dict:
        """Get current overlay status"""
        return self._request("GET", "/status")

    def get_health(self) -> Dict:
        """Health check"""
        return self._request("GET", "/health")

    # Events
    def get_events(self, limit: int = 100) -> Dict:
        """Get all events (donations + messages)"""
        return self._request("GET", f"/events?limit={limit}")

    # Webhooks
    def get_webhooks(self) -> Dict:
        """List all webhooks"""
        return self._request("GET", "/webhooks")

    def create_webhook(self, url: str, events: List[str] = None) -> Dict:
        """Create a webhook"""
        if events is None:
            events = ["donation", "message"]
        return self._request("POST", "/webhooks", {
            "url": url,
            "events": events
        })

    def delete_webhook(self, webhook_id: str) -> Dict:
        """Delete a webhook"""
        return self._request("DELETE", f"/webhooks/{webhook_id}")

    # OBS
    def get_obs_config(self) -> Dict:
        """Get OBS Browser Source URLs"""
        return self._request("GET", "/obs/config")

    # ═══════════════════════════════════════════════════════════
    # WebSocket Methods
    # ═══════════════════════════════════════════════════════════

    def connect(self):
        """Connect to WebSocket"""
        ws_url = self.base_url.replace("http://", "ws://").replace("/v2", "")
        ws_url = f"{ws_url}?key={self.api_key}"

        self.running = True
        self.ws = websocket.WebSocketApp(
            ws_url,
            on_open=self._on_open,
            on_message=self._on_message,
            on_error=self._on_error,
            on_close=self._on_close
        )

        self.ws_thread = threading.Thread(target=self.ws.run_forever)
        self.ws_thread.daemon = True
        self.ws_thread.start()

        # Wait for connection
        time.sleep(1)

    def disconnect(self):
        """Disconnect from WebSocket"""
        self.running = False
        if self.ws:
            self.ws.close()
        if self.ws_thread:
            self.ws_thread.join(timeout=2)

    def on(self, event_type: str, handler: Callable):
        """Register event handler"""
        if event_type not in self.event_handlers:
            self.event_handlers[event_type] = []
        self.event_handlers[event_type].append(handler)

    def off(self, event_type: str, handler: Callable):
        """Unregister event handler"""
        if event_type in self.event_handlers:
            self.event_handlers[event_type].remove(handler)

    def _on_open(self, ws):
        """WebSocket opened"""
        print("[UMBRA] WebSocket connected")
        self._trigger_event("connected", {})

        # Start ping thread
        def ping_loop():
            while self.running:
                time.sleep(30)
                if self.ws:
                    try:
                        self.ws.send(json.dumps({"type": "ping"}))
                    except:
                        pass

        ping_thread = threading.Thread(target=ping_loop)
        ping_thread.daemon = True
        ping_thread.start()

    def _on_message(self, ws, message):
        """WebSocket message received"""
        try:
            data = json.loads(message)
            self._trigger_event(data.get("type"), data.get("data", data))
        except Exception as e:
            print(f"[UMBRA] Failed to parse message: {e}")

    def _on_error(self, ws, error):
        """WebSocket error"""
        print(f"[UMBRA] WebSocket error: {error}")
        self._trigger_event("error", {"error": str(error)})

    def _on_close(self, ws, close_status_code, close_msg):
        """WebSocket closed"""
        print("[UMBRA] WebSocket disconnected")
        self._trigger_event("disconnected", {})

    def _trigger_event(self, event_type: str, data: Dict):
        """Trigger event handlers"""
        handlers = self.event_handlers.get(event_type, [])
        for handler in handlers:
            try:
                handler(data)
            except Exception as e:
                print(f"[UMBRA] Event handler error: {e}")

        # Trigger wildcard handlers
        wildcard_handlers = self.event_handlers.get("*", [])
        for handler in wildcard_handlers:
            try:
                handler({"type": event_type, "data": data})
            except Exception as e:
                print(f"[UMBRA] Wildcard handler error: {e}")


# Example usage
if __name__ == "__main__":
    # Initialize client
    client = UmbraClient("your_api_key_here")

    # REST API examples
    print("Sending donation...")
    result = client.send_donation("Test User", 100, "Great stream!")
    print(f"Donation sent: {result}")

    print("\nGetting stats...")
    stats = client.get_stats()
    print(f"Goal: {stats['goal']['current']}/{stats['goal']['target']}")

    # WebSocket example
    def on_donation(data):
        print(f"New donation: {data['name']} - {data['amount']}")

    def on_message(data):
        print(f"New message: {data['author']}: {data['text']}")

    client.on("donation", on_donation)
    client.on("message", on_message)

    print("\nConnecting to WebSocket...")
    client.connect()

    # Keep running
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nDisconnecting...")
        client.disconnect()
