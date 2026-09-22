const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'challenge_db.json');
const QUESTIONS_FILE = path.join(DATA_DIR, 'questions.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Load questions
let questions = [];
try {
  const qData = fs.readFileSync(QUESTIONS_FILE, 'utf8');
  questions = JSON.parse(qData);
} catch (err) {
  console.error('Error loading questions:', err);
}

// Format date as YYYY-MM-DD
function getLocalDateString(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Calculate unlocked day (1 to 5)
function calculateUnlockedDay(startDateStr) {
  if (!startDateStr) return 1;
  const startParts = startDateStr.split('-').map(Number);
  const startDate = new Date(startParts[0], startParts[1] - 1, startParts[2]);
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const diffTime = today - startDate;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const currentDay = diffDays + 1;

  if (currentDay < 1) return 1;
  if (currentDay > 5) return 5;
  return currentDay;
}

// Validate Roll Number
function isValidRollNo(rollNo) {
  if (!rollNo || typeof rollNo !== 'string') return false;
  const regex = /^25ma60r\d+$/i;
  return regex.test(rollNo.trim());
}

// Validate Name: at least 4 characters
function isValidName(name) {
  if (!name || typeof name !== 'string') return false;
  return name.trim().length >= 4;
}

// Database Connection
let pgPool = null;
let isPostgresReady = false;

if (process.env.DATABASE_URL) {
  try {
    const isLocal = process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1');
    pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: isLocal ? false : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    });
  } catch (err) {
    console.error('PostgreSQL initialization error:', err.message);
  }
}

// Initialize tables in PostgreSQL
async function initDatabase() {
  if (!pgPool) return;

  try {
    // 1. Meta table (startDate, etc.)
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS challenge_meta (
        key VARCHAR(50) PRIMARY KEY,
        val TEXT NOT NULL
      );
    `);

    // 2. Individual users table - each user has their own row (no race conditions!)
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS challenge_users (
        roll_no VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        joined_at TEXT NOT NULL,
        last_active TEXT NOT NULL,
        solved JSONB DEFAULT '{}'::jsonb
      );
    `);

    // 3. Activity feed table
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS challenge_activity (
        id VARCHAR(80) PRIMARY KEY,
        roll_no VARCHAR(50) NOT NULL,
        name VARCHAR(100) NOT NULL,
        problem_id VARCHAR(50) NOT NULL,
        problem_title VARCHAR(200) NOT NULL,
        day INT NOT NULL,
        action VARCHAR(20) NOT NULL,
        timestamp TEXT NOT NULL
      );
    `);

    // Ensure startDate is set
    const metaCheck = await pgPool.query("SELECT val FROM challenge_meta WHERE key = 'start_date'");
    if (metaCheck.rows.length === 0) {
      await pgPool.query("INSERT INTO challenge_meta (key, val) VALUES ('start_date', $1)", ['2026-09-20']);
    }

    // Migrate any data from previous challenge_store table if present
    const oldTableCheck = await pgPool.query("SELECT to_regclass('public.challenge_store') as exists");
    if (oldTableCheck.rows[0]?.exists) {
      const oldBlob = await pgPool.query("SELECT data FROM challenge_store WHERE id = 'state'");
      if (oldBlob.rows.length > 0 && oldBlob.rows[0].data?.users) {
        for (const [r, u] of Object.entries(oldBlob.rows[0].data.users)) {
          await pgPool.query(`
            INSERT INTO challenge_users (roll_no, name, joined_at, last_active, solved)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (roll_no) DO UPDATE SET 
              name = EXCLUDED.name,
              last_active = EXCLUDED.last_active,
              solved = EXCLUDED.solved
          `, [r, u.name, u.joinedAt || new Date().toISOString(), u.lastActive || new Date().toISOString(), JSON.stringify(u.solved || {})]);
        }
      }
    }

    isPostgresReady = true;
    console.log('PostgreSQL initialized with atomic user rows. Concurrency protected.');
  } catch (err) {
    console.error('PostgreSQL table setup error, using file fallback:', err.message);
    isPostgresReady = false;
  }
}

// Local File DB Helper (fallback when DATABASE_URL is not set)
function readLocalDB() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const initial = { startDate: '2026-09-20', users: {}, activity: [] };
      fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf8');
      return initial;
    }
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {
    return { startDate: '2026-09-20', users: {}, activity: [] };
  }
}

function writeLocalDB(data) {
  try {
    const tmp = `${DB_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, DB_FILE);
  } catch (e) {
    console.error('Local file write error:', e);
  }
}

