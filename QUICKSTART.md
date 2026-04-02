# Quick Start Guide

## 🚀 Getting Started (Docker - Recommended)

The easiest way to run the application is using **Docker**. This sets up the Backend, Frontend, and a production-ready **PostgreSQL** database automatically.

### 1. Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) or Docker Engine installed.
- OpenAI API Key.

### 2. Configuration
Ensure you have your OpenAI API key set in `backend/.env`:
```bash
OPENAI_API_KEY=sk-your-actual-api-key-here
```

### 3. Launch
Run the helper script:
```bash
./start-docker.sh
```

The application will open at: **http://localhost:5173**
- **Dashboard**: View your saved applications.
- **Tailor Resume**: Start a new application.

---

## 💻 Manual Setup (Legacy / Local Dev)

If you cannot use Docker, you can still run the application locally. It will automatically fallback to a simplified **SQLite** database.

### 1. Run Setup
```bash
./setup.sh
```

### 2. Start Application
```bash
./start-local.sh
```

---

## 📋 Usage Instructions

### Step 1: Upload & Tailor
- Upload your base resume (`.docx`).
- Paste the job description or URL.
- Click **Tailor Resume**.

### Step 2: Review & Refine
- Preview your tailored resume.
- Use the **Diff Toggle** to see exactly what AI changed.
- Use the **Refinement Chat** to request specific tweaks.

### Step 3: Accept & Continue
- Click **"Accept & Continue"** to lock in your resume.
- The AI will automatically write a **Cover Letter** matching your resume and the job.

### Step 4: Cover Letter & Save
- Review and refine your cover letter.
- Click **"Accept Application"** to save the entire packet (Resume, Cover Letter, Job Details) to your local database.
- View all your history on the main **Dashboard**.

---

## 📝 Features

✅ **Dashboard**: Track all your saved job applications in one place.  
✅ **AI Resume Tailoring**: Optimizes your resume for specific job descriptions.  
✅ **AI Cover Letter**: Generates professional cover letters automatically.  
✅ **Database Storage**: Persists your data locally (PostgreSQL in Docker, SQLite in manual mode).  
✅ **Multi-Format Export**: DOCX, PDF, and TXT for all documents.  

---

## 🔧 Troubleshooting

### "Docker permission denied"
The startup script tries to handle this, but if it fails, run with sudo: `sudo ./start-docker.sh` (Linux) or ensure your user is in the `docker` group.

### "Port already in use"
Ensure no other instances are running. Run `docker-compose down` to stop all containers.

---

Happy job hunting! 🎉
