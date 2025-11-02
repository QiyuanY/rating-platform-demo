const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// 5级层级排行榜评价等级配置
const RATING_LEVELS = {
    'hang': { score: 1, name: '夯', description: '基础表现', tier: 'S级', color: '#8B0000' },
    'top': { score: 2, name: '顶级', description: '优秀水平', tier: 'A级', color: '#FF6B35' },
    'ren': { score: 3, name: '人上人', description: '超越大多数', tier: 'B级', color: '#F7931E' },
    'npc': { score: 4, name: 'NPC', description: '普通表现', tier: 'C级', color: '#FFD23F' },
    'la': { score: 5, name: '拉完了', description: '需要改进', tier: 'D级', color: '#06FFA5' }
};

// 中间件
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 初始化数据库
const dbPath = path.join(__dirname, 'data.db');
const db = new sqlite3.Database(dbPath);

// 创建数据库表
function initDatabase() {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // 创建评价表
            db.run(`CREATE TABLE IF NOT EXISTS ratings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                content TEXT NOT NULL,
                category TEXT NOT NULL,
                rating TEXT NOT NULL,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // 创建层级排行榜表
            db.run(`CREATE TABLE IF NOT EXISTS tier_lists (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                tiers JSON NOT NULL,
                items JSON,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // 创建待评价项目表
            db.run(`CREATE TABLE IF NOT EXISTS pending_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT,
                category TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // 插入示例数据（5级系统）
            const sampleRatings = [
                ['电影《流浪地球3》', '影视', 'top', '视觉效果震撼'],
                ['周杰伦新专辑', '音乐', 'ren', '旋律依然动人'],
                ['iPhone 20', '科技', 'hang', '创新不足'],
                ['某个网红', '人物', 'la', '内容质量低'],
                ['特斯拉FSD', '科技', 'npc', '还需完善']
            ];

            const pendingItems = [
                ['新上映的电影', '需要评价的影视作品', '影视'],
                ['新发布的歌曲', '待评价的音乐作品', '音乐'],
                ['新产品发布', '科技产品评价', '科技'],
                ['新的人物', '人物评价', '人物'],
                ['新的事件', '事件评价', '事件']
            ];

            // 检查是否已有数据
            db.get('SELECT COUNT(*) as count FROM ratings', (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                if (row.count === 0) {
                    const stmt = db.prepare('INSERT INTO ratings (content, category, rating, description) VALUES (?, ?, ?, ?)');
                    sampleRatings.forEach(item => {
                        stmt.run(item);
                    });
                    stmt.finalize();

                    const pendingStmt = db.prepare('INSERT INTO pending_items (title, description, category) VALUES (?, ?, ?)');
                    pendingItems.forEach(item => {
                        pendingStmt.run(item);
                    });
                    pendingStmt.finalize();
                }
            });

            resolve();
        });
    });
}

// 获取所有评价
app.get('/api/ratings', (req, res) => {
    db.all('SELECT * FROM ratings ORDER BY created_at DESC', (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        // 转换数据格式，添加等级信息
        const ratingsWithLevels = rows.map(row => {
            const level = RATING_LEVELS[row.rating];
            return {
                ...row,
                level: level ? {
                    name: level.name,
                    score: level.score,
                    description: level.description,
                    tier: level.tier,
                    color: level.color
                } : null
            };
        });
        
        res.json(ratingsWithLevels);
    });
});

// 创建新评价
app.post('/api/ratings', (req, res) => {
    const { content, category, rating, description } = req.body;
    
    if (!content || !category || !rating) {
        return res.status(400).json({ error: '缺少必要字段' });
    }
    
    // 验证评价等级
    if (!RATING_LEVELS[rating]) {
        return res.status(400).json({ error: '无效的评价等级' });
    }
    
    db.run(
        'INSERT INTO ratings (content, category, rating, description) VALUES (?, ?, ?, ?)',
        [content, category, rating, description || ''],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ id: this.lastID, message: '评价创建成功' });
        }
    );
});

// 获取待评价项目
app.get('/api/pending-items', (req, res) => {
    db.all('SELECT * FROM pending_items ORDER BY created_at DESC', (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// 创建待评价项目
app.post('/api/pending-items', (req, res) => {
    const { title, description, category } = req.body;
    
    if (!title || !category) {
        return res.status(400).json({ error: '缺少必要字段' });
    }
    
    db.run(
        'INSERT INTO pending_items (title, description, category) VALUES (?, ?, ?)',
        [title, description || '', category],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ id: this.lastID, message: '待评价项目创建成功' });
        }
    );
});

// 删除待评价项目
app.delete('/api/pending-items/:id', (req, res) => {
    db.run('DELETE FROM pending_items WHERE id = ?', [req.params.id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: '项目删除成功' });
    });
});

// 获取层级排行榜列表
app.get('/api/tier-lists', (req, res) => {
    db.all('SELECT * FROM tier_lists ORDER BY created_at DESC', (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        // 解析JSON字段
        const tierLists = rows.map(row => ({
            ...row,
            tiers: JSON.parse(row.tiers || '[]'),
            items: JSON.parse(row.items || '[]')
        }));
        
        res.json(tierLists);
    });
});

// 创建新的层级排行榜
app.post('/api/tier-lists', (req, res) => {
    const { name, description, tiers, items } = req.body;
    
    if (!name || !tiers) {
        return res.status(400).json({ error: '缺少必要字段' });
    }
    
    db.run(
        'INSERT INTO tier_lists (name, description, tiers, items) VALUES (?, ?, ?, ?)',
        [name, description || '', JSON.stringify(tiers), JSON.stringify(items || [])],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ id: this.lastID, message: '层级排行榜创建成功' });
        }
    );
});

// 获取特定层级排行榜
app.get('/api/tier-lists/:id', (req, res) => {
    db.get('SELECT * FROM tier_lists WHERE id = ?', [req.params.id], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        if (!row) {
            return res.status(404).json({ error: '层级排行榜不存在' });
        }
        
        // 解析JSON字段
        const tierList = {
            ...row,
            tiers: JSON.parse(row.tiers || '[]'),
            items: JSON.parse(row.items || '[]')
        };
        
        res.json(tierList);
    });
});

// 获取评价等级信息
app.get('/api/rating-levels', (req, res) => {
    const levelsArray = Object.entries(RATING_LEVELS).map(([key, value]) => ({
        key,
        ...value
    }));
    
    res.json(levelsArray);
});

// 获取统计数据
app.get('/api/stats', (req, res) => {
    // 统计数据
    db.get('SELECT COUNT(*) as total FROM ratings', (err, totalRow) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        // 按等级统计
        const ratingStats = {};
        Object.keys(RATING_LEVELS).forEach(level => {
            ratingStats[level] = { count: 0, name: RATING_LEVELS[level].name, tier: RATING_LEVELS[level].tier };
        });
        
        db.all('SELECT rating, COUNT(*) as count FROM ratings GROUP BY rating', (err, rows) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            
            rows.forEach(row => {
                if (ratingStats[row.rating]) {
                    ratingStats[row.rating].count = row.count;
                }
            });
            
            // 按类别统计
            db.all('SELECT category, COUNT(*) as count FROM ratings GROUP BY category', (err, categoryRows) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                
                res.json({
                    totalRatings: totalRow.total,
                    ratingDistribution: ratingStats,
                    categoryDistribution: categoryRows
                });
            });
        });
    });
});

// 启动服务器
async function startServer() {
    try {
        await initDatabase();
        app.listen(PORT, () => {
            console.log(`🚀 5级层级排行榜服务器运行在 http://localhost:${PORT}`);
            console.log('📊 等级系统：夯(S级) → 顶级(A级) → 人上人(B级) → NPC(C级) → 拉完了(D级)');
        });
    } catch (err) {
        console.error('❌ 服务器启动失败:', err);
        process.exit(1);
    }
}

startServer();