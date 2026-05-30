const fs = require('fs');
const path = './extension/content.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Patch firstMatch to use querySelectorAll and skip empty text
content = content.replace(
  /function firstMatch\(selectors, root = document\) {[\s\S]*?return null;\n}/m,
  `function firstMatch(selectors, root = document) {
  for (const sel of selectors) {
    const els = root.querySelectorAll(sel);
    for (const el of els) {
      const text = el?.innerText?.trim();
      // Skip left panel elements dynamically
      if (el.closest('ul, li, .jobs-search-results-list')) continue;
      if (text && text.length > 0) return text;
    }
  }
  return null;
}`
);

// 2. Patch location Strategy 2.5 to skip left panel clue nodes
const locRegex = /\/\/ Strategy 2\.5: Find clue words and traverse up[\s\S]*?const clueNodes = findLeafText\(t => \/ago\|applicant\|reposted\|promoted\|clicked\/i\.test\(t\), 10, root\);\n    for \(const node of clueNodes\) {/m;
const locReplacement = `// Strategy 2.5: Find clue words and traverse up
    const clueNodes = findLeafText(t => /ago|applicant|reposted|promoted|clicked/i.test(t), 10, root);
    for (const node of clueNodes) {
        // Exclude left panel list items
        if (node.el.closest('ul, li, .jobs-search-results-list')) continue;`;
content = content.replace(locRegex, locReplacement);

// 3. Patch datePosted Strategy 1.5 to skip left panel clue nodes
const dateRegex = /\/\/ Strategy 1\.5: Broad scan for "ago" or "just now"\n    const timeNodes = findLeafText\([\s\S]*?\n    \);\n    if \(timeNodes\.length > 0\) \{\n        return timeNodes\[0\]\.text;\n    \}/m;
const dateReplacement = `// Strategy 1.5: Broad scan for "ago" or "just now"
    const timeNodes = findLeafText(
      t => (t.includes('ago') && /\\d+/.test(t)) || /just now/i.test(t),
      15, root
    );
    for (const node of timeNodes) {
        if (!node.el.closest('ul, li, .jobs-search-results-list')) {
            return node.text;
        }
    }`;
content = content.replace(dateRegex, dateReplacement);

fs.writeFileSync(path, content, 'utf8');
console.log("Patched content.js with robust right-panel targeting");
