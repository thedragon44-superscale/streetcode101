from pydantic import BaseModel
from jose import jwt, JWTError
from datetime import datetime, timedelta
from fastapi import BackgroundTasks # If you want to send emails in the background
import stripe
import os
import requests
import socket
import urllib3.util.connection as urllib3_cn
import smtplib
import urllib.request
import urllib.parse
import json
from email.message import EmailMessage

# ==========================================
# ULTIMATE IPv4 ENFORCER (Forces Stripe & Requests to IPv4)
# ==========================================
urllib3_cn.allowed_gai_family = lambda: socket.AF_INET

orig_getaddrinfo = socket.getaddrinfo
def getaddrinfo_ipv4(host, port, family=0, type=0, proto=0, flags=0):
    return orig_getaddrinfo(host, port, socket.AF_INET, type, proto, flags)
socket.getaddrinfo = getaddrinfo_ipv4

import requests
import stripe
# Force Stripe to use our patched requests session
stripe.default_http_client = stripe.RequestsClient(session=requests.Session())

import jwt
import boto3
import uuid
from botocore.config import Config
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, WebSocket, WebSocketDisconnect
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import bcrypt
from pydantic import BaseModel
from sqlmodel import Session, select
from typing import List

from database import get_session, engine
from models import Product, Order, User, VendorListing, Message, CartItem

router = APIRouter()
security = HTTPBearer()

# Direct bcrypt Hashing Utility (No Passlib needed!)
def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed_pw = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed_pw.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

# Safely load the secrets from your .env file
SECRET_KEY = os.getenv("JWT_SECRET", "fallback_secret")
ADMIN_PASS = os.getenv("ADMIN_PASSWORD", "fallback_password")

# --- STRIPE CONFIG ---
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

# Force Stripe to use 'requests' so it inherits our Errno 101 IPv4 patch!
stripe.default_http_client = stripe.RequestsClient()

# Set up AWS / MinIO Client with Path-Style Addressing
s3_client = boto3.client(
    "s3",
    endpoint_url=os.getenv("AWS_ENDPOINT_URL"),
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
    region_name="us-east-1",
    config=Config(s3={'addressing_style': 'path'}) 
)
BUCKET_NAME = os.getenv("AWS_STORAGE_BUCKET_NAME")

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class AuthRequest(BaseModel):
    username: str
    password: str

class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str

class ProfileUpdate(BaseModel):
    bio: str

class ImageUpdate(BaseModel):
    image_url: str

class OrderStatusUpdate(BaseModel):
    status: str

