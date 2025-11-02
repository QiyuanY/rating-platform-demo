const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 数据库初始化
const db = new sqlite3.Database('./rating_platform.db', (err) => {
    if (err) {
        console.error('数据库连接失败:', err);
    } else {
        console.log('数据库连接成功');
        initDatabase();
    }
});

// 数据库结构初始化
function initDatabase() {
    // 用户表
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        avatar_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 内容表
    db.run(`CREATE TABLE IF NOT EXISTS contents (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT,
        image_url TEXT,
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users (id)
    )`);

    // 评价表
    db.run(`CREATE TABLE IF NOT EXISTS ratings (
        id TEXT PRIMARY KEY,
        content_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        overall_level TEXT NOT NULL,
        technical_level TEXT,
        creativity_level TEXT,
        execution_level TEXT,
        impact_level TEXT,
        comment TEXT,
        tags TEXT, -- JSON数组
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (content_id) REFERENCES contents (id),
        FOREIGN KEY (user_id) REFERENCES users (id),
        UNIQUE(content_id, user_id)
    )`);

    // 评价统计表
    db.run(`CREATE TABLE IF NOT EXISTS rating_stats (
        content_id TEXT PRIMARY KEY,
        total_ratings INTEGER DEFAULT 0,
        average_score REAL DEFAULT 0,
        level_distribution TEXT, -- JSON对象
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (content_id) REFERENCES contents (id)
    )`);
}

// JWT验证中间件
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: '访问令牌缺失' });
    }
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: '无效的访问令牌' });
        }
        req.user = user;
        next();
    });
}

// 评价等级配置
const RATING_LEVELS = {
    'lā': { score: 1, name: '拉', description: '表现较差' },
    'hāng': { score: 2, name: '夯', description: '基础水平' },
    'zhōng': { score: 3, name: '中', description: '平均水平' },
    'shàng': { score: 4, name: '上', description: '较好表现' },
    'jiā': { score: 5, name: '佳', description: '优秀水平' },
    'rénshàng': { score: 6, name: '人上', description: '超越大多数' },
    'dǐng': { score: 7, name: '顶', description: '顶级表现' }
};

// ==================== 用户认证API ====================

// 用户注册
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        if (!username || !email || !password) {
            return res.status(400).json({ error: '用户名、邮箱和密码不能为空' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = uuidv4();
        
        db.run(
            'INSERT INTO users (id, username, email, password_hash) VALUES (?, ?, ?, ?)',
            [userId, username, email, hashedPassword],
            function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(409).json({ error: '用户名或邮箱已存在' });
                    }
                    return res.status(500).json({ error: '注册失败' });
                }
                
                const token = jwt.sign({ id: userId, username }, JWT_SECRET);
                res.json({
                    message: '注册成功',
                    token,
                    user: { id: userId, username, email }
                });
            }
        );
    } catch (error) {
        res.status(500).json({ error: '服务器错误' });
    }
});

// 用户登录
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        db.get(
            'SELECT * FROM users WHERE username = ? OR email = ?',
            [username, username],
            async (err, user) => {
                if (err) {
                    return res.status(500).json({ error: '服务器错误' });
                }
                
                if (!user) {
                    return res.status(401).json({ error: '用户不存在' });
                }
                
                const validPassword = await bcrypt.compare(password, user.password_hash);
                if (!validPassword) {
                    return res.status(401).json({ error: '密码错误' });
                }
                
                const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
                res.json({
                    message: '登录成功',
                    token,
                    user: { id: user.id, username: user.username, email: user.email }
                });
            }
        );
    } catch (error) {
        res.status(500).json({ error: '服务器错误' });
    }
});

// ==================== 内容管理API ====================

// 创建内容
app.post('/api/contents', authenticateToken, (req, res) => {
    const { title, category, description, image_url } = req.body;
    const contentId = uuidv4();
    
    if (!title || !category) {
        return res.status(400).json({ error: '标题和分类不能为空' });
    }
    
    db.run(
        'INSERT INTO contents (id, title, category, description, image_url, created_by) VALUES (?, ?, ?, ?, ?, ?)',
        [contentId, title, category, description, image_url, req.user.id],
        function(err) {
            if (err) {
                return res.status(500).json({ error: '创建内容失败' });
            }
            
            res.json({
                message: '内容创建成功',
                content: { id: contentId, title, category, description, image_url }
            });
        }
    );
});

