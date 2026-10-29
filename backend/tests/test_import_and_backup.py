import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.app.database import Base
from backend.app.models.models import Customer, Category
from backend.app.services.import_service import detect_column_mappings
from backend.app.services.backup_service import export_all_data, restore_all_data
from backend.app.services.export_service import sanitize_csv_cell

@pytest.fixture
def test_db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestingSessionLocal()
    yield db
    db.close()

def test_detect_column_mappings():
    headers = ["Full Name", "WhatsApp Number", "E-mail Address", "Business Name", "User Category"]
    detected = detect_column_mappings(headers)
    assert detected["name_col"] == "Full Name"
    assert detected["phone_col"] == "WhatsApp Number"
    assert detected["email_col"] == "E-mail Address"
    assert detected["company_col"] == "Business Name"
    assert detected["category_col"] == "User Category"

def test_csv_formula_injection_sanitization():
    # Dangerous values starting with =, +, -, @
    assert sanitize_csv_cell("=cmd|' /C calc'!A0") == "'=cmd|' /C calc'!A0"
    assert sanitize_csv_cell("+123456") == "'+123456"
    assert sanitize_csv_cell("-50") == "'-50"
    assert sanitize_csv_cell("@SUM(A1:A10)") == "'@SUM(A1:A10)"
    # Safe value
    assert sanitize_csv_cell("Hello World") == "Hello World"

def test_backup_and_restore(test_db):
    cat = Category(name="Leads", description="Inbound leads")
    test_db.add(cat)
    test_db.flush()

    cust = Customer(
        full_name="Bruce Wayne",
        phone="15551234567",
        formatted_phone="+15551234567",
        category_id=cat.id,
        consent_status="verified"
    )
    test_db.add(cust)
    test_db.commit()

    # Export
    backup = export_all_data(test_db)
    assert len(backup["categories"]) == 1
    assert len(backup["customers"]) == 1

    # Restore in clean DB
    res = restore_all_data(test_db, backup)
    assert res["success"] is True

    # Verify restored records
    restored_cust = test_db.query(Customer).first()
    assert restored_cust.full_name == "Bruce Wayne"
    assert restored_cust.phone == "15551234567"
