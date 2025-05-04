const express = require('express');
const router = express.Router();
const db = require('../utils/db');
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

// 創建房間
router.post('/rooms', authenticateToken, async (req, res) => {
    const { name } = req.body;
    const userId = req.user.userId;

    if (!name) {
        return res.status(400).json({
            success: false,
            error: '必須要設定自習室的名稱'
        });
    }

    try {
        // 查詢使用者名稱
        const userResults = await db.queryPromise('SELECT username FROM users WHERE id = ?', [userId]);
        if (!userResults[0]) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        const creator_name = userResults[0].username;

        // 開始
        await db.queryPromise('BEGIN');

        try {
            // 插入房間
            const roomResult = await db.queryPromise(
                'INSERT INTO rooms (name, creator_id, creator_name, status) VALUES (?, ?, ?, ?)',
                [name, userId, creator_name, status]
            );
            const roomId = roomResult.insertId;

            // 清除舊的房間成員記錄
            await db.queryPromise('DELETE FROM room_members WHERE user_id = ?', [userId]);

            // 將創建者加入房間
            await db.queryPromise('INSERT INTO room_members (room_id, user_id) VALUES (?, ?)', [roomId, userId]);

            // 提交事務
            await db.queryPromise('COMMIT');

            res.json({
                success: true,
                room: { id: roomId, userId, name, creator_name, status, creator_id: userId }
            });
        } catch (error) {
            // 出錯的話 rollback
            await db.queryPromise('ROLLBACK');
            throw error;
        }
    } catch (error) {
        console.error('Create room error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create room',
            details: error.message
        });
    }
});

// 加入房間
router.post('/:roomId/join', authenticateToken, (req, res) => {
    const roomId = req.params.roomId;
    const userId = req.user.userId;

    // 檢查房間是否存在
    db.query(
        'SELECT id FROM rooms WHERE id = ?',
        [roomId],
        (error, results) => {
            if (error) {
                console.error('Fetch room error:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to fetch room',
                    details: error.message
                });
            }
            if (!results[0]) {
                return res.status(404).json({
                    success: false,
                    error: '找不到此自習室'
                });
            }

            // 清除使用者的其他房間記錄
            db.query(
                'DELETE FROM room_members WHERE user_id = ?',
                [userId],
                (error) => {
                    if (error) {
                        console.error('Clear room members error:', error);
                        return res.status(500).json({
                            success: false,
                            error: 'Failed to clear room members',
                            details: error.message
                        });
                    }

                    // 插入新房間記錄
                    db.query(
                        'INSERT INTO room_members (room_id, user_id) VALUES (?, ?)',
                        [roomId, userId],
                        (error) => {
                            if (error) {
                                console.error('Join room error:', error);
                                return res.status(500).json({
                                    success: false,
                                    error: 'Failed to join room',
                                    details: error.message
                                });
                            }

                            res.json({
                                success: true,
                                message: '成功加入自習室'
                            });
                        }
                    );
                }
            );
        }
    );
});

// 獲取使用者加入的房間
router.get('/', authenticateToken, (req, res) => {
    const userId = req.user.userId;

    db.query(
        'SELECT r.id, r.name, r.creator_name, r.status, r.creator_id FROM rooms r JOIN room_members rm ON r.id = rm.room_id WHERE rm.user_id = ? ORDER BY r.created_at DESC',
        [userId],
        (error, results) => {
            if (error) {
                console.error('Fetch rooms error:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to fetch rooms',
                    details: error.message
                });
            }

            res.json({
                success: true,
                rooms: results || []
            });
        }
    );
});

// 獲取當前房間（最新加入的房間）
router.get('/current', authenticateToken, (req, res) => {
    const userId = req.user.userId;

    db.query(
        'SELECT r.id, r.name, r.creator_name, r.status, r.creator_id FROM rooms r JOIN room_members rm ON r.id = rm.room_id WHERE rm.user_id = ? ORDER BY rm.joined_at DESC LIMIT 1',
        [userId],
        (error, results) => {
            if (error) {
                console.error('Fetch current room error:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to fetch current room',
                    details: error.message
                });
            }

            res.json({
                success: true,
                room: results[0] || null
            });
        }
    );
});

// 獲取所有房間
router.get('/all', authenticateToken, (req, res) => {
    db.query(
        'SELECT id, name, creator_name, status, creator_id FROM rooms ORDER BY created_at DESC',
        (error, results) => {
            if (error) {
                console.error('Fetch all rooms error:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to fetch all rooms',
                    details: error.message
                });
            }

            res.json({
                success: true,
                rooms: results || []
            });
        }
    );
});

// 退出房間
router.delete('/leave', authenticateToken, (req, res) => {
    const userId = req.user.userId;

    // 查詢使用者最新的房間記錄
    db.query(
        'SELECT room_id FROM room_members WHERE user_id = ? ORDER BY joined_at DESC LIMIT 1',
        [userId],
        (error, results) => {
            if (error) {
                console.error('Fetch room member error:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to fetch room member',
                    details: error.message
                });
            }
            if (!results[0]) {
                return res.status(404).json({
                    success: false,
                    error: 'Not in any room'
                });
            }

            const roomId = results[0].room_id;

            // 刪除房間成員記錄
            db.query(
                'DELETE FROM room_members WHERE user_id = ? AND room_id = ?',
                [userId, roomId],
                (error) => {
                    if (error) {
                        console.error('Leave room error:', error);
                        return res.status(500).json({
                            success: false,
                            error: 'Failed to leave room',
                            details: error.message
                        });
                    }

                    res.json({
                        success: true,
                        message: '成功離開房間'
                    });
                }
            );
        }
    );
});

// 獲取使用者創建的房間
router.get('/created', authenticateToken, (req, res) => {
    const userId = req.user.userId;

    db.query(
        'SELECT id, name, creator_name, status, creator_id FROM rooms WHERE creator_id = ? ORDER BY created_at DESC',
        [userId],
        (error, results) => {
            if (error) {
                console.error('Fetch created rooms error:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to fetch created rooms',
                    details: error.message
                });
            }

            res.json({
                success: true,
                rooms: results || []
            });
        }
    );
});

// 刪除房間並清空成員
router.delete('/rooms/:roomId', authenticateToken, async (req, res) => {
    const roomId = req.params.roomId;
    const userId = req.user.userId;

    try {
        // 檢查房間是否存在並驗證創建者
        const roomResults = await db.queryPromise('SELECT creator_id FROM rooms WHERE id = ?', [roomId]);
        if (!roomResults[0]) {
            return res.status(404).json({
                success: false,
                error: '找不到此自習室'
            });
        }
        if (roomResults[0].creator_id !== userId) {
            return res.status(403).json({
                success: false,
                error: 'Unauthorized',
                details: '只有房主才能刪除房間'
            });
        }

        // 開始事務
        await db.queryPromise('BEGIN');

        try {
            // 刪除房間成員
            await db.queryPromise('DELETE FROM room_members WHERE room_id = ?', [roomId]);

            // 刪除房間
            await db.queryPromise('DELETE FROM rooms WHERE id = ?', [roomId]);

            // 提交
            await db.queryPromise('COMMIT');

            res.json({
                success: true,
                message: 'Room deleted successfully'
            });
        } catch (error) {
            // 出錯的話 Rollback
            await db.queryPromise('ROLLBACK');
            throw error;
        }
    } catch (error) {
        console.error('Delete room error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete room',
            details: error.message
        });
    }
});

module.exports = router;