console.log('[background] service worker starting');

chrome.alarms.create('keepAlive', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener(() => {
  console.log('[background] keepAlive ping');
});

chrome.webRequest.onBeforeSendHeaders.addListener(
  async (details) => {
    console.log('[webRequest] intercept:', details.method, details.url);

    const storage = await chrome.storage.local.get('auth_token');
    const token   = storage.auth_token;
    if (!token) {
      console.warn('[webRequest] no auth_token in storage');
      return { requestHeaders: details.requestHeaders };
    }

    // remove any existing header
    const headers = details.requestHeaders.filter(h => h.name.toLowerCase() !== 'authorization');
    headers.push({ name: 'Authorization', value: `Bearer ${token}` });
    console.log('[webRequest] injected Authorization for', details.url);

    return { requestHeaders: headers };
  },
  { urls: ['https://chatcommit.fly.dev/*'] },
  ['blocking', 'requestHeaders']
);

