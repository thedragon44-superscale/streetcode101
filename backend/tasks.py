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