def send_automated_email(to_email: str, subject: str, body: str):
    """Universal SMTP dispatcher for welcomes, tracking, and alerts."""
    smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", 587))
    smtp_user = os.getenv("SMTP_USER")
    smtp_pass = os.getenv("SMTP_PASS")
    
    if not smtp_user or not smtp_pass:
        print("⚠️ SMTP credentials missing. Email not sent.")
        return
        
    try:
        msg = EmailMessage()
        msg.set_content(body)
        msg["Subject"] = subject
        msg["From"] = smtp_user
        msg["To"] = to_email
        
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(smtp_user, smtp_pass)
        server.send_message(msg)
        server.quit()
    except Exception as e:
        print(f"❌ SMTP ERROR: {str(e)}")

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Validates the JWT token provided in the Authorization header."""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

@router.post("/api/auth/register")
def register_user(request: RegisterRequest, session: Session = Depends(get_session)):
    """Registers a new public user and triggers a welcome email."""
    if request.username.lower() == "admin":
        raise HTTPException(status_code=400, detail="Reserved username")
        
    # Check if username OR email is already taken
    existing_user = session.exec(select(User).where((User.username == request.username) | (User.email == request.email))).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username or email already taken")
        
    new_user = User(
        username=request.username,
        email=request.email,
        password_hash=get_password_hash(request.password)
    )
    session.add(new_user)
    session.commit()
    
    # Send a Welcome Email automatically!
    send_automated_email(
        to_email=new_user.email,
        subject="Welcome to Street Code 101",
        body=f"Yo @{new_user.username},\n\nWelcome to the ledger. Your account has been created."
    )
    
    return {"message": "Registration successful. Check your email."}

@router.post("/api/admin/login")
def login(request: AuthRequest, session: Session = Depends(get_session)):
    """Unified login for Master Admin and Public Users."""
    # 1. Check for Master Admin override
    if request.username.lower() == "admin":
        if request.password != ADMIN_PASS:
            raise HTTPException(status_code=401, detail="Invalid password")
        expire = datetime.now(timezone.utc) + timedelta(hours=12)
        token = jwt.encode({"sub": "admin", "exp": expire}, SECRET_KEY, algorithm="HS256")
        return {"access_token": token, "is_admin": True}
        
    # 2. Check Postgres for Public Users
    user = session.exec(select(User).where(User.username == request.username)).first()
    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")
        
    expire = datetime.now(timezone.utc) + timedelta(days=7)
    token = jwt.encode({"sub": user.username, "exp": expire}, SECRET_KEY, algorithm="HS256")
    return {"access_token": token, "is_admin": False}

@router.get("/api/profile/me")
def get_my_profile(session: Session = Depends(get_session), token: dict = Depends(verify_token)):
    """Fetches the profile of the currently logged-in user."""
    username = token.get("sub")
    if username == "admin":
        return {"username": "admin", "bio": "Master Admin Override", "profile_image_url": "/dragon_logo.png"}
        
    user = session.exec(select(User).where(User.username == username)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.patch("/api/profile/me")
def update_my_profile(payload: ProfileUpdate, session: Session = Depends(get_session), token: dict = Depends(verify_token)):
    """Updates the user's bio."""
    username = token.get("sub")
    if username == "admin":
        raise HTTPException(status_code=400, detail="Admin bio cannot be updated here")
        
    user = session.exec(select(User).where(User.username == username)).first()
    user.bio = payload.bio
    session.add(user)
    session.commit()
    return {"message": "Profile updated successfully"}

@router.get("/api/products", response_model=List[Product])
def get_catalog(session: Session = Depends(get_session)):
    """Fetches the catalog directly from PostgreSQL."""
    return session.exec(select(Product)).all()

@router.post("/api/products")
def create_product(
    sku: str = Form(...),
    title: str = Form(...),
    description: str = Form(...),
    price: float = Form(...),
    category: str = Form(...),
    in_stock: str = Form(...), 
    file: UploadFile = File(None),
    session: Session = Depends(get_session),
    token: dict = Depends(verify_token)
):
    """Creates a new product and uploads its image to MinIO (SECURED)."""
    image_url = "https://via.placeholder.com/150"
    
    if file:
        try:
            file_extension = file.filename.split(".")[-1]
            unique_filename = f"{uuid.uuid4().hex}.{file_extension}"
            
            s3_client.upload_fileobj(
                file.file,
                BUCKET_NAME,
                unique_filename,
                ExtraArgs={"ContentType": file.content_type}
            )
            image_url = f"https://streetcode101.com/{BUCKET_NAME}/{unique_filename}"
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to upload image: {str(e)}")

    is_in_stock = in_stock.lower() == 'true'

    new_product = Product(
        sku=sku,
        title=title,
        description=description,
        price=price,
        category=category,
        in_stock=is_in_stock,
        image_url=image_url
    )
    
    session.add(new_product)
    session.commit()
    session.refresh(new_product)
    
    return new_product

@router.get("/api/products/{sku}", response_model=Product)
def get_product(sku: str, session: Session = Depends(get_session)):
    product = session.get(Product, sku)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

@router.delete("/api/products/{sku}")
def delete_product(sku: str, session: Session = Depends(get_session), token: dict = Depends(verify_token)):
    """Deletes a product from the database (SECURED)."""
    product = session.get(Product, sku)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    session.delete(product)
    session.commit()
    return {"message": f"Product {sku} permanently deleted."}

class PaymentIntentRequest(BaseModel):
    amount: float  # The cart total in dollars

