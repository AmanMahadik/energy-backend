const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const auth = require('../middleware/auth');
const sendEmail = require('../utils/sendEmail'); // ✅ Email sender

// Create users table if it doesn't exist
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

// ✅ Register new user
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ message: 'Please enter all fields' });
  }

  try {
    db.get(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [username, email],
      async (err, row) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ message: 'Server error' });
        }

        if (row) {
          if (row.username === username) {
            return res.status(400).json({ message: 'Username already exists' });
          } else {
            return res.status(400).json({ message: 'Email already exists' });
          }
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        db.run(
          'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
          [username, email, hashedPassword],
          function (err) {
            if (err) {
              console.error('Error creating user:', err);
              return res.status(500).json({ message: 'Error creating user' });
            }

            const token = jwt.sign(
              { id: this.lastID, username },
              process.env.JWT_SECRET || 'your_jwt_secret',
              { expiresIn: '7d' }
            );

            res.json({
              token,
              id: this.lastID,
              username,
              email
            });
          }
        );
      }
    );
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ✅ Login user
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Please enter all fields' });
  }

  db.get(
    'SELECT * FROM users WHERE username = ?',
    [username],
    async (err, user) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Server error' });
      }

      if (!user) {
        return res.status(400).json({ message: 'User does not exist' });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { id: user.id, username: user.username },
        process.env.JWT_SECRET || 'your_jwt_secret',
        { expiresIn: '7d' }
      );

      res.json({
        token,
        id: user.id,
        username: user.username,
        email: user.email
      });
    }
  );
});

// ✅ Forgot Password Route
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  try {
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Server error' });
      }

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const resetLink = `http://yourfrontend.com/reset-password?email=${email}`;
      const message = `Click the link to reset your password: ${resetLink}`;

      await sendEmail(email, 'Password Reset Request', message);
      res.status(200).json({ message: 'Password reset email sent' });
    });
  } catch (error) {
    console.error('Error in forgot-password:', error);
    res.status(500).json({ message: 'Failed to send email' });
  }
});

// ✅ Reset Password Route
router.post('/reset-password', async (req, res) => {
  const { email, newPassword } = req.body;

  try {
    if (!email || !newPassword) {
      return res.status(400).json({ message: 'Email and new password are required' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    db.run(
      'UPDATE users SET password = ? WHERE email = ?',
      [hashedPassword, email],
      function (err) {
        if (err) {
          console.error('Database error during password reset:', err);
          return res.status(500).json({ message: 'Server error' });
        }

        if (this.changes === 0) {
          return res.status(404).json({ message: 'User not found or email is incorrect' });
        }

        res.status(200).json({ message: 'Password has been reset successfully' });
      }
    );
  } catch (error) {
    console.error('Error in reset-password:', error);
    res.status(500).json({ message: 'Failed to reset password' });
  }
});

// ✅ Verify token endpoint
router.get('/verify', auth, (req, res) => {
  res.json({
    message: 'Token is valid',
    user: {
      id: req.user.id,
      username: req.user.username
    }
  });
});

// ✅ Refresh token
router.post('/refresh-token', auth, (req, res) => {
  const token = jwt.sign(
    { id: req.user.id, username: req.user.username },
    process.env.JWT_SECRET || 'your_jwt_secret',
    { expiresIn: '7d' }
  );

  res.json({ token });
});

// ✅ Get user data
router.get('/user', auth, (req, res) => {
  db.get(
    'SELECT id, username, email, created_at FROM users WHERE id = ?',
    [req.user.id],
    (err, user) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Server error' });
      }

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({ user });
    }
  );
});

module.exports = router;
