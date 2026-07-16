const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const Holding = require('../models/Holding');
const User = require('../models/User');
const auth = require('../middleware/auth');

// @route    GET api/analytics/summary
// @desc     Get total income, total expense, savings, savings rate, and category breakdown
// @access   Private
router.get('/summary', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Aggregate totals
    const totals = await Transaction.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: '$type',
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    let totalIncome = 0;
    let totalExpense = 0;

    totals.forEach(t => {
      if (t._id === 'income') {
        totalIncome = t.totalAmount;
      } else if (t._id === 'expense') {
        totalExpense = t.totalAmount;
      }
    });

    const netSavings = totalIncome - totalExpense;
    const savingsRate = totalIncome > 0 ? parseFloat(((netSavings / totalIncome) * 100).toFixed(2)) : 0;

    // Aggregate category-wise expenses
    const categoryExpenses = await Transaction.aggregate([
      { 
        $match: { 
          userId: new mongoose.Types.ObjectId(userId),
          type: 'expense'
        } 
      },
      {
        $group: {
          _id: '$category',
          amount: { $sum: '$amount' }
        }
      },
      { $sort: { amount: -1 } }
    ]);

    // Format category breakdown
    const categoryBreakdown = categoryExpenses.map(item => ({
      category: item._id,
      amount: item.amount
    }));

    res.json({
      totalIncome,
      totalExpense,
      netSavings,
      savingsRate,
      categoryBreakdown
    });
  } catch (err) {
    console.error('Analytics summary error:', err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route    GET api/analytics/prediction
// @desc     Get category-wise predicted spend for next month using ML Linear Regression
// @access   Private
router.get('/prediction', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const mlUrl = process.env.ML_SERVICE_URL || 'http://127.0.0.1:5001';

    // Aggregate expenses by category and month (format: YYYY-MM)
    const groupedExpenses = await Transaction.aggregate([
      { 
        $match: { 
          userId: new mongoose.Types.ObjectId(userId),
          type: 'expense'
        } 
      },
      {
        $group: {
          _id: {
            category: '$category',
            month: { $dateToString: { format: '%Y-%m', date: '$date' } }
          },
          totalAmount: { $sum: '$amount' }
        }
      },
      { $sort: { '_id.month': 1 } } // Ensure chronological ordering
    ]);

    // Build history mapping: category -> [amount_month_1, amount_month_2, ...]
    const historyMap = {};
    groupedExpenses.forEach(item => {
      const cat = item._id.category;
      const amount = item.totalAmount;
      if (!historyMap[cat]) {
        historyMap[cat] = [];
      }
      historyMap[cat].push(amount);
    });

    const predictions = {};

    // For each category, query the Flask ML service
    for (const [category, history] of Object.entries(historyMap)) {
      try {
        const predRes = await fetch(`${mlUrl}/predict/expense`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ monthly_history: history })
        });
        
        if (predRes.ok) {
          const predData = await predRes.json();
          predictions[category] = predData.predicted_expense;
        } else {
          // Fallback to average of monthly history
          const avg = history.reduce((sum, val) => sum + val, 0) / history.length;
          predictions[category] = parseFloat(avg.toFixed(2));
        }
      } catch (err) {
        console.warn(`Could not reach ML service for category ${category} prediction:`, err.message);
        // Fallback to average of monthly history
        const avg = history.reduce((sum, val) => sum + val, 0) / history.length;
        predictions[category] = parseFloat(avg.toFixed(2));
      }
    }

    res.json(predictions);
  } catch (err) {
    console.error('Prediction calculation error:', err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route    GET api/analytics/health-score
// @desc     Calculate a financial health score (0-100) for the user
// @access   Private
router.get('/health-score', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all transactions
    const transactions = await Transaction.find({ userId: new mongoose.Types.ObjectId(userId) });

    if (transactions.length === 0) {
      return res.json({ score: 50, grade: 'C', breakdown: { savingsScore: 0, consistencyScore: 0, anomalyPenalty: 0 } });
    }

    let totalIncome = 0;
    let totalExpense = 0;
    let anomalyCount = 0;

    transactions.forEach(t => {
      if (t.type === 'income') totalIncome += t.amount;
      else totalExpense += t.amount;
      if (t.isAnomaly) anomalyCount++;
    });

    // 1. Savings rate score (0-40 pts): 30%+ savings = full 40
    const savingsRate = totalIncome > 0 ? (totalIncome - totalExpense) / totalIncome : 0;
    const savingsScore = Math.min(40, Math.max(0, savingsRate * 130));

    // 2. Expense consistency score (0-40 pts): low variance in monthly expenses = better
    const monthlyExpenses = {};
    transactions.filter(t => t.type === 'expense').forEach(t => {
      const month = new Date(t.date).toISOString().slice(0, 7);
      monthlyExpenses[month] = (monthlyExpenses[month] || 0) + t.amount;
    });

    const expValues = Object.values(monthlyExpenses);
    let consistencyScore = 40;
    if (expValues.length > 1) {
      const avg = expValues.reduce((s, v) => s + v, 0) / expValues.length;
      const variance = expValues.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / expValues.length;
      const cv = avg > 0 ? Math.sqrt(variance) / avg : 0; // coefficient of variation
      // CV < 0.1 = full points, CV > 0.8 = 0 pts
      consistencyScore = Math.max(0, 40 - (cv / 0.8) * 40);
    }

    // 3. Anomaly penalty (up to -20 pts)
    const anomalyPenalty = Math.min(20, anomalyCount * 5);

    const rawScore = savingsScore + consistencyScore - anomalyPenalty;
    const score = Math.round(Math.max(0, Math.min(100, rawScore)));

    let grade = 'D';
    if (score >= 90) grade = 'A+';
    else if (score >= 80) grade = 'A';
    else if (score >= 70) grade = 'B+';
    else if (score >= 60) grade = 'B';
    else if (score >= 50) grade = 'C';

    res.json({
      score,
      grade,
      breakdown: {
        savingsScore: Math.round(savingsScore),
        consistencyScore: Math.round(consistencyScore),
        anomalyPenalty: Math.round(anomalyPenalty)
      },
      meta: { totalIncome, totalExpense, savingsRate: parseFloat((savingsRate * 100).toFixed(1)), anomalyCount }
    });
  } catch (err) {
    console.error('Health score error:', err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route    GET api/analytics/recurring
// @desc     Detect recurring subscriptions/bills
// @access   Private
router.get('/recurring', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const expenses = await Transaction.find({ userId, type: 'expense' }).sort({ date: 1 });

    const recurringKeywords = [
      'netflix', 'spotify', 'disney', 'prime', 'hbo', 'hulu', 'apple', 'youtube',
      'rent', 'gym', 'fitness', 'electricity', 'power', 'water', 'gas', 'utilities',
      'insurance', 'internet', 'wifi', 'comcast', 'verizon', 'att', 'mobile',
      'phone', 't-mobile', 'broadband', 'zoom', 'github', 'adobe', 'office 365', 'icloud', 'canva', 'cursor'
    ];

    const normalizeName = (desc) => {
      if (!desc) return '';
      let norm = desc.toLowerCase().trim();
      for (const kw of recurringKeywords) {
        if (norm.includes(kw)) {
          return kw;
        }
      }
      return norm.replace(/[^a-z]/g, '');
    };

    const grouped = {};
    expenses.forEach(tx => {
      const norm = normalizeName(tx.description || tx.category);
      if (!norm) return;
      if (!grouped[norm]) {
        grouped[norm] = [];
      }
      grouped[norm].push(tx);
    });

    const recurringItems = [];
    const today = new Date();

    for (const [normKey, txList] of Object.entries(grouped)) {
      txList.sort((a, b) => new Date(a.date) - new Date(b.date));

      const name = txList[txList.length - 1].description || txList[txList.length - 1].category;
      const category = txList[txList.length - 1].category;
      const totalAmount = txList.reduce((sum, tx) => sum + tx.amount, 0);
      const avgAmount = parseFloat((totalAmount / txList.length).toFixed(2));
      const lastTx = txList[txList.length - 1];
      const lastPaymentDate = new Date(lastTx.date);

      let frequency = 'Monthly';
      let isRecurring = false;

      const isKnownKeyword = recurringKeywords.some(kw => normKey.includes(kw));

      if (txList.length >= 2) {
        let totalIntervalDays = 0;
        for (let i = 1; i < txList.length; i++) {
          const diffMs = new Date(txList[i].date) - new Date(txList[i-1].date);
          totalIntervalDays += diffMs / (1000 * 60 * 60 * 24);
        }
        const avgInterval = totalIntervalDays / (txList.length - 1);

        if (avgInterval >= 25 && avgInterval <= 35) {
          frequency = 'Monthly';
          isRecurring = true;
        } else if (avgInterval >= 5 && avgInterval <= 9) {
          frequency = 'Weekly';
          isRecurring = true;
        } else if (isKnownKeyword) {
          frequency = 'Monthly';
          isRecurring = true;
        }
      } else if (txList.length === 1 && isKnownKeyword) {
        frequency = 'Monthly';
        isRecurring = true;
      }

      if (isRecurring) {
        const nextDueDate = new Date(lastPaymentDate);
        if (frequency === 'Monthly') {
          nextDueDate.setMonth(nextDueDate.getMonth() + 1);
        } else {
          nextDueDate.setDate(nextDueDate.getDate() + 7);
        }

        const diffTime = nextDueDate - today;
        const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        const isPaidThisMonth = txList.some(tx => {
          const txDate = new Date(tx.date);
          return txDate.getFullYear() === today.getFullYear() && txDate.getMonth() === today.getMonth();
        });

        const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);
        const displayName = isKnownKeyword ? capitalize(normKey) : capitalize(name);

        recurringItems.push({
          name: displayName,
          category,
          frequency,
          amount: avgAmount,
          lastPaymentDate,
          nextDueDate,
          daysRemaining,
          isPaidThisMonth
        });
      }
    }

    recurringItems.sort((a, b) => a.nextDueDate - b.nextDueDate);
    res.json(recurringItems);
  } catch (err) {
    console.error('Recurring bills error:', err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route    POST api/analytics/projection
// @desc     Calculate wealth projections using Monte Carlo simulation
// @access   Private
router.post('/projection', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const mlUrl = process.env.ML_SERVICE_URL || 'http://127.0.0.1:5001';
    
    // 1. Calculate default current net worth from holdings if not provided
    let { current_net_worth, monthly_savings, years = 10, risk_profile = 'balanced' } = req.body;
    
    if (current_net_worth === undefined || current_net_worth === null) {
      const holdings = await Holding.find({ userId: new mongoose.Types.ObjectId(userId) });
      let computedNetWorth = 0;
      holdings.forEach(h => {
        computedNetWorth += h.quantity * h.avgBuyPrice;
      });
      current_net_worth = computedNetWorth;
    }
    
    // 2. Calculate default monthly savings from transaction history if not provided
    if (monthly_savings === undefined || monthly_savings === null) {
      const monthlyData = await Transaction.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId) } },
        {
          $group: {
            _id: {
              month: { $dateToString: { format: '%Y-%m', date: '$date' } },
              type: '$type'
            },
            total: { $sum: '$amount' }
          }
        }
      ]);
      
      const monthsMap = {};
      monthlyData.forEach(item => {
        const month = item._id.month;
        const type = item._id.type;
        if (!monthsMap[month]) {
          monthsMap[month] = { income: 0, expense: 0 };
        }
        if (type === 'income') {
          monthsMap[month].income += item.total;
        } else if (type === 'expense') {
          monthsMap[month].expense += item.total;
        }
      });
      
      const netSavingsPerMonth = Object.keys(monthsMap).map(month => {
        return monthsMap[month].income - monthsMap[month].expense;
      });
      
      let averageMonthlySavings = 0;
      if (netSavingsPerMonth.length > 0) {
        const sum = netSavingsPerMonth.reduce((s, v) => s + v, 0);
        averageMonthlySavings = parseFloat((sum / netSavingsPerMonth.length).toFixed(2));
      } else {
        const userObj = await User.findById(userId);
        if (userObj && userObj.monthlyIncome > 0) {
          averageMonthlySavings = parseFloat((userObj.monthlyIncome * 0.20).toFixed(2));
        }
      }
      monthly_savings = Math.max(0, averageMonthlySavings);
    }
    
    // 3. Call ML service
    const simRes = await fetch(`${mlUrl}/portfolio/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        current_net_worth,
        monthly_savings,
        years,
        risk_profile
      })
    });
    
    if (simRes.ok) {
      const simData = await simRes.json();
      return res.json({
        defaults: {
          current_net_worth,
          monthly_savings
        },
        simulation: simData
      });
    } else {
      const errText = await simRes.text();
      return res.status(500).json({ message: 'Error simulating projections from ML service', error: errText });
    }
  } catch (err) {
    console.error('Projection simulation route error:', err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;
