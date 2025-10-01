import React, { useRef, useState, useEffect } from 'react';
import io from 'socket.io-client';
import { GOOGLE_DRIVE_CONFIG } from './config';

export default function App() {
  const [mode, setMode] = useState(null); // 'send' or 'receive'
  const [room, setRoom] = useState('');
  const [fileName, setFileName] = useState('');
  const [isGoogleDriveEnabled, setIsGoogleDriveEnabled] = useState(false);
  const [googleDriveLink, setGoogleDriveLink] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [p2pTimeout, setP2pTimeout] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const fileRef = useRef();
  const pcRef = useRef(null);
  const dataChannelRef = useRef(null);
  const socket = useRef(null);
  const tokenClientRef = useRef(null);

  const SIGNALING_SERVER = 'http://13.233.212.34:3000';

  // Initialize Google Identity Services token client
  useEffect(() => {
    const initTokenClient = () => {
      if (window.google && window.google.accounts && window.google.accounts.oauth2) {
        tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_DRIVE_CONFIG.CLIENT_ID,
          scope: GOOGLE_DRIVE_CONFIG.SCOPES,
          prompt: '',
          callback: (tokenResponse) => {
            if (tokenResponse && tokenResponse.access_token) {
              setAccessToken(tokenResponse.access_token);
              setIsGoogleDriveEnabled(true);
            }
          }
        });
      }
    };

    if (window.google && window.google.accounts && window.google.accounts.oauth2) {
      initTokenClient();
    } else {
      const interval = setInterval(() => {
        if (window.google && window.google.accounts && window.google.accounts.oauth2) {
          clearInterval(interval);
          initTokenClient();
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, []);

  useEffect(() => {
    socket.current = io(SIGNALING_SERVER);

    socket.current.on('connect', () => {
      console.log('Connected to signaling server');
    });

    socket.current.on('disconnect', () => {
      console.log('Disconnected from signaling server');
    });

    socket.current.on('ready', (peerId) => {
      console.log('Peer ready:', peerId);
      // If sender, create offer when receiver joins
      if (mode === 'send' && fileRef.current?.files[0]) {
        createOffer(peerId);
      }
      // If receiver, wait for offer (no action needed here)
      if (mode === 'receive') {
        console.log('Waiting for offer from sender...');
      }
    });

    socket.current.on('offer', async ({ from, sdp }) => {
      console.log('Received offer from:', from);
      try {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);
        socket.current.emit('answer', { target: from, sdp: answer });
        console.log('Sent answer to:', from);
      } catch (error) {
        console.error('Error handling offer:', error);
      }
    });

    socket.current.on('answer', async ({ sdp }) => {
      console.log('Received answer');
      try {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
      } catch (error) {
        console.error('Error handling answer:', error);
      }
    });

    socket.current.on('ice-candidate', async ({ candidate }) => {
      console.log('Received ICE candidate');
      try { 
        await pcRef.current.addIceCandidate(candidate); 
      } catch (e) { 
        console.error('Error adding ICE candidate:', e); 
      }
    });

    return () => socket.current.disconnect();
  }, [mode]);

  const joinRoom = (roomId, file = null, isSender = false) => {
    console.log(`Joining room ${roomId} as ${isSender ? 'sender' : 'receiver'}`);
    socket.current.emit('join', roomId);

    pcRef.current = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    if (isSender) {
      console.log('Creating data channel for sender');
      dataChannelRef.current = pcRef.current.createDataChannel('file');
      setupDataChannel(file);
    } else {
      console.log('Setting up data channel listener for receiver');
      pcRef.current.ondatachannel = (e) => {
        console.log('Data channel received');
        dataChannelRef.current = e.channel;
        setupDataChannel(null);
      };
    }

    pcRef.current.onicecandidate = (e) => {
      if (e.candidate) {
        console.log('Sending ICE candidate');
        // For ICE candidates, we need to send to all peers in the room
        // The server will handle broadcasting to other peers
        socket.current.emit('ice-candidate', { candidate: e.candidate, room: roomId });
      }
    };

    pcRef.current.onconnectionstatechange = () => {
      console.log('Connection state:', pcRef.current.connectionState);
      
      // Check for P2P connection failure
      if (pcRef.current.connectionState === 'failed' || pcRef.current.connectionState === 'disconnected') {
        console.log('P2P connection failed, attempting Google Drive upload...');
        if (mode === 'send' && fileRef.current?.files[0]) {
          uploadToGoogleDrive(fileRef.current.files[0]);
        }
      }
      
      // Clear timeout if connection is successful
      if (pcRef.current.connectionState === 'connected') {
        if (p2pTimeout) {
          clearTimeout(p2pTimeout);
          setP2pTimeout(null);
        }
      }
    };
  };

  const createOffer = async (peerId) => {
    const offer = await pcRef.current.createOffer();
    await pcRef.current.setLocalDescription(offer);
    socket.current.emit('offer', { sdp: offer, target: peerId });
  };

  const setupDataChannel = (file) => {
    const ch = dataChannelRef.current;
    let buffers = [], expected = 0, size = 0, receivedFileName = '';

    ch.onopen = () => { 
      console.log('Data channel opened');
      if (file) {
        console.log('Sending file:', file.name, 'Size:', file.size);
        sendFile(file); 
      }
    };

    ch.onmessage = (e) => {
      console.log('Received data on data channel, type:', typeof e.data);
      if (typeof e.data === 'string') {
        const meta = JSON.parse(e.data);
        console.log('Received metadata:', meta);
        if (meta.type === 'meta') {
          expected = meta.size;
          receivedFileName = meta.name || 'file_received';
          console.log('Expected file size:', expected, 'Filename:', receivedFileName);
        }
      } else {
        // Handle binary data - check for byteLength property
        const dataSize = e.data.byteLength || e.data.size || 0;
        console.log('Received binary data, size:', dataSize, 'Total received:', size + dataSize, 'Expected:', expected);
        buffers.push(e.data);
        size += dataSize;
        if (size >= expected) {
          console.log('File transfer complete! Creating download...');
          const blob = new Blob(buffers);
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = receivedFileName || fileName || 'file_received';
          document.body.appendChild(a);
          a.click();
          a.remove();
          console.log('File downloaded:', a.download);
          buffers = []; size = 0; expected = 0;
        }
      }
    };
  };

  const sendFile = (file) => {
    const ch = dataChannelRef.current;
    console.log('Sending file metadata:', { type: 'meta', size: file.size, name: file.name });
    ch.send(JSON.stringify({ type: 'meta', size: file.size, name: file.name }));

    const chunkSize = 64 * 1024;
    let offset = 0;
    const reader = new FileReader();

    const readSlice = (o) => {
      const slice = file.slice(o, o + chunkSize);
      reader.readAsArrayBuffer(slice);
    };

    reader.onload = (e) => {
      console.log('Sending chunk, offset:', offset, 'size:', e.target.result.byteLength);
      ch.send(e.target.result);
      offset += chunkSize;
      if (offset < file.size) readSlice(offset);
    };

    readSlice(0);
  };

  // Google Drive auth via Google Identity Services
  const authenticateGoogleDrive = async () => {
    try {
      if (!tokenClientRef.current) {
        throw new Error('Google Identity Services not loaded');
      }

      return await new Promise((resolve) => {
        tokenClientRef.current.callback = (tokenResponse) => {
          if (tokenResponse && tokenResponse.access_token) {
            setAccessToken(tokenResponse.access_token);
            setIsGoogleDriveEnabled(true);
            resolve(true);
          } else {
            resolve(false);
          }
        };
        tokenClientRef.current.requestAccessToken({ prompt: 'consent' });
      });
    } catch (error) {
      console.error('Google Drive authentication failed:', error);
      alert('Failed to authenticate with Google Drive. Please try again.');
      return false;
    }
  };

  const uploadToGoogleDrive = async (file) => {
    if (!accessToken) {
      const ok = await authenticateGoogleDrive();
      if (!ok) return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const metadata = {
        name: file.name,
        parents: [] // Upload to root folder
      };

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', file);

      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(progress);
        }
      });

      xhr.onload = () => {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          const fileId = response.id;
          const shareLink = `https://drive.google.com/file/d/${fileId}/view`;
          setGoogleDriveLink(shareLink);
          console.log('File uploaded to Google Drive:', shareLink);
          alert(`File uploaded successfully! Share this link: ${shareLink}`);
        } else {
          console.error('Upload failed:', xhr.responseText);
          alert('Upload to Google Drive failed. Please try again.');
        }
        setIsUploading(false);
      };

      xhr.onerror = () => {
        console.error('Upload error');
        alert('Upload to Google Drive failed. Please try again.');
        setIsUploading(false);
      };

      xhr.open('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart');
      xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
      xhr.send(form);

    } catch (error) {
      console.error('Google Drive upload error:', error);
      alert('Upload to Google Drive failed. Please try again.');
      setIsUploading(false);
    }
  };

  const startSend = () => {
    if (!fileRef.current?.files[0]) return alert('Select a file first!');
    const file = fileRef.current.files[0];
    setFileName(file.name);

    const roomCode = Math.random().toString(36).substr(2, 4).toUpperCase();
    setRoom(roomCode);
    joinRoom(roomCode, file, true);
    
    // Set a timeout for P2P connection (30 seconds)
    const timeout = setTimeout(() => {
      console.log('P2P connection timeout, attempting Google Drive upload...');
      if (pcRef.current?.connectionState !== 'connected') {
        uploadToGoogleDrive(file);
      }
    }, 30000);
    
    setP2pTimeout(timeout);
  };

  const startReceive = () => {
    if (!room) return alert('Enter room code!');
    setMode('receive');
    joinRoom(room, null, false);
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'100vh', fontFamily:'Arial, sans-serif', backgroundColor:'#f7f7f7', color:'#333', padding:'20px' }}>
      <h1 style={{ fontWeight: 300 }}>P2P File Transfer</h1>

      {!mode ? (
        <div style={{ display:'flex', gap:'20px', marginTop:'20px' }}>
          <button style={buttonStyle} onClick={() => setMode('send')}>Send</button>
          <button style={buttonStyle} onClick={() => setMode('receive')}>Receive</button>
        </div>
      ) : mode === 'send' ? (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'10px', marginTop:'20px' }}>
          <input type="file" ref={fileRef} />
          <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', justifyContent:'center' }}>
            <button style={buttonStyle} onClick={startSend}>Start P2P Transfer</button>
            <button style={{...buttonStyle, backgroundColor: '#34a853'}} onClick={() => fileRef.current?.files[0] && uploadToGoogleDrive(fileRef.current.files[0])}>
              Upload to Google Drive
            </button>
            <button style={{...buttonStyle, backgroundColor: '#ea4335'}} onClick={authenticateGoogleDrive}>
              {isGoogleDriveEnabled ? '✓ Authenticated' : 'Authenticate Google Drive'}
            </button>
          </div>
          {room && <p>Share this code with receiver: <b>{room}</b></p>}
          {isUploading && (
            <div style={{ width: '300px', textAlign: 'center' }}>
              <p>Uploading to Google Drive... {uploadProgress}%</p>
              <div style={{ width: '100%', backgroundColor: '#f0f0f0', borderRadius: '4px', height: '20px' }}>
                <div style={{ width: `${uploadProgress}%`, backgroundColor: '#34a853', height: '100%', borderRadius: '4px', transition: 'width 0.3s' }}></div>
              </div>
            </div>
          )}
          {googleDriveLink && (
            <div style={{ textAlign: 'center', maxWidth: '400px' }}>
              <p style={{ color: '#34a853', fontWeight: 'bold' }}>Google Drive Link:</p>
              <a href={googleDriveLink} target="_blank" rel="noopener noreferrer" style={{ color: '#1a73e8', wordBreak: 'break-all' }}>
                {googleDriveLink}
              </a>
              <button 
                style={{...buttonStyle, backgroundColor: '#1a73e8', marginTop: '10px'}} 
                onClick={() => navigator.clipboard.writeText(googleDriveLink)}
              >
                Copy Link
              </button>
            </div>
          )}
          <div style={{ textAlign: 'center', marginTop: '10px' }}>
            <p style={{ fontSize: '14px', color: isGoogleDriveEnabled ? '#34a853' : '#ea4335' }}>
              Google Drive: {isGoogleDriveEnabled ? '✓ Ready' : '❌ Not authenticated'}
            </p>
          </div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'10px', marginTop:'20px' }}>
          <input type="text" placeholder="Enter room code" value={room} onChange={e => setRoom(e.target.value.toUpperCase())} maxLength={4} style={{ padding:'8px', borderRadius:'4px', border:'1px solid #ccc' }} />
          <button style={buttonStyle} onClick={startReceive}>Start Receiving</button>
        </div>
      )}
    </div>
  );
}

const buttonStyle = {
  padding: '10px 20px',
  border: 'none',
  borderRadius: '4px',
  backgroundColor: '#4a90e2',
  color: '#fff',
  cursor: 'pointer'
};
