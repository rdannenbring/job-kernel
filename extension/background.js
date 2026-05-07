let API_URL = 'http://localhost:8000';

// Listen for settings changes
chrome.storage.local.get(['jobkernelApiUrl'], (res) => {
  if (res.jobkernelApiUrl) {
    API_URL = res.jobkernelApiUrl;
  }
});

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.jobkernelApiUrl) {
    API_URL = changes.jobkernelApiUrl.newValue || 'http://localhost:8000';
  }
});

async function fetchWithAuthBackground(url, options = {}) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['apiKey', 'token', 'jobkernelApiUrl'], async (result) => {
      const token = result.apiKey || result.token;
      const currentApiUrl = result.jobkernelApiUrl || API_URL;
      const headers = { ...options.headers };
      
      if (token && url.startsWith(currentApiUrl)) {
        headers['X-API-Key'] = token;
      }
      
      if ((options.method === 'POST' || options.method === 'PUT') && !headers['Content-Type'] && !(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
      }
      
      try {
        const res = await fetch(url, { ...options, headers });
        resolve(res);
      } catch (err) {
        reject(err);
      }
    });
  });
}

/**
 * Send a log message to the backend.
 */
async function remoteLog(level, message, context = null) {
  // Always log to local console first
  const consoleMethod = level.toLowerCase() === 'error' ? 'error' : 
                        level.toLowerCase() === 'warning' ? 'warn' : 'log';
  console[consoleMethod](`[RemoteLog] ${message}`, context || '');

  try {
    // Only attempt if we have an API URL
    chrome.storage.local.get(['jobkernelApiUrl'], async (res) => {
      const currentApiUrl = res.jobkernelApiUrl || API_URL;
      if (!currentApiUrl) return;

      await fetchWithAuthBackground(`${currentApiUrl}/api/extension/logs`, {
        method: 'POST',
        body: JSON.stringify({ level, message, context })
      });
    });
  } catch (e) {
    // Fallback if remote logging itself fails
    console.warn('[JobAutomator] Failed to send remote log:', e);
  }
}
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

