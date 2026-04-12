require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) =>
  res.send('P2P signaling server running (Uploadcare uploads happen from the browser)')
);

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
const PORT = process.env.PORT || 3000;

const rooms = {};

io.on('connection', (socket) => {
  console.log('New socket connected:', socket.id);

  socket.on('join', (roomId) => {
    console.log(`Socket ${socket.id} joining room ${roomId}`);
    socket.join(roomId);
    rooms[roomId] = rooms[roomId] || [];
    rooms[roomId].push(socket.id);

    const others = rooms[roomId].filter((id) => id !== socket.id);
    console.log(`Room ${roomId} has ${rooms[roomId].length} peers, notifying ${others.length} others`);
    others.forEach((otherId) => {
      io.to(otherId).emit('ready', socket.id);
    });
  });

  socket.on('offer', ({ target, sdp }) => {
    console.log(`Socket ${socket.id} sending offer to ${target}`);
    io.to(target).emit('offer', { from: socket.id, sdp });
  });

  socket.on('answer', ({ target, sdp }) => {
    console.log(`Socket ${socket.id} sending answer to ${target}`);
    io.to(target).emit('answer', { from: socket.id, sdp });
  });

  socket.on('ice-candidate', ({ target, candidate, room }) => {
    if (target) {
      console.log(`Socket ${socket.id} sending ICE candidate to ${target}`);
      io.to(target).emit('ice-candidate', { from: socket.id, candidate });
    } else if (room) {
      console.log(`Socket ${socket.id} broadcasting ICE candidate to room ${room}`);
      socket.to(room).emit('ice-candidate', { from: socket.id, candidate });
    }
  });

  socket.on('disconnect', () => {
    for (const room in rooms) {
      rooms[room] = rooms[room].filter((id) => id !== socket.id);
      if (!rooms[room].length) delete rooms[room];
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Signaling server running on port ${PORT}`);
});
