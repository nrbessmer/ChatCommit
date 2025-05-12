// injectToken.js
// run_at=document_start
;(() => {
  // e.g. URL is https://chat-commit.vercel.app/branches#token=XYZ
  const hash = location.hash.slice(1);
  if (!hash) return;

  const params = new URLSearchParams(hash);
  const t = params.get('token');
  if (!t) return;

  // save to localStorage under the same key your frontend reads
  localStorage.setItem('auth_token', t);

  // clean up the URL so the user doesn’t keep seeing the hash
  history.replaceState(null, '', location.pathname + location.search);
})();

