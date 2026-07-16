const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const auth = require('../middleware/auth');

// @route    GET api/transactions
// @desc     Get all transactions for the authenticated user (with filters)
// @access   Private
router.get('/', auth, async (req, res) => {
  try {
    const { category, type, startDate, endDate, sortBy = 'date', order = 'desc' } = req.query;

    // Build query
    const query = { userId: req.user.id };

    if (category && typeof category === 'string') {
      query.category = category;
    }

    if (type && typeof type === 'string') {
      query.type = type;
    }

    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        query.date.$gte = new Date(startDate);
      }
      if (endDate) {
        query.date.$lte = new Date(endDate);
      }
    }

    // Build sort options
    const sortOptions = {};
    sortOptions[sortBy] = order === 'asc' ? 1 : -1;

    const transactions = await Transaction.find(query).sort(sortOptions);
    res.json(transactions);
  } catch (err) {
    console.error('Fetch transactions error:', err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route    POST api/transactions
// @desc     Create a new transaction (with AI category prediction & anomaly check)
// @access   Private
router.post('/', auth, async (req, res) => {
  let { amount, type, category, description, date } = req.body;

  try {
    if (amount === undefined || amount === null || isNaN(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({ message: 'A positive amount is required' });
    }
    if (!type) {
      return res.status(400).json({ message: 'Transaction type is required' });
    }
    if (!['income', 'expense'].includes(type)) {
      return res.status(400).json({ message: 'Type must be either income or expense' });
    }

    const mlUrl = process.env.ML_SERVICE_URL || 'http://127.0.0.1:5001';
    let predictedCategory = '';
    let isAnomaly = false;

    // 1. ML Auto-Categorization (only query Flask if description is provided)
    if (description && description.trim()) {
      try {
        const catRes = await fetch(`${mlUrl}/predict/category`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description })
        });
        if (catRes.ok) {
          const catData = await catRes.json();
          predictedCategory = catData.category;
          
          // Auto-fill category if the user did not choose one, or selected "Others"
          if (!category || category === 'Others') {
            category = predictedCategory;
          }
        }
      } catch (err) {
        console.warn('ML Service offline or error for auto-categorization:', err.message);
      }
    }

    // Default category fallback
    if (!category) {
      category = 'Others';
    }

    // 2. ML Anomaly Detection (only for expenses)
    if (type === 'expense') {
      try {
        // Fetch past expense amounts in the same category for this user
        const pastTx = await Transaction.find({
          userId: req.user.id,
          category: category,
          type: 'expense'
        });
        const pastAmounts = pastTx.map(t => t.amount);

        const anomalyRes = await fetch(`${mlUrl}/predict/anomaly`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            past_amounts: pastAmounts,
            current_amount: amount
          })
        });
        if (anomalyRes.ok) {
          const anomalyData = await anomalyRes.json();
          isAnomaly = anomalyData.is_anomaly;
        }
      } catch (err) {
        console.warn('ML Service offline or error for anomaly detection:', err.message);
      }
    }

    const newTransaction = new Transaction({
      userId: req.user.id,
      amount,
      type,
      category,
      description,
      date: date ? new Date(date) : new Date(),
      isAnomaly,
      predictedCategory
    });

    const transaction = await newTransaction.save();
    res.status(201).json(transaction);
  } catch (err) {
    console.error('Create transaction error:', err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route    PUT api/transactions/:id
// @desc     Update a transaction
// @access   Private
router.put('/:id', auth, async (req, res) => {
  const { amount, type, category, description, date, isAnomaly, predictedCategory } = req.body;

  try {
    let transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    // Make sure user owns transaction
    if (transaction.userId.toString() !== req.user.id) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    // Build update object
    const fieldsToUpdate = {};
    if (amount !== undefined) fieldsToUpdate.amount = amount;
    if (type !== undefined) {
      if (!['income', 'expense'].includes(type)) {
        return res.status(400).json({ message: 'Type must be either income or expense' });
      }
      fieldsToUpdate.type = type;
    }
    if (category !== undefined) fieldsToUpdate.category = category;
    if (description !== undefined) fieldsToUpdate.description = description;
    if (date !== undefined) fieldsToUpdate.date = new Date(date);
    if (isAnomaly !== undefined) fieldsToUpdate.isAnomaly = isAnomaly;
    if (predictedCategory !== undefined) fieldsToUpdate.predictedCategory = predictedCategory;

    transaction = await Transaction.findByIdAndUpdate(
      req.params.id,
      { $set: fieldsToUpdate },
      { new: true }
    );

    res.json(transaction);
  } catch (err) {
    console.error('Update transaction error:', err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route    DELETE api/transactions/:id
// @desc     Delete a transaction
// @access   Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    // Make sure user owns transaction
    if (transaction.userId.toString() !== req.user.id) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    await Transaction.findByIdAndDelete(req.params.id);

    res.json({ message: 'Transaction removed' });
  } catch (err) {
    console.error('Delete transaction error:', err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route    GET api/transactions/export
// @desc     Export all user transactions as CSV
// @access   Private
router.get('/export', auth, async (req, res) => {
  try {
    const transactions = await Transaction.find({ userId: req.user.id }).sort({ date: -1 });

    const headers = ['Date', 'Type', 'Category', 'Amount', 'Description', 'Anomaly'];
    const rows = transactions.map(t => [
      new Date(t.date).toISOString().split('T')[0],
      t.type,
      t.category,
      t.amount,
      `"${(t.description || '').replace(/"/g, '""')}"`,
      t.isAnomaly ? 'Yes' : 'No'
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="wealthai_transactions_${new Date().toISOString().slice(0,10)}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('Export error:', err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route    POST api/transactions/import
// @desc     Bulk import transactions from CSV data (JSON array from client-parsed CSV)
// @access   Private
router.post('/import', auth, async (req, res) => {
  try {
    const { rows } = req.body; // Array of { date, type, category, amount, description }

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ message: 'No rows provided' });
    }

    const validTypes = ['income', 'expense'];
    const docs = [];

    for (const row of rows) {
      const amount = parseFloat(row.amount);
      if (isNaN(amount) || amount <= 0) continue;
      const type = (row.type || '').toLowerCase().trim();
      if (!validTypes.includes(type)) continue;

      docs.push({
        userId: req.user.id,
        amount,
        type,
        category: (row.category || 'Others').trim(),
        description: (row.description || '').trim(),
        date: row.date ? new Date(row.date) : new Date(),
        isAnomaly: false,
        predictedCategory: ''
      });
    }

    if (docs.length === 0) {
      return res.status(400).json({ message: 'No valid rows found. Ensure type is income/expense and amount is a positive number.' });
    }

    const inserted = await Transaction.insertMany(docs);
    res.status(201).json({ imported: inserted.length, message: `Successfully imported ${inserted.length} transactions` });
  } catch (err) {
    console.error('Import error:', err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route    POST api/transactions/parse-sms
// @desc     Simulate bank SMS transaction sync
// @access   Private
router.post('/parse-sms', auth, async (req, res) => {
  const { smsText } = req.body;

  try {
    if (!smsText || !smsText.trim()) {
      return res.status(400).json({ message: 'SMS text is required' });
    }

    const text = smsText.toLowerCase().trim();

    // 1. Determine type: income or expense
    let type = 'expense';
    if (text.includes('credited') || text.includes('received') || text.includes('salary') || text.includes('deposit') || text.includes('added to a/c') || text.includes('refunded')) {
      type = 'income';
    }

    // 2. Extract Amount (checks formats like INR 1,200.00, Rs. 500, debited 250, etc.)
    const amtRegex = /(?:inr|rs\.?|rs\s*|inr\s*|debited\s*|credited\s*|spent\s*|withdrawn\s*)(?:\s*)([0-9,]+(?:\.[0-9]+)?)/i;
    const matchAmt = smsText.match(amtRegex);
    let amount = 0;
    if (matchAmt && matchAmt[1]) {
      amount = parseFloat(matchAmt[1].replace(/,/g, ''));
    } else {
      // Fallback: search for any number in the string
      const fallbackAmtRegex = /(\d+(?:\.\d+)?)/;
      const matchFallback = smsText.match(fallbackAmtRegex);
      if (matchFallback && matchFallback[1]) {
        amount = parseFloat(matchFallback[1]);
      }
    }

    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ message: 'Could not extract valid transaction amount from SMS' });
    }

    // 3. Extract Merchant / Description
    let description = 'SMS Transaction';
    
    if (text.includes('salary')) {
      description = 'Salary Credited';
    } else {
      // Look for phrases like "at [merchant]", "for [merchant]", "to [merchant]", "spent on [merchant]"
      const merchantRegex = /(?:at|for|to|spent\s+on)\s+([a-z0-9\s._'-]+)/i;
      const matchMerchant = smsText.match(merchantRegex);
      if (matchMerchant && matchMerchant[1]) {
        description = matchMerchant[1].trim();
        // Remove trailing phrases like "using ...", "on ...", "via ...", "your a/c ..."
        description = description.replace(/\s+(on|via|using|card|account|your\s+a\/c).*/i, '').trim();
      }
    }

    if (description.toLowerCase().includes('account') || description.toLowerCase().includes('a/c') || description.toLowerCase().includes('bank')) {
      description = type === 'income' ? 'Income Deposit' : 'SMS Expense';
    }

    if (description.toLowerCase().startsWith('inr') || description.toLowerCase().startsWith('rs') || description.length < 2) {
      description = 'SMS Transaction';
    }

    // Capitalize description nicely
    description = description.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

    // 4. ML Categorization and Anomaly detection
    const mlUrl = process.env.ML_SERVICE_URL || 'http://127.0.0.1:5001';
    let category = type === 'income' ? 'Salary' : 'Others';
    let predictedCategory = '';
    let isAnomaly = false;

    // ML Auto-Categorization
    try {
      const catRes = await fetch(`${mlUrl}/predict/category`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description })
      });
      if (catRes.ok) {
        const catData = await catRes.json();
        predictedCategory = catData.category;
        category = predictedCategory;
      }
    } catch (err) {
      console.warn('ML auto-category failed on SMS parse:', err.message);
    }

    // Default category fallback
    if (!category) {
      category = 'Others';
    }

    // ML Anomaly Detection (only for expenses)
    if (type === 'expense') {
      try {
        const pastTx = await Transaction.find({
          userId: req.user.id,
          category: category,
          type: 'expense'
        });
        const pastAmounts = pastTx.map(t => t.amount);

        const anomalyRes = await fetch(`${mlUrl}/predict/anomaly`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            past_amounts: pastAmounts,
            current_amount: amount
          })
        });
        if (anomalyRes.ok) {
          const anomalyData = await anomalyRes.json();
          isAnomaly = anomalyData.is_anomaly;
        }
      } catch (err) {
        console.warn('ML anomaly-detect failed on SMS parse:', err.message);
      }
    }

    const newTransaction = new Transaction({
      userId: req.user.id,
      amount,
      type,
      category,
      description,
      date: new Date(),
      isAnomaly,
      predictedCategory
    });

    const transaction = await newTransaction.save();
    res.status(201).json(transaction);
  } catch (err) {
    console.error('Parse SMS error:', err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route    POST api/transactions/import-preview
// @desc     Parse uploaded transactions draft, run through ML auto-categorizer, and return categorized rows
// @access   Private
router.post('/import-preview', auth, async (req, res) => {
  try {
    const { rows } = req.body; // Array of { date, amount, description, type }
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ message: 'No rows provided' });
    }

    const mlUrl = process.env.ML_SERVICE_URL || 'http://127.0.0.1:5001';
    const processedRows = [];

    for (const row of rows) {
      const amount = parseFloat(row.amount);
      if (isNaN(amount) || amount === 0) continue;

      let type = (row.type || '').toLowerCase().trim();
      if (!type) {
        type = amount < 0 ? 'expense' : 'income';
      }
      
      const absoluteAmount = Math.abs(amount);
      const description = (row.description || '').trim();
      let category = (row.category || '').trim();
      let predictedCategory = '';

      // ML Auto-Categorization (only query Flask if description is provided and category is not chosen)
      if (description && (!category || category === 'Others')) {
        try {
          const catRes = await fetch(`${mlUrl}/predict/category`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ description })
          });
          if (catRes.ok) {
            const catData = await catRes.json();
            predictedCategory = catData.category;
            category = predictedCategory;
          }
        } catch (err) {
          console.warn('ML Service category prediction error on import-preview:', err.message);
        }
      }

      if (!category) {
        category = 'Others';
      }

      processedRows.push({
        date: row.date || new Date().toISOString().substring(0, 10),
        description,
        amount: absoluteAmount,
        type: type === 'credit' || type === 'income' ? 'income' : 'expense',
        category,
        predictedCategory
      });
    }

    res.json(processedRows);
  } catch (err) {
    console.error('Import preview error:', err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;
