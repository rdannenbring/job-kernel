# Quick Start Guide

## 🚀 Getting Started (Docker - Recommended)

The easiest way to run the application is using **Docker**. This sets up the Backend, the Frontend, and the **SQLite** database automatically.

### 1. Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) or Docker Engine installed.
- A Google Gemini API key ([aistudio.google.com](https://aistudio.google.com)).

### 2. Configuration
Copy the template and fill in your Gemini key:
```bash
cp backend/config.example.json backend/config.json
```
See the [README](README.md#2-configure-the-backend) for the full `config.json` shape. Never commit this file.

### 3. Launch
Run the helper script:
```bash
./start-docker.sh
```

The application will open at: **http://localhost:5173**
- **Dashboard**: Kanban, list, and table views of every application.
- **Discover**: Search job boards and pull listings straight into the pipeline.
- **New Application**: Start one from a URL, a paste, or the browser extension.

---

## 💻 Manual Setup (Legacy / Local Dev)

If you cannot use Docker, you can still run the application locally against the same SQLite database.

### 1. Run Setup
```bash
./setup.sh
```

### 2. Start Application
```bash
./start-local.sh
```

---

## 📋 Usage

JobKernel is a **high-throughput application workbench** — the goal is to get through as many applications as possible without ceremony. Applications move through a pipeline, not a wizard.

```
Saved → Generated → Applied → Interviewing → Decision → Accepted
                                   └────────→ Rejected / Declined / Withdrawn
```

**Nothing blocks you from moving an application to any stage.** Drag it on the Kanban board, click through the pipeline rail on the detail page, or change it from the list view — at any time, in any order, forwards or backwards. See [`documentation/product-direction.md`](documentation/product-direction.md).

### Getting an application into the pipeline
Use **Discover** to search job boards, paste a job URL or description under **New Application**, or clip a listing with the browser extension. Either way it lands in **Saved**.

### Working an application
Open it and use whichever sub-stage panels are useful — job analysis, company research, network contacts, priority. **All of these are optional.** The progress ring shows how much detail you have captured, not how much you owe.

### Generating documents
From the **Generated** stage, tailor your resume against the job description and draft a cover letter. Preview, diff against your base resume, refine with instructions, and export to DOCX / PDF / TXT. You can also skip this entirely and record an application you sent elsewhere.

### After you apply
The **Applied** stage is the one with full backend support: log what you submitted, attach a confirmation receipt, plan a follow-up, and record it when sent. JobKernel computes a readiness signal for moving to Interviewing and shows it as a **suggestion**. It does not stop you.

### Want the guardrails?
Turn on **Settings → Workflow → Guided mode** to make readiness checks actually enforce, per stage. Off by default.

---

## 📝 Features

✅ **Pipeline Tracking**: Kanban, list, and table views with drag-and-drop stage changes.
✅ **Job Discovery**: Search multiple job boards and import listings directly.
✅ **AI Resume Tailoring**: Rewrites your resume per job description, preserving formatting.
✅ **AI Cover Letters**: Drafted from your resume and the job posting.
✅ **Applied-stage tracking**: Submission records, receipts, follow-up plans, activity log.
✅ **Local Storage**: SQLite on your own machine.
✅ **Multi-Format Export**: DOCX, PDF, and TXT for all documents.

---

## 🔧 Troubleshooting

### "Docker permission denied"
The startup script tries to handle this, but if it fails, run with sudo: `sudo ./start-docker.sh` (Linux) or ensure your user is in the `docker` group.

### "Port already in use"
Ensure no other instances are running. Run `docker-compose down` to stop all containers.

---

Happy job hunting! 🎉
