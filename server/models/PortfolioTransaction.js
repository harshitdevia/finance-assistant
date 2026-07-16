const mongoose = require('mongoose');

const PortfolioTransactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  holdingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Holding'
  },
  symbol: {
    type: String,
    required: [true, 'Symbol is required'],
    trim: true
  },
  type: {
    type: String,
    required: [true, 'Transaction type is required'],
    enum: ['buy', 'sell', 'dividend', 'interest']
  },
  quantity: {
    type: Number,
    min: [0, 'Quantity cannot be negative'],
    default: 0
  },
  price: {
    type: Number,
    min: [0, 'Price cannot be negative'],
    default: 0
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0, 'Amount cannot be negative']
  },
  date: {
    type: Date,
    default: Date.now
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('PortfolioTransaction', PortfolioTransactionSchema);
