const fs = require('fs');
const path = './extension/content.js';
let content = fs.readFileSync(path, 'utf8');

const isLeftPanelStr = `function isLeftPanel(el) {
  if (!el || !el.closest) return false;
  return !!el.closest('ul, li, .jobs-search-results-list, .scaffold-layout__list, .job-card-container, .job-card-list, [data-job-id]');
}

/**`;
content = content.replace(/\/\*\*/, isLeftPanelStr);

// Now replace all existing `closest('ul, li, .jobs-search-results-list')` with `isLeftPanel(img)` etc.
content = content.replace(/el\.closest\('ul, li, \.jobs-search-results-list'\)/g, 'isLeftPanel(el)');
content = content.replace(/node\.el\.closest\('ul, li, \.jobs-search-results-list'\)/g, 'isLeftPanel(node.el)');
content = content.replace(/img\.closest\('ul, li, \.jobs-search-results-list'\)/g, 'isLeftPanel(img)');
content = content.replace(/link\.closest\('ul, li, \.jobs-search-results-list'\)/g, 'isLeftPanel(link)');
content = content.replace(/node\.closest\('ul, li, \.jobs-search-results-list'\)/g, 'isLeftPanel(node)');

fs.writeFileSync(path, content, 'utf8');
console.log("Patched isLeftPanel");
