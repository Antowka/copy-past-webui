from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from typing import Dict, List
import json

app = FastAPI()

# In-memory storage for active sessions
# Key: session_password, Value: list of connected WebSocket clients
active_sessions: Dict[str, List[WebSocket]] = {}

@app.websocket("/ws/{session_password}")
async def websocket_endpoint(websocket: WebSocket, session_password: str):
    await websocket.accept()
    
    # Create session if it doesn't exist
    if session_password not in active_sessions:
        active_sessions[session_password] = []
    
    # Add this client to the session
    active_sessions[session_password].append(websocket)
    print(f"Client connected to session {session_password}. Total clients: {len(active_sessions[session_password])}")
    
    try:
        while True:
            data = await websocket.receive_text()
            # Broadcast the data to all other clients in the same session
            for client in active_sessions[session_password]:
                if client != websocket:  # Don't send back to sender
                    try:
                        await client.send_text(data)
                    except:
                        # Remove disconnected client
                        if client in active_sessions[session_password]:
                            active_sessions[session_password].remove(client)
    except WebSocketDisconnect:
        print(f"Client disconnected from session {session_password}")
        # Remove the client from the session
        if session_password in active_sessions:
            if websocket in active_sessions[session_password]:
                active_sessions[session_password].remove(websocket)
            
            # Clean up empty sessions
            if len(active_sessions[session_password]) == 0:
                del active_sessions[session_password]
                
@app.get("/")
def read_root():
    return {"message": "Clipboard Exchange Backend API"}