// API Routes (Fully Async for Serverless & Postgres Concurrency)

// 1. Config / Challenge Status
app.get('/api/config', async (req, res) => {
  try {
    let startDate = '2026-09-20';
    if (isPostgresReady) {
      const row = await pgPool.query("SELECT val FROM challenge_meta WHERE key = 'start_date'");
      if (row.rows.length > 0) startDate = row.rows[0].val;
    } else {
      startDate = readLocalDB().startDate || '2026-09-20';
    }

    const unlockedDay = calculateUnlockedDay(startDate);
    res.json({
      success: true,
      startDate,
      serverToday: getLocalDateString(),
      currentUnlockedDay: unlockedDay,
      totalDays: 5,
      questionsPerDay: 10,
      storageType: isPostgresReady ? 'postgresql' : 'local_file'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Get questions with solve counts and unlock status
app.get('/api/problems', async (req, res) => {
  try {
    let startDate = '2026-09-20';
    const solveCounts = {};

    if (isPostgresReady) {
      const metaRow = await pgPool.query("SELECT val FROM challenge_meta WHERE key = 'start_date'");
      if (metaRow.rows.length > 0) startDate = metaRow.rows[0].val;

      const userRows = await pgPool.query("SELECT solved FROM challenge_users");
      userRows.rows.forEach(u => {
        const s = u.solved || {};
        Object.keys(s).forEach(qId => {
          solveCounts[qId] = (solveCounts[qId] || 0) + 1;
        });
      });
    } else {
      const local = readLocalDB();
      startDate = local.startDate || '2026-09-20';
      Object.values(local.users || {}).forEach(u => {
        const s = u.solved || {};
        Object.keys(s).forEach(qId => {
          solveCounts[qId] = (solveCounts[qId] || 0) + 1;
        });
      });
    }

    const unlockedDay = calculateUnlockedDay(startDate);
    const enriched = questions.map(q => ({
      ...q,
      isUnlocked: q.day <= unlockedDay,
      totalSolvedCount: solveCounts[q.id] || 0
    }));

    res.json({
      success: true,
      startDate,
      currentUnlockedDay: unlockedDay,
      totalQuestions: questions.length,
      questions: enriched
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Auth Login / Register (Per-User Atomic Upsert)
app.post('/api/auth/login', async (req, res) => {
  let { name, rollNo } = req.body;

  if (!rollNo || !isValidRollNo(rollNo)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid roll number. Must match format 25MA60XX (for example 25ma60r09).'
    });
  }

  if (!name || !isValidName(name)) {
    return res.status(400).json({
      success: false,
      message: 'Name must be at least 4 characters long.'
    });
  }

  const cleanRoll = rollNo.trim().toLowerCase();
  const cleanName = name.trim();
  const now = new Date().toISOString();

  try {
    if (isPostgresReady) {
      // Atomic upsert in PostgreSQL: updates ONLY this user without ever touching others
      const result = await pgPool.query(`
        INSERT INTO challenge_users (roll_no, name, joined_at, last_active, solved)
        VALUES ($1, $2, $3, $3, '{}')
        ON CONFLICT (roll_no) DO UPDATE SET 
          name = EXCLUDED.name,
          last_active = EXCLUDED.last_active
        RETURNING roll_no, name, joined_at, last_active, solved;
      `, [cleanRoll, cleanName, now]);

      const u = result.rows[0];
      return res.json({
        success: true,
        message: `Welcome, ${u.name}.`,
        user: {
          rollNo: u.roll_no,
          name: u.name,
          joinedAt: u.joined_at,
          lastActive: u.last_active,
          solved: u.solved || {}
        }
      });
    } else {
      const local = readLocalDB();
      if (!local.users) local.users = {};

      if (!local.users[cleanRoll]) {
        local.users[cleanRoll] = {
          rollNo: cleanRoll,
          name: cleanName,
          joinedAt: now,
          lastActive: now,
          solved: {}
        };
      } else {
        local.users[cleanRoll].lastActive = now;
        local.users[cleanRoll].name = cleanName;
      }

      writeLocalDB(local);
      return res.json({
        success: true,
        message: `Welcome, ${local.users[cleanRoll].name}.`,
        user: local.users[cleanRoll]
      });
    }
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Database error during sign in.' });
  }
});

// 4. Toggle problem solved status (Atomic per user)
app.post('/api/progress/toggle', async (req, res) => {
  const { rollNo, problemId } = req.body;

  if (!rollNo || !isValidRollNo(rollNo)) {
    return res.status(400).json({ success: false, message: 'Invalid roll number format.' });
  }

  const cleanRoll = rollNo.trim().toLowerCase();
  const problem = questions.find(q => q.id === problemId);
  if (!problem) {
    return res.status(404).json({ success: false, message: 'Problem not found.' });
  }

  const now = new Date().toISOString();

  try {
    if (isPostgresReady) {
      // Check unlock status
      const metaRow = await pgPool.query("SELECT val FROM challenge_meta WHERE key = 'start_date'");
      const startDate = metaRow.rows[0]?.val || '2026-09-20';
      const unlockedDay = calculateUnlockedDay(startDate);

      if (problem.day > unlockedDay) {
        return res.status(403).json({
          success: false,
          message: `Day ${problem.day} is currently locked. It will unlock on schedule.`
        });
      }

      // Fetch current user row
      const userRes = await pgPool.query("SELECT * FROM challenge_users WHERE roll_no = $1", [cleanRoll]);
      if (userRes.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'User not found. Please sign in first.' });
      }

      const u = userRes.rows[0];
      const solvedMap = u.solved || {};
      let isSolved = false;

      if (solvedMap[problemId]) {
        delete solvedMap[problemId];
        isSolved = false;
      } else {
        solvedMap[problemId] = now;
        isSolved = true;
      }

      // Save updated solved map atomically for this user
      await pgPool.query(
        "UPDATE challenge_users SET solved = $1, last_active = $2 WHERE roll_no = $3",
        [JSON.stringify(solvedMap), now, cleanRoll]
      );

      // Record activity
      const actId = 'act_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
      await pgPool.query(`
        INSERT INTO challenge_activity (id, roll_no, name, problem_id, problem_title, day, action, timestamp)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [actId, cleanRoll, u.name, problem.id, problem.title, problem.day, isSolved ? 'solved' : 'unsolved', now]);

      return res.json({
        success: true,
        isSolved,
        problemId,
        solvedCount: Object.keys(solvedMap).length,
        user: {
          rollNo: u.roll_no,
          name: u.name,
          joinedAt: u.joined_at,
          lastActive: now,
          solved: solvedMap
        }
      });
    } else {
      const local = readLocalDB();
      const unlockedDay = calculateUnlockedDay(local.startDate);

      if (problem.day > unlockedDay) {
        return res.status(403).json({
          success: false,
          message: `Day ${problem.day} is currently locked.`
        });
      }

      if (!local.users || !local.users[cleanRoll]) {
        return res.status(404).json({ success: false, message: 'User not found. Please sign in first.' });
      }

      const user = local.users[cleanRoll];
      user.lastActive = now;
      if (!user.solved) user.solved = {};

      let isSolved = false;
      if (user.solved[problemId]) {
        delete user.solved[problemId];
        isSolved = false;
      } else {
        user.solved[problemId] = now;
        isSolved = true;
      }

      const activityEntry = {
        id: 'act_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        rollNo: user.rollNo,
        name: user.name,
        problemId: problem.id,
        problemTitle: problem.title,
        day: problem.day,
        action: isSolved ? 'solved' : 'unsolved',
        timestamp: now
      };

      local.activity = [activityEntry, ...(local.activity || [])].slice(0, 50);
      writeLocalDB(local);

      return res.json({
        success: true,
        isSolved,
        problemId,
        solvedCount: Object.keys(user.solved).length,
        user
      });
    }
  } catch (err) {
    console.error('Toggle progress error:', err);
    res.status(500).json({ success: false, message: 'Failed to update problem status.' });
  }
});

// 5. Leaderboard (Always reads live state)
app.get('/api/leaderboard', async (req, res) => {
  try {
    let usersList = [];
    let startDate = '2026-09-20';

    if (isPostgresReady) {
      const metaRow = await pgPool.query("SELECT val FROM challenge_meta WHERE key = 'start_date'");
      if (metaRow.rows.length > 0) startDate = metaRow.rows[0].val;

      const userRows = await pgPool.query("SELECT roll_no, name, joined_at, last_active, solved FROM challenge_users");
      usersList = userRows.rows.map(r => ({
        rollNo: r.roll_no,
        name: r.name,
        joinedAt: r.joined_at,
        lastActive: r.last_active,
        solved: r.solved || {}
      }));
    } else {
      const local = readLocalDB();
      startDate = local.startDate || '2026-09-20';
      usersList = Object.values(local.users || {});
    }

    const leaderboard = usersList.map(u => {
      const solvedMap = u.solved || {};
      const solvedIds = Object.keys(solvedMap);
      const totalSolved = solvedIds.length;

      const dayStats = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      let latestSolveTime = 0;

      for (const qId of solvedIds) {
        const q = questions.find(item => item.id === qId);
        if (q && dayStats[q.day] !== undefined) {
          dayStats[q.day]++;
        }
        const solveTime = new Date(solvedMap[qId]).getTime();
        if (solveTime > latestSolveTime) {
          latestSolveTime = solveTime;
        }
      }

      return {
        rollNo: u.rollNo,
        name: u.name,
        totalSolved,
        percentage: Math.round((totalSolved / (questions.length || 50)) * 100),
        dayStats,
        lastActive: u.lastActive,
        latestSolveTime,
        joinedAt: u.joinedAt
      };
    });

    leaderboard.sort((a, b) => {
      if (b.totalSolved !== a.totalSolved) {
        return b.totalSolved - a.totalSolved;
      }
      if (a.totalSolved > 0 && b.totalSolved > 0 && a.latestSolveTime !== b.latestSolveTime) {
        return a.latestSolveTime - b.latestSolveTime;
      }
      return a.rollNo.localeCompare(b.rollNo);
    });

    leaderboard.forEach((item, index) => {
      item.rank = index + 1;
    });

    res.json({
      success: true,
      leaderboard,
      totalParticipants: leaderboard.length,
      totalQuestions: questions.length,
      currentUnlockedDay: calculateUnlockedDay(startDate)
    });
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. User Profile details
app.get('/api/users/:rollNo', async (req, res) => {
  const cleanRoll = req.params.rollNo.trim().toLowerCase();

  try {
    if (isPostgresReady) {
      const userRes = await pgPool.query("SELECT * FROM challenge_users WHERE roll_no = $1", [cleanRoll]);
      if (userRes.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'User not found.' });
      }
      const u = userRes.rows[0];
      const solvedIds = Object.keys(u.solved || {});
      return res.json({
        success: true,
        user: {
          rollNo: u.roll_no,
          name: u.name,
          joinedAt: u.joined_at,
          lastActive: u.last_active,
          totalSolved: solvedIds.length,
          solvedIds,
          solvedDetails: u.solved || {}
        }
      });
    } else {
      const local = readLocalDB();
      const user = (local.users || {})[cleanRoll];
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found.' });
      }
      const solvedIds = Object.keys(user.solved || {});
      return res.json({
        success: true,
        user: {
          rollNo: user.rollNo,
          name: user.name,
          joinedAt: user.joinedAt,
          lastActive: user.lastActive,
          totalSolved: solvedIds.length,
          solvedIds,
          solvedDetails: user.solved || {}
        }
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Recent Activity Feed
app.get('/api/activity', async (req, res) => {
  try {
    if (isPostgresReady) {
      const rows = await pgPool.query("SELECT * FROM challenge_activity ORDER BY timestamp DESC LIMIT 25");
      const activity = rows.rows.map(r => ({
        id: r.id,
        rollNo: r.roll_no,
        name: r.name,
        problemId: r.problem_id,
        problemTitle: r.problem_title,
        day: r.day,
        action: r.action,
        timestamp: r.timestamp
      }));
      return res.json({ success: true, activity });
    } else {
      const local = readLocalDB();
      return res.json({ success: true, activity: (local.activity || []).slice(0, 25) });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. Overall stats
app.get('/api/stats', async (req, res) => {
  try {
    let totalUsers = 0;
    let totalSolves = 0;
    let startDate = '2026-09-20';

    if (isPostgresReady) {
      const metaRow = await pgPool.query("SELECT val FROM challenge_meta WHERE key = 'start_date'");
      if (metaRow.rows.length > 0) startDate = metaRow.rows[0].val;

      const userRows = await pgPool.query("SELECT solved FROM challenge_users");
      totalUsers = userRows.rows.length;
      userRows.rows.forEach(u => {
        totalSolves += Object.keys(u.solved || {}).length;
      });
    } else {
      const local = readLocalDB();
      startDate = local.startDate || '2026-09-20';
      const users = Object.values(local.users || {});
      totalUsers = users.length;
      users.forEach(u => {
        totalSolves += Object.keys(u.solved || {}).length;
      });
    }

    res.json({
      success: true,
      totalUsers,
      totalSolves,
      totalQuestions: questions.length,
      currentUnlockedDay: calculateUnlockedDay(startDate)
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Catch-all route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`OA Practice Platform running on http://localhost:${PORT}`);
  });
});

module.exports = app;
