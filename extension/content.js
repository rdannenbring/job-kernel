// ─── Dynamic Debug Logger Monkeypatch ────────────────────────────────────────
(function() {
  let isDebugEnabled = false;

  const initDebug = () => {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['enableDebug'], (result) => {
          isDebugEnabled = !!result.enableDebug;
        });
        
        chrome.storage.onChanged.addListener((changes, namespace) => {
          if (namespace === 'local' && changes.enableDebug) {
            isDebugEnabled = !!changes.enableDebug.newValue;
          }
        });
      }
    } catch (e) {}
  };
  initDebug();

  const originalLog = console.log;
  const originalError = console.error;

  console.log = function(...args) {
    originalLog.apply(console, args);
    try {
      if (isDebugEnabled && args[0] && typeof args[0] === 'string' && args[0].startsWith('[JobKernel-Debug]')) {
        const message = args[0];
        const context = args.slice(1);
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
          chrome.runtime.sendMessage({
            action: 'log',
            level: 'DEBUG',
            message: `[Content-Debug] ${message}`,
            context: context.length > 0 ? JSON.stringify(context) : null
          }).catch(() => {});
        }
      }
    } catch (e) {}
  };

  console.error = function(...args) {
    originalError.apply(console, args);
    try {
      if (isDebugEnabled && args[0] && typeof args[0] === 'string' && args[0].startsWith('[JobKernel-Debug]')) {
        const message = args[0];
        const context = args.slice(1);
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
          chrome.runtime.sendMessage({
            action: 'log',
            level: 'ERROR',
            message: `[Content-Error] ${message}`,
            context: context.length > 0 ? JSON.stringify(context) : null
          }).catch(() => {});
        }
      }
    } catch (e) {}
  };
})();

// ─── Utility helpers ────────────────────────────────────────────────────────
function getDynamicLeftPanel() {
    const cards = Array.from(document.querySelectorAll('li[data-occludable-job-id], div[data-job-id], .job-card-container, [class*="job-card-list"]'));
    const applyBtn = document.querySelector('.jobs-apply-button, button[data-control-name="jobdetails_apply_btn"]');
    if (cards.length > 0) {
        let parent = cards[0].parentElement;
        let bestCandidate = null;
        while (parent && parent !== document.body && parent !== document.documentElement) {
            // As long as the parent doesn't contain the apply button and isn't the full screen width
            if (!applyBtn || !parent.contains(applyBtn)) {
                if (parent.getBoundingClientRect().width < window.innerWidth * 0.6) {
                    bestCandidate = parent;
                } else {
                    break; // stop going up once it spans the screen
                }
            } else {
                break; // stop going up once we hit a wrapper containing both
            }
            parent = parent.parentElement;
        }
        if (bestCandidate) return bestCandidate;
    }
    return document.querySelector('ul.jobs-search-results__list, [class*="scaffold-layout__list"], .jobs-search-results-list');
}

function isLeftPanel(el) {
  if (!el || !el.closest) return false;
  
  // 1. Direct dynamic left panel rejection
  const leftPanel = getDynamicLeftPanel();
  if (leftPanel && leftPanel.contains(el)) return true;
  
  // 2. Direct right pane containment check
  if (typeof getLIRoot === 'function') {
    const rightPane = getLIRoot();
    if (rightPane && rightPane !== document && rightPane.id !== 'workspace') {
      const cls = rightPane.className || '';
      if (!cls.includes('scaffold-layout__main') && !cls.includes('job-view-layout')) {
        if (!rightPane.contains(el)) return true;
      }
    }
  }
  
  // 3. Fallback checks
  return !!el.closest('ul, li, [class*="jobs-search-results"], [class*="scaffold-layout__list"], [class*="job-card"], [data-job-id], [class*="job-list"]');
}

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
    const els = Array.from(root.querySelectorAll(sel));
    const isGiantContainer = root === document || root.id === 'workspace' || (root.className && typeof root.className.includes === 'function' && root.className.includes('main'));
    const iterable = isGiantContainer ? els.reverse() : els;
    for (const el of iterable) {
      const text = el?.innerText?.trim();
      // Skip generic UI buttons that might get caught by broad selectors
      if (text && /^(show more|show all|follow|save|apply|report|message|share|about)$/i.test(text)) continue;
      // Skip left panel elements dynamically
      if (isLeftPanel(el)) continue;
      if (typeof isVisible === 'function' && !isVisible(el)) continue;
      if (text && text.length > 0 && !text.includes('Be an early applicant')) return text;
    }
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
  while ((node = walker.nextNode())) {
    if (node.children.length === 0) {
      const text = node.innerText?.trim();
      if (text && predicate(text)) {
        results.push({ el: node, text, cls: node.className || '' });
      }
    }
  }
  const isGiantContainer = root === document || root.id === 'workspace' || (root.className && typeof root.className.includes === 'function' && root.className.includes('main'));
  if (isGiantContainer) results.reverse();
  return results.slice(0, limit);
}

function isVisible(el) {
  if (!el) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
  if (style.display !== 'contents') {
     const rect = el.getBoundingClientRect();
     if (rect.width === 0 || rect.height === 0) return false;
  }
  return true;
}

