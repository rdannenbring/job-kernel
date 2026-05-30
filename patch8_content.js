const fs = require('fs');
const path = './extension/content.js';
let content = fs.readFileSync(path, 'utf8');

const isVisibleStr = `function isVisible(el) {
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

const getLIRoot = () => {
  const selectors = [
    '.jobs-details',
    '.scaffold-layout__main',
    '[class*="description-container--two-pane"]',
    '.job-details-jobs-unified-top-card',
    '[class*="job-details-jobs-unified-top-card"]',
    '[class*="jobs-unified-top-card"]',
    '.jobs-search__job-details--container',
    '.job-view-layout',
    '.top-card-layout',
    '#workspace'
  ];
  for (const sel of selectors) {
    const els = document.querySelectorAll(sel);
    for (const el of els) {
      if (isVisible(el)) return el;
    }
  }
  return document;
};`;

content = content.replace(/const getLIRoot = \(\) =>[\s\S]*?document;/m, isVisibleStr);

// Also patch firstMatch to ignore hidden elements
const firstMatchRegex = /if \(el\.closest\('ul, li, \.jobs-search-results-list'\)\) continue;/m;
const firstMatchReplacement = `if (el.closest('ul, li, .jobs-search-results-list')) continue;
      if (typeof isVisible === 'function' && !isVisible(el)) continue;`;
// Wait, isLeftPanel(el) is what it uses now!
content = content.replace(/if \(isLeftPanel\(el\)\) continue;/g, `if (isLeftPanel(el)) continue;
      if (typeof isVisible === 'function' && !isVisible(el)) continue;`);

// And the fallback for companyLogo
content = content.replace(/const cardImg = topCard\.querySelector\('img'\);/m, `const cardImg = Array.from(topCard.querySelectorAll('img')).find(isVisible);`);

fs.writeFileSync(path, content, 'utf8');
console.log("Patched getLIRoot and firstMatch with visibility check");
