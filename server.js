const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Parse JSON bodies
app.use(express.json());

// Root route - serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rate endpoints
app.get('/api/ratings', (req, res) => {
    try {
        const dbPath = path.join(__dirname, 'data', 'ratings.db');
        const sqlite3 = require('sqlite3').verbose();
        const db = new sqlite3.Database(dbPath);

        db.all('SELECT * FROM ratings ORDER BY created_at DESC', [], (err, rows) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json(rows);
            db.close();
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/ratings', (req, res) => {
    try {
        const { item_name, category, rating, review } = req.body;
        
        if (!item_name || !rating) {
            return res.status(400).json({ error: 'Item name and rating are required' });
        }

        const dbPath = path.join(__dirname, 'data', 'ratings.db');
        const sqlite3 = require('sqlite3').verbose();
        const db = new sqlite3.Database(dbPath);

        db.run(
            'INSERT INTO ratings (item_name, category, rating, review) VALUES (?, ?, ?, ?)',
            [item_name, category || null, rating, review || null],
            function(err) {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                res.json({ 
                    id: this.lastID, 
                    item_name, 
                    category, 
                    rating, 
                    review 
                });
                db.close();
            }
        );
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Pending items endpoints
app.get('/api/pending-items', (req, res) => {
    try {
        const dbPath = path.join(__dirname, 'data', 'ratings.db');
        const sqlite3 = require('sqlite3').verbose();
        const db = new sqlite3.Database(dbPath);

        db.all('SELECT * FROM pending_items ORDER BY created_at DESC', [], (err, rows) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json(rows);
            db.close();
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/pending-items', (req, res) => {
    try {
        const { item_name, description, category } = req.body;
        
        if (!item_name) {
            return res.status(400).json({ error: 'Item name is required' });
        }

        const dbPath = path.join(__dirname, 'data', 'ratings.db');
        const sqlite3 = require('sqlite3').verbose();
        const db = new sqlite3.Database(dbPath);

        db.run(
            'INSERT INTO pending_items (item_name, description, category) VALUES (?, ?, ?)',
            [item_name, description || null, category || null],
            function(err) {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                res.json({ 
                    id: this.lastID, 
                    item_name, 
                    description, 
                    category 
                });
                db.close();
            }
        );
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/pending-items/:id', (req, res) => {
    try {
        const { id } = req.params;
        const dbPath = path.join(__dirname, 'data', 'ratings.db');
        const sqlite3 = require('sqlite3').verbose();
        const db = new sqlite3.Database(dbPath);

        db.run(
            'DELETE FROM pending_items WHERE id = ?',
            [id],
            function(err) {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                res.json({ message: 'Pending item deleted successfully' });
                db.close();
            }
        );
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Tier list endpoints
app.get('/api/tier-lists', (req, res) => {
    try {
        const dbPath = path.join(__dirname, 'data', 'ratings.db');
        const sqlite3 = require('sqlite3').verbose();
        const db = new sqlite3.Database(dbPath);

        db.all(
            'SELECT item_name, category, rating FROM ratings ORDER BY rating DESC',
            [],
            (err, rows) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                
                // Group by tiers
                const tiers = {
                    'S': [],
                    'A': [],
                    'B': [],
                    'C': [],
                    'D': [],
                    'F': []
                };
                
                rows.forEach(item => {
                    let tier;
                    if (item.rating >= 9) tier = 'S';
                    else if (item.rating >= 8) tier = 'A';
                    else if (item.rating >= 7) tier = 'B';
                    else if (item.rating >= 6) tier = 'C';
                    else if (item.rating >= 5) tier = 'D';
                    else tier = 'F';
                    
                    tiers[tier].push(item);
                });
                
                res.json(tiers);
                db.close();
            }
        );
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Stats endpoints
app.get('/api/stats', (req, res) => {
    try {
        const dbPath = path.join(__dirname, 'data', 'ratings.db');
        const sqlite3 = require('sqlite3').verbose();
        const db = new sqlite3.Database(dbPath);

        db.get(
            'SELECT COUNT(*) as total_ratings, AVG(rating) as avg_rating FROM ratings',
            [],
            (err, stats) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                res.json(stats);
                db.close();
            }
        );
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Initialize database
function initDatabase() {
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    const dbPath = path.join(dataDir, 'ratings.db');
    const sqlite3 = require('sqlite3').verbose();
    const db = new sqlite3.Database(dbPath);

    // Create ratings table
    db.run(`
        CREATE TABLE IF NOT EXISTS ratings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_name TEXT NOT NULL,
            category TEXT,
            rating INTEGER NOT NULL,
            review TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Create pending items table
    db.run(`
        CREATE TABLE IF NOT EXISTS pending_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_name TEXT NOT NULL,
            description TEXT,
            category TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.close();
    console.log('Database initialized successfully');
}

// Start server
app.listen(PORT, () => {
    initDatabase();
    console.log(`Server is running on port ${PORT}`);
});