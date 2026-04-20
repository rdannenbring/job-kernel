import os
import sys
from pathlib import Path

# Add backend directory to path so we can import services
backend_dir = Path(__file__).resolve().parent.parent
sys.path.append(str(backend_dir))

from services.database_service import DatabaseService
from services.auth_service import AuthService

def reset_password(username, new_password):
    db = DatabaseService()
    user = db.get_user_by_username(username)
    
    if not user:
        print(f"❌ Error: User '{username}' not found.")
        return False
    
    hashed_password = AuthService.get_password_hash(new_password)
    
    # Update user password in DB
    session = db.Session()
    try:
        from services.database_service import User
        db_user = session.query(User).filter(User.id == user['id']).first()
        db_user.hashed_password = hashed_password
        session.commit()
        print(f"✅ Success: Password for user '{username}' has been reset.")
        return True
    except Exception as e:
        session.rollback()
        print(f"❌ Error updating database: {e}")
        return False
    finally:
        session.close()

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python reset_password.py <username> <new_password>")
        sys.exit(1)
    
    target_username = sys.argv[1]
    target_password = sys.argv[2]
    
    reset_password(target_username, target_password)
