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

class VendorListing(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(index=True) # Ties the listing to the specific user
    title: str
    description: str
    price: float
    image_url: str = Field(default="/default.png")
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
