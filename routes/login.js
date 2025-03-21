const express = require('express');
const db = require('../utils/db');
const { generateToken } = require('../utils/jwt');
const router = express.Router();

// 登入 API
// router.post('/login', (req, res) => {
router.post('/', (req, res) => {
  const { username, password, rememberMe } = req.body;

  const query = 'SELECT * FROM users WHERE username = ? AND password = ?';
  db.query(query, [username, password], (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }
    if (results.length > 0) {
      const user = results[0];

      // 生成 JWT
      const token = generateToken(
        { userId: user.id, username: user.username },
        rememberMe ? '7d' : '1h'
      );
      console.log("登入成功");      
      // 這裡直接把名字跟其他資訊寫在 json 裡
      return res.json({ message: 'Login successful', token, name: user.name });
    } else {
      return res.status(401).json({ message: 'Invalid username or password' });
    }
  });
});

module.exports = router;