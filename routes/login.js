const express = require('express');
const db = require('../utils/db');
const bcrypt = require('bcrypt');
const { generateToken } = require('../utils/jwt');
const router = express.Router();

// 登入
router.post('/', (req, res) => {
  const { username, password, rememberMe } = req.body;

  db.query('SELECT * FROM users WHERE username = ?', [username], async (err, rows) => {
    if (err) return res.status(500).json({ message: '資料庫錯誤' });
    if (!rows.length) return res.status(401).json({ message: '帳號不存在' });

    const user = rows[0];
    let isPasswordValid = false;

    if (password === user.password) {
      isPasswordValid = true;
    } else {
      try {
        isPasswordValid = await bcrypt.compare(password, user.password);
      } catch (cmpErr) {
        return res.status(500).json({ message: '密碼比對錯誤' });
      }
    }

    if (!isPasswordValid) return res.status(401).json({ message: '密碼錯誤' });

    const token = generateToken(
      { userId: user.id, username: user.username },
      rememberMe ? '7d' : '1h'
    );
    res.json({ message: '登入成功', token, name: user.name, avatar: user.avatar });
  });
});

// 註冊
router.post('/register', (req, res) => {
  const { username, password, name, email } = req.body;
  if (!username || !password || !name || !email) {
    return res.status(400).json({ message: '請填寫所有欄位' });
  }

  db.query(
    'SELECT * FROM users WHERE username = ? OR email = ?',
    [username, email],
    (err, rows) => {
      if (err) return res.status(500).json({ message: '資料庫錯誤' });
      if (rows.length) {
        const dup = rows[0].username === username ? '帳號' : 'Email';
        return res.status(400).json({ message: `${dup} 已存在` });
      }

      bcrypt.hash(password, 10, (hashErr, hash) => {
        if (hashErr) return res.status(500).json({ message: '密碼加密失敗' });

        const sql = 'INSERT INTO users (username, password, name, email) VALUES (?,?,?,?)';
        db.query(sql, [username, hash, name, email], (insErr) => {
          if (insErr) return res.status(500).json({ message: '註冊失敗' });
          res.json({ message: '註冊成功' });
        });
      });
    }
  );
});

module.exports = router;
