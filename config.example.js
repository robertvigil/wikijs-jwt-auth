/**
 * Configuration Example
 *
 * Copy the relevant sections to auth-service.js and update with your values
 *
 * DEPLOYMENT MODES:
 * 1. Wiki.js Database Mode - Connect to existing Wiki.js database
 * 2. Standalone Mode - Use independent auth database (see database/README.md)
 */

// ============================================
// Database Configuration
// ============================================
// Find: const pool = new Pool({ ... })
// Location: Near the top of auth-service.js, after imports

// OPTION 1: Wiki.js Database Mode
// Use this if you have an existing Wiki.js installation
const wikiJsDatabaseConfig = {
  host: 'localhost',              // PostgreSQL host
  database: 'wikijs',             // Existing Wiki.js database
  user: 'wikijs',                 // Database user
  password: 'your_password_here', // Database password
  port: 5432                      // PostgreSQL port
};

// OPTION 2: Standalone Database Mode
// Use this if you ran database/init-database.sh to create independent auth DB
const standaloneDatabaseConfig = {
  host: 'localhost',              // PostgreSQL host
  database: 'auth_db',            // Standalone auth database
  user: 'auth_user',              // Database user
  password: 'auth_password',      // Database password (set during init-database.sh)
  port: 5432                      // PostgreSQL port
};

// ============================================
// Server Configuration
// ============================================
// Find: const PORT =
// Location: Near the bottom of auth-service.js

const PORT = 3004;  // Port for auth service to listen on

// ============================================
// JWT/Cookie Configuration
// ============================================
// Find: res.cookie('jwt', token, { ... })
// Location: In the /api/login route handler

const cookieConfig = {
  httpOnly: true,           // Prevent JavaScript access (security)
  secure: false,            // Set to true for HTTPS in production
  sameSite: 'lax',          // CSRF protection
  domain: undefined,        // Set to '.yourdomain.com' for subdomain cookie sharing
  maxAge: 60 * 60 * 1000   // 1 hour in milliseconds
};

// ============================================
// JWT Expiration
// ============================================
// Find: exp: Math.floor(Date.now() / 1000) + ...
// Location: In the /api/login route, JWT payload creation

const jwtExpiration = 60 * 60;  // 1 hour in seconds
