from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey, text, Float, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime, timezone
import json
import os
from typing import Dict, List, Any

Base = declarative_base()

class User(Base):
    __tablename__ = 'users'
    
    id = Column(Integer, primary_key=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_admin = Column(Integer, default=0) # 1 for admin, 0 for regular
    api_key = Column(String, unique=True, index=True, nullable=True)
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    email = Column(String, nullable=True)
    photo_url = Column(String, nullable=True)
    photo_zoom = Column(Float, default=1.0)
    photo_x = Column(Float, default=0.0)
    photo_y = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    applications = relationship("Application", back_populates="user")
    profile = relationship("UserProfile", back_populates="user", uselist=False)
    config = relationship("Config", back_populates="user", uselist=False)

class Application(Base):
    __tablename__ = 'applications'
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=True) # Nullable for legacy
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
    diff_data = Column(Text) # JSON string
    source = Column(String) # Origin platform (e.g. LinkedIn, Indeed)
    company_url = Column(String) # Link to company website
    
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
    pipeline_stage = Column(String, default='saved') # saved, generated, applied, interviewing, decision, accepted
    commute_time_mins = Column(Integer, nullable=True)
    commute_distance_miles = Column(Float, nullable=True)
    commute_details = Column(Text) # JSON dict like {"driving": {"mins": 25, "distance": 12}, "walking": {...}}

    match_score = Column(Integer, nullable=True)
    match_details = Column(Text) # JSON string containing scoring and coaching plan
    substage_progress = Column(Text) # JSON dict of sub-stage completion status
    additional_docs = Column(Text)  # JSON list of {filename, path, label}
    excluded_profile_docs = Column(Text) # JSON list of paths (to exclude from profile docs)

    # AI-enriched job context fields (generated on first view)
    job_summary = Column(Text, nullable=True)     # High-level mission / what the company does
    core_purpose = Column(Text, nullable=True)    # Core purpose of the role
    function_dept = Column(Text, nullable=True)   # Function / department
    reporting_line = Column(Text, nullable=True)  # Who this role reports to
    team_context = Column(Text, nullable=True)    # Team size / composition context
    parsed_requirements = Column(Text, nullable=True) # JSON list of concise requirements
    parsed_preferences = Column(Text, nullable=True)  # JSON list of concise preferences
    parsed_skills = Column(Text, nullable=True)       # JSON list of concise skills
    bonus_equity = Column(Text, nullable=True)        # Summary of bonus/equity
    travel_requirements = Column(Text, nullable=True) # Summary of travel requirements
    outreach_script = Column(Text, nullable=True)     # Generated outreach script
    company_research = Column(Text, nullable=True)    # JSON: AI-generated company research (overview, financials, competitors, detailed)
    prioritization_ranking = Column(Text, nullable=True) # JSON: User-defined prioritization scoring

    # Applied stage (added 2026-05-21)
    applied_substage = Column(String(64), nullable=True)
    submission_record_json = Column(Text, nullable=True)
    submission_snapshot_json = Column(Text, nullable=True)
    confirmation_record_json = Column(Text, nullable=True)
    follow_up_plan_json = Column(Text, nullable=True)
    sla_tracker_json = Column(Text, nullable=True)

    # Relationships
    sub_steps = relationship("ApplicationSubStep", back_populates="application", cascade="all, delete-orphan")
    contacts = relationship("ApplicationContact", back_populates="application", cascade="all, delete-orphan")
    events = relationship("ApplicationEvent", back_populates="application", cascade="all, delete-orphan")
    applied_assets = relationship("AppliedAsset", back_populates="application", cascade="all, delete-orphan")
    user = relationship("User", back_populates="applications")


class ApplicationSubStep(Base):
    __tablename__ = 'application_sub_steps'
    id = Column(Integer, primary_key=True)
    application_id = Column(Integer, ForeignKey('applications.id'))
    title = Column(String)
    description = Column(Text)
    status = Column(String) # 'todo', 'in_progress', 'completed'
    date = Column(String)
    phase = Column(String, default="saved")
    application = relationship("Application", back_populates="sub_steps")

class ApplicationContact(Base):
    __tablename__ = 'application_contacts'
    id = Column(Integer, primary_key=True)
    application_id = Column(Integer, ForeignKey('applications.id'))
    name = Column(String)
    role = Column(String)
    email = Column(String)
    phone = Column(String)
    linkedin_url = Column(String)
    headline = Column(String)
    company = Column(String)
    how_we_know = Column(String)
    photo_url = Column(String)
    # Applied stage (added 2026-05-21)
    is_hiring_manager = Column(Boolean, default=False)
    source = Column(String, nullable=True)
    application = relationship("Application", back_populates="contacts")

class ApplicationEvent(Base):
    __tablename__ = 'application_events'
    id = Column(Integer, primary_key=True)
    application_id = Column(Integer, ForeignKey('applications.id'))
    event_type = Column(String)
    description = Column(Text)
    timestamp = Column(String)
    # Applied stage (added 2026-05-21)
    actor = Column(String(32), nullable=True)            # 'user' | 'agent' | 'system'
    title = Column(String(255), nullable=True)
    metadata_json = Column(Text, nullable=True)
    related_asset_id = Column(Integer, nullable=True)
    substage = Column(String(64), nullable=True)
    application = relationship("Application", back_populates="events")


class AppliedAsset(Base):
    __tablename__ = 'applied_assets'

    id = Column(Integer, primary_key=True)
    application_id = Column(Integer, ForeignKey('applications.id'), nullable=False, index=True)
    asset_type = Column(String(64), nullable=False)              # 'receipt', 'screenshot', etc.
    file_path = Column(String(1024), nullable=False)
    mime_type = Column(String(128), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_hash = Column(String(128), nullable=False)              # 'sha256:<hex>'
    uploaded_at = Column(String(64), nullable=False)             # ISO-8601 UTC
    created_by_user_id = Column(Integer, nullable=True)

    application = relationship("Application", back_populates="applied_assets")


class UserProfile(Base):
    __tablename__ = 'user_profile'
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=True) # Nullable for legacy
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
    recommendations = Column(Text) # JSON list of dicts/strings
    base_resume_path = Column(String)
    long_form_resume_path = Column(String)
    example_cover_letter_path = Column(String)
    additional_docs = Column(Text)  # JSON list of {filename, path, label}
    social_links = Column(Text) # JSON list of {name, url}
    preferences = Column(Text) # JSON dict of user preferences

    experiences = relationship("UserExperience", back_populates="user", cascade="all, delete-orphan")
    educations = relationship("UserEducation", back_populates="user", cascade="all, delete-orphan")
    user = relationship("User", back_populates="profile")

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

class LinkedInConnection(Base):
    __tablename__ = 'linkedin_connections'
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    name = Column(String)
    headline = Column(Text)
    profile_url = Column(String)
    company_id = Column(String) # Numeric LinkedIn company ID
    company_name = Column(String)
    degree = Column(String) # "1st", "2nd", etc.
    is_alumni = Column(Boolean, default=False)
    photo_url = Column(String)
    last_synced = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User")

class Config(Base):
    __tablename__ = 'configs'
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), unique=True, nullable=True)
    settings = Column(Text) # JSON string of all settings (AI key, prompts, etc.)
    
    user = relationship("User", back_populates="config")

