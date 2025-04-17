const db = require('../config/database'); // Ensure this path is correct for your database configuration
const bcrypt = require('bcrypt');

class User {
  // Method to find a user by email
  static findByEmail(email) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  }

  // Method to find a user by ID
  static findById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT id, email, username, created_at FROM users WHERE id = ?', [id], (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  }

  // Method to create a new user
  static async create(userData) {
    const { email, username, password } = userData;
    
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO users (email, username, password) VALUES (?, ?, ?)',
        [email, username, hashedPassword],
        function(err) {
          if (err) return reject(err);
          resolve(this.lastID); // Return the last inserted ID
        }
      );
    });
  }

  // Method to validate password (compare hashed password)
  static async validatePassword(user, password) {
    return bcrypt.compare(password, user.password); // Compare plain password with hashed password
  }

  // Method to find a user by reset token
  static findByResetToken(token) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE reset_token = ?', [token], (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  }

  // Method to update password
  static async updatePassword(userId, newPassword) {
    const hashedPassword = await bcrypt.hash(newPassword, 10); // Hash the new password
    
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE users SET password = ? WHERE id = ?',
        [hashedPassword, userId],
        function(err) {
          if (err) return reject(err);
          resolve(this.changes); // Returns the number of rows affected (should be 1 if successful)
        }
      );
    });
  }

  // Method to clear reset token and expiry
  static clearResetToken(userId) {
    return new Promise((resolve, reject) => {
      db.run('UPDATE users SET reset_token = NULL, reset_token_expiry = NULL WHERE id = ?', [userId], function(err) {
        if (err) return reject(err);
        resolve(this.changes); // Returns the number of rows affected (should be 1 if successful)
      });
    });
  }
}

module.exports = User;
