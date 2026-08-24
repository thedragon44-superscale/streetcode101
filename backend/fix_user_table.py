from sqlmodel import Session
from sqlalchemy import text
from database import engine

print("Connecting to PostgreSQL to patch User table...")

def fix_user_table():
    with Session(engine) as session:
        try:
            # Inject the missing discount_percent column with a default value of 0.0
            session.exec(text('ALTER TABLE "user" ADD COLUMN discount_percent FLOAT DEFAULT 0.0;'))
            session.commit()
            print("✅ SUCCESS: Added 'discount_percent' column to the User table!")
        except Exception as e:
            print(f"❌ Error (Column might already exist): {e}")

if __name__ == "__main__":
    fix_user_table()
