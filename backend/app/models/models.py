from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Index, Table, UniqueConstraint
)
from sqlalchemy.orm import relationship
from backend.app.database import Base

customer_tags = Table(
    "customer_tags",
    Base.metadata,
    Column("customer_id", Integer, ForeignKey("customers.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True)
)

class Tag(Base):
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False, index=True)
    color = Column(String(20), default="#64748b")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    customers = relationship("Customer", secondary=customer_tags, back_populates="tag_items")

class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(String(255), nullable=True)
    color = Column(String(20), default="#10b981")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    customers = relationship("Customer", back_populates="category")

class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(150), nullable=False, index=True)
    phone = Column(String(30), unique=True, nullable=False, index=True) # Normalized E.164 digits without +
    formatted_phone = Column(String(40), nullable=False) # e.g. +1 555 123 4567
    email = Column(String(255), nullable=True, index=True)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    company = Column(String(150), nullable=True)
    tags = Column(String(500), nullable=True) # comma-separated tag list for backward compatibility
    lead_stage = Column(String(50), default="New", nullable=False) # "New", "Contacted", "Interested", "Converted", "Lost"
    
    # Consent management
    consent_status = Column(String(30), default="unverified", nullable=False) # "verified", "unverified", "opted_out"
    consent_source = Column(String(100), nullable=True) # e.g. "Web Form", "In Store", "Direct Request"
    consent_date = Column(DateTime, nullable=True)
    is_suppressed = Column(Boolean, default=False, nullable=False) # explicitly blocked/opted out
    
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    category = relationship("Category", back_populates="customers")
    campaign_recipients = relationship("CampaignRecipient", back_populates="customer")
    tag_items = relationship("Tag", secondary=customer_tags, back_populates="customers")
    consent_logs = relationship("ConsentAuditLog", back_populates="customer", cascade="all, delete-orphan")
    tasks = relationship("FollowUpTask", back_populates="customer", cascade="all, delete-orphan")
    inquiries = relationship("CustomerInquiry", back_populates="customer")

    __table_args__ = (
        Index("ix_customer_search", "full_name", "phone", "company"),
        Index("ix_customer_lead_stage", "lead_stage"),
    )

class MessageTemplate(Base):
    __tablename__ = "message_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False, index=True)
    body = Column(Text, nullable=False)
    description = Column(String(255), nullable=True)
    category = Column(String(100), nullable=True) # e.g. "Promotional", "Follow-up", "Transactional"
    header_type = Column(String(30), default="none") # "none", "image"
    header_media_url = Column(Text, nullable=True)
    buttons_json = Column(Text, nullable=True) # JSON array of interactive buttons: [{"id":"1","type":"quick_reply","text":"ENQUIRE"},{"id":"2","type":"quick_reply","text":"STOP"}]
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

class Campaign(Base):
    __tablename__ = "campaigns"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False, index=True)
    description = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    template_id = Column(Integer, ForeignKey("message_templates.id", ondelete="SET NULL"), nullable=True)
    message_body_snapshot = Column(Text, nullable=False) # Template text at creation time
    header_media_url = Column(Text, nullable=True)
    buttons_json = Column(Text, nullable=True)
    is_test_mode = Column(Boolean, default=False, nullable=False)
    
    status = Column(String(30), default="draft", nullable=False) # "draft", "in_progress", "completed", "cancelled"
    total_recipients = Column(Integer, default=0, nullable=False)
    opened_count = Column(Integer, default=0, nullable=False)
    sent_count = Column(Integer, default=0, nullable=False)
    delivered_count = Column(Integer, default=0, nullable=False)
    read_count = Column(Integer, default=0, nullable=False)
    replied_count = Column(Integer, default=0, nullable=False)
    opt_out_count = Column(Integer, default=0, nullable=False)
    skipped_count = Column(Integer, default=0, nullable=False)
    failed_count = Column(Integer, default=0, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    recipients = relationship("CampaignRecipient", back_populates="campaign", cascade="all, delete-orphan")
    activity_logs = relationship("CampaignActivityLog", back_populates="campaign", cascade="all, delete-orphan")

class CampaignRecipient(Base):
    __tablename__ = "campaign_recipients"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="SET NULL"), nullable=True)

    recipient_name = Column(String(150), nullable=False)
    recipient_phone = Column(String(30), nullable=False) # normalized digits
    recipient_company = Column(String(150), nullable=True)
    recipient_category = Column(String(100), nullable=True)

    personalized_message = Column(Text, nullable=False)
    click_to_chat_url = Column(Text, nullable=False)
    media_url = Column(Text, nullable=True)
    message_id = Column(String(100), nullable=True, index=True)

    status = Column(String(30), default="prepared", nullable=False) # "prepared", "opened", "sent", "delivered", "read", "skipped", "failed"
    opened_at = Column(DateTime, nullable=True)
    confirmed_sent_at = Column(DateTime, nullable=True)
    delivered_at = Column(DateTime, nullable=True)
    read_at = Column(DateTime, nullable=True)
    replied_at = Column(DateTime, nullable=True)
    reply_text = Column(Text, nullable=True)
    skipped_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    campaign = relationship("Campaign", back_populates="recipients")
    customer = relationship("Customer", back_populates="campaign_recipients")

    __table_args__ = (
        UniqueConstraint("campaign_id", "recipient_phone", name="uq_campaign_recipient_phone"),
        Index("ix_campaign_recipient_lookup", "campaign_id", "recipient_phone"),
    )

