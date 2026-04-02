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
  const btnMagicFill        = document.getElementById('btn-magic-fill');
  
  // LinkedIn Sync Elements
  const btnSyncLinkedin       = document.getElementById('btn-sync-linkedin');
  const btnViewNetwork        = document.getElementById('btn-view-network');
  const syncStatus            = document.getElementById('sync-status');
  const syncProgressContainer = document.getElementById('sync-progress-container');
  const syncProgress          = document.getElementById('sync-progress');

  const networkModal          = document.getElementById('network-modal');
  const networkModalClose     = document.getElementById('network-modal-close');
  const networkModalOverlay   = document.getElementById('network-modal-overlay');
  const networkList           = document.getElementById('network-list');
  const networkModalCount     = document.getElementById('network-modal-count');
  const networkEmpty           = document.getElementById('network-empty');
  const networkSearch          = document.getElementById('network-search');

  const btnRefresh          = document.getElementById('btn-refresh');
  const btnSettings         = document.getElementById('btn-settings');
  const btnSettingsBack     = document.getElementById('btn-settings-back');
  const settingsContainer   = document.getElementById('settings-container');
  const syncBanner          = document.getElementById('sync-banner');
  const btnGoSync           = document.getElementById('btn-go-sync');
  const bannerProgressContainer = document.getElementById('banner-progress-container');
  const bannerSyncStatus    = document.getElementById('banner-sync-status');
  const bannerSyncPercent   = document.getElementById('banner-sync-percent');
  const bannerProgressFill  = document.getElementById('banner-progress-fill');
  const syncLastTime        = document.getElementById('sync-last-time');
  const btnClearNetwork     = document.getElementById('btn-clear-network');
  
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
  
  const sideConnectionBanner = document.getElementById('side-connection-banner');
  const sideConnectionList   = document.getElementById('side-conn-list');
  const sideConnHeader       = document.getElementById('side-conn-header');
  const sideConnToggleIcon   = document.getElementById('side-conn-toggle-icon');
  const sideConnCountBadge   = document.getElementById('side-conn-count-badge');

  // Listing Source Elements
  const listingSourceContainer = document.getElementById('listing-source-container');
  const listingSourceLogo      = document.getElementById('listing-source-logo');
  const listingSourceName      = document.getElementById('listing-source-name');
  const listingSourceLink      = document.getElementById('listing-source-link');
  
  // Manual Parse Elements
  const btnManualParse      = document.getElementById('btn-manual-parse');
  const manualParseModal    = document.getElementById('manual-parse-modal');
  const manualParseClose    = document.getElementById('manual-parse-close');
  const manualParseOverlay  = document.getElementById('manual-parse-overlay');
  const btnDoManualParse    = document.getElementById('btn-do-manual-parse');
  const manualParseTextarea = document.getElementById('manual-parse-textarea');

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

  // ── Custom Dropdowns ──────────────────────────────────────────────────────
  function initCustomDropdowns() {
    document.querySelectorAll('.custom-dropdown').forEach(dropdown => {
      const trigger = dropdown.querySelector('.dropdown-trigger');
      const triggerText = trigger.querySelector('.trigger-text');
      const menu = dropdown.querySelector('.dropdown-menu');
      const options = dropdown.querySelectorAll('.dropdown-option');
      const nativeSelect = dropdown.querySelector('select');

      // Toggle dropdown open/close
      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = dropdown.classList.contains('open');
        // Close all other dropdowns
        document.querySelectorAll('.custom-dropdown.open').forEach(d => d.classList.remove('open'));
        if (!isOpen) dropdown.classList.add('open');
      });

      // Handle option selection
      options.forEach(option => {
        option.addEventListener('click', (e) => {
          e.stopPropagation();
          const val = option.getAttribute('data-value');
          const text = option.innerText;
          
          // Update trigger text
          triggerText.innerText = text;
          
          // Sync native select value
          nativeSelect.value = val;
          // Trigger change event for any listeners (like auto-saving)
          nativeSelect.dispatchEvent(new Event('change', { bubbles: true }));
          
          // Update active class on options
          options.forEach(o => o.classList.remove('selected'));
          option.classList.add('selected');
          
          // Close dropdown
          dropdown.classList.remove('open');
        });
      });
    });

    // Close on click outside
    document.addEventListener('click', () => {
      document.querySelectorAll('.custom-dropdown.open').forEach(d => d.classList.remove('open'));
    });
  }

  initCustomDropdowns();

  // ── Mode Switching ────────────────────────────────────────────────────────
  let currentMode = 'details';

  function setMode(mode) {
    currentMode = mode;
    
    // Hide all main containers
    detailsContainer.style.display = 'none';
    applyContainer.style.display = 'none';
    settingsContainer.style.display = 'none';
    applyJobPicker.style.display = 'none';
    footerActions.style.display = 'none';
    savedBanner.style.display = 'none';
    btnChangeApp.style.display = 'none';

    if (mode === 'apply') {
      detailsModeBtn.classList.remove('active');
      applyModeBtn.classList.add('active');
      applyContainer.style.display = 'flex';
      btnChangeApp.style.display = applySelectedJob ? 'flex' : 'none';
      initApplyMode();
      triggerMagicScan();
    } else if (mode === 'details') {
      applyModeBtn.classList.remove('active');
      detailsModeBtn.classList.add('active');
      detailsContainer.style.display = 'block';
      footerActions.style.display = 'flex';
      savedBanner.style.display = ''; 
    } else if (mode === 'settings') {
      settingsContainer.style.display = 'block';
      detailsModeBtn.classList.remove('active');
      applyModeBtn.classList.remove('active');
    }
  }

  btnManualParse.addEventListener('click', () => {
    manualParseModal.classList.add('visible');
    manualParseModal.setAttribute('aria-hidden', 'false');
    manualParseTextarea.focus();
  });

  const closeManualParse = () => {
    manualParseModal.classList.remove('visible');
    manualParseModal.setAttribute('aria-hidden', 'true');
    manualParseTextarea.value = '';
  };

  manualParseClose.addEventListener('click', closeManualParse);
  manualParseOverlay.addEventListener('click', closeManualParse);

  btnDoManualParse.addEventListener('click', async () => {
    const text = manualParseTextarea.value.trim();
    if (!text) return;

    try {
      showLoading('Parsing job description...', 'This may take a few seconds');
      closeManualParse(); // Close modal while processing

      const response = await fetch(`${API_URL}/api/analyze-job`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_description: text })
      });

      if (!response.ok) throw new Error('Parsing failed');
      
      const data = await response.json();
      if (data.success && data.analysis) {
        const metadata = data.analysis.metadata || {};
        
        // Map AI metadata to our form fields
        const parsedData = {
          title: metadata.job_title || '',
          company: metadata.company || '',
          location: metadata.location || '',
          locationType: metadata.location_type || '',
          jobType: metadata.job_type || '',
          salaryRange: metadata.salary_range || '',
          datePosted: metadata.date_posted || '',
          deadline: metadata.deadline || '',
          description: text,
          url: window.location.href
        };

        populateForm(parsedData);
        
        // Ensure the description is set (using explicit reference to avoids global scope issues)
        const descEl = document.getElementById('description');
        if (descEl) {
          descEl.value = text;
          // Open the container so the user sees it's filled
          if (descContainer) {
            descContainer.classList.add('open');
            toggleDescBtn.classList.add('active'); // Update the button visual too if it has an active state
          }
        }
        
        // Auto-fetch logo if company was found
        if (parsedData.company) {
          fetchAndSetCompanyLogo(parsedData.company);
        }
      }
    } catch (err) {
      console.error('Manual parse error:', err);
      showAlert('Error parsing job description. Please try again or fill manually.', 'error');
    } finally {
      hideLoading();
    }
  });

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

  btnSettings.addEventListener('click', () => setMode('settings'));
  btnSettingsBack.addEventListener('click', () => setMode('details'));
  btnGoSync.addEventListener('click', () => {
    btnGoSync.disabled = true;
    btnGoSync.textContent = 'Syncing...';
    startSync();
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
    const options = Array.from(el.options);
    const match = options.find(opt => opt.value.toLowerCase() === val.toLowerCase());
    const finalVal = match ? match.value : '';
    el.value = finalVal;

    // Now sync the custom UI if it exists
    const dropdown = el.closest('.custom-dropdown');
    if (dropdown) {
      const triggerText = dropdown.querySelector('.trigger-text');
      const customOptions = dropdown.querySelectorAll('.dropdown-option');
      
      const matchedOpt = Array.from(customOptions).find(o => o.getAttribute('data-value').toLowerCase() === finalVal.toLowerCase());
      if (matchedOpt) {
        triggerText.innerText = matchedOpt.innerText;
        customOptions.forEach(o => o.classList.remove('selected'));
        matchedOpt.classList.add('selected');
      } else {
        // Fallback to first option if no match
        const firstOpt = customOptions[0];
        if (firstOpt) {
          triggerText.innerText = firstOpt.innerText;
          customOptions.forEach(o => o.classList.remove('selected'));
          firstOpt.classList.add('selected');
        }
      }
    }
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
    const currentDesc = document.getElementById('description').value;
    const newDesc = data.description || data.job_description || '';
    // Don't overwrite an existing description with an empty one during silent/background refreshes,
    // unless we are populating from an explicit app record (which may have 'job_description' property)
    if (newDesc || (data.id && data.date_saved)) {
       document.getElementById('description').value = newDesc;
    }
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

    // Listing Source Indicator
    const listingURL = data.link || data.job_url || '';
    if (listingSourceContainer) listingSourceContainer.style.display = 'flex';
    
    // Helper to hide/show source-specific parts
    function updateSourceVisibility(visible) {
      if (listingSourceName) listingSourceName.style.display = visible ? 'inline' : 'none';
      if (listingSourceLogo) listingSourceLogo.style.display = visible ? 'inline' : 'none';
      if (listingSourceLink) listingSourceLink.style.display = visible ? 'flex' : 'none';
      const sourceLabel = document.querySelector('.source-label');
      if (sourceLabel) sourceLabel.style.display = visible ? 'inline' : 'none';
    }

    if (listingURL) {
      try {
        const urlObj = new URL(listingURL);
        let hostname = urlObj.hostname.replace(/^www\./i, ''); // Strip leading www.
        
        // Try to identify the core brand name
        let siteName = hostname.split('.')[0];
        
        // Attempt a few known platforms explicitly to handle complex domains
        if (hostname.includes('linkedin.com')) siteName = 'LinkedIn';
        else if (hostname.includes('indeed.com')) siteName = 'Indeed';
        else if (hostname.includes('glassdoor.com')) siteName = 'Glassdoor';
        else if (hostname.includes('ziprecruiter.com')) siteName = 'ZipRecruiter';
        else siteName = siteName.charAt(0).toUpperCase() + siteName.slice(1);
        
        if (listingSourceName) listingSourceName.textContent = siteName;
        if (listingSourceLogo) listingSourceLogo.src = `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
        
        updateSourceVisibility(true);

        if (listingSourceLink) {
          listingSourceLink.onclick = () => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
              const currentTabUrl = tabs[0]?.url || '';
              if (currentTabUrl.includes(listingURL) || currentTabUrl.includes(urlObj.pathname)) {
                alert('You are currently viewing this job listing.');
              } else {
                openOrFocusListingTab(listingURL);
              }
            });
          };
        }
      } catch (e) {
        updateSourceVisibility(false);
      }
    } else {
      updateSourceVisibility(false);
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

  // Intelligently open or focus an existing Job Listing tab.
  function openOrFocusListingTab(targetUrl) {
    const targetUrlObj = new URL(targetUrl);
    const targetHost = targetUrlObj.hostname.replace(/^www\./i, '');

    chrome.tabs.query({}, (tabs) => {
      let existingTab = null;
      
      if (tabs) {
        existingTab = tabs.find(tab => {
          try {
            const tabUrlObj = new URL(tab.url);
            const tabHost = tabUrlObj.hostname.replace(/^www\./i, '');
            if (tabHost !== targetHost) return false;

            // Direct match of Path + Query is solid
            if (tabUrlObj.pathname === targetUrlObj.pathname && tabUrlObj.search === targetUrlObj.search) {
              return true;
            }

            // Fuzzy match for SPAs like LinkedIn that use query IDs
            const tId = targetUrlObj.searchParams.get('currentJobId') || targetUrlObj.pathname.match(/\d{7,}/)?.[0];
            const pId = tabUrlObj.searchParams.get('currentJobId') || tabUrlObj.pathname.match(/\d{7,}/)?.[0];
            
            if (tId && pId && tId === pId) return true;

            // Fallback: match pathname if no ID logic applied
            return (tabUrlObj.pathname === targetUrlObj.pathname) && tabUrlObj.pathname.length > 1;
          } catch (e) {
            return false;
          }
        });
      }

      if (existingTab) {
        // We found an exact matching job tab — focus its window and make it active
        chrome.windows.update(existingTab.windowId, { focused: true });
        chrome.tabs.update(existingTab.id, { active: true });
      } else {
        // Spawn a new tab
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
 
               // Intelligent syncing: If we just found a matching record for the current page,
               // ensure the Apply mode is synced to this job too.
               if (currentMode === 'apply' || !applySelectedJob) {
                 applySelectedJob = appRecord;
                 if (currentMode === 'apply') {
                   loadApplyJob(appRecord);
                 }
               }
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

             // Always Check for LinkedIn Connections for the current job
             checkLinkedInConnections(appRecord || scrapedData);
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
 
   // ── LinkedIn Network Connections Matching ───────────────────────────────
   const checkLinkedInConnections = async (data) => {
     if (!data) {
       sideConnectionBanner.style.display = 'none';
       return;
     }
 
     // Extract company name and ID
     const companyName = data.company || data.job_title_company || '';
     // For app records, we don't store company_id yet in the applications table, 
     // but we can try to get it from scrapedData if available.
     const companyId = data.link ? extractCompanyId(data.link) : null;
 
     if (!companyName && !companyId) {
       sideConnectionBanner.style.display = 'none';
       return;
     }
 
     try {
       // Try ID matching first if available
       let matches = [];
       if (companyId) {
         const res = await fetch(`${API_URL}/api/linkedin/matches/${companyId}`);
         const result = await res.json();
         matches = result.matches || [];
       }
 
       // If no ID matches or no ID, try Name matching
       if (matches.length === 0 && companyName) {
         const res = await fetch(`${API_URL}/api/linkedin/matches/name/${encodeURIComponent(companyName)}`);
         const result = await res.json();
         matches = result.matches || [];
       }
 
       renderSideConnections(matches);
     } catch (err) {
       console.error('[JobAutomator] Error checking connections in sidepanel:', err);
       sideConnectionBanner.style.display = 'none';
     }
   };
 
   function extractCompanyId(url) {
     if (!url) return null;
     const m = url.match(/\/company\/([^/?#]+)/);
     return m ? m[1] : null;
   }
 
   function renderSideConnections(matches) {
     if (!matches || matches.length === 0) {
       sideConnectionBanner.style.display = 'none';
       return;
     }
 
     sideConnectionList.innerHTML = '';
     matches.forEach(conn => {
       const item = document.createElement('a');
       item.className = 'side-conn-item';
       item.href = conn.profile_url;
       item.target = '_blank';
       
       const initials = conn.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
       
       item.innerHTML = `
         <div class="side-conn-avatar">${initials}</div>
         <div class="side-conn-info">
           <div class="side-conn-name">${conn.name}</div>
           <div class="side-conn-headline">${conn.headline || ''}</div>
         </div>
       `;
       
       sideConnectionList.appendChild(item);
     });
 
     sideConnectionBanner.style.display = 'block';

    if (sideConnCountBadge) {
      sideConnCountBadge.textContent = matches.length;
      sideConnCountBadge.style.display = 'inline-flex';
    }
    
    if (sideConnectionList) {
      const shouldExpand = matches.length <= 3;
      sideConnectionList.style.display = shouldExpand ? 'flex' : 'none';
      if (sideConnToggleIcon) {
        sideConnToggleIcon.style.transform = shouldExpand ? 'rotate(180deg)' : 'rotate(0deg)';
      }
      if (sideConnHeader) {
        sideConnHeader.onclick = () => {
          const isCollapsed = sideConnectionList.style.display === 'none';
          sideConnectionList.style.display = isCollapsed ? 'flex' : 'none';
          if (sideConnToggleIcon) {
             sideConnToggleIcon.style.transform = isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)';
          }
        };
      }
    }
   }
 
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
    } else if (message.action === 'LINKEDIN_SYNC_PROGRESS') {
      updateSyncStatus(message.progress, message.message);
    } else if (message.action === 'LINKEDIN_SYNC_COMPLETE') {
      finishSync(message.count);
    } else if (message.action === 'LINKEDIN_SYNC_ERROR') {
      failSync(message.error);
    }
  });

  function startSync() {
    btnSyncLinkedin.classList.add('syncing');
    syncStatus.textContent = 'Preparing sync...';
    syncProgressContainer.style.display = 'block';
    syncProgress.style.width = '0%';
    
    // If banner is showing, initialize its progress UI
    if (syncBanner.style.display !== 'none') {
      bannerProgressContainer.style.display = 'block';
      bannerProgressFill.style.width = '0%';
      bannerSyncStatus.textContent = 'Preparing...';
      bannerSyncPercent.textContent = '0%';
      btnGoSync.textContent = 'Syncing...';
      btnGoSync.disabled = true;
    }

    chrome.runtime.sendMessage({ action: 'START_LINKEDIN_SYNC' });
  }

  // LinkedIn Sync logic
  if (btnSyncLinkedin) {
    btnSyncLinkedin.onclick = startSync;
  }

  function updateSyncStatus(percent, message) {
    syncProgressContainer.style.display = 'block';
    syncProgress.style.width = `${percent}%`;
    syncStatus.textContent = message || `Syncing network (${percent}%)...`;
    btnSyncLinkedin.classList.add('syncing');

    if (syncBanner.style.display !== 'none') {
      bannerProgressContainer.style.display = 'block';
      bannerProgressFill.style.width = `${percent}%`;
      bannerSyncPercent.textContent = `${percent}%`;
      if (message) bannerSyncStatus.textContent = message;
      btnGoSync.textContent = `${percent}%`;
    }
  }

  function finishSync(count) {
    btnSyncLinkedin.classList.remove('syncing');
    syncStatus.textContent = `Success! Mirrored ${count} connections.`;
    syncProgress.style.width = '100%';
    btnViewNetwork.style.display = 'flex';
    
    // Update last sync time
    const timeStr = new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
    syncLastTime.textContent = `Last synced: ${timeStr}`;

    // Update banner with success message and settings hint
    if (syncBanner.style.display !== 'none') {
      const bannerText = syncBanner.querySelector('.alert-content p');
      if (bannerText) {
        bannerText.textContent = `Success! Mirrored ${count} connections. Re-sync anytime via the gear icon.`;
        btnGoSync.style.display = 'none';
        bannerProgressContainer.style.display = 'none'; // Hide progress after success
        
        // Auto-hide banner after 10 seconds since it's now success info
        setTimeout(() => {
          syncBanner.style.opacity = '0';
          setTimeout(() => {
            syncBanner.style.display = 'none';
            syncBanner.style.opacity = '1'; 
          }, 500);
        }, 10000);
      }
    }

    setTimeout(() => {
      syncProgressContainer.style.display = 'none';
    }, 3000);
  }

  function failSync(error) {
    btnSyncLinkedin.classList.remove('syncing');
    syncStatus.textContent = `Sync failed: ${error}`;
    syncProgress.style.background = 'var(--error)';
  }

  // Network Modal logic
  btnViewNetwork.addEventListener('click', () => {
    networkModal.classList.add('visible');
    networkModal.setAttribute('aria-hidden', 'false');
    fetchNetwork();
  });

  const closeNetworkModal = () => {
    networkModal.classList.remove('visible');
    networkModal.setAttribute('aria-hidden', 'true');
  };

  networkModalClose.addEventListener('click', closeNetworkModal);
  networkModalOverlay.addEventListener('click', closeNetworkModal);

  async function fetchNetwork() {
    try {
      networkList.innerHTML = '<div class="network-empty-state">Loading network...</div>';
      networkModalCount.textContent = 'Fetching connection list...';
      
      const response = await fetch(`${API_URL}/api/linkedin/debug?limit=500`);
      if (!response.ok) throw new Error('Failed to fetch network data');
      
      const data = await response.json();
      renderNetwork(data.connections || []);
      networkModalCount.textContent = `${data.total_count || 0} connections stored locally`;
    } catch (err) {
      console.error('[LinkedInSync] Fetch Error:', err);
      networkList.innerHTML = `<div class="network-empty-state" style="color:var(--error)">${err.message}</div>`;
    }
  }

  function renderNetwork(connections) {
    if (connections.length === 0) {
      networkList.innerHTML = '';
      networkEmpty.style.display = 'block';
      return;
    }
    
    networkEmpty.style.display = 'none';
    networkList.innerHTML = connections.map(c => `
      <a href="${c.profile_url}" target="_blank" class="network-item">
        <div class="network-avatar">
          <span class="material-symbols-outlined">person</span>
        </div>
        <div class="network-item-info">
          <span class="network-item-name">${c.name}</span>
          <span class="network-item-headline">${c.headline || ''}</span>
          ${c.company_name ? `<span class="network-item-company">${c.company_name}</span>` : ''}
        </div>
      </a>
    `).join('');
  }

  networkSearch.addEventListener('input', () => {
    const query = networkSearch.value.toLowerCase();
    const items = networkList.querySelectorAll('.network-item');
    items.forEach(item => {
      const text = item.innerText.toLowerCase();
      item.style.display = text.includes(query) ? 'flex' : 'none';
    });
  });

  async function checkNetworkStatus() {
    try {
      // 1. Check DB for existing connections
      const dbRes = await fetch(`${API_URL}/api/linkedin/debug?limit=1`);
      if (dbRes.ok) {
        const dbData = await dbRes.json();
        if (dbData.total_count > 0) {
          btnViewNetwork.style.display = 'flex';
          syncStatus.textContent = `Mirrored ${dbData.total_count} connections.`;
          syncBanner.style.display = 'none';

          if (dbData.connections && dbData.connections.length > 0) {
            const lastSync = new Date(dbData.connections[0].last_synced);
            syncLastTime.textContent = `Last synced: ${lastSync.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}`;
          }
        } else {
          // No connections yet - show encouragement banner
          syncBanner.style.display = 'flex';
          syncBanner.querySelector('.alert-content p').textContent = 'Mirror your LinkedIn network to find connections at jobs you view.';
          btnGoSync.textContent = 'Sync Now';
          btnGoSync.style.display = 'block';
          btnGoSync.disabled = false;
          bannerProgressContainer.style.display = 'none';
          syncLastTime.textContent = 'Not synced yet';
        }
      }

      // 2. Check if a sync is currently running in the background
      chrome.runtime.sendMessage({ action: 'GET_SYNC_STATUS' }, (status) => {
        if (status && status.isSyncing) {
            console.log('[LinkedInSync] Reconnecting to active sync...');
            btnSyncLinkedin.classList.add('syncing');
            syncProgressContainer.style.display = 'block';
            syncProgress.style.width = `${status.progress}%`;
            syncStatus.textContent = status.message || 'Syncing network...';
            
            // If banner is currently shown, also update its progress UI
            if (syncBanner.style.display !== 'none') {
              bannerProgressContainer.style.display = 'block';
              bannerProgressFill.style.width = `${status.progress}%`;
              bannerSyncPercent.textContent = `${status.progress}%`;
              if (status.message) bannerSyncStatus.textContent = status.message;
              btnGoSync.textContent = `${status.progress}%`;
              btnGoSync.disabled = true;
            } else {
              // Only hide the banner if it wasn't already being used for a sync-in-place
              // (This handles the case where sync was started from Settings but we're now on Details)
              // syncBanner.style.display = 'none'; 
            }
        }
      });
    } catch (err) {
      console.warn('[LinkedInSync] Initial status check failed:', err);
    }
  }

  btnClearNetwork.onclick = async () => {
    if (!confirm('Are you sure you want to clear all mirrored LinkedIn connections? This cannot be undone.')) return;
    
    try {
      const res = await fetch(`${API_URL}/api/linkedin/purge`, { method: 'DELETE' });
      if (res.ok) {
        syncStatus.textContent = 'Mirror your 1st-degree connections';
        btnViewNetwork.style.display = 'none';
        showStatus('Network data cleared successfully.', 'success');
        checkNetworkStatus(); // This will trigger the sync banner to show
      }
    } catch (err) {
      console.error('[LinkedInSync] Clear failed:', err);
      showStatus('Failed to clear network data.', 'error');
    }
  };

  checkNetworkStatus();

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
    // 1. Intelligent Default: If details panel found a matching record for THIS page, use it.
    if (currentAppRecord) {
      loadApplyJob(currentAppRecord);
    } 
    // 2. Persistence: If no match on current page, but we already have a job selected in Apply mode, keep it.
    else if (applySelectedJob) {
      loadApplyJob(applySelectedJob);
    }
    // 3. Fallback: Show the picker
    else {
      btnChangeApp.style.display = 'none';
      applyJobSummary.style.display = 'none';
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
        <button type="button" class="field-copy-btn" style="margin-right: 6px;">
          <span class="material-symbols-outlined" style="font-size: 1rem;">content_copy</span>
        </button>
        <span class="field-title">${label}</span>
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
    // Always show close button so user can cancel
    btnClosePicker.style.display = 'block';
    
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
    // If we have a job selected, restore the apply view
    if (applySelectedJob) {
      applySections.style.display = 'flex';
      applyJobSummary.style.display = 'block';
    } else {
      // If no job selected and they closed the picker, they likely clicked Apply by mistake
      // Switch them back to Details mode
      setMode('details');
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

    // Automatically trigger magic fill scan when a job is loaded
    triggerMagicScan();
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

  // ── Magic Fill ────────────────────────────────────────────────────────────

  async function triggerMagicScan() {
    if (currentMode !== 'apply' || !applySelectedJob) return;

    let p = null;
    if (applySelectedJob.profile_snapshot && applySelectedJob.profile_snapshot.profile) {
      p = JSON.parse(JSON.stringify(applySelectedJob.profile_snapshot.profile));
    } else {
      try {
        const res = await fetch(`${API_URL}/api/profile`);
        p = await res.json();
      } catch (e) {
        console.error('[JobAutomator] Error fetching profile for magic scan:', e);
      }
    }

    if (!p) return;

    // Prepare profile for matching
    p.address = [p.address_line1, p.address_line2].filter(Boolean).join(', ');
    p.location = (p.city && p.state) ? `${p.city}, ${p.state}` : (p.city || p.state || '');
    p.full_name = p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim();

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url && !tab.url.startsWith('chrome://')) {
      chrome.tabs.sendMessage(tab.id, { 
        action: 'start_magic_fill', 
        profile: p
      }).catch(() => {
        // Content script might not be loaded yet or on protected page
      });
    }
  }

  // Handle manual re-scan
  if (btnMagicFill) {
    btnMagicFill.onclick = triggerMagicScan;
  }

  // Also trigger scan when the user navigates to a new page while in Apply mode
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.active) {
      triggerMagicScan();
    }
  });
});
