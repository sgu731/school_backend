const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const db = require('../utils/db');

const router = express.Router();

/* ========= 忘記密碼：寄送 reset link ========= */
router.post('/forgot-password', (req, res) => {
  const { email } = req.body;

  db.query('SELECT * FROM users WHERE email = ?', [email], (err, rows) => {
    if (err) return res.status(500).json({ message: '資料庫錯誤' });
    if (!rows.length) return res.status(404).json({ message: '找不到此使用者' });

    const user = rows[0];
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '15m' });
    const resetLink = `http://localhost:3000/reset-password/${token}`;
    // console.log('Password Reset Link:', resetLink);

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS
      }
    });

    transporter.verify((e) => {
      if (e) console.error('SMTP 驗證失敗:', e);
      else console.log('Gmail SMTP 已就緒');
    });

    transporter.sendMail({
      from: `"Learning Helper" <${process.env.MAIL_USER}>`,
      to: email,
      subject: '[Learning Helper] 密碼重設連結',
      text: `請點擊下方連結重設密碼（15 分鐘內有效）：\n${resetLink}`,
      html: `
        <p>給我記住你的密碼！</p>
        <p>點擊以下連結重設密碼：</p>
        <p><a href="${resetLink}">${resetLink}</a></p>
        <p>此連結將在 15 分鐘後失效。</p>
        <p>若未曾申請重設密碼，請忽略本信件。</p>
        <p>感謝使用 Learning Helper。</p>
      `
    }, (mailErr, info) => {
      if (mailErr) {
        console.error('寄信錯誤:', mailErr);
        return res.status(500).json({ message: '寄信失敗' });
      }
      console.log('寄信成功:', info);
      res.json({ message: '已寄出密碼重設連結至您的信箱' });
    });
  });
});

/* ========= 密碼重設 ========= */
router.post('/reset-password', (req, res) => {
  const { token, password } = req.body;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    bcrypt.hash(password, 10, (hashErr, hashedPassword) => {
      if (hashErr) {
        console.error('密碼加密失敗:', hashErr);
        return res.status(500).json({ message: '密碼加密失敗' });
      }

      db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId], (updateErr, result) => {
        if (updateErr || result.affectedRows === 0) {
          console.error('密碼更新失敗:', updateErr);
          return res.status(500).json({ message: '密碼更新失敗' });
        }

        res.json({ message: '密碼更新成功' });
      });
    });
  } catch (err) {
    console.error('Token 錯誤或過期:', err);
    res.status(400).json({ message: 'Token 無效或已過期' });
  }
});

/* ========= 檢查 token 有效性 ========= */
router.get('/reset-password/:token', (req, res) => {
  try {
    jwt.verify(req.params.token, process.env.JWT_SECRET);
    res.json({ valid: true });
  } catch {
    res.status(400).json({ valid: false });
  }
});

module.exports = router;
