# WealthAI — Project Video Presentation Script

**Deviya HarshitKumar KalpeshKumar · USN 241VMTR01558 · MCA Semester IV**
Guide: Prof. Prabha S · Jain Online (Deemed-to-be University)
Deck: `WealthAI_Video_Presentation.pptx` (15 slides) · Target runtime: **10–11 minutes**

Read at a steady ~130 words per minute. Do **not** rush the demo section — that is where the marks are.
Anything in `[square brackets]` is a stage direction, not spoken.

---

## PRE-RECORDING CHECKLIST — do all of this before you hit record

1. **Wake the cloud services** (Render free tier sleeps — first call takes ~55 seconds).
   - Open `https://finance-server-zfco.onrender.com` in a tab, wait for a response.
   - Open `https://finance-ml-service-pw5a.onrender.com/health` in a tab, wait for `{"status": "ok"}`.
   - Open the app, log in, send **one throwaway chatbot message**, wait for the reply.
   - Only now start recording. This kills the cold-start dead air.
2. **Seed the demo account** so no screen looks empty:
   - 15–20 transactions across at least 5 categories, spread over 2–3 months
   - 2 budgets (make one of them over-limit so the warning state shows)
   - 2 goals (one partly funded)
   - 3 portfolio holdings with real tickers
3. **Browser hygiene**: new window, no bookmarks bar, no other tabs, no personal notifications, zoom at 100%, 1920×1080.
4. **Have a second browser profile ready** if you want to show live registration — otherwise skip straight to login.
5. **Audio**: earphone mic, not the laptop mic. Record 10 seconds, play it back, then start.
6. Close Word, Slack, WhatsApp, and anything that can pop a notification.

---

## PART 1 — SLIDES (0:00 – 4:55)

### Slide 1 · Title  — 0:00 to 0:35
> [Webcam on you, full frame or large corner bubble]

"Good morning. My name is Deviya HarshitKumar KalpeshKumar, USN 241VMTR01558, MCA Semester Four, Data Analytics elective at Jain Online Deemed-to-be University, working under the guidance of Prof. Prabha S.

My project is **WealthAI** — an AI-powered personal finance assistant that combines machine learning classification, spending outlier analytics and stochastic projections in a single deployed web platform.

Over the next ten minutes I will take you through the problem, the architecture, the machine learning behind it, a live demonstration of the deployed system, and my findings."

---

### Slide 2 · Problem definition — 0:35 to 1:10

"Personal finance today is fragmented, manual and static. Three specific problems.

First, **information fragmentation**. A typical user holds money across multiple banks, a broker, credit cards and digital wallets. There is no single place that shows total net worth, so computing it is manual labour.

Second, **slow and error-prone categorisation**. Budgeting only works if transactions are labelled, but labelling hundreds of raw descriptions by hand every month is exhausting. Users give up, and the budget dies with them.

Third, **late anomalies and static forecasting**. A double charge or a silent subscription price hike is usually noticed only at month end. And conventional goal calculators still use the fixed-rate compound interest formula, which quietly assumes markets never move."

---

### Slide 3 · Aim and objectives — 1:10 to 1:45

"The aim was to design, implement and **deploy** — not just prototype — an automated, full-stack, AI-driven finance application that consolidates records, categorises transactions with machine learning, flags irregular spending, evaluates long-term goals stochastically, tracks live asset prices, and answers questions conversationally.

That breaks into seven functional modules, listed on the right: automated CSV import with ML categorisation, budgets and goals and subscription tracking, portfolio management with live quotes, spending anomaly detection, short-term expense forecasting, stochastic projections, and an interactive financial chatbot. All seven were delivered."

---

### Slide 4 · Review of literature — 1:45 to 2:15

"The literature review compared conventional approaches against what I adopted.

For categorisation, rule tables do not generalise to merchant strings they have never seen — so I used TF-IDF vectorisation with a Multinomial Naive Bayes classifier.

For anomaly detection, fixed amount thresholds produce high false positives because they ignore an individual's own baseline — so I used an Isolation Forest, with a Z-score fallback for sparse accounts.

