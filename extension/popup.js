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
  const STORAGE_KEY_TOKEN = 'auth_token';
  const API_BASE_DEFAULT  = 'https://chatcommit.fly.dev';
  const VERCEL_BASE       = 'https://chat-commit.vercel.app';

  let lastScrapeData = null;

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
      // init
      await populateBranchSelect();
      await scrapeChat();
    } catch (e) {
      console.error('Login error', e);
      loginStatus.textContent = '❌ Login failed';
    }
  });

  // Auto‑login if token present
  if (localStorage.getItem(STORAGE_KEY_TOKEN)) {
    loginPanel.style.display = 'none';
    mainPanel.style.display  = 'block';
    populateBranchSelect();
    scrapeChat();
  }

  // ─── FETCH & POPULATE BRANCHES ─────────────────
  async function fetchBranches(base) {
    // token injection handled in background.js
    const r = await fetch(`${base}/branch/`);
    if (!r.ok) throw r;
    return r.json();
  }
  async function populateBranchSelect() {
    const base = await getBackend();
    try {
      const branches = await fetchBranches(base);
      const select = document.getElementById('branch-select');
      select.innerHTML = '';
      if (!branches.length) {
        const o = document.createElement('option');
        o.textContent = 'No branches available';
        o.disabled = true;
        select.append(o);
      } else {
        branches.forEach(b => {
          const o = document.createElement('option');
          o.value = b.id;
          o.textContent = `${b.name} (#${b.id})`;
          select.append(o);
        });
      }
    } catch (e) {
      console.error('populateBranchSelect error', e);
      statusMsg.textContent = '❌ Failed to load branches';
    }
  }

  // ─── NAVIGATION ────────────────────────────────
  document.getElementById('view-branches')?.addEventListener('click', () =>
    chrome.tabs.create({ url: `${VERCEL_BASE}/branches` })
  );
  document.getElementById('rollback-btn')?.addEventListener('click', () =>
    chrome.tabs.create({ url: `${VERCEL_BASE}/rollback` })
  );
  document.getElementById('timeline-btn')?.addEventListener('click', () =>
    chrome.tabs.create({ url: `${VERCEL_BASE}/timeline` })
  );

  // ─── SCRAPE CHAT ───────────────────────────────
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

  // ─── COPY CONTEXT ──────────────────────────────
  document.getElementById('copy-context')?.addEventListener('click', () => {
    let out = 'Role\tMessage\n';
    document.querySelectorAll('#context-table tr').forEach(tr => {
      out += `${tr.cells[0].textContent}\t${tr.cells[1].textContent}\n`;
    });
    navigator.clipboard.writeText(out)
      .then(() => statusMsg.textContent = '✅ Context copied')
      .catch(() => statusMsg.textContent = '❌ Copy failed');
  });

  // ─── COMMIT ───────────────────────────────────
  document.getElementById('commit-btn')?.addEventListener('click', async () => {
    const base    = await getBackend();
    const message = document.getElementById('message-input').value.trim();
    const ctx     = lastScrapeData;
    const branch  = parseInt(document.getElementById('branch-select').value, 10);
    const tag     = document.getElementById('tag-input').value.trim();
    if (!message || !ctx?.messages?.length || !branch) {
      return statusMsg.textContent = '❌ Missing commit data';
    }
    try {
      const r    = await fetch(`${base}/commit/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commit_message: message,
          conversation_context: { messages: ctx.messages.map(m => `${m.role}: ${m.text}`) },
          branch_id: branch
        })
      });
      const data = await r.json();
      if (!r.ok) throw data;
      let msg = `✅ Commit #${data.commit_hash.slice(0,8)} saved`;
      if (tag) {
        const tRes = await fetch(`${base}/tag/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
      const r = await fetch(`${base}/branch/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  // ─── MERGE PANEL ─────────────────────────────
  document.getElementById('merge-btn')?.addEventListener('click', async () => {
    mainPanel.style.display  = 'none';
    mergePanel.style.display = 'block';
    document.getElementById('merge-status').textContent = '';
    const base = await getBackend();
    try {
      const branches = await fetchBranches(base);
      ['merge-source','merge-target'].forEach(id => {
        const sel = document.getElementById(id);
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
    const base = await getBackend();
    try {
      const r    = await fetch(`${base}/merge/${src}/${tgt}`, { method: 'POST' });
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
