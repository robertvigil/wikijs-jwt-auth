#!/usr/bin/env node

/**
 * Admin CLI Tool for STANDALONE Authentication Database
 *
 * ⚠️  WARNING: This tool is ONLY for standalone auth databases (auth_db).
 * ⚠️  DO NOT use with Wiki.js databases - use Wiki.js's admin interface instead.
 *
 * Manage users, groups, and memberships for the standalone authentication system.
 *
 * Usage:
 *   node admin.js <command> [options]
 *
 * Commands:
 *   user:create <email> <name>          Create new user
 *   user:list                           List all users
 *   user:delete <email>                 Delete user
 *   user:set-password <email>           Change user password
 *   user:activate <email>               Activate user account
 *   user:deactivate <email>             Deactivate user account
 *
 *   group:create <name>                 Create new group
 *   group:list                          List all groups
 *   group:delete <name>                 Delete group
 *
 *   membership:add <email> <group>      Add user to group
 *   membership:remove <email> <group>   Remove user from group
 *   membership:list <email>             List user's groups
 *
 * Environment Variables:
 *   DB_HOST     Database host (default: localhost)
 *   DB_PORT     Database port (default: 5432)
 *   DB_NAME     Database name (default: auth_db)
 *   DB_USER     Database user (default: auth_user)
 *   DB_PASSWORD Database password (default: auth_password)
 */

const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const readline = require('readline');

// Database configuration
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'auth_db',
  user: process.env.DB_USER || 'auth_user',
  password: process.env.DB_PASSWORD || 'auth_password'
});

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Helper: Prompt for password input (hidden)
function promptPassword(prompt) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question(prompt, (password) => {
      rl.close();
      resolve(password);
    });

    // Hide password input
    rl._writeToOutput = function _writeToOutput(stringToWrite) {
      if (stringToWrite.charCodeAt(0) === 13) {
        rl.output.write('\n');
      } else if (stringToWrite === prompt) {
        rl.output.write(stringToWrite);
      }
    };
  });
}

// Helper: Format output
function success(message) {
  console.log(`${colors.green}✓${colors.reset} ${message}`);
}

function error(message) {
  console.error(`${colors.red}✗${colors.reset} ${message}`);
}

function info(message) {
  console.log(`${colors.blue}ℹ${colors.reset} ${message}`);
}

function warn(message) {
  console.log(`${colors.yellow}⚠${colors.reset} ${message}`);
}

// User Commands
async function userCreate(email, name) {
  try {
    // Validate email
    if (!email || !email.includes('@')) {
      throw new Error('Invalid email address');
    }

    // Check if user exists
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      throw new Error(`User ${email} already exists`);
    }

    // Prompt for password
    const password = await promptPassword('Enter password: ');
    const passwordConfirm = await promptPassword('Confirm password: ');

    if (password !== passwordConfirm) {
      throw new Error('Passwords do not match');
    }

    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    // Hash password
    info('Hashing password...');
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert user
    const result = await pool.query(
      `INSERT INTO users (email, name, password, "isActive", "isVerified", "providerKey")
       VALUES ($1, $2, $3, true, true, 'local')
       RETURNING id, email, name`,
      [email, name, passwordHash]
    );

    const user = result.rows[0];
    success(`User created: ${user.email} (ID: ${user.id})`);
  } catch (err) {
    error(`Failed to create user: ${err.message}`);
    process.exit(1);
  }
}

