from sqlmodel import SQLModel, Field
from typing import Optional
from datetime import datetime, timezone
from sqlalchemy import Column, JSON

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(unique=True, index=True)
    email: str = Field(unique=True, index=True)
    password_hash: str
    bio: Optional[str] = None
    profile_image_url: str = Field(default="/default.png")
    is_verified: bool = Field(default=False)
    has_spun: bool = Field(default=False)
    discount_percent: float = Field(default=0.0)
    email_opt_in: bool = Field(default=False)
    wallet_balance: float = Field(default=0.0) # The StreetCoin Wallet
    role: str = Field(default="customer")  # Options: "customer", "vendor", "service_provider"
    primary_trade: Optional[str] = Field(default=None)
    push_token: Optional[str] = None

class Product(SQLModel, table=True):
    sku: str = Field(primary_key=True, index=True)
    title: str
    description: str
    price: float
    category: str = Field(default="uncategorized", index=True)
    image_url: str
    in_stock: bool
    supplier_sku: Optional[str] = None 
    variants: list = Field(default=[], sa_column=Column(JSON)) 
    is_featured: bool = Field(default=False) 

class Order(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    sku: str
    quantity: int
    customer_email: str
    shipping_address: str
    status: str = Field(default="processing")
    supplier_order_id: Optional[str] = None
    tracking_number: Optional[str] = None

class Post(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(index=True)
    post_type: str = Field(default="text") # 'text', 'image', or 'vendor_drop'
    description: str # This acts as the main text/body for ALL post types
    title: Optional[str] = None # Only used if it's a vendor_drop
    price: Optional[float] = None # Only used if it's a vendor_drop
    image_url: Optional[str] = None # Used for images and vendor_drops
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Like(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    post_id: int = Field(index=True)
    username: str = Field(index=True)

class Comment(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    post_id: int = Field(index=True)
    username: str
    text: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Message(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    sender: str = Field(index=True)
    receiver: str = Field(index=True)
    text: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CartItem(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(index=True)
    sku: str
    quantity: int = 1

class PromoCode(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    code: str = Field(unique=True, index=True)
    discount_percent: float
    is_active: bool = Field(default=True)
    usage_count: int = Field(default=0)

class LedgerSubscriber(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True)
    subscribed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_subscribed: bool = Field(default=True)

class Notification(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    receiver_username: str = Field(index=True)
    actor_username: str
    action: str # "liked your post" or "commented on your post"
    post_id: Optional[int] = None
    is_read: bool = Field(default=False)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Follow(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    follower_username: str = Field(index=True)
    following_username: str = Field(index=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Transaction(SQLModel, table=True):
    """The Immutable Double-Entry Ledger."""
    id: int | None = Field(default=None, primary_key=True)
    sender_username: str = Field(index=True)
    receiver_username: str = Field(index=True)
    amount: float
    # Types: 'onramp' (Stripe purchase), 'p2p_escrow' (Purchase), 'escrow_release' (Tracking verified), 'offramp' (Zelle cashout)
    transaction_type: str 
    status: str = Field(default="completed") # 'pending', 'completed', 'refunded'
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class P2POrder(SQLModel, table=True):
    """Tracks physical item sales and their Escrow state."""
    id: int | None = Field(default=None, primary_key=True)
    buyer_username: str = Field(index=True)
    vendor_username: str = Field(index=True)
    post_id: int
    amount: float
    shipping_address: str
    tracking_number: str | None = Field(default=None)
    # Statuses: 'pending_tracking', 'shipped', 'completed', 'cancelled', 'refunded'
    status: str = Field(default="pending_tracking") 
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CashoutRequest(SQLModel, table=True):
    """The Zelle Offramp Queue for the Master Admin."""
    id: int | None = Field(default=None, primary_key=True)
    username: str = Field(index=True)
    amount_coins: float
    usd_payout: float # The amount AFTER the platform tax
    zelle_contact: str # Email or Phone number for Zelle
    status: str = Field(default="pending") # 'pending', 'approved', 'rejected'
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

from typing import Optional
from datetime import datetime

class ServiceListing(SQLModel, table=True):
    """Catalog of available services (mechanics, dev work, haircuts)."""
    id: Optional[int] = Field(default=None, primary_key=True)
    provider_username: str
    title: str
    description: str
    price: float  # Base rate or flat fee
    service_type: str  # 'in_person' or 'remote'
    image_url: str = Field(default="/default_service.png")
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Appointment(SQLModel, table=True):
    """The Service equivalent of an Order, handling time and geolocation."""
    id: Optional[int] = Field(default=None, primary_key=True)
    service_id: int
    provider_username: str
    client_username: str
    status: str = Field(default="locked") # locked, checked_in, completed, disputed, released
    
    # Time & Location Constraints
    scheduled_start: datetime
    job_address: Optional[str] = None
    
    # Layer 1: GPS Verification (In-Person Services)
    target_lat: Optional[float] = None
    target_long: Optional[float] = None
    actual_lat: Optional[float] = None
    actual_long: Optional[float] = None
    checked_in_at: Optional[datetime] = None
    
    # Layer 2: Handshake & Proof (Remote & In-Person)
    proof_of_delivery_url: Optional[str] = None
    provider_completed_at: Optional[datetime] = None
    client_confirmed_at: Optional[datetime] = None
    
    # Financials
    escrow_amount: float
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Review(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    reviewer_username: str = Field(index=True)
    target_username: str = Field(index=True)
    appointment_id: int | None = Field(default=None)
    order_id: int | None = Field(default=None)
    rating: int = Field(ge=1, le=5)
    text: str | None = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)
