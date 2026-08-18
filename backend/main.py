# ==========================================
# ULTIMATE IPv4 ENFORCER (Must be at the VERY top!)
# ==========================================
import socket
import urllib3.util.connection as urllib3_cn
urllib3_cn.allowed_gai_family = lambda: socket.AF_INET
orig_getaddrinfo = socket.getaddrinfo
def getaddrinfo_ipv4(host, port, family=0, type=0, proto=0, flags=0):
    return orig_getaddrinfo(host, port, socket.AF_INET, type, proto, flags)
socket.getaddrinfo = getaddrinfo_ipv4

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import SQLModel, Session, select
from database import engine
from models import Product, Order, User, VendorListing, Message
from routes import router

app = FastAPI(title="Dropshipping API with Postgres", version="0.3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Bring in all the endpoints defined in routes.py
app.include_router(router)

@app.on_event("startup")
def on_startup():
    SQLModel.metadata.create_all(engine)
    
    # Optional: Seed the database with our mock products if it's empty
    with Session(engine) as session:
        existing = session.exec(select(Product)).first()
        if not existing:
            print("Seeding database with initial products...")
            session.add(Product(sku="SKU-1001", title="Wireless Ergonomic Mouse", description="Reduces wrist strain.", price=29.99, image_url="https://dummyimage.com/400x400/000/fff&text=Mouse", in_stock=True, supplier_sku="SUPP-A1"))
            session.add(Product(sku="SKU-1002", title="Mechanical Keyboard", description="RGB backlit.", price=79.99, image_url="https://dummyimage.com/400x400/000/fff&text=Keyboard", in_stock=False, supplier_sku="SUPP-B2"))
            session.commit()
