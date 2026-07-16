# AI-Powered Personal Finance Assistant (WealthAI)

WealthAI is a full-stack, AI-powered personal finance assistant designed as a final year capstone project. It enables users to log income and expenses, visualize financial patterns, predict future spending trends using linear regression models, screen transaction sizes for anomalies using isolation forests, and receive contextual personal financial advisory via an integrated Claude-powered chatbot.

---

## Folder Structure

```
finance-assistant/
├── client/          # React frontend (Vite + Tailwind CSS + Material UI + Recharts)
├── server/          # Backend server (Node.js + Express + MongoDB Mongoose)
├── ml-service/      # AI/ML service (Python Flask + scikit-learn + Anthropic SDK)
└── README.md        # Setup & execution instructions
```

---

## Tech Stack & Libraries

### 1. Frontend (`client/`)
* **Framework**: React (Vite scaffolding)
* **Styling**: Tailwind CSS (for modern layouts, dark mode, glassmorphism) + Material UI (for rich interactive inputs, dialogs, date pickers, icons)
* **Charts**: Recharts (Donut PieChart, Area trend charts)
* **API Client**: Axios (configured with authorization interceptors)

### 2. Backend (`server/`)
* **Runtime**: Node.js & Express
* **Database**: MongoDB (Object data modeling via Mongoose)
* **Auth**: JSON Web Tokens (JWT) & bcryptjs password hashing

### 3. ML Service (`ml-service/`)
* **Framework**: Python Flask
* **ML Algorithms**:
  * **Expense Prediction**: `LinearRegression` modeling chronological category trends.
  * **Anomaly Detection**: `IsolationForest` flagging suspicious transaction sizes (with statistical Z-score fallback for limited datasets).
  * **Auto-Categorization**: TF-IDF Vectorizer + Multinomial Naive Bayes (`MultinomialNB`) text classifier.
* **Chatbot**: Anthropic Claude SDK with a smart rule-based mock advisor fallback.

---

## Setup & Configuration

### Prerequisites
* **Node.js** (v18+)
* **MongoDB** (Local Community Server running on port 27017 or a MongoDB Atlas cloud URI)
* **Python** (v3.9 - v3.13)

---

### Step 1: Backend Database & Server Setup

1. Navigate to the server folder:
   ```bash
   cd server
   ```
2. Install npm packages:
   ```bash
   npm install
   ```
3. Create a `.env` file from the example:
   ```bash
   cp .env.example .env
   ```
4. Edit the `.env` file:
   * Define your `MONGO_URI` (either your local mongodb string or Atlas connection string).
   * Specify a secret string for `JWT_SECRET`.
5. Run the backend development server:
   ```bash
   npm run dev
   ```
   *The server runs on `http://localhost:5000`.*

---

### Step 2: React Frontend Setup

1. Navigate to the client folder:
   ```bash
   cd ../client
   ```
2. Install packages:
   ```bash
   npm install
   ```
3. Run the Vite React development server:
   ```bash
   npm run dev
   ```
   *The client will open on `http://localhost:5173`.*

---

### Step 3: ML/AI Flask Service Setup

1. Navigate to the ML folder:
   ```bash
   cd ../ml-service
   ```
2. Create and activate a Python virtual environment:
   * **Windows (PowerShell)**:
     ```powershell
     python -m venv venv
     .\venv\Scripts\Activate.ps1
     ```
   * **macOS/Linux**:
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     ```
3. Install Python requirements:
   ```bash
   pip install -r requirements.txt
   ```
4. Create a `.env` file from the example:
   ```bash
   cp .env.example .env
   ```
5. Edit the `.env` file:
   * Provide your `ANTHROPIC_API_KEY` (Claude API).
   * *Note: If `ANTHROPIC_API_KEY` is left blank, the server automatically boots in **Mock Advisor Mode** allowing you to test full contextual chats, afford-assessments, and overspending analysis completely offline for free!*
6. Start the Flask ML server:
   ```bash
   python app.py
   ```
   *The Flask service runs on `http://localhost:5001`.*

