// Simple test script to verify the signaling server is working
const io = require('socket.io-client');

const serverUrl = 'http://13.233.212.34:3000';
console.log('Testing connection to:', serverUrl);

const socket = io(serverUrl);

socket.on('connect', () => {
  console.log('✅ Connected to signaling server');
  
  // Test joining a room
  const testRoom = 'TEST';
  console.log(`Joining test room: ${testRoom}`);
  socket.emit('join', testRoom);
});

socket.on('ready', (peerId) => {
  console.log('✅ Received ready event from peer:', peerId);
});

socket.on('disconnect', () => {
  console.log('❌ Disconnected from signaling server');
});

socket.on('connect_error', (error) => {
  console.log('❌ Connection error:', error.message);
});

// Test for 5 seconds then disconnect
setTimeout(() => {
  console.log('Test completed, disconnecting...');
  socket.disconnect();
  process.exit(0);
}, 5000);
