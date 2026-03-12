from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
import os
import shutil
import tempfile
from typing import Optional, List, Dict, Any
from dotenv import load_dotenv
import json

from services.document_service import DocumentService
from services.ai_service import AIService
from services.scraper_service import ScraperService
from services.database_service import DatabaseService

load_dotenv()

app = FastAPI(title="Resume Automator API")

# CORS middleware for local development
# We also need to allow requests from the Chrome extension's side panel,
# which runs at a chrome-extension:// origin. Since FastAPI doesn't support
# prefix wildcards, allow_origins=["*"] is safe here because the server only
# listens on localhost and is never exposed to the internet.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,  # must be False when allow_origins=["*"]
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
document_service = DocumentService()
ai_service = AIService()
scraper_service = ScraperService()
database_service = DatabaseService()

class RefineRequest(BaseModel):
    current_resume_data: dict
    instructions: str
    original_filename: str
    original_text_content: Optional[str] = None # To preserve original diff context
    additional_context: Optional[str] = None

class CoverLetterRequest(BaseModel):
    resume_text: str
    job_description: str
    base_filename: str
    additional_context: Optional[str] = None

class RefineCoverLetterRequest(BaseModel):
    content: str
    instructions: str
    base_filename: str
    additional_context: Optional[str] = None

class ApplicationSaveRequest(BaseModel):
    id: Optional[int] = None
    application_id: Optional[int] = None
    job_title: Optional[str] = "Unknown Role"
    company: Optional[str] = "Unknown Company"
    company_logo: Optional[str] = ""
    job_url: Optional[str] = ""
    apply_url: Optional[str] = ""
    job_description: Optional[str] = ""
    original_resume_path: Optional[str] = ""
    tailored_resume_path: Optional[str] = ""
    cover_letter_path: Optional[str] = ""
    resume_data: Optional[Any] = {}
    cover_letter_text: Optional[str] = ""
    salary_range: Optional[str] = ""
    date_posted: Optional[str] = ""
    deadline: Optional[str] = ""
    job_type: Optional[str] = ""
    location_type: Optional[str] = ""
    location: Optional[str] = ""
    relocation: Optional[Any] = None
    interest_level: Optional[str] = ""
    remarks: Optional[str] = ""
    status: Optional[str] = None
    is_archived: Optional[Any] = None
    resume_changes_summary: Optional[Any] = []
    cover_letter_changes_summary: Optional[Any] = []
    kanban_order: Optional[int] = 0
    
    # Company Ratings & Links
    glassdoor_rating: Optional[str] = None
    glassdoor_url: Optional[str] = None
    indeed_rating: Optional[str] = None
    indeed_url: Optional[str] = None
    linkedin_rating: Optional[str] = None
    linkedin_url: Optional[str] = None
    profile_snapshot: Optional[Any] = None
    override_resume_path: Optional[str] = None
    override_cover_letter_path: Optional[str] = None
    active_resume_type: Optional[str] = 'generated'
    active_cover_letter_type: Optional[str] = 'generated'


class StatusUpdateRequest(BaseModel):
    status: str

class ExperienceModel(BaseModel):
    company: Optional[str] = ""
    position: Optional[str] = ""
    start_date: Optional[str] = ""
    end_date: Optional[str] = ""
    description: Optional[str] = ""

class EducationModel(BaseModel):
    institution: Optional[str] = ""
    degree: Optional[str] = ""
    field_of_study: Optional[str] = ""
    start_date: Optional[str] = ""
    end_date: Optional[str] = ""


class ProfileModel(BaseModel):
    first_name: Optional[str] = ""
    last_name: Optional[str] = ""
    full_name: Optional[str] = ""
    address_line1: Optional[str] = ""
    address_line2: Optional[str] = ""
    city: Optional[str] = ""
    state: Optional[str] = ""
    zip_code: Optional[str] = ""
    phone_primary: Optional[str] = ""
    phone_secondary: Optional[str] = ""
    linkedin_url: Optional[str] = ""
    github_url: Optional[str] = ""
    website_url: Optional[str] = ""
    email: Optional[str] = ""
    job_title: Optional[str] = ""
    bio: Optional[str] = ""
    skills: List[str] = []
    experiences: List[ExperienceModel] = []
    educations: List[EducationModel] = []
    certificates: List[dict] = []
    other: List[dict] = []
    base_resume_path: Optional[str] = None
    long_form_resume_path: Optional[str] = None
    additional_docs: List[dict] = []



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
    config = get_config()
    
    # Use the live prompts from ai_service, which are already merged with defaults
    config_dict: Dict[str, Any] = config
    config_dict.update({"prompts": ai_service.prompts})
    
    return config_dict

