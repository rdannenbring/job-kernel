// ─── Utility helpers ────────────────────────────────────────────────────────

/**
 * Try a list of CSS selectors in order, return the trimmed innerText of the
 * first one that resolves to a non-empty value.
 */
function firstMatch(selectors, root = document) {
  for (const sel of selectors) {
    const el = root.querySelector(sel);
    const text = el?.innerText?.trim();
    if (text) return text;
  }
  return null;
}

/**
 * Walk all leaf text nodes in the document. Return an array of
 * { el, text, cls } objects whose text satisfies the predicate.
 */
function findLeafText(predicate, limit = 20, root = document.body) {
  const results = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let node;
  while ((node = walker.nextNode()) && results.length < limit) {
    if (node.children.length === 0) {
      const text = node.innerText?.trim();
      if (text && predicate(text)) {
        results.push({ el: node, text, cls: node.className || '' });
      }
    }
  }
  return results;
}

const getLIRoot = () => document.querySelector('.jobs-search__job-details--container') 
  || document.querySelector('.job-view-layout') 
  || document.querySelector('.jobs-details')
  || document;

// ─── LinkedIn scraper ────────────────────────────────────────────────────────
//
// LinkedIn's authenticated job-search page (/jobs/search?currentJobId=…)
// renders a right-side details pane using the "unified top card" component.
// The DOM structure changes often; we use multiple selector strategies and
// fall through gracefully.

