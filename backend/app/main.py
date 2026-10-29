import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from backend.app.database import engine, Base, SessionLocal
from backend.app.models.models import Category, MessageTemplate, AppSetting
from backend.app.api import api_router

# Initialize database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="WhatsApp Campaign Manager API",
    description="Local-first backend for managing WhatsApp customer contacts, templates, and manual campaigns.",
    version="1.0.0"
)

# Static media uploads directory
uploads_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")
if not os.path.exists(uploads_dir):
    os.makedirs(uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

# Enable CORS for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5180",
        "http://127.0.0.1:5180"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)

def seed_defaults():
    db: Session = SessionLocal()
    try:
        # Seed default categories if none exist
        if db.query(Category).count() == 0:
            defaults = [
                Category(name="New Leads", description="Prospective customers who expressed interest", color="#3b82f6"),
                Category(name="Existing Customers", description="Active recurring clients", color="#10b981"),
                Category(name="VIP Customers", description="High-priority premium clientele", color="#8b5cf6"),
                Category(name="Follow-up Required", description="Contacts pending response or quotation", color="#f59e0b"),
                Category(name="Retail Customers", description="Individual retail buyers", color="#06b6d4"),
            ]
            db.add_all(defaults)
            db.commit()

        # Seed sample message templates if none exist
        if db.query(MessageTemplate).count() == 0:
            sample_templates = [
                MessageTemplate(
                    name="Warm Follow-up",
                    category="Follow-up",
                    description="Personalized follow up with lead or client",
                    body="Hello {name},\n\nThank you for reaching out regarding {company}. We wanted to check in and see if you had any questions regarding our latest updates.\n\nPlease reply if you would like to discuss further!\n\nBest regards,\nCustomer Care Team"
                ),
                MessageTemplate(
                    name="Special Promotion Announcement",
                    category="Promotional",
                    description="Promotional discount or announcement",
                    body="Hi {name}! 🎉\n\nAs a valued member of our {category} group, we are thrilled to offer you an exclusive 15% discount this week.\n\nLet us know if you would like more details.\n\nWarm wishes,\nSales Team"
                ),
                MessageTemplate(
                    name="Appointment / Service Reminder",
                    category="Transactional",
                    description="Reminder message for upcoming appointments or renewals",
                    body="Hello {name},\n\nThis is a quick reminder regarding your upcoming schedule with {company}. Please let us know if you need to reschedule or confirm.\n\nThank you,\nSupport Team"
                ),
            ]
            db.add_all(sample_templates)
            db.commit()

    finally:
        db.close()

seed_defaults()

@app.get("/")
def read_root():
    return {
        "app": "WhatsApp Campaign Manager API",
        "status": "online",
        "version": "1.0.0",
        "docs": "/docs"
    }
