const mongoose = require('mongoose');

const BudgetSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    trim: true
  },
  monthlyLimit: {
    type: Number,
    required: [true, 'Monthly limit is required'],
    min: [0, 'Limit must be positive']
  },
  // Store as YYYY-MM so each budget is per month
  month: {
    type: String,
    required: true,
    match: [/^\d{4}-\d{2}$/, 'Month must be in YYYY-MM format']
  },
  color: {
    type: String,
    default: '#14b8a6'
  }
}, {
  timestamps: true
});

// Each user can have one budget per category per month
BudgetSchema.index({ userId: 1, category: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('Budget', BudgetSchema);
