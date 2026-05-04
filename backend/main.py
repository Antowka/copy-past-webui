from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File
from typing import Dict, List
import json
import uuid

app = FastAPI()

CHUNK_SIZE = 64 * 1024

active_sessions: Dict[str, List[WebSocket]] = {}
session_files: Dict[str, Dict[str, dict]] = {}

@app.websocket("/ws/{session_password}")
async def websocket_endpoint(websocket: WebSocket, session_password: str):
    await websocket.accept()

    if session_password not in active_sessions:
        active_sessions[session_password] = []
        session_files[session_password] = {}

    active_sessions[session_password].append(websocket)
    print(f"Client connected to session {session_password}. Total clients: {len(active_sessions[session_password])}")

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)

            if message["type"] == "clipboard":
                for client in active_sessions[session_password]:
                    if client != websocket:
                        try:
                            await client.send_text(data)
                        except:
                            if client in active_sessions[session_password]:
                                active_sessions[session_password].remove(client)

            elif message["type"] == "file_offer":
                file_id = message["fileId"]
                session_files[session_password][file_id] = {
                    "name": message["fileName"],
                    "size": message["fileSize"],
                    "chunks": {},
                    "totalChunks": message.get("totalChunks", 0),
                    "receivedChunks": 0
                }
                for client in active_sessions[session_password]:
                    if client != websocket:
                        try:
                            await client.send_text(data)
                        except:
                            if client in active_sessions[session_password]:
                                active_sessions[session_password].remove(client)

            elif message["type"] == "file_chunk":
                file_id = message["fileId"]
                if session_password in session_files and file_id in session_files[session_password]:
                    session_files[session_password][file_id]["chunks"][message["chunkIndex"]] = message["data"]
                    session_files[session_password][file_id]["receivedChunks"] += 1
                for client in active_sessions[session_password]:
                    if client != websocket:
                        try:
                            await client.send_text(data)
                        except:
                            if client in active_sessions[session_password]:
                                active_sessions[session_password].remove(client)

            elif message["type"] == "file_complete":
                file_id = message["fileId"]
                if session_password in session_files and file_id in session_files[session_password]:
                    del session_files[session_password][file_id]
                for client in active_sessions[session_password]:
                    if client != websocket:
                        try:
                            await client.send_text(data)
                        except:
                            if client in active_sessions[session_password]:
                                active_sessions[session_password].remove(client)

    except WebSocketDisconnect:
        print(f"Client disconnected from session {session_password}")
        if session_password in active_sessions:
            if websocket in active_sessions[session_password]:
                active_sessions[session_password].remove(websocket)
            if len(active_sessions[session_password]) == 0:
                del active_sessions[session_password]
                if session_password in session_files:
                    del session_files[session_password]
                
@app.get("/")
def read_root():
    return {"message": "Clipboard Exchange Backend API"}