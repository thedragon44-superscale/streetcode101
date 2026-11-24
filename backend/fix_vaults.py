from sqlmodel import Session, select
from database import engine
from models import User

with Session(engine) as session:
    # 1. Reset Admin to 0
    admin = session.exec(select(User).where(User.username == "admin")).first()
    if admin:
        admin.wallet_balance = 0.0
        session.add(admin)

    # 2. Create Master Vault (The Genesis Supply)
    master = session.exec(select(User).where(User.username == "master_vault")).first()
    if not master:
        master = User(username="master_vault", email="master@streetcode101.com", password_hash="locked", role="system")
    master.wallet_balance = 1000000000.0  # 1 Billion SC
    session.add(master)

    # 3. Create Escrow Vault (For holding pending funds)
    escrow = session.exec(select(User).where(User.username == "escrow_vault")).first()
    if not escrow:
        escrow = User(username="escrow_vault", email="escrow@streetcode101.com", password_hash="locked", role="system")
    escrow.wallet_balance = 0.0
    session.add(escrow)

    session.commit()
    print("Architecture Reset: Admin=0, Master=1B, Escrow=0")
