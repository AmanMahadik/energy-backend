const express = require('express');
const cors = require('cors');
const authRoutes = require('./src/routes/auth');
const energyRoutes = require('./src/routes/energy');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Request logger middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  next();
});

// CORS configuration
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'x-auth-token']
}));

// Body parser
app.use(express.json());

// Test route for basic connectivity check
app.get('/test', (req, res) => {
  res.json({ message: 'Test endpoint is working!' });
});

// Main routes
app.use('/api/auth', authRoutes);
app.use('/api/energy', energyRoutes);

// Root route
app.get('/', (req, res) => {
  res.send('API is running');
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT} and accessible at http://localhost:${PORT}`);
  console.log('For physical devices, use your computer\'s IP address');
});