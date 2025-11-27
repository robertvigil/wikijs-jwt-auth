/**
 * Shared authentication utilities for example app
 */

const AUTH_CONFIG = {
    API_BASE: '/api',
    LOGIN_PAGE: 'index.html',
    DASHBOARD_PAGE: 'dashboard.html'
};

/**
 * Check if user is authenticated
 * @returns {Promise<Object|null>} User data if authenticated, null otherwise
 */
async function checkAuth() {
    try {
        const response = await fetch(`${AUTH_CONFIG.API_BASE}/verify`, {
            credentials: 'include'
        });
        const data = await response.json();

        if (data.authenticated) {
            return data.user;
        }
        return null;
    } catch (error) {
        console.error('Auth check failed:', error);
        return null;
    }
}

/**
 * Require authentication - redirect to login if not authenticated
 * @returns {Promise<Object>} User data
 */
async function requireAuth() {
    const user = await checkAuth();
    if (!user) {
        window.location.href = AUTH_CONFIG.LOGIN_PAGE;
        throw new Error('Not authenticated');
    }
    return user;
}

/**
 * Redirect to dashboard if already authenticated
 */
async function redirectIfAuthenticated() {
    const user = await checkAuth();
    if (user) {
        window.location.href = AUTH_CONFIG.DASHBOARD_PAGE;
    }
}

/**
 * Login with email and password
 * @param {string} email
 * @param {string} password
 * @returns {Promise<Object>} Response data
 */
async function login(email, password) {
    const response = await fetch(`${AUTH_CONFIG.API_BASE}/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ email, password })
    });

    return await response.json();
}

/**
 * Logout current user
 * @returns {Promise<Object>} Response data
 */
async function logout() {
    const response = await fetch(`${AUTH_CONFIG.API_BASE}/logout`, {
        method: 'POST',
        credentials: 'include'
    });

    return await response.json();
}

/**
 * Get group names from group IDs
 * @param {Array<number>} groupIds
 * @returns {Array<string>} Group names
 */
function getGroupNames(groupIds) {
    const groupMap = {
        1: 'admin',
        2: 'mgmt',
        3: 'dev',
        4: 'view'
    };

    return groupIds.map(id => groupMap[id] || `Group ${id}`);
}

/**
 * Show message in a message div
 * @param {string} elementId - ID of message div
 * @param {string} text - Message text
 * @param {string} type - 'success' or 'error'
 */
function showMessage(elementId, text, type) {
    const messageDiv = document.getElementById(elementId);
    if (messageDiv) {
        messageDiv.textContent = text;
        messageDiv.className = `message ${type}`;
        messageDiv.style.display = 'block';
    }
}

/**
 * Hide message div
 * @param {string} elementId - ID of message div
 */
function hideMessage(elementId) {
    const messageDiv = document.getElementById(elementId);
    if (messageDiv) {
        messageDiv.style.display = 'none';
    }
}
