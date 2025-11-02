const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// 新的5级层级排行榜系统（匹配前端）
const RATING_LEVELS = {
    'sheng': { score: 5, name: '夯', description: 'S级 - 顶级表现', tier: 'S' },
    'dengji': { score: 4, name: '顶级', description: 'A级 - 优秀水平', tier: 'A' },
    'renshen': { score: 3, name: '人上人', description: 'B级 - 超越大多数', tier: 'B' },
    'npc': { score: 2, name: 'NPC', description: 'C级 - 一般表现', tier: 'C' },
    'lowest': { score: 1, name: '拉完了', description: 'D级 - 需要改进', tier: 'D' }
};

const LEVEL_ORDER = ['sheng', 'dengji', 'renshen', 'npc', 'lowest'];
const VALID_RATINGS = Object.keys(RATING_LEVELS);

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// 初始化数据库
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) {
        console.error('数据库连接失败:', err.message);
    } else {
        console.log('已连接到SQLite数据库');
        initializeDatabase();
    }
});

function initializeDatabase() {
    db.serialize(() => {
        // 创建用户表
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // 创建评价表（更新为5级系统）
        db.run(`CREATE TABLE IF NOT EXISTS ratings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            item_name TEXT NOT NULL,
            item_category TEXT,
            rating_level TEXT NOT NULL,
            rating_score INTEGER NOT NULL,
            rating_comment TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )`);

        // 创建层级排行榜表
        db.run(`CREATE TABLE IF NOT EXISTS tier_lists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            tiers_data TEXT NOT NULL, -- JSON格式存储层级数据
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // 创建示例用户
        db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
            if (err) {
                console.error(err);
                return;
            }
            if (row.count === 0) {
                const hashedPassword = bcrypt.hashSync('demo123', 10);
                db.run(`INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)`,
                    ['demo', 'demo@example.com', hashedPassword]);
                console.log('示例用户已创建');
            }
        });

        // 创建示例层级排行榜
        db.get("SELECT COUNT(*) as count FROM tier_lists", (err, row) => {
            if (err) {
                console.error(err);
                return;
            }
            if (row.count === 0) {
                const exampleTierData = {
                    tiers: {
                        'sheng': { name: '夯 (S级)', color: '#ff6b6b', items: ['示例项目1', '示例项目2'] },
                        'dengji': { name: '顶级 (A级)', color: '#4ecdc4', items: ['示例项目3'] },
                        'renshen': { name: '人上人 (B级)', color: '#45b7d1', items: [] },
                        'npc': { name: 'NPC (C级)', color: '#96ceb4', items: [] },
                        'lowest': { name: '拉完了 (D级)', color: '#ffd93d', items: [] }
                    }
                };
                
                db.run(`INSERT INTO tier_lists (name, description, tiers_data) VALUES (?, ?, ?)`,
                    ['示例层级排行榜', '展示5级层级排行榜系统', JSON.stringify(exampleTierData)]);
                console.log('示例层级排行榜已创建');
            }
        });
    });
}

// 验证评级等级
function validateRatingLevel(level) {
    return VALID_RATINGS.includes(level);
}

// 转换等级为分数
function getRatingScore(level) {
    return RATING_LEVELS[level] ? RATING_LEVELS[level].score : 0;
}

// 获取等级信息
function getRatingInfo(level) {
    return RATING_LEVELS[level] || null;
}

// 认证中间件
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

// API路由

// 获取所有评价等级（5级系统）
app.get('/api/rating-levels', (req, res) => {
    const levels = LEVEL_ORDER.map(level => ({
        level: level,
        ...RATING_LEVELS[level]
    }));
    res.json({ success: true, data: levels });
});

// 用户注册
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        if (!username || !email || !password) {
            return res.status(400).json({ success: false, message: '所有字段都是必填的' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        db.run(
            'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
            [username, email, hashedPassword],
            function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(409).json({ success: false, message: '用户名或邮箱已存在' });
                    }
                    return res.status(500).json({ success: false, message: '注册失败' });
                }
                
                const token = jwt.sign(
                    { id: this.lastID, username },
                    JWT_SECRET,
                    { expiresIn: '24h' }
                );
                
                res.status(201).json({
                    success: true,
                    message: '注册成功',
                    token,
                    user: { id: this.lastID, username, email }
                });
            }
        );
    } catch (error) {
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// 用户登录
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    db.get(
        'SELECT * FROM users WHERE username = ? OR email = ?',
        [username, username],
        async (err, user) => {
            if (err) {
                return res.status(500).json({ success: false, message: '服务器错误' });
            }
            
            if (!user) {
                return res.status(401).json({ success: false, message: '用户不存在' });
            }
            
            const passwordMatch = await bcrypt.compare(password, user.password_hash);
            
            if (!passwordMatch) {
                return res.status(401).json({ success: false, message: '密码错误' });
            }
            
            const token = jwt.sign(
                { id: user.id, username: user.username },
                JWT_SECRET,
                { expiresIn: '24h' }
            );
            
            res.json({
                success: true,
                message: '登录成功',
                token,
                user: { id: user.id, username: user.username, email: user.email }
            });
        }
    );
});

// 创建评价
app.post('/api/ratings', authenticateToken, (req, res) => {
    try {
        const { item_name, item_category, rating_level, rating_comment } = req.body;
        
        // 验证等级
        if (!validateRatingLevel(rating_level)) {
            return res.status(400).json({ 
                success: false, 
                message: '无效的评价等级',
                valid_levels: VALID_RATINGS
            });
        }
        
        const rating_score = getRatingScore(rating_level);
        const rating_info = getRatingInfo(rating_level);
        
        db.run(
            'INSERT INTO ratings (user_id, item_name, item_category, rating_level, rating_score, rating_comment) VALUES (?, ?, ?, ?, ?, ?)',
            [req.user.id, item_name, item_category || '', rating_level, rating_score, rating_comment || ''],
            function(err) {
                if (err) {
                    console.error(err);
                    return res.status(500).json({ success: false, message: '创建评价失败' });
                }
                
                res.status(201).json({
                    success: true,
                    message: '评价创建成功',
                    data: {
                        id: this.lastID,
                        item_name,
                        item_category: item_category || '',
                        rating_level,
                        rating_score,
                        rating_info,
                        rating_comment: rating_comment || ''
                    }
                });
            }
        );
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// 获取用户的所有评价
app.get('/api/ratings', authenticateToken, (req, res) => {
    db.all(
        'SELECT * FROM ratings WHERE user_id = ? ORDER BY created_at DESC',
        [req.user.id],
        (err, rows) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ success: false, message: '获取评价失败' });
            }
            
            const ratings = rows.map(row => ({
                ...row,
                rating_info: getRatingInfo(row.rating_level)
            }));
            
            res.json({ success: true, data: ratings });
        }
    );
});

// 获取评价统计
app.get('/api/statistics', (req, res) => {
    const { category } = req.query;
    
    let query = 'SELECT rating_level, COUNT(*) as count FROM ratings';
    let params = [];
    
    if (category) {
        query += ' WHERE item_category = ?';
        params.push(category);
    }
    
    query += ' GROUP BY rating_level';
    
    db.all(query, params, (err, rows) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ success: false, message: '获取统计数据失败' });
        }
        
        const stats = {};
        const total = rows.reduce((sum, row) => sum + row.count, 0);
        
        rows.forEach(row => {
            stats[row.rating_level] = {
                count: row.count,
                percentage: total > 0 ? (row.count / total * 100).toFixed(1) : 0,
                rating_info: getRatingInfo(row.rating_level)
            };
        });
        
        res.json({
            success: true,
            data: {
                total_ratings: total,
                by_level: stats
            }
        });
    });
});

// 获取层级排行榜列表
app.get('/api/tier-lists', (req, res) => {
    db.all(
        'SELECT id, name, description, created_at, updated_at FROM tier_lists ORDER BY updated_at DESC',
        (err, rows) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ success: false, message: '获取层级排行榜失败' });
            }
            
            res.json({ success: true, data: rows });
        }
    );
});

// 创建或更新层级排行榜
app.post('/api/tier-lists', authenticateToken, (req, res) => {
    try {
        const { name, description, tiers_data } = req.body;
        
        if (!name || !tiers_data) {
            return res.status(400).json({ success: false, message: '名称和层级数据是必填的' });
        }
        
        // 验证层级数据
        const tiers = typeof tiers_data === 'string' ? JSON.parse(tiers_data) : tiers_data;
        
        if (!tiers.tiers) {
            return res.status(400).json({ success: false, message: '层级数据格式不正确' });
        }
        
        // 验证所有等级都在有效范围内
        const invalidLevels = Object.keys(tiers.tiers).filter(level => !validateRatingLevel(level));
        if (invalidLevels.length > 0) {
            return res.status(400).json({
                success: false,
                message: '包含无效的评价等级',
                invalid_levels: invalidLevels
            });
        }
        
        const tiersJson = JSON.stringify(tiers);
        
        db.run(
            'INSERT INTO tier_lists (name, description, tiers_data) VALUES (?, ?, ?)',
            [name, description || '', tiersJson],
            function(err) {
                if (err) {
                    console.error(err);
                    return res.status(500).json({ success: false, message: '创建层级排行榜失败' });
                }
                
                res.status(201).json({
                    success: true,
                    message: '层级排行榜创建成功',
                    data: {
                        id: this.lastID,
                        name,
                        description: description || '',
                        tiers_data: tiers
                    }
                });
            }
        );
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// 获取特定层级排行榜
app.get('/api/tier-lists/:id', (req, res) => {
    const { id } = req.params;
    
    db.get(
        'SELECT * FROM tier_lists WHERE id = ?',
        [id],
        (err, row) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ success: false, message: '获取层级排行榜失败' });
            }
            
            if (!row) {
                return res.status(404).json({ success: false, message: '层级排行榜不存在' });
            }
            
            try {
                const tiersData = JSON.parse(row.tiers_data);
                res.json({
                    success: true,
                    data: {
                        ...row,
                        tiers_data: tiersData
                    }
                });
            } catch (parseErr) {
                console.error('JSON解析错误:', parseErr);
                res.status(500).json({ success: false, message: '层级数据解析失败' });
            }
        }
    );
});

// 更新层级排行榜
app.put('/api/tier-lists/:id', authenticateToken, (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, tiers_data } = req.body;
        
        if (!name || !tiers_data) {
            return res.status(400).json({ success: false, message: '名称和层级数据是必填的' });
        }
        
        // 验证层级数据
        const tiers = typeof tiers_data === 'string' ? JSON.parse(tiers_data) : tiers_data;
        
        if (!tiers.tiers) {
            return res.status(400).json({ success: false, message: '层级数据格式不正确' });
        }
        
        // 验证所有等级都在有效范围内
        const invalidLevels = Object.keys(tiers.tiers).filter(level => !validateRatingLevel(level));
        if (invalidLevels.length > 0) {
            return res.status(400).json({
                success: false,
                message: '包含无效的评价等级',
                invalid_levels: invalidLevels
            });
        }
        
        const tiersJson = JSON.stringify(tiers);
        
        db.run(
            'UPDATE tier_lists SET name = ?, description = ?, tiers_data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [name, description || '', tiersJson, id],
            function(err) {
                if (err) {
                    console.error(err);
                    return res.status(500).json({ success: false, message: '更新层级排行榜失败' });
                }
                
                if (this.changes === 0) {
                    return res.status(404).json({ success: false, message: '层级排行榜不存在' });
                }
                
                res.json({
                    success: true,
                    message: '层级排行榜更新成功',
                    data: {
                        id: parseInt(id),
                        name,
                        description: description || '',
                        tiers_data: tiers
                    }
                });
            }
        );
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// 删除层级排行榜
app.delete('/api/tier-lists/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    
    db.run(
        'DELETE FROM tier_lists WHERE id = ?',
        [id],
        function(err) {
            if (err) {
                console.error(err);
                return res.status(500).json({ success: false, message: '删除层级排行榜失败' });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ success: false, message: '层级排行榜不存在' });
            }
            
            res.json({ success: true, message: '层级排行榜删除成功' });
        }
    );
});

// 获取分类列表
app.get('/api/categories', (req, res) => {
    db.all(
        'SELECT DISTINCT item_category FROM ratings WHERE item_category IS NOT NULL AND item_category != "" ORDER BY item_category',
        (err, rows) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ success: false, message: '获取分类失败' });
            }
            
            const categories = rows.map(row => row.item_category);
            res.json({ success: true, data: categories });
        }
    );
});

// 静态文件服务
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 健康检查端点
app.get('/api/health', (req, res) => {
    res.json({ 
        success: true, 
        message: '服务器运行正常',
        version: '2.0',
        rating_system: '5级层级排行榜',
        valid_levels: VALID_RATINGS
    });
});

// 404处理
app.use((req, res) => {
    res.status(404).json({ success: false, message: '接口不存在' });
});

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error('服务器错误:', err);
    res.status(500).json({ success: false, message: '服务器内部错误' });
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
    console.log('评价系统：5级层级排行榜');
    console.log('可用等级：', VALID_RATINGS.join(', '));
});

// 优雅关闭
process.on('SIGINT', () => {
    console.log('正在关闭服务器...');
    db.close((err) => {
        if (err) {
            console.error('关闭数据库连接失败:', err.message);
        } else {
            console.log('数据库连接已关闭');
        }
        process.exit(0);
    });
});