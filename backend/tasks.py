from celery import Celery
from sqlmodel import Session, select
from database import engine
from models import Product, Order
import time
import random

# --- INITIALIZE CELERY ---
# Connects to the local Redis server we just installed
celery_app = Celery(
    "dropship_tasks",
    broker="redis://localhost:6379/0",
    backend="redis://localhost:6379/0"
)

# --- MOCK SUPPLIER API ---
def fetch_supplier_data():
    """Simulates a network request to a supplier."""
    time.sleep(2) # Simulate network delay
    return {
        "SUPP-A1": {"wholesale_price": 22.50, "stock_quantity": 45},
        "SUPP-B2": {"wholesale_price": 60.00, "stock_quantity": 0}
    }

# --- THE BACKGROUND TASK ---
# bind=True gives us access to 'self' so we can retry the task if it fails
@celery_app.task(name="sync_inventory", bind=True, max_retries=3)
def sync_inventory_task(self):
    try:
        supplier_data = fetch_supplier_data()
        
        with Session(engine) as session:
            products = session.exec(select(Product)).all()
            updates_made = 0

            for product in products:
                if not product.supplier_sku:
                    continue
                    
                if product.supplier_sku in supplier_data:
                    live_data = supplier_data[product.supplier_sku]
                    
                    # 1. Update Inventory
                    is_currently_in_stock = live_data["stock_quantity"] > 0
                    if product.in_stock != is_currently_in_stock:
                        product.in_stock = is_currently_in_stock
                        updates_made += 1
                    
                    # 2. Dynamic Pricing Protection
                    desired_margin = 1.40
                    calculated_retail_price = round(live_data["wholesale_price"] * desired_margin, 2)
                    
                    if product.price != calculated_retail_price:
                        product.price = calculated_retail_price
                        updates_made += 1

            if updates_made > 0:
                session.commit()
                return f"Sync complete! {updates_made} updates made."
            else:
                return "Sync complete! No changes needed."
                
    except Exception as exc:
        # If the supplier API is down, retry automatically in 60 seconds
        raise self.retry(exc=exc, countdown=60)

@celery_app.task(name="process_fulfillment", bind=True)
def process_fulfillment_task(self, order_id: int):
    """Simulates sending the order to a supplier and generating tracking."""
    # Simulate a 3-second network delay to the supplier API
    time.sleep(3) 
    
    # Generate mock supplier data
    mock_tracking = f"TRK-{random.randint(10000000, 99999999)}"
    mock_supplier_id = f"SUPP-ORD-{random.randint(1000, 9999)}"
    
    with Session(engine) as session:
        order = session.get(Order, order_id)
        if order:
            order.tracking_number = mock_tracking
            order.supplier_order_id = mock_supplier_id
            session.add(order)
            session.commit()
            
    return f"Order {order_id} fulfilled! Tracking: {mock_tracking}"

