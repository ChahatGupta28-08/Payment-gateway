const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const nodemailer = require('nodemailer');
const mysql = require('mysql2/promise');
const Transaction = require('../models/Transaction');

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// MySQL pool
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'payment_gateway'
});

// Helper function to send email
async function sendEmail(to, subject, text) {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      text
    });
    console.log('✅ Email sent successfully');
  } catch (err) {
    console.error('❌ Email error:', err);
  }
}

// Helper function to update payment status
async function updatePaymentStatus(paymentIntent, status) {
  const conn = await pool.getConnection();
  try {
    // Update MySQL
    await conn.execute(
      'UPDATE payments SET status = ? WHERE stripe_payment_id = ?',
      [status, paymentIntent.id]
    );

    // Get payment details
    const [payment] = await conn.execute(
      'SELECT * FROM payments WHERE stripe_payment_id = ?',
      [paymentIntent.id]
    );

    if (payment && payment[0]) {
      // Update MongoDB
      await Transaction.findOneAndUpdate(
        { 'metadata.stripePaymentId': paymentIntent.id },
        { status: status }
      );

      // Get user email
      const [user] = await conn.execute(
        'SELECT email FROM users WHERE id = ?',
        [payment[0].user_id]
      );

      if (user && user[0]) {
        // Send email notification
        const amount = payment[0].amount;
        let message = '';
        
        switch(status) {
          case 'succeeded':
            message = `Your payment of $${amount} was successful.`;
            break;
          case 'failed':
            message = `Your payment of $${amount} failed. Please try again.`;
            break;
          case 'refunded':
            message = `Your payment of $${amount} has been refunded.`;
            break;
        }

        await sendEmail(
          user[0].email,
          `Payment ${status} - Payment Gateway`,
          message
        );
      }
    }
  } finally {
    conn.release();
  }
}

// Webhook endpoint
router.post('/', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await updatePaymentStatus(event.data.object, 'succeeded');
        break;
      case 'payment_intent.payment_failed':
        await updatePaymentStatus(event.data.object, 'failed');
        break;
      case 'charge.refunded':
        await updatePaymentStatus(event.data.object.payment_intent, 'refunded');
        break;
    }

    res.json({received: true});
  } catch (err) {
    console.error('❌ Webhook processing failed:', err);
    res.status(500).send(`Webhook Error: ${err.message}`);
  }
});

module.exports = router;