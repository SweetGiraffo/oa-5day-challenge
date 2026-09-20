// OA Challenge Practice Platform - Apple UI Client Logic
// Strictly Zero Emojis, Mixed Topics, No Topic Spoilers, Explicit LeetCode Solve Links

// Application State
let currentUser = null;
let allQuestions = [];
let currentUnlockedDay = 1;
let activeDay = 1;
let activeView = 'questions'; // 'questions', 'leaderboard', 'activity'
let leaderboardData = [];
let startDate = null;
let syncTimer = null;

// Day Metadata (No topic spoilers)
const DAY_METADATA = {
  1: {
    title: 'Day 1',
    desc: '10 mixed Online Assessment practice problems.'
  },
  2: {
    title: 'Day 2',
    desc: '10 mixed Online Assessment practice problems.'
  },
  3: {
    title: 'Day 3',
    desc: '10 mixed Online Assessment practice problems.'
  },
  4: {
    title: 'Day 4',
    desc: '10 mixed Online Assessment practice problems.'
  },
  5: {
    title: 'Day 5',
    desc: '10 mixed Online Assessment practice problems.'
  }
};

// DOM References
const loginModal = document.getElementById('loginModal');
const loginForm = document.getElementById('loginForm');
const inputName = document.getElementById('inputName');
const inputRoll = document.getElementById('inputRoll');
const nameHint = document.getElementById('nameHint');
const rollHint = document.getElementById('rollHint');
const loginAlert = document.getElementById('loginAlert');

const userPill = document.getElementById('userPill');
const loginTriggerBtn = document.getElementById('loginTriggerBtn');
const switchUserBtn = document.getElementById('switchUserBtn');
const userNameText = document.getElementById('userNameText');
const userRollText = document.getElementById('userRollText');
const userInitials = document.getElementById('userInitials');
const rankIndicator = document.getElementById('rankIndicator');

const metricChallengers = document.getElementById('metricChallengers');
const metricTotalSolves = document.getElementById('metricTotalSolves');
const metricDayStatus = document.getElementById('metricDayStatus');
const metricPersonalSolves = document.getElementById('metricPersonalSolves');

const dayHeroCard = document.getElementById('dayHeroCard');
const dayHeroTitle = document.getElementById('dayHeroTitle');
const dayHeroDesc = document.getElementById('dayHeroDesc');
const dayStatusPill = document.getElementById('dayStatusPill');
const dayProgressBar = document.getElementById('dayProgressBar');
const dayProgressCount = document.getElementById('dayProgressCount');
const dayProgressPercent = document.getElementById('dayProgressPercent');

const problemCardsGrid = document.getElementById('problemCardsGrid');
const lockedDayNotice = document.getElementById('lockedDayNotice');
const lockedTitleText = document.getElementById('lockedTitleText');
const lockedDescText = document.getElementById('lockedDescText');

const viewQuestions = document.getElementById('viewQuestions');
const viewLeaderboard = document.getElementById('viewLeaderboard');
const viewActivity = document.getElementById('viewActivity');

const podiumGrid = document.getElementById('podiumGrid');
const leaderboardTbody = document.getElementById('leaderboardTbody');
const activityTimeline = document.getElementById('activityTimeline');

const friendModal = document.getElementById('friendModal');
const closeFriendModalBtn = document.getElementById('closeFriendModalBtn');
const friendModalInitials = document.getElementById('friendModalInitials');
const friendModalName = document.getElementById('friendModalName');
const friendModalRoll = document.getElementById('friendModalRoll');
const friendModalStats = document.getElementById('friendModalStats');
const friendModalSolvedList = document.getElementById('friendModalSolvedList');

// Roll Number Format Validation
const ROLL_REGEX = /^25ma60r\d+$/i;

// Boot Application
document.addEventListener('DOMContentLoaded', async () => {
  restoreSession();
  bindEvents();
  await loadConfig();
  await loadProblems();
  await loadLeaderboard();
  await loadActivity();
  await loadStats();

  if (!currentUser) {
    displayLoginModal();
  }

  // Silent sync loop every 8 seconds
  syncTimer = setInterval(async () => {
    await performSilentSync();
  }, 8000);
});

// Session Management
function restoreSession() {
  const stored = localStorage.getItem('oa_user');
  if (stored) {
    try {
      currentUser = JSON.parse(stored);
      refreshUserNav();
    } catch (err) {
      currentUser = null;
    }
  }
}