@app.post("/api/config")
async def update_app_config(config: dict):
    """Update application configuration"""
    try:
        # Load existing to merge
        existing = get_config()
        existing.update(config)
        
        with open(CONFIG_PATH, 'w') as f:
            json.dump(existing, f, indent=4)
        
        # Reload services
        ai_service.load_config()
        
        return {"message": "Configuration updated", "config": existing}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@app.get("/api/profile")
async def get_profile():
    try:
        return database_service.get_profile()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/profile")
async def save_profile(profile: ProfileModel):
    try:
        return {"id": database_service.save_profile(profile.dict())}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/scan-contact-info")
async def scan_contact_info(resume: UploadFile = File(...)):
    try:
        content = await resume.read()
        # Save temp file for parsing
        with tempfile.NamedTemporaryFile(delete=False, suffix=".docx") as tmp:
             tmp.write(content)
             tmp_path = tmp.name
        
        # Parse text
        parsed = document_service.parse_docx(tmp_path)
        full_text = "\n".join(parsed.get("full_text", []))
        
        # Extract info
        extracted = await ai_service.extract_profile_data(full_text)
        
        os.unlink(tmp_path)
        return extracted
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/profile/upload-resume")
async def upload_profile_resume(
    resume: UploadFile = File(...),
    resume_type: str = Form(...)  # "base" or "long_form"
):
    """Upload and save a base or long-form resume to the user profile."""
    try:
        if resume_type not in ["base", "long_form"]:
            raise HTTPException(status_code=400, detail="resume_type must be 'base' or 'long_form'")
        
        # Save the file to a dedicated profile resumes directory
        os.makedirs("uploads/profile_resumes", exist_ok=True)
        filename = f"{resume_type}_resume_{resume.filename}"
        save_path = f"uploads/profile_resumes/{filename}"
        
        content = await resume.read()
        with open(save_path, "wb") as f:
            f.write(content)
        
        # Update profile in DB with new path
        field_key = "base_resume_path" if resume_type == "base" else "long_form_resume_path"
        profile = database_service.get_profile()
        profile[field_key] = save_path
        database_service.save_profile(profile)
        
        return {"path": save_path, "filename": resume.filename, "type": resume_type}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/profile/resume/{resume_type}")
async def delete_profile_resume(resume_type: str):
    """Remove a base or long-form resume from the user profile."""
    try:
        if resume_type not in ["base", "long_form"]:
            raise HTTPException(status_code=400, detail="resume_type must be 'base' or 'long_form'")

        field_key = "base_resume_path" if resume_type == "base" else "long_form_resume_path"
        profile = database_service.get_profile()
        old_path = profile.get(field_key)
        if old_path and os.path.exists(old_path):
            os.remove(old_path)
        profile[field_key] = None
        database_service.save_profile(profile)
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/profile/upload-additional-doc")
async def upload_additional_doc(
    document: UploadFile = File(...),
    label: str = Form("")  # Optional user-supplied label
):
    """Upload an additional supplemental document (PDF, DOCX, TXT) to the user profile."""
    try:
        os.makedirs("uploads/profile_docs", exist_ok=True)
        safe_name = document.filename.replace(" ", "_")
        save_path = f"uploads/profile_docs/{safe_name}"
        content = await document.read()
        with open(save_path, "wb") as f:
            f.write(content)

        profile = database_service.get_profile()
        docs = profile.get("additional_docs", []) or []
        docs.append({"filename": document.filename, "path": save_path, "label": label})
        profile["additional_docs"] = docs
        database_service.save_profile(profile)
        return {"filename": document.filename, "path": save_path, "label": label}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/profile/additional-doc")
