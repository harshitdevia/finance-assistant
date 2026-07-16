const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Helper to fetch ML predictions for the user
async function getPredictions(userId, mlUrl) {
  try {
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
      { $sort: { '_id.month': 1 } }
    ]);

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
          const avg = history.reduce((sum, val) => sum + val, 0) / history.length;
          predictions[category] = parseFloat(avg.toFixed(2));
        }
      } catch (err) {
        const avg = history.reduce((sum, val) => sum + val, 0) / history.length;
        predictions[category] = parseFloat(avg.toFixed(2));
      }
    }
    return predictions;
  } catch (err) {
    console.error('Error fetching predictions for chatbot context:', err.message);
    return {};
  }
}

// @route    POST api/chatbot
// @desc     Query AI chatbot with user financial context
// @access   Private
router.post('/', auth, async (req, res) => {
  const { message, conversation_history } = req.body;

  try {
    if (!message || !message.trim()) {
      return res.status(400).json({ message: 'Message is required' });
    }

    const userId = req.user.id;
    const user = await User.findById(userId).select('-password');

    // Gather all transactions to compile a summary for AI context
    const transactions = await Transaction.find({ userId }).sort({ date: -1 });

    // Calculate quick stats
    let totalIncome = 0;
    let totalExpense = 0;
    const categoryMap = {};

    transactions.forEach(t => {
      if (t.type === 'income') {
        totalIncome += t.amount;
      } else {
        totalExpense += t.amount;
        categoryMap[t.category] = (categoryMap[t.category] || 0) + t.amount;
      }
    });

    const netSavings = totalIncome - totalExpense;
    const savingsRate = totalIncome > 0 ? ((netSavings / totalIncome) * 100).toFixed(1) : '0';

    // Format category breakdown for the prompt
    const categoryBreakdown = Object.entries(categoryMap).map(([cat, amt]) => ({
      category: cat,
      amount: amt
    }));

    // Format recent transactions list
    const recentTx = transactions.slice(0, 15).map(t => ({
      amount: t.amount,
      type: t.type,
      category: t.category,
      description: t.description || 'No description',
      date: new Date(t.date).toISOString().substring(0, 10),
      isAnomaly: t.isAnomaly
    }));

    const mlUrl = process.env.ML_SERVICE_URL || 'http://127.0.0.1:5001';
    
    // Fetch ML category predictions to enrich chatbot analysis
    const predictions = await getPredictions(userId, mlUrl);

    // Pack everything as context
    const context = {
      username: user.username,
      totalIncome,
      totalExpense,
      netSavings,
      savingsRate,
      categoryBreakdown,
      recentTransactions: recentTx,
      predictions: predictions || {}
    };

    // Call Flask Chatbot Service
    const mlRes = await fetch(`${mlUrl}/chatbot`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message,
        context,
        conversation_history: Array.isArray(conversation_history) ? conversation_history.slice(-10) : []
      })
    });

    if (!mlRes.ok) {
      const errData = await mlRes.json().catch(() => ({}));
      return res.status(mlRes.status).json({ 
        message: errData.error || 'Failed to query ML Chatbot service' 
      });
    }

    const mlData = await mlRes.json();
    let reply = mlData.reply || '';
    let actionTriggered = null;

    if (reply.includes('||ACTION_START||') && reply.includes('||ACTION_END||')) {
      const parts = reply.split('||ACTION_START||');
      const textReply = parts[0].trim();
      const actionBlock = parts[1].split('||ACTION_END||')[0].trim();

      // Clean response text from JSON string block
      const trailingPart = parts[1].split('||ACTION_END||')[1] || '';
      reply = (textReply + '\n' + trailingPart).trim();

      let actionObj = null;
      try {
        actionObj = JSON.parse(actionBlock);
      } catch (jsonErr) {
        console.error('Error parsing agent action block from chatbot reply:', jsonErr.message);
      }

      if (actionObj) {
      try {
        const { action, params } = actionObj;

        if (action === 'CREATE_TRANSACTION') {
          let { type, amount, category, description } = params;
          if (amount && type && category) {
            let isAnomaly = false;
            if (type === 'expense') {
              try {
                const pastTx = await Transaction.find({
                  userId,
                  category,
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
                console.warn('ML Service offline during chatbot anomaly check:', err.message);
              }
            }

            const newTx = new Transaction({
              userId,
              amount,
              type,
              category,
              description: description || 'Logged via Chatbot',
              date: new Date(),
              isAnomaly,
              predictedCategory: category
            });

            await newTx.save();
            actionTriggered = {
              type: 'CREATE_TRANSACTION',
              success: true,
              details: { type, amount, category, description: newTx.description, isAnomaly }
            };
          }
        } else if (action === 'CREATE_GOAL') {
          const { name, target, targetDate } = params;
          if (name && target && targetDate) {
            const Goal = require('../models/Goal');
            const newGoal = new Goal({
              userId,
              name,
              targetAmount: target,
              deadline: new Date(targetDate),
              currentAmount: 0
            });
            await newGoal.save();
            actionTriggered = {
              type: 'CREATE_GOAL',
              success: true,
              details: { name, targetAmount: target, deadline: targetDate }
            };
          }
        } else if (action === 'CREATE_BUDGET') {
          const { category, limit } = params;
          if (category && limit) {
            const Budget = require('../models/Budget');
            const currentMonth = new Date().toISOString().substring(0, 7);
            let budget = await Budget.findOne({ userId, category, month: currentMonth });
            if (budget) {
              budget.monthlyLimit = limit;
              await budget.save();
            } else {
              const newBudget = new Budget({ 
                userId, 
                category, 
                monthlyLimit: limit, 
                month: currentMonth 
              });
              await newBudget.save();
            }
            actionTriggered = {
              type: 'CREATE_BUDGET',
              success: true,
              details: { category, limit, month: currentMonth }
            };
          }
        }
      } catch (actionErr) {
        console.error('Error executing agent action from chatbot reply:', actionErr.message);
        actionTriggered = {
          type: actionObj?.action || 'UNKNOWN',
          success: false,
          error: 'Failed to save the requested change. Please try again.'
        };
      }
      }
    }

    res.json({ reply, actionTriggered });

  } catch (err) {
    console.error('Express Chatbot route error:', err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;
