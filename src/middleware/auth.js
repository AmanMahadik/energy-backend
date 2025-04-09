// File: middleware/auth.js
const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  // Get token from header
  const token = req.header('x-auth-token');
  
  // Log request for debugging
  console.log(`Auth middleware checking request to ${req.originalUrl}`);
  console.log(`Token present: ${token ? 'Yes' : 'No'}`);
  
  // Check if token exists
  if (!token) {
    console.log('Authentication failed: No token provided');
    return res.status(401).json({ message: 'No token, authorization denied' });
  }
  
  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    
    // Add user from payload
    req.user = decoded;
    console.log(`Authentication successful for user ID: ${req.user.id}`);
    next();
  } catch (error) {
    console.log(`Token verification failed: ${error.message}`);
    
    // Provide more specific error messages
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token has expired' });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    
    res.status(401).json({ message: 'Token is not valid' });
  }
};