// The toolbar button is only useful on pages we rendered: disable it by default,
// and enable it per tab when the content script reports a rendered document.
chrome.action.disable();

chrome.runtime.onMessage.addListener((msg, sender) => {
  const tabId = sender.tab?.id;
  if (msg?.type === 'rendered' && tabId != null) chrome.action.enable(tabId);
});

chrome.action.onClicked.addListener((tab) => {
  if (tab.id != null) chrome.tabs.sendMessage(tab.id, { type: 'toggle-raw' }, { frameId: 0 }).catch(() => {});
});
