from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import json
import os
from typing import Dict, List, Any

Base = declarative_base()

class Application(Base):
    __tablename__ = 'applications'
    
    id = Column(Integer, primary_key=True)
    job_title = Column(String)
    company = Column(String)
    company_logo = Column(Text)   # base64 or URL
    job_url = Column(String)
    job_description = Column(Text)
    status = Column(String, default='Saved')
    date_saved = Column(String) # Storing ISO format string
    original_resume_path = Column(String)
    tailored_resume_path = Column(String)
    cover_letter_path = Column(String)
    resume_data = Column(Text) # JSON string
    cover_letter_text = Column(Text)
    salary_range = Column(String)
    date_posted = Column(String)
    deadline = Column(String)
    apply_url = Column(String)
    job_type = Column(String)
    location_type = Column(String)
    location = Column(String)
    relocation = Column(String)   # 'true'/'false'
    interest_level = Column(String)
    remarks = Column(Text)
    is_archived = Column(String, default='false')  # 'true'/'false'
    kanban_order = Column(Integer, default=0)
    
    # Override fields for final versions
    override_resume_path = Column(String)
    override_cover_letter_path = Column(String)
    active_resume_type = Column(String, default='generated') # 'generated' or 'override'
    active_cover_letter_type = Column(String, default='generated') # 'generated' or 'override'
    
    # New fields for AI insights
    resume_changes_summary = Column(Text) # JSON list/string
    cover_letter_changes_summary = Column(Text) # JSON list/string

    # Company Ratings & Links
    glassdoor_rating = Column(String)
    glassdoor_url = Column(String)
    indeed_rating = Column(String)
    indeed_url = Column(String)
    linkedin_rating = Column(String)
    linkedin_url = Column(String)
    
    # Snapshot of User Profile at time of generation
    profile_snapshot = Column(Text) # JSON string


class UserProfile(Base):
    __tablename__ = 'user_profile'
    
    id = Column(Integer, primary_key=True)
    first_name = Column(String)
    last_name = Column(String)
    full_name = Column(String) # For display preference
    address_line1 = Column(String)
    address_line2 = Column(String)
    city = Column(String)
    state = Column(String)
    zip_code = Column(String)
    phone_primary = Column(String)
    phone_secondary = Column(String)
    linkedin_url = Column(String)
    github_url = Column(String)
    website_url = Column(String)
    email = Column(String)
    job_title = Column(String) # Target title
    bio = Column(Text) # Brief summary
    skills = Column(Text) # JSON list of strings
    certificates = Column(Text) # JSON list of dicts/strings
    other = Column(Text) # JSON list of dicts/strings
    base_resume_path = Column(String)
    long_form_resume_path = Column(String)
    additional_docs = Column(Text)  # JSON list of {filename, path, label}
    social_links = Column(Text) # JSON list of {name, url}
    preferences = Column(Text) # JSON dict of user preferences

    experiences = relationship("UserExperience", back_populates="user", cascade="all, delete-orphan")
    educations = relationship("UserEducation", back_populates="user", cascade="all, delete-orphan")

class UserExperience(Base):
    __tablename__ = 'user_experience'
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('user_profile.id'))
    company = Column(String)
    position = Column(String)
    start_date = Column(String)
    end_date = Column(String)
    description = Column(Text) # Raw text or bullets

    user = relationship("UserProfile", back_populates="experiences")

class UserEducation(Base):
    __tablename__ = 'user_education'
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('user_profile.id'))
    institution = Column(String)
    degree = Column(String)
    field_of_study = Column(String)
    start_date = Column(String)
    end_date = Column(String)

    user = relationship("UserProfile", back_populates="educations")

# Import remaining sqlalchemy types
from sqlalchemy import ForeignKey
from sqlalchemy.orm import relationship

import time
from sqlalchemy.exc import OperationalError

