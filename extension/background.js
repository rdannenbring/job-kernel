chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);
});

/**
 * Broadcast panel state changes to all content scripts in the active tab.
 * This keeps the floating button's visual state in sync.
 */
function broadcastPanelState(isOpen) {
  chrome.storage.local.set({ isPanelOpen: isOpen });
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'panel_state_changed', isOpen }).catch(() => {});
    }
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const fromContentScript = !!(sender && sender.tab);

  // ── Open side panel ────────────────────────────────────────────────────
  if (message.action === 'open_side_panel') {
    const windowId = sender.tab?.windowId;
    if (!windowId) { sendResponse({ error: 'no windowId' }); return true; }
    chrome.sidePanel.open({ windowId }).then(() => {
      broadcastPanelState(true);
      sendResponse({ success: true });
    }).catch((err) => {
      console.error('[JobAutomator] open_side_panel error:', err);
      sendResponse({ error: err.message });
    });
    return true;

  // ── Close side panel ───────────────────────────────────────────────────
  } else if (message.action === 'close_side_panel') {
    broadcastPanelState(false);
    chrome.runtime.sendMessage({ action: 'do_window_close' }).catch(() => {});
    sendResponse({ success: true });
    return true;

  // ── Legacy toggle (kept for backwards compatibility) ────────────────────
  } else if (message.action === 'toggle_side_panel') {
    chrome.storage.local.get(['isPanelOpen'], (result) => {
      const isOpen = result.isPanelOpen || false;
      if (isOpen) {
        broadcastPanelState(false);
        chrome.runtime.sendMessage({ action: 'do_window_close' }).catch(() => {});
        sendResponse({ action: 'closed' });
      } else {
        chrome.sidePanel.open({ windowId: sender.tab.windowId }).then(() => {
          broadcastPanelState(true);
          sendResponse({ action: 'opened' });
        }).catch((err) => {
          sendResponse({ error: err.message });
        });
      }
    });
    return true;

  // ── Open and store (solves missing user gesture) ────────────────────────
  } else if (message.action === 'open_and_store') {
    const windowId = sender.tab?.windowId;
    if (!windowId) { sendResponse({ error: 'no windowId' }); return true; }
    chrome.storage.local.set({ latestJobData: message.data }, () => {
      chrome.sidePanel.open({ windowId }).then(() => {
        broadcastPanelState(true);
        sendResponse({ success: true });
      }).catch((err) => {
        sendResponse({ error: err.message });
      });
    });
    return true;

  // ── Store job data ──────────────────────────────────────────────────────

  } else if (message.action === 'store_job_data') {
    chrome.storage.local.set({ latestJobData: message.data }, () => {
      sendResponse({ success: true });
    });
    return true;

  // ── Loading state (content → background → side panel) ──────────────────
  } else if (message.action === 'job_loading' && fromContentScript) {
    chrome.runtime.sendMessage({ action: 'job_loading' }).catch(() => {});
    sendResponse({ success: true });
    return true;

  // ── Refresh panel data (content → background → side panel) ─────────────
  } else if (message.action === 'refresh_panel_data' && fromContentScript) {
    chrome.runtime.sendMessage({ action: 'refresh_panel_data' }).catch(() => {});
    sendResponse({ success: true });
    return true;
  }
});

// Keep isPanelOpen in sync when the side panel is closed by the user
// (e.g. via the browser's built-in close button)
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'sidepanel') {
    port.onDisconnect.addListener(() => {
      broadcastPanelState(false);
    });
  }
});
