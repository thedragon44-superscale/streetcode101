from sqlmodel import Session
from database import engine
from models import Product
import json

with Session(engine) as session:
    # Query the exact shoe SKU you are troubleshooting
    product = session.get(Product, "101-CJPB2083")
    
    if product:
        print(f"\n✅ PRODUCT FOUND: {product.title}")
        print(f"--- VARIANT DATA ---")
        # Pretty-print the JSON array so it's easy to read
        print(json.dumps(product.variants, indent=2))
    else:
        print("\n❌ Product not found in database.")
