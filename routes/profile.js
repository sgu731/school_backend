const express = require('express');
const router = express.Router();
const { verifyToken } = require('../utils/jwt');
const db = require('../utils/db');

// 驗證 JWT 的 token
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  try {
    const user = verifyToken(token);
    req.user = user;
    next();
  } catch (err) {
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
};

// 使用者相關的東東
//router.get('/profile', authenticateToken, (req, res) => {
/*router.get('/', authenticateToken, (req, res) => {
  res.json({ message: 'Profile data', user: req.user });
});*/

router.get('/', authenticateToken, (req, res) => {
  const userId = req.user.userId;

  const query = 'SELECT name FROM users WHERE id = ?';
  db.query(query, [userId], (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Database error', error: err });
    }
    if (results.length > 0) {
      res.json({ message: 'Profile data', user: results[0] });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  });
});

module.exports = router;