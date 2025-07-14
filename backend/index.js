// Main backend server for CCRT RSII
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;

// SQLite DB setup
const db = new sqlite3.Database(path.join(__dirname, 'ccrt-rsii.db'));

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(session({
  secret: 'ccrt-rsii-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set to true if using HTTPS
}));

// DB schema setup (run once)
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password_hash TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS baas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    password_hash TEXT,
    jotform_embed TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    login_id TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS forms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    jotform_embed TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS assignments (
    participant_id INTEGER,
    form_id INTEGER,
    PRIMARY KEY (participant_id, form_id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS completions (
    participant_id INTEGER,
    form_id INTEGER,
    completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (participant_id, form_id)
  )`);
});

// Helper: get admin by username
function getAdmin(username, cb) {
  db.get('SELECT * FROM admins WHERE username = ?', [username], cb);
}

// Helper: set admin password
function setAdminPassword(username, password, cb) {
  bcrypt.hash(password, 10, (err, hash) => {
    if (err) return cb(err);
    db.run('INSERT OR REPLACE INTO admins (id, username, password_hash) VALUES ((SELECT id FROM admins WHERE username = ?), ?, ?)', [username, username, hash], cb);
  });
}

// On first run, set default admin password if not set
getAdmin('admin', (err, admin) => {
  if (!admin) {
    setAdminPassword('admin', 'ChangeMe123!', () => {
      console.log('Default admin password set.');
    });
  }
});

// --- Admin login ---
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  getAdmin(username, (err, admin) => {
    if (err || !admin) return res.status(401).json({ error: 'Invalid credentials' });
    bcrypt.compare(password, admin.password_hash, (err, result) => {
      if (result) {
        req.session.admin = { username };
        res.json({ success: true });
      } else {
        res.status(401).json({ error: 'Invalid credentials' });
      }
    });
  });
});

// --- Admin logout ---
app.post('/api/admin/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

// --- Admin password change ---
app.post('/api/admin/change-password', (req, res) => {
  if (!req.session.admin) return res.status(401).json({ error: 'Not logged in' });
  const { oldPassword, newPassword } = req.body;
  getAdmin(req.session.admin.username, (err, admin) => {
    if (err || !admin) return res.status(401).json({ error: 'Invalid session' });
    bcrypt.compare(oldPassword, admin.password_hash, (err, result) => {
      if (!result) return res.status(403).json({ error: 'Old password incorrect' });
      setAdminPassword(admin.username, newPassword, (err) => {
        if (err) return res.status(500).json({ error: 'Failed to update password' });
        res.json({ success: true });
      });
    });
  });
});

// --- BAA login ---
app.post('/api/baa/login', (req, res) => {
  const { password } = req.body;
  db.get('SELECT * FROM baas WHERE password_hash IS NOT NULL', [], (err, baa) => {
    if (err || !baa) return res.status(401).json({ error: 'Invalid credentials' });
    bcrypt.compare(password, baa.password_hash, (err, result) => {
      if (result) {
        req.session.baa = { id: baa.id };
        res.json({ success: true });
      } else {
        res.status(401).json({ error: 'Invalid credentials' });
      }
    });
  });
});

// --- Get JotForm embed code for logged-in BAA ---
app.get('/api/baa/form', (req, res) => {
  if (!req.session.baa) return res.status(401).json({ error: 'Not logged in' });
  db.get('SELECT jotform_embed FROM baas WHERE id = ?', [req.session.baa.id], (err, row) => {
    if (err || !row) return res.status(404).json({ error: 'No form assigned' });
    res.json({ embedCode: row.jotform_embed });
  });
});

// --- Middleware: require admin login ---
function requireAdmin(req, res, next) {
  if (!req.session.admin) return res.status(401).json({ error: 'Admin login required' });
  next();
}

// --- Middleware: require participant login ---
function requireParticipant(req, res, next) {
  if (!req.session.participant) return res.status(401).json({ error: 'Participant login required' });
  next();
}

// --- List all BAAs ---
app.get('/api/baas', requireAdmin, (req, res) => {
  db.all('SELECT id, jotform_embed FROM baas', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch BAAs' });
    res.json({ baas: rows });
  });
});

// --- Add a new BAA ---
app.post('/api/baas', requireAdmin, (req, res) => {
  const { password, jotform_embed } = req.body;
  if (!password || !jotform_embed) return res.status(400).json({ error: 'Password and JotForm embed code required' });
  bcrypt.hash(password, 10, (err, hash) => {
    if (err) return res.status(500).json({ error: 'Failed to hash password' });
    db.run('INSERT INTO baas (password_hash, jotform_embed) VALUES (?, ?)', [hash, jotform_embed], function(err) {
      if (err) return res.status(500).json({ error: 'Failed to add BAA' });
      res.json({ id: this.lastID });
    });
  });
});

// --- Update a BAA’s password or JotForm code ---
app.put('/api/baas/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { password, jotform_embed } = req.body;
  if (!password && !jotform_embed) return res.status(400).json({ error: 'Nothing to update' });
  if (password) {
    bcrypt.hash(password, 10, (err, hash) => {
      if (err) return res.status(500).json({ error: 'Failed to hash password' });
      db.run('UPDATE baas SET password_hash = ? WHERE id = ?', [hash, id], function(err) {
        if (err) return res.status(500).json({ error: 'Failed to update password' });
        if (jotform_embed) {
          db.run('UPDATE baas SET jotform_embed = ? WHERE id = ?', [jotform_embed, id], function(err) {
            if (err) return res.status(500).json({ error: 'Failed to update JotForm' });
            res.json({ success: true });
          });
        } else {
          res.json({ success: true });
        }
      });
    });
  } else if (jotform_embed) {
    db.run('UPDATE baas SET jotform_embed = ? WHERE id = ?', [jotform_embed, id], function(err) {
      if (err) return res.status(500).json({ error: 'Failed to update JotForm' });
      res.json({ success: true });
    });
  }
});

// --- Admin: add participant ---
app.post('/api/participants', requireAdmin, (req, res) => {
  // Debug: log session and body
  console.log('Session:', req.session);
  console.log('Received participant:', req.body);
  // Accept both loginId and login_id for robustness
  const { name, loginId, login_id } = req.body;
  const finalLoginId = loginId || login_id;
  if (!name || !finalLoginId) {
    console.log('Missing name or loginId:', { name, finalLoginId });
    return res.status(400).json({ error: 'Name and Login ID required' });
  }
  db.run('INSERT INTO participants (name, login_id) VALUES (?, ?)', [name, finalLoginId], function(err) {
    if (err) {
      console.log('DB error:', err);
      return res.status(500).json({ error: 'Failed to add participant', details: err.message });
    }
    res.json({ id: this.lastID });
  });
});

// --- Admin: list participants ---
app.get('/api/participants', requireAdmin, (req, res) => {
  db.all('SELECT id, name, login_id FROM participants', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch participants' });
    res.json({ participants: rows });
  });
});

// --- Admin: assign forms to participant ---
app.post('/api/assign', requireAdmin, (req, res) => {
  const { participant_id, form_ids } = req.body;
  if (!participant_id || !Array.isArray(form_ids)) return res.status(400).json({ error: 'participant_id and form_ids required' });
  const stmt = db.prepare('INSERT OR IGNORE INTO assignments (participant_id, form_id) VALUES (?, ?)');
  form_ids.forEach(fid => stmt.run(participant_id, fid));
  stmt.finalize(err => {
    if (err) return res.status(500).json({ error: 'Failed to assign forms' });
    res.json({ success: true });
  });
});

// --- Participant login ---
app.post('/api/participant/login', (req, res) => {
  const { login_id } = req.body;
  db.get('SELECT * FROM participants WHERE login_id = ?', [login_id], (err, user) => {
    if (err || !user) return res.status(401).json({ error: 'Invalid credentials' });
    req.session.participant = { id: user.id, name: user.name, login_id: user.login_id };
    res.json({ success: true });
  });
});

// --- Participant logout ---
app.post('/api/participant/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

// --- Participant: fetch assigned forms and completion status ---
app.get('/api/participant/forms', requireParticipant, (req, res) => {
  const pid = req.session.participant.id;
  db.all(`SELECT f.id, f.name, f.jotform_embed,
    CASE WHEN c.form_id IS NOT NULL THEN 1 ELSE 0 END as completed
    FROM forms f
    JOIN assignments a ON a.form_id = f.id AND a.participant_id = ?
    LEFT JOIN completions c ON c.form_id = f.id AND c.participant_id = ?`,
    [pid, pid], (err, rows) => {
      if (err) return res.status(500).json({ error: 'Failed to fetch forms' });
      res.json({ forms: rows });
    });
});

// --- Participant: mark form as completed ---
app.post('/api/participant/complete', requireParticipant, (req, res) => {
  const pid = req.session.participant.id;
  const { form_id } = req.body;
  if (!form_id) return res.status(400).json({ error: 'form_id required' });
  db.run('INSERT OR IGNORE INTO completions (participant_id, form_id) VALUES (?, ?)', [pid, form_id], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to mark as completed' });
    res.json({ success: true });
  });
});

// --- Admin: list all forms ---
app.get('/api/forms', requireAdmin, (req, res) => {
  db.all('SELECT id, name, jotform_embed FROM forms', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch forms' });
    res.json({ forms: rows });
  });
});

// --- Admin: add a new form ---
app.post('/api/forms', requireAdmin, (req, res) => {
  const { name, jotform_embed } = req.body;
  if (!name || !jotform_embed) return res.status(400).json({ error: 'Name and JotForm embed code required' });
  db.run('INSERT INTO forms (name, jotform_embed) VALUES (?, ?)', [name, jotform_embed], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to add form' });
    res.json({ id: this.lastID });
  });
});

// --- Admin: get participant details and assigned forms ---
app.get('/api/participants/:id', requireAdmin, (req, res) => {
  const id = req.params.id;
  db.get('SELECT id, name, login_id FROM participants WHERE id = ?', [id], (err, participant) => {
    if (err || !participant) return res.status(404).json({ error: 'Participant not found' });
    db.all('SELECT form_id FROM assignments WHERE participant_id = ?', [id], (err2, rows) => {
      if (err2) return res.status(500).json({ error: 'Failed to fetch assignments' });
      const formIds = rows.map(row => row.form_id);
      res.json({ participant, formIds });
    });
  });
});

// --- Participant: get own details and assigned forms ---
app.get('/api/participant/me', requireParticipant, (req, res) => {
  const pid = req.session.participant.id;
  db.get('SELECT id, name, login_id FROM participants WHERE id = ?', [pid], (err, participant) => {
    if (err || !participant) return res.status(404).json({ error: 'Participant not found' });
    db.all('SELECT form_id FROM assignments WHERE participant_id = ?', [pid], (err2, rows) => {
      if (err2) return res.status(500).json({ error: 'Failed to fetch assignments' });
      const formIds = rows.map(row => row.form_id);
      res.json({ participant, formIds });
    });
  });
});

// --- Admin: delete participant ---
app.delete('/api/participants/:id', requireAdmin, (req, res) => {
  const id = req.params.id;
  db.run('DELETE FROM assignments WHERE participant_id = ?', [id], (err2) => {
    if (err2) return res.status(500).json({ error: 'Failed to delete assignments' });
    db.run('DELETE FROM participants WHERE id = ?', [id], function(err3) {
      if (err3) return res.status(500).json({ error: 'Failed to delete participant' });
      res.json({ success: true });
    });
  });
});

// Serve static files (should be after API routes)
app.use(express.static(path.join(__dirname, 'public')));

// --- Error handling middleware ---
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
