# 🚀 Deployment Guide — Finance Assistant

> **Architecture:** 3 services → each deployed separately on free hosting
>
> | Service | Technology | Deploy To |
> |---------|-----------|-----------|
> | **Frontend** | React + Vite | [Vercel](https://vercel.com) (Free) |
> | **Backend** | Node.js + Express | [Render](https://render.com) (Free) |
> | **ML Service** | Python + Flask | [Render](https://render.com) (Free) |
> | **Database** | MongoDB | [MongoDB Atlas](https://cloud.mongodb.com) (Free) |

---

## ⚠️ Before You Start — Prerequisites

1. Create free accounts on:
   - [GitHub](https://github.com) — to push your code
   - [Vercel](https://vercel.com) — for frontend
   - [Render](https://render.com) — for backend + ML service
   - [MongoDB Atlas](https://cloud.mongodb.com) — for database

2. Your code must be in a **GitHub repository** (public or private)

---

## STEP 1 — Push Code to GitHub

Open PowerShell in your project folder and run:

```powershell
cd c:\Users\LENOVO\Downloads\jain\finance-assistant

# Initialize git (if not already done)
git init

# Create a .gitignore file (important!)
# node_modules, venv, .env files must NOT be committed

git add .
git commit -m "Initial commit - Finance Assistant"

# Create a new repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/finance-assistant.git
git push -u origin main
```

### 📄 Create `.gitignore` in the root:
```
node_modules/
client/node_modules/
server/node_modules/
ml-service/venv/
.env
*.env
__pycache__/
*.pyc
dist/
.DS_Store
```

---

## STEP 2 — Set Up MongoDB Atlas (Cloud Database)

1. Go to [cloud.mongodb.com](https://cloud.mongodb.com) → **Create Account**
2. Create a **Free Cluster** (M0 Sandbox — always free)
3. Click **Connect** → **Connect your application**
4. Copy the connection string (looks like):
   ```
   mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/finance_assistant?retryWrites=true&w=majority
   ```
5. Under **Network Access** → **Add IP Address** → **Allow Access from Anywhere** (`0.0.0.0/0`)
6. **Save this connection string** — you'll need it in Step 4

---

## STEP 3 — Deploy ML Service (Python Flask) to Render

### A. Create `Procfile` in `ml-service/` folder:
```
web: gunicorn app:app --bind 0.0.0.0:$PORT --workers 2
```
*(gunicorn is already in requirements.txt ✅)*

### B. Add `yfinance` and `certifi` to requirements.txt:
Open `ml-service/requirements.txt` and make sure it contains:
```
flask==3.0.3
flask-cors==4.0.1
numpy==2.1.2
pandas==2.2.3
scikit-learn==1.5.2
anthropic==0.29.0
python-dotenv==1.0.1
gunicorn==23.0.0
yfinance
certifi
```

### C. On Render:
1. Go to [render.com](https://render.com) → **New** → **Web Service**
2. Connect your **GitHub repo**
3. Settings:
   | Setting | Value |
   |---------|-------|
   | **Root Directory** | `ml-service` |
   | **Runtime** | `Python 3` |
   | **Build Command** | `pip install -r requirements.txt` |
   | **Start Command** | `gunicorn app:app --bind 0.0.0.0:$PORT --workers 2` |
   | **Plan** | Free |

4. Add **Environment Variables**:
   | Key | Value |
   |-----|-------|
   | `ANTHROPIC_API_KEY` | Your Anthropic API key (or leave blank for mock mode) |
   | `PORT` | `10000` |

5. Click **Deploy** → Wait ~3-5 minutes
6. **Copy the URL** (e.g. `https://finance-ml-service.onrender.com`) — needed in Step 4

---

## STEP 4 — Deploy Node.js Backend to Render

### A. On Render:
1. Go to [render.com](https://render.com) → **New** → **Web Service**
2. Connect your **GitHub repo**
3. Settings:
   | Setting | Value |
   |---------|-------|
   | **Root Directory** | `server` |
   | **Runtime** | `Node` |
   | **Build Command** | `npm install` |
   | **Start Command** | `npm start` |
   | **Plan** | Free |

4. Add **Environment Variables**:
   | Key | Value |
   |-----|-------|
   | `MONGO_URI` | Your MongoDB Atlas connection string from Step 2 |
   | `JWT_SECRET` | Any long random string (e.g. `mySuper$ecretKey_2026_Finance`) |
   | `ML_SERVICE_URL` | URL from Step 3 (e.g. `https://finance-ml-service.onrender.com`) |
   | `PORT` | `10000` |

5. Click **Deploy** → Wait ~2-3 minutes
6. **Copy the URL** (e.g. `https://finance-backend.onrender.com`) — needed in Step 5

---

## STEP 5 — Update Frontend API URL

Open `client/src/services/api.js` and change:
```js
// OLD (local):
baseURL: 'http://localhost:5000/api',

// NEW (production):
baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
```

Create `client/.env.production`:
```
VITE_API_URL=https://finance-backend.onrender.com/api
```

Create `client/.env.development` (keeps local dev working):
```
VITE_API_URL=http://localhost:5000/api
```

---

## STEP 6 — Deploy Frontend to Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import your **GitHub repo**
3. Settings:
   | Setting | Value |
   |---------|-------|
   | **Root Directory** | `client` |
   | **Framework Preset** | `Vite` |
   | **Build Command** | `npm run build` |
   | **Output Directory** | `dist` |

4. Add **Environment Variable** on Vercel:
   | Key | Value |
   |-----|-------|
   | `VITE_API_URL` | `https://finance-backend.onrender.com/api` |

5. Click **Deploy** → Done in ~1-2 minutes!
6. Your app is live at: `https://finance-assistant-xxx.vercel.app` 🎉

---

## STEP 7 — Fix CORS (Allow Vercel URL in Backend)

Update `server/server.js` to allow your Vercel domain:

```js
// Replace the current cors() with:
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://finance-assistant-xxx.vercel.app',  // ← your Vercel URL
    /\.vercel\.app$/  // allows all Vercel preview URLs
  ],
  credentials: true
}));
```

Commit and push → Render will auto-redeploy.

---

## 🔄 Auto-Redeploy (Free Feature!)

Both Vercel and Render automatically redeploy whenever you push to GitHub:
```powershell
git add .
git commit -m "Fix: goals page API response"
git push
# → Vercel + Render both auto-deploy within 2-3 minutes
```

---

## ⚠️ Free Tier Limitations

| Platform | Limitation |
|----------|-----------|
| **Render (Free)** | Service **sleeps after 15 mins** of inactivity. First request after sleep takes ~30 seconds to wake up |
| **MongoDB Atlas (Free)** | 512MB storage limit (plenty for development) |
| **Vercel (Free)** | 100GB bandwidth/month — more than enough |

### Fix Render Sleep Issue (optional):
Use a free service like [UptimeRobot](https://uptimerobot.com) to ping your Render URL every 10 minutes to keep it awake.

---

## ✅ Final Checklist

- [ ] Code pushed to GitHub
- [ ] `.gitignore` has `node_modules/`, `venv/`, `.env`
- [ ] MongoDB Atlas cluster created + connection string copied
- [ ] ML Service deployed on Render
- [ ] Backend deployed on Render + env variables set
- [ ] `api.js` updated to use `VITE_API_URL`
- [ ] Frontend deployed on Vercel + `VITE_API_URL` env var set
- [ ] CORS updated with Vercel URL
- [ ] Test login + dashboard on live URL 🎉

---

## 🌐 Your Live URLs (fill in after deployment)

| Service | URL |
|---------|-----|
| **Frontend (App)** | `https://_______.vercel.app` |
| **Backend API** | `https://_______.onrender.com` |
| **ML Service** | `https://_______.onrender.com` |