class DatabaseService:
    def __init__(self):
        # Default to existing sqlite if no env var, or postgres if provided
        # For Docker, we will set DATABASE_URL=postgresql://user:pass@db:5432/dbname
        self.db_url = os.getenv("DATABASE_URL", "sqlite:///applications.db")
        
        self.engine = create_engine(self.db_url)
        self._wait_for_db()
        # Base.metadata.drop_all(self.engine) # RESET DB Schema for dev changes
        Base.metadata.create_all(self.engine)
        self._migrate_schema()
        self.Session = sessionmaker(bind=self.engine)

    def _migrate_schema(self):
        """Add any new columns to existing tables that weren't there when the table was first created."""
        migrations = [
            "ALTER TABLE applications ADD COLUMN IF NOT EXISTS deadline TEXT",
            "ALTER TABLE applications ADD COLUMN IF NOT EXISTS apply_url TEXT",
            "ALTER TABLE applications ADD COLUMN IF NOT EXISTS company_logo TEXT",
            "ALTER TABLE applications ADD COLUMN IF NOT EXISTS job_type TEXT",
            "ALTER TABLE applications ADD COLUMN IF NOT EXISTS location_type TEXT",
            "ALTER TABLE applications ADD COLUMN IF NOT EXISTS location TEXT",
            "ALTER TABLE applications ADD COLUMN IF NOT EXISTS relocation TEXT",
            "ALTER TABLE applications ADD COLUMN IF NOT EXISTS interest_level TEXT",
            "ALTER TABLE applications ADD COLUMN IF NOT EXISTS remarks TEXT",
            "ALTER TABLE applications ADD COLUMN IF NOT EXISTS is_archived TEXT DEFAULT 'false'",
            "ALTER TABLE applications ADD COLUMN IF NOT EXISTS kanban_order INTEGER DEFAULT 0",
            "ALTER TABLE applications ADD COLUMN IF NOT EXISTS glassdoor_rating TEXT",
            "ALTER TABLE applications ADD COLUMN IF NOT EXISTS glassdoor_url TEXT",
            "ALTER TABLE applications ADD COLUMN IF NOT EXISTS indeed_rating TEXT",
            "ALTER TABLE applications ADD COLUMN IF NOT EXISTS indeed_url TEXT",
            "ALTER TABLE applications ADD COLUMN IF NOT EXISTS linkedin_rating TEXT",
            "ALTER TABLE applications ADD COLUMN IF NOT EXISTS linkedin_url TEXT",
            "ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS base_resume_path TEXT",
            "ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS long_form_resume_path TEXT",
            "ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS additional_docs TEXT",
            "ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS social_links TEXT",
            "ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS preferences TEXT",
            "ALTER TABLE applications ADD COLUMN IF NOT EXISTS profile_snapshot TEXT",
            "ALTER TABLE applications ADD COLUMN IF NOT EXISTS override_resume_path TEXT",
            "ALTER TABLE applications ADD COLUMN IF NOT EXISTS override_cover_letter_path TEXT",
            "ALTER TABLE applications ADD COLUMN IF NOT EXISTS active_resume_type TEXT DEFAULT 'generated'",
            "ALTER TABLE applications ADD COLUMN IF NOT EXISTS active_cover_letter_type TEXT DEFAULT 'generated'",
        ]
        with self.engine.connect() as conn:
            for sql in migrations:
                try:
                    conn.execute(text(sql))
                    conn.commit()
                except Exception as e:
                    print(f"Migration skipped or failed (may already exist): {e}")
        
    def _wait_for_db(self, retries=30, delay=2):
        """Wait for database to be ready."""
        print(f"Waiting for database at {self.db_url}...")
        for i in range(retries):
            try:
                self.engine = create_engine(self.db_url)
                # Try to connect
                with self.engine.connect() as conn:
                    print("Database connected successfully!")
                    return
            except Exception as e:
                # OperationalError or other connection errors
                if i < retries - 1:
                    print(f"Database not ready (attempt {i+1}/{retries}), retrying in {delay}s... Error: {str(e)[:100]}")
                    time.sleep(delay)
                else:
                    print("Database connection failed after retries.")
                    raise
        
    def save_application(self, data: Dict[str, Any]) -> int:
        session = self.Session()
        try:
            app_id = data.get('application_id')
            if app_id:
                app = session.query(Application).filter(Application.id == app_id).first()
                if app:
                    app.status = data.get('status', 'Generated')
                    app.job_title = data.get('job_title', app.job_title)
                    app.company = data.get('company', app.company)
                    if data.get('company_logo'): app.company_logo = data.get('company_logo')
                    if data.get('job_url'): app.job_url = data.get('job_url')
                    if data.get('job_description'): app.job_description = data.get('job_description')
                    if data.get('original_resume_path'): app.original_resume_path = data.get('original_resume_path')
                    if data.get('tailored_resume_path'): app.tailored_resume_path = data.get('tailored_resume_path')
                    if data.get('cover_letter_path'): app.cover_letter_path = data.get('cover_letter_path')
                    if data.get('resume_data'): app.resume_data = json.dumps(data.get('resume_data'))
                    if data.get('cover_letter_text'): app.cover_letter_text = data.get('cover_letter_text')
                    if data.get('salary_range'): app.salary_range = data.get('salary_range')
                    if data.get('date_posted'): app.date_posted = data.get('date_posted')
                    if data.get('deadline'): app.deadline = data.get('deadline')
                    if data.get('apply_url'): app.apply_url = data.get('apply_url')
                    if data.get('job_type'): app.job_type = data.get('job_type')
                    if data.get('location_type'): app.location_type = data.get('location_type')
                    if data.get('location'): app.location = data.get('location')
                    if data.get('relocation') is not None: 
                        app.relocation = 'true' if data.get('relocation') is True else 'false'
                    else:
                        app.relocation = None
                    if data.get('interest_level'): app.interest_level = data.get('interest_level')
                    if data.get('remarks'): app.remarks = data.get('remarks')
                    if data.get('resume_changes_summary'): app.resume_changes_summary = json.dumps(data.get('resume_changes_summary'))
                    if data.get('cover_letter_changes_summary'): app.cover_letter_changes_summary = json.dumps(data.get('cover_letter_changes_summary'))
                    if 'kanban_order' in data: app.kanban_order = data['kanban_order']
                    if 'is_archived' in data: 
                        app.is_archived = 'true' if (data['is_archived'] is True or data['is_archived'] == 'true') else 'false'
                    if data.get('profile_snapshot'):
                        val = data['profile_snapshot']
                        app.profile_snapshot = json.dumps(val) if isinstance(val, (dict, list)) else val
                    if 'override_resume_path' in data: app.override_resume_path = data['override_resume_path']
                    if 'override_cover_letter_path' in data: app.override_cover_letter_path = data['override_cover_letter_path']
                    if 'active_resume_type' in data: app.active_resume_type = data['active_resume_type'] or 'generated'
                    if 'active_cover_letter_type' in data: app.active_cover_letter_type = data['active_cover_letter_type'] or 'generated'

                    
                    # Update company ratings
                    if data.get('glassdoor_rating') is not None: app.glassdoor_rating = data.get('glassdoor_rating')
                    if data.get('glassdoor_url') is not None: app.glassdoor_url = data.get('glassdoor_url')
                    if data.get('indeed_rating') is not None: app.indeed_rating = data.get('indeed_rating')
                    if data.get('indeed_url') is not None: app.indeed_url = data.get('indeed_url')
                    if data.get('linkedin_rating') is not None: app.linkedin_rating = data.get('linkedin_rating')
                    if data.get('linkedin_url') is not None: app.linkedin_url = data.get('linkedin_url')
                    
                    session.commit()
                    return app.id

            new_app = Application(
                job_title=data.get('job_title', 'Unknown Role'),
                company=data.get('company', 'Unknown Company'),
                company_logo=data.get('company_logo', ''),
                job_url=data.get('job_url', ''),
                job_description=data.get('job_description', ''),
                date_saved=datetime.now().isoformat(),
                original_resume_path=data.get('original_resume_path', ''),
                tailored_resume_path=data.get('tailored_resume_path', ''),
                cover_letter_path=data.get('cover_letter_path', ''),
                resume_data=json.dumps(data.get('resume_data', {})),
                cover_letter_text=data.get('cover_letter_text', ''),
                salary_range=data.get('salary_range', ''),
                date_posted=data.get('date_posted', ''),
                deadline=data.get('deadline', ''),
                apply_url=data.get('apply_url', ''),
                job_type=data.get('job_type', ''),
                location_type=data.get('location_type', ''),
                location=data.get('location', ''),
                relocation='true' if data.get('relocation') is True else ('false' if data.get('relocation') is False else None),
                interest_level=data.get('interest_level', ''),
                remarks=data.get('remarks', ''),
                resume_changes_summary=json.dumps(data.get('resume_changes_summary', [])),
                cover_letter_changes_summary=json.dumps(data.get('cover_letter_changes_summary', [])),
                status=data.get('status', 'Saved'),
                is_archived='true' if (data.get('is_archived') is True or data.get('is_archived') == 'true') else 'false',
                kanban_order=data.get('kanban_order', 0),
                glassdoor_rating=data.get('glassdoor_rating'),
                glassdoor_url=data.get('glassdoor_url'),
                indeed_rating=data.get('indeed_rating'),
                indeed_url=data.get('indeed_url'),
                linkedin_rating=data.get('linkedin_rating'),
                linkedin_url=data.get('linkedin_url'),
                profile_snapshot=json.dumps(data.get('profile_snapshot')) if data.get('profile_snapshot') else None,
                override_resume_path=data.get('override_resume_path'),
                override_cover_letter_path=data.get('override_cover_letter_path'),
                active_resume_type=data.get('active_resume_type', 'generated'),
                active_cover_letter_type=data.get('active_cover_letter_type', 'generated')
            )
            session.add(new_app)
            session.commit()
            return new_app.id
        finally:
            session.close()

    def update_application_status(self, app_id: int, new_status: str) -> bool:
        session = self.Session()
        try:
            app = session.query(Application).filter(Application.id == app_id).first()
            if app:
                app.status = new_status
                session.commit()
                return True
            return False
        finally:
            session.close()

    def update_application_logo(self, app_id: int, company_logo: str) -> bool:
        session = self.Session()
        try:
            app = session.query(Application).filter(Application.id == app_id).first()
            if app:
                app.company_logo = company_logo
                session.commit()
                return True
            return False
        finally:
            session.close()
        
    def get_applications(self) -> List[Dict[str, Any]]:
        session = self.Session()
        try:
            apps = session.query(Application).order_by(Application.date_saved.desc()).all()
            
            # Convert to dict list
            result = []
            for app in apps:
                result.append({
                    "id": app.id,
                    "job_title": app.job_title,
                    "company": app.company,
                    "company_logo": app.company_logo,
                    "job_url": app.job_url,
                    "job_description": app.job_description,
                    "status": app.status,
                    "date_saved": app.date_saved,
                    "original_resume_path": app.original_resume_path,
                    "tailored_resume_path": app.tailored_resume_path,
                    "cover_letter_path": app.cover_letter_path,
                    "cover_letter_text": app.cover_letter_text,
                    "salary_range": app.salary_range,
                    "date_posted": app.date_posted,
                    "deadline": app.deadline,
                    "apply_url": app.apply_url,
                    "job_type": app.job_type,
                    "location_type": app.location_type,
                    "location": app.location,
                    "relocation": True if app.relocation == 'true' else (False if app.relocation == 'false' else None),
                    "interest_level": app.interest_level,
                    "remarks": app.remarks,
                    "resume_changes_summary": app.resume_changes_summary,
                    "cover_letter_changes_summary": app.cover_letter_changes_summary,
                    "is_archived": app.is_archived == 'true',
                    "glassdoor_rating": app.glassdoor_rating,
                    "glassdoor_url": app.glassdoor_url,
                    "indeed_rating": app.indeed_rating,
                    "indeed_url": app.indeed_url,
                    "linkedin_rating": app.linkedin_rating,
                    "linkedin_url": app.linkedin_url,
                    "profile_snapshot": json.loads(app.profile_snapshot) if app.profile_snapshot else None
                })
            return result
        finally:
            session.close()

    def normalize_url(self, url: str) -> str:
        if not url: return ""
        # Remove whitespace and trailing slash
        return url.strip().rstrip('/')

    def _app_to_dict(self, app) -> Dict[str, Any]:
        """Convert an Application ORM object to a dict."""
        return {
            "id": app.id,
            "job_title": app.job_title,
            "company": app.company,
            "company_logo": app.company_logo,
            "job_url": app.job_url,
            "apply_url": app.apply_url,
            "job_description": app.job_description,
            "status": app.status,
            "date_saved": app.date_saved,
            "salary_range": app.salary_range,
            "date_posted": app.date_posted,
            "deadline": app.deadline,
            "job_type": app.job_type,
            "location_type": app.location_type,
            "location": app.location,
            "relocation": app.relocation,
            "interest_level": app.interest_level,
            "remarks": app.remarks,
            "original_resume_path": app.original_resume_path,
            "tailored_resume_path": app.tailored_resume_path,
            "cover_letter_path": app.cover_letter_path,
            "cover_letter_text": app.cover_letter_text,
            "resume_changes_summary": app.resume_changes_summary,
            "cover_letter_changes_summary": app.cover_letter_changes_summary,
            "is_archived": app.is_archived or 'false',
            "kanban_order": app.kanban_order or 0,
            "profile_snapshot": json.loads(app.profile_snapshot) if app.profile_snapshot else None,
            "override_resume_path": app.override_resume_path,
            "override_cover_letter_path": app.override_cover_letter_path,
            "active_resume_type": app.active_resume_type or 'generated',
            "active_cover_letter_type": app.active_cover_letter_type or 'generated'
        }

    def get_application_by_url(self, url: str) -> Dict[str, Any]:
        """Check if an application with this URL already exists. Returns full application data."""
        if not url: return None
        
        normalized_url = self.normalize_url(url)
        print(f"DEBUG: Checking for URL: '{url}' -> Normalized: '{normalized_url}'")
        
        session = self.Session()
        try:
            # First try exact match
            app = session.query(Application).filter(Application.job_url == url).first()
            if app:
                print(f"DEBUG: Exact match found: {app.id}")
                return self._app_to_dict(app)
                
            # Fallback: check normalized
            all_apps = session.query(Application).all()
            for app in all_apps:
                if self.normalize_url(app.job_url) == normalized_url:
                    print(f"DEBUG: Fuzzy match found: {app.id}")
                    return self._app_to_dict(app)
            
            print("DEBUG: No match found.")
            return None
        finally:
            session.close()

    def get_application_by_id(self, app_id: int) -> Dict[str, Any]:
        """Get a single application by its ID."""
        session = self.Session()
        try:
            app = session.query(Application).filter(Application.id == app_id).first()
            if not app:
                return None
            return self._app_to_dict(app)
        finally:
            session.close()

    def update_application(self, app_id: int, data: Dict[str, Any]) -> bool:
        """Update an existing application's fields."""
        session = self.Session()
        try:
            app = session.query(Application).filter(Application.id == app_id).first()
            if not app:
                return False
            if 'job_title' in data: app.job_title = data['job_title']
            if 'company' in data: app.company = data['company']
            if 'company_logo' in data: app.company_logo = data['company_logo']
            if 'job_url' in data: app.job_url = data['job_url']
            if 'apply_url' in data: app.apply_url = data['apply_url']
            if 'job_description' in data: app.job_description = data['job_description']
            if 'salary_range' in data: app.salary_range = data['salary_range']
            if 'date_posted' in data: app.date_posted = data['date_posted']
            if 'deadline' in data: app.deadline = data['deadline']
            if 'job_type' in data: app.job_type = data['job_type']
            if 'location_type' in data: app.location_type = data['location_type']
            if 'location' in data: app.location = data['location']
            if 'relocation' in data: 
                if data['relocation'] is True or data['relocation'] == 'true':
                    app.relocation = 'true'
                elif data['relocation'] is False or data['relocation'] == 'false':
                    app.relocation = 'false'
                else:
                    app.relocation = None
            if 'interest_level' in data: app.interest_level = data['interest_level']
            if 'remarks' in data: app.remarks = data['remarks']
            if 'status' in data: app.status = data['status']
            if 'kanban_order' in data: app.kanban_order = data['kanban_order']
            if 'is_archived' in data: 
                app.is_archived = 'true' if (data['is_archived'] is True or data['is_archived'] == 'true') else 'false'
            if 'original_resume_path' in data: app.original_resume_path = data['original_resume_path']
            if 'tailored_resume_path' in data: app.tailored_resume_path = data['tailored_resume_path']
            if 'cover_letter_path' in data: app.cover_letter_path = data['cover_letter_path']
            if 'cover_letter_text' in data: app.cover_letter_text = data['cover_letter_text']
            if 'resume_data' in data: 
                val = data['resume_data']
                app.resume_data = json.dumps(val) if isinstance(val, (dict, list)) else val
            if 'resume_changes_summary' in data:
                val = data['resume_changes_summary']
                app.resume_changes_summary = json.dumps(val) if isinstance(val, (dict, list)) else val
            if 'cover_letter_changes_summary' in data:
                val = data['cover_letter_changes_summary']
                app.cover_letter_changes_summary = json.dumps(val) if isinstance(val, (dict, list)) else val
            
            if 'profile_snapshot' in data:
                val = data['profile_snapshot']
                app.profile_snapshot = json.dumps(val) if isinstance(val, (dict, list)) else val
            if 'override_resume_path' in data: app.override_resume_path = data['override_resume_path']
            if 'override_cover_letter_path' in data: app.override_cover_letter_path = data['override_cover_letter_path']
            if 'active_resume_type' in data: app.active_resume_type = data['active_resume_type'] or 'generated'
            if 'active_cover_letter_type' in data: app.active_cover_letter_type = data['active_cover_letter_type'] or 'generated'

            
            if 'glassdoor_rating' in data: app.glassdoor_rating = data['glassdoor_rating']
            if 'glassdoor_url' in data: app.glassdoor_url = data['glassdoor_url']
            if 'indeed_rating' in data: app.indeed_rating = data['indeed_rating']
            if 'indeed_url' in data: app.indeed_url = data['indeed_url']
            if 'linkedin_rating' in data: app.linkedin_rating = data['linkedin_rating']
            if 'linkedin_url' in data: app.linkedin_url = data['linkedin_url']

            session.commit()
            return True
        except Exception as e:
            session.rollback()
            raise e
        finally:
            session.close()

    def delete_application(self, app_id: int) -> bool:
        """Delete an application record by ID."""
        session = self.Session()
        try:
            app = session.query(Application).filter(Application.id == app_id).first()
            if not app:
                return False
            session.delete(app)
            session.commit()
            return True
        except Exception as e:
            session.rollback()
            raise e
        finally:
            session.close()

    def archive_application(self, app_id: int, archived: bool) -> bool:
        """Set the archived flag on an application."""
        session = self.Session()
        try:
            app = session.query(Application).filter(Application.id == app_id).first()
            if not app:
                return False
            app.is_archived = 'true' if archived else 'false'
            session.commit()
            return True
        except Exception as e:
            session.rollback()
            raise e
        finally:
            session.close()

    def get_profile(self) -> Dict[str, Any]:
        """Get the single user profile (assumes single user system)."""
        session = self.Session()
        try:
            profile = session.query(UserProfile).first()
            if not profile:
                return {}
            
            return {
                "id": profile.id,
                "first_name": profile.first_name,
                "last_name": profile.last_name,
                "full_name": profile.full_name,
                "address_line1": profile.address_line1,
                "address_line2": profile.address_line2,
                "city": profile.city,
                "state": profile.state,
                "zip_code": profile.zip_code,
                "phone_primary": profile.phone_primary,
                "phone_secondary": profile.phone_secondary,
                "linkedin_url": profile.linkedin_url,
                "github_url": profile.github_url,
                "website_url": profile.website_url,
                "email": profile.email,
                "job_title": profile.job_title,
                "bio": profile.bio,
                "skills": json.loads(profile.skills) if profile.skills else [],
                "experiences": [{
                    "id": exp.id,
                    "company": exp.company,
                    "position": exp.position,
                    "start_date": exp.start_date,
                    "end_date": exp.end_date,
                    "description": exp.description
                } for exp in profile.experiences],
                "educations": [{
                    "id": edu.id,
                    "institution": edu.institution,
                    "degree": edu.degree,
                    "field_of_study": edu.field_of_study,
                    "start_date": edu.start_date,
                    "end_date": edu.end_date
                } for edu in profile.educations],
                "certificates": json.loads(profile.certificates) if profile.certificates else [],
                "other": json.loads(profile.other) if profile.other else [],
                "base_resume_path": profile.base_resume_path,
                "long_form_resume_path": profile.long_form_resume_path,
                "additional_docs": json.loads(profile.additional_docs) if profile.additional_docs else [],
                "social_links": json.loads(profile.social_links) if getattr(profile, 'social_links', None) else [],
                "preferences": json.loads(profile.preferences) if getattr(profile, 'preferences', None) else {}
            }
        finally:
            session.close()

    def save_profile(self, data: Dict[str, Any]) -> int:
        """Save or update the user profile."""
        session = self.Session()
        try:
            profile = session.query(UserProfile).first()
            if not profile:
                profile = UserProfile()
                session.add(profile)
            
            # Update fields
            profile.first_name = data.get('first_name', '')
            profile.last_name = data.get('last_name', '')
            profile.full_name = data.get('full_name', '')
            profile.address_line1 = data.get('address_line1', '')
            profile.address_line2 = data.get('address_line2', '')
            profile.city = data.get('city', '')
            profile.state = data.get('state', '')
            profile.zip_code = data.get('zip_code', '')
            profile.phone_primary = data.get('phone_primary', '')
            profile.phone_secondary = data.get('phone_secondary', '')
            profile.linkedin_url = data.get('linkedin_url', '')
            profile.github_url = data.get('github_url', '')
            profile.website_url = data.get('website_url', '')
            profile.email = data.get('email', '')
            profile.job_title = data.get('job_title', '')
            profile.bio = data.get('bio', '')
            profile.skills = json.dumps(data.get('skills', []))
            
            # Handle Experience (full replace for simplicity in MVP)
            # Clear existing
            profile.experiences = []
            for exp_data in data.get('experiences', []):
                new_exp = UserExperience(
                    company=exp_data.get('company', ''),
                    position=exp_data.get('position', ''),
                    start_date=exp_data.get('start_date', ''),
                    end_date=exp_data.get('end_date', ''),
                    description=exp_data.get('description', '')
                )
                profile.experiences.append(new_exp)
            
            # Handle Education (full replace)
            profile.educations = []
            for edu_data in data.get('educations', []):
                new_edu = UserEducation(
                    institution=edu_data.get('institution', ''),
                    degree=edu_data.get('degree', ''),
                    field_of_study=edu_data.get('field_of_study', ''),
                    start_date=edu_data.get('start_date', ''),
                    end_date=edu_data.get('end_date', '')
                )
                profile.educations.append(new_edu)
            
            profile.certificates = json.dumps(data.get('certificates', []))
            profile.other = json.dumps(data.get('other', []))
            if data.get("base_resume_path") is not None:
                profile.base_resume_path = data["base_resume_path"]
            if data.get("long_form_resume_path") is not None:
                profile.long_form_resume_path = data["long_form_resume_path"]
            if "additional_docs" in data and data.get("additional_docs") is not None:
                profile.additional_docs = json.dumps(data.get("additional_docs", []))
            if "social_links" in data:
                profile.social_links = json.dumps(data.get("social_links", []))
            if "preferences" in data:
                profile.preferences = json.dumps(data.get("preferences", {}))
                
            session.commit()
            return profile.id
        finally:
            session.close()
