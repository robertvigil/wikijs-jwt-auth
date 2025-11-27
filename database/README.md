# Standalone Authentication Database Setup

This directory contains everything needed to create an **independent authentication database** that works with the JWT authentication service - no Wiki.js installation required.

## Quick Start

### One-Command Setup

```bash
cd database/
./init-database.sh
```

This will:
1. ✅ Create PostgreSQL database (`auth_db`) and user (`auth_user`)
2. ✅ Create schema (4 tables: settings, users, groups, userGroups)
3. ✅ Generate RSA key pair and session secret
4. ✅ Seed demo users and groups

**That's it!** Your standalone auth database is ready.

---

## What Gets Created

### Database
- **Name**: `auth_db`
- **User**: `auth_user` / `auth_password`
- **Host**: `localhost:5432`

### Tables
| Table | Purpose |
|-------|---------|
| `settings` | RSA keys, session secrets |
| `users` | User accounts (bcrypt passwords) |
| `groups` | Permission groups |
| `userGroups` | User-group memberships |

### Demo Accounts

| Email | Password | Groups |
|-------|----------|--------|
| admin@example.com | password123 | Administrators |
| alice@example.com | password123 | Managers, Developers |
| bob@example.com | password123 | Developers |
| carol@example.com | password123 | Viewers |
| guest@example.com | password123 | *(none)* |

---

## Manual Setup (Step-by-Step)

If you prefer manual control or need to customize the setup:

### Step 1: Create Database and User

```bash
sudo -u postgres psql
```

```sql
CREATE USER auth_user WITH PASSWORD 'auth_password';
CREATE DATABASE auth_db OWNER auth_user;
\q
```

### Step 2: Create Schema

```bash
psql -U auth_user -d auth_db -f schema.sql
```

Creates tables, indexes, and the default "Administrators" group.

### Step 3: Generate RSA Keys

```bash
node generate-keys.js
```

Generates:
- 2048-bit RSA key pair (public + private)
- 256-bit random session secret
- Stores in `settings` table

**For encrypted private key:**
```bash
node generate-keys.js --encrypted
```

### Step 4: Seed Demo Data (Optional)

```bash
psql -U auth_user -d auth_db -f seed-demo-data.sql
```

Creates 5 demo users and 4 groups.

---

## Configuration

### Environment Variables

Override defaults using environment variables:

```bash
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=auth_db
export DB_USER=auth_user
export DB_PASSWORD=auth_password

./init-database.sh
```

### Auth Service Configuration

Update `../config.js` to point to your standalone database:

```javascript
module.exports = {
  database: {
    host: 'localhost',
    port: 5432,
    database: 'auth_db',      // Standalone database
    user: 'auth_user',
    password: 'auth_password'
  }
};
```

---

## Advanced Options

### Drop and Recreate Database

```bash
./init-database.sh --drop
```

**⚠️ WARNING**: This deletes all existing data!

### Skip Demo Data

```bash
./init-database.sh --no-demo
```

Creates empty database (just schema and RSA keys).

### Encrypted Private Key

```bash
./init-database.sh --encrypted
```

Encrypts the RSA private key with the session secret as passphrase.

### Combine Options

```bash
./init-database.sh --drop --encrypted --no-demo
```

---

## Schema Reference

### settings Table

```sql
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL
);
```

**Required rows:**
- `certs` - RSA public/private key pair (PEM format)
- `sessionSecret` - Random hex string for encryption

