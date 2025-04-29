const express = require('express');
const router = express.Router();
const axios = require('axios');
const { verifyToken } = require('../utils/jwt');

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

router.post('/analyze', authenticateToken, async (req, res) => {
    console.log("正在跑 AI 分析功能...");
    try {
        const { text, prompt } = req.body;
        if (!text) {
            return res.status(400).json({ error: 'No text provided for analysis' });
        }

        const response = await axios.post('http://localhost:8000/ai/analyze',
            `transcription=${encodeURIComponent(text)}&prompt=${encodeURIComponent(prompt || '')}`,
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `Bearer ${req.headers['authorization'].split(' ')[1]}`
                },
                timeout: 30000
            }
        );

        res.json(response.data);
    } catch (error) {
        console.error('Analysis error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to analyze text',
            details: error.message
        });
    }
});

module.exports = router;