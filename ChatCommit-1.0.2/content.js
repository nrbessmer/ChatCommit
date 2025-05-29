chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "scrape") {
    const messages = [];
    document.querySelectorAll('[data-message-author-role]').forEach(node => {
      const role = node.getAttribute("data-message-author-role");
      const text = node.innerText.trim();
      if (role && text) {
        messages.push(`${role === "user" ? "User" : "AI"}: ${text}`);
      }
    });
    sendResponse({ messages });
  }
});
