// Script to patch ApplicationLifecycle.jsx
const fs = require('fs');

let content = fs.readFileSync('frontend/src/pages/ApplicationLifecycle.jsx', 'utf8');

// Replace SAVED_SUBSTAGES
content = content.replace(
  /const SAVED_SUBSTAGES = \[[\s\S]*?\];/,
  `const SAVED_SUBSTAGES = [
  { id: 'parsed', label: 'Job Analysis (parsed)', icon: 'analytics' },
  { id: 'reviewed', label: 'Reviewed', icon: 'rule' },
  { id: 'network', label: 'Network Contacts', icon: 'group' },
  { id: 'company', label: 'Company Research', icon: 'business' },
  { id: 'prioritized', label: 'Prioritized', icon: 'format_list_numbered' },
];`
);

// Update initial state
content = content.replace(
  /const \[activeSubStage, setActiveSubStage\] = useState\('details'\);/,
  `const [activeSubStage, setActiveSubStage] = useState('parsed');`
);

// Auto-enrich logic
content = content.replace(
  /activeSubStage === 'details'/g,
  `activeSubStage === 'parsed'`
);

fs.writeFileSync('frontend/src/pages/ApplicationLifecycle.jsx', content);
