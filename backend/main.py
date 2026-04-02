from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
import os
import shutil
import tempfile
from typing import Optional, List, Dict, Any
from dotenv import load_dotenv
import json
import requests

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



def calculate_commute_for_app(app_id: int):
    # Retrieve app to get location
    app = database_service.get_application_by_id(app_id)
    if not app: return
    
    dest_str = app.get('location')
    if not dest_str or 'remote' in dest_str.lower() or str(app.get('location_type', '')).lower() == 'remote':
        database_service.update_application(app_id, {
            'commute_time_mins': 0, 
            'commute_distance_miles': 0.0,
            'commute_details': {'Driving': {'mins': 0, 'distance': 0.0}}
        })
        return
        
    profile = database_service.get_profile()
    if not profile: return
    
    origin_parts = []
    if profile.get('address_line1'): origin_parts.append(profile['address_line1'])
    if profile.get('city'): origin_parts.append(profile['city'])
    if profile.get('state'): origin_parts.append(profile['state'])
    origin_str = ", ".join(origin_parts)
    if not origin_str: return
    
    # Get preferred commute types from profile
    prefs = profile.get('preferences', {})
    commute_types = prefs.get('commute_types', ['Driving'])
    if not isinstance(commute_types, list):
        commute_types = [commute_types]
    
    details = {}
    
    try:
        r1 = requests.get(f"https://nominatim.openstreetmap.org/search?format=json&q={origin_str}&limit=1", headers={'Accept-Language': 'en', 'User-Agent': 'JobAppTracker'})
        r1.raise_for_status()
        loc1 = r1.json()
        
        r2 = requests.get(f"https://nominatim.openstreetmap.org/search?format=json&q={dest_str}&limit=1", headers={'Accept-Language': 'en', 'User-Agent': 'JobAppTracker'})
        r2.raise_for_status()
        loc2 = r2.json()
        
        if loc1 and loc2:
            lon1, lat1 = loc1[0]['lon'], loc1[0]['lat']
            lon2, lat2 = loc2[0]['lon'], loc2[0]['lat']
            
            # Get driving info first as a reliable base for distance
            driving_mins = 0
            driving_dist_meters = 0
            
            try:
                base_res = requests.get(f"https://router.project-osrm.org/route/v1/driving/{lon1},{lat1};{lon2},{lat2}?overview=false")
                if base_res.ok:
                    base_data = base_res.json()
                    if base_data.get('code') == 'Ok' and base_data.get('routes'):
                        driving_mins = int(round(base_data['routes'][0]['duration'] / 60))
                        driving_dist_meters = base_data['routes'][0]['distance']
            except:
                pass

            for ctype in commute_types:
                mode = 'driving'
                if ctype == 'Walking': mode = 'walking'
                elif ctype == 'Bicycle': mode = 'bicycle'
                elif ctype == 'Public Transportation': mode = 'transit'
                elif ctype == 'Flight': mode = 'flight'
                
                if mode == 'driving':
                    if driving_dist_meters > 0:
                        details[ctype] = {
                            'mins': driving_mins,
                            'distance': round(driving_dist_meters * 0.000621371, 1)
                        }
                elif mode == 'walking':
                    if driving_dist_meters > 0:
                        # 5 km/h = 83.3 meters per minute
                        walk_mins = int(round(driving_dist_meters / 83.3))
                        details[ctype] = {
                            'mins': walk_mins,
                            'distance': round(driving_dist_meters * 0.000621371, 1)
                        }
                elif mode == 'bicycle':
                    if driving_dist_meters > 0:
                        # 16 km/h = 266.6 meters per minute
                        bike_mins = int(round(driving_dist_meters / 266.6))
                        details[ctype] = {
                            'mins': bike_mins,
                            'distance': round(driving_dist_meters * 0.000621371, 1)
                        }
                elif mode == 'transit':
                    if driving_mins > 0:
                        # Roughly 1.5x driving plus 10 min wait
                        transit_mins = int(driving_mins * 1.5) + 10
                        details[ctype] = {
                            'mins': transit_mins,
                            'distance': round(driving_dist_meters * 0.000621371, 1)
                        }
                elif mode == 'flight':
                    # Haversine distance for flight
                    from math import radians, cos, sin, asin, sqrt
                    def haversine(lon1, lat1, lon2, lat2):
                        lon1, lat1, lon2, lat2 = map(radians, [float(lon1), float(lat1), float(lon2), float(lat2)])
                        dlon = lon2 - lon1
                        dlat = lat2 - lat1
                        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
                        c = 2 * asin(sqrt(a))
                        r = 3956 # Radius of earth in miles
                        return c * r
                    
                    dist_miles = haversine(lon1, lat1, lon2, lat2)
                    # Flight time: 500 mph + 2 hours for airport overhead
                    if dist_miles > 50:
                        f_mins = int((dist_miles / 500.0) * 60) + 120
                        details[ctype] = {
                            'mins': f_mins,
                            'distance': int(dist_miles)
                        }
            
            # Update main fields with Driving info or first available
            main_mins = 0
            main_dist = 0.0
            if 'Driving' in details:
                main_mins = details['Driving']['mins']
                main_dist = details['Driving']['distance']
            elif details:
                first_key = list(details.keys())[0]
                main_mins = details[first_key]['mins']
                main_dist = details[first_key]['distance']
            
            database_service.update_application(app_id, {
                'commute_time_mins': main_mins,
                'commute_distance_miles': main_dist,
                'commute_details': details
            })
    except Exception as e:
        print(f"Error calculating commute for app {app_id}: {e}")

