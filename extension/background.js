// background.js
console.log('[background] service worker starting');

// Keep-alive ping
chrome.alarms.create('keepAlive', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener(() => {
  console.log('[background] keepAlive ping');
});

// Token injection removed — now handled only in popup.js
// This avoids duplicate Authorization headers causing 401 errors

// chrome.webRequest.onBeforeSendHeaders.addListener(
//   async (details) => {
//     console.log('[webRequest] intercept:', details.method, details.url);

//     const storage = await chrome.storage.local.get('auth_token');
//     const token   = storage.auth_token;

//     if (!token) {
//       console.warn('[webRequest] no auth_token in storage');
//       return { requestHeaders: details.requestHeaders };
//     }

//     const headers = details.requestHeaders.filter(
//       h => h.name.toLowerCase() !== 'authorization'
//     );
//     headers.push({ name: 'Authorization', value: `Bearer ${token}` });

//     console.log('[webRequest] injected Authorization header');
//     return { requestHeaders: headers };
//   },
//   { urls: ['https://chatcommit.fly.dev/*'] },
//   ['blocking', 'requestHeaders']
// );
