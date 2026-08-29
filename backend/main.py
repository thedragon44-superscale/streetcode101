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

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import SQLModel, Session, select
from database import engine
from models import Product, Order, User, Post, Message
from routes import router
import json

# --- WEBSOCKET CONNECTION MANAGER ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except:
                pass

manager = ConnectionManager()

app = FastAPI(title="Dropshipping API with Postgres", version="0.3.0")

app.mount("/.well-known", StaticFiles(directory=".well-known"), name="well-known")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://streetcode101.com", "https://www.streetcode101.com"], 
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Ensure WebSockets are evaluated BEFORE any HTTP catch-all routes in routes.py
@app.websocket("/api/ws/chat/{token}")
@app.websocket("/ws/chat/{token}")
@app.websocket("/chat/{token}")
async def websocket_endpoint(websocket: WebSocket, token: str):
    if not token or token == "null":
        await websocket.close(code=1008)
        return

    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            await manager.broadcast(data)
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# Bring in all the endpoints defined in routes.py
app.include_router(router)

@app.on_event("startup")
def on_startup():
    SQLModel.metadata.create_all(engine)
    
    with Session(engine) as session:
        existing = session.exec(select(Product)).first()
        if not existing:
            print("Seeding database with initial products...")
            session.add(Product(sku="SKU-1001", title="Wireless Ergonomic Mouse", description="Reduces wrist strain.", price=29.99, image_url="https://dummyimage.com/400x400/000/fff&text=Mouse", in_stock=True, supplier_sku="SUPP-A1"))
            session.add(Product(sku="SKU-1002", title="Mechanical Keyboard", description="RGB backlit.", price=79.99, image_url="https://dummyimage.com/400x400/000/fff&text=Keyboard", in_stock=False, supplier_sku="SUPP-B2"))
            session.commit()