const getLIRoot = () => {
  // First, identify the tightest known selectors for the right pane
  const tightSelectors = [
    '.scaffold-layout__detail',
    '.jobs-details',
    '.jobs-search__job-details--container',
    '[class*="description-container--two-pane"]',
    '.job-details-jobs-unified-top-card',
    '[class*="job-details-jobs-unified-top-card"]',
    '[class*="jobs-unified-top-card"]',
    '.top-card-layout'
  ];
  
  for (const sel of tightSelectors) {
    const els = Array.from(document.querySelectorAll(sel));
    for (let i = els.length - 1; i >= 0; i--) {
      if (isVisible(els[i])) return els[i];
    }
  }
  
  // Identify the left panel so we can avoid it
  const leftPanel = typeof getDynamicLeftPanel === "function" ? getDynamicLeftPanel() : null;
  
  // Dynamic fallback: Find the newest Apply button and grab its container
  const applyBtns = Array.from(document.querySelectorAll('.jobs-apply-button, button[data-control-name="jobdetails_apply_btn"], button.jobs-apply-button--light'));
  for (let i = applyBtns.length - 1; i >= 0; i--) {
      if (isVisible(applyBtns[i])) {
          let container = null;
          let testNode = applyBtns[i].parentElement;
          while (testNode && testNode !== document.body) {
              if (leftPanel && testNode.contains(leftPanel)) break;
              // If the container spans almost the whole screen, it's wrapping the left panel too.
              if (testNode.getBoundingClientRect().width > window.innerWidth * 0.85) break;
              container = testNode;
              testNode = testNode.parentElement;
          }
          if (container) return container;
      }
  }
  
  // Dynamic fallback: Find newest h1
  const h1s = Array.from(document.querySelectorAll('h1'));
  for (let i = h1s.length - 1; i >= 0; i--) {
      if (isVisible(h1s[i])) {
          let container = null;
          let testNode = h1s[i].parentElement;
          while (testNode && testNode !== document.body) {
              if (leftPanel && testNode.contains(leftPanel)) break;
              if (testNode.getBoundingClientRect().width > window.innerWidth * 0.85) break;
              container = testNode;
              testNode = testNode.parentElement;
          }
          if (container) return container;
      }
  }
  
  // Absolute final fallbacks for standalone views (will cause bleeding if in split view, but better than document)
  const broadSelectors = ['.scaffold-layout__main', '.job-view-layout', '#workspace'];
  for (const sel of broadSelectors) {
    const els = Array.from(document.querySelectorAll(sel));
    for (let i = els.length - 1; i >= 0; i--) {
      if (isVisible(els[i])) return els[i];
    }
  }
  
  return document;
};

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

  title: () => {
    const root = getLIRoot();
    const t = firstMatch([
    'h1 a',
    '.job-details-jobs-unified-top-card__job-title h1',
    '.job-details-jobs-unified-top-card__job-title h2',
    '.job-details-jobs-unified-top-card__job-title-link',
    '.job-details-jobs-unified-top-card__job-title',
    '.jobs-unified-top-card__job-title h1',
    '.jobs-unified-top-card__job-title h2',
    '.jobs-unified-top-card__job-title a',
    '.jobs-unified-top-card__job-title',
    '[class*="job-title"] h1',
    '[class*="job-title"] h2',
    '[class*="job-title"] a',
    '[class*="job-title"]',
    'h1[class*="job-title"]',
    'h2[class*="job-title"]',
    'h1.top-card-layout__title',
    'h2.top-card-layout__title',
    '.top-card-layout__title',
    '.t-24.t-bold',
    'h1.t-24',
    'h2.t-24',
    'h1',
    '[class*="top-card"] h1',
    '[class*="top-card"] h2',
    '.jobs-search__job-details--container h1'
  ], root);
    if (t) return t;
    
    // Fallback: Find largest text node in right pane
    let largest = null;
    let maxFontSize = 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.children.length === 0 && node.innerText?.trim()) {
        if (isLeftPanel(node)) continue;
        const style = window.getComputedStyle(node);
        const size = parseFloat(style.fontSize) || 0;
        if (size > maxFontSize) {
          maxFontSize = size;
          largest = node;
        }
      }
    }
    return largest?.innerText?.trim() || null;
  },

  company: () => {
    const root = getLIRoot();
    let c = firstMatch([
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
  ], root);
    
    if (!c) {
      // Fallback: look for a company link
      const links = Array.from(root.querySelectorAll('a[href*="/company/"]'));
      const isGiantContainer = root === document || root.id === 'workspace' || (root.className && typeof root.className.includes === 'function' && root.className.includes('main'));
      const iterable = isGiantContainer ? links.reverse() : links;
      for (const link of iterable) {
         if (isLeftPanel(link)) continue;
         const text = link.innerText?.trim();
         if (text && !/premium|see all|follow|show more/i.test(text)) {
             c = text;
             break;
         }
      }
    }
    
    if (c) {
        c = c.replace(/[\n\r]+/g, ' ');
        c = c.replace(/(?:·\s*)?\d+(?:,\d+)*(?:\.\d+)?\s*(?:followers|alumni).*/i, '').trim();
        return c;
    }
    return null;
  },

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
    const explicitLocs = Array.from((root === document ? document : root).querySelectorAll('.job-details-jobs-unified-top-card__location'));
    for (let i = explicitLocs.length - 1; i >= 0; i--) {
        if (isVisible(explicitLocs[i]) && explicitLocs[i]?.innerText?.trim()) return explicitLocs[i].innerText.trim();
    }

    // Strategy 2: parse the primary-description row or find by traversing from clue nodes
    const primaryDescs = Array.from(root.querySelectorAll('[class*="primary-description"]'));
    const primaryDesc = primaryDescs[primaryDescs.length - 1]; // get the newest one
    if (primaryDesc) {
      const text = primaryDesc.innerText || '';
      const split = text.split('·');
      if (split.length >= 1) {
          let loc = split[0].replace(/\((remote|hybrid|on-site)\)/gi, '').trim();
          if (loc && !/\d/.test(loc) && !/reposted|promoted|applicant|apply|early|fast/i.test(loc)) return loc;
      }
    }

    // Strategy 2.5: Find clue words and traverse up
    const clueNodes = findLeafText(t => /ago|applicant|reposted|promoted|clicked/i.test(t), 10, root);
    for (const node of clueNodes) {
        // Exclude left panel list items
        if (isLeftPanel(node.el)) continue;
        if (typeof isVisible === 'function' && !isVisible(node.el)) continue;
        let parent = node.el.parentElement;
        for (let i = 0; i < 4 && parent; i++) {
            const text = parent.innerText || '';
            if (text.includes('·')) {
                const split = text.split('·');
                if (split.length >= 1) {
                    let loc = split[0].replace(/\((remote|hybrid|on-site)\)/gi, '').trim();
                    // Split sometimes gives "Company Name\nLocation" if they are in the same block
                    if (loc.includes('\n')) loc = loc.split('\n').pop().trim();
                    if (loc && !/\d/.test(loc) && !/reposted|promoted|click|viewed|applicant|apply|early|fast/i.test(loc)) return loc;
                }
            }
            parent = parent.parentElement;
        }
    }
    
    // Advanced Fallback: Search for common city/state formats near the top of the right pane
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let n;
    const walkerNodes = [];
    while ((n = walker.nextNode())) {
        if (n.children.length === 0 && n.innerText?.trim()) {
            walkerNodes.push(n);
        }
    }
    const isGiant = root === document || root.id === 'workspace' || (root.className && typeof root.className.includes === 'function' && root.className.includes('main'));
    if (isGiant) walkerNodes.reverse();
    
    for (const n of walkerNodes) {
        if (isLeftPanel(n)) continue;
        if (typeof isVisible === 'function' && !isVisible(n)) continue;
        const t = n.innerText.trim();
        // Matches "City, State", "City, Country", "Remote", "United States", etc.
        // It must be relatively short to be a location
        if (t.length > 2 && t.length < 40 && !/\d/.test(t) && !/click|apply|save|about|show|people|viewed|applicant|early|fast/i.test(t)) {
            // Check if it matches City, ST pattern or known large regions
            if (/, \w{2}$/.test(t) || /, \w{2,}/.test(t) || /remote/i.test(t) || /united states/i.test(t)) {
                return t.replace(/\((remote|hybrid|on-site)\)/gi, '').trim();
            }
        }
    }

    // Strategy 3: Top-card layout flavors
    const flavors = Array.from(document.querySelectorAll('#workspace [class*="flavor"], .top-card-layout__first-subline .topcard__flavor, .topcard__flavor--bullet'));
    for (const flavor of flavors.reverse()) {
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

    extLog('WARNING', 'Workplace extraction FAILED', { url: window.location.href });
    console.warn('[JobAutomator] Workplace extraction FAILED.');
    return null;
  },

  description: () => {
    const root = getLIRoot();
    const desc = firstMatch([
    '.jobs-description__content .jobs-box__html-content',
    '.jobs-description-content__text--large',
    '.jobs-description-content__text',
    '#job-details',
    '.description__text',
    '.show-more-less-html__markup',
    '[class*="job-description"]',
    '.jobs-box__html-content',
    '.jobs-details__main-content',
  ], root);
    if (desc) return desc;

    // Fallback 1: Look for "About the job" header specifically
    const headers = Array.from(root.querySelectorAll('h2, h3, div, span, strong, b'));
    for (const h of headers) {
        if (isLeftPanel(h)) continue;
        if (typeof isVisible === 'function' && !isVisible(h)) continue;
        const text = h.innerText?.trim()?.toLowerCase() || '';
        if (text === 'about the job' || text === 'job description' || text === 'description') {
            // Found the header! The description is usually the sibling, or the parent contains both
            // Let's go up a couple levels and find the container that holds the actual paragraphs
            let container = h.parentElement;
            let bestText = container.innerText || '';
            
            // Go up until we have at least 300 characters of text, but don't go too far
            let levels = 0;
            while (container && container !== document.body && levels < 4) {
                const inner = container.innerText || '';
                // If it suddenly becomes massive (contains the whole page), stop
                if (inner.length > 30000) break;
                // If it contains the left panel text, stop
                if (inner.includes('Jobs that match your profile')) break;
                
                bestText = inner;
                if (bestText.length > 500) break; // Found a good sized description block
                
                container = container.parentElement;
                levels++;
            }
            if (bestText.length > 100) return bestText.trim();
        }
    }

    // Fallback 2: Find the element with the most text in the right pane, completely ignoring anything that touches the left side of the screen
    let largest = null;
    let maxLength = 0;
    const candidates = root.querySelectorAll('div, section, article, main');
    const applyBtn = root.querySelector('.jobs-apply-button, button[data-control-name="jobdetails_apply_btn"]');
    const rightPaneMinX = applyBtn ? applyBtn.getBoundingClientRect().x - 400 : window.innerWidth * 0.3;
    
    for (const el of candidates) {
       if (el === document.body || el.id === 'workspace' || el.tagName.toLowerCase() === 'main') continue;
       if (el.className && typeof el.className.includes === 'function' && el.className.includes('scaffold-layout')) continue;
       if (isLeftPanel(el)) continue;
       if (typeof isVisible === 'function' && !isVisible(el)) continue;
       
       const rect = el.getBoundingClientRect();
       if (rect.width === 0 || rect.height === 0) continue; // Ignore display:contents wrappers
       
       // If it's a split view (we guess based on apply button position), reject anything that starts on the far left
       if (rightPaneMinX > 100 && rect.x < rightPaneMinX) continue;
       
       const text = el.innerText?.trim() || '';
       if (text.includes('Jobs that match your profile')) continue; // Explicitly reject left panel leakage
       
       if (text.length > maxLength && text.length > 200 && text.length < 30000) {
           maxLength = text.length;
           largest = el;
       }
    }
    return largest?.innerText?.trim() || null;
  }, // Search from document to avoid issues with isolated roots

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
      if (isLeftPanel(el)) continue;
      if (typeof isVisible === 'function' && !isVisible(el)) continue;
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

    extLog('WARNING', 'Job Type extraction FAILED', { url: window.location.href });
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
      if (isLeftPanel(el)) continue;
      if (typeof isVisible === 'function' && !isVisible(el)) continue;
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
      const salaryRegex = /(?:[\$\£\€\¥]|USD|EUR|GBP)?\s*[\d,]+(?:\.\d+)?\s*(?:[kK]|m|M)?\s*(?:\/(?:yr|hr|month|year|hour|annum|wk|week))?\s*(?:[-–]|to|and)\s*(?:[\$\£\€\¥]|USD|EUR|GBP)?\s*[\d,]+(?:\.\d+)?\s*(?:[kK]|m|M)?\s*(?:\/(?:yr|hr|month|year|hour|annum|wk|week))?|(?:[\$\£\€\¥]|USD|EUR|GBP)\s*[\d,]+(?:\.\d+)?\s*(?:[kK]|m|M)?\s*(?:\/(?:yr|hr|month|year|hour|annum|wk|week))?/gi;
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

    // Strategy 1.5: Broad scan for "ago" or "just now"
    const timeNodes = findLeafText(
      t => (t.includes('ago') && /\d+/.test(t)) || /just now/i.test(t),
      15, root
    );
    for (const node of timeNodes) {
        if (!isLeftPanel(node.el)) {
            return node.text;
        }
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
    const isGiantContainer = root === document || root.id === 'workspace' || (root.className && typeof root.className.includes === 'function' && root.className.includes('main'));
    for (const sel of selectors) {
      const imgs = Array.from(root.querySelectorAll(sel));
      const iterable = isGiantContainer ? imgs.reverse() : imgs;
      for (const img of iterable) {
        if (isLeftPanel(img)) continue;
        if (typeof isVisible === 'function' && !isVisible(img)) continue;
        if (img?.src && !img.src.includes('data:') && img.src.includes('http')) {
          return img.src;
        }
      }
    }
    
    // Fallback block - look inside top card
    const topCards = Array.from(root.querySelectorAll('[class*="unified-top-card"]'));
    const topCard = topCards[topCards.length - 1];
    if (topCard) {
      const cardImg = Array.from(topCard.querySelectorAll('img')).find(isVisible);
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
                const photoUrl = imgEl ? (
                    imgEl.getAttribute('data-delayed-url') ||
                    imgEl.getAttribute('srcset')?.split(',')[0].split(' ')[0] ||
                    (imgEl.src && !imgEl.src.includes('ghost_person') && !imgEl.src.startsWith('data:') ? imgEl.src : null)
                ) : null;

                connections.push({
                    name: name,
                    headline: headlineEl?.innerText.trim() || '',
                    profile_url: profileUrl,
                    degree: degree,
                    is_alumni: isAlumni,
                    photo_url: (photoUrl && photoUrl.includes('http')) ? photoUrl : null
                });
            }
        });
    });

    // 2. Check the Job Details pane (root)
    const root = getLIRoot();
    
        // Strategy 2a: Broad Initial Networking Scan
    // Scan the entire job details pane for any profile links that are accompanied by photos
    const allProfileLinks = root.querySelectorAll('a[href*="/in/"]');
    allProfileLinks.forEach(link => {
        const profileUrl = link.href.split('?')[0];
        if (connections.some(c => c.profile_url === profileUrl)) return;

        // Check if this link is part of a networking-related section
        const section = link.closest('.jobs-people-who-can-help-section, [class*="people-who-can-help"], .jobs-facepile-list, .jobs-poster, [class*="networking"], [class*="facepile"]');
        if (!section) return;

        // Find the image. It might be inside the link, a sibling, or nearby in a facepile
        const firstName = link.innerText.trim().split(' ')[0];
        // Also check <picture> elements LinkedIn often uses for lazy-loading
        const picEl = link.querySelector('picture') ||
                      link.parentElement.querySelector('picture') ||
                      section.querySelector('picture');
        const imgInPic = picEl ? picEl.querySelector('img') : null;
        const img = link.querySelector('img') || 
                    link.parentElement.querySelector('img') ||
                    imgInPic ||
                    (firstName ? section.querySelector(`img[alt*="${firstName}"]`) : null) ||
                    section.querySelector('img');
        
        const rawUrl = img ? (
            img.getAttribute('data-delayed-url') ||
            img.getAttribute('srcset')?.split(',')[0].split(' ')[0] ||
            (img.src && !img.src.includes('ghost_person') && !img.src.startsWith('data:') ? img.src : null)
        ) : null;

        // Accept http URLs — data-delayed-url is always http, img.src ghosts are data: URIs
        const photoUrl = (rawUrl && rawUrl.includes('http')) ? rawUrl : null;
        if (!photoUrl) return;

        let name = link.innerText.trim();
        // Handle "Alexa and 4 others"
        if (name.includes(' and ')) name = name.split(' and ')[0].trim();
        // If name is just "1st" or "2nd", try image alt
        if (!name || name.length < 2 || /^\d[nsrt][tdh]$/i.test(name)) {
            name = img.alt ? img.alt.replace('Avatar of ', '').split(',')[0].trim() : '';
        }
        
        // If still no name, try to find a sibling that looks like a name
        if (!name) {
            const nameEl = section.querySelector('strong, [class*="name"], .artdeco-entity-lockup__title');
            if (nameEl) name = nameEl.innerText.trim();
        }

        if (name && name.length > 1 && name !== 'LinkedIn Member') {
            connections.push({
                name: name,
                headline: 'Contact at Company',
                profile_url: profileUrl,
                photo_url: photoUrl
            });
            console.log(`[JobKernel] Broad scan found connection: ${name}`);
        }
    });

    // Strategy 2b: Standard networking cards
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
            // Prioritize data-delayed-url — it's the REAL photo URL before LinkedIn's lazy loader fires
            const photoUrl = imgEl ? (
                imgEl.getAttribute('data-delayed-url') ||
                imgEl.getAttribute('srcset')?.split(' ')[0] ||
                (imgEl.src && !imgEl.src.startsWith('data:') && imgEl.src) ||
                null
            ) : null;
            
            const finalPhotoUrl = (photoUrl && photoUrl.includes('http')) ? photoUrl : null;

            connections.push({
                name,
                headline: headlineEl?.innerText.trim() || (card.classList.contains('jobs-poster') ? 'Job Poster' : ''),
                profile_url: profileUrl,
                degree: degree,
                is_alumni: isAlumni,
                is_poster: /poster|hirer/i.test(card.className) || !!card.closest('.jobs-poster, .hirer-card__container'),
                photo_url: finalPhotoUrl
            });
        }
    });

    // Strategy 2c: LinkedIn Facepile Initial Scan (the "Alexa and others in your network" section)
    // This is the compact view BEFORE "Show All" is clicked. Profile names come from img alt text.
    const facepileSections = root.querySelectorAll(
        '.jobs-people-who-can-help-section, [class*="people-who-can-help"], [class*="facepile"], [class*="connections-facepile"]'
    );
    facepileSections.forEach(section => {
        const imgs = section.querySelectorAll('img');
        imgs.forEach(img => {
            // Extract name from alt attr — LinkedIn uses "Avatar of First Last, Title" format
            const alt = img.alt || '';
            const nameFromAlt = alt.replace(/^Avatar of\s*/i, '').split(',')[0].trim();
            if (!nameFromAlt || nameFromAlt.length < 2 || nameFromAlt === 'LinkedIn Member') return;

            // Find the closest anchor or look for a nearby profile link
            const link = img.closest('a[href*="/in/"]') ||
                         img.parentElement?.closest('a[href*="/in/"]') ||
                         section.querySelector(`a[href*="/in/"][aria-label*="${nameFromAlt.split(' ')[0]}"]`);
            if (!link) return;

            const profileUrl = link.href.split('?')[0];
            if (connections.some(c => c.profile_url === profileUrl)) return;

            const rawUrl = img.getAttribute('data-delayed-url') ||
                           img.getAttribute('srcset')?.split(' ')[0] ||
                           (img.src && !img.src.startsWith('data:') && img.src) ||
                           img.getAttribute('src');
            const photoUrl = (rawUrl && rawUrl.includes('http')) ? rawUrl : null;

            connections.push({
                name: nameFromAlt,
                headline: 'Contact at Company',
                profile_url: profileUrl,
                photo_url: photoUrl
            });
            console.log(`[JobKernel] Facepile scan found: ${nameFromAlt} (${photoUrl ? 'has photo' : 'no photo'})`);
        });
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
                // Prioritize data-delayed-url — LinkedIn's lazy-load real URL
                const photoUrl = imgEl ? (
                    imgEl.getAttribute('data-delayed-url') ||
                    imgEl.getAttribute('srcset')?.split(' ')[0] ||
                    (imgEl.src && !imgEl.src.startsWith('data:') && imgEl.src) ||
                    null
                ) : null;

                connections.push({
                    name,
                    headline: headlineEl?.innerText.trim() || '',
                    profile_url: profileUrl,
                    degree: degree,
                    is_alumni: isAlumni,
                    photo_url: (photoUrl && photoUrl.includes('http')) ? photoUrl : null
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

  const safeExtract = (key, fallback) => {
    try {
      if (typeof scraper[key] === 'function') {
        const res = scraper[key]();
        return res !== undefined && res !== null ? res : fallback;
      }
      return fallback;
    } catch (e) {
      console.error(`[JobAutomator] Extractor error for ${key}:`, e);
      return fallback;
    }
  };

  const rawLocation = safeExtract('location', '');
  const rawWorkplaceType = safeExtract('workplaceType', '');
  const rawDatePosted = safeExtract('datePosted', null);
  const rawSalary = safeExtract('salary', null);
  const rawType = safeExtract('type', null);
  const rawTitle = safeExtract('title', null);
  const rawCompany = safeExtract('company', null);
  const rawDescription = safeExtract('description', null);
  const rawCompanyLogo = safeExtract('companyLogo', null);
  const rawApplyLink = safeExtract('applyLink', null);
  const rawDeadline = safeExtract('deadline', null);
  const rawUrl = safeExtract('url', window.location.href);

  const locationType = inferLocationType(rawLocation, rawWorkplaceType) || null;
  const location = cleanLocation(rawLocation);
  const datePosted = parseRelativeDate(rawDatePosted);
  const deadlineParsed = parseRelativeDate(rawDeadline) || rawDeadline;
  
  let cleanDescription = rawDescription?.trim() || null;
  if (cleanDescription) {
    cleanDescription = cleanDescription.replace(/(?:\r?\n)*(?:\.\.\.|…)?\s*(?:show)?\s*more\s*$/i, '');
  }

  return {
    title: rawTitle?.trim() || null,
    company: rawCompany?.trim() || null,
    companyLogo: rawCompanyLogo || null,
    link: rawUrl,
    applyLink: rawApplyLink || rawUrl,
    datePosted: datePosted || null,
    deadline: deadlineParsed || null,
    salaryRange: rawSalary?.trim() || null,
    description: cleanDescription,
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
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
      return false;
    }
    // Accessing getManifest will throw an exception if the extension context is invalidated.
    chrome.runtime.getManifest();
    return true;
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
      // Pre-enable the side panel for this tab immediately so it's ready for clicks
      chrome.runtime.sendMessage({ action: 'pre_enable_side_panel' }).catch(() => {});
    } catch(e) {}
  }

  btn.addEventListener('click', () => {
    if (!isExtValid()) {
      console.warn('[JobAutomator] Extension context invalidated. Please refresh the page.');
      return;
    }
    try {
      const isOpen = btn.classList.contains('panel-open');

      if (isOpen) {
        safeSendMessage({ action: 'close_side_panel' }, () => {
          if (chrome.runtime.lastError) console.warn(chrome.runtime.lastError);
          updateButtonState(btn, false);
        });
      } else {
        // 1. Clear old data instantly so the panel doesn't flash the previous job.
        // The side panel listens to this and will instantly show its loading spinner.
        chrome.storage.local.set({ latestJobData: { _isLoading: true } });

        // 2. Immediately open the panel using the user gesture
        safeSendMessage({ action: 'open_side_panel' }, () => {
          if (chrome.runtime.lastError) console.warn(chrome.runtime.lastError);
          updateButtonState(btn, true);
        });

        // 2. Tell the panel we are actively scraping so it can show a loading state
        safeSendMessage({ action: 'job_loading' });

        // 3. Defer the heavy DOM scraping to the next tick. 
        // This prevents the synchronous scrapeJobData() function from blocking
        // the main thread and delaying the panel from sliding out.
        setTimeout(() => {
          const jobData = scrapeJobData();
          console.log('[JobAutomator] Scraped Job Data:', jobData);
          extLog('INFO', `Scraped job data for ${jobData.company || 'Unknown Company'}`, { title: jobData.title, url: jobData.url });
          
          // 4. Store the data. The background script will auto-refresh the panel when done.
          safeSendMessage({ action: 'store_job_data', data: jobData }, () => {
            if (chrome.runtime.lastError) console.warn(chrome.runtime.lastError);
          });
        }, 10);
      }
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
      chrome.storage.local.set({ latestJobData: jobData });
    } catch(e) {}
  }, 1000);

  // Second networking pass: LinkedIn lazy-loads images and sometimes descriptions ~2-4s after page render.
  setTimeout(() => {
    if (!isExtValid()) return;
    if (!window.location.hostname.includes('linkedin.com')) return;
    
    const onPage = LINKEDIN_SCRAPER.networking?.() || [];
    const fullScrape = scrapeJobData();
    
    chrome.storage.local.get(['latestJobData'], (result) => {
      if (!result.latestJobData) return;
      
      let needsUpdate = false;
      let updateData = { ...result.latestJobData };

      // Check if we now have more networking photos
      const prevConnections = result.latestJobData.onPageConnections || [];
      const prevWithPhotos = prevConnections.filter(c => c.photo_url).length;
      const newWithPhotos  = onPage.filter(c => c.photo_url).length;
      
      if (newWithPhotos > prevWithPhotos) {
        console.log(`[JobKernel] Delayed re-scan: found ${newWithPhotos} photos (was ${prevWithPhotos})`);
        updateData.onPageConnections = onPage;
        needsUpdate = true;
        safeSendMessage({ action: 'refresh_on_page_connections', onPageConnections: onPage });
      }

      // Check if description was empty/short but is now populated
      const prevDesc = result.latestJobData.description || '';
      const newDesc = fullScrape.description || '';
      if (newDesc.length > prevDesc.length && newDesc.length > 50) {
        console.log(`[JobKernel] Delayed re-scan: Job description fully loaded (${newDesc.length} chars)`);
        updateData = { ...fullScrape, onPageConnections: onPage };
        needsUpdate = true;
        // This will trigger loadData in sidepanel, which will now find a valid description and trigger AI scoring
        safeSendMessage({ action: 'refresh_panel_data' });
      }

      if (needsUpdate) {
        chrome.storage.local.set({ latestJobData: updateData });
      }
    });
  }, 4000);
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
  } else if (message.action === 'LINKEDIN_SYNC_COMPLETE') {
    connectionCache.clear();
    document.querySelectorAll('[data-kernel-processed-company]').forEach(el => {
      delete el.dataset.kernelProcessedCompany;
    });
    processLinkedInConnections();
    sendResponse({ success: true });
  }
});

