-- ============================================
-- Minimal Authentication Database Schema
-- ============================================
-- This schema provides the minimal tables needed for:
-- - wikijs-jwt-auth: JWT authentication service
-- - wikijs-secure-assets: Group-based asset authorization
--
-- Compatible with Wiki.js database structure but can
-- be used completely independently.
-- ============================================

-- Settings table: Stores RSA keys and secrets
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL
);

COMMENT ON TABLE settings IS 'Configuration settings including RSA keys and session secrets';
COMMENT ON COLUMN settings.key IS 'Setting identifier (e.g., "certs", "sessionSecret")';
COMMENT ON COLUMN settings.value IS 'JSON value containing setting data';

-- Users table: User accounts and credentials
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password TEXT NOT NULL,
  "isActive" BOOLEAN DEFAULT true,
  "isVerified" BOOLEAN DEFAULT true,
  "providerKey" TEXT DEFAULT 'local',
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE users IS 'User accounts with bcrypt-hashed passwords';
COMMENT ON COLUMN users.email IS 'Unique email address for login';
COMMENT ON COLUMN users.password IS 'Bcrypt hash of user password';
COMMENT ON COLUMN users."isActive" IS 'Whether user account is active';
COMMENT ON COLUMN users."isVerified" IS 'Whether email is verified';
COMMENT ON COLUMN users."providerKey" IS 'Authentication provider (local, oauth, etc)';

-- Groups table: Permission groups
CREATE TABLE IF NOT EXISTS groups (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE groups IS 'Permission groups for authorization';
COMMENT ON COLUMN groups.name IS 'Unique group name';

-- User-Group junction table: Many-to-many relationship
CREATE TABLE IF NOT EXISTS "userGroups" (
  "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "groupId" INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY ("userId", "groupId")
);

COMMENT ON TABLE "userGroups" IS 'User membership in groups';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_provider ON users("providerKey");
CREATE INDEX IF NOT EXISTS idx_usergroups_userid ON "userGroups"("userId");
CREATE INDEX IF NOT EXISTS idx_usergroups_groupid ON "userGroups"("groupId");

-- Create default admin group
INSERT INTO groups (name) VALUES ('admin')
ON CONFLICT (name) DO NOTHING;

-- Display summary
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '==========================================';
  RAISE NOTICE '  Authentication Database Schema Created';
  RAISE NOTICE '==========================================';
  RAISE NOTICE '  Tables: settings, users, groups, userGroups';
  RAISE NOTICE '  Default group: admin';
  RAISE NOTICE '';
  RAISE NOTICE '  Next steps:';
  RAISE NOTICE '    1. Run generate-keys.js to create RSA keys';
  RAISE NOTICE '    2. Run seed-demo-data.sql for demo users';
  RAISE NOTICE '';
  RAISE NOTICE '  Or use: ./init-database.sh (all-in-one)';
  RAISE NOTICE '==========================================';
  RAISE NOTICE '';
END $$;
