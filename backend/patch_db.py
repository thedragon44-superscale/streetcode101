from sqlalchemy import text
from database import engine

with engine.connect() as conn:
    conn.execute(text('ALTER TABLE "user" ADD COLUMN role VARCHAR DEFAULT \'customer\';'))
    conn.commit()
print("Role column injected successfully!")
