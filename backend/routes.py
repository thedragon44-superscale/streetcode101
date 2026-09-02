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
import random
import string
import re
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
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, WebSocket, WebSocketDisconnect, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import bcrypt
from pydantic import BaseModel
from sqlmodel import Session, select
from typing import List

from database import get_session, engine
from models import Product, Order, User, Post, Like, Comment, Message, CartItem, PromoCode, LedgerSubscriber, Notification, Follow

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

class TopUpRequest(BaseModel):
    coins: int

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
    role: str = "customer"

class ProfileUpdate(BaseModel):
    bio: str | None = None
    email_opt_in: bool | None = None

class ImageUpdate(BaseModel):
    image_url: str

class OrderStatusUpdate(BaseModel):
    status: str

def send_automated_email(to_email: str, subject: str, body: str, html_body: str = None):
    """Universal SMTP dispatcher for welcomes, tracking, alerts, and HTML marketing."""
    smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", 587))
    smtp_user = os.getenv("SMTP_USER")
    smtp_pass = os.getenv("SMTP_PASS")
    
    if not smtp_user or not smtp_pass:
        print("⚠️ SMTP credentials missing. Email not sent.")
        return
        
    try:
        msg = EmailMessage()
        msg.set_content(body) # Fallback for plain-text email clients
        
        # Inject the HTML layer if provided
        if html_body:
            msg.add_alternative(html_body, subtype='html')
            
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
        password_hash=get_password_hash(request.password),
        role=request.role
    )
    session.add(new_user)
    session.commit()
    
    # Define the graphical HTML welcome email
    welcome_html = f"""
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
                        <!-- Header Image -->
                        <tr>
                            <td>
                                <img src="https://streetcode101.com/welcome-email.png" alt="Access Granted - Street Code 101" style="width: 100%; max-width: 600px; display: block; border: none;" />
                            </td>
                        </tr>
                        
                        <!-- Email Body -->
                        <tr>
                            <td style="padding: 40px 30px;">
                                <h2 style="color: #ffffff; margin-top: 0; font-size: 24px; letter-spacing: 1px;">WELCOME TO THE VAULT.</h2>
                                <p style="font-size: 15px; line-height: 1.6; margin-bottom: 30px;">Your access to Street Code 101 has been officially granted. You are now integrated into a closed-loop P2P dropshipping and virtual economy platform. Here is your operational briefing:</p>
                                
                                <!-- Feature 1: Storefront -->
                                <h3 style="color: #38bdf8; font-size: 16px; margin-bottom: 8px; text-transform: uppercase;">🛍️ The Storefront</h3>
                                <p style="font-size: 14px; line-height: 1.5; margin-top: 0; margin-bottom: 20px;">Gain direct access to exclusive drops spanning apparel, jewelry, and electronics, all backed by automated supply-chain fulfillment.</p>
                                
                                <!-- Feature 2: Social Feed -->
                                <h3 style="color: #f97316; font-size: 16px; margin-bottom: 8px; text-transform: uppercase;">🌐 P2P Social Timeline</h3>
                                <p style="font-size: 14px; line-height: 1.5; margin-top: 0; margin-bottom: 20px;">We are a ledger, not just a store. Post your own drops, share images, interact with other verified members, and build your community reputation.</p>
                                
                                <!-- Feature 3: Economy & Escrow -->
                                <h3 style="color: #10b981; font-size: 16px; margin-bottom: 8px; text-transform: uppercase;">💰 StreetCoin (SC) & Escrow</h3>
                                <p style="font-size: 14px; line-height: 1.5; margin-top: 0; margin-bottom: 20px;">Engage with our native digital economy. Hold StreetCoin in your wallet, lock funds securely in Escrow for P2P trades, and initiate fiat offramps directly to USD via Zelle.</p>
                                
                                <!-- Feature 4: Promos -->
                                <h3 style="color: #ec4899; font-size: 16px; margin-bottom: 8px; text-transform: uppercase;">🎟️ Encrypted Promos</h3>
                                <p style="font-size: 14px; line-height: 1.5; margin-top: 0; margin-bottom: 30px;">Monitor the network for admin broadcasts. VIP discount codes and limited-time vault access keys will be dispersed directly to registered users.</p>
                                
                                <!-- CTA Button -->
                                <div style="text-align: center; margin-top: 40px; margin-bottom: 20px;">
                                    <a href="https://streetcode101.com" style="background-color: #0ea5e9; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; display: inline-block;">Initialize Session</a>
                                </div>
                                
                                <!-- Compliance Opt-Out -->
                                <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #334155;">
                                    <p style="font-size: 11px; color: #64748b; line-height: 1.5; margin: 0;">
                                        You are receiving this email because you registered at Street Code 101.<br>
                                        <a href="https://streetcode101.com/api/unsubscribe/{new_user.email}" style="color: #64748b; text-decoration: underline;">Opt-out of marketing communications</a>
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

    send_automated_email(
        to_email=new_user.email,
        subject="Access Granted: Welcome to Street Code 101",
        body="Welcome to Street Code 101. Please enable HTML to view this message.",
        html_body=welcome_html
    )
    
    # Trigger the 24-hour drip campaign email via Celery worker
    from tasks import send_second_drip_email_task
    send_second_drip_email_task.apply_async(args=[new_user.email, new_user.username], countdown=86400)
    
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
    """Fetches the profile of the currently logged-in user (now supports Wallets)."""
    username = token.get("sub")
    
    user = session.exec(select(User).where(User.username == username)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Calculate network metrics
    followers_count = len(session.exec(select(Follow).where(Follow.following_username == username)).all())
    following_count = len(session.exec(select(Follow).where(Follow.follower_username == username)).all())
        
    return {
        "username": user.username,
        "bio": user.bio,
        "profile_image_url": user.profile_image_url,
        "email_opt_in": getattr(user, "email_opt_in", False),
        "followers_count": followers_count,
        "following_count": following_count,
        "wallet_balance": getattr(user, "wallet_balance", 0.0) # Expose the new wallet to the frontend!
    }

@router.patch("/api/profile/me")
def update_my_profile(payload: ProfileUpdate, session: Session = Depends(get_session), token: dict = Depends(verify_token)):
    """Updates the user's profile settings."""
    username = token.get("sub")
    if username == "admin":
        raise HTTPException(status_code=400, detail="Admin profile cannot be updated here")
        
    user = session.exec(select(User).where(User.username == username)).first()
    
    if payload.bio is not None:
        user.bio = payload.bio
    if payload.email_opt_in is not None:
        user.email_opt_in = payload.email_opt_in
        
    session.add(user)
    session.commit()
    return {"message": "Profile updated successfully"}

@router.get("/api/products", response_model=List[Product])
def get_catalog(
    offset: int = 0,
    limit: int = 20,
    category: str = "All",
    search: str = "",
    session: Session = Depends(get_session)
):
    """Fetches the catalog with pagination and optional filtering."""
    query = select(Product)
    
    if category and category != "All":
        query = query.where(Product.category == category)
        
    if search and search.strip():
        search_term = f"%{search.strip().lower()}%"
        query = query.where(Product.title.ilike(search_term) | Product.description.ilike(search_term))
        
    # Order by SKU to ensure stable pagination
    query = query.order_by(Product.sku).offset(offset).limit(limit)
    
    return session.exec(query).all()

@router.get("/api/search")
def global_search(q: str, session: Session = Depends(get_session)):
    """Searches both the Product catalog and the User roster."""
    if not q or len(q.strip()) < 1:
        return {"products": [], "users": []}
        
    search_term = f"%{q.strip()}%"
    raw_query = q.strip().lower()
    
    # 1. Search Products
    products = session.exec(
        select(Product).where(
            Product.title.ilike(search_term) | Product.description.ilike(search_term)
        ).limit(10)
    ).all()
    
    # 2. Search Users
    users = session.exec(
        select(User).where(User.username.ilike(search_term)).limit(10)
    ).all()
    
    safe_users = [
        {"username": u.username, "profile_image_url": u.profile_image_url} 
        for u in users
    ]
    
    # --- ADMIN INJECTION LOGIC ---
    # If the user's search query matches part of the word "admin", manually add it to the top!
    if raw_query in "admin":
        safe_users.insert(0, {"username": "admin", "profile_image_url": "/dragon_logo.png"})
    
    return {
        "products": products,
        "users": safe_users
    }

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

@router.patch("/api/admin/products/{sku}")
def edit_product_details(sku: str, payload: dict, session: Session = Depends(get_session), token: dict = Depends(verify_token)):
    """Allows the admin to manually edit any product's details."""
    username = token.get("sub")
    if username != "admin":
        raise HTTPException(status_code=403, detail="Master Admin only.")
        
    product = session.get(Product, sku)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    # Dynamically update only the fields provided from the frontend
    if "title" in payload:
        product.title = payload["title"]
    if "description" in payload:
        product.description = payload["description"]
    if "price" in payload:
        product.price = float(payload["price"])
    if "category" in payload:
        product.category = payload["category"]
    if "image_url" in payload:
        product.image_url = payload["image_url"]
    
    session.add(product)
    session.commit()
    session.refresh(product)
    
    return {"message": f"Successfully updated {sku}!", "product": product}

