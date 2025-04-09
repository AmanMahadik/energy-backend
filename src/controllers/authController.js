const User = require('../models/user');
const jwt = require('jsonwebtoken');

// Load environment variables
require('dotenv').config();
const JWT_SECRET = process.env.JWT_SECRET || 'bcdisjvboudbncojzkxcol';

exports.register = async (req, res) => {
    try {
      console.log("Registration request received:", req.body);
      const { email, username, password } = req.body;
     
      // Simple validation
      if (!email || !username || !password) {
        console.log("Validation failed - missing fields");
        return res.status(400).json({ message: 'All fields are required' });
      }
     
      // Check if user already exists
      console.log("Checking if user exists with email:", email);
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        console.log("User already exists");
        return res.status(400).json({ message: 'User already exists' });
      }
     
      // Create user
      console.log("Creating new user");
      const userId = await User.create({ email, username, password });
      console.log("User created with ID:", userId);
     
      // Generate JWT
      const token = jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '1d' });
     
      console.log("Registration successful");
      res.status(201).json({
        message: 'User registered successfully',
        token,
        user: {
          id: userId,
          email,
          username
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  };

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    
    // Find user
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    
    // Validate password
    const isMatch = await User.validatePassword(user, password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    
    // Generate JWT
    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '1d' });
    
    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({
      id: user.id,
      email: user.email,
      username: user.username,
      created_at: user.created_at
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};