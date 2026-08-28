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
