const fs = require('fs');
const path = './extension/content.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Patch Title
const titleRegex = /title: \(\) => firstMatch\(\[([\s\S]*?)\]\, getLIRoot\(\)\)\,/m;
const titleReplacement = `title: () => {
    const root = getLIRoot();
    const t = firstMatch([$1], root);
    if (t) return t;
    
    // Fallback: Find largest text node in right pane
    let largest = null;
    let maxFontSize = 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.children.length === 0 && node.innerText?.trim()) {
        if (node.closest('ul, li, .jobs-search-results-list')) continue;
        const style = window.getComputedStyle(node);
        const size = parseFloat(style.fontSize) || 0;
        if (size > maxFontSize) {
          maxFontSize = size;
          largest = node;
        }
      }
    }
    return largest?.innerText?.trim() || null;
  },`;
content = content.replace(titleRegex, titleReplacement);

// 2. Patch Company
const compRegex = /company: \(\) => firstMatch\(\[([\s\S]*?)\]\, getLIRoot\(\)\)\,/m;
const compReplacement = `company: () => {
    const root = getLIRoot();
    const c = firstMatch([$1], root);
    if (c) return c;
    
    // Fallback: look for a company link
    const links = root.querySelectorAll('a[href*="/company/"]');
    for (const link of links) {
       if (link.closest('ul, li, .jobs-search-results-list')) continue;
       const text = link.innerText?.trim();
       if (text && !/premium|see all|follow/i.test(text)) return text;
    }
    return null;
  },`;
content = content.replace(compRegex, compReplacement);

// 3. Patch Description
const descRegex = /description: \(\) => firstMatch\(\[([\s\S]*?)\]\, document\),/m;
const descReplacement = `description: () => {
    const root = getLIRoot();
    const desc = firstMatch([$1], document);
    if (desc) return desc;

    // Fallback: Find the element with the most text in the right pane
    let largest = null;
    let maxLength = 0;
    // We only care about block elements that could hold a description
    const candidates = root.querySelectorAll('div, section, article, main');
    for (const el of candidates) {
       if (el.closest('ul, li, .jobs-search-results-list')) continue;
       const text = el.innerText?.trim() || '';
       // Avoid grabbing the absolute highest level container if possible, but taking it is better than null
       if (text.length > maxLength && text.length > 200 && text.length < 30000) {
           maxLength = text.length;
           largest = el;
       }
    }
    return largest?.innerText?.trim() || null;
  },`;
content = content.replace(descRegex, descReplacement);

fs.writeFileSync(path, content, 'utf8');
console.log("Patched semantic fallbacks for Title, Company, Description");
