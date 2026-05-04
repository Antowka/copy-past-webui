import React, { useState, useEffect, useRef } from 'react';
import './App.css';

const CHUNK_SIZE = 64 * 1024;

function App() {
  const [password, setPassword] = useState('');
  const [ws, setWs] = useState(null);
  const [connected, setConnected] = useState(false);
  const [clipboardContent, setClipboardContent] = useState('');
  const [otherUsersContent, setOtherUsersContent] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [incomingFiles, setIncomingFiles] = useState([]);
  const [downloadProgress, setDownloadProgress] = useState({});
  const fileChunksRef = useRef({});
  const fileMetadataRef = useRef({});

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
        } else if (data.type === 'file_offer') {
          fileChunksRef.current[data.fileId] = {};
          fileMetadataRef.current[data.fileId] = { name: data.fileName, size: data.fileSize, totalChunks: data.totalChunks };
          setIncomingFiles(prev => [...prev, { fileId: data.fileId, fileName: data.fileName, fileSize: data.fileSize }]);
          setDownloadProgress(prev => ({ ...prev, [data.fileId]: 0 }));
        } else if (data.type === 'file_chunk') {
          if (fileChunksRef.current[data.fileId]) {
            fileChunksRef.current[data.fileId][data.chunkIndex] = data.data;
            const chunks = fileChunksRef.current[data.fileId];
            if (chunks) {
              setDownloadProgress(prev => {
                const received = Object.keys(chunks).length;
                return { ...prev, [data.fileId]: Math.round((received / data.totalChunks) * 100) };
              });
            }
          }
        } else if (data.type === 'file_complete') {
          try {
            const metadata = fileMetadataRef.current[data.fileId];
            if (metadata) {
              const sortedChunks = Object.keys(fileChunksRef.current[data.fileId])
                .sort((a, b) => parseInt(a) - parseInt(b))
                .map(k => fileChunksRef.current[data.fileId][k]);
              const binaryString = sortedChunks.join('');
              const bytes = Uint8Array.from(atob(binaryString), c => c.charCodeAt(0));
              const blob = new Blob([bytes]);
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = metadata.name;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }
            delete fileChunksRef.current[data.fileId];
            delete fileMetadataRef.current[data.fileId];
          } catch (err) {
            console.error('File processing error:', err);
          }
          setIncomingFiles(prev => prev.filter(f => f.fileId !== data.fileId));
          setDownloadProgress(prev => {
            const newProgress = { ...prev };
            delete newProgress[data.fileId];
            return newProgress;
          });
        }
      } catch (e) {
        console.error('Message parse error:', e);
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

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.size > 50 * 1024 * 1024) {
      alert('File size must be less than 50MB');
      e.target.value = '';
      return;
    }
    setSelectedFile(file);
  };

  const handleSendFile = () => {
    if (!ws || !connected || !selectedFile) return;

    const fileId = Date.now().toString();
    const totalChunks = Math.ceil(selectedFile.size / CHUNK_SIZE);

    const offerMessage = JSON.stringify({
      type: 'file_offer',
      fileId,
      fileName: selectedFile.name,
      fileSize: selectedFile.size,
      totalChunks
    });
    ws.send(offerMessage);

    const reader = new FileReader();
    let offset = 0;
    let chunkIndex = 0;

    const readNextChunk = () => {
      const slice = selectedFile.slice(offset, offset + CHUNK_SIZE);
      reader.readAsDataURL(slice);
      reader.onload = () => {
        const data = reader.result.split(',')[1];
        const chunkMessage = JSON.stringify({
          type: 'file_chunk',
          fileId,
          chunkIndex,
          totalChunks,
          data
        });
        ws.send(chunkMessage);
        offset += CHUNK_SIZE;
        chunkIndex++;
        if (offset < selectedFile.size) {
          readNextChunk();
        } else {
          const completeMessage = JSON.stringify({ type: 'file_complete', fileId });
          ws.send(completeMessage);
          setSelectedFile(null);
          setOtherUsersContent(prev => [...prev, {
            id: Date.now(),
            content: `[File sent: ${selectedFile.name}]`,
            timestamp: new Date(),
            isOwn: true
          }]);
        }
      };
    };

    readNextChunk();
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

            <div className="file-section">
              <h2>Send File</h2>
              <input type="file" onChange={handleFileSelect} />
              {selectedFile && (
                <div className="file-info">
                  <span>{selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                  <button onClick={handleSendFile} className="send-file-btn">Send File</button>
                </div>
              )}
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

            {incomingFiles.length > 0 && (
              <div className="incoming-files">
                <h2>Incoming Files</h2>
                {incomingFiles.map((file) => (
                  <div key={file.fileId} className="incoming-file-item">
                    <span>{file.fileName} ({(file.fileSize / 1024 / 1024).toFixed(2)} MB)</span>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${downloadProgress[file.fileId] || 0}%` }}></div>
                    </div>
                    <span className="progress-text">{downloadProgress[file.fileId] || 0}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;