const LINKEDIN_SCRAPER = {
  isJobPage: () => {
    const p = window.location.pathname;
    const hasCurrentJobId = new URLSearchParams(window.location.search).has('currentJobId');
    return (p.includes('/jobs/view') || p.includes('/jobs/search') || p.includes('/jobs/collections') || hasCurrentJobId) ||
      !!document.querySelector('.jobs-details') ||
      !!document.querySelector('[class*="jobs-unified-top-card"]') ||
      !!document.querySelector('[class*="job-details-jobs-unified-top-card"]');
  },

  title: () => firstMatch([
    '.job-details-jobs-unified-top-card__job-title h1',
    '.jobs-unified-top-card__job-title h1',
    'h1.top-card-layout__title',
    'h1[class*="job-title"]',
    'h1',
  ], getLIRoot()),

  company: () => firstMatch([
    '.job-details-jobs-unified-top-card__company-name a',
    '.job-details-jobs-unified-top-card__company-name',
    '.jobs-unified-top-card__company-name a',
    '.jobs-unified-top-card__company-name',
    '.topcard__org-name-link',
    '[class*="company-name"] a',
    '[class*="company-name"]',
  ], getLIRoot()),

  /**
   * Extract the city/state location from the unified top card.
   *
   * LinkedIn's primary-description row typically looks like:
   *   "Figma · New York, NY (Hybrid) · 3 weeks ago · Over 200 applicants"
   * or in tvm__text spans:
   *   [span "New York, NY"] [span "(Hybrid)"] [span "3 weeks ago"]
   */
  location: () => {
    const root = getLIRoot();
    const explicitLoc = document.querySelector('.job-details-jobs-unified-top-card__location');
    if (explicitLoc?.innerText?.trim()) return explicitLoc.innerText.trim();

    // Strategy 2: parse the primary-description row
    const primaryDesc = root.querySelector('[class*="primary-description"]');

    if (primaryDesc) {
      const parts = Array.from(primaryDesc.querySelectorAll('span, a'))
        .map(s => s.innerText?.trim())
        .filter(t => t && t !== '·' && !t.startsWith('·') && !t.endsWith('·'));

      for (const part of parts) {
        if (/\d+\s+(week|day|month|hour|minute)/i.test(part)) continue;
        if (/applicant|follower|employee|alumni/i.test(part)) continue;
        if (/hybrid|remote|on-site|onsite/i.test(part)) continue;
        if (part.includes(',') || /^[A-Z][a-zA-Z\s]+$/.test(part)) return part;
      }
      if (parts.length > 0) return parts[0];
      
      const text = primaryDesc.innerText || '';
      const split = text.split('·');
      if (split.length >= 2) {
          const loc = split[1].replace(/\((remote|hybrid|on-site)\)/gi, '').trim();
          if (loc && !/\d/.test(loc)) return loc;
      }
    }
    
    // Strategy 3: any generic text node mapping to city/state in the top card
    const topCard = root.querySelector('[class*="unified-top-card"], [class*="job-details"]');
    if (topCard) {
        const textNodes = findLeafText(t => t.includes(',') && !/\d/.test(t) && t.length < 50, 15, topCard);
        for (const node of textNodes) {
          // If it smells like a location (e.g. San Francisco, CA)
          if (/^[a-zA-Z\s]+,\s*[A-Z]{2,}$/.test(node.text) || /^[a-zA-Z\s]+,\s*[a-zA-Z\s]+$/.test(node.text)) {
              return node.text;
          }
        }
    }

    return null;
  },

  /**
   * Extract the workplace type (Remote / Hybrid / On-site) separately from location.
   */
  workplaceType: () => {
    // Strategy 1: dedicated element
    const badge = firstMatch([
      '.job-details-jobs-unified-top-card__workplace-type',
      '.jobs-unified-top-card__workplace-type',
      '[class*="workplace-type"]',
    ], getLIRoot());
    if (badge) return badge;

    // Strategy 2: look for parenthetical in location text e.g. "(Hybrid)"
    const root = getLIRoot();
    const bullet = root.querySelector(
      '.job-details-jobs-unified-top-card__bullet, .jobs-unified-top-card__bullet'
    );
    if (bullet) {
      const m = bullet.innerText?.match(/\((remote|hybrid|on-site)\)/i);
      if (m) return m[1];
    }

    // Strategy 3: scan the top-card area for standalone work-type tokens
    const topCard =
      root.querySelector('[class*="unified-top-card"]') ||
      root.querySelector('[class*="jobs-details"]');

    if (topCard) {
      const spans = topCard.querySelectorAll('span');
      for (const span of spans) {
        const t = span.innerText?.trim();
        if (t && /^(remote|hybrid|on-site)$/i.test(t)) return t;
      }
    }

    return null;
  },

  description: () => firstMatch([
    '.jobs-description__content .jobs-box__html-content',
    '.jobs-description-content__text--large',
    '.jobs-description-content__text',
    '#job-details',
    '.description__text',
    '[class*="job-description"]',
  ], getLIRoot()),

  /**
   * Job type (Full-time / Part-time / Contract / Internship).
   *
   * LinkedIn puts this in one of:
   *  a) The "Job Details" section below the description (criteria list)
   *  b) The "How you match" section
   *  c) An insight badge in the top card
   */
  type: () => {
    // Strategy 1: criteria list (older layout / public view)
    const root = getLIRoot();
    const criteriaItems = root.querySelectorAll(
      '.description__job-criteria-list li, ' +
      '.job-details-jobs-unified-top-card__job-insight li'
    );
    for (const item of criteriaItems) {
      const header = item.querySelector(
        '.description__job-criteria-subheader, [class*="criteria-subheader"]'
      );
      if (header?.innerText?.toLowerCase().includes('employment type')) {
        const val = item.querySelector(
          '.description__job-criteria-text, [class*="criteria-text"]'
        )?.innerText?.trim();
        if (val) return val;
      }
    }

    // Strategy 2: insight items that explicitly contain an employment-type keyword
    const insightEls = root.querySelectorAll(
      '.job-details-jobs-unified-top-card__job-insight, ' +
      '.jobs-unified-top-card__job-insight, ' +
      '[class*="job-insight"]'
    );
    for (const el of insightEls) {
      const text = el.innerText || '';
      const m = text.match(/\b(full[\s-]time|part[\s-]time|contract|freelance|internship|temporary)\b/i);
      if (m) return m[1].replace(/\s+/g, '-').toLowerCase()
        .replace(/^f/, 'F').replace(/^p/, 'P').replace(/^c/, 'C').replace(/^i/, 'I').replace(/^t/, 'T');
    }

    // Strategy 3: scan all leaf elements for a standalone type token
    const typeTokens = findLeafText(
      t => /^(full[\s-]time|part[\s-]time|contract|internship|temporary)$/i.test(t),
      15, root
    );
    if (typeTokens.length) return typeTokens[0].text;

    const labels = root.querySelectorAll('.ui-label, .tvm__text--neutral');
    for (const label of labels) {
      const text = label.innerText?.trim();
      if (text && /^(full-time|part-time|contract|internship)$/i.test(text)) {
        return text;
      }
    }
    
    // Strategy 4: Fallback to any insight with "full-time" etc (regardless of standalone text nodes)
    const allInsights = root.querySelectorAll('[class*="job-insight"], [class*="ui-label"], .tvm__text--neutral');
    for (const el of allInsights) {
        const text = (el.innerText || '').toLowerCase();
        if (/full[\s-]time/.test(text)) return 'Full-time';
        if (/part[\s-]time/.test(text)) return 'Part-time';
        if (/contract/.test(text)) return 'Contract';
        if (/internship/.test(text)) return 'Internship';
    }

    // Strategy 5: Nuclear option. Search the entire job details block's raw text.
    const everything = root.innerText || '';
    if (/full[\s-]?time/i.test(everything)) return 'Full-time';
    if (/part[\s-]?time/i.test(everything)) return 'Part-time';
    if (/contract/i.test(everything)) return 'Contract';
    if (/internship/i.test(everything)) return 'Internship';

    return null;
  },

  /**
   * Salary range.
   *
   * LinkedIn shows salary in various places depending on whether the company
   * disclosed it:
   *  - A dedicated "salary insight" element in the top card
   *  - A "compensation" section
   *  - Inside an insight/badge containing a "$" sign
   */
  salary: () => {
    // Strategy 1: explicit selectors
    const root = getLIRoot();
    const direct = firstMatch([
      '.compensation__salary',
      '.job-details-jobs-unified-top-card__salary-link',
      '.jobs-unified-top-card__salary-link',
      '[class*="salary-info"]',
      '[class*="compensation"]',
    ], root);
    if (direct) return direct;

    // Strategy 2: any insight element that contains a dollar sign
    const insightEls = root.querySelectorAll(
      '.job-details-jobs-unified-top-card__job-insight, ' +
      '.jobs-unified-top-card__job-insight, ' +
      '[class*="job-insight"], ' +
      '[class*="insight-container"]'
    );
    for (const el of insightEls) {
      const text = (el.innerText || '').trim();
      // Skip strings that look like "Retry Premium for $0"
      if (/premium|retry|\$0/i.test(text)) continue;

      if (text.includes('$') || /\d+[kK]\/yr|\d+\/hr/i.test(text)) {
        // Clean up: remove possible "matches your salary preference" suffix
        let cleaned = text.split('\n')[0].trim();
        cleaned = cleaned.replace(/Matches your.*$/i, '').trim();
        if (cleaned.length < 200) return cleaned;
      }
    }

    // Strategy 3: leaf-text scan for "$X - $Y" or "$Xk/yr" patterns
    const salaryNodes = findLeafText(
      t => /\$[\d,]+/.test(t) && t.length < 150 && !/premium|retry|\$0/i.test(t),
      10, root
    );
    if (salaryNodes.length) {
      // Prefer ones that look like ranges
      const range = salaryNodes.find(n => /\$[\d,]+\s*[-–]\s*\$[\d,]+/i.test(n.text));
      if (range) return range.text;
      return salaryNodes[0].text;
    }

    return null;
  },

  deadline: () => {
    const root = getLIRoot();
    const deadlineEls = findLeafText(t => /deadline|apply by|closing date/i.test(t), 15, root);
    for (const node of deadlineEls) {
        const m = node.text.match(/(?:deadline|apply by|closing date)[\s:]*([a-zA-Z]+\s+\d{1,2}(?:,\s*\d{4})?|\d{1,2}\/\d{1,2}\/\d{2,4})/i);
        if (m) return m[1];
    }
    return null;
  },

  applyLink: () => {
    const root = getLIRoot();
    const applyBtn = root.querySelector('.jobs-apply-button--native, a.jobs-apply-button, a[data-control-name="jobdetails_apply_btn"]');
    if (applyBtn && applyBtn.href) {
        if (!applyBtn.href.includes('#')) return applyBtn.href;
    }
    // Often linkedin obfuscates external apply
    return null;
  },

  datePosted: () => {
    // Strategy 1: explicit selectors
    const root = getLIRoot();
    const el =
      root.querySelector('.posted-time-ago__text') ||
      root.querySelector('[class*="posted-date"]') ||
      root.querySelector('time[datetime]') ||
      root.querySelector('.tvm__text--positive');

    if (el) {
      if (el.tagName === 'TIME' && el.getAttribute('datetime')) {
        return el.getAttribute('datetime');
      }
      return el.innerText?.trim() || null;
    }

    const labels = root.querySelectorAll('.tvm__text--neutral, .tvm__text--positive');
    for (const lbl of labels) {
        if (/ago|just now/i.test(lbl.innerText)) return lbl.innerText.trim();
    }

    // Strategy 2: scan top card for "X days ago" text
    const topCard = root.querySelector('[class*="unified-top-card"]');
    if (topCard) {
      const timeNodes = findLeafText(
        t => /\d+\s+(day|week|month|hour)/i.test(t) && t.length < 60,
        5, root
      );
      if (timeNodes.length) return timeNodes[0].text;
    }

    return null;
  },

  /**
   * Capture the company logo URL from the job card.
   */
  companyLogo: () => {
    const root = getLIRoot();
    const selectors = [
      '.job-details-jobs-unified-top-card__company-logo-image',
      '.jobs-unified-top-card__company-logo-image',
      '.artdeco-entity-image--company',
      '.topcard__logo-image',
      '[class*="company-logo"] img',
      '[class*="entity-image"]',
    ];
    for (const sel of selectors) {
      const img = root.querySelector(sel);
      if (img?.src && !img.src.includes('data:') && img.src.includes('http')) {
        return img.src;
      }
    }
    
    // Fallback block - look inside top card
    const topCard = root.querySelector('[class*="unified-top-card"]');
    if (topCard) {
      const cardImg = topCard.querySelector('img');
      if (cardImg && cardImg.src && cardImg.src.includes('http')) return cardImg.src;
    }
    return null;
  },
};

