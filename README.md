# Resume Automation Application

Automatically tailor your resume to match job descriptions while maintaining your original formatting and style.


## 🚨 FOR AI AGENTS & DEVELOPERS

**PLEASE USE DOCKER FOR DEVELOPMENT**

To ensure a consistent environment and avoid dependency issues, please run the application using the provided Docker setup script:

```bash
./start-docker.sh
```

**Do not try to run `pip install` or `npm install` locally unless specifically debugging local environment issues.** All dependencies are managed within the Docker containers.

- **Backend Container**: `jobapplicationautomator-backend-1`
- **Frontend Container**: `jobapplicationautomator-frontend-1`

To run commands inside the backend (e.g., to install new packages temporarily):
```bash
docker exec -it jobapplicationautomator-backend-1 pip install <package_name>
```

---

## Features

- 📄 **Resume Upload**: Support for Word (.docx) format
- 🎯 **Job Description Input**: Paste text or provide a URL to scrape
- 🤖 **AI-Powered Tailoring**: Intelligently modify your resume to highlight relevant experience
- 📥 **Multi-Format Export**: Download as DOCX, PDF, or TXT
- 📊 **History Tracking**: View and download previously tailored resumes
- 🎨 **Format Preservation**: Maintains your original resume styling

## Tech Stack

### Frontend
- React with Vite
- Modern, responsive UI
- File upload and preview

### Backend
- Python FastAPI
- OpenAI API for intelligent resume tailoring
- Document processing libraries

### Document Processing
- `python-docx` - Word document manipulation
- `ReportLab` - PDF generation
- `BeautifulSoup4` - Web scraping for job URLs

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- Python 3.9+
- OpenAI API key (or similar AI service)

### Installation

1. **Clone and setup**:
```bash
cd /home/rdannenbring/Development/JobApplicationAutomator
```

2. **Frontend Setup**:
```bash
cd frontend
npm install
npm run dev
```

3. **Backend Setup**:
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python main.py
```

4. **Environment Variables**:
Create a `.env` file in the backend directory:
```
OPENAI_API_KEY=your_api_key_here
```

## Usage

1. Open the web application (default: http://localhost:5173)
2. Upload your base resume (.docx format)
3. Input job description (paste text or provide URL)
4. Click "Tailor Resume"
5. Preview the tailored resume
6. Download in your preferred format (DOCX, PDF, or TXT)

## Project Structure

```
JobApplicationAutomator/
├── frontend/           # React + Vite frontend
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── App.jsx
│   └── package.json
├── backend/           # Python FastAPI backend
│   ├── main.py
│   ├── services/
│   │   ├── ai_service.py
│   │   ├── document_service.py
│   │   └── scraper_service.py
│   ├── requirements.txt
│   └── uploads/
└── README.md
```

## How It Works

1. **Upload**: Your resume is uploaded and parsed to extract structure and content
2. **Job Analysis**: AI analyzes the job description to identify key requirements, skills, and keywords
3. **Tailoring**: AI intelligently modifies your resume to:
   - Highlight relevant experience
   - Add keyword optimization
   - Reorder or emphasize skills matching the job
   - Maintain your original formatting
4. **Export**: Generate the tailored resume in multiple formats

## Privacy & Security

- All processing happens locally on your machine
- Your resume data is never stored permanently (unless you choose to save it)
- API keys are stored locally in environment variables

## License

MIT License - For personal use
