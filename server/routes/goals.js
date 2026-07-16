const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Goal = require('../models/Goal');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Helper to calculate difference in months between two dates
function getMonthsDifference(start, end) {
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + (end.getDate() - start.getDate()) / 30;
}

// @route    GET /api/goals
// @desc     Get all goals for a user with AI analysis & projections
// @access   Private
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const goals = await Goal.find({ userId }).sort({ deadline: 1 });

    // Calculate user's average monthly savings
    // Group all transactions by month and type
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

    // Map into month -> { income, expense }
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
      // Fallback: use user's monthly income * 20% savings rate as a sensible default
      const userObj = await User.findById(userId);
      if (userObj && userObj.monthlyIncome > 0) {
        averageMonthlySavings = parseFloat((userObj.monthlyIncome * 0.20).toFixed(2));
      }
    }

    const analyzedGoals = goals.map(goal => {
      const target = goal.targetAmount;
      const current = goal.currentAmount;
      const remainingAmount = Math.max(0, target - current);
      const deadline = new Date(goal.deadline);
      const now = new Date();

      const monthsRemaining = Math.max(0, getMonthsDifference(now, deadline));
      const monthlySavingsRequired = monthsRemaining > 0 
        ? parseFloat((remainingAmount / monthsRemaining).toFixed(2))
        : remainingAmount;

      let projectedCompletionDate = null;
      let status = 'on_track'; // default

      if (current >= target) {
        status = 'completed';
      } else if (monthsRemaining === 0) {
        status = 'behind'; // deadline passed but not completed
      } else if (averageMonthlySavings <= 0) {
        status = 'behind'; // no savings velocity
      } else {
        const projectedMonths = remainingAmount / averageMonthlySavings;
        const projectedDate = new Date();
        projectedDate.setMonth(projectedDate.getMonth() + Math.ceil(projectedMonths));
        projectedCompletionDate = projectedDate;

        if (projectedMonths > monthsRemaining) {
          status = 'behind';
        }
      }

      return {
        _id: goal._id,
        name: goal.name,
        targetAmount: goal.targetAmount,
        currentAmount: goal.currentAmount,
        deadline: goal.deadline,
        color: goal.color,
        remainingAmount,
        monthsRemaining: parseFloat(monthsRemaining.toFixed(2)),
        monthlySavingsRequired,
        projectedCompletionDate,
        status,
        averageMonthlySavings
      };
    });

    res.json({
      goals: analyzedGoals,
      averageMonthlySavings
    });
  } catch (err) {
    console.error('Get goals error:', err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route    POST /api/goals
// @desc     Create a new savings goal
// @access   Private
router.post('/', auth, async (req, res) => {
  try {
    const { name, targetAmount, currentAmount, deadline, color } = req.body;

    if (!name || !targetAmount || !deadline) {
      return res.status(400).json({ message: 'Name, target amount, and deadline are required' });
    }

    const newGoal = new Goal({
      userId: req.user.id,
      name,
      targetAmount,
      currentAmount: currentAmount || 0,
      deadline,
      color: color || '#d97706'
    });

    const goal = await newGoal.save();
    res.status(201).json(goal);
  } catch (err) {
    console.error('Create goal error:', err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route    PUT /api/goals/:id
// @desc     Update a savings goal (details or contributions)
// @access   Private
router.put('/:id', auth, async (req, res) => {
  try {
    const { name, targetAmount, currentAmount, deadline, color, contribution } = req.body;

    let goal = await Goal.findById(req.params.id);
    if (!goal) {
      return res.status(404).json({ message: 'Goal not found' });
    }

    if (goal.userId.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const updateFields = {};
    if (name) updateFields.name = name;
    if (targetAmount !== undefined) updateFields.targetAmount = targetAmount;
    if (deadline) updateFields.deadline = deadline;
    if (color) updateFields.color = color;

    if (currentAmount !== undefined) {
      updateFields.currentAmount = currentAmount;
    } else if (contribution !== undefined) {
      updateFields.currentAmount = Math.max(0, goal.currentAmount + Number(contribution));
    }

    goal = await Goal.findByIdAndUpdate(
      req.params.id,
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    res.json(goal);
  } catch (err) {
    console.error('Update goal error:', err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route    DELETE /api/goals/:id
// @desc     Delete a savings goal
// @access   Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const goal = await Goal.findById(req.params.id);
    if (!goal) {
      return res.status(404).json({ message: 'Goal not found' });
    }

    if (goal.userId.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    await Goal.findByIdAndDelete(req.params.id);
    res.json({ message: 'Savings goal deleted successfully' });
  } catch (err) {
    console.error('Delete goal error:', err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;
