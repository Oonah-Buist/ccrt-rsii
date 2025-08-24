// Main backend server for CCRT RSII
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
// Added security and ops middleware
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const SQLiteStore = require('connect-sqlite3')(session);
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 4000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// SQLite DB setup
// Allow overriding DB locations via env so platforms like Railway can mount volumes
const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'ccrt-rsii.db');
const SESSIONS_DB_FILE = process.env.SESSIONS_DB_FILE || path.join(__dirname, 'sessions.sqlite');
// Ensure directories exist
try { fs.mkdirSync(path.dirname(DB_FILE), { recursive: true }); } catch {}
try { fs.mkdirSync(path.dirname(SESSIONS_DB_FILE), { recursive: true }); } catch {}
const db = new sqlite3.Database(DB_FILE);

// Middleware
// Trust proxy when behind reverse proxy (Nginx/Cloudflare) for correct proto & IP
if (process.env.TRUST_PROXY === 'true' || NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Optionally enforce HTTPS redirects when behind a proxy
if (process.env.ENFORCE_HTTPS === 'true') {
  app.use((req, res, next) => {
    if (req.secure) return next();
    // Some proxies set x-forwarded-proto
    if (req.headers['x-forwarded-proto'] === 'https') return next();
    return res.redirect(301, 'https://' + req.headers.host + req.originalUrl);
  });
}

// Security headers
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false // keep simple; can be tightened later
}));

// Logging & compression
app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(compression());

// CORS: if ORIGIN is set, restrict; else allow same-origin
if (process.env.CORS_ORIGIN) {
  app.use(cors({ origin: process.env.CORS_ORIGIN.split(','), credentials: true }));
} else {
  app.use(cors({ origin: true, credentials: true }));
}

app.use(express.json());
// Accept webhook posts from JotForm (x-www-form-urlencoded)
app.use(express.urlencoded({ extended: true }));

// Sessions: use persistent SQLite store
const sessionSecret = process.env.SESSION_SECRET || 'change-this-in-prod';
app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  store: new SQLiteStore({ db: path.basename(SESSIONS_DB_FILE), dir: path.dirname(SESSIONS_DB_FILE) }),
  cookie: {
    secure: NODE_ENV === 'production',
    sameSite: NODE_ENV === 'production' ? 'lax' : 'lax',
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 8 // 8 hours
  }
}));

// Basic rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
});
app.use(['/api/admin/login', '/api/participant/login', '/api/baa/login'], authLimiter);

