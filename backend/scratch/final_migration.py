import sqlite3
import os

DB_PATH = "applications.db"

def migrate():
    if not os.path.exists(DB_PATH):
        print("Database not found.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Get the first user ID (presumably the admin)
    cursor.execute("SELECT id FROM users LIMIT 1")
    user = cursor.fetchone()
    if not user:
        print("No users found. Create an account first.")
        conn.close()
        return
    
    admin_id = user[0]
    print(f"Migrating records to user_id: {admin_id}")

    # Update applications
    cursor.execute("UPDATE applications SET user_id = ? WHERE user_id IS NULL OR user_id = 0", (admin_id,))
    print(f"Updated {cursor.rowcount} applications.")

    # Update linkedin_connections
    cursor.execute("UPDATE linkedin_connections SET user_id = ? WHERE user_id IS NULL OR user_id = 0", (admin_id,))
    print(f"Updated {cursor.rowcount} linkedin_connections.")

    # Update configs
    cursor.execute("UPDATE configs SET user_id = ? WHERE user_id IS NULL OR user_id = 0", (admin_id,))
    print(f"Updated {cursor.rowcount} configs.")

    conn.commit()
    conn.close()
    print("Migration complete.")

if __name__ == "__main__":
    migrate()
