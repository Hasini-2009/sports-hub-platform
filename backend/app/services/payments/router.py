import logging
from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models import User, Payment, Booking, Registration, Court, Event
from app.schemas import PaymentIntentCreate, PaymentIntentOut, PaymentOut
from app.security import get_current_user
from app.services.payments.mock_gw import MockGateway
from app.services.payments.stripe_gw import StripeGateway
from app.services.payments.razorpay_gw import RazorpayGateway
from app.services.payments.phonepe_gw import PhonePeGateway
from app.services.notifications.dispatcher import notification_dispatcher

logger = logging.getLogger(__name__)

payments_router = APIRouter(prefix="/payments", tags=["Payments"])


def get_gateway_instance(gateway_name: str):
    if settings.PAYMENT_MODE == "mock" or gateway_name == "mock":
        return MockGateway()
    if gateway_name == "stripe":
        return StripeGateway()
    if gateway_name == "razorpay":
        return RazorpayGateway()
    if gateway_name == "phonepe":
        return PhonePeGateway()
    return MockGateway()


def on_payment_success(payment: Payment, db: Session) -> Payment:
    """Executes post-payment success mutations idempotently."""
    if payment.status == "SUCCESS":
        return payment

    payment.status = "SUCCESS"

    if payment.purpose == "BOOKING":
        booking = db.query(Booking).filter(Booking.id == payment.ref_id).first()
        if booking:
            booking.payment_status = "CONFIRMED"
            court = db.query(Court).filter(Court.id == booking.court_id).first()
            court_name = court.name if court else "Court"
            slot_str = booking.slot_start.strftime("%Y-%m-%d %H:%M UTC")

            notification_dispatcher.dispatch(
                user_id=payment.user_id,
                title="Court Booking Confirmed!",
                body=f"Your booking for {court_name} at {slot_str} has been confirmed.",
                kind="BOOKING_CONFIRMED",
                db=db
            )

    elif payment.purpose == "REGISTRATION":
        reg = db.query(Registration).filter(Registration.id == payment.ref_id).first()
        if reg:
            reg.status = "CONFIRMED"
            reg.payment_id = payment.id
            event = db.query(Event).filter(Event.id == reg.event_id).first()
            event_title = event.title if event else "Tournament"

            notification_dispatcher.dispatch(
                user_id=payment.user_id,
                title="Tournament Registration Confirmed!",
                body=f"Your registration and entry fee for '{event_title}' are confirmed.",
                kind="REGISTRATION_CONFIRMED",
                db=db
            )

    db.commit()
    db.refresh(payment)
    return payment


@payments_router.post("/create-intent", response_model=PaymentIntentOut, status_code=status.HTTP_201_CREATED)
def create_payment_intent(
    payload: PaymentIntentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    amount = 0
    currency = "INR"

    if payload.purpose == "BOOKING":
        booking = db.query(Booking).filter(
            Booking.id == payload.ref_id,
            Booking.user_id == current_user.id
        ).first()
        if not booking:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found.")
        court = db.query(Court).filter(Court.id == booking.court_id).first()
        amount = court.hourly_price if court else 50000

    elif payload.purpose == "REGISTRATION":
        reg = db.query(Registration).filter(
            Registration.id == payload.ref_id,
            Registration.user_id == current_user.id
        ).first()
        if not reg:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Registration not found.")
        event = db.query(Event).filter(Event.id == reg.event_id).first()
        amount = event.entry_fee if event else 0

    gateway_name = payload.gateway
    gw = get_gateway_instance(gateway_name)
    order_data = gw.create_order(
        amount=amount,
        currency=currency,
        purpose=payload.purpose,
        ref_id=payload.ref_id
    )

    payment = Payment(
        user_id=current_user.id,
        purpose=payload.purpose,
        ref_id=payload.ref_id,
        gateway=gateway_name,
        amount=amount,
        currency=currency,
        gateway_order_id=order_data["order_id"],
        status="PENDING"
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)

    return PaymentIntentOut(
        payment_id=payment.id,
        gateway=gateway_name,
        order_id=order_data["order_id"],
        amount=amount,
        currency=currency,
        checkout_url_or_token=order_data.get("checkout_url_or_token")
    )


@payments_router.post("/mock/complete/{payment_id}", response_model=PaymentOut)
def complete_mock_payment(
    payment_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if settings.PAYMENT_MODE != "mock":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Mock payment completion is permitted only when PAYMENT_MODE=mock."
        )

    payment = db.query(Payment).filter(
        Payment.id == payment_id,
        Payment.user_id == current_user.id
    ).first()
    if not payment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment record not found.")

    updated_payment = on_payment_success(payment, db)
    return updated_payment


@payments_router.post("/webhook/{gateway}")
async def payment_webhook(gateway: str, request: Request, db: Session = Depends(get_db)):
    gw = get_gateway_instance(gateway)
    headers = dict(request.headers)
    body = await request.body()

    is_valid, gateway_order_id, _ = gw.verify_webhook(headers, body)
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid webhook signature")

    payment = db.query(Payment).filter(Payment.gateway_order_id == gateway_order_id).first()
    if payment:
        on_payment_success(payment, db)
        return {"status": "ok", "message": f"Payment {payment.id} processed successfully."}

    return {"status": "ignored", "message": "No matching payment record found."}

