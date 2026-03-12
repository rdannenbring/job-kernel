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
  'localhost': KERNEL_SCRAPER,
};

const FALLBACK_SCRAPER = {
  isJobPage: () => {
    const text = document.body.innerText.toLowerCase();
    const isJob = text.includes('job description') || text.includes('apply for this job') || text.includes('qualifications') || text.includes('requirements');
    const isCompany = text.includes('about the company') || text.includes('company overview') || (text.includes('careers') && text.includes('location'));
    const isWellfound = window.location.hostname.includes('wellfound') && window.location.pathname.includes('/company/');
    return isJob || isCompany || isWellfound;
  },
  title: () => {
    // Try to find the first H1 that isn't a logo
    const h1s = Array.from(document.querySelectorAll('h1'));
    for (const h1 of h1s) {
      if (h1.innerText.length > 3 && h1.innerText.length < 100) return h1.innerText.trim();
    }
    return document.title.split('|')[0].split('-')[0].trim();
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
  salary: () => null,
  datePosted: () => null,
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
  const params = new URLSearchParams(window.location.search);
  // Check common job ID parameters
  return params.get('jk') || params.get('vjk') || params.get('currentJobId') || params.get('jobId') || params.get('jobListingId') || params.get('jl') || params.get('lvk') || '';
}

lastJobIdValue = null; // Initialize as null to ensure first check triggers
lastJobUrl = null;

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
  const newId = getJobIdFromUrl();
  
  if (newUrl === lastJobUrl && newId === lastJobIdValue) return;
  
  lastJobUrl = newUrl;
  lastJobIdValue = newId;
  
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

// 2. Lightweight ID poll (for sites that might change URL via hash or other means)
setInterval(() => {
  const currentId = getJobIdFromUrl();
  const currentUrl = window.location.href;

  if (currentId === lastJobIdValue && currentUrl === lastJobUrl) return;
  
  lastJobIdValue = currentId;
  lastJobUrl = currentUrl;

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

function initialScrape() {
  if (!isExtValid()) return;
  chrome.storage.local.get(['isPanelOpen'], (result) => {
    if (result.isPanelOpen && getScraper().isJobPage()) {
      handleJobNavigation();
    }
  });
}

window.addEventListener('load', () => {
  checkIfJobPage();
  initialScrape();
});
setInterval(checkIfJobPage, 2000);
// Also periodically check for navigation in case events are missed
setInterval(() => {
  if (isExtValid()) {
    chrome.storage.local.get(['isPanelOpen'], (result) => {
      if (result.isPanelOpen) {
        const currentId = getJobIdFromUrl();
        const currentUrl = window.location.href;
        if (currentId !== lastJobIdValue || currentUrl !== lastJobUrl) {
          lastJobIdValue = currentId;
          lastJobUrl = currentUrl;
          if (getScraper().isJobPage()) handleJobNavigation();
        }
      }
    });
  }
}, 3000);

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
  }
});

// ─── App Interaction ─────────────────────────────────────────────────────────

window.addEventListener('JOB_KERNEL_APP_UPDATED', (e) => {
  if (!isExtValid()) return;
  try {
    chrome.runtime.sendMessage({ 
      action: 'app_updated', 
      application_id: e.detail?.application_id 
    });
  } catch (err) {}
});
