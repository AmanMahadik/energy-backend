const User = require('../models/user');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'default_secret_key';
const RESET_TOKEN_EXPIRATION = 3600000; // 1 hour

// 📝 Register User
exports.register = async (req, res) => {
  try {
    const { email, username, password } = req.body;

    if (!email || !username || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const userId = await User.create({ email, username, password });

    const token = jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '1d' });

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

// 🔐 Login User
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await User.validatePassword(user, password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

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

// 📩 Forgot Password
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!email) return res.status(400).json({ message: 'Email is required' });

  const user = await User.findByEmail(email);
  if (!user) return res.status(404).json({ message: 'User not found' });

  // Generate a random reset token
  const token = crypto.randomBytes(20).toString('hex');
  const expiry = Date.now() + RESET_TOKEN_EXPIRATION;

  // Store the reset token and its expiration
  await User.updatePassword(user.id, token);  // Here we store the reset token in the user record
  await db.run('UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE id = ?', [token, expiry, user.id]);

  // Send reset token via email (using nodemailer in production)
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',  // Use Gmail or any email service provider
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const resetLink = `http://your-app-url/reset-password?token=${token}`;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Password Reset Request',
      text: `You have requested to reset your password. Click the link below to reset your password: \n\n${resetLink}\n\nIf you did not request a password reset, please ignore this email.`,
    };

    await transporter.sendMail(mailOptions);

    res.json({
      message: 'Password reset link sent to your email.',
    });
  } catch (error) {
    console.error('Error sending reset email:', error);
    res.status(500).json({ message: 'Error sending reset email' });
  }
};

// 🔑 Reset Password
exports.resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ message: 'Token and new password are required' });
  }

  // Find user by the reset token
  const user = await User.findByResetToken(token);
  if (!user || user.reset_token_expiry < Date.now()) {
    return res.status(400).json({ message: 'Invalid or expired token' });
  }

  // Update the user's password
  await User.updatePassword(user.id, newPassword);

  // Clear the reset token and expiry
  await User.clearResetToken(user.id);

  res.json({ message: 'Password updated successfully' });
};
