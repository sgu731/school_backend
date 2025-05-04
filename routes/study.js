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
  console.log('收到的 token:', token);
  try {
    const user = verifyToken(token);
    req.user = user;
    next();
  } catch (err) {
    console.error('JWT 驗證失敗:', err); 
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
};

// 獲取使用者的科目列表
router.get('/subjects', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    const query = 'SELECT * FROM subjects WHERE user_id = ?';
    db.query(query, [userId], (err, results) => {
    if (err) {
        return res.status(500).json({ message: 'Database error', error: err });
    }
    res.json({ subjects: results });
    });
});

// 新增科目
router.post('/subjects', authenticateToken, (req, res) => {
    const { name } = req.body; // 科目名稱
    const userId = req.user.userId; // 從 JWT 中獲取用戶 ID

    const query = 'INSERT INTO subjects (user_id, name) VALUES (?, ?)';
    db.query(query, [userId, name], (err, results) => {
    if (err) {
        return res.status(500).json({ message: 'Database error', error: err });
    }
    res.json({ message: 'Subject added successfully', subjectId: results.insertId });
    });
});

// 獲取使用者的讀書紀錄
router.get('/study-records', authenticateToken, (req, res) => {
    const userId = req.user.userId;

    const query = `
        SELECT study_records.*, subjects.name AS subject_name
        FROM study_records
        JOIN subjects ON study_records.subject_id = subjects.id
        WHERE study_records.user_id = ?
    `;
    db.query(query, [userId], (err, results) => {
        if (err) {
        return res.status(500).json({ message: 'Database error', error: err });
        }
        res.json({ studyRecords: results });
    });
});

// 保存讀書紀錄
router.post('/study-records', authenticateToken, (req, res) => {
    const { subjectId, duration } = req.body; // 科目 ID 和讀書時間
    const userId = req.user.userId; // 從 JWT 中獲取用戶 ID

    const query = 'INSERT INTO study_records (user_id, subject_id, duration) VALUES (?, ?, ?)';
    db.query(query, [userId, subjectId, duration], (err, results) => {
    if (err) {
        return res.status(500).json({ message: 'Database error', error: err });
    }
    res.json({ message: 'Study record saved successfully', recordId: results.insertId });
    });
});

module.exports = router;