@app.post("/api/profile/recalculate-commutes")
async def recalculate_commutes(background_tasks: BackgroundTasks):
    apps = database_service.get_applications()
    for ap in apps:
        background_tasks.add_task(calculate_commute_for_app, ap['id'])
    return {"message": "Recalculation started in background."}

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
    instructions: Optional[str] = ""

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
    pipeline_stage: Optional[str] = 'saved'
    commute_time_mins: Optional[int] = None
    commute_distance_miles: Optional[float] = None
    match_score: Optional[int] = None
    match_details: Optional[Any] = None
    commute_details: Optional[Any] = {}



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
    preferences: Optional[dict] = {}
    social_links: List[dict] = []



# Ensure directories exist
os.makedirs("uploads", exist_ok=True)
os.makedirs("outputs", exist_ok=True)


class CaptureJobRequest(BaseModel):
    url: Optional[str] = None
    text: Optional[str] = None

class JobDescriptionRequest(BaseModel):
    job_description: Optional[str] = None
    job_url: Optional[str] = None

class LinkedInConnectionModel(BaseModel):
    name: str
    headline: Optional[str] = None
    profile_url: str
    company_id: Optional[str] = None
    company_name: Optional[str] = None

class LinkedInSyncRequest(BaseModel):
    connections: List[LinkedInConnectionModel]


@app.get("/")
async def root():
    return {
        "message": "Resume Automator API",
        "version": "1.0.0",
        "status": "running"
    }


import json
import requests

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

@app.post("/api/score-job-match")
async def score_job_match(
    resume: Optional[UploadFile] = File(None),
    job_description: Optional[str] = Form(None),
    job_url: Optional[str] = Form(None),
    use_default_resume: bool = Form(False),
    additional_context_paths: Optional[str] = Form(None),
    tailored_resume_text: Optional[str] = Form(None)
):
    """
    Score the match between a resume and a job description.
    """
    try:
        config = get_config()
        profile = database_service.get_profile()
        file_path = None
        
        if tailored_resume_text:
            resume_text = tailored_resume_text
        else:
            if resume:
                file_path = f"uploads/{resume.filename}"
                with open(file_path, "wb") as buffer:
                    shutil.copyfileobj(resume.file, buffer)
            elif profile.get("base_resume_path") and os.path.exists(profile["base_resume_path"]):
                file_path = profile["base_resume_path"]
            elif use_default_resume and config.get("default_resume_path") and os.path.exists(config["default_resume_path"]):
                file_path = config["default_resume_path"]
            else:
                raise HTTPException(status_code=400, detail="No resume provided or found in profile.")

            resume_text = document_service.extract_text(file_path)
        final_job_description: str = job_description or ""
        if job_url:
            scraped_text = await scraper_service.scrape_job_description(job_url)
            if scraped_text:
                final_job_description = scraped_text + "\n\n" + final_job_description

        if not final_job_description.strip():
            raise HTTPException(status_code=400, detail="Job description or valid URL is required.")

        additional_context_text = ""
        if additional_context_paths:
            paths = json.loads(additional_context_paths)
            for path in paths:
                if os.path.exists(path):
                    additional_context_text += f"\n--- Context from {os.path.basename(path)} ---\n"
                    additional_context_text += document_service.extract_text(path) + "\n"

        result = await ai_service.score_job_match(
            resume_text=resume_text,
            job_description=final_job_description,
            additional_context=additional_context_text
        )

        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/tailor-resume")
