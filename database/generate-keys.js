#!/usr/bin/env node

/**
 * RSA Key Pair Generator for JWT Authentication
 *
 * Generates:
 * - 2048-bit RSA key pair (private + public)
 * - Random session secret (256-bit hex)
 * - Inserts into settings table
 *
 * Usage: node generate-keys.js [--encrypted]
 *
 * Options:
 *   --encrypted    Generate encrypted private key with passphrase
 */

const crypto = require('crypto');
const { Pool } = require('pg');

// Parse command line arguments
const ENCRYPTED = process.argv.includes('--encrypted');

// Database configuration
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'auth_db',
  user: process.env.DB_USER || 'auth_user',
  password: process.env.DB_PASSWORD || 'auth_password',
  port: parseInt(process.env.DB_PORT || '5432')
};

console.log('');
console.log('==========================================');
console.log('  RSA Key Pair Generator');
console.log('==========================================');
console.log(`  Database: ${DB_CONFIG.database}@${DB_CONFIG.host}:${DB_CONFIG.port}`);
console.log(`  Key type: ${ENCRYPTED ? 'Encrypted RSA' : 'Unencrypted RSA'}`);
console.log('==========================================');
console.log('');

async function generateKeys() {
  const pool = new Pool(DB_CONFIG);

  try {
    // Test database connection
    console.log('🔌 Testing database connection...');
    await pool.query('SELECT NOW()');
    console.log('✓ Database connected\n');

    // Generate session secret (256-bit random hex)
    console.log('🔐 Generating session secret...');
    const sessionSecret = crypto.randomBytes(32).toString('hex');
    console.log(`✓ Session secret: ${sessionSecret.substring(0, 16)}...`);
    console.log('');

    // Generate RSA key pair
    console.log('🔑 Generating 2048-bit RSA key pair...');
    console.log('   (This may take a few seconds...)');

    const keyOptions = {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    };

    // Add encryption if requested
    if (ENCRYPTED) {
      keyOptions.privateKeyEncoding.cipher = 'aes-256-cbc';
      keyOptions.privateKeyEncoding.passphrase = sessionSecret;
    }

    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', keyOptions);

    console.log('✓ RSA key pair generated');
    console.log(`   Public key: ${publicKey.split('\n')[0]}`);
    console.log(`   Private key: ${privateKey.split('\n')[0]}`);
    if (ENCRYPTED) {
      console.log('   Private key is encrypted with session secret');
    }
    console.log('');

    // Insert certs into database
    console.log('💾 Storing RSA keys in database...');
    const certsValue = {
      public: publicKey,
      private: privateKey
    };

    await pool.query(
      `INSERT INTO settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = $2`,
      ['certs', JSON.stringify(certsValue)]
    );
    console.log('✓ RSA keys stored in settings table');
    console.log('');

    // Insert session secret into database
    console.log('💾 Storing session secret in database...');
    const secretValue = { v: sessionSecret };

    await pool.query(
      `INSERT INTO settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = $2`,
      ['sessionSecret', JSON.stringify(secretValue)]
    );
    console.log('✓ Session secret stored in settings table');
    console.log('');

    // Verify settings were stored
    const result = await pool.query(
      `SELECT key FROM settings WHERE key IN ('certs', 'sessionSecret')`
    );
    console.log('📋 Settings in database:');
    result.rows.forEach(row => {
      console.log(`   ✓ ${row.key}`);
    });
    console.log('');

    console.log('==========================================');
    console.log('  ✅ Key generation complete!');
    console.log('==========================================');
    console.log('');
    console.log('  Next steps:');
    console.log('    1. Run seed-demo-data.sql to create demo users');
    console.log('    2. Start auth-service.js');
    console.log('');
    console.log('  Security notes:');
    if (ENCRYPTED) {
      console.log('    • Private key is encrypted with session secret');
      console.log('    • Auth service will use session secret as passphrase');
    } else {
      console.log('    • Private key is unencrypted (use --encrypted for production)');
    }
    console.log('    • Keep database backups secure');
    console.log('    • Never commit keys to version control');
    console.log('');
    console.log('==========================================');
    console.log('');

  } catch (err) {
    console.error('');
    console.error('❌ Error:', err.message);
    console.error('');

    if (err.code === 'ECONNREFUSED') {
      console.error('Database connection refused. Make sure:');
      console.error('  1. PostgreSQL is running');
      console.error('  2. Database exists (run schema.sql first)');
      console.error('  3. Credentials are correct');
      console.error('');
    } else if (err.code === '42P01') {
      console.error('Settings table does not exist.');
      console.error('  Run schema.sql first: psql -d auth_db -f schema.sql');
      console.error('');
    }

    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run
generateKeys();
