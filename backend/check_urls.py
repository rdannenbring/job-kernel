from services.database_service import DatabaseService; db = DatabaseService(); session = db.Session(); apps = db.get_all_applications(); print([(a['id'], a['job_url']) for a in apps])
