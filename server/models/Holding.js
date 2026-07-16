const mongoose = require('mongoose');

const HoldingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  symbol: {
    type: String,
    required: [true, 'Symbol/Ticker is required'],
    trim: true
  },
  name: {
    type: String,
    required: [true, 'Asset name is required'],
    trim: true
  },
  assetType: {
    type: String,
    required: [true, 'Asset type is required'],
    enum: ['stock', 'mutual_fund', 'gold', 'fd']
  },
  exchange: {
    type: String,
    trim: true,
    default: 'NSE'
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [0, 'Quantity cannot be negative']
  },
  avgBuyPrice: {
    type: Number,
    required: [true, 'Average buy price is required'],
    min: [0, 'Average buy price cannot be negative']
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Holding', HoldingSchema);
