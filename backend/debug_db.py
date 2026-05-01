
import os
import sys
import json
from services.database_service import DatabaseService

def main():
    db = DatabaseService()
    # Check ID 3 (the one from logs)
    app = db.get_application_by_id(3)
    if app:
        print(json.dumps(app, indent=2))
    else:
        print("Application ID 3 not found. Checking all apps...")
        apps = db.get_applications()
        print(json.dumps(apps, indent=2))

if __name__ == "__main__":
    main()
