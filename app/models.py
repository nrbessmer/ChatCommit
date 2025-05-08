// popup.js — Full file with debug logging and correct endpoints

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

  // Skip login if we already have a token
  if (localStorage.getItem(STORAGE_KEY_TOKEN)) {
    loginPanel.style.display = "none";
    mainPanel.style.display  = "block";
    initApp();
  }

  // ───── LOGIN LOGIC ─────
  console.log('[popup] binding login handler');
  const loginBtn = document.getElementById("login-submit");
  console.log('[popup] loginBtn is', loginBtn);
  loginBtn.onclick = async () => {
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
  };

  // ───── MAIN APP ─────
  function initApp() {
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
      chrome.storage.local.get([
        "openai", "repoUrl", "repoHook"
      ], (res) => {
        openaiKeyField.value   = res.openai   || "";
        backendUrlField.value  = res.repoUrl  || API_BASE;
        repoHookField.value    = res.repoHook || "";
      });
    }
    saveSettingsBtn.onclick = () => {
      chrome.storage.local.set({
        openai:  openaiKeyField.value.trim(),
        repoUrl: backendUrlField.value.trim(),
        repoHook:repoHookField.value.trim()
      }, () => {
        statusMsg.textContent        = "✅ Settings saved";
        settingsPanel.style.display  = "none";
        mainPanel.style.display      = "block";
      });
    };
    settingsBtn.onclick = () => {
      mainPanel.style.display      = "none";
      settingsPanel.style.display  = "block";
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
      const r = await fetch(`${base}/branch/`, {
        headers: { Authorization: `Bearer ${localStorage.getItem(STORAGE_KEY_TOKEN)}` }
      });
      if (!r.ok) throw new Error("Branch API failed");
      return r.json();
    };

    const populateSelect = async (base, selectEl, excludeId = null) => {
      selectEl.innerHTML = "";
      try {
        const branches = await fetchBranches(base);
        branches.forEach(({ id, name }) => {
          if (excludeId !== null && id === excludeId) return;
          const o = document.createElement("option");
          o.value = id;
          o.textContent = `${name} (#${id})`;
          selectEl.appendChild(o);
        });
      } catch {
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
            document.querySelectorAll("canvas").forEach((cv) => {
              try { canvas_images.push(cv.toDataURL()); } catch { canvas_images.push(null); }
            });
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
    refreshBtn.onclick    = () => getBackend().then(scrapeChat);
    copyContextBtn.onclick = () =>
      navigator.clipboard.writeText(contextArea.value)
        .then(() => statusMsg.textContent = "✅ Context copied")
        .catch(() => statusMsg.textContent = "❌ Copy failed");

    // ─── COMMIT ───
    commitBtn.onclick = async () => {
      const base = await getBackend();
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

      // 🔍 DEBUG: log token & URL
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
