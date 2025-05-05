document.addEventListener("DOMContentLoaded", () => {
  // Panels
  const mainPanel      = document.getElementById("main-panel");
  const settingsPanel  = document.getElementById("settings-panel");
  const mergePanel     = document.getElementById("merge-panel");
  const statusMsg      = document.getElementById("status-message");

  // Main‑panel elements
  const refreshBtn      = document.getElementById("refresh-chat");
  const branchSelect    = document.getElementById("branch-select");
  const messageInput    = document.getElementById("message-input");
  const contextArea     = document.getElementById("context-area");
  const tagInput        = document.getElementById("tag-input");
  const commitBtn       = document.getElementById("commit-btn");
  const createBranchBtn = document.getElementById("create-branch");
  const viewBranchesBtn = document.getElementById("view-branches");
  const copyContextBtn  = document.getElementById("copy-context");

  // Settings‑panel elements
  const settingsBtn     = document.getElementById("settings-btn");
  const saveSettingsBtn = document.getElementById("save-settings");
  const backBtn         = document.getElementById("back-btn");
  const openaiKeyField  = document.getElementById("openai-key");
  const backendUrlField = document.getElementById("backend-url");
  const repoHookField   = document.getElementById("repo-hook");

  // Merge‑panel elements
  const mergeBtn        = document.getElementById("merge-btn");
  const mergeSource     = document.getElementById("merge-source");
  const mergeTargetSel  = document.getElementById("merge-target");
  const executeMerge    = document.getElementById("execute-merge");
  const cancelMerge     = document.getElementById("cancel-merge");
  const mergeStatus     = document.getElementById("merge-status");

  // ─── Settings ───────────────────────────────────────────
  function loadSettings() {
    chrome.storage.local.get(["openai","repoUrl","repoHook"], res => {
      openaiKeyField.value   = res.openai   || "";
      backendUrlField.value  = res.repoUrl  || "https://chatcommit.fly.dev";
      repoHookField.value    = res.repoHook || "";
    });
  }
  saveSettingsBtn.onclick = () => {
    chrome.storage.local.set({
      openai:  openaiKeyField.value.trim(),
      repoUrl: backendUrlField.value.trim(),
      repoHook:repoHookField.value.trim()
    }, () => {
      statusMsg.textContent = "✅ Settings saved";
      settingsPanel.style.display = "none";
      mainPanel.style.display     = "block";
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

  // ─── Utility: Fetch and populate a <select> with branches ───
  async function fetchBranches(baseUrl) {
    const res = await fetch(`${baseUrl}/branch/`);
    if (!res.ok) throw new Error("Branch API failed");
    return res.json();
  }
  async function populateSelect(baseUrl, selectEl, excludeId = null) {
    selectEl.innerHTML = "";
    try {
      const branches = await fetchBranches(baseUrl);
      branches.forEach(b => {
        if (excludeId != null && b.id == excludeId) return;
        const o = document.createElement("option");
        o.value = b.id;
        o.textContent = `${b.name} (#${b.id})`;
        selectEl.appendChild(o);
      });
      return branches;
    } catch {
      statusMsg.textContent = "❌ Failed to load branches";
      return [];
    }
  }

  // ─── Chat scraping ────────────────────────────────────────
  async function scrapeChat(baseUrl) {
    try {
      const [tab] = await chrome.tabs.query({ active:true, currentWindow:true });
      const injection = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const messages = [];
          document.querySelectorAll('[data-message-author-role]').forEach(el => {
            const r = el.getAttribute("data-message-author-role")==="user"?"User":"AI";
            const t = el.innerText.trim();
            if (t) messages.push(`${r}: ${t}`);
          });
          const canvas_images = [];
          document.querySelectorAll("canvas").forEach((cv,i) => {
            try { canvas_images.push(cv.toDataURL()); }
            catch { canvas_images.push(null); }
          });
          const images = Array.from(document.querySelectorAll("img.chatImage")).map(i=>i.src);
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
    chrome.storage.local.get("repoUrl", ({repoUrl}) =>
      scrapeChat(repoUrl||"https://chatcommit.fly.dev")
    );
  };
  copyContextBtn.onclick = () => {
    navigator.clipboard.writeText(contextArea.value)
      .then(()=> statusMsg.textContent="✅ Context copied")
      .catch(()=> statusMsg.textContent="❌ Copy failed");
  };

  // ─── Commit ───────────────────────────────────────────────
  commitBtn.onclick = async () => {
    const { repoUrl } = await chrome.storage.local.get("repoUrl");
    const base = repoUrl || "https://chatcommit.fly.dev";
    const commit_message = messageInput.value.trim();
    let conversation_context;
    try { conversation_context = JSON.parse(contextArea.value); }
    catch { statusMsg.textContent="❌ Invalid JSON"; return; }
    const branch_id = parseInt(branchSelect.value,10);
    if (!commit_message||!conversation_context.messages?.length||!branch_id) {
      statusMsg.textContent="❌ Missing commit data"; return;
    }
    try {
      const res = await fetch(`${base}/commit/`, {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ commit_message, conversation_context, branch_id })
      });
      const data = await res.json();
      if (!res.ok) {
        statusMsg.textContent=`❌ Commit error: ${data.detail||JSON.stringify(data)}`;
        return;
      }
      let msg = `✅ Commit #${data.commit_hash.slice(0,8)} saved`;
      const tag = tagInput.value.trim();
      if (tag) {
        const t = await fetch(`${base}/tag/`, {
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body: JSON.stringify({ name:tag, commit_id:data.id })
        });
        msg += t.ok? " + Tag added":" (Tag failed)";
      }
      statusMsg.textContent = msg;
    } catch {
      statusMsg.textContent="❌ Commit failed";
    }
  };

  // ─── Create branch & view branches ───────────────────────
  createBranchBtn.onclick = () => {
    const name = prompt("New branch name:");
    if (!name) return;
    chrome.storage.local.get("repoUrl", async ({repoUrl}) => {
      const base = repoUrl||"https://chatcommit.fly.dev";
      try {
        const r = await fetch(`${base}/branch/`, {
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body: JSON.stringify({ name })
        });
        if (!r.ok) throw 0;
        alert("✅ Branch created");
        await populateSelect(base, branchSelect);
      } catch {
        alert("❌ Could not create branch");
      }
    });
  };
  viewBranchesBtn.onclick = () =>
    chrome.tabs.create({ url:"https://chat-commit.vercel.app/branches" });

 // ─── Rollback/Timeline actions ──────────────────────────────
document.getElementById("rollback-btn").onclick = () =>
  chrome.tabs.create({ url: "https://chat-commit.vercel.app/rollback" });

document.getElementById("timeline-btn").onclick = () =>
  chrome.tabs.create({ url: "https://chat-commit.vercel.app/timeline" });

  // ─── Merge panel ──────────────────────────────────────────
  mergeBtn.onclick = async () => {
    // load both selects
    const { repoUrl } = await chrome.storage.local.get("repoUrl");
    const base = repoUrl||"https://chatcommit.fly.dev";
    const branches = await fetchBranches(base);

    // populate source and target
    mergeSource.value = branchSelect.selectedOptions[0].textContent;
    await populateSelect(base, mergeTargetSel, branchSelect.value);

    mainPanel.style.display  = "none";
    mergePanel.style.display = "block";
    mergeStatus.textContent  = "";
  };

  executeMerge.onclick = async () => {
    const srcId = mergeSource.value.match(/\(#(\d+)\)/)?.[1];
    const tgtId = mergeTargetSel.value;
    if (!srcId||!tgtId) {
      mergeStatus.textContent = "❌ Select both source & target";
      return;
    }
    const { repoUrl } = await chrome.storage.local.get("repoUrl");
    const base = repoUrl||"https://chatcommit.fly.dev";
    try {
      const res = await fetch(
        `${base}/merge?source_branch_id=${srcId}&target_branch_id=${tgtId}`,
        { method:"POST" }
      );
      const data = await res.json();
      if (!res.ok) throw data;
      mergeStatus.textContent = `✅ ${data.message}`;
    } catch (e) {
      mergeStatus.textContent = `❌ Merge error: ${e.detail||JSON.stringify(e)}`;
    }
  };
  cancelMerge.onclick = () => {
    mergePanel.style.display = "none";
    mainPanel.style.display  = "block";
  };

  // ─── Init: populate main branch‑select & scrape context ───
  chrome.storage.local.get("repoUrl", ({repoUrl}) => {
    const base = repoUrl || "https://chatcommit.fly.dev";
    populateSelect(base, branchSelect);
    scrapeChat(base);
  });
});
