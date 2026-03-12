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
        // Always tell the panel to refresh — even if the stored value didn't
        // change (same job URL reloaded), so it re-checks the DB for updates.
        chrome.runtime.sendMessage({ action: 'refresh_panel_data' }).catch(() => {});
        sendResponse({ success: true });
      }).catch((err) => {
        sendResponse({ error: err.message });
      });
    });
    return true;

  // ── Store job data ──────────────────────────────────────────────────────

  } else if (message.action === 'store_job_data') {
    chrome.storage.local.set({ latestJobData: message.data }, () => {
      // Always tell the panel to refresh so same-URL reloads still pick up
      // any DB changes (status, fields) made in the main app.
      chrome.runtime.sendMessage({ action: 'refresh_panel_data' }).catch(() => {});
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

// ── Context Menus ─────────────────────────────────────────────────────────

const PASTE_MENU_ID = 'kernel-paste-parent';
const FIELDS = [
  { id: 'full_name',  label: 'Full Name' },
  { id: 'first_name', label: 'First Name' },
  { id: 'last_name',  label: 'Last Name' },
  { id: 'email',      label: 'Email' },
  { id: 'phone',      label: 'Phone' },
  { id: 'linkedin',   label: 'LinkedIn URL' },
  { id: 'github',     label: 'GitHub URL' },
  { id: 'website',    label: 'Website/Portfolio' },
  { id: 'city',       label: 'City' },
  { id: 'state',      label: 'State' },
  { id: 'zip',        label: 'Zip Code' }
];

function createContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: PASTE_MENU_ID,
      title: 'Paste from Kernel',
      contexts: ['editable']
    });

    FIELDS.forEach(field => {
      chrome.contextMenus.create({
        id: `paste-${field.id}`,
        parentId: PASTE_MENU_ID,
        title: field.label,
        contexts: ['editable']
      });
    });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  createContextMenus();
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId.startsWith('paste-')) {
    const fieldId = info.menuItemId.replace('paste-', '');
    
    // Fetch profile data
    try {
      const res = await fetch('http://localhost:8000/api/profile');
      const profile = await res.json();
      
      let value = '';
      switch(fieldId) {
        case 'full_name':  value = profile.full_name || `${profile.first_name} ${profile.last_name}`.trim(); break;
        case 'first_name': value = profile.first_name; break;
        case 'last_name':  value = profile.last_name; break;
        case 'email':      value = profile.email; break;
        case 'phone':     value = profile.phone_primary; break;
        case 'linkedin':  value = profile.linkedin_url; break;
        case 'github':    value = profile.github_url; break;
        case 'website':   value = profile.website_url; break;
        case 'city':      value = profile.city; break;
        case 'state':     value = profile.state; break;
        case 'zip':       value = profile.zip_code; break;
      }

      if (value) {
        chrome.tabs.sendMessage(tab.id, { 
          action: 'insert_text', 
          text: value 
        }).catch(err => console.error('Error sending insert_text:', err));
      }
    } catch (e) {
      console.error('Failed to fetch profile for context menu:', e);
    }
  }
});