---

## Verifying the Services (Testing)

We have implemented complete automated test suites in both Node and Python to verify the installation:

### Test Backend APIs & Database math:
Run this inside the `server/` directory:
```bash
node test-flow.js
```
*This starts the server, registers a user, performs complete CRUD transactions, verifies the calculations on analytics, tests predictions forwarding, tests chatbot routing, and cleans up.*

### Test Savings Goals, Projections & Subscriptions:
Run this inside the `server/` directory:
```bash
node test-goals-recurring.js
```
*This verifies the Goal Mongoose schema, calculates user monthly savings rates dynamically, and runs chronological billing checks.*

### Test Bank SMS Transaction Parser:
Run this inside the `server/` directory:
```bash
node test-sms-parser.js
```
*This tests text message parsing logic against Netflix card debits, UPI transactions, and Salary credits, running categorization checks and saving to the DB.*

### Test Bank Statement Import Wizard:
Run this inside the `server/` directory:
```bash
node test-csv-import.js
```
*This validates drag-and-drop/copy-paste bank statement parsing and ML preview classification.*

### Test Agentic Chatbot NL Actions:
Run this inside the `server/` directory:
```bash
node test-agentic-chatbot.js
```
*This asserts backend chatbot payload intercepts for writing transactions, budgets, and goals to MongoDB.*

### Test Monte Carlo Projections:
Run this inside the `server/` directory:
```bash
node test-projections.js
```
*This runs simulated random walks verifying default valuations, percentile bands, and risk strategy spread variances.*

### Test ML Models & Flask endpoints:
Run this inside the `ml-service/` directory (with active venv):
```bash
python test-ml-flow.py
```
*This tests text auto-classification, isolation forest outlier flags, linear regression predictions, and chatbot routing mock validations.*

---

## 🏆 Advanced Real-Product Features (New Upgrades)

WealthAI has been upgraded with the following production-grade financial capabilities:

1. **Auto-Recurring Subscription Detector**: Automatically groups historical logs and flags recurring subscriptions (e.g. Netflix, Spotify, Rent, Utilities) spaced monthly or weekly.
2. **Savings Goals Simulator**: Tracks target timelines against the user's real monthly savings velocity, calling Aurelia AI advice alerts for shortfalls.
3. **AI Proactive Insights Carousel**: Displays sliding alerts on the Dashboard for spending speed limits, anomalous charges, and low savings rates.
4. **Interactive Bank SMS Sync Simulator**: Simulates real-time card debit/credit SMS parsing on the backend, auto-categorizing and syncing results to the active dashboard.
5. **Printable Wealth Reports (PDF)**: Overrides CSS layout rules when print behavior is called, hiding UI components to export clean reports along with a custom **AI Summary Assessment** from Claude.
6. **Voice Interactive Chatbot Console (STT + TTS)**: Includes hands-free Speech-to-Text microphone recording and a Text-to-Speech synthesizer (with mute options) to read Aurelia's financial tips aloud.
7. **Consult Aurelia Direct Prompts**: Clickable quick-actions on the Dashboard to auto-run specific chatbot analysis.
8. **Real-time Portfolio Tracker**: Live valuation of equity holdings (via `yfinance` quotes) and mutual funds (via AMFI NAV), tracking FIFO Capital Gains tax calculations (STCG/LTCG).
9. **Bank Statement Import Wizard**: Parse spreadsheet CSVs or copy-pasted data from Excel/Sheets, review ML categorization, and batch import transactions.
10. **Agentic NLP Chatbot Actions**: Create database records (transactions, savings goals, monthly budgets) directly from natural language conversation prompts.
11. **Monte Carlo Wealth Simulator**: Runs 1,000 statistical compounding paths (Worst, Median, Best case) and analyzes success feasibility rates of all active savings goals.