function persistSession(user) {
  currentUser = user;
  localStorage.setItem('oa_user', JSON.stringify(user));
  refreshUserNav();
}

function refreshUserNav() {
  if (currentUser) {
    userPill.style.display = 'flex';
    loginTriggerBtn.style.display = 'none';

    userNameText.textContent = currentUser.name;
    userRollText.textContent = currentUser.rollNo.toUpperCase();
    userInitials.textContent = computeInitials(currentUser.name);

    refreshUserMetrics();
  } else {
    userPill.style.display = 'none';
    loginTriggerBtn.style.display = 'inline-flex';
    rankIndicator.textContent = 'Sign In';
    metricPersonalSolves.textContent = '0 / 10';
  }
}

function refreshUserMetrics() {
  if (!currentUser) return;
  const userSolves = currentUser.solved || {};
  const totalCount = Object.keys(userSolves).length;

  metricPersonalSolves.textContent = `${totalCount} / 50`;

  if (leaderboardData && leaderboardData.length > 0) {
    const entry = leaderboardData.find(u => u.rollNo.toLowerCase() === currentUser.rollNo.toLowerCase());
    if (entry) {
      rankIndicator.textContent = `Rank #${entry.rank}`;
    }
  }
}

// Bind Event Listeners
function bindEvents() {
  for (let d = 1; d <= 5; d++) {
    const btn = document.getElementById(`segDay${d}`);
    if (btn) {
      btn.addEventListener('click', () => selectDay(d));
    }
  }

  document.getElementById('segLeaderboard')?.addEventListener('click', () => switchView('leaderboard'));
  document.getElementById('segActivity')?.addEventListener('click', () => switchView('activity'));

  inputRoll.addEventListener('input', () => {
    const val = inputRoll.value.trim();
    if (val && !ROLL_REGEX.test(val)) {
      rollHint.classList.add('error');
      rollHint.textContent = 'Must match format 25MA60XX (e.g. 25ma60r09)';
    } else {
      rollHint.classList.remove('error');
      rollHint.textContent = 'Format: 25MA60XX (e.g. 25ma60r09)';
    }
  });

  inputName.addEventListener('input', () => {
    const val = inputName.value.trim();
    if (val && val.length < 4) {
      nameHint.classList.add('error');
      nameHint.textContent = 'Minimum 4 characters';
    } else {
      nameHint.classList.remove('error');
      nameHint.textContent = 'Minimum 4 characters';
    }
  });

  loginForm.addEventListener('submit', onLoginSubmit);
  loginTriggerBtn.addEventListener('click', displayLoginModal);
  switchUserBtn.addEventListener('click', () => {
    localStorage.removeItem('oa_user');
    currentUser = null;
    refreshUserNav();
    renderDayView();
    displayLoginModal();
  });

  document.getElementById('refreshLeaderboardBtn')?.addEventListener('click', loadLeaderboard);
  document.getElementById('refreshActivityBtn')?.addEventListener('click', loadActivity);

  closeFriendModalBtn.addEventListener('click', () => friendModal.close());
  friendModal.addEventListener('click', (e) => {
    if (e.target === friendModal) friendModal.close();
  });
}

function displayLoginModal() {
  loginAlert.style.display = 'none';
  if (currentUser) {
    inputName.value = currentUser.name;
    inputRoll.value = currentUser.rollNo;
  } else {
    inputName.value = '';
    inputRoll.value = '';
  }
  loginModal.showModal();
}

async function onLoginSubmit(e) {
  e.preventDefault();
  const name = inputName.value.trim();
  const rollNo = inputRoll.value.trim();

  if (!ROLL_REGEX.test(rollNo)) {
    displayLoginError('Invalid roll number format. Example: 25MA60XX (e.g. 25ma60r09).');
    return;
  }

  if (name.length < 4) {
    displayLoginError('Name must be at least 4 characters long.');
    return;
  }

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, rollNo })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      displayLoginError(data.message || 'Authentication error.');
      return;
    }

    persistSession(data.user);
    loginModal.close();
    renderDayView();
    await loadLeaderboard();
    await loadStats();
  } catch (err) {
    console.error(err);
    displayLoginError('Unable to connect to the server.');
  }
}

function displayLoginError(msg) {
  loginAlert.textContent = msg;
  loginAlert.style.display = 'block';
}