async def delete_additional_doc(path: str):
    """Remove an additional document from the user profile by its path."""
    try:
        profile = database_service.get_profile()
        docs = profile.get("additional_docs", []) or []
        doc_to_remove = next((d for d in docs if d["path"] == path), None)
        if doc_to_remove and os.path.exists(doc_to_remove["path"]):
            os.remove(doc_to_remove["path"])
        profile["additional_docs"] = [d for d in docs if d["path"] != path]
        database_service.save_profile(profile)
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/profile/file")
async def serve_profile_file(path: str):
    """Serve a profile document (resume or additional doc) by its relative path for preview/download."""
    # Sanitize: only allow files within the uploads directory
    abs_path = os.path.abspath(path)
    uploads_dir = os.path.abspath("uploads")
    if not abs_path.startswith(uploads_dir):
        raise HTTPException(status_code=403, detail="Access denied")
    if not os.path.exists(abs_path):
        raise HTTPException(status_code=404, detail="File not found")
    filename = os.path.basename(abs_path)
    return FileResponse(abs_path, filename=filename)

@app.post("/api/tailor-resume")
async def tailor_resume(
    resume: Optional[UploadFile] = File(None),
    job_description: Optional[str] = Form(None),
    job_url: Optional[str] = Form(None),
    use_default_resume: bool = Form(False),
    additional_context_paths: Optional[str] = Form(None), # JSON list of paths
    additional_files: List[UploadFile] = File([])
):
    """
    Tailor a resume based on a job description.
    Accepts either job_description text or job_url to scrape.
    Supports using a default local resume file for testing.
    """
    try:
        config = get_config()
        profile = database_service.get_profile()
        file_path = None
        original_filename = "resume.docx"
        
        if resume:
            # Use uploaded file
            original_filename = resume.filename
            file_path = f"uploads/{original_filename}"
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(resume.file, buffer)
        elif profile.get("base_resume_path"):
            # Use base resume from profile
            base_resume_path = profile["base_resume_path"]
            if not os.path.exists(base_resume_path):
                # Check absolute vs relative
                if not base_resume_path.startswith('/'):
                    # might be relative to project root?
                    pass
                else:
                    raise HTTPException(status_code=404, detail=f"Base resume not found at {base_resume_path}")
            
            original_filename = os.path.basename(base_resume_path)
            file_path = f"uploads/{original_filename}"
            shutil.copy2(base_resume_path, file_path)
        elif use_default_resume and config.get("default_resume_path"):
            # Fallback to config default (kept for legacy/test support)
            default_path = config["default_resume_path"]
            if not os.path.exists(default_path):
                raise HTTPException(status_code=404, detail=f"Default resume not found at {default_path}")
            
            original_filename = os.path.basename(default_path)
            file_path = f"uploads/{original_filename}"
            shutil.copy2(default_path, file_path)
        else:
            raise HTTPException(status_code=400, detail="No resume provided. Please upload a resume or set a Base Resume in your profile.")

        # Handle Job Description Source
        final_job_description: str = job_description or ""
        if job_url:
            print(f"Scraping job from: {job_url}")
            try:
                scraped_text = await scraper_service.scrape_job_description(job_url)
                if scraped_text:
                    if final_job_description:
                         final_job_description += "\n\n" + scraped_text
                    else:
                        final_job_description = scraped_text
            except Exception as e:
                 print(f"Warning: Scraper failed: {e}")
                 # If scraping failed and no text provided, we must error out with specific message
                 if not final_job_description:
                     raise HTTPException(status_code=400, detail=f"Could not auto-scrape content from URL. Please paste the job description manually.")

        if not final_job_description:
            raise HTTPException(status_code=400, detail="No job description provided (text or URL)")
            
        print(f"Processing resume: {original_filename}")
        
        # --- Handle Additional Context Documents ---
        additional_context_chunks: List[str] = []
        
        # 1. Process paths from profile
        if additional_context_paths:
            try:
                paths = json.loads(str(additional_context_paths))
                for path in paths:
                    if os.path.exists(path):
                         # Extract text using document_service
                         path_str = str(path)
                         if path_str.endswith('.docx'):
                             doc_data = document_service.parse_docx(path)
                             text = "\n".join(doc_data.get("full_text", []))
                             additional_context_chunks.append(f"\n--- Context Document: {os.path.basename(path)} ---\n{text}\n")
                         elif path_str.endswith('.pdf'):
                             text = document_service.extract_text_from_pdf(path)
                             if text:
                                 additional_context_chunks.append(f"\n--- Context Document: {os.path.basename(path)} ---\n{text}\n")
                         elif path_str.endswith('.txt'):
                             text = document_service.extract_text_from_txt(path)
                             if text:
                                 additional_context_chunks.append(f"\n--- Context Document: {os.path.basename(path)} ---\n{text}\n")
            except Exception as e:
                print(f"Error processing additional context paths: {e}")

        # 2. Process newly uploaded files
        for adj_file in additional_files:
            try:
                # Save temporarily to parse
                suffix = os.path.splitext(adj_file.filename)[1] if adj_file.filename else ""
                with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
                    shutil.copyfileobj(adj_file.file, tmp)
                    tmp_path = tmp.name
                
                if adj_file.filename.endswith('.docx'):
                    doc_data = document_service.parse_docx(tmp_path)
                    text = "\n".join(doc_data.get("full_text", []))
                    additional_context_chunks.append(f"\n--- Context Document: {adj_file.filename} ---\n{text}\n")
                elif adj_file.filename.endswith('.pdf'):
                    text = document_service.extract_text_from_pdf(tmp_path)
                    if text:
                        additional_context_chunks.append(f"\n--- Context Document: {adj_file.filename} ---\n{text}\n")
                elif adj_file.filename.endswith('.txt'):
                    text = document_service.extract_text_from_txt(tmp_path)
                    if text:
                        additional_context_chunks.append(f"\n--- Context Document: {adj_file.filename} ---\n{text}\n")
                
                os.remove(tmp_path)
            except Exception as e:
                print(f"Error processing additional uploaded file: {e}")
        
        all_additional_context = "".join(additional_context_chunks)
        
        # 1. Parse Resume
        resume_data = document_service.parse_docx(file_path)
        
        # Ensure original has a PDF version for previewing
        if file_path.endswith('.docx'):
            original_pdf_path = file_path.replace('.docx', '.pdf')
            if not os.path.exists(original_pdf_path):
                document_service.create_pdf_from_docx(file_path, original_pdf_path)
        
        # 2. Tailor with AI
        tailored_resume_data = await ai_service.tailor_resume(resume_data, final_job_description, additional_context=all_additional_context)
        
        # 3. Generate Output
        base_name = os.path.splitext(original_filename)[0]
        output_filename = f"{base_name}_tailored.docx"
        output_path = f"outputs/{output_filename}"
        
        # Use XML-preserving generation
        document_service.create_docx_with_xml_preservation(
            file_path,
            tailored_resume_data,
            output_path
        )
        
        # Generate PDF and TXT versions
        pdf_filename = f"{base_name}_tailored.pdf"
        pdf_path = f"outputs/{pdf_filename}"
        txt_filename = f"{base_name}_tailored.txt"
        txt_path = f"outputs/{txt_filename}"
        
        # Create PDF directly from DOCX to preserve formatting
        pdf_result = document_service.create_pdf_from_docx(output_path, pdf_path)
        pdf_success = pdf_result.get('success', False) if isinstance(pdf_result, dict) else pdf_result
        font_info = pdf_result.get('font_info', {}) if isinstance(pdf_result, dict) else {}
        
        # Create TXT
        document_service.create_txt(tailored_resume_data, txt_path)
        
        # Create Redline PDF (Changes Highlighted)
        redline_docx_filename = f"{base_name}_tailored_redline.docx"
        redline_docx_path = f"outputs/{redline_docx_filename}"
        redline_pdf_filename = f"{base_name}_tailored_redline.pdf"
        redline_pdf_path = f"outputs/{redline_pdf_filename}"
        
        try:
            document_service.create_redline_docx(file_path, tailored_resume_data, redline_docx_path)
            document_service.create_pdf_from_docx(redline_docx_path, redline_pdf_path)
        except Exception as e:
            print(f"⚠️ Redline generation failed: {e}")
        
        # Create preview text (first 500 characters of content)
        preview_chunks: List[str] = []
        for section in tailored_resume_data.get("sections", [])[:3]:  # First 3 sections
            if section.get("title") and section.get("type") != "table":
                preview_chunks.append(f"{section['title']}\n")
                for item in section.get("content", [])[:2]:  # First 2 items per section
                    preview_chunks.append(f"• {item[:100]}...\n" if len(str(item)) > 100 else f"• {item}\n")
                preview_chunks.append("\n")
        
        preview_text = "".join(preview_chunks)
        
        if not preview_text:
            preview_text = tailored_resume_data.get("summary", "Resume tailored successfully")
        
        # Build response
        # Extract change summary from AI response
        change_summary = tailored_resume_data.get("change_summary", [])
        if isinstance(change_summary, str):
            change_summary = [change_summary]
            
        # Prepare text for diff view (join full_text list)
        original_text_content = "\n\n".join(resume_data.get("full_text", []))
        tailored_text_content = "\n\n".join(tailored_resume_data.get("full_text", []))
        
        response = {
            "message": "Resume tailored successfully",
            "files": {
                "docx": f"/api/download/{base_name}_tailored.docx",
                "pdf": f"/api/download/{base_name}_tailored.pdf",
                "redline_pdf": f"/api/download/{base_name}_tailored_redline.pdf",
                "txt": f"/api/download/{base_name}_tailored.txt"
            },
            "preview": preview_text.strip(),
            "change_summary": change_summary,
            "diff_data": {
                "original": original_text_content,
                "tailored": tailored_text_content
            },
            "resume_data": tailored_resume_data,
            "original_filename": original_filename,
            "job_metadata": tailored_resume_data.get("job_metadata", {}),
            "job_description": final_job_description,  # Return the actual text used (scraped or pasted)
            "extracted_context": all_additional_context
        }
        
        # Add font warnings if any fonts were substituted
        if font_info.get('missing_fonts'):
            warnings = []
            for missing in font_info['missing_fonts']:
                warnings.append(
                    f"Font '{missing['font']}' not available - substituted with '{missing['substitute']}'. "
                    f"Install with: {missing['install_command']}"
                )
            response['font_warnings'] = warnings
        
        return response
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/refine-resume")
async def refine_resume(request: RefineRequest):
    try:
        current_data = request.current_resume_data
        
        # 1. Refine Data with AI
        refined_data = await ai_service.refine_resume(
            current_data, 
            request.instructions, 
            additional_context=request.additional_context
        )
        
        # 2. File Paths
        original_filename = request.original_filename
        file_path = f"uploads/{original_filename}"
        
        if not os.path.exists(file_path):
             print(f"Warning: Original file {file_path} not found.")
             
        base_name = os.path.splitext(original_filename)[0]
        
        output_filename = f"{base_name}_tailored.docx"
        output_path = f"outputs/{output_filename}"
        pdf_filename = f"{base_name}_tailored.pdf"
        pdf_path = f"outputs/{pdf_filename}"
        redline_docx_path = f"outputs/{base_name}_tailored_redline.docx"
        redline_pdf_path = f"outputs/{base_name}_tailored_redline.pdf"
        txt_path = f"outputs/{base_name}_tailored.txt"
        
        # 3. Regenerate Documents
        document_service.create_docx_with_xml_preservation(file_path, refined_data, output_path)
        
        try:
            document_service.create_redline_docx(file_path, refined_data, redline_docx_path)
            document_service.create_pdf_from_docx(redline_docx_path, redline_pdf_path)
        except Exception as e:
            print(f"Refine redline error: {e}")
            
        pdf_result = document_service.create_pdf_from_docx(output_path, pdf_path)
        font_info = pdf_result.get('font_info', {}) if isinstance(pdf_result, dict) else {}
        
        document_service.create_txt(refined_data, txt_path)
        
        # 4. Response
        preview_text = refined_data.get("summary", "Resume refined successfully")

        change_summary = refined_data.get("change_summary", [])
        if isinstance(change_summary, str): change_summary = [change_summary]
        
        prev_text = "\n\n".join(current_data.get("full_text", []))
        new_text = "\n\n".join(refined_data.get("full_text", []))

        response = {
            "message": "Resume refined successfully",
            "files": {
                "docx": f"/api/download/{base_name}_tailored.docx",
                "pdf": f"/api/download/{base_name}_tailored.pdf",
                "redline_pdf": f"/api/download/{base_name}_tailored_redline.pdf",
                "txt": f"/api/download/{base_name}_tailored.txt"
            },
            "preview": preview_text,
            "change_summary": change_summary,
            "diff_data": {
                "original": prev_text,
                "tailored": new_text
            },
            "resume_data": refined_data,
            "original_filename": original_filename
        }
        
        if font_info.get('missing_fonts'):
             response['font_warnings'] = [f"Font '{m['font']}' substituted." for m in font_info['missing_fonts']]
        
        return response

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/generate-cover-letter")
async def generate_cover_letter_endpoint(request: CoverLetterRequest):
    try:
        # Fetch profile
        user_profile = database_service.get_profile()
        
        result = await ai_service.generate_cover_letter(
            request.resume_text, 
            request.job_description, 
            user_profile,
            additional_context=request.additional_context
        )
        content = result.get("content", "")
        
        base_name = os.path.splitext(request.base_filename)[0]
        output_docx = f"outputs/{base_name}_cover_letter.docx"
        output_pdf = f"outputs/{base_name}_cover_letter.pdf"
        output_txt = f"outputs/{base_name}_cover_letter.txt"
        
        document_service.create_cover_letter_docx(content, output_docx)
        document_service.create_pdf_from_docx(output_docx, output_pdf)
        
        with open(output_txt, 'w') as f:
            f.write(content)
            
        return {
            "message": "Cover letter generated",
            "content": content,
            "generation_summary": result.get("generation_summary", []),
            "missing_fields": result.get("missing_fields", []),
            "detected_info": result.get("detected_info", {}),
            "files": {
                "docx": f"/api/download/{base_name}_cover_letter.docx",
                "pdf": f"/api/download/{base_name}_cover_letter.pdf",
                "txt": f"/api/download/{base_name}_cover_letter.txt"
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/refine-cover-letter")
async def refine_cover_letter_endpoint(request: RefineCoverLetterRequest):
    try:
        result = await ai_service.refine_cover_letter(
            request.content, 
            request.instructions, 
            additional_context=request.additional_context
        )
        content = result.get("content", "")
        
        base_name = os.path.splitext(request.base_filename)[0]
        output_docx = f"outputs/{base_name}_cover_letter.docx"
        output_pdf = f"outputs/{base_name}_cover_letter.pdf"
        output_txt = f"outputs/{base_name}_cover_letter.txt"
        
        document_service.create_cover_letter_docx(content, output_docx)
        document_service.create_pdf_from_docx(output_docx, output_pdf)
        
        with open(output_txt, 'w') as f:
            f.write(content)
            
        return {
            "message": "Cover letter refined",
            "content": content,
            "files": {
                "docx": f"/api/download/{base_name}_cover_letter.docx",
                "pdf": f"/api/download/{base_name}_cover_letter.pdf",
                "txt": f"/api/download/{base_name}_cover_letter.txt"
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/save-application")
async def save_application(request: ApplicationSaveRequest):
    try:
        app_id = database_service.save_application(request.dict())
        return {"message": "Application saved", "id": app_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/applications/{app_id}")
async def get_application(app_id: int):
    """Get a single application by ID."""
    try:
        app_data = database_service.get_application_by_id(app_id)
        if app_data:
            return app_data
        raise HTTPException(status_code=404, detail="Application not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/applications/{app_id}")
async def update_application(app_id: int, request: ApplicationSaveRequest):
    """Update an existing application's fields."""
    try:
        success = database_service.update_application(app_id, request.dict(exclude_unset=True))
        if success:
            return {"message": "Application updated", "id": app_id}
        raise HTTPException(status_code=404, detail="Application not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/applications")
async def get_applications():
    try:
        apps = database_service.get_applications()
        return apps
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/applications/{app_id}/status")
async def update_application_status(app_id: int, request: StatusUpdateRequest):
    try:
        success = database_service.update_application_status(app_id, request.status)
        if success:
            return {"message": "Application status updated successfully"}
        else:
            raise HTTPException(status_code=404, detail="Application not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/applications/{app_id}")
async def delete_application(app_id: int):
    try:
        success = database_service.delete_application(app_id)
        if success:
            return {"message": "Application deleted successfully"}
        else:
            raise HTTPException(status_code=404, detail="Application not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/applications/{application_id}/override-resume")
async def override_resume(application_id: int, file: UploadFile = File(...)):
    try:
        # Save file
        content = await file.read()
        filename = f"override_resume_{application_id}_{file.filename}"
        file_path = f"outputs/{filename}"
        with open(file_path, "wb") as f:
            f.write(content)
            
        # Extract text and process profile
        text = ""
        if file.filename.endswith('.docx'):
            doc_data = document_service.parse_docx(file_path)
            text = "\n".join(doc_data.get("full_text", []))
        elif file.filename.endswith('.pdf'):
            text = document_service.extract_text_from_pdf(file_path)
        elif file.filename.endswith('.txt'):
            text = document_service.extract_text_from_txt(file_path)
        
        profile_snapshot = None
        if text:
            profile_snapshot = await ai_service.extract_profile_data(text)
        
        database_service.update_application(application_id, {
            "override_resume_path": filename,
            "active_resume_type": "override",
            "profile_snapshot": profile_snapshot
        })
        
        return {"message": "Override resume updated", "path": filename, "profile_snapshot": profile_snapshot}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/applications/{application_id}/override-cover-letter")
async def override_cover_letter(application_id: int, file: UploadFile = File(...)):
    try:
        # Save file
        content = await file.read()
        filename = f"override_cl_{application_id}_{file.filename}"
        file_path = f"outputs/{filename}"
        with open(file_path, "wb") as f:
            f.write(content)
            
        database_service.update_application(application_id, {
            "override_cover_letter_path": filename,
            "active_cover_letter_type": "override"
        })
        
        return {"message": "Override cover letter updated", "path": filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/applications/{application_id}/toggle-active")
async def toggle_active_endpoint(application_id: int, request: Request):
    try:
        data = await request.json()
        doc_type = data.get("type") # 'resume' or 'cover_letter'
        active_version = data.get("active") # 'generated' or 'override'
        
        update_data = {}
        if doc_type == 'resume':
            update_data["active_resume_type"] = active_version
        elif doc_type == 'cover_letter':
            update_data["active_cover_letter_type"] = active_version
            
        success = database_service.update_application(application_id, update_data)
        if not success:
            raise HTTPException(status_code=404, detail="Application not found")
            
        return {"message": "Active version updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class LogoUpdateRequest(BaseModel):
    company_logo: Optional[str] = ""

@app.patch("/api/applications/{app_id}/logo")
async def update_application_logo(app_id: int, request: LogoUpdateRequest):
    try:
        success = database_service.update_application_logo(app_id, request.company_logo)
        if success:
            return {"message": "Logo updated"}
        else:
            raise HTTPException(status_code=404, detail="Application not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ArchiveRequest(BaseModel):
    archived: bool

@app.patch("/api/applications/{app_id}/archive")
async def archive_application(app_id: int, request: ArchiveRequest):
    try:
        success = database_service.archive_application(app_id, request.archived)
        if success:
            action = "archived" if request.archived else "unarchived"
            return {"message": f"Application {action} successfully"}
        else:
            raise HTTPException(status_code=404, detail="Application not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/download/{filename}")

async def download_file(filename: str):
    """
    Download a tailored resume file.
    """
    file_path = f"outputs/{filename}"
    
    if not os.path.exists(file_path):
        # Fallback: Check uploads directory (for original resumes)
        file_path = f"uploads/{filename}"
        
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found in outputs or uploads")
    
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

@app.get("/api/check-job-url")
async def check_job_url(url: str):
    """Check if a job URL has already been processed. Returns full application data if found."""
    try:
        app_data = database_service.get_application_by_url(url)
        if app_data:
            return {"exists": True, "application": app_data}
        return {"exists": False}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/debug/urls")
async def debug_urls():
    """Debug: List all job URLs."""
    try:
        # Quick query using SQLAlchemy session directly or adding a method in service
        # For speed: using the service's session logic
        session = database_service.Session()
        try:
            from services.database_service import Application
            apps = session.query(Application).all()
            return [{"id": a.id, "job_url": a.job_url, "job_title": a.job_title} for a in apps]
        finally:
            session.close()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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


@app.post("/api/fetch-models")
async def fetch_available_models(config: dict):
    """Fetch available models from the specified provider"""
    try:
        # Extract parameters from config
        api_key = config.get("api_key")
        provider = config.get("provider")
        base_url = config.get("base_url")

        # Prepare kwargs for the service call
        kwargs = {
            "provider": provider,
            "base_url": base_url
        }

        # Handle API key based on provider, providing default from environment if not explicitly given
        if provider == "openai" and not api_key:
            kwargs["api_key"] = os.getenv("OPENAI_API_KEY", "")
        elif provider == "google" and not api_key:
            kwargs["api_key"] = os.getenv("GOOGLE_API_KEY", "")
        else:
            kwargs["api_key"] = api_key # Use provided api_key if available or for other providers

        models = await ai_service.list_available_models(**kwargs)
        return {"models": models}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
