/**
 * @file app.js
 * @description Express application configuration with security, logging, and routing middleware.
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const env = require('./config/env');
const requestLogger = require('./middleware/requestLogger');
const errorHandler = require('./middleware/errorHandler');
const apiRoutes = require('./routes/api');

const app = express();

// Security and parsing middleware
app.use(cors({
  origin: '*', // Adjust or specify client origins as required
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Structured HTTP request logger
app.use(requestLogger);

// Mount API routes
app.use('/api', apiRoutes);

// Production static file serving for React frontend
if (env.NODE_ENV === 'production') {
  const clientDistPath = path.resolve(__dirname, '../../client/dist');
  if (fs.existsSync(clientDistPath)) {
    // Serve static assets from Vite build
    app.use(express.static(clientDistPath));

    // For any non-API GET request, serve index.html for SPA routing
    app.get('*', (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) {
        return next();
      }
      res.sendFile(path.join(clientDistPath, 'index.html'));
    });
  }
}

// Catch-all 404 handler for undefined endpoints
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'NotFoundError',
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// Centralized error handling middleware
app.use(errorHandler);

module.exports = app;