And for goal projection, deterministic compound interest hides market risk entirely — so I used a thousand-iteration Monte Carlo simulation producing tenth, fiftieth and ninetieth percentile bands.

The research gap is at the bottom: no single open personal-finance platform brings all three of these together behind one authenticated interface."

---

### Slide 5 · Planning and methodology — 2:15 to 2:40

"I followed Agile across eight weekly sprints. Waterfall was rejected because a single-pass sequential model cannot absorb the requirement churn you get once machine learning behaviour meets real transaction data. Spiral was rejected because its risk-analysis overhead is disproportionate to an eight-week single-developer project.

The sprints ran from requirements and architecture, through schema design, authentication, the ledger and budgeting engine, the ML microservice, the market data pipeline, the chatbot and dashboard, and finally integration testing and cloud deployment.

The risk table below shows the three risks I actually hit, and how each was mitigated."

---

### Slide 6 · Technology stack — 2:40 to 3:05

"The stack is a MERN foundation with a dedicated Python microservice for the analytics.

Presentation: React with Vite, Material UI and Recharts. Application: Node and Express, with JWT authorisation middleware and bcrypt password hashing at salt factor ten. Machine learning: Python and Flask running scikit-learn, pandas, NumPy and the yfinance market gateway. Data and cloud: MongoDB Atlas, with Vercel hosting the frontend and Render hosting both backend services."

---

### Slide 7 · Architecture (Figure 4.1) — 3:05 to 3:45

"This is the three-tier architecture, and the important detail is the separation.

The React single-page application sits on Vercel. It talks only to the Express API, over authenticated HTTP with a JWT bearer token.

The Express API on Render owns all business logic: authorisation middleware, bcrypt security, and seven routers — auth, transactions, budgets, goals, portfolio, analytics and chatbot.

From there the API fans out two ways: to MongoDB Atlas through Mongoose, and to the Python Flask machine learning service through an internal REST proxy.

The browser never reaches the ML service directly. Every request is authenticated at the Express layer first, which is what keeps tenant data isolated and keeps the ML tier off the public browser path."

---

### Slide 8 · ML pipelines (Table 1.1) — 3:45 to 4:20

"These are the actual pipelines and their hyperparameters.

Transaction categorisation uses a TF-IDF vectoriser — lowercased, English stop words removed, with unigrams and bigrams — feeding a Multinomial Naive Bayes classifier.

Anomaly detection uses an Isolation Forest with one hundred estimators, contamination set to zero point zero five, and a fixed random state for reproducibility.

Expense forecasting is ordinary least squares linear regression over monthly aggregate expenditure.

Goal and portfolio projection runs one thousand Monte Carlo iterations driven by a Gaussian return distribution, reporting the P10, P50 and P90 outcomes.

Note the last column. **Every pipeline has a deterministic fallback** — a keyword dictionary, a Z-score check, a rolling average, plain compound interest. So when a new user has almost no data, the product still returns something sensible instead of failing."

---

### Slide 9 · Data model and interfaces — 4:20 to 4:45

"Six MongoDB collections: User, Transaction, Budget, Goal, Holding and PortfolioTransaction. Every one of them is indexed on the user reference, so every query is scoped to a single authenticated account — that is multi-tenant isolation enforced at the data layer, not just in the UI.

On the right are the Flask microservice endpoints the Express API proxies to — category prediction, anomaly detection, expense forecasting, live quotes, portfolio analysis, Monte Carlo simulation and the chatbot."

---

### Slide 10 · Demo divider — 4:45 to 4:55

"That is the design. Let me now show you the system actually running — this is the deployed cloud environment, not a local build."

> [Switch to the browser. Screen capture takes over; keep the webcam bubble small in a corner.]

---

## PART 2 — LIVE DEMO (4:55 – 9:15)

> Keep narrating continuously. Never let silence sit while a page loads — talk over it.

### 2a · Login and JWT — 4:55 to 5:20
> [Show the login page, enter credentials, submit]

"This is the deployed frontend on Vercel. I'll log in — the password is verified against a bcrypt hash, and on success the Express API issues a JWT which the client stores and attaches to every subsequent request. Every protected route you're about to see is guarded by that token."

