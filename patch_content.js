const fs = require('fs');
const path = './extension/content.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Update Title Selectors
content = content.replace(
  /title: \(\) => firstMatch\(\[\s*'\.job-details[^\]]+\]/m,
  `title: () => firstMatch([
    'h1 a',
    '.job-details-jobs-unified-top-card__job-title h1',
    '.job-details-jobs-unified-top-card__job-title h2',
    '.job-details-jobs-unified-top-card__job-title-link',
    '.jobs-unified-top-card__job-title h1',
    '.jobs-unified-top-card__job-title h2',
    '.jobs-unified-top-card__job-title a',
    '[class*="job-title"] h1',
    '[class*="job-title"] h2',
    '[class*="job-title"] a',
    'h1[class*="job-title"]',
    'h2[class*="job-title"]',
    'h1.top-card-layout__title',
    'h2.top-card-layout__title',
    '.top-card-layout__title',
    'h1'
  ]`
);

// 2. Update Location logic
content = content.replace(
  /const split = text.split\('·'\);\n\s*if \(split\.length >= 2\) {\n\s*const loc = split\[1\]\.replace\(\/\\\(\(remote\|hybrid\|on-site\)\\\)\/gi, ''\)\.trim\(\);\n\s*if \(loc && !\/\\d\/\.test\(loc\)\) return loc;\n\s*}/m,
  `const split = text.split('·');
      if (split.length >= 1) {
          // Check split[0] first (new layout: Location · Date)
          let loc = split[0].replace(/\\((remote|hybrid|on-site)\\)/gi, '').trim();
          if (loc && !/\\d/.test(loc) && !/reposted|promoted/i.test(loc)) return loc;
          
          if (split.length >= 2) {
              // Fallback to split[1] (old layout: Company · Location · Date)
              loc = split[1].replace(/\\((remote|hybrid|on-site)\\)/gi, '').trim();
              if (loc && !/\\d/.test(loc) && !/reposted|promoted/i.test(loc)) return loc;
          }
      }`
);

// 3. Update Date Posted logic
content = content.replace(
  /\/\/ Strategy 2: scan top card for "X days ago" text/m,
  `// Strategy 1.5: scan primary description directly for date
    const primaryDesc = root.querySelector('[class*="primary-description"]');
    if (primaryDesc) {
      const parts = (primaryDesc.innerText || '').split('·').map(p => p.trim());
      for (const part of parts) {
        if (/ago|just now/i.test(part)) return part;
      }
    }

    // Strategy 2: scan top card for "X days ago" text`
);

fs.writeFileSync(path, content, 'utf8');
console.log("Patched content.js");
