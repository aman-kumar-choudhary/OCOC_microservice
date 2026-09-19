from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import List, Dict, Any
import logging
import json
import asyncio

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/ws", tags=["websockets"])

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket connected. Total clients: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"WebSocket disconnected. Total clients: {len(self.active_connections)}")

    async def broadcast(self, message: Dict[str, Any]):
        """Broadcasts a JSON message to all connected clients."""
        text_data = json.dumps(message)
        failed_connections = []
        
        for connection in self.active_connections:
            try:
                await connection.send_text(text_data)
            except Exception as e:
                logger.error(f"Error broadcasting to client: {e}")
                failed_connections.append(connection)
                
        # Clean up dead connections
        for failed in failed_connections:
            self.disconnect(failed)

manager = ConnectionManager()

@router.websocket("/stream")
async def websocket_endpoint(websocket: WebSocket):
    """
    Connect to this endpoint to receive real-time streams of:
    - Access Events (ENTRY/EXIT logs)
    - Alerts (Curfew violations, Leave violations)
    - Face Recognition Logs (if pushed by devices)
    """
    await manager.connect(websocket)
    try:
        while True:
            # We don't expect messages from the client right now, but we need to keep the connection alive
            # and detect when they disconnect.
            data = await websocket.receive_text()
            # Respond to ping if necessary, though ping/pong is handled at protocol level usually
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)
