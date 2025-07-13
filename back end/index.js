require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const db = new sqlite3.Database('./database.sqlite');
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

app.use(cors());
app.use(express.json());

// --- Database Setup ---
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'participant', 'business_associate'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS form_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    form_id TEXT NOT NULL,
    completed INTEGER DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS jotform_embeds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ba_id INTEGER NOT NULL,
    form_id TEXT NOT NULL,
    embed_code TEXT NOT NULL,
    FOREIGN KEY(ba_id) REFERENCES users(id)
  )`);

  // Ensure default admin exists
  db.get("SELECT * FROM users WHERE role = 'admin'", (err, row) => {
    if (!row) {
      bcrypt.hash('ChangeMe123!', 10, (err, hash) => {
        db.run("INSERT INTO users (username, password, role) VALUES (?, ?, 'admin')", ['admin', hash]);
      });
    }
  });
});

// --- Auth Middleware ---
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// --- Routes ---
// Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    bcrypt.compare(password, user.password, (err, result) => {
      if (!result) return res.status(401).json({ error: 'Invalid credentials' });
      const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
      res.json({ token, role: user.role });
    });
  });
});

// Change admin password
app.post('/api/admin/change-password', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  const { newPassword } = req.body;
  bcrypt.hash(newPassword, 10, (err, hash) => {
    db.run('UPDATE users SET password = ? WHERE id = ?', [hash, req.user.id], function(err) {
      if (err) return res.status(500).json({ error: 'Failed to update password' });
      res.json({ success: true });
    });
  });
});

// Assign participant password (admin only)
app.post('/api/admin/assign-participant', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  const { username, password } = req.body;
  bcrypt.hash(password, 10, (err, hash) => {
    db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [username, hash, 'participant'], function(err) {
      if (err) return res.status(400).json({ error: 'User already exists' });
      res.json({ success: true });
    });
  });
});

// Get assigned forms for participant
app.get('/api/participant/forms', authenticateToken, (req, res) => {
  if (req.user.role !== 'participant') return res.sendStatus(403);
  db.all('SELECT form_id, completed FROM form_assignments WHERE user_id = ?', [req.user.id], (err, rows) => {
    res.json({ forms: rows });
  });
});

// Mark form as completed
app.post('/api/participant/complete-form', authenticateToken, (req, res) => {
  if (req.user.role !== 'participant') return res.sendStatus(403);
  const { form_id } = req.body;
  db.run('UPDATE form_assignments SET completed = 1 WHERE user_id = ? AND form_id = ?', [req.user.id, form_id], function(err) {
    if (err || this.changes === 0) return res.status(400).json({ error: 'Form not assigned or already completed' });
    res.json({ success: true });
  });
});

// Assign form to participant (admin only)
app.post('/api/admin/assign-form', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  const { username, form_id } = req.body;
  db.get('SELECT id FROM users WHERE username = ? AND role = ?', [username, 'participant'], (err, user) => {
    if (!user) return res.status(404).json({ error: 'Participant not found' });
    db.run('INSERT INTO form_assignments (user_id, form_id, completed) VALUES (?, ?, 0)', [user.id, form_id], function(err) {
      if (err) return res.status(400).json({ error: 'Form already assigned' });
      res.json({ success: true });
    });
  });
});

// --- Business Associate Registration ---
app.post('/api/ba/register', (req, res) => {
  const { username, password } = req.body;
  bcrypt.hash(password, 10, (err, hash) => {
    db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [username, hash, 'business_associate'], function(err) {
      if (err) return res.status(400).json({ error: 'User already exists' });
      res.json({ success: true });
    });
  });
});

// --- Business Associate Login ---
app.post('/api/ba/login', (req, res) => {
  const { username, password } = req.body;
  db.get('SELECT * FROM users WHERE username = ? AND role = ?', [username, 'business_associate'], (err, user) => {
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    bcrypt.compare(password, user.password, (err, result) => {
      if (!result) return res.status(401).json({ error: 'Invalid credentials' });
      const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
      res.json({ token, role: user.role });
    });
  });
});

// --- Admin: Assign JotForm Embed Code to BA ---
app.post('/api/admin/assign-jotform', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  const { ba_username, form_id, embed_code } = req.body;
  db.get('SELECT id FROM users WHERE username = ? AND role = ?', [ba_username, 'business_associate'], (err, ba) => {
    if (!ba) return res.status(404).json({ error: 'Business Associate not found' });
    db.run('INSERT INTO jotform_embeds (ba_id, form_id, embed_code) VALUES (?, ?, ?)', [ba.id, form_id, embed_code], function(err) {
      if (err) return res.status(400).json({ error: 'Embed already assigned' });
      res.json({ success: true });
    });
  });
});

// --- BA: Get Assigned Forms and Embed Codes ---
app.get('/api/ba/forms', authenticateToken, (req, res) => {
  if (req.user.role !== 'business_associate') return res.sendStatus(403);
  db.all('SELECT form_id, embed_code FROM jotform_embeds WHERE ba_id = ?', [req.user.id], (err, rows) => {
    res.json({ forms: rows });
  });
});

// --- BA: Get Single Embed Code for Authenticated BA ---
app.get('/api/baa/form', authenticateToken, (req, res) => {
  if (req.user.role !== 'business_associate') return res.sendStatus(403);
  db.get('SELECT embed_code FROM jotform_embeds WHERE ba_id = ? LIMIT 1', [req.user.id], (err, row) => {
    if (err || !row) return res.status(404).json({ error: 'No embed code found' });
    res.json({ embed_code: row.embed_code });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
