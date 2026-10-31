from datetime import datetime, date, time, timedelta, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.db import get_db
from app.cache import cache
from app.models import User, Court, Booking
from app.schemas import CourtOut, SlotAvailability, BookingCreate, BookingOut
from app.security import get_current_user

bookings_router = APIRouter(tags=["Court Bookings"])


@bookings_router.get("/courts", response_model=List[CourtOut])
def list_courts(db: Session = Depends(get_db)):
    return db.query(Court).all()


@bookings_router.get("/courts/{court_id}/availability", response_model=List[SlotAvailability])
def get_court_availability(
    court_id: str,
    date_str: str = Query(..., alias="date", regex=r"^\d{4}-\d{2}-\d{2}$"),
    db: Session = Depends(get_db)
):
    court = db.query(Court).filter(Court.id == court_id).first()
    if not court:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Court not found.")

    target_date = date.fromisoformat(date_str)
    # Define business hours: 06:00 to 22:00 in 1-hour slots
    start_hour = 6
    end_hour = 22

    # Query existing bookings for this date and court
    day_start = datetime(target_date.year, target_date.month, target_date.day, 0, 0, 0, tzinfo=timezone.utc)
    day_end = datetime(target_date.year, target_date.month, target_date.day, 23, 59, 59, tzinfo=timezone.utc)

    existing_bookings = db.query(Booking).filter(
        Booking.court_id == court_id,
        Booking.slot_start >= day_start,
        Booking.slot_start <= day_end,
        Booking.payment_status.in_(["PENDING", "CONFIRMED"])
    ).all()

    booked_slot_starts = {b.slot_start.astimezone(timezone.utc) for b in existing_bookings}

    availability: List[SlotAvailability] = []
    for h in range(start_hour, end_hour):
        slot_start = datetime(target_date.year, target_date.month, target_date.day, h, 0, 0, tzinfo=timezone.utc)
        slot_end = slot_start + timedelta(hours=1)

        is_booked = any(b_start == slot_start for b_start in booked_slot_starts)
        availability.append(SlotAvailability(
            slot_start=slot_start,
            slot_end=slot_end,
            is_available=not is_booked
        ))

    return availability


@bookings_router.post("/bookings", response_model=BookingOut, status_code=status.HTTP_201_CREATED)
def create_booking(
    payload: BookingCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    court = db.query(Court).filter(Court.id == payload.court_id).first()
    if not court:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Court not found.")

    # Standardize to UTC
    slot_start_utc = payload.slot_start.astimezone(timezone.utc) if payload.slot_start.tzinfo else payload.slot_start.replace(tzinfo=timezone.utc)
    slot_end_utc = payload.slot_end.astimezone(timezone.utc) if payload.slot_end.tzinfo else payload.slot_end.replace(tzinfo=timezone.utc)

    # 1. Acquire Redis/in-memory lock: lock:court:{id}:{slot} with 5-minute TTL (300s)
    lock_key = f"lock:court:{court.id}:{slot_start_utc.isoformat()}"
    lock_acquired = cache.set_with_lock(lock_key, current_user.id, ex=300)
    if not lock_acquired:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This court slot is currently locked or being booked by another user. Please choose another slot."
        )

    try:
        # 2. Check if already booked in DB
        existing = db.query(Booking).filter(
            Booking.court_id == court.id,
            Booking.slot_start == slot_start_utc,
            Booking.payment_status.in_(["PENDING", "CONFIRMED"])
        ).first()

        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Court is already booked for this slot."
            )

        booking = Booking(
            user_id=current_user.id,
            court_id=court.id,
            slot_start=slot_start_utc,
            slot_end=slot_end_utc,
            payment_status="PENDING"
        )
        db.add(booking)
        db.commit()
        db.refresh(booking)
        return booking

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Conflict: This court slot has already been booked."
        )
    finally:
        # Rule: Booking lock is released after the PENDING booking row is committed; the unique DB constraint remains the final guard.
        cache.delete(lock_key)


@bookings_router.get("/bookings/me", response_model=List[BookingOut])
def get_my_bookings(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    bookings = db.query(Booking).filter(
        Booking.user_id == current_user.id
    ).order_by(Booking.slot_start.desc()).all()
    return bookings

