from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
import os
import shutil
import tempfile
import hashlib
import time
from typing import Optional, List, Dict, Any
from dotenv import load_dotenv
import json
import requests
import httpx

from services.document_service import DocumentService
from services.ai_service import AIService
from services.scraper_service import ScraperService
from services.database_service import DatabaseService
from services.auth_service import AuthService, get_current_user_id, get_admin_user_id

load_dotenv()

app = FastAPI(title="Resume Automator API")

@app.get("/health", tags=["system"])
async def health_check():
    """Lightweight healthcheck endpoint — no authentication required."""
    return {"status": "ok"}

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
        
    profile = database_service.get_profile(app.get('user_id'))
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
    source: Optional[str] = None
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
    
    match_score: Optional[int] = None
    match_details: Optional[Any] = None
    pipeline_stage: Optional[str] = 'saved'
    commute_time_mins: Optional[int] = None
    commute_distance_miles: Optional[float] = None
    match_score: Optional[int] = None
    match_details: Optional[Any] = None
    commute_details: Optional[Any] = {}
    diff_data: Optional[Any] = {}
    files: Optional[dict] = {}



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
UPLOADS_DIR = os.environ.get("DOCUMENTS_STORAGE_PATH", ".") + "/uploads"
OUTPUTS_DIR = os.environ.get("DOCUMENTS_STORAGE_PATH", ".") + "/outputs"
os.makedirs(UPLOADS_DIR, exist_ok=True)
os.makedirs(OUTPUTS_DIR, exist_ok=True)


class CaptureJobRequest(BaseModel):
    url: Optional[str] = None
    text: Optional[str] = None

class JobDescriptionRequest(BaseModel):
    job_description: Optional[str] = None
    job_url: Optional[str] = None

class LoginRequest(BaseModel):
    username: str
    password: str

class RegisterRequest(BaseModel):
    username: str
    password: str

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

# --- Authentication Endpoints ---

@app.get("/api/auth/has-admin")
async def check_has_admin():
    return {"has_admin": database_service.has_admin()}

@app.post("/api/auth/register")
async def register(req: RegisterRequest):
    # Self-registration is only allowed during initial setup (no admin exists yet)
    if database_service.has_admin():
        raise HTTPException(
            status_code=403,
            detail="Registration is closed. Contact your administrator to create an account."
        )

    # Check if user already exists
    existing = database_service.get_user_by_username(req.username)
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # First user always becomes admin
    hashed_pw = AuthService.get_password_hash(req.password)
    user_id = database_service.create_user(req.username, hashed_pw, is_admin=1)
    
    token = AuthService.create_access_token({"sub": str(user_id)})
    return {"access_token": token, "token_type": "bearer", "user_id": user_id, "is_admin": 1}

@app.post("/api/auth/login")
async def login(req: LoginRequest):
    user = database_service.get_user_by_username(req.username)
    if not user or not AuthService.verify_password(req.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    token = AuthService.create_access_token({"sub": str(user["id"])})
    return {"access_token": token, "token_type": "bearer", "user_id": user["id"], "is_admin": user["is_admin"]}

@app.get("/api/auth/me")
async def get_me(user_id: int = Depends(get_current_user_id)):
    user = database_service.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


import json
import requests

# Load config if exists
CONFIG_PATH = "config.json"
def get_config():
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH, 'r') as f:
            return json.load(f)
    return {}

async def get_merged_config(user_id: int):
    """Internal helper to get merged user and global config."""
    # 1. Fetch user-specific config (UI settings etc)
    user_config = database_service.get_config(user_id)
    
    # 2. Fetch global config (AI keys, prompts) managed by admin
    global_config = database_service.get_config(None) 
    
    # 3. Merge: User UI settings + Global AI settings
    config = {
        "ui_config": user_config.get("ui_config", {"font_size": 15, "theme": "dark"}),
        "ai_config": global_config.get("ai_config", {}),
        "prompts": global_config.get("prompts", ai_service.prompts)
    }
    
    # Fallback to local config.json if global config in DB is empty (migration support)
    if not config["ai_config"]:
        file_config = get_config()
        if "ai_config" in file_config:
            config["ai_config"] = file_config["ai_config"]
            if "prompts" in file_config:
                config["prompts"] = file_config.get("prompts", ai_service.prompts)
            # Save to global config in DB for next time
            database_service.save_config({"ai_config": config["ai_config"], "prompts": config["prompts"]}, None)
            
    return config

@app.get("/api/config")
async def get_app_config(user_id: int = Depends(get_current_user_id)):
    """Return application configuration including defaults"""
    return await get_merged_config(user_id)

@app.post("/api/config")
async def update_app_config(config: dict, user_id: int = Depends(get_current_user_id)):
    """Update application configuration (User UI settings)"""
    try:
        existing = database_service.get_config(user_id)
        # Regular users only allowed to update UI config
        if "ui_config" in config:
            existing["ui_config"] = config["ui_config"]
        
        database_service.save_config(existing, user_id)
        return {"message": "User settings updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/user/api-keys")
async def list_user_api_keys(user_id: int = Depends(get_current_user_id)):
    """List all named API keys for the current user (values obscured)."""
    return database_service.list_named_api_keys(user_id)

@app.post("/api/user/api-keys")
async def create_user_api_key(body: dict, user_id: int = Depends(get_current_user_id)):
    """Create a new named API key. Returns the full key value once."""
    name = body.get("name", "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Key name is required")
    result = database_service.create_named_api_key(user_id, name)
    return result

