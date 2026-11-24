from database import engine
from sqlalchemy import text

print("Upgrading database schema...")

try:
    with engine.connect() as conn:
        # This SQL command injects the missing column directly into Postgres
        conn.execute(text("ALTER TABLE product ADD COLUMN is_featured BOOLEAN DEFAULT FALSE;"))
        conn.commit()
    print("✅ Successfully added 'is_featured' column to the database!")
except Exception as e:
    print(f"❌ Error (the column might already exist): {e}")
