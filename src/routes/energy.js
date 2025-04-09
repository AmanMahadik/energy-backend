// File: routes/energy.js
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const auth = require('../middleware/auth');

// Create necessary tables if they don't exist
db.serialize(() => {
  // Appliances table
  db.run(`
    CREATE TABLE IF NOT EXISTS appliances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      power_consumption REAL NOT NULL,
      hours REAL NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  
  // Energy summary table for quick access to total consumption
  db.run(`
    CREATE TABLE IF NOT EXISTS user_energy_summary (
      user_id INTEGER PRIMARY KEY,
      daily_consumption REAL NOT NULL DEFAULT 0,
      monthly_consumption REAL NOT NULL DEFAULT 0,
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
});

// GET user's appliances
router.get('/appliances', auth, (req, res) => {
  const userId = req.user.id;
  
  db.all(
    `SELECT id, name, power_consumption as powerConsumption, hours 
     FROM appliances 
     WHERE user_id = ?`,
    [userId],
    (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Error retrieving appliances' });
      }
      
      return res.json({ appliances: rows });
    }
  );
});

// GET user's energy summary
router.get('/summary', auth, (req, res) => {
  const userId = req.user.id;
  
  db.get(
    `SELECT daily_consumption as dailyConsumption, monthly_consumption as monthlyConsumption 
     FROM user_energy_summary 
     WHERE user_id = ?`,
    [userId],
    (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Error retrieving energy summary' });
      }
      
      // If no summary exists yet, return zeros
      if (!row) {
        return res.json({ 
          summary: { 
            dailyConsumption: 0, 
            monthlyConsumption: 0 
          } 
        });
      }
      
      return res.json({ summary: row });
    }
  );
});

// POST/Update user's appliances
router.post('/appliances', auth, (req, res) => {
  const userId = req.user.id;
  const { appliances } = req.body;
  
  if (!appliances || !Array.isArray(appliances)) {
    return res.status(400).json({ message: 'Invalid appliance data' });
  }
  
  // Calculate total energy consumption
  let dailyConsumption = 0;
  appliances.forEach(appliance => {
    // kWh = Power (watts) * Hours / 1000
    const applianceConsumption = (appliance.powerConsumption * appliance.hours) / 1000;
    dailyConsumption += applianceConsumption;
  });
  
  const monthlyConsumption = dailyConsumption * 30;
  
  // Start a transaction
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    
    try {
      // First, remove existing appliances for this user
      db.run('DELETE FROM appliances WHERE user_id = ?', [userId]);
      
      // Prepare statement for insertion
      const stmt = db.prepare(
        'INSERT INTO appliances (user_id, name, power_consumption, hours) VALUES (?, ?, ?, ?)'
      );
      
      // Insert each appliance
      appliances.forEach(appliance => {
        stmt.run(
          userId, 
          appliance.name, 
          appliance.powerConsumption || 0, 
          appliance.hours || 0
        );
      });
      
      // Finalize statement
      stmt.finalize();
      
      // Update or insert the energy summary
      db.run(`
        INSERT INTO user_energy_summary (user_id, daily_consumption, monthly_consumption)
        VALUES (?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          daily_consumption = excluded.daily_consumption,
          monthly_consumption = excluded.monthly_consumption,
          last_updated = CURRENT_TIMESTAMP
      `, [userId, dailyConsumption, monthlyConsumption]);
      
      // Commit transaction
      db.run('COMMIT');
      
      return res.json({ 
        success: true, 
        message: 'Appliance data saved successfully',
        summary: {
          dailyConsumption,
          monthlyConsumption
        }
      });
    } catch (error) {
      // If there's an error, rollback the transaction
      db.run('ROLLBACK');
      console.error('Error saving appliances:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Error saving appliance data' 
      });
    }
  });
});

// Replace the existing leaderboard route in routes/energy.js with this code

// GET leaderboard data (all users ranked by energy savings)
router.get('/leaderboard', auth, (req, res) => {
  // Get average energy consumption across all users to establish a baseline
  db.get(
    `SELECT AVG(monthly_consumption) as avg_consumption FROM user_energy_summary`,
    [],
    (err, avgRow) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Error retrieving leaderboard data' });
      }
      
      const avgConsumption = avgRow ? avgRow.avg_consumption : 0;
      
      // Get all users with their consumption data
      db.all(
        `SELECT u.username, 
                s.daily_consumption as dailyConsumption, 
                s.monthly_consumption as monthlyConsumption,
                CASE 
                  WHEN s.monthly_consumption = 0 THEN 0
                  WHEN ${avgConsumption} = 0 THEN 0
                  ELSE ((${avgConsumption} - s.monthly_consumption) / ${avgConsumption} * 100)
                END as savingsPercentage,
                CASE 
                  WHEN s.monthly_consumption = 0 THEN 0
                  WHEN ${avgConsumption} = 0 THEN 0
                  ELSE (${avgConsumption} - s.monthly_consumption)
                END as energySaved
         FROM user_energy_summary s
         JOIN users u ON s.user_id = u.id
         ORDER BY savingsPercentage DESC, energySaved DESC`,
        [],
        (err, rows) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'Error retrieving leaderboard data' });
          }
          
          // Add rank badges based on position
          const rankedData = rows.map((row, index) => {
            let badge = 'New';
            
            // Assign badges based on ranking
            if (index === 0) badge = 'Energy Champion';
            else if (index === 1) badge = 'Energy Master';
            else if (index === 2) badge = 'Energy Expert';
            else if (index < 10) badge = 'Energy Saver';
            
            // Round values to improve readability
            return {
              ...row,
              savingsPercentage: parseFloat(row.savingsPercentage.toFixed(1)),
              energySaved: parseFloat(row.energySaved.toFixed(2)),
              badge
            };
          });
          
          return res.json({ 
            leaderboard: rankedData,
            averageConsumption: avgConsumption
          });
        }
      );
    }
  );
});
module.exports = router;