function selectDay(dayNumber) {
  activeDay = dayNumber;
  switchView('questions');
  updateSegmentButtons();
  renderDayView();
}

function switchView(viewName) {
  activeView = viewName;

  document.querySelectorAll('.segment-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.view-panel').forEach(panel => panel.classList.remove('active'));

  if (viewName === 'questions') {
    document.getElementById(`segDay${activeDay}`)?.classList.add('active');
    viewQuestions.classList.add('active');
    renderDayView();
  } else if (viewName === 'leaderboard') {
    document.getElementById('segLeaderboard')?.classList.add('active');
    viewLeaderboard.classList.add('active');
    renderLeaderboard();
  } else if (viewName === 'activity') {
    document.getElementById('segActivity')?.classList.add('active');
    viewActivity.classList.add('active');
    loadActivity();
  }
}

function updateSegmentButtons() {
  const userSolves = currentUser?.solved || {};

  for (let d = 1; d <= 5; d++) {
    const btn = document.getElementById(`segDay${d}`);
    const badge = document.getElementById(`badgeDay${d}`);
    if (!btn || !badge) continue;

    const isUnlocked = d <= currentUnlockedDay;

    if (isUnlocked) {
      const dayQuestions = allQuestions.filter(q => q.day === d);
      const solvedInDay = dayQuestions.filter(q => userSolves[q.id]).length;
      badge.textContent = `${solvedInDay}/10`;
      btn.classList.remove('locked');

      const lockIcon = btn.querySelector('.segment-lock-icon');
      if (lockIcon) lockIcon.style.display = 'none';
    } else {
      badge.textContent = 'Locked';
      btn.classList.add('locked');

      const lockIcon = btn.querySelector('.segment-lock-icon');
      if (lockIcon) lockIcon.style.display = 'inline-block';
    }
  }
}

// Render Questions for Selected Day (Mixed topics, no topic names, explicit LeetCode link)
function renderDayView() {
  const isUnlocked = activeDay <= currentUnlockedDay;
  const meta = DAY_METADATA[activeDay] || DAY_METADATA[1];

  dayHeroTitle.textContent = meta.title;
  dayHeroDesc.textContent = meta.desc;

  if (activeDay === currentUnlockedDay) {
    dayStatusPill.textContent = 'Active Today';
    dayStatusPill.style.display = 'inline-block';
  } else if (activeDay < currentUnlockedDay) {
    dayStatusPill.textContent = 'Available (Past)';
    dayStatusPill.style.display = 'inline-block';
  } else {
    dayStatusPill.style.display = 'none';
  }

  if (!isUnlocked) {
    dayHeroCard.style.display = 'none';
    problemCardsGrid.style.display = 'none';
    lockedDayNotice.style.display = 'block';

    const daysUntil = activeDay - currentUnlockedDay;
    lockedTitleText.textContent = `Day ${activeDay} is Locked`;
    lockedDescText.textContent = `This day will unlock in ${daysUntil} day${daysUntil > 1 ? 's' : ''} on schedule. Complete Day ${currentUnlockedDay} problems in the meantime.`;
    return;
  }

  dayHeroCard.style.display = 'flex';
  problemCardsGrid.style.display = 'grid';
  lockedDayNotice.style.display = 'none';

  const dayQuestions = allQuestions.filter(q => q.day === activeDay);
  const userSolves = currentUser?.solved || {};
  const solvedCount = dayQuestions.filter(q => userSolves[q.id]).length;
  const pct = Math.round((solvedCount / 10) * 100);

  dayProgressBar.style.width = `${pct}%`;
  dayProgressCount.textContent = `${solvedCount} of 10 completed`;
  dayProgressPercent.textContent = `${pct}%`;

  problemCardsGrid.innerHTML = dayQuestions.map((q, idx) => {
    const isCompleted = !!userSolves[q.id];
    const diffClass = q.difficulty === 'Hard' ? 'pill-hard' : 'pill-medium';

    return `
      <div class="problem-card ${isCompleted ? 'completed' : ''}" id="card-${q.id}">
        <div class="card-top">
          <label class="apple-checkbox-wrap" title="Mark as solved">
            <input 
              type="checkbox" 
              ${isCompleted ? 'checked' : ''} 
              onchange="onToggleProblem('${q.id}', this)"
            >
            <span class="apple-checkbox-disc">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </span>
          </label>

          <div style="flex: 1;">
            <div style="font-weight: 600; font-size: 0.95rem; margin-bottom: 0.5rem; line-height: 1.35;">
              ${idx + 1}. ${escapeText(q.title)}
            </div>

            <div style="display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
              <a href="${q.url}" target="_blank" rel="noopener noreferrer" class="btn-solve-link">
                <span>Solve on LeetCode</span>
                <svg class="external-arrow" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <line x1="7" y1="17" x2="17" y2="7"></line>
                  <polyline points="7 7 17 7 17 17"></polyline>
                </svg>
              </a>
              <span class="apple-pill ${diffClass}">${q.difficulty}</span>
            </div>
          </div>
        </div>

        <div class="card-foot">
          <span class="challenger-solve-text" id="peer-count-${q.id}">
            Solved by ${q.totalSolvedCount || 0} challenger${q.totalSolvedCount === 1 ? '' : 's'}
          </span>
          <span class="status-label-text ${isCompleted ? 'solved' : ''}">
            ${isCompleted ? 'Completed' : 'Pending'}
          </span>
        </div>
      </div>
    `;
  }).join('');
}

