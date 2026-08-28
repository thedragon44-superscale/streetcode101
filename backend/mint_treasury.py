from sqlmodel import Session, text, select
from models import User, Transaction, P2POrder, CashoutRequest, SQLModel
from database import engine 

def run_patch():
    # 1. Create the new tables (Transaction, P2POrder, CashoutRequest)
    SQLModel.metadata.create_all(engine)
    print("✅ New economy tables created.")

    with engine.begin() as conn:
        try:
            # Added double quotes around "user" to bypass PostgreSQL reserved keyword restrictions
            conn.execute(text('ALTER TABLE "user" ADD COLUMN wallet_balance FLOAT DEFAULT 0.0;'))
            print("✅ Wallet balances added to existing users.")
        except Exception as e:
            print(f"⚠️ Column check: {e}")

    # 3. Mint the 1 Billion Coin Treasury
    with Session(engine) as session:
        admin = session.exec(select(User).where(User.username == "admin")).first()
        if not admin:
            print("⚠️ Master admin user not found in database. Please register 'admin' first.")
            return
            
        if admin.wallet_balance < 1000000000:
            admin.wallet_balance = 1000000000.0
            session.add(admin)
            
            # Log the genesis transaction
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
