// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const cors = require('cors');
const whatsappRouter = require('./routes/whatsapp');
const taskRouter = require('./routes/taskRoutes');
const reminderService = require('./services/reminderService');

// Initialize express app
const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware for debugging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  next();
});

// Routes
app.use('/api/whatsapp', whatsappRouter);
app.use('/api/tasks', taskRouter);

// API documentation route
app.get('/api', (req, res) => {
  res.json({
    message: 'WhatsApp Task Manager API',
    endpoints: {
      whatsapp: '/api/whatsapp',
      tasks: '/api/tasks'
    }
  });
});

// General 404 handler - Catch all requests that didn't match previous routes
app.use((req, res, next) => {
  // Only send 404 for routes starting with /api/
  if (req.originalUrl.startsWith('/api/')) {
    res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.originalUrl} not found`
    });
  } else {
    res.status(404).send('Resource not found.');
  }
});

// Global error handler (Must be LAST middleware)
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message
  });
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/task-manager')
  .then(() => {
    console.log('Connected to MongoDB');
    // Reschedule pending reminders on startup
    reminderService.rescheduleRemindersOnStartup();
  })
  .catch(err => console.error('MongoDB connection error:', err));

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = server;