// 获取内容列表
app.get('/api/contents', (req, res) => {
    const { category, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    let query = 'SELECT c.*, u.username as creator_name FROM contents c LEFT JOIN users u ON c.created_by = u.id';
    let params = [];
    
    if (category && category !== 'all') {
        query += ' WHERE c.category = ?';
        params.push(category);
    }
    
    query += ' ORDER BY c.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);
    
    db.all(query, params, (err, contents) => {
        if (err) {
            return res.status(500).json({ error: '获取内容失败' });
        }
        
        // 获取每个内容的评分统计
        const contentsWithStats = contents.map(content => {
            return new Promise((resolve) => {
                db.get(
                    'SELECT * FROM rating_stats WHERE content_id = ?',
                    [content.id],
                    (err, stats) => {
                        resolve({
                            ...content,
                            stats: stats || {
                                total_ratings: 0,
                                average_score: 0,
                                level_distribution: {}
                            }
                        });
                    }
                );
            });
        });
        
        Promise.all(contentsWithStats).then(finalContents => {
            res.json(finalContents);
        });
    });
});

// ==================== 评价API ====================

// 提交/更新评价
app.post('/api/ratings', authenticateToken, (req, res) => {
    const { content_id, overall_level, technical_level, creativity_level, execution_level, impact_level, comment, tags } = req.body;
    const ratingId = uuidv4();
    
    if (!content_id || !overall_level) {
        return res.status(400).json({ error: '内容ID和总体评分不能为空' });
    }
    
    if (!RATING_LEVELS[overall_level]) {
        return res.status(400).json({ error: '无效的评价等级' });
    }
    
    const tagsJson = JSON.stringify(tags || []);
    
    // 使用UPSERT语句
    db.run(
        `INSERT INTO ratings (id, content_id, user_id, overall_level, technical_level, creativity_level, execution_level, impact_level, comment, tags) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
         ON CONFLICT(content_id, user_id) DO UPDATE SET 
         overall_level = excluded.overall_level,
         technical_level = excluded.technical_level,
         creativity_level = excluded.creativity_level,
         execution_level = excluded.execution_level,
         impact_level = excluded.impact_level,
         comment = excluded.comment,
         tags = excluded.tags,
         updated_at = CURRENT_TIMESTAMP`,
        [ratingId, content_id, req.user.id, overall_level, technical_level, creativity_level, execution_level, impact_level, comment, tagsJson],
        function(err) {
            if (err) {
                console.error('评价提交失败:', err);
                return res.status(500).json({ error: '评价提交失败' });
            }
            
            // 更新评分统计
            updateRatingStats(content_id);
            
            res.json({
                message: '评价提交成功',
                rating_id: ratingId
            });
        }
    );
});

// 获取内容的评价
app.get('/api/contents/:id/ratings', (req, res) => {
    const contentId = req.params.id;
    
    db.all(
        `SELECT r.*, u.username, u.avatar_url 
         FROM ratings r 
         LEFT JOIN users u ON r.user_id = u.id 
         WHERE r.content_id = ? 
         ORDER BY r.created_at DESC`,
        [contentId],
        (err, ratings) => {
            if (err) {
                return res.status(500).json({ error: '获取评价失败' });
            }
            
            // 解析tags JSON
            const parsedRatings = ratings.map(rating => ({
                ...rating,
                tags: JSON.parse(rating.tags || '[]')
            }));
            
            res.json(parsedRatings);
        }
    );
});

// 获取用户的评价
app.get('/api/my-ratings', authenticateToken, (req, res) => {
    db.all(
        `SELECT r.*, c.title, c.category 
         FROM ratings r 
         LEFT JOIN contents c ON r.content_id = c.id 
         WHERE r.user_id = ? 
         ORDER BY r.created_at DESC`,
        [req.user.id],
        (err, ratings) => {
            if (err) {
                return res.status(500).json({ error: '获取评价失败' });
            }
            
            // 解析tags JSON
            const parsedRatings = ratings.map(rating => ({
                ...rating,
                tags: JSON.parse(rating.tags || '[]')
            }));
            
            res.json(parsedRatings);
        }
    );
});

// 更新评分统计
function updateRatingStats(contentId) {
    // 获取所有评价
    db.all(
        'SELECT overall_level FROM ratings WHERE content_id = ?',
        [contentId],
        (err, ratings) => {
            if (err) {
                console.error('获取评价失败:', err);
                return;
            }
            
            const totalRatings = ratings.length;
            let totalScore = 0;
            const levelDistribution = {};
            
            // 初始化等级分布
            Object.keys(RATING_LEVELS).forEach(level => {
                levelDistribution[level] = 0;
            });
            
            // 计算统计
            ratings.forEach(rating => {
                const score = RATING_LEVELS[rating.overall_level].score;
                totalScore += score;
                levelDistribution[rating.overall_level]++;
            });
            
            const averageScore = totalRatings > 0 ? totalScore / totalRatings : 0;
            
            // 更新或插入统计记录
            db.run(
                `INSERT INTO rating_stats (content_id, total_ratings, average_score, level_distribution) 
                 VALUES (?, ?, ?, ?) 
                 ON CONFLICT(content_id) DO UPDATE SET 
                 total_ratings = excluded.total_ratings,
                 average_score = excluded.average_score,
                 level_distribution = excluded.level_distribution,
                 updated_at = CURRENT_TIMESTAMP`,
                [contentId, totalRatings, averageScore, JSON.stringify(levelDistribution)],
                (err) => {
                    if (err) {
                        console.error('更新统计失败:', err);
                    }
                }
            );
        }
    );
}

// ==================== 统计分析API ====================

// 获取平台统计
app.get('/api/stats', (req, res) => {
    const stats = {};
    
    // 获取总用户数
    db.get('SELECT COUNT(*) as count FROM users', (err, userResult) => {
        if (err) return res.status(500).json({ error: '获取统计数据失败' });
        stats.totalUsers = userResult.count;
        
        // 获取总内容数
        db.get('SELECT COUNT(*) as count FROM contents', (err, contentResult) => {
            if (err) return res.status(500).json({ error: '获取统计数据失败' });
            stats.totalContents = contentResult.count;
            
            // 获取总评价数
            db.get('SELECT COUNT(*) as count FROM ratings', (err, ratingResult) => {
                if (err) return res.status(500).json({ error: '获取统计数据失败' });
                stats.totalRatings = ratingResult.count;
                
                // 获取分类统计
                db.all('SELECT category, COUNT(*) as count FROM contents GROUP BY category', (err, categoryResults) => {
                    if (err) return res.status(500).json({ error: '获取统计数据失败' });
                    stats.categoryStats = categoryResults;
                    
                    res.json(stats);
                });
            });
        });
    });
});

// ==================== 初始化示例数据 ====================

// 添加示例数据
function addSampleData() {
    const sampleUsers = [
        { id: 'user1', username: 'demo_user', email: 'demo@example.com' },
        { id: 'user2', username: 'gamer_pro', email: 'gamer@example.com' },
        { id: 'user3', username: 'movie_fan', email: 'movie@example.com' }
    ];
    
    const sampleContents = [
        {
            id: 'content1',
            title: '《原神》',
            category: 'game',
            description: '开放世界RPG游戏，独特的元素交互系统',
            image_url: 'https://genshin.hoyoverse.com/zh-tw/home'
        },
        {
            id: 'content2',
            title: '《流浪地球2》',
            category: 'movie',
            description: '中国科幻电影巨制，视觉效果震撼',
            image_url: ''
        },
        {
            id: 'content3',
            title: '《王者荣耀》',
            category: 'game',
            description: 'MOBA手游经典之作',
            image_url: ''
        }
    ];
    
    // 添加示例用户（使用默认密码：123456）
    sampleUsers.forEach(async (user) => {
        const hashedPassword = await bcrypt.hash('123456', 10);
        db.run(
            'INSERT OR IGNORE INTO users (id, username, email, password_hash) VALUES (?, ?, ?, ?)',
            [user.id, user.username, user.email, hashedPassword]
        );
    });
    
    // 添加示例内容
    sampleContents.forEach((content) => {
        db.run(
            'INSERT OR IGNORE INTO contents (id, title, category, description, image_url, created_by) VALUES (?, ?, ?, ?, ?, ?)',
            [content.id, content.title, content.category, content.description, content.image_url, 'user1']
        );
    });
    
    console.log('示例数据添加完成');
}

// 启动服务器
app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
    console.log('访问 http://localhost:3000 查看应用');
    
    // 添加示例数据
    setTimeout(() => {
        addSampleData();
    }, 1000);
});

// 优雅关闭
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error('关闭数据库连接失败:', err);
        } else {
            console.log('数据库连接已关闭');
        }
        process.exit(0);
    });
});