// Problem Toggle
async function onToggleProblem(problemId, checkbox) {
  if (!currentUser) {
    checkbox.checked = !checkbox.checked;
    displayLoginModal();
    return;
  }

  const card = document.getElementById(`card-${problemId}`);

  try {
    const res = await fetch('/api/progress/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rollNo: currentUser.rollNo,
        problemId: problemId
      })
    });

    const data = await res.json();
    if (data.success) {
      currentUser.solved = data.user.solved;
      persistSession(currentUser);

      if (data.isSolved) {
        card?.classList.add('completed');
      } else {
        card?.classList.remove('completed');
      }

      updateSegmentButtons();
      renderDayView();
      await loadProblems();
      await loadLeaderboard();
      await loadStats();
    } else {
      checkbox.checked = !checkbox.checked;
      alert(data.message || 'Error updating status.');
    }
  } catch (err) {
    console.error(err);
    checkbox.checked = !checkbox.checked;
    alert('Unable to sync with server.');
  }
}

// API Data Fetching
async function loadConfig() {
  try {
    const res = await fetch('/api/config');
    const data = await res.json();
    if (data.success) {
      currentUnlockedDay = data.currentUnlockedDay;
      activeDay = currentUnlockedDay;
      startDate = data.startDate;
      metricDayStatus.textContent = `Day ${currentUnlockedDay}`;
      updateSegmentButtons();
    }
  } catch (err) {
    console.error('Config fetch failed:', err);
  }
}

async function loadProblems() {
  try {
    const res = await fetch('/api/problems');
    const data = await res.json();
    if (data.success) {
      allQuestions = data.questions;
      currentUnlockedDay = data.currentUnlockedDay || currentUnlockedDay;
      updateSegmentButtons();
      if (activeView === 'questions') {
        renderDayView();
      }
    }
  } catch (err) {
    console.error('Problems fetch failed:', err);
  }
}

async function loadLeaderboard() {
  try {
    const res = await fetch('/api/leaderboard');
    const data = await res.json();
    if (data.success) {
      leaderboardData = data.leaderboard;
      metricChallengers.textContent = data.totalParticipants || 0;
      renderLeaderboard();
      refreshUserMetrics();
    }
  } catch (err) {
    console.error('Leaderboard fetch failed:', err);
  }
}

async function loadActivity() {
  try {
    const res = await fetch('/api/activity');
    const data = await res.json();
    if (data.success) {
      renderActivity(data.activity);
    }
  } catch (err) {
    console.error('Activity fetch failed:', err);
  }
}

async function loadStats() {
  try {
    const res = await fetch('/api/stats');
    const data = await res.json();
    if (data.success) {
      metricTotalSolves.textContent = data.totalSolves || 0;
    }
  } catch (err) {
    console.error('Stats fetch failed:', err);
  }
}

// Silent Sync
async function performSilentSync() {
  try {
    const [pRes, lRes, aRes, sRes] = await Promise.all([
      fetch('/api/problems'),
      fetch('/api/leaderboard'),
      fetch('/api/activity'),
      fetch('/api/stats')
    ]);

    const pData = await pRes.json();
    const lData = await lRes.json();
    const aData = await aRes.json();
    const sData = await sRes.json();

    if (pData.success) {
      allQuestions = pData.questions;
      currentUnlockedDay = pData.currentUnlockedDay || currentUnlockedDay;
      updateSegmentButtons();
    }

    if (lData.success) {
      leaderboardData = lData.leaderboard;
      metricChallengers.textContent = lData.totalParticipants || 0;
      if (activeView === 'leaderboard') renderLeaderboard();
      refreshUserMetrics();
    }

    if (aData.success && activeView === 'activity') {
      renderActivity(aData.activity);
    }

    if (sData.success) {
      metricTotalSolves.textContent = sData.totalSolves || 0;
    }
  } catch (err) {
    // Graceful silent failure
  }
}

