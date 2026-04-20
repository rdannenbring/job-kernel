
import sqlite3
import os

db_path = "applications.db"
if not os.path.exists(db_path):
    print("DB not found")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

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
    """
]

for m in migrations:
    try:
        cursor.execute(m)
        conn.commit()
        print(f"Success: {m[:50]}...")
    except Exception as e:
        print(f"Failed: {m[:50]}... Error: {e}")

conn.close()
