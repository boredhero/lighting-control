"""WebSocket connection manager."""
import json
import logging
from fastapi import WebSocket
from lighting_control.auth.service import decode_token

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}
        self.subscriptions: dict[str, set[str]] = {}

    async def connect(self, websocket: WebSocket) -> str | None:
        """Authenticate and accept a WebSocket connection. Returns user_id or None."""
        token = websocket.query_params.get("token")
        if not token:
            await websocket.close(code=4001, reason="Missing token")
            return None
        try:
            payload = decode_token(token)
            if payload.get("type") != "access":
                await websocket.close(code=4001, reason="Invalid token type")
                return None
            user_id = payload["sub"]
        except Exception:
            await websocket.close(code=4001, reason="Invalid token")
            return None
        await websocket.accept()
        self.active_connections[user_id] = websocket
        self.subscriptions[user_id] = set()
        logger.info(f"WebSocket connected: {user_id}")
        return user_id

    def disconnect(self, user_id: str):
        self.active_connections.pop(user_id, None)
        self.subscriptions.pop(user_id, None)
        logger.info(f"WebSocket disconnected: {user_id}")

    def subscribe(self, user_id: str, device_id: str):
        if user_id in self.subscriptions:
            self.subscriptions[user_id].add(device_id)

    def unsubscribe(self, user_id: str, device_id: str):
        if user_id in self.subscriptions:
            self.subscriptions[user_id].discard(device_id)

    async def broadcast(self, event: str, data: dict):
        """Send an event to all connected clients."""
        message = json.dumps({"event": event, "data": data})
        disconnected = []
        for user_id, ws in self.active_connections.items():
            try:
                await ws.send_text(message)
            except Exception:
                disconnected.append(user_id)
        for uid in disconnected:
            self.disconnect(uid)

    async def send_to_subscribers(self, device_id: str, event: str, data: dict):
        """Send an event only to users subscribed to a specific device."""
        message = json.dumps({"event": event, "data": data})
        disconnected = []
        for user_id, ws in self.active_connections.items():
            if device_id in self.subscriptions.get(user_id, set()):
                try:
                    await ws.send_text(message)
                except Exception:
                    disconnected.append(user_id)
        for uid in disconnected:
            self.disconnect(uid)

    async def handle_message(self, user_id: str, raw: str):
        """Handle incoming WebSocket messages from clients."""
        try:
            msg = json.loads(raw)
            action = msg.get("action")
            if action == "subscribe_device":
                self.subscribe(user_id, msg["device_id"])
            elif action == "unsubscribe_device":
                self.unsubscribe(user_id, msg["device_id"])
            elif action == "ping":
                ws = self.active_connections.get(user_id)
                if ws:
                    await ws.send_text(json.dumps({"event": "pong"}))
        except Exception as e:
            logger.warning(f"Invalid WebSocket message from {user_id}: {e}")


ws_manager = ConnectionManager()
