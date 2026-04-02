import os
from sqlalchemy import text
from sqlalchemy import create_engine

# Need psycopg2 installed, backend probably has it
DATABASE_URL = "postgresql://user:password@localhost:5432/jobapp_db"
engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    print("Executing ALTER TABLE match_score...")
    try:
        conn.execute(text("ALTER TABLE applications ADD COLUMN match_score INTEGER;"))
        conn.commit()
    except Exception as e:
        print("Score error:", e)

    print("Executing ALTER TABLE match_details...")
    try:
        conn.execute(text("ALTER TABLE applications ADD COLUMN match_details TEXT;"))
        conn.commit()
    except Exception as e:
        print("Details error:", e)

print("Migration completed.")