@app.delete("/api/user/api-keys/{key_id}")
async def delete_user_api_key(key_id: int, user_id: int = Depends(get_current_user_id)):
    """Delete a named API key by ID."""
    success = database_service.delete_named_api_key(key_id, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="API key not found")
    return {"message": "API key deleted"}

# --- ADMIN ENDPOINTS ---

@app.get("/api/admin/users")
async def list_users(admin_id: int = Depends(get_admin_user_id)):
    return database_service.list_users()

@app.post("/api/admin/users")
async def create_user_by_admin(user_data: dict, admin_id: int = Depends(get_admin_user_id)):
    from services.auth_service import AuthService
    username   = user_data.get("username")
    password   = user_data.get("password")
    is_admin   = user_data.get("is_admin", False)
    first_name = user_data.get("first_name", "").strip() or None
    last_name  = user_data.get("last_name", "").strip()  or None
    email      = user_data.get("email", "").strip()      or None

    if not username or not password:
        raise HTTPException(status_code=400, detail="Username and password required")

    hashed_pwd = AuthService.get_password_hash(password)
    try:
        new_id = database_service.create_user(
            username, hashed_pwd, is_admin,
            first_name=first_name, last_name=last_name, email=email
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Username already exists")
    return {"message": "User created", "user_id": new_id}

@app.patch("/api/admin/users/{uid}")
async def admin_edit_user(uid: int, data: dict, admin_id: int = Depends(get_admin_user_id)):
    """Admin: update any user's name, email, password, or role."""
    success = database_service.admin_update_user(uid, data)
    if not success:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User updated"}

@app.patch("/api/admin/users/{uid}/role")
async def update_user_role(uid: int, data: dict, admin_id: int = Depends(get_admin_user_id)):
    success = database_service.update_user_role(uid, data.get("is_admin", False))
    if not success:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User role updated"}

@app.delete("/api/admin/users/{uid}")
async def delete_user(uid: int, admin_id: int = Depends(get_admin_user_id)):
    if uid == admin_id:
        raise HTTPException(status_code=400, detail="Cannot delete self")
    success = database_service.delete_user(uid)
    if not success:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted"}

@app.patch("/api/user/account")
async def update_own_account(data: dict, user_id: int = Depends(get_current_user_id)):
    """Self-service: update name, email, or password."""
    success = database_service.update_account(user_id, data)
    if not success:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "Account updated"}

@app.get("/api/admin/config")
async def get_admin_config(admin_id: int = Depends(get_admin_user_id)):
    """Full config for admin (including AI secrets)"""
    return database_service.get_config(None)

@app.post("/api/admin/config")
async def update_admin_config(config: dict, admin_id: int = Depends(get_admin_user_id)):
    """Update global AI configuration"""
    database_service.save_config(config, None)
    return {"message": "Global configuration updated"}



