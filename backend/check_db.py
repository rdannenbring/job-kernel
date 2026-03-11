import sqlite3
import json

conn = sqlite3.connect("backend/applications.db")
c = conn.cursor()
c.execute("SELECT resume_data FROM applications ORDER BY id DESC LIMIT 1")
row = c.fetchone()
if row:
    resume_data = json.loads(row[0])
    print("Full Text Title:", resume_data.get("full_text", [])[4])
    print("Change Summary:", resume_data.get("change_summary", []))
else:
    print("No rows found")
