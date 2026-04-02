const API_URL = 'http://localhost:8000';

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

  } else if (message.action === 'get_linkedin_matches') {
    const { company_id } = message;
    fetch(`${API_URL}/api/linkedin/matches/${company_id}`)
      .then(res => res.json())
      .then(data => sendResponse({ success: true, matches: data.matches }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;

  } else if (message.action === 'START_LINKEDIN_SYNC') {
    if (isSyncing) {
        sendResponse({ success: true, alreadyRunning: true });
        return true;
    }
    isSyncing = true;
    fetchConnectionsBatch(0).then(() => {
      sendResponse({ success: true });
    }).catch(err => {
      isSyncing = false;
      sendResponse({ error: err.message });
    });
    return true;

  } else if (message.action === 'GET_SYNC_STATUS') {
    const progressPercent = syncExpectedTotal > 0 
        ? Math.min(Math.round((syncRunningTotal / syncExpectedTotal) * 100), 100)
        : Math.min(Math.round((syncRunningTotal / 1000) * 100), 100);

    sendResponse({ 
        isSyncing, 
        progress: progressPercent, 
        message: lastSyncMessage,
        runningTotal: syncRunningTotal,
        expectedTotal: syncExpectedTotal
    });
    return true;

  } else if (message.action === 'CHECK_CONNECTIONS') {
    fetch(`${API_URL}/api/linkedin/matches/${message.companyId}`)
      .then(res => res.json())
      .then(data => {
        sendResponse({ matches: data.matches });
      })
      .catch(err => {
        console.error('Error checking connections:', err);
        sendResponse({ matches: [] });
      });
    return true;
  } else if (message.action === 'CHECK_CONNECTIONS_BY_NAME') {
    fetch(`${API_URL}/api/linkedin/matches/name/${encodeURIComponent(message.companyName)}`)
      .then(res => res.json())
      .then(data => {
        sendResponse({ matches: data.matches });
      })
      .catch(err => {
        console.error('Error checking connections by name:', err);
        sendResponse({ matches: [] });
      });
    return true;
  }
});

// ── LinkedIn Connection Sync Logic ───────────────────────────────────────

/**
 * Retrieve the CSRF Token (JSESSIONID) from cookies
 */
