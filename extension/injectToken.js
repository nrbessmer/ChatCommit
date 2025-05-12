// injectToken.js
// run_at=document_start
(() => {
  const hash = location.hash.slice(1);
  if (!hash) return;

  const params = new URLSearchParams(hash);
  const token = params.get('token');
  if (!token) return;

  console.log('[injectToken] injecting token into localStorage');
  localStorage.setItem('auth_token', token);

  // Clean up the URL
  history.replaceState(null, '', location.pathname + location.search);
})();
