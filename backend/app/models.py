import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Boolean,
    Integer,
    DateTime,
    ForeignKey,
    JSON,
    UniqueConstraint
)
from sqlalchemy.orm import relationship
from app.db import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(100), nullable=False)
    email = Column(String(120), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default="athlete")  # athlete | coach | organizer | referee
    profile_metrics = Column(JSON, nullable=False, default=dict)  # {"height": 178, "weight": 70, "age": 22, "fitness_score": 80}
    device_token = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    documents = relationship("Document", back_populates="user", cascade="all, delete-orphan")
    registrations = relationship("Registration", back_populates="user", cascade="all, delete-orphan")
    bookings = relationship("Booking", back_populates="user", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")


class Document(Base):
    __tablename__ = "documents"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    doc_type = Column(String(20), nullable=False)  # ID | MEDICAL | WAIVER
    storage_url = Column(String(255), nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    uploaded_at = Column(DateTime(timezone=True), default=utc_now)

    user = relationship("User", back_populates="documents")


class Event(Base):
    __tablename__ = "events"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    sport_name = Column(String(50), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    venue = Column(String(200), nullable=False)
    organizer_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    date_time = Column(DateTime(timezone=True), nullable=False)
    entry_fee = Column(Integer, default=0, nullable=False)  # in paise (e.g. 50000 = Rs. 500)
    capacity = Column(Integer, default=32, nullable=False)
    mandatory_requirements = Column(JSON, nullable=False, default=list)  # ["MIN_AGE:16", "MEDICAL", "ID"]

    organizer = relationship("User")
    registrations = relationship("Registration", back_populates="event", cascade="all, delete-orphan")
    matches = relationship("Match", back_populates="event", cascade="all, delete-orphan")


class Registration(Base):
    __tablename__ = "registrations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    event_id = Column(String(36), ForeignKey("events.id"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    status = Column(String(30), default="PENDING_PAYMENT", nullable=False)  # PENDING_PAYMENT | CONFIRMED | CANCELLED
    payment_id = Column(String(36), nullable=True)

    event = relationship("Event", back_populates="registrations")
    user = relationship("User", back_populates="registrations")


class Court(Base):
    __tablename__ = "courts"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(100), nullable=False)
    sport_name = Column(String(50), nullable=False, index=True)
    venue = Column(String(200), nullable=False)
    hourly_price = Column(Integer, default=50000, nullable=False)  # in paise

    bookings = relationship("Booking", back_populates="court", cascade="all, delete-orphan")


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    court_id = Column(String(36), ForeignKey("courts.id"), nullable=False, index=True)
    slot_start = Column(DateTime(timezone=True), nullable=False)
    slot_end = Column(DateTime(timezone=True), nullable=False)
    payment_status = Column(String(20), default="PENDING", nullable=False)  # PENDING | CONFIRMED | FAILED
    created_at = Column(DateTime(timezone=True), default=utc_now)

    user = relationship("User", back_populates="bookings")
    court = relationship("Court", back_populates="bookings")

    __table_args__ = (
        UniqueConstraint("court_id", "slot_start", name="uq_court_slot"),
    )


class Payment(Base):
    __tablename__ = "payments"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    purpose = Column(String(30), nullable=False)  # BOOKING | REGISTRATION
    ref_id = Column(String(36), nullable=False, index=True)
    gateway = Column(String(30), nullable=False)  # mock | stripe | razorpay | phonepe
    amount = Column(Integer, nullable=False)  # in paise
    currency = Column(String(10), default="INR", nullable=False)
    gateway_order_id = Column(String(100), nullable=True, index=True)
    status = Column(String(20), default="PENDING", nullable=False)  # PENDING | SUCCESS | FAILED
    created_at = Column(DateTime(timezone=True), default=utc_now)

    user = relationship("User", back_populates="payments")


class Match(Base):
    __tablename__ = "matches"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tournament_id = Column(String(36), ForeignKey("events.id"), nullable=False, index=True)
    team_a = Column(String(100), nullable=False)
    team_b = Column(String(100), nullable=False)
    court_number = Column(Integer, default=1, nullable=False)
    start_time = Column(DateTime(timezone=True), nullable=False)
    score_a = Column(Integer, default=0, nullable=False)
    score_b = Column(Integer, default=0, nullable=False)
    status = Column(String(20), default="SCHEDULED", nullable=False)  # SCHEDULED | LIVE | FINISHED

    event = relationship("Event", back_populates="matches")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(150), nullable=False)
    body = Column(String(500), nullable=False)
    kind = Column(String(50), nullable=False)  # BOOKING_CONFIRMED | REGISTRATION_CONFIRMED | MATCH_SCHEDULE_UPDATED | MATCH_REMINDER
    sent_at = Column(DateTime(timezone=True), default=utc_now)
    read = Column(Boolean, default=False, nullable=False)

    user = relationship("User", back_populates="notifications")

