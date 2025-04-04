import os

base_path = "/Users/nrbes/Projects/ChatCommit/extension"

files = {
    "manifest.json": """{
  "manifest_version": 3,
  "name": "ChatCommit Extension",
  "description": "Commit ChatGPT threads to ChatCommit",
  "version": "0.1",
  "permissions": ["activeTab", "scripting", "storage"],
  "host_permissions": ["https://chat.openai.com/*"],
  "action": {
    "default_popup": "popup.html",
    "default_icon": "icon.png"
  },
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["https://chat.openai.com/*"],
      "js": ["content.js"]
    }
  ]
}
""",
    "popup.html": """<!DOCTYPE html>
<html>
<head>
  <title>ChatCommit</title>
  <style>
    body { font-family: sans-serif; width: 300px; padding: 10px; }
    label, select, textarea, button { display: block; margin-bottom: 10px; width: 100%; }
  </style>
</head>
<body>
  <h2>ChatCommit</h2>
  <label for="branch">Branch:</label>
  <select id="branch"></select>

  <label for="message">Commit Message:</label>
  <input type="text" id="message" placeholder="e.g. Summary of this thread" />

  <button id="commit">Commit</button>
  <div id="status"></div>

  <script src="popup.js"></script>
</body>
</html>
""",
    "popup.js": """document.addEventListener("DOMContentLoaded", async () => {
  const branchSelect = document.getElementById("branch");
  const status = document.getElementById("status");

  try {
    const res = await fetch("http://localhost:8000/branch/");
    const branches = await res.json();
    branches.forEach(b => {
      const opt = document.createElement("option");
      opt.value = b.id;
      opt.textContent = `${b.name} (#${b.id})`;
      branchSelect.appendChild(opt);
    });
  } catch {
    status.textContent = "❌ Failed to load branches";
  }

  document.getElementById("commit").addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scrapeChat
    }, async (results) => {
      const messages = results[0].result;
      const commitMessage = document.getElementById("message").value;
      const branchId = branchSelect.value;

      const payload = {
        commit_message: commitMessage,
        conversation_context: { messages },
        branch_id: parseInt(branchId)
      };

      try {
        const res = await fetch("http://localhost:8000/commit/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        status.textContent = `✅ Commit ${data.commit_hash}`;
      } catch (err) {
        status.textContent = "❌ Failed to commit";
      }
    });
  });
});

function scrapeChat() {
  const nodes = Array.from(document.querySelectorAll("[data-message-author-role]"));
  return nodes.map(n => n.textContent.trim()).filter(Boolean);
}
""",
    "background.js": """chrome.runtime.onInstalled.addListener(() => {
  console.log("ChatCommit Extension installed");
});
""",
    "content.js": """console.log("ChatCommit extension loaded.");
""",
    "README_deploy.md": """# ChatCommit Extension Setup

## 📂 Location
All files live under `/Users/nrbes/Projects/ChatCommit/extension`.

## ✅ How to Test
1. Open **Chrome**.
2. Go to `chrome://extensions`.
3. Enable **Developer Mode** (toggle upper-right).
4. Click **Load unpacked** and select the `extension` folder.
5. Visit https://chat.openai.com.
6. Click the ChatCommit extension icon.
7. Choose a branch, enter a commit message, and click **Commit**.

## 🧠 Requirements
- Backend must be running on `http://localhost:8000`.
"""
}

os.makedirs(base_path, exist_ok=True)
for filename, content in files.items():
    with open(os.path.join(base_path, filename), "w") as f:
        f.write(content)

print("✅ ChatCommit browser extension files deployed successfully.")