async function userList() {
  try {
    const result = await pool.query(`
      SELECT
        u.id,
        u.email,
        u.name,
        u."isActive",
        u."isVerified",
        u."createdAt",
        array_agg(g.name ORDER BY g.name) FILTER (WHERE g.name IS NOT NULL) as groups
      FROM users u
      LEFT JOIN "userGroups" ug ON u.id = ug."userId"
      LEFT JOIN groups g ON ug."groupId" = g.id
      GROUP BY u.id, u.email, u.name, u."isActive", u."isVerified", u."createdAt"
      ORDER BY u.id
    `);

    if (result.rows.length === 0) {
      warn('No users found');
      return;
    }

    console.log('\n' + colors.cyan + 'Users:' + colors.reset);
    console.log('─'.repeat(80));

    result.rows.forEach(user => {
      const status = user.isActive ? colors.green + 'active' : colors.red + 'inactive';
      const groups = user.groups ? user.groups.join(', ') : colors.yellow + 'none';

      console.log(`ID: ${user.id}`);
      console.log(`  Email:  ${user.email}`);
      console.log(`  Name:   ${user.name}`);
      console.log(`  Status: ${status}${colors.reset}`);
      console.log(`  Groups: ${groups}${colors.reset}`);
      console.log('');
    });

    info(`Total users: ${result.rows.length}`);
  } catch (err) {
    error(`Failed to list users: ${err.message}`);
    process.exit(1);
  }
}

async function userDelete(email) {
  try {
    const result = await pool.query(
      'DELETE FROM users WHERE email = $1 RETURNING id, email',
      [email]
    );

    if (result.rows.length === 0) {
      throw new Error(`User ${email} not found`);
    }

    success(`User deleted: ${email}`);
  } catch (err) {
    error(`Failed to delete user: ${err.message}`);
    process.exit(1);
  }
}

async function userSetPassword(email) {
  try {
    // Check if user exists
    const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      throw new Error(`User ${email} not found`);
    }

    // Prompt for new password
    const password = await promptPassword('Enter new password: ');
    const passwordConfirm = await promptPassword('Confirm new password: ');

    if (password !== passwordConfirm) {
      throw new Error('Passwords do not match');
    }

    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    // Hash password
    info('Hashing password...');
    const passwordHash = await bcrypt.hash(password, 10);

    // Update password
    await pool.query(
      'UPDATE users SET password = $1 WHERE email = $2',
      [passwordHash, email]
    );

    success(`Password updated for: ${email}`);
  } catch (err) {
    error(`Failed to set password: ${err.message}`);
    process.exit(1);
  }
}

async function userActivate(email) {
  try {
    const result = await pool.query(
      'UPDATE users SET "isActive" = true WHERE email = $1 RETURNING email',
      [email]
    );

    if (result.rows.length === 0) {
      throw new Error(`User ${email} not found`);
    }

    success(`User activated: ${email}`);
  } catch (err) {
    error(`Failed to activate user: ${err.message}`);
    process.exit(1);
  }
}

async function userDeactivate(email) {
  try {
    const result = await pool.query(
      'UPDATE users SET "isActive" = false WHERE email = $1 RETURNING email',
      [email]
    );

    if (result.rows.length === 0) {
      throw new Error(`User ${email} not found`);
    }

    warn(`User deactivated: ${email}`);
  } catch (err) {
    error(`Failed to deactivate user: ${err.message}`);
    process.exit(1);
  }
}

// Group Commands
async function groupCreate(name) {
  try {
    // Validate group name (lowercase, no spaces, alphanumeric + dash/underscore)
    if (!/^[a-z0-9_-]+$/.test(name)) {
      throw new Error('Group name must be lowercase alphanumeric (a-z, 0-9, -, _)');
    }

    const result = await pool.query(
      'INSERT INTO groups (name) VALUES ($1) RETURNING id, name',
      [name]
    );

    const group = result.rows[0];
    success(`Group created: ${group.name} (ID: ${group.id})`);
  } catch (err) {
    if (err.code === '23505') { // Unique violation
      error(`Group "${name}" already exists`);
    } else {
      error(`Failed to create group: ${err.message}`);
    }
    process.exit(1);
  }
}