async def tailor_resume(
    resume: Optional[UploadFile] = File(None),
    job_description: Optional[str] = Form(None),
    job_url: Optional[str] = Form(None),
    use_default_resume: bool = Form(False),
    additional_context_paths: Optional[str] = Form(None), # JSON list of paths
    additional_files: List[UploadFile] = File([]),
    instructions: Optional[str] = Form("")
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
                # Some clients might send double-encoded JSON or weird strings
                if isinstance(additional_context_paths, str) and (additional_context_paths.startswith('[') or additional_context_paths.startswith('{')):
                    paths = json.loads(additional_context_paths)
                else:
                    paths = [additional_context_paths] if additional_context_paths else []

                for path in paths:
                    if path and os.path.exists(str(path)):
                         # Extract text using document_service
                         path_str = str(path)
                         if path_str.endswith('.docx'):
                             doc_data = document_service.parse_docx(path_str)
                             text = "\n".join(doc_data.get("full_text", []))
                             additional_context_chunks.append(f"\n--- Context Document: {os.path.basename(path_str)} ---\n{text}\n")
                         elif path_str.endswith('.pdf'):
                             text = document_service.extract_text_from_pdf(path_str)
                             if text:
                                 additional_context_chunks.append(f"\n--- Context Document: {os.path.basename(path_str)} ---\n{text}\n")
                         elif path_str.endswith('.txt'):
                             text = document_service.extract_text_from_txt(path_str)
                             if text:
                                 additional_context_chunks.append(f"\n--- Context Document: {os.path.basename(path_str)} ---\n{text}\n")
            except Exception as e:
                print(f"Warning: Failed to parse additional_context_paths: {e}")
                # Fallback: if it's just a single string path that's not JSON
                if isinstance(additional_context_paths, str) and os.path.exists(additional_context_paths):
                    path_str = str(additional_context_paths)
                    if path_str.endswith('.docx'):
                        doc_data = document_service.parse_docx(path_str)
                        text = "\n".join(doc_data.get("full_text", []))
                        additional_context_chunks.append(f"\n--- Context Document: {os.path.basename(path_str)} ---\n{text}\n")
                    elif path_str.endswith('.pdf'):
                        text = document_service.extract_text_from_pdf(path_str)
                        if text:
                            additional_context_chunks.append(f"\n--- Context Document: {os.path.basename(path_str)} ---\n{text}\n")

        # 2. Add text from newly uploaded files
        if additional_files:
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
                    
                    if os.path.exists(tmp_path):
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
        tailored_resume_data = await ai_service.tailor_resume(
            resume_data, 
            final_job_description, 
            additional_context=all_additional_context,
            instructions=instructions
        )
        
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
            additional_context=request.additional_context,
            instructions=request.instructions
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
async def save_application(request: ApplicationSaveRequest, background_tasks: BackgroundTasks):
    try:
        app_id = database_service.save_application(request.dict())
        background_tasks.add_task(calculate_commute_for_app, app_id)
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
async def update_application(app_id: int, request: ApplicationSaveRequest, background_tasks: BackgroundTasks):
    """Update an existing application's fields."""
    try:
        success = database_service.update_application(app_id, request.dict(exclude_unset=True))
        if success:
            if 'location' in request.dict(exclude_unset=True) or 'location_type' in request.dict(exclude_unset=True):
                background_tasks.add_task(calculate_commute_for_app, app_id)
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

        return {"message": "Active version updated"}
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

@app.delete("/api/applications/{application_id}/override/{doc_type}")
async def delete_application_override(application_id: int, doc_type: str):
    """
    Remove an override (custom) file for a resume or cover letter.
    Sets the active type back to 'generated'.
    """
    try:
        if doc_type not in ["resume", "cover_letter"]:
            raise HTTPException(status_code=400, detail="doc_type must be 'resume' or 'cover_letter'")
        
        field = "override_resume_path" if doc_type == "resume" else "override_cover_letter_path"
        active_field = "active_resume_type" if doc_type == "resume" else "active_cover_letter_type"
        
        # Get application to find file path
        app_data = database_service.get_application_by_id(application_id)
        if not app_data:
            raise HTTPException(status_code=404, detail="Application not found")
        
        filename = app_data.get(field)
        if filename:
            file_path = f"outputs/{filename}"
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except Exception as e:
                    print(f"Warning: Failed to delete physical file {file_path}: {e}")
        
        # Update database
        database_service.update_application(application_id, {
            field: None,
            active_field: "generated"
        })
        
        return {"message": f"Override {doc_type} removed"}
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


@app.post("/api/profile/recalculate-commutes")
async def recalculate_commutes(background_tasks: BackgroundTasks):
    """Trigger background recalculation of commutes for all applications."""
    try:
        apps = database_service.get_applications()
        for app in apps:
            if app.get('id'):
                background_tasks.add_task(calculate_commute_for_app, app['id'])
        return {"message": "Recalculation started for all applications"}
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

@app.post("/api/linkedin/sync")
async def sync_linkedin_connections(request: LinkedInSyncRequest):
    try:
        count = database_service.save_linkedin_connections([c.dict() for c in request.connections])
        return {"message": f"Successfully synced {count} new connections.", "count": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/linkedin/matches/{company_id}")
async def get_linkedin_matches(company_id: str):
    try:
        matches = database_service.get_linkedin_connections_by_company(company_id)
        return {"matches": matches}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/linkedin/matches/name/{company_name}")
async def get_linkedin_matches_by_name(company_name: str):
    try:
        matches = database_service.get_linkedin_connections_by_company_name(company_name)
        return {"matches": matches}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/linkedin/matches/batch")
async def get_linkedin_batch_matches(company_names: List[str]):
    try:
        results = {}
        for name in company_names:
            matches = database_service.get_linkedin_connections_by_company_name(name)
            if matches:
                results[name] = matches
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/linkedin/debug")
async def debug_linkedin_connections(limit: int = 100):
    try:
        connections = database_service.get_all_linkedin_connections(limit)
        return {"total_count": len(connections), "connections": connections}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/linkedin/purge")
async def purge_linkedin_connections():
    try:
        success = database_service.clear_linkedin_connections()
        return {"success": success}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/capture-job")
async def capture_job(request: CaptureJobRequest):
    """
    Mobile job capture: accept a URL or raw pasted text,
    scrape/parse the content, and use AI to extract structured job fields.
    Returns extracted data for user review before saving.
    """
    try:
        url = (request.url or "").strip()
        text = (request.text or "").strip()

        if not url and not text:
            raise HTTPException(status_code=400, detail="Either 'url' or 'text' is required")

        scraped_text = ""

        if url:
            # Check for duplicate first
            existing = database_service.find_application_by_url(url) if hasattr(database_service, 'find_application_by_url') else None
            
            try:
                scraped_text = await scraper_service.scrape_job_description(url)
            except Exception as scrape_err:
                # If scraping fails and we have no text, report the error
                if not text:
                    raise HTTPException(
                        status_code=422,
                        detail=f"Could not scrape the URL. Try pasting the job description text instead. ({str(scrape_err)[:100]})"
                    )
                # Fall through to use the provided text
                scraped_text = text
        else:
            scraped_text = text

        if not scraped_text or len(scraped_text.strip()) < 20:
            raise HTTPException(
                status_code=422,
                detail="Not enough content was extracted. Try pasting the full job description text instead."
            )

        # Use AI to extract structured fields
        analysis = await ai_service.analyze_job_description(scraped_text)
        metadata = analysis.get("metadata", {})

        return {
            "success": True,
            "job_url": url,
            "raw_description": scraped_text,
            "extracted": {
                "job_title": metadata.get("job_title", ""),
                "company": metadata.get("company", ""),
                "location": metadata.get("location", ""),
                "location_type": metadata.get("location_type", ""),
                "job_type": metadata.get("job_type", ""),
                "salary_range": metadata.get("salary_range", ""),
                "date_posted": metadata.get("date_posted", ""),
                "deadline": metadata.get("deadline", ""),
            },
            "duplicate": existing if url and existing else None
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
