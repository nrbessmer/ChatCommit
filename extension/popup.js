document.addEventListener("DOMContentLoaded", () => {
  // Panels
  const mainPanel = document.getElementById("main-panel");
  const settingsPanel = document.getElementById("settings-panel");

  // Main panel elements
  const refreshBtn = document.getElementById("refresh-chat");
  const branchSelect = document.getElementById("branch-select");
  const messageInput = document.getElementById("message-input");
  const contextArea = document.getElementById("context-area");
  const tagInput = document.getElementById("tag-input");
  const commitBtn = document.getElementById("commit-btn");
  const statusMsg = document.getElementById("status-message");
  const createBranchBtn = document.getElementById("create-branch");
  const viewBranchesBtn = document.getElementById("view-branches");
  const copyContextBtn = document.getElementById("copy-context");

  // Settings panel elements
  const settingsBtn = document.getElementById("settings-btn");
  const saveSettingsBtn = document.getElementById("save-settings");
  const backBtn = document.getElementById("back-btn");
  const openaiKeyField = document.getElementById("openai-key");
  const claudeKeyField = document.getElementById("claude-key");
  const geminiKeyField = document.getElementById("gemini-key");
  const backendUrlField = document.getElementById("backend-url");
  const repoHookField = document.getElementById("repo-hook");

  // Buttons for merges
    // Buttons for merges
  document.getElementById("merge-btn").onclick = async () => {
    const sourceId = branchSelect.value;
    if (!sourceId) {
      alert("❌ No branch selected to merge from.");
      return;
    }

    chrome.storage.local.get(["repoUrl"], async (res) => {
      const base = res.repoUrl || "https://chatcommit.fly.dev";

      try {
        // Fetch all branches
        const response = await fetch(`${base}/branch/`);
        const branches = await response.json();

        const sourceBranch = branches.find(b => b.id == sourceId);
        const targets = branches.filter(b => b.id != sourceId);

        if (targets.length === 0) {
          alert("❌ No other branches to merge into.");
          return;
        }

        const list = targets.map(b => `${b.name} (#${b.id})`).join('\n');
        const choice = prompt(
          `Merge from: ${sourceBranch.name} (#${sourceBranch.id})\nChoose target branch:\n${list}`
        );
        const target = targets.find(b => choice && choice.includes(`#${b.id})`));

        if (!target) {
          alert("❌ Merge cancelled: no valid target selected.");
          return;
        }

        const mergeRes = await fetch(`${base}/merge/${sourceId}/${target.id}`, {
          method: "POST",
        });

        if (!mergeRes.ok) {
          const err = await mergeRes.text();
          statusMsg.textContent = `❌ Merge error: ${err}`;
        } else {
          statusMsg.textContent = `✅ Merged ${sourceBranch.name} → ${target.name}`;
        }
      } catch (e) {
        console.error("Merge error:", e);
        statusMsg.textContent = "❌ Merge failed. See console for details.";
      }
    });
  };

  document.getElementById("rollback-btn").onclick = () => alert("⏪ Rollback: Coming soon!");
  document.getElementById("timeline-btn").onclick = () => alert("🕒 Timeline: Coming soon!");

  document.getElementById("merge-btn").onclick = () => alert("🔀 Merge: Coming soon!");
  document.getElementById("rollback-btn").onclick = () => alert("⏪ Rollback: Coming soon!");
  document.getElementById("timeline-btn").onclick = () => alert("🕒 Timeline: Coming soon!");

  // Toggle settings panel
  settingsBtn.onclick = () => {
    mainPanel.style.display = "none";
    settingsPanel.style.display = "block";
    loadSettings();
  };
  backBtn.onclick = () => {
    settingsPanel.style.display = "none";
    mainPanel.style.display = "block";
  };

  // Load & save settings
  function loadSettings() {
    chrome.storage.local.get(["openai", "repoUrl", "repoHook"], (res) => {
      openaiKeyField.value = res.openai || "";
      backendUrlField.value = res.repoUrl || "https://chatcommit.fly.dev";
      repoHookField.value = res.repoHook || "";
    });
  }
  saveSettingsBtn.onclick = () => {
    const openai = openaiKeyField.value.trim();
    const repoUrl = backendUrlField.value.trim();
    const hook = repoHookField.value.trim();
    chrome.storage.local.set({ openai, repoUrl, repoHook: hook }, () => {
      statusMsg.textContent = "✅ Settings saved";
      settingsPanel.style.display = "none";
      mainPanel.style.display = "block";
    });
  };

  // Attempt to let user resize
  if (window.outerWidth < 700) {
    window.resizeTo(700, 900);
  }

  // Load branches from backend
  function loadBranches(url) {
    fetch(`${url}/branch/`)
      .then((res) => res.json())
      .then((branches) => {
        branchSelect.innerHTML = "";
        branches.forEach((b) => {
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

  // Scrape chat
  async function scrapeChat(url) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const injection = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          // gather text from data-message-author-role
          const messages = [];
          document.querySelectorAll('[data-message-author-role]').forEach(el => {
            const role = el.getAttribute("data-message-author-role") === "user" ? "User" : "AI";
            const text = el.innerText.trim();
            if (text) messages.push(`${role}: ${text}`);
          });
          // gather canvas images
          const canvasImages = [];
          document.querySelectorAll("canvas").forEach((cv, idx) => {
            try {
              const data = cv.toDataURL("image/png");
              canvasImages.push(`Canvas #${idx + 1}: ${data}`);
            } catch (e) {
              canvasImages.push(`Canvas #${idx + 1}: not captured`);
            }
          });
          // gather inline images if any
          const images = [];
          document.querySelectorAll("img.chatImage").forEach((img) => {
            images.push(img.src);
          });
          return { messages, canvasImages, images };
        }
      });

      const { messages, canvasImages, images } = injection[0].result;
      if (!messages.length) throw new Error("No chat messages found");
      const finalContext = {
        messages,
        canvas_images: canvasImages,
        images
      };
      contextArea.value = JSON.stringify(finalContext, null, 2);
      statusMsg.textContent = "✅ Chat scraped successfully";
    } catch (err) {
      statusMsg.textContent = "❌ Failed to scrape chat";
    }
  }

  // Refresh Chat
  refreshBtn.onclick = () => {
    chrome.storage.local.get(["repoUrl"], (res) => {
      const base = res.repoUrl || "https://chatcommit.fly.dev";
      scrapeChat(base);
    });
  };

  // Copy context
  copyContextBtn.onclick = () => {
    navigator.clipboard.writeText(contextArea.value)
      .then(() => {
        statusMsg.textContent = "✅ Context copied";
      })
      .catch(() => {
        statusMsg.textContent = "❌ Copy failed";
      });
  };

  // Commit logic
  commitBtn.onclick = async () => {
    chrome.storage.local.get(["repoUrl"], async (res) => {
      const base = res.repoUrl || "https://chatcommit.fly.dev";
      const commitMsg = messageInput.value.trim();
      let contextObj;
      try {
        contextObj = JSON.parse(contextArea.value);
      } catch (e) {
        statusMsg.textContent = "❌ Invalid context JSON";
        return;
      }
      if (!commitMsg || !contextObj.messages || !branchSelect.value) {
        statusMsg.textContent = "❌ Missing commit message or context";
        return;
      }
      const branchId = parseInt(branchSelect.value);
      const tagVal = tagInput.value.trim();

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
        const commitData = await commitRes.json();
        if (!commitRes.ok) {
          statusMsg.textContent = `❌ Commit error: ${commitData.detail}`;
          return;
        }
        let st = `✅ Commit #${commitData.commit_hash.slice(0, 8)} saved`;
        if (tagVal) {
          // create a tag
          const tagRes = await fetch(`${base}/tag/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: tagVal, commit_id: commitData.id })
          });
          if (!tagRes.ok) {
            st += " (Tag creation failed)";
          } else {
            st += " + Tag added";
          }
        }
        statusMsg.textContent = st;
      } catch (err) {
        statusMsg.textContent = "❌ Commit request failed";
      }
    });
  };

  // Create new branch
  createBranchBtn.onclick = () => {
    const newName = prompt("Enter a name for the new branch:");
    if (!newName) return;
    chrome.storage.local.get(["repoUrl"], async (res) => {
      const base = res.repoUrl || "https://chatcommit.fly.dev";
      try {
        const branchRes = await fetch(`${base}/branch/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newName })
        });
        if (!branchRes.ok) {
          alert("❌ Failed to create branch");
          return;
        }
        alert("✅ Branch created successfully");
        loadBranches(base); // reload
      } catch (err) {
        alert("❌ Error creating branch");
      }
    });
  };

  // View branches (temporary link to localhost:3000/branches)
  viewBranchesBtn.onclick = () => {
  chrome.tabs.create({ url: "https://chat-commit.vercel.app/branches" });
};


  // On load: load settings -> load branches -> scrape chat
  chrome.storage.local.get(["repoUrl"], (cfg) => {
    const base = cfg.repoUrl || "https://chatcommit.fly.dev";
    loadBranches(base);
    scrapeChat(base);
  });
});
