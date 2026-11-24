from sqlalchemy import text
from database import engine

with engine.connect() as conn:
    conn.execute(text('ALTER TABLE "user" ADD COLUMN primary_trade VARCHAR;'))
    conn.commit()
print("Primary Trade column added successfully!")