// ─── Indeed scraper ──────────────────────────────────────────────────────────

const INDEED_SCRAPER = {
  isJobPage: () =>
    window.location.pathname.includes('/viewjob') ||
    !!document.querySelector('#jobsearch-ViewJobLayout'),
  title: () => firstMatch(['.jobsearch-JobInfoHeader-title', 'h1']),
  company: () => firstMatch([
    '[data-testid="inlineHeader-companyName"]',
    '.jobsearch-InlineCompanyRating div',
  ]),
  location: () => firstMatch([
    '[data-testid="inlineHeader-companyLocation"]',
    '.jobsearch-JobInfoHeader-subtitle div:nth-child(2)',
  ]),
  workplaceType: () => null,
  description: () => document.querySelector('#jobDescriptionText')?.innerText || null,
  type: () => document.querySelector('#jobDetailsSection div:nth-child(2)')?.innerText || null,
  salary: () => document.querySelector('#salaryInfoAndJobType')?.innerText || null,
  datePosted: () => null,
  companyLogo: () => {
    const img = document.querySelector('[class*="companyAvatar"] img, [class*="company-logo"] img');
    return img?.src || null;
  },
};

// ─── Site registry & fallback ────────────────────────────────────────────────

const SCRAPERS = {
  'linkedin.com': LINKEDIN_SCRAPER,
  'indeed.com': INDEED_SCRAPER,
};

