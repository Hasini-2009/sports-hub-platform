from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, EmailStr, Field


# ===================== USER & AUTH =====================
class UserRegister(BaseModel):
    name: str = Field(..., min_length=2)
    email: EmailStr
    password: str = Field(..., min_length=6)
    role: str = Field(default="athlete", pattern="^(athlete|coach|organizer|referee)$")
    profile_metrics: Optional[Dict[str, Any]] = Field(default_factory=dict)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class MetricsUpdate(BaseModel):
    height: Optional[float] = None
    weight: Optional[float] = None
    age: Optional[int] = None
    fitness_score: Optional[int] = None


class DeviceTokenUpdate(BaseModel):
    device_token: str


class UserOut(BaseModel):
    id: str
    name: str
    email: EmailStr
    role: str
    profile_metrics: Dict[str, Any]
    device_token: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ===================== VAULT =====================
class DocumentOut(BaseModel):
    id: str
    user_id: str
    doc_type: str
    storage_url: str
    is_verified: bool
    uploaded_at: datetime

    class Config:
        from_attributes = True


# ===================== EVENTS & ELIGIBILITY =====================
class EventCreate(BaseModel):
    sport_name: str
    title: str
    venue: str
    date_time: datetime
    entry_fee: int = 0  # in paise
    capacity: int = 32
    mandatory_requirements: List[str] = Field(default_factory=list)  # ["MIN_AGE:16", "MEDICAL", "ID"]


class EventOut(BaseModel):
    id: str
    sport_name: str
    title: str
    venue: str
    organizer_id: str
    date_time: datetime
    entry_fee: int
    capacity: int
    mandatory_requirements: List[str]
    registered_count: Optional[int] = 0

    class Config:
        from_attributes = True


class EligibilityCheckItem(BaseModel):
    requirement: str
    passed: bool
    message: str


class EligibilityResult(BaseModel):
    eligible: bool
    checks: List[EligibilityCheckItem]


class RegistrationOut(BaseModel):
    id: str
    event_id: str
    user_id: str
    status: str
    payment_id: Optional[str] = None
    event: Optional[EventOut] = None

    class Config:
        from_attributes = True


# ===================== COURTS & BOOKINGS =====================
class CourtOut(BaseModel):
    id: str
    name: str
    sport_name: str
    venue: str
    hourly_price: int

    class Config:
        from_attributes = True


class SlotAvailability(BaseModel):
    slot_start: datetime
    slot_end: datetime
    is_available: bool


class BookingCreate(BaseModel):
    court_id: str
    slot_start: datetime
    slot_end: datetime


class BookingOut(BaseModel):
    id: str
    user_id: str
    court_id: str
    slot_start: datetime
    slot_end: datetime
    payment_status: str
    created_at: datetime
    court: Optional[CourtOut] = None

    class Config:
        from_attributes = True


# ===================== PAYMENTS =====================
class PaymentIntentCreate(BaseModel):
    purpose: str = Field(..., pattern="^(BOOKING|REGISTRATION)$")
    ref_id: str
    gateway: str = Field(default="mock", pattern="^(mock|stripe|razorpay|phonepe)$")


class PaymentIntentOut(BaseModel):
    payment_id: str
    gateway: str
    order_id: str
    amount: int
    currency: str
    checkout_url_or_token: Optional[str] = None


class PaymentOut(BaseModel):
    id: str
    user_id: str
    purpose: str
    ref_id: str
    gateway: str
    amount: int
    currency: str
    gateway_order_id: Optional[str] = None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


# ===================== NOTIFICATIONS =====================
class NotificationOut(BaseModel):
    id: str
    user_id: str
    title: str
    body: str
    kind: str
    sent_at: datetime
    read: bool

    class Config:
        from_attributes = True


# ===================== MATCH & LIVE =====================
class MatchOut(BaseModel):
    id: str
    tournament_id: str
    team_a: str
    team_b: str
    court_number: int
    start_time: datetime
    score_a: int
    score_b: int
    status: str

    class Config:
        from_attributes = True


class ScoreUpdate(BaseModel):
    score_a: int
    score_b: int
    status: Optional[str] = None


# ===================== INJURY AI =====================
class InjuryQueryRequest(BaseModel):
    question: str
    sport: Optional[str] = None
    history: Optional[str] = None


class InjuryHealthResponse(BaseModel):
    status: str
    ollama_reachable: bool
    chromadb_reachable: bool
    model: str


# ===================== SCHEDULER =====================
class SchedulerGenerateRequest(BaseModel):
    teams: List[str]
    courts_count: int = Field(..., gt=0)
    match_duration_mins: int = Field(default=45, gt=0)
    start_time: datetime
    min_rest_slots: int = Field(default=1, ge=0)
    format: str = Field(default="round_robin", pattern="^(round_robin|single_elimination)$")


class ScheduledMatch(BaseModel):
    match_index: int
    team_a: str
    team_b: str
    court_number: int
    slot_index: int
    start_time: datetime
    end_time: datetime


class SchedulerResponse(BaseModel):
    total_slots: int
    makespan_minutes: int
    matches: List[ScheduledMatch]

