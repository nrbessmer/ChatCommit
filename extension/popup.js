document.addEventListener("DOMContentLoaded", () => {
  // Panels
  const mainPanel      = document.getElementById("main-panel");
  const settingsPanel  = document.getElementById("settings-panel");
  const mergePanel     = document.getElementById("merge-panel");
  const statusMsg      = document.getElementById("status-message");

  // Main panel elements
  const refreshBtn     = document.getElementById("refresh-chat");
  const branchSelect   = document.getElementById("branch-select");
  const messageInput   = document.getElementById("message-input");
  const contextArea    = document.getElementById("context-area");
  const tagInput       = document.getElementById("tag-input");
  const commitBtn      = document.getElementById("commit-btn");
  const createBranchBtn= document.getElementById("create-branch");
  const viewBranchesBtn= document.getElementById("view-branches");
  const copyContextBtn = document.getElementById("copy-context");

  // Settings panel elements
  const settingsBtn    = document.getElementById("settings-btn");
  const saveSettingsBtn= document.getElementById("save-settings");
  const backBtn        = document.getElementById("back-btn");
  const openaiKeyField = document.getElementById("openai-key");
  const backendUrlField= document.getElementById("backend-url");
  const repoHookField  = document.getElementById("repo-hook");

  // Merge panel elements
  const mergeBtn       = document.getElementById("merge-btn");
  const mergeSource    = document.getElementById("merge-source");
  const mergeTargetSel = document.getElementById("merge-target");
  const executeMerge   = document.getElementById("execute-merge");
  const cancelMerge    = document.getElementById("cancel-merge");
  const mergeStatus    = document.getElementById("merge-status");

  // Load & Save settings
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
      repoHook: repoHookField.value.trim()
    }, () => {
      statusMsg.textContent = "✅ Settings saved";
      settingsPanel.style.display = "none";
      mainPanel.style.display     = "block";
    });
  };

  // View toggling
  settingsBtn.onclick = () => {
    mainPanel.style.display = "none";
    settingsPanel.style.display = "block";
    loadSettings();
  };
  backBtn.onclick = () => {
    settingsPanel.style.display = "none";
    mainPanel.style.display     = "block";
  };

  // Resize popup
  if (window.outerWidth < 700) window.resizeTo(700, 900);

  // Load branches into any <select>
  async function loadBranches(url, selectEl, includeAll = true) {
    try {
      const res = await fetch(`${url}/branch/`);
      const branches = await res.json();
      selectEl.innerHTML = "";
      branches.forEach(b => {
        const opt = document.createElement("option");
        opt.value   = b.id;
        opt.textContent = `${b.name} (#${b.id})`;
        selectEl.appendChild(opt);
      });
      return branches;
    } catch {
      statusMsg.textContent = "❌ Failed to load branches";
      return [];
    }
  }

  // Scrape chat context
  async function scrapeChat(url) {
    try {
      const [tab] = await chrome.tabs.query({ active:true, currentWindow:true });
      const injection = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const messages = [];
          document.querySelectorAll('[data-message-author-role]').forEach(el => {
            const role = el.getAttribute("data-message-author-role")==="user"?"User":"AI";
            const text = el.innerText.trim();
            if(text) messages.push(`${role}: ${text}`);
          });
          const canvasImages = [];
          document.querySelectorAll("canvas").forEach((cv, i) => {
            try { canvasImages.push(cv.toDataURL("image/png")); }
            catch { canvasImages.push(null); }
          });
          const images = Array.from(document.querySelectorAll("img.chatImage")).map(img=>img.src);
          return { messages, canvas_images: canvasImages, images };
        }
      });
      const ctx = injection[0].result;
      contextArea.value = JSON.stringify(ctx, null,2);
      statusMsg.textContent = "✅ Chat scraped";
    } catch {
      statusMsg.textContent = "❌ Failed to scrape chat";
    }
  }

  // Refresh Chat
  refreshBtn.onclick = () => {
    chrome.storage.local.get(["repoUrl"], ({repoUrl}) => {
      scrapeChat(repoUrl || "https://chatcommit.fly.dev");
    });
  };

  // Copy context
  copyContextBtn.onclick = () => {
    navigator.clipboard.writeText(contextArea.value)
      .then(()=> statusMsg.textContent="✅ Context copied")
      .catch(()=> statusMsg.textContent="❌ Copy failed");
  };

  // Commit
  commitBtn.onclick = async () => {
    const base = (await chrome.storage.local.get("repoUrl")).repoUrl || "https://chatcommit.fly.dev";
    const commitMsg = messageInput.value.trim();
    let ctx;
    try { ctx = JSON.parse(contextArea.value); }
    catch { statusMsg.textContent="❌ Invalid context JSON"; return; }
    const branchId = parseInt(branchSelect.value,10);
    if(!commitMsg||!ctx.messages?.length||!branchId) {
      statusMsg.textContent="❌ Missing commit data"; return;
    }
    try {
      const res = await fetch(`${base}/commit/`, {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          commit_message: commitMsg,
          conversation_context: ctx,
          branch_id: branchId
        })
      });
      const data = await res.json();
      if(!res.ok) {
        statusMsg.textContent = `❌ Commit error: ${data.detail||JSON.stringify(data)}`;
        return;
      }
      let st = `✅ Commit #${data.commit_hash.slice(0,8)} saved`;
      const tagVal = tagInput.value.trim();
      if(tagVal) {
        const t = await fetch(`${base}/tag/`, {
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body: JSON.stringify({ name: tagVal, commit_id: data.id })
        });
        st += t.ok?" + Tag added":" (Tag failed)";
      }
      statusMsg.textContent = st;
    } catch {
      statusMsg.textContent="❌ Commit failed";
    }
  };

  // Create branch
  createBranchBtn.onclick = () => {
    const newName = prompt("New branch name:");
    if(!newName) return;
    chrome.storage.local.get(["repoUrl"], async ({repoUrl}) => {
      const base = repoUrl||"https://chatcommit.fly.dev";
      try {
        const r = await fetch(`${base}/branch/`,{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body: JSON.stringify({ name:newName })
        });
        if(!r.ok) throw 0;
        alert("✅ Branch created");
        await loadBranches(base, branchSelect);
      } catch {
        alert("❌ Branch creation failed");
      }
    });
  };

  // View branches page
  viewBranchesBtn.onclick = () => {
    chrome.tabs.create({ url:"https://chat-commit.vercel.app/branches" });
  };

  // Rollback/timeline stubs
  document.getElementById("rollback-btn").onclick = () => alert("⏪ Rollback: Coming soon!");
  document.getElementById("timeline-btn").onclick = () => alert("🕒 Timeline: Coming soon!");

  // ─────────── MERGE PANEL ───────────
  mergeBtn.onclick = async () => {
    const sourceId = branchSelect.value;
    if(!sourceId) { alert("❌ Select a source branch first."); return; }

    // load branches for target list
    chrome.storage.local.get(["repoUrl"], async ({repoUrl}) => {
      const base = repoUrl||"https://chatcommit.fly.dev";
      const branches = await loadBranches(base, mergeTargetSel);
      const source = branches.find(b=>b.id==sourceId);
      if(!source) { alert("❌ Source branch not found."); return; }

      // populate source field
      mergeSource.value = `${source.name} (#${source.id})`;

      // remove source from targets
      Array.from(mergeTargetSel.options)
        .forEach(opt => { if(opt.value==sourceId) opt.remove(); });

      // show merge panel
      mainPanel.style.display  = "none";
      mergePanel.style.display = "block";
      mergeStatus.textContent  = "";  // clear previous
    });
  };

  executeMerge.onclick = async () => {
    const sourceVal = mergeSource.value.match(/\(#(\d+)\)/)?.[1];
    const targetId  = mergeTargetSel.value;
    if(!sourceVal||!targetId) {
      mergeStatus.textContent = "❌ Select both source and target.";
      return;
    }
    chrome.storage.local.get(["repoUrl"], async ({repoUrl}) => {
      const base = repoUrl||"https://chatcommit.fly.dev";
      try {
        const res = await fetch(
          `${base}/merge?source_branch_id=${sourceVal}&target_branch_id=${targetId}`,
          { method:"POST" }
        );
        const data = await res.json();
        if(!res.ok) {
          mergeStatus.textContent = `❌ Merge error: ${data.detail||JSON.stringify(data)}`;
        } else {
          mergeStatus.textContent = `✅ ${data.message}`;
        }
      } catch (e) {
        mergeStatus.textContent = "❌ Merge failed.";
        console.error(e);
      }
    });
  };

  cancelMerge.onclick = () => {
    mergePanel.style.display = "none";
    mainPanel.style.display  = "block";
  };

  // ─────────── INITIALIZE ───────────
  chrome.storage.local.get(["repoUrl"], ({repoUrl}) => {
    const base = repoUrl || "https://chatcommit.fly.dev";
    loadBranches(base, branchSelect);
    scrapeChat(base);
  });
});