@app.get("/api/profile")
async def get_profile(user_id: int = Depends(get_current_user_id)):
    try:
        return database_service.get_profile(user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/profile")
async def save_profile(profile: ProfileModel, user_id: int = Depends(get_current_user_id)):
    try:
        return {"id": database_service.save_profile(profile.dict(), user_id)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/scan-contact-info")
async def scan_contact_info(resume: UploadFile = File(...), user_id: int = Depends(get_current_user_id)):
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
        config = await get_merged_config(user_id)
        extracted = await ai_service.extract_profile_data(full_text, config=config)
        
        os.unlink(tmp_path)
        return extracted
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/profile/upload-resume")
async def upload_profile_resume(
    resume: UploadFile = File(...),
    resume_type: str = Form(...),
    user_id: int = Depends(get_current_user_id)
):
    """Upload and save a base or long-form resume to the user profile."""
    try:
        if resume_type not in ["base", "long_form"]:
            raise HTTPException(status_code=400, detail="resume_type must be 'base' or 'long_form'")
        
        # Save the file to a dedicated profile resumes directory
        os.makedirs(f"{UPLOADS_DIR}/profile_resumes", exist_ok=True)
        filename = f"{resume_type}_resume_{resume.filename}"
        save_path = f"{UPLOADS_DIR}/profile_resumes/{filename}"
        
        content = await resume.read()
        with open(save_path, "wb") as f:
            f.write(content)
        
        # Update profile in DB with new path
        field_key = "base_resume_path" if resume_type == "base" else "long_form_resume_path"
        profile = database_service.get_profile(user_id)
        profile[field_key] = save_path
        database_service.save_profile(profile, user_id)
        
        return {"path": save_path, "filename": resume.filename, "type": resume_type}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/profile/resume/{resume_type}")
async def delete_profile_resume(resume_type: str, user_id: int = Depends(get_current_user_id)):
    """Remove a base or long-form resume from the user profile."""
    try:
        if resume_type not in ["base", "long_form"]:
            raise HTTPException(status_code=400, detail="resume_type must be 'base' or 'long_form'")

        field_key = "base_resume_path" if resume_type == "base" else "long_form_resume_path"
        profile = database_service.get_profile(user_id)
        old_path = profile.get(field_key)
        if old_path and os.path.exists(old_path):
            os.remove(old_path)
        profile[field_key] = None
        database_service.save_profile(profile, user_id)
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/profile/upload-additional-doc")
async def upload_additional_doc(
    document: UploadFile = File(...),
    label: str = Form(""),
    user_id: int = Depends(get_current_user_id)
):
    """Upload an additional supplemental document (PDF, DOCX, TXT) to the user profile."""
    try:
        os.makedirs(f"{UPLOADS_DIR}/profile_docs", exist_ok=True)
        safe_name = document.filename.replace(" ", "_")
        save_path = f"{UPLOADS_DIR}/profile_docs/{safe_name}"
        content = await document.read()
        with open(save_path, "wb") as f:
            f.write(content)

        profile = database_service.get_profile(user_id)
        docs = profile.get("additional_docs", []) or []
        docs.append({"filename": document.filename, "path": save_path, "label": label})
        profile["additional_docs"] = docs
        database_service.save_profile(profile, user_id)
        return {"filename": document.filename, "path": save_path, "label": label}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/profile/additional-doc")
async def delete_additional_doc(path: str, user_id: int = Depends(get_current_user_id)):
    """Remove an additional document from the user profile by its path."""
    try:
        profile = database_service.get_profile(user_id)
        docs = profile.get("additional_docs", []) or []
        doc_to_remove = next((d for d in docs if d["path"] == path), None)
        if doc_to_remove and os.path.exists(doc_to_remove["path"]):
            os.remove(doc_to_remove["path"])
        profile["additional_docs"] = [d for d in docs if d["path"] != path]
        database_service.save_profile(profile, user_id)
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/profile/field")
async def save_profile_field(request: Request, user_id: int = Depends(get_current_user_id)):
    try:
        data = await request.json()
        field = data.get("field")
        value = data.get("value")
        
        profile = database_service.get_profile(user_id)
        profile[field] = value
        database_service.save_profile(profile, user_id)
        
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/profile/file")
async def serve_profile_file(path: str):
    """Serve a profile document (resume or additional doc) by its relative path for preview/download."""
    # Sanitize: only allow files within the uploads directory
    abs_path = os.path.abspath(path)
    uploads_dir = os.path.abspath(UPLOADS_DIR)
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
    tailored_resume_text: Optional[str] = Form(None),
    application_id: Optional[int] = Form(None),
    user_id: int = Depends(get_current_user_id)
):
    """
    Score the match between a resume and a job description.
    """
    try:
        config = await get_merged_config(user_id)
        profile = database_service.get_profile(user_id)
        file_path = None
        
        if tailored_resume_text:
            resume_text = tailored_resume_text
        else:
            if resume:
                file_path = f"{UPLOADS_DIR}/{resume.filename}"
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
            additional_context=additional_context_text,
            config=config
        )

        if application_id:
            database_service.update_application(application_id, {
                "match_score": result.get("overall_score"),
                "match_details": result
            })

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
    additional_context_paths: Optional[str] = Form(None),
    additional_files: List[UploadFile] = File([]),
    instructions: Optional[str] = Form(""),
    user_id: int = Depends(get_current_user_id)
):
    """
    Tailor a resume based on a job description.
    Accepts either job_description text or job_url to scrape.
    Supports using a default local resume file for testing.
    """
    try:
        config = await get_merged_config(user_id)
        profile = database_service.get_profile(user_id)
        file_path = None
        original_filename = "resume.docx"
        
        if resume:
            # Use uploaded file
            original_filename = resume.filename
            file_path = f"{UPLOADS_DIR}/{original_filename}"
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
            file_path = f"{UPLOADS_DIR}/{original_filename}"
            shutil.copy2(base_resume_path, file_path)
        elif use_default_resume and config.get("default_resume_path"):
            # Fallback to config default (kept for legacy/test support)
            default_path = config["default_resume_path"]
            if not os.path.exists(default_path):
                raise HTTPException(status_code=404, detail=f"Default resume not found at {default_path}")
            
            original_filename = os.path.basename(default_path)
            file_path = f"{UPLOADS_DIR}/{original_filename}"
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
            instructions=instructions,
            config=config
        )
        
        # 3. Generate Output
        base_name = os.path.splitext(original_filename)[0]
        output_filename = f"{base_name}_tailored.docx"
        output_path = f"{OUTPUTS_DIR}/{output_filename}"
        
        # Use XML-preserving generation
        document_service.create_docx_with_xml_preservation(
            file_path,
            tailored_resume_data,
            output_path
        )
        
        # Generate PDF and TXT versions
        pdf_filename = f"{base_name}_tailored.pdf"
        pdf_path = f"{OUTPUTS_DIR}/{pdf_filename}"
        txt_filename = f"{base_name}_tailored.txt"
        txt_path = f"{OUTPUTS_DIR}/{txt_filename}"
        
        # Create PDF directly from DOCX to preserve formatting
        pdf_result = document_service.create_pdf_from_docx(output_path, pdf_path)
        pdf_success = pdf_result.get('success', False) if isinstance(pdf_result, dict) else pdf_result
        font_info = pdf_result.get('font_info', {}) if isinstance(pdf_result, dict) else {}
        
        # Create TXT
        document_service.create_txt(tailored_resume_data, txt_path)
        
        # Create Redline PDF (Changes Highlighted)
        redline_docx_filename = f"{base_name}_tailored_redline.docx"
        redline_docx_path = f"{OUTPUTS_DIR}/{redline_docx_filename}"
        redline_pdf_filename = f"{base_name}_tailored_redline.pdf"
        redline_pdf_path = f"{OUTPUTS_DIR}/{redline_pdf_filename}"
        
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
                "ai_tailored": tailored_text_content,
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
async def refine_resume(request: RefineRequest, user_id: int = Depends(get_current_user_id)):
    try:
        current_data = request.current_resume_data
        
        # 1. Refine Data with AI
        config = await get_merged_config(user_id)
        refined_data = await ai_service.refine_resume(
            current_data, 
            request.instructions, 
            additional_context=request.additional_context,
            config=config
        )
        
        # 2. File Paths
        original_filename = request.original_filename
        file_path = f"{UPLOADS_DIR}/{original_filename}"
        
        if not os.path.exists(file_path):
             print(f"Warning: Original file {file_path} not found.")
             
        base_name = os.path.splitext(original_filename)[0]
        
        output_filename = f"{base_name}_tailored.docx"
        output_path = f"{OUTPUTS_DIR}/{output_filename}"
        pdf_filename = f"{base_name}_tailored.pdf"
        pdf_path = f"{OUTPUTS_DIR}/{pdf_filename}"
        redline_docx_path = f"{OUTPUTS_DIR}/{base_name}_tailored_redline.docx"
        redline_pdf_path = f"{OUTPUTS_DIR}/{base_name}_tailored_redline.pdf"
        txt_path = f"{OUTPUTS_DIR}/{base_name}_tailored.txt"
        
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
                "original": request.original_text_content or prev_text,
                "ai_tailored": new_text,
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
async def generate_cover_letter_endpoint(request: CoverLetterRequest, user_id: int = Depends(get_current_user_id)):
    try:
        # Fetch profile
        user_profile = database_service.get_profile(user_id)
        config = await get_merged_config(user_id)
        
        result = await ai_service.generate_cover_letter(
            resume_text=request.resume_text, 
            job_description=request.job_description, 
            user_profile=user_profile,
            additional_context=request.additional_context,
            instructions=request.instructions,
            config=config
        )
        content = result.get("content", "")
        
        base_name = os.path.splitext(request.base_filename)[0]
        output_docx = f"{OUTPUTS_DIR}/{base_name}_cover_letter.docx"
        output_pdf = f"{OUTPUTS_DIR}/{base_name}_cover_letter.pdf"
        output_txt = f"{OUTPUTS_DIR}/{base_name}_cover_letter.txt"
        
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
async def refine_cover_letter_endpoint(request: RefineCoverLetterRequest, user_id: int = Depends(get_current_user_id)):
    try:
        config = await get_merged_config(user_id)
        result = await ai_service.refine_cover_letter(
            content=request.content, 
            instructions=request.instructions, 
            additional_context=request.additional_context,
            config=config
        )
        content = result.get("content", "")
        
        base_name = os.path.splitext(request.base_filename)[0]
        output_docx = f"{OUTPUTS_DIR}/{base_name}_cover_letter.docx"
        output_pdf = f"{OUTPUTS_DIR}/{base_name}_cover_letter.pdf"
        output_txt = f"{OUTPUTS_DIR}/{base_name}_cover_letter.txt"
        
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
async def save_application(request: ApplicationSaveRequest, background_tasks: BackgroundTasks, user_id: int = Depends(get_current_user_id)):
    try:
        app_id = database_service.save_application(request.dict(), user_id)
        background_tasks.add_task(calculate_commute_for_app, app_id)
        return {"message": "Application saved", "id": app_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/applications/{app_id}")
async def get_application(app_id: int, user_id: int = Depends(get_current_user_id)):
    """Get a single application by ID."""
    try:
        app_data = database_service.get_application_by_id(app_id, user_id)
        if not app_data:
            raise HTTPException(status_code=404, detail="Application not found")
        return app_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/applications/{app_id}")
async def update_application(app_id: int, request: ApplicationSaveRequest, background_tasks: BackgroundTasks, user_id: int = Depends(get_current_user_id)):
    """Update an existing application's fields."""
    try:
        success = database_service.update_application(app_id, request.dict(exclude_unset=True), user_id)
        if success:
            if 'location' in request.dict(exclude_unset=True) or 'location_type' in request.dict(exclude_unset=True):
                background_tasks.add_task(calculate_commute_for_app, app_id)
            updated_app = database_service.get_application_by_id(app_id)
            return updated_app
        raise HTTPException(status_code=404, detail="Application not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/applications")
async def get_applications(user_id: int = Depends(get_current_user_id)):
    try:
        apps = database_service.get_applications(user_id)
        return apps
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/analytics")
async def get_analytics(user_id: int = Depends(get_current_user_id)):
    """Return aggregated analytics data from the applications database."""
    try:
        from datetime import datetime, timedelta
        from collections import defaultdict

        apps = database_service.get_applications(user_id)
        
        # Helper to match frontend status mapping
        KANBAN_COLUMNS = ['Saved', 'Generated', 'Applied', 'Interviewing', 'Rejected', 'Offered', 'Accepted']
        def get_status_stage(status):
            if not status: return 'Applied'
            s = str(status).lower()
            for col in KANBAN_COLUMNS:
                if col.lower() in s or (col == 'Interviewing' and 'interview' in s):
                    return col
            return status

        # Sync analytics filter with dashboard: exclude archived AND items not mapping to board columns (e.g., Drafts)
        active_apps = []
        for a in apps:
            if a.get('is_archived', False): continue
            stage = get_status_stage(a.get('status'))
            if stage in KANBAN_COLUMNS:
                active_apps.append(a)
                
        total = len(active_apps)

        # --- Pipeline stage counts ---
        stage_order = ['saved', 'generated', 'applied', 'interviewing', 'decision', 'accepted', 'rejected', 'declined']
        stage_counts = defaultdict(int)
        for a in active_apps:
            stage = (a.get('pipeline_stage') or 'saved').lower()
            stage_counts[stage] += 1

        # --- Interest level counts ---
        interest_counts = defaultdict(int)
        for a in active_apps:
            lvl = (a.get('interest_level') or 'Not Set').strip()
            if not lvl:
                lvl = 'Not Set'
            interest_counts[lvl] += 1

        # --- Job type counts ---
        job_type_counts = defaultdict(int)
        for a in active_apps:
            jt = (a.get('job_type') or 'Not Set').strip()
            if not jt:
                jt = 'Not Set'
            job_type_counts[jt] += 1

        # --- Location type counts ---
        location_type_counts = defaultdict(int)
        for a in active_apps:
            lt = (a.get('location_type') or 'Not Set').strip()
            if not lt:
                lt = 'Not Set'
            location_type_counts[lt] += 1

        # --- Weekly activity: applications added per day over last 8 weeks ---
        today = datetime.now().date()
        eight_weeks_ago = today - timedelta(weeks=8)
        # Build a dict of date -> count
        daily_counts = defaultdict(int)
        for a in active_apps:
            ds = a.get('date_saved')
            if ds:
                try:
                    d = datetime.fromisoformat(ds[:10]).date()
                    if d >= eight_weeks_ago:
                        daily_counts[d.isoformat()] += 1
                except Exception:
                    pass

        # Build last 8 weeks as a list of {date, count, day_of_week}
        weekly_activity = []
        for i in range(56):
            d = eight_weeks_ago + timedelta(days=i)
            weekly_activity.append({
                "date": d.isoformat(),
                "count": daily_counts.get(d.isoformat(), 0),
                "day": d.strftime("%a"),
            })

        # --- Match score stats ---
        scores = [a.get('match_score') for a in active_apps if a.get('match_score') is not None]
        avg_score = round(sum(scores) / len(scores)) if scores else None

        # --- Top companies (by count) ---
        company_counts = defaultdict(int)
        for a in active_apps:
            c = (a.get('company') or '').strip()
            # Heuristic: If company is "LinkedIn", skip it from the breakdown unless it's clearly the hiring company.
            # Most users don't apply to LinkedIn itself 8 times, so this is usually a scraping remnant.
            if c and c.lower() != 'linkedin':
                company_counts[c] += 1
        top_companies = sorted(company_counts.items(), key=lambda x: -x[1])[:10]

        # --- LinkedIn Connections stats ---
        all_conns = database_service.get_all_linkedin_connections(limit=5000, user_id=user_id)
        total_unique_conns = len(all_conns)
        
        # Match apps with connections
        conn_map = defaultdict(int)
        for conn in all_conns:
            cname = (conn.get('company_name') or '').strip().lower()
            if cname:
                conn_map[cname] += 1
        
        apps_with_conns_count = 0
        conn_distribution = defaultdict(int) # Number of apps with N connections
        for a in active_apps:
            aname = (a.get('company') or '').strip().lower()
            count = conn_map.get(aname, 0)
            if count > 0:
                apps_with_conns_count += 1
                conn_distribution[count] += 1
            else:
                conn_distribution[0] += 1

        # --- Recent applications (last 10 by date_saved) ---
        sorted_apps = sorted(
            active_apps,
            key=lambda a: a.get('date_saved') or '',
            reverse=True
        )[:10]
        recent = [
            {
                "id": a.get('id'),
                "job_title": a.get('job_title'),
                "company": a.get('company'),
                "company_logo": a.get('company_logo'),
                "date_saved": a.get('date_saved'),
                "pipeline_stage": a.get('pipeline_stage'),
                "interest_level": a.get('interest_level'),
                "match_score": a.get('match_score'),
                "location": a.get('location'),
                "location_type": a.get('location_type'),
                "connection_count": conn_map.get((a.get('company') or '').strip().lower(), 0)
            }
            for a in sorted_apps
        ]

        return {
            "total_applications": total,
            "pipeline_stages": dict(stage_counts),
            "interest_levels": dict(interest_counts),
            "job_types": dict(job_type_counts),
            "location_types": dict(location_type_counts),
            "weekly_activity": weekly_activity,
            "avg_match_score": avg_score,
            "scores_count": len(scores),
            "top_companies": [{"company": c, "count": n} for c, n in top_companies],
            "recent_applications": recent,
            "linkedin_stats": {
                "total_connections": total_unique_conns,
                "apps_with_connections": apps_with_conns_count,
                "percentage_with_connections": round((apps_with_conns_count / total * 100) if total > 0 else 0),
                "distribution": dict(conn_distribution)
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/applications/{app_id}/status")
async def update_application_status(app_id: int, request: StatusUpdateRequest, user_id: int = Depends(get_current_user_id)):
    try:
        success = database_service.update_application_status(app_id, request.status, user_id)
        if success:
            return {"message": "Application status updated successfully"}
        else:
            raise HTTPException(status_code=404, detail="Application not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/applications/{app_id}")
async def delete_application(app_id: int, user_id: int = Depends(get_current_user_id)):
    try:
        success = database_service.delete_application(app_id, user_id)
        if success:
            return {"message": "Application deleted successfully"}
        else:
            raise HTTPException(status_code=404, detail="Application not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/applications/{application_id}/override-resume")
async def override_resume(application_id: int, file: UploadFile = File(...), user_id: int = Depends(get_current_user_id)):
    try:
        # Save file
        content = await file.read()
        filename = f"override_resume_{application_id}_{file.filename}"
        file_path = f"{OUTPUTS_DIR}/{filename}"
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
            config = await get_merged_config(user_id)
            profile_snapshot = await ai_service.extract_profile_data(text, config=config)
        
        database_service.update_application(application_id, {
            "override_resume_path": filename,
            "active_resume_type": "override",
            "profile_snapshot": profile_snapshot
        }, user_id)
        
        return {"message": "Override resume updated", "path": filename, "profile_snapshot": profile_snapshot}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/applications/{application_id}/override-cover-letter")
async def override_cover_letter(application_id: int, file: UploadFile = File(...), user_id: int = Depends(get_current_user_id)):
    try:
        # Save file
        content = await file.read()
        filename = f"override_cl_{application_id}_{file.filename}"
        file_path = f"{OUTPUTS_DIR}/{filename}"
        with open(file_path, "wb") as f:
            f.write(content)
            
        database_service.update_application(application_id, {
            "override_cover_letter_path": filename,
            "active_cover_letter_type": "override"
        }, user_id)
        
        return {"message": "Override cover letter updated", "path": filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

        return {"message": "Active version updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/applications/{application_id}/toggle-active")
async def toggle_active_endpoint(application_id: int, request: Request, user_id: int = Depends(get_current_user_id)):
    try:
        data = await request.json()
        doc_type = data.get("type") # 'resume' or 'cover_letter'
        active_version = data.get("active") # 'generated' or 'override'
        
        update_data = {}
        if doc_type == 'resume':
            update_data["active_resume_type"] = active_version
        elif doc_type == 'cover_letter':
            update_data["active_cover_letter_type"] = active_version
            
        success = database_service.update_application(application_id, update_data, user_id)
        if not success:
            raise HTTPException(status_code=404, detail="Application not found")
            
        return {"message": "Active version updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/applications/{application_id}/override/{doc_type}")
async def delete_application_override(application_id: int, doc_type: str, user_id: int = Depends(get_current_user_id)):
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
        app_data = database_service.get_application_by_id(application_id, user_id)
        if not app_data:
            raise HTTPException(status_code=404, detail="Application not found")
        
        filename = app_data.get(field)
        if filename:
            file_path = f"{OUTPUTS_DIR}/{filename}"
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
async def update_application_logo(app_id: int, request: LogoUpdateRequest, user_id: int = Depends(get_current_user_id)):
    try:
        success = database_service.update_application_logo(app_id, request.company_logo, user_id)
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
async def archive_application(app_id: int, request: ArchiveRequest, user_id: int = Depends(get_current_user_id)):
    try:
        success = database_service.archive_application(app_id, request.archived, user_id)
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
    file_path = f"{OUTPUTS_DIR}/{filename}"
    
    if not os.path.exists(file_path):
        # Fallback: Check uploads directory (for original resumes)
        file_path = f"{UPLOADS_DIR}/{filename}"
        
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

# ===== OnlyOffice Integration =====

ONLYOFFICE_URL = os.getenv("ONLYOFFICE_URL", "http://localhost:8443")
# Internal URL for OnlyOffice to reach the backend (inside Docker network)
BACKEND_INTERNAL_URL = os.getenv("BACKEND_INTERNAL_URL", "http://backend:8000")
ONLYOFFICE_INTERNAL_URL = os.getenv("ONLYOFFICE_INTERNAL_URL", "onlyoffice:80")

# External URL for the browser to reach the backend
BACKEND_EXTERNAL_URL = os.getenv("BACKEND_EXTERNAL_URL", "http://localhost:8000")

@app.get("/api/onlyoffice/config/{filename:path}")
async def get_onlyoffice_config(filename: str, application_id: Optional[str] = None):
    """
    Returns OnlyOffice editor configuration for a given DOCX file.
    The file must exist in outputs/ or uploads/.
    """
    print(f"📄 Requesting OnlyOffice config for: {filename}, application_id: {application_id}")
    
    # Find the file
    file_path = f"{OUTPUTS_DIR}/{filename}"
    if not os.path.exists(file_path):
        file_path = f"{UPLOADS_DIR}/{filename}"
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"File not found: {filename}")
    
    # Generate a unique key based on filename + modification time + random salt
    mtime = os.path.getmtime(file_path)
    doc_key = hashlib.md5(f"{filename}_{mtime}_{time.time_ns()}".encode()).hexdigest()
    
    # Add application_id to callback if provided
    callback_query = f"filename={filename}"
    if application_id:
        callback_query += f"&application_id={application_id}"
    
    # Document URL that OnlyOffice server can access (internal Docker network)
    document_url = f"{BACKEND_INTERNAL_URL}/api/download/{filename}?v={int(mtime)}"

    
    config = {
        "document": {
            "fileType": "docx",
            "key": doc_key,
            "title": filename,
            "url": document_url,
            "permissions": {
                "download": True,
                "edit": True,
                "print": True,
                "review": False,
                "comment": False,
            }
        },
        "editorConfig": {
            "callbackUrl": f"{BACKEND_INTERNAL_URL}/api/onlyoffice/callback?{callback_query}",
            "mode": "edit",
            "lang": "en",
            "customization": {
                "autosave": True,
                "forcesave": True,
                "compactHeader": False,
                "compactToolbar": False,
                "toolbarNoTabs": False,
                "hideRightMenu": True,
                "chat": False,
                "comments": False,
                "help": False,
                "plugins": False,
            },
            "user": {
                "id": "user-1",
                "name": "Resume Editor"
            }
        },
        "type": "desktop",
        "width": "100%",
        "height": "100%",
    }
    
    return config

@app.post("/api/onlyoffice/callback")
async def onlyoffice_callback(request: Request, filename: str, application_id: Optional[int] = None):
    """
    Callback endpoint for OnlyOffice Document Server.
    Called when a document is saved or closed.
    Status codes:
      1 = editing
      2 = ready for saving (doc closed)
      4 = closed with no changes
      6 = force save
    """
    try:
        body = await request.json()
        status = body.get("status")
        download_url = body.get("url")
        
        print(f"📝 OnlyOffice callback: status={status}, filename={filename}, application_id={application_id}")
        
        # FALLBACK: If application_id is missing, try to find it by tailored_resume_path
        if not application_id and filename:
            print(f"🔍 application_id missing in callback for {filename}, attempting fallback lookup...")
            app_obj = database_service.get_application_by_resume_path(filename)
            if app_obj:
                application_id = app_obj.id
                print(f"✅ Fallback successful: Found application {application_id}")
            else:
                print(f"⚠️ Fallback failed: No application found with tailored_resume_path='{filename}'")

        
        if status in (2, 6) and download_url:
            # Document is ready to save - download the edited file
            # Rewrite URL if it points to localhost (as seen from outside) but we are in the backend container
            internal_download_url = download_url.replace("localhost:8443", ONLYOFFICE_INTERNAL_URL)
            if "localhost" in download_url and "onlyoffice" not in internal_download_url:
                # Fallback if port 8443 wasn't in the string for some reason
                internal_download_url = download_url.replace("localhost", "onlyoffice")

            print(f"⬇️ Downloading edited file from: {internal_download_url}")
            
            async with httpx.AsyncClient() as client:
                response = await client.get(internal_download_url)
                response.raise_for_status()
                
                file_path = f"{OUTPUTS_DIR}/{filename}"
                with open(file_path, "wb") as f:
                    f.write(response.content)
                
                print(f"✅ Saved edited file to: {file_path}")

                
                # Regenerate PDF from the updated DOCX
                try:
                    base_name = os.path.splitext(filename)[0]
                    pdf_path = f"{OUTPUTS_DIR}/{base_name}.pdf"
                    document_service.create_pdf_from_docx(file_path, pdf_path)
                    print(f"✅ Regenerated PDF: {pdf_path}")
                except Exception as pdf_err:
                    print(f"⚠️ PDF regeneration failed: {pdf_err}")
                
                # Sync updated text to database if application_id is provided
                if application_id:
                    try:
                        print(f"🔄 Syncing manual edits to database for application {application_id}")
                        doc_data = document_service.parse_docx(file_path)
                        manual_text = "\n\n".join(doc_data.get("full_text", []))
                        
                        # Get current application
                        app = database_service.get_application_by_id(application_id)
                        if app:
                            resume_data = app.get("resume_data", {})
                            if isinstance(resume_data, str):
                                resume_data = json.loads(resume_data)
                            
                            # Update the tailored_text in resume_data
                            resume_data["tailored_text"] = manual_text
                            
                            # Also update diff_data to reflect manual changes
                            diff_data = app.get("diff_data", {})
                            if not diff_data or not diff_data.get("original"):
                                # If missing or baseline is empty, try to rebuild it
                                original_text = "\n\n".join(resume_data.get("full_text", []))
                                ai_tailored = "\n\n".join(resume_data.get("full_text", []))
                                
                                # Use existing dict but fill in gaps
                                if not diff_data: diff_data = {}
                                if not diff_data.get("original"): diff_data["original"] = original_text
                                if not diff_data.get("ai_tailored"): diff_data["ai_tailored"] = ai_tailored
                            
                            diff_data["manual_tailored"] = manual_text
                            diff_data["tailored"] = manual_text # Update primary tailored text for view
                            
                            database_service.update_application(application_id, {
                                "resume_data": resume_data,
                                "diff_data": diff_data,
                                "match_details": app.get("match_details") # Keep existing
                            })
                            print(f"✅ Database synced for application {application_id}")
                    except Exception as sync_err:
                        print(f"⚠️ Manual edit sync failed: {sync_err}")
        
        # OnlyOffice expects {"error": 0} to acknowledge
        return JSONResponse(content={"error": 0})
        
    except Exception as e:
        print(f"❌ OnlyOffice callback error: {e}")
        return JSONResponse(content={"error": 0})  # Always return success to prevent retries

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
async def analyze_job(request: JobDescriptionRequest, user_id: int = Depends(get_current_user_id)):
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
        
        config = await get_merged_config(user_id)
        analysis = await ai_service.analyze_job_description(job_description, config=config)
        
        return {
            "success": True,
            "analysis": analysis
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/fetch-models")
async def fetch_available_models(config: dict, user_id: int = Depends(get_current_user_id)):
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
async def sync_linkedin_connections(request: LinkedInSyncRequest, user_id: int = Depends(get_current_user_id)):
    try:
        count = database_service.save_linkedin_connections([c.dict() for c in request.connections], user_id)
        return {"message": f"Successfully synced {count} new connections.", "count": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ContactCreate(BaseModel):
    name: str
    role: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    linkedin_url: Optional[str] = None
    headline: Optional[str] = None

@app.post("/api/applications/{app_id}/contacts")
async def add_application_contact(app_id: int, contact: ContactCreate, user_id: int = Depends(get_current_user_id)):
    print(f"👤 Adding contact {contact.name} to application {app_id}")
    try:
        new_contact = database_service.add_application_contact(app_id, contact.dict(), user_id)
        return new_contact
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/linkedin/matches/{company_id}")
async def get_linkedin_matches(company_id: str, user_id: int = Depends(get_current_user_id)):
    try:
        matches = database_service.get_linkedin_connections_by_company(company_id, user_id)
        return {"matches": matches}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/linkedin/matches/name/{company_name}")
async def get_linkedin_matches_by_name(company_name: str, user_id: int = Depends(get_current_user_id)):
    try:
        matches = database_service.get_linkedin_connections_by_company_name(company_name, user_id)
        return {"matches": matches}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/linkedin/search")
def search_linkedin(q: str, user_id: int = Depends(get_current_user_id)):
    return {"results": database_service.search_linkedin_connections(q, user_id)}

@app.post("/api/linkedin/matches/batch")
async def get_linkedin_batch_matches(company_names: List[str], user_id: int = Depends(get_current_user_id)):
    try:
        results = {}
        for name in company_names:
            matches = database_service.get_linkedin_connections_by_company_name(name, user_id)
            if matches:
                results[name] = matches
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/linkedin/debug")
async def debug_linkedin_connections(limit: int = 100, user_id: int = Depends(get_current_user_id)):
    try:
        connections = database_service.get_all_linkedin_connections(limit, user_id)
        return {"total_count": len(connections), "connections": connections}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/linkedin/purge")
async def purge_linkedin_connections(user_id: int = Depends(get_current_user_id)):
    try:
        success = database_service.clear_linkedin_connections(user_id)
        return {"success": success}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/capture-job")
async def capture_job(request: CaptureJobRequest, user_id: int = Depends(get_current_user_id)):
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
        config = await get_merged_config(user_id)
        analysis = await ai_service.analyze_job_description(scraped_text, config=config)
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


@app.get("/api/resume/sync-manual")
async def sync_manual_edits(filename: str):
    """
    Extract flat text from the potentially manually edited DOCX.
    This lets the frontend synchronize and show three-way diffs for manual changes.
    """
    try:
        if not filename.endswith('.docx') or '/' in filename or '\\' in filename:
            raise HTTPException(status_code=400, detail="Invalid filename")
            
        file_path = os.path.join(OUTPUTS_DIR, filename)
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found")
            
        text = document_service.extract_text(file_path)
        return {"text": text}
    except Exception as e:
        print(f"Error syncing manual edits: {e}")
        raise HTTPException(status_code=500, detail=str(e))



@app.on_event("startup")
async def startup_event():
    # 1. Initialize initial admin if no admin exists
    if not database_service.has_admin():
        admin_username = os.environ.get("INITIAL_ADMIN_USERNAME")
        admin_password = os.environ.get("INITIAL_ADMIN_PASSWORD")
        if admin_username and admin_password:
            hashed_pw = AuthService.get_password_hash(admin_password)
            is_admin = 1
            first_name = os.environ.get("INITIAL_ADMIN_FIRST_NAME")
            last_name = os.environ.get("INITIAL_ADMIN_LAST_NAME")
            email = os.environ.get("INITIAL_ADMIN_EMAIL")
            try:
                database_service.create_user(
                    username=admin_username,
                    hashed_password=hashed_pw,
                    is_admin=is_admin,
                    first_name=first_name,
                    last_name=last_name,
                    email=email
                )
                print(f"Created initial admin user: {admin_username}")
            except Exception as e:
                print(f"Failed to create initial admin user: {e}")
    
    # 2. Initialize global config if it doesn't exist
    global_config = database_service.get_config(None)
    if not global_config.get("ai_config"):
        default_ai_provider = os.environ.get("DEFAULT_AI_PROVIDER", "openai")
        default_ai_model = os.environ.get("DEFAULT_AI_MODEL", "gpt-4o-mini")
        default_openai_key = os.environ.get("DEFAULT_OPENAI_API_KEY", os.environ.get("OPENAI_API_KEY", ""))
        default_anthropic_key = os.environ.get("DEFAULT_ANTHROPIC_API_KEY", os.environ.get("ANTHROPIC_API_KEY", ""))
        
        file_config = get_config()
        if "ai_config" in file_config:
            new_ai_config = file_config["ai_config"]
            prompts = file_config.get("prompts", ai_service.prompts)
        else:
            new_ai_config = {
                "provider": default_ai_provider,
                "model": default_ai_model,
                "openai_api_key": default_openai_key,
                "anthropic_api_key": default_anthropic_key,
            }
            prompts = ai_service.prompts

        documents_storage_path = os.environ.get("DOCUMENTS_STORAGE_PATH", "uploads")
        new_ai_config["documents_storage_path"] = documents_storage_path

        global_config["ai_config"] = new_ai_config
        global_config["prompts"] = prompts
        database_service.save_config(global_config, None)
        print("Initialized global config from environment/defaults.")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
