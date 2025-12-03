# Clipboard Exchange Application

This is a web application that allows two users to exchange clipboard content using a shared password. The application uses Python with FastAPI and WebSockets for the backend, and ReactJS for the frontend.

## Features

- Two users can connect using the same password
- When one user copies text, it appears on the other user's screen
- Each user has their own textarea to view and edit content
- Copy to clipboard functionality for received content
- No database required - all data is stored in memory

## Architecture

- **Backend**: Python with FastAPI and WebSockets
- **Frontend**: ReactJS with Vite
- **Communication**: WebSocket connections for real-time data exchange

## How to Run

### Option 1: Full Development Setup

#### Backend (Python FastAPI)
1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Start the backend server:
   ```bash
   cd backend
   python run.py
   ```
   The backend will be available at `http://localhost:8000`

#### Frontend (React) - Development
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies (requires Node.js and npm):
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```
   The frontend will be available at `http://localhost:5173`

### Option 2: Standalone HTML (No Build Required)
If you're having issues with npm dependencies, you can use the standalone HTML version:
1. Make sure the backend is running (see backend instructions above)
2. Simply open `/workspace/frontend/dist/index.html` in your browser
3. This contains the complete frontend application that connects directly to the backend

## How to Use

1. Open the frontend in two different browser windows/tabs (or different browsers)
2. Enter the same password in both windows and click "Connect to Session"
3. Once connected, each window will show:
   - Your own clipboard content area
   - A list of content received from other users in the same session
4. Type or paste content in your textarea and click "Send to Others" to share with connected users
5. Use "Paste from Clipboard" to get content from your system clipboard
6. Click "Copy to Clipboard" on received content to copy it to your system clipboard

## Technical Details

- The backend maintains in-memory sessions keyed by the password
- WebSocket connections are used for real-time communication
- When a user sends content, it's broadcast to all other users in the same session
- The frontend handles clipboard API integration for direct system clipboard access