const FALLBACK_SCRAPER = {
  isJobPage: () => true,
  title: () => document.querySelector('h1')?.innerText || document.title || null,
  company: () => null,
  location: () => null,
  workplaceType: () => null,
  description: () => {
    let largest = '';
    document.querySelectorAll('div, p, article').forEach(el => {
      if (el.innerText && el.innerText.length > largest.length && el.innerText.length < 15000) {
        largest = el.innerText;
      }
    });
    return largest || null;
  },
  type: () => null,
  salary: () => null,
  datePosted: () => null,
  companyLogo: () => null,
  applyLink: () => null,
  deadline: () => null,
};

function getScraper() {
  const hostname = window.location.hostname;
  for (const [domain, scraper] of Object.entries(SCRAPERS)) {
    if (hostname.includes(domain)) return scraper;
  }
  return FALLBACK_SCRAPER;
}

// ─── Post-processing helpers ─────────────────────────────────────────────────

function parseRelativeDate(raw) {
  if (!raw) return null;
  raw = raw.trim();
  const direct = new Date(raw);
  if (!isNaN(direct.getTime())) return direct.toISOString().split('T')[0];

  const now = new Date();
  const lower = raw.toLowerCase();
  const hourMatch = lower.match(/(\d+)\s+hour/);
  const dayMatch = lower.match(/(\d+)\s+day/);
  const weekMatch = lower.match(/(\d+)\s+week/);
  const monthMatch = lower.match(/(\d+)\s+month/);

  const shift = (d, fn) => { fn(d); return d.toISOString().split('T')[0]; };
  if (lower.includes('just now') || lower.includes('today')) return now.toISOString().split('T')[0];
  if (lower.includes('yesterday')) return shift(new Date(now), d => d.setDate(d.getDate() - 1));
  if (hourMatch) return shift(new Date(now), d => d.setHours(d.getHours() - +hourMatch[1]));
  if (dayMatch) return shift(new Date(now), d => d.setDate(d.getDate() - +dayMatch[1]));
  if (weekMatch) return shift(new Date(now), d => d.setDate(d.getDate() - +weekMatch[1] * 7));
  if (monthMatch) return shift(new Date(now), d => d.setMonth(d.getMonth() - +monthMatch[1]));
  return null;
}

