const mongoose = require('mongoose');

const GoalSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: [true, 'Goal name is required'],
    trim: true
  },
  targetAmount: {
    type: Number,
    required: [true, 'Target amount is required'],
    min: [1, 'Target amount must be greater than 0']
  },
  currentAmount: {
    type: Number,
    default: 0,
    min: [0, 'Current savings cannot be negative']
  },
  deadline: {
    type: Date,
    required: [true, 'Deadline date is required']
  },
  color: {
    type: String,
    default: '#d97706' // default cashmerish gold
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Goal', GoalSchema);
