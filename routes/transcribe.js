const express = require('express');
const router = express.Router();
const fileUpload = require('express-fileupload');
const FormData = require('form-data'); 
const { PassThrough } = require('stream');
const axios = require('axios');
const db = require('../utils/db');
const { verifyToken } = require('../utils/jwt');

router.use(fileUpload());

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

// 轉錄功能
router.post('/transcribe', authenticateToken, async (req, res) => {
    console.log("轉錄中");
    try {
        if (!req.files || !req.files.audio) {
            return res.status(400).json({ error: 'No audio file uploaded' });
        }

        const audioFile = req.files.audio;
        const allowedMimeTypes = ['audio/mpeg', 'audio/wav', 'audio/x-m4a'];

        // 檢查檔案 MIME 類型
        if (!allowedMimeTypes.includes(audioFile.mimetype)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid file format. Only MP3, WAV, and M4A are supported.'
            });
        }

        // 轉發給 Python 服務
        // 使用 form-data
        const formData = new FormData();
        const stream = new PassThrough();
        stream.end(audioFile.data);
        formData.append('file', stream, {
            filename: audioFile.name,
            contentType: audioFile.mimetype
        });

        const response = await axios.post('http://localhost:8000/transcribe', formData, {
            headers: {
                ...formData.getHeaders()
            },
            timeout: 300000
        });

        const result = response.data;

        if (result.success) {
            res.json({
                success: true,
                transcription: result.transcription,
                language: result.language,
                device_used: result.device_used,
                user: req.user // 可選：返回使用者資訊
            });
            // 儲存到 MySQL
            await db.query(
                'INSERT INTO transcriptions (user_id, transcription, source, language, device_used) VALUES (?, ?, ?, ?, ?)',
                [
                    req.user.userId, // JWT 中包含 user.userId 所以直接打這個就好
                    result.transcription,
                    result.source || 'whisper',
                    result.language || 'zh',
                    result.device_used || null
                ]
            );            
        } else {
            res.status(500).json({
                success: false,
                error: result.error,
                details: result.details
            });
        }
    } catch (error) {
        if (error.code === 'ECONNABORTED') {
            return res.status(504).json({
                success: false,
                error: 'Transcription timeout',
                details: 'The request took too long to process'
            });
        }
        console.error('Transcription error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to transcribe audio',
            details: error.message
        });
    }
});

// Youtube語音轉錄功能
router.post('/youtube', authenticateToken, async (req, res) => {
    console.log("Youtube 轉錄功能 ");
    try {
        const { url } = req.body;
        if (!url) {
            return res.status(400).json({ error: 'No YouTube URL provided' });
        }

        const response = await axios.post('http://localhost:8000/transcribe/youtube', 
            `url=${encodeURIComponent(url)}`, 
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                timeout: 300000
            }
        );

        const result = response.data;

        if (result.success) {
            res.json({
                success: true,
                transcription: result.transcription,
                language: result.language,
                user: req.user
            });
            // 儲存到 MySQL
            await db.query(
                'INSERT INTO transcriptions (user_id, transcription, source, language, device_used) VALUES (?, ?, ?, ?, ?)',
                [
                    req.user.userId,
                    result.transcription,
                    result.source || 'whisper',
                    result.language || 'zh',
                    result.device_used || null
                ]
            );
        } else {
            res.status(500).json({
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        console.error('Transcription error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to transcribe YouTube video',
            details: error.message
        });
    }
});

router.get('/transcriptions', authenticateToken, async (req, res) => {
    console.log("讀取轉錄的歷史資料...");
    db.query(
        'SELECT id, transcription, source, language, device_used, created_at FROM transcriptions WHERE user_id = ? ORDER BY created_at DESC',
        [req.user.userId],
        (error, results) => {
            if (error) {
                console.error('Fetch transcriptions error:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to fetch transcriptions',
                    details: error.message
                });
            }
            //console.log('Query results:', results);
            res.json({
                success: true,
                transcriptions: results || []
            });
        }
    );
});

module.exports = router;