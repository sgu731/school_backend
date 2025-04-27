const express = require('express');
const router = express.Router();
const { verifyToken } = require('../utils/jwt');
const db = require('../utils/db');
const multer = require('multer');
const path = require('path');

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

// 修改使用者名字
router.patch('/', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const { name } = req.body;

  if (!name || name.trim() === '') {
    return res.status(400).json({ message: '名字不能是空的' });
  }

  const query = 'UPDATE users SET name = ? WHERE id = ?';
  db.query(query, [name, userId], (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Database error', error: err });
    }
    res.json({ message: '名字更新成功' });
  });
});

// 修改密碼
router.patch('/password', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ message: '舊密碼和新密碼都要填寫' });
  }

  // 查詢舊密碼是否正確
  const queryCheck = 'SELECT password FROM users WHERE id = ?';
  db.query(queryCheck, [userId], (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Database error', error: err });
    }
    if (results.length === 0) {
      return res.status(404).json({ message: '找不到使用者' });
    }

    const currentPassword = results[0].password;

    if (currentPassword !== oldPassword) {
      return res.status(400).json({ message: '舊密碼錯誤' });
    }

    // 舊密碼正確，更新成新密碼
    const queryUpdate = 'UPDATE users SET password = ? WHERE id = ?';
    db.query(queryUpdate, [newPassword, userId], (err2) => {
      if (err2) {
        return res.status(500).json({ message: '更新密碼失敗', error: err2 });
      }
      res.json({ message: '密碼修改成功' });
    });
  });
});

//上傳大頭貼
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads'); 
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`); 
  }
});
const upload = multer({ storage });

router.post('/avatar', authenticateToken, upload.single('avatar'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: '沒有上傳檔案' });
  }

  const userId = req.user.userId;
  const avatarPath = `/uploads/${req.file.filename}`; 

  const query = 'UPDATE users SET avatar = ? WHERE id = ?';
  db.query(query, [avatarPath, userId], (err) => {
    if (err) {
      console.error('更新資料庫錯誤:', err);
      return res.status(500).json({ message: '更新資料庫錯誤' });
    }

    res.json({ message: '上傳成功', avatarUrl: avatarPath });
  });
});

module.exports = router;