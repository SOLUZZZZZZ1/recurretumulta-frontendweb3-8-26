async function configureSidePanel() {
  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  } catch {
    // Fail closed: no fallback opens pages or injects code automatically.
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void configureSidePanel();
});

chrome.runtime.onStartup.addListener(() => {
  void configureSidePanel();
});

void configureSidePanel();
