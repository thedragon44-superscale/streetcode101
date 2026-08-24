from sqlmodel import Session
from sqlalchemy import text
from database import engine

print("Connecting to PostgreSQL to patch User table...")

def fix_user_table():
    with Session(engine) as session:
        try:
            # Inject the missing column with a default value of false
            session.exec(text('ALTER TABLE "user" ADD COLUMN has_spun BOOLEAN DEFAULT FALSE;'))
            session.commit()
            print("✅ SUCCESS: Added 'has_spun' column to the User table!")
        except Exception as e:
            print(f"❌ Error (Column might already exist): {e}")

if __name__ == "__main__":
    fix_user_table()
