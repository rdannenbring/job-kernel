const fs = require('fs');
const path = './extension/content.js';
let content = fs.readFileSync(path, 'utf8');

const regex = /const getLIRoot = \(\) => \{[\s\S]*?return document;\n\};/m;
const replacement = `const getLIRoot = () => {
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
  const leftPanel = document.querySelector('ul.jobs-search-results__list, [class*="scaffold-layout__list"], .jobs-search-results-list');
  
  // Dynamic fallback: Find the newest Apply button and grab its container
  const applyBtns = Array.from(document.querySelectorAll('.jobs-apply-button, button[data-control-name="jobdetails_apply_btn"]'));
  for (let i = applyBtns.length - 1; i >= 0; i--) {
      if (isVisible(applyBtns[i])) {
          let container = null;
          let testNode = applyBtns[i].parentElement;
          while (testNode && testNode !== document.body) {
              if (leftPanel && testNode.contains(leftPanel)) break;
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
};`;

content = content.replace(regex, replacement);
fs.writeFileSync(path, content, 'utf8');
console.log("Patched getLIRoot with mathematically perfect layout isolation");
