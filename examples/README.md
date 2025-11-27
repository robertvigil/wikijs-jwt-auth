# Examples

Example applications demonstrating integration with the JWT authentication service.

## Available Examples

### basic-auth-app

A responsive, multi-page web application showing complete JWT authentication integration.

**Features:**
- Login page with demo account reference
- Protected dashboard with user information
- User profile page with group permissions
- Shared authentication utilities
- Responsive design (Pico CSS)
- No build process required

**[View Example →](basic-auth-app/)**

## Running Examples

All examples require the JWT auth service to be running:

```bash
# Terminal 1: Start auth service
cd /path/to/wikijs-jwt-auth
node auth-service.js

# Terminal 2: Serve example app
cd examples/basic-auth-app
python3 -m http.server 8080

# Open in browser: http://localhost:8080
```

## Using Examples as Templates

These examples are designed to be copied and customized for your own projects. Each example includes:

- Complete source code with comments
- Detailed README with setup instructions
- Reusable utility functions
- Responsive, accessible UI components

See individual example READMEs for customization guides.

## Deploying to Production with Secure Assets

If you're deploying example apps to a server that uses the [wikijs-secure-assets](https://github.com/yourusername/wikijs-secure-assets) system:

### File Permissions

After copying files to the server, ensure proper permissions so Nginx can serve them after authentication succeeds:

```bash
# Fix directory permissions (755 = owner read/write/execute, others read/execute)
chmod 755 /path/to/secure-assets/example
chmod 755 /path/to/secure-assets/example/subdirectories

# Fix file permissions (644 = owner read/write, others read)
chmod 644 /path/to/secure-assets/example/*.html
chmod 644 /path/to/secure-assets/example/*.css
chmod 644 /path/to/secure-assets/example/*.js
chmod 644 /path/to/secure-assets/example/images/*
```

**Why this is needed:**
- The secure-assets service authenticates users via JWT
- After authentication succeeds, Nginx serves the files from disk
- Nginx runs as `www-data` user and needs read permissions
- Files copied via `scp` may have restrictive permissions (600)

**Symptom of wrong permissions:**
- Authentication succeeds in logs: `✅ ALLOWED (admin - full access)`
- But browser shows "403 Forbidden" or "Access Denied"
- This happens because Nginx can't read the files despite auth succeeding

### Automatic Fix

You can fix all permissions recursively:

```bash
# Make all directories readable/executable
find /path/to/secure-assets/example -type d -exec chmod 755 {} \;

# Make all files readable
find /path/to/secure-assets/example -type f -exec chmod 644 {} \;
```
