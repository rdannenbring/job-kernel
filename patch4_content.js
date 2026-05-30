const fs = require('fs');
const path = './extension/content.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Patch scrapeJobData to use try/catch for every property
const scrapeJobDataRegex = /function scrapeJobData\(\) \{[\s\S]*?const rawUrl = scraper\.url\?\.\(\) \|\| window\.location\.href;/m;
const scrapeJobDataReplacement = `function scrapeJobData() {
  const scraper = getScraper();

  const safeExtract = (key, fallback) => {
    try {
      if (typeof scraper[key] === 'function') {
        const res = scraper[key]();
        return res !== undefined && res !== null ? res : fallback;
      }
      return fallback;
    } catch (e) {
      console.error(\`[JobAutomator] Extractor error for \${key}:\`, e);
      return fallback;
    }
  };

  const rawLocation = safeExtract('location', '');
  const rawWorkplaceType = safeExtract('workplaceType', '');
  const rawDatePosted = safeExtract('datePosted', null);
  const rawSalary = safeExtract('salary', null);
  const rawType = safeExtract('type', null);
  const rawTitle = safeExtract('title', null);
  const rawCompany = safeExtract('company', null);
  const rawDescription = safeExtract('description', null);
  const rawCompanyLogo = safeExtract('companyLogo', null);
  const rawApplyLink = safeExtract('applyLink', null);
  const rawDeadline = safeExtract('deadline', null);
  const rawUrl = safeExtract('url', window.location.href);`;

content = content.replace(scrapeJobDataRegex, scrapeJobDataReplacement);

fs.writeFileSync(path, content, 'utf8');
console.log("Patched scrapeJobData with safeExtract");
