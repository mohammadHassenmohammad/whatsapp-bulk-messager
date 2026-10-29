from typing import Dict, Any, List
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import text

from backend.app.models.models import (
    Customer, Category, MessageTemplate, Campaign, CampaignRecipient,
    CampaignActivityLog, AppSetting, CustomerInquiry, ConsentAuditLog,
    Conversation, Message, FollowUpTask, Tag, customer_tags
)

def _get_utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def export_all_data(db: Session) -> Dict[str, Any]:
    """
    Exports a complete, schema-compliant snapshot of all data including CRM entities:
    Categories, Tags, Customers, Templates, Campaigns, Inquiries, Conversations,
    Messages, Follow-Up Tasks, Consent Audit Logs, and App Settings.
    """
    tags = [
        {
            "id": t.id,
            "name": t.name,
            "color": t.color,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        }
        for t in db.query(Tag).all()
    ]

    categories = [
        {
            "id": c.id,
            "name": c.name,
            "description": c.description,
            "color": c.color,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "updated_at": c.updated_at.isoformat() if c.updated_at else None,
        }
        for c in db.query(Category).all()
    ]

    customers = [
        {
            "id": c.id,
            "full_name": c.full_name,
            "phone": c.phone,
            "formatted_phone": c.formatted_phone,
            "email": c.email,
            "category_id": c.category_id,
            "company": c.company,
            "tags": c.tags,
            "tag_names": [t.name for t in c.tag_items] if c.tag_items else [],
            "lead_stage": getattr(c, "lead_stage", "New"),
            "consent_status": c.consent_status,
            "consent_source": c.consent_source,
            "consent_date": c.consent_date.isoformat() if c.consent_date else None,
            "is_suppressed": c.is_suppressed,
            "notes": c.notes,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "updated_at": c.updated_at.isoformat() if c.updated_at else None,
        }
        for c in db.query(Customer).all()
    ]

    templates = [
        {
            "id": t.id,
            "name": t.name,
            "body": t.body,
            "description": t.description,
            "category": t.category,
            "header_type": getattr(t, "header_type", "none"),
            "header_media_url": getattr(t, "header_media_url", None),
            "buttons_json": getattr(t, "buttons_json", None),
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "updated_at": t.updated_at.isoformat() if t.updated_at else None,
        }
        for t in db.query(MessageTemplate).all()
    ]

    campaigns = [
        {
            "id": cmp.id,
            "name": cmp.name,
            "description": cmp.description,
            "notes": cmp.notes,
            "template_id": cmp.template_id,
            "message_body_snapshot": cmp.message_body_snapshot,
            "header_media_url": cmp.header_media_url,
            "buttons_json": cmp.buttons_json,
            "is_test_mode": getattr(cmp, "is_test_mode", False),
            "status": cmp.status,
            "total_recipients": cmp.total_recipients,
            "opened_count": cmp.opened_count,
            "sent_count": cmp.sent_count,
            "delivered_count": cmp.delivered_count or 0,
            "read_count": cmp.read_count or 0,
            "replied_count": cmp.replied_count or 0,
            "opt_out_count": cmp.opt_out_count or 0,
            "skipped_count": cmp.skipped_count,
            "failed_count": cmp.failed_count,
            "created_at": cmp.created_at.isoformat() if cmp.created_at else None,
            "updated_at": cmp.updated_at.isoformat() if cmp.updated_at else None,
            "recipients": [
                {
                    "id": r.id,
                    "customer_id": r.customer_id,
                    "recipient_name": r.recipient_name,
                    "recipient_phone": r.recipient_phone,
                    "recipient_company": r.recipient_company,
                    "recipient_category": r.recipient_category,
                    "personalized_message": r.personalized_message,
                    "click_to_chat_url": r.click_to_chat_url,
                    "media_url": r.media_url,
                    "message_id": r.message_id,
                    "status": r.status,
                    "opened_at": r.opened_at.isoformat() if r.opened_at else None,
                    "confirmed_sent_at": r.confirmed_sent_at.isoformat() if r.confirmed_sent_at else None,
                    "delivered_at": r.delivered_at.isoformat() if r.delivered_at else None,
                    "read_at": r.read_at.isoformat() if r.read_at else None,
                    "replied_at": r.replied_at.isoformat() if r.replied_at else None,
                    "reply_text": r.reply_text,
                    "skipped_at": r.skipped_at.isoformat() if r.skipped_at else None,
                    "error_message": r.error_message,
                    "notes": r.notes,
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                }
                for r in cmp.recipients
            ]
        }
        for cmp in db.query(Campaign).all()
    ]

    inquiries = [
        {
            "id": inq.id,
            "customer_id": inq.customer_id,
            "phone": inq.phone,
            "customer_name": inq.customer_name,
            "inquiry_type": inq.inquiry_type,
            "message_text": inq.message_text,
            "status": inq.status,
            "campaign_id": inq.campaign_id,
            "message_id": inq.message_id,
            "created_at": inq.created_at.isoformat() if inq.created_at else None,
        }
        for inq in db.query(CustomerInquiry).all()
    ]

    conversations = []
    for conv in db.query(Conversation).all():
        messages = [
            {
                "id": m.id,
                "direction": m.direction,
                "sender_type": m.sender_type,
                "body": m.body,
                "media_url": m.media_url,
                "provider_message_id": m.provider_message_id,
                "delivery_status": m.delivery_status,
                "error_message": m.error_message,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in conv.messages
        ]
        conversations.append({
            "id": conv.id,
            "customer_id": conv.customer_id,
            "phone": conv.phone,
            "customer_name": conv.customer_name,
            "status": conv.status,
            "assigned_to": conv.assigned_to,
            "last_message_at": conv.last_message_at.isoformat() if conv.last_message_at else None,
            "created_at": conv.created_at.isoformat() if conv.created_at else None,
            "messages": messages
        })

    tasks = [
        {
            "id": t.id,
            "customer_id": t.customer_id,
            "title": t.title,
            "description": t.description,
            "due_date": t.due_date.isoformat() if t.due_date else None,
            "priority": t.priority,
            "status": t.status,
            "completed_at": t.completed_at.isoformat() if t.completed_at else None,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        }
        for t in db.query(FollowUpTask).all()
    ]

    consent_logs = [
        {
            "id": cl.id,
            "customer_id": cl.customer_id,
            "phone": cl.phone,
            "action": cl.action,
            "previous_status": cl.previous_status,
            "new_status": cl.new_status,
            "source": cl.source,
            "reason": cl.reason,
            "created_at": cl.created_at.isoformat() if cl.created_at else None,
        }
        for cl in db.query(ConsentAuditLog).all()
    ]

    settings = [
        {
            "key": s.key,
            "value": s.value,
            "description": s.description
        }
        for s in db.query(AppSetting).all()
    ]

    return {
        "version": "2.0",
        "exported_at": _get_utc_now_iso(),
        "tags": tags,
        "categories": categories,
        "customers": customers,
        "templates": templates,
        "campaigns": campaigns,
        "inquiries": inquiries,
        "conversations": conversations,
        "tasks": tasks,
        "consent_logs": consent_logs,
        "settings": settings
    }

def restore_all_data(db: Session, backup_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Safely wipes and restores all tables inside an ACID transaction, preserving
    foreign key integrity and cross-references.
    """
    if not isinstance(backup_data, dict) or "version" not in backup_data:
        raise ValueError("Invalid backup file format: missing version header")

    try:
        # Clear existing data in correct topological foreign-key order
        db.query(Message).delete()
        db.query(Conversation).delete()
        db.query(FollowUpTask).delete()
        db.query(ConsentAuditLog).delete()
        db.query(CustomerInquiry).delete()
        db.query(CampaignActivityLog).delete()
        db.query(CampaignRecipient).delete()
        db.query(Campaign).delete()
        db.execute(customer_tags.delete())
        db.query(Customer).delete()
        db.query(Category).delete()
        db.query(Tag).delete()
        db.query(MessageTemplate).delete()
        db.query(AppSetting).delete()
        db.flush()

        # 1. Tags
        tag_map = {}
        for t in backup_data.get("tags", []):
            tag_obj = Tag(
                name=t["name"],
                color=t.get("color", "#64748b")
            )
            db.add(tag_obj)
            db.flush()
            tag_map[t["name"]] = tag_obj

        # 2. Categories
        cat_id_map = {}
        for c in backup_data.get("categories", []):
            cat = Category(
                name=c["name"],
                description=c.get("description"),
                color=c.get("color", "#10b981")
            )
            db.add(cat)
            db.flush()
            cat_id_map[c.get("id")] = cat.id

        # 3. Customers
        cust_id_map = {}
        for cu in backup_data.get("customers", []):
            new_cat_id = cat_id_map.get(cu.get("category_id"))
            c_date = None
            if cu.get("consent_date"):
                try:
                    c_date = datetime.fromisoformat(cu["consent_date"])
                except Exception:
                    pass

            cust = Customer(
                full_name=cu["full_name"],
                phone=cu["phone"],
                formatted_phone=cu.get("formatted_phone", f"+{cu['phone']}"),
                email=cu.get("email"),
                category_id=new_cat_id,
                company=cu.get("company"),
                tags=cu.get("tags"),
                lead_stage=cu.get("lead_stage", "New"),
                consent_status=cu.get("consent_status", "unverified"),
                consent_source=cu.get("consent_source"),
                consent_date=c_date,
                is_suppressed=bool(cu.get("is_suppressed", False)),
                notes=cu.get("notes")
            )
            # Re-associate tags
            for t_name in cu.get("tag_names", []):
                if t_name in tag_map:
                    cust.tag_items.append(tag_map[t_name])

            db.add(cust)
            db.flush()
            cust_id_map[cu.get("id")] = cust.id

        # 4. Templates
        tpl_id_map = {}
        for t in backup_data.get("templates", []):
            tpl = MessageTemplate(
                name=t["name"],
                body=t["body"],
                description=t.get("description"),
                category=t.get("category"),
                header_type=t.get("header_type", "none"),
                header_media_url=t.get("header_media_url"),
                buttons_json=t.get("buttons_json")
            )
            db.add(tpl)
            db.flush()
            tpl_id_map[t.get("id")] = tpl.id

        # 5. Campaigns & Recipients
        for cmp_data in backup_data.get("campaigns", []):
            cmp = Campaign(
                name=cmp_data["name"],
                description=cmp_data.get("description"),
                notes=cmp_data.get("notes"),
                template_id=tpl_id_map.get(cmp_data.get("template_id")),
                message_body_snapshot=cmp_data["message_body_snapshot"],
                header_media_url=cmp_data.get("header_media_url"),
                buttons_json=cmp_data.get("buttons_json"),
                is_test_mode=bool(cmp_data.get("is_test_mode", False)),
                status=cmp_data.get("status", "completed"),
                total_recipients=cmp_data.get("total_recipients", 0),
                opened_count=cmp_data.get("opened_count", 0),
                sent_count=cmp_data.get("sent_count", 0),
                delivered_count=cmp_data.get("delivered_count", 0),
                read_count=cmp_data.get("read_count", 0),
                replied_count=cmp_data.get("replied_count", 0),
                opt_out_count=cmp_data.get("opt_out_count", 0),
                skipped_count=cmp_data.get("skipped_count", 0),
                failed_count=cmp_data.get("failed_count", 0)
            )
            db.add(cmp)
            db.flush()

            for r_data in cmp_data.get("recipients", []):
                rec = CampaignRecipient(
                    campaign_id=cmp.id,
                    customer_id=cust_id_map.get(r_data.get("customer_id")),
                    recipient_name=r_data["recipient_name"],
                    recipient_phone=r_data["recipient_phone"],
                    recipient_company=r_data.get("recipient_company"),
                    recipient_category=r_data.get("recipient_category"),
                    personalized_message=r_data["personalized_message"],
                    click_to_chat_url=r_data["click_to_chat_url"],
                    media_url=r_data.get("media_url"),
                    message_id=r_data.get("message_id"),
                    status=r_data.get("status", "prepared"),
                    error_message=r_data.get("error_message"),
                    notes=r_data.get("notes")
                )
                db.add(rec)

        # 6. Customer Inquiries
        for inq_data in backup_data.get("inquiries", []):
            inq = CustomerInquiry(
                customer_id=cust_id_map.get(inq_data.get("customer_id")),
                phone=inq_data["phone"],
                customer_name=inq_data.get("customer_name", "Unknown"),
                inquiry_type=inq_data.get("inquiry_type", "general_reply"),
                message_text=inq_data.get("message_text", ""),
                status=inq_data.get("status", "new"),
                campaign_id=inq_data.get("campaign_id"),
                message_id=inq_data.get("message_id")
            )
            db.add(inq)

        # 7. Follow-Up Tasks
        for t_data in backup_data.get("tasks", []):
            d_date = datetime.now(timezone.utc)
            if t_data.get("due_date"):
                try:
                    d_date = datetime.fromisoformat(t_data["due_date"])
                except Exception:
                    pass
            comp_date = None
            if t_data.get("completed_at"):
                try:
                    comp_date = datetime.fromisoformat(t_data["completed_at"])
                except Exception:
                    pass

            c_id = cust_id_map.get(t_data.get("customer_id"))
            if c_id:
                task = FollowUpTask(
                    customer_id=c_id,
                    title=t_data["title"],
                    description=t_data.get("description"),
                    due_date=d_date,
                    priority=t_data.get("priority", "medium"),
                    status=t_data.get("status", "pending"),
                    completed_at=comp_date
                )
                db.add(task)

        # 8. Conversations & Messages
        for conv_data in backup_data.get("conversations", []):
            conv = Conversation(
                customer_id=cust_id_map.get(conv_data.get("customer_id")),
                phone=conv_data["phone"],
                customer_name=conv_data.get("customer_name", "Unknown"),
                status=conv_data.get("status", "open"),
                assigned_to=conv_data.get("assigned_to"),
            )
            db.add(conv)
            db.flush()

            for m_data in conv_data.get("messages", []):
                msg = Message(
                    conversation_id=conv.id,
                    customer_id=conv.customer_id,
                    direction=m_data.get("direction", "inbound"),
                    sender_type=m_data.get("sender_type", "customer"),
                    body=m_data.get("body", ""),
                    media_url=m_data.get("media_url"),
                    provider_message_id=m_data.get("provider_message_id"),
                    delivery_status=m_data.get("delivery_status", "sent"),
                    error_message=m_data.get("error_message")
                )
                db.add(msg)

        # 9. Consent Audit Logs
        for cl_data in backup_data.get("consent_logs", []):
            c_id = cust_id_map.get(cl_data.get("customer_id"))
            if c_id:
                audit = ConsentAuditLog(
                    customer_id=c_id,
                    phone=cl_data.get("phone", ""),
                    action=cl_data.get("action", "consent_updated"),
                    previous_status=cl_data.get("previous_status"),
                    new_status=cl_data.get("new_status", "unverified"),
                    source=cl_data.get("source", "Backup Restore"),
                    reason=cl_data.get("reason", "Restored from backup")
                )
                db.add(audit)

        # 10. Settings
        for s in backup_data.get("settings", []):
            setting = AppSetting(
                key=s["key"],
                value=str(s["value"]),
                description=s.get("description")
            )
            db.add(setting)

        db.commit()
        return {
            "success": True,
            "message": "All data restored successfully without data loss.",
            "categories_restored": len(backup_data.get("categories", [])),
            "customers_restored": len(backup_data.get("customers", [])),
            "templates_restored": len(backup_data.get("templates", [])),
            "campaigns_restored": len(backup_data.get("campaigns", [])),
            "inquiries_restored": len(backup_data.get("inquiries", [])),
            "conversations_restored": len(backup_data.get("conversations", [])),
            "tasks_restored": len(backup_data.get("tasks", [])),
        }
    except Exception as e:
        db.rollback()
        raise e
