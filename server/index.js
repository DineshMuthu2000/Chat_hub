const express = require('express');
const fs = require('fs');

const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const store = require('./db/store');
const { setIo } = require('./socket');
const { createChatMessage } = require('./services/chatService');
const authRoutes = require('./routes/auth');
const questionRoutes = require('./routes/questions');
const chatRoutes = require('./routes/chats');
const uploadRoutes = require('./routes/uploads');
const notificationRoutes = require('./routes/notifications');
const adminRoutes = require('./routes/admin');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Share the io instance so REST routes can broadcast realtime chat events
setIo(io);

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Serve React production build if available
app.use(express.static(path.join(__dirname, '../client/dist')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/doubts', questionRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);

// Socket.IO Real-time Connection
const activeSockets = new Map(); // socket.id -> userId

io.on('connection', (socket) => {
  console.log('🔌 New client connected:', socket.id);

  // Authenticate & register user socket
  socket.on('register_user', (userData) => {
    if (userData && userData.id) {
      socket.userId = userData.id;
      socket.username = userData.username;
      activeSockets.set(socket.id, userData.id);
      
      // Join general room by default
      socket.join('general');
      console.log(`👤 User registered on socket: ${userData.username} (${userData.id})`);
    }
  });

  // Join channel room
  socket.on('join_room', (roomId) => {
    socket.join(roomId);
    console.log(`📌 Socket ${socket.id} joined room: ${roomId}`);
  });

  // Leave channel room
  socket.on('leave_room', (roomId) => {
    socket.leave(roomId);
    console.log(`🚪 Socket ${socket.id} left room: ${roomId}`);
  });

  // Handle incoming live chat message (persist + broadcast via shared service)
  socket.on('send_chat_message', (msgData) => {
    try {
      createChatMessage({
        sender_id: msgData.sender_id,
        sender_name: msgData.sender_name,
        recipient_id: msgData.recipient_id || null,
        room_id: msgData.room_id || 'general',
        message: msgData.message || '',
        attachment_url: msgData.attachment_url || null,
        attachment_type: msgData.attachment_type || null,
        attachment_name: msgData.attachment_name || null,
        attachment_size: msgData.attachment_size || null,
        client_msg_id: msgData.client_msg_id || null,
        reply_to_id: msgData.reply_to_id || null
      });
    } catch (err) {
      console.error('Error handling socket message:', err);
    }
  });

  socket.on('disconnect', () => {
    activeSockets.delete(socket.id);
    console.log('⚡ Client disconnected:', socket.id);
  });
});

// SPA Fallback for Client routes
app.get('*', (req, res) => {
  const clientIndex = path.join(__dirname, '../client/dist/index.html');
  if (fs.existsSync(clientIndex)) {
    res.sendFile(clientIndex);
  } else {
    res.send('Backend API running. Client build in progress or not yet generated.');
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Anonymous Community Server running on port ${PORT}`);
});