class CartItemMinimal(BaseModel):
    sku: str
    quantity: int

class PaymentIntentRequest(BaseModel):
    items: List[CartItemMinimal]
    promo_code: str | None = None

class PromoValidateRequest(BaseModel):
    code: str

optional_security = HTTPBearer(auto_error=False)

@router.post("/api/validate-promo")
def validate_promo(req: PromoValidateRequest, session: Session = Depends(get_session)):
    """Allows the frontend to visually validate a code before checkout."""
    promo = session.exec(select(PromoCode).where(PromoCode.code == req.code.upper(), PromoCode.is_active == True)).first()
    if not promo:
        raise HTTPException(status_code=400, detail="Invalid or expired promo code.")
    return {"code": promo.code, "discount_percent": promo.discount_percent}

def resolve_product_and_price(session: Session, sku: str):
    """Helper to find a product by base SKU or variant SKU."""
    product = session.get(Product, sku)
    if product:
        return product, product.price
    
    # Fallback: Search inside variants
    for p in session.exec(select(Product)).all():
        if p.variants:
            for v in p.variants:
                if v.get("variant_sku") == sku:
                    return p, float(v.get("price", p.price))
    return None, 0.0

@router.post("/api/create-payment-intent")
def create_payment_intent(
    req: PaymentIntentRequest, 
    session: Session = Depends(get_session),
    credentials: HTTPAuthorizationCredentials | None = Depends(optional_security)
):
    """Securely calculates price on the backend and requests a PaymentIntent."""
    
    base_total = 0.0
    for item in req.items:
        product, item_price = resolve_product_and_price(session, item.sku)
        if not product or not product.in_stock:
            raise HTTPException(status_code=400, detail=f"Product {item.sku} unavailable")
        base_total += item_price * item.quantity

    # 2. Calculate Total Discount
    total_discount_percent = 0.0
    
    # Apply User Vault Discount if logged in
    if credentials:
        try:
            payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=["HS256"])
            user = session.exec(select(User).where(User.username == payload.get("sub"))).first()
            if user:
                total_discount_percent += user.discount_percent
        except:
            pass # Ignore invalid tokens for guest checkouts

    # Apply Promo Code if provided
    if req.promo_code:
        promo = session.exec(select(PromoCode).where(PromoCode.code == req.promo_code.upper(), PromoCode.is_active == True)).first()
        if promo:
            total_discount_percent += promo.discount_percent
        else:
            raise HTTPException(status_code=400, detail="Invalid or inactive promo code")

    # 3. Final Math
    discount_multiplier = 1 - (total_discount_percent / 100)
    final_total = base_total * discount_multiplier
    amount_in_cents = int(final_total * 100)
    
    if amount_in_cents < 50:
        raise HTTPException(status_code=400, detail="Minimum charge is $0.50")

    try:
        intent = stripe.PaymentIntent.create(
            amount=amount_in_cents,
            currency="usd",
            automatic_payment_methods={"enabled": True},
        )
        return {"clientSecret": intent.client_secret, "finalTotal": final_total}
    except Exception as e:
        print(f"❌ STRIPE ERROR: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/api/checkout")
def submit_order(order_data: Order, session: Session = Depends(get_session)):
    """Saves a new customer order to the database (Stripe/Card Checkout)."""
    product, _ = resolve_product_and_price(session, order_data.sku)
    if not product or not product.in_stock:
        raise HTTPException(status_code=400, detail="Product unavailable")

    session.add(order_data)
    session.commit()
    session.refresh(order_data)
    
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

class StreetCoinCheckoutRequest(BaseModel):
    items: List[CartItemMinimal]
    promo_code: str | None = None
    customer_email: str
    shipping_address: str

@router.post("/api/checkout/streetcoin")
def checkout_with_streetcoin(req: StreetCoinCheckoutRequest, session: Session = Depends(get_session), token: dict = Depends(verify_token)):
    """Processes a cart checkout using StreetCoins and locks funds in Escrow."""
    username = token.get("sub")
    user = session.exec(select(User).where(User.username == username)).first()
    admin = session.exec(select(User).where(User.username == "admin")).first()
    
    if not user or not admin:
        raise HTTPException(status_code=404, detail="System routing error.")
        
    # 1. Calculate final exact total (including promos/vault discounts)
    base_total = 0.0
    for item in req.items:
        product, item_price = resolve_product_and_price(session, item.sku)
        if not product or not product.in_stock:
            raise HTTPException(status_code=400, detail=f"Product {item.sku} unavailable")
        base_total += item_price * item.quantity

    total_discount = getattr(user, "discount_percent", 0.0)
    if req.promo_code:
        promo = session.exec(select(PromoCode).where(PromoCode.code == req.promo_code.upper(), PromoCode.is_active == True)).first()
        if promo:
            total_discount += promo.discount_percent
            
    final_total = base_total * (1 - (total_discount / 100))
    
    # 2. Verify Wallet Balance
    if getattr(user, "wallet_balance", 0) < final_total:
        raise HTTPException(status_code=400, detail="Insufficient StreetCoin balance. Please top up your wallet.")
        
    # 3. Deduct from Buyer & Hold in Admin Escrow
    user.wallet_balance -= final_total
    admin.wallet_balance += final_total
    
    # 4. Log Immutable Escrow Transaction
    from models import Transaction
    tx = Transaction(
        sender_username=user.username,
        receiver_username="admin",
        amount=final_total,
        transaction_type="escrow_lock",
        status="completed"
    )
    
    session.add(user)
    session.add(admin)
    session.add(tx)
    
    # 5. Generate the Physical Orders
    for item in req.items:
        new_order = Order(
            sku=item.sku,
            quantity=item.quantity,
            customer_email=req.customer_email,
            shipping_address=req.shipping_address,
            status="processing"
        )
        session.add(new_order)
        
    session.commit()
    
    # 6. Dispatch Escrow Receipt
    send_automated_email(
        to_email=req.customer_email,
        subject="StreetCoin Escrow Locked - Order Confirmed",
        body=f"Yo @{user.username},\n\nYour order has been paid securely using {final_total:.2f} StreetCoins. The funds are currently locked in the Master Escrow Vault until the vendor ships your drop.\n\nShipping to:\n{req.shipping_address}\n\nStay tuned for tracking info."
    )
    
    return {"message": "Escrow secured and order placed."}

@router.post("/api/wallet/topup")
def create_wallet_topup(req: TopUpRequest, session: Session = Depends(get_session), token: dict = Depends(verify_token)):
    """Generates a native Stripe PaymentIntent to buy StreetCoins with exact fee coverage."""
    username = token.get("sub")
    user = session.exec(select(User).where(User.username == username)).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if req.coins <= 0:
        raise HTTPException(status_code=400, detail="Must purchase at least 1 coin")
        
    # THE SURCHARGE ALGORITHM
    total_usd = (req.coins + 0.30) / 0.971
    total_cents = int(round(total_usd * 100))
    
    try:
        intent = stripe.PaymentIntent.create(
            amount=total_cents,
            currency="usd",
            automatic_payment_methods={"enabled": True},
            metadata={
                'type': 'wallet_topup',
                'username': user.username,
                'coins': str(req.coins)
            }
        )
        return {"clientSecret": intent.client_secret, "totalUsd": total_usd}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/webhook")
async def stripe_webhook(request: Request, session: Session = Depends(get_session)):
    """Listens for successful Stripe events."""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, os.getenv("STRIPE_WEBHOOK_SECRET", "whsec_fallback")
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    # Native PaymentIntent success (Wallet Top-Up)
    if event['type'] == 'payment_intent.succeeded':
        payment_intent = event['data']['object']
        metadata = payment_intent.get('metadata', {})
        
        if metadata.get('type') == 'wallet_topup':
            username = metadata.get('username')
            coins_purchased = float(metadata.get('coins'))
            
            from models import Transaction
            admin = session.exec(select(User).where(User.username == "admin")).first()
            user = session.exec(select(User).where(User.username == username)).first()
            
            if admin and user and getattr(admin, "wallet_balance", 0) >= coins_purchased:
                admin.wallet_balance -= coins_purchased
                user.wallet_balance += coins_purchased
                
                tx = Transaction(
                    sender_username="admin",
                    receiver_username=user.username,
                    amount=coins_purchased,
                    transaction_type="onramp",
                    status="completed"
                )
                
                session.add(admin)
                session.add(user)
                session.add(tx)
                session.commit()
                print(f"💰 NATIVE TOP-UP SUCCESS: {coins_purchased} SC transferred to @{username}.")
                
            return {"status": "success"}

    # Hosted Checkout success (Physical Dropshipping Orders)
    elif event['type'] == 'checkout.session.completed':
        session_data = event['data']['object']
        metadata = session_data.get('metadata', {})
        
        if metadata.get('type') != 'wallet_topup':
            customer_email = session_data.get("customer_details", {}).get("email", "unknown@email.com")
            shipping_details = session_data.get("shipping_details", {}).get("address", {})
            address_str = f"{shipping_details.get('line1', '')}, {shipping_details.get('city', '')}, {shipping_details.get('state', '')} {shipping_details.get('postal_code', '')}"
            sku = metadata.get("sku", "UNKNOWN")
            quantity = int(metadata.get("quantity", 1))

            new_order = Order(
                sku=sku,
                quantity=quantity,
                customer_email=customer_email,
                shipping_address=address_str,
                status="processing"
            )
            session.add(new_order)
            session.commit()
            return {"status": "success"}

    return {"status": "success"}

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

