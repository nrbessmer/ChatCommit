// injectToken.js
console.log('[injectToken] Script loaded');

// Extract token from location hash if present
function extractTokenFromHash() {
  const hash = window.location.hash;
  if (hash && hash.includes('token=')) {
    const token = decodeURIComponent(hash.split('token=')[1]);
    console.log('[injectToken] Found token in hash');
    return token;
  }
  return null;
}

// Store token in sessionStorage for use by the app
function storeTokenInSession(token) {
  if (token) {
    window.sessionStorage.setItem('auth_token', token);
    console.log('[injectToken] Token stored in sessionStorage');
    
    // Clean up the URL
    const cleanUrl = window.location.href.split('#')[0];
    window.history.replaceState({}, document.title, cleanUrl);
  }
}

// Check for token in extension storage
async function checkExtensionStorage() {
  try {
    const result = await chrome.storage.local.get('auth_token');
    if (result.auth_token) {
      console.log('[injectToken] Retrieved token from extension storage');
      storeTokenInSession(result.auth_token);
      return true;
    }
  } catch (e) {
    console.error('[injectToken] Failed to access extension storage', e);
  }
  return false;
}

// Main initialization
async function initialize() {
  // First check URL hash for token
  const hashToken = extractTokenFromHash();
  if (hashToken) {
    storeTokenInSession(hashToken);
    return;
  }
  
  // If no token in hash, try extension storage
  await checkExtensionStorage();
}

// Execute on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}