// DB schema setup (run once)
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password_hash TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS baas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT,
    login_id TEXT,
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

  // Track BAA submissions (one record per BAA)
  db.run(`CREATE TABLE IF NOT EXISTS baa_completions (
    baa_id INTEGER PRIMARY KEY,
    completed_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Ensure missing columns exist (simple migration)
  db.all(`PRAGMA table_info(forms)`, [], (err, columns) => {
    if (!err) {
      const hasButtonImage = columns.some(c => c.name === 'button_image');
      if (!hasButtonImage) {
        db.run(`ALTER TABLE forms ADD COLUMN button_image TEXT`, (e) => {
          if (e) console.error('Failed to add button_image column to forms:', e.message);
          else console.log('Added button_image column to forms table');
        });
      }
    }
  });

  // Ensure baas table columns and drop legacy password_hash by rebuild
  db.all(`PRAGMA table_info(baas)`, [], (err, columns) => {
    if (err || !Array.isArray(columns)) return;
    const hasName = columns.some(c => c.name === 'name');
    const hasEmail = columns.some(c => c.name === 'email');
    const hasLoginId = columns.some(c => c.name === 'login_id');
    const hasPasswordHash = columns.some(c => c.name === 'password_hash');

    let pending = 0;
    const maybeStartDropMigration = () => {
      if (pending !== 0) return;
      if (!hasPasswordHash) return; // nothing to drop

      console.log('Migrating baas table to remove legacy password_hash column...');
      // Rebuild table without password_hash
      db.run('BEGIN TRANSACTION', (e1) => {
        if (e1) { console.error('Migration failed to BEGIN:', e1.message); return; }
        db.run('DROP TABLE IF EXISTS baas_new', (e1a) => {
          if (e1a) { console.error('Migration failed (drop temp):', e1a.message); db.run('ROLLBACK'); return; }
          db.run(`CREATE TABLE baas_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            email TEXT,
            login_id TEXT,
            jotform_embed TEXT
          )`, (e2) => {
            if (e2) { console.error('Migration failed to create baas_new:', e2.message); db.run('ROLLBACK'); return; }
            db.run(`INSERT INTO baas_new (id, name, email, login_id, jotform_embed)
                    SELECT id, name, email, login_id, jotform_embed FROM baas`, (e3) => {
              if (e3) { console.error('Migration failed to copy data:', e3.message); db.run('ROLLBACK'); return; }
              db.run('DROP TABLE baas', (e4) => {
                if (e4) { console.error('Migration failed to drop old baas:', e4.message); db.run('ROLLBACK'); return; }
                db.run('ALTER TABLE baas_new RENAME TO baas', (e5) => {
                  if (e5) { console.error('Migration failed to rename table:', e5.message); db.run('ROLLBACK'); return; }
                  db.run('COMMIT', (e6) => {
                    if (e6) console.error('Migration failed to COMMIT:', e6.message);
                    else console.log('baas table migrated: password_hash removed');
                  });
                });
              });
            });
          });
        });
      });
    };

    const addColumn = (sql, label) => {
      pending++;
      db.run(sql, (e) => {
        if (e) console.error(`Failed to add ${label} column to baas:`, e.message);
        else console.log(`Added ${label} column to baas table`);
        pending--;
        maybeStartDropMigration();
      });
    };

    if (!hasName) addColumn('ALTER TABLE baas ADD COLUMN name TEXT', 'name');
    if (!hasEmail) addColumn('ALTER TABLE baas ADD COLUMN email TEXT', 'email');
    if (!hasLoginId) addColumn('ALTER TABLE baas ADD COLUMN login_id TEXT', 'login_id');
    if (pending === 0) maybeStartDropMigration();
  });
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

// Small helper: mark completion after validating assignment
function markCompletion(participantId, formId, cb) {
  if (!participantId || !formId) return cb(new Error('Missing participantId or formId'));
  db.get('SELECT 1 FROM assignments WHERE participant_id = ? AND form_id = ?', [participantId, formId], (err, row) => {
    if (err) return cb(err);
    if (!row) return cb(new Error('Assignment not found'));
    db.run('INSERT OR IGNORE INTO completions (participant_id, form_id) VALUES (?, ?)', [participantId, formId], (err2) => cb(err2));
  });
}

// On first run, set default admin password if not set; read from env if provided
getAdmin('admin', (err, admin) => {
  if (!admin) {
    const defaultPwd = process.env.ADMIN_DEFAULT_PASSWORD || 'ChangeMe123!';
    setAdminPassword('admin', defaultPwd, () => {
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
  const { login_id } = req.body;
  if (!login_id) return res.status(400).json({ error: 'login_id required' });
  db.get('SELECT * FROM baas WHERE login_id = ?', [login_id], (err, baa) => {
    if (err || !baa) return res.status(401).json({ error: 'Invalid credentials' });
    req.session.baa = { id: baa.id };
    res.json({ success: true });
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

// Record BAA completion via Thank You redirect
// Configure JotForm Thank You to redirect to: /api/baa/thankyou?baa_id={baa_id}
app.get('/api/baa/thankyou', (req, res) => {
  const baaIdFromQuery = parseInt(req.query.baa_id, 10);
  const baaIdFromSession = req.session?.baa?.id;
  const baaId = Number.isInteger(baaIdFromQuery) ? baaIdFromQuery : (Number.isInteger(baaIdFromSession) ? baaIdFromSession : undefined);
  if (!baaId) {
    res.status(400).send('<h2>Missing BAA information.</h2>');
    return;
  }
  db.run('INSERT OR REPLACE INTO baa_completions (baa_id, completed_at) VALUES (?, CURRENT_TIMESTAMP)', [baaId], (err) => {
    const success = !err;
    const title = success ? 'BAA Submission Received' : 'Could not record BAA completion';
    const message = success ? 'Thank you! Your BAA submission was received and recorded.' : 'We received your submission, but could not record it automatically.';
    res.set('Content-Type', 'text/html');
    res.send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title}</title><meta http-equiv="refresh" content="2"></head>
<body style="font-family: Arial, sans-serif;">
  <h2>${title}</h2>
  <p>${message}</p>
  <script>setTimeout(function(){ if (window.opener) { try { window.opener.location.reload(); } catch(e){} } window.close(); }, 1500);</script>
</body></html>`);
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
  db.all('SELECT id, name, email, login_id, jotform_embed FROM baas', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch BAAs' });
    res.json({ baas: rows });
  });
});

