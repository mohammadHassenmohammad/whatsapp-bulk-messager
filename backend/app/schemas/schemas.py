from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, EmailStr, ConfigDict

# ----------------- Category Schemas -----------------
class CategoryBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=255)
    color: Optional[str] = Field("#10b981", max_length=20)

class CategoryCreate(CategoryBase):
    pass

class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    color: Optional[str] = None

class CategoryResponse(CategoryBase):
    id: int
    customer_count: Optional[int] = 0
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

# ----------------- Customer Schemas -----------------
class CustomerBase(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=150)
    phone: str = Field(..., min_length=5, max_length=30) # Raw or normalized
    email: Optional[str] = None
    category_id: Optional[int] = None
    company: Optional[str] = None
    tags: Optional[str] = None
    lead_stage: Optional[str] = Field("New", description="New, Contacted, Interested, Converted, Lost")
    consent_status: Optional[str] = Field("unverified", description="verified, unverified, opted_out")
    consent_source: Optional[str] = None
    consent_date: Optional[datetime] = None
    is_suppressed: Optional[bool] = False
    notes: Optional[str] = None

class CustomerCreate(CustomerBase):
    default_country_code: Optional[str] = "1"

class CustomerUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    category_id: Optional[int] = None
    company: Optional[str] = None
    tags: Optional[str] = None
    lead_stage: Optional[str] = None
    consent_status: Optional[str] = None
    consent_source: Optional[str] = None
    consent_date: Optional[datetime] = None
    is_suppressed: Optional[bool] = None
    notes: Optional[str] = None
    default_country_code: Optional[str] = "1"

class CustomerResponse(BaseModel):
    id: int
    full_name: str
    phone: str
    formatted_phone: str
    email: Optional[str] = None
    category_id: Optional[int] = None
    category_name: Optional[str] = None
    company: Optional[str] = None
    tags: Optional[str] = None
    lead_stage: str = "New"
    consent_status: str
    consent_source: Optional[str] = None
    consent_date: Optional[datetime] = None
    is_suppressed: bool
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class CustomerListResponse(BaseModel):
    items: List[CustomerResponse]
    total: int
    page: int
    page_size: int
    total_pages: int

# ----------------- Message Template Schemas -----------------
class TemplateBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    body: str = Field(..., min_length=1)
    description: Optional[str] = None
    category: Optional[str] = None
    header_type: Optional[str] = "none"
    header_media_url: Optional[str] = None
    buttons_json: Optional[str] = None

class TemplateCreate(TemplateBase):
    pass

class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    body: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    header_type: Optional[str] = None
    header_media_url: Optional[str] = None
    buttons_json: Optional[str] = None

class TemplateResponse(TemplateBase):
    id: int
    variables: List[str] = []
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

# ----------------- Campaign Schemas -----------------
class CampaignCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    description: Optional[str] = None
    notes: Optional[str] = None
    template_id: Optional[int] = None
    message_body: str = Field(..., min_length=1)
    header_media_url: Optional[str] = None
    buttons_json: Optional[str] = None
    # Recipient selection criteria
    customer_ids: Optional[List[int]] = None
    category_ids: Optional[List[int]] = None
    select_all_matching: Optional[bool] = False
    only_verified_consent: Optional[bool] = False
    exclude_suppressed: Optional[bool] = True
    is_test_mode: Optional[bool] = False
    test_phone_number: Optional[str] = None

class CampaignRecipientResponse(BaseModel):
    id: int
    campaign_id: int
    customer_id: Optional[int] = None
    recipient_name: str
    recipient_phone: str
    recipient_company: Optional[str] = None
    recipient_category: Optional[str] = None
    personalized_message: str
    click_to_chat_url: str
    media_url: Optional[str] = None
    message_id: Optional[str] = None
    status: str
    opened_at: Optional[datetime] = None
    confirmed_sent_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    read_at: Optional[datetime] = None
    replied_at: Optional[datetime] = None
    reply_text: Optional[str] = None
    skipped_at: Optional[datetime] = None
    error_message: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class CampaignActivityLogResponse(BaseModel):
    id: int
    campaign_id: int
    recipient_id: Optional[int] = None
    action: str
    details: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class CampaignResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    notes: Optional[str] = None
    template_id: Optional[int] = None
    message_body_snapshot: str
    header_media_url: Optional[str] = None
    buttons_json: Optional[str] = None
    is_test_mode: bool = False
    status: str
    total_recipients: int
    opened_count: int
    sent_count: int
    delivered_count: int = 0
    read_count: int = 0
    replied_count: int = 0
    opt_out_count: int = 0
    skipped_count: int
    failed_count: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class CampaignDetailResponse(CampaignResponse):
    recipients: List[CampaignRecipientResponse] = []
    activity_logs: List[CampaignActivityLogResponse] = []