function inferLocationType(locationRaw, workplaceTypeRaw) {
  const combined = `${locationRaw || ''} ${workplaceTypeRaw || ''}`.toLowerCase();
  if (combined.includes('remote')) return 'Remote';
  if (combined.includes('hybrid')) return 'Hybrid';
  if (combined.includes('on-site') || combined.includes('onsite') || combined.includes('in-person')) return 'On-site';
  return null;
}

function cleanLocation(raw) {
  if (!raw) return '';
  return raw
    .replace(/\((remote|hybrid|on-site|onsite)\)/gi, '')
    .replace(/\b(remote|hybrid|on-site|onsite)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function normaliseJobType(raw) {
  if (!raw) return null;
  const t = raw.toLowerCase();
  if (t.includes('full')) return 'Full-time';
  if (t.includes('part')) return 'Part-time';
  if (t.includes('contract') || t.includes('freelance')) return 'Contract';
  if (t.includes('intern')) return 'Internship';
  return raw.trim();
}

// ─── Main scrape function ────────────────────────────────────────────────────

function scrapeJobData() {
  const scraper = getScraper();

  const rawLocation = scraper.location?.() || '';
  const rawWorkplaceType = scraper.workplaceType?.() || '';
  const rawDatePosted = scraper.datePosted?.() || null;
  const rawSalary = scraper.salary?.() || null;
  const rawType = scraper.type?.() || null;
  const rawTitle = scraper.title?.() || null;
  const rawCompany = scraper.company?.() || null;
  const rawDescription = scraper.description?.() || null;
  const rawCompanyLogo = scraper.companyLogo?.() || null;
  const rawApplyLink = scraper.applyLink?.() || null;
  const rawDeadline = scraper.deadline?.() || null;

  const locationType = inferLocationType(rawLocation, rawWorkplaceType) || null;
  const location = cleanLocation(rawLocation);
  const datePosted = parseRelativeDate(rawDatePosted);
  const deadlineParsed = parseRelativeDate(rawDeadline) || rawDeadline;

  return {
    title: rawTitle?.trim() || null,
    company: rawCompany?.trim() || null,
    companyLogo: rawCompanyLogo || null,
    link: window.location.href,
    applyLink: rawApplyLink || window.location.href,
    datePosted: datePosted || null,
    deadline: deadlineParsed || null,
    salaryRange: rawSalary?.trim() || null,
    description: rawDescription?.trim() || null,
    jobType: normaliseJobType(rawType),
    locationType: locationType || null,
    location: location || null,
    relocation: 'false',
    interestLevel: 'Medium',
    remarks: '',
  };
}

// ─── Floating button ─────────────────────────────────────────────────────────

const ICON_OPEN = `
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <!-- ">>" — panel is open, click to collapse -->
    <polyline points="13 17 18 12 13 7"></polyline>
    <polyline points="6 17 11 12 6 7"></polyline>
  </svg>`;

const ICON_CLOSED = `
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <!-- "<<" — panel is closed, click to open -->
    <polyline points="11 17 6 12 11 7"></polyline>
    <polyline points="18 17 13 12 18 7"></polyline>
  </svg>`;

function updateButtonState(btn, isOpen) {
  if (!btn) return;
  btn.innerHTML = isOpen ? ICON_OPEN : ICON_CLOSED;
  btn.title = isOpen ? 'Close side panel' : 'Open side panel';
  btn.classList.toggle('panel-open', isOpen);
}

function isExtValid() {
  return typeof chrome !== 'undefined' && chrome.runtime && !!chrome.runtime.id;
}

function injectFloatingButton() {
  let btn = document.getElementById('job-automator-btn');
  if (btn) {
    // Already injected — just sync the visual state and return
    if (isExtValid()) {
      try {
        chrome.storage.local.get(['isPanelOpen'], r => updateButtonState(btn, !!r.isPanelOpen));
      } catch(e) {}
    }
    return;
  }

  btn = document.createElement('div');
  btn.id = 'job-automator-btn';
  btn.className = 'job-automator-floating-btn';
  btn.setAttribute('role', 'button');
  btn.setAttribute('tabindex', '0');

  // Set initial visual state
  if (isExtValid()) {
    try {
      chrome.storage.local.get(['isPanelOpen'], r => updateButtonState(btn, !!r.isPanelOpen));
    } catch(e) {}
  }

  btn.addEventListener('click', () => {
    if (!isExtValid()) {
      console.warn('[JobAutomator] Extension context invalidated. Please refresh the page.');
      return;
    }
    try {
      chrome.storage.local.get(['isPanelOpen'], (result) => {
        const isOpen = !!result.isPanelOpen;

        if (isOpen) {
          chrome.runtime.sendMessage({ action: 'close_side_panel' }, () => {
            if (chrome.runtime.lastError) console.warn(chrome.runtime.lastError);
            updateButtonState(btn, false);
          });
        } else {
          const jobData = scrapeJobData();
          console.log('[JobAutomator] Scraped Job Data:', jobData);
          chrome.runtime.sendMessage({ action: 'open_and_store', data: jobData }, () => {
            if (chrome.runtime.lastError) console.warn(chrome.runtime.lastError);
            updateButtonState(btn, true);
            chrome.runtime.sendMessage({ action: 'refresh_panel_data' });
          });
        }
      });
    } catch(e) {
      console.error('[JobAutomator] Error expanding panel:', e);
    }
  });

  document.body.appendChild(btn);
}

// Listen for panel state changes broadcast from the background
if (isExtValid()) {
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'panel_state_changed') {
      const btn = document.getElementById('job-automator-btn');
      updateButtonState(btn, message.isOpen);
    }
  });
}

