from sqlmodel import Session, text, select
from models import User, Transaction, P2POrder, CashoutRequest, SQLModel
from database import engine 
from passlib.context import CryptContext

# Set up the password hasher
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def run_patch():
    SQLModel.metadata.create_all(engine)

    with engine.begin() as conn:
        try:
            conn.execute(text('ALTER TABLE "user" ADD COLUMN wallet_balance FLOAT DEFAULT 0.0;'))
        except Exception as e:
            pass # Column already exists

    with Session(engine) as session:
        admin = session.exec(select(User).where(User.username == "admin")).first()
        
        # 1. MATERIALIZE THE GHOST ACCOUNT
        if not admin:
            print("⚠️ Ghost admin found. Converting to real database account...")
            admin = User(
                username="admin",
                email="admin@streetcode101.com",
                password_hash=pwd_context.hash("DudeIhatethis4me"), # Secure default password
                bio="Master Admin Override",
                profile_image_url="/dragon_logo.png",
                is_verified=True,
                wallet_balance=0.0
            )
            session.add(admin)
            session.commit()
            session.refresh(admin)
            print("✅ Real 'admin' account created! (Password: MasterVault101!)")
            
        # 2. MINT THE TREASURY
        if admin.wallet_balance < 1000000000:
            admin.wallet_balance = 1000000000.0
            session.add(admin)
            
            genesis_tx = Transaction(
                sender_username="SYSTEM",
                receiver_username="admin",
                amount=1000000000.0,
                transaction_type="genesis_mint",
                status="completed"
            )
            session.add(genesis_tx)
            
            session.commit()
            print("🐉 MASTER TREASURY MINTED: 1,000,000,000 StreetCoins allocated to Admin Vault.")
        else:
            print("🐉 Treasury already minted.")

if __name__ == "__main__":
    run_patch()
