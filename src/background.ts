// The toolbar button is only useful on pages we rendered: disable it by default,
// and enable it per tab when the content script reports a rendered document.
chrome.action.disable();

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const tabId = sender.tab?.id;

  if (msg?.type === 'rendered' && tabId != null) {
    chrome.action.enable(tabId);
    return;
  }

  // Content scripts on file:// pages cannot fetch file URLs themselves; the
  // extension can (when "Allow access to file URLs" is on). Only allow a tab
  // to re-read the exact local file it is showing.
  if (msg?.type === 'fetch-file' && typeof msg.url === 'string') {
    const tabUrl = sender.tab?.url?.split('#')[0];
    if (!msg.url.startsWith('file:///') || msg.url !== tabUrl) {
      sendResponse({ ok: false });
      return;
    }
    fetch(msg.url, { cache: 'no-store' })
      .then((r) => r.text())
      .then((text) => sendResponse({ ok: true, text }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }
});

chrome.action.onClicked.addListener((tab) => {
  if (tab.id != null) chrome.tabs.sendMessage(tab.id, { type: 'toggle-raw' }).catch(() => {});
});
