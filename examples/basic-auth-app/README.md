# Basic Auth App Example

A responsive, multi-page demonstration application showing how to integrate with the JWT authentication service.

## Features

- ✅ **Responsive Design** - Works on mobile, tablet, and desktop using Pico CSS
- ✅ **Multiple Pages** - Login, Dashboard, and Profile pages
- ✅ **Shared Utilities** - Reusable authentication functions
- ✅ **Clean URLs** - No build process, just open and run
- ✅ **Group-Based UI** - Shows user groups and permissions
- ✅ **Protected Routes** - Pages require authentication to access

## Pages

### index.html - Login Page
- Login form with email/password
- Auto-redirect if already logged in
- Error handling and validation
- Production-ready (can replace built-in `/secure/login` page)

### dashboard.html - Main Dashboard
- Protected page (requires login)
- Displays user information from JWT
- Navigation between pages
- Demo cards/widgets
- Logout functionality

### profile.html - User Profile
- Protected page (requires login)
- Detailed user information
- Group permissions breakdown
- Raw JWT token viewer

## Files

### Shared Resources

- **auth.js** - Shared authentication utilities
  - `checkAuth()` - Check if user is authenticated
  - `requireAuth()` - Require authentication or redirect
  - `login()` - Login with credentials
  - `logout()` - Logout current user
  - Helper functions for messages and group names

- **styles.css** - Shared custom styles
  - Extends Pico CSS with app-specific styles
  - Responsive layouts
  - Message styles
  - User info cards
  - Navigation styles

### Dependencies

- **Pico CSS** (via CDN) - No-class CSS framework
  - Fully responsive
  - Dark mode support
  - Semantic HTML
  - 10KB gzipped

## Running the Example

### Prerequisites

1. The JWT auth service must be running on `http://localhost:3004`
2. The standalone database must be set up with demo users

### Quick Start (Local Development)

```bash
# Make sure auth service is running
cd /path/to/wikijs-jwt-auth
node auth-service.js

# Open the example in a browser
# Option 1: Using a simple HTTP server
cd examples/basic-auth-app
python3 -m http.server 8080
# Open: http://localhost:8080

# Option 2: Using Node.js http-server
npx http-server -p 8080
# Open: http://localhost:8080

# Option 3: Just open index.html directly
# (may have CORS issues with some browsers)
open index.html
```

**Note:** For local development, you'll need to update `auth.js` to use `API_BASE: 'http://localhost:3004/api'` instead of the default `/api` since you won't have Nginx proxying requests.

### Production Deployment

This example app can replace the auth service's built-in login page at `/secure/login`. Deploy by copying files to your server:

```bash
# Copy to a protected path (requires group-based auth via secure-assets)
scp -r examples/basic-auth-app/* user@server:/path/to/secure-assets/login/

# Or copy to a public path (HTML is public, auth handled by JavaScript)
scp -r examples/basic-auth-app/* user@server:/path/to/public-assets/login/

# Fix permissions (see parent README for details)
ssh user@server "find /path/to/assets/login -type d -exec chmod 755 {} \;"
ssh user@server "find /path/to/assets/login -type f -exec chmod 644 {} \;"
```

Access at: `https://your-domain.com/secure/login/` 

### Demo Accounts

| Email | Password | Groups |
|-------|----------|--------|
| admin@example.com | password123 | admin |
| alice@example.com | password123 | mgmt, dev |
| bob@example.com | password123 | dev |
| carol@example.com | password123 | view |
| guest@example.com | password123 | (none) |

## Using as a Template

This example is designed to be copied and modified for your own projects.

### Customization Steps

1. **Copy the example directory**
   ```bash
   cp -r examples/basic-auth-app /path/to/your-project
   ```

2. **Update API endpoint** in `auth.js` (if needed):
   ```javascript
   const AUTH_CONFIG = {
       API_BASE: '/api',  // Default - works when Nginx proxies /api/ to auth service
       LOGIN_PAGE: 'index.html',
       DASHBOARD_PAGE: 'dashboard.html'
   };
   ```

   **Note:** The default `/api` works in production when your Nginx config includes:
   ```nginx
   location ^~ /api/ {
       proxy_pass http://localhost:3004;
   }
   ```

   For local development without Nginx, you may need to change this to:
   ```javascript
   API_BASE: 'http://localhost:3004/api'
   ```

3. **Customize the pages**
   - Edit HTML content
   - Modify styles in `styles.css`
   - Add more pages as needed

4. **Add your functionality**
   - Replace demo cards with real features
   - Add API calls to your backend
   - Implement group-based access control

## Architecture

### Authentication Flow

```
index.html (Login)
    ↓
  Login Form
    ↓
auth.js → login(email, password)
    ↓
Auth Service API (/api/login)
    ↓
JWT Cookie Set
    ↓
Redirect to dashboard.html
    ↓
auth.js → requireAuth()
    ↓
Auth Service API (/api/verify)
    ↓
Show User Info
```

### Protected Pages

All pages except `index.html` call `requireAuth()` on load:

```javascript
requireAuth().then(user => {
    // Page loads with user data
}).catch(() => {
    // Redirects to login page
});
```

## Group-Based Access Control

To add group-based restrictions to pages:

```javascript
// Require specific group
requireAuth().then(user => {
    const groupNames = getGroupNames(user.groups);

    if (!groupNames.includes('admin')) {
        alert('Admin access required');
        window.location.href = 'dashboard.html';
        return;
    }

    // Page loads for admin users only
});
```

## Production Considerations

Before using in production:

1. **HTTPS Only** - Never use over HTTP in production
2. **API Endpoint** - Update `AUTH_CONFIG.API_BASE` to your production API
3. **Error Handling** - Add comprehensive error handling
4. **Loading States** - Improve UX with better loading indicators
5. **Security Headers** - Add appropriate CSP and security headers
6. **Session Management** - Handle token expiration gracefully
7. **Validation** - Add client-side and server-side validation
8. **Accessibility** - Enhance ARIA labels and keyboard navigation

## Troubleshooting

### Login fails with "Connection error"
- Make sure auth service is running: `node auth-service.js`
- Check the service is on port 3004: `curl http://localhost:3004/health`

### Pages redirect to login immediately
- Check browser console for errors
- Verify JWT cookie is being set (check browser dev tools → Application → Cookies)
- Ensure you're using the same origin (not mixing http://localhost with http://127.0.0.1)

### CORS errors
- Use a local web server (python, http-server, etc.) instead of file:// protocol
- Or update auth service to allow your origin in CORS settings

## Next Steps

- Add more pages (settings, admin panel, etc.)
- Implement real functionality (API calls, data display)
- Add group-based feature toggles
- Implement password change functionality
- Add user registration (if applicable)
- Integrate with your backend services
