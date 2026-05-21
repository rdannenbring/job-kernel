from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from pydantic import BaseModel
import os
import shutil
import tempfile
import hashlib
import time
import csv
import zipfile
import io
import platform
import re
from typing import Optional, List, Dict, Any
from dotenv import load_dotenv
import json
import requests
import httpx
import threading
from datetime import datetime, timedelta

from services.document_service import DocumentService
from services.ai_service import AIService
from services.scraper_service import ScraperService
from services.database_service import DatabaseService
from services.auth_service import AuthService, get_current_user_id, get_admin_user_id
from routes.applied import router as applied_router
import logging
from logging.handlers import RotatingFileHandler

load_dotenv()

# Configure logging
log_formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
log_file = os.path.join(os.path.dirname(__file__), 'backend.log')

# Rotate at 5MB, keep 2 backups
file_handler = RotatingFileHandler(log_file, maxBytes=5*1024*1024, backupCount=2)
file_handler.setFormatter(log_formatter)

# Console handler for Docker logs
console_handler = logging.StreamHandler()
console_handler.setFormatter(log_formatter)

# Configure the root logger
root_logger = logging.getLogger()
root_logger.setLevel(logging.INFO)
root_logger.addHandler(file_handler)
root_logger.addHandler(console_handler)

# Specific logger for application events
logger = logging.getLogger("app")
logger.setLevel(logging.INFO)
# Root handlers already cover this, but we can be explicit if needed.
# To avoid double logging, we don't add handlers here if they are on root.

# Intercept Uvicorn loggers to ensure they use our formatter and files
for logger_name in ["uvicorn", "uvicorn.error", "uvicorn.access"]:
    uv_logger = logging.getLogger(logger_name)
    uv_logger.handlers = []
    uv_logger.addHandler(file_handler)
    uv_logger.addHandler(console_handler)
    uv_logger.propagate = False

# Database logger (SQLAlchemy)
db_log_file = os.path.join(os.path.dirname(__file__), 'database.log')
db_logger = logging.getLogger("sqlalchemy.engine")
db_logger.setLevel(logging.INFO)
db_file_handler = RotatingFileHandler(db_log_file, maxBytes=5*1024*1024, backupCount=2)
db_file_handler.setFormatter(log_formatter)
db_logger.handlers = []
db_logger.addHandler(db_file_handler)
db_logger.propagate = False

# Extension logger
ext_log_file = os.path.join(os.path.dirname(__file__), 'extension.log')
extension_logger = logging.getLogger("extension")
extension_logger.setLevel(logging.INFO)
ext_file_handler = RotatingFileHandler(ext_log_file, maxBytes=5*1024*1024, backupCount=2)
ext_file_handler.setFormatter(log_formatter)
extension_logger.handlers = []
extension_logger.addHandler(ext_file_handler)
extension_logger.propagate = False


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

# Applied stage router (mounted; endpoint modules fill in routes per Phase B)
app.include_router(applied_router)


def run_maintenance_loop():
    """Background loop to handle scheduled database maintenance."""
    # Wait for the app to start up properly
    time.sleep(10)
    print("MAINTENANCE: Background scheduler started.")
    while True:
        try:
            # Check global config for maintenance settings
            config = database_service.get_config(None)
            m_config = config.get('maintenance', {})
            
            if m_config.get('cleanup_enabled', False):
                freq = m_config.get('frequency', 'weekly')
                start_time_str = m_config.get('start_time', '03:00')
                day_of_week = m_config.get('day_of_week', 'Sunday')
                day_of_month = int(m_config.get('day_of_month', 1))
                last_run_str = m_config.get('last_run')
                
                now = datetime.now()
                last_run = datetime.fromisoformat(last_run_str) if last_run_str else datetime.min
                
                should_run = False
                curr_time_str = now.strftime("%H:%M")
                
                if freq == 'hourly':
                    if (now - last_run) >= timedelta(hours=1):
                        should_run = True
                elif freq == 'daily':
                    if (now - last_run) >= timedelta(days=1) and curr_time_str >= start_time_str:
                        should_run = True
                elif freq == 'weekly':
                    if (now - last_run) >= timedelta(days=7) and now.strftime("%A") == day_of_week and curr_time_str >= start_time_str:
                        should_run = True
                elif freq == 'monthly':
                    if (now - last_run) >= timedelta(days=28) and now.day == day_of_month and curr_time_str >= start_time_str:
                        should_run = True

                if should_run:
                    print(f"MAINTENANCE: Running scheduled cleanup ({freq})...")
                    database_service.vacuum()
                    
                    # Log retention
                    retention_days = m_config.get('log_retention_days', 7)
                    _internal_purge_logs(retention_days)
                    
                    m_config['last_run'] = now.isoformat()
                    config['maintenance'] = m_config
                    database_service.save_config(config, None)
                    print("MAINTENANCE: Cleanup complete.")
            
            # Check every 10 minutes to minimize overhead
            time.sleep(600) 
                
        except Exception as e:
            print(f"MAINTENANCE ERROR: {e}")
            time.sleep(600)

# Start background maintenance thread
threading.Thread(target=run_maintenance_loop, daemon=True).start()



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

class ApproveRefinementRequest(BaseModel):
    application_id: int
    pending_refinement: dict

class CoverLetterRequest(BaseModel):
    resume_text: Optional[str] = None
    job_description: Optional[str] = None
    base_filename: Optional[str] = None
    additional_context: Optional[str] = ""
    additional_context_paths: Optional[List[str]] = []
    instructions: Optional[str] = ""
    application_id: Optional[int] = None

class RefineCoverLetterRequest(BaseModel):
    content: str
    instructions: str
    base_filename: str
    additional_context: Optional[str] = ""
    additional_context_paths: Optional[List[str]] = []


class ApplicationSaveRequest(BaseModel):
    id: Optional[int] = None
    application_id: Optional[int] = None
    job_title: Optional[str] = "Unknown Role"
    company: Optional[str] = "Unknown Company"
    company_logo: Optional[str] = ""
    job_url: Optional[str] = ""
    apply_url: Optional[str] = ""
    company_url: Optional[str] = ""
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
    force: Optional[bool] = False
    
    match_score: Optional[int] = None
    match_details: Optional[Any] = None
    pipeline_stage: Optional[str] = 'saved'
    commute_time_mins: Optional[int] = None
    commute_distance_miles: Optional[float] = None
    substage_progress: Optional[Any] = None
    company_research: Optional[Any] = None
    commute_details: Optional[Any] = {}
    diff_data: Optional[Any] = {}
    files: Optional[dict] = {}
    additional_docs: Optional[List[dict]] = []
    excluded_profile_docs: Optional[List[str]] = []
    prioritization_ranking: Optional[Any] = None



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
    recommendations: List[dict] = []
    other: List[dict] = []
    base_resume_path: Optional[str] = None
    long_form_resume_path: Optional[str] = None
    example_cover_letter_path: Optional[str] = None
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

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class ExtractProfileRequest(BaseModel):
    text: str

class LinkedInConnectionModel(BaseModel):
    name: str
    headline: Optional[str] = None
    profile_url: str
    company_id: Optional[str] = None
    company_name: Optional[str] = None
    degree: Optional[str] = None
    is_alumni: Optional[bool] = False
    photo_url: Optional[str] = None

class LinkedInSyncRequest(BaseModel):
    connections: List[LinkedInConnectionModel]

class ExtensionLogRequest(BaseModel):
    level: str = "INFO"
    message: str
    context: Optional[Dict[str, Any]] = None


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

