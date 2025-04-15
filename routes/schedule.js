const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { verifyToken } = require('../utils/jwt');

// middleware：驗證登入
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Access denied. No token.' });

  try {
    const user = verifyToken(token);
    req.user = user;
    next();
  } catch (err) {
    return res.status(403).json({ message: 'Invalid token' });
  }
};

// 取得某天的所有計畫
router.get('/', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const { date } = req.query; // eg: 2025-04-14
  const query = `
    SELECT s.*, sub.name AS subject_name
    FROM study_schedule s
    JOIN subjects sub ON s.subject_id = sub.id
    WHERE s.user_id = ? AND DATE(s.start_time) = ?
    ORDER BY s.start_time ASC
  `;
  db.query(query, [userId, date], (err, results) => {
    if (err) return res.status(500).json({ error: err });
    res.json({ schedule: results });
  });
});

// 新增
router.post('/', authenticateToken, (req, res) => {
  const { subjectId, startTime, endTime, note } = req.body;
  const userId = req.user.userId;

  const query = `
    INSERT INTO study_schedule (user_id, subject_id, start_time, end_time, note)
    VALUES (?, ?, ?, ?, ?)
  `;
  db.query(query, [userId, subjectId, startTime, endTime, note], (err, results) => {
    if (err) return res.status(500).json({ error: err });
    res.json({ message: 'Plan saved', scheduleId: results.insertId });
  });
});

// 修改
router.put('/:id', authenticateToken, (req, res) => {
  const { subjectId, startTime, endTime, note } = req.body;
  const { id } = req.params;
  const userId = req.user.userId;

  const query = `
    UPDATE study_schedule
    SET subject_id = ?, start_time = ?, end_time = ?, note = ?
    WHERE id = ? AND user_id = ?
  `;
  db.query(query, [subjectId, startTime, endTime, note, id, userId], (err) => {
    if (err) return res.status(500).json({ error: err });
    res.json({ message: 'Plan updated' });
  });
});

// 刪除
router.delete('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const userId = req.user.userId;

  const query = `DELETE FROM study_schedule WHERE id = ? AND user_id = ?`;
  db.query(query, [id, userId], (err) => {
    if (err) return res.status(500).json({ error: err });
    res.json({ message: 'Plan deleted' });
  });
});

module.exports = router;
