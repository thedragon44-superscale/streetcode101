import os
from dotenv import load_dotenv
from sqlmodel import create_engine, Session

# Load environment variables from the .env file
load_dotenv()

# Safely get the database URL
DATABASE_URL = os.getenv("DATABASE_URL")

# Create the database engine
engine = create_engine(DATABASE_URL, echo=True)

# Dependency to yield database sessions to our endpoints
def get_session():
    with Session(engine) as session:
        yield session
