const fs = require('fs');
const path = './extension/content.js';
let content = fs.readFileSync(path, 'utf8');

const regexLeftPanel = /function isLeftPanel\(el\) \{[\s\S]*?return !!el\.closest\('ul, li.*?\]'\);\n\}/m;
const replacementLeftPanel = `function getDynamicLeftPanel() {
    const cards = Array.from(document.querySelectorAll('li[data-occludable-job-id], div[data-job-id], .job-card-container, [class*="job-card-list"]'));
    if (cards.length > 2) {
        let parent = cards[0].parentElement;
        while (parent && parent !== document.body && parent !== document.documentElement) {
            if (parent.contains(cards[cards.length - 1])) {
                const rect = parent.getBoundingClientRect();
                if (rect.width > 0 && rect.width < window.innerWidth * 0.7) {
                    return parent;
                }
            }
            parent = parent.parentElement;
        }
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
}`;

content = content.replace(regexLeftPanel, replacementLeftPanel);

const regexGetRoot = /const leftPanel = document\.querySelector\('ul\.jobs-search-results__list.*?'\);/g;
content = content.replace(regexGetRoot, 'const leftPanel = typeof getDynamicLeftPanel === "function" ? getDynamicLeftPanel() : null;');

fs.writeFileSync(path, content, 'utf8');
console.log("Patched isLeftPanel to use dynamic boundary detection");
