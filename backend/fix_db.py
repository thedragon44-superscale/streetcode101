from sqlalchemy import text
from database import engine

print("Connecting to PostgreSQL...")
with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TABLE product ADD COLUMN category VARCHAR DEFAULT 'uncategorized';"))
        conn.commit()
        print("✅ SUCCESS: Added 'category' column to the Product table!")
    except Exception as e:
        print(f"❌ ERROR: {e}")
