const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

// Fail fast if required secrets are missing, rather than letting every
// auth request fail later with a confusing generic error.
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set. Set it in server/.env before starting the server.');
  process.exit(1);
}

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Harden Mongoose queries against NoSQL-injection-style operator objects
// slipping in through query-string parsing (e.g. ?category[$ne]=null).
mongoose.set('sanitizeFilter', true);

// Database Connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/finance_assistant';
mongoose
  .connect(MONGO_URI)
  .then(() => console.log('MongoDB Connected Successfully'))
  .catch(err => {
    console.error('Database connection error:', err.message);
    process.exit(1);
  });

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Finance Assistant server is healthy' });
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/chatbot', require('./routes/chatbot'));
app.use('/api/budgets', require('./routes/budgets'));
app.use('/api/goals', require('./routes/goals'));
app.use('/api/portfolio', require('./routes/portfolio'));

// 404 handler for unmatched API routes (keeps the API consistently JSON)
app.use((req, res) => {
  res.status(404).json({ message: 'Not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong on the server' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
