// background.js
console.log('[background] service worker starting');

// Helper: install/update the single dNR rule to include the current token
async function updateAuthRule(token) {
  if (!token) {
    console.warn('[background] No token provided for rule update');
    return;
  }
  
  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [1],
      addRules: [
        {
          id: 1,
          priority: 1,
          action: {
            type: 'modifyHeaders',
            requestHeaders: [
              { header: 'Authorization', operation: 'set', value: `Bearer ${token}` }
            ]
          },
          condition: {
            urlFilter: 'https://chatcommit.fly.dev/*',
            resourceTypes: ['xmlhttprequest']
          }
        }
      ]
    });
    console.log('[background] declarativeNetRequest rule updated successfully');
  } catch (e) {
    console.error('[background] failed to update dNR rule', e);
  }
}

// On install or update, apply any already‑stored token
chrome.runtime.onInstalled.addListener(async () => {
  console.log('[background] Extension installed/updated');
  const { auth_token } = await chrome.storage.local.get('auth_token');
  if (auth_token) {
    console.log('[background] Found existing token, updating rule');
    await updateAuthRule(auth_token);
  } else {
    console.log('[background] No token found during installation');
  }
});

// Add listener for runtime messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateToken' && message.token) {
    console.log('[background] Received token update request');
    updateAuthRule(message.token);
    sendResponse({success: true});
  }
  return true;
});

// Whenever popup.js saves a new token, re‑write the rule
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.auth_token) {
    console.log('[background] Token changed in storage');
    if (changes.auth_token.newValue) {
      updateAuthRule(changes.auth_token.newValue);
    }
  }
});