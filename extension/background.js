console.log('[background] service worker loaded');

chrome.webRequest.onBeforeSendHeaders.addListener(
  async (details) => {
    // grab your JWT from storage
    const { auth_token } = await chrome.storage.local.get('auth_token');
    if (!auth_token) {
      return { requestHeaders: details.requestHeaders };
    }

    // remove any existing Authorization header
    const headers = details.requestHeaders.filter(
      h => h.name.toLowerCase() !== 'authorization'
    );

    // inject our Bearer token
    headers.push({
      name: 'Authorization',
      value: `Bearer ${auth_token}`
    });

    return { requestHeaders: headers };
  },
  {
    urls: [
      "https://chatcommit.fly.dev/*"
    ]
  },
  ["blocking", "requestHeaders"]
);