@celery_app.task(name="send_second_drip_email", bind=True)
def send_second_drip_email_task(self, email: str, username: str):
    """Dispatches the second onboarding email exactly 24 hours after registration."""
    from routes import send_automated_email
    
    subject = "Day 1: Status Active"
    body = f"Yo @{username},\n\nIt's been exactly 24 hours since your vault access was granted."
    
    html_template = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="background-color: #0f1115; color: #cbd5e1; font-family: Arial, sans-serif; margin: 0; padding: 20px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #0f1115;">
            <tr>
                <td align="center">
                    <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #1e222a; border-radius: 12px; overflow: hidden; border: 1px solid #334155; margin-top: 20px; margin-bottom: 20px; max-width: 600px;">
                        <tr>
                            <td>
                                <img src="https://streetcode101.com/second-email.png" alt="Status Active - Street Code 101" style="width: 100%; max-width: 600px; display: block; border: none;" />
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 40px 30px;">
                                <h2 style="color: #ffffff; margin-top: 0; font-size: 24px; letter-spacing: 1px;">STATUS: ACTIVE</h2>
                                <p style="font-size: 15px; line-height: 1.6; margin-bottom: 30px;">Yo @{username}, it has been exactly 24 hours since your vault access was granted. The ledger is waiting for your first move.</p>
                                <h3 style="color: #f97316; font-size: 16px; margin-bottom: 8px; text-transform: uppercase;">🔥 Secure Your First Drop</h3>
                                <p style="font-size: 14px; line-height: 1.5; margin-top: 0; margin-bottom: 30px;">Don't forget to use your introductory code <strong>VAULT-Q70KHNSF5G</strong> at checkout to initiate your first P2P transaction.</p>
                                <div style="text-align: center; margin-bottom: 20px;">
                                    <a href="https://streetcode101.com" style="background-color: #0ea5e9; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; display: inline-block;">Browse The Catalog</a>
                                </div>
                                
                                <!-- Compliance Opt-Out -->
                                <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #334155;">
                                    <p style="font-size: 11px; color: #64748b; line-height: 1.5; margin: 0;">
                                        You are receiving this email because you registered at Street Code 101.<br>
                                        <a href="https://streetcode101.com/api/unsubscribe/{email}" style="color: #64748b; text-decoration: underline;">Opt-out of marketing communications</a>
                                    </p>
                                </div>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """
    
    send_automated_email(to_email=email, subject=subject, body=body, html_body=html_template)
    return f"Second drip email sent to {email}"

from datetime import datetime, timedelta
from sqlmodel import Session, select
from database import engine
from models import Appointment, User, Transaction
from routes import send_automated_email

@celery_app.task(name="auto_release_escrow_task")
def auto_release_escrow_task():
    """Scans for jobs completed over 24 hours ago and auto-releases the Escrow."""
    with Session(engine) as session:
        # Find all jobs waiting on the client
        pending_appts = session.exec(
            select(Appointment).where(Appointment.status == "pending_confirmation")
        ).all()
        
        admin = session.exec(select(User).where(User.username == "admin")).first()
        if not admin:
            return "Admin vault not found"
            
        released_count = 0
        now = datetime.utcnow()
        
        for appt in pending_appts:
            if appt.provider_completed_at:
                time_elapsed = now - appt.provider_completed_at
                
                # THE 24-HOUR RULE
                if time_elapsed > timedelta(hours=24):
                    provider = session.exec(select(User).where(User.username == appt.provider_username)).first()
                    client = session.exec(select(User).where(User.username == appt.client_username)).first()
                    
                    if provider and admin.wallet_balance >= appt.escrow_amount:
                        # 1. Transfer the money
                        admin.wallet_balance -= appt.escrow_amount
                        provider.wallet_balance += appt.escrow_amount
                        
                        # 2. Log the immutable transaction
                        tx = Transaction(
                            sender_username="admin",
                            receiver_username=provider.username,
                            amount=appt.escrow_amount,
                            transaction_type="auto_escrow_release",
                            status="completed"
                        )
                        
                        # 3. Update appointment status
                        appt.status = "released"
                        appt.client_confirmed_at = now
                        
                        session.add(admin)
                        session.add(provider)
                        session.add(tx)
                        session.add(appt)
                        
                        # 4. Notify the Provider they got paid
                        send_automated_email(
                            to_email=provider.email,
                            subject="💰 Escrow Auto-Released!",
                            body=f"Yo @{provider.username},\n\nThe 24-hour review window passed without a client dispute. {appt.escrow_amount:.2f} SC has been automatically released to your wallet for appointment #{appt.id}.\n\nKeep grinding."
                        )
                        
                        # 5. Notify the Client it was closed
                        if client:
                            send_automated_email(
                                to_email=client.email,
                                subject="Service Escrow Closed",
                                body=f"Yo @{client.username},\n\nThe 24-hour review window for appointment #{appt.id} has expired. The escrowed funds have been automatically released to the provider. The job is now officially closed."
                            )
                        
                        released_count += 1
                        
        session.commit()
        return f"Auto-released {released_count} escrows."

from celery.schedules import crontab

# Configure Celery Beat Schedule
celery_app.conf.beat_schedule = {
    # Existing Sync Task
    'sync-inventory-every-15-min': {
        'task': 'sync_inventory',
        'schedule': 900.0, # 15 minutes in seconds
    },
    
    # New Auto-Release Task
    'check-escrow-every-hour': {
        'task': 'auto_release_escrow_task',
        'schedule': crontab(minute=0), # Runs at the top of every hour
    },
}

celery_app.conf.timezone = 'UTC'
