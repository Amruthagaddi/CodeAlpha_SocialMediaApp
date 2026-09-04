const http = require('http');
const { Server } = require('socket.io');

const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const { initMinio, minioClient, bucketName, isMinioAvailable } = require('./config/minio');

// Load environment variables
dotenv.config();

// Connect to MongoDB & MinIO
connectDB();
initMinio();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Attach io to app for access in controllers if needed
app.set('io', io);

// Socket.io Real-Time Room & Event Handling
io.on('connection', (socket) => {
  socket.on('join_user', (userId) => {
    if (userId) {
      socket.join(userId.toString());
    }
  });

  socket.on('send_direct_message', (data) => {
    if (data && data.recipientId) {
      io.to(data.recipientId.toString()).emit('receive_direct_message', data);
    }
  });

  socket.on('disconnect', () => {});
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
const frontendPath = path.join(__dirname, '../frontend');
app.use(express.static(frontendPath));

// Stream Media Route (Serves MinIO bucket objects or local fallback files)
app.get('/api/media/*', async (req, res) => {
  const objectName = req.params[0];
  if (!objectName) {
    return res.status(400).send('Object key required');
  }

  if (isMinioAvailable()) {
    try {
      const dataStream = await minioClient.getObject(bucketName, objectName);
      dataStream.on('error', (err) => {
        console.error('MinIO DataStream error:', err);
        return res.status(404).send('Image not found');
      });
      return dataStream.pipe(res);
    } catch (err) {
      // Fallback to local file if MinIO getObject fails
    }
  }

  const localFilePath = path.join(__dirname, '../uploads', objectName);
  if (fs.existsSync(localFilePath)) {
    return res.sendFile(localFilePath);
  }

  return res.status(404).send('Media file not found');
});

// Mount API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/posts', require('./routes/postRoutes'));
app.use('/api/comments', require('./routes/commentRoutes'));
app.use('/api/upload', require('./routes/uploadRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/messages', require('./routes/messageRoutes'));

// HTML Page Route Handler
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  const reqPath = req.path === '/' ? '/index.html' : req.path;
  const filePath = path.extname(reqPath) ? reqPath : `${reqPath}.html`;
  const absolutePath = path.join(frontendPath, filePath);

  res.sendFile(absolutePath, (err) => {
    if (err) {
      res.sendFile(path.join(frontendPath, 'index.html'));
    }
  });
});

// Centralized Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Global Error:', err.stack || err.message);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

const PORT = process.env.PORT || 5050;

server.listen(PORT, () => {
  console.log(`Mitra Social Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  console.log(`Mitra Web App accessible at http://localhost:${PORT}`);
});