### 2b · Dashboard — 5:20 to 5:55
> [Land on the dashboard, scroll slowly through the widgets]

"This is the consolidated dashboard — the single view of net worth that the problem statement asked for. Total balance, income against expenditure, category-wise spending breakdown, and recent activity, all pulled from MongoDB Atlas and scoped to my account only.

Notice the category labels here. I never typed those — they were assigned by the Naive Bayes classifier when the transactions were imported."

### 2c · Add a transaction — 5:55 to 6:25
> [Use the navbar quick-add. Type a merchant-style description, e.g. "AMZN MKTPLACE PMTS", an amount, submit]

"Let me add one live. I'll use the quick-add in the navbar and enter a raw merchant description, exactly as a bank statement would print it.

On submit, Express forwards the description to the Flask service, which vectorises it with TF-IDF and returns a predicted category — and there it is, categorised and in the ledger, with the dashboard totals updated."

### 2d · Budgets and goals — 6:25 to 7:00
> [Open Budgets, show an over-limit category. Then Goals, show progress and the projection]

"Budgets track spending against a per-category limit. This one is over its limit, so it's flagged.

Goals track progress toward a savings target. And this is the Monte Carlo piece — instead of a single fixed-return number, the projection gives a probability band across a thousand simulated market paths, so I can see the pessimistic, median and optimistic outcomes rather than one falsely precise figure."

### 2e · Portfolio — 7:00 to 7:35
> [Open Portfolio, show holdings, live prices, allocation chart, chart range buttons]

"The portfolio module tracks holdings with live market prices fetched through yfinance. Current value, gain or loss per holding, and the allocation breakdown are computed server-side. The range selectors re-query the performance history.

If the market API is unavailable, the service falls back to cached historic close quotes rather than erroring out."

### 2f · Aurelia chatbot — 7:35 to 8:35
> [Open Chatbot. Ask something concrete, e.g. "How much did I spend on food last month, and am I on track for my goals?"]

"This is Aurelia, the conversational layer, and it is the part I'm most pleased with.

The Express chatbot router assembles my actual financial context — balances, budgets, goals, recent spending — and sends it with my question to the ML service, so the answer is grounded in my real data rather than generic advice.

[wait for the reply, then point at the right pane]

And this is the design decision I want to highlight. Rather than a plain chat window, any table or chart in the reply is extracted and pinned into a persistent Insights panel on the right, tagged with the question that produced it. So the analysis accumulates as a workspace instead of scrolling away up the chat history."

### 2g · Reports — 8:35 to 9:05
> [Open Reports, show spending trends, forecast, goal feasibility]

"Finally, Reports. Spending trends over time, the linear-regression forecast for the next cycle, and goal feasibility — which combines the two: current savings rate against the Monte Carlo projection, to say whether a target is realistically reachable."

### 2h · Hand back — 9:05 to 9:15
> [Switch back to the slide deck]

"That is the working system, end to end. Back to the findings."

---

## PART 3 — RESULTS AND CLOSE (9:15 – 11:00)

### Slide 11 · Results and deployment — 9:15 to 9:45

"All four components are deployed and live: the React client on Vercel, the Express API and the Flask ML service both on Render, and the database on MongoDB Atlas. All seven functional modules from the scope were delivered.

The evaluation metrics in Table 5.1 cover classification accuracy and F1, anomaly detection precision, regression RMSE, and latency for both the Monte Carlo module and the end-to-end REST pipeline."

> **Fill the blanks on this slide with your real measured numbers before recording.** If you have not measured them yet, either measure them or delete the table and speak only about deployment — do not read out invented figures.

### Slide 12 · Findings — 9:45 to 10:05

"Four findings.

TF-IDF with Naive Bayes classified standard transaction descriptions quickly and accurately at very low computational cost.

The Isolation Forest worked well on larger ledgers, while the Z-score fallback kept detection reliable for accounts with fewer than fifteen transactions.

Monte Carlo projection produced realistic outcome ranges by factoring in volatility, where a fixed-return calculator produces one confident and misleading number.

