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


@app.post("/api/tailor-resume")
async def tailor_resume(
    resume: UploadFile = File(...),
    job_description: Optional[str] = Form(None),
    job_url: Optional[str] = Form(None)
):
    """
    Tailor a resume based on a job description.
    Accepts either job_description text or job_url to scrape.
    """
    try:
        # Validate inputs
        if not job_description and not job_url:
            raise HTTPException(
                status_code=400,
                detail="Either job_description or job_url must be provided"
            )
        
        # Save uploaded resume
        resume_path = f"uploads/{resume.filename}"
        with open(resume_path, "wb") as buffer:
            shutil.copyfileobj(resume.file, buffer)
        
        # Get job description from URL if provided
        if job_url:
            job_description = await scraper_service.scrape_job_description(job_url)
        
        # Parse the resume
        resume_data = document_service.parse_docx(resume_path)
        
        # Use AI to analyze job and tailor resume
        tailored_content = await ai_service.tailor_resume(
            resume_data=resume_data,
            job_description=job_description
        )
        
        # Generate output files
        base_filename = os.path.splitext(resume.filename)[0]
        output_files = {
            "docx": f"outputs/{base_filename}_tailored.docx",
            "pdf": f"outputs/{base_filename}_tailored.pdf",
            "txt": f"outputs/{base_filename}_tailored.txt"
        }
        
        # Create DOCX with XML-level preservation (preserves shapes, backgrounds, all formatting)
        document_service.create_docx_with_xml_preservation(
            resume_path, 
            tailored_content, 
            output_files["docx"]
        )
        
        # Create PDF and TXT (these use basic formatting)
        document_service.create_pdf(tailored_content, output_files["pdf"])
        document_service.create_txt(tailored_content, output_files["txt"])
        
        return {
            "success": True,
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
    
    return FileResponse(
        path=file_path,
        filename=filename,
        media_type="application/octet-stream"
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
