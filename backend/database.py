import os
from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, Text, ForeignKey, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship

DB_PATH = "sqlite:///./crm.db"

engine = create_engine(DB_PATH, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class HCP(Base):
    __tablename__ = "hcps"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    specialty = Column(String(100), nullable=False)
    clinic_name = Column(String(150), nullable=False)
    email = Column(String(100), nullable=False)
    phone = Column(String(30), nullable=False)
    address = Column(String(250), nullable=True)

    interactions = relationship("Interaction", back_populates="hcp", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="hcp", cascade="all, delete-orphan")

class Interaction(Base):
    __tablename__ = "interactions"
    id = Column(Integer, primary_key=True, index=True)
    hcp_id = Column(Integer, ForeignKey("hcps.id", ondelete="CASCADE"), nullable=False)
    interaction_type = Column(String(50), default="Meeting") # Meeting, Call, Email, etc.
    date = Column(String(30), nullable=False)
    time = Column(String(20), nullable=True)
    attendees = Column(String(200), nullable=True)
    summary = Column(Text, nullable=False) # Maps to Topics Discussed
    materials_shared = Column(Text, nullable=True) # JSON array or comma separated
    samples_distributed = Column(Text, nullable=True) # JSON array or comma separated
    sentiment = Column(String(20), default="Neutral") # Positive, Neutral, Negative
    outcomes = Column(Text, nullable=True)
    next_steps = Column(Text, nullable=True) # Maps to Follow-up Actions
    duration_mins = Column(Integer, default=15)
    created_at = Column(DateTime, default=datetime.utcnow)

    hcp = relationship("HCP", back_populates="interactions")
    tasks = relationship("Task", back_populates="interaction")

class Task(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True, index=True)
    hcp_id = Column(Integer, ForeignKey("hcps.id", ondelete="CASCADE"), nullable=False)
    interaction_id = Column(Integer, ForeignKey("interactions.id", ondelete="SET NULL"), nullable=True)
    due_date = Column(String(30), nullable=False)
    activity_type = Column(String(100), nullable=False)  # e.g., "Follow-up Call", "Send Literature"
    status = Column(String(20), default="Pending")       # Pending, Completed
    created_at = Column(DateTime, default=datetime.utcnow)

    hcp = relationship("HCP", back_populates="tasks")
    interaction = relationship("Interaction", back_populates="tasks")

def init_db():
    # Drop and recreate to handle schema updates cleanly during development
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        if db.query(HCP).count() == 0:
            mock_hcps = [
                HCP(
                    name="Dr. Sarah Jenkins",
                    specialty="Cardiologist",
                    clinic_name="Metro Cardiac Associates",
                    email="sarah.jenkins@metrocardiac.com",
                    phone="+1-555-0199",
                    address="Suite 402, 100 Medical Plaza, Chicago, IL"
                ),
                HCP(
                    name="Dr. James Patel",
                    specialty="Oncologist",
                    clinic_name="Midwest Cancer Center",
                    email="jpatel@midwestcancer.org",
                    phone="+1-555-0123",
                    address="Building B, 450 Health Parkway, Indianapolis, IN"
                ),
                HCP(
                    name="Dr. Emily Vance",
                    specialty="Pediatrician",
                    clinic_name="Vance Pediatrics",
                    email="emily.vance@vancepeds.com",
                    phone="+1-555-0144",
                    address="12 Oakridge Ave, Ann Arbor, MI"
                ),
                HCP(
                    name="Dr. David K. Miller",
                    specialty="Endocrinologist",
                    clinic_name="Endocrine Specialists LLC",
                    email="dmiller@endospec.com",
                    phone="+1-555-0177",
                    address="Floor 2, 80 Clinic Road, Columbus, OH"
                ),
                HCP(
                    name="Dr. Helen Cho",
                    specialty="Rheumatologist",
                    clinic_name="Cho Rheumatology & Arthritis Clinic",
                    email="hcho@chorheuma.com",
                    phone="+1-555-0188",
                    address="Suite A, 290 Summit Dr, Cleveland, OH"
                )
            ]
            db.add_all(mock_hcps)
            db.commit()
            print("Database initialized and mock HCPs seeded successfully.")
    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    init_db()
