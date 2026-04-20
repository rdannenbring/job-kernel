import os
from datetime import datetime, timedelta
from typing import Optional, Any
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, Security, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials, APIKeyHeader
from dotenv import load_dotenv

load_dotenv()

# We'll use jose for JWT operations

SECRET_KEY = os.getenv("JWT_SECRET", "super-secret-key-change-me")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440")) # 24 hours
RESET_TOKEN_EXPIRE_MINUTES = 60 # 1 hour for security

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

class AuthService:
    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        return pwd_context.verify(plain_password, hashed_password)

    @staticmethod
    def get_password_hash(password: str) -> str:
        return pwd_context.hash(password)

    @staticmethod
    def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
        return encoded_jwt

    @staticmethod
    def decode_token(token: str) -> Optional[dict]:
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            return payload
        except Exception:
            return None

    @staticmethod
    def create_reset_token(user_id: int, current_hashed_password: str) -> str:
        # We include the first 8 chars of the current hash. 
        # If the password changes, the hash changes, and the token becomes invalid.
        hash_fragment = current_hashed_password[:8]
        expire = datetime.utcnow() + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES)
        to_encode = {
            "sub": str(user_id),
            "exp": expire,
            "type": "reset",
            "v": hash_fragment
        }
        return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

    @staticmethod
    def verify_reset_token(token: str, current_hashed_password: str) -> Optional[int]:
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            if payload.get("type") != "reset":
                return None
            
            # Check if hash fragment matches
            if payload.get("v") != current_hashed_password[:8]:
                return None
            
            return int(payload.get("sub"))
        except Exception:
            return None

def get_current_user_id(
    request: Request,
    auth: Optional[HTTPAuthorizationCredentials] = Depends(security),
    api_key: Optional[str] = Depends(api_key_header)
) -> int:
    # 1. Check API Key first (Extension)
    if api_key:
        from services.database_service import DatabaseService
        db = DatabaseService()
        user = db.get_user_by_api_key(api_key)
        if user:
            return user["id"]
        # If key is provided but invalid, we could fail here, 
        # or fall back to token. Let's fall back.

    # 2. Check JWT Token
    if auth:
        payload = AuthService.decode_token(auth.credentials)
        if payload:
            user_id = payload.get("sub")
            if user_id:
                return int(user_id)
                
    raise HTTPException(status_code=401, detail="Missing or invalid authentication (JWT or API Key)")

def get_admin_user_id(user_id: int = Depends(get_current_user_id)) -> int:
    from services.database_service import DatabaseService
    db = DatabaseService()
    # Check if user is admin
    session = db.Session()
    try:
        from services.database_service import User
        user = session.query(User).filter(User.id == user_id).first()
        if not user or not user.is_admin:
            raise HTTPException(status_code=403, detail="Admin privileges required")
        return user_id
    finally:
        session.close()