function checkIfJobPage() {
  const scraper = getScraper();
  if (scraper.isJobPage()) {
    injectFloatingButton();
  }
}

// ─── Auto-detect job navigation (SPA) ───────────────────────────────────────
// LinkedIn changes the URL via history.pushState without a full page reload.
// We detect navigation in two complementary ways:
//   1. Patching history.pushState/replaceState to emit a 'locationchange' event
//   2. A lightweight poll that checks the `currentJobId` URL param every second
//
// ⚠️  We do NOT use a MutationObserver — LinkedIn fires thousands of DOM mutations
//     per second which would continuously reset any debounce timer.

let lastJobUrl = window.location.href;
let lastJobId = new URLSearchParams(window.location.search).get('currentJobId') || '';
let scrapeTimer = null;

function handleJobNavigation() {
  if (!isExtValid()) return;
  try {
    chrome.runtime.sendMessage({ action: 'job_loading' }).catch(()=>{});
  } catch(e) {}

  clearTimeout(scrapeTimer);
  scrapeTimer = setTimeout(() => {
    const jobData = scrapeJobData();
    console.log('[JobAutomator] Auto-scraped new job:', jobData);
    if (!isExtValid()) return;
    try {
      chrome.runtime.sendMessage({ action: 'store_job_data', data: jobData }, () => {
        if (chrome.runtime.lastError) {}
        chrome.runtime.sendMessage({ action: 'refresh_panel_data' }).catch(()=>{});
      });
    } catch(e) {}
  }, 1500);
}

