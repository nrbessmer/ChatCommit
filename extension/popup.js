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
    console.log('[setToken] token saved to storage');
  }

  async function getToken() {
    const result = await chrome.storage.local.get(STORAGE_KEY_TOKEN);
    console.log('[getToken] token retrieved:', result[STORAGE_KEY_TOKEN]);
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
    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    try {
      const resp = await fetch(`${API_BASE_DEFAULT}/auth/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (!resp.ok) throw resp;
      const { access_token } = await resp.json();
      await setToken(access_token);

      setTimeout(async () => {
        loginStatus.textContent = '✅ Logged in';
        loginPanel.style.display = 'none';
        mainPanel.style.display  = 'block';
        await populateBranchSelect();
        await scrapeChat();
      }, 100);
    } catch (err) {
      console.error('Login error', err);
      loginStatus.textContent = '❌ Login failed';
    }
  });

  // ─── AUTO‑LOGIN ───────────────────────────────────
  chrome.storage.local.get(STORAGE_KEY_TOKEN, async ({ auth_token }) => {
    if (auth_token) {
      console.log('[startup] token found →', auth_token);
      loginPanel.style.display = 'none';
      mainPanel.style.display  = 'block';
      await populateBranchSelect();
      scrapeChat();
    }
  });

  // ─── FETCH & POPULATE BRANCHES ────────────────────
  async function fetchBranches(base) {
    const token = await getToken();
    console.log('[fetchBranches] fetching from', base, 'with token:', token);
    const r = await fetch(`${base}/branch/`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!r.ok) throw await r.json();
    return r.json();
  }

  async function populateBranchSelect() {
    const base = await getBackend();
    try {
      const branches = await fetchBranches(base);
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
    } catch (e) {
      console.error('populateBranchSelect error', e);
      statusMsg.textContent = '❌ Failed to load branches';
    }
  }

  // ─── NAVIGATION ───────────────────────────────────
  async function openWithToken(path) {
    const token = await getToken();
    const url = `${VERCEL_BASE}${path}#token=${encodeURIComponent(token)}`;
    chrome.tabs.create({ url });
  }

  document.getElementById('view-branches')?.addEventListener('click', () => openWithToken('/branches'));
  document.getElementById('rollback-btn')?.addEventListener('click', () => openWithToken('/rollback'));
  document.getElementById('timeline-btn')?.addEventListener('click', () => openWithToken('/timeline'));

  // ─── SCRAPE CHAT ──────────────────────────────────
  async function scrapeChat() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
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
      statusMsg.textContent = '❌ Failed to scrape';
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
    const base  = await getBackend();
    const msg   = document.getElementById('message-input').value.trim();
    const ctx   = lastScrapeData;
    const bid   = parseInt(document.getElementById('branch-select').value, 10);
    const tag   = document.getElementById('tag-input').value.trim();
    if (!msg || !ctx?.messages?.length || !bid) {
      return statusMsg.textContent = '❌ Missing commit data';
    }
    try {
      const token = await getToken();
      const r = await fetch(`${base}/commit/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          commit_message: msg,
          conversation_context: { messages: ctx.messages.map(m => `${m.role}: ${m.text}`) },
          branch_id: bid
        })
      });
      const data = await r.json();
      if (!r.ok) throw data;
      let out = `✅ Commit #${data.commit_hash.slice(0,8)} saved`;
      if (tag) {
        const tRes = await fetch(`${base}/tag/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ name: tag, commit_id: data.id })
        });
        out += tRes.ok ? ' + Tag added' : ' + Tag failed';
      }
      statusMsg.textContent = out;
    } catch (err) {
      console.error('Commit error', err);
      statusMsg.textContent = '❌ Commit failed';
    }
  });

  // ─── CREATE BRANCH ──────────────────────────────
  document.getElementById('create-branch')?.addEventListener('click', async () => {
    const name = prompt('New branch name:');
    if (!name) return;
    const base = await getBackend();
    try {
      const token = await getToken();
      const r = await fetch(`${base}/branch/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name })
      });
      if (!r.ok) throw r;
      alert('✅ Branch created');
      populateBranchSelect();
    } catch (e) {
      console.error('Create branch error', e);
      alert('❌ Could not create branch');
    }
  });

  // ─── MERGE FLOW ────────────────────────────────
  document.getElementById('merge-btn')?.addEventListener('click', async () => {
    mainPanel.style.display  = 'none';
    mergePanel.style.display = 'block';
    document.getElementById('merge-status').textContent = '';
    const base = await getBackend();
    try {
      const branches = await fetchBranches(base);
      const src = document.getElementById('merge-source');
      const tgt = document.getElementById('merge-target');
      [src, tgt].forEach(sel => {
        sel.innerHTML = '<option value="">Select branch</option>';
        branches.forEach(b => {
          const o = document.createElement('option');
          o.value = b.id;
          o.textContent = `${b.name} (#${b.id})`;
          sel.append(o.cloneNode(true));
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
    const base  = await getBackend();
    const token = await getToken();
    try {
      const r = await fetch(`${base}/merge/${src}/${tgt}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await r.json();
      document.getElementById('merge-status').textContent = r.ok
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