const handleMessage = (message, sender, sendResponse) => {
  const fromContentScript = !!(sender && sender.tab);

  // ── Open side panel ────────────────────────────────────────────────────
  if (message.action === 'open_side_panel') {
    const windowId = sender.tab?.windowId;
    if (!windowId) { sendResponse({ error: 'no windowId' }); return true; }
    chrome.sidePanel.open({ windowId }).then(() => {
      broadcastPanelState(true);
      remoteLog('INFO', 'Side panel opened from content script');
      sendResponse({ success: true });
    }).catch((err) => {
      remoteLog('ERROR', `open_side_panel error: ${err.message}`);
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
    fetchWithAuthBackground(`${API_URL}/api/linkedin/matches/${company_id}`)
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
    fetchWithAuthBackground(`${API_URL}/api/linkedin/matches/${message.companyId}`)
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
    fetchWithAuthBackground(`${API_URL}/api/linkedin/matches/name/${encodeURIComponent(message.companyName)}`)
      .then(res => res.json())
      .then(data => {
        sendResponse({ matches: data.matches });
      })
      .catch(err => {
        console.error('Error checking connections by name:', err);
        sendResponse({ matches: [] });
      });
    return true;
  } else if (message.action === 'SCRAPE_LINKEDIN_PROFILE') {
    (async () => {
      try {
        const csrfToken = await getCsrfToken();
        if (!csrfToken) throw new Error('Not logged into LinkedIn (JSESSIONID missing). Please sign in to LinkedIn first.');

        // 1. Get My Profile ID
        const meRes = await fetch('https://www.linkedin.com/voyager/api/me', {
          headers: {
            'csrf-token': csrfToken,
            'x-restli-protocol-version': '2.0.0',
            'accept': 'application/json',
            'x-li-lang': 'en_US'
          },
          credentials: 'include'
        });
        if (!meRes.ok) throw new Error(`LinkedIn API (me) failed: ${meRes.status}`);
        const meData = await meRes.json();
        const publicId = meData.miniProfile.publicIdentifier;

        // 2. Get Profile Detail (Location, Bio)
        let profile = {};
        try {
          const profileRes = await fetch(`https://www.linkedin.com/voyager/api/identity/profiles/${publicId}`, {
            headers: {
              'csrf-token': csrfToken,
              'x-restli-protocol-version': '2.0.0',
              'accept': 'application/json'
            },
            credentials: 'include'
          });
          if (profileRes.ok) profile = await profileRes.json();
        } catch (err) { console.warn('[SCRAPE_LINKEDIN_PROFILE] Error fetching profile detail:', err); }

        // 3. Get Positions
        let positions = { elements: [] };
        try {
          const posRes = await fetch(`https://www.linkedin.com/voyager/api/identity/profiles/${publicId}/positions`, {
            headers: {
              'csrf-token': csrfToken,
              'x-restli-protocol-version': '2.0.0',
              'accept': 'application/json'
            },
            credentials: 'include'
          });
          if (posRes.ok) positions = await posRes.json();
        } catch (err) { console.warn('[SCRAPE_LINKEDIN_PROFILE] Error fetching positions:', err); }

        // 4. Get Education
        let educations = { elements: [] };
        try {
          const eduRes = await fetch(`https://www.linkedin.com/voyager/api/identity/profiles/${publicId}/educations`, {
            headers: {
              'csrf-token': csrfToken,
              'x-restli-protocol-version': '2.0.0',
              'accept': 'application/json'
            },
            credentials: 'include'
          });
          if (eduRes.ok) educations = await eduRes.json();
        } catch (err) { console.warn('[SCRAPE_LINKEDIN_PROFILE] Error fetching educations:', err); }

        // 5. Get Skills
        let skills = { elements: [] };
        try {
          const skillRes = await fetch(`https://www.linkedin.com/voyager/api/identity/profiles/${publicId}/skills`, {
            headers: {
              'csrf-token': csrfToken,
              'x-restli-protocol-version': '2.0.0',
              'accept': 'application/json'
            },
            credentials: 'include'
          });
          if (skillRes.ok) skills = await skillRes.json();
        } catch (err) { console.warn('[SCRAPE_LINKEDIN_PROFILE] Error fetching skills:', err); }

        // 6. Get Certifications
        let certifications = { elements: [] };
        try {
          const certRes = await fetch(`https://www.linkedin.com/voyager/api/identity/profiles/${publicId}/certifications`, {
            headers: {
              'csrf-token': csrfToken,
              'x-restli-protocol-version': '2.0.0',
              'accept': 'application/json'
            },
            credentials: 'include'
          });
          if (certRes.ok) certifications = await certRes.json();
        } catch (err) { console.warn('[SCRAPE_LINKEDIN_PROFILE] Error fetching certifications:', err); }

        // 7. Get Recommendations
        let recommendations = { elements: [] };
        try {
          // We will try `recommendationsReceived` first, if it fails, try `recommendations`
          const recRes = await fetch(`https://www.linkedin.com/voyager/api/identity/profiles/${publicId}/recommendationsReceived`, {
            headers: {
              'csrf-token': csrfToken,
              'x-restli-protocol-version': '2.0.0',
              'accept': 'application/json'
            },
            credentials: 'include'
          });
          if (recRes.ok) {
              recommendations = await recRes.json();
          } else {
              const recResBackup = await fetch(`https://www.linkedin.com/voyager/api/identity/profiles/${publicId}/recommendations`, {
                headers: {
                  'csrf-token': csrfToken,
                  'x-restli-protocol-version': '2.0.0',
                  'accept': 'application/json'
                },
                credentials: 'include'
              });
              if (recResBackup.ok) {
                  recommendations = await recResBackup.json();
              }
          }
        } catch (err) { console.warn('[SCRAPE_LINKEDIN_PROFILE] Error fetching recommendations:', err); }

        // Normalize data for the App
        const normalized = {
          first_name: meData.miniProfile.firstName || '',
          last_name: meData.miniProfile.lastName || '',
          full_name: `${meData.miniProfile.firstName || ''} ${meData.miniProfile.lastName || ''}`.trim(),
          job_title: meData.miniProfile.occupation || '',
          bio: profile.summary || '',
          city: profile.locationName?.split(',')[0]?.trim() || '',
          state: profile.locationName?.split(',')[1]?.trim() || '',
          linkedin_url: `https://www.linkedin.com/in/${publicId}`,
          experiences: (positions.elements || []).map(p => ({
            company: p.companyName || '',
            title: p.title || '',
            location: p.locationName || '',
            description: p.description || '',
            start_date: p.timePeriod?.startDate ? `${p.timePeriod.startDate.month}/${p.timePeriod.startDate.year}` : '',
            end_date: p.timePeriod?.endDate ? `${p.timePeriod.endDate.month}/${p.timePeriod.endDate.year}` : (p.timePeriod?.startDate ? 'Present' : '')
          })),
          educations: (educations.elements || []).map(e => ({
            school: e.schoolName || '',
            degree: e.degreeName || '',
            field: e.fieldOfStudy || '',
            start_date: e.timePeriod?.startDate ? String(e.timePeriod.startDate.year) : '',
            end_date: e.timePeriod?.endDate ? String(e.timePeriod.endDate.year) : ''
          })),
          skills: (skills.elements || []).map(s => s.name || s.skill?.name).filter(Boolean),
          certificates: (certifications.elements || []).map(c => {
            const name = c.name || '';
            if (!name) return null;
            return {
              name: name,
              issuer: c.authority || '',
              date: c.timePeriod?.startDate ? `${c.timePeriod.startDate.month ? c.timePeriod.startDate.month + '/' : ''}${c.timePeriod.startDate.year || ''}` : '',
              url: c.url || ''
            };
          }).filter(Boolean),
          recommendations: (recommendations.elements || []).map(r => {
            const textRaw = r.recommendationText || r.recommendation;
            const text = typeof textRaw === 'object' ? (textRaw.text || '') : (textRaw || '');
            if (!text) return null;
            return {
              text: text,
              recommender: r.recommender ? `${r.recommender.firstName || ''} ${r.recommender.lastName || ''}`.trim() : '',
              relationship: '',
              url: r.recommender?.publicIdentifier ? `https://www.linkedin.com/in/${r.recommender.publicIdentifier}` : ''
            };
          }).filter(Boolean)
        };

        sendResponse({ success: true, data: normalized });
      } catch (err) {
        console.error('[SCRAPE_LINKEDIN_PROFILE] Error:', err);
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  } else if (message.action === 'log') {
    remoteLog(message.level || 'INFO', message.message, message.context);
    sendResponse({ success: true });
    return true;
  }
};

chrome.runtime.onMessage.addListener(handleMessage);
chrome.runtime.onMessageExternal.addListener(handleMessage);

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
    remoteLog('INFO', 'LinkedIn connection sync started');
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
        
        let photo_url = null;
        try {
            if (mini.picture && mini.picture['com.linkedin.common.VectorImage']) {
                const vectorImage = mini.picture['com.linkedin.common.VectorImage'];
                if (vectorImage.rootUrl && vectorImage.artifacts && vectorImage.artifacts.length > 0) {
                    // Use the largest artifact for best quality and most stable URL
                    const artifact = vectorImage.artifacts[vectorImage.artifacts.length - 1];
                    let rawUrl = vectorImage.rootUrl + artifact.fileIdentifyingUrlPathSegment;
                    // Strip session-bound token params that expire; keep the base CDN URL
                    rawUrl = rawUrl.replace(/[?&]v=beta.*$/, '').replace(/[?&]e=\d+.*$/, '');
                    photo_url = rawUrl;
                }
            }
        } catch (e) {}

        return { name, headline, profile_url, company_id, company_name, photo_url };
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
    
    if (syncRunningTotal % 200 === 0 || syncRunningTotal === batchConnections.length) {
      remoteLog('INFO', `LinkedIn sync progress: ${syncRunningTotal}/${syncExpectedTotal || 'unknown'}`);
    }
    
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
      remoteLog('INFO', `LinkedIn connection sync complete. Processed ${syncRunningTotal} connections.`);
      chrome.runtime.sendMessage({ 
        action: 'LINKEDIN_SYNC_COMPLETE',
        count: syncRunningTotal
      }).catch(() => {});
    }
  } catch (error) {
    isSyncing = false;
    console.error('[LinkedInSync] Voyager API Fetch Error:', error);
    remoteLog('ERROR', `LinkedIn sync error: ${error.message}`);
    chrome.runtime.sendMessage({ action: 'LINKEDIN_SYNC_ERROR', error: error.message }).catch(() => {});
  }
}

/**
 * Send the retrieved JSON to the backend ingestion endpoint
 */
async function sendBatchToApp(connections) {
  try {
    const response = await fetchWithAuthBackground(`${API_URL}/api/linkedin/sync`, {
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
      const res = await fetchWithAuthBackground(`${API_URL}/api/profile`);
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