@router.post("/api/create-payment-intent")
def create_payment_intent(req: PaymentIntentRequest):
    """Securely requests a PaymentIntent session from Stripe."""
    try:
        # Stripe processes amounts in cents (e.g., $10.00 = 1000)
        amount_in_cents = int(req.amount * 100)
        
        intent = stripe.PaymentIntent.create(
            amount=amount_in_cents,
            currency="usd",
            automatic_payment_methods={"enabled": True},
        )
        
        return {"clientSecret": intent.client_secret}
    except Exception as e:
        print(f"❌ STRIPE ERROR: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/api/checkout")
def submit_order(order_data: Order, session: Session = Depends(get_session)):
    """Saves a new customer order to the database."""
    product = session.get(Product, order_data.sku)
    if not product or not product.in_stock:
        raise HTTPException(status_code=400, detail="Product unavailable")

    session.add(order_data)
    session.commit()
    session.refresh(order_data)
    
    # --- SEND AUTOMATED CONFIRMATION EMAIL ---
    email_body = (
        f"Thanks for dropping with us!\n\n"
        f"We've successfully received your order for '{product.title}' (SKU: {order_data.sku}).\n"
        f"Quantity: {order_data.quantity}\n\n"
        f"Shipping to:\n{order_data.shipping_address}\n\n"
        f"We will email you again the moment your tracking number is generated. Stay tuned!"
    )
    
    send_automated_email(
        to_email=order_data.customer_email,
        subject=f"Street Code 101 - Order Confirmation #{order_data.id}",
        body=email_body
    )

    return {
        "order_id": order_data.id,
        "status": order_data.status,
        "message": "Order saved securely to database!"
    }

@router.get("/api/orders", response_model=List[Order])
def get_all_orders(session: Session = Depends(get_session), token: dict = Depends(verify_token)):
    """Fetches all customer orders for the admin dashboard (SECURED)."""
    return session.exec(select(Order)).all()

@router.get("/api/orders/{order_id}")
def get_order_status(order_id: int, session: Session = Depends(get_session)):
    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order

@router.post("/api/admin/trigger-sync")
def trigger_manual_sync(token: dict = Depends(verify_token)):
    """Triggers the Celery worker to sync inventory in the background (SECURED)."""
    from tasks import sync_inventory_task
    
    task = sync_inventory_task.delay()
    return {"message": "Background sync triggered successfully", "task_id": task.id}

@router.post("/api/admin/upload-image")
def upload_product_image(file: UploadFile = File(...), token: dict = Depends(verify_token)):
    """Uploads an image to MinIO/S3 and returns the public URL (SECURED)."""
    try:
        file_extension = file.filename.split(".")[-1]
        unique_filename = f"{uuid.uuid4().hex}.{file_extension}"
        
        s3_client.upload_fileobj(
            file.file,
            BUCKET_NAME,
            unique_filename,
            ExtraArgs={"ContentType": file.content_type}
        )
        
        file_url = f"https://streetcode101.com/{BUCKET_NAME}/{unique_filename}"
        
        return {"message": "Upload successful", "image_url": file_url}
        
    except Exception as e:
        print(f"\n❌ UPLOAD CRASHED: {str(e)}\n")
        raise HTTPException(status_code=500, detail=f"Failed to upload to cloud storage: {str(e)}")

@router.patch("/api/admin/products/{sku}/image")
def update_product_image(sku: str, payload: ImageUpdate, session: Session = Depends(get_session), token: dict = Depends(verify_token)):
    """Updates a product's image URL in the database (SECURED)."""
    product = session.get(Product, sku)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    product.image_url = payload.image_url
    session.add(product)
    session.commit()
    session.refresh(product)
    
    return {"message": "Product image updated!", "product": product}

