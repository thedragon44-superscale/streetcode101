from sqlmodel import Session, select
from database import engine
from models import User

with Session(engine) as session:
    users = session.exec(select(User).where(User.role.contains("service_provider"))).all()
    for u in users:
        if not u.primary_trade:
            u.primary_trade = "mobile_mechanic"  # Injecting a fallback trade
            session.add(u)
            print(f"Fixed account: @{u.username}")
    session.commit()
print("Patch complete!")