async function groupList() {
  try {
    const result = await pool.query(`
      SELECT
        g.id,
        g.name,
        COUNT(ug."userId") as member_count,
        g."createdAt"
      FROM groups g
      LEFT JOIN "userGroups" ug ON g.id = ug."groupId"
      GROUP BY g.id, g.name, g."createdAt"
      ORDER BY g.name
    `);

    if (result.rows.length === 0) {
      warn('No groups found');
      return;
    }

    console.log('\n' + colors.cyan + 'Groups:' + colors.reset);
    console.log('─'.repeat(60));

    result.rows.forEach(group => {
      console.log(`${colors.green}${group.name}${colors.reset}`);
      console.log(`  ID:      ${group.id}`);
      console.log(`  Members: ${group.member_count}`);
      console.log('');
    });

    info(`Total groups: ${result.rows.length}`);
  } catch (err) {
    error(`Failed to list groups: ${err.message}`);
    process.exit(1);
  }
}

async function groupDelete(name) {
  try {
    // Check if it's the admin group
    if (name === 'admin' || name === 'Administrators') {
      throw new Error('Cannot delete admin group');
    }

    const result = await pool.query(
      'DELETE FROM groups WHERE name = $1 RETURNING id, name',
      [name]
    );

    if (result.rows.length === 0) {
      throw new Error(`Group "${name}" not found`);
    }

    success(`Group deleted: ${name}`);
  } catch (err) {
    error(`Failed to delete group: ${err.message}`);
    process.exit(1);
  }
}

// Membership Commands
async function membershipAdd(email, groupName) {
  try {
    // Get user ID
    const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      throw new Error(`User ${email} not found`);
    }
    const userId = userResult.rows[0].id;

    // Get group ID
    const groupResult = await pool.query('SELECT id FROM groups WHERE name = $1', [groupName]);
    if (groupResult.rows.length === 0) {
      throw new Error(`Group "${groupName}" not found`);
    }
    const groupId = groupResult.rows[0].id;

    // Add membership
    await pool.query(
      'INSERT INTO "userGroups" ("userId", "groupId") VALUES ($1, $2)',
      [userId, groupId]
    );

    success(`Added ${email} to group "${groupName}"`);
  } catch (err) {
    if (err.code === '23505') { // Unique violation
      warn(`User ${email} is already in group "${groupName}"`);
    } else {
      error(`Failed to add membership: ${err.message}`);
      process.exit(1);
    }
  }
}

async function membershipRemove(email, groupName) {
  try {
    const result = await pool.query(
      `DELETE FROM "userGroups" ug
       USING users u, groups g
       WHERE ug."userId" = u.id
         AND ug."groupId" = g.id
         AND u.email = $1
         AND g.name = $2
       RETURNING u.email, g.name`,
      [email, groupName]
    );

    if (result.rows.length === 0) {
      throw new Error(`User ${email} is not in group "${groupName}"`);
    }

    success(`Removed ${email} from group "${groupName}"`);
  } catch (err) {
    error(`Failed to remove membership: ${err.message}`);
    process.exit(1);
  }
}

async function membershipList(email) {
  try {
    const result = await pool.query(
      `SELECT g.name, g.id
       FROM groups g
       JOIN "userGroups" ug ON g.id = ug."groupId"
       JOIN users u ON ug."userId" = u.id
       WHERE u.email = $1
       ORDER BY g.name`,
      [email]
    );

    if (result.rows.length === 0) {
      warn(`User ${email} is not in any groups`);
      return;
    }

    console.log(`\n${colors.cyan}Groups for ${email}:${colors.reset}`);
    result.rows.forEach(group => {
      console.log(`  ${colors.green}${group.name}${colors.reset} (ID: ${group.id})`);
    });
    console.log('');
  } catch (err) {
    error(`Failed to list memberships: ${err.message}`);
    process.exit(1);
  }
}

