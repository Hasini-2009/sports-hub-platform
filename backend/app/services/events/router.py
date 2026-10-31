from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Header
from sqlalchemy.orm import Session
from sqlalchemy import or_
from jose import jwt, JWTError

from app.config import settings
from app.db import get_db
from app.models import User, Event, Registration
from app.schemas import EventCreate, EventOut, RegistrationOut, EligibilityResult
from app.security import get_current_user, require_role
from app.services.events.eligibility import evaluate_eligibility

events_router = APIRouter(prefix="/events", tags=["Events & Registrations"])


def get_optional_user(authorization: Optional[str] = Header(None), db: Session = Depends(get_db)) -> Optional[User]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("sub")
        if user_id:
            return db.query(User).filter(User.id == user_id).first()
    except JWTError:
        return None
    return None


@events_router.get("", response_model=List[EventOut])
def list_events(
    sport: Optional[str] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    search: Optional[str] = Query(None),
    eligible_only: bool = Query(False),
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    query = db.query(Event)

    if sport:
        query = query.filter(Event.sport_name.ilike(f"%{sport}%"))

    if date_from:
        query = query.filter(Event.date_time >= date_from)

    if date_to:
        query = query.filter(Event.date_time <= date_to)

    if search:
        pattern = f"%{search}%"
        query = query.filter(or_(Event.title.ilike(pattern), Event.venue.ilike(pattern), Event.sport_name.ilike(pattern)))

    events = query.order_by(Event.date_time.asc()).all()

    # Calculate registered counts
    results = []
    for ev in events:
        reg_count = db.query(Registration).filter(
            Registration.event_id == ev.id,
            Registration.status != "CANCELLED"
        ).count()
        ev_out = EventOut(
            id=ev.id,
            sport_name=ev.sport_name,
            title=ev.title,
            venue=ev.venue,
            organizer_id=ev.organizer_id,
            date_time=ev.date_time,
            entry_fee=ev.entry_fee,
            capacity=ev.capacity,
            mandatory_requirements=ev.mandatory_requirements or [],
            registered_count=reg_count
        )

        if eligible_only:
            if not current_user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required for 'eligible_only' filter."
                )
            eval_res = evaluate_eligibility(current_user, ev, db)
            if eval_res.eligible:
                results.append(ev_out)
        else:
            results.append(ev_out)

    return results


@events_router.get("/{event_id}", response_model=EventOut)
def get_event(event_id: str, db: Session = Depends(get_db)):
    ev = db.query(Event).filter(Event.id == event_id).first()
    if not ev:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found.")

    reg_count = db.query(Registration).filter(
        Registration.event_id == ev.id,
        Registration.status != "CANCELLED"
    ).count()

    return EventOut(
        id=ev.id,
        sport_name=ev.sport_name,
        title=ev.title,
        venue=ev.venue,
        organizer_id=ev.organizer_id,
        date_time=ev.date_time,
        entry_fee=ev.entry_fee,
        capacity=ev.capacity,
        mandatory_requirements=ev.mandatory_requirements or [],
        registered_count=reg_count
    )


@events_router.post("", response_model=EventOut, status_code=status.HTTP_201_CREATED)
def create_event(
    payload: EventCreate,
    organizer: User = Depends(require_role("organizer")),
    db: Session = Depends(get_db)
):
    ev = Event(
        sport_name=payload.sport_name,
        title=payload.title,
        venue=payload.venue,
        organizer_id=organizer.id,
        date_time=payload.date_time,
        entry_fee=payload.entry_fee,
        capacity=payload.capacity,
        mandatory_requirements=payload.mandatory_requirements
    )
    db.add(ev)
    db.commit()
    db.refresh(ev)
    return EventOut(
        id=ev.id,
        sport_name=ev.sport_name,
        title=ev.title,
        venue=ev.venue,
        organizer_id=ev.organizer_id,
        date_time=ev.date_time,
        entry_fee=ev.entry_fee,
        capacity=ev.capacity,
        mandatory_requirements=ev.mandatory_requirements or [],
        registered_count=0
    )


@events_router.get("/{event_id}/eligibility", response_model=EligibilityResult)
def check_eligibility(
    event_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    ev = db.query(Event).filter(Event.id == event_id).first()
    if not ev:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found.")

    return evaluate_eligibility(current_user, ev, db)


@events_router.post("/{event_id}/register", response_model=RegistrationOut, status_code=status.HTTP_201_CREATED)
def register_for_event(
    event_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    ev = db.query(Event).filter(Event.id == event_id).first()
    if not ev:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found.")

    # 1. Eligibility evaluation
    eval_res = evaluate_eligibility(current_user, ev, db)
    if not eval_res.eligible:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": "Eligibility requirements not satisfied.",
                "checks": [check.model_dump() for check in eval_res.checks]
            }
        )

    # 2. Check duplicate registration
    existing = db.query(Registration).filter(
        Registration.event_id == ev.id,
        Registration.user_id == current_user.id,
        Registration.status != "CANCELLED"
    ).first()
    if existing:
        return existing

    # 3. Capacity check
    confirmed_count = db.query(Registration).filter(
        Registration.event_id == ev.id,
        Registration.status != "CANCELLED"
    ).count()
    if confirmed_count >= ev.capacity:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Event has reached maximum capacity.")

    # 4. Create registration
    initial_status = "CONFIRMED" if ev.entry_fee == 0 else "PENDING_PAYMENT"
    reg = Registration(
        event_id=ev.id,
        user_id=current_user.id,
        status=initial_status
    )
    db.add(reg)
    db.commit()
    db.refresh(reg)

    if initial_status == "CONFIRMED":
        # Dispatch notification
        from app.services.notifications.dispatcher import notification_dispatcher
        notification_dispatcher.dispatch(
            user_id=current_user.id,
            title="Registration Confirmed!",
            body=f"You are confirmed for '{ev.title}' ({ev.sport_name}).",
            kind="REGISTRATION_CONFIRMED",
            db=db
        )

    return reg

