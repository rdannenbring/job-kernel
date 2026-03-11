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
  const savedBanner = document.getElementById('saved-banner');
  const savedBannerStatus = document.getElementById('saved-banner-status');
  const savedBannerLink = document.getElementById('saved-banner-link');
  const readonlyNotice = document.getElementById('readonly-notice');
  const btnSaveLabel    = document.getElementById('btn-save-label');
  const btnProcessLabel = document.getElementById('btn-process-label');

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

  // ── Loading state ────────────────────────────────────────────────────────
  function showLoading(title = 'Detecting New Job', subtitle = 'Reading the job listing\u2026') {
    loadingTitle.textContent    = title;
    loadingSubtitle.textContent = subtitle;
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
    const reader = new FileReader();
    reader.onload = (e) => setLogo(e.target.result);
    reader.readAsDataURL(file);
  });

  logoImg.addEventListener('click', () => logoFileInput.click());
  logoPlaceholder.addEventListener('click', () => logoFileInput.click());

  // ── Interest level toggles ────────────────────────────────────────────────
  const toggleBtns = document.querySelectorAll('.toggle-btn');
  const interestInput = document.getElementById('interestLevel');

  toggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      toggleBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      interestInput.value = btn.dataset.value;
    });
  });

  // ── Interest level helpers ────────────────────────────────────────────────
  function setInterest(value) {
    toggleBtns.forEach(b => b.classList.remove('active'));
    if (value) {
      const match = document.querySelector(`.toggle-btn[data-value="${value}"]`);
      if (match) match.classList.add('active');
    }
    interestInput.value = value || '';
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
    const jobTypeEl = document.getElementById('jobType');
    const jt = data.jobType || data.job_type || '';
    jobTypeEl.value = jobTypeEl.querySelector(`option[value="${jt}"]`) ? jt : '';

    // Location Type
    const locationTypeEl = document.getElementById('locationType');
    const lt = data.locationType || data.location_type || '';
    locationTypeEl.value = locationTypeEl.querySelector(`option[value="${lt}"]`) ? lt : '';

    // Remarks
    document.getElementById('remarks').value = data.remarks || '';

    // Interest level
    setInterest(data.interestLevel || data.interest_level || '');

    // Company logo — prefer app record logo over scraped
    setLogo(data.companyLogo || data.company_logo || null);
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


  // ── Show the "already saved" banner ──────────────────────────────────────
  function showSavedBanner(appRecord) {
    savedBannerStatus.textContent = appRecord.status || 'Saved';
    // The app uses hash routing — link to dashboard where the user can find the record
    savedBannerLink.href = `${APP_URL}/#dashboard`;
    savedBannerLink.title = `View "${appRecord.job_title}" in the app`;
    savedBanner.style.display = 'flex';
  }

  function hideSavedBanner() {
    savedBanner.style.display = 'none';
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


  // ── Check if job URL is already in the database ───────────────────────────
  async function checkExistingApplication(jobUrl) {
    if (!jobUrl) return null;
    try {
      const res = await fetch(`${API_URL}/api/check-job-url?url=${encodeURIComponent(jobUrl)}`);
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

  // ── Populate form from scraped data ──────────────────────────────────────
  const loadData = async () => {
    chrome.storage.local.get(['latestJobData'], async (result) => {
      if (result.latestJobData) {
        scrapedData = result.latestJobData;

        // Check if a matching application already exists in the DB
        const jobUrl = scrapedData.link || scrapedData.job_url || '';
        const appRecord = jobUrl ? await checkExistingApplication(jobUrl) : null;

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
        }
      }

      hideLoading();
    });
  };

  loadData();

  // ── Message listener ──────────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'job_loading') {
      showLoading();
    } else if (message.action === 'refresh_panel_data') {
      loadData();
    } else if (message.action === 'do_window_close') {
      window.close();
    }
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
      showLoading('Updating Application', 'Saving changes to the backend\u2026');
      try {
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
          }),
        });

        if (res.ok) {
          showStatus('Updated!', 'success');
          // Refresh the local record and remove diff highlights
          const updated = await checkExistingApplication(data.link);
          if (updated) {
            currentAppRecord = updated;
            applyDiffHighlights(updated, scrapedData);
          }
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
      showLoading('Saving Application', 'Sending your data to the backend\u2026');
      try {
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
          }),
        });

        if (res.ok) {
          showStatus('Saved!', 'success');
          chrome.storage.local.remove('latestJobData');
          // Show the banner for the newly saved record
          const saved = await checkExistingApplication(data.link);
          if (saved) {
            currentAppRecord = saved;
            showSavedBanner(saved);
            applyStatusRules(saved.status);
          }
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
    const payload = btoa(encodeURIComponent(JSON.stringify(data)));
    chrome.tabs.create({ url: `${APP_URL}/?processJob=${payload}` });
  });
});
