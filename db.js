const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'ambient_root.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the local SQLite database.');
        initializeSchema();
    }
});

function initializeSchema() {
    db.serialize(() => {
        // Table for incoming message logs
        db.run(`CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            provider TEXT,
            sender TEXT,
            content TEXT,
            redacted_content TEXT,
            urgency TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Table for user session tokens (Local-First privacy)
        db.run(`CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            platform TEXT UNIQUE,
            token TEXT,
            meta_data TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
    });
}

const saveMessage = (messageData) => {
    const { provider, sender, content, redacted_content, urgency } = messageData;
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO messages (provider, sender, content, redacted_content, urgency) VALUES (?, ?, ?, ?, ?)`,
            [provider, sender, content, redacted_content, urgency],
            function (err) {
                if (err) {
                    console.error('Error saving message:', err.message);
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            }
        );
    });
};

const saveSession = (platform, token, metaData = {}) => {
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO sessions (platform, token, meta_data) 
             VALUES (?, ?, ?) 
             ON CONFLICT(platform) DO UPDATE SET 
             token = excluded.token, 
             meta_data = excluded.meta_data,
             updated_at = CURRENT_TIMESTAMP`,
            [platform, token, JSON.stringify(metaData)],
            function (err) {
                if (err) {
                    console.error('Error saving session:', err.message);
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            }
        );
    });
};

module.exports = {
    db,
    saveMessage,
    saveSession
};