class CampaignActivityLog(Base):
    __tablename__ = "campaign_activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False, index=True)
    recipient_id = Column(Integer, nullable=True)
    action = Column(String(50), nullable=False) # "created", "opened", "marked_sent", "delivered", "read", "replied", "opt_out", "skipped", "completed", "cancelled"
    details = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    campaign = relationship("Campaign", back_populates="activity_logs")

class ConsentAuditLog(Base):
    __tablename__ = "consent_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    phone = Column(String(30), nullable=False, index=True)
    action = Column(String(50), nullable=False) # "consent_granted", "consent_revoked", "opt_out", "opt_in", "suppressed", "unsuppressed"
    previous_status = Column(String(30), nullable=True)
    new_status = Column(String(30), nullable=False)
    source = Column(String(100), nullable=True) # e.g. "CSV Import", "Web Form", "Manual UI", "WhatsApp Reply STOP"
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    customer = relationship("Customer", back_populates="consent_logs")

class CustomerInquiry(Base):
    __tablename__ = "customer_inquiries"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="SET NULL"), nullable=True)
    phone = Column(String(30), nullable=False, index=True)
    customer_name = Column(String(150), nullable=False)
    inquiry_type = Column(String(50), default="enquire", nullable=False) # "enquire", "stop", "general_reply"
    message_text = Column(Text, nullable=False)
    status = Column(String(30), default="new", nullable=False) # "new", "contacted", "resolved"
    campaign_id = Column(Integer, nullable=True)
    message_id = Column(String(100), nullable=True, unique=True, index=True) # For idempotent deduplication
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    customer = relationship("Customer", back_populates="inquiries")

class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="SET NULL"), nullable=True, index=True)
    phone = Column(String(30), nullable=False, index=True)
    customer_name = Column(String(150), nullable=False)
    status = Column(String(30), default="open", nullable=False) # "open", "waiting_reply", "closed"
    assigned_to = Column(String(100), nullable=True)
    last_message_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    customer = relationship("Customer")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan", order_by="Message.created_at.asc()")

class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="SET NULL"), nullable=True)
    direction = Column(String(20), nullable=False) # "inbound", "outbound"
    sender_type = Column(String(30), default="customer", nullable=False) # "customer", "user", "auto_reply", "campaign"
    body = Column(Text, nullable=False)
    media_url = Column(Text, nullable=True)
    provider_message_id = Column(String(100), nullable=True, index=True)
    delivery_status = Column(String(30), default="sent", nullable=False) # "sent", "delivered", "read", "failed"
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    conversation = relationship("Conversation", back_populates="messages")
    customer = relationship("Customer")

class FollowUpTask(Base):
    __tablename__ = "follow_up_tasks"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    due_date = Column(DateTime, nullable=False, index=True)
    priority = Column(String(20), default="medium", nullable=False) # "low", "medium", "high", "urgent"
    status = Column(String(30), default="pending", nullable=False) # "pending", "completed", "cancelled"
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    customer = relationship("Customer", back_populates="tasks")

class AppSetting(Base):
    __tablename__ = "app_settings"

    key = Column(String(100), primary_key=True, index=True)
    value = Column(Text, nullable=False)
    description = Column(String(255), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class SchemaMigration(Base):
    __tablename__ = "schema_migrations"

    version = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    applied_at = Column(DateTime, default=datetime.utcnow, nullable=False)

