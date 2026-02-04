from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
import os
import shutil
from typing import Optional
from dotenv import load_dotenv

from services.document_service import DocumentService
from services.ai_service import AIService
from services.scraper_service import ScraperService

load_dotenv()

app = FastAPI(title="Resume Automator API")

# CORS middleware for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
document_service = DocumentService()
ai_service = AIService()
scraper_service = ScraperService()

# Ensure directories exist
os.makedirs("uploads", exist_ok=True)
os.makedirs("outputs", exist_ok=True)


class JobDescriptionRequest(BaseModel):
    job_description: Optional[str] = None
    job_url: Optional[str] = None


@app.get("/")
async def root():
    return {
        "message": "Resume Automator API",
        "version": "1.0.0",
        "status": "running"
    }


import json

# Load config if exists
CONFIG_PATH = "config.json"
def get_config():
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH, 'r') as f:
            return json.load(f)
    return {}

@app.get("/api/config")
async def get_app_config():
    """Return application configuration including defaults"""
    return get_config()


@app.post("/api/tailor-resume")
async def tailor_resume(
    resume: Optional[UploadFile] = File(None),
    job_description: Optional[str] = Form(None),
    job_url: Optional[str] = Form(None),
    use_default_resume: bool = Form(False)
):
    """
    Tailor a resume based on a job description.
    Accepts either job_description text or job_url to scrape.
    Supports using a default local resume file for testing.
    """
    try:
        # Handle Resume Source
        config = get_config()
        file_path = None
        original_filename = "resume.docx"
        
        if use_default_resume and config.get("default_resume_path"):
            # Use local default file
            default_path = config["default_resume_path"]
            if not os.path.exists(default_path):
                raise HTTPException(status_code=404, detail=f"Default resume not found at {default_path}")
            
            # Copy to uploads folder to normalize processing
            original_filename = os.path.basename(default_path)
            file_path = f"uploads/{original_filename}"
            shutil.copy2(default_path, file_path)
            
        elif resume:
            # Use uploaded file
            original_filename = resume.filename
            file_path = f"uploads/{original_filename}"
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(resume.file, buffer)
        else:
            raise HTTPException(status_code=400, detail="No resume provided. Upload a file or use default.")

        # Handle Job Description Source
        final_job_description = job_description
        if job_url:
            print(f"Scraping job from: {job_url}")
            scraped_data = await scraper_service.scrape_job(job_url)
            if scraped_data:
                # validation: ensure we got actual text
                scraped_text = scraped_data.get("description", "")
                if scraped_text:
                    if final_job_description:
                         final_job_description += "\n\n" + scraped_text
                    else:
                        final_job_description = scraped_text
            else:
                 print("Warning: Scraper returned no data")

        if not final_job_description:
            raise HTTPException(status_code=400, detail="No job description provided (text or URL)")
            
        print(f"Processing resume: {original_filename}")
        
        # 1. Parse Resume
        resume_data = document_service.parse_docx(file_path)
        
        # 2. Tailor with AI
        tailored_resume_data = await ai_service.tailor_resume(resume_data, final_job_description)
        
        # 3. Generate Output
        base_name = os.path.splitext(original_filename)[0]
        output_filename = f"{base_name}_tailored.docx"
        output_path = f"outputs/{output_filename}"
        
        # Use XML-preserving generation
        document_service.create_docx_preserve_formatting(
            file_path,
            tailored_resume_data,
            output_path
        )
        
        # Also save PDF for preview
        pdf_filename = f"{base_name}_tailored.pdf"
        # We don't have a converter, but we'll return the docx filename so the frontend can download it
        # If we had libreoffice, we'd convert here.
        
        return {
            "message": "Resume tailored successfully",
            "files": {
                "docx": f"/api/download/{base_filename}_tailored.docx",
                "pdf": f"/api/download/{base_filename}_tailored.pdf",
                "txt": f"/api/download/{base_filename}_tailored.txt"
            },
            "preview": tailored_content.get("summary", "Resume tailored successfully")
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/download/{filename}")
async def download_file(filename: str):
    """
    Download a tailored resume file.
    """
    file_path = f"outputs/{filename}"
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    # Determine media type and disposition based on file extension
    media_type = "application/octet-stream"
    content_disposition_type = "attachment"
    
    if filename.lower().endswith(".pdf"):
        media_type = "application/pdf"
        content_disposition_type = "inline"
    elif filename.lower().endswith(".docx"):
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    
    return FileResponse(
        path=file_path,
        filename=filename,
        media_type=media_type,
        content_disposition_type=content_disposition_type
    )


@app.post("/api/analyze-job")
async def analyze_job(request: JobDescriptionRequest):
    """
    Analyze a job description and extract key requirements.
    """
    try:
        job_description = request.job_description
        
        if request.job_url:
            job_description = await scraper_service.scrape_job_description(request.job_url)
        
        if not job_description:
            raise HTTPException(
                status_code=400,
                detail="Either job_description or job_url must be provided"
            )
        
        analysis = await ai_service.analyze_job_description(job_description)
        
        return {
            "success": True,
            "analysis": analysis
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