// --- Add a new BAA ---
app.post('/api/baas', requireAdmin, (req, res) => {
  const { name, email, login_id, jotform_embed } = req.body;
  if (!login_id) return res.status(400).json({ error: 'BAA Login ID required' });
  if (!jotform_embed) return res.status(400).json({ error: 'JotForm embed code required' });
  // name/email optional
  db.run('INSERT INTO baas (name, email, login_id, jotform_embed) VALUES (?, ?, ?, ?)', [name || null, email || null, login_id, jotform_embed], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to add BAA' });
    res.json({ id: this.lastID });
  });
});

// --- Update a BAA’s details ---
app.put('/api/baas/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { name, email, login_id, jotform_embed } = req.body;
  if (!name && !email && !login_id && !jotform_embed) return res.status(400).json({ error: 'Nothing to update' });

  const updates = [];
  const params = [];
  if (typeof name === 'string') { updates.push('name = ?'); params.push(name); }
  if (typeof email === 'string') { updates.push('email = ?'); params.push(email); }
  if (typeof login_id === 'string') { updates.push('login_id = ?'); params.push(login_id); }
  if (typeof jotform_embed === 'string') { updates.push('jotform_embed = ?'); params.push(jotform_embed); }
  const sql = `UPDATE baas SET ${updates.join(', ')} WHERE id = ?`;
  params.push(id);
  db.run(sql, params, function(err) {
    if (err) return res.status(500).json({ error: 'Failed to update BAA' });
    res.json({ success: true });
  });
});

