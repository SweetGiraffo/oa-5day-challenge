const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

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

// Helper to read DB
function readDB() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const initial = {
        startDate: getLocalDateString(),
        users: {},
        activity: []
      };
      fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf8');
      return initial;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed.startDate) {
      parsed.startDate = getLocalDateString();
      writeDB(parsed);
    }
    return parsed;
  } catch (err) {
    console.error('Error reading DB:', err);
    return { startDate: getLocalDateString(), users: {}, activity: [] };
  }
}

// Helper to write DB atomically
function writeDB(data) {
  try {
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.error('Error writing DB:', err);
  }
}

// Validate Roll Number
// Format: 25ma60r followed by numbers e.g. 25ma60r09, 25ma60r29
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

// API Routes

// 1. Config / Challenge Status
app.get('/api/config', (req, res) => {
  const db = readDB();
  const unlockedDay = calculateUnlockedDay(db.startDate);
  res.json({
    success: true,
    startDate: db.startDate,
    serverToday: getLocalDateString(),
    currentUnlockedDay: unlockedDay,
    totalDays: 5,
    questionsPerDay: 10
  });
});

// 2. Get questions with solve counts and unlock status
app.get('/api/problems', (req, res) => {
  const db = readDB();
  const unlockedDay = calculateUnlockedDay(db.startDate);

  // Count how many users solved each problem
  const solveCounts = {};
  for (const user of Object.values(db.users)) {
    if (user.solved) {
      for (const qId of Object.keys(user.solved)) {
        solveCounts[qId] = (solveCounts[qId] || 0) + 1;
      }
    }
  }

  const enrichedQuestions = questions.map(q => ({
    ...q,
    isUnlocked: q.day <= unlockedDay,
    totalSolvedCount: solveCounts[q.id] || 0
  }));

  res.json({
    success: true,
    startDate: db.startDate,
    currentUnlockedDay: unlockedDay,
    totalQuestions: questions.length,
    questions: enrichedQuestions
  });
});

// 3. Auth Login / Register
app.post('/api/auth/login', (req, res) => {
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

  const db = readDB();
  const now = new Date().toISOString();

  if (!db.users[cleanRoll]) {
    db.users[cleanRoll] = {
      rollNo: cleanRoll,
      name: cleanName,
      joinedAt: now,
      lastActive: now,
      solved: {}
    };
  } else {
    db.users[cleanRoll].lastActive = now;
    if (cleanName && cleanName.length >= 4) {
      db.users[cleanRoll].name = cleanName;
    }
  }

  writeDB(db);

  res.json({
    success: true,
    message: `Welcome, ${db.users[cleanRoll].name}.`,
    user: db.users[cleanRoll]
  });
});

// 4. Toggle problem solved status
app.post('/api/progress/toggle', (req, res) => {
  const { rollNo, problemId } = req.body;

  if (!rollNo || !isValidRollNo(rollNo)) {
    return res.status(400).json({ success: false, message: 'Invalid roll number format.' });
  }

  const cleanRoll = rollNo.trim().toLowerCase();
  const db = readDB();

  if (!db.users[cleanRoll]) {
    return res.status(404).json({ success: false, message: 'User not found. Please log in first.' });
  }

  const problem = questions.find(q => q.id === problemId);
  if (!problem) {
    return res.status(404).json({ success: false, message: 'Problem not found.' });
  }

  // Check if problem is unlocked
  const unlockedDay = calculateUnlockedDay(db.startDate);
  if (problem.day > unlockedDay) {
    return res.status(403).json({
      success: false,
      message: `Day ${problem.day} is currently locked. It will unlock on schedule.`
    });
  }

  const user = db.users[cleanRoll];
  const now = new Date().toISOString();
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

  db.activity = [activityEntry, ...(db.activity || [])].slice(0, 50);

  writeDB(db);

  res.json({
    success: true,
    isSolved,
    problemId,
    solvedCount: Object.keys(user.solved).length,
    user: user
  });
});

// 5. Leaderboard
app.get('/api/leaderboard', (req, res) => {
  const db = readDB();
  const usersList = Object.values(db.users);

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
    currentUnlockedDay: calculateUnlockedDay(db.startDate)
  });
});

// 6. User Profile details
app.get('/api/users/:rollNo', (req, res) => {
  const cleanRoll = req.params.rollNo.trim().toLowerCase();
  const db = readDB();
  const user = db.users[cleanRoll];

  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }

  const solvedIds = Object.keys(user.solved || {});
  res.json({
    success: true,
    user: {
      rollNo: user.rollNo,
      name: user.name,
      joinedAt: user.joinedAt,
      lastActive: user.lastActive,
      totalSolved: solvedIds.length,
      solvedIds: solvedIds,
      solvedDetails: user.solved || {}
    }
  });
});

// 7. Recent Activity Feed
app.get('/api/activity', (req, res) => {
  const db = readDB();
  res.json({
    success: true,
    activity: (db.activity || []).slice(0, 25)
  });
});

// 8. Overall stats
app.get('/api/stats', (req, res) => {
  const db = readDB();
  const users = Object.values(db.users);
  let totalSolves = 0;

  users.forEach(u => {
    totalSolves += Object.keys(u.solved || {}).length;
  });

  res.json({
    success: true,
    totalUsers: users.length,
    totalSolves,
    totalQuestions: questions.length,
    currentUnlockedDay: calculateUnlockedDay(db.startDate)
  });
});

// Reset initial DB if needed
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`OA Practice Platform running on http://localhost:${PORT}`);
});
