-- ============================================
-- Demo Data for Authentication Database
-- ============================================
-- Creates sample users and groups for testing
--
-- Demo Users:
--   admin@example.com     / password123  (admin)
--   alice@example.com     / password123  (mgmt, dev)
--   bob@example.com       / password123  (dev)
--   carol@example.com     / password123  (view)
--   guest@example.com     / password123  (No groups)
--
-- Demo Groups:
--   admin, mgmt, dev, view
-- ============================================

-- Create demo groups
INSERT INTO groups (name) VALUES
  ('mgmt'),
  ('dev'),
  ('view')
ON CONFLICT (name) DO NOTHING;

-- Create demo users (password: "password123" - bcrypt hash)
-- NOTE: All users have the same password for demo purposes
-- Hash generated with: bcrypt.hash('password123', 10)
-- DO NOT MODIFY THIS HASH - it is a valid bcrypt hash for "password123"
INSERT INTO users (email, name, password, "isActive", "isVerified", "providerKey") VALUES
  (
    'admin@example.com',
    'Admin User',
    '$2b$10$D1uRNCPaTbY7BefZ62LqUe84fh4ZSwnv4zjGZEEm/7nnWeGBJGFnu',
    true,
    true,
    'local'
  ),
  (
    'alice@example.com',
    'Alice Johnson',
    '$2b$10$D1uRNCPaTbY7BefZ62LqUe84fh4ZSwnv4zjGZEEm/7nnWeGBJGFnu',
    true,
    true,
    'local'
  ),
  (
    'bob@example.com',
    'Bob Smith',
    '$2b$10$D1uRNCPaTbY7BefZ62LqUe84fh4ZSwnv4zjGZEEm/7nnWeGBJGFnu',
    true,
    true,
    'local'
  ),
  (
    'carol@example.com',
    'Carol Williams',
    '$2b$10$D1uRNCPaTbY7BefZ62LqUe84fh4ZSwnv4zjGZEEm/7nnWeGBJGFnu',
    true,
    true,
    'local'
  ),
  (
    'guest@example.com',
    'Guest User',
    '$2b$10$D1uRNCPaTbY7BefZ62LqUe84fh4ZSwnv4zjGZEEm/7nnWeGBJGFnu',
    true,
    true,
    'local'
  )
ON CONFLICT (email) DO NOTHING;

-- Assign users to groups
-- Admin: admin
INSERT INTO "userGroups" ("userId", "groupId")
SELECT u.id, g.id
FROM users u, groups g
WHERE u.email = 'admin@example.com' AND g.name = 'admin'
ON CONFLICT DO NOTHING;

-- Alice: mgmt, dev
INSERT INTO "userGroups" ("userId", "groupId")
SELECT u.id, g.id
FROM users u, groups g
WHERE u.email = 'alice@example.com' AND g.name IN ('mgmt', 'dev')
ON CONFLICT DO NOTHING;

-- Bob: dev
INSERT INTO "userGroups" ("userId", "groupId")
SELECT u.id, g.id
FROM users u, groups g
WHERE u.email = 'bob@example.com' AND g.name = 'dev'
ON CONFLICT DO NOTHING;

-- Carol: view
INSERT INTO "userGroups" ("userId", "groupId")
SELECT u.id, g.id
FROM users u, groups g
WHERE u.email = 'carol@example.com' AND g.name = 'view'
ON CONFLICT DO NOTHING;

-- Guest: No groups (empty memberships)

-- Display summary
DO $$
DECLARE
  user_count INTEGER;
  group_count INTEGER;
  membership_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO user_count FROM users;
  SELECT COUNT(*) INTO group_count FROM groups;
  SELECT COUNT(*) INTO membership_count FROM "userGroups";

  RAISE NOTICE '';
  RAISE NOTICE '==========================================';
  RAISE NOTICE '  Demo Data Seeded Successfully';
  RAISE NOTICE '==========================================';
  RAISE NOTICE '  Users: %', user_count;
  RAISE NOTICE '  Groups: %', group_count;
  RAISE NOTICE '  Memberships: %', membership_count;
  RAISE NOTICE '';
  RAISE NOTICE '  Demo Accounts:';
  RAISE NOTICE '    admin@example.com  (admin)';
  RAISE NOTICE '    alice@example.com  (mgmt, dev)';
  RAISE NOTICE '    bob@example.com    (dev)';
  RAISE NOTICE '    carol@example.com  (view)';
  RAISE NOTICE '    guest@example.com  (No groups)';
  RAISE NOTICE '';
  RAISE NOTICE '  All passwords: password123';
  RAISE NOTICE '';
  RAISE NOTICE '  ⚠️  SECURITY WARNING:';
  RAISE NOTICE '    These are DEMO accounts only!';
  RAISE NOTICE '    Delete or change passwords for production use.';
  RAISE NOTICE '';
  RAISE NOTICE '  Next steps:';
  RAISE NOTICE '    1. Start auth-service.js';
  RAISE NOTICE '    2. Visit http://localhost:3004';
  RAISE NOTICE '    3. Login with any demo account';
  RAISE NOTICE '';
  RAISE NOTICE '==========================================';
  RAISE NOTICE '';
END $$;
