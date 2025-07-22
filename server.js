require('dotenv').config();

//  Load passport strategy (register strategy)
const passport = require('passport');
require('./config/passport');

const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const mysql = require('mysql2');

const app = express();

// Middleware
app.use(cors());

// Webhook route should come BEFORE express.json middleware
app.use('/api/webhooks', require('./routes/webhooks'));

app.use(express.json());
app.use(express.static('public'));
app.use(passport.initialize());

//  MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/payment_gateway', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log(' MongoDB Connected'))
.catch(err => console.error('MongoDB connection error:', err));

// MySQL test connection (optional)
const mysqlConnection = mysql.createConnection({
  host: process.env.MYSQL_HOST || 'localhost',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || 'root',
  database: process.env.MYSQL_DATABASE || 'payment_gateway'
});
mysqlConnection.connect(err => {
  if (err) console.error(' MySQL connection error:', err);
  else console.log(' MySQL Connected');
});

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.use('/api/auth', require('./routes/auth'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/webhooks', require('./routes/webhooks')); // Add this line

// Global error handler
app.use((err, req, res, next) => {
  console.error(' Internal server error:', err.stack);
  res.status(500).json({ msg: 'Something broke!' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(` Server running on port ${PORT}`));
