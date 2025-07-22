// config/passport.js
const passport = require('passport');
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const mysql = require('mysql2/promise');

// MySQL connection pool
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'payment_gateway'
});

const opts = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET
};

passport.use(new JwtStrategy(opts, async (jwt_payload, done) => {
  try {
    const connection = await pool.getConnection();
    const [users] = await connection.execute('SELECT * FROM users WHERE id = ?', [jwt_payload.user.id]);
    connection.release();

    if (users.length > 0) return done(null, users[0]);
    return done(null, false);
  } catch (err) {
    return done(err, false);
  }
}));

// ✅ Don't export anything
// Just leave it like this
