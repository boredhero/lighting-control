"""WebSocket endpoint."""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from lighting_control.websocket.manager import ws_manager

router = APIRouter()


@router.websocket("/ws/")
async def websocket_endpoint(websocket: WebSocket):
    user_id = await ws_manager.connect(websocket)
    if not user_id:
        return
    try:
        while True:
            raw = await websocket.receive_text()
            await ws_manager.handle_message(user_id, raw)
    except WebSocketDisconnect:
        ws_manager.disconnect(user_id)
