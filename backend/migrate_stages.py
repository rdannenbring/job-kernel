import json
import os
from services.database_service import DatabaseService, Application
from sqlalchemy.orm import sessionmaker

def migrate():
    db = DatabaseService()
    session = db.Session()
    
    mapping = {
        'Saved': 'saved',
        'Generated': 'generated',
        'Applied': 'applied',
        'Interviewing': 'interviewing',
        'Decision': 'decision',
        'Accepted': 'accepted',
        'Archived': 'archived'
    }
    
    try:
        apps = session.query(Application).all()
        print(f"Checking {len(apps)} applications...")
        count = 0
        for app in apps:
            current_stage = getattr(app, 'pipeline_stage', None)
            new_stage = mapping.get(app.status, 'saved')
            
            # Update if current is 'saved' but status suggests otherwise, 
            # or if stage is out of sync with status
            if current_stage != new_stage:
                print(f"App {app.id}: Status='{app.status}', Syncing: {current_stage} -> {new_stage}")
                app.pipeline_stage = new_stage
                count += 1
        
        session.commit()
        print(f"Migrated {count} applications.")
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        session.rollback()
    finally:
        session.close()

if __name__ == "__main__":
    migrate()
