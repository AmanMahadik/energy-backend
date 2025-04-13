const Database = require('better-sqlite3');
const path = require('path');

// Create a database connection
const dbPath = path.resolve(__dirname, '../../database.sqlite');
const db = new Database(dbPath);

// Create users table if it doesn't exist
try {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      username TEXT UNIQUE,
      password TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  console.log('Connected to SQLite and ensured users table exists');
} catch (err) {
  console.error('Database setup error:', err);
}

module.exports = db;