// --- Delete a BAA ---
app.delete('/api/baas/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM baas WHERE id = ?', [id], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to delete BAA' });
    res.json({ success: true });
  });
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
  db.all(`SELECT f.id, f.name, f.jotform_embed, f.button_image,
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
  db.all('SELECT id, name, jotform_embed, button_image FROM forms', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch forms' });
    res.json({ forms: rows });
  });
});

// --- Admin: add a new form ---
app.post('/api/forms', requireAdmin, (req, res) => {
  const { name, jotform_embed, button_image } = req.body;
  if (!name || !jotform_embed || !button_image) return res.status(400).json({ error: 'Name, JotForm embed code, and button image required' });
  db.run('INSERT INTO forms (name, jotform_embed, button_image) VALUES (?, ?, ?)', [name, jotform_embed, button_image], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to add form' });
    res.json({ id: this.lastID });
  });
});

// --- Admin: update a form ---
app.put('/api/forms/:id', requireAdmin, (req, res) => {
  const id = req.params.id;
  const { name, jotform_embed, button_image } = req.body;
  if (!name || !jotform_embed || !button_image) return res.status(400).json({ error: 'Name, JotForm embed code, and button image required' });
  db.run('UPDATE forms SET name = ?, jotform_embed = ?, button_image = ? WHERE id = ?', [name, jotform_embed, button_image, id], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to update form' });
    res.json({ success: true });
  });
});

// --- Admin: delete a form ---
app.delete('/api/forms/:id', requireAdmin, (req, res) => {
  const id = req.params.id;
  db.run('DELETE FROM assignments WHERE form_id = ?', [id], (err1) => {
    if (err1) return res.status(500).json({ error: 'Failed to delete assignments' });
    db.run('DELETE FROM completions WHERE form_id = ?', [id], (err2) => {
      if (err2) return res.status(500).json({ error: 'Failed to delete completions' });
      db.run('DELETE FROM forms WHERE id = ?', [id], function(err3) {
        if (err3) return res.status(500).json({ error: 'Failed to delete form' });
        res.json({ success: true });
      });
    });
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
      res.json({
        id: participant.id,
        name: participant.name,
        login_id: participant.login_id,
        assignedForms: formIds
      });
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

// --- Admin: update participant info and assigned forms ---
app.put('/api/participants/:id', requireAdmin, (req, res) => {
  const id = req.params.id;
  const { name, login_id, assignedForms } = req.body;
  // Update name and/or login_id if provided
  const updateParticipant = (cb) => {
    if (login_id && name) {
      db.run('UPDATE participants SET name = ?, login_id = ? WHERE id = ?', [name, login_id, id], cb);
    } else if (name) {
      db.run('UPDATE participants SET name = ? WHERE id = ?', [name, id], cb);
    } else if (login_id) {
      db.run('UPDATE participants SET login_id = ? WHERE id = ?', [login_id, id], cb);
    } else {
      cb();
    }
  };
  updateParticipant((err) => {
    if (err) return res.status(500).json({ error: 'Failed to update participant' });
    // Update assigned forms
    if (Array.isArray(assignedForms)) {
      db.run('DELETE FROM assignments WHERE participant_id = ?', [id], (err2) => {
        if (err2) return res.status(500).json({ error: 'Failed to clear assignments' });
        const stmt = db.prepare('INSERT INTO assignments (participant_id, form_id) VALUES (?, ?)');
        assignedForms.forEach(fid => stmt.run(id, fid));
        stmt.finalize(err3 => {
          if (err3) return res.status(500).json({ error: 'Failed to assign forms' });
          res.json({ success: true });
        });
      });
    } else {
      res.json({ success: true });
    }
  });
});

// --- Admin: manually mark a participant's form complete ---
app.post('/api/admin/participants/:pid/forms/:fid/complete', requireAdmin, (req, res) => {
  const pid = parseInt(req.params.pid, 10);
  const fid = parseInt(req.params.fid, 10);
  markCompletion(pid, fid, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    res.json({ success: true });
  });
});

// --- JotForm Thank You redirect endpoint ---
// Configure your JotForm Thank You Page to redirect to:
// http://<your-host>/api/jotform/thankyou?pid={participant_id}&fid={form_id}
app.get('/api/jotform/thankyou', (req, res) => {
  const pid = parseInt(req.query.pid || req.query.participant_id, 10);
  const fid = parseInt(req.query.fid || req.query.form_id, 10);
  // Optionally, try to use logged in participant if matches
  const sessionPid = req.session?.participant?.id;
  const effectivePid = Number.isInteger(pid) ? pid : (Number.isInteger(sessionPid) ? sessionPid : undefined);
  if (!effectivePid || !Number.isInteger(fid)) {
    return res.status(400).send('<h2>Missing participant or form information.</h2>');
  }
  markCompletion(effectivePid, fid, (err) => {
    const success = !err;
    const title = success ? 'Submission Received' : 'Could not record completion';
    const message = success ? 'Thank you! Your submission was received and recorded.' : `We received your submission, but could not record it automatically (${err?.message}).`;
    // Simple HTML page that closes after a short delay and refreshes the opener
    res.set('Content-Type', 'text/html');
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>body{font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif; padding: 2rem; text-align:center;} .ok{color:#2e7d32} .warn{color:#c62828} .btn{display:inline-block;margin-top:1rem;padding:.6rem 1rem;border-radius:6px;background:#5a31f4;color:#fff;text-decoration:none}</style>
</head>
<body>
  <h2 class="${success ? 'ok' : 'warn'}">${title}</h2>
  <p>${message}</p>
  <a class="btn" href="/participant-portal.html">Back to Portal</a>
  <script>
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ type: 'form_completed', pid: ${effectivePid}, fid: ${fid} }, '*');
      }
    } catch (e) {}
    setTimeout(function(){ window.close(); }, 2500);
  <\/script>
</body>
</html>`);
  });
});