// ── LinkedIn Network Matches ──────────────────────────────────────────────

let connectionCache = new Map(); // companyId or name -> matches
let lastActiveJobId = null;

async function getMatches(companyId, companyName) {
  const key = companyId || companyName;
  if (!key) {
    console.log('[JobKernel-Debug] getMatches: Empty key. Skipping query.');
    return [];
  }
  if (connectionCache.has(key)) {
    const cachedVal = connectionCache.get(key);
    console.log('[JobKernel-Debug] getMatches: cache HIT for key "' + key + '". Cached matches count:', cachedVal?.length || 0);
    return cachedVal;
  }

  console.log('[JobKernel-Debug] getMatches: cache MISS for key "' + key + '". Querying backend...', { companyId, companyName });

  return new Promise((resolve) => {
    // Strategy: Try ID first if available. If no matches, try Name.
    const tryQuery = (id, name) => {
      const action = id ? 'CHECK_CONNECTIONS' : 'CHECK_CONNECTIONS_BY_NAME';
      const params = id ? { companyId: id } : { companyName: name };
      
      console.log('[JobKernel-Debug] getMatches: sending message to background...', { action, params });
      
      safeSendMessage({ action, ...params }, (response) => {
        const matches = response?.matches || [];
        console.log('[JobKernel-Debug] getMatches: received response for key "' + key + '". Action used:', action, 'Matches count:', matches.length, matches);
        
        if (matches.length > 0 || !name || (id && !name)) {
          connectionCache.set(key, matches);
          resolve(matches);
        } else if (id && name) {
          // Fallback to name search
          console.log('[JobKernel-Debug] getMatches: ID search returned 0 matches for "' + key + '". Falling back to Name query:', name);
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
  console.log('[JobKernel-Debug] processLinkedInConnections triggered. Pathname:', window.location.pathname, 'isJobPage:', LINKEDIN_SCRAPER.isJobPage(), 'isProcessingConnections:', isProcessingConnections);
  if (!isExtValid()) {
    console.log('[JobKernel-Debug] processLinkedInConnections aborted: extension not valid.');
    return;
  }
  if (!LINKEDIN_SCRAPER.isJobPage()) {
    console.log('[JobKernel-Debug] processLinkedInConnections aborted: not a job page.');
    return;
  }
  if (isProcessingConnections) {
    console.log('[JobKernel-Debug] processLinkedInConnections aborted: already processing.');
    return;
  }
  isProcessingConnections = true;
  try {
    // 1. Current Job Banner
    const jobId = new URLSearchParams(window.location.search).get('currentJobId');
    console.log('[JobKernel-Debug] processLinkedInConnections: jobId from URL:', jobId, 'lastActiveJobId:', lastActiveJobId);
    if (jobId && (jobId !== lastActiveJobId || !document.getElementById('kernel-connection-banner'))) {
      const companyName = LINKEDIN_SCRAPER.company();
      const companyId = LINKEDIN_SCRAPER.companyId();
      console.log('[JobKernel-Debug] processLinkedInConnections: scraped top card details:', { companyName, companyId });

      if (companyName || companyId) {
        lastActiveJobId = jobId;
        const matches = await getMatches(companyId, companyName);
        console.log('[JobKernel-Debug] processLinkedInConnections: got matches for top card banner:', matches?.length);
        renderConnectionBanner(matches, companyName);
      }
    }

    // 2. Proactively update side panel on-page connections
    const onPage = LINKEDIN_SCRAPER.networking?.() || [];
    console.log('[JobKernel-Debug] processLinkedInConnections: scraped onPage connections count:', onPage.length);
    if (onPage.length > 0) {
      chrome.storage.local.get(['latestJobData'], (result) => {
        if (result.latestJobData) {
          const updatedData = { ...result.latestJobData, onPageConnections: onPage };
          chrome.storage.local.set({ latestJobData: updatedData }, () => {
            console.log('[JobKernel-Debug] processLinkedInConnections: stored on-page connections in local storage');
            safeSendMessage({ action: 'refresh_on_page_connections', onPageConnections: onPage });
          });
        }
      });
    }

    // 3. Job List Highlights (rate-limited separately)
    console.log('[JobKernel-Debug] processLinkedInConnections: calling highlightConnectionsInList');
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
const LIST_HIGHLIGHT_INTERVAL = 200; // Throttle reduced to 200ms to eliminate startup/rendering race conditions

function getLeftPanelJobLinks() {
  const allLinks = Array.from(document.querySelectorAll('a[href*="/jobs/view/"], a[href*="currentJobId="]'));
  return allLinks.filter(a => {
    const rect = a.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.left < window.innerWidth * 0.5;
  });
}

function getClosestCommonAncestor(elements) {
  if (elements.length === 0) return null;
  if (elements.length === 1) return elements[0].parentElement;
  
  let parents = [];
  let p = elements[0].parentElement;
  while (p) {
    parents.push(p);
    p = p.parentElement;
  }
  
  for (const parent of parents) {
    let isCommon = true;
    for (let i = 1; i < elements.length; i++) {
      if (!parent.contains(elements[i])) {
        isCommon = false;
        break;
      }
    }
    if (isCommon) {
      return parent;
    }
  }
  return null;
}

function addLeftPaneScrollListener(resolvedContainer = null) {
  const leftPane = resolvedContainer || 
                   document.querySelector('.jobs-search-results-list, [class*="scaffold-layout__list"], [class*="jobs-search-results__list"]');
  if (leftPane && !leftPane.dataset.kernelScrollWatched) {
    leftPane.dataset.kernelScrollWatched = 'true';
    leftPane.addEventListener('scroll', () => {
      const now = Date.now();
      if (now - lastConnectionProcess > THROTTLE_MS) {
        lastConnectionProcess = now;
        processLinkedInConnections();
      }
    }, { passive: true });
    console.log('[JobKernel] Registered left pane scroll listener on container:', leftPane.tagName, leftPane.className);
  }
}

async function highlightConnectionsInList() {
  const now = Date.now();
  console.log('[JobKernel-Debug] highlightConnectionsInList: lastListHighlight diff:', now - lastListHighlight, 'INTERVAL:', LIST_HIGHLIGHT_INTERVAL);
  if (now - lastListHighlight < LIST_HIGHLIGHT_INTERVAL) {
    console.log('[JobKernel-Debug] highlightConnectionsInList: aborted due to throttle interval.');
    return;
  }
  lastListHighlight = now;

  let listItems = Array.from(document.querySelectorAll(
    '.jobs-search-results-list__item, .scaffold-layout__list-item, .job-card-container, li[data-occludable-job-id], div[data-job-id], [class*="job-card-list"], [class*="_258fed07"], [class*="_13ea86fc"], [class*="ba6a2084"]'
  ));
  console.log('[JobKernel-Debug] highlightConnectionsInList: querySelectorAll found items:', listItems.length);

  let resolvedContainer = null;
  if (listItems.length === 0) {
    console.log('[JobKernel-Debug] highlightConnectionsInList: listItems is 0. Running dynamic container fallback...');
    try {
      const leftLinks = getLeftPanelJobLinks();
      console.log('[JobKernel-Debug] Dynamic resolver found left panel links count:', leftLinks.length);
      resolvedContainer = getClosestCommonAncestor(leftLinks);
      if (resolvedContainer) {
        console.log('[JobKernel-Debug] Dynamic resolver found list container:', resolvedContainer.tagName, resolvedContainer.className);
        const cards = [];
        Array.from(resolvedContainer.children).forEach(child => {
          const hasLink = leftLinks.some(link => child.contains(link));
          if (hasLink) {
            cards.push(child);
          }
        });
        listItems = cards;
        console.log('[JobKernel-Debug] Dynamic resolver successfully resolved cards count:', listItems.length);
      }
    } catch (e) {
      console.error('[JobKernel-Debug] Error in dynamic card resolver:', e);
    }
  }
  
  // Register scroll listener on the left pane container for real-time responsiveness
  addLeftPaneScrollListener(resolvedContainer);
    
    // 1. Diagnostic Link Finder
    try {
      const allLinks = Array.from(document.querySelectorAll('a'));
      const jobLinks = allLinks.filter(a => a.href && (a.href.includes('/jobs/view/') || a.href.includes('currentJobId=')));
      console.log('[JobKernel-Debug] Diagnostic job links found count:', jobLinks.length);
      if (jobLinks.length > 0) {
        jobLinks.slice(0, 5).forEach((a, idx) => {
          const classStr = a.className ? `.${a.className.split(/\s+/).join('.')}` : '';
          const parentClassStr = a.parentElement?.className ? `.${a.parentElement.className.split(/\s+/).join('.')}` : '';
          const grandClassStr = a.parentElement?.parentElement?.className ? `.${a.parentElement.parentElement.className.split(/\s+/).join('.')}` : '';
          console.log(`[JobKernel-Debug] Diagnostic job link[${idx}]: href: ${a.href} | text: "${a.innerText.trim().replace(/\s+/g, ' ').substring(0, 40)}" | a${classStr} > parent: ${a.parentElement?.tagName}${parentClassStr} > grandparent: ${a.parentElement?.parentElement?.tagName}${grandClassStr}`);
        });
      }
    } catch (e) {
      console.error('[JobKernel-Debug] Error running link diagnostics:', e);
    }

    // 2. Text node search for visible entities
    try {
      const searchTerms = ['S&P Global', 'BOI (Board of Innovation)', 'Bristol Myers Squibb', 'PwC', 'Citi', 'Client Technology'];
      searchTerms.forEach(term => {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
          if (node.nodeValue && node.nodeValue.includes(term)) {
            let parent = node.parentElement;
            const hierarchyStrs = [];
            let depth = 0;
            while (parent && depth < 6) {
              const classStr = parent.className ? `.${parent.className.split(/\s+/).join('.')}` : '';
              const idStr = parent.id ? `#${parent.id}` : '';
              const jobIdStr = (parent.getAttribute('data-job-id') || parent.getAttribute('data-occludable-job-id')) ? `[data-job-id="${parent.getAttribute('data-job-id') || parent.getAttribute('data-occludable-job-id')}"]` : '';
              hierarchyStrs.push(`${parent.tagName}${idStr}${classStr}${jobIdStr}`);
              parent = parent.parentElement;
              depth++;
            }
            console.log(`[JobKernel-Debug] Diagnostic match for text "${term}" hierarchy: ` + hierarchyStrs.reverse().join(' > '));
          }
        }
      });
    } catch (e) {
      console.error('[JobKernel-Debug] Error running text diagnostics:', e);
    }
  }
  
  // Register scroll listener on the left pane container for real-time responsiveness
  addLeftPaneScrollListener();

  // Process all list items in parallel to eliminate sequential blocking and race conditions
  listItems.forEach(async (item, idx) => {
    const companyLink = item.querySelector('a[href*="/company/"]');
    const companyNameEl = item.querySelector(
      '.job-card-container__company-name, .artdeco-entity-lockup__subtitle, .job-card-container__primary-description, [class*="company-name"], [class*="primary-description"]'
    );
    
    // Fallback: If both are missing, clean up and skip
    if (!companyLink && !companyNameEl) {
      console.log(`[JobKernel-Debug] listItem[${idx}]: both companyLink and companyNameEl missing. ClassName: "${item.className}"`);
      const existingIndicator = item.querySelector('.kernel-list-indicator');
      if (existingIndicator) existingIndicator.remove();
      item.classList.remove('kernel-match-highlight');
      delete item.dataset.kernelProcessedCompany;
      return;
    }
    
    const companyIdMatch = companyLink ? companyLink.href.match(/\/company\/([^/?#]+)/) : null;
    const companyId = companyIdMatch ? companyIdMatch[1] : null;
    const companyName = (companyNameEl?.innerText || companyLink?.innerText || '').trim();
    
    const currentCompanyKey = companyId || companyName;
    console.log(`[JobKernel-Debug] listItem[${idx}]: companyId: "${companyId}", companyName: "${companyName}", currentCompanyKey: "${currentCompanyKey}"`);
    
    if (!currentCompanyKey) {
      console.log(`[JobKernel-Debug] listItem[${idx}]: currentCompanyKey empty. Cleaning up.`);
      const existingIndicator = item.querySelector('.kernel-list-indicator');
      if (existingIndicator) existingIndicator.remove();
      item.classList.remove('kernel-match-highlight');
      delete item.dataset.kernelProcessedCompany;
      return;
    }
    
    // If already processed for this exact company, do nothing
    if (item.dataset.kernelProcessedCompany === currentCompanyKey) {
      console.log(`[JobKernel-Debug] listItem[${idx}]: already processed for company key "${currentCompanyKey}". Skipping.`);
      return;
    }
    
    // Mark as processed for this company to avoid duplicate calls
    console.log(`[JobKernel-Debug] listItem[${idx}]: processing key "${currentCompanyKey}". Processing matches.`);
    item.dataset.kernelProcessedCompany = currentCompanyKey;
    
    // Clean up any stale indicators/highlights from recycling
    const existingIndicator = item.querySelector('.kernel-list-indicator');
    if (existingIndicator) existingIndicator.remove();
    item.classList.remove('kernel-match-highlight');
    
    try {
      const matches = await getMatches(companyId, companyName);
      console.log(`[JobKernel-Debug] listItem[${idx}]: matches fetched for "${currentCompanyKey}":`, matches?.length);
      if (matches && matches.length > 0) {
        addConnectionIndicator(item, matches);
      }
    } catch (err) {
      console.warn('[JobKernel] Error checking connections for ' + currentCompanyKey, err);
      // Reset processed state on error to allow retry
      delete item.dataset.kernelProcessedCompany;
    }
  });
}

function addConnectionIndicator(item, matches) {
  console.log('[JobKernel-Debug] addConnectionIndicator called. Matches count:', matches.length, 'Item element:', item);
  // Check if indicator already exists (prevent duplicates)
  if (item.querySelector('.kernel-list-indicator')) {
    console.log('[JobKernel-Debug] addConnectionIndicator aborted: indicator already exists.');
    return;
  }
  
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

  // Place it directly relative to the main card container for absolute reliability and visibility
  item.style.position = 'relative';
  item.appendChild(indicator);
  
  // Unconditionally add the highlight class to the card
  item.classList.add('kernel-match-highlight');
  console.log('[JobKernel-Debug] addConnectionIndicator completed. Added class kernel-match-highlight and appended indicator element.', indicator);
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
    
    // Specialized observer for the modal to catch lazy-loaded images
    const modals = document.querySelectorAll('.artdeco-modal, [role="dialog"]');
    modals.forEach(modal => {
        if (modal.dataset.kernelWatched) return;
        modal.dataset.kernelWatched = 'true';
        
        const imgObserver = new MutationObserver((mutations) => {
            const hasNewPhoto = mutations.some(m => {
                if (m.type === 'attributes' && (m.attributeName === 'src' || m.attributeName === 'data-delayed-url')) {
                    const src = m.target.getAttribute('src') || m.target.getAttribute('data-delayed-url');
                    return src && src.includes('media.licdn.com') && !src.includes('ghost_person');
                }
                return false;
            });
            if (hasNewPhoto) {
                console.log('[JobKernel] Lazy-loaded photo detected in modal — updating.');
                processLinkedInConnections();
            }
        });
        imgObserver.observe(modal, { attributes: true, subtree: true, attributeFilter: ['src', 'data-delayed-url'] });
    });
  }

  const now = Date.now();
  console.log('[JobKernel-Debug] MutationObserver triggered. Time since last process:', now - lastConnectionProcess, 'THROTTLE_MS:', THROTTLE_MS, 'isProcessing:', isProcessingConnections);
  if (now - lastConnectionProcess > THROTTLE_MS) {
    lastConnectionProcess = now;
    if (!isProcessingConnections) {
      console.log('[JobKernel-Debug] MutationObserver initiating processLinkedInConnections (immediate)');
      processLinkedInConnections();
    }
  } else {
    clearTimeout(connectionTimeout);
    connectionTimeout = setTimeout(() => {
      lastConnectionProcess = Date.now();
      if (!isProcessingConnections) {
        console.log('[JobKernel-Debug] MutationObserver initiating processLinkedInConnections (debounced)');
        processLinkedInConnections();
      }
    }, THROTTLE_MS);
  }
});
// ── Initial Connection Processing ──────────────────────────────────────────

if (window.location.hostname.includes('linkedin.com')) {
  connectionObserver.observe(document.body, { childList: true, subtree: true });

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