// Leaderboard Rendering (Apple Style)
function renderLeaderboard() {
  if (!leaderboardData || leaderboardData.length === 0) {
    podiumGrid.innerHTML = '';
    leaderboardTbody.innerHTML = `
      <tr>
        <td colspan="11" class="cell-empty">
          No registered challengers yet. Be the first to sign in.
        </td>
      </tr>
    `;
    return;
  }

  // Top 3 Podium
  const top1 = leaderboardData[0];
  const top2 = leaderboardData[1];
  const top3 = leaderboardData[2];

  let podiumHTML = '';
  if (top2) podiumHTML += buildPodiumCard(top2, '2nd Place', 'rank-2-badge');
  if (top1) podiumHTML += buildPodiumCard(top1, '1st Place', 'rank-1-badge');
  if (top3) podiumHTML += buildPodiumCard(top3, '3rd Place', 'rank-3-badge');
  podiumGrid.innerHTML = podiumHTML;

  // Table
  leaderboardTbody.innerHTML = leaderboardData.map(u => {
    const isSelf = currentUser && u.rollNo.toLowerCase() === currentUser.rollNo.toLowerCase();

    return `
      <tr style="${isSelf ? 'background: rgba(0, 113, 227, 0.08); font-weight: 500;' : ''}">
        <td class="cell-rank">#${u.rank}</td>
        <td>
          <div class="cell-user">
            <div class="user-initials" style="width: 24px; height: 24px; font-size: 0.65rem;">
              ${computeInitials(u.name)}
            </div>
            <span>${escapeText(u.name)} ${isSelf ? '<span style="color: var(--apple-blue); font-size: 0.7rem;">(You)</span>' : ''}</span>
          </div>
        </td>
        <td style="font-family: var(--apple-font-mono); font-size: 0.78rem;">${u.rollNo.toUpperCase()}</td>
        <td><span class="day-score-pill ${u.dayStats[1] === 10 ? 'done' : ''}">${u.dayStats[1]}/10</span></td>
        <td><span class="day-score-pill ${u.dayStats[2] === 10 ? 'done' : ''}">${u.dayStats[2]}/10</span></td>
        <td><span class="day-score-pill ${u.dayStats[3] === 10 ? 'done' : ''}">${u.dayStats[3]}/10</span></td>
        <td><span class="day-score-pill ${u.dayStats[4] === 10 ? 'done' : ''}">${u.dayStats[4]}/10</span></td>
        <td><span class="day-score-pill ${u.dayStats[5] === 10 ? 'done' : ''}">${u.dayStats[5]}/10</span></td>
        <td style="font-weight: 600; font-family: var(--apple-font-mono);">${u.totalSolved} / 50</td>
        <td>
          <span style="font-size: 0.75rem; font-family: var(--apple-font-mono); color: var(--apple-text-secondary);">${u.percentage}%</span>
        </td>
        <td>
          <button class="btn-apple-secondary" onclick="viewFriendDetails('${u.rollNo}')">Inspect</button>
        </td>
      </tr>
    `;
  }).join('');
}

function buildPodiumCard(u, label, badgeClass) {
  return `
    <div class="apple-podium-card">
      <div class="podium-rank-label ${badgeClass}">${label}</div>
      <div class="user-initials large">${computeInitials(u.name)}</div>
      <div class="podium-user-name">${escapeText(u.name)}</div>
      <div class="podium-user-roll">${u.rollNo.toUpperCase()}</div>
      <div class="podium-metric-val">${u.totalSolved}</div>
      <div class="podium-metric-sub">Problems Completed</div>
      <div style="margin-top: 1.25rem;">
        <button class="btn-apple-secondary" onclick="viewFriendDetails('${u.rollNo}')">View Details</button>
      </div>
    </div>
  `;
}

