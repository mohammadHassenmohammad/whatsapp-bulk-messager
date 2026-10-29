import logging
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.orm import Session

from backend.app.models.models import Customer, FollowUpTask, Tag, customer_tags

logger = logging.getLogger(__name__)

class AutomationService:
    @staticmethod
    def process_inbound_automation(
        db: Session,
        customer_id: Optional[int],
        inquiry_type: str,
        message_text: str
    ) -> Optional[FollowUpTask]:
        """Automatically trigger tasks, tags, and lead stage progression for inbound replies."""
        if not customer_id:
            return None

        customer = db.query(Customer).filter(Customer.id == customer_id).first()
        if not customer:
            return None

        now = datetime.utcnow()
        task_created = None

        # 1. Lead Stage Progression
        if inquiry_type in ["enquire", "interested"]:
            if customer.lead_stage in ["New", "Contacted"]:
                customer.lead_stage = "Interested"
                customer.updated_at = now

            # 2. Automatically generate high-priority follow-up task
            existing_pending_task = db.query(FollowUpTask).filter(
                FollowUpTask.customer_id == customer.id,
                FollowUpTask.status == "pending"
            ).first()

            if not existing_pending_task:
                due_date = now + timedelta(days=1)
                task_title = f"Follow up on inquiry: {customer.full_name}"
                task_desc = f"Customer replied with inquiry: '{message_text[:120]}'. Reach out with quote or details."
                new_task = FollowUpTask(
                    customer_id=customer.id,
                    title=task_title,
                    description=task_desc,
                    due_date=due_date,
                    priority="high",
                    status="pending",
                    created_at=now,
                    updated_at=now
                )
                db.add(new_task)
                task_created = new_task
                logger.info(f"Auto-created follow-up task {new_task.title} for customer {customer.id}")

            # 3. Auto-tag as 'Warm Lead'
            AutomationService.ensure_customer_tag(db, customer, "Warm Lead", "#10b981")

        elif inquiry_type == "stop":
            if customer.lead_stage != "Lost":
                customer.lead_stage = "Lost"
                customer.updated_at = now
            AutomationService.ensure_customer_tag(db, customer, "Opted-Out", "#ef4444")

        return task_created

    @staticmethod
    def ensure_customer_tag(db: Session, customer: Customer, tag_name: str, color: str = "#6366f1"):
        """Attach a tag to a customer if not already present."""
        tag = db.query(Tag).filter(Tag.name == tag_name).first()
        if not tag:
            tag = Tag(name=tag_name, color=color, created_at=datetime.utcnow())
            db.add(tag)
            db.flush()

        if customer.tag_items is None:
            customer.tag_items = []
        if tag not in customer.tag_items:
            customer.tag_items.append(tag)

        # Also update legacy string column
        cur_list = [t.strip() for t in (customer.tags or "").split(",") if t.strip()]
        if tag_name not in cur_list:
            cur_list.append(tag_name)
            customer.tags = ", ".join(cur_list)

    @staticmethod
    def run_inactivity_check(db: Session, days_inactive: int = 45) -> int:
        """Mark leads as 'Lost' if they have not engaged in X days."""
        cutoff = datetime.utcnow() - timedelta(days=days_inactive)
        stale_customers = db.query(Customer).filter(
            Customer.lead_stage.in_(["New", "Contacted"]),
            Customer.updated_at < cutoff
        ).all()

        updated_count = 0
        for c in stale_customers:
            c.lead_stage = "Lost"
            c.notes = (c.notes or "") + f"\n[Automated] Marked as Lost due to {days_inactive} days of inactivity."
            updated_count += 1

        if updated_count > 0:
            db.commit()
        return updated_count
