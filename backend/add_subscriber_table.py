from sqlmodel import SQLModel
from database import engine
# Importing LedgerSubscriber registers it with SQLModel's metadata
from models import LedgerSubscriber 

print("Connecting to PostgreSQL to initialize new tables...")

def create_new_tables():
    try:
        # Safely creates any missing tables without dropping existing data
        SQLModel.metadata.create_all(engine)
        print("✅ SUCCESS: LedgerSubscriber table has been created successfully!")
    except Exception as e:
        print(f"❌ ERROR: {e}")

if __name__ == "__main__":
    create_new_tables()
