from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, List
import json

app = FastAPI()

# Add CORS to allow frontend and backend to interact
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Store connected clients per board
boards: Dict[str, List[WebSocket]] = {}

# Store board elements per board (lines, shapes etc)
board_states: Dict[str, List[dict]] = {}

# Websocket endpoint for board connections
@app.websocket("/ws/{board_id}")
async def websocket_endpoint(websocket: WebSocket, board_id: str):
    
    await websocket.accept()

    # add current board_ID to boards if not already connected
    if board_id not in boards:
        boards[board_id] = []
        board_states[board_id] = []
    boards[board_id].append(websocket)
    print(f"✅ Client connected to board {board_id}")

    # Send current board state(lines, shapes etc) to newly connected client
    if board_states[board_id]:
        initial_state = {
            "type": "initial-state",
            "elements": board_states[board_id]
        }

        # Try to send current state to current user
        try:
            await websocket.send_text(json.dumps(initial_state))
            print(f"📤 Sent initial state to new client: {len(board_states[board_id])} elements")
        except Exception as e:
            print(f"Error sending initial state: {e}")

    try:
        while True:
            # Receive drawing data 
            data_text = await websocket.receive_text()
            data = json.loads(data_text)
            print(f"📩 Received from {board_id}: {data.get('type', 'unknown')}")

            # Update board state based on message type
            if data.get("type") == "element":
                # Add element to board state
                if "element" in data:
                    board_states[board_id].append(data["element"])
            elif data.get("type") == "element-update":
                # Update existing element in board state
                if "element" in data:
                    element_id = data["element"].get("id")
                    if element_id:
                        # Find and update the element
                        for i, el in enumerate(board_states[board_id]):
                            if el.get("id") == element_id:
                                board_states[board_id][i] = data["element"]
                                break
            elif data.get("type") == "undo":
                # Remove element from board state
                element_id = data.get("elementId")
                if element_id:
                    # remove element from board_states
                    board_states[board_id] = [element for element in board_states[board_id] if element.get("id") != element_id]
                    
            elif data.get("type") == "clear":
                # Clear board state
                board_states[board_id] = []

            # Update board for all users
            for client in boards[board_id]:
                if client != websocket:
                    try:
                        await client.send_text(data_text)
                    except Exception as e:
                        print(f"Error sending to client: {e}")

    # Handle disconnections
    except WebSocketDisconnect:
        print(f"❌ Client disconnected from {board_id}")
        if board_id in boards:
            boards[board_id].remove(websocket)
