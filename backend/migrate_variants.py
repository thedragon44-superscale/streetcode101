from sqlalchemy import text
from database import engine

print("Connecting to PostgreSQL...")
with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TABLE product ADD COLUMN variants JSON DEFAULT '[]';"))
        conn.commit()
        print("✅ SUCCESS: Added 'variants' column to the Product table!")
    except Exception as e:
        print(f"❌ ERROR: {e}")