// --- JotForm Webhook endpoint ---
// Configure your JotForm webhook to POST to: http://<your-host>/api/jotform/webhook
// Include hidden fields named participant_id and form_id in your form.
app.post('/api/jotform/webhook', (req, res) => {
  // JotForm can send x-www-form-urlencoded; express.urlencoded handles this
  const body = req.body || {};
  // Attempt to extract participant_id and form_id (case-insensitive) from all keys
  const findId = (keys) => {
    for (const k of Object.keys(body)) {
      if (k.toLowerCase() === keys) {
        const val = parseInt(body[k], 10);
        if (Number.isInteger(val)) return val;
      }
    }
    return undefined;
  };
  const pid = findId('participant_id');
  const fid = findId('form_id');

  if (!pid || !fid) {
    return res.status(400).json({ error: 'Missing participant_id or form_id in webhook payload' });
  }

  markCompletion(pid, fid, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    res.json({ success: true });
  });
});

// Serve static files (should be after API routes)
const publicDir = path.join(__dirname, 'public');
const distDir = path.join(__dirname, 'dist');
let staticDir = publicDir;
if (NODE_ENV === 'production' && fs.existsSync(distDir)) {
  staticDir = distDir;
}
if (NODE_ENV === 'production') {
  // Optionally block debug/test pages in production
  app.use((req, res, next) => {
    if (/(debug|test)\b-?.*\.(html|js|css)$/i.test(req.path)) {
      return res.status(404).send('Not found');
    }
    next();
  });
}
app.use(express.static(staticDir));

// If serving a built SPA in production, provide a fallback to index.html
if (NODE_ENV === 'production' && staticDir === distDir) {
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path === '/health' || req.path === '/healthz') return next();
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send('ok');
});
app.get('/healthz', (req, res) => {
  db.get('SELECT 1 as ok', [], (err, row) => {
    if (err) return res.status(500).json({ status: 'error' });
    res.json({ status: 'ok' });
  });
});

// --- Error handling middleware ---
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong' });
});

// --- Admin submissions aggregate ---
app.get('/api/admin/submissions', requireAdmin, (req, res) => {
  const result = { participants: [], baas: [] };

  // Participants with completed forms
  db.all(`
    SELECT p.id as participant_id, p.name as participant_name, p.login_id,
           f.id as form_id, f.name as form_name, c.completed_at
    FROM participants p
    LEFT JOIN completions c ON c.participant_id = p.id
    LEFT JOIN forms f ON f.id = c.form_id
    ORDER BY p.name COLLATE NOCASE, c.completed_at
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch participant submissions' });
    const map = new Map();
    rows.forEach(r => {
      if (!map.has(r.participant_id)) {
        map.set(r.participant_id, { id: r.participant_id, name: r.participant_name, login_id: r.login_id, completed: [] });
      }
      if (r.form_id) {
        map.get(r.participant_id).completed.push({ form_id: r.form_id, form_name: r.form_name, completed_at: r.completed_at });
      }
    });
    result.participants = Array.from(map.values());

    // BAAs with completion status
    db.all(`
      SELECT b.id as baa_id, b.name, b.login_id, bc.completed_at
      FROM baas b
      LEFT JOIN baa_completions bc ON bc.baa_id = b.id
      ORDER BY b.name COLLATE NOCASE
    `, [], (err2, rows2) => {
      if (err2) return res.status(500).json({ error: 'Failed to fetch BAA submissions' });
      result.baas = rows2.map(r => ({ id: r.baa_id, name: r.name, login_id: r.login_id, completed_at: r.completed_at }));
      res.json(result);
    });
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