# Optional security allows us to see if the visitor is logged in (to check if they follow the user) without blocking guests
optional_security = HTTPBearer(auto_error=False)

@router.get("/api/profile/{username}")
def get_public_profile(
    username: str, 
    session: Session = Depends(get_session),
    credentials: HTTPAuthorizationCredentials | None = Depends(optional_security)
):
    """Fetches a public profile along with their follower/following stats."""
    
    # 1. Figure out who is visiting the profile
    visitor_username = None
    if credentials:
        try:
            payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=["HS256"])
            visitor_username = payload.get("sub")
        except:
            pass

    # 2. Calculate network metrics
    followers_count = len(session.exec(select(Follow).where(Follow.following_username == username)).all())
    following_count = len(session.exec(select(Follow).where(Follow.follower_username == username)).all())
    
    is_following = False
    if visitor_username:
        check_follow = session.exec(
            select(Follow).where((Follow.follower_username == visitor_username) & (Follow.following_username == username))
        ).first()
        if check_follow:
            is_following = True

    # 3. Handle Admin override
    if username.lower() == "admin":
        return {
            "username": "admin", 
            "bio": "Official Street Code 101 Storefront", 
            "profile_image_url": "/dragon_logo.png",
            "followers_count": followers_count,
            "following_count": following_count,
            "is_following": is_following
        }
        
    # 4. Handle standard users
    user = session.exec(select(User).where(User.username == username)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    return {
        "username": user.username,
        "bio": user.bio,
        "profile_image_url": user.profile_image_url,
        "followers_count": followers_count,
        "following_count": following_count,
        "is_following": is_following
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
    
    reset_link = f"https://streetcode101.com/reset-password?token={reset_token}"
    
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
class CommentCreate(BaseModel):
    text: str

@router.post("/api/posts")
def create_social_post(
    post_type: str = Form(...),
    description: str = Form(...),
    title: str = Form(None),
    price: float = Form(None),
    file: UploadFile = File(None),
    session: Session = Depends(get_session),
    token: dict = Depends(verify_token)
):
    """Creates a text, image, or vendor drop post."""
    username = token.get("sub")
    image_url = None
    
    if file:
        try:
            file_extension = file.filename.split(".")[-1]
            unique_filename = f"posts/{uuid.uuid4().hex}.{file_extension}"
            
            s3_client.upload_fileobj(
                file.file,
                BUCKET_NAME,
                unique_filename,
                ExtraArgs={"ContentType": file.content_type}
            )
            image_url = f"https://streetcode101.com/{BUCKET_NAME}/{unique_filename}"
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Image upload failed: {str(e)}")

    new_post = Post(
        username=username,
        post_type=post_type,
        description=description,
        title=title,
        price=price,
        image_url=image_url
    )
    
    session.add(new_post)
    session.commit()
    session.refresh(new_post)
    
    # --- MENTION ENGINE: POSTS ---
    mentioned_usernames = set(re.findall(r'@([a-zA-Z0-9_]+)', description))
    for mentioned in mentioned_usernames:
        if mentioned == username:
            continue
        mentioned_user = session.exec(select(User).where(User.username == mentioned)).first()
        if mentioned_user:
            new_notif = Notification(
                receiver_username=mentioned,
                actor_username=username,
                action="mentioned you in a post",
                post_id=new_post.id
            )
            session.add(new_notif)
            if getattr(mentioned_user, "email_opt_in", False):
                send_automated_email(
                    to_email=mentioned_user.email,
                    subject="You were mentioned in a Drop!",
                    body=f"Yo @{mentioned_user.username},\n\n@{username} just mentioned you in a post:\n\"{description}\"\n\nLog in to check it out."
                )
    session.commit()

    return {
        "id": new_post.id,
        "username": new_post.username,
        "post_type": new_post.post_type,
        "title": new_post.title,
        "description": new_post.description,
        "price": new_post.price,
        "image_url": new_post.image_url,
        "created_at": new_post.created_at.isoformat() if new_post.created_at else None,
        "likes_count": 0,
        "comments_count": 0
    }

@router.get("/api/posts/user/{target_username}")
def get_user_posts(target_username: str, session: Session = Depends(get_session)):
    """Fetches a specific user's wall with engagement metrics."""
    posts = session.exec(
        select(Post).where(Post.username == target_username).order_by(Post.id.desc())
    ).all()
    
    wall = []
    for p in posts:
        like_count = len(session.exec(select(Like).where(Like.post_id == p.id)).all())
        comment_count = len(session.exec(select(Comment).where(Comment.post_id == p.id)).all())
        
        wall.append({
            "id": p.id,
            "username": p.username,
            "post_type": p.post_type,
            "title": p.title,
            "description": p.description,
            "price": p.price,
            "image_url": p.image_url,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "likes_count": like_count,
            "comments_count": comment_count
        })
    return wall

@router.get("/api/posts/feed")
def get_global_feed(
    filter: str = "global",
    offset: int = 0,
    limit: int = 10,
    session: Session = Depends(get_session),
    credentials: HTTPAuthorizationCredentials | None = Depends(optional_security)
):
    """Fetches the timeline, supporting both Global and Following modes with pagination."""
    if filter == "following":
        if not credentials:
            raise HTTPException(status_code=401, detail="Log in to view your following feed.")
        try:
            payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=["HS256"])
            username = payload.get("sub")
        except:
            raise HTTPException(status_code=401, detail="Invalid token.")
            
        following_records = session.exec(select(Follow).where(Follow.follower_username == username)).all()
        following_usernames = [f.following_username for f in following_records]
        following_usernames.append(username) 
        
        posts = session.exec(
            select(Post).where(Post.username.in_(following_usernames)).order_by(Post.id.desc()).offset(offset).limit(limit)
        ).all()
    else:
        posts = session.exec(select(Post).order_by(Post.id.desc()).offset(offset).limit(limit)).all()
        
    feed = []
    for p in posts:
        user = session.exec(select(User).where(User.username == p.username)).first()
        avatar = "/default.png"
        if p.username == "admin":
            avatar = "/dragon_logo.png"
        elif user:
            avatar = user.profile_image_url
            
        like_count = len(session.exec(select(Like).where(Like.post_id == p.id)).all())
        comment_count = len(session.exec(select(Comment).where(Comment.post_id == p.id)).all())
            
        feed.append({
            "id": p.id,
            "username": p.username,
            "post_type": p.post_type,
            "title": p.title,
            "description": p.description,
            "price": p.price,
            "image_url": p.image_url,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "user_avatar": avatar,
            "likes_count": like_count,
            "comments_count": comment_count
        })
        
    return feed

@router.get("/api/posts/{id}")
def get_single_post(id: int, session: Session = Depends(get_session)):
    """Fetches a single post with engagement metrics for the standalone view."""
    p = session.get(Post, id)
    if not p:
        raise HTTPException(status_code=404, detail="Post not found")
        
    user = session.exec(select(User).where(User.username == p.username)).first()
    avatar = "/default.png"
    if p.username == "admin":
        avatar = "/dragon_logo.png"
    elif user:
        avatar = user.profile_image_url
        
    like_count = len(session.exec(select(Like).where(Like.post_id == p.id)).all())
    comment_count = len(session.exec(select(Comment).where(Comment.post_id == p.id)).all())
    
    return {
        "id": p.id,
        "username": p.username,
        "post_type": p.post_type,
        "title": p.title,
        "description": p.description,
        "price": p.price,
        "image_url": p.image_url,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "user_avatar": avatar,
        "likes_count": like_count,
        "comments_count": comment_count
    }

@router.delete("/api/posts/{id}")
def delete_post(id: int, session: Session = Depends(get_session), token: dict = Depends(verify_token)):
    """Allows Admin (or the author) to delete a post."""
    username = token.get("sub")
    post = session.get(Post, id)
    
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
        
    if username != "admin" and username != post.username:
        raise HTTPException(status_code=403, detail="Unauthorized")
        
    session.delete(post)
    session.commit()
    return {"message": "Post permanently removed."}


class PostEditRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    price: float | None = None

@router.patch("/api/posts/{id}")
def edit_post(id: int, payload: PostEditRequest, session: Session = Depends(get_session), token: dict = Depends(verify_token)):
    """Allows the author to edit their own post."""
    username = token.get("sub")
    post = session.get(Post, id)
    
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
        
    if post.username != username:
        raise HTTPException(status_code=403, detail="Unauthorized. You can only edit your own posts.")
        
    if payload.title is not None:
        post.title = payload.title
    if payload.description is not None:
        post.description = payload.description
    if payload.price is not None:
        post.price = payload.price
        
    session.add(post)
    session.commit()
    session.refresh(post)
    return {"message": "Post updated successfully", "post": post}

from fastapi.responses import HTMLResponse

@router.get("/api/unsubscribe/{email}", response_class=HTMLResponse)
def unsubscribe_user(email: str, session: Session = Depends(get_session)):
    # 1. Update the marketing list
    subscriber = session.query(LedgerSubscriber).filter(LedgerSubscriber.email == email).first()
    if subscriber:
        subscriber.is_subscribed = False
        
    # 2. Update the main User table opt-in flag for maximum coverage
    user = session.query(User).filter(User.email == email).first()
    if user:
        user.email_opt_in = False
        
    session.commit()
    
    return f"""
    <!DOCTYPE html>
    <html>
    <body style="margin: 0; background-color: #0f172a; color: #f8fafc; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh;">
        <div style="text-align: center; padding: 40px; border: 1px solid #1e293b; border-radius: 12px; background-color: #020617;">
            <h2 style="margin-top: 0;">Unsubscribed Successfully</h2>
            <p style="color: #94a3b8;"><b>{email}</b> has been removed from our marketing ledger.</p>
            <p style="color: #94a3b8;">You will still receive critical alerts (receipts, password resets).</p>
            <a href="https://streetcode101.com" style="color: #f97316; text-decoration: none; font-weight: bold; margin-top: 20px; display: inline-block;">Return to Store</a>
        </div>
    </body>
    </html>
    """

# --- NEW ENGAGEMENT ENDPOINTS ---

@router.get("/api/notifications")
def get_my_notifications(session: Session = Depends(get_session), token: dict = Depends(verify_token)):
    """Fetches all notifications for the logged-in user and marks them as read."""
    username = token.get("sub")
    notifs = session.exec(
        select(Notification)
        .where(Notification.receiver_username == username)
        .order_by(Notification.created_at.desc())
        .limit(30)
    ).all()
    
    # 1. Extract the data safely BEFORE we commit and expire the objects
    safe_notifs = []
    for n in notifs:
        safe_notifs.append({
            "id": n.id,
            "receiver_username": n.receiver_username,
            "actor_username": n.actor_username,
            "action": n.action,
            "post_id": n.post_id,
            "is_read": n.is_read,
            "created_at": n.created_at.isoformat() if n.created_at else None
        })
    
    # 2. Mark as read so the red dot clears
    for n in notifs:
        if not n.is_read:
            n.is_read = True
            session.add(n)
    session.commit()
    
    # 3. Return the safe data
    return safe_notifs

@router.post("/api/users/{target_username}/follow")
def toggle_follow(target_username: str, session: Session = Depends(get_session), token: dict = Depends(verify_token)):
    """Toggles following/unfollowing a user."""
    current_user = token.get("sub")
    
    if current_user == target_username:
        raise HTTPException(status_code=400, detail="You cannot follow yourself.")
        
    target = session.exec(select(User).where(User.username == target_username)).first()
    if not target and target_username != "admin":
        raise HTTPException(status_code=404, detail="User not found.")
        
    existing_follow = session.exec(
        select(Follow).where((Follow.follower_username == current_user) & (Follow.following_username == target_username))
    ).first()
    
    if existing_follow:
        session.delete(existing_follow)
        session.commit()
        return {"message": f"Unfollowed @{target_username}", "is_following": False}
    else:
        new_follow = Follow(follower_username=current_user, following_username=target_username)
        session.add(new_follow)
        
        # Fire off a notification!
        if target_username != "admin":
            new_notif = Notification(
                receiver_username=target_username,
                actor_username=current_user,
                action="started following you",
                post_id=0 # 0 indicates a profile-level notification, not a post
            )
            session.add(new_notif)
            
            if getattr(target, "email_opt_in", False):
                send_automated_email(
                    to_email=target.email,
                    subject="You have a new follower!",
                    body=f"Yo @{target.username},\n\n@{current_user} just started following you on Street Code 101!\n\nLog in to check out their profile."
                )
                
        session.commit()
        return {"message": f"Following @{target_username}", "is_following": True}

@router.post("/api/posts/{post_id}/like")
def toggle_like(post_id: int, session: Session = Depends(get_session), token: dict = Depends(verify_token)):
    """Toggles a like on or off for the current user."""
    username = token.get("sub")
    post = session.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    existing_like = session.exec(select(Like).where((Like.post_id == post_id) & (Like.username == username))).first()
    
    if existing_like:
        session.delete(existing_like)
        session.commit()
        return {"message": "Unliked", "liked": False}
    else:
        new_like = Like(post_id=post_id, username=username)
        session.add(new_like)
        
        # Generate Notification & Email Alert
        if post.username != username:
            new_notif = Notification(
                receiver_username=post.username,
                actor_username=username,
                action="liked your post",
                post_id=post.id
            )
            session.add(new_notif)
            
            post_owner = session.exec(select(User).where(User.username == post.username)).first()
            if post_owner and getattr(post_owner, "email_opt_in", False):
                send_automated_email(
                    to_email=post_owner.email,
                    subject="New Like on your Drop!",
                    body=f"Yo @{post_owner.username},\n\n@{username} just liked your recent post!\nLog in to see who's interacting with your drops."
                )
                
        session.commit()
        return {"message": "Liked", "liked": True}

@router.get("/api/posts/{post_id}/comments")
def get_comments(post_id: int, session: Session = Depends(get_session)):
    """Fetches all comments for a specific post."""
    return session.exec(select(Comment).where(Comment.post_id == post_id).order_by(Comment.created_at.asc())).all()

@router.post("/api/posts/{post_id}/comments")
def add_comment(post_id: int, payload: CommentCreate, session: Session = Depends(get_session), token: dict = Depends(verify_token)):
    """Posts a new comment."""
    username = token.get("sub")
    post = session.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
        
    new_comment = Comment(post_id=post_id, username=username, text=payload.text)
    session.add(new_comment)
    
    # 1. Post Owner Notification
    if post.username != username:
        new_notif = Notification(
            receiver_username=post.username,
            actor_username=username,
            action="commented on your post",
            post_id=post.id
        )
        session.add(new_notif)
        
        post_owner = session.exec(select(User).where(User.username == post.username)).first()
        if post_owner and getattr(post_owner, "email_opt_in", False):
            send_automated_email(
                to_email=post_owner.email,
                subject="New Comment on your Drop!",
                body=f"Yo @{post_owner.username},\n\n@{username} just commented on your post:\n\"{payload.text}\"\n\nLog in to reply!"
            )

    # --- MENTION ENGINE: COMMENTS ---
    mentioned_usernames = set(re.findall(r'@([a-zA-Z0-9_]+)', payload.text))
    for mentioned in mentioned_usernames:
        if mentioned == username or mentioned == post.username: # Prevent self-tags and double-notifying the post owner
            continue
        mentioned_user = session.exec(select(User).where(User.username == mentioned)).first()
        if mentioned_user:
            mention_notif = Notification(
                receiver_username=mentioned,
                actor_username=username,
                action="mentioned you in a comment",
                post_id=post.id
            )
            session.add(mention_notif)
            if getattr(mentioned_user, "email_opt_in", False):
                send_automated_email(
                    to_email=mentioned_user.email,
                    subject="You were mentioned in a Comment!",
                    body=f"Yo @{mentioned_user.username},\n\n@{username} just mentioned you in a comment:\n\"{payload.text}\"\n\nLog in to check it out."
                )
            
    session.commit()
    session.refresh(new_comment)
    return new_comment

class CJSyncRequest(BaseModel):
    sku: str

def fetch_cj_product_data(target_sku: str, cj_api_key: str):
    """Hits listV2 to extract the hidden 'id', then hits Deep Query to extract variants."""
    auth_url = "https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken"
    base_headers = {"User-Agent": "Mozilla/5.0"}
    
    auth_res = requests.post(auth_url, json={"apiKey": cj_api_key}, headers=base_headers, timeout=15)
    if not auth_res.ok or not auth_res.json().get("data"):
        return None
        
    access_token = auth_res.json()["data"].get("accessToken")
    auth_headers = {**base_headers, "CJ-Access-Token": access_token}

    # STEP 1: Search listV2 to grab the 'id'
    search_url = "https://developers.cjdropshipping.com/api2.0/v1/product/listV2"
    search_res = requests.get(search_url, headers=auth_headers, params={"page": 1, "size": 1, "keyWord": target_sku}, timeout=15)
    
    content_list = search_res.json().get("data", {}).get("content", [])
    if not content_list or not content_list[0].get("productList"):
        return None
        
    actual_pid = content_list[0].get("productList")[0].get("id")
    if not actual_pid:
        return None

    # STEP 2: Use 'id' for Deep Query
    query_url = "https://developers.cjdropshipping.com/api2.0/v1/product/query"
    query_res = requests.get(query_url, headers=auth_headers, params={"pid": actual_pid}, timeout=15)
    p = query_res.json().get("data")
    
    if not p:
        return None
        
    base_price = float(p.get("sellPrice", 15.00))
    cj_variants = p.get("variants", [])
    parsed_variants = []
    
    for v in cj_variants:
        v_key = v.get("variantKey", "Default")
        parts = v_key.split("-")
        color = parts[0] if len(parts) > 0 else "Default"
        size = parts[-1] if len(parts) > 1 else "OS"
        
        parsed_variants.append({
            "variant_sku": v.get("variantSku", ""),
            "color": color,
            "size": size,
            "price": float(v.get("variantSellPrice", base_price)) * 2.5,
            "image_url": v.get("variantImage", p.get("productImage", p.get("bigImage", "/sb.png")))
        })
        
    if not parsed_variants:
        parsed_variants = [{"variant_sku": f"101-{target_sku[:8]}-DEF", "color": "Default", "size": "OS", "price": base_price * 2.5, "image_url": p.get("productImage", p.get("bigImage", "/sb.png"))}]
        
    p["nameEn"] = p.get("productNameEn", p.get("nameEn", "Premium CJ Drop"))
    
    # Safely extract an image
    main_img = p.get("productImage") or p.get("bigImage")
    
    # SANITIZER: If CJ sends a list of images, extract just the first one
    if isinstance(main_img, list) and len(main_img) > 0:
        main_img = main_img[0]
    elif isinstance(main_img, str) and main_img.strip().startswith("["):
        try:
            import json
            parsed_imgs = json.loads(main_img)
            if isinstance(parsed_imgs, list) and len(parsed_imgs) > 0:
                main_img = parsed_imgs[0]
        except:
            pass # Fall back to the raw string if parsing fails
            
    # Fallback to variant image or default
    if not main_img and parsed_variants:
        main_img = parsed_variants[0].get("image_url")
    p["bigImage"] = main_img or "/sb.png"
    
    p["sku"] = p.get("productSku", target_sku)
        
    return {"base_data": p, "variants": parsed_variants}


@router.post("/api/admin/sync-cj")
def sync_cj_dropshipping(payload: CJSyncRequest, session: Session = Depends(get_session), token: dict = Depends(verify_token)):
    """Fetches a specific product from CJ Dropshipping API by SKU, including variants."""
    username = token.get("sub")
    if username != "admin":
        raise HTTPException(status_code=403, detail="Unauthorized.")
        
    cj_api_key = os.getenv("CJ_API_KEY")
    target_sku = payload.sku.strip()
    
    existing = session.exec(select(Product).where(Product.supplier_sku == target_sku)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Product already exists. Use Resync.")

    cj_data = fetch_cj_product_data(target_sku, cj_api_key)
    if not cj_data:
        raise HTTPException(status_code=404, detail=f"CJ returned 0 results for: {target_sku}")
        
    p = cj_data["base_data"]
    actual_sku = p.get("sku", target_sku)
    markup_price = float(p.get("sellPrice", 15.00)) * 2.5
    
    new_prod = Product(
        sku=f"101-{actual_sku[:8]}", 
        title=p.get("nameEn", "Premium CJ Drop"),
        description=f"Authentic dropshipped item. Supplier Ref: {actual_sku}",
        price=markup_price,
        image_url=p.get("bigImage", "/sb.png"), 
        in_stock=True,
        supplier_sku=actual_sku,
        variants=cj_data["variants"]
    )
    session.add(new_prod)
    session.commit()
    session.refresh(new_prod)
    return {"message": f"Successfully imported {new_prod.title} with variants!", "product": new_prod}


@router.post("/api/admin/resync-all-variants")
def resync_all_variants(session: Session = Depends(get_session), token: dict = Depends(verify_token)):
    """API endpoint for UI resyncing using the optimized logic."""
    username = token.get("sub")
    if username != "admin":
        raise HTTPException(status_code=403, detail="Unauthorized.")
        
    cj_api_key = os.getenv("CJ_API_KEY")
    products = session.exec(select(Product)).all()
    updated = 0
    
    for prod in products:
        if not prod.supplier_sku:
            continue
            
        cj_data = fetch_cj_product_data(prod.supplier_sku, cj_api_key)
        if cj_data:
            prod.variants = cj_data["variants"]
            session.add(prod)
            updated += 1
            
    session.commit()
    return {"message": f"Successfully resynced variants for {updated} products!"}


@router.patch("/api/admin/products/{sku}/featured")
def toggle_featured_product(sku: str, session: Session = Depends(get_session), token: dict = Depends(verify_token)):
    """Sets a product as the Featured Drop and un-features all others."""
    username = token.get("sub")
    if username != "admin":
        raise HTTPException(status_code=403, detail="Unauthorized")
        
    product = session.get(Product, sku)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    # Un-feature all other products to ensure only ONE crown exists
    existing_featured = session.exec(select(Product).where(Product.is_featured == True)).all()
    for p in existing_featured:
        p.is_featured = False
        session.add(p)
        
    # Feature the selected product
    product.is_featured = True
    session.add(product)
    session.commit()
    
    return {"message": f"{product.title} is now the Featured Drop!"}


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

class BroadcastRequest(BaseModel):
    subject: str
    image_url: str
    headline: str
    body_text: str
    promo_code: str | None = None
    cta_text: str = "Shop The Drop"
    cta_link: str = "https://streetcode101.com"

@router.post("/api/admin/broadcast")
def send_marketing_broadcast(payload: BroadcastRequest, session: Session = Depends(get_session), token: dict = Depends(verify_token)):
    # Security Check: Only admin can fire blasts
    if token.get("sub") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Fetch all subscribed emails who haven't opted out
    subscribers = session.query(LedgerSubscriber).filter(LedgerSubscriber.is_subscribed == True).all()
    if not subscribers:
        raise HTTPException(status_code=404, detail="No subscribers found.")

    # Conditionally render the Promo Code block
    promo_html = ""
    if payload.promo_code:
        promo_html = f"""
        <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom: 30px;">
            <tr>
                <td align="center">
                    <div style="background-color: #1e293b; border: 2px dashed #334155; border-radius: 12px; padding: 20px; display: inline-block;">
                        <p style="margin: 0 0 5px 0; color: #94a3b8; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Promo Code</p>
                        <p style="margin: 0; color: #f97316; font-family: monospace; font-size: 26px; font-weight: 900; letter-spacing: 3px;">{payload.promo_code}</p>
                    </div>
                </td>
            </tr>
        </table>
        """

    # Dynamic HTML Template
    html_template = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{payload.subject}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
        <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #f8fafc; padding: 40px 10px;">
            <tr>
                <td align="center">
                    <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="max-width: 600px; background-color: #0f172a; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
                        <tr>
                            <td align="center" style="padding: 30px 20px; background-color: #020617; border-bottom: 1px solid #1e293b;">
                                <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase;">
                                    STREET CODE <span style="color: #f97316;">101</span>
                                </h1>
                            </td>
                        </tr>
                        <tr>
                            <td align="center" style="background-color: #0f172a;">
                                <img src="{payload.image_url}" alt="Promo Graphic" width="600" style="width: 100%; max-width: 600px; height: auto; display: block; border: 0;" />
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 40px 30px; text-align: center;">
                                <h2 style="margin: 0 0 15px 0; color: #ffffff; font-size: 28px; font-weight: 900; text-transform: uppercase; letter-spacing: -0.5px;">
                                    {payload.headline}
                                </h2>
                                <p style="margin: 0 0 25px 0; color: #94a3b8; font-size: 16px; line-height: 1.6; font-weight: 500;">
                                    {payload.body_text}
                                </p>
                                {promo_html}
                                <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
                                    <tr>
                                        <td align="center">
                                            <a href="{payload.cta_link}" style="display: inline-block; background-color: #f97316; color: #0f172a; text-decoration: none; padding: 18px 40px; font-size: 14px; font-weight: 900; border-radius: 12px; text-transform: uppercase; letter-spacing: 1px;">
                                                {payload.cta_text}
                                            </a>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        <tr>
                            <td align="center" style="padding: 30px; background-color: #020617; border-top: 1px solid #1e293b;">
                                <p style="margin: 0 0 10px 0; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">
                                    The Peer-to-Peer Ledger
                                </p>
                                <p style="margin: 0; color: #475569; font-size: 11px;">
                                    © 2026 Street Code 101. All rights reserved.
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """
    
    plain_fallback = f"{payload.headline}\n\n{payload.body_text}\n\n{payload.cta_link}"
    
    sent_count = 0
    for sub in subscribers:
        send_automated_email(
            to_email=sub.email,
            subject=payload.subject,
            body=plain_fallback,
            html_body=html_template
        )
        sent_count += 1
        
    return {"message": f"Broadcast sent to {sent_count} subscribers successfully."}

import boto3
import uuid
import os
from fastapi import UploadFile, File

@router.post("/api/admin/upload-image")
async def upload_marketing_image(file: UploadFile = File(...), token: dict = Depends(verify_token)):
    if token.get("sub") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Authenticate with the MinIO bucket
    s3_client = boto3.client(
        's3',
        endpoint_url=os.getenv('AWS_ENDPOINT_URL', 'http://127.0.0.1:9000'),
        aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID', 'stars_admin'),
        aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY', '1234567890'),
    )
    bucket_name = os.getenv('AWS_STORAGE_BUCKET_NAME', 'dropship')
    
    # Generate a unique filename so old promos aren't overwritten
    file_ext = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
    unique_filename = f"marketing/{uuid.uuid4().hex}.{file_ext}"
    
    try:
        # Upload directly to your local bucket
        s3_client.upload_fileobj(
            file.file, 
            bucket_name, 
            unique_filename,
            ExtraArgs={"ContentType": file.content_type}
        )
        # Construct the live public URL through your domain
        public_url = f"https://streetcode101.com/{bucket_name}/{unique_filename}"
        return {"url": public_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload to bucket: {str(e)}")

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

class PromoGenerateRequest(BaseModel):
    base_word: str
    discount_percent: float

@router.get("/api/admin/promos")
def get_all_promos(session: Session = Depends(get_session), token: dict = Depends(verify_token)):
    """Fetches all promo codes for the admin dashboard."""
    if token.get("sub") != "admin":
        raise HTTPException(status_code=403, detail="Unauthorized")
    return session.exec(select(PromoCode).order_by(PromoCode.id.desc())).all()

@router.post("/api/admin/promos")
def generate_promo(req: PromoGenerateRequest, session: Session = Depends(get_session), token: dict = Depends(verify_token)):
    """Generates a secure 16-character promo code."""
    if token.get("sub") != "admin":
        raise HTTPException(status_code=403, detail="Unauthorized")
        
    clean_word = req.base_word.strip().upper()[:10] # Max 10 chars to leave room for randomness
    prefix = f"{clean_word}-" if clean_word else ""
    remaining_length = 16 - len(prefix)
    
    # Generate the random suffix
    chars = string.ascii_uppercase + string.digits
    suffix = ''.join(random.choices(chars, k=max(0, remaining_length)))
    
    final_code = prefix + suffix
    
    new_promo = PromoCode(code=final_code, discount_percent=req.discount_percent)
    session.add(new_promo)
    session.commit()
    session.refresh(new_promo)
    return new_promo

@router.patch("/api/admin/promos/{id}/toggle")
def toggle_promo_status(id: int, session: Session = Depends(get_session), token: dict = Depends(verify_token)):
    """Kill switch to instantly activate or deactivate a promo code."""
    if token.get("sub") != "admin":
        raise HTTPException(status_code=403, detail="Unauthorized")
        
    promo = session.get(PromoCode, id)
    if not promo:
        raise HTTPException(status_code=404, detail="Promo not found")
        
    promo.is_active = not promo.is_active
    session.add(promo)
    session.commit()
    session.refresh(promo)
    return {"message": f"Promo {promo.code} is now {'Active' if promo.is_active else 'Inactive'}", "promo": promo}


class SupportMessageRequest(BaseModel):
    text: str

class GuestSupportRequest(BaseModel):
    email: str
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
    
    saved_items = session.exec(select(CartItem).where(CartItem.username == username)).all()
    
    cart_products = []
    for item in saved_items:
        product, item_price = resolve_product_and_price(session, item.sku)
        if product and product.in_stock:
            prod_dict = product.dict()
            prod_dict["cart_quantity"] = item.quantity
            prod_dict["sku"] = item.sku
            prod_dict["price"] = item_price
            
            if product.variants:
                for v in product.variants:
                    if v.get("variant_sku") == item.sku:
                        prod_dict["title"] = f"{product.title} ({v.get('color', '')} / {v.get('size', '')})"
                        prod_dict["image_url"] = v.get("image_url", product.image_url)
                        
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

@router.post("/api/support/guest-message")
def send_guest_support_message(payload: GuestSupportRequest, session: Session = Depends(get_session)):
    """Saves a guest support message and emails the Admin via SMTP."""
    # Prefix the email so you know it's a guest in your DB
    sender_id = f"guest:{payload.email}"
    
    new_msg = Message(sender=sender_id, receiver="admin", text=payload.text)
    session.add(new_msg)
    session.commit()

    smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", 587))
    smtp_user = os.getenv("SMTP_USER")
    smtp_pass = os.getenv("SMTP_PASS")
    admin_email = os.getenv("ADMIN_EMAIL", smtp_user)
    
    if smtp_user and smtp_pass:
        try:
            msg = EmailMessage()
            msg.set_content(f"Guest ({payload.email}) sent a support request from the storefront:\n\n{payload.text}\n\nYou must reply to them via their email address directly.")
            msg["Subject"] = f"🚨 New Guest Ticket: {payload.email}"
            msg["From"] = smtp_user
            msg["To"] = admin_email
            
            server = smtplib.SMTP(smtp_server, smtp_port)
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)
            server.quit()
        except Exception as e:
            print(f"❌ SMTP ERROR: {str(e)}")

    return {"message": "Support request transmitted."}

# --- LEDGER SUBSCRIPTION & COMMUNITY ENDPOINTS ---

class SubscribeRequest(BaseModel):
    email: str

class UserDiscountUpdate(BaseModel):
    discount_percent: float

class AdminEmailRequest(BaseModel):
    subject: str
    body: str

@router.post("/api/subscribe")
def subscribe_newsletter(req: SubscribeRequest, session: Session = Depends(get_session)):
    """Saves marketing leads to the database and issues the vault code."""
    existing = session.exec(select(LedgerSubscriber).where(LedgerSubscriber.email == req.email)).first()
    
    if not existing:
        new_sub = LedgerSubscriber(email=req.email)
        session.add(new_sub)
        session.commit()
        
        plain_text_fallback = "You're officially on the list. Use code VAULT-Q70KHNSF5G at checkout to claim your drop. Create an account to permanently secure your vault access."
        
        html_template = f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Welcome to Street Code 101</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
            <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #f8fafc; padding: 40px 10px;">
                <tr>
                    <td align="center">
                        <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="max-width: 600px; background-color: #0f172a; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
                            <tr>
                                <td align="center" style="padding: 30px 20px; background-color: #020617; border-bottom: 1px solid #1e293b;">
                                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase;">
                                        STREET CODE <span style="color: #f97316;">101</span>
                                    </h1>
                                </td>
                            </tr>
                            <tr>
                                <td align="center" style="background-color: #0f172a;">
                                    <img src="https://images.unsplash.com/photo-1550639525-c97d455acf70?q=80&w=600&auto=format&fit=crop" alt="Welcome to the Vault" width="600" style="width: 100%; max-width: 600px; height: auto; display: block; border: 0;" />
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 40px 30px; text-align: center;">
                                    <h2 style="margin: 0 0 15px 0; color: #ffffff; font-size: 28px; font-weight: 900; text-transform: uppercase; letter-spacing: -0.5px;">
                                        Welcome to the Ledger
                                    </h2>
                                    <p style="margin: 0 0 25px 0; color: #94a3b8; font-size: 16px; line-height: 1.6; font-weight: 500;">
                                        You're officially on the list. You now have exclusive access to our community drops, vendor network, and secure marketplace. Use the secure vault code below at checkout to claim your introductory drop:
                                    </p>
                                    <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom: 30px;">
                                        <tr>
                                            <td align="center">
                                                <div style="background-color: #1e293b; border: 2px dashed #334155; border-radius: 12px; padding: 20px; display: inline-block;">
                                                    <p style="margin: 0 0 5px 0; color: #94a3b8; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Introductory Code</p>
                                                    <p style="margin: 0; color: #f97316; font-family: monospace; font-size: 26px; font-weight: 900; letter-spacing: 3px;">VAULT-Q70KHNSF5G</p>
                                                </div>
                                            </td>
                                        </tr>
                                    </table>
                                    <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
                                        <tr>
                                            <td align="center">
                                                <a href="https://streetcode101.com" style="display: inline-block; background-color: #f97316; color: #0f172a; text-decoration: none; padding: 18px 40px; font-size: 14px; font-weight: 900; border-radius: 12px; text-transform: uppercase; letter-spacing: 1px;">
                                                    Enter The Vault
                                                </a>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                            <tr>
                                <td align="center" style="padding: 30px; background-color: #020617; border-top: 1px solid #1e293b;">
                                    <p style="margin: 0 0 10px 0; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">
                                        The Peer-to-Peer Ledger
                                    </p>
                                    <p style="margin: 0; color: #475569; font-size: 11px;">
                                        © 2026 Street Code 101. All rights reserved.<br>
                                    </p>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
        """
        
        # Fire the dual-layer automated welcome email
        send_automated_email(
            to_email=req.email,
            subject="Welcome to the 101 Ledger",
            body=plain_text_fallback,
            html_body=html_template
        )

    # Return the updated code
    return {"message": "Access Granted", "code": "VAULT-Q70KHNSF5G"}

@router.get("/api/admin/users")
def get_all_users(session: Session = Depends(get_session), token: dict = Depends(verify_token)):
    """Fetches the community roster for the Admin Dashboard."""
    if token.get("sub") != "admin":
        raise HTTPException(status_code=403, detail="Unauthorized")
        
    users = session.exec(select(User).order_by(User.id.desc())).all()
    # Strip out password hashes before returning to the frontend
    return [
        {
            "id": u.id, 
            "username": u.username, 
            "email": u.email, 
            "profile_image_url": u.profile_image_url, 
            "discount_percent": u.discount_percent, 
            "is_verified": u.is_verified
        } for u in users
    ]

@router.patch("/api/admin/users/{username}/discount")
def update_user_discount(username: str, payload: UserDiscountUpdate, session: Session = Depends(get_session), token: dict = Depends(verify_token)):
    """Allows Admin to permanently adjust a user's base Vault discount."""
    if token.get("sub") != "admin":
        raise HTTPException(status_code=403, detail="Unauthorized")
        
    user = session.exec(select(User).where(User.username == username)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.discount_percent = payload.discount_percent
    session.add(user)
    session.commit()
    
    return {"message": f"Updated @{username}'s base discount to {payload.discount_percent}%"}

@router.post("/api/admin/users/{username}/email")
def email_user_directly(username: str, payload: AdminEmailRequest, session: Session = Depends(get_session), token: dict = Depends(verify_token)):
    """Utilizes the SMTP dispatcher to email a user directly from the Admin console."""
    if token.get("sub") != "admin":
        raise HTTPException(status_code=403, detail="Unauthorized")
        
    user = session.exec(select(User).where(User.username == username)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    send_automated_email(to_email=user.email, subject=payload.subject, body=payload.body)
    return {"message": f"Secure email dispatched to @{username}"}

class TrackingRequest(BaseModel):
    tracking_number: str

@router.get("/api/vendor/dashboard")
def get_vendor_dashboard(session: Session = Depends(get_session), token: dict = Depends(verify_token)):
    """Fetches live escrow metrics and fulfillment queue for the vendor."""
    username = token.get("sub")
    user = session.exec(select(User).where(User.username == username)).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Fetch all orders (Reverse chronological order)
    orders = session.exec(select(Order).order_by(Order.id.desc())).all()
    
    formatted_orders = []
    escrow_balance = 0.0
    total_sales = 0
    
    for o in orders:
        product, price = resolve_product_and_price(session, o.sku)
        order_total = price * o.quantity if product else 0.0
        total_sales += 1
        
        if o.status == "processing":
            escrow_balance += order_total
            
        formatted_orders.append({
            "id": f"ORD-{o.id}",
            "raw_id": o.id,
            "productName": product.title if product else f"SKU: {o.sku}",
            "buyerUsername": o.customer_email.split('@')[0], 
            "shippingAddress": o.shipping_address,
            "date": "Just now", 
            "price": order_total,
            "status": o.status,
            "escrowStatus": "locked" if o.status == "processing" else "released",
            "trackingNumber": getattr(o, "tracking_number", "")
        })
        
    return {
        "availableBalance": getattr(user, "wallet_balance", 0.0),
        "escrowBalance": escrow_balance,
        "totalSales": total_sales,
        "orders": formatted_orders
    }

def verify_tracking_live(tracking_number: str) -> tuple[bool, str]:
    """Auto-detects the carrier and pings the live network to verify the label exists."""
    tracking = tracking_number.strip().upper()
    
    # 1. Regex Carrier Auto-Detection
    carrier = "usps"
    if re.match(r"^1Z[0-9A-Z]{16}$", tracking):
        carrier = "ups"
    elif re.match(r"^[0-9]{12,15}$", tracking):
        carrier = "fedex"
    elif re.match(r"^9[0-9]{19,21}$", tracking):
        carrier = "usps"
    else:
        return False, "Unrecognized tracking format. Must be a valid UPS, USPS, or FedEx number."
        
    # 2. Live API Ping (Shippo)
    shippo_api_key = os.getenv("SHIPPO_API_KEY")
    if not shippo_api_key:
        # Fallback: If you haven't added your API key yet, it passes the Regex check so your app doesn't crash during development
        return True, "Valid Regex Format (Live Verification Bypassed - Missing API Key)"
        
    try:
        url = f"https://api.goshippo.com/tracks/{carrier}/{tracking}"
        headers = {"Authorization": f"ShippoToken {shippo_api_key}"}
        res = requests.get(url, headers=headers, timeout=10)
        
        if res.status_code == 404:
            return False, "Carrier network has no record of this tracking number."
            
        data = res.json()
        tracking_status = data.get("tracking_status", {})
        
        if not tracking_status:
            return False, "Tracking number format valid, but carrier status is unknown."
            
        # Usually status is "UNKNOWN", "PRE_TRANSIT", "TRANSIT", "DELIVERED", "RETURNED", "FAILURE"
        # We reject "UNKNOWN" to prevent vendors from inputting dead labels that haven't registered
        if tracking_status.get("status") == "UNKNOWN":
            return False, "Label not yet recognized by carrier. Please wait until it updates to 'Pre-Transit' before releasing escrow."
            
        return True, "Tracking verified live."
        
    except Exception as e:
        return False, f"Live verification failed: {str(e)}"


@router.post("/api/vendor/orders/{order_id}/ship")
def release_escrow(order_id: int, req: TrackingRequest, session: Session = Depends(get_session), token: dict = Depends(verify_token)):
    """Logs the tracking number, verifies it against carrier networks, and releases Escrow."""
    username = token.get("sub")
    vendor = session.exec(select(User).where(User.username == username)).first()
    admin = session.exec(select(User).where(User.username == "admin")).first()
    
    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status == "shipped":
        raise HTTPException(status_code=400, detail="Escrow already released")
        
    # --- FIRE THE LIVE VERIFICATION ---
    is_valid, message = verify_tracking_live(req.tracking_number)
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)
        
    order.status = "shipped"
    order.tracking_number = req.tracking_number
    
    # Process the Escrow Release
    product, price = resolve_product_and_price(session, order.sku)
    payout = price * order.quantity
    
    if admin and vendor and admin.wallet_balance >= payout:
        admin.wallet_balance -= payout
        vendor.wallet_balance += payout
        
        from models import Transaction
        tx = Transaction(
            sender_username="admin",
            receiver_username=vendor.username,
            amount=payout,
            transaction_type="escrow_release",
            status="completed"
        )
        session.add(admin)
        session.add(vendor)
        session.add(tx)
        
    session.commit()
    
    send_automated_email(
        to_email=order.customer_email,
        subject=f"Street Code 101 - Order Shipped! #{order.id}",
        body=f"Great news!\n\nYour drop has officially shipped.\nTracking Number: {req.tracking_number}\n\nStay street."
    )
    
    return {"message": "Escrow released successfully."}
    
    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status == "shipped":
        raise HTTPException(status_code=400, detail="Escrow already released")
        
    order.status = "shipped"
    order.tracking_number = req.tracking_number
    
    # Process the Escrow Release
    product, price = resolve_product_and_price(session, order.sku)
    payout = price * order.quantity
    
    if admin and vendor and admin.wallet_balance >= payout:
        admin.wallet_balance -= payout
        vendor.wallet_balance += payout
        
        from models import Transaction
        tx = Transaction(
            sender_username="admin",
            receiver_username=vendor.username,
            amount=payout,
            transaction_type="escrow_release",
            status="completed"
        )
        session.add(admin)
        session.add(vendor)
        session.add(tx)
        
    session.commit()
    
    send_automated_email(
        to_email=order.customer_email,
        subject=f"Street Code 101 - Order Shipped! #{order.id}",
        body=f"Great news!\n\nYour drop has officially shipped.\nTracking Number: {req.tracking_number}\n\nStay street."
    )
    
    return {"message": "Escrow released successfully."}

class CashoutSubmitRequest(BaseModel):
    amount_coins: float
    zelle_contact: str

@router.post("/api/vendor/cashout")
def submit_cashout_request(req: CashoutSubmitRequest, session: Session = Depends(get_session), token: dict = Depends(verify_token)):
    """Locks coins from the vendor's wallet and submits a Zelle cashout request."""
    from models import CashoutRequest
    
    username = token.get("sub")
    user = session.exec(select(User).where(User.username == username)).first()
    admin = session.exec(select(User).where(User.username == "admin")).first()
    
    if req.amount_coins < 10:
        raise HTTPException(status_code=400, detail="Minimum cashout is 10 SC.")
        
    if getattr(user, "wallet_balance", 0) < req.amount_coins:
        raise HTTPException(status_code=400, detail="Insufficient StreetCoin balance.")
        
    # 5% Platform Infrastructure Tax
    usd_payout = req.amount_coins * 0.95
    
    # Deduct from vendor immediately to prevent double spending
    user.wallet_balance -= req.amount_coins
    admin.wallet_balance += req.amount_coins
    
    cashout = CashoutRequest(
        username=username,
        amount_coins=req.amount_coins,
        usd_payout=usd_payout,
        zelle_contact=req.zelle_contact,
        status="pending"
    )
    
    session.add(user)
    session.add(admin)
    session.add(cashout)
    session.commit()
    
    return {"message": "Cashout request submitted securely."}

@router.get("/api/admin/cashouts")
def get_admin_cashouts(session: Session = Depends(get_session), token: dict = Depends(verify_token)):
    if token.get("sub") != "admin":
        raise HTTPException(status_code=403, detail="Unauthorized")
    from models import CashoutRequest
    return session.exec(select(CashoutRequest).order_by(CashoutRequest.id.desc())).all()

@router.post("/api/admin/cashouts/{req_id}/approve")
def approve_cashout(req_id: int, session: Session = Depends(get_session), token: dict = Depends(verify_token)):
    if token.get("sub") != "admin":
        raise HTTPException(status_code=403, detail="Unauthorized")
        
    from models import CashoutRequest, Transaction
    cashout = session.get(CashoutRequest, req_id)
    
    if not cashout or cashout.status != "pending":
        raise HTTPException(status_code=400, detail="Invalid or already processed request.")
        
    admin = session.exec(select(User).where(User.username == "admin")).first()
    
    # Burn the coins from the master vault since fiat has physically left the ecosystem
    admin.wallet_balance -= cashout.amount_coins
    cashout.status = "approved"
    
    tx = Transaction(
        sender_username="admin",
        receiver_username=cashout.username,
        amount=cashout.amount_coins,
        transaction_type="offramp",
        status="completed"
    )
    
    session.add(admin)
    session.add(cashout)
    session.add(tx)
    session.commit()
    
    vendor = session.exec(select(User).where(User.username == cashout.username)).first()
    if vendor:
        send_automated_email(
            to_email=vendor.email,
            subject="Street Code 101 - Cashout Approved",
            body=f"Yo @{vendor.username},\n\nYour cashout of {cashout.amount_coins} SC has been fulfilled. ${cashout.usd_payout:.2f} USD has been dispatched to your Zelle: {cashout.zelle_contact}."
        )
        
    return {"message": "Cashout approved. Coins removed from circulation."}

@router.get("/api/admin/analytics")
def get_admin_analytics(session: Session = Depends(get_session), token: dict = Depends(verify_token)):
    """Calculates platform-wide financial metrics for the admin dashboard."""
    if token.get("sub") != "admin":
        raise HTTPException(status_code=403, detail="Unauthorized")
        
    from models import User, Order, CashoutRequest
    
    # 1. Total SC in Circulation (All user wallets combined, excluding admin vault)
    users = session.exec(select(User).where(User.username != "admin")).all()
    total_circulation = sum(getattr(u, "wallet_balance", 0.0) for u in users)
    
    # 2. Total Escrow Liability (Locked funds awaiting tracking numbers)
    processing_orders = session.exec(select(Order).where(Order.status == "processing")).all()
    escrow_liability = 0.0
    for o in processing_orders:
        product, price = resolve_product_and_price(session, o.sku)
        if product:
            escrow_liability += price * o.quantity
            
    # 3. Platform Tax Revenue (The 5% retained from fulfilled cashouts)
    completed_cashouts = session.exec(select(CashoutRequest).where(CashoutRequest.status == "approved")).all()
    total_revenue_usd = sum(c.amount_coins - c.usd_payout for c in completed_cashouts)
    
    return {
        "total_circulation": total_circulation,
        "escrow_liability": escrow_liability,
        "total_revenue_usd": total_revenue_usd
    }

# ==========================================
# SERVICE ECONOMY ENDPOINTS
# ==========================================

class ServiceCreateRequest(BaseModel):
    title: str
    description: str
    price: float
    service_type: str  # 'in_person' or 'remote'
    image_url: str = "/default_service.png"

@router.post("/api/services")
def create_service_listing(payload: ServiceCreateRequest, session: Session = Depends(get_session), token: dict = Depends(verify_token)):
    """Allows a verified Service Provider to post a new service to the catalog."""
    username = token.get("sub")
    user = session.exec(select(User).where(User.username == username)).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Security check: Only allow users who registered as service providers (or admin) to create listings
    if user.role != "service_provider" and username != "admin":
        raise HTTPException(status_code=403, detail="Only registered Service Providers can create listings.")
        
    from models import ServiceListing
    new_service = ServiceListing(
        provider_username=username,
        title=payload.title,
        description=payload.description,
        price=payload.price,
        service_type=payload.service_type,
        image_url=payload.image_url
    )
    
    session.add(new_service)
    session.commit()
    session.refresh(new_service)
    
    return {"message": "Service listing published successfully!", "service": new_service}

@router.get("/api/services")
def get_service_catalog(session: Session = Depends(get_session)):
    """Fetches all active service listings for the public storefront."""
    from models import ServiceListing
    # Fetch active services and order them newest first
    services = session.exec(select(ServiceListing).where(ServiceListing.is_active == True).order_by(ServiceListing.id.desc())).all()
    return services

class BookingRequest(BaseModel):
    service_id: int
    scheduled_start: str  # ISO 8601 string from the frontend date picker
    job_address: str | None = None
    target_lat: float | None = None
    target_long: float | None = None

@router.post("/api/appointments/book")
def book_service(payload: BookingRequest, session: Session = Depends(get_session), token: dict = Depends(verify_token)):
    """Locks StreetCoin in Escrow and schedules a service appointment."""
    from models import ServiceListing, Appointment, Transaction
    from dateutil import parser
    
    username = token.get("sub")
    client = session.exec(select(User).where(User.username == username)).first()
    admin = session.exec(select(User).where(User.username == "admin")).first()
    
    if not client or not admin:
        raise HTTPException(status_code=404, detail="System routing error.")

    # 1. Validate the Service
    service = session.get(ServiceListing, payload.service_id)
    if not service or not service.is_active:
        raise HTTPException(status_code=404, detail="Service not found or inactive.")
        
    if service.provider_username == username:
        raise HTTPException(status_code=400, detail="You cannot book your own service.")

    # 2. Verify Wallet Balance
    if getattr(client, "wallet_balance", 0) < service.price:
        raise HTTPException(status_code=400, detail="Insufficient StreetCoin balance. Please top up your wallet.")

    # 3. Deduct from Buyer & Hold in Admin Escrow
    client.wallet_balance -= service.price
    admin.wallet_balance += service.price
    
    # 4. Log Immutable Escrow Transaction
    tx = Transaction(
        sender_username=client.username,
        receiver_username="admin",
        amount=service.price,
        transaction_type="service_escrow_lock",
        status="completed"
    )
    
    # 5. Parse time and generate the Appointment
    try:
        start_time = parser.isoparse(payload.scheduled_start)
    except:
        raise HTTPException(status_code=400, detail="Invalid date format provided.")

    new_appt = Appointment(
        service_id=service.id,
        provider_username=service.provider_username,
        client_username=client.username,
        scheduled_start=start_time,
        job_address=payload.job_address,
        target_lat=payload.target_lat,
        target_long=payload.target_long,
        escrow_amount=service.price,
        status="locked"
    )

    session.add(client)
    session.add(admin)
    session.add(tx)
    session.add(new_appt)
    session.commit()
    session.refresh(new_appt)
    
    # 6. Dispatch Dual Notifications
    provider = session.exec(select(User).where(User.username == service.provider_username)).first()
    
    # Alert Client
    send_automated_email(
        to_email=client.email,
        subject="Service Booked & Escrow Locked",
        body=f"Yo @{client.username},\n\nYour appointment for '{service.title}' is confirmed for {start_time.strftime('%b %d, %Y at %I:%M %p')}.\n\n{service.price:.2f} SC has been securely locked in the Master Escrow Vault. It will not be released to @{service.provider_username} until the job is completed and verified."
    )
    
    # Alert Provider
    if provider:
        send_automated_email(
            to_email=provider.email,
            subject="New Booking Secured!",
            body=f"Yo @{provider.username},\n\n@{client.username} just booked you for '{service.title}' on {start_time.strftime('%b %d, %Y at %I:%M %p')}.\n\nThe funds ({service.price:.2f} SC) are already secured in Escrow. Check your Service Dashboard for address and check-in details."
        )

    return {"message": "Booking confirmed and funds secured in Escrow.", "appointment_id": new_appt.id}
