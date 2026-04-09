import sqlite3
import re
from sqlalchemy import create_engine
from services.database_service import Base

def fix_all():
    conn = sqlite3.connect('../applications.db')
    cursor = conn.cursor()
    
    # We want to use SQLAlchemy to create tables if they don't exist
    engine = create_engine('sqlite:///../applications.db')
    Base.metadata.create_all(engine)
    
    # Introspect sqlalchemy tables vs sqlite tables
    for table_name, table in Base.metadata.tables.items():
        cursor.execute(f"PRAGMA table_info({table_name})")
        existing_cols = {row[1] for row in cursor.fetchall()}
        
        for column in table.columns:
            if column.name not in existing_cols:
                # Add it natively
                col_type = str(column.type)
                print(f"Adding {column.name} to {table_name} type {col_type}")
                try:
                    cursor.execute(f"ALTER TABLE {table_name} ADD COLUMN {column.name} {col_type}")
                except Exception as e:
                    print(e)
    conn.commit()
    conn.close()

if __name__ == '__main__':
    fix_all()