// 1. History API patch
function patchHistoryAPI() {
  const _push = history.pushState.bind(history);
  const _replace = history.replaceState.bind(history);
  history.pushState = function (...args) { _push(...args); window.dispatchEvent(new Event('locationchange')); };
  history.replaceState = function (...args) { _replace(...args); window.dispatchEvent(new Event('locationchange')); };
  window.addEventListener('popstate', () => window.dispatchEvent(new Event('locationchange')));
}
patchHistoryAPI();

window.addEventListener('locationchange', () => {
  const newUrl = window.location.href;
  if (newUrl === lastJobUrl) return;
  lastJobUrl = newUrl;
  setTimeout(checkIfJobPage, 800);
  
  if (!isExtValid()) return;
  try {
    chrome.storage.local.get(['isPanelOpen'], (result) => {
      if (chrome.runtime.lastError) return;
      if (!result.isPanelOpen) return;
      if (getScraper().isJobPage()) handleJobNavigation();
    });
  } catch(e) {}
});

// 2. Lightweight currentJobId poll
setInterval(() => {
  const params = new URLSearchParams(window.location.search);
  const currentJobId = params.get('currentJobId') || '';
  if (!currentJobId || currentJobId === lastJobId) return;
  lastJobId = currentJobId;
  const newUrl = window.location.href;
  if (newUrl === lastJobUrl) return;
  lastJobUrl = newUrl;
  setTimeout(checkIfJobPage, 800);
  
  if (!isExtValid()) return;
  try {
    chrome.storage.local.get(['isPanelOpen'], (result) => {
      if (chrome.runtime.lastError) return;
      if (!result.isPanelOpen) return;
      if (getScraper().isJobPage()) handleJobNavigation();
    });
  } catch(e) {}
}, 1000);

window.addEventListener('load', checkIfJobPage);
setInterval(checkIfJobPage, 2000);
