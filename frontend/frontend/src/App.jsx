import React, { useRef, useState, useEffect, useCallback } from 'react';
import io from 'socket.io-client';
import { uploadFile } from '@uploadcare/upload-client';
import { APP_CONFIG } from './config';
import './App.css';

const SIGNALING_SERVER = APP_CONFIG.SIGNALING_SERVER || 'http://localhost:3000';
const UPLOADCARE_KEY = APP_CONFIG.UPLOADCARE_PUBLIC_KEY;

export default function App() {
  const [mode, setMode] = useState(null);
  const [room, setRoom] = useState('');
  const [fileName, setFileName] = useState('');
  const [cloudLink, setCloudLink] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [toast, setToast] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [hasFile, setHasFile] = useState(false);
  const fileRef = useRef();
  const pcRef = useRef(null);
  const dataChannelRef = useRef(null);
  const socket = useRef(null);
  const modeRef = useRef(mode);
  const p2pTimeoutRef = useRef(null);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const showToast = useCallback((type, message) => {
    setToast({ type, message });
  }, []);

  const clearSession = useCallback(() => {
    if (p2pTimeoutRef.current) {
      clearTimeout(p2pTimeoutRef.current);
      p2pTimeoutRef.current = null;
    }
    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch {
        /* ignore */
      }
      pcRef.current = null;
    }
    dataChannelRef.current = null;
    if (fileRef.current) fileRef.current.value = '';
    setRoom('');
    setFileName('');
    setCloudLink('');
    setUploadProgress(0);
    setIsUploading(false);
    setToast(null);
    setHasFile(false);
  }, []);

  const goHome = () => {
    clearSession();
    setMode(null);
  };

  useEffect(() => {
    socket.current = io(SIGNALING_SERVER);

    socket.current.on('connect', () => {
      console.log('Connected to signaling server');
    });

    socket.current.on('disconnect', () => {
      console.log('Disconnected from signaling server');
    });

    socket.current.on('ready', (peerId) => {
      const m = modeRef.current;
      console.log('Peer ready:', peerId);
      if (m === 'send' && fileRef.current?.files[0]) {
        createOffer(peerId);
      }
      if (m === 'receive') {
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
  }, []);

  const uploadToUploadcare = async (file) => {
    if (!UPLOADCARE_KEY) {
      showToast(
        'error',
        'Add VITE_UPLOADCARE_PUBLIC_KEY in Vercel (or .env.local) to enable cloud fallback uploads.'
      );
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setCloudLink('');
    setToast(null);

    try {
      const result = await uploadFile(file, {
        publicKey: UPLOADCARE_KEY,
        store: 'auto',
        fileName: file.name,
        contentType: file.type || undefined,
        onProgress: (info) => {
          if (info.isComputable) {
            setUploadProgress(Math.round(info.value * 100));
          }
        },
      });

      const url = result.cdnUrl;
      setCloudLink(url);
      showToast('ok', 'File is on Uploadcare. Share the link below.');
      console.log('Uploadcare URL:', url);
    } catch (error) {
      console.error('Uploadcare upload error:', error);
      showToast('error', error.message || 'Upload to Uploadcare failed.');
    } finally {
      setIsUploading(false);
    }
  };

  const joinRoom = (roomId, file = null, isSender = false) => {
    console.log(`Joining room ${roomId} as ${isSender ? 'sender' : 'receiver'}`);
    socket.current.emit('join', roomId);

    pcRef.current = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
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
        socket.current.emit('ice-candidate', { candidate: e.candidate, room: roomId });
      }
    };

    pcRef.current.onconnectionstatechange = () => {
      const state = pcRef.current?.connectionState;
      console.log('Connection state:', state);

      if (state === 'failed' || state === 'disconnected') {
        console.log('P2P connection issue, attempting Uploadcare upload...');
        if (modeRef.current === 'send' && fileRef.current?.files[0]) {
          uploadToUploadcare(fileRef.current.files[0]);
        }
      }

      if (state === 'connected' && p2pTimeoutRef.current) {
        clearTimeout(p2pTimeoutRef.current);
        p2pTimeoutRef.current = null;
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
    let buffers = [];
    let expected = 0;
    let size = 0;
    let receivedFileName = '';

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
          showToast('ok', 'Peer transfer complete. Download started.');
          buffers = [];
          size = 0;
          expected = 0;
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

  const startSend = () => {
    if (!fileRef.current?.files[0]) {
      showToast('error', 'Choose a file first.');
      return;
    }
    const file = fileRef.current.files[0];
    setFileName(file.name);

    const roomCode = Math.random().toString(36).substr(2, 4).toUpperCase();
    setRoom(roomCode);
    joinRoom(roomCode, file, true);

    p2pTimeoutRef.current = setTimeout(() => {
      console.log('P2P connection timeout, attempting Uploadcare upload...');
      if (pcRef.current?.connectionState !== 'connected') {
        uploadToUploadcare(file);
      }
      p2pTimeoutRef.current = null;
    }, 30000);
  };

  const startReceive = () => {
    if (!room) {
      showToast('error', 'Enter the four-letter room code.');
      return;
    }
    setMode('receive');
    joinRoom(room, null, false);
  };

  const pickFile = (fileList) => {
    if (!fileList?.length) return;
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(fileList[0]);
    fileRef.current.files = dataTransfer.files;
    setFileName(fileList[0].name);
    setHasFile(true);
    setToast(null);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    pickFile(e.dataTransfer.files);
  };

  const IconSend = () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3v12m0 0l4-4m-4 4l-4-4M5 21h14"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  const IconReceive = () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 21V9m0 0l4 4m-4-4l-4 4M5 3h14"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  const IconLogo = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 12h10M12 7v10"
        stroke="#0c0a12"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );

  return (
    <div className="app-root">
      <div className="app-bg" aria-hidden />
      <div className="app-grid" aria-hidden />
      <div className="app-noise" aria-hidden />
      <div className="app-shell">
        <div className="app-card">
          <div className="brand">
            <div className="brand-mark">
              <IconLogo />
            </div>
            <div>
              <h1>Aurora Beam</h1>
            </div>
          </div>
          <p className="tagline">
            WebRTC peer transfer with an Uploadcare safety net when the direct path does not come up.
          </p>

          <div className="pills">
            <span className="pill pill-accent">WebRTC data channel</span>
            <span className="pill">Uploadcare cloud</span>
            <span className="pill">Room codes</span>
          </div>

          {!mode ? (
            <div className="mode-grid">
              <button type="button" className="mode-tile" onClick={() => setMode('send')}>
                <IconSend />
                <h2>Send</h2>
                <p>Open a room, share the code, and push bytes straight to your peer.</p>
              </button>
              <button type="button" className="mode-tile" onClick={() => setMode('receive')}>
                <IconReceive />
                <h2>Receive</h2>
                <p>Enter the code you were given and accept the incoming file.</p>
              </button>
            </div>
          ) : mode === 'send' ? (
            <>
              <div className="back-row">
                <button type="button" className="btn btn-ghost" onClick={goHome}>
                  ← Back
                </button>
              </div>
              <label
                className={`dropzone ${dragOver ? 'drag' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
              >
                <input
                  type="file"
                  ref={fileRef}
                  onChange={(e) => pickFile(e.target.files)}
                />
                <strong>Drop a file or tap to browse</strong>
                <span>Anything your browser can read — we keep the UI local until transfer.</span>
              </label>
              {fileName ? (
                <div className="file-chip" title={fileName}>
                  <span aria-hidden>📎</span>
                  {fileName}
                </div>
              ) : null}

              <div className="panel-actions">
                <button type="button" className="btn btn-primary" onClick={startSend}>
                  Start peer transfer
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={!hasFile || isUploading}
                  onClick={() => fileRef.current?.files[0] && uploadToUploadcare(fileRef.current.files[0])}
                >
                  Upload to Uploadcare
                </button>
              </div>

              {room ? (
                <div className="room-code-display">
                  <div className="label">Room code</div>
                  <p className="code">{room}</p>
                </div>
              ) : null}

              {isUploading ? (
                <div className="progress-wrap">
                  <div className="progress-label">
                    <span>Uploading with Uploadcare</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              ) : null}

              {cloudLink ? (
                <div className="link-box">
                  <div className="progress-label" style={{ marginBottom: 8 }}>
                    <span>CDN link</span>
                  </div>
                  <a href={cloudLink} target="_blank" rel="noopener noreferrer">
                    {cloudLink}
                  </a>
                  <div className="panel-actions" style={{ marginTop: 12 }}>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => {
                        navigator.clipboard.writeText(cloudLink);
                        showToast('ok', 'Link copied to clipboard.');
                      }}
                    >
                      Copy link
                    </button>
                  </div>
                </div>
              ) : null}

              <p className="hint">
                If the peer route stalls ~30s or ICE fails, we automatically try Uploadcare (when your public key is
                configured).
              </p>
            </>
          ) : (
            <>
              <div className="back-row">
                <button type="button" className="btn btn-ghost" onClick={goHome}>
                  ← Back
                </button>
              </div>
              <div className="room-field">
                <input
                  type="text"
                  placeholder="CODE"
                  value={room}
                  onChange={(e) => setRoom(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4))}
                  maxLength={4}
                  autoComplete="off"
                  spellCheck={false}
                />
                <button type="button" className="btn btn-primary" onClick={startReceive}>
                  Join & receive
                </button>
              </div>
              <p className="hint">Ask the sender for the glowing four-character code, then join once they started.</p>
            </>
          )}

          {toast ? (
            <div className={`toast toast-${toast.type === 'error' ? 'error' : toast.type === 'warn' ? 'warn' : 'ok'}`}>
              {toast.message}
            </div>
          ) : null}

          {!UPLOADCARE_KEY ? (
            <div className="toast toast-warn" style={{ marginTop: 12 }}>
              Cloud fallback is paused: set <code style={{ color: '#fff' }}>VITE_UPLOADCARE_PUBLIC_KEY</code> for
              Vercel builds.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
