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
  const STORAGE_KEY_TOKEN = 'chatcommit_auth_token';
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
      localStorage.setItem(STORAGE_KEY_TOKEN, access_token);
      loginStatus.textContent = '✅ Logged in';
      loginPanel.style.display = 'none';
      mainPanel.style.display  = 'block';
      initApp();
    } catch (e) {
      console.error('Login error', e);
      loginStatus.textContent = '❌ Login failed';
    }
  });

  // Auto‑login if token present
  if (localStorage.getItem(STORAGE_KEY_TOKEN)) {
    loginPanel.style.display = 'none';
    mainPanel.style.display  = 'block';
    initApp();
  }

  // ─── MAIN APP ────────────────────────────────────
  function initApp() {
    // Elements
    const refreshBtn       = document.getElementById('refresh-chat');
    const branchSelect     = document.getElementById('branch-select');
    const messageInput     = document.getElementById('message-input');
    const tagInput         = document.getElementById('tag-input');
    const commitBtn        = document.getElementById('commit-btn');
    const createBranchBtn  = document.getElementById('create-branch');
    const viewBranchesBtn  = document.getElementById('view-branches');
    const copyContextBtn   = document.getElementById('copy-context');
    const settingsBtn      = document.getElementById('settings-btn');
    const saveSettingsBtn  = document.getElementById('save-settings');
    const backBtn          = document.getElementById('back-btn');
    const openaiKeyField   = document.getElementById('openai-key');
    const backendUrlField  = document.getElementById('backend-url');
    const repoHookField    = document.getElementById('repo-hook');
    const mergeBtn         = document.getElementById('merge-btn');
    const mergeSource      = document.getElementById('merge-source');
    const mergeTargetSel   = document.getElementById('merge-target');
    const executeMerge     = document.getElementById('execute-merge');
    const cancelMerge      = document.getElementById('cancel-merge');
    const mergeStatus      = document.getElementById('merge-status');
    const rollbackBtn      = document.getElementById('rollback-btn');
    const timelineBtn      = document.getElementById('timeline-btn');
    const logoutBtn        = document.getElementById('logout-btn');
    const contextTable     = document.getElementById('context-table');

    // ─── LOGOUT ────────────────────────────────────
    logoutBtn?.addEventListener('click', () => {
      localStorage.removeItem(STORAGE_KEY_TOKEN);
      chrome.storage.local.clear(() => {
        loginPanel.style.display    = 'block';
        mainPanel.style.display     = 'none';
        settingsPanel.style.display = 'none';
        mergePanel.style.display    = 'none';
        loginStatus.textContent     = '🔒 Logged out';
      });
    });

    // ─── SETTINGS ──────────────────────────────────
    saveSettingsBtn?.addEventListener('click', () => {
      chrome.storage.local.set({
        openai:   openaiKeyField.value.trim(),
        repoUrl:  backendUrlField.value.trim(),
        repoHook: repoHookField.value.trim()
      }, () => {
        statusMsg.textContent       = '✅ Settings saved';
        settingsPanel.style.display = 'none';
        mainPanel.style.display     = 'block';
      });
    });
    settingsBtn?.addEventListener('click', () => {
      chrome.storage.local.get(['openai','repoUrl','repoHook'], res => {
        openaiKeyField.value   = res.openai   || '';
        backendUrlField.value  = res.repoUrl  || API_BASE_DEFAULT;
        repoHookField.value    = res.repoHook || '';
        mainPanel.style.display     = 'none';
        settingsPanel.style.display = 'block';
      });
    });
    backBtn?.addEventListener('click', () => {
      settingsPanel.style.display = 'none';
      mainPanel.style.display     = 'block';
    });

    // ─── FETCH & POPULATE BRANCHES ─────────────────
    async function fetchBranches(base) {
      const r = await fetch(`${base}/branch/`, {
        headers: { Authorization: `Bearer ${localStorage.getItem(STORAGE_KEY_TOKEN)}` }
      });
      if (!r.ok) throw r;
      return r.json();
    }
    async function populateBranchSelect() {
      const base = await getBackend();
      try {
        const branches = await fetchBranches(base);
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
    viewBranchesBtn?.addEventListener('click', () => {
      chrome.tabs.create({ url: `${VERCEL_BASE}/branches` });
    });
    rollbackBtn?.addEventListener('click', () => {
      chrome.tabs.create({ url: `${VERCEL_BASE}/rollback` });
    });
    timelineBtn?.addEventListener('click', () => {
      // fixed: drop trailing slash to avoid 307 redirect
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
    refreshBtn?.addEventListener('click', scrapeChat);

    // ─── COPY PRETTY CONTEXT ──────────────────────
    copyContextBtn?.addEventListener('click', () => {
      let out = 'Role\tMessage\n';
      Array.from(contextTable.querySelectorAll('tr')).forEach(tr => {
        out += `${tr.cells[0].textContent}\t${tr.cells[1].textContent}\n`;
      });
      navigator.clipboard.writeText(out)
        .then(() => statusMsg.textContent = '✅ Context copied')
        .catch(() => statusMsg.textContent = '❌ Copy failed');
    });

    // ─── COMMIT ───────────────────────────
    commitBtn.addEventListener('click', async () => {
      const base           = await getBackend();
      const commit_message = messageInput.value.trim();
      const ctx            = lastScrapeData;
      const branch_id      = parseInt(branchSelect.value, 10);
      const tag            = tagInput.value.trim();
      if (!commit_message || !ctx?.messages?.length || !branch_id) {
        return statusMsg.textContent = '❌ Missing commit data';
      }
      try {
        const stringMessages = ctx.messages.map(m => `${m.role}: ${m.text}`);
        const r = await fetch(`${base}/commit/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem(STORAGE_KEY_TOKEN)}`
          },
          body: JSON.stringify({
            commit_message,
            conversation_context: { messages: stringMessages },
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
              Authorization: `Bearer ${localStorage.getItem(STORAGE_KEY_TOKEN)}`
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
    createBranchBtn?.addEventListener('click', async () => {
      const name = prompt('New branch name:'); if (!name) return;
      const base = await getBackend();
      try {
        const r = await fetch(`${base}/branch/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem(STORAGE_KEY_TOKEN)}`
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
    mergeBtn?.addEventListener('click', async () => {
      mainPanel.style.display  = 'none';
      mergePanel.style.display = 'block';
      mergeStatus.textContent  = '';
      const base = await getBackend();
      try {
        const branches = await fetchBranches(base);
        [mergeSource, mergeTargetSel].forEach(sel => {
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
        mergeStatus.textContent = '❌ Could not load branches';
      }
    });
    executeMerge?.addEventListener('click', async () => {
      const src = mergeSource.value;
      const tgt = mergeTargetSel.value;
      if (!src || !tgt || src === tgt) {
        mergeStatus.textContent = '❌ Select two different branches';
        return;
      }
      const base = await getBackend();
      try {
        const r = await fetch(`${base}/merge/${src}/${tgt}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem(STORAGE_KEY_TOKEN)}` }
        });
        const data = await r.json();
        mergeStatus.textContent = r.ok
          ? `✅ ${data.message}`
          : `❌ ${JSON.stringify(data)}`;
      } catch (e) {
        console.error('Merge error', e);
        mergeStatus.textContent = '❌ Merge failed';
      }
    });
    cancelMerge?.addEventListener('click', () => {
      mergePanel.style.display = 'none';
      mainPanel.style.display  = 'block';
    });

    // ─── INITIALIZE ──────────────────────────────
    populateBranchSelect();
    scrapeChat();
  }
});
