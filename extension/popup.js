// popup.js
console.log('[popup.js] loaded');

document.addEventListener('DOMContentLoaded', () => {
  // Panels & messages
  const loginPanel    = document.getElementById('login-panel');
  const mainPanel     = document.getElementById('main-panel');
  const settingsPanel = document.getElementById('settings-panel');
  const mergePanel    = document.getElementById('merge-panel');
  const statusMsg     = document.getElementById('status-message');
  const loginStatus   = document.getElementById('login-status');

  // Storage & endpoints
  // 🔑 Use the same key your backend expects
  const STORAGE_KEY_TOKEN = 'auth_token';
  const API_BASE_DEFAULT  = 'https://chatcommit.fly.dev';
  const VERCEL_BASE       = 'https://chat-commit.vercel.app';

  let lastScrapeData = null;

  const getBackend = () =>
    new Promise(res =>
      chrome.storage.local.get('repoUrl', o => res(o.repoUrl || API_BASE_DEFAULT))
    );

  // ─── LOGIN ─────────────────────────────────────────
  const loginBtn = document.getElementById('login-submit');
  loginBtn?.addEventListener('click', async () => {
    loginStatus.textContent = '⏳ Logging in…';
    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    try {
      const r = await fetch(`${API_BASE_DEFAULT}/auth/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (!r.ok) throw r;
      const { access_token } = await r.json();
      console.log('[login] got token →', access_token);
      localStorage.setItem(STORAGE_KEY_TOKEN, access_token);
      loginStatus.textContent = '✅ Logged in';
      loginPanel.style.display = 'none';
      mainPanel.style.display  = 'block';
      // initialize after successful login
      await populateBranchSelect();
      await scrapeChat();
    } catch (e) {
      console.error('Login error', e);
      loginStatus.textContent = '❌ Login failed';
    }
  });

  // Auto‑login if token present
  const existingToken = localStorage.getItem(STORAGE_KEY_TOKEN);
  console.log('[startup] existing token →', existingToken);
  if (existingToken) {
    loginPanel.style.display = 'none';
    mainPanel.style.display  = 'block';
    // initialize on auto‑login
    populateBranchSelect();
    scrapeChat();
  }

  // ─── MAIN APP ────────────────────────────────────
  function initApp() {
    // not used; we initialize on login directly
  }

  // ─── FETCH & POPULATE BRANCHES ─────────────────
  async function fetchBranches(base) {
    const token = localStorage.getItem(STORAGE_KEY_TOKEN);
    console.log('[fetchBranches] using token →', token);
    const r = await fetch(`${base}/branch/`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!r.ok) throw r;
    return r.json();
  }
  async function populateBranchSelect() {
    const base = await getBackend();
    try {
      const branches = await fetchBranches(base);
      const branchSelect = document.getElementById('branch-select');
      branchSelect.innerHTML = '';
      if (!branches.length) {
        const o = document.createElement('option');
        o.textContent = 'No branches available';
        o.disabled = true;
        branchSelect.append(o);
      } else {
        branches.forEach(b => {
          const o = document.createElement('option');
          o.value = b.id;
          o.textContent = `${b.name} (#${b.id})`;
          branchSelect.append(o);
        });
      }
    } catch (e) {
      console.error('populateBranchSelect error', e);
      statusMsg.textContent = '❌ Failed to load branches';
    }
  }

  // ─── NAVIGATION BUTTONS ───────────────────────
  document.getElementById('view-branches')?.addEventListener('click', () => {
    chrome.tabs.create({ url: `${VERCEL_BASE}/branches` });
  });
  document.getElementById('rollback-btn')?.addEventListener('click', () => {
    chrome.tabs.create({ url: `${VERCEL_BASE}/rollback` });
  });
  document.getElementById('timeline-btn')?.addEventListener('click', () => {
    chrome.tabs.create({ url: `${VERCEL_BASE}/timeline` });
  });

  // ─── REFRESH & SCRAPE CHAT ────────────────────
  async function scrapeChat() {
    try {
      const [tab] = await chrome.tabs.query({ active:true, currentWindow:true });
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
      const contextTable = document.getElementById('context-table');
      contextTable.innerHTML = '';
      result.messages.forEach(({ role, text }) => {
        const tr = document.createElement('tr');
        tr.className = role === 'User' ? 'user-row' : 'ai-row';
        const tdRole = document.createElement('td');
        tdRole.textContent = role;
        const tdText = document.createElement('td');
        tdText.textContent = text;
        tr.append(tdRole, tdText);
        contextTable.appendChild(tr);
      });
      statusMsg.textContent = '✅ Chat scraped';
    } catch (e) {
      console.error('scrapeChat error', e);
      statusMsg.textContent = '❌ Failed to scrape';
    }
  }
  document.getElementById('refresh-chat')?.addEventListener('click', scrapeChat);

  // ─── COPY PRETTY CONTEXT ──────────────────────
  document.getElementById('copy-context')?.addEventListener('click', () => {
    let out = 'Role\tMessage\n';
    document.querySelectorAll('#context-table tr').forEach(tr => {
      out += `${tr.cells[0].textContent}\t${tr.cells[1].textContent}\n`;
    });
    navigator.clipboard.writeText(out)
      .then(() => statusMsg.textContent = '✅ Context copied')
      .catch(() => statusMsg.textContent = '❌ Copy failed');
  });

  // ─── COMMIT ───────────────────────────
  document.getElementById('commit-btn')?.addEventListener('click', async () => {
    const base           = await getBackend();
    const commit_message = document.getElementById('message-input').value.trim();
    const ctx            = lastScrapeData;
    const branch_id      = parseInt(document.getElementById('branch-select').value, 10);
    const tag            = document.getElementById('tag-input').value.trim();
    if (!commit_message || !ctx?.messages?.length || !branch_id) {
      return statusMsg.textContent = '❌ Missing commit data';
    }
    try {
      const token = localStorage.getItem(STORAGE_KEY_TOKEN);
      const r = await fetch(`${base}/commit/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          commit_message,
          conversation_context: { messages: ctx.messages.map(m => `${m.role}: ${m.text}`) },
          branch_id
        })
      });
      const data = await r.json();
      if (!r.ok) throw data;
      let msg = `✅ Commit #${data.commit_hash.slice(0,8)} saved`;
      if (tag) {
        const tRes = await fetch(`${base}/tag/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ name: tag, commit_id: data.id })
        });
        msg += tRes.ok ? ' + Tag added' : ' + Tag failed';
      }
      statusMsg.textContent = msg;
    } catch (err) {
      console.error('Commit error', err);
      statusMsg.textContent = `❌ Commit failed: ${JSON.stringify(err)}`;
    }
  });

  // ─── CREATE BRANCH ───────────────────────────
  document.getElementById('create-branch')?.addEventListener('click', async () => {
    const name = prompt('New branch name:');
    if (!name) return;
    const base = await getBackend();
    try {
      const token = localStorage.getItem(STORAGE_KEY_TOKEN);
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
      alert(`❌ Could not create branch: ${e}`);
    }
  });

  // ─── MERGE FLOW ──────────────────────────────
  document.getElementById('merge-btn')?.addEventListener('click', async () => {
    mainPanel.style.display  = 'none';
    mergePanel.style.display = 'block';
    document.getElementById('merge-status').textContent = '';
    const base = await getBackend();
    try {
      const branches = await fetchBranches(base);
      const srcSel = document.getElementById('merge-source');
      const tgtSel = document.getElementById('merge-target');
      [srcSel, tgtSel].forEach(sel => {
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
      document.getElementById('merge-status').textContent = '❌ Select two different branches';
      return;
    }
    const base  = await getBackend();
    const token = localStorage.getItem(STORAGE_KEY_TOKEN);
    try {
      const r = await fetch(`${base}/merge/${src}/${tgt}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await r.json();
      document.getElementById('merge-status').textContent = r.ok
        ? `✅ ${data.message}`
        : `❌ ${JSON.stringify(data)}`;
    } catch (e) {
      console.error('Merge error', e);
      document.getElementById('merge-status').textContent = '❌ Merge failed';
    }
  });
  document.getElementById('cancel-merge')?.addEventListener('click', () => {
    mergePanel.style.display = 'none';
    mainPanel.style.display  = 'block';
  });
});
