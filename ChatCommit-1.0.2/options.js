// options.js
document.addEventListener('DOMContentLoaded', function() {
  const statusEl = document.getElementById('status');
  const tokenInfo = document.getElementById('tokenInfo');
  const tokenSection = document.getElementById('tokenSection');
  const apiUrlInput = document.getElementById('apiUrl');
  
  // Load saved API URL
  chrome.storage.local.get('repoUrl', (result) => {
    if (result.repoUrl) {
      apiUrlInput.value = result.repoUrl;
    } else {
      apiUrlInput.value = 'https://chatcommit.fly.dev';
    }
  });
  
  // Save API URL
  document.getElementById('saveApiUrl').addEventListener('click', () => {
    const url = apiUrlInput.value.trim();
    if (!url) {
      showStatus('Please enter a valid URL', 'error');
      return;
    }
    
    chrome.storage.local.set({ 'repoUrl': url }, () => {
      showStatus('API URL saved', 'success');
    });
  });
  
  // Check current token
  document.getElementById('checkToken').addEventListener('click', () => {
    chrome.storage.local.get('auth_token', (result) => {
      if (result.auth_token) {
        tokenInfo.textContent = result.auth_token;
        tokenSection.classList.remove('hidden');
        showStatus('Token found', 'success');
        
        // Attempt to decode JWT to show expiration
        try {
          const payload = JSON.parse(atob(result.auth_token.split('.')[1]));
          const expDate = new Date(payload.exp * 1000);
          tokenInfo.textContent += `\n\nExpires: ${expDate.toLocaleString()}`;
          
          if (Date.now() > payload.exp * 1000) {
            showStatus('WARNING: Token is expired!', 'error');
          }
        } catch (e) {
          console.error('Failed to decode token', e);
        }
      } else {
        showStatus('No token found', 'error');
        tokenSection.classList.add('hidden');
      }
    });
  });
  
  // Clear token
  document.getElementById('clearToken').addEventListener('click', () => {
    chrome.storage.local.remove('auth_token', () => {
      showStatus('Token cleared', 'info');
      tokenSection.classList.add('hidden');
      
      // Notify background script to remove authorization rule
      chrome.runtime.sendMessage({
        action: 'updateToken',
        token: null
      });
    });
  });
  
  // Test API connection
  document.getElementById('testEndpoint').addEventListener('click', async () => {
    try {
      showStatus('Testing connection...', 'info');
      
      // Get API URL
      const { repoUrl } = await chrome.storage.local.get('repoUrl');
      const apiUrl = repoUrl || 'https://chatcommit.fly.dev';
      
      // Get token
      const { auth_token } = await chrome.storage.local.get('auth_token');
      
      // Test health endpoint (shouldn't require auth)
      const healthResp = await fetch(`${apiUrl}/health`);
      if (!healthResp.ok) {
        throw new Error(`Health check failed: ${healthResp.status}`);
      }
      
      // If we have a token, test an authenticated endpoint
      if (auth_token) {
        const branchResp = await fetch(`${apiUrl}/branch/`, {
          headers: { 'Authorization': `Bearer ${auth_token}` }
        });
        
        if (branchResp.ok) {
          showStatus('Connection successful! Auth is working.', 'success');
        } else if (branchResp.status === 401) {
          showStatus('Connection OK but authentication failed (401). Token may be expired.', 'error');
        } else {
          showStatus(`Connected but API returned: ${branchResp.status} ${branchResp.statusText}`, 'error');
        }
      } else {
        showStatus('Health check OK, but no auth token to test authenticated endpoints.', 'info');
      }
    } catch (e) {
      showStatus(`Connection failed: ${e.message}`, 'error');
    }
  });
  
  function showStatus(message, type) {
    statusEl.textContent = message;
    statusEl.className = type;
    statusEl.classList.remove('hidden');
  }
});