async function getCsrfToken() {
  try {
    const cookie = await chrome.cookies.get({
      url: 'https://www.linkedin.com',
      name: 'JSESSIONID'
    });
    if (!cookie) return null;
    return cookie.value.replace(/"/g, '');
  } catch (e) {
    console.error('Error getting CSRF token:', e);
    return null;
  }
}

let isSyncing = false;
let syncRunningTotal = 0;
let syncExpectedTotal = 0;
let lastSyncMessage = '';

/**
 * Fetch a batch of connections from the Voyager API
 */
async function fetchConnectionsBatch(start = 0, count = 40) {
  if (start === 0) {
    syncRunningTotal = 0;
    syncExpectedTotal = 0;
  }
  
  const csrfToken = await getCsrfToken();
  if (!csrfToken) {
    console.error('[LinkedInSync] Error: User is not logged into LinkedIn (JSESSIONID cookie missing).');
    chrome.runtime.sendMessage({ 
      action: 'LINKEDIN_SYNC_ERROR', 
      error: 'Not logged into LinkedIn. Please log in and try again.' 
    }).catch(() => {});
    return;
  }

  console.log(`[LinkedInSync] Fetching connections batch starting at ${start}...`);

  // Use the more stable non-dash endpoint for connections
  const url = `https://www.linkedin.com/voyager/api/relationships/connections?count=${count}&start=${start}&sortType=RECENTLY_ADDED`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'csrf-token': csrfToken,
        'x-restli-protocol-version': '2.0.0',
        'accept': 'application/json',
        'x-li-lang': 'en_US'
      },
      credentials: 'include'
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[LinkedInSync] Error Body: ${errorBody}`);
        throw new Error(`LinkedIn API responded with ${response.status}: ${errorBody.substring(0, 100)}`);
    }

    const data = await response.json();
    
    // On the first batch, extract the total count from paging if available
    if (start === 0) {
        // 1. Check standard paging root
        if (data.paging && typeof data.paging.total === 'number') {
            syncExpectedTotal = data.paging.total;
        } 
        // 2. Check metadata paging
        else if (data.metadata && data.metadata.paging && typeof data.metadata.paging.total === 'number') {
            syncExpectedTotal = data.metadata.paging.total;
        }

        // 3. Fallback: Dedicated summary/count endpoint
        if (!syncExpectedTotal || syncExpectedTotal === 0) {
            try {
                const summaryUrl = `https://www.linkedin.com/voyager/api/relationships/connectionsSummary`;
                const summaryRes = await fetch(summaryUrl, {
                    headers: {
                        'csrf-token': csrfToken,
                        'x-restli-protocol-version': '2.0.0',
                        'accept': 'application/json'
                    },
                    credentials: 'include'
                });
                if (summaryRes.ok) {
                    const summaryData = await summaryRes.json();
                    if (summaryData.numConnections) {
                        syncExpectedTotal = summaryData.numConnections;
                    }
                }
            } catch (e) {
                console.warn('[LinkedInSync] Failed to fetch connectionsSummary fallback:', e);
            }
        }

        // 4. Final Fallback: Deep search the current 'data' object for anything that looks like a total
        if (!syncExpectedTotal || syncExpectedTotal === 0) {
            const findTotalInObject = (obj) => {
                if (!obj || typeof obj !== 'object') return 0;
                if (obj.total && typeof obj.total === 'number' && obj.total > 10) return obj.total;
                if (obj.numConnections && typeof obj.numConnections === 'number') return obj.numConnections;
                for (const key in obj) {
                    const res = findTotalInObject(obj[key]);
                    if (res) return res;
                }
                return 0;
            };
            syncExpectedTotal = findTotalInObject(data);
        }
        
        if (syncExpectedTotal) {
            console.log(`[LinkedInSync] Detected total network size: ${syncExpectedTotal}`);
        }
    }

    // Process and normalize connections from the stable endpoint
    const batchConnections = (data.elements || []).map(element => {
        const mini = element.miniProfile;
        if (!mini) return null;

        const name = `${mini.firstName || ''} ${mini.lastName || ''}`.trim();
        const headline = mini.occupation || '';
        const profile_url = mini.publicIdentifier ? 
            `https://www.linkedin.com/in/${mini.publicIdentifier}` : '';
        
        let company_id = '';
        let company_name = '';

        // Try to extract company name from headline (e.g., "Software Engineer at Google")
        const atMatch = headline.match(/at\s+(.+)$/i);
        if (atMatch) {
            company_name = atMatch[1].trim();
        }

        return { name, headline, profile_url, company_id, company_name };
    }).filter(Boolean);

    if (batchConnections.length > 0) {
        syncRunningTotal += batchConnections.length;
        await sendBatchToApp(batchConnections);
    }

    // Progress update
    const progressPercent = syncExpectedTotal > 0 
        ? Math.min(Math.round((syncRunningTotal / syncExpectedTotal) * 100), 100)
        : Math.min(Math.round((syncRunningTotal / 1000) * 100), 100); // Fallback to 1000 if total unknown

    const progressMsg = syncExpectedTotal > 0
        ? `Syncing network (${syncRunningTotal} of ${syncExpectedTotal})...`
        : `Syncing network (${syncRunningTotal} connections)...`;
    
    lastSyncMessage = progressMsg;

    console.log(`[LinkedInSync] Progress: ${progressPercent}% (${syncRunningTotal}/${syncExpectedTotal || '?'})`);
    
    chrome.runtime.sendMessage({ 
      action: 'LINKEDIN_SYNC_PROGRESS', 
      progress: progressPercent,
      message: progressMsg
    }).catch(() => {});

    // Pagination: handle next batch with a random delay
    if (data.elements && data.elements.length > 0 && syncRunningTotal < 5000) {
      const nextStart = start + count;
      const delay = Math.floor(Math.random() * 8000) + 4000;
      console.log(`[LinkedInSync] Fetching next batch in ${delay/1000}s...`);
      setTimeout(() => fetchConnectionsBatch(nextStart, count), delay);
    } else {
      isSyncing = false;
      console.log(`[LinkedInSync] Sync complete. Total processed: ${syncRunningTotal}`);
      chrome.runtime.sendMessage({ 
        action: 'LINKEDIN_SYNC_COMPLETE',
        count: syncRunningTotal
      }).catch(() => {});
    }
  } catch (error) {
    isSyncing = false;
    console.error('[LinkedInSync] Voyager API Fetch Error:', error);
    chrome.runtime.sendMessage({ action: 'LINKEDIN_SYNC_ERROR', error: error.message }).catch(() => {});
  }
}

/**
 * Send the retrieved JSON to the backend ingestion endpoint
 */
async function sendBatchToApp(connections) {
  try {
    const response = await fetch('http://localhost:8000/api/linkedin/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connections })
    });
    return await response.json();
  } catch (e) {
    console.error('Error sending batch to app:', e);
  }
}

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
