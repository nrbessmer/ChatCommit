document.addEventListener("DOMContentLoaded", () => {
  // ───── SETUP PANELS ─────
  const loginPanel    = document.getElementById("login-panel");
  const mainPanel     = document.getElementById("main-panel");
  const settingsPanel = document.getElementById("settings-panel");
  const mergePanel    = document.getElementById("merge-panel");
  const statusMsg     = document.getElementById("status-message");
  const loginStatus   = document.getElementById("login-status");

  const STORAGE_KEY_TOKEN = "chatcommit_auth_token";
  const API_BASE = "https://chatcommit.fly.dev";

  console.log('[popup] DOMContentLoaded - checking token');
  // Skip login if we already have a token
  if (localStorage.getItem(STORAGE_KEY_TOKEN)) {
    console.log('[popup] token found, initializing app');
    loginPanel.style.display = "none";
    mainPanel.style.display  = "block";
    initApp();
  }

  // ───── LOGIN LOGIC ─────
  console.log('[popup] binding login handler');
  const loginBtn = document.getElementById("login-submit");
  console.log('[popup] loginBtn is', loginBtn);
  // prevent form submission reload
  loginBtn.type = "button";
  loginBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    console.log('[popup] login button clicked');
    const email    = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    loginStatus.textContent = "⏳ Logging in…";

    try {
      console.log('[popup] about to fetch', `${API_BASE}/auth/users/login`);
      const res = await fetch(`${API_BASE}/auth/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      console.log('[popup] fetch returned', res.status);
      if (!res.ok) throw new Error(`Login failed (${res.status})`);
      const { access_token } = await res.json();
      console.log('[popup] got token', access_token);
      localStorage.setItem(STORAGE_KEY_TOKEN, access_token);

      loginStatus.textContent = "✅ Success!";
      loginPanel.style.display = "none";
      mainPanel.style.display  = "block";
      initApp();
    } catch (err) {
      console.error("Login error:", err);
      loginStatus.textContent = "❌ Login failed";
    }
  });

  // ───── MAIN APP ─────
  function initApp() {
    console.log('[popup] initApp start');

    // UI elements
    const refreshBtn      = document.getElementById("refresh-chat");
    const branchSelect    = document.getElementById("branch-select");
    const messageInput    = document.getElementById("message-input");
    const contextArea     = document.getElementById("context-area");
    const tagInput        = document.getElementById("tag-input");
    const commitBtn       = document.getElementById("commit-btn");
    const createBranchBtn = document.getElementById("create-branch");
    const viewBranchesBtn = document.getElementById("view-branches");
    const copyContextBtn  = document.getElementById("copy-context");

    const settingsBtn     = document.getElementById("settings-btn");
    const saveSettingsBtn = document.getElementById("save-settings");
    const backBtn         = document.getElementById("back-btn");
    const openaiKeyField  = document.getElementById("openai-key");
    const backendUrlField = document.getElementById("backend-url");
    const repoHookField   = document.getElementById("repo-hook");

    const mergeBtn        = document.getElementById("merge-btn");
    const mergeSource     = document.getElementById("merge-source");
    const mergeTargetSel  = document.getElementById("merge-target");
    const executeMerge    = document.getElementById("execute-merge");
    const cancelMerge     = document.getElementById("cancel-merge");
    const mergeStatus     = document.getElementById("merge-status");

    const rollbackBtn     = document.getElementById("rollback-btn");
    const timelineBtn     = document.getElementById("timeline-btn");

    const logoutBtn       = document.getElementById("logout-btn");

    // ─── LOGOUT ───
    logoutBtn.onclick = () => {
      console.log('[popup] logging out');
      localStorage.removeItem(STORAGE_KEY_TOKEN);
      chrome.storage.local.clear(() => {
        loginPanel.style.display    = "block";
        mainPanel.style.display     = "none";
        settingsPanel.style.display = "none";
        mergePanel.style.display    = "none";
        loginStatus.textContent     = "🔒 Logged out";
      });
    };

    // ─── SETTINGS ───
    function loadSettings() {
      chrome.storage.local.get(
        ["openai", "repoUrl", "repoHook"],
        (res) => {
          openaiKeyField.value   = res.openai   || "";
          backendUrlField.value  = res.repoUrl  || API_BASE;
          repoHookField.value    = res.repoHook || "";
        }
      );
    }
    saveSettingsBtn.onclick = () => {
      chrome.storage.local.set({
        openai:   openaiKeyField.value.trim(),
        repoUrl:  backendUrlField.value.trim(),
        repoHook: repoHookField.value.trim()
      }, () => {
        statusMsg.textContent       = "✅ Settings saved";
        settingsPanel.style.display = "none";
        mainPanel.style.display     = "block";
      });
    };
    settingsBtn.onclick = () => {
      mainPanel.style.display     = "none";
      settingsPanel.style.display = "block";
      loadSettings();
    };
    backBtn.onclick = () => {
      settingsPanel.style.display = "none";
      mainPanel.style.display     = "block";
    };

    // ─── HELPERS ───
    const getBackend = () =>
      new Promise(res =>
        chrome.storage.local.get("repoUrl", (o) => res(o.repoUrl || API_BASE))
      );

    const fetchBranches = async (base) => {
      console.log('[popup] fetchBranches fetching from', base + '/branch/');
      const r = await fetch(`${base}/branch/`, {
        headers: { Authorization: `Bearer ${localStorage.getItem(STORAGE_KEY_TOKEN)}` }
      });
      console.log('[popup] fetchBranches status', r.status);
      if (!r.ok) throw new Error("Branch API failed");
      const data = await r.json();
      console.log('[popup] fetchBranches data', data);
      return data;
    };

    const populateSelect = async (base, selectEl, excludeId = null) => {
      console.log('[popup] populateSelect: clearing', selectEl.id);
      selectEl.innerHTML = "";
      try {
        const branches = await fetchBranches(base);
        console.log('[popup] populateSelect: branches returned', branches);
        if (!branches.length) {
          console.warn('[popup] populateSelect: no branches available');
          const o = document.createElement("option");
          o.textContent = "No branches available";
          o.disabled = true;
          selectEl.appendChild(o);
          return;
        }
        branches.forEach(({ id, name }) => {
          if (excludeId !== null && id === excludeId) return;
          const o = document.createElement("option");
          o.value = id;
          o.textContent = `${name} (#${id})`;
          selectEl.appendChild(o);
        });
        console.log('[popup] populateSelect: done populating');
      } catch (err) {
        console.error('[popup] populateSelect error', err);
        statusMsg.textContent = "❌ Failed to load branches";
      }
    };

    // ─── SCRAPE CHAT ───
    const scrapeChat = async (base) => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const [{ result }] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const messages = [];
            document.querySelectorAll("[data-message-author-role]").forEach((el) => {
              const role = el.getAttribute("data-message-author-role") === "user" ? "User" : "AI";
              const t = el.innerText.trim();
              if (t) messages.push(`${role}: ${t}`);
            });
            const canvas_images = [];
            document.querySelectorAll("canvas").forEach((cv) => { try { canvas_images.push(cv.toDataURL()); } catch { canvas_images.push(null); } });
            const images = Array.from(document.querySelectorAll("img.chatImage")).map((i) => i.src);
            return { messages, canvas_images, images };
          }
        });
        contextArea.value = JSON.stringify(result, null, 2);
        statusMsg.textContent = "✅ Chat scraped";
      } catch {
        statusMsg.textContent = "❌ Failed to scrape";
      }
    };
    refreshBtn.onclick     = () => getBackend().then(scrapeChat);
    copyContextBtn.onclick = () =>
      navigator.clipboard.writeText(contextArea.value)
        .then(() => statusMsg.textContent = "✅ Context copied")
        .catch(() => statusMsg.textContent = "❌ Copy failed");

    // ─── COMMIT ───
    commitBtn.onclick = async () => {
      const base          = await getBackend();
      const commit_message = messageInput.value.trim();
      let ctx;
      try {
        ctx = JSON.parse(contextArea.value);
      } catch {
        return statusMsg.textContent = "❌ Invalid JSON";
      }
      const branch_id = parseInt(branchSelect.value, 10);
      if (!commit_message || !ctx.messages?.length || !branch_id) {
        return statusMsg.textContent = "❌ Missing commit data";
      }

      console.log("COMMIT: using token", localStorage.getItem(STORAGE_KEY_TOKEN));
      console.log("COMMIT: POST to", `${base}/commit/`);

      try {
        const r = await fetch(`${base}/commit/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem(STORAGE_KEY_TOKEN)}`
          },
          body: JSON.stringify({ commit_message, conversation_context: ctx, branch_id })
        });

        console.log("COMMIT: response status", r.status);

        const d = await r.json();
        if (!r.ok) {
          return statusMsg.textContent = `❌ Commit error: ${d.detail || JSON.stringify(d)}`;
        }

        let msg = `✅ Commit #${d.commit_hash.slice(0,8)} saved`;
        const tag = tagInput.value.trim();
        if (tag) {
          console.log("COMMIT: adding tag", tag);
          const tagRes = await fetch(`${base}/tag/`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem(STORAGE_KEY_TOKEN)}`
            },
            body: JSON.stringify({ name: tag, commit_id: d.id })
          });
          console.log("COMMIT: tag response status", tagRes.status);
          msg += tagRes.ok ? " + Tag added" : " (Tag failed)";
        }

        statusMsg.textContent = msg;
      } catch (err) {
        console.error("COMMIT: fetch error", err);
        statusMsg.textContent = "❌ Commit failed";
      }
    };

    // ─── CREATE/VIEW BRANCH ───
    createBranchBtn.onclick = () => {
      const name = prompt("New branch name:");
      if (!name) return;
      getBackend().then(async (base) => {
        const r = await fetch(`${base}/branch/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem(STORAGE_KEY_TOKEN)}`
          },
          body: JSON.stringify({ name })
        });
        if (r.ok) {
          alert("✅ Branch created");
          populateSelect(base, branchSelect);
        } else {
          alert("❌ Could not create branch");
        }
      });
    };
    viewBranchesBtn.onclick = () =>
      chrome.tabs.create({ url: "https://chat-commit.vercel.app/branches" });

    // ─── ROLLBACK & TIMELINE ───
    rollbackBtn.onclick = () =>
      chrome.tabs.create({ url: "https://chat-commit.vercel.app/rollback" });
    timelineBtn.onclick = () =>
      chrome.tabs.create({ url: "https://chat-commit.vercel.app/timeline" });

    <!-- ───────── MERGE PANEL ───────── -->
    <div class="container" id="merge-panel" style="display:none">
      <h2 class="header">🔀 Merge Branches</h2>

      <label for="merge-source">Source Branch</label>
      <select id="merge-source"></select>

      <label for="merge-target">Target Branch</label>
      <select id="merge-target"></select>

      <div class="button-group">
        <button id="execute-merge" class="blue">✅ Confirm</button>
        <button id="cancel-merge">⬅️ Cancel</button>
      </div>

      <p id="merge-status" class="message"></p>
    </div>

    <script>
      const API_BASE = 'https://chatcommit.fly.dev';

      async function loadBranchesInto(selectorIds) {
        try {
          const resp = await fetch(`${API_BASE}/branch/`);
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const branches = await resp.json();
          selectorIds.forEach(id => {
            const sel = document.getElementById(id);
            sel.innerHTML = `<option value="">-- Select branch --</option>`;
            branches.forEach(b => {
              const opt = document.createElement('option');
              opt.value = b.id;
              opt.textContent = `${b.name} (#${b.id})`;
              sel.appendChild(opt);
            });
          });
        } catch (err) {
          console.error('Failed to load branches:', err);
          document.getElementById('merge-status').textContent = '❌ Could not load branches';
        }
      }

      document.addEventListener('DOMContentLoaded', () => {
        // populate both selects
        loadBranchesInto(['merge-source', 'merge-target']);

        document.getElementById('execute-merge').addEventListener('click', async () => {
          const src = document.getElementById('merge-source').value;
          const tgt = document.getElementById('merge-target').value;
          const status = document.getElementById('merge-status');
          status.textContent = '';

          if (!src || !tgt || src === tgt) {
            return alert('Please select two different branches to merge.');
          }

          try {
            const token = localStorage.getItem('auth_token') || '';
            const res = await fetch(
              `${API_BASE}/merge/${src}/${tgt}`,
              {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
              }
            );
            const data = await res.json();
            if (!res.ok) throw data;
            status.textContent = data.message;
          } catch (err) {
            const msg = err.detail || err.message || 'Merge failed';
            status.textContent = `❌ ${msg}`;
          }
        });

        document.getElementById('cancel-merge').addEventListener('click', () => {
          document.getElementById('merge-panel').style.display = 'none';
        });
      });
    </script>

    // ─── INITIALIZE ───
    getBackend().then((base) => {
      console.log('[popup] initial backend URL', base);
      populateSelect(base, branchSelect);
      scrapeChat(base);
    });
  }
});
