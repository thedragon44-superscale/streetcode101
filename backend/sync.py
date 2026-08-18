from sqlmodel import Session, select
from main import engine, Product
import random

# --- MOCK SUPPLIER API ---
def fetch_supplier_data():
    """
    Simulates fetching live data from a supplier like AliExpress or CJ Dropshipping.
    In reality, you would use the `requests` library to GET this data from their API.
    """
    print("-> Fetching live data from Supplier API...")
    return {
        "SUPP-A1": {"wholesale_price": 22.50, "stock_quantity": 45},
        "SUPP-B2": {"wholesale_price": 60.00, "stock_quantity": 0} # Uh oh, out of stock!
    }

# --- SYNC LOGIC ---
def sync_inventory_and_pricing():
    supplier_data = fetch_supplier_data()
    
    with Session(engine) as session:
        # Fetch all products from your Postgres database
        products = session.exec(select(Product)).all()
        
        updates_made = 0

        for product in products:
            # Skip products that don't have a supplier SKU mapped
            if not product.supplier_sku:
                continue
                
            if product.supplier_sku in supplier_data:
                live_data = supplier_data[product.supplier_sku]
                
                # 1. Update Inventory
                is_currently_in_stock = live_data["stock_quantity"] > 0
                if product.in_stock != is_currently_in_stock:
                    print(f"[*] STOCK UPDATE: {product.sku} changed to {'In Stock' if is_currently_in_stock else 'Out of Stock'}")
                    product.in_stock = is_currently_in_stock
                    updates_made += 1
                
                # 2. Dynamic Pricing Protection (Maintain a 40% profit margin)
                desired_margin = 1.40
                calculated_retail_price = round(live_data["wholesale_price"] * desired_margin, 2)
                
                if product.price != calculated_retail_price:
                    print(f"[*] PRICE UPDATE: {product.sku} changed from ${product.price} to ${calculated_retail_price}")
                    product.price = calculated_retail_price
                    updates_made += 1

        if updates_made > 0:
            session.commit()
            print(f"-> Sync complete! Committed {updates_made} updates to PostgreSQL.")
        else:
            print("-> Sync complete! No changes needed.")

if __name__ == "__main__":
    print("--- Starting Manual Inventory Sync ---")
    sync_inventory_and_pricing()