// Help
function showHelp() {
  console.log(`
${colors.cyan}Admin CLI Tool for STANDALONE Authentication Database${colors.reset}

${colors.red}⚠️  WARNING: For standalone auth_db ONLY!${colors.reset}
${colors.red}   DO NOT use with Wiki.js databases - use Wiki.js's admin interface instead.${colors.reset}

${colors.yellow}Usage:${colors.reset}
  node admin.js <command> [arguments]

${colors.yellow}User Commands:${colors.reset}
  user:create <email> <name>          Create new user (prompts for password)
  user:list                           List all users with groups
  user:delete <email>                 Delete user
  user:set-password <email>           Change user password
  user:activate <email>               Activate user account
  user:deactivate <email>             Deactivate user account

${colors.yellow}Group Commands:${colors.reset}
  group:create <name>                 Create new group (lowercase, no spaces)
  group:list                          List all groups with member counts
  group:delete <name>                 Delete group

${colors.yellow}Membership Commands:${colors.reset}
  membership:add <email> <group>      Add user to group
  membership:remove <email> <group>   Remove user from group
  membership:list <email>             List user's groups

${colors.yellow}Environment Variables:${colors.reset}
  DB_HOST     Database host (default: localhost)
  DB_PORT     Database port (default: 5432)
  DB_NAME     Database name (default: auth_db)
  DB_USER     Database user (default: auth_user)
  DB_PASSWORD Database password (default: auth_password)

${colors.yellow}Examples:${colors.reset}
  node admin.js user:create alice@company.com "Alice Johnson"
  node admin.js group:create finance
  node admin.js membership:add alice@company.com finance
  node admin.js user:list
`);
}

// Main
async function main() {
  const [command, ...args] = process.argv.slice(2);

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    showHelp();
    process.exit(0);
  }

  try {
    // Test database connection
    await pool.query('SELECT NOW()');

    // Warn if database name suggests Wiki.js database
    if (process.env.DB_NAME === 'wikijs' || pool.options.database === 'wikijs') {
      console.log('');
      warn('You are connected to a database named "wikijs"');
      warn('This tool is intended for STANDALONE databases only!');
      warn('Use Wiki.js\'s admin interface to manage Wiki.js users.');
      console.log('');
    }

    switch (command) {
      // User commands
      case 'user:create':
        if (args.length < 2) {
          error('Usage: user:create <email> <name>');
          process.exit(1);
        }
        await userCreate(args[0], args.slice(1).join(' '));
        break;

      case 'user:list':
        await userList();
        break;

      case 'user:delete':
        if (args.length < 1) {
          error('Usage: user:delete <email>');
          process.exit(1);
        }
        await userDelete(args[0]);
        break;

      case 'user:set-password':
        if (args.length < 1) {
          error('Usage: user:set-password <email>');
          process.exit(1);
        }
        await userSetPassword(args[0]);
        break;

      case 'user:activate':
        if (args.length < 1) {
          error('Usage: user:activate <email>');
          process.exit(1);
        }
        await userActivate(args[0]);
        break;

      case 'user:deactivate':
        if (args.length < 1) {
          error('Usage: user:deactivate <email>');
          process.exit(1);
        }
        await userDeactivate(args[0]);
        break;

      // Group commands
      case 'group:create':
        if (args.length < 1) {
          error('Usage: group:create <name>');
          process.exit(1);
        }
        await groupCreate(args[0]);
        break;

      case 'group:list':
        await groupList();
        break;

      case 'group:delete':
        if (args.length < 1) {
          error('Usage: group:delete <name>');
          process.exit(1);
        }
        await groupDelete(args[0]);
        break;

      // Membership commands
      case 'membership:add':
        if (args.length < 2) {
          error('Usage: membership:add <email> <group>');
          process.exit(1);
        }
        await membershipAdd(args[0], args[1]);
        break;

      case 'membership:remove':
        if (args.length < 2) {
          error('Usage: membership:remove <email> <group>');
          process.exit(1);
        }
        await membershipRemove(args[0], args[1]);
        break;

      case 'membership:list':
        if (args.length < 1) {
          error('Usage: membership:list <email>');
          process.exit(1);
        }
        await membershipList(args[0]);
        break;

      default:
        error(`Unknown command: ${command}`);
        console.log('Run "node admin.js help" for usage information');
        process.exit(1);
    }

    await pool.end();
  } catch (err) {
    error(`Database error: ${err.message}`);
    process.exit(1);
  }
}

// Run
if (require.main === module) {
  main().catch(err => {
    error(`Unexpected error: ${err.message}`);
    process.exit(1);
  });
}
