# Wiki.js JWT Authentication Service

Independent authentication service that generates Wiki.js-compatible JWT tokens for **external applications and services**. This service authenticates users against the Wiki.js database and creates properly signed JWT cookies that work with external services like [wikijs-secure-assets](https://github.com/yourusername/wikijs-secure-assets).

## ⚠️ Important Limitations

**This service is NOT intended for Wiki.js web UI login.** It is designed for:
- ✅ Custom applications using Wiki.js user database
- ✅ External services requiring Wiki.js authentication (e.g., wikijs-secure-assets)
- ✅ API access and programmatic authentication
- ✅ Headless/service-to-service authentication

**Not supported:**
- ❌ Wiki.js web interface login (use Wiki.js's built-in login instead)
- ❌ Full Wiki.js session management
- ❌ Wiki.js admin interface access

## Overview

This service provides a REST API for authenticating users against the Wiki.js database without running the full Wiki.js application. It's the perfect companion to wikijs-secure-assets and custom applications.

**Use cases:**
- Custom applications that need to authenticate users from Wiki.js database
- Group-based access control for external resources (like secure assets)
- API authentication for services that integrate with Wiki.js users/groups
- Microservices architecture where authentication is separate from Wiki.js
- Testing/development without running full Wiki.js stack

## How It Works

```
┌─────────────┐
│   User      │
└──────┬──────┘
       │ 1. POST /api/login (email + password)
       ▼
┌─────────────────────────────────┐
│  wikijs-jwt-auth (this service) │
│  - Verify password (bcrypt)      │
│  - Load RSA private key from DB │
│  - Create JWT payload            │
│  - Sign with RS256               │
│  - Set jwt cookie                │
└──────┬──────────────────────────┘
       │ 2. JWT cookie set
       ▼
┌─────────────┐
│   User      │─────┐ 3. Access external services
└─────────────┘     │
                    ▼
          ┌──────────────────────┐
          │   secure-assets      │ ✅ JWT verified (public key)
          │   or                 │
          │   custom app         │ ✅ Access granted
          └──────────────────────┘
```

**Key Process:**

1. **User submits credentials** → Service queries Wiki.js database
2. **Password verified** → bcrypt comparison against stored hash
3. **JWT created** → Signed with RSA private key from Wiki.js database
4. **Cookie set** → JWT cookie created with proper signature
5. **User authenticated** → Can now access external services and secure assets

## Deployment Modes

This service supports **two deployment modes**, choose the one that fits your needs:

### Mode 1: Connect to Existing Wiki.js Database

If you already have Wiki.js running, point this service at your existing database. No additional setup required - users, groups, and RSA keys are already there.

**Best for:**
- 💡 Adding authentication to external services alongside Wiki.js
- 💡 Leveraging existing Wiki.js users and groups
- 💡 Minimal setup - just point and connect

**Setup:** Follow the [Standard Installation](#installation) below.

---

### Mode 2: Standalone Authentication Database

Create an independent authentication database without Wiki.js. This gives you a lightweight auth system with JWT tokens, users, and groups.

**Best for:**
- 💡 Authentication without running full Wiki.js
- 💡 Microservices that only need user management
- 💡 Lightweight deployments (4 tables vs 30+ Wiki.js tables)
- 💡 Custom authentication systems

**Setup:** See [Standalone Database Setup](database/README.md)

**Quick Start (Standalone):**
```bash
cd database/
bash init-database.sh    # Creates auth_db, generates keys, adds demo users
cd ..
# Update config.js to point to auth_db (instead of wikijs)
npm start
```

---

## Admin CLI Tool

**⚠️ For Standalone Database Mode ONLY** - Do not use with Wiki.js databases.

The `admin.js` CLI tool provides easy management of users, groups, and memberships for the standalone authentication database.

### Quick Start

```bash
# List all users
node admin.js user:list

# Create a new user (prompts for password)
node admin.js user:create alice@company.com "Alice Johnson"

# Create a group
node admin.js group:create finance

# Add user to group
node admin.js membership:add alice@company.com finance
```

### User Commands

```bash
node admin.js user:create <email> <name>      # Create user (prompts for password)
node admin.js user:list                       # List all users with groups
node admin.js user:delete <email>             # Delete user
node admin.js user:set-password <email>       # Change password
node admin.js user:activate <email>           # Activate account
node admin.js user:deactivate <email>         # Deactivate account
```

### Group Commands

```bash
node admin.js group:create <name>             # Create group (lowercase, no spaces)
node admin.js group:list                      # List all groups with member counts
node admin.js group:delete <name>             # Delete group (cannot delete admin)
```

### Membership Commands

```bash
node admin.js membership:add <email> <group>     # Add user to group
node admin.js membership:remove <email> <group>  # Remove user from group
node admin.js membership:list <email>            # List user's groups
```

### Examples

```bash
# Create a new developer
node admin.js user:create dev@company.com "Dev User"
node admin.js membership:add dev@company.com dev

# Create finance team
node admin.js group:create finance
node admin.js user:create cfo@company.com "CFO Name"
node admin.js membership:add cfo@company.com finance
node admin.js membership:add cfo@company.com mgmt

# List everything
node admin.js user:list
node admin.js group:list
```

### Configuration

The admin tool connects to the standalone database using these defaults:
- Database: `auth_db`
- User: `auth_user`
- Password: `auth_password`
- Host: `localhost`
- Port: `5432`

Override with environment variables if needed:
```bash
DB_NAME=custom_db DB_PASSWORD=different node admin.js user:list
```

---

## Installation

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL database (either Wiki.js DB or standalone)
- Database credentials

### Quick Start (Wiki.js Database Mode)

**Development:**
```bash
# 1. Clone or download this repository
cd wikijs-jwt-auth

# 2. Install dependencies
npm install

# 3. Configure database connection (see Configuration section below)
# Update the database pool settings in auth-service.js

# 4. Start the service
npm start

# 5. Open browser
http://localhost:3004
```

**Production:**
```bash
# 1. Install to server directory
sudo mkdir -p /opt/wikijs-jwt-auth
sudo chown $USER:$USER /opt/wikijs-jwt-auth
cp -r * /opt/wikijs-jwt-auth/
cd /opt/wikijs-jwt-auth

# 2. Install dependencies
npm install --production

# 3. Configure database (edit auth-service.js)
# Update credentials and set secure: true for cookies

# 4. Create systemd service (see Configuration section)

# 5. Configure nginx reverse proxy (see Configuration section)
```

## Configuration

All configuration is in `auth-service.js`. Search for the following sections:

### Database Connection

Find the `const pool = new Pool({` section in `auth-service.js` and update based on your deployment mode:

**Option 1: Wiki.js Database Mode**
```javascript
const pool = new Pool({
  host: 'localhost',        // Your database host
  database: 'wikijs',       // Your existing Wiki.js database
  user: 'wikijs',           // Database user
  password: 'wikijspassword', // Database password
  port: 5432
});
```

**Option 2: Standalone Database Mode**
```javascript
const pool = new Pool({
  host: 'localhost',        // Your database host
  database: 'auth_db',      // Standalone auth database (created by init-database.sh)
  user: 'auth_user',        // Database user
  password: 'auth_password', // Database password
  port: 5432
});
```

> **Note:** For standalone mode setup, see [database/README.md](database/README.md)

### Server Port

Find `const PORT = ` near the bottom of the file:

```javascript
const PORT = 3004;
```

### Cookie Settings (Production HTTPS)

Find `res.cookie('jwt', token, {` in the `/api/login` endpoint:

```javascript
res.cookie('jwt', token, {
  httpOnly: true,
  secure: true,           // ✅ Enable for HTTPS in production
  sameSite: 'lax',
  domain: '.yourdomain.com', // Optional: share across subdomains
  maxAge: 60 * 60 * 1000  // 1 hour
});
```

### Systemd Service

Create `/etc/systemd/system/jwt-auth.service`:

```ini
[Unit]
Description=Wiki.js JWT Authentication Service
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/wikijs-jwt-auth
ExecStart=/usr/bin/node /opt/wikijs-jwt-auth/auth-service.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable jwt-auth
sudo systemctl start jwt-auth
sudo systemctl status jwt-auth
```

### Nginx Reverse Proxy

**Option 1: Standalone Subdomain**

Create `/etc/nginx/sites-available/jwt-auth`:

```nginx
server {
    listen 443 ssl http2;
    server_name auth.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3004;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Option 2: Integrated with Wiki.js (Same Domain)**

Add to your existing Wiki.js nginx config:

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    # JWT auth login page at /login (or /auth or /jwt-login)
    location /login {
        proxy_pass http://localhost:3004/;  # Trailing slash important!
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API endpoints
    location /api/ {
        proxy_pass http://localhost:3004;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Wiki.js (must be last)
    location / {
        proxy_pass http://localhost:3000;
        # ... rest of Wiki.js config
    }
}
```

**Option 3: With wikijs-secure-assets (Recommended Pattern)**

When using with [wikijs-secure-assets](https://github.com/yourusername/wikijs-secure-assets), use `/secure/login` and the `^~` modifier to prevent regex pattern conflicts:

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    # JWT auth login page - use ^~ to prevent regex pattern matching
    location ^~ /secure/login {
        proxy_pass http://localhost:3004/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API endpoints - use ^~ to prevent regex pattern matching
    location ^~ /api/ {
        proxy_pass http://localhost:3004;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Secure assets regex patterns come after
    location ~ ^/secure/([^/]+)/?(.*)$ {
        # ... secure-assets config
    }

    # Wiki.js (must be last)
    location / {
        proxy_pass http://localhost:3000;
        # ... rest of Wiki.js config
    }
}
```

**Why `^~` is important:** The `^~` modifier ensures these location blocks take priority over regex patterns (like `/secure/` used by secure-assets). Without it, `/secure/login` would match the secure-assets regex pattern and require authentication.

**Important:** The trailing slash in `proxy_pass http://localhost:3004/;` ensures `/login` maps to the service root.

Enable config:
```bash
sudo ln -s /etc/nginx/sites-available/jwt-auth /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## API Endpoints

### POST /api/login

Authenticate user and create JWT cookie.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "user": {
    "id": 5,
    "email": "user@example.com",
    "name": "John Doe",
    "groups": ["Administrators", "Developers"]
  }
}
```

**Error Response (401):**
```json
{
  "success": false,
  "message": "Invalid email or password"
}
```

**Cookie Set:**
- Name: `jwt`
- HttpOnly: true
- SameSite: lax
- Max-Age: 1 hour

### POST /api/logout

Clear JWT cookie.

**Response (200):**
```json
{
  "success": true,
  "message": "Logout successful"
}
```

### GET /api/verify

Verify current JWT token.

**Success Response (200):**
```json
{
  "success": true,
  "authenticated": true,
  "user": {
    "id": 5,
    "email": "user@example.com",
    "name": "John Doe",
    "groups": ["Administrators"]
  }
}
```

**Not Authenticated (401):**
```json
{
  "success": false,
  "authenticated": false,
  "message": "No token found"
}
```

### GET /

Serve login page (HTML form).

## JWT Structure

The service creates JWTs with essential claims for external authentication:

```javascript
{
  "id": 5,                           // User ID
  "email": "user@example.com",       // User email
  "name": "John Doe",                // Display name
  "groups": [1, 3],                  // Group IDs (numbers)
  "iat": 1732581234,                 // Issued at (timestamp)
  "exp": 1732584834,                 // Expires at (timestamp)
  "aud": "urn:wiki.js",              // Audience claim
  "iss": "urn:wiki.js"               // Issuer claim
}
```

**Signing:**
- Algorithm: **RS256** (RSA-SHA256)
- Private key: Loaded from Wiki.js database (`settings.certs`)
- Signature: RSA encryption of SHA256 hash

## Security

### How JWT Signing Works

1. **Create payload** with user data
2. **Hash the payload** using SHA256
3. **Encrypt the hash** with RSA private key → signature
4. **Send**: `header.payload.signature`

**Verification (by Wiki.js or secure-assets):**
1. **Decrypt signature** with public key → original hash
2. **Hash the received payload** → computed hash
3. **Compare hashes** → if match, authentic!

### Security Considerations

**✅ Secure:**
- Passwords verified with bcrypt
- JWTs signed with RSA private key (can't be forged)
- HttpOnly cookies (not accessible to JavaScript)
- Database credentials required

**⚠️ Important:**
- This service has access to the **private key** - can create valid JWTs for any user
- Database access = full authentication control
- Use HTTPS in production (`secure: true` for cookies)
- Protect this service - don't expose publicly without additional security

**Access Level:**
- **Anyone with this service** = Can authenticate as any user (has private key)
- Same security boundary as Wiki.js itself
- Intended for trusted environments (same server, internal network)

## Use Cases

### 1. Secure Asset Access (Primary Use Case)

Perfect companion to [wikijs-secure-assets](https://github.com/yourusername/wikijs-secure-assets):

```javascript
// User logs in via this service
const response = await fetch('http://auth.yourdomain.com/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'user@example.com', password: 'pass123' }),
  credentials: 'include'
});

// JWT cookie is set - can now access group-protected assets
const asset = await fetch('https://yourdomain.com/secure-assets/managers/report.pdf', {
  credentials: 'include'
});
// ✅ Access granted based on JWT group membership
```

### 2. Custom Application Authentication

Build custom apps that use Wiki.js user database:

```javascript
// Your custom app login page
app.post('/login', async (req, res) => {
  // Authenticate via wikijs-jwt-auth service
  const authResponse = await fetch('http://localhost:3004/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req.body)
  });

  const data = await authResponse.json();

  if (data.success) {
    // Set cookie from auth service response
    res.cookie('jwt', authResponse.headers.get('set-cookie'));
    res.json({ user: data.user });
  }
});
```

### 3. Microservices Architecture

Separate authentication from your main application:

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Custom App     │────▶│ jwt-auth service │────▶│ Wiki.js DB      │
│  (Frontend)     │     │ (Auth only)      │     │ (Users/Groups)  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                        │
        │ JWT cookie set         │
        ▼                        ▼
┌─────────────────┐     ┌──────────────────┐
│  Custom API     │     │  secure-assets   │
│  (Backend)      │     │  (File server)   │
└─────────────────┘     └──────────────────┘
```

### 4. Testing/Development

Quick authentication testing without running full Wiki.js:

```bash
# Login as test user
curl -X POST http://localhost:3004/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}' \
  -c cookies.txt

# Verify JWT is valid
curl -b cookies.txt http://localhost:3004/api/verify

# Access secure resources
curl -b cookies.txt https://yourdomain.com/secure-assets/managers/file.pdf
```

## Development

```bash
# Install dependencies
npm install

# Run with auto-reload
npm run dev

# View logs
# Service logs all authentication attempts to console
```

## Production Deployment

### Systemd Service

Create `/etc/systemd/system/wikijs-jwt-auth.service`:

```ini
[Unit]
Description=Wiki.js JWT Authentication Service
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/wikijs-jwt-auth
ExecStart=/usr/bin/node /opt/wikijs-jwt-auth/auth-service.js
Restart=always
RestartSec=10

Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable wikijs-jwt-auth
sudo systemctl start wikijs-jwt-auth
sudo systemctl status wikijs-jwt-auth
```

### Nginx Reverse Proxy

```nginx
server {
    listen 443 ssl http2;
    server_name auth.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3004;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Important:** Update cookie settings for HTTPS:
```javascript
res.cookie('jwt', token, {
  httpOnly: true,
  secure: true,  // ✅ Enable for HTTPS
  sameSite: 'lax',
  domain: '.yourdomain.com', // Allow sharing across subdomains
  maxAge: 60 * 60 * 1000
});
```

### Integration with Existing Wiki.js Server

When running on the same server as Wiki.js, add these location blocks to your Wiki.js nginx config (`/etc/nginx/sites-available/wiki`):

```nginx
server {
    listen 80;
    server_name _;

    # JWT Auth API endpoints (exact match - highest priority)
    location = /api/login {
        proxy_pass http://localhost:3004/api/login;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location = /api/logout {
        proxy_pass http://localhost:3004/api/logout;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location = /api/verify {
        proxy_pass http://localhost:3004/api/verify;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # JWT Auth login page
    location /jwt-auth/ {
        rewrite ^/jwt-auth/(.*)$ /$1 break;
        proxy_pass http://localhost:3004;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location = /jwt-auth {
        return 301 /jwt-auth/;
    }

    # Proxy to Wiki.js (catch-all - must be last)
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 90;
    }
}
```

**Important:** The order matters! Exact match locations (`= /api/login`) must come before the catch-all Wiki.js location block (`/`).

**Access URLs:**
- Login page: `http://yourdomain.com/jwt-auth/`
- API endpoints: `http://yourdomain.com/api/login`, `/api/logout`, `/api/verify`
- Wiki.js: `http://yourdomain.com/` (everything else)

**Reload nginx:**
```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Monitoring

### View Service Logs

```bash
# If running as systemd service (use your service name)
sudo journalctl -u jwt-auth -f

# Example output:
[2025-11-26T01:25:02.289Z] LOGIN REQUEST:
  Email: user@example.com
  User: user@example.com (ID: 5)
  Groups: Administrators, Developers
  Result: ✅ LOGIN SUCCESS
```

## Troubleshooting

### "Database connection failed"
- Verify PostgreSQL is running
- Check database credentials in `auth-service.js`
- Ensure database name matches your Wiki.js instance

### "Invalid email or password"
- User must exist in Wiki.js database
- User must have `providerKey = 'local'` (not SSO)
- Password must match (bcrypt hash verification)

### "Failed to load JWT private key"
- Requires `settings.certs` entry in Wiki.js database
- Wiki.js creates this on first startup
- Check: `SELECT * FROM settings WHERE key = 'certs';`

### JWT not recognized by Wiki.js
- Verify JWT structure matches (check payload fields)
- Ensure RS256 algorithm is used
- Check cookie domain/path settings
- Verify token hasn't expired (1 hour default)

## Comparison with Wiki.js

| Feature | Wiki.js Built-in | wikijs-jwt-auth |
|---------|------------------|-----------------|
| User database | Built-in | Uses Wiki.js database |
| JWT signing | RS256 private key | ✅ Same private key |
| Password hashing | bcrypt | ✅ Same bcrypt verification |
| JWT structure | Full payload | ✅ Compatible payload |
| Cookie name | `jwt` | ✅ Same cookie name |
| Group support | Yes | ✅ Yes |
| SSO providers | Many | ❌ No (but can integrate) |
| UI | Full Wiki.js interface | Simple login form |
| Independence | Full CMS | ✅ Standalone auth only |

## Related Projects

- **[wikijs-secure-assets](https://github.com/yourusername/wikijs-secure-assets)** - Group-based access control for Wiki.js assets
  - This service creates JWTs that work with secure-assets
  - Secure-assets verifies JWTs with the public key
  - Together they provide complete auth + authorization

## Architecture

```
┌──────────────────────┐
│  Wiki.js Database    │
│  ┌────────────────┐  │
│  │ users          │  │ ← User credentials (bcrypt)
│  │ groups         │  │ ← Group memberships
│  │ settings.certs │  │ ← RSA private/public keys
│  └────────────────┘  │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ wikijs-jwt-auth      │
│ (This Service)       │
│ - Reads private key  │
│ - Signs JWTs         │
│ - Creates auth       │
└──────────┬───────────┘
           │
           ▼ (JWT cookie)
┌──────────────────────┐
│ Client Browser       │
└──────────┬───────────┘
           │
           ├───────────────────────┐
           ▼                       ▼
┌──────────────────┐    ┌──────────────────┐
│ Wiki.js          │    │ wikijs-secure-   │
│ - Verifies JWT   │    │   assets         │
│ - Uses public    │    │ - Verifies JWT   │
│   key            │    │ - Uses public key│
│ - Grants access  │    │ - Checks groups  │
└──────────────────┘    └──────────────────┘
```

## Contributing

Contributions welcome! This is a complementary tool for Wiki.js environments.

## License

MIT

## Credits

Created to complement [Wiki.js](https://js.wiki) and provide flexible authentication options for Wiki.js-based systems.
