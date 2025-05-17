// popup.js
console.log('[popup.js] loaded');

document.addEventListener('DOMContentLoaded', () => {
  const loginPanel     = document.getElementById('login-panel');
  const mainPanel      = document.getElementById('main-panel');
  const settingsPanel  = document.getElementById('settings-panel');
  const mergePanel     = document.getElementById('merge-panel');
  const statusMsg      = document.getElementById('status-message');
  const loginStatus    = document.getElementById('login-status');

  const STORAGE_KEY_TOKEN  = 'auth_token';
  const API_BASE_DEFAULT   = 'https://chatcommit.fly.dev';
  const VERCEL_BASE        = 'https://chat-commit.vercel.app';

  let lastScrapeData = null;

  async function setToken(token) {
  await chrome.storage.local.set({ [STORAGE_KEY_TOKEN]: token });
  console.log('[setToken] token saved');
  
  // Explicitly notify background script to update the rule
  try {
    await chrome.runtime.sendMessage({
      action: 'updateToken',
      token: token
    });
    console.log('[setToken] notified background script');
  } catch (e) {
    console.error('[setToken] failed to notify background script', e);
  }
}

  async function getToken() {
    const result = await chrome.storage.local.get(STORAGE_KEY_TOKEN);
    return result[STORAGE_KEY_TOKEN];
  }

  async function clearToken() {
    await chrome.storage.local.remove(STORAGE_KEY_TOKEN);
    console.log('[clearToken] token removed');
  }

  const getBackend = () =>
    new Promise(res =>
      chrome.storage.local.get('repoUrl', o => res(o.repoUrl || API_BASE_DEFAULT))
    );

  // ─── LOGIN ─────────────────────────────────────────
  document.getElementById('login-submit')?.addEventListener('click', async () => {
  loginStatus.textContent = '⏳ Logging in…';
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  
  if (!email || !password) {
    loginStatus.textContent = '❌ Email and password required';
    return;
  }
  
  try {
    const base = await getBackend();
    console.log(`[login] Using API base: ${base}`);
    
    const resp = await fetch(`${base}/auth/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    if (!resp.ok) {
      console.error(`[login] HTTP error: ${resp.status}`);
      throw resp;
    }
    
    const data = await resp.json();
    console.log('[login] Authentication successful');
    
    if (!data.access_token) {
      throw new Error('Server response missing access_token');
    }
    
    await setToken(data.access_token);
    loginStatus.textContent = '✅ Logged in';
    loginPanel.style.display = 'none';
    mainPanel.style.display  = 'block';
    await populateBranchSelect();
    await scrapeChat();
  } catch (err) {
    console.error('Login error', err);
    let msg = 'Login failed';
    
    if (err instanceof Response) {
      try { 
        const errData = await err.json();
        msg = errData.detail || `HTTP ${err.status}`;
      } catch {
        msg = `HTTP ${err.status}`;
      }
    } else if (err.message) {
      msg = err.message;
    }
    
    loginStatus.textContent = `❌ ${msg}`;
  }
});

  // ─── AUTO‑LOGIN ───────────────────────────────────
  chrome.storage.local.get(STORAGE_KEY_TOKEN, async ({ auth_token }) => {
    if (auth_token) {
      loginPanel.style.display = 'none';
      mainPanel.style.display  = 'block';
      await populateBranchSelect();
      await scrapeChat();
    }
  });

  // ─── FETCH & POPULATE BRANCHES ────────────────────
  async function fetchBranches(retries = 3) {
    const [base, token] = await Promise.all([getBackend(), getToken()]);
    const resp = await fetch(`${base}/branch/`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!resp.ok) {
      if (resp.status === 401 && retries > 0) {
        await new Promise(r => setTimeout(r, 200));
        return fetchBranches(retries - 1);
      }
      const body = await resp.json().catch(() => null);
      throw new Error(body?.detail || JSON.stringify(body) || `HTTP ${resp.status}`);
    }
    return resp.json();
  }

  async function populateBranchSelect() {
    try {
      const branches = await fetchBranches();
      const sel = document.getElementById('branch-select');
      sel.innerHTML = '';
      if (!branches.length) {
        const o = document.createElement('option');
        o.textContent = 'No branches available';
        o.disabled = true;
        sel.append(o);
      } else {
        branches.forEach(b => {
          const o = document.createElement('option');
          o.value = b.id;
          o.textContent = `${b.name} (#${b.id})`;
          sel.append(o);
        });
      }
      statusMsg.textContent = '';
    } catch (e) {
      console.error('populateBranchSelect error', e);
      statusMsg.textContent = `❌ Failed to load branches: ${e.message}`;
    }
  }

  // ─── NAVIGATION ───────────────────────────────────
  async function openWithToken(path) {
    const token = await getToken();
    chrome.tabs.create({ url: `${VERCEL_BASE}${path}#token=${encodeURIComponent(token)}` });
  }
  document.getElementById('view-branches')?.addEventListener('click', () => openWithToken('/branches'));
  document.getElementById('rollback-btn')?.addEventListener('click', () => openWithToken('/rollback'));
  document.getElementById('timeline-btn')?.addEventListener('click', () => openWithToken('/timeline'));

  // ─── SCRAPE CHAT ──────────────────────────────────
  async function scrapeChat() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab.url.startsWith('chrome://')) {
        statusMsg.textContent = '❌ Cannot scrape chrome:// pages';
        return;
      }
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const msgs = [];
          document.querySelectorAll('[data-message-author-role]').forEach(el => {
            const role = el.getAttribute('data-message-author-role') === 'user' ? 'User' : 'AI';
            const text = el.innerText.trim();
            if (text) msgs.push({ role, text });
          });
          return { messages: msgs };
        }
      });
      lastScrapeData = result;
      const table = document.getElementById('context-table');
      table.innerHTML = '';
      result.messages.forEach(({ role, text }) => {
        const tr = document.createElement('tr');
        tr.className = role === 'User' ? 'user-row' : 'ai-row';
        tr.innerHTML = `<td>${role}</td><td>${text}</td>`;
        table.appendChild(tr);
      });
      statusMsg.textContent = '✅ Chat scraped';
    } catch (e) {
      console.error('scrapeChat error', e);
      statusMsg.textContent = `❌ Failed to scrape: ${e.message}`;
    }
  }
  document.getElementById('refresh-chat')?.addEventListener('click', scrapeChat);

  // ─── COPY CONTEXT ───────────────────────────────
  document.getElementById('copy-context')?.addEventListener('click', () => {
    let out = 'Role\tMessage\n';
    document.querySelectorAll('#context-table tr').forEach(tr => {
      out += `${tr.cells[0].textContent}\t${tr.cells[1].textContent}\n`;
    });
    navigator.clipboard.writeText(out)
      .then(() => statusMsg.textContent = '✅ Context copied')
      .catch(() => statusMsg.textContent = '❌ Copy failed');
  });

  // ─── COMMIT ──────────────────────────────────────
  document.getElementById('commit-btn')?.addEventListener('click', async () => {
    const base   = await getBackend();
    const msg    = document.getElementById('message-input').value.trim();
    const ctx    = lastScrapeData;
    const bid    = parseInt(document.getElementById('branch-select').value, 10);
    const tag    = document.getElementById('tag-input').value.trim();
    if (!msg || !ctx?.messages?.length || !bid) {
      statusMsg.textContent = '❌ Missing commit data';
      return;
    }
    try {
      const token = await getToken();
      const resp  = await fetch(`${base}/commit/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${token}`
        },
        body: JSON.stringify({
          commit_message: msg,
          conversation_context: { messages: ctx.messages.map(m => `${m.role}: ${m.text}`) },
          branch_id: bid
        })
      });
      const data = await resp.json().catch(() => null);
      if (!resp.ok) {
        const errMsg = Array.isArray(data)
          ? data.map(e => `${e.loc.join('.')}: ${e.msg}`).join('; ')
          : data?.detail || JSON.stringify(data) || `HTTP ${resp.status}`;
        throw new Error(errMsg);
      }
      let out = `✅ Commit #${data.commit_hash.slice(0,8)} saved`;
      if (tag) {
        const tRes = await fetch(`${base}/tag/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization:   `Bearer ${token}`
          },
          body: JSON.stringify({ name: tag, commit_id: data.id })
        });
        out += tRes.ok ? ' + Tag added' : ' + Tag failed';
      }
      statusMsg.textContent = out;
    } catch (err) {
      console.error('Commit error', err);
      statusMsg.textContent = `❌ Commit failed: ${err.message}`;
    }
  });

  // ─── CREATE BRANCH ──────────────────────────────
  document.getElementById('create-branch')?.addEventListener('click', async () => {
    const name = prompt('New branch name:');
    if (!name) return;
    try {
      const base = await getBackend();
      const token = await getToken();
      const resp = await fetch(`${base}/branch/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${token}`
        },
        body: JSON.stringify({ name })
      });
      if (!resp.ok) throw resp;
      alert('✅ Branch created');
      await populateBranchSelect();
    } catch (e) {
      console.error('Create branch error', e);
      statusMsg.textContent = '❌ Could not create branch';
    }
  });

  // ─── MERGE FLOW ────────────────────────────────
  document.getElementById('merge-btn')?.addEventListener('click', async () => {
    mainPanel.style.display  = 'none';
    mergePanel.style.display = 'block';
    document.getElementById('merge-status').textContent = '';
    try {
      const branches = await fetchBranches();
      ['merge-source', 'merge-target'].forEach(id => {
        const sel = document.getElementById(id);
        sel.innerHTML = '<option value="">Select branch</option>';
        branches.forEach(b => {
          const o = document.createElement('option');
          o.value = b.id;
          o.textContent = `${b.name} (#${b.id})`;
          sel.append(o);
        });
      });
    } catch (e) {
      console.error('Merge load error', e);
      document.getElementById('merge-status').textContent = '❌ Could not load branches';
    }
  });

  document.getElementById('execute-merge')?.addEventListener('click', async () => {
    const src = document.getElementById('merge-source').value;
    const tgt = document.getElementById('merge-target').value;
    if (!src || !tgt || src === tgt) {
      return document.getElementById('merge-status').textContent = '❌ Select two different branches';
    }
    try {
      const base = await getBackend();
      const token = await getToken();
      const resp = await fetch(`${base}/merge/${src}/${tgt}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await resp.json().catch(() => null);
      document.getElementById('merge-status').textContent = resp.ok
        ? `✅ ${data.message}`
        : '❌ Merge failed';
    } catch (e) {
      console.error('Merge error', e);
      document.getElementById('merge-status').textContent = '❌ Merge failed';
    }
  });

  document.getElementById('cancel-merge')?.addEventListener('click', () => {
    mergePanel.style.display  = 'none';
    mainPanel.style.display   = 'block';
  });

  // ─── LOG OUT ─────────────────────────────────────
  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    await clearToken();
    mainPanel.style.display     = 'none';
    settingsPanel.style.display = 'none';
    mergePanel.style.display    = 'none';
    loginPanel.style.display    = 'block';
    loginStatus.textContent     = '';
    statusMsg.textContent       = '';
    document.getElementById('login-email').value    = '';
    document.getElementById('login-password').value = '';
  });
});