@router.patch("/api/admin/orders/{order_id}/status")
def update_order_status(order_id: int, payload: OrderStatusUpdate, session: Session = Depends(get_session), token: dict = Depends(verify_token)):
    """Updates an order's status and triggers fulfillment emails (SECURED)."""
    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    order.status = payload.status
    session.add(order)
    session.commit()
    session.refresh(order)
    
    if payload.status == "shipped":
        from tasks import process_fulfillment_task
        process_fulfillment_task.delay(order.id)
        
        # Fire off the shipping notification to the customer
        send_automated_email(
            to_email=order.customer_email,
            subject="📦 Your Street Code 101 Drop has Shipped!",
            body=f"Great news!\n\nYour order (#{order.id}) for item '{order.sku}' has officially shipped. Tracking details will be generated shortly."
        )
        return {"message": f"Order {order_id} marked as shipped. Fulfillment & emails triggered!"}
        
    return {"message": f"Order {order_id} status updated to {payload.status}"}

@router.get("/api/profile/{username}")
def get_public_profile(username: str, session: Session = Depends(get_session)):
    """Fetches the public profile of any user (No authentication required)."""
    if username.lower() == "admin":
        return {
            "username": "admin", 
            "bio": "Official Street Code 101 Storefront", 
            "profile_image_url": "/dragon_logo.png"
        }
        
    user = session.exec(select(User).where(User.username == username)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # We return a specific dictionary to ensure we NEVER accidentally leak the password_hash!
    return {
        "username": user.username,
        "bio": user.bio,
        "profile_image_url": user.profile_image_url
    }

# --- PASSWORD RECOVERY ---

# You should use the same SECRET_KEY you used for login
RESET_SECRET_KEY = "your_super_secret_jwt_key_here" 
ALGORITHM = "HS256"

@router.post("/api/auth/forgot-password")
def forgot_password(req: ForgotPasswordRequest, session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.email == req.email)).first()
    
    if not user:
        return {"message": "If an account exists, a reset link was sent."}
    
    # Generate a temporary JWT that expires in 15 minutes
    expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    reset_token = jwt.encode({"sub": user.username, "exp": expire}, RESET_SECRET_KEY, algorithm=ALGORITHM)
    
    reset_link = f"http://localhost:5173/reset-password?token={reset_token}"
    
    # Fire the actual SMTP email using your existing dispatcher!
    send_automated_email(
        to_email=user.email,
        subject="Street Code 101 - Password Reset",
        body=f"Yo @{user.username},\n\nWe received a request to reset your password. Click the secure link below to create a new one. This link expires in 15 minutes.\n\n{reset_link}\n\nIf you did not request this, you can safely ignore this email."
    )
    
    print(f"DEBUG: Password reset link for {user.username} -> {reset_link}")
    
    return {"message": "If an account exists, a reset link was sent."}

