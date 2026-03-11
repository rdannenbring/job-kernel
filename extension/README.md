# Job Application Automator - Browser Extension

This browser extension allows you to easily capture job listings from sites like Indeed, LinkedIn, Glassdoor, etc., and either save them to your local database or process them immediately to generate tailored resumes and cover letters.

## Features

- **Floating Action Button**: When a job listing page is detected, a floating button ("Automate Job") appears in the bottom right corner with a dynamic pulse animation.
- **Auto-Capture**: Extracts Job Title, Company, URL, Job Description, Salary, Date Posted, and more natively from the DOM.
- **Premium Side Panel**: The extension is built with `chrome.sidePanel`, presenting a sleek dark-mode UI directly within the browser tab.
- **Save Listing**: Allows you to save the job packet directly as a Draft in the Automator without generating a resume.
- **Process Immediately**: Seamlessly sends the job data to your running frontend Application (`http://localhost:5173`), pre-fills the form, and automatically initiates processing.

## Installation (Google Chrome / Edge)

This extension uses Manifest V3.

1. Open Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** in the top right corner.
3. Click **Load unpacked**.
4. Select the `extension` folder from this repository (`/home/rdannenbring/Development/JobApplicationAutomator/extension`).

## Safari & Firefox Placeholders

The codebase is built strictly with Javascript and standard CSS, and utilizes the modern Manifest V3 API structure. 
- **Firefox**: The `manifest.json` will require `browser_specific_settings` to fully load sidepanels appropriately, although the `content_scripts` and `action` components are standardized. A dedicated `manifest.firefox.json` would be built upon compiling if splitting is needed.
- **Safari**: Can be converted using `xcrun safari-web-extension-converter`. Safari fully supports Manifest V3 as of Safari 15.4, meaning this Chrome extension can be ported directly into Xcode for compilation into a Safari App Extension.

*Enjoy automating your job applications right from the job boards!*
