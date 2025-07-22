const express = require('express');
const router = express.Router();
const passport = require('passport');
const mysql = require('mysql2/promise');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Transaction = require('../models/Transaction');

// MySQL pool
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'payment_gateway'
});

// Process payment
router.post('/process', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { amount, paymentMethodId } = req.body;
    const userId = req.user.id;

    if (!amount || !paymentMethodId) return res.status(400).json({ msg: 'Amount & paymentMethodId required' });

    // Get payment method details
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
    
    // Validate card
    if (paymentMethod.card.error) {
      return res.status(400).json({ msg: 'Invalid card' });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100,
      currency: 'usd',
      payment_method: paymentMethodId,
      confirm: true,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never'
      },
      return_url: 'http://localhost:3000'
    });

    const conn = await pool.getConnection();
    await conn.execute(
      'INSERT INTO payments (user_id, amount, status, stripe_payment_id, card_last_four, card_brand) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, amount, paymentIntent.status, paymentIntent.id, paymentMethod.card.last4, paymentMethod.card.brand]
    );
    const [payment] = await conn.execute('SELECT * FROM payments WHERE stripe_payment_id = ?', [paymentIntent.id]);
    conn.release();

    await Transaction.create({
      userId,
      paymentId: payment[0].id,
      amount,
      status: paymentIntent.status,
      type: 'payment',
      metadata: { 
        stripePaymentId: paymentIntent.id,
        cardLast4: paymentMethod.card.last4,
        cardBrand: paymentMethod.card.brand
      }
    });

    res.json({ success: true, payment: payment[0], clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error('❌ Payment error:', err);
    res.status(500).json({ msg: 'Payment failed' });
  }
});

// Payment history
router.get('/history', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [payments] = await conn.execute('SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
    conn.release();
    res.json(payments);
  } catch (err) {
    console.error('❌ History error:', err);
    res.status(500).json({ msg: 'Fetch failed' });
  }
});

module.exports = router;
