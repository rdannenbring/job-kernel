document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const form = document.getElementById('job-form');
  const toggleDescBtn = document.getElementById('toggle-desc');
  const descContainer = document.getElementById('desc-container');
  const btnSave = document.getElementById('btn-save');
  const btnProcess = document.getElementById('btn-process');
  const statusMsg = document.getElementById('status-message');
  const loadingOverlay = document.getElementById('loading-overlay');
  const loadingTitle    = document.getElementById('loading-title');
  const loadingSubtitle = document.getElementById('loading-subtitle');
  const logoImg = document.getElementById('company-logo-img');
  const logoPlaceholder = document.getElementById('company-logo-placeholder');
  const logoFileInput = document.getElementById('logo-file-input');
  const logoEditBtn = document.getElementById('logo-edit-btn');
  const savedBanner        = document.getElementById('saved-banner');
  const savedBannerStatus   = document.getElementById('saved-banner-status');
  const savedBannerLink     = document.getElementById('saved-banner-link');
  const kernelEditBtn       = document.getElementById('kernel-edit-btn');
  const readonlyNotice      = document.getElementById('readonly-notice');
  const btnSaveLabel        = document.getElementById('btn-save-label');
  const btnProcessLabel     = document.getElementById('btn-process-label');
  const companyInput        = document.getElementById('company');
  const loadingProgress     = document.getElementById('loading-progress');
  
  // Mode switcher elements
  const detailsModeBtn      = document.getElementById('mode-details');
  const applyModeBtn        = document.getElementById('mode-apply');
  const detailsContainer    = document.getElementById('details-container');
  const applyContainer      = document.getElementById('apply-container');
  const applyJobPicker      = document.getElementById('apply-job-picker');
  const applySearchInput    = document.getElementById('apply-job-search');
  const applySearchResults  = document.getElementById('apply-search-results');
  const applyNoJob          = document.getElementById('apply-no-job');
  const btnSwitchToDetails  = document.getElementById('btn-switch-to-details');
  const footerActions       = document.querySelector('.footer-actions');
  const btnChangeApp        = document.getElementById('btn-change-application');
  const btnClosePicker      = document.getElementById('btn-close-picker');
  const applyHeaderSubtitle = document.getElementById('apply-header-subtitle');
  const btnBannerApply      = document.getElementById('btn-banner-apply');
  const applyJobSummary     = document.getElementById('apply-job-summary');
  const summaryLogo         = document.getElementById('summary-logo');
  const summaryTitle        = document.getElementById('summary-title');
  const summaryCompany      = document.getElementById('summary-company');
  const summaryMeta         = document.getElementById('summary-meta');
  const summaryStatusBadge  = document.getElementById('summary-status-badge');

  const btnRefresh          = document.getElementById('btn-refresh');
  
  // Apply Sections & Grids
  const applySections       = document.getElementById('apply-sections');
  const applyAssetsV2        = document.getElementById('apply-assets-v2');
  const gridContact         = document.getElementById('grid-contact');
  const gridSkills          = document.getElementById('grid-skills');
  const gridExperience      = document.getElementById('grid-experience');
  const gridEducation       = document.getElementById('grid-education');
  const gridCertificates     = document.getElementById('grid-certificates');
  const gridOther           = document.getElementById('grid-other');
  const btnCopyAllSkills    = document.getElementById('btn-copy-all-skills');

  // Modal elements
  const logoModal           = document.getElementById('logo-modal');
  const logoModalClose      = document.getElementById('logo-modal-close');
  const logoModalOverlay    = document.getElementById('logo-modal-overlay');
  const logoSearchInput     = document.getElementById('logo-search-input');
  const logoResults         = document.getElementById('logo-results');
  const logoSearching       = document.getElementById('logo-searching');
  const logoNoResults       = document.getElementById('logo-no-results');
  const tabBtns             = document.querySelectorAll('.tab-btn');
  const tabContents         = document.querySelectorAll('.tab-content');
  const logoUrlInput        = document.getElementById('logo-url-input');
  const logoUrlPreviewContainer = document.getElementById('logo-url-preview-container');
  const logoUrlPreview      = document.getElementById('logo-url-preview');
  const btnUseUrl           = document.getElementById('btn-use-url');
  const logoDropzone        = document.getElementById('logo-dropzone');
  const logoZone            = document.getElementById('logo-zone');

  const API_URL = 'http://localhost:8000';
  const APP_URL = 'http://localhost:5173';

  let loadingTimeout = null;
  // The current application record from the server (if it exists)
  let currentAppRecord = null;
  // The scraped data from the browser
  let scrapedData = null;

  // ── Tell background we're alive so it can track panel state ─────────────
  const port = chrome.runtime.connect({ name: 'sidepanel' });
  chrome.storage.local.set({ isPanelOpen: true });
  window.addEventListener('unload', () => {
    chrome.storage.local.set({ isPanelOpen: false });
  });

  // ── Mode Switching ────────────────────────────────────────────────────────
  let currentMode = 'details';

  function setMode(mode) {
    currentMode = mode;
    if (mode === 'apply') {
      detailsModeBtn.classList.remove('active');
      applyModeBtn.classList.add('active');
      detailsContainer.style.display = 'none';
      applyContainer.style.display = 'flex';
      footerActions.style.display = 'none';
      savedBanner.style.display = 'none'; 
      
      // Update header Change App button visibility
      btnChangeApp.style.display = applySelectedJob ? 'flex' : 'none';
      
      initApplyMode();
    } else {
      applyModeBtn.classList.remove('active');
      detailsModeBtn.classList.add('active');
      applyContainer.style.display = 'none';
      applyJobPicker.style.display = 'none'; // Ensure picker is hidden when leaving Apply mode
      detailsContainer.style.display = 'block';
      footerActions.style.display = 'flex';
      savedBanner.style.display = ''; 
      
      // Hide header Change App button in search mode
      btnChangeApp.style.display = 'none';
    }
  }

  detailsModeBtn.addEventListener('click', () => setMode('details'));
  applyModeBtn.addEventListener('click', () => setMode('apply'));
  btnSwitchToDetails.addEventListener('click', () => setMode('details'));

  btnBannerApply.addEventListener('click', () => {
    // Switch to apply mode using the current record found in the kernel
    if (currentAppRecord) {
      setMode('apply');
      loadApplyJob(currentAppRecord);
    } else {
      setMode('apply');
    }
  });

  // ── Loading state ────────────────────────────────────────────────────────
  function showLoading(title = 'Detecting New Job', subtitle = 'Reading the job listing\u2026') {
    loadingTitle.textContent    = title;
    loadingSubtitle.textContent = subtitle;
    loadingProgress.style.width = '0%';
    loadingOverlay.classList.add('visible');
    loadingOverlay.setAttribute('aria-hidden', 'false');
    btnSave.disabled = true;
    btnProcess.disabled = true;
    clearTimeout(loadingTimeout);
    loadingTimeout = setTimeout(() => {
      console.warn('[JobAutomator] Loading timed out — hiding overlay.');
      hideLoading();
    }, 15000);
  }

  function updateLoadingProgress(percent, subtitle) {
    if (percent !== undefined) loadingProgress.style.width = `${percent}%`;
    if (subtitle) loadingSubtitle.textContent = subtitle;
  }

  function hideLoading() {
    clearTimeout(loadingTimeout);
    loadingOverlay.classList.remove('visible');
    loadingOverlay.setAttribute('aria-hidden', 'true');
    btnSave.disabled = false;
    btnProcess.disabled = false;
  }

  // ── Toggle description ────────────────────────────────────────────────────
  toggleDescBtn.addEventListener('click', () => {
    toggleDescBtn.classList.toggle('active');
    descContainer.classList.toggle('open');
  });

  // ── Company logo ──────────────────────────────────────────────────────────
  let currentLogoUrl = null;

  function setLogo(url) {
    currentLogoUrl = url || null;
    if (url) {
      logoImg.src = url;
      logoImg.style.display = 'block';
      logoPlaceholder.style.display = 'none';
    } else {
      logoImg.style.display = 'none';
      logoImg.src = '';
      logoPlaceholder.style.display = 'flex';
    }
  }

  logoEditBtn.addEventListener('click', () => logoFileInput.click());

  logoFileInput.addEventListener('change', () => {
    const file = logoFileInput.files[0];
    if (!file) return;
    handleLogoFile(file);
  });

  function handleLogoFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      setLogo(e.target.result);
      closeLogoModal();
    };
    reader.readAsDataURL(file);
  }

  // ── Logo Modal Logic ───────────────────────────────────────────────────────
  
  function openLogoModal() {
    logoModal.classList.add('visible');
    logoModal.setAttribute('aria-hidden', 'false');
    if (companyInput.value) {
      logoSearchInput.value = companyInput.value;
      performLogoSearch(companyInput.value);
    }
    setTimeout(() => logoSearchInput.focus(), 100);
  }

  function closeLogoModal() {
    logoModal.classList.remove('visible');
    logoModal.setAttribute('aria-hidden', 'true');
  }

  logoZone.addEventListener('click', openLogoModal);
  logoModalClose.addEventListener('click', closeLogoModal);
  logoModalOverlay.addEventListener('click', closeLogoModal);

  // Tabs
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${target}`).classList.add('active');
    });
  });

  // Search Logic
  let logoSearchTimeout = null;
  logoSearchInput.addEventListener('input', () => {
    clearTimeout(logoSearchTimeout);
    logoSearchTimeout = setTimeout(() => {
      performLogoSearch(logoSearchInput.value);
    }, 400);
  });

  async function performLogoSearch(query) {
    if (!query || query.length < 2) {
      logoResults.innerHTML = '';
      logoNoResults.style.display = 'none';
      return;
    }

    logoSearching.style.display = 'flex';
    logoNoResults.style.display = 'none';
    logoResults.innerHTML = '';

    try {
      const res = await fetch(`https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(query)}`);
      const data = await res.json();
      
      logoSearching.style.display = 'none';
      
      if (!data || data.length === 0) {
        logoNoResults.style.display = 'flex';
        return;
      }

      data.slice(0, 9).forEach(item => {
        const div = document.createElement('div');
        div.className = 'logo-result-item';
        // item.logo is direct from clearbit, item.domain allows google favicon fallback
        const logoUrl = `https://www.google.com/s2/favicons?domain=${item.domain}&sz=128`;
        
        div.innerHTML = `
          <img src="${logoUrl}" alt="${item.name}" onerror="this.src='https://www.google.com/s2/favicons?domain=${item.domain}&sz=64'">
          <span>${item.name}</span>
        `;
        div.onclick = () => {
          setLogo(logoUrl);
          closeLogoModal();
        };
        logoResults.appendChild(div);
      });
    } catch (e) {
      logoSearching.style.display = 'none';
      logoNoResults.style.display = 'flex';
    }
  }

  // URL Tab
  logoUrlInput.addEventListener('input', () => {
    const val = logoUrlInput.value.trim();
    if (val && (val.startsWith('http') || val.startsWith('data:'))) {
      logoUrlPreview.src = val;
      logoUrlPreviewContainer.style.display = 'flex';
    } else {
      logoUrlPreviewContainer.style.display = 'none';
    }
  });

  btnUseUrl.addEventListener('click', () => {
    const val = logoUrlInput.value.trim();
    if (val) {
      setLogo(val);
      closeLogoModal();
    }
  });

  // Upload Tab
  logoDropzone.addEventListener('click', () => logoFileInput.click());

  // ── Auto-Logo Detection ───────────────────────────────────────────────────
  // If company name changes and we have no logo, try a quick auto-search
  companyInput.addEventListener('blur', () => {
    if (companyInput.value && !currentLogoUrl) {
      autoFetchLogo(companyInput.value);
    }
  });

  async function autoFetchLogo(name) {
    if (!name || name.length < 2) return;
    
    // Clean names like "at Optimum" or "Optimum - 3.5 rating"
    let cleanName = name.replace(/^at\s+/i, '').split(/[\-\u2013\u2014]/)[0].trim();
    if (cleanName.length < 2) return;

    console.log(`[JobAutomator] Auto-fetching logo for: "${cleanName}"`);
    try {
      const res = await fetch(`https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(cleanName)}`);
      if (!res.ok) return;
      
      const data = await res.json();
      if (data && data.length > 0) {
        // Look for the best match (often the first one is correct)
        const bestMatch = data[0];
        console.log(`[JobAutomator] Logo auto-match found: ${bestMatch.name} (${bestMatch.domain})`);
        const logoUrl = `https://www.google.com/s2/favicons?domain=${bestMatch.domain}&sz=128`;
        setLogo(logoUrl);
      } else {
        console.log(`[JobAutomator] No logo matches found for: "${cleanName}"`);
      }
    } catch (e) {
      console.error('[JobAutomator] Auto-logo fetch failed:', e);
    }
  }

  // ── Interest level toggles ────────────────────────────────────────────────
  const interestStars = document.querySelectorAll('#interest-stars .star');
  const interestInput = document.getElementById('interestLevel');
  const valueMap = { 1: 'Low', 2: 'Medium', 3: 'High' };
  const levelMap = { 'Low': 1, 'Medium': 2, 'High': 3, '': 0 };

  interestStars.forEach(star => {
    star.addEventListener('click', () => {
      const val = parseInt(star.dataset.value);
      interestInput.value = valueMap[val];
      updateStarsUI(val);
    });
  });

  function updateStarsUI(level) {
    interestStars.forEach(s => {
      const sVal = parseInt(s.dataset.value);
      if (sVal <= level) {
        s.classList.add('filled');
      } else {
        s.classList.remove('filled');
      }
    });
  }

  // ── Interest level helpers ────────────────────────────────────────────────
  function setInterest(value) {
    interestInput.value = value || '';
    updateStarsUI(levelMap[value || '']);
  }

  // ── Normalise a date value to YYYY-MM-DD ─────────────────────────────────
  function normaliseDate(raw) {
    if (!raw) return '';
    try {
      const d = new Date(raw);
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    } catch (_) {}
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    return '';
  }

  // ── Safe select value helper ──────────────────────────────────────────────
  function setSelectValueSafely(selectId, value) {
    const el = document.getElementById(selectId);
    if (!el) return;
    const val = value || '';
    // Instead of querySelector (which fails on special characters like $),
    // we iterate the options or just check the validity of the value.
    const options = Array.from(el.options);
    const match = options.find(opt => opt.value === val);
    el.value = match ? val : '';
  }

  // ── Populate form from a data object ─────────────────────────────────────
  function populateForm(data) {
    document.getElementById('title').value      = data.title       || data.job_title    || '';
    document.getElementById('company').value    = data.company     || '';
    document.getElementById('link').value       = data.link        || data.job_url      || '';
    document.getElementById('applyLink').value  = data.applyLink   || data.apply_url    || '';
    document.getElementById('datePosted').value = normaliseDate(data.datePosted  || data.date_posted);
    document.getElementById('deadline').value   = normaliseDate(data.deadline);
    document.getElementById('salaryRange').value= data.salaryRange || data.salary_range || '';
    document.getElementById('description').value= data.description || data.job_description || '';
    document.getElementById('location').value   = data.location    || '';
    document.getElementById('relocation').checked =
      data.relocation === true || data.relocation === 'true';

    // Job Type
    setSelectValueSafely('jobType', data.jobType || data.job_type);

    // Location Type
    setSelectValueSafely('locationType', data.locationType || data.location_type);

    // Remarks
    document.getElementById('remarks').value = data.remarks || '';

    // Interest level
    setInterest(data.interestLevel || data.interest_level || '');

    // Company logo — prefer app record logo over scraped
    setLogo(data.companyLogo || data.company_logo || null);

    // If logo is still null, try auto-fetch using company name first, then title
    if (!currentLogoUrl) {
      const searchName = data.company || data.job_title;
      if (searchName) {
        autoFetchLogo(searchName);
      }
    }
  }

  // ── Apply field diff highlighting ─────────────────────────────────────────
  // Compare an app record value to the scraped value and mark the wrapper accordingly.
  // fieldMap: { fieldName: { appValue, scrapedValue, elementId } }
  function applyDiffHighlights(appRecord, scraped) {
    // Clear all existing diff badges & classes
    document.querySelectorAll('.field-diff-wrapper').forEach(wrapper => {
      wrapper.classList.remove('field-has-diff');
      const badge = wrapper.querySelector('.field-diff-badge');
      if (badge) badge.remove();
    });

    if (!scraped) return;

    // Map of data-field → scraped value (using scraped field names)
    const scrapedMap = {
      title:        scraped.title        || '',
      company:      scraped.company      || '',
      link:         scraped.link         || '',
      applyLink:    scraped.applyLink    || '',
      datePosted:   normaliseDate(scraped.datePosted),
      deadline:     normaliseDate(scraped.deadline),
      salaryRange:  scraped.salaryRange  || '',
      jobType:      scraped.jobType      || '',
      locationType: scraped.locationType || '',
      location:     scraped.location     || '',
      description:  scraped.description  || '',
      remarks:      scraped.remarks      || '',
    };

    // Map of data-field → app record value
    const appMap = {
      title:        appRecord.job_title      || '',
      company:      appRecord.company        || '',
      link:         appRecord.job_url        || '',
      applyLink:    appRecord.apply_url      || '',
      datePosted:   normaliseDate(appRecord.date_posted),
      deadline:     normaliseDate(appRecord.deadline),
      salaryRange:  appRecord.salary_range   || '',
      jobType:      appRecord.job_type       || '',
      locationType: appRecord.location_type  || '',
      location:     appRecord.location       || '',
      description:  appRecord.job_description|| '',
      remarks:      appRecord.remarks        || '',
    };

    document.querySelectorAll('.field-diff-wrapper[data-field]').forEach(wrapper => {
      const field = wrapper.dataset.field;
      const appVal     = (appMap[field]     || '').trim();
      const scrapedVal = (scrapedMap[field] || '').trim();

      // Skip if scraped has no value for this field (nothing to compare)
      if (!scrapedVal) return;

      if (appVal !== scrapedVal) {
        wrapper.classList.add('field-has-diff');
        // Add badge
        const badge = document.createElement('span');
        badge.className = 'field-diff-badge';
        badge.textContent = 'i';
        badge.title = `App value: "${appVal || '(empty)'}" · Page value: "${scrapedVal}"`;
        wrapper.appendChild(badge);
      }
    });
  }

  // ── Apply app status rules to the form ───────────────────────────────────
  // Status logic:
  //   Saved / Generated  → editable, buttons labelled Update / Re-process (for Generated)
  //   Anything else      → read-only, buttons hidden / disabled
  function applyStatusRules(status) {
    const normalizedStatus = (status || '').toLowerCase();
    const isSaved     = normalizedStatus === 'saved';
    const isGenerated = normalizedStatus === 'generated';
    const isEditable  = isSaved || isGenerated;

    // Form read-only
    if (isEditable) {
      form.classList.remove('form-readonly');
    } else {
      form.classList.add('form-readonly');
    }

    // Button labels
    if (isGenerated) {
      if (btnSaveLabel)    btnSaveLabel.textContent    = 'Update';
      if (btnProcessLabel) btnProcessLabel.textContent = 'Re-process';
    } else {
      if (btnSaveLabel)    btnSaveLabel.textContent    = 'Save';
      if (btnProcessLabel) btnProcessLabel.textContent = 'Process Now';
    }

    if (!isEditable) {
      btnSave.style.display    = 'none';
      btnProcess.style.display = 'none';
    } else {
      btnSave.style.display    = '';
      btnProcess.style.display = '';
    }
  }


  // ── Tab Management Helper ─────────────────────────────────────────────────
  // Intelligently open or focus an existing JobKernel tab rather than spawning duplicates.
  function openOrFocusAppTab(targetUrl) {
    const targetUrlObj = new URL(targetUrl);
    const targetHost = targetUrlObj.host;

    // Query all tabs to find one that matches our app host
    chrome.tabs.query({}, (tabs) => {
      let existingTab = null;
      
      if (tabs) {
        existingTab = tabs.find(tab => {
          try {
            const tabUrl = new URL(tab.url);
            // Match host (e.g. localhost:5173 or 127.0.0.1:5173)
            return tabUrl.host === targetHost;
          } catch (e) {
            return false;
          }
        });
      }

      if (existingTab) {
        // We found an existing app tab — focus its window and make it active
        chrome.windows.update(existingTab.windowId, { focused: true });
        
        const props = { active: true };
        // Only navigate if the URL is different
        if (existingTab.url !== targetUrl) {
          props.url = targetUrl;
        }
        chrome.tabs.update(existingTab.id, props);
      } else {
        // Fallback: spawn a new tab
        chrome.tabs.create({ url: targetUrl });
      }
    });
  }

  // ── Show the "already in Kernel" confirmation overlay ────────────────────
  function showSavedBanner(appRecord) {
    // Format the "Last updated" time
    const ts = appRecord.updated_at || appRecord.created_at || appRecord.date_saved;
    let subText = 'Last updated \u2014';
    if (ts) {
      try {
        const d = new Date(ts);
        if (!isNaN(d.getTime())) {
          subText = 'Last updated ' + d.toLocaleDateString(undefined, {
            month: 'short', day: 'numeric', year: 'numeric'
          }) + ' at ' + d.toLocaleTimeString(undefined, {
            hour: 'numeric', minute: '2-digit'
          });
        }
      } catch (_) {}
    }
    savedBannerStatus.textContent = subText;

    // Set href so native "open in new tab" still works via right click,
    // but default left-click is intercepted to focus existing tabs.
    savedBannerLink.href = `${APP_URL}/?viewApp=${appRecord.id}#detail`;
    savedBannerLink.dataset.url = `${APP_URL}/?viewApp=${appRecord.id}#detail`;
    savedBannerLink.title = `View "${appRecord.job_title}" in the app`;

    savedBanner.classList.add('visible');
    savedBanner.setAttribute('aria-hidden', 'false');
  }

  savedBannerLink.addEventListener('click', (e) => {
    e.preventDefault();
    if (savedBannerLink.dataset.url) {
      openOrFocusAppTab(savedBannerLink.dataset.url);
    }
  });

  function hideSavedBanner() {
    savedBanner.classList.remove('visible');
    savedBanner.setAttribute('aria-hidden', 'true');
    currentAppRecord = null;
    // Restore button labels
    if (btnSaveLabel)    btnSaveLabel.textContent    = 'Save';
    if (btnProcessLabel) btnProcessLabel.textContent = 'Process Now';
    btnSave.style.display    = '';
    btnProcess.style.display = '';
    form.classList.remove('form-readonly');
    document.querySelectorAll('.field-diff-wrapper').forEach(w => {
      w.classList.remove('field-has-diff');
      const b = w.querySelector('.field-diff-badge');
      if (b) b.remove();
    });
  }

  // "Edit details" button dismisses the confirmation and reveals the form
  kernelEditBtn.addEventListener('click', hideSavedBanner);


  // ── Check if job URL is already in the database ───────────────────────────
  async function checkExistingApplication(jobUrl) {
    if (!jobUrl) return null;
    try {
      const res = await fetch(`${API_URL}/api/check-job-url?url=${encodeURIComponent(jobUrl)}`, {
        cache: 'no-store'
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data.exists && data.application) {
        return data.application;
      }
    } catch (e) {
      console.warn('[JobAutomator] check-job-url failed:', e);
    }
    return null;
  }

  // ── Populate form from scraped/app data ──────────────────────────────────
  // silent=true skips the loading overlay (used for background refreshes)
  const loadData = async ({ silent = false } = {}) => {
    try {
      if (!silent) showLoading('Detecting New Job', 'Reading the job listing\u2026');
      updateLoadingProgress(10);

      chrome.storage.local.get(['latestJobData'], async (result) => {
        try {
          updateLoadingProgress(30, 'Parsing scraped data\u2026');
          if (result.latestJobData) {
            scrapedData = result.latestJobData;

            // Check if a matching application already exists in the DB
            const jobUrl = scrapedData.link || scrapedData.job_url || '';
            updateLoadingProgress(50, 'Checking database for history\u2026');
            const appRecord = jobUrl ? await checkExistingApplication(jobUrl) : null;

            updateLoadingProgress(70, 'Updating form fields\u2026');
            if (appRecord) {
              currentAppRecord = appRecord;
              // Populate form from the APP record (truth source for existing job)
              populateForm(appRecord);
              // Show the already-saved banner
              showSavedBanner(appRecord);
              // Mark fields that differ from what was scraped
              applyDiffHighlights(appRecord, scrapedData);
              // Apply status-based editability rules
              applyStatusRules(appRecord.status);
            } else {
              // New job — populate from scraped data as before
              hideSavedBanner();
              populateForm(scrapedData);
              
              // If we were in Apply mode but just landed on a new, untracked job,
              // automatically switch back to Search mode so they can save it.
              if (currentMode === 'apply') {
                setMode('details');
              }
            }
          }
        } catch (innerErr) {
          console.error('[JobAutomator] Error in loadData storage callback:', innerErr);
        } finally {
          updateLoadingProgress(100, 'Ready!');
          setTimeout(() => hideLoading(), 300);
        }
      });
    } catch (err) {
      console.error('[JobAutomator] Error in loadData:', err);
      hideLoading();
    }
  };

  // ── Silent background refresh of existing app record ──────────────────────
  // When the panel opens and we already have a live app record, silently
  // re-fetch it from the API so any changes made in the main app (status
  // changes, employer edits, etc.) are picked up without a user action.
  const silentRefreshAppRecord = async (specificId = null) => {
    const idToRefresh = specificId || currentAppRecord?.id;
    if (!idToRefresh) return;
    
    try {
      const res = await fetch(`${API_URL}/api/applications/${idToRefresh}`, {
        cache: 'no-store'
      });
      if (!res.ok) return;
      const updated = await res.json();
      
      // Update Details context if IDs match
      if (currentAppRecord && updated.id === currentAppRecord.id) {
        if (JSON.stringify(updated) !== JSON.stringify(currentAppRecord)) {
          console.log('[JobAutomator] Details record changed — refreshing.');
          currentAppRecord = updated;
          populateForm(updated);
          showSavedBanner(updated);
          applyDiffHighlights(updated, scrapedData);
          applyStatusRules(updated.status);
        }
      }

      // Update Apply context if IDs match
      if (applySelectedJob && updated.id === applySelectedJob.id) {
        if (JSON.stringify(updated) !== JSON.stringify(applySelectedJob)) {
          console.log('[JobAutomator] Apply record changed — refreshing.');
          loadApplyJob(updated);
        }
      }
    } catch (e) {
      // Backend may not be reachable — silently ignore
    }
  };

  loadData();

  // ── Auto-refresh: watch chrome.storage for latestJobData changes ──────────
  // Fires when the content script re-scrapes the page (e.g. user reloads the
  // job listing tab or navigates to a new job), so the panel updates instantly
  // without needing a manual reload.
  chrome.storage.onChanged.addListener((changes, area) => {
    try {
      if (area === 'local' && changes.latestJobData) {
        const newVal = changes.latestJobData.newValue;
        if (newVal) {
          console.log('[JobAutomator] latestJobData updated — reloading panel.');
          loadData({ silent: true });
        }
      }
    } catch (e) {
      console.error('[JobAutomator] Error in storage listener:', e);
    }
  });

  // ── Message listener ──────────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'job_loading') {
      showLoading();
    } else if (message.action === 'refresh_panel_data') {
      // Reload scraped data and cleanly re-fetch the database record 
      // checkExistingApplication now uses cache: 'no-store' so this is guaranteed fresh.
      loadData({ silent: true });
    } else if (message.action === 'do_window_close') {
      window.close();
    } else if (message.action === 'app_updated') {
      silentRefreshAppRecord(message.application_id);
    }
  });

  // On panel focus (user switches back to the panel), silently check for
  // any changes that happened in the main app in the meantime.
  // Debounced to 2s to avoid rapid-fire API calls when flicking between windows.
  let focusRefreshTimer = null;
  window.addEventListener('focus', () => {
    clearTimeout(focusRefreshTimer);
    focusRefreshTimer = setTimeout(() => silentRefreshAppRecord(), 2000);
  });

  // ── Status helper ─────────────────────────────────────────────────────────
  function showStatus(message, type = 'success') {
    statusMsg.textContent = message;
    statusMsg.className = `status-message show ${type}`;
    setTimeout(() => { statusMsg.className = 'status-message'; }, 5000);
  }

  // ── Collect form data ─────────────────────────────────────────────────────
  function getFormData() {
    return {
      title:         document.getElementById('title').value,
      company:       document.getElementById('company').value,
      companyLogo:   currentLogoUrl,
      link:          document.getElementById('link').value,
      applyLink:     document.getElementById('applyLink').value,
      datePosted:    document.getElementById('datePosted').value,
      deadline:      document.getElementById('deadline').value,
      salaryRange:   document.getElementById('salaryRange').value,
      description:   document.getElementById('description').value,
      jobType:       document.getElementById('jobType').value,
      locationType:  document.getElementById('locationType').value,
      location:      document.getElementById('location').value,
      relocation:    document.getElementById('relocation').checked,
      interestLevel: document.getElementById('interestLevel').value,
      remarks:       document.getElementById('remarks').value,
    };
  }

  // ── Save / Update ─────────────────────────────────────────────────────────
  btnSave.addEventListener('click', async () => {
    if (!form.checkValidity()) { form.reportValidity(); return; }

    const data = getFormData();

    if (currentAppRecord) {
      // UPDATE existing application
      showLoading('Updating Application', 'Validating data\u2026');
      updateLoadingProgress(15);
      try {
        updateLoadingProgress(40, 'Connecting to backend\u2026');
        const res = await fetch(`${API_URL}/api/applications/${currentAppRecord.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            job_title:       data.title,
            company:         data.company,
            company_logo:    data.companyLogo,
            job_url:         data.link,
            apply_url:       data.applyLink,
            job_description: data.description,
            salary_range:    data.salaryRange,
            date_posted:     data.datePosted,
            deadline:        data.deadline,
            job_type:        data.jobType,
            location_type:   data.locationType,
            location:        data.location,
            relocation:      data.relocation,
            interest_level:  data.interestLevel,
            remarks:         data.remarks,
            status:          currentAppRecord?.status || 'Saved',
          }),
        });

        if (res.ok) {
          updateLoadingProgress(80, 'Finalizing update\u2026');
          showStatus('Updated!', 'success');
          // Refresh the local record and remove diff highlights
          const updated = await checkExistingApplication(data.link);
          if (updated) {
            currentAppRecord = updated;
            applyDiffHighlights(updated, scrapedData);
          }
          updateLoadingProgress(100);
        } else {
          const err = await res.json();
          showStatus(err.detail || 'Failed to update', 'error');
        }
      } catch (e) {
        showStatus('Connection error. Is the backend running?', 'error');
      } finally {
        hideLoading();
      }
    } else {
      // SAVE new application
      showLoading('Saving Application', 'Preparing job data\u2026');
      updateLoadingProgress(15);
      try {
        updateLoadingProgress(40, 'Sending to Kernel database\u2026');
        const res = await fetch(`${API_URL}/api/save-application`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            job_title:       data.title,
            company:         data.company,
            company_logo:    data.companyLogo,
            job_url:         data.link,
            apply_url:       data.applyLink,
            job_description: data.description,
            salary_range:    data.salaryRange,
            date_posted:     data.datePosted,
            deadline:        data.deadline,
            job_type:        data.jobType,
            location_type:   data.locationType,
            location:        data.location,
            relocation:      data.relocation,
            interest_level:  data.interestLevel,
            remarks:         data.remarks,
            status:          'Saved',
          }),
        });

        if (res.ok) {
          updateLoadingProgress(80, 'Sycing with local storage\u2026');
          showStatus('Saved!', 'success');
          chrome.storage.local.remove('latestJobData');
          // Show the banner for the newly saved record
          const saved = await checkExistingApplication(data.link);
          if (saved) {
            currentAppRecord = saved;
            showSavedBanner(saved);
            applyStatusRules(saved.status);
          }
          updateLoadingProgress(100);
        } else {
          const err = await res.json();
          showStatus(err.detail || 'Failed to save', 'error');
        }
      } catch (e) {
        showStatus('Connection error. Is the backend running?', 'error');
      } finally {
        hideLoading();
      }
    }
  });

  // ── Process ───────────────────────────────────────────────────────────────
  btnProcess.addEventListener('click', () => {
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const data = getFormData();
    // Add existing ID so NewApplication.jsx updates instead of recreating
    if (currentAppRecord) data.id = currentAppRecord.id;
    
    const payload = btoa(encodeURIComponent(JSON.stringify(data)));
    openOrFocusAppTab(`${APP_URL}/?processJob=${payload}`);
  });

  // ── Apply Mode Logic ──────────────────────────────────────────────────────
  let applySelectedJob = null;

  async function initApplyMode() {
    // If the current job in the details panel is "Generated", use it automatically
    if (currentAppRecord && currentAppRecord.status.toLowerCase() === 'generated') {
      loadApplyJob(currentAppRecord);
    } else {
      // Otherwise show the picker
      btnChangeApp.style.display = 'none';
      applyJobSummary.style.display = 'none'; // Hide summary if no job selected
      if (applyHeaderSubtitle) {
        applyHeaderSubtitle.style.display = 'none';
      }
      showApplyPicker();
    }
    // Prioritize profile from job snapshot if available
    if (applySelectedJob && applySelectedJob.profile_snapshot && applySelectedJob.profile_snapshot.profile) {
      console.log('[JobAutomator] Using job-specific profile snapshot');
      renderProfileItems(applySelectedJob.profile_snapshot.profile, applySelectedJob.profile_snapshot.context_docs);
    } else {
      // Otherwise load the latest global profile
      loadProfileInfo();
    }
  }

  async function loadProfileInfo() {
    try {
      const res = await fetch(`${API_URL}/api/profile`);
      if (!res.ok) throw new Error('Failed to fetch profile');
      const profile = await res.json();
      renderProfileItems(profile);
    } catch (e) {
      console.error('[JobAutomator] Error loading profile:', e);
    }
  }

  function createCopyField(label, value) {
    if (!value) return null;
    const el = document.createElement('div');
    el.className = 'copy-field';
    el.innerHTML = `
      <div class="field-title-row">
        <span class="field-title">${label}</span>
        <button type="button" class="field-copy-btn">
          <span class="material-symbols-outlined" style="font-size: 1rem;">content_copy</span>
        </button>
      </div>
      <div class="field-value">${value}</div>
    `;
    
    el.onclick = () => {
      navigator.clipboard.writeText(value);
      const btn = el.querySelector('.field-copy-btn');
      const original = btn.innerHTML;
      btn.innerHTML = '<span class="material-symbols-outlined" style="color:var(--success); font-size:1rem;">check_circle</span>';
      el.style.borderColor = 'var(--success)';
      setTimeout(() => {
        btn.innerHTML = original;
        el.style.borderColor = '';
      }, 1500);
    };
    return el;
  }

  function renderProfileItems(p, contextDocs = []) {
    // Clear all grids
    gridContact.innerHTML = '';
    gridSkills.innerHTML = '';
    gridExperience.innerHTML = '';
    gridEducation.innerHTML = '';
    gridCertificates.innerHTML = '';
    gridOther.innerHTML = '';

    // 1. Contact Info (Removed Full Name as requested)
    const contactFields = [
      { label: 'First Name', value: p.first_name },
      { label: 'Last Name',  value: p.last_name },
      { label: 'Email',      value: p.email },
      { label: 'Phone',     value: p.phone_primary },
      { label: 'LinkedIn',  value: p.linkedin_url },
      { label: 'GitHub',    value: p.github_url },
      { label: 'Website',   value: p.website_url },
      { label: 'Address',   value: [p.address_line1, p.address_line2].filter(Boolean).join(', ') },
      { label: 'Location',  value: (p.city && p.state) ? `${p.city}, ${p.state}` : (p.city || p.state || '') },
      { label: 'Zip Code',  value: p.zip_code },
      { label: 'Bio',       value: p.bio },
    ];
    contactFields.forEach(f => {
      const el = createCopyField(f.label, f.value);
      if (el) gridContact.appendChild(el);
    });

    // 2. Skills
    if (p.skills && p.skills.length > 0) {
      p.skills.forEach(skill => {
        const item = document.createElement('div');
        item.className = 'copy-item';
        item.innerHTML = `
          <span class="copy-item-label">${skill}</span>
          <button type="button" class="btn-copy">
            <span class="material-symbols-outlined" style="font-size: 0.9rem;">content_copy</span>
          </button>
        `;
        item.onclick = () => {
          navigator.clipboard.writeText(skill);
          const btn = item.querySelector('.btn-copy');
          const original = btn.innerHTML;
          btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:0.9rem;">check</span>';
          item.style.borderColor = 'var(--success)';
          setTimeout(() => {
            btn.innerHTML = original;
            item.style.borderColor = '';
          }, 1500);
        };
        gridSkills.appendChild(item);
      });

      // Copy All Skills
      btnCopyAllSkills.onclick = () => {
        const all = p.skills.join(', ');
        navigator.clipboard.writeText(all);
        const original = btnCopyAllSkills.innerHTML;
        btnCopyAllSkills.innerHTML = '<span class="material-symbols-outlined">check</span> Copied All';
        setTimeout(() => { btnCopyAllSkills.innerHTML = original; }, 2000);
      };
    } else {
       gridSkills.innerHTML = '<div class="apply-status-view">No skills found.</div>';
    }

    // 3. Experience (Jobs in sub-cards)
    if (p.experiences && p.experiences.length > 0) {
      p.experiences.forEach(exp => {
        const card = document.createElement('div');
        card.className = 'experience-card';
        card.innerHTML = `<div class="exp-header">${exp.position} at ${exp.company}</div>`;
        
        const f1 = createCopyField('Company', exp.company);
        const f2 = createCopyField('Position', exp.position);
        const f3 = createCopyField('Duration', `${exp.start_date} - ${exp.end_date || 'Present'}`);
        const f4 = createCopyField('Description', exp.description);
        
        [f1, f2, f3, f4].forEach(el => { if (el) card.appendChild(el); });
        gridExperience.appendChild(card);
      });
    }

    // 4. Education
    if (p.educations && p.educations.length > 0) {
      p.educations.forEach(edu => {
        const el = createCopyField(`${edu.degree} in ${edu.field_of_study}`, `${edu.institution} (${edu.start_date} - ${edu.end_date || 'Present'})`);
        if (el) gridEducation.appendChild(el);
      });
    }

    // 5. Certificates
    if (p.certificates && p.certificates.length > 0) {
      p.certificates.forEach(cert => {
        const val = typeof cert === 'string' ? cert : (cert.name || cert.title || JSON.stringify(cert));
        const el = createCopyField('Certificate', val);
        if (el) gridCertificates.appendChild(el);
      });
    }

    // 6. Other / Context Docs
    if (p.other && p.other.length > 0) {
      p.other.forEach(item => {
        const val = typeof item === 'string' ? item : (item.name || item.title || item.content || JSON.stringify(item));
        const el = createCopyField('Profile Note', val);
        if (el) gridOther.appendChild(el);
      });
    }

    if (contextDocs && contextDocs.length > 0) {
      contextDocs.forEach(doc => {
        const el = createCopyField('Context Document', doc.label || doc.filename);
        if (el) gridOther.appendChild(el);
      });
    }
  }

  function showApplyPicker() {
    applyJobPicker.style.display = 'flex';
    // If a job is already selected, allow closing the picker
    btnClosePicker.style.display = applySelectedJob ? 'block' : 'none';
    
    applySections.style.display = 'none';
    applyNoJob.style.display = 'none';
    fetchApplicationsForPicker();
  }

  async function fetchApplicationsForPicker() {
    applySearchResults.innerHTML = '<div class="apply-status-view"><div class="mini-spinner"></div></div>';
    try {
      const res = await fetch(`${API_URL}/api/applications`);
      if (!res.ok) throw new Error('Failed to fetch applications');
      let apps = await res.json();
      
      // Fetch ALL applications now
      renderPickerResults(apps);
    } catch (e) {
      applySearchResults.innerHTML = '<div class="apply-status-view">Error loading applications.</div>';
    }
  }

  function renderPickerResults(apps) {
    if (apps.length === 0) {
      applySearchResults.innerHTML = '<div class="apply-status-view">No applications found.</div>';
      return;
    }
    
    // Priority Sorting: Generated (w/ assets) > Saved > Others
    const sortedApps = [...apps].sort((a, b) => {
      const getPriority = (app) => {
        const hasAssets = app.tailored_resume_path || app.cover_letter_path;
        if (app.status === 'Generated' || hasAssets) return 1;
        if (app.status === 'Saved') return 2;
        return 3;
      };
      return getPriority(a) - getPriority(b);
    });

    applySearchResults.innerHTML = '';
    sortedApps.forEach(app => {
      const hasAssets = app.tailored_resume_path || app.cover_letter_path;
      const isPriority = app.status === 'Generated' || hasAssets || app.status === 'Saved';
      
      const item = document.createElement('div');
      item.className = `picker-item ${!isPriority ? 'picker-item-disabled' : ''}`;
      
      const logo = app.company_logo || `https://www.google.com/s2/favicons?domain=google.com&sz=64`;
      const status = app.status || 'Saved';
      const statusClass = `status-${status.toLowerCase()}`;

      item.innerHTML = `
        <img class="picker-item-logo" src="${logo}">
        <div class="picker-item-info">
          <div class="picker-item-header">
            <span class="picker-item-title">${app.job_title || 'Unknown Position'}</span>
            <span class="status-badge ${statusClass}" style="flex-shrink:0;">${status}</span>
          </div>
          <span class="picker-item-company">${app.company || 'Unknown Company'}</span>
        </div>
      `;
      item.onclick = () => loadApplyJob(app);
      applySearchResults.appendChild(item);
    });
  }

  btnChangeApp.addEventListener('click', () => {
    showApplyPicker();
  });

  btnClosePicker.addEventListener('click', () => {
    applyJobPicker.style.display = 'none';
    // If we had a job selected before opening the picker, restore its sections
    if (applySelectedJob) {
      applySections.style.display = 'flex';
      applyJobSummary.style.display = 'block';
    } else {
      applyNoJob.style.display = 'flex';
    }
  });
  function loadApplyJob(app) {
    applySelectedJob = app;
    applyJobPicker.style.display = 'none';
    applyNoJob.style.display = 'none';
    applySections.style.display = 'flex';
    btnChangeApp.style.display = 'flex';
    applyJobSummary.style.display = 'block';

    // Status & Header
    if (applyHeaderSubtitle) {
      applyHeaderSubtitle.style.display = 'none';
    }
    if (summaryStatusBadge) {
      const status = app.status || 'saved';
      summaryStatusBadge.textContent = status;
      summaryStatusBadge.className = `status-badge status-${status.toLowerCase()}`;
    }

    // Populate summary card
    summaryLogo.src = app.company_logo || `https://www.google.com/s2/favicons?domain=example.com&sz=64`;

    summaryTitle.textContent = app.job_title || 'Unknown Position';
    summaryCompany.textContent = app.company || 'Unknown Company';

    // Build meta tags
    summaryMeta.innerHTML = '';
    const tags = [
      { icon: 'calendar_today', label: 'Posted',  value: app.date_posted },
      { icon: 'history',        label: 'Created', value: app.created_at ? new Date(app.created_at).toLocaleDateString() : null },
      { icon: 'work',           label: 'Type',    value: app.job_type },
      { icon: 'location_on',    label: 'Loc',     value: app.location },
      { icon: 'distance',       label: 'Relo',    value: app.relocation },
      { icon: 'star',           label: 'Rank',    value: 'STARS', level: app.interest_level },
    ].filter(t => t.value === 'STARS' || (t.value && t.value !== 'null' && t.value !== 'Unknown'));

    tags.forEach(t => {
      const tagEl = document.createElement('div');
      tagEl.className = 'summary-tag';
      tagEl.title = `${t.label}: ${t.value === 'STARS' ? (t.level || 'Not Rated') : t.value}`;
      
      if (t.value === 'STARS') {
        const level = levelMap[t.level || ''] || 0;
        let starsHtml = '';
        for (let i = 1; i <= 3; i++) {
          starsHtml += `<span class="material-symbols-outlined" style="font-size: 0.9rem; color: ${i <= level ? '#fbbf24' : 'var(--text-muted)'}; font-variation-settings: 'FILL' ${i <= level ? 1 : 0};">star</span>`;
        }
        tagEl.innerHTML = starsHtml;
      } else {
        tagEl.innerHTML = `<span class="material-symbols-outlined">${t.icon}</span><span>${t.value}</span>`;
      }
      summaryMeta.appendChild(tagEl);
    });

    // Asset logic
    applyAssetsV2.innerHTML = '';
    
    const createAssetCard = (type, path) => {
      const card = document.createElement('div');
      card.className = 'asset-card';
      card.style.flexDirection = 'row';
      card.style.alignItems = 'center';
      card.style.justifyContent = 'space-between';
      
      const icon = type === 'Resume' ? '📄' : '✉️';
      
      if (path) {
        card.innerHTML = `
          <div class="asset-info">
            <div class="asset-icon">${icon}</div>
            <div class="asset-details">
              <strong>${type}</strong>
              <span>${path}</span>
            </div>
          </div>
          <div class="asset-actions">
            <button type="button" class="asset-btn btn-drag" draggable="true" title="Drag to upload">
              <span class="material-symbols-outlined" style="font-size: 1.1rem;">drag_pan</span>
            </button>
            <button type="button" class="asset-btn btn-download" title="Download">
              <span class="material-symbols-outlined" style="font-size: 1.1rem;">download</span>
            </button>
          </div>
        `;
        
        const btnDrag = card.querySelector('.btn-drag');
        const btnDownload = card.querySelector('.btn-download');
        
        btnDownload.onclick = () => handleAssetDownload(path);
        setupAssetDragging(btnDrag, () => path);
      } else {
        card.innerHTML = `
          <div class="asset-info">
            <div class="asset-icon">${icon}</div>
            <div class="asset-details" style="opacity:0.5">
              <strong>${type}</strong>
              <span>Not generated</span>
            </div>
          </div>
          <button type="button" class="btn btn-secondary btn-mini btn-gen" style="width:auto; padding:0 0.5rem">
            <span class="material-symbols-outlined">auto_fix_high</span> Generate
          </button>
        `;
        card.querySelector('.btn-gen').onclick = redirectToGeneration;
      }
      return card;
    };

    applyAssetsV2.appendChild(createAssetCard('Resume', app.tailored_resume_path));
    applyAssetsV2.appendChild(createAssetCard('Cover Letter', app.cover_letter_path));

    // Re-render profile items with the snapshot from THIS job
    if (app.profile_snapshot && app.profile_snapshot.profile) {
      renderProfileItems(app.profile_snapshot.profile, app.profile_snapshot.context_docs);
    } else {
      loadProfileInfo();
    }
  }


  applySearchInput.addEventListener('input', () => {
    const query = applySearchInput.value.toLowerCase();
    const items = applySearchResults.querySelectorAll('.picker-item');
    items.forEach(item => {
      const text = item.innerText.toLowerCase();
      item.style.display = text.includes(query) ? 'flex' : 'none';
    });
  });

  // ── Asset Handlers ────────────────────────────────────────────────────────
  function handleAssetDownload(filename) {
    if (!filename) return;
    // Prefer PDF for applying
    if (filename.toLowerCase().endsWith('.docx')) {
      filename = filename.replace(/\.docx$/i, '.pdf');
    }
    const url = `${API_URL}/api/documents/download/${filename}`;
    window.open(url, '_blank');
  }

  function setupAssetDragging(btn, getFilename) {
    btn.addEventListener('dragstart', (e) => {
      let filename = getFilename();
      if (!filename) {
        e.preventDefault();
        return;
      }
      
      // Prefer PDF for dragging onto applications
      if (filename.toLowerCase().endsWith('.docx')) {
        filename = filename.replace(/\.docx$/i, '.pdf');
      }
      
      const downloadUrl = `${API_URL}/api/documents/download/${filename}`;
      const mime = 'application/pdf';
      e.dataTransfer.setData('DownloadURL', `${mime}:${filename}:${downloadUrl}`);
      
      // Visual feedback
      e.dataTransfer.effectAllowed = 'copyMove';
    });
  }

  // ── Asset Handlers (Dynamic listeners now) ──────────────────────────────────

  // Generate logic
  function redirectToGeneration() {
    if (!applySelectedJob) return;
    // Construct simplified job data for re-processing
    const jobData = {
      id: applySelectedJob.id,
      title: applySelectedJob.job_title,
      company: applySelectedJob.company,
      description: applySelectedJob.job_description || applySelectedJob.description,
      link: applySelectedJob.job_url || applySelectedJob.link,
      jobType: applySelectedJob.job_type,
      location: applySelectedJob.location,
      salaryRange: applySelectedJob.salary_range,
      applyLink: applySelectedJob.apply_url || applySelectedJob.applyLink,
      interestLevel: applySelectedJob.interest_level,
      locationType: applySelectedJob.location_type,
      relocation: applySelectedJob.relocation,
      remarks: applySelectedJob.remarks,
      date_posted: applySelectedJob.date_posted
    };
    const payload = btoa(encodeURIComponent(JSON.stringify(jobData)));
    openOrFocusAppTab(`${APP_URL}/?processJob=${payload}#new_app`);
  }


  // Refresh logic
  btnRefresh.addEventListener('click', () => {
    window.location.reload();
  });

  // Global image error handler
  document.addEventListener('error', (e) => {
    if (e.target.tagName === 'IMG' && (e.target.id === 'summary-logo' || e.target.id === 'company-logo-img' || e.target.classList.contains('picker-item-logo'))) {
      e.target.src = 'https://www.google.com/s2/favicons?domain=example.com&sz=64';
    }
  }, true);

  // ── Field Copy Handlers ───────────────────────────────────────────────────
  document.querySelectorAll('.label-action-btn').forEach(btn => {
    btn.onclick = (e) => {
      const fieldId = btn.getAttribute('data-copy');
      const input = document.getElementById(fieldId);
      if (input) {
        const val = input.value;
        if (!val) return;

        navigator.clipboard.writeText(val);
        
        // Visual feedback
        const originalSvg = btn.innerHTML;
        btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
        btn.classList.add('copied');
        
        setTimeout(() => {
          btn.innerHTML = originalSvg;
          btn.classList.remove('copied');
        }, 1500);
      }
    };
  });
});