@router.post("/api/auth/reset-password")
def reset_password(req: ResetPasswordRequest, session: Session = Depends(get_session)):
    try:
        payload = jwt.decode(req.token, RESET_SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=400, detail="Invalid token structure.")
    except JWTError:
        raise HTTPException(status_code=400, detail="Token is invalid or expired.")
        
    user = session.exec(select(User).where(User.username == username)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
        
    # Use your native bcrypt hashing function instead of passlib!
    user.password_hash = get_password_hash(req.new_password)
    session.add(user)
    session.commit()
    
    return {"message": "Password updated successfully."}

@router.post("/api/profile/me/image")
def upload_profile_image(file: UploadFile = File(...), session: Session = Depends(get_session), token: dict = Depends(verify_token)):
    """Uploads a new avatar to MinIO and updates the user's profile (SECURED)."""
    username = token.get("sub")
    if username == "admin":
        raise HTTPException(status_code=400, detail="Admin cannot change avatar here")
        
    user = session.exec(select(User).where(User.username == username)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    try:
        # Save avatars in a specific folder structure inside your bucket
        file_extension = file.filename.split(".")[-1]
        unique_filename = f"avatars/{uuid.uuid4().hex}.{file_extension}"
        
        s3_client.upload_fileobj(
            file.file,
            BUCKET_NAME,
            unique_filename,
            ExtraArgs={"ContentType": file.content_type}
        )
        
        file_url = f"https://streetcode101.com/{BUCKET_NAME}/{unique_filename}"
        
        # Save the new image URL directly to the user's database record
        user.profile_image_url = file_url
        session.add(user)
        session.commit()
        session.refresh(user)
        
        return {"message": "Avatar updated successfully", "profile_image_url": file_url}
        
    except Exception as e:
        print(f"\n❌ AVATAR UPLOAD CRASHED: {str(e)}\n")
        raise HTTPException(status_code=500, detail=f"Failed to upload avatar: {str(e)}")

@router.post("/api/profile/me/listings")
def create_vendor_listing(
    title: str = Form(...),
    description: str = Form(...),
    price: float = Form(...),
    file: UploadFile = File(None),
    session: Session = Depends(get_session),
    token: dict = Depends(verify_token)
):
    """Allows a public user to post an item for sale to their wall and the social feed."""
    username = token.get("sub")
    if username == "admin":
        raise HTTPException(status_code=400, detail="Master Admin should use the official product catalog, not user walls.")

    image_url = "/default.png"
    
    if file:
        try:
            file_extension = file.filename.split(".")[-1]
            unique_filename = f"listings/{uuid.uuid4().hex}.{file_extension}"
            
            s3_client.upload_fileobj(
                file.file,
                BUCKET_NAME,
                unique_filename,
                ExtraArgs={"ContentType": file.content_type}
            )
            image_url = f"https://streetcode101.com/{BUCKET_NAME}/{unique_filename}"
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to upload listing image: {str(e)}")

    new_listing = VendorListing(
        username=username,
        title=title,
        description=description,
        price=price,
        image_url=image_url
    )
    
    session.add(new_listing)
    session.commit()
    session.refresh(new_listing)
    
    return new_listing

@router.get("/api/profile/{username}/listings")
def get_user_listings(username: str, session: Session = Depends(get_session)):
    """Fetches all items listed by a specific user for their Profile Wall."""
    listings = session.exec(
        select(VendorListing).where(VendorListing.username == username).order_by(VendorListing.id.desc())
    ).all()
    return listings

@router.get("/api/listings/feed")
def get_global_social_feed(session: Session = Depends(get_session)):
    """Fetches the global social feed of all peer-to-peer vendor items."""
    listings = session.exec(select(VendorListing).order_by(VendorListing.id.desc())).all()
    feed = []
    
    for item in listings:
        # Look up the user who posted this item
        user = session.exec(select(User).where(User.username == item.username)).first()
        
        # Determine the correct avatar
        avatar = "/default.png"
        if item.username == "admin":
            avatar = "/dragon_logo.png"
        elif user:
            avatar = user.profile_image_url
            
        # Bundle it all together
        feed.append({
            "id": item.id,
            "username": item.username,
            "title": item.title,
            "description": item.description,
            "price": item.price,
            "image_url": item.image_url,
            "created_at": item.created_at.isoformat() if item.created_at else None,
            "user_avatar": avatar
        })
        
    return feed

class CJSyncRequest(BaseModel):
    sku: str

@router.post("/api/admin/sync-cj")
def sync_cj_dropshipping(payload: CJSyncRequest, session: Session = Depends(get_session), token: dict = Depends(verify_token)):
    """Fetches a specific product from CJ Dropshipping API by SKU."""
    username = token.get("sub")
    if username != "admin":
        raise HTTPException(status_code=403, detail="Unauthorized. Master Admin only.")
        
    cj_api_key = os.getenv("CJ_API_KEY")
    if not cj_api_key:
        raise HTTPException(status_code=500, detail="CJ_API_KEY is missing from .env file!")

    target_sku = payload.sku.strip()
    if not target_sku:
        raise HTTPException(status_code=400, detail="No SKU provided.")

    # 1. Authenticate with CJ
    auth_url = "https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken"
    base_headers = {"User-Agent": "Mozilla/5.0"}
    
    auth_res = requests.post(auth_url, json={"apiKey": cj_api_key}, headers=base_headers, timeout=15)
    if not auth_res.ok or not auth_res.json().get("data"):
        raise HTTPException(status_code=500, detail=f"CJ API Auth Failed: {auth_res.text}")
        
    access_token = auth_res.json()["data"].get("accessToken")
    auth_headers = {**base_headers, "CJ-Access-Token": access_token}

    # 2. Prevent Duplicate Imports
    existing = session.exec(select(Product).where(Product.supplier_sku == target_sku)).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Product {target_sku} is already in your store!")

    # 3. Search CJ safely (Bulletproof encoding for exact SKUs)
    products_url = "https://developers.cjdropshipping.com/api2.0/v1/product/listV2"
    safe_params = {
        "page": 1,
        "size": 10,
        "keyWord": target_sku
    }
    prod_res = requests.get(products_url, headers=auth_headers, params=safe_params, timeout=15)
    
    if not prod_res.ok:
        raise HTTPException(status_code=500, detail="Failed to reach CJ API.")
        
    # 4. Extract data using the correct V2 Dictionary Keys!
    products = prod_res.json().get("data", {}).get("productList", [])
    if not products:
        raise HTTPException(status_code=404, detail=f"CJ returned 0 results for: {target_sku}")
        
    p = products[0] # Grab the exact match
    
    # Grab the real SPU from the API, even if we searched by title
    actual_spu = p.get("spu", target_sku)
    
    # Prevent duplicate insertions if we search by title instead of SPU
    if session.exec(select(Product).where(Product.supplier_sku == actual_spu)).first():
        raise HTTPException(status_code=400, detail=f"Product {actual_spu} is already in your store!")
    
    base_price = float(p.get("sellPrice", 15.00))
    markup_price = base_price * 2.5
    
    new_prod = Product(
        sku=f"101-{actual_spu[:8]}", 
        title=p.get("nameEn", "Premium CJ Drop"),
        description=f"Authentic dropshipped item. Supplier Ref: {actual_spu}",
        price=markup_price,
        image_url=p.get("bigImage", "/sb.png"), 
        in_stock=True,
        supplier_sku=actual_spu,
        category="uncategorized"
    )
    session.add(new_prod)
    session.commit()
    return {"message": f"Successfully imported {target_sku}!"}
# --- WEBSOCKET CONNECTION MANAGER ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, username: str):
        await websocket.accept()
        self.active_connections[username] = websocket

    def disconnect(self, username: str):
        if username in self.active_connections:
            del self.active_connections[username]

    async def send_personal_message(self, message: dict, receiver: str):
        if receiver in self.active_connections:
            await self.active_connections[receiver].send_json(message)

manager = ConnectionManager()

@router.get("/api/messages/{target_user}")
def get_chat_history(target_user: str, session: Session = Depends(get_session), token: dict = Depends(verify_token)):
    """Fetches historical messages between the logged-in user and the target user."""
    username = token.get("sub")
    messages = session.exec(
        select(Message)
        .where(
            ((Message.sender == username) & (Message.receiver == target_user)) |
            ((Message.sender == target_user) & (Message.receiver == username))
        )
        .order_by(Message.timestamp.asc())
    ).all()
    return messages

@router.websocket("/api/ws/chat/{token}")
async def websocket_chat(websocket: WebSocket, token: str):
    """Real-time WebSocket endpoint for direct messaging."""
    try:
        # Authenticate the WebSocket connection using the JWT
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        username = payload.get("sub")
    except:
        await websocket.close(code=1008)
        return

    await manager.connect(websocket, username)
    try:
        while True:
            data = await websocket.receive_json()
            receiver = data.get("receiver")
            text = data.get("text")
            
            # Save message to PostgreSQL
            new_msg = Message(sender=username, receiver=receiver, text=text)
            with Session(engine) as session:
                session.add(new_msg)
                session.commit()
                session.refresh(new_msg)
            
            msg_payload = {
                "id": new_msg.id,
                "sender": username,
                "receiver": receiver,
                "text": text,
                "timestamp": new_msg.timestamp.isoformat()
            }
            
            # Route to the receiver if they are online
            await manager.send_personal_message(msg_payload, receiver)
            # Echo back to the sender so their UI updates
            await websocket.send_json(msg_payload)
            
    except WebSocketDisconnect:
        manager.disconnect(username)

@router.get("/api/inbox")
def get_inbox(session: Session = Depends(get_session), token: dict = Depends(verify_token)):
    """Fetches all active conversations for the logged-in user."""
    username = token.get("sub")
    
    # Grab all messages where the user is either the sender or receiver, newest first
    messages = session.exec(
        select(Message)
        .where((Message.sender == username) | (Message.receiver == username))
        .order_by(Message.timestamp.desc())
    ).all()
    
    # Group them by the *other* person in the chat to create a unique list of conversations
    conversations = {}
    for msg in messages:
        contact = msg.receiver if msg.sender == username else msg.sender
        if contact not in conversations:
            conversations[contact] = {
                "contact": contact,
                "last_message": msg.text,
                "timestamp": msg.timestamp.isoformat(),
                "is_sender": msg.sender == username
            }
            
    # Return as a list
    return list(conversations.values())

class SupportMessageRequest(BaseModel):
    text: str

# --- PERSISTENT CART ENDPOINTS ---

class CartItemSync(BaseModel):
    sku: str
    quantity: int

class CartSyncRequest(BaseModel):
    items: List[CartItemSync]

@router.get("/api/cart")
def get_user_cart(session: Session = Depends(get_session), token: dict = Depends(verify_token)):
    """Fetches the saved cart for the logged-in user."""
    username = token.get("sub")
    
    # Get all saved cart items for this user
    saved_items = session.exec(select(CartItem).where(CartItem.username == username)).all()
    
    # We need to return the full product details so the frontend can render images/prices
    cart_products = []
    for item in saved_items:
        product = session.get(Product, item.sku)
        if product and product.in_stock:
            # Convert SQLAlchemy object to dictionary so we can inject the quantity
            prod_dict = product.dict()
            prod_dict["cart_quantity"] = item.quantity
            cart_products.append(prod_dict)
            
    return cart_products

@router.post("/api/cart/sync")
def sync_user_cart(req: CartSyncRequest, session: Session = Depends(get_session), token: dict = Depends(verify_token)):
    """Overwrites the user's saved cart in the database with the current browser state."""
    username = token.get("sub")
    
    # 1. Wipe the old cart for this user
    existing_items = session.exec(select(CartItem).where(CartItem.username == username)).all()
    for item in existing_items:
        session.delete(item)
        
    # 2. Save the new items
    for item in req.items:
        new_cart_item = CartItem(username=username, sku=item.sku, quantity=item.quantity)
        session.add(new_cart_item)
        
    session.commit()
    return {"message": "Cart synchronized securely."}

@router.post("/api/support/message")
def send_support_message(payload: SupportMessageRequest, session: Session = Depends(get_session), token: dict = Depends(verify_token)):
    """Saves a support message to the DB and emails the Admin via SMTP."""
    username = token.get("sub")
    
    # 1. Save to PostgreSQL so it shows up in the Admin Inbox
    new_msg = Message(sender=username, receiver="admin", text=payload.text)
    session.add(new_msg)
    session.commit()
    session.refresh(new_msg)

    # 2. Fire the SMTP Email Alert
    smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", 587))
    smtp_user = os.getenv("SMTP_USER")
    smtp_pass = os.getenv("SMTP_PASS")
    admin_email = os.getenv("ADMIN_EMAIL", smtp_user) # Fallback to sending to yourself
    
    if smtp_user and smtp_pass:
        try:
            msg = EmailMessage()
            msg.set_content(f"User @{username} sent a new support request from the storefront:\n\n{payload.text}\n\nLog in to the Admin Console to reply.")
            msg["Subject"] = f"🚨 New Support Ticket: @{username}"
            msg["From"] = smtp_user
            msg["To"] = admin_email
            
            server = smtplib.SMTP(smtp_server, smtp_port)
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)
            server.quit()
        except Exception as e:
            print(f"❌ SMTP ERROR: {str(e)}")
            # We don't raise an HTTPException here so the user still sees a "success" 
            # message even if your email server briefly hiccups.

    return {"message": "Support request transmitted."}