@app.post("/api/auth/forgot-password")
async def forgot_password(req: ForgotPasswordRequest):
    user = database_service.get_user_by_email(req.email)
    # Always return success to prevent user enumeration
    if not user:
        return {"message": "If an account with that email exists, a reset link has been sent."}
    
    token = AuthService.create_reset_token(user["id"], user["hashed_password"])
    
    # In a real app, send email here. For now, log to console.
    reset_link = f"http://localhost/reset-password?token={token}"
    print(f"\n🔑 PASSWORD RESET REQUEST for {user['username']} ({user['email']})")
    print(f"🔗 Reset Link: {reset_link}\n")
    
    return {"message": "If an account with that email exists, a reset link has been sent."}

@app.post("/api/auth/reset-password")
async def reset_password(req: ResetPasswordRequest):
    # We need to find the user from the token first
    payload = AuthService.decode_token(req.token)
    if not payload or payload.get("type") != "reset":
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    
    user_id = int(payload.get("sub"))
    user = database_service.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Verify token against current password hash
    verified_id = AuthService.verify_reset_token(req.token, user["hashed_password"])
    if verified_id != user_id:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    
    # Update password
    new_hashed = AuthService.get_password_hash(req.new_password)
    database_service.admin_update_user(user_id, {"hashed_password": new_hashed})
    
    return {"message": "Password updated successfully"}


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

@app.post("/api/applications/{application_id}/upload-additional-doc")
async def upload_app_additional_doc(
    application_id: int,
    document: UploadFile = File(...),
    user_id: int = Depends(get_current_user_id)
):
    """Upload an additional supplemental document to a specific application."""
    try:
        app = database_service.get_application_by_id(application_id)
        if not app or app.get('user_id') != user_id:
            raise HTTPException(status_code=404, detail="Application not found")

        os.makedirs(f"{UPLOADS_DIR}/app_docs", exist_ok=True)
        filename = document.filename
        # Make filename unique
        safe_name = f"{int(time.time())}_{filename}"
        save_path = f"{UPLOADS_DIR}/app_docs/{safe_name}"
        
        with open(save_path, "wb") as buffer:
            shutil.copyfileobj(document.file, buffer)
            
        # Update application's additional_docs
        # We need to handle potential JSON parsing
        docs_str = app.get("additional_docs", "[]") or "[]"
        if isinstance(docs_str, str):
            docs = json.loads(docs_str)
        else:
            docs = docs_str or []
            
        docs.append({
            "filename": filename,
            "path": save_path,
            "label": "Job Document"
        })
        
        database_service.update_application(application_id, {"additional_docs": docs})
        
        return {"message": "Document uploaded", "path": save_path, "docs": docs}
    except Exception as e:
        logger.error(f"Error uploading app document: {e}")
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
async def get_admin_config(user_id: int = Depends(get_admin_user_id)):
    config = database_service.get_config(None)
    return config

@app.post("/api/admin/config")
async def save_admin_config(config: Dict[str, Any], user_id: int = Depends(get_admin_user_id)):
    database_service.save_config(config, None)
    return {"status": "success"}

@app.get("/api/admin/logs")
async def get_logs(type: str = "app", lines: int = 500, user_id: int = Depends(get_admin_user_id)):
    """Retrieve the tail of application, database, or extension logs."""
    if type == "extension":
        filename = "extension.log"
    elif type == "db":
        filename = "database.log"
    else:
        filename = "backend.log"
        
    base_dir = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(base_dir, filename)
    
    if not os.path.exists(path):
        return {"logs": f"Log file {filename} not found."}
        
    try:
        with open(path, 'r') as f:
            all_lines = f.readlines()
            tail = all_lines[-lines:] if len(all_lines) > lines else all_lines
            return {"logs": "".join(tail)}
    except Exception as e:
        logger.error(f"Error reading logs: {e}")
        return {"logs": f"Error reading logs: {str(e)}"}

@app.post("/api/extension/logs")
async def receive_extension_log(req: ExtensionLogRequest):
    """Receive logs from the Chrome extension."""
    level = req.level.upper()
    message = req.message
    if req.context:
        message += f" | Context: {json.dumps(req.context)}"
    
    if level == "DEBUG":
        extension_logger.debug(message)
    elif level == "WARNING":
        extension_logger.warning(message)
    elif level == "ERROR":
        extension_logger.error(message)
    else:
        extension_logger.info(message)
        
    return {"status": "success"}

def parse_logs_structured(lines):
    import re
    ts_pattern = re.compile(r'^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3}) - ([^ ]+) - ([^ ]+) - (.*)$')
    structured = []
    current_entry = None
    
    for line in lines:
        match = ts_pattern.match(line)
        if match:
            if current_entry:
                structured.append(current_entry)
            current_entry = {
                "timestamp": match.group(1),
                "logger": match.group(2),
                "level": match.group(3),
                "message": match.group(4)
            }
        elif current_entry:
            current_entry["message"] += "\n" + line.strip()
        else:
            # Lines before any timestamp
            structured.append({"timestamp": None, "logger": None, "level": None, "message": line.strip()})
            
    if current_entry:
        structured.append(current_entry)
    return structured

def process_log_files(files, format, start_date, end_date):
    import re
    all_lines = []
    ts_pattern = re.compile(r'^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3})')
    
    start_dt = datetime.strptime(start_date, "%Y-%m-%d") if start_date else None
    end_dt = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1) if end_date else None
    
    include_current = not (start_dt or end_dt)
    
    for fpath in files:
        if not os.path.exists(fpath): continue
        with open(fpath, 'r') as f:
            for line in f:
                match = ts_pattern.match(line)
                if match:
                    if not start_dt and not end_dt:
                        include_current = True
                    else:
                        try:
                            line_dt = datetime.strptime(match.group(1).split(',')[0], "%Y-%m-%d %H:%M:%S")
                            include_current = True
                            if start_dt and line_dt < start_dt: include_current = False
                            if end_dt and line_dt >= end_dt: include_current = False
                        except:
                            pass
                if include_current:
                    all_lines.append(line)
    
    if format == "log":
        return "".join(all_lines).encode()
    
    structured = parse_logs_structured(all_lines)
    if format == "jsonl":
        return "\n".join([json.dumps(entry) for entry in structured]).encode()
    if format == "csv":
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=["timestamp", "logger", "level", "message"])
        writer.writeheader()
        writer.writerows(structured)
        return output.getvalue().encode()
    return b""

@app.get("/api/admin/logs/export")
async def export_logs(
    type: str = "app", 
    format: str = "log", 
    start_date: Optional[str] = None, 
    end_date: Optional[str] = None,
    user_id: int = Depends(get_admin_user_id)
):
    base_dir = os.path.dirname(os.path.abspath(__file__))
    
    if type == "all":
        memory_file = io.BytesIO()
        with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
            for lt in ["app", "db", "extension"]:
                if lt == "extension":
                    filename = "extension.log"
                elif lt == "db":
                    filename = "database.log"
                else:
                    filename = "backend.log"

                path = os.path.join(base_dir, filename)
                files = [path]
                for i in range(1, 3):
                    p = f"{path}.{i}"
                    if os.path.exists(p): files.append(p)
                files.reverse()
                
                content_bytes = process_log_files(files, format, start_date, end_date)
                zf.writestr(f"{lt}_logs.{format}", content_bytes)
        
        memory_file.seek(0)
        return StreamingResponse(
            memory_file,
            media_type="application/zip",
            headers={"Content-Disposition": f"attachment; filename=all_logs.zip"}
        )

    if type == "extension":
        filename = "extension.log"
    elif type == "db":
        filename = "database.log"
    else:
        filename = "backend.log"
    path = os.path.join(base_dir, filename)
    files = [path]
    for i in range(1, 3):
        p = f"{path}.{i}"
        if os.path.exists(p): files.append(p)
    files.reverse()
    
    content_bytes = process_log_files(files, format, start_date, end_date)
    
    media_types = {
        "log": "text/plain",
        "jsonl": "application/x-jsonlines",
        "csv": "text/csv"
    }
    
    return StreamingResponse(
        io.BytesIO(content_bytes),
        media_type=media_types.get(format, "text/plain"),
        headers={"Content-Disposition": f"attachment; filename={type}_logs.{format}"}
    )

