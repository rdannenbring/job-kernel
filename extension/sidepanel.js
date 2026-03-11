document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const form = document.getElementById('job-form');
  const toggleDescBtn = document.getElementById('toggle-desc');
  const descContainer = document.getElementById('desc-container');
  const btnSave = document.getElementById('btn-save');
  const btnProcess = document.getElementById('btn-process');
  const statusMsg = document.getElementById('status-message');
  const loadingOverlay = document.getElementById('loading-overlay');
  const logoImg = document.getElementById('company-logo-img');
  const logoPlaceholder = document.getElementById('company-logo-placeholder');
  const logoFileInput = document.getElementById('logo-file-input');
  const logoEditBtn = document.getElementById('logo-edit-btn');

  const API_URL = 'http://localhost:8000';
  const APP_URL = 'http://localhost:5173';

  let loadingTimeout = null;

  // ── Tell background we're alive so it can track panel state ─────────────
  // Using a port keeps the connection alive and lets the background detect
  // when the panel is closed via the browser's native close button.
  const port = chrome.runtime.connect({ name: 'sidepanel' });
  chrome.storage.local.set({ isPanelOpen: true });
  window.addEventListener('unload', () => {
    chrome.storage.local.set({ isPanelOpen: false });
  });

  // ── Loading state ────────────────────────────────────────────────────────
  function showLoading() {
    loadingOverlay.classList.add('visible');
    loadingOverlay.setAttribute('aria-hidden', 'false');
    btnSave.disabled = true;
    btnProcess.disabled = true;
    clearTimeout(loadingTimeout);
    loadingTimeout = setTimeout(() => {
      console.warn('[JobAutomator] Loading timed out — hiding overlay.');
      hideLoading();
    }, 10000);
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

  // User-uploaded logo overrides the scraped one
  logoEditBtn.addEventListener('click', () => logoFileInput.click());

  logoFileInput.addEventListener('change', () => {
    const file = logoFileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => setLogo(e.target.result);
    reader.readAsDataURL(file);
  });

  // Also allow clicking directly on the logo area
  logoImg.addEventListener('click', () => logoFileInput.click());
  logoPlaceholder.addEventListener('click', () => logoFileInput.click());

  // ── Populate form from scraped data ──────────────────────────────────────
  const loadData = () => {
    chrome.storage.local.get(['latestJobData'], (result) => {
      if (result.latestJobData) {
        const data = result.latestJobData;

        document.getElementById('title').value = data.title || '';
        document.getElementById('company').value = data.company || '';
        document.getElementById('link').value = data.link || '';

        // Date: normalise to YYYY-MM-DD
        const dateEl = document.getElementById('datePosted');
        dateEl.value = '';
        if (data.datePosted) {
          try {
            const d = new Date(data.datePosted);
            if (!isNaN(d.getTime())) {
              dateEl.value = d.toISOString().split('T')[0];
            } else if (/^\d{4}-\d{2}-\d{2}$/.test(data.datePosted)) {
              dateEl.value = data.datePosted;
            }
          } catch (e) { /* leave blank */ }
        }

        const deadlineEl = document.getElementById('deadline');
        deadlineEl.value = '';
        if (data.deadline) {
          try {
            const d = new Date(data.deadline);
            if (!isNaN(d.getTime())) {
              deadlineEl.value = d.toISOString().split('T')[0];
            } else if (/^\d{4}-\d{2}-\d{2}$/.test(data.deadline)) {
              deadlineEl.value = data.deadline;
            }
          } catch (e) { /* leave blank */ }
        }

        document.getElementById('applyLink').value = data.applyLink || '';
        document.getElementById('salaryRange').value = data.salaryRange || '';
        document.getElementById('description').value = data.description || '';

        // Job Type — only set if a matching option exists
        const jobTypeEl = document.getElementById('jobType');
        jobTypeEl.value = jobTypeEl.querySelector(`option[value="${data.jobType}"]`) ? data.jobType : '';

        // Location Type — same
        const locationTypeEl = document.getElementById('locationType');
        locationTypeEl.value = locationTypeEl.querySelector(`option[value="${data.locationType}"]`) ? data.locationType : '';

        document.getElementById('location').value = data.location || '';
        document.getElementById('relocation').checked = data.relocation === true || data.relocation === 'true';

        // Company logo
        setLogo(data.companyLogo || null);
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
      title: document.getElementById('title').value,
      company: document.getElementById('company').value,
      companyLogo: currentLogoUrl,
      link: document.getElementById('link').value,
      applyLink: document.getElementById('applyLink').value,
      datePosted: document.getElementById('datePosted').value,
      deadline: document.getElementById('deadline').value,
      salaryRange: document.getElementById('salaryRange').value,
      description: document.getElementById('description').value,
      jobType: document.getElementById('jobType').value,
      locationType: document.getElementById('locationType').value,
      location: document.getElementById('location').value,
      relocation: document.getElementById('relocation').checked,
      interestLevel: document.getElementById('interestLevel').value,
      remarks: document.getElementById('remarks').value,
    };
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  btnSave.addEventListener('click', async () => {
    if (!form.checkValidity()) { form.reportValidity(); return; }

    const data = getFormData();
    btnSave.disabled = true;
    btnSave.textContent = 'Saving…';

    try {
      const res = await fetch(`${API_URL}/api/save-application`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_title: data.title,
          company: data.company,
          job_url: data.link,
          apply_url: data.applyLink,
          job_description: data.description,
          salary_range: data.salaryRange,
          date_posted: data.datePosted,
          deadline: data.deadline,
        }),
      });

      if (res.ok) {
        showStatus('Job listing saved successfully!', 'success');
        chrome.storage.local.remove('latestJobData');
      } else {
        const err = await res.json();
        showStatus(err.detail || 'Failed to save application', 'error');
      }
    } catch (e) {
      showStatus('Connection error. Is the backend running?', 'error');
    } finally {
      btnSave.disabled = false;
      btnSave.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>Save Listing`;
    }
  });

  // ── Process Immediately ───────────────────────────────────────────────────
  btnProcess.addEventListener('click', () => {
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const data = getFormData();
    const payload = btoa(encodeURIComponent(JSON.stringify(data)));
    chrome.tabs.create({ url: `${APP_URL}/?processJob=${payload}` });
  });
});
