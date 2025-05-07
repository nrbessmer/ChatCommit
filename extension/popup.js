document.addEventListener("DOMContentLoaded", () => {
  // ───── SETUP PANELS ─────
  const loginPanel   = document.getElementById("login-panel");
  const mainPanel    = document.getElementById("main-panel");
  const settingsPanel= document.getElementById("settings-panel");
  const mergePanel   = document.getElementById("merge-panel");
  const statusMsg    = document.getElementById("status-message");
  const loginStatus  = document.getElementById("login-status");

  const STORAGE_KEY_TOKEN = "chatcommit_auth_token";
  const API_BASE = "https://chatcommit.fly.dev";

  // If we have a token, skip login
  if (localStorage.getItem(STORAGE_KEY_TOKEN)) {
    loginPanel.style.display = "none";
    mainPanel.style.display  = "block";
    initApp();
  } else {
    loginPanel.style.display = "block";
    mainPanel.style.display  = "none";
  }

  // ───── LOGIN LOGIC ─────
  document.getElementById("login-submit").onclick = async () => {
    const email    = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    loginStatus.textContent = "⏳ Logging in…";

    try {
      const res = await fetch(`${API_BASE}/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      if (!res.ok) throw new Error("Invalid credentials");
      const data = await res.json();
      localStorage.setItem(STORAGE_KEY_TOKEN, data.token);
      loginStatus.textContent = "✅ Success!";
      loginPanel.style.display = "none";
      mainPanel.style.display  = "block";
      initApp();
    } catch (e) {
      loginStatus.textContent = "❌ Login failed";
    }
  };

  // ───── MAIN APP ─────
  function initApp() {
    // Panels & elements
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

    // ─── SETTINGS ───────────────────────────────────────────
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
      mainPanel.style.display    = "none";
      settingsPanel.style.display= "block";
      loadSettings();
    };
    backBtn.onclick = () => {
      settingsPanel.style.display = "none";
      mainPanel.style.display     = "block";
    };

    // ─── HELPERS ────────────────────────────────────────────
    async function getBackend() {
      return new Promise((res) =>
        chrome.storage.local.get("repoUrl", (o) => res(o.repoUrl || API_BASE))
      );
    }

    async function fetchBranches(baseUrl) {
      const res = await fetch(`${baseUrl}/branch/`, {
        headers: { "Authorization": `Bearer ${localStorage.getItem(STORAGE_KEY_TOKEN)}` }
      });
      if (!res.ok) throw new Error("Branch API failed");
      return res.json();
    }
    async function populateSelect(baseUrl, selectEl, excludeId = null) {
      selectEl.innerHTML = "";
      try {
        const branches = await fetchBranches(baseUrl);
        branches.forEach((b) => {
          if (excludeId != null && b.id == excludeId) return;
          const o = document.createElement("option");
          o.value = b.id;
          o.textContent = `${b.name} (#${b.id})`;
          selectEl.appendChild(o);
        });
      } catch {
        statusMsg.textContent = "❌ Failed to load branches";
      }
    }

    // ─── CHAT SCRAPING ───────────────────────────────────────
    async function scrapeChat(baseUrl) {
      try {
        const [tab] = await chrome.tabs.query({ active:true, currentWindow:true });
        const injection = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const messages = [];
            document.querySelectorAll("[data-message-author-role]").forEach((el) => {
              const role = el.getAttribute("data-message-author-role") === "user"
                ? "User" : "AI";
              const t = el.innerText.trim();
              if (t) messages.push(`${role}: ${t}`);
            });
            const canvas_images = [];
            document.querySelectorAll("canvas").forEach((cv) => {
              try { canvas_images.push(cv.toDataURL()); }
              catch { canvas_images.push(null); }
            });
            const images = Array.from(document.querySelectorAll("img.chatImage"))
              .map((i) => i.src);
            return { messages, canvas_images, images };
          }
        });
        const ctx = injection[0].result;
        contextArea.value = JSON.stringify(ctx, null, 2);
        statusMsg.textContent = "✅ Chat scraped";
      } catch {
        statusMsg.textContent = "❌ Failed to scrape";
      }
    }
    refreshBtn.onclick = () => {
      getBackend().then((b) => scrapeChat(b));
    };
    copyContextBtn.onclick = () => {
      navigator.clipboard.writeText(contextArea.value)
        .then(() => statusMsg.textContent = "✅ Context copied")
        .catch(() => statusMsg.textContent = "❌ Copy failed");
    };

    // ─── COMMIT ─────────────────────────────────────────────
    commitBtn.onclick = async () => {
      const base = await getBackend();
      const commit_message = messageInput.value.trim();
      let conversation_context;
      try { conversation_context = JSON.parse(contextArea.value); }
      catch { statusMsg.textContent = "❌ Invalid JSON"; return; }
      const branch_id = parseInt(branchSelect.value, 10);
      if (!commit_message || !conversation_context.messages?.length || !branch_id) {
        statusMsg.textContent = "❌ Missing commit data"; return;
      }
      try {
        const res = await fetch(`${base}/commit/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${localStorage.getItem(STORAGE_KEY_TOKEN)}`
          },
          body: JSON.stringify({ commit_message, conversation_context, branch_id })
        });
        const data = await res.json();
        if (!res.ok) {
          statusMsg.textContent = `❌ Commit error: ${data.detail || JSON.stringify(data)}`;
          return;
        }
        let msg = `✅ Commit #${data.commit_hash.slice(0,8)} saved`;
        const tag = tagInput.value.trim();
        if (tag) {
          const t = await fetch(`${base}/tag/`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${localStorage.getItem(STORAGE_KEY_TOKEN)}`
            },
            body: JSON.stringify({ name:tag, commit_id:data.id })
          });
          msg += t.ok ? " + Tag added" : " (Tag failed)";
        }
        statusMsg.textContent = msg;
      } catch {
        statusMsg.textContent = "❌ Commit failed";
      }
    };

    // ─── CREATE / VIEW BRANCH ───────────────────────────────
    createBranchBtn.onclick = () => {
      const name = prompt("New branch name:");
      if (!name) return;
      getBackend().then(async (base) => {
        const r = await fetch(`${base}/branch/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${localStorage.getItem(STORAGE_KEY_TOKEN)}`
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

    // ─── ROLLBACK / TIMELINE ─────────────────────────────────
    document.getElementById("rollback-btn").onclick = () =>
      chrome.tabs.create({ url: "https://chat-commit.vercel.app/rollback" });
    document.getElementById("timeline-btn").onclick = () =>
      chrome.tabs.create({ url: "https://chat-commit.vercel.app/timeline" });

    // ─── MERGE PANEL ─────────────────────────────────────────
    mergeBtn.onclick = async () => {
      const base = await getBackend();
      await populateSelect(base, mergeTargetSel, branchSelect.value);
      mergeSource.value = branchSelect.selectedOptions[0].textContent;
      mainPanel.style.display  = "none";
      mergePanel.style.display = "block";
      mergeStatus.textContent  = "";
    };
    executeMerge.onclick = async () => {
      const srcId = mergeSource.value.match(/\(#(\d+)\)/)?.[1];
      const tgtId = mergeTargetSel.value;
      if (!srcId || !tgtId) {
        mergeStatus.textContent = "❌ Select both source & target"; return;
      }
      const base = await getBackend();
      try {
        const res = await fetch(`${base}/merge?source_branch_id=${srcId}&target_branch_id=${tgtId}`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${localStorage.getItem(STORAGE_KEY_TOKEN)}` }
        });
        const data = await res.json();
        if (!res.ok) throw data;
        mergeStatus.textContent = `✅ ${data.message}`;
      } catch (e) {
        mergeStatus.textContent = `❌ Merge error: ${e.detail || JSON.stringify(e)}`;
      }
    };
    cancelMerge.onclick = () => {
      mergePanel.style.display = "none";
      mainPanel.style.display  = "block";
    };

    // ─── INIT CONTENT ────────────────────────────────────────
    getBackend().then((base) => {
      populateSelect(base, branchSelect);
      scrapeChat(base);
    });
  }
});