def _internal_purge_logs(retention_days=None):
    """Internal helper to clear or selectively purge logs based on age."""
    base_dir = os.path.dirname(os.path.abspath(__file__))
    purged = []
    current_time = time.time()
    retention_seconds = int(retention_days) * 86400 if retention_days else None

    for filename in ["backend.log", "database.log", "extension.log"]:
        path = os.path.join(base_dir, filename)
        
        # If no retention days specified, truncate the main active log file
        if retention_days is None:
            if os.path.exists(path):
                with open(path, 'w') as f:
                    f.truncate(0)
                purged.append(filename)
        
        # Process rotations (check up to 10 back files)
        for i in range(1, 10):
            rot_path = f"{path}.{i}"
            if os.path.exists(rot_path):
                if retention_seconds:
                    mtime = os.path.getmtime(rot_path)
                    if (current_time - mtime) > retention_seconds:
                        try:
                            os.remove(rot_path)
                            purged.append(f"{filename}.{i}")
                        except Exception as e:
                            print(f"Error removing {rot_path}: {e}")
                else:
                    # No retention, purge all rotations
                    try:
                        os.remove(rot_path)
                        purged.append(f"{filename}.{i}")
                    except Exception as e:
                        print(f"Error removing {rot_path}: {e}")
    return purged

@app.post("/api/admin/logs/purge")
async def purge_logs(data: Dict[str, Any] = None, user_id: int = Depends(get_admin_user_id)):
    """Clear or selectively purge application and database logs."""
    retention_days = data.get('retention_days') if data else None
    purged = _internal_purge_logs(retention_days)
    return {"status": "success", "purged": purged}

def mask_sensitive(data):
    if isinstance(data, dict):
        return {k: mask_sensitive(v) if not any(s in k.upper() for s in ['KEY', 'SECRET', 'TOKEN', 'PASSWORD', 'AUTH', 'API']) else '********' for k, v in data.items()}
    return data

@app.get("/api/admin/system/diagnostic-bundle")
async def get_diagnostic_bundle(user_id: int = Depends(get_admin_user_id)):
    """Generate a ZIP bundle with logs and configuration info."""
    memory_file = io.BytesIO()
    with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
        # 1. Logs
        base_dir = os.path.dirname(os.path.abspath(__file__))
        for log_name in ["backend.log", "database.log", "extension.log"]:
            path = os.path.join(base_dir, log_name)
            if os.path.exists(path):
                zf.write(path, arcname=f"logs/{log_name}")
                for i in range(1, 3):
                    p = f"{path}.{i}"
                    if os.path.exists(p):
                        zf.write(p, arcname=f"logs/{log_name}.{i}")
        
        # 2. Config Info
        config_info = {
            "system": {
                "os": platform.system(),
                "os_release": platform.release(),
                "python_version": platform.python_version(),
                "timestamp": datetime.now().isoformat()
            },
            "environment": mask_sensitive(dict(os.environ)),
            "app_config": mask_sensitive(database_service.get_config(None))
        }
        zf.writestr("config_diagnostics.json", json.dumps(config_info, indent=2))
        
    memory_file.seek(0)
    return StreamingResponse(
        memory_file,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=diagnostic_bundle.zip"}
    )


@app.post("/api/admin/db/vacuum")
async def vacuum_db(admin_id: int = Depends(get_admin_user_id)):
    """Reclaim unused space in the SQLite database"""
    try:
        database_service.vacuum()
        return {"status": "success", "message": "Database optimized successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/admin/db/reset")
