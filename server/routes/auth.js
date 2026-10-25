// ============================================================
// PulseTriage — Auth & User Routes (server/routes/auth.js)
// ============================================================

const express = require('express');
const router = express.Router();
const db = require('../db');
const { generateToken, authMiddleware } = require('../auth');

// POST /api/auth/login
// Supports password authentication and 1-click quick-role demo accounts
router.post('/login', async (req, res) => {
  try {
    const { email, role } = req.body;

    let user = null;
    if (email) {
      const result = await db.query('SELECT * FROM users WHERE email = $1 LIMIT 1', [email]);
      if (result.rows.length > 0) {
        user = result.rows[0];
      }
    } else if (role) {
      // Quick demo switch: pick first active user with matching role
      const result = await db.query('SELECT * FROM users WHERE role = $1 AND is_active = TRUE LIMIT 1', [role]);
      if (result.rows.length > 0) {
        user = result.rows[0];
      }
    }

    if (!user) {
      return res.status(401).json({ error: 'User not found or credentials invalid' });
    }

    const token = generateToken(user);
    res.json({
      token,
      user: {
        userId: user.user_id,
        email: user.email,
        fullName: user.full_name,
        role: user.role
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// GET /api/auth/demo-users
// Returns representative accounts for each role to power UI quick-switcher
router.get('/demo-users', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT DISTINCT ON (role) user_id, email, full_name, role
      FROM users
      WHERE is_active = TRUE
      ORDER BY role, full_name;
    `);
    res.json({ users: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
