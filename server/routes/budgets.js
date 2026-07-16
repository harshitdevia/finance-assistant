const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Budget = require('../models/Budget');
const Transaction = require('../models/Transaction');
const auth = require('../middleware/auth');

// @route   GET /api/budgets
// @desc    Get all budgets for a month, joined with actual spend from transactions
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { month } = req.query;

    // Default to current month if not specified
    const targetMonth = (month && typeof month === 'string') ? month : new Date().toISOString().slice(0, 7);

    const budgets = await Budget.find({ userId, month: targetMonth }).sort({ category: 1 });

    // Calculate actual spending for each budget category this month
    const monthStart = new Date(`${targetMonth}-01T00:00:00.000Z`);
    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthEnd.getMonth() + 1);

    const actuals = await Transaction.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          type: 'expense',
          date: { $gte: monthStart, $lt: monthEnd }
        }
      },
      {
        $group: {
          _id: '$category',
          totalSpent: { $sum: '$amount' }
        }
      }
    ]);

    const actualMap = {};
    actuals.forEach(a => { actualMap[a._id] = a.totalSpent; });

    const budgetsWithActuals = budgets.map(b => ({
      _id: b._id,
      category: b.category,
      monthlyLimit: b.monthlyLimit,
      month: b.month,
      color: b.color,
      spent: actualMap[b.category] || 0,
      remaining: Math.max(0, b.monthlyLimit - (actualMap[b.category] || 0)),
      percentUsed: b.monthlyLimit > 0
        ? Math.min(100, parseFloat(((actualMap[b.category] || 0) / b.monthlyLimit * 100).toFixed(1)))
        : 0
    }));

    res.json(budgetsWithActuals);
  } catch (err) {
    console.error('Get budgets error:', err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route   POST /api/budgets
// @desc    Create or update a budget goal for a category/month
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const { category, monthlyLimit, month, color } = req.body;

    if (!category || !monthlyLimit) {
      return res.status(400).json({ message: 'Category and monthly limit are required' });
    }

    const targetMonth = month || new Date().toISOString().slice(0, 7);

    // Upsert: update if exists, create if not
    const budget = await Budget.findOneAndUpdate(
      { userId: req.user.id, category, month: targetMonth },
      { monthlyLimit, color: color || '#14b8a6' },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(201).json(budget);
  } catch (err) {
    console.error('Create budget error:', err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route   DELETE /api/budgets/:id
// @desc    Delete a budget goal
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const budget = await Budget.findById(req.params.id);

    if (!budget) {
      return res.status(404).json({ message: 'Budget not found' });
    }

    if (budget.userId.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    await Budget.findByIdAndDelete(req.params.id);
    res.json({ message: 'Budget deleted' });
  } catch (err) {
    console.error('Delete budget error:', err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;
