import sqlite3

def fix_schema():
    conn = sqlite3.connect('applications.db')
    cursor = conn.cursor()
    
    # Get current columns
    cursor.execute("PRAGMA table_info(applications)")
    columns = [row[1] for row in cursor.fetchall()]
    
    missing_columns = [
        ('company_logo', 'TEXT'),
        ('job_type', 'VARCHAR'),
        ('location_type', 'VARCHAR'),
        ('location', 'VARCHAR'),
        ('relocation', 'VARCHAR'),
        ('interest_level', 'VARCHAR'),
        ('remarks', 'TEXT'),
        ('is_archived', 'VARCHAR DEFAULT "false"'),
        ('kanban_order', 'INTEGER DEFAULT 0'),
        ('override_resume_path', 'VARCHAR'),
        ('override_cover_letter_path', 'VARCHAR'),
        ('active_resume_type', 'VARCHAR DEFAULT "generated"'),
        ('active_cover_letter_type', 'VARCHAR DEFAULT "generated"'),
        ('glassdoor_rating', 'VARCHAR'),
        ('glassdoor_url', 'VARCHAR'),
        ('indeed_rating', 'VARCHAR'),
        ('indeed_url', 'VARCHAR'),
        ('linkedin_rating', 'VARCHAR'),
        ('linkedin_url', 'VARCHAR'),
        ('profile_snapshot', 'TEXT'),
        ('pipeline_stage', 'VARCHAR DEFAULT "saved"'),
        ('commute_time_mins', 'INTEGER'),
        ('commute_distance_miles', 'FLOAT'),
        ('commute_details', 'TEXT')
    ]
    
    for col_name, col_type in missing_columns:
        if col_name not in columns:
            print(f"Adding column {col_name}...")
            try:
                cursor.execute(f"ALTER TABLE applications ADD COLUMN {col_name} {col_type}")
            except Exception as e:
                print(f"Error adding {col_name}: {e}")
    
    conn.commit()
    conn.close()
    print("Schema fix complete.")

if __name__ == "__main__":
    fix_schema()
