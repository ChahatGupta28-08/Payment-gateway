const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  userId: {
    type: Number,
    required: true,
    index: true
  },
  paymentId: {
    type: Number,
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'succeeded', 'failed'],
    default: 'pending'
  },
  type: {
    type: String,
    enum: ['payment', 'refund'],
    required: true
  },
  metadata: {
    stripePaymentId: String,
    cardLastFour: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Transaction', TransactionSchema);