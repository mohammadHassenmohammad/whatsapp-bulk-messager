from typing import Optional
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.app.database import get_db
from backend.app.models.models import (
    Customer, Category, Campaign, CampaignRecipient, CustomerInquiry, FollowUpTask
)
from backend.app.schemas.schemas import AnalyticsOverview

router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.get("", response_model=AnalyticsOverview)
def get_analytics(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db)
):
    now = datetime.now(timezone.utc)
    start_date = now - timedelta(days=days)

    total_customers = db.query(Customer).count()
    eligible_contacts_count = db.query(Customer).filter(
        Customer.consent_status == "verified",
        Customer.is_suppressed == False
    ).count()
    verified_consent = db.query(Customer).filter(Customer.consent_status == "verified").count()
    unverified_consent = db.query(Customer).filter(Customer.consent_status == "unverified").count()
    opted_out = db.query(Customer).filter(Customer.consent_status == "opted_out").count()

    total_categories = db.query(Category).count()
    total_campaigns = db.query(Campaign).count()
    active_campaigns_count = db.query(Campaign).filter(Campaign.status == "in_progress").count()

    # Recipient status totals
    recipient_stats = db.query(
        CampaignRecipient.status,
        func.count(CampaignRecipient.id)
    ).group_by(CampaignRecipient.status).all()

    stats_dict = {s: cnt for s, cnt in recipient_stats}
    total_opened = stats_dict.get("opened", 0) + stats_dict.get("sent", 0) + stats_dict.get("delivered", 0) + stats_dict.get("read", 0)
    total_sent = stats_dict.get("sent", 0) + stats_dict.get("delivered", 0) + stats_dict.get("read", 0)
    total_skipped = stats_dict.get("skipped", 0)
    total_failed = stats_dict.get("failed", 0)

    # Real delivered, read, replied counts
    total_delivered = db.query(CampaignRecipient).filter(CampaignRecipient.delivered_at.isnot(None)).count()
    total_read = db.query(CampaignRecipient).filter(CampaignRecipient.read_at.isnot(None)).count()
    total_replied = db.query(CampaignRecipient).filter(CampaignRecipient.replied_at.isnot(None)).count()

    # Inquiry counts & leads
    total_inquiries = db.query(CustomerInquiry).count()
    new_inquiries = db.query(CustomerInquiry).filter(CustomerInquiry.status == "new").count()

    # Follow-up tasks due today and overdue
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    tasks_due_today = db.query(FollowUpTask).filter(
        FollowUpTask.status == "pending",
        FollowUpTask.due_date >= today_start,
        FollowUpTask.due_date < today_end
    ).count()
    tasks_overdue = db.query(FollowUpTask).filter(
        FollowUpTask.status == "pending",
        FollowUpTask.due_date < today_start
    ).count()

    # Category distribution
    cat_dist_query = db.query(
        Category.name,
        func.count(Customer.id).label("count"),
        Category.color
    ).outerjoin(Customer, Customer.category_id == Category.id).group_by(Category.id).all()

    category_distribution = [
        {"name": name, "count": count, "color": color or "#10b981"}
        for name, count, color in cat_dist_query
    ]
    # Uncategorized count
    uncat_count = db.query(Customer).filter(Customer.category_id.is_(None)).count()
    if uncat_count > 0:
        category_distribution.append({
            "name": "Uncategorized",
            "count": uncat_count,
            "color": "#94a3b8"
        })

    # Timeline of customer growth (grouped by date)
    recent_customers_q = db.query(Customer).filter(Customer.created_at >= start_date).order_by(Customer.created_at.asc()).all()
    growth_map = {}
    for c in recent_customers_q:
        d_str = c.created_at.strftime("%Y-%m-%d") if c.created_at else "Unknown"
        growth_map[d_str] = growth_map.get(d_str, 0) + 1

    customer_growth = [{"date": k, "count": v} for k, v in sorted(growth_map.items())]

    # Timeline of campaigns
    recent_campaigns_q = db.query(Campaign).filter(Campaign.created_at >= start_date).order_by(Campaign.created_at.asc()).all()
    campaign_timeline_map = {}
    for cmp in recent_campaigns_q:
        d_str = cmp.created_at.strftime("%Y-%m-%d") if cmp.created_at else "Unknown"
        if d_str not in campaign_timeline_map:
            campaign_timeline_map[d_str] = {"date": d_str, "campaigns": 0, "recipients": 0}
        campaign_timeline_map[d_str]["campaigns"] += 1
        campaign_timeline_map[d_str]["recipients"] += cmp.total_recipients

    campaign_timeline = list(campaign_timeline_map.values())

    # Recent 5 campaigns
    recent_campaigns = [
        {
            "id": cmp.id,
            "name": cmp.name,
            "status": cmp.status,
            "total_recipients": cmp.total_recipients,
            "sent_count": cmp.sent_count,
            "delivered_count": cmp.delivered_count or 0,
            "read_count": cmp.read_count or 0,
            "replied_count": cmp.replied_count or 0,
            "created_at": cmp.created_at.isoformat() if cmp.created_at else None
        }
        for cmp in db.query(Campaign).order_by(Campaign.created_at.desc()).limit(5).all()
    ]

    # Recent 5 customers
    recent_customers = [
        {
            "id": cust.id,
            "full_name": cust.full_name,
            "formatted_phone": cust.formatted_phone,
            "category": cust.category.name if cust.category else "Uncategorized",
            "consent_status": cust.consent_status,
            "created_at": cust.created_at.isoformat() if cust.created_at else None
        }
        for cust in db.query(Customer).order_by(Customer.created_at.desc()).limit(5).all()
    ]

    # Recent 5 inquiries
    recent_inquiries = [
        {
            "id": inq.id,
            "customer_name": inq.customer_name,
            "phone": inq.phone,
            "inquiry_type": inq.inquiry_type,
            "message_text": inq.message_text,
            "status": inq.status,
            "campaign_id": inq.campaign_id,
            "created_at": inq.created_at.isoformat() if inq.created_at else None
        }
        for inq in db.query(CustomerInquiry).order_by(CustomerInquiry.created_at.desc()).limit(5).all()
    ]

    return AnalyticsOverview(
        total_customers=total_customers,
        eligible_contacts_count=eligible_contacts_count,
        verified_consent_count=verified_consent,
        unverified_consent_count=unverified_consent,
        opted_out_count=opted_out,
        total_categories=total_categories,
        total_campaigns=total_campaigns,
        active_campaigns_count=active_campaigns_count,
        total_chats_opened=total_opened,
        total_confirmed_sents=total_sent,
        total_delivered=total_delivered,
        total_read=total_read,
        total_replied=total_replied,
        total_skipped=total_skipped,
        total_failed=total_failed,
        total_inquiries=total_inquiries,
        new_inquiries=new_inquiries,
        tasks_due_today=tasks_due_today,
        tasks_overdue=tasks_overdue,
        customer_growth=customer_growth,
        category_distribution=category_distribution,
        campaign_timeline=campaign_timeline,
        recent_campaigns=recent_campaigns,
        recent_customers=recent_customers,
        recent_inquiries=recent_inquiries
    )