class CustomerInquiryResponse(BaseModel):
    id: int
    customer_id: Optional[int] = None
    phone: str
    customer_name: str
    inquiry_type: str
    message_text: str
    status: str
    campaign_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class RecipientStatusUpdate(BaseModel):
    status: str = Field(..., description="opened, sent, delivered, read, skipped, failed")
    message_id: Optional[str] = None
    error_message: Optional[str] = None
    notes: Optional[str] = None

# ----------------- Import Schemas -----------------
class ImportPreviewResponse(BaseModel):
    filename: str
    total_rows: int
    headers: List[str]
    sample_rows: List[Dict[str, Any]]
    detected_mappings: Dict[str, str]

class ColumnMapping(BaseModel):
    name_col: Optional[str] = None
    phone_col: str
    email_col: Optional[str] = None
    company_col: Optional[str] = None
    category_col: Optional[str] = None
    tags_col: Optional[str] = None
    consent_status_col: Optional[str] = None
    notes_col: Optional[str] = None

class ImportConfirmRequest(BaseModel):
    filename: str
    mappings: ColumnMapping
    default_country_code: str = "1"
    default_category_id: Optional[int] = None
    default_consent_status: str = "unverified"
    on_duplicate: str = Field("skip", description="skip or update")

class ImportResult(BaseModel):
    total_processed: int
    imported_count: int
    updated_count: int
    skipped_count: int
    failed_count: int
    errors: List[Dict[str, Any]]

# ----------------- Settings & Analytics Schemas -----------------
class SettingItem(BaseModel):
    key: str
    value: str
    description: Optional[str] = None

class SettingsMap(BaseModel):
    settings: Dict[str, str]

class AnalyticsOverview(BaseModel):
    total_customers: int
    eligible_contacts_count: int = 0
    verified_consent_count: int
    unverified_consent_count: int
    opted_out_count: int
    total_categories: int
    total_campaigns: int
    active_campaigns_count: int = 0
    total_chats_opened: int
    total_confirmed_sents: int
    total_delivered: int = 0
    total_read: int = 0
    total_replied: int = 0
    total_skipped: int
    total_failed: int = 0
    total_inquiries: int = 0
    new_inquiries: int = 0
    tasks_due_today: int = 0
    tasks_overdue: int = 0
    customer_growth: List[Dict[str, Any]]
    category_distribution: List[Dict[str, Any]]
    campaign_timeline: List[Dict[str, Any]]
    recent_campaigns: List[Dict[str, Any]]
    recent_customers: List[Dict[str, Any]]
    recent_inquiries: List[Dict[str, Any]] = []

# ----------------- Consent & CRM Schemas -----------------
class ConsentAuditLogResponse(BaseModel):
    id: int
    customer_id: int
    phone: str
    action: str
    previous_status: Optional[str] = None
    new_status: str
    source: Optional[str] = None
    reason: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class FollowUpTaskCreate(BaseModel):
    customer_id: int
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    due_date: datetime
    priority: Optional[str] = Field("medium", description="low, medium, high, urgent")

class FollowUpTaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    priority: Optional[str] = None
    status: Optional[str] = None # "pending", "completed", "cancelled"

class FollowUpTaskResponse(BaseModel):
    id: int
    customer_id: int
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    title: str
    description: Optional[str] = None
    due_date: datetime
    priority: str
    status: str
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class MessageCreate(BaseModel):
    conversation_id: int
    body: str = Field(..., min_length=1)
    media_url: Optional[str] = None

class MessageResponse(BaseModel):
    id: int
    conversation_id: int
    customer_id: Optional[int] = None
    direction: str
    sender_type: str
    body: str
    media_url: Optional[str] = None
    provider_message_id: Optional[str] = None
    delivery_status: str
    error_message: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ConversationResponse(BaseModel):
    id: int
    customer_id: Optional[int] = None
    phone: str
    customer_name: str
    status: str
    assigned_to: Optional[str] = None
    last_message_at: datetime
    created_at: datetime
    updated_at: datetime
    messages: List[MessageResponse] = []

    model_config = ConfigDict(from_attributes=True)