### users Table

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password TEXT NOT NULL,           -- bcrypt hash
  "isActive" BOOLEAN DEFAULT true,
  "isVerified" BOOLEAN DEFAULT true,
  "providerKey" TEXT DEFAULT 'local',
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);
```

### groups Table

```sql
CREATE TABLE groups (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);
```

### userGroups Table

```sql
CREATE TABLE "userGroups" (
  "userId" INTEGER REFERENCES users(id) ON DELETE CASCADE,
  "groupId" INTEGER REFERENCES groups(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY ("userId", "groupId")
);
```

---

## Adding Users and Groups

### Create a New User

```sql
-- Generate bcrypt hash for password
-- In Node.js: bcrypt.hash('your_password', 10)

INSERT INTO users (email, name, password)
VALUES (
  'newuser@example.com',
  'New User',
  '$2b$10$hash_here'
);
```

### Create a New Group

```sql
INSERT INTO groups (name) VALUES ('Sales');
```

### Add User to Group

```sql
INSERT INTO "userGroups" ("userId", "groupId")
SELECT u.id, g.id
FROM users u, groups g
WHERE u.email = 'newuser@example.com' AND g.name = 'Sales';
```

---

## Verification

### Check Database

```bash
psql -U auth_user -d auth_db
```

```sql
-- List users
SELECT id, email, name, "isActive" FROM users;

-- List groups
SELECT id, name FROM groups;

-- Show user memberships
SELECT u.email, g.name
FROM users u
JOIN "userGroups" ug ON u.id = ug."userId"
JOIN groups g ON ug."groupId" = g.id
ORDER BY u.email, g.name;

-- Verify settings exist
SELECT key FROM settings;
```

### Test RSA Keys

```bash
psql -U auth_user -d auth_db -c "SELECT key FROM settings;"
```

Should show:
```
     key
--------------
 certs
 sessionSecret
```

---

## Troubleshooting

### PostgreSQL Not Running

```bash
sudo systemctl start postgresql
# or
brew services start postgresql  # macOS
```

### Permission Denied

Make sure scripts are executable:
```bash
chmod +x init-database.sh generate-keys.js
```

### Database Already Exists

Drop and recreate:
```bash
./init-database.sh --drop
```

Or manually:
```bash
sudo -u postgres psql -c "DROP DATABASE auth_db;"
sudo -u postgres psql -c "DROP USER auth_user;"
```

### Can't Connect to Database

Check PostgreSQL is accepting connections:
```bash
pg_isready -h localhost -p 5432
```

Verify `pg_hba.conf` allows local connections (should have `md5` or `trust` for local).

---

## Production Considerations

### Security Checklist

- [ ] Delete or disable demo accounts
- [ ] Use encrypted private key (`--encrypted`)
- [ ] Change database password from default
- [ ] Restrict database network access (firewall)
- [ ] Enable PostgreSQL SSL connections
- [ ] Set up regular backups
- [ ] Use environment variables for credentials (never commit passwords)

### Backup Database

```bash
pg_dump -U auth_user -d auth_db > auth_db_backup.sql
```

### Restore Database

```bash
psql -U auth_user -d auth_db < auth_db_backup.sql
```

### Migrate RSA Keys

To use existing RSA keys from another system:

```sql
-- Extract keys from old system
SELECT value FROM settings WHERE key = 'certs';
SELECT value FROM settings WHERE key = 'sessionSecret';

-- Insert into new database
INSERT INTO settings (key, value) VALUES
  ('certs', '{"public":"...","private":"..."}'),
  ('sessionSecret', '{"v":"..."}');
```

---

## Files in This Directory

| File | Purpose |
|------|---------|
| `schema.sql` | Database schema (tables, indexes) |
| `generate-keys.js` | RSA key pair generator |
| `seed-demo-data.sql` | Demo users and groups |
| `init-database.sh` | One-command setup script |
| `README.md` | This documentation |

---

## Next Steps

After database setup:

1. **Configure auth service**: Update `../config.js` with database credentials
2. **Start auth service**: `cd .. && node auth-service.js`
3. **Test login**: Visit `http://localhost:3004` and login with demo account
4. **Integrate with apps**: Use JWT tokens for authentication

---

## Comparison: Standalone vs Wiki.js Database

| Feature | Standalone DB | Wiki.js DB |
|---------|--------------|------------|
| **Setup** | Run `init-database.sh` | Install Wiki.js |
| **Tables** | 4 tables | 30+ tables |
| **Size** | < 1 MB | 100+ MB |
| **Purpose** | Auth only | Full wiki + auth |
| **Maintenance** | Minimal | Regular updates |
| **Dependencies** | PostgreSQL only | Wiki.js + dependencies |

**Use standalone if:** You only need authentication/authorization without Wiki.js features

**Use Wiki.js DB if:** You're already running Wiki.js and want to leverage existing users
