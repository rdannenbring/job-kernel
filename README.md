# JobKernel

AI-powered job application manager — track applications, tailor resumes, generate cover letters, and stay organized throughout your job search.

---

## 🚨 For AI Agents & Developers

**PLEASE USE DOCKER FOR DEVELOPMENT.**

All dependencies are managed inside Docker containers. Do not run `pip install` or `npm install` locally unless specifically debugging a local environment issue.

```bash
./start-docker.sh
```

| Container | Name |
|-----------|------|
| Backend (FastAPI) | `jobapplicationautomator-backend-1` |
| Frontend (Vite/React) | `jobapplicationautomator-frontend-1` |

To run a command inside the backend container:
```bash
docker exec -it jobapplicationautomator-backend-1 pip install <package_name>
```

---

## Features

- 📋 **Application Tracking** — Kanban, list & table views with drag-and-drop status updates
- 📄 **Resume Tailoring** — AI rewrites your resume to match each job description, preserving formatting
- ✉️ **Cover Letter Generation** — AI-drafted cover letters with one click
- 🗂️ **Archiving** — Archive applications instead of deleting them; toggle archived view on the dashboard
- 🏢 **Company Logos** — Upload logos per application; displayed in all dashboard views
- 🔌 **Browser Extension** — Clip job listings directly from LinkedIn and other job boards
- 👤 **Profile Management** — Store contact info, resume data, documents, and preferences
- 📊 **Analytics** — Visual breakdown of your application pipeline

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React, Vite, Tailwind CSS |
| Backend | Python, FastAPI, SQLAlchemy, SQLite |
| AI | Google Gemini (configurable) |
| Document Processing | `python-docx`, `BeautifulSoup4` |
| Extension | Chrome Manifest V3 |

---

## Getting Started

### Prerequisites

- [Docker](https://www.docker.com/) & Docker Compose
- A [Google AI Studio](https://aistudio.google.com/) API key (Gemini)

### 1. Clone the repository

```bash
git clone https://github.com/rdannenbring/job-kernel.git
cd job-kernel
```

### 2. Configure the backend

`backend/config.json` is **not** committed to the repo (it contains your API key). Create it from the provided template:

```bash
cp backend/config.example.json backend/config.json
```

Then open `backend/config.json` and fill in your values:

```json
{
    "default_resume_path": "/mnt/resume/YourResume.docx",
    "ai_config": {
        "provider": "gemini",
        "model": "gemini-2.5-flash",
        "api_key": "YOUR_GEMINI_API_KEY_HERE"
    },
    ...
}
```

> **Where to get a Gemini API key:** Visit [aistudio.google.com](https://aistudio.google.com), sign in, and create a new API key under **Get API key**.
>
> ⚠️ **Never commit `config.json` to git.** It is listed in `.gitignore` for this reason. If you accidentally expose a key, revoke it immediately at [aistudio.google.com](https://aistudio.google.com) and generate a new one.

### 3. Start the application

```bash
./start-docker.sh
```

The app will be available at **http://localhost:5173**.

---

## Project Structure

```
job-kernel/
├── backend/
│   ├── main.py                  # FastAPI app & all API endpoints
│   ├── config.json              # ⚠️ Local only — never committed
│   ├── config.example.json      # ✅ Safe template — copy to config.json
│   ├── requirements.txt
│   └── services/
│       ├── ai_service.py        # Gemini integration
│       ├── database_service.py  # SQLite ORM & migrations
│       ├── document_service.py  # Resume/cover letter DOCX generation
│       └── scraper_service.py   # Job URL scraping
├── frontend/
│   ├── src/
│   │   ├── pages/               # Dashboard, Profile, ApplicationDetail, etc.
│   │   ├── components/          # Sidebar, Layout, shared UI
│   │   └── App.jsx              # Root component & routing
│   └── index.html
├── extension/                   # Chrome browser extension
│   ├── manifest.json
│   ├── sidepanel.html/js/css
│   ├── content.js
│   └── background.js
├── resources/
│   └── images/logos/            # Brand assets
├── start-docker.sh
└── README.md
```

---

## Privacy & Security

- All data is processed and stored **locally on your machine** — nothing is sent to external servers except AI API calls (Gemini)
- `config.json` and the SQLite database (`*.db`) are excluded from version control via `.gitignore`
- Resume files are stored in `backend/uploads/` — also excluded from version control

---

## License

MIT License — For personal use
