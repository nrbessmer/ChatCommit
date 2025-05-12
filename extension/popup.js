// popup.js
console.log('[popup.js] loaded]');

document.addEventListener('DOMContentLoaded', () => {
  console.log('[popup] DOMContentLoaded');

  // ───── PANELS & STATUS ─────
  const loginPanel    = document.getElementById('login-panel');
  const mainPanel     = document.getElementById('main-panel');
  const settingsPanel = document.getElementById('settings-panel');
  const mergePanel    = document.getElementById('merge-panel');
  const statusMsg     = document.getElementById('status-message');
  const loginStatus   = document.getElementById('login-status');

  // ───── STORAGE & API BASE ─────
  const STORAGE_KEY_TOKEN = 'chatcommit_auth_token';
  const API_BASE_DEFAULT  = 'https://chatcommit.fly.dev';
  const getBackend = () => new Promise(res => chrome.storage.local.get('repoUrl', o => res(o.repoUrl || API_BASE_DEFAULT)));

  // ───── AUTO-LOGIN CHECK ─────
  if (localStorage.getItem(STORAGE_KEY_TOKEN)) {
    loginPanel.style.display = 'none';
    mainPanel.style.display  = 'block';
    initApp();
  }

  // ───── LOGIN HANDLER ─────
  const loginBtn = document.getElementById('login-submit');
  if (loginBtn) {
    loginBtn.type = 'button';
    loginBtn.addEventListener('click', async () => {
      loginStatus.textContent = '⏳ Logging in…';
      const email    = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;
      try {
        const res = await fetch(`${API_BASE_DEFAULT}/auth/users/login`, {
          method: 'POST', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({email, password})
        });
        if (!res.ok) throw new Error(`Login failed (${res.status})`);
        const {access_token} = await res.json();
        localStorage.setItem(STORAGE_KEY_TOKEN, access_token);
        loginStatus.textContent = '✅ Success!';
        loginPanel.style.display = 'none';
        mainPanel.style.display  = 'block';
        initApp();
      } catch (err) {
        console.error('[popup] login error', err);
        loginStatus.textContent = '❌ Login failed';
      }
    });
  }

  // ───── MAIN APP INITIALIZER ─────
  function initApp() {
    console.log('[popup] initApp start');

    // UI ELEMENTS
    const refreshBtn      = document.getElementById('refresh-chat');
    const branchSelect    = document.getElementById('branch-select');
    const messageInput    = document.getElementById('message-input');
    const contextArea     = document.getElementById('context-area');
    const tagInput        = document.getElementById('tag-input');
    const commitBtn       = document.getElementById('commit-btn');
    const createBranchBtn = document.getElementById('create-branch');
    const viewBranchesBtn = document.getElementById('view-branches');
    const copyContextBtn  = document.getElementById('copy-context');

    const settingsBtn     = document.getElementById('settings-btn');
    const saveSettingsBtn = document.getElementById('save-settings');
    const backBtn         = document.getElementById('back-btn');
    const openaiKeyField  = document.getElementById('openai-key');
    const backendUrlField = document.getElementById('backend-url');
    const repoHookField   = document.getElementById('repo-hook');

    const mergeBtn        = document.getElementById('merge-btn');
    const mergeSource     = document.getElementById('merge-source');
    const mergeTargetSel  = document.getElementById('merge-target');
    const executeMerge    = document.getElementById('execute-merge');
    const cancelMerge     = document.getElementById('cancel-merge');
    const mergeStatus     = document.getElementById('merge-status');

    const rollbackBtn     = document.getElementById('rollback-btn');
    const timelineBtn     = document.getElementById('timeline-btn');

    const logoutBtn       = document.getElementById('logout-btn');

    // ───── LOGOUT ─────
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

    // ───── SETTINGS ─────
    saveSettingsBtn?.addEventListener('click', () => {
      chrome.storage.local.set({
        openai:   openaiKeyField.value.trim(),
        repoUrl:  backendUrlField.value.trim(),
        repoHook: repoHookField.value.trim()
      }, () => {
        statusMsg.textContent = '✅ Settings saved';
        settingsPanel.style.display = 'none';
        mainPanel.style.display     = 'block';
      });
    });
    settingsBtn?.addEventListener('click', () => {
      mainPanel.style.display     = 'none';
      settingsPanel.style.display = 'block';
      chrome.storage.local.get(['openai','repoUrl','repoHook'], res => {
        openaiKeyField.value   = res.openai   || '';
        backendUrlField.value  = res.repoUrl  || API_BASE_DEFAULT;
        repoHookField.value    = res.repoHook || '';
      });
    });
    backBtn?.addEventListener('click', () => {
      settingsPanel.style.display = 'none';
      mainPanel.style.display     = 'block';
    });

    // ───── FETCH & POPULATE BRANCHES ─────
    async function fetchBranches(base) {
      const res = await fetch(`${base}/branch/`, {
        headers: { Authorization: `Bearer ${localStorage.getItem(STORAGE_KEY_TOKEN)}` }
      });
      if (!res.ok) throw new Error(`Branches API failed (${res.status})`);
      return res.json();
    }
    async function populateBranchSelect() {
      const base = await getBackend();
      try {
        const branches = await fetchBranches(base);
        branchSelect.innerHTML = '';
        if (!branches.length) {
          const opt = document.createElement('option');
          opt.textContent = 'No branches available';
          opt.disabled = true;
          branchSelect.append(opt);
        } else {
          branches.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b.id;
            opt.textContent = `${b.name} (#${b.id})`;
            branchSelect.append(opt);
          });
        }
      } catch (e) {
        console.error('[popup] populateBranchSelect error', e);
        statusMsg.textContent = '❌ Failed to load branches';
      }
    }

    // ───── SCRAPE CHAT ─────
    async function scrapeChat() {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const [{ result }] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const messages = [];
            document.querySelectorAll('[data-message-author-role]').forEach(el => {
              const role = el.getAttribute('data-message-author-role') === 'user' ? 'User' : 'AI';
              const t = el.innerText.trim();
              if (t) messages.push(`${role}: ${t}`);
            });
            const canvas_images = [];
            document.querySelectorAll('canvas').forEach(cv => {
              try { canvas_images.push(cv.toDataURL()); } catch { canvas_images.push(null); }
            });
            const images = Array.from(document.querySelectorAll('img.chatImage')).map(i => i.src);
            return { messages, canvas_images, images };
          }
        });
        contextArea.value = JSON.stringify(result, null, 2);
        statusMsg.textContent = '✅ Chat scraped';
      } catch (e) {
        console.error('[popup] scrapeChat error', e);
        statusMsg.textContent = '❌ Failed to scrape';
      }
    }
    refreshBtn?.addEventListener('click', scrapeChat);
    copyContextBtn?.addEventListener('click', () =>
      navigator.clipboard.writeText(contextArea.value)
        .then(() => statusMsg.textContent = '✅ Context copied')
        .catch(() => statusMsg.textContent = '❌ Copy failed')
    );

    // ───── COMMIT ─────
    commitBtn?.addEventListener('click', async () => {
      const base = await getBackend();
      const commit_message = messageInput.value.trim();
      let ctx;
      try { ctx = JSON.parse(contextArea.value); } catch { return statusMsg.textContent = '❌ Invalid JSON'; }
      const branch_id = parseInt(branchSelect.value, 10);
      if (!commit_message || !ctx.messages?.length || !branch_id) {
        statusMsg.textContent = '❌ Missing commit data';
        return;
      }
      try {
        const res = await fetch(`${base}/commit/`, {
          method: 'POST', headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem(STORAGE_KEY_TOKEN)}`
          },
          body: JSON.stringify({ commit_message, conversation_context: ctx, branch_id })
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.detail || JSON.stringify(d));
        let msg = `✅ Commit #${d.commit_hash.slice(0,8)} saved`;
        const tag = tagInput.value.trim();
        if (tag) {
          const tRes = await fetch(`${base}/tag/`, {
            method: 'POST', headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localStorage.getItem(STORAGE_KEY_TOKEN)}`
            },
            body: JSON.stringify({ name: tag, commit_id: d.id })
          });
          msg += tRes.ok ? ' + Tag added' : ' (Tag failed)';
        }
        statusMsg.textContent = msg;
      } catch (err) {
        console.error('[popup] commit error', err);
        statusMsg.textContent = `❌ Commit error: ${err.message}`;
      }
    });

    // ───── BRANCH CREATION & VIEW ─────
    createBranchBtn?.addEventListener('click', async () => {
      const name = prompt('New branch name:'); if (!name) return;
      const base = await getBackend();
      try {
        const res = await fetch(`${base}/branch/`, {
          method: 'POST', headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem(STORAGE_KEY_TOKEN)}`
          },
          body: JSON.stringify({ name })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        alert('✅ Branch created');
        populateBranchSelect();
      } catch (e) {
        console.error('[popup] create branch error', e);
        alert('❌ Could not create branch');
      }
    });
    viewBranchesBtn?.addEventListener('click', () =>
      chrome.tabs.create({ url: `${API_BASE_DEFAULT}/branches` })
    );

    // ───── ROLLBACK & TIMELINE ─────
    rollbackBtn?.addEventListener('click', () =>
      chrome.tabs.create({ url: `${API_BASE_DEFAULT}/rollback` })
    );
    timelineBtn?.addEventListener('click', () =>
      chrome.tabs.create({ url: `${API_BASE_DEFAULT}/timeline` })
    );

    // ───── MERGE FLOW ─────
    mergeBtn?.addEventListener('click', async () => {
      mainPanel.style.display  = 'none';
      mergePanel.style.display = 'block';
      mergeStatus.textContent  = '';
      const base = await getBackend();
      try {
        const branches = await fetchBranches(base);
        mergeSource.innerHTML = '<option value="">Select source</option>';
        mergeTargetSel.innerHTML = '<option value="">Select target</option>';
        branches.forEach(b => {
          const o1 = document.createElement('option'); o1.value = b.id; o1.textContent = `${b.name} (#${b.id})`;
          const o2 = o1.cloneNode(true);
          mergeSource.append(o1);
          mergeTargetSel.append(o2);
        });
      } catch (e) {
        console.error('[popup] merge load error', e);
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
        const res = await fetch(`${base}/merge/${src}/${tgt}`, {
          method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem(STORAGE_KEY_TOKEN)}` }
        });
        const data = await res.json();
        mergeStatus.textContent = res.ok ? `✅ ${data.message}` : `❌ ${data.detail || data.message}`;
      } catch (e) {
        console.error('[popup] merge error', e);
        mergeStatus.textContent = '❌ Merge failed';
      }
    });
    cancelMerge?.addEventListener('click', () => {
      mergePanel.style.display = 'none';
      mainPanel.style.display  = 'block';
    });

    // ───── INITIALIZE CONTENT ─────
    populateBranchSelect();
    scrapeChat();
  }
});