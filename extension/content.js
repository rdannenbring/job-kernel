// ─── Utility helpers ────────────────────────────────────────────────────────
/**
 * Send a log message to the backend via the background script.
 */
function extLog(level, message, context = null) {
  try {
    chrome.runtime.sendMessage({ action: 'log', level, message, context }).catch(() => {});
  } catch (e) {}
}

extLog('INFO', 'Content script initialized', { url: window.location.href });


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

const getLIRoot = () => 
  document.querySelector('.jobs-details') ||
  document.querySelector('.scaffold-layout__main') ||
  document.querySelector('[class*="description-container--two-pane"]') ||
  document.querySelector('.job-details-jobs-unified-top-card') ||
  document.querySelector('[class*="job-details-jobs-unified-top-card"]') ||
  document.querySelector('[class*="jobs-unified-top-card"]') ||
  document.querySelector('.jobs-search__job-details--container') ||
  document.querySelector('.job-view-layout') ||
  document.querySelector('.top-card-layout') ||
  document.querySelector('#workspace') ||
  document;

/**
 * Advanced label-based extraction. Finds a label (e.g. "Location:") 
 * and attempts to find the corresponding value in the next sibling,
 * parent text, or adjacent table cell.
 */
function extractByLabel(labelRegex, maxLength = 200) {
  // Use findLeafText to find nodes matching the label
  const leaves = findLeafText(t => labelRegex.test(t), 10);
  for (const leaf of leaves) {
    // 1. Check next sibling element
    let val = leaf.el.nextElementSibling?.innerText?.trim();
    if (val && val.length > 0 && val.length < maxLength) return val;
    
    // 2. Check parent text (excluding the label itself)
    const parentText = leaf.el.parentElement?.innerText?.trim();
    if (parentText) {
      val = parentText.replace(labelRegex, '').replace(/^[:\s-]+/, '').trim();
      if (val && val.length > 0 && val.length < maxLength) return val;
    }
    
    // 3. Table cell logic: if label is in a cell, value might be in the next cell
    const cell = leaf.el.closest('td, th');
    if (cell && cell.nextElementSibling) {
      val = cell.nextElementSibling.innerText.trim();
      if (val && val.length > 0 && val.length < maxLength) return val;
    }
  }
  return null;
}

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
    '.top-card-layout__title',
    'h1.top-card-layout__title',
    'h1[class*="job-title"]',
    'h1',
    '#workspace h1',
    '#workspace h2',
    '.top-card-layout__title',
    'h2.top-card-layout__title',
  ], getLIRoot()),

  company: () => firstMatch([
    '.job-details-jobs-unified-top-card__company-name a',
    '.job-details-jobs-unified-top-card__company-name',
    '.jobs-unified-top-card__company-name a',
    '.jobs-unified-top-card__company-name',
    '#workspace a[href*="/company/"]',
    '#workspace .company-name',
    '#workspace [class*="company"] a',
    '#workspace h2 a',
    '.topcard__org-name-link',
    '.top-card-layout__first-subline a',
    '[class*="company-name"] a',
    '[class*="company-name"]',
  ], getLIRoot()),

  companyId: () => {
    // Try multiple strategies to get slug or numeric ID
    const root = getLIRoot();
    
    // Strategy 1: link in the top card
    const link = root.querySelector('.job-details-jobs-unified-top-card__company-name a') || 
                 root.querySelector('.jobs-unified-top-card__company-name a') ||
                 root.querySelector('.topcard__org-name-link') ||
                 root.querySelector('[class*="company-name"] a');

    if (link) {
      // Try slug first: /company/pwc/
      const slugMatch = link.href.match(/\/company\/([^/?#]+)/);
      if (slugMatch && !/^\d+$/.test(slugMatch[1])) return slugMatch[1];
      
      // Try numeric ID: /company/12345/ or f_C=12345
      const numericMatch = link.href.match(/\/company\/(\d+)/) || link.href.match(/f_C=(\d+)/);
      if (numericMatch) return numericMatch[1];
    }

    // Strategy 2: Search internal <code> tags for numeric ID
    const codes = document.querySelectorAll('code');
    for (const code of codes) {
      try {
        const content = code.textContent;
        if (content.includes('urn:li:fsd_company:')) {
          const idMatch = content.match(/urn:li:fsd_company:(\d+)/);
          if (idMatch) return idMatch[1];
        }
      } catch (e) {}
    }

    return null;
  },

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
    
    // Strategy 3: Top-card layout flavors
    const flavors = document.querySelectorAll('#workspace [class*="flavor"], .top-card-layout__first-subline .topcard__flavor, .topcard__flavor--bullet');
    for (const flavor of flavors) {
        const text = flavor.innerText?.trim();
        // Check for common tokens that aren't locations
        if (text && text.includes(',') && !/\d/.test(text) && !/applicant|employee|ago|hybrid|remote|on-site/i.test(text)) {
            return text;
        }
    }
    
    // Strategy 4: Workspace subline scan
    const workspaceHeader = document.querySelector('#workspace header');
    if (workspaceHeader) {
        const textNodes = findLeafText(t => t.includes(',') && t.length < 50, 10, workspaceHeader);
        if (textNodes.length) return textNodes[0].text;
    }
    
    // Strategy 5: any generic text node mapping to city/state in the top card
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

  workplaceType: () => {
    const root = getLIRoot();

    const matchWorkplace = (t) => {
      t = t.toLowerCase();
      if (t.includes('remote')) return 'Remote';
      if (t.includes('hybrid')) return 'Hybrid';
      if (t.includes('on-site') || t.includes('onsite') || t.includes('in person') || t.includes('in-person')) return 'On-site';
      return null;
    };

    // Strategy A: Visually-hidden accessibility labels (document-wide — LinkedIn puts these
    // in aria-label spans that are not inside the visible top-card root)
    const hiddenLabels = document.querySelectorAll('.visually-hidden, [class*="visually-hidden"], [class*="screen-reader"]');
    for (const el of hiddenLabels) {
      const text = (el.innerText || el.textContent || '').trim().toLowerCase();
      if (text.includes('workplace type is') || text.includes('work location type')) {
        const m = matchWorkplace(text);
        if (m) { console.log('[JobAutomator] Workplace: A (aria)', m); return m; }
      }
    }

    // Strategy B: The LinkedIn "Job Details" criteria section (below description)
    // e.g. <span class="description__job-criteria-text">Remote</span>
    const criteriaText = document.querySelectorAll(
      '.description__job-criteria-text, [class*="job-criteria-text"], [class*="criteria-item"] span'
    );
    for (const el of criteriaText) {
      const m = matchWorkplace((el.innerText || '').trim());
      if (m) { console.log('[JobAutomator] Workplace: B (criteria)', m); return m; }
    }

    // Strategy C: Insight pills / tvm spans in root
    const insightEls = root.querySelectorAll(
      '.tvm__text, .ui-label, [class*="job-insight"] span, [class*="job-insight"] li, .artdeco-pill__text'
    );
    for (const el of insightEls) {
      const t = (el.innerText || el.textContent || '').trim();
      if (t.length < 40) {
        const m = matchWorkplace(t);
        if (m) { console.log('[JobAutomator] Workplace: C (insight pill)', m); return m; }
      }
    }

    // Strategy D: Leaf-node scan of all small spans/anchors in root
    const leafEls = root.querySelectorAll('span, a, li');
    for (const el of leafEls) {
      if (el.children.length > 0 && el.tagName !== 'A') continue;
      const t = (el.innerText || '').trim();
      if (t.length > 0 && t.length < 30) {
        const m = matchWorkplace(t);
        if (m) { console.log('[JobAutomator] Workplace: D (leaf node)', m); return m; }
      }
    }

    // Strategy E: Full-text regex on the root innerHTML
    const pageText = root.innerText || '';
    const m = matchWorkplace(pageText.substring(0, 5000));
    if (m) { console.log('[JobAutomator] Workplace: E (page text)', m); return m; }

    console.warn('[JobAutomator] Workplace extraction FAILED.');
    return null;
  },

  description: () => firstMatch([
    '.jobs-description__content .jobs-box__html-content',
    '.jobs-description-content__text--large',
    '.jobs-description-content__text',
    '#job-details',
    '.description__text',
    '.show-more-less-html__markup',
    '[class*="job-description"]',
    '.jobs-box__html-content',
    '.jobs-details__main-content',
  ], document), // Search from document to avoid issues with isolated roots

  type: () => {
    const root = getLIRoot();

    const matchJobType = (t) => {
      t = t.toLowerCase();
      // Match with or without hyphen: "full-time", "full time", "fulltime"
      if (/full[\s-]?time/.test(t)) return 'Full-time';
      if (/part[\s-]?time/.test(t)) return 'Part-time';
      if (/\bcontract\b|\bfreelance\b|\btemporary\b/.test(t)) return 'Contract';
      if (/\binternship\b|\bintern\b/.test(t)) return 'Internship';
      return null;
    };

    // Strategy A: Visually-hidden aria labels (document-wide)
    // LinkedIn encodes "Job type is Full-time" in hidden spans that may be outside root
    const hiddenLabels = document.querySelectorAll('.visually-hidden, [class*="visually-hidden"], [class*="screen-reader"]');
    for (const el of hiddenLabels) {
      const text = (el.innerText || el.textContent || '').trim();
      if (/job type is|employment type/i.test(text)) {
        const m = matchJobType(text);
        if (m) { console.log('[JobAutomator] Job Type: A (aria label)', m); return m; }
      }
    }

    // Strategy B: LinkedIn "Job Details" criteria section
    // Scans <h3> labels for "Employment type" then reads its sibling value span
    const criteriaItems = document.querySelectorAll(
      '.description__job-criteria-item, [class*="job-criteria-item"]'
    );
    for (const item of criteriaItems) {
      const header = (item.querySelector('h3, [class*="criteria-subheader"]')?.innerText || '').toLowerCase();
      if (header.includes('employment type') || header.includes('job type')) {
        const val = item.querySelector('[class*="criteria-text"], span:last-child')?.innerText || '';
        const m = matchJobType(val);
        if (m) { console.log('[JobAutomator] Job Type: B (criteria section)', m); return m; }
      }
    }

    // Strategy C: Standalone criteria text spans (when we can't find h3 but can find the value)
    const criteriaText = document.querySelectorAll(
      '.description__job-criteria-text, [class*="job-criteria-text"]'
    );
    for (const el of criteriaText) {
      const m = matchJobType((el.innerText || '').trim());
      if (m) { console.log('[JobAutomator] Job Type: C (criteria text)', m); return m; }
    }

    // Strategy D: Job insight pills / tvm spans in root
    const insightEls = root.querySelectorAll(
      '.tvm__text, .ui-label, [class*="job-insight"] span, [class*="job-insight"] li, .artdeco-pill__text'
    );
    for (const el of insightEls) {
      const t = (el.innerText || el.textContent || '').trim();
      if (t.length < 40) {
        const m = matchJobType(t);
        if (m) { console.log('[JobAutomator] Job Type: D (insight pill)', m); return m; }
      }
    }

    // Strategy E: Leaf-node scan of all small elements in root
    const leafEls = root.querySelectorAll('span, li, b');
    for (const el of leafEls) {
      if (el.children.length > 0) continue;
      const t = (el.innerText || '').trim();
      if (t.length > 0 && t.length < 30) {
        const m = matchJobType(t);
        if (m) { console.log('[JobAutomator] Job Type: E (leaf node)', m); return m; }
      }
    }

    // Strategy F: Description text fallback — job type is often stated in the description body
    const descEl = document.querySelector('#job-details, .jobs-description-content__text, .jobs-box__html-content');
    if (descEl) {
      // Look in first 2000 chars of description for explicit employment type statement
      const descText = (descEl.innerText || '').substring(0, 2000);
      const m = matchJobType(descText);
      if (m) { console.log('[JobAutomator] Job Type: F (description text)', m); return m; }
    }

    console.warn('[JobAutomator] Job Type extraction FAILED.');
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
    const root = getLIRoot();
    // Strategy 1: explicit selectors
    const direct = firstMatch([
      '.job-details-jobs-unified-top-card__salary-link',
      '.jobs-unified-top-card__salary-link',
      '.compensation__salary',
      '[class*="salary-info"]',
      '[class*="compensation"]',
    ], root);
    if (direct) return direct;

    // Strategy 2: any insight element containing "$"
    const insightEls = root.querySelectorAll(
      '.job-details-jobs-unified-top-card__job-insight, ' +
      '.jobs-unified-top-card__job-insight, ' +
      '[class*="job-insight"], ' +
      '[class*="insight-container"], ' +
      '.ui-label, .tvm__text'
    );
    for (const el of insightEls) {
      const text = (el.innerText || '').trim();
      if (/premium|retry|\$0/i.test(text)) continue;

      if (text.includes('$') || /\d+[kK]\/yr|\d+\/hr/i.test(text)) {
        let cleaned = text.split('\n')[0].trim();
        cleaned = cleaned.replace(/Matches your.*$/i, '').trim();
        if (cleaned.length < 150) return cleaned;
      }
    }

    // Strategy 3: Deep fallback - search the job description itself for salary patterns
    const desc = LINKEDIN_SCRAPER.description() || document.querySelector('.jobs-description-content__text')?.innerText;
    if (desc) {
      // Look for patterns like "$183,000 - $285,000" or "$100k-$150k" or "£50k-£70k" or "60,000 - 80,000 EUR"
      const salaryRegex = /(?:[\$\£\€\¥]|USD|EUR|GBP)[\s]*[\d,]+(?:\s*[kK])?\s*(?:[-–]|to)\s*(?:[\$\£\€\¥]|USD|EUR|GBP)?[\s]*[\d,]+(?:\s*[kK])?|[\d,]+(?:\s*[kK])?[\s]*(?:[\$\£\€\¥]|USD|EUR|GBP)?(?:\s*\/\s*(?:yr|hr|month|year|hour|annum))|[\$\£\€\¥][\d,]+(?:\s*[kK])?/gi;
      const matches = desc.match(salaryRegex);
      if (matches) {
        // Filter out very small numbers that might be counts (like $0 for matching)
        const relevant = matches.filter(m => !m.includes('$0') && m.length > 2);
        if (relevant.length > 0) {
          // Find the one that looks most like a range or is reasonably long
          return relevant.sort((a,b) => b.length - a.length)[0];
        }
      }
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

  companyLogo: () => {
    const root = getLIRoot();
    const selectors = [
      '.job-details-jobs-unified-top-card__company-logo-image',
      '.jobs-unified-top-card__company-logo-image',
      '.artdeco-entity-image--company',
      '#workspace img[src*="company-logo"]',
      '#workspace img[alt*="logo"]',
      '.topcard__logo-image',
      '.topcard__logo-container img',
      '.top-card-layout__entity-image',
      '.top-card-layout__entity-image--logo',
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
  
  networking: () => {
    const connections = [];
    
    // 1. Check for LinkedIn Modals (most important for "Show all")
    const modals = document.querySelectorAll('.artdeco-modal, [role="dialog"], #artdeco-modal-outlet');
    modals.forEach(modal => {
        // Look for connection items in the modal (LinkedIn often uses entity-lockup or entity-result)
        const items = modal.querySelectorAll('.artdeco-entity-lockup, .entity-result, [class*="result-item"], [class*="member-tabpanel"] li');
        items.forEach(item => {
            const nameLink = item.querySelector('a[href*="/in/"]');
            // Try different name containers
            const nameEl = item.querySelector('strong, .artdeco-entity-lockup__title, [class*="name"], .entity-result__title');
            const headlineEl = item.querySelector('[class*="headline"], .artdeco-entity-lockup__subtitle, .entity-result__primary-subtitle, [class*="subtitle"]');
            
            if (nameEl && nameLink) {
                const name = nameEl.querySelector('strong')?.innerText || nameEl.innerText.split('\n')[0].split(' and ')[0].trim();
                const profileUrl = nameLink.href.split('?')[0];

                // Check for duplicate in this run
                if (connections.some(c => c.profile_url === profileUrl)) return;

                // Detection for Connection Degree and Alumni status
                const degreeEl = item.querySelector('.dist-value, [class*="dist-value"], .entity-result__badge');
                let degree = degreeEl ? degreeEl.innerText.trim().replace(/\s+/g, '') : null;
                if (degree && degree.includes('·')) degree = degree.split('·').pop().trim();

                const itemText = item.innerText.toLowerCase();
                const isAlumni = itemText.includes('alumni') || itemText.includes('alumnus') || itemText.includes('class of');
                const imgEl = item.querySelector('img');

                connections.push({
                    name: name,
                    headline: headlineEl?.innerText.trim() || '',
                    profile_url: profileUrl,
                    degree: degree,
                    is_alumni: isAlumni,
                    photo_url: imgEl ? imgEl.src : null
                });
            }
        });
    });

    // 2. Check the Job Details pane (root)
    const root = getLIRoot();
    // Look for various networking sections
    const networkCards = root.querySelectorAll('[class*="networking-card"], [class*="facepile-item"], .job-details-people-who-can-help__connections-card-summary, .jobs-poster, [class*="job-poster"], .hirer-card__container');
    
    networkCards.forEach(card => {
        const nameEl = card.querySelector('[class*="name"], [class*="title"], .job-details-people-who-can-help__connections-card-summary-text');
        const headlineEl = card.querySelector('[class*="headline"], [class*="subtitle"]');
        const linkEl = card.querySelector('a[href*="/in/"]');
        
        if (nameEl && linkEl) {
            const profileUrl = linkEl.href.split('?')[0];
            if (connections.some(c => c.profile_url === profileUrl)) return;

            const name = nameEl.innerText.split(' and ')[0].split(' in your network')[0].trim();
            
            // Detection for Connection Degree and Alumni status
            const degreeEl = card.querySelector('.dist-value, [class*="dist-value"]');
            let degree = degreeEl ? degreeEl.innerText.trim() : null;
            
            if (!degree) {
                const cardText = card.innerText;
                const degMatch = cardText.match(/\b([123][snr][td])\b/);
                if (degMatch) degree = degMatch[1];
            }

            const cardText = card.innerText.toLowerCase();
            const isAlumni = cardText.includes('alumni') || cardText.includes('alumnus') || cardText.includes('class of');
            const imgEl = card.querySelector('img');

            connections.push({
                name,
                headline: headlineEl?.innerText.trim() || (card.classList.contains('jobs-poster') ? 'Job Poster' : ''),
                profile_url: profileUrl,
                degree: degree,
                is_alumni: isAlumni,
                is_poster: /poster|hirer/i.test(card.className) || !!card.closest('.jobs-poster, .hirer-card__container'),
                photo_url: imgEl ? imgEl.src : null
            });
        }
    });

    // Strategy 3: Just find ANY /in/ link inside ANY networking area in the whole document
    const networkingAreas = document.querySelectorAll('.jobs-details__networking, .job-details-people-who-can-help, .jobs-search-connections-list, .jobs-details__main-content');
    networkingAreas.forEach(area => {
        const links = area.querySelectorAll('a[href*="/in/"]');
        links.forEach(link => {
            const container = link.closest('div, li, .artdeco-entity-lockup, [class*="card"]');
            const name = link.innerText.trim();
            const profileUrl = link.href.split('?')[0];

            if (connections.some(c => c.profile_url === profileUrl)) return;

            if (name && name.split(' ').length >= 2 && name.split(' ').length <= 5) { 
                const headlineEl = container?.querySelector('[class*="headline"], [class*="subtitle"], .artdeco-entity-lockup__subtitle');
                
                const degreeEl = container?.querySelector('.dist-value, [class*="dist-value"]');
                let degree = degreeEl ? degreeEl.innerText.trim() : null;
                const containerText = container?.innerText.toLowerCase() || '';
                const isAlumni = containerText.includes('alumni') || containerText.includes('alumnus') || containerText.includes('class of');
                const imgEl = container?.querySelector('img');

                connections.push({
                    name,
                    headline: headlineEl?.innerText.trim() || '',
                    profile_url: profileUrl,
                    degree: degree,
                    is_alumni: isAlumni,
                    photo_url: imgEl ? imgEl.src : null
                });
            }
        });
    });

    // Deduplicate one last time
    const unique = [];
    const seen = new Set();
    connections.forEach(c => {
        if (!seen.has(c.profile_url)) {
            seen.add(c.profile_url);
            unique.push(c);
        }
    });
    
    return unique;
  }
};




// ─── Indeed scraper ──────────────────────────────────────────────────────────

const INDEED_SCRAPER = {
  isJobPage: () =>
    window.location.pathname.includes('/viewjob') ||
    !!document.querySelector('#jobsearch-ViewJobLayout') ||
    !!document.querySelector('.jobsearch-JobComponent'),
  title: () => firstMatch([
    'h1.jobsearch-JobInfoHeader-title',
    '[data-testid="jobsearch-JobInfoHeader-title"]',
    '.jobsearch-JobInfoHeader-title',
    'h1'
  ]),
  company: () => firstMatch([
    '[data-testid="inlineHeader-companyName"]',
    '[data-testid="jobsearch-JobInfoHeader-companyName"]',
    '.jobsearch-InlineCompanyRating div',
    '.jobsearch-CompanyReview--heading',
  ]),
  location: () => firstMatch([
    '[data-testid="inlineHeader-companyLocation"]',
    '[data-testid="jobsearch-JobInfoHeader-companyLocation"]',
    '.jobsearch-JobInfoHeader-subtitle div:nth-child(2)',
  ]),
  workplaceType: () => {
    const text = document.body.innerText;
    if (/remote/i.test(text)) return 'Remote';
    if (/hybrid/i.test(text)) return 'Hybrid';
    if (/on-site|onsite/i.test(text)) return 'On-site';
    return null;
  },
  description: () => document.querySelector('#jobDescriptionText')?.innerText || null,
  type: () => firstMatch([
    '[data-testid="jobsearch-JobInfoHeader-salaryAndJobType"]',
    '#jobDetailsSection div:nth-child(2)',
    '.jobsearch-JobMetadataHeader-item'
  ]),
  salary: () => firstMatch([
    '#salaryInfoAndJobType',
    '[data-testid="jobsearch-JobInfoHeader-salary"]',
    '.jobsearch-JobMetadataHeader-item'
  ]),
  datePosted: () => {
    const el = document.querySelector('.jobsearch-JobMetadataHeader-item');
    return el?.innerText || null;
  },
  companyLogo: () => {
    const img = document.querySelector('[class*="companyAvatar"] img, [class*="company-logo"] img, .jobsearch-JobInfoHeader-logo img');
    return img?.src || null;
  },
  applyLink: () => {
    // Indeed often uses an 'Apply Now' button that redirects or opens a modal.
    // We try to find the direct link if available, otherwise return the viewjob URL.
    const applyBtn = document.querySelector('#applyButtonLinkContainer a, .jobsearch-SearchApplyButton--native a, [data-testid="jobsearch-ViewJobButton-button"]');
    if (applyBtn && applyBtn.href && !applyBtn.href.startsWith('javascript:')) return applyBtn.href;
    
    // Construct viewjob link if possible
    const jk = new URLSearchParams(window.location.search).get('jk') || new URLSearchParams(window.location.search).get('vjk');
    if (jk) return `https://www.indeed.com/viewjob?jk=${jk}`;
    
    return window.location.href;
  },
  url: () => {
    // Return a clean permalink if possible
    const jk = new URLSearchParams(window.location.search).get('jk') || new URLSearchParams(window.location.search).get('vjk');
    if (jk) return `https://www.indeed.com/viewjob?jk=${jk}`;
    return window.location.href;
  }
};

// ─── Glassdoor scraper ───────────────────────────────────────────────────────

const GLASSDOOR_SCRAPER = {
  isJobPage: () => window.location.hostname.includes('glassdoor.com') && (window.location.pathname.includes('/Job/') || !!document.querySelector('[data-test="job-title"]')),
  title: () => firstMatch(['[data-test="job-title"]', 'h1']),
  company: () => firstMatch(['[data-test="employer-name"]', '.EmployerProfile_employerName__vp_7Z']),
  location: () => firstMatch(['[data-test="location"]', '.JobDetails_location__m_iSl']),
  description: () => document.querySelector('.jobDescriptionContent')?.innerText || document.querySelector('#JobDescriptionContainer')?.innerText || null,
  salary: () => firstMatch(['[data-test="detailSalary"]', '.SalaryEstimate_salaryRange__6o7_s']),
  companyLogo: () => document.querySelector('.JobDetails_logo__7_8_s img')?.src || null,
  applyLink: () => {
    const btn = document.querySelector('[data-test="apply-button"]');
    return btn?.href || window.location.href;
  },
  url: () => {
    const jobId = new URLSearchParams(window.location.search).get('jobListingId') || new URLSearchParams(window.location.search).get('jobId');
    if (jobId && !window.location.href.includes('/job-listing/')) {
        return `https://www.glassdoor.com/job-listing/job.htm?jl=${jobId}`;
    }
    return window.location.href;
  }
};

// ─── ZipRecruiter scraper ────────────────────────────────────────────────────

const ZIPRECRUITER_SCRAPER = {
  isJobPage: () => window.location.hostname.includes('ziprecruiter.com') && (window.location.pathname.includes('/jobs/') || !!document.querySelector('.job_title')),
  title: () => firstMatch(['.job_title', 'h1']),
  company: () => firstMatch(['.hiring_company_link', '.company_name']),
  location: () => firstMatch(['.location', '.job_location']),
  description: () => document.querySelector('.job_description')?.innerText || document.querySelector('.jobDescriptionSection')?.innerText || null,
  salary: () => firstMatch(['.salary_range', '.job_salary']),
  applyLink: () => document.querySelector('a.apply_button')?.href || window.location.href,
  url: () => window.location.href.split('?')[0],
};

// ─── Greenhouse scraper ──────────────────────────────────────────────────────

const GREENHOUSE_SCRAPER = {
  isJobPage: () => !!document.querySelector('#grnhse_app') || window.location.hostname.includes('greenhouse.io'),
  title: () => firstMatch(['h1.app-title', '.job-title', 'h1']),
  company: () => firstMatch(['.company-name', 'span.company-name', 'h1 + span']),
  location: () => firstMatch(['.location', 'span.location']),
  description: () => document.querySelector('#content')?.innerText || document.querySelector('#main')?.innerText || null,
};

// ─── Lever scraper ──────────────────────────────────────────────────────────

const LEVER_SCRAPER = {
  isJobPage: () => !!document.querySelector('.postings-container') || window.location.hostname.includes('lever.co'),
  title: () => firstMatch(['.posting-header h2', 'h2']),
  company: () => firstMatch(['.main-header-logo img', 'title']),
  location: () => firstMatch(['.sort-by-time + .location', '.location']),
  description: () => document.querySelector('.section-wrapper .section:nth-child(3)')?.innerText || document.querySelector('.job-description')?.innerText || null,
};

// ─── Wellfound scraper ───────────────────────────────────────────────────────

const WELLFOUND_SCRAPER = {
  isJobPage: () => window.location.hostname.includes('wellfound.com') || window.location.hostname.includes('angel.co'),
  title: () => firstMatch(['h1[class*="job-title"]', 'h1']),
  company: () => firstMatch(['h2[class*="company-name"]', 'h2']),
  location: () => firstMatch(['[class*="location"]']),
  description: () => document.querySelector('[class*="job-description"]')?.innerText || null,
};

// ─── Workday scraper ─────────────────────────────────────────────────────────

const WORKDAY_SCRAPER = {
  isJobPage: () => window.location.hostname.includes('myworkdayjobs.com'),
  title: () => firstMatch(['[data-automation-id="jobPostingHeader"]', 'h1', 'h2']),
  company: () => firstMatch(['[data-automation-id="legalEntity"]', 'title']),
  location: () => firstMatch(['[data-automation-id="location"]', '[class*="location"]']),
  description: () => document.querySelector('[data-automation-id="jobPostingDescription"]')?.innerText || null,
};

// ─── SimplyHired scraper ─────────────────────────────────────────────────────

const SIMPLYHIRED_SCRAPER = {
  isJobPage: () => window.location.hostname.includes('simplyhired.com'),
  title: () => firstMatch(['h2 a.chakra-button', 'h1']),
  company: () => firstMatch(['span[data-testid="company-name"]', '.company-name']),
  location: () => firstMatch(['span[data-testid="location"]', '.location']),
  description: () => document.querySelector('div.css-1u3q0w0')?.innerText || document.querySelector('.job-description')?.innerText || null,
  url: () => {
    const jk = new URLSearchParams(window.location.search).get('jk') || new URLSearchParams(window.location.search).get('vjk');
    if (jk) return `https://www.simplyhired.com/job/${jk}`;
    return window.location.href;
  }
};

// ─── Monster scraper ─────────────────────────────────────────────────────────

const MONSTER_SCRAPER = {
  isJobPage: () => window.location.hostname.includes('monster.com'),
  title: () => firstMatch(['h1[class*="JobTitle"]', 'h1']),
  company: () => firstMatch(['[class*="company-link"]', '.company-name']),
  location: () => firstMatch(['[class*="job-location"]', '.location']),
  description: () => document.querySelector('[class*="description-style__Description"]')?.innerText || null,
};

// ─── CareerBuilder scraper ───────────────────────────────────────────────────

const CAREERBUILDER_SCRAPER = {
  isJobPage: () => window.location.hostname.includes('careerbuilder.com'),
  title: () => firstMatch(['.jdp_title', 'h1']),
  company: () => firstMatch(['.jdp_company_name', '.company-name']),
  location: () => firstMatch(['.jdp_location', '.location']),
  description: () => document.querySelector('.jdp_description')?.innerText || null,
};

// ─── MTA scraper ─────────────────────────────────────────────────────────────

const MTA_SCRAPER = {
  isJobPage: () => window.location.hostname.includes('mta.org'),
  title: () => firstMatch(['h1']),
  company: () => 'MTA',
  location: () => extractByLabel(/location:/i) || extractByLabel(/location/i),
  salary: () => extractByLabel(/salary range:/i) || extractByLabel(/salary:/i),
  datePosted: () => extractByLabel(/date posted:/i),
  description: () => document.querySelector('.description, #description, [class*="description"], .job-description')?.innerText || document.body.innerText,
};

// ─── Site registry & fallback ────────────────────────────────────────────────

const KERNEL_SCRAPER = {
  isJobPage: () => false,
  title: () => null,
  company: () => null,
  location: () => null,
  description: () => null,
};

const SCRAPERS = {
  'linkedin.com': LINKEDIN_SCRAPER,
  'indeed.com': INDEED_SCRAPER,
  'glassdoor.com': GLASSDOOR_SCRAPER,
  'ziprecruiter.com': ZIPRECRUITER_SCRAPER,
  'greenhouse.io': GREENHOUSE_SCRAPER,
  'lever.co': LEVER_SCRAPER,
  'wellfound.com': WELLFOUND_SCRAPER,
  'angel.co': WELLFOUND_SCRAPER,
  'myworkdayjobs.com': WORKDAY_SCRAPER,
  'simplyhired.com': SIMPLYHIRED_SCRAPER,
  'monster.com': MONSTER_SCRAPER,
  'careerbuilder.com': CAREERBUILDER_SCRAPER,
  'mta.org': MTA_SCRAPER,
  'localhost': KERNEL_SCRAPER,
};

const FALLBACK_SCRAPER = {
  isJobPage: () => {
    const text = document.body.innerText.toLowerCase();
    const commonJobKeywords = [
      'job description', 'apply for this job', 'qualifications', 'requirements', 
      'about the role', 'responsibilities', 'who you are', 'what you\'ll do',
      'desired skills', 'minimum qualifications', 'preferred qualifications',
      'pay range', 'compensation', 'benefits', 'equal opportunity employer'
    ];
    
    // Check if any significant number of keywords are present
    const matchCount = commonJobKeywords.filter(k => text.includes(k)).length;
    const isJob = matchCount >= 2 || text.includes('apply for this job') || text.includes('submit application');
    
    const isCompany = text.includes('about the company') || text.includes('company overview') || (text.includes('careers') && text.includes('location'));
    const isWellfound = window.location.hostname.includes('wellfound') && (window.location.pathname.includes('/company/') || window.location.pathname.includes('/jobs/'));
    
    // Also check URL for common job-related paths
    const path = window.location.pathname.toLowerCase();
    const isJobUrl = path.includes('/jobs/') || path.includes('/careers/') || path.includes('/openings/') || path.includes('/job/');

    return isJob || isCompany || isWellfound || isJobUrl;
  },
  title: () => {
    // Strategy 1: Look for elements with clear job-title classes or IDs
    const specific = firstMatch([
      '[class*="job-title"]', '[class*="JobTitle"]', '[id*="job-title"]',
      '.posting-header h2', '.app-title', '.jdp_title', 'h1.title'
    ]);
    if (specific) return specific;

    // Strategy 2: First H1 that isn't a logo
    const h1s = Array.from(document.querySelectorAll('h1'));
    for (const h1 of h1s) {
      const text = h1.innerText.trim();
      if (text.length > 3 && text.length < 100 && !/login|sign in|welcome/i.test(text)) return text;
    }
    
    // Strategy 3: Clean up page title
    return document.title.split(/[\|\-–]/)[0].trim();
  },
  company: () => {
    // Try to extract company from title or meta tags
    const ogCompany = document.querySelector('meta[property="og:site_name"]')?.content;
    if (ogCompany) return ogCompany;
    
    const titleParts = document.title.split(/[\|\-–]/);
    if (titleParts.length > 1) return titleParts[titleParts.length - 1].trim();
    
    return null;
  },
  location: () => {
    const fromLabel = extractByLabel(/location:/i) || extractByLabel(/location/i) || extractByLabel(/city:/i);
    if (fromLabel) return fromLabel;

    const patterns = [/location/i, /city/i, /remote/i];
    for (const p of patterns) {
      const el = findLeafText(t => p.test(t), 1)[0];
      if (el) {
        const val = el.el.nextElementSibling?.innerText?.trim() || el.el.parentElement?.innerText?.replace(p, '').trim();
        if (val && val.length < 50) return val;
      }
    }
    return null;
  },
  workplaceType: () => {
    const text = document.body.innerText.toLowerCase();
    if (text.includes('remote')) return 'Remote';
    if (text.includes('hybrid')) return 'Hybrid';
    return null;
  },
  description: () => {
    // Look for common container IDs
    const container = document.querySelector('#job-description, .job-description, #description, .description, main, article');
    if (container) return container.innerText;

    let largest = '';
    document.querySelectorAll('div, p, article').forEach(el => {
      if (el.innerText && el.innerText.length > largest.length && el.innerText.length < 20000) {
        largest = el.innerText;
      }
    });
    return largest || null;
  },
  type: () => null,
  salary: () => extractByLabel(/salary range:/i) || extractByLabel(/salary:/i) || extractByLabel(/compensation:/i) || extractByLabel(/pay range:/i),
  datePosted: () => extractByLabel(/date posted:/i) || extractByLabel(/posted on:/i) || extractByLabel(/posted:/i),
  companyLogo: () => {
    return document.querySelector('link[rel*="icon"]')?.href || document.querySelector('meta[property="og:image"]')?.content || null;
  },
  applyLink: () => {
    const applyBtn = Array.from(document.querySelectorAll('a, button')).find(el => /apply/i.test(el.innerText || el.value));
    return applyBtn?.href || applyBtn?.onclick ? window.location.href : null;
  },
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
  const rawUrl = scraper.url?.() || window.location.href;

  const locationType = inferLocationType(rawLocation, rawWorkplaceType) || null;
  const location = cleanLocation(rawLocation);
  const datePosted = parseRelativeDate(rawDatePosted);
  const deadlineParsed = parseRelativeDate(rawDeadline) || rawDeadline;

  return {
    title: rawTitle?.trim() || null,
    company: rawCompany?.trim() || null,
    companyLogo: rawCompanyLogo || null,
    link: rawUrl,
    applyLink: rawApplyLink || rawUrl,
    datePosted: datePosted || null,
    deadline: deadlineParsed || null,
    salaryRange: rawSalary?.trim() || null,
    description: rawDescription?.trim() || null,
    jobType: normaliseJobType(rawType),
    locationType: locationType || null,
    location: location || null,
    relocation: null,
    interestLevel: null,
    remarks: '',
    onPageConnections: scraper.networking?.() || [],
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
  try {
    return typeof chrome !== 'undefined' && chrome.runtime && !!chrome.runtime.id;
  } catch (e) {
    return false;
  }
}

function safeSendMessage(message, callback) {
  if (!isExtValid()) {
    if (callback) callback();
    return Promise.resolve();
  }
  // Expected errors when the side panel isn't open — suppress them to keep
  // the page console clean. Unexpected errors are still logged.
  const isBenignError = (err) => {
    const msg = err?.message || String(err);
    return msg.includes('Could not establish connection') ||
           msg.includes('Receiving end does not exist') ||
           msg.includes('The message port closed');
  };
  try {
    if (callback) {
      chrome.runtime.sendMessage(message, (response) => {
        if (!isExtValid()) return;
        if (chrome.runtime.lastError) {
          if (!isBenignError(chrome.runtime.lastError)) {
            console.warn('[JobAutomator] Message error:', chrome.runtime.lastError);
          }
        }
        if (callback) callback(response);
      });
    } else {
      const p = chrome.runtime.sendMessage(message);
      return p ? p.catch(e => { if (!isBenignError(e)) console.warn('[JobAutomator] Message async error:', e); }) : Promise.resolve();
    }
  } catch(e) {
    if (!isBenignError(e)) console.warn('[JobAutomator] Message sync error:', e);
    if (callback) callback();
    return Promise.resolve();
  }
}

function injectFloatingButton() {
  if (!isExtValid()) return;
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
          safeSendMessage({ action: 'close_side_panel' }, () => {
            if (chrome.runtime.lastError) console.warn(chrome.runtime.lastError);
            updateButtonState(btn, false);
          });
        } else {
          const jobData = scrapeJobData();
          console.log('[JobAutomator] Scraped Job Data:', jobData);
          extLog('INFO', `Scraped job data for ${jobData.company || 'Unknown Company'}`, { title: jobData.title, url: jobData.url });
          safeSendMessage({ action: 'open_and_store', data: jobData }, () => {
            if (chrome.runtime.lastError) console.warn(chrome.runtime.lastError);
            updateButtonState(btn, true);
            safeSendMessage({ action: 'refresh_panel_data' });
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
  try {
    // On fresh page load, the side panel is never open — reset stale storage.
    // This ensures the chevron icon always reflects true state from the start.
    chrome.storage.local.set({ isPanelOpen: false });
  } catch(e) {}

  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'panel_state_changed') {
      const btn = document.getElementById('job-automator-btn');
      updateButtonState(btn, message.isOpen);
    }
  });
}

function checkIfJobPage() {
  if (!isExtValid()) return;
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
// We track both the URL and common job identification parameters for SPA transitions
let lastJobIdValue = '';
let scrapeTimer = null;

function getJobIdFromUrl() {
  const url = window.location.href;
  const params = new URLSearchParams(window.location.search);
  
  // 1. Check common LinkedIn path pattern: /jobs/view/ID/
  const viewMatch = url.match(/\/jobs\/view\/([0-9]+)/);
  if (viewMatch && viewMatch[1]) return viewMatch[1];

  // 2. Check search parameters
  return params.get('jk') || params.get('vjk') || params.get('currentJobId') || params.get('jobId') || params.get('jobListingId') || params.get('jl') || params.get('lvk') || '';
}

lastJobIdValue = null; // Initialize as null to ensure first check triggers
lastJobUrl = null;

function handleJobNavigation() {
  if (!isExtValid()) return;
  try {
    safeSendMessage({ action: 'job_loading' }).catch(()=>{});
  } catch(e) {}

  clearTimeout(scrapeTimer);
  scrapeTimer = setTimeout(() => {
    const jobData = scrapeJobData();
    console.log('[JobAutomator] Auto-scraped new job:', jobData);
    extLog('INFO', `Auto-scraped job: ${jobData.title} @ ${jobData.company}`, { url: jobData.url });
    
    // Check for network matches if on LinkedIn
    if (window.location.hostname.includes('linkedin.com')) {
      processLinkedInConnections();
    }
    if (!isExtValid()) return;
    try {
      safeSendMessage({ action: 'store_job_data', data: jobData }, () => {
        if (chrome.runtime.lastError) {}
        safeSendMessage({ action: 'refresh_panel_data' }).catch(()=>{});
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
  const newId = getJobIdFromUrl();
  
  if (newUrl === lastJobUrl && newId === lastJobIdValue) return;
  
  lastJobUrl = newUrl;
  lastJobIdValue = newId;
  
  setTimeout(checkIfJobPage, 800);
  
  if (!isExtValid()) return;
  try {
    if (getScraper().isJobPage()) handleJobNavigation();
  } catch(e) {}
});

// 2. Lightweight ID poll (for sites that might change URL via hash or other means)
// Self-terminates if the extension context is invalidated (e.g. after a reload).
const urlPollInterval = setInterval(() => {
  if (!isExtValid()) {
    clearInterval(urlPollInterval);
    return;
  }

  const currentId = getJobIdFromUrl();
  const currentUrl = window.location.href;

  if (currentId === lastJobIdValue && currentUrl === lastJobUrl) return;

  lastJobIdValue = currentId;
  lastJobUrl = currentUrl;

  setTimeout(() => {
    if (isExtValid()) checkIfJobPage();
  }, 800);

  try {
    if (getScraper().isJobPage()) handleJobNavigation();
  } catch(e) {}
}, 1000);

// 3. Tab Visibility Tracker
// When the user swaps back to this tab, silently push the job data to the sidepanel
// so that the panel isn't showing a stale job from a different tab.
let lastSyncedJobId = null;
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    if (!isExtValid()) return;
    try {
      if (getScraper().isJobPage()) {
        const currentId = getJobIdFromUrl();
        const currentUrl = window.location.href;

        // Only trigger if the job ID actually changed OR we don't have a record of it
        // This prevents redundant "refresh_panel_data" when just flipping tabs for the same job.
        if (currentId && currentId === lastSyncedJobId && currentUrl === lastJobUrl) {
           return;
        }

        const jobData = scrapeJobData();
        lastSyncedJobId = currentId;
        lastJobUrl = currentUrl;

        safeSendMessage({ action: 'store_job_data', data: jobData }, () => {
          if (chrome.runtime.lastError) return;
          safeSendMessage({ action: 'refresh_panel_data' }).catch(()=>{});
        });
      }
    } catch(e) {}
  }
});

function initialScrape() {
  if (!isExtValid()) return;
  if (getScraper().isJobPage()) {
    handleJobNavigation();
  }
}

window.addEventListener('load', () => {
  checkIfJobPage();
  initialScrape();
});
// Navigation detection is fully covered by:
//   - The 1s urlPollInterval above
//   - The locationchange event listener (history API patch)
//   - The visibilitychange listener (tab switch detection)
// No additional polling intervals are needed.


// ─── Magic Fill ─────────────────────────────────────────────────────────────
// Note: No external font/icon CDN links are injected here.
// LinkedIn's CSP (style-src) blocks chrome-extension: and fonts.googleapis.com,
// so all icons use inline SVGs instead.

const FIELD_MAP = {
  first_name: ['first', 'fname', 'given-name'],
  last_name: ['last', 'lname', 'family-name', 'surname'],
  full_name: ['full_name', 'fullname', 'name'],
  email: ['email', 'mail'],
  phone: ['phone', 'tel', 'mobile', 'cell'],
  address: ['address', 'street'],
  city: ['city', 'town'],
  state: ['state', 'province', 'region'],
  zip_code: ['zip', 'postal', 'postcode'],
  linkedin: ['linkedin'],
  github: ['github'],
  website: ['portfolio', 'website', 'blog', 'site']
};

let activeHighlights = [];

function findFields() {
  const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]), textarea, select'));
  const matches = [];

  inputs.forEach(input => {
    // 1. Check direct attributes
    const attrs = [
      input.id, input.name, input.placeholder, 
      input.getAttribute('aria-label'), input.title, 
      input.autocomplete
    ].filter(Boolean).map(a => a.toLowerCase());

    // 2. Check associated label
    let labelText = '';
    if (input.id) {
      const label = document.querySelector(`label[for="${input.id}"]`);
      if (label) labelText = label.innerText.toLowerCase();
    }
    if (!labelText) {
      const parentLabel = input.closest('label');
      if (parentLabel) labelText = parentLabel.innerText.toLowerCase();
    }

    for (const [key, keywords] of Object.entries(FIELD_MAP)) {
      // Avoid matching "name" inside "password" or "password_confirmation"
      const isMatch = keywords.some(k => {
        const matchesAttr = attrs.some(a => {
          // If keyword is 'name', it must be nearly the whole word or start/end properly
          if (k === 'name' && (a.includes('password') || a.includes('secret') || a.includes('token') || a.includes('username') || a.includes('login'))) return false;
          return a.includes(k);
        });
        const matchesLabel = labelText.includes(k.replace('-', ' '));
        return matchesAttr || matchesLabel;
      });

      if (isMatch) {
        matches.push({ el: input, key });
        break; 
      }
    }
  });

  return matches;
}

function clearMagicHighlights() {
  activeHighlights.forEach(h => h.remove());
  activeHighlights = [];
  document.querySelectorAll('.kernel-magic-highlight').forEach(el => {
    el.classList.remove('kernel-magic-highlight');
  });
}

function injectMagicUI(allMatches, profile) {
  clearMagicHighlights();
  
  // Bug fix: Filter matches by available profile data so the count is accurate
  const matches = allMatches.filter(m => {
    const val = profile[m.key];
    return val && val.trim() !== '';
  });

  if (matches.length === 0) return;

  // Create human labels for the summary
  const fieldLabels = {
    first_name: 'First Name',
    last_name: 'Last Name',
    full_name: 'Full Name',
    email: 'Email',
    phone: 'Phone',
    address: 'Address',
    city: 'City',
    state: 'State',
    zip_code: 'Zip Code',
    linkedin: 'LinkedIn',
    github: 'GitHub',
    website: 'Portfolio/Website'
  };

  const detectedFieldsList = [...new Set(matches.map(m => fieldLabels[m.key] || m.key))].join(', ');

  // Create floating "Fill All" bar
  const bar = document.createElement('div');
  bar.className = 'kernel-magic-bar';
  bar.innerHTML = `
    <div class="kernel-magic-bar-content">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0">
        <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
      </svg>
      <div class="kernel-magic-info" title="Detected: ${detectedFieldsList}">
        <span>Found <strong>${matches.length}</strong> fields to auto-fill</span>
        <svg class="kernel-info-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      </div>
      <div class="kernel-magic-bar-actions">
        <button type="button" id="kernel-magic-fill-all" class="kernel-btn-primary">Fill All</button>
        <button type="button" id="kernel-magic-cancel" class="kernel-btn-secondary">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(bar);
  activeHighlights.push(bar);

  bar.querySelector('#kernel-magic-fill-all').onclick = () => {
    matches.forEach(m => fillField(m.el, profile[m.key]));
    clearMagicHighlights();
  };
  bar.querySelector('#kernel-magic-cancel').onclick = clearMagicHighlights;

  // Individual field highlights
  matches.forEach(m => {
    const val = profile[m.key];
    // redundant check but safe
    if (!val) return;

    m.el.classList.add('kernel-magic-highlight');
    
    // Preview badge
    const badge = document.createElement('div');
    badge.className = 'kernel-magic-badge';
    badge.innerHTML = `
      <span class="kernel-badge-text">Fill: ${val.length > 20 ? val.substring(0, 17) + '...' : val}</span>
      <button type="button" class="kernel-badge-btn" title="Fill this field">
        <span class="material-symbols-outlined" style="font-size: 14px;">check</span>
      </button>
    `;
    
    document.body.appendChild(badge);
    activeHighlights.push(badge);

    const updatePosition = () => {
      const rect = m.el.getBoundingClientRect();
      badge.style.top = `${window.scrollY + rect.top - 28}px`;
      badge.style.left = `${window.scrollX + rect.left}px`;
    };
    
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition);

    badge.querySelector('.kernel-badge-btn').onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      fillField(m.el, val);
      badge.remove();
      m.el.classList.remove('kernel-magic-highlight');
    };
  });
}

function fillField(el, value) {
  if (!el || !value) return;
  el.focus();
  if (el.tagName === 'SELECT') {
    // Try to match option
    const options = Array.from(el.options);
    const match = options.find(o => 
      o.value.toLowerCase() === value.toLowerCase() || 
      o.text.toLowerCase().includes(value.toLowerCase())
    );
    if (match) el.value = match.value;
  } else {
    el.value = value;
  }
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.blur();
}

// ── Context Menu Insertion ────────────────────────────────────────────────
let lastRightClickedElement = null;

document.addEventListener('contextmenu', (e) => {
  lastRightClickedElement = e.target;
}, true);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'insert_text') {
    const target = lastRightClickedElement || document.activeElement;
    if (!target) return;

    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      // Focus the element
      target.focus();

      if (target.isContentEditable) {
        document.execCommand('insertText', false, message.text);
      } else {
        // Find cursor position
        const start = target.selectionStart;
        const end = target.selectionEnd;
        const value = target.value;
        
        // Insert text
        target.value = value.substring(0, start) + message.text + value.substring(end);
        
        // Restore cursor
        target.selectionStart = target.selectionEnd = start + message.text.length;
      }

      // Dispatch events so the site's JS (React/Vue/etc) picks up the change
      target.dispatchEvent(new Event('input', { bubbles: true }));
      target.dispatchEvent(new Event('change', { bubbles: true }));
    }
  } else if (message.action === 'start_magic_fill') {
    const matches = findFields();
    injectMagicUI(matches, message.profile);
    sendResponse({ found: matches.length });
  }
});

// ── LinkedIn Network Matches ──────────────────────────────────────────────

let connectionCache = new Map(); // companyId or name -> matches
let lastActiveJobId = null;

async function getMatches(companyId, companyName) {
  const key = companyId || companyName;
  if (!key) return [];
  if (connectionCache.has(key)) return connectionCache.get(key);

  return new Promise((resolve) => {
    // Strategy: Try ID first if available. If no matches, try Name.
    const tryQuery = (id, name) => {
      const action = id ? 'CHECK_CONNECTIONS' : 'CHECK_CONNECTIONS_BY_NAME';
      const params = id ? { companyId: id } : { companyName: name };
      
      safeSendMessage({ action, ...params }, (response) => {
        const matches = response?.matches || [];
        if (matches.length > 0 || !name || (id && !name)) {
          connectionCache.set(key, matches);
          resolve(matches);
        } else if (id && name) {
          // Fallback to name search
          tryQuery(null, name);
        } else {
          connectionCache.set(key, []);
          resolve([]);
        }
      });
    };

    tryQuery(companyId, companyName);
  });
}

async function processLinkedInConnections() {
  if (!isExtValid()) return;
  if (!LINKEDIN_SCRAPER.isJobPage()) return;
  if (isProcessingConnections) return;
  isProcessingConnections = true;
  try {
    // 1. Current Job Banner
    const jobId = new URLSearchParams(window.location.search).get('currentJobId');
    if (jobId && (jobId !== lastActiveJobId || !document.getElementById('kernel-connection-banner'))) {
      const companyName = LINKEDIN_SCRAPER.company();
      const companyId = LINKEDIN_SCRAPER.companyId();

      if (companyName || companyId) {
        lastActiveJobId = jobId;
        const matches = await getMatches(companyId, companyName);
        renderConnectionBanner(matches, companyName);
      }
    }

    // 2. Proactively update side panel on-page connections
    const onPage = LINKEDIN_SCRAPER.networking?.() || [];
    if (onPage.length > 0) {
      chrome.storage.local.get(['latestJobData'], (result) => {
        if (result.latestJobData) {
          const updatedData = { ...result.latestJobData, onPageConnections: onPage };
          chrome.storage.local.set({ latestJobData: updatedData }, () => {
            safeSendMessage({ action: 'refresh_on_page_connections', onPageConnections: onPage });
          });
        }
      });
    }

    // 3. Job List Highlights (rate-limited separately)
    highlightConnectionsInList();
  } finally {
    isProcessingConnections = false;
  }
}

function renderConnectionBanner(matches, companyName) {
  // Remove existing banner
  const existing = document.getElementById('kernel-connection-banner');
  if (existing) existing.remove();
  
  if (!matches || matches.length === 0) return;
  
  const root = getLIRoot();
  const topCard = root.querySelector('.jobs-unified-top-card') || root.querySelector('.job-details-jobs-unified-top-card');
  if (!topCard) return;
  
  const banner = document.createElement('div');
  banner.id = 'kernel-connection-banner';
  banner.className = 'kernel-connection-banner';
  
  const match = matches[0];
  const othersCount = matches.length - 1;
  const othersText = othersCount > 0 ? ` and ${othersCount} other${othersCount > 1 ? 's' : ''}` : '';
  
  banner.innerHTML = `
    <div class="kernel-banner-inner">
      <div class="kernel-banner-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
      </div>
      <div class="kernel-banner-text">
        <span class="kernel-banner-strong">Network Connection Found:</span>
        <a href="${match.profile_url}" target="_blank" class="kernel-banner-link">${match.name}</a>${othersText} at ${companyName || 'this company'}
      </div>
      <button class="kernel-banner-close" onclick="this.parentElement.parentElement.remove()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"></path></svg>
      </button>
    </div>
  `;
  
  // Prepend to top card
  topCard.insertBefore(banner, topCard.firstChild);
}

let lastListHighlight = 0;
const LIST_HIGHLIGHT_INTERVAL = 5000; // At most once per 5 seconds

async function highlightConnectionsInList() {
  const now = Date.now();
  if (now - lastListHighlight < LIST_HIGHLIGHT_INTERVAL) return;
  lastListHighlight = now;

  const listItems = document.querySelectorAll('.jobs-search-results-list__item, .scaffold-layout__list-item, .job-card-container');
  
  for (const item of listItems) {
    if (item.dataset.kernelProcessed) continue;
    
    const companyLink = item.querySelector('a[href*="/company/"]');
    const companyNameEl = item.querySelector('.job-card-container__company-name, .artdeco-entity-lockup__subtitle, .job-card-container__primary-description');
    
    if (!companyLink && !companyNameEl) continue;
    
    // Mark as processed to avoid double-querying immediately
    item.dataset.kernelProcessed = 'true';
    
    const companyIdMatch = companyLink ? companyLink.href.match(/\/company\/([^/?#]+)/) : null;
    const companyId = companyIdMatch ? companyIdMatch[1] : null;
    
    const companyName = companyNameEl?.innerText?.trim();
    
    if (companyId || companyName) {
      const matches = await getMatches(companyId, companyName);
      if (matches && matches.length > 0) {
        addConnectionIndicator(item, matches);
      }
    } else {
      delete item.dataset.kernelProcessed;
    }
  }
}

function addConnectionIndicator(item, matches) {
  // Check if indicator already exists
  if (item.querySelector('.kernel-list-indicator')) return;
  
  const count = matches.length;
  // Get names, cap at 3 for tooltip
  const names = matches.slice(0, 3).map(m => m.name);
  let namesStr = names.join(', ');
  if (count > 3) {
    namesStr += ` and ${count - 3} others`;
  }
  
  const tooltipText = `${count} network connection${count > 1 ? 's' : ''}:\n${namesStr}`;
  
  const indicator = document.createElement('div');
  indicator.className = 'kernel-list-indicator';
  indicator.setAttribute('data-tooltip', tooltipText);
  indicator.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
      <circle cx="9" cy="7" r="4"></circle>
    </svg>
  `;

  // Find a good spot to place it - usually near the company logo or title
  const target = item.querySelector('.job-card-list__entity-lockup, .job-card-container__content-container, .job-card-list__title');
  if (target) {
    target.style.position = 'relative';
    target.appendChild(indicator);
    item.classList.add('kernel-match-highlight');
  } else {
    // fallback if internal structure is different
    item.style.position = 'relative';
    item.appendChild(indicator);
  }
}

// ── Mutation Observer to handle SPA navigation ──────────────────────────

let connectionTimeout = null;
let lastConnectionProcess = 0;
const THROTTLE_MS = 2000; // LinkedIn fires DOM mutations constantly — 2s is sufficient to catch new cards
let isProcessingConnections = false;

const connectionObserver = new MutationObserver((mutations) => {
  // Self-disconnect if extension context is gone
  if (!isExtValid()) {
    connectionObserver.disconnect();
    return;
  }

  // Check if a modal was added (triggers re-scrape of networking people)
  const modalAdded = mutations.some(m => 
    Array.from(m.addedNodes).some(n => 
      n.nodeType === 1 && (n.matches?.('.artdeco-modal, [role="dialog"]') || n.querySelector?.('.artdeco-modal, [role="dialog"]'))
    )
  );

  if (modalAdded) {
    console.log('[JobAutomator] Modal detected — re-scraping data.');
    const jobData = scrapeJobData();
    chrome.storage.local.set({ latestJobData: jobData });
  }

  const now = Date.now();
  if (now - lastConnectionProcess > THROTTLE_MS) {
    lastConnectionProcess = now;
    if (!isProcessingConnections) processLinkedInConnections();
  } else {
    clearTimeout(connectionTimeout);
    connectionTimeout = setTimeout(() => {
      lastConnectionProcess = Date.now();
      if (!isProcessingConnections) processLinkedInConnections();
    }, THROTTLE_MS);
  }
});
// ── URL Observer to handle LinkedIn list clicks ───────────────────────

let lastUrl = window.location.href;
const urlObserver = new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    const oldId = new URLSearchParams(new URL(lastUrl).search).get('currentJobId');
    const newId = new URLSearchParams(window.location.search).get('currentJobId');
    lastUrl = window.location.href;
    
    if (newId && newId !== oldId && LINKEDIN_SCRAPER.isJobPage()) {
      console.log('[JobAutomator] Job selection changed — re-scraping.');
      // Give the DOM a moment to settle
      setTimeout(() => {
        if (!isExtValid()) return;
        const jobData = scrapeJobData();
        if (jobData) {
          console.log('[JobAutomator] Auto-scraped data:', jobData);
          extLog('INFO', `Auto-scraped data for ${jobData.company || 'Unknown'}`, { title: jobData.title });
          chrome.storage.local.set({ latestJobData: jobData }, () => {
            if (isExtValid() && chrome.runtime.lastError) {
              console.log('[JobAutomator] Storage set result check: FAILED');
            }
          });
          safeSendMessage({ action: 'store_job_data', data: jobData });
        }
      }, 1000);
    }
  }
});

if (LINKEDIN_SCRAPER.isJobPage()) {
  connectionObserver.observe(document.body, { childList: true, subtree: true });
  urlObserver.observe(document.querySelector('title') || document.head, { childList: true });
  
  // Also poll slightly for URL because popstate/mutation isn't always reliable on all SPAs
  const urlPollInterval2 = setInterval(() => {
    if (!isExtValid()) {
      clearInterval(urlPollInterval2);
      return;
    }
    if (window.location.href !== lastUrl) {
      const u = new URL(window.location.href);
      const oldId = new URLSearchParams(new URL(lastUrl).search).get('currentJobId');
      const newId = u.searchParams.get('currentJobId');
      
      if (newId && newId !== oldId) {
        lastUrl = window.location.href;
        console.log('[JobAutomator] URL change detected (poll) — re-scraping.');
        setTimeout(() => {
          if (!isExtValid()) return;
          const jobData = scrapeJobData();
          if (jobData) {
            chrome.storage.local.set({ latestJobData: jobData });
            safeSendMessage({ action: 'store_job_data', data: jobData });
          }
        }, 1200);
      }
    }
  }, 1500);

  // Initial run
  setTimeout(processLinkedInConnections, 500);
}

// ── App Interaction ─────────────────────────────────────────────────────────

window.addEventListener('JOB_KERNEL_APP_UPDATED', (e) => {
  if (!isExtValid()) return;
  try {
    safeSendMessage({ 
      action: 'app_updated', 
      application_id: e.detail?.application_id 
    });
  } catch (err) {}
});

// ─── Authentication Sync ───────────────────────────────────────────────────

/**
 * JobKernel Auth Sync:
 * If we are on the JobKernel web app, listen for changes to the 'token' in localStorage
 * and sync it to chrome.storage.local so the extension sidepanel can use it.
 */
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  console.log('[JobKernel] Auth sync active on web app');

  // Listen for messages from the web app
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data && event.data.type === 'JOB_AUTOMATOR_SCRAPE_LINKEDIN') {
      if (!isExtValid()) {
        console.warn('[JobKernel] Extension context invalidated. Please refresh the page.');
        return;
      }
      console.log('[JobKernel] Received scrape request from web app');
      try {
        chrome.runtime.sendMessage({ action: 'SCRAPE_LINKEDIN_PROFILE' }, (response) => {
          // Even if context is invalidated, window.postMessage is a DOM API and safe
          window.postMessage({
            type: 'JOB_AUTOMATOR_SCRAPE_LINKEDIN_RESPONSE',
            response: response
          }, '*');
        });
      } catch (err) {
        console.warn('[JobKernel] Failed to send message to extension:', err);
      }
    }
  });


  const isJobKernelApp = () => {
    // Only sync if we're fairly sure this is the JobKernel app
    return document.title.includes('JobKernel') || 
           !!document.querySelector('meta[name="description"][content*="JobKernel"]') ||
           !!document.querySelector('img[src*="job-kernel-logo"]') ||
           (window.location.hostname === 'localhost' && window.location.port === '5173');
  };

  const syncToken = () => {
    if (!isExtValid() || !isJobKernelApp()) return;
    
    const token = localStorage.getItem('token');
    // Only sync if the token exists and looks like a valid credential (length check)
    if (token && token.length > 20 && token !== 'null' && token !== 'undefined') {
      const apiUrl = document.querySelector('meta[name="jobkernel-api-url"]')?.content;
      const appUrl = document.querySelector('meta[name="jobkernel-app-url"]')?.content;
      
      const storageUpdate = { token };
      if (apiUrl) storageUpdate.jobkernelApiUrl = apiUrl;
      if (appUrl) storageUpdate.jobkernelAppUrl = appUrl;

      chrome.storage.local.set(storageUpdate, () => {
        console.log('[JobKernel] Auth and URLs synced to extension');
      });
    }
    // We explicitly DO NOT remove the token if it's missing in localStorage here,
    // to avoid clearing a manually-pasted key when visiting other localhost apps.
  };

  // Sync once on load
  if (isJobKernelApp()) {
    syncToken();

    // Listen for storage events (if changed in another tab)
    window.addEventListener('storage', (e) => {
      if (e.key === 'token') syncToken();
    });

    // Since React might update localStorage without triggering a 'storage' event in the same tab,
    // we poll occasionally. Polling is safer than patching setItem.
    const authSyncInterval = setInterval(() => {
      if (!isExtValid()) {
        clearInterval(authSyncInterval);
        return;
      }
      syncToken();
    }, 5000); // Polling every 5s is plenty for auth sync
  }
}