// Friend Details Modal
async function viewFriendDetails(rollNo) {
  try {
    const res = await fetch(`/api/users/${rollNo}`);
    const data = await res.json();
    if (!data.success) {
      alert('Could not retrieve user details.');
      return;
    }

    const u = data.user;
    friendModalName.textContent = u.name;
    friendModalRoll.textContent = u.rollNo.toUpperCase();
    friendModalInitials.textContent = computeInitials(u.name);

    const dayStats = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const solvedSet = new Set(u.solvedIds || []);

    allQuestions.forEach(q => {
      if (solvedSet.has(q.id)) {
        dayStats[q.day] = (dayStats[q.day] || 0) + 1;
      }
    });

    friendModalStats.innerHTML = `
      <div class="stat-subcell">
        <div class="stat-subcell-label">Total</div>
        <div class="stat-subcell-val">${u.totalSolved}/50</div>
      </div>
      <div class="stat-subcell">
        <div class="stat-subcell-label">Day 1</div>
        <div class="stat-subcell-val">${dayStats[1]}/10</div>
      </div>
      <div class="stat-subcell">
        <div class="stat-subcell-label">Day 2</div>
        <div class="stat-subcell-val">${dayStats[2]}/10</div>
      </div>
      <div class="stat-subcell">
        <div class="stat-subcell-label">Day 3</div>
        <div class="stat-subcell-val">${dayStats[3]}/10</div>
      </div>
      <div class="stat-subcell">
        <div class="stat-subcell-label">Day 4</div>
        <div class="stat-subcell-val">${dayStats[4]}/10</div>
      </div>
      <div class="stat-subcell">
        <div class="stat-subcell-label">Day 5</div>
        <div class="stat-subcell-val">${dayStats[5]}/10</div>
      </div>
    `;

    if (u.solvedIds.length === 0) {
      friendModalSolvedList.innerHTML = `<div class="cell-empty" style="padding: 1.5rem;">No completed problems yet.</div>`;
    } else {
      friendModalSolvedList.innerHTML = u.solvedIds.map(id => {
        const q = allQuestions.find(item => item.id === id);
        if (!q) return '';
        const timestamp = u.solvedDetails[id] ? timeAgo(u.solvedDetails[id]) : 'Recently';
        return `
          <div class="friend-solved-row">
            <div style="display: flex; align-items: center; gap: 0.6rem;">
              <span class="apple-pill pill-tag">Day ${q.day}</span>
              <a href="${q.url}" target="_blank" rel="noopener noreferrer" class="btn-solve-link">
                <span>${escapeText(q.title)}</span>
                <svg class="external-arrow" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <line x1="7" y1="17" x2="17" y2="7"></line>
                  <polyline points="7 7 17 7 17 17"></polyline>
                </svg>
              </a>
            </div>
            <span style="color: var(--apple-text-secondary); font-size: 0.72rem; font-family: var(--apple-font-mono);">${timestamp}</span>
          </div>
        `;
      }).join('');
    }

    friendModal.showModal();
  } catch (err) {
    console.error(err);
    alert('Unable to load friend details.');
  }
}

// Activity Timeline
function renderActivity(activities) {
  if (!activities || activities.length === 0) {
    activityTimeline.innerHTML = `<div class="cell-empty">No recent activity recorded.</div>`;
    return;
  }

  activityTimeline.innerHTML = activities.map(a => {
    const isSolved = a.action === 'solved';
    return `
      <div class="timeline-entry">
        <div class="timeline-left">
          <div class="timeline-dot ${isSolved ? '' : 'unsolved'}"></div>
          <div class="timeline-desc">
            <strong>${escapeText(a.name)}</strong> (${a.rollNo.toUpperCase()})
            ${isSolved ? 'completed' : 'unmarked'}
            <strong>${escapeText(a.problemTitle)}</strong>
            <span class="apple-pill pill-tag" style="margin-left: 0.35rem;">Day ${a.day}</span>
          </div>
        </div>
        <div class="timeline-stamp">${timeAgo(a.timestamp)}</div>
      </div>
    `;
  }).join('');
}

// Utility Helpers
function computeInitials(name) {
  if (!name) return 'OA';
  return name
    .split(' ')
    .filter(Boolean)
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'OA';
}

function escapeText(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

function timeAgo(isoString) {
  if (!isoString) return '';
  const now = new Date();
  const date = new Date(isoString);
  const diffSec = Math.floor((now - date) / 1000);

  if (diffSec < 60) return 'just now';
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
