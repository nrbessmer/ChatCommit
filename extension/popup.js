document.addEventListener("DOMContentLoaded", () => {
  // Panels
  const mainPanel = document.getElementById("main-panel");
  const settingsPanel = document.getElementById("settings-panel");
  const statusMsg = document.getElementById("status-message");

  // Main panel elements
  const refreshBtn = document.getElementById("refresh-chat");
  const branchSelect = document.getElementById("branch-select");
  const messageInput = document.getElementById("message-input");
  const contextArea = document.getElementById("context-area");
  const tagInput = document.getElementById("tag-input");
  const commitBtn = document.getElementById("commit-btn");
  const createBranchBtn = document.getElementById("create-branch");
  const viewBranchesBtn = document.getElementById("view-branches");
  const copyContextBtn = document.getElementById("copy-context");

  // Settings panel elements
  const settingsBtn = document.getElementById("settings-btn");
  const saveSettingsBtn = document.getElementById("save-settings");
  const backBtn = document.getElementById("back-btn");
  const openaiKeyField = document.getElementById("openai-key");
  const backendUrlField = document.getElementById("backend-url");
  const repoHookField = document.getElementById("repo-hook");

  // Load & Save settings
  function loadSettings() {
    chrome.storage.local.get(["openai", "repoUrl", "repoHook"], (res) => {
      openaiKeyField.value = res.openai || "";
      backendUrlField.value = res.repoUrl || "https://chatcommit.fly.dev";
      repoHookField.value = res.repoHook || "";
    });
  }

  saveSettingsBtn.onclick = () => {
    chrome.storage.local.set({
      openai: openaiKeyField.value.trim(),
      repoUrl: backendUrlField.value.trim(),
      repoHook: repoHookField.value.trim()
    }, () => {
      statusMsg.textContent = "✅ Settings saved";
      settingsPanel.style.display = "none";
      mainPanel.style.display = "block";
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
    mainPanel.style.display = "block";
  };

  // Resize popup
  if (window.outerWidth < 700) {
    window.resizeTo(700, 900);
  }

  // Branch dropdown
  function loadBranches(url) {
    fetch(`${url}/branch/`)
      .then(res => res.json())
      .then(branches => {
        branchSelect.innerHTML = "";
        branches.forEach(b => {
          const opt = document.createElement("option");
          opt.value = b.id;
          opt.textContent = `${b.name} (#${b.id})`;
          branchSelect.appendChild(opt);
        });
      })
      .catch(() => {
        statusMsg.textContent = "❌ Failed to load branches";
      });
  }

  // Merge logic
  document.getElementById("merge-btn").onclick = () => {
    const sourceId = branchSelect.value;
    if (!sourceId) {
      alert("❌ No source branch selected");
      return;
    }

    chrome.storage.local.get(["repoUrl"], async (res) => {
      const base = res.repoUrl || "https://chatcommit.fly.dev";

      try {
        const response = await fetch(`${base}/branch/`);
        const branches = await response.json();
        const sourceBranch = branches.find(b => b.id == sourceId);
        const targets = branches.filter(b => b.id != sourceId);

        const list = targets.map(b => `${b.name} (#${b.id})`).join("\n");
        const choice = prompt(`Merge from: ${sourceBranch.name} (#${sourceBranch.id})\nChoose target:\n${list}`);
        const target = targets.find(b => choice && choice.includes(`#${b.id})`));

        if (!target) {
          alert("❌ Invalid target branch.");
          return;
        }

        const mergeRes = await fetch(`${base}/merge/${sourceId}/${target.id}`, { method: "POST" });
        const result = await mergeRes.json();

        if (!mergeRes.ok) {
          statusMsg.textContent = `❌ Merge error: ${result.detail || JSON.stringify(result)}`;
        } else {
          statusMsg.textContent = `✅ Merged: ${sourceBranch.name} → ${target.name}`;
        }
      } catch (err) {
        console.error("Merge failed:", err);
        statusMsg.textContent = "❌ Merge failed (console error)";
      }
    });
  };

  // Rollback/timeline stubs
  document.getElementById("rollback-btn").onclick = () => alert("⏪ Rollback: Coming soon!");
  document.getElementById("timeline-btn").onclick = () => alert("🕒 Timeline: Coming soon!");

  // Refresh chat context
  refreshBtn.onclick = () => {
    chrome.storage.local.get(["repoUrl"], (res) => {
      const base = res.repoUrl || "https://chatcommit.fly.dev";
      scrapeChat(base);
    });
  };

  // Copy context
  copyContextBtn.onclick = () => {
    navigator.clipboard.writeText(contextArea.value)
      .then(() => statusMsg.textContent = "✅ Context copied")
      .catch(() => statusMsg.textContent = "❌ Copy failed");
  };

  // Scrape logic
  async function scrapeChat(url) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const result = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const messages = [];
          document.querySelectorAll('[data-message-author-role]').forEach(el => {
            const role = el.getAttribute("data-message-author-role") === "user" ? "User" : "AI";
            const text = el.innerText.trim();
            if (text) messages.push(`${role}: ${text}`);
          });
          const canvasImages = [];
          document.querySelectorAll("canvas").forEach((cv, idx) => {
            try {
              canvasImages.push(`Canvas #${idx + 1}: ${cv.toDataURL("image/png")}`);
            } catch {
              canvasImages.push(`Canvas #${idx + 1}: not captured`);
            }
          });
          const images = [];
          document.querySelectorAll("img.chatImage").forEach(img => {
            images.push(img.src);
          });
          return { messages, canvas_images: canvasImages, images };
        }
      });

      const context = result[0].result;
      contextArea.value = JSON.stringify(context, null, 2);
      statusMsg.textContent = "✅ Chat scraped successfully";
    } catch (e) {
      statusMsg.textContent = "❌ Failed to scrape chat";
    }
  }

  // Commit
  commitBtn.onclick = async () => {
    chrome.storage.local.get(["repoUrl"], async (res) => {
      const base = res.repoUrl || "https://chatcommit.fly.dev";
      const commitMsg = messageInput.value.trim();
      const tagVal = tagInput.value.trim();
      let contextObj;

      try {
        contextObj = JSON.parse(contextArea.value);
      } catch {
        statusMsg.textContent = "❌ Invalid context JSON";
        return;
      }

      const branchId = parseInt(branchSelect.value);
      if (!commitMsg || !contextObj.messages || !branchId) {
        statusMsg.textContent = "❌ Missing commit data";
        return;
      }

      try {
        const commitRes = await fetch(`${base}/commit/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            commit_message: commitMsg,
            conversation_context: contextObj,
            branch_id: branchId
          })
        });
        const data = await commitRes.json();
        if (!commitRes.ok) {
          statusMsg.textContent = `❌ Commit error: ${data.detail}`;
          return;
        }

        let st = `✅ Commit #${data.commit_hash.slice(0, 8)} saved`;

        if (tagVal) {
          const tagRes = await fetch(`${base}/tag/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: tagVal, commit_id: data.id })
          });
          st += tagRes.ok ? " + Tag added" : " (Tag failed)";
        }

        statusMsg.textContent = st;
      } catch (err) {
        statusMsg.textContent = "❌ Commit failed";
      }
    });
  };

  // Create branch
  createBranchBtn.onclick = () => {
    const newName = prompt("New branch name:");
    if (!newName) return;

    chrome.storage.local.get(["repoUrl"], async (res) => {
      const base = res.repoUrl || "https://chatcommit.fly.dev";
      try {
        const branchRes = await fetch(`${base}/branch/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newName })
        });
        if (!branchRes.ok) return alert("❌ Failed to create branch");
        alert("✅ Branch created");
        loadBranches(base);
      } catch {
        alert("❌ Branch creation error");
      }
    });
  };

  // View branches
  viewBranchesBtn.onclick = () => {
    chrome.tabs.create({ url: "https://chat-commit.vercel.app/branches" });
  };

  // Init
  chrome.storage.local.get(["repoUrl"], (cfg) => {
    const base = cfg.repoUrl || "https://chatcommit.fly.dev";
    loadBranches(base);
    scrapeChat(base);
  });
});
