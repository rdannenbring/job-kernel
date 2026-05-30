const fs = require('fs');
const path = './extension/content.js';
let content = fs.readFileSync(path, 'utf8');

// --- Patch TITLE ---
const titleReplacement = `title: () => firstMatch([
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
  ], getLIRoot()),`;

content = content.replace(/title: \(\) => firstMatch\(\[[\s\S]*?\], getLIRoot\(\)\),/m, titleReplacement);

// --- Patch LOCATION ---
const locationRegex = /location: \(\) => \{[\s\S]*?\/\/ Strategy 3: Top-card layout flavors/m;
const locationReplacement = `location: () => {
    const root = getLIRoot();
    const explicitLoc = document.querySelector('.job-details-jobs-unified-top-card__location');
    if (explicitLoc?.innerText?.trim()) return explicitLoc.innerText.trim();

    // Strategy 2: parse the primary-description row or find by traversing from clue nodes
    const primaryDesc = root.querySelector('[class*="primary-description"]');
    if (primaryDesc) {
      const text = primaryDesc.innerText || '';
      const split = text.split('·');
      if (split.length >= 1) {
          let loc = split[0].replace(/\\((remote|hybrid|on-site)\\)/gi, '').trim();
          if (loc && !/\\d/.test(loc) && !/reposted|promoted/i.test(loc)) return loc;
      }
    }

    // Strategy 2.5: Find clue words and traverse up
    const clueNodes = findLeafText(t => /ago|applicant|reposted|promoted|clicked/i.test(t), 10, root);
    for (const node of clueNodes) {
        let parent = node.el.parentElement;
        for (let i = 0; i < 4 && parent; i++) {
            const text = parent.innerText || '';
            if (text.includes('·')) {
                const split = text.split('·');
                if (split.length >= 1) {
                    let loc = split[0].replace(/\\((remote|hybrid|on-site)\\)/gi, '').trim();
                    // Split sometimes gives "Company Name\\nLocation" if they are in the same block
                    if (loc.includes('\\n')) loc = loc.split('\\n').pop().trim();
                    if (loc && !/\\d/.test(loc) && !/reposted|promoted|click/i.test(loc)) return loc;
                }
            }
            parent = parent.parentElement;
        }
    }

    // Strategy 3: Top-card layout flavors`;

content = content.replace(locationRegex, locationReplacement);

// --- Patch DATE POSTED ---
const datePostedRegex = /datePosted: \(\) => \{[\s\S]*?\/\/ Strategy 2: scan top card for "X days ago" text[\s\S]*?if \(timeNodes\.length\) return timeNodes\[0\]\.text;\n    \}/m;
const datePostedReplacement = `datePosted: () => {
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
      t => (t.includes('ago') && /\\d+/.test(t)) || /just now/i.test(t),
      15, root
    );
    if (timeNodes.length > 0) {
        return timeNodes[0].text;
    }`;

content = content.replace(datePostedRegex, datePostedReplacement);

fs.writeFileSync(path, content, 'utf8');
console.log("Patched content.js successfully");