class UserApiKey(Base):
    __tablename__ = 'user_api_keys'
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    name = Column(String, nullable=False)
    api_key = Column(String, nullable=False, unique=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User")

class Notification(Base):
    __tablename__ = 'notifications'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    category = Column(String, default='info')  # 'success', 'info', 'warning', 'error'
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    link_screen = Column(String, nullable=True)   # e.g. 'lifecycle', 'detail'
    link_app_id = Column(Integer, nullable=True)   # Application ID to navigate to
    link_anchor = Column(String, nullable=True)    # Sub-stage/section to scroll to (e.g. 'company')
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")

# Import remaining sqlalchemy types
from sqlalchemy import ForeignKey
from sqlalchemy.orm import relationship

import time
from sqlalchemy.exc import OperationalError
from typing import Optional

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

    def create_user(self, username: str, hashed_password: str, is_admin: int = 0,
                    first_name: str = None, last_name: str = None, email: str = None) -> int:
        session = self.Session()
        try:
            user = User(
                username=username, hashed_password=hashed_password,
                is_admin=is_admin, first_name=first_name,
                last_name=last_name, email=email
            )
            session.add(user)
            session.commit()
            
            # If this is the first admin, assign all orphaned records to them
            if is_admin:
                session.execute(text("UPDATE applications SET user_id = :uid WHERE user_id IS NULL"), {"uid": user.id})
                session.execute(text("UPDATE user_profile SET user_id = :uid WHERE user_id IS NULL"), {"uid": user.id})
                session.commit()
            
            return user.id
        except Exception as e:
            session.rollback()
            raise e
        finally:
            session.close()

    def vacuum(self):
        session = self.Session()
        try:
            session.execute(text("VACUUM"))
            session.commit()
        finally:
            session.close()

    def reset_database(self):
        session = self.Session()
        try:
            from sqlalchemy import text
            for table in reversed(Base.metadata.sorted_tables):
                session.execute(table.delete())
            session.commit()
        finally:
            session.close()

    def get_user_by_username(self, username: str) -> Optional[Dict[str, Any]]:
        session = self.Session()
        try:
            user = session.query(User).filter(User.username == username).first()
            if not user: return None
            return {
                "id": user.id,
                "username": user.username,
                "hashed_password": user.hashed_password,
                "is_admin": user.is_admin
            }
        finally:
            session.close()

    def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        session = self.Session()
        try:
            user = session.query(User).filter(User.email == email).first()
            if not user: return None
            return {
                "id": user.id,
                "username": user.username,
                "hashed_password": user.hashed_password,
                "is_admin": user.is_admin,
                "email": user.email
            }
        finally:
            session.close()

    def get_user_by_id(self, user_id: int) -> Optional[Dict[str, Any]]:
        session = self.Session()
        try:
            user = session.query(User).filter(User.id == user_id).first()
            if not user: return None
            return {
                "id": user.id,
                "username": user.username,
                "is_admin": user.is_admin,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "email": user.email,
                "photo_url": user.photo_url,
                "photo_zoom": user.photo_zoom,
                "photo_x": user.photo_x,
                "photo_y": user.photo_y,
            }
        finally:
            session.close()

    def get_user_by_api_key(self, api_key: str) -> Optional[Dict[str, Any]]:
        """Find a user by API key — checks named keys table first, then legacy column."""
        session = self.Session()
        try:
            # Check new named keys table
            record = session.query(UserApiKey).filter(UserApiKey.api_key == api_key).first()
            if record:
                user = session.query(User).filter(User.id == record.user_id).first()
                if user:
                    return {"id": user.id, "username": user.username, "is_admin": user.is_admin}
            # Fallback: legacy users.api_key column
            user = session.query(User).filter(User.api_key == api_key).first()
            if user:
                return {"id": user.id, "username": user.username, "is_admin": user.is_admin}
            return None
        finally:
            session.close()

    def create_named_api_key(self, user_id: int, name: str) -> Dict[str, Any]:
        """Create a new named API key for a user. Returns the full key value once."""
        import secrets
        new_key = f"ja_{secrets.token_urlsafe(32)}"
        session = self.Session()
        try:
            record = UserApiKey(user_id=user_id, name=name, api_key=new_key)
            session.add(record)
            session.commit()
            return {
                "id": record.id,
                "name": name,
                "api_key": new_key,  # Full value — only returned here
                "created_at": record.created_at.isoformat() if record.created_at else None
            }
        except Exception as e:
            session.rollback()
            raise e
        finally:
            session.close()

    def list_named_api_keys(self, user_id: int) -> List[Dict[str, Any]]:
        """List all named API keys for a user (key value obscured)."""
        session = self.Session()
        try:
            records = session.query(UserApiKey).filter(UserApiKey.user_id == user_id).order_by(UserApiKey.created_at.desc()).all()
            return [{
                "id": r.id,
                "name": r.name,
                "api_key_preview": r.api_key[:8] + "••••••••••••••••",
                "api_key": r.api_key,  # Full value for reveal/copy
                "created_at": r.created_at.isoformat() if r.created_at else None
            } for r in records]
        finally:
            session.close()

    def delete_named_api_key(self, key_id: int, user_id: int) -> bool:
        """Delete a named API key. Verifies ownership."""
        session = self.Session()
        try:
            record = session.query(UserApiKey).filter(
                UserApiKey.id == key_id,
                UserApiKey.user_id == user_id
            ).first()
            if not record:
                return False
            session.delete(record)
            session.commit()
            return True
        finally:
            session.close()

    def generate_api_key(self, user_id: int) -> str:
        """Legacy: Generate/rotate the single API key on the users table."""
        import secrets
        new_key = f"ja_{secrets.token_urlsafe(32)}"
        session = self.Session()
        try:
            user = session.query(User).filter(User.id == user_id).first()
            if user:
                user.api_key = new_key
                session.commit()
                return new_key
            return ""
        finally:
            session.close()

    def list_users(self) -> List[Dict[str, Any]]:
        """Admin: List all users."""
        session = self.Session()
        try:
            users = session.query(User).all()
            return [{
                "id": u.id,
                "username": u.username,
                "is_admin": u.is_admin,
                "first_name": u.first_name,
                "last_name": u.last_name,
                "email": u.email,
                "created_at": u.created_at.isoformat() if u.created_at else None,
                "has_api_key": u.api_key is not None
            } for u in users]
        finally:
            session.close()

    def delete_user(self, user_id: int) -> bool:
        """Admin: Delete a user and their data."""
        session = self.Session()
        try:
            user = session.query(User).filter(User.id == user_id).first()
            if not user: return False
            
            # Cascades should handle most, but let's be safe
            session.delete(user)
            session.commit()
            return True
        finally:
            session.close()

    def update_user_role(self, user_id: int, is_admin: bool) -> bool:
        """Admin: Update user role."""
        session = self.Session()
        try:
            user = session.query(User).filter(User.id == user_id).first()
            if not user: return False
            user.is_admin = 1 if is_admin else 0
            session.commit()
            return True
        finally:
            session.close()

    def admin_update_user(self, user_id: int, data: Dict[str, Any]) -> bool:
        """Admin: Update user details (name, email, password, role)."""
        session = self.Session()
        try:
            user = session.query(User).filter(User.id == user_id).first()
            if not user: return False
            if 'first_name' in data: user.first_name = data['first_name']
            if 'last_name'  in data: user.last_name  = data['last_name']
            if 'email'      in data: user.email       = data['email']
            if 'is_admin'   in data: user.is_admin    = 1 if data['is_admin'] else 0
            if data.get('password'):
                from services.auth_service import AuthService
                user.hashed_password = AuthService.get_password_hash(data['password'])
            session.commit()
            return True
        except Exception as e:
            session.rollback()
            raise e
        finally:
            session.close()

    def update_account(self, user_id: int, data: Dict[str, Any]) -> bool:
        """Self-service: user updates their own name, email, or password."""
        session = self.Session()
        try:
            user = session.query(User).filter(User.id == user_id).first()
            if not user: return False
            if 'first_name' in data: user.first_name = data['first_name']
            if 'last_name'  in data: user.last_name  = data['last_name']
            if 'email'      in data: user.email       = data['email']
            if 'photo_url'  in data: user.photo_url   = data['photo_url']
            if 'photo_zoom' in data: user.photo_zoom  = data['photo_zoom']
            if 'photo_x'    in data: user.photo_x     = data['photo_x']
            if 'photo_y'    in data: user.photo_y     = data['photo_y']
            if data.get('password'):
                from services.auth_service import AuthService
                user.hashed_password = AuthService.get_password_hash(data['password'])
            session.commit()
            return True
        except Exception as e:
            session.rollback()
            raise e
        finally:
            session.close()

    def has_admin(self) -> bool:
        session = self.Session()
        try:
            return session.query(User).filter(User.is_admin == 1).first() is not None
        finally:
            session.close()

    def _migrate_schema(self):
        """Add any new columns to existing tables that weren't there when the table was first created."""
        migrations = [
            "ALTER TABLE applications ADD COLUMN user_id INTEGER",
            "ALTER TABLE user_profile ADD COLUMN user_id INTEGER",
            "ALTER TABLE linkedin_connections ADD COLUMN user_id INTEGER",
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY,
                username TEXT UNIQUE,
                hashed_password TEXT,
                is_admin INTEGER DEFAULT 0,
                api_key TEXT UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS configs (
                id INTEGER PRIMARY KEY,
                user_id INTEGER UNIQUE,
                settings TEXT,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
            """,
            "ALTER TABLE users ADD COLUMN api_key TEXT",
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_api_key ON users(api_key)",
            "ALTER TABLE applications ADD COLUMN deadline TEXT",
            "ALTER TABLE applications ADD COLUMN apply_url TEXT",
            "ALTER TABLE applications ADD COLUMN company_logo TEXT",
            "ALTER TABLE applications ADD COLUMN job_type TEXT",
            "ALTER TABLE applications ADD COLUMN location_type TEXT",
            "ALTER TABLE applications ADD COLUMN location TEXT",
            "ALTER TABLE applications ADD COLUMN relocation TEXT",
            "ALTER TABLE applications ADD COLUMN interest_level TEXT",
            "ALTER TABLE applications ADD COLUMN remarks TEXT",
            "ALTER TABLE applications ADD COLUMN is_archived TEXT DEFAULT 'false'",
            "ALTER TABLE applications ADD COLUMN kanban_order INTEGER DEFAULT 0",
            "ALTER TABLE applications ADD COLUMN glassdoor_rating TEXT",
            "ALTER TABLE applications ADD COLUMN glassdoor_url TEXT",
            "ALTER TABLE applications ADD COLUMN indeed_rating TEXT",
            "ALTER TABLE applications ADD COLUMN indeed_url TEXT",
            "ALTER TABLE applications ADD COLUMN linkedin_rating TEXT",
            "ALTER TABLE applications ADD COLUMN linkedin_url TEXT",
            "ALTER TABLE applications ADD COLUMN diff_data TEXT",
            "ALTER TABLE applications ADD COLUMN source TEXT",
            "ALTER TABLE applications ADD COLUMN resume_changes_summary TEXT",
            "ALTER TABLE user_profile ADD COLUMN base_resume_path TEXT",
            "ALTER TABLE user_profile ADD COLUMN long_form_resume_path TEXT",
            "ALTER TABLE user_profile ADD COLUMN example_cover_letter_path TEXT",
            "ALTER TABLE user_profile ADD COLUMN additional_docs TEXT",
            "ALTER TABLE user_profile ADD COLUMN social_links TEXT",
            "ALTER TABLE user_profile ADD COLUMN preferences TEXT",
            "ALTER TABLE applications ADD COLUMN profile_snapshot TEXT",
            "ALTER TABLE applications ADD COLUMN override_resume_path TEXT",
            "ALTER TABLE applications ADD COLUMN override_cover_letter_path TEXT",
            "ALTER TABLE applications ADD COLUMN active_resume_type TEXT DEFAULT 'generated'",
            "ALTER TABLE applications ADD COLUMN active_cover_letter_type TEXT DEFAULT 'generated'",
            "ALTER TABLE applications ADD COLUMN pipeline_stage TEXT DEFAULT 'saved'",
            "ALTER TABLE applications ADD COLUMN commute_time_mins INTEGER",
            "ALTER TABLE applications ADD COLUMN commute_distance_miles REAL",
            "ALTER TABLE applications ADD COLUMN commute_details TEXT",
            "ALTER TABLE application_contacts ADD COLUMN linkedin_url TEXT",
            "ALTER TABLE application_contacts ADD COLUMN headline TEXT",
            "ALTER TABLE application_contacts ADD COLUMN company TEXT",
            "ALTER TABLE application_contacts ADD COLUMN how_we_know TEXT",
            "ALTER TABLE application_contacts ADD COLUMN photo_url TEXT",
            "ALTER TABLE applications ADD COLUMN match_score INTEGER",
            "ALTER TABLE applications ADD COLUMN outreach_script TEXT",
            "ALTER TABLE applications ADD COLUMN match_details TEXT",
            "ALTER TABLE applications ADD COLUMN substage_progress TEXT",
            "ALTER TABLE applications ADD COLUMN cover_letter_changes_summary TEXT",
            "ALTER TABLE applications ADD COLUMN job_summary TEXT",
            "ALTER TABLE applications ADD COLUMN core_purpose TEXT",
            "ALTER TABLE applications ADD COLUMN function_dept TEXT",
            "ALTER TABLE applications ADD COLUMN reporting_line TEXT",
            "ALTER TABLE applications ADD COLUMN team_context TEXT",
            "ALTER TABLE applications ADD COLUMN parsed_requirements TEXT",
            "ALTER TABLE applications ADD COLUMN parsed_preferences TEXT",
            "ALTER TABLE applications ADD COLUMN parsed_skills TEXT",
            "ALTER TABLE applications ADD COLUMN bonus_equity TEXT",
            "ALTER TABLE applications ADD COLUMN travel_requirements TEXT",
            "ALTER TABLE application_sub_steps ADD COLUMN phase TEXT DEFAULT 'saved'",
            "ALTER TABLE users ADD COLUMN first_name TEXT",
            "ALTER TABLE users ADD COLUMN last_name TEXT",
            "ALTER TABLE users ADD COLUMN email TEXT",
            "ALTER TABLE applications ADD COLUMN additional_docs TEXT",
            "ALTER TABLE applications ADD COLUMN excluded_profile_docs TEXT",
            "ALTER TABLE applications ADD COLUMN company_research TEXT",
            "ALTER TABLE applications ADD COLUMN company_url TEXT",
            "ALTER TABLE applications ADD COLUMN prioritization_ranking TEXT",
            # Ensure tables are created if not already (Base.metadata.create_all handles this mostly, but explicit for clarity in migrations)
            """
            CREATE TABLE IF NOT EXISTS application_sub_steps (
                id INTEGER PRIMARY KEY,
                application_id INTEGER,
                title TEXT,
                description TEXT,
                status TEXT,
                date TEXT,
                phase TEXT DEFAULT 'saved',
                FOREIGN KEY(application_id) REFERENCES applications(id)
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS application_contacts (
                id INTEGER PRIMARY KEY,
                application_id INTEGER,
                name TEXT,
                role TEXT,
                email TEXT,
                phone TEXT,
                FOREIGN KEY(application_id) REFERENCES applications(id)
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS application_events (
                id INTEGER PRIMARY KEY,
                application_id INTEGER,
                event_type TEXT,
                description TEXT,
                timestamp TEXT,
                FOREIGN KEY(application_id) REFERENCES applications(id)
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS linkedin_connections (
                id INTEGER PRIMARY KEY,
                user_id INTEGER,
                name TEXT,
                headline TEXT,
                profile_url TEXT,
                company_id TEXT,
                company_name TEXT,
                degree TEXT,
                is_alumni BOOLEAN DEFAULT FALSE,
                last_synced TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """,
            "ALTER TABLE linkedin_connections ADD COLUMN degree TEXT",
            "ALTER TABLE linkedin_connections ADD COLUMN is_alumni BOOLEAN DEFAULT FALSE",
            "ALTER TABLE linkedin_connections ADD COLUMN photo_url TEXT",
            """
            CREATE TABLE IF NOT EXISTS user_api_keys (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                api_key TEXT NOT NULL UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS notifications (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                category TEXT DEFAULT 'info',
                title TEXT NOT NULL,
                message TEXT NOT NULL,
                link_screen TEXT,
                link_app_id INTEGER,
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """,
            "ALTER TABLE notifications ADD COLUMN link_anchor TEXT",

            # ── Applied stage (added 2026-05-21) ──────────────────────────
            "ALTER TABLE applications ADD COLUMN applied_substage TEXT",
            "ALTER TABLE applications ADD COLUMN submission_record_json TEXT",
            "ALTER TABLE applications ADD COLUMN submission_snapshot_json TEXT",
            "ALTER TABLE applications ADD COLUMN confirmation_record_json TEXT",
            "ALTER TABLE applications ADD COLUMN follow_up_plan_json TEXT",
            "ALTER TABLE applications ADD COLUMN sla_tracker_json TEXT",

            "ALTER TABLE application_events ADD COLUMN actor TEXT",
            "ALTER TABLE application_events ADD COLUMN title TEXT",
            "ALTER TABLE application_events ADD COLUMN metadata_json TEXT",
            "ALTER TABLE application_events ADD COLUMN related_asset_id INTEGER",
            "ALTER TABLE application_events ADD COLUMN substage TEXT",

            # Per decision D1: keep existing `role` column; expose as `title` via Pydantic alias in T2.
            "ALTER TABLE application_contacts ADD COLUMN is_hiring_manager INTEGER DEFAULT 0",
            "ALTER TABLE application_contacts ADD COLUMN source TEXT",

            """
            CREATE TABLE IF NOT EXISTS applied_assets (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              application_id INTEGER NOT NULL,
              asset_type TEXT NOT NULL,
              file_path TEXT NOT NULL,
              mime_type TEXT NOT NULL,
              original_filename TEXT NOT NULL,
              file_hash TEXT NOT NULL,
              uploaded_at TEXT NOT NULL,
              created_by_user_id INTEGER,
              FOREIGN KEY(application_id) REFERENCES applications(id)
            )
            """,
            "CREATE INDEX IF NOT EXISTS idx_applied_assets_app ON applied_assets(application_id)",
            "ALTER TABLE users ADD COLUMN photo_url TEXT",
            "ALTER TABLE users ADD COLUMN photo_zoom REAL DEFAULT 1.0",
            "ALTER TABLE users ADD COLUMN photo_x REAL DEFAULT 0.0",
            "ALTER TABLE users ADD COLUMN photo_y REAL DEFAULT 0.0",
        ]
        with self.engine.connect() as conn:
            for sql in migrations:
                try:
                    with conn.begin():
                        conn.execute(text(sql))
                    print(f"Migration successful: {sql[:100]}...")
                except Exception as e:
                    print(f"Migration skipped or failed: {e}")
        
    def _get_stage_from_status(self, status: str) -> str:
        """Helper to map legacy status strings to pipeline stages."""
        if not status: return 'saved'
        s = status.lower()
        if s == 'saved': return 'saved'
        if s in ['generated', 'ready', 'ready to apply']: return 'generated'
        if s in ['applied', 'submitted']: return 'applied'
        if s in ['interviewing', 'interview']: return 'interviewing'
        if s in ['decision', 'offer']: return 'decision'
        if s == 'accepted': return 'accepted'
        if s in ['rejected', 'declined', 'archived']: return s
        return 'saved'

    def _is_valid_progression(self, current_stage: str, next_stage: str) -> bool:
        """
        Check if the move from current_stage to next_stage is a forward progression.
        Returns True if forward or neutral, False if backward.
        """
        STAGES = ['saved', 'generated', 'applied', 'interviewing', 'decision', 'accepted']
        
        # If either is an end-state or unknown, we allow it (manual or terminal move)
        if current_stage not in STAGES or next_stage not in STAGES:
            return True
            
        return STAGES.index(next_stage) >= STAGES.index(current_stage)

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
        
    def save_application(self, data: Dict[str, Any], user_id: int = None, force: bool = False) -> int:
        session = self.Session()
        try:
            app_id = data.get('application_id')
            if app_id:
                app = session.query(Application).filter(Application.id == app_id).first()
                if app:
                    # Check for status change
                    if data.get('status') and data.get('status') != app.status:
                        self._log_event(app.id, 'stage_change', f"Status updated to {data['status']}", session=session)
                    elif data.get('pipeline_stage') and data.get('pipeline_stage') != app.pipeline_stage:
                        self._log_event(app.id, 'stage_change', f"Pipeline stage updated to {data['pipeline_stage']}", session=session)

                    if user_id: app.user_id = user_id
                    
                    # Track if we should update status/stage based on progression rules
                    new_status = data.get('status')
                    new_stage = data.get('pipeline_stage') or (self._get_stage_from_status(new_status) if new_status else None)
                    
                    should_update_stage = True
                    if new_stage and not force:
                        if not self._is_valid_progression(app.pipeline_stage or 'saved', new_stage):
                            print(f"DEBUG: Blocking backward stage progression from {app.pipeline_stage} to {new_stage}")
                            should_update_stage = False

                    if new_status and (should_update_stage or force):
                        app.status = new_status
                    
                    if new_stage and (should_update_stage or force):
                        app.pipeline_stage = new_stage

                    app.job_title = data.get('job_title', app.job_title)
                    app.company = data.get('company', app.company)
                    if data.get('company_logo'): app.company_logo = data.get('company_logo')
                    if data.get('job_url'): app.job_url = data.get('job_url')
                    if data.get('job_description'): app.job_description = data.get('job_description')
                    if data.get('original_resume_path'): app.original_resume_path = data.get('original_resume_path')
                    if data.get('tailored_resume_path'): app.tailored_resume_path = data.get('tailored_resume_path')
                    if data.get('cover_letter_path'): app.cover_letter_path = data.get('cover_letter_path')
                    if data.get('resume_data'): app.resume_data = json.dumps(data.get('resume_data'))
                    if data.get('diff_data'): app.diff_data = json.dumps(data.get('diff_data'))
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
                    if data.get('source'): app.source = data.get('source')
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
                    # Stage update handled above with progression logic
                    if 'match_score' in data: app.match_score = data['match_score']
                    if 'match_details' in data: 
                        app.match_details = json.dumps(data['match_details']) if isinstance(data['match_details'], (dict, list)) else data['match_details']
                    if 'substage_progress' in data: 
                        app.substage_progress = json.dumps(data['substage_progress']) if isinstance(data['substage_progress'], (dict, list)) else data['substage_progress']
                    if 'additional_docs' in data:
                        app.additional_docs = json.dumps(data['additional_docs']) if isinstance(data['additional_docs'], (dict, list)) else data['additional_docs']
                    if 'excluded_profile_docs' in data:
                        app.excluded_profile_docs = json.dumps(data['excluded_profile_docs']) if isinstance(data['excluded_profile_docs'], (dict, list)) else data['excluded_profile_docs']
                    
                    # Update company ratings
                    if data.get('glassdoor_rating') is not None: app.glassdoor_rating = data.get('glassdoor_rating')
                    if data.get('glassdoor_url') is not None: app.glassdoor_url = data.get('glassdoor_url')
                    if data.get('indeed_rating') is not None: app.indeed_rating = data.get('indeed_rating')
                    if data.get('indeed_url') is not None: app.indeed_url = data.get('indeed_url')
                    if data.get('linkedin_rating') is not None: app.linkedin_rating = data.get('linkedin_rating')
                    if data.get('linkedin_url') is not None: app.linkedin_url = data.get('linkedin_url')
                    if data.get('company_url') is not None: app.company_url = data.get('company_url')
                    if data.get('company_research'): app.company_research = json.dumps(data.get('company_research'))
                    if data.get('prioritization_ranking'): app.prioritization_ranking = json.dumps(data.get('prioritization_ranking'))
                    
                    session.commit()
                    return app.id

            new_app = Application(
                user_id=user_id,
                job_title=data.get('job_title', 'Unknown Role'),
                company=data.get('company', 'Unknown Company'),
                company_logo=data.get('company_logo', ''),
                job_url=data.get('job_url', ''),
                job_description=data.get('job_description', ''),
                date_saved=datetime.now().isoformat(),
                original_resume_path=data.get('original_resume_path', ''),
                # If 'files' object is provided (common from frontend result), use it
                # We store just the basename in the database for consistency
                tailored_resume_path=(data.get('tailored_resume_path') or (data.get('files', {}).get('docx') if data.get('files') else '')).split('/')[-1],
                cover_letter_path=(data.get('cover_letter_path') or (data.get('files', {}).get('cl_docx') if data.get('files') else '')).split('/')[-1],
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
                match_score=data.get('match_score'),
                match_details=json.dumps(data.get('match_details')) if isinstance(data.get('match_details'), (dict, list)) else data.get('match_details'),
                glassdoor_rating=data.get('glassdoor_rating'),
                glassdoor_url=data.get('glassdoor_url'),
                indeed_rating=data.get('indeed_rating'),
                indeed_url=data.get('indeed_url'),
                linkedin_rating=data.get('linkedin_rating'),
                linkedin_url=data.get('linkedin_url'),
                company_url=data.get('company_url', ''),
                profile_snapshot=json.dumps(data.get('profile_snapshot')) if data.get('profile_snapshot') else None,
                override_resume_path=data.get('override_resume_path'),
                override_cover_letter_path=data.get('override_cover_letter_path'),
                active_resume_type=data.get('active_resume_type', 'generated'),
                active_cover_letter_type=data.get('active_cover_letter_type', 'generated'),
                pipeline_stage=data.get('pipeline_stage') or self._get_stage_from_status(data.get('status', 'Saved')),
                diff_data=json.dumps(data.get('diff_data')) if data.get('diff_data') else None,
                commute_time_mins=data.get('commute_time_mins'),
                commute_distance_miles=data.get('commute_distance_miles'),
                commute_details=json.dumps(data.get('commute_details')) if data.get('commute_details') else None,
                substage_progress=json.dumps(data.get('substage_progress')) if data.get('substage_progress') else None,
                additional_docs=json.dumps(data.get('additional_docs')) if isinstance(data.get('additional_docs'), (dict, list)) else data.get('additional_docs'),
                excluded_profile_docs=json.dumps(data.get('excluded_profile_docs')) if isinstance(data.get('excluded_profile_docs'), (dict, list)) else data.get('excluded_profile_docs'),
                source=data.get('source'),
                outreach_script=data.get('outreach_script'),
                company_research=json.dumps(data.get('company_research')) if data.get('company_research') else None,
                prioritization_ranking=json.dumps(data.get('prioritization_ranking')) if data.get('prioritization_ranking') else None
            )

            session.add(new_app)
            session.flush() # Get the new ID
            self._log_event(new_app.id, 'stage_change', f"Application {new_app.status}", session=session)
            session.commit()
            return new_app.id
        finally:
            session.close()

    def update_application_status(self, app_id: int, new_status: str, user_id: int = None, force: bool = False) -> bool:
        session = self.Session()
        try:
            query = session.query(Application).filter(Application.id == app_id)
            if user_id:
                query = query.filter(Application.user_id == user_id)
            app = query.first()
            if app:
                new_stage = self._get_stage_from_status(new_status)
                
                if not force:
                    if not self._is_valid_progression(app.pipeline_stage or 'saved', new_stage):
                        print(f"DEBUG: Blocking backward stage progression from {app.pipeline_stage} to {new_stage} in update_application_status")
                        return False

                if app.status != new_status:
                    self._log_event(app.id, 'stage_change', f"Status updated to {new_status}", session=session)
                app.status = new_status
                # Sync pipeline stage
                app.pipeline_stage = new_stage
                session.commit()
                return True
            return False
        finally:
            session.close()

    def update_application_logo(self, app_id: int, company_logo: str, user_id: int = None) -> bool:
        session = self.Session()
        try:
            query = session.query(Application).filter(Application.id == app_id)
            if user_id:
                query = query.filter(Application.user_id == user_id)
            app = query.first()
            if app:
                app.company_logo = company_logo
                session.commit()
                return True
            return False
        finally:
            session.close()
        
    def add_application_contact(self, application_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
        """Add a manual contact to an application."""
        session = self.Session()
        try:
            contact = ApplicationContact(
                application_id=application_id,
                name=data.get('name'),
                role=data.get('role'),
                email=data.get('email'),
                phone=data.get('phone'),
                linkedin_url=data.get('linkedin_url'),
                headline=data.get('headline'),
                company=data.get('company'),
                how_we_know=data.get('how_we_know'),
                photo_url=data.get('photo_url')
            )
            session.add(contact)
            session.commit()
            return {
                "id": contact.id,
                "name": contact.name,
                "role": contact.role,
                "email": contact.email,
                "phone": contact.phone,
                "linkedin_url": contact.linkedin_url,
                "headline": contact.headline,
                "company": contact.company,
                "how_we_know": contact.how_we_know,
                "photo_url": contact.photo_url
            }
        except Exception as e:
            session.rollback()
            print(f"Error adding contact: {e}")
            raise e
        finally:
            session.close()

    def update_application_contact(self, contact_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
        """Update an existing contact."""
        session = self.Session()
        try:
            contact = session.query(ApplicationContact).filter(ApplicationContact.id == contact_id).first()
            if not contact:
                return None
            
            if 'name' in data: contact.name = data['name']
            if 'role' in data: contact.role = data['role']
            if 'email' in data: contact.email = data['email']
            if 'phone' in data: contact.phone = data['phone']
            if 'linkedin_url' in data: contact.linkedin_url = data['linkedin_url']
            if 'headline' in data: contact.headline = data['headline']
            if 'company' in data: contact.company = data['company']
            if 'how_we_know' in data: contact.how_we_know = data['how_we_know']
            if 'photo_url' in data: contact.photo_url = data['photo_url']
            
            session.commit()
            return {
                "id": contact.id,
                "name": contact.name,
                "role": contact.role,
                "email": contact.email,
                "phone": contact.phone,
                "linkedin_url": contact.linkedin_url,
                "headline": contact.headline,
                "company": contact.company,
                "how_we_know": contact.how_we_know,
                "photo_url": contact.photo_url
            }
        except Exception as e:
            session.rollback()
            print(f"Error updating contact: {e}")
            raise e
        finally:
            session.close()

    def get_photo_by_linkedin_url(self, linkedin_url: str) -> str:
        """Find the photo URL for a given LinkedIn profile URL across all contacts."""
        session = self.Session()
        try:
            # Canonicalize URL (remove trailing slash and query params)
            base_url = linkedin_url.split('?')[0].rstrip('/')
            
            # Find any contact with this URL that has a photo
            contact = session.query(ApplicationContact).filter(
                ApplicationContact.linkedin_url.like(f"{base_url}%"),
                ApplicationContact.photo_url.isnot(None),
                ApplicationContact.photo_url != ""
            ).first()
            
            return contact.photo_url if contact else None
        except Exception as e:
            print(f"Error fetching photo by URL: {e}")
            return None
        finally:
            session.close()

    def update_contact_photo_by_url(self, application_id: int, linkedin_url: str, photo_url: str) -> bool:
        """Update a contact's photo by matching their LinkedIn URL within a specific application."""
        session = self.Session()
        try:
            base_url = linkedin_url.split('?')[0].rstrip('/')
            contact = session.query(ApplicationContact).filter(
                ApplicationContact.application_id == application_id,
                ApplicationContact.linkedin_url.like(f"{base_url}%"),
                (ApplicationContact.photo_url.is_(None) | (ApplicationContact.photo_url == ""))
            ).first()
            
            if contact:
                contact.photo_url = photo_url
                session.commit()
                return True
            return False
        except Exception as e:
            session.rollback()
            print(f"Error updating contact photo by URL: {e}")
            return False
        finally:
            session.close()

    def delete_application_contact(self, contact_id: int) -> bool:
        """Delete an existing contact."""
        session = self.Session()
        try:
            contact = session.query(ApplicationContact).filter(ApplicationContact.id == contact_id).first()
            if not contact:
                return False
            session.delete(contact)
            session.commit()
            return True
        except Exception as e:
            session.rollback()
            print(f"Error deleting contact: {e}")
            raise e
        finally:
            session.close()

    def get_applications(self, user_id: int = None) -> List[Dict[str, Any]]:
        session = self.Session()
        try:
            query = session.query(Application)
            if user_id:
                # If this is the only user or an admin, try to adopt orphaned apps
                is_admin = False
                user = session.query(User).filter(User.id == user_id).first()
                if user and user.is_admin:
                    is_admin = True
                
                # Check for orphaned apps (user_id IS NULL)
                orphans = session.query(Application).filter(Application.user_id == None).all()
                if orphans and (is_admin or session.query(User).count() == 1):
                    for orphan in orphans:
                        orphan.user_id = user_id
                    session.commit()
                
                query = query.filter(Application.user_id == user_id)
            
            apps = query.order_by(Application.date_saved.desc()).all()
            return [self._app_to_dict(app) for app in apps]
        finally:
            session.close()

    def get_config(self, user_id: int = None) -> Dict[str, Any]:
        """Fetch configuration for a specific user, falling back to global config if needed."""
        # Always start with global config as base
        config = self._load_global_config()
        
        if user_id is None:
            return config
            
        session = self.Session()
        try:
            user_record = session.query(Config).filter(Config.user_id == user_id).first()
            if user_record:
                user_settings = json.loads(user_record.settings)
                # Merge user settings into global config
                # We use a shallow merge for top-level keys
                config.update(user_settings)
            
            return config
        finally:
            session.close()

    def save_config(self, settings: Dict[str, Any], user_id: int = None):
        """Save configuration for a user or global config."""
        session = self.Session()
        try:
            config_record = session.query(Config).filter(Config.user_id == user_id).first()
            if config_record:
                config_record.settings = json.dumps(settings)
            else:
                config_record = Config(user_id=user_id, settings=json.dumps(settings))
                session.add(config_record)
            session.commit()
        except Exception as e:
            session.rollback()
            raise e
        finally:
            session.close()

    def _load_global_config(self) -> Dict[str, Any]:
        """Helper to load global config from DB with fallback to legacy config.json."""
        # Try database first (user_id is NULL)
        session = self.Session()
        try:
            # Explicitly import Config to avoid any scoping issues if needed, 
            # though it should be available in the class scope
            record = session.query(Config).filter(Config.user_id == None).first()
            if record:
                return json.loads(record.settings)
        finally:
            session.close()

        # Fallback to file
        config_path = "config.json"
        if os.path.exists(config_path):
            try:
                with open(config_path, 'r') as f:
                    return json.load(f)
            except:
                pass
        return {}

    def normalize_url(self, url: str) -> str:
        if not url: return ""
        url = url.strip().rstrip('/')
        
        # Special handling for LinkedIn job URLs
        if 'linkedin.com' in url:
            # If it has a currentJobId param, that is the truth
            if 'currentJobId=' in url:
                import re
                match = re.search(r'currentJobId=(\d+)', url)
                if match:
                    return f"linkedin_job_{match.group(1)}"
            
            # If it is a direct /jobs/view/ID URL
            if '/jobs/view/' in url:
                import re
                match = re.search(r'/jobs/view/(\d+)', url)
                if match:
                    return f"linkedin_job_{match.group(1)}"
        
        return url

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
            "relocation": True if app.relocation == 'true' else (False if app.relocation == 'false' else None),
            "interest_level": app.interest_level,
            "remarks": app.remarks,
            "original_resume_path": app.original_resume_path,
            "tailored_resume_path": app.tailored_resume_path,
            "cover_letter_path": app.cover_letter_path,
            "files": {
                "docx": f"/api/download/{app.tailored_resume_path}" if app.tailored_resume_path else "",
                "pdf": f"/api/download/{app.tailored_resume_path.replace('.docx', '.pdf')}" if app.tailored_resume_path and app.tailored_resume_path.endswith('.docx') else "",
                "cl_docx": f"/api/download/{app.cover_letter_path}" if app.cover_letter_path else "",
                "cl_pdf": f"/api/download/{app.cover_letter_path.replace('.docx', '.pdf')}" if app.cover_letter_path and app.cover_letter_path.endswith('.docx') else ""
            },
            "cover_letter_text": app.cover_letter_text,
            "resume_data": json.loads(app.resume_data) if app.resume_data else {},
            "diff_data": json.loads(app.diff_data) if app.diff_data else {},
            "resume_changes_summary": json.loads(app.resume_changes_summary) if app.resume_changes_summary else [],
            "cover_letter_changes_summary": json.loads(app.cover_letter_changes_summary) if app.cover_letter_changes_summary else [],
            "match_score": app.match_score,
            "match_details": json.loads(app.match_details) if app.match_details else {},
            "substage_progress": json.loads(app.substage_progress) if app.substage_progress else {},
            "original_filename": app.original_resume_path,
            "is_archived": app.is_archived == 'true',
            "kanban_order": app.kanban_order or 0,
            "profile_snapshot": json.loads(app.profile_snapshot) if app.profile_snapshot else None,
            "override_resume_path": app.override_resume_path,
            "override_cover_letter_path": app.override_cover_letter_path,
            "active_resume_type": app.active_resume_type or 'generated',
            "active_cover_letter_type": app.active_cover_letter_type or 'generated',
            "pipeline_stage": app.pipeline_stage or 'saved',
            "commute_time_mins": app.commute_time_mins,
            "commute_distance_miles": app.commute_distance_miles,
            "commute_details": json.loads(app.commute_details) if app.commute_details else {},
            "source": app.source,
            "outreach_script": app.outreach_script,
            "sub_steps": [{"id": s.id, "title": s.title, "description": s.description, "status": s.status, "date": s.date, "phase": s.phase} for s in app.sub_steps],
            "contacts": [{"id": c.id, "name": c.name, "role": c.role, "email": c.email, "phone": c.phone, "linkedin_url": c.linkedin_url, "headline": c.headline, "company": c.company, "how_we_know": c.how_we_know, "photo_url": c.photo_url} for c in app.contacts],
            "events": [{"id": e.id, "event_type": e.event_type, "description": e.description, "timestamp": e.timestamp} for e in app.events],
            # AI-enriched fields
            "job_summary": app.job_summary,
            "core_purpose": app.core_purpose,
            "function_dept": app.function_dept,
            "reporting_line": app.reporting_line,
            "team_context": app.team_context,
            "parsed_requirements": app.parsed_requirements,
            "parsed_preferences": app.parsed_preferences,
            "parsed_skills": app.parsed_skills,
            "bonus_equity": app.bonus_equity,
            "travel_requirements": app.travel_requirements,
            "glassdoor_rating": app.glassdoor_rating,
            "glassdoor_url": app.glassdoor_url,
            "indeed_rating": app.indeed_rating,
            "indeed_url": app.indeed_url,
            "linkedin_rating": app.linkedin_rating,
            "linkedin_url": app.linkedin_url,
            "company_research": json.loads(app.company_research) if app.company_research else None,
            "prioritization_ranking": json.loads(app.prioritization_ranking) if app.prioritization_ranking else {},
            "company_url": app.company_url,
        }

    def get_application_by_resume_path(self, filename: str) -> Dict[str, Any]:
        """Find an application by its tailored resume filename."""
        if not filename: return None
        session = self.Session()
        try:
            # Check both tailored_resume_path and override_resume_path
            app = session.query(Application).filter(
                (Application.tailored_resume_path == filename) | 
                (Application.override_resume_path == filename)
            ).first()
            if app:
                return self._app_to_dict(app)
            return None
        finally:
            session.close()

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

    def get_application_by_id(self, app_id: int, user_id: int = None) -> Dict[str, Any]:
        """Get a single application by its ID."""
        session = self.Session()
        try:
            query = session.query(Application).filter(Application.id == app_id)
            if user_id:
                query = query.filter(Application.user_id == user_id)
            app = query.first()
            if not app:
                return None
            return self._app_to_dict(app)
        finally:
            session.close()

    def update_application(self, app_id: int, data: Dict[str, Any], user_id: int = None, force: bool = False) -> bool:
        """Update an existing application."""
        session = self.Session()
        try:
            query = session.query(Application).filter(Application.id == app_id)
            if user_id:
                query = query.filter(Application.user_id == user_id)
            app = query.first()
            if not app:
                return False
            
            # Handle status/stage updates with progression rules
            new_status = data.get('status')
            new_stage = data.get('pipeline_stage') or (self._get_stage_from_status(new_status) if new_status else None)
            
            should_update_stage = True
            if new_stage and not force:
                if not self._is_valid_progression(app.pipeline_stage or 'saved', new_stage):
                    print(f"DEBUG: Blocking backward stage progression from {app.pipeline_stage} to {new_stage} in update_application")
                    should_update_stage = False

            if new_status and (should_update_stage or force):
                if new_status != app.status:
                    self._log_event(app.id, 'stage_change', f"Status updated to {new_status}", session=session)
                app.status = new_status
            
            if new_stage and (should_update_stage or force):
                if new_stage != app.pipeline_stage:
                    self._log_event(app.id, 'stage_change', f"Pipeline stage updated to {new_stage}", session=session)
                app.pipeline_stage = new_stage

            if 'job_title' in data: app.job_title = data['job_title']
            if 'company' in data: app.company = data['company']
            if 'company_logo' in data: app.company_logo = data['company_logo']
            if 'job_url' in data: app.job_url = data['job_url']
            if 'apply_url' in data: app.apply_url = data['apply_url']
            if 'company_url' in data: app.company_url = data['company_url']
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
            if 'source' in data: app.source = data['source']
            # Status handled above
            if 'kanban_order' in data: app.kanban_order = data['kanban_order']
            if 'is_archived' in data: 
                app.is_archived = 'true' if (data['is_archived'] is True or data['is_archived'] == 'true') else 'false'
            if 'original_resume_path' in data: app.original_resume_path = data['original_resume_path']
            if 'tailored_resume_path' in data: 
                path = data['tailored_resume_path']
                app.tailored_resume_path = path.split('/')[-1] if path else None
            if 'files' in data and isinstance(data['files'], dict):
                if data['files'].get('docx'): app.tailored_resume_path = data['files']['docx'].split('/')[-1]
                if data['files'].get('cl_docx'): app.cover_letter_path = data['files']['cl_docx'].split('/')[-1]
            
            if 'cover_letter_path' in data: app.cover_letter_path = data['cover_letter_path'].split('/')[-1]
            if 'cover_letter_text' in data: app.cover_letter_text = data['cover_letter_text']
            if 'resume_data' in data: 
                val = data['resume_data']
                app.resume_data = json.dumps(val) if isinstance(val, (dict, list)) else val
            if 'diff_data' in data:
                val = data['diff_data']
                app.diff_data = json.dumps(val) if isinstance(val, (dict, list)) else val
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
            
            if 'match_score' in data: app.match_score = data['match_score']
            if 'match_details' in data:
                val = data['match_details']
                app.match_details = json.dumps(val) if isinstance(val, (dict, list)) else val
            
            if 'commute_time_mins' in data: app.commute_time_mins = data['commute_time_mins']
            if 'commute_distance_miles' in data: app.commute_distance_miles = data['commute_distance_miles']
            if 'commute_details' in data:
                val = data['commute_details']
                app.commute_details = json.dumps(val) if isinstance(val, (dict, list)) else val
            
            if 'glassdoor_rating' in data: app.glassdoor_rating = data['glassdoor_rating']
            if 'glassdoor_url' in data: app.glassdoor_url = data['glassdoor_url']
            if 'indeed_rating' in data: app.indeed_rating = data['indeed_rating']
            if 'indeed_url' in data: app.indeed_url = data['indeed_url']
            if 'linkedin_rating' in data: app.linkedin_rating = data['linkedin_rating']
            if 'linkedin_url' in data: app.linkedin_url = data['linkedin_url']

            # AI-enriched fields
            if 'job_summary' in data: app.job_summary = data['job_summary']
            if 'core_purpose' in data: app.core_purpose = data['core_purpose']
            if 'function_dept' in data: app.function_dept = data['function_dept']
            if 'reporting_line' in data: app.reporting_line = data['reporting_line']
            if 'team_context' in data: app.team_context = data['team_context']
            if 'parsed_requirements' in data: app.parsed_requirements = data['parsed_requirements']
            if 'parsed_preferences' in data: app.parsed_preferences = data['parsed_preferences']
            if 'parsed_skills' in data: app.parsed_skills = data['parsed_skills']
            if 'bonus_equity' in data: app.bonus_equity = data['bonus_equity']
            if 'travel_requirements' in data: app.travel_requirements = data['travel_requirements']
            if 'outreach_script' in data: app.outreach_script = data['outreach_script']
            if 'company_research' in data:
                val = data['company_research']
                app.company_research = json.dumps(val) if isinstance(val, (dict, list)) else val
            if 'prioritization_ranking' in data:
                val = data['prioritization_ranking']
                app.prioritization_ranking = json.dumps(val) if isinstance(val, (dict, list)) else val
            if 'substage_progress' in data:
                val = data['substage_progress']
                app.substage_progress = json.dumps(val) if isinstance(val, (dict, list)) else val

            session.commit()
            return True
        except Exception as e:
            session.rollback()
            raise e
        finally:
            session.close()

    def delete_application(self, app_id: int, user_id: int = None) -> bool:
        """Delete an application."""
        session = self.Session()
        try:
            query = session.query(Application).filter(Application.id == app_id)
            if user_id:
                query = query.filter(Application.user_id == user_id)
            app = query.first()
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

    def archive_application(self, app_id: int, archived: bool, user_id: int = None) -> bool:
        """Set the archived flag on an application."""
        session = self.Session()
        try:
            query = session.query(Application).filter(Application.id == app_id)
            if user_id:
                query = query.filter(Application.user_id == user_id)
            app = query.first()
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

    def get_profile(self, user_id: int = None) -> Dict[str, Any]:
        """Get the user profile."""
        session = self.Session()
        try:
            query = session.query(UserProfile)
            if user_id:
                # Check for orphaned profile first
                is_admin = False
                user = session.query(User).filter(User.id == user_id).first()
                if user and user.is_admin:
                    is_admin = True

                if is_admin or session.query(User).count() == 1:
                    orphaned_profile = session.query(UserProfile).filter(UserProfile.user_id == None).first()
                    if orphaned_profile:
                        # Adopt it
                        orphaned_profile.user_id = user_id
                        session.commit()

                query = query.filter(UserProfile.user_id == user_id)
            profile = query.first()
            if not profile:
                return {}
            
            return {
                "id": profile.id,
                "user_id": profile.user_id,
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
                "recommendations": json.loads(profile.recommendations) if getattr(profile, 'recommendations', None) else [],
                "other": json.loads(profile.other) if profile.other else [],
                "base_resume_path": profile.base_resume_path,
                "long_form_resume_path": profile.long_form_resume_path,
                "example_cover_letter_path": profile.example_cover_letter_path,
                "additional_docs": json.loads(profile.additional_docs) if profile.additional_docs else [],
                "social_links": json.loads(profile.social_links) if getattr(profile, 'social_links', None) else [],
                "preferences": json.loads(profile.preferences) if getattr(profile, 'preferences', None) else {}
            }
        finally:
            session.close()

    def save_profile(self, data: Dict[str, Any], user_id: int = None) -> int:
        """Save or update the user profile."""
        session = self.Session()
        try:
            query = session.query(UserProfile)
            if user_id:
                query = query.filter(UserProfile.user_id == user_id)
            profile = query.first()
            
            if not profile:
                profile = UserProfile(user_id=user_id)
                session.add(profile)
            
            # Update fields
            if user_id: profile.user_id = user_id
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
            profile.recommendations = json.dumps(data.get('recommendations', []))
            profile.other = json.dumps(data.get('other', []))
            if data.get("base_resume_path") is not None:
                profile.base_resume_path = data["base_resume_path"]
            if data.get("long_form_resume_path") is not None:
                profile.long_form_resume_path = data["long_form_resume_path"]
            if data.get("example_cover_letter_path") is not None:
                profile.example_cover_letter_path = data["example_cover_letter_path"]
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

    def save_linkedin_connections(self, connections: List[Dict[str, Any]], user_id: int = None) -> int:
        """Save a batch of LinkedIn connections."""
        session = self.Session()
        try:
            count = 0
            for conn_data in connections:
                # Basic deduplication based on profile_url and user_id
                query = session.query(LinkedInConnection).filter(
                    LinkedInConnection.profile_url == conn_data.get('profile_url')
                )
                if user_id:
                    query = query.filter(LinkedInConnection.user_id == user_id)
                existing = query.first()
                
                if not existing:
                    new_conn = LinkedInConnection(
                        name=conn_data.get('name'),
                        headline=conn_data.get('headline'),
                        profile_url=conn_data.get('profile_url'),
                        company_id=str(conn_data.get('company_id', '')),
                        company_name=conn_data.get('company_name', ''),
                        degree=conn_data.get('degree'),
                        is_alumni=conn_data.get('is_alumni', False),
                        photo_url=conn_data.get('photo_url'),
                        last_synced=datetime.utcnow(),
                        user_id=user_id
                    )
                    session.add(new_conn)
                    count += 1
                else:
                    # Update existing record — only overwrite fields with non-empty values
                    # to prevent re-syncs from erasing previously-captured data
                    if conn_data.get('name'):
                        existing.name = conn_data['name']
                    if conn_data.get('headline'):
                        existing.headline = conn_data['headline']
                    if conn_data.get('company_id'):
                        existing.company_id = str(conn_data['company_id'])
                    if conn_data.get('company_name'):
                        existing.company_name = conn_data['company_name']
                    if conn_data.get('degree'):
                        existing.degree = conn_data['degree']
                    if 'is_alumni' in conn_data:
                        existing.is_alumni = conn_data['is_alumni']
                    # Critical: only update photo if new value is a real URL
                    new_photo = conn_data.get('photo_url')
                    if new_photo and new_photo.startswith('http'):
                        existing.photo_url = new_photo
                    existing.last_synced = datetime.utcnow()
                    if user_id:
                        existing.user_id = user_id
            
            session.commit()
            return count
        finally:
            session.close()

    def get_linkedin_connections_by_company(self, company_id: str, user_id: int = None) -> List[Dict[str, Any]]:
        """Get connections matching a specific company ID."""
        session = self.Session()
        try:
            query = session.query(LinkedInConnection).filter(
                LinkedInConnection.company_id == str(company_id)
            )
            if user_id:
                query = query.filter(LinkedInConnection.user_id == user_id)
            
            conns = query.all()
            return [
                {
                    "name": c.name,
                    "headline": c.headline,
                    "profile_url": c.profile_url,
                    "company_name": c.company_name,
                    "photo_url": c.photo_url
                } for c in conns
            ]
        finally:
            session.close()

    def _normalize_company_name(self, name: str) -> str:
        """Helper to strip common suffixes and punctuation from company names for better matching."""
        if not name: return ""
        import re
        # Convert to lowercase
        n = name.lower().strip()
        # Remove punctuation
        n = re.sub(r'[.,!?:;]', '', n)
        # Remove common suffixes
        suffixes = [
            r'\binc\b', r'\bllc\b', r'\bcorp\b', r'\bcorporation\b', 
            r'\bco\b', r'\bcompany\b', r'\blimited\b', r'\bltd\b',
            r'\bgroup\b', r'\bplc\b', r'\bservices\b'
        ]
        for s in suffixes:
            n = re.sub(s, '', n)
        # Clean up double spaces and return
        return ' '.join(n.split()).strip()

    def get_linkedin_connections_by_company_name(self, company_name: str, user_id: int = None) -> List[Dict[str, Any]]:
        """Get connections matching a specific company name (improved fuzzy with headline fallback)."""
        session = self.Session()
        try:
            # Normalize the search name
            norm_search = self._normalize_company_name(company_name)
            
            # Handle specific acronyms (could be expanded or automated)
            acronyms = {
                "new york power authority": "nypa",
                "nypa": "new york power authority",
                "metropolitan transportation authority": "mta",
                "mta": "metropolitan transportation authority"
            }
            extra_search = acronyms.get(norm_search)
            
            # 1. Try direct and normalized ilike match on company_name
            # If the search term is short (e.g. "Ro"), we must enforce word boundaries
            if len(company_name) <= 4:
                conditions = [
                    LinkedInConnection.company_name.ilike(company_name),
                    LinkedInConnection.company_name.ilike(f"{company_name} %"),
                    LinkedInConnection.company_name.ilike(f"% {company_name}"),
                    LinkedInConnection.company_name.ilike(f"% {company_name} %")
                ]
            else:
                # For longer names, we can keep the fuzzy match
                conditions = [
                    LinkedInConnection.company_name.ilike(f"%{company_name}%")
                ]
            
            if norm_search and len(norm_search) > 2:
                if len(norm_search) <= 4:
                    conditions.extend([
                      LinkedInConnection.company_name.ilike(norm_search),
                      LinkedInConnection.company_name.ilike(f"{norm_search} %"),
                      LinkedInConnection.company_name.ilike(f"% {norm_search}"),
                      LinkedInConnection.company_name.ilike(f"% {norm_search} %")
                   ])
                else:
                    conditions.append(LinkedInConnection.company_name.ilike(f"%{norm_search}%"))
            
            if extra_search:
                conditions.append(LinkedInConnection.company_name.ilike(f"%{extra_search}%"))
                
            from sqlalchemy import or_
            query = session.query(LinkedInConnection).filter(or_(*conditions))
            if user_id:
                query = query.filter(LinkedInConnection.user_id == user_id)
            
            conns = query.all()
            
            # 2. Inverse check if needed (small set only)
            if not conns:
                all_query = session.query(LinkedInConnection)
                if user_id:
                    all_query = all_query.filter(LinkedInConnection.user_id == user_id)
                all_conns = all_query.all()
                matches = []
                for c in all_conns:
                    c_norm = self._normalize_company_name(c.company_name)
                    if c_norm and norm_search:
                        if len(norm_search) <= 4:
                            # For short names, require exact normalized match
                            if c_norm == norm_search:
                                matches.append(c)
                        else:
                            # Original fuzzy logic for longer names
                            if c_norm in norm_search or norm_search in c_norm:
                                matches.append(c)
                    elif extra_search and c_norm and (c_norm in extra_search or extra_search in c_norm):
                        matches.append(c)
                conns = matches

            # 3. Fallback: Search HEADLINE if company_name is empty or we have few matches
            if len(conns) < 5:
                if len(company_name) <= 4:
                    headline_conditions = [
                        LinkedInConnection.headline.ilike(company_name),
                        LinkedInConnection.headline.ilike(f"% at {company_name}%"),
                        LinkedInConnection.headline.ilike(f"% @ {company_name}%"),
                        LinkedInConnection.headline.ilike(f"% {company_name} %")
                    ]
                else:
                    headline_conditions = [
                        LinkedInConnection.headline.ilike(f"%{company_name}%")
                    ]
                
                if norm_search and len(norm_search) > 2:
                    if len(norm_search) <= 4:
                        headline_conditions.extend([
                            LinkedInConnection.headline.ilike(norm_search),
                            LinkedInConnection.headline.ilike(f"% at {norm_search}%"),
                            LinkedInConnection.headline.ilike(f"% @ {norm_search}%")
                        ])
                    else:
                        headline_conditions.append(LinkedInConnection.headline.ilike(f"%{norm_search}%"))

                if extra_search:
                    headline_conditions.append(LinkedInConnection.headline.ilike(f"%{extra_search}%"))
                
                headline_query = session.query(LinkedInConnection).filter(or_(*headline_conditions))
                if user_id:
                    headline_query = headline_query.filter(LinkedInConnection.user_id == user_id)
                
                headline_conns = headline_query.all()
                conns.extend(headline_conns)

            # --- DEFINITIVE WORD BOUNDARY FILTER ---
            # For short names like "Ro", SQL ILIKE is too loose. 
            # We enforce strict word boundaries in Python to avoid "Metro" vs "Ro".
            if len(norm_search) <= 5:
                import re
                # Pattern: Word boundary, then name, then word boundary.
                # Avoids matching "ro" in "Metro", "Brooklyn", "Recruiter for..."
                pattern = re.compile(rf'\b{re.escape(norm_search)}\b', re.IGNORECASE)
                extra_pattern = None
                if extra_search:
                    extra_pattern = re.compile(rf'\b{re.escape(extra_search)}\b', re.IGNORECASE)
                
                filtered = []
                seen_urls = set()
                for c in conns:
                    if c.profile_url in seen_urls: continue
                    
                    # Must find the standalone word in Company OR Headline (or extra mapped pattern word)
                    match_found = False
                    if pattern.search(c.company_name or "") or pattern.search(c.headline or ""):
                        match_found = True
                    elif extra_pattern and (extra_pattern.search(c.company_name or "") or extra_pattern.search(c.headline or "")):
                        match_found = True
                    
                    if match_found:
                        filtered.append(c)
                        seen_urls.add(c.profile_url)
                conns = filtered
            else:
                # Simple deduplication for longer names
                unique = []
                seen = set()
                for c in conns:
                    if c.profile_url not in seen:
                        unique.append(c)
                        seen.add(c.profile_url)
                conns = unique

            return [
                {
                    "id": c.id,
                    "name": c.name,
                    "headline": c.headline,
                    "profile_url": c.profile_url,
                    "company_id": c.company_id,
                    "company_name": c.company_name,
                    "photo_url": c.photo_url
                } for c in conns
            ]
        finally:
            session.close()

    def get_all_linkedin_connections(self, limit: int = 100, user_id: int = None) -> List[Dict[str, Any]]:
        """Retrieve all synced LinkedIn connections."""
        session = self.Session()
        try:
            if user_id:
                # Adoption logic for LinkedIn connections
                orphans = session.query(LinkedInConnection).filter(LinkedInConnection.user_id == None).all()
                if orphans:
                    is_admin = False
                    user = session.query(User).filter(User.id == user_id).first()
                    if user and user.is_admin:
                        is_admin = True
                    
                    if is_admin or session.query(User).count() == 1:
                        for orphan in orphans:
                            orphan.user_id = user_id
                        session.commit()

            query = session.query(LinkedInConnection)
            if user_id:
                query = query.filter(LinkedInConnection.user_id == user_id)
                
            conns = query.order_by(LinkedInConnection.last_synced.desc()).limit(limit).all()
            return [
                {
                    "name": c.name,
                    "headline": c.headline,
                    "profile_url": c.profile_url,
                    "company_id": c.company_id,
                    "company_name": c.company_name,
                    "last_synced": c.last_synced.isoformat() if c.last_synced else None,
                    "photo_url": c.photo_url
                } for c in conns
            ]
        finally:
            session.close()

    def clear_linkedin_connections(self, user_id: int = None) -> bool:
        """Purge all LinkedIn connection records."""
        session = self.Session()
        try:
            query = session.query(LinkedInConnection)
            if user_id:
                query = query.filter(LinkedInConnection.user_id == user_id)
            query.delete(synchronize_session=False)
            session.commit()
            return True
        finally:
            session.close()

    def search_linkedin_connections(self, query: str, user_id: int = None) -> List[Dict[str, Any]]:
        """Search for LinkedIn connections by name or headline."""
        session = self.Session()
        try:
            from sqlalchemy import or_
            db_query = session.query(LinkedInConnection).filter(
                or_(
                    LinkedInConnection.name.ilike(f"%{query}%"),
                    LinkedInConnection.headline.ilike(f"%{query}%"),
                    LinkedInConnection.company_name.ilike(f"%{query}%")
                )
            )
            if user_id:
                db_query = db_query.filter(LinkedInConnection.user_id == user_id)
                
            conns = db_query.limit(20).all()
            
            return [
                {
                    "id": c.id,
                    "name": c.name,
                    "headline": c.headline,
                    "profile_url": c.profile_url,
                    "company_name": c.company_name,
                    "photo_url": c.photo_url
                } for c in conns
            ]
        finally:
            session.close()

    def _log_event(self, app_id: int, event_type: str, description: str, session=None):
        """Helper to create an application event."""
        own_session = False
        if session is None:
            session = self.Session()
            own_session = True
        
        try:
            event = ApplicationEvent(
                application_id=app_id,
                event_type=event_type,
                description=description,
                timestamp=datetime.now(timezone.utc).isoformat()
            )
            session.add(event)
            if own_session:
                session.commit()
        except Exception as e:
            print(f"Failed to log event: {e}")
            if own_session:
                session.rollback()
        finally:
            if own_session:
                session.close()

    # ── Notifications ───────────────────────────────────────────────────────────
    def create_notification(self, user_id: int, title: str, message: str,
                            category: str = 'info', link_screen: str = None,
                            link_app_id: int = None, link_anchor: str = None) -> Dict[str, Any]:
        """Create a new notification for a user."""
        session = self.Session()
        try:
            n = Notification(
                user_id=user_id, category=category, title=title,
                message=message, link_screen=link_screen,
                link_app_id=link_app_id, link_anchor=link_anchor
            )
            session.add(n)
            session.commit()
            return {
                "id": n.id, "user_id": n.user_id, "category": n.category,
                "title": n.title, "message": n.message,
                "link_screen": n.link_screen, "link_app_id": n.link_app_id,
                "link_anchor": n.link_anchor, "is_read": n.is_read,
                "created_at": n.created_at.isoformat() if n.created_at else None
            }
        except Exception as e:
            session.rollback()
            raise e
        finally:
            session.close()

    def get_notifications(self, user_id: int, limit: int = 50) -> List[Dict[str, Any]]:
        """Get recent notifications for a user, newest first."""
        session = self.Session()
        try:
            results = (session.query(Notification)
                       .filter(Notification.user_id == user_id)
                       .order_by(Notification.created_at.desc())
                       .limit(limit)
                       .all())
            return [{
                "id": n.id, "user_id": n.user_id, "category": n.category,
                "title": n.title, "message": n.message,
                "link_screen": n.link_screen, "link_app_id": n.link_app_id,
                "link_anchor": n.link_anchor, "is_read": n.is_read,
                "created_at": n.created_at.isoformat() if n.created_at else None
            } for n in results]
        finally:
            session.close()

    def mark_notification_read(self, notification_id: int, user_id: int) -> bool:
        """Mark a single notification as read."""
        session = self.Session()
        try:
            n = session.query(Notification).filter(
                Notification.id == notification_id,
                Notification.user_id == user_id
            ).first()
            if not n:
                return False
            n.is_read = True
            session.commit()
            return True
        finally:
            session.close()

    def mark_all_notifications_read(self, user_id: int) -> int:
        """Mark all notifications as read for a user. Returns count updated."""
        session = self.Session()
        try:
            count = (session.query(Notification)
                     .filter(Notification.user_id == user_id, Notification.is_read == False)
                     .update({"is_read": True}))
            session.commit()
            return count
        finally:
            session.close()


if __name__ == "__main__":
    pass
