#!/usr/bin/env node

/**
 * Wiki.js JWT Authentication Service
 *
 * Independent login/logout service that generates Wiki.js-compatible JWT tokens.
 * Uses the Wiki.js database for user credentials and RSA private key for signing.
 *
 * Usage: node auth-service.js
 * Listens on: http://localhost:3004
 */

const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static('public'));

// Database connection
const pool = new Pool({
  host: 'localhost',
  database: 'wikijs',
  user: 'wikijs',
  password: 'wikijspassword',
  port: 5432
});

// RSA Private Key (loaded dynamically from database at startup)
let JWT_PRIVATE_KEY = null;
let JWT_PASSPHRASE = null;

/**
 * Initialize JWT private key from Wiki.js database
 * Wiki.js uses RS256 (RSA) for JWT signing
 */
async function initializePrivateKey() {
  try {
    const result = await pool.query(
      "SELECT value::text FROM settings WHERE key = 'certs'"
    );

    if (result.rows.length === 0) {
      throw new Error('certs not found in database');
    }

    const valueStr = result.rows[0].value;
    const certsData = JSON.parse(valueStr);
    JWT_PRIVATE_KEY = certsData.private;

    // Check if private key is encrypted (contains "ENCRYPTED" header)
    if (JWT_PRIVATE_KEY.includes('ENCRYPTED')) {
      // Load sessionSecret as passphrase for encrypted private key
      const secretResult = await pool.query(
        "SELECT value::text FROM settings WHERE key = 'sessionSecret'"
      );
      const secretData = JSON.parse(secretResult.rows[0].value);
      JWT_PASSPHRASE = secretData.v;
      console.log('✓ JWT private key loaded from database (encrypted, using passphrase)');
    } else {
      console.log('✓ JWT private key loaded from database');
    }
  } catch (err) {
    console.error('❌ Failed to load JWT private key:', err.message);
    process.exit(1);
  }
}

// Test database connection on startup
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
    process.exit(1);
  } else {
    console.log('✓ Database connected');
  }
});

/**
 * POST /api/login
 * Authenticates user and creates JWT token
 */
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  console.log(`[${new Date().toISOString()}] LOGIN REQUEST:`);
  console.log(`  Email: ${email}`);

  if (!email || !password) {
    console.log(`  Result: ❌ DENIED (missing credentials)`);
    return res.status(400).json({
      success: false,
      message: 'Email and password required'
    });
  }

  try {
    // Query user from database
    const result = await pool.query(`
      SELECT
        id,
        email,
        name,
        password,
        "isActive",
        "isVerified"
      FROM users
      WHERE email = $1 AND "providerKey" = 'local'
    `, [email]);

    if (result.rows.length === 0) {
      console.log(`  Result: ❌ DENIED (user not found)`);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const user = result.rows[0];

    // Check if user is active
    if (!user.isActive) {
      console.log(`  Result: ❌ DENIED (user inactive)`);
      return res.status(401).json({
        success: false,
        message: 'Account is inactive'
      });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      console.log(`  Result: ❌ DENIED (invalid password)`);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Get user groups
    const groupsResult = await pool.query(`
      SELECT g.id
      FROM groups g
      JOIN "userGroups" ug ON g.id = ug."groupId"
      WHERE ug."userId" = $1
    `, [user.id]);

    const groups = groupsResult.rows.map(row => row.id);

    // Create JWT payload with essential claims
    const payload = {
      id: user.id,
      email: user.email,
      name: user.name,
      groups: groups,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (60 * 60), // 1 hour expiration
      aud: 'urn:wiki.js',  // Standard JWT audience claim
      iss: 'urn:wiki.js'   // Standard JWT issuer claim
    };

    // Sign JWT with RSA private key
    const signOptions = {
      algorithm: 'RS256'
    };

    // If private key is encrypted, include passphrase
    const privateKeyObj = JWT_PASSPHRASE
      ? { key: JWT_PRIVATE_KEY, passphrase: JWT_PASSPHRASE }
      : JWT_PRIVATE_KEY;

    const token = jwt.sign(payload, privateKeyObj, signOptions);

    // Set cookie (matching Wiki.js cookie settings)
    res.cookie('jwt', token, {
      httpOnly: true,
      secure: false, // Set to true in production with HTTPS
      sameSite: 'lax',
      maxAge: 60 * 60 * 1000 // 1 hour
    });

    console.log(`  User: ${user.email} (ID: ${user.id})`);
    console.log(`  Groups: ${groups.join(', ') || 'none'}`);
    console.log(`  Result: ✅ LOGIN SUCCESS`);

    return res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        groups: groups
      }
    });

  } catch (err) {
    console.error(`  Result: ❌ ERROR:`, err.message);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * POST /api/logout
 * Clears JWT cookie
 */
app.post('/api/logout', (req, res) => {
  console.log(`[${new Date().toISOString()}] LOGOUT REQUEST`);

  res.clearCookie('jwt', {
    httpOnly: true,
    secure: false,
    sameSite: 'lax'
  });

  console.log(`  Result: ✅ LOGOUT SUCCESS`);

  return res.json({
    success: true,
    message: 'Logout successful'
  });
});

/**
 * GET /api/verify
 * Verifies current JWT token
 */
app.get('/api/verify', async (req, res) => {
  const token = req.cookies.jwt;

  if (!token) {
    return res.status(401).json({
      success: false,
      authenticated: false,
      message: 'No token found'
    });
  }

  try {
    // Load public key for verification
    const result = await pool.query(
      "SELECT value::text FROM settings WHERE key = 'certs'"
    );
    const certsData = JSON.parse(result.rows[0].value);
    const publicKey = certsData.public;

    // Verify token
    const decoded = jwt.verify(token, publicKey, {
      algorithms: ['RS256']
    });

    return res.json({
      success: true,
      authenticated: true,
      user: {
        id: decoded.id,
        email: decoded.email,
        name: decoded.name,
        groups: decoded.groups
      }
    });

  } catch (err) {
    return res.status(401).json({
      success: false,
      authenticated: false,
      message: 'Invalid or expired token'
    });
  }
});

// Login page is served by static middleware (public/index.html)

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Start server (after initializing JWT private key)
const PORT = 3004;

async function startServer() {
  await initializePrivateKey();

  app.listen(PORT, () => {
    console.log('');
    console.log('==========================================');
    console.log('  Wiki.js JWT Authentication Service');
    console.log('==========================================');
    console.log(`  Listening on: http://localhost:${PORT}`);
    console.log(`  Database: wikijs@localhost:5432`);
    console.log(`  JWT Signing: RS256 (RSA Private Key)`);
    console.log('');
    console.log('  Endpoints:');
    console.log('    GET  /           - Login page');
    console.log('    POST /api/login  - Authenticate user');
    console.log('    POST /api/logout - Clear session');
    console.log('    GET  /api/verify - Verify token');
    console.log('');
    console.log('  Press Ctrl+C to stop');
    console.log('==========================================');
    console.log('');
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nShutting down...');
  pool.end(() => {
    console.log('Database pool closed');
    process.exit(0);
  });
});
