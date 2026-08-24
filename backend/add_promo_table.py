from sqlmodel import SQLModel
from database import engine
# Importing PromoCode registers it with SQLModel's metadata
from models import PromoCode 

print("Connecting to PostgreSQL to initialize new tables...")

def create_new_tables():
    try:
        # This safely creates any missing tables (like PromoCode) without altering existing ones
        SQLModel.metadata.create_all(engine)
        print("✅ SUCCESS: PromoCode table has been created successfully!")
    except Exception as e:
        print(f"❌ ERROR: {e}")

if __name__ == "__main__":
    create_new_tables()
