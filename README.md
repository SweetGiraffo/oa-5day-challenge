# ⚔️ 5-Day OA Challenge Practice Platform & Live Leaderboard

A full-stack collaborative platform for you and your friends to conquer a 5-day Online Assessment (OA) coding challenge with 50 curated LeetCode problems, persistent progress tracking, and a live competitive ranking leaderboard.

---

## 🌟 Key Features

1. **Custom Login & Verification**:
   - **Roll Number**: Strictly validates format `25ma60r` followed by digits (e.g. `25ma60r09`, `25ma60r29`, `25MA60R102`, case-insensitive).
   - **Name**: Flexible name validation (minimum 4 characters).
   - **Persistence**: Remembers your session locally and stores all progress on the server so everyone can view each other's status.

2. **50 High-Frequency OA Questions Categorized by Day**:
   - **Day 5: Graphs & Shortest Paths** (10 questions — BFS, Dijkstra, Union-Find, Bipartite)
   - **Day 6: Binary Search & Optimization** (10 questions — Minimax, Answer search, Greedy)
   - **Day 7: Dynamic Programming** (10 questions — Multidimensional, Knapsack, Game Theory)
   - **Day 8: Subarrays & Monotonic Stack / Queue** (10 questions — Sliding Window, Monotonic)
   - **Day 9: Grand Finale / OA Boss** (10 questions — Hardest recurring questions in Uber, Google, Amazon, Citadel)
   - Every question has direct clickable links to LeetCode, difficulty tags (Medium/Hard), and algorithm tags.

3. **Live Rank Dashboard & Leaderboard**:
   - **Top 3 Podium**: 1st (Gold 👑/🥇), 2nd (Silver 🥈), 3rd (Bronze 🥉).
   - **Real-Time Standings**: Sorted by total problems solved and fastest completion speed.
   - **Day-by-Day Score Breakdown**: See how many questions each friend completed on each day (e.g., `8/10`).
   - **Friend Inspector**: Click any friend's name to view their checklist and solved timestamps.

4. **Peer Activity Stream & Celebrations**:
   - Real-time activity feed showing when someone completes or unmarks a problem.
   - Canvas confetti celebrations on day completion and challenge finish.
   - Auto-syncs every 8 seconds across all open devices without page refreshes.

---

## 🚀 How to Run Locally

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Server
```bash
npm start
# or
node server.js
```

### 3. Open in Browser
Visit **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 📱 How Your Friends Can Access It

### Option A: On the Same Wi-Fi / College Network (Instant, No Hosting Required)
1. Find your computer's local IP address:
   - On Windows: Run `ipconfig` in PowerShell/Command Prompt (look for `IPv4 Address`, e.g. `192.168.1.15`).
2. Tell your friends on the same Wi-Fi to open:
   ```
   http://<YOUR_IP_ADDRESS>:3000
   # Example: http://192.168.1.15:3000
   ```
3. They can log in with their roll number and start solving immediately!

### Option B: Free Cloud Hosting (Permanent, Runs 24/7)

Your repository is published at: **[https://github.com/SweetGiraffo/oa-5day-challenge](https://github.com/SweetGiraffo/oa-5day-challenge)**

You can deploy it for free with 1 click:

1. **Deploy on Render (Recommended for Node.js + Persistent API)**:
   - Click: **[Deploy to Render](https://render.com/deploy?repo=https://github.com/SweetGiraffo/oa-5day-challenge)**
   - Sign in with GitHub and click **Apply**.
   - Render will build and launch your server at `https://<your-app>.onrender.com`.

2. **Deploy on Vercel**:
   - Click: **[Deploy with Vercel](https://vercel.com/new/clone?repository-url=https://github.com/SweetGiraffo/oa-5day-challenge)**
   - Connect your GitHub account and click **Deploy**.
   - Your site will be live instantly on a `.vercel.app` domain.

3. **Deploy on Railway**:
   - Go to [railway.app](https://railway.app) -> **New Project** -> **Deploy from GitHub repo** -> select `oa-5day-challenge`.

---

## 📂 Project Structure

```
├── server.js              # Express backend, persistent JSON DB, REST APIs
├── package.json           # Dependencies and start script
├── data/
│   ├── questions.json     # All 50 LeetCode problems with links and tags
│   └── challenge_db.json  # Persistent database for users, solves, and activity
└── public/
    ├── index.html         # Responsive modern UI layout
    ├── style.css          # Dark tech theme, podium styles, responsive grid
    └── app.js             # Client logic, live polling, confetti, state
```
