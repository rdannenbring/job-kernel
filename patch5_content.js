const fs = require('fs');
const path = './extension/content.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Patch companyLogo
const logoRegex = /companyLogo: \(\) => \{\n    const root = getLIRoot\(\);\n    const selectors = \[([\s\S]*?)\];\n    for \(const sel of selectors\) \{\n      const img = root\.querySelector\(sel\);\n      if \(img\?\.src && !img\.src\.includes\('data:'\) && img\.src\.includes\('http'\)\) \{\n        return img\.src;\n      \}\n    \}/m;
const logoReplacement = `companyLogo: () => {
    const root = getLIRoot();
    const selectors = [$1];
    for (const sel of selectors) {
      const imgs = root.querySelectorAll(sel);
      for (const img of imgs) {
        if (img.closest('ul, li, .jobs-search-results-list')) continue;
        if (img?.src && !img.src.includes('data:') && img.src.includes('http')) {
          return img.src;
        }
      }
    }`;
content = content.replace(logoRegex, logoReplacement);

// 2. Patch salary
const salaryRegex = /const insightEls = root\.querySelectorAll\([\s\S]*?\);\n    for \(const el of insightEls\) \{\n      const text/m;
const salaryReplacement = `const insightEls = root.querySelectorAll(
      '.job-details-jobs-unified-top-card__job-insight, ' +
      '.jobs-unified-top-card__job-insight, ' +
      '[class*="job-insight"], ' +
      '[class*="insight-container"], ' +
      '.ui-label, .tvm__text'
    );
    for (const el of insightEls) {
      if (el.closest('ul, li, .jobs-search-results-list')) continue;
      const text`;
content = content.replace(salaryRegex, salaryReplacement);

// 3. Patch type
const typeRegex = /const leafEls = root\.querySelectorAll\('span, li, b'\);\n    for \(const el of leafEls\) \{\n      if \(el\.children\.length > 0\) continue;\n      const t/m;
const typeReplacement = `const leafEls = root.querySelectorAll('span, li, b');
    for (const el of leafEls) {
      if (el.closest('ul, li, .jobs-search-results-list')) continue;
      if (el.children.length > 0) continue;
      const t`;
content = content.replace(typeRegex, typeReplacement);

fs.writeFileSync(path, content, 'utf8');
console.log("Patched left-pane filters for logo, salary, type");
