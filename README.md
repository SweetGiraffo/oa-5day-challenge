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

### Option B: Free Cloud Hosting with Permanent Data Storage

On Render's free tier, the file system is **ephemeral** (Render wipes the local disk whenever the app sleeps or relaunches). To make sure all challenger logins, scores, and timestamps are **permanently saved across all restarts**, the server automatically connects to **PostgreSQL** whenever `DATABASE_URL` is set.

#### Quick 2-Minute Setup for Permanent Storage on Render:

1. **Create a Free PostgreSQL Database on Render**:
   - In your [Render Dashboard](https://dashboard.render.com), click **New +** -> **PostgreSQL**.
   - Give it any name (e.g. `oa-db`) and choose the **Free** instance type.
   - Click **Create Database**.

2. **Connect it to your Web Service**:
   - On the database page, copy the **Internal Database URL** (e.g. `postgres://oachallenge:...@dpg-...-a/oachallenge`).
   - Go to your Web Service in Render -> click the **Environment** tab.
   - Click **Add Environment Variable**:
     - Key: `DATABASE_URL`
     - Value: *(paste the copied internal database URL)*
   - Click **Save Changes**.

Render will automatically redeploy. Your platform now has permanent, ACID-compliant cloud storage that **never forgets any data** when it sleeps, wakes up, or relaunches!

*(Alternative: You can also use a free serverless database from [Neon.tech](https://neon.tech) or [Supabase.com](https://supabase.com) by pasting its connection string into `DATABASE_URL`).*

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