And routing every client request through the Node API turned microservice isolation into a genuine security property, not just an architectural preference."

### Slide 13 · Known limitations — 10:05 to 10:30

"I want to be straightforward about the limitations.

The Render free tier idles the ML service, so the first call after an idle period is slow — health pings reduce this, they do not remove it.

The models were evaluated on my own test ledger and a sample bank statement, not on a large public benchmark corpus.

Ingestion is CSV-only; there is no direct bank connectivity yet.

The mobile navigation does not yet have parity with the desktop navbar.

And chatbot conversations are not persisted across logins — that needs a new collection and CRUD routes."

### Slide 14 · Recommendations and future scope — 10:30 to 10:50

"Near term: a retraining pipeline that learns from user-corrected labels, a Redis cache in front of the market data API, open banking integration through Plaid or Account Aggregator, and user-defined classification rules that can override the model.

Longer term: React Native mobile clients reusing the existing REST API, expanding the chatbot into a fully conversational advisor, tax-bracket optimisation, and multi-currency support."

### Slide 15 · Conclusion — 10:50 to 11:00

"To conclude — WealthAI addresses the four problems it set out to solve: data fragmentation, manual categorisation effort, undetected anomalies and static forecasting. It does that by combining a MERN web interface with a dedicated Python machine learning microservice, deployed and running on cloud infrastructure.

Thank you for watching. I'm happy to take any questions."

> [Cut back to webcam for the final line if you can — it closes the video the same way it opened.]

---

## LIKELY PANEL QUESTIONS — prepare these answers

**"Why Naive Bayes and not a neural network / transformer?"**
Transaction descriptions are short, sparse, high-dimensional text with a small label set. Naive Bayes with TF-IDF trains in milliseconds, needs no GPU, and is interpretable. A transformer would add large latency and hosting cost for marginal gain on this data shape. If accuracy became the bottleneck, the honest next step is a linear SVM or logistic regression, not a deep model.

**"Why contamination = 0.05 in the Isolation Forest?"**
It encodes the prior that roughly five percent of transactions are unusual. It is a tunable assumption, not a measurement — that is exactly why the Z-score fallback exists for accounts too small for the assumption to hold.

**"Why 1,000 Monte Carlo iterations?"**
It is the point where the percentile bands stabilise while the request still returns fast enough for an interactive UI. More iterations narrow the estimate marginally and cost latency linearly.

**"How is user data kept secure?"**
Passwords are bcrypt-hashed at salt factor ten and never stored in plain text. Every protected route passes through JWT middleware. Every collection is indexed and queried on the user reference, so one account cannot read another's data. The client never talks to the ML service directly — all traffic is proxied through the authenticated Express layer.

**"What happens if the ML service is down?"**
Every pipeline has a deterministic fallback: keyword dictionary matching for categories, Z-score for anomalies, rolling average for forecasts, compound interest for projections. The product degrades, it does not break.

**"Is this original work?"**
Yes — the architecture, schema design, ML pipeline configuration, API design and frontend are my own, built over an eight-week sprint plan. The libraries used are standard open-source packages, cited in the bibliography.

---

## RECORDING AND SUBMISSION

- **Record with OBS Studio** (free): Scene 1 = webcam full frame for the intro and close; Scene 2 = display capture with a small webcam bubble for slides and demo. Output MP4, 1080p, 30 fps.
- Or simpler: record the slide narration in PowerPoint (`Slide Show ▸ Record`), record the demo with Xbox Game Bar (`Win + G`), and stitch them in Clipchamp (built into Windows 11).
- Do a **full dry run with a stopwatch** before the real take. If you run past twelve minutes, cut Slide 6 and shorten the Reports section — do not cut the chatbot.
- Export as `241VMTR01558_WealthAI_Video_Presentation.mp4`.
- If Moodle rejects the file size, upload to Google Drive or YouTube as **Unlisted**, set link sharing so anyone with the link can view, verify the link in a private window, and submit the URL.
- **Submit by 9 August** — the deadline is Monday 10 August 2026, 11:59 PM, and late upload failures are common.
