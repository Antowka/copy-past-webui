import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [password, setPassword] = useState('');
  const [ws, setWs] = useState(null);
  const [connected, setConnected] = useState(false);
  const [clipboardContent, setClipboardContent] = useState('');
  const [otherUsersContent, setOtherUsersContent] = useState([]);

  useEffect(() => {
    // Clean up WebSocket connection on unmount
    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [ws]);

  const connectToSession = () => {
    if (!password) {
      alert('Please enter a password');
      return;
    }

    // Close existing connection if any
    if (ws) {
      ws.close();
    }

    // Create WebSocket connection
    const wsUrl = `ws://localhost:8000/ws/${encodeURIComponent(password)}`;
    const newWs = new WebSocket(wsUrl);

    newWs.onopen = () => {
      console.log('Connected to session:', password);
      setWs(newWs);
      setConnected(true);
    };

    newWs.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'clipboard') {
          setOtherUsersContent(prev => [...prev, { id: Date.now(), content: data.content, timestamp: new Date() }]);
        }
      } catch (e) {
        // If not JSON, treat as plain text (for backward compatibility)
        setOtherUsersContent(prev => [...prev, { id: Date.now(), content: event.data, timestamp: new Date() }]);
      }
    };

    newWs.onclose = () => {
      console.log('Disconnected from session:', password);
      setConnected(false);
      setWs(null);
    };

    newWs.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConnected(false);
    };
  };

  const disconnectFromSession = () => {
    if (ws) {
      ws.close();
      setWs(null);
      setConnected(false);
      setOtherUsersContent([]);
    }
  };

  const handleCopyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      alert('Copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy: ', err);
      alert('Failed to copy to clipboard');
    }
  };

  const handleSendToClipboard = () => {
    if (!ws || !connected) {
      alert('Not connected to a session');
      return;
    }

    if (!clipboardContent.trim()) {
      alert('Please enter some content to send');
      return;
    }

    // Send the content to other users in the session
    const message = JSON.stringify({
      type: 'clipboard',
      content: clipboardContent
    });
    
    ws.send(message);
    
    // Add to our own list of sent content
    setOtherUsersContent(prev => [...prev, { id: Date.now(), content: clipboardContent, timestamp: new Date(), isOwn: true }]);
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setClipboardContent(text);
    } catch (err) {
      console.error('Failed to read clipboard: ', err);
      alert('Failed to read from clipboard. Browser may not support this feature.');
    }
  };

  return (
    <div className="App">
      <div className="container">
        <h1>Clipboard Exchange</h1>
        
        {!connected ? (
          <div className="connection-section">
            <input
              type="password"
              placeholder="Enter session password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && connectToSession()}
            />
            <button onClick={connectToSession}>Connect to Session</button>
          </div>
        ) : (
          <div className="connected-section">
            <div className="status">
              <span className="connected-indicator">●</span> Connected to session: {password}
              <button onClick={disconnectFromSession} className="disconnect-btn">Disconnect</button>
            </div>
            
            <div className="clipboard-section">
              <h2>Your Clipboard Content</h2>
              <textarea
                value={clipboardContent}
                onChange={(e) => setClipboardContent(e.target.value)}
                placeholder="Type or paste content here..."
                rows="4"
                cols="50"
              ></textarea>
              <div className="clipboard-actions">
                <button onClick={handlePasteFromClipboard}>Paste from Clipboard</button>
                <button onClick={handleSendToClipboard} disabled={!clipboardContent.trim()}>Send to Others</button>
              </div>
            </div>
            
            <div className="received-content">
              <h2>Content from Other Users</h2>
              {otherUsersContent.length === 0 ? (
                <p>No content received yet...</p>
              ) : (
                <div className="content-list">
                  {[...otherUsersContent].reverse().map((item) => (
                    <div key={item.id} className={`content-item ${item.isOwn ? 'own' : ''}`}>
                      <div className="content-text">{item.content}</div>
                      <div className="content-actions">
                        <button onClick={() => handleCopyToClipboard(item.content)}>Copy to Clipboard</button>
                        <span className="timestamp">{item.timestamp.toLocaleTimeString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;