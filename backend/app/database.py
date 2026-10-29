import os
from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./whatsapp_campaign.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)

# Enforce foreign key constraints in SQLite
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    if "sqlite" in DATABASE_URL:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def run_migrations(target_engine):
    """
    Ensures that existing SQLite tables are upgraded with missing columns,
    necessary unique constraints/indexes, and verifies database integrity.
    """
    if "sqlite" not in str(target_engine.url):
        return

    with target_engine.connect() as conn:
        cursor = conn.connection.cursor()
        
        # Check customers
        cursor.execute("PRAGMA table_info(customers)")
        cust_cols = {row[1] for row in cursor.fetchall()}
        if cust_cols and "lead_stage" not in cust_cols:
            cursor.execute("ALTER TABLE customers ADD COLUMN lead_stage VARCHAR(50) DEFAULT 'lead'")

        # Check campaigns
        cursor.execute("PRAGMA table_info(campaigns)")
        camp_cols = {row[1] for row in cursor.fetchall()}
        if camp_cols and "is_test_mode" not in camp_cols:
            cursor.execute("ALTER TABLE campaigns ADD COLUMN is_test_mode BOOLEAN DEFAULT 0")

        # Check customer_inquiries
        cursor.execute("PRAGMA table_info(customer_inquiries)")
        inq_cols = {row[1] for row in cursor.fetchall()}
        if inq_cols and "message_id" not in inq_cols:
            cursor.execute("ALTER TABLE customer_inquiries ADD COLUMN message_id VARCHAR(100)")

        # Unique index on campaign recipients to prevent duplicate recipient queuing
        cursor.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_campaign_recipient_phone "
            "ON campaign_recipients (campaign_id, recipient_phone)"
        )
        
        # SQLite integrity check
        cursor.execute("PRAGMA integrity_check")
        res = cursor.fetchall()
        if not res or res[0][0] != "ok":
            print(f"[DATABASE WARNING] SQLite integrity check returned: {res}")

        conn.connection.commit()
        cursor.close()