async def reset_db(admin_id: int = Depends(get_admin_user_id)):
    """Clear all data and force a restart to trigger the setup flow"""
    try:
        database_service.reset_database()
        
        # Define restart function
        def restart_app():
            time.sleep(1)
            print("RESET: Restarting application to trigger setup flow...")
            os._exit(0)
            
        threading.Thread(target=restart_app).start()
        return {"status": "success", "message": "Database reset. Application will restart in 1 second."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



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

@app.post("/api/extract-profile")
async def extract_profile_from_text(req: ExtractProfileRequest, user_id: int = Depends(get_current_user_id)):
    try:
        config = await get_merged_config(user_id)
        return await ai_service.extract_profile_data(req.text, config=config)
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

@app.post("/api/profile/upload-example-cover-letter")
async def upload_example_cover_letter(
    document: UploadFile = File(...),
    user_id: int = Depends(get_current_user_id)
):
    """Upload and save an example cover letter to the user profile."""
    try:
        os.makedirs(f"{UPLOADS_DIR}/profile_cover_letters", exist_ok=True)
        filename = f"example_cover_letter_{document.filename}"
        save_path = f"{UPLOADS_DIR}/profile_cover_letters/{filename}"
        
        content = await document.read()
        with open(save_path, "wb") as f:
            f.write(content)
        
        # Update profile in DB with new path
        profile = database_service.get_profile(user_id)
        profile["example_cover_letter_path"] = save_path
        database_service.save_profile(profile, user_id)
        
        return {"path": save_path, "filename": document.filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/profile/example-cover-letter")
async def delete_example_cover_letter(user_id: int = Depends(get_current_user_id)):
    """Remove the example cover letter from the user profile."""
    try:
        profile = database_service.get_profile(user_id)
        path = profile.get("example_cover_letter_path")
        if path and os.path.exists(path):
            try:
                os.remove(path)
            except:
                pass
        
        profile["example_cover_letter_path"] = None
        database_service.save_profile(profile, user_id)
        return {"message": "Example cover letter removed"}
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
    application_id: Optional[int] = Form(None),
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
        app_obj = None
        if application_id:
            app_obj = database_service.get_application_by_id(application_id)

        file_path = None
        original_filename = "resume.docx"
        
        if resume:
            # Use uploaded file
            original_filename = resume.filename
            file_path = f"{UPLOADS_DIR}/{original_filename}"
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(resume.file, buffer)
        elif app_obj and app_obj.get("original_resume_path"):
            # Use the resume associated with this application
            file_path = app_obj["original_resume_path"]
            original_filename = os.path.basename(file_path)
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
        
        # If no description provided, try to get from application
        if not final_job_description and app_obj:
            final_job_description = app_obj.get("job_description") or ""
            if not job_url:
                job_url = app_obj.get("job_url")

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
        
        if application_id:
            print(f"💾 Saving tailored resume results to database for application {application_id}")
            success = database_service.update_application(application_id, {
                "tailored_resume_path": output_filename,
                "resume_data": tailored_resume_data,
                "resume_changes_summary": change_summary,
                "diff_data": {
                    "original": original_text_content,
                    "ai_tailored": tailored_text_content,
                    "tailored": tailored_text_content
                }
            })
            print(f"✅ Database update {'successful' if success else 'failed'}")


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
            "job_description": final_job_description,
            "extracted_context": all_additional_context,
            "application": database_service.get_application_by_id(application_id) if application_id else None
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

@app.post("/api/approve-refinement")
async def approve_refinement(request: ApproveRefinementRequest, user_id: int = Depends(get_current_user_id)):
    try:
        app_obj = database_service.get_application_by_id(request.application_id)
        if not app_obj:
            raise HTTPException(status_code=404, detail="Application not found")
            
        pending = request.pending_refinement
        files = pending.get("files", {})
        
        # Extract filename from URL (e.g., /api/download/base_resume_..._tailored.docx)
        resume_path = files.get("docx", "").split("/")[-1]
        
        updates = {
            "resume_data": pending.get("resume_data"),
            "resume_changes_summary": pending.get("change_summary"),
            "diff_data": pending.get("diff_data"),
            "tailored_resume_path": resume_path
        }
        
        database_service.update_application(request.application_id, updates)
        return {"message": "Refinement approved and saved"}
    except Exception as e:
        print(f"Error approving refinement: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/generate-cover-letter")
async def generate_cover_letter_endpoint(request: CoverLetterRequest, user_id: int = Depends(get_current_user_id)):
    try:
        # Fetch profile
        user_profile = database_service.get_profile(user_id)
        config = await get_merged_config(user_id)
        
        # --- Resolve Job Description and Resume from Application ---
        job_description = request.job_description
        resume_text = request.resume_text
        base_filename = request.base_filename or "cover_letter"
        
        if request.application_id:
            app_obj = database_service.get_application_by_id(request.application_id)
            if app_obj:
                if not job_description:
                    job_description = app_obj.get("job_description")
                if not resume_text:
                    # Try to extract from the application's resume
                    r_path = app_obj.get("original_resume_path")
                    if r_path:
                        full_r_path = os.path.join(UPLOADS_DIR, r_path) if not os.path.isabs(r_path) else r_path
                        if os.path.exists(full_r_path):
                            resume_text = document_service.extract_text(full_r_path)
                    
                    if not resume_text and user_profile.get("base_resume_path"):
                        base_r_path = user_profile["base_resume_path"]
                        if os.path.exists(base_r_path):
                            resume_text = document_service.extract_text(base_r_path)
                if not request.base_filename:
                    base_filename = app_obj.get("company", "cover_letter")

        if not job_description:
            raise HTTPException(status_code=400, detail="No job description provided (text or URL)")

        # --- Handle Additional Context Documents from Paths ---
        combined_additional_context = request.additional_context or ""
        if request.additional_context_paths:
            additional_context_chunks = []
            for path in request.additional_context_paths:
                if path and os.path.exists(str(path)):
                    path_str = str(path)
                    try:
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
                        print(f"Warning: Failed to parse context path {path_str}: {e}")
            
            if additional_context_chunks:
                combined_additional_context += "\n" + "\n".join(additional_context_chunks)

        # --- Handle Example Cover Letter for Formatting/Tone ---
        example_cl_text = ""
        example_cl_path = user_profile.get("example_cover_letter_path")
        if example_cl_path and os.path.exists(example_cl_path):
            try:
                if example_cl_path.endswith('.docx'):
                    doc_data = document_service.parse_docx(example_cl_path)
                    example_cl_text = "\n".join(doc_data.get("full_text", []))
                elif example_cl_path.endswith('.pdf'):
                    example_cl_text = document_service.extract_text_from_pdf(example_cl_path)
                elif example_cl_path.endswith('.txt'):
                    example_cl_text = document_service.extract_text_from_txt(example_cl_path)
            except Exception as e:
                print(f"Warning: Failed to parse example cover letter {example_cl_path}: {e}")

        result = await ai_service.generate_cover_letter(
            resume_text=resume_text, 
            job_description=job_description, 
            user_profile=user_profile,
            additional_context=combined_additional_context,
            example_cover_letter=example_cl_text,
            instructions=request.instructions,
            config=config
        )
        content = result.get("content", "")
        
        # Safe filename
        safe_base_name = re.sub(r'[^\w\s-]', '', base_filename).strip().replace(' ', '_')
        output_docx = f"{OUTPUTS_DIR}/{safe_base_name}_cover_letter.docx"
        output_pdf = f"{OUTPUTS_DIR}/{safe_base_name}_cover_letter.pdf"
        output_txt = f"{OUTPUTS_DIR}/{safe_base_name}_cover_letter.txt"
        
        document_service.create_cover_letter_docx(content, output_docx)
        document_service.create_pdf_from_docx(output_docx, output_pdf)
        
        with open(output_txt, 'w') as f:
            f.write(content)
            
        if request.application_id:
            database_service.update_application(request.application_id, {
                "cover_letter_path": os.path.basename(output_docx),
                "cover_letter_text": content
            })

        return {
            "message": "Cover letter generated",
            "content": content,
            "generation_summary": result.get("generation_summary", []),
            "missing_fields": result.get("missing_fields", []),
            "detected_info": result.get("detected_info", {}),
            "files": {
                "docx": f"/api/download/{safe_base_name}_cover_letter.docx",
                "pdf": f"/api/download/{safe_base_name}_cover_letter.pdf",
                "txt": f"/api/download/{safe_base_name}_cover_letter.txt"
            },
            "application": database_service.get_application_by_id(request.application_id) if request.application_id else None
        }


    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/refine-cover-letter")
async def refine_cover_letter_endpoint(request: RefineCoverLetterRequest, user_id: int = Depends(get_current_user_id)):
    try:
        config = await get_merged_config(user_id)
        # --- Handle Additional Context Documents from Paths ---
        combined_additional_context = request.additional_context or ""
        if request.additional_context_paths:
            additional_context_chunks = []
            for path in request.additional_context_paths:
                if path and os.path.exists(str(path)):
                    path_str = str(path)
                    try:
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
                        print(f"Warning: Failed to parse context path {path_str}: {e}")
            
            if additional_context_chunks:
                combined_additional_context += "\n" + "\n".join(additional_context_chunks)

        result = await ai_service.refine_cover_letter(
            content=request.content, 
            instructions=request.instructions, 
            additional_context=combined_additional_context,
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
        app_id = database_service.save_application(request.dict(exclude_unset=True), user_id, force=request.force)
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
        success = database_service.update_application(app_id, request.dict(exclude_unset=True), user_id, force=request.force)
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
        import traceback
        error_detail = traceback.format_exc()
        print(f"Error generating analytics: {str(e)}\n{error_detail}")
        
        # If we failed to get apps, we can't do much, but we can try to return a valid empty structure
        # instead of a 500 error, which allows the frontend to show an empty state or a friendly message.
        return {
            "total_applications": 0,
            "pipeline_stages": {},
            "interest_levels": {},
            "job_types": {},
            "location_types": {},
            "weekly_activity": [],
            "avg_match_score": None,
            "scores_count": 0,
            "top_companies": [],
            "recent_applications": [],
            "linkedin_stats": {
                "total_connections": 0,
                "apps_with_connections": 0,
                "percentage_with_connections": 0,
                "distribution": {}
            },
            "error_context": str(e) if os.getenv("DEBUG") == "True" else None
        }


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

class OutreachRequest(BaseModel):
    contact_name: str
    contact_role: str
    linkedin_url: Optional[str] = None
    how_we_know: Optional[str] = None

@app.post("/api/applications/{app_id}/generate-outreach")
async def generate_outreach_script(app_id: int, request: OutreachRequest, user_id: int = Depends(get_current_user_id)):
    try:
        app_data = database_service.get_application_by_id(app_id, user_id)
        if not app_data:
            raise HTTPException(status_code=404, detail="Application not found")

        profile = database_service.get_profile(user_id)
        config = await get_merged_config(user_id)
        
        system_prompt = "Act as an expert recruiter, placement, and HR professional with extensive experience in creating high-converting outreach scripts. Your goal is to write a personalized LinkedIn message or email to a potential connection at a company the user is applying to. Keep it professional, concise, and engaging. RETURN YOUR RESPONSE AS A STRICT JSON OBJECT WITH TWO KEYS: 'subject' (a catchy subject line) and 'body' (the message content). DO NOT wrap it in markdown block quotes, just output the raw JSON."
        
        user_prompt = f"Company: {app_data.get('company')}\n"
        user_prompt += f"Job Title: {app_data.get('job_title')}\n"
        user_prompt += f"Contact Name: {request.contact_name}\n"
        user_prompt += f"Contact Role: {request.contact_role}\n"
        
        if request.how_we_know:
            user_prompt += f"How I know them: {request.how_we_know}\n"

        user_prompt += "\nPlease generate a short, personalized outreach message. It should not exceed 100-150 words.\n"
        user_prompt += "CRITICAL INSTRUCTION: Please fill in all placeholders directly using the following information from my profile:\n"
        user_prompt += f"My Name: {profile.get('full_name', '') or profile.get('first_name', '') + ' ' + profile.get('last_name', '')}\n"
        user_prompt += f"My Email: {profile.get('email', '')}\n"
        user_prompt += f"My Phone: {profile.get('phone_primary', '')}\n"
        user_prompt += f"My LinkedIn: {profile.get('linkedin_url', '')}\n"
        user_prompt += "Ensure NO placeholder brackets like [Your Name] are left in the final text. Substitute them naturally."

        response = await ai_service.execute_ai_request(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            response_format="json_object",
            config=config
        )
        
        database_service.update_application(app_id, {"outreach_script": response}, user_id)
        
        import json
        try:
            parsed = json.loads(response)
        except Exception:
            parsed = {"subject": "Outreach", "body": response}

        return {"script": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/applications/{app_id}/enrich")
async def enrich_application(app_id: int, force: bool = False, user_id: int = Depends(get_current_user_id)):
    """AI-generate enrichment fields (job_summary, core_purpose, etc.) from the job description.
    
    Only calls the AI if any field is missing, unless force is True. Returns the enriched fields and saves them.
    """
    try:
        app_data = database_service.get_application_by_id(app_id, user_id)
        if not app_data:
            raise HTTPException(status_code=404, detail="Application not found")

        # Check if enrichment has already been done (at least the summary)
        if not force and app_data.get("job_summary"):
            fields = ["job_summary", "core_purpose", "function_dept", "reporting_line", "team_context"]
            return {k: app_data.get(k) for k in fields}

        jd = app_data.get("job_description", "")
        if not jd:
            return {k: None for k in fields}

        # Load per-user config for AI provider selection
        user_config = {}
        try:
            user_config = database_service.get_config(user_id) or {}
            logger.info(f"Enrichment config retrieved for user {user_id}. Keys: {list(user_config.keys())}")
        except Exception as e:
            logger.error(f"Error fetching config for enrichment: {e}")
            pass

        prompt = f"""Analyze the following job description and extract these specific details.

JOB TITLE: {app_data.get('job_title', 'Unknown')}
COMPANY: {app_data.get('company', 'Unknown')}

JOB DESCRIPTION:
{jd[:6000]}

Return a JSON object with EXACTLY these fields:
{{
    "job_summary": "2-3 sentence summary of the company mission and what this role is about. If the company mission isn't explicit, infer it from context.",
    "core_purpose": "1-2 sentences describing the core purpose of this specific role — what problem it solves or what it is accountable for.",
    "function_dept": "The functional area or department (e.g., 'Engineering — Platform', 'Product Management', 'Data Science — Analytics'). Be specific.",
    "reporting_line": "Who this role reports to, if stated or strongly implied. Use null if not determinable.",
    "team_context": "Context about the team — size, composition, stage, or mission if available. Use null if not mentioned.",
    "requirements": ["Concise requirement 1", "Concise requirement 2"],
    "preferences": ["Concise preference 1", "Concise preference 2"],
    "skills": ["Skill 1", "Skill 2"],
    "bonus_equity": "1-2 sentence summary of Bonus and Equity compensation. If none stated, return 'Not specified.'",
    "travel_requirements": "1-2 sentence summary of Travel Requirements. If none stated, return 'None specified.'",
    "company_url": "Provide the official company website URL. If not explicitly found in the job description text, provide the official URL if you are certain of it based on the company name, otherwise null."
}}

CRITICAL INSTRUCTIONS:
- For "requirements" and "preferences": Summarize the original bullets so they boil down to just the essence (not wordy).
- For "skills": Be even briefer. Limit these to 3 words or less whenever possible (but if it can't be done, it's ok to have more).
- Be concise and grounded in the text. Do not fabricate details not present or inferable from the description."""

        content = await ai_service.execute_ai_request(
            system_prompt="You are a precise job description analyst.",
            user_prompt=prompt,
            response_format="json_object",
            temperature=0.2,
            config=user_config,
        )
        result = ai_service._parse_json_response(content)

        enrichment = {
            "job_summary": result.get("job_summary"),
            "core_purpose": result.get("core_purpose"),
            "function_dept": result.get("function_dept"),
            "reporting_line": result.get("reporting_line"),
            "team_context": result.get("team_context"),
            "parsed_requirements": json.dumps(result.get("requirements", [])),
            "parsed_preferences": json.dumps(result.get("preferences", [])),
            "parsed_skills": json.dumps(result.get("skills", [])),
            "bonus_equity": result.get("bonus_equity"),
            "travel_requirements": result.get("travel_requirements"),
        }

        # Include company_url if provided by AI and not already present
        if result.get("company_url") and not app_data.get("company_url"):
            enrichment["company_url"] = result.get("company_url")

        # Persist — use a direct SQL update to avoid touching other fields
        database_service.update_application(app_id, enrichment, user_id)

        return enrichment
    except Exception as e:
        logger.error(f"Error enriching application {app_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/applications/{app_id}/company-research")
async def generate_company_research(app_id: int, background_tasks: BackgroundTasks, force: bool = False, user_id: int = Depends(get_current_user_id)):
    """AI-generate company research data for all four sections (overview, detailed, financials, competitors).
    
    Stores the result as a JSON blob in the `company_research` column.
    Uses force=True to always regenerate, even if research already exists.
    """
    try:
        app_data = database_service.get_application_by_id(app_id, user_id)
        if not app_data:
            raise HTTPException(status_code=404, detail="Application not found")

        # Return cached research if it exists and not forcing refresh
        if not force and app_data.get("company_research"):
            return {"company_research": app_data["company_research"], "cached": True}

        company = app_data.get("company") or "Unknown Company"
        jd = app_data.get("job_description") or ""
        job_title = app_data.get("job_title") or "Unknown Role"

        config = await get_merged_config(user_id)

        system_prompt = (
            "You are an expert business analyst and company researcher. "
            "Given a company name and optionally a job description, generate comprehensive research data. "
            "Return ONLY a valid JSON object with no extra text or markdown."
        )

        user_prompt = f"""Generate detailed company research for: {company}
Role being applied to: {job_title}

Job Description excerpt (use for additional context):
{jd[:3000]}

Return a JSON object with EXACTLY these top-level keys:
{{
  "overview": {{
    "mission": "1-2 sentence mission statement or core purpose of the company",
    "founded": "Year founded (or estimated)",
    "website": "Link to company homepage (e.g. 'https://acme.com') or null",
    "careers_url": "Link to company careers page or job listings (e.g. 'https://acme.com/careers') or null",
    "headquarters": "City, Country",
    "industry": "Primary industry",
    "business_model": "1-2 sentence description of how the company makes money",
    "employee_count": "Headcount (e.g. '9,800+' or '~500')",
    "public_private": "Public or Private",
    "ticker": "Stock ticker if public, else null",
    "core_values": ["Value 1", "Value 2", "Value 3"],
    "glassdoor_rating": "Rating out of 5 if known (e.g. '4.2'), else null",
    "linkedin_followers": "Number of LinkedIn followers if known, else null",
    "leadership": [
      {{"title": "CEO", "name": "Name if known, else null"}},
      {{"title": "CTO", "name": "Name if known, else null"}},
      {{"title": "CPO", "name": "Name if known, else null"}}
    ]
  }},
  "detailed": {{
    "market_position": "1-2 sentences on their market position and competitive standing",
    "culture_summary": "1-2 sentences about the engineering/product culture",
    "tech_stack": ["Technology 1", "Technology 2", "Technology 3"],
    "recent_news": [
      {{"headline": "News headline", "source": "Source name", "time_ago": "e.g. '1 week ago'", "sentiment": "positive|neutral|negative"}},
      {{"headline": "News headline 2", "source": "Source name", "time_ago": "e.g. '2 weeks ago'", "sentiment": "positive|neutral|negative"}}
    ],
    "work_model": "Remote/Hybrid/On-site policy if known, else null",
    "notable_perks": ["Perk 1", "Perk 2", "Perk 3"]
  }},
  "financials": {{
    "annual_revenue": "Most recent annual revenue (e.g. '$1.2B') or null",
    "revenue_growth": "YoY revenue growth percentage or null",
    "gross_margin": "Gross margin percentage or null",
    "market_cap": "Market cap if public (e.g. '$58B') or null",
    "funding_stage": "Series X / IPO / Public / Bootstrapped or null",
    "total_funding": "Total funding raised if private (e.g. '$500M') or null",
    "profitable": "Yes / No / Unknown",
    "stock_symbol": "Ticker if public, else null",
    "recent_acquisitions": [
      {{"name": "Acquisition name", "year": "Year", "rationale": "1-sentence strategic rationale"}}
    ]
  }},
  "competitors": {{
    "primary_competitors": [
      {{"name": "Competitor 1", "differentiator": "What sets them apart vs target company"}},
      {{"name": "Competitor 2", "differentiator": "What sets them apart vs target company"}},
      {{"name": "Competitor 3", "differentiator": "What sets them apart vs target company"}}
    ],
    "competitive_advantages": ["Advantage 1", "Advantage 2", "Advantage 3"],
    "market_threats": ["Threat 1", "Threat 2"],
    "interview_tips": "1-2 sentences on how to discuss competitive landscape in interviews"
  }}
}}

IMPORTANT:
- Base data on actual knowledge of the company. Use null for fields you are uncertain about.
- Do NOT fabricate specific numbers. Use approximations with '~' if needed.
- Return ONLY valid JSON, no markdown, no code blocks."""

        research = None
        last_error = None
        for attempt in range(2):
            try:
                content = await ai_service.execute_ai_request(
                    system_prompt=system_prompt,
                    user_prompt=user_prompt,
                    response_format="json_object",
                    temperature=0.3 + (attempt * 0.2), # Increase temperature on retry to change generation path
                    config=config,
                )
                research = ai_service._parse_json_response(content)
                if research:
                    break
            except Exception as e:
                last_error = e
                if attempt == 1:
                    logger.error(f"Failed to generate valid JSON after 2 attempts for app {app_id}: {e}")
                    
        if not research:
            raise HTTPException(status_code=500, detail=f"Failed to generate valid JSON: {str(last_error) if last_error else 'Unknown error'}")
        
        # Extract website for top-level field
        company_website = research.get("overview", {}).get("website")
        careers_url = research.get("overview", {}).get("careers_url")
        
        # Persist to database
        update_data = {"company_research": research}
        if company_website:
            update_data["company_url"] = company_website
            
        database_service.update_application(app_id, update_data, user_id)

        # Trigger background scan of careers page if careers_url is found
        if careers_url:
            background_tasks.add_task(scan_company_jobs, app_id, careers_url, user_id)

        return {"company_research": research, "cached": False}
    except Exception as e:
        logger.error(f"Error generating company research for app {app_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/applications/{app_id}/refresh-career-matches")
async def refresh_career_matches(app_id: int, background_tasks: BackgroundTasks, user_id: int = Depends(get_current_user_id)):
    """Re-run the career page scraping and AI matching without regenerating the full company research."""
    try:
        app_data = database_service.get_application_by_id(app_id, user_id)
        if not app_data:
            raise HTTPException(status_code=404, detail="Application not found")

        # Extract careers_url from existing research
        research_raw = app_data.get("company_research")
        if not research_raw:
            raise HTTPException(status_code=400, detail="No company research found. Run full company research first.")

        research = research_raw if isinstance(research_raw, dict) else json.loads(research_raw)
        careers_url = research.get("overview", {}).get("careers_url")
        if not careers_url:
            raise HTTPException(status_code=400, detail="No careers URL found in company research.")

        background_tasks.add_task(scan_company_jobs, app_id, careers_url, user_id)
        return {"message": "Career matches refresh started", "careers_url": careers_url}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error refreshing career matches for app {app_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def scan_company_jobs(app_id: int, careers_url: str, user_id: int):
    """Background task to scrape careers page and find matching roles."""
    try:
        logger.info(f"Starting background job scan for app {app_id} at {careers_url}")
        
        # 1. Get the current application details (needed for job title in scraping)
        app_data = database_service.get_application_by_id(app_id, user_id)
        current_job_title = app_data.get("job_title", "") if app_data else ""
        
        # 2. Scrape the careers page using the multi-strategy scraper
        jobs_text = await scraper_service.scrape_careers_page(careers_url, job_title=current_job_title)
        if not jobs_text or len(jobs_text) < 100:
            logger.warning(f"Aborting job scan for app {app_id}: Scraped text too short ({len(jobs_text or '')} chars).")
            return

        # 3. Get user profile for matching
        profile = database_service.get_profile(user_id)
        profile_text = ""
        if profile:
            profile_text = f"Title: {profile.get('job_title')}\nBio: {profile.get('bio')}\nSkills: {', '.join(profile.get('skills', []))}"
        
        # 4. Build prompt context from application details
        current_jd = app_data.get("job_description", "") if app_data else ""
        current_job_excerpt = current_jd[:1500] if current_jd else ""
        
        # 4. Use AI to find matches
        config = await get_merged_config(user_id)
        prompt_template = ai_service.get_prompt("match_career_openings", config)
        prompt = prompt_template.format(
            profile_text=profile_text,
            current_job_title=current_job_title,
            current_job_excerpt=current_job_excerpt,
            jobs_text=jobs_text[:15000]
        )
        
        content = await ai_service.execute_ai_request(
            system_prompt="You are a specialized career matching assistant.",
            user_prompt=prompt,
            response_format="json_object",
            temperature=0.3,
            config=config
        )
        matches_data = ai_service._parse_json_response(content)
        
        # 5. Update the application research with the matches
        app_data = database_service.get_application_by_id(app_id, user_id)
        if app_data and app_data.get("company_research"):
            research = app_data["company_research"]
            if isinstance(research, str):
                research = json.loads(research)
            
            research["career_matches"] = matches_data
            update_payload = {"company_research": research}
            
            # 6. Auto-update apply_url if direct listing found with high confidence
            direct = matches_data.get("direct_listing", {})
            if direct.get("found") and direct.get("url") and direct.get("confidence") in ("high", "medium"):
                update_payload["apply_url"] = direct["url"]
                logger.info(f"Auto-updated apply_url for app {app_id} to direct listing: {direct['url']}")
            
            database_service.update_application(app_id, update_payload, user_id)
            logger.info(f"Background job scan complete for app {app_id}")

            # 7. Emit notification
            match_count = len(matches_data.get("matches", []))
            company_name = app_data.get("company", "Unknown")
            if direct.get("found") and direct.get("confidence") in ("high", "medium"):
                # Apply URL was auto-updated — this is a background data change
                notif_title = f"Apply link updated for {company_name}"
                notif_msg = f"We found your job listing on {company_name}'s careers page and automatically updated the apply link. {match_count} other matching role{'s' if match_count != 1 else ''} also found."
                notif_category = "update"
            elif direct.get("found"):
                # Found but low confidence — user should verify
                notif_title = f"Possible direct listing at {company_name}"
                notif_msg = f"We found a potential match for your role on {company_name}'s careers page (low confidence). Please review and update the apply link if correct."
                notif_category = "action"
            elif match_count > 0:
                # No direct listing, but similar roles found — user might want to explore
                notif_title = f"{match_count} similar role{'s' if match_count != 1 else ''} at {company_name}"
                notif_msg = f"Your specific listing was not found on the careers page, but we found {match_count} similar role{'s' if match_count != 1 else ''} that may interest you."
                notif_category = "info"
            else:
                notif_title = f"Career scan complete for {company_name}"
                notif_msg = f"No matching roles were found on {company_name}'s careers page."
                notif_category = "info"
            
            database_service.create_notification(
                user_id=user_id,
                title=notif_title,
                message=notif_msg,
                category=notif_category,
                link_screen="lifecycle",
                link_app_id=app_id,
                link_anchor="company",
            )

    except Exception as e:
        logger.error(f"Error in scan_company_jobs for app {app_id}: {e}")
        try:
            database_service.create_notification(
                user_id=user_id,
                title="Career scan failed",
                message=f"An error occurred while scanning the careers page: {str(e)[:200]}",
                category="error",
                link_screen="lifecycle",
                link_app_id=app_id,
                link_anchor="company",
            )
        except Exception:
            pass

@app.post("/api/applications/{app_id}/score")
async def score_application_endpoint(app_id: int, user_id: int = Depends(get_current_user_id)):
    """Re-calculate the AI match score for an application using the current profile/resume."""
    try:
        app_data = database_service.get_application_by_id(app_id, user_id)
        if not app_data:
            raise HTTPException(status_code=404, detail="Application not found")

        config = await get_merged_config(user_id)
        profile = database_service.get_profile(user_id)
        
        # Determine which resume to use based on active type and available files
        active_type = app_data.get("active_resume_type", "generated")
        override_path = app_data.get("override_resume_path")
        tailored_path = app_data.get("tailored_resume_path")
        original_path = app_data.get("original_resume_path")
        base_path = profile.get("base_resume_path")
        
        file_to_score = None
        
        def resolve_path(filename):
            if not filename: return None
            if filename.startswith("/"):
                return filename if os.path.exists(filename) else None
            out_p = f"{OUTPUTS_DIR}/{filename}"
            if os.path.exists(out_p): return out_p
            up_p = f"{UPLOADS_DIR}/{filename}"
            if os.path.exists(up_p): return up_p
            return None

        # If override is explicitly selected and available
        if active_type == "override" and override_path:
            file_to_score = resolve_path(override_path)
            
        # Otherwise, fall back to generated/tailored, then original uploaded, then profile default
        if not file_to_score and tailored_path:
            file_to_score = resolve_path(tailored_path)
        if not file_to_score and original_path:
            file_to_score = resolve_path(original_path)
        if not file_to_score and base_path:
            file_to_score = resolve_path(base_path)
        
        resume_text = ""
        if file_to_score:
            resume_text = document_service.extract_text(file_to_score)
        else:
            # Fallback to resume_data if no files found
            res_data = app_data.get("resume_data", {})
            if res_data and "full_text" in res_data:
                resume_text = "\n".join(res_data["full_text"])
        
        if not resume_text:
            raise HTTPException(status_code=400, detail="No resume content found to score.")

        jd = app_data.get("job_description", "")
        if not jd:
            raise HTTPException(status_code=400, detail="No job description found to score.")

        result = await ai_service.score_job_match(
            resume_text=resume_text,
            job_description=jd,
            config=config
        )

        database_service.update_application(app_id, {
            "match_score": result.get("overall_score"),
            "match_details": json.dumps(result)
        }, user_id)

        return result
    except Exception as e:
        logger.error(f"Error scoring application {app_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error enriching application {app_id}: {e}")
        # Return empty fields instead of 500 to allow the frontend to stop the loading animation
        return {
            "job_summary": None,
            "core_purpose": None,
            "function_dept": None,
            "reporting_line": None,
            "team_context": None
        }

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
        # Fallback: Check profile docs
        file_path = f"{UPLOADS_DIR}/profile_docs/{filename}"
        
    if not os.path.exists(file_path):
        # Fallback: Check app-specific docs
        file_path = f"{UPLOADS_DIR}/app_docs/{filename}"
        
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
async def get_onlyoffice_config(filename: str, application_id: Optional[str] = None, user_id: int = Depends(get_current_user_id)):
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
    
    # Generate a unique key based on filename + modification time
    import hashlib
    mtime = os.path.getmtime(file_path)
    # Use a stable hash for session consistency
    doc_key = hashlib.md5(f"{filename}_{int(mtime)}".encode()).hexdigest()[:20]
    
    # Add application_id to callback if provided
    callback_query = f"filename={filename}"
    if application_id:
        callback_query += f"&application_id={application_id}"
    
    # Document URL that OnlyOffice server can access (internal Docker network)
    document_url = f"{BACKEND_INTERNAL_URL}/api/download/{filename}"

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
        "documentType": "word",
        "editorConfig": {
            "callbackUrl": f"{BACKEND_INTERNAL_URL}/api/onlyoffice/callback?{callback_query}",
            "mode": "edit",
            "lang": "en",
            "customization": {
                "uiTheme": "theme-dark",
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
                "id": f"user-{user_id}",
                "name": "Resume Editor"
            }
        },
        "type": "desktop",
        "width": "100%",
        "height": "100%"
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
    """Fetch available models from the specified provider using the posted config."""
    try:
        provider = config.get("provider") or "openai"
        base_url = config.get("base_url") or config.get(f"{provider}_base_url")
        # Resolve API key: provider-specific key wins, then generic, then env
        api_key = (
            config.get(f"{provider}_api_key")
            or config.get("api_key")
            or os.getenv(f"{provider.upper()}_API_KEY", "")
            or os.getenv("GOOGLE_API_KEY", "") if provider == "gemini" else ""
        )
        models = await ai_service.list_available_models(
            provider=provider, api_key=api_key, base_url=base_url
        )
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
    company: Optional[str] = None
    how_we_know: Optional[str] = None
    photo_url: Optional[str] = None

@app.post("/api/applications/{app_id}/contacts")
async def add_application_contact(app_id: int, contact: ContactCreate, user_id: int = Depends(get_current_user_id)):
    print(f"👤 Adding contact {contact.name} to application {app_id}")
    try:
        new_contact = database_service.add_application_contact(app_id, contact.dict())
        return new_contact
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/applications/{app_id}/contacts/{contact_id}")
async def update_application_contact(app_id: int, contact_id: int, contact: ContactCreate, user_id: int = Depends(get_current_user_id)):
    print(f"👤 Updating contact {contact_id} for application {app_id}")
    try:
        updated_contact = database_service.update_application_contact(contact_id, contact.dict(exclude_unset=True))
        if not updated_contact:
            raise HTTPException(status_code=404, detail="Contact not found")
        return updated_contact
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/applications/{app_id}/contacts/{contact_id}")
async def delete_application_contact(app_id: int, contact_id: int, user_id: int = Depends(get_current_user_id)):
    print(f"👤 Deleting contact {contact_id} for application {app_id}")
    try:
        success = database_service.delete_application_contact(contact_id)
        if not success:
            raise HTTPException(status_code=404, detail="Contact not found")
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/proxy-image")
async def proxy_image(url: str):
    """
    Proxy LinkedIn CDN images through the backend to avoid CORS/referrer
    restrictions when loading stored Voyager API photo URLs in the extension.
    Allows both media and static LinkedIn CDN domains.
    """
    # Allow any subdomain of licdn.com
    import urllib.parse
    parsed = urllib.parse.urlparse(url)
    if not (parsed.netloc.endswith('.licdn.com') or parsed.netloc == 'licdn.com'):
        logger.warning(f"Proxy attempt for non-allowed domain: {url}")
        raise HTTPException(status_code=400, detail="Only LinkedIn CDN images are supported")
    try:
        async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Referer": "https://www.linkedin.com/",
            }
            resp = await client.get(url, headers=headers)
            if resp.status_code != 200:
                logger.error(f"Image proxy failed for {url} with status {resp.status_code}")
                raise HTTPException(status_code=resp.status_code, detail="Image fetch failed")
            
            content_type = resp.headers.get("content-type", "image/jpeg")
            return StreamingResponse(
                iter([resp.content]),
                media_type=content_type,
                headers={"Cache-Control": "public, max-age=86400"}
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Proxy error for {url}: {e}")
        raise HTTPException(status_code=502, detail=f"Proxy error: {str(e)}")


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

@app.get("/api/linkedin/resolve-photo")
async def resolve_linkedin_photo(url: str):
    """
    Attempt to find a profile photo for a LinkedIn URL.
    1. Check database cache.
    2. Try a lightweight server-side scrape of the public profile (og:image).
    """
    # 1. Database check
    photo_url = database_service.get_photo_by_linkedin_url(url)
    if photo_url:
        return {"photo_url": photo_url}
        
    # 2. Server-side scrape fallback
    try:
        import httpx
        import re
        
        async with httpx.AsyncClient(timeout=5.0) as client:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8"
            }
            response = await client.get(url, headers=headers)
            if response.status_code == 200:
                html = response.text
                # Look for og:image
                match = re.search(r'<meta property="og:image" content="([^"]+)"', html)
                if match:
                    photo_url = match.group(1).replace("&amp;", "&")
                    if "ghost_person" not in photo_url:
                        # Success!
                        database_service.save_linkedin_connections([{
                            "profile_url": url,
                            "photo_url": photo_url
                        }], None)
                        return {"photo_url": photo_url}
    except Exception as e:
        print(f"[API] resolve-photo scrape error: {e}")
        
    raise HTTPException(status_code=404, detail="Photo not found")

@app.delete("/api/linkedin/purge")
async def purge_linkedin_connections(user_id: int = Depends(get_current_user_id)):
    try:
        success = database_service.clear_linkedin_connections(user_id)
        return {"success": success}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class PhotoResolveBatchRequest(BaseModel):
    profile_urls: List[str]
    application_id: Optional[int] = None

@app.post("/api/linkedin/resolve-photos-batch")
async def resolve_photos_batch(request: PhotoResolveBatchRequest, user_id: int = Depends(get_current_user_id)):
    """
    Bulk-resolve profile photos for LinkedIn connections.
    1. Check database cache for each URL.
    2. For cache misses, try to scrape the public profile page for og:image.
    3. Persist any found photos to linkedin_connections + application_contacts.
    Returns a dict of {profile_url: photo_url} for successfully resolved photos.
    """
    import re as _re
    results = {}
    urls_to_scrape = []
    
    # 1. Check cache for all URLs first
    for url in request.profile_urls:
        cached = database_service.get_photo_by_linkedin_url(url)
        if cached:
            results[url] = cached
        else:
            urls_to_scrape.append(url)
    
    # 2. Scrape public profiles for uncached URLs (in parallel, with rate limiting)
    if urls_to_scrape:
        async def scrape_one(profile_url: str) -> tuple:
            try:
                async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
                    headers = {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                        "Accept-Language": "en-US,en;q=0.5"
                    }
                    resp = await client.get(profile_url, headers=headers)
                    if resp.status_code == 200:
                        html = resp.text
                        match = _re.search(r'<meta property="og:image" content="([^"]+)"', html)
                        if match:
                            photo = match.group(1).replace("&amp;", "&")
                            if "ghost_person" not in photo and "placeholder" not in photo:
                                return (profile_url, photo)
            except Exception as e:
                logger.debug(f"Failed to scrape {profile_url}: {e}")
            return (profile_url, None)
        
        import asyncio
        # Process in batches of 5 to avoid overwhelming LinkedIn
        batch_size = 5
        for i in range(0, len(urls_to_scrape), batch_size):
            batch = urls_to_scrape[i:i+batch_size]
            tasks = [scrape_one(url) for url in batch]
            batch_results = await asyncio.gather(*tasks)
            for url, photo in batch_results:
                if photo:
                    results[url] = photo
            # Small delay between batches
            if i + batch_size < len(urls_to_scrape):
                await asyncio.sleep(0.5)
    
    # 3. Persist found photos to database
    if results:
        for url, photo in results.items():
            # Update linkedin_connections table
            database_service.save_linkedin_connections([{
                "profile_url": url,
                "photo_url": photo
            }], user_id)
            
            # Update application_contacts if app_id was provided
            if request.application_id:
                database_service.update_contact_photo_by_url(
                    request.application_id, url, photo
                )
    
    return {"resolved": results, "total": len(results), "attempted": len(request.profile_urls)}

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
                "company_url": metadata.get("company_url", ""),
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



# ── Notification Endpoints ──────────────────────────────────────────────────
@app.get("/api/notifications")
async def get_notifications(user_id: int = Depends(get_current_user_id)):
    """Get all notifications for the current user."""
    return database_service.get_notifications(user_id, limit=50)

@app.put("/api/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: int, user_id: int = Depends(get_current_user_id)):
    """Mark a single notification as read."""
    success = database_service.mark_notification_read(notification_id, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"ok": True}

@app.put("/api/notifications/read-all")
async def mark_all_notifications_read(user_id: int = Depends(get_current_user_id)):
    """Mark all notifications as read for the current user."""
    count = database_service.mark_all_notifications_read(user_id)
    return {"ok": True, "count": count}

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
