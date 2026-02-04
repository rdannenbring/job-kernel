# Quick Start Guide

## 🚀 Getting Started in 3 Steps

### 1. Run Setup
```bash
./setup.sh
```
This will:
- Create Python virtual environment
- Install all backend dependencies
- Install all frontend dependencies
- Create a template `.env` file

### 2. Add Your API Key
Edit `backend/.env` and add your OpenAI API key:
```bash
OPENAI_API_KEY=sk-your-actual-api-key-here
```

**Don't have an OpenAI API key?**
- Get one at: https://platform.openai.com/api-keys
- Free tier available for testing

### 3. Start the Application
```bash
./start.sh
```

The application will open at: **http://localhost:5173**

---

## 📋 Usage Instructions

### Step 1: Upload Your Resume
- Click or drag-and-drop your resume (must be `.docx` format)
- Only Word documents are supported for best results

### Step 2: Add Job Description
Choose one method:
- **Paste Text**: Copy and paste the job description directly
- **From URL**: Enter the job posting URL (works with LinkedIn, Indeed, etc.)

### Step 3: Process
Click "Tailor Resume" and wait for AI to optimize your resume

### Step 4: Download
Get your tailored resume in three formats:
- **📄 Word (.docx)** - Ready to edit further
- **📑 PDF (.pdf)** - Ready to submit
- **📝 Text (.txt)** - For ATS systems

---

## 🔧 Manual Setup (Alternative)

If you prefer to set up manually:

### Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env and add your API key
python main.py
```

### Frontend (in a new terminal)
```bash
cd frontend
npm install
npm run dev
```

---

## 🛠️ Troubleshooting

### "Module not found" errors
Run setup again:
```bash
./setup.sh
```

### Backend won't start
1. Check that you've activated the virtual environment: `source backend/venv/bin/activate`
2. Verify API key is set in `backend/.env`
3. Check Python version: `python3 --version` (needs 3.9+)

### Frontend won't start
1. Check Node version: `node --version` (needs 18+)
2. Delete `node_modules` and run: `npm install`

### "CORS error" in browser
Make sure both backend (port 8000) and frontend (port 5173) are running

### File upload fails
- Ensure you're uploading a `.docx` file (not `.doc` or other formats)
- File should be less than 10MB

---

## 📝 Features

✅ AI-powered resume optimization  
✅ Support for text or URL job descriptions  
✅ Multi-format export (DOCX, PDF, TXT)  
✅ Maintains original resume formatting  
✅ Privacy-first (all processing on your machine)  
✅ Beautiful, modern interface  

---

## 🔒 Privacy & Security

- All processing happens locally on your machine
- Your resume is never sent to external servers (except OpenAI for AI processing)
- Temporary files are stored locally and can be deleted anytime
- No data is permanently stored unless you choose to save it

---

## 💰 API Costs

This application uses OpenAI's GPT-4 model:
- Cost: ~$0.01-0.03 per resume tailoring
- Much cheaper than paid resume services
- You only pay for what you use

---

## 🎯 Tips for Best Results

1. **Use a well-formatted resume**: The better your original resume, the better the output
2. **Provide detailed job descriptions**: More detail = better optimization
3. **Review before submitting**: Always review the AI-generated content
4. **Save your base resume**: Keep an unmodified copy for future tailoring

---

## 📦 What Gets Installed

### Backend (Python)
- FastAPI - Web framework
- OpenAI - AI processing
- python-docx - Word document handling
- ReportLab - PDF generation
- BeautifulSoup4 - Web scraping

### Frontend (Node.js)
- React - UI framework
- Vite - Build tool

---

## 🤝 Need Help?

1. Check this guide first
2. Review the main README.md
3. Check that all dependencies are installed
4. Verify your OpenAI API key is correct

---

Happy job hunting! 🎉
