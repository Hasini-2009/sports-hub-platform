import os
import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from app.config import settings
from app.db import Base, engine, SessionLocal
from app.seed import seed_database
from app.middleware.logger import RequestLoggingMiddleware
from app.middleware.rate_limit import SimpleRateLimiter
from app.models import Match, Registration, Notification
from app.services.injury_ai.rag import rag_service
from app.services.notifications.dispatcher import notification_dispatcher

# Routers
from app.services.auth_vault.router import auth_router, vault_router
from app.services.events.router import events_router
from app.services.bookings.router import bookings_router
from app.services.payments.router import payments_router
from app.services.notifications.router import notifications_router
from app.services.injury_ai.router import injury_router
from app.services.scheduler.router import scheduler_router
from app.services.live.router import live_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("sports_hub.main")

match_reminder_task = None


async def match_reminder_worker():
    """Background task running every 60s to check for matches starting in ~1 hour."""
    logger.info("Match reminder background worker started.")
    while True:
        try:
            await asyncio.sleep(60)
            now = datetime.now(timezone.utc)
            window_start = now + timedelta(minutes=50)
            window_end = now + timedelta(minutes=70)

            db = SessionLocal()
            try:
                upcoming_matches = db.query(Match).filter(
                    Match.start_time >= window_start,
                    Match.start_time <= window_end,
                    Match.status == "SCHEDULED"
                ).all()

                for match in upcoming_matches:
                    # Check registered users for this tournament
                    regs = db.query(Registration).filter(
                        Registration.event_id == match.tournament_id,
                        Registration.status == "CONFIRMED"
                    ).all()

                    for reg in regs:
                        # Avoid spamming multiple reminders
                        existing_rem = db.query(Notification).filter(
                            Notification.user_id == reg.user_id,
                            Notification.kind == "MATCH_REMINDER",
                            Notification.title.ilike(f"%{match.team_a}%")
                        ).first()

                        if not existing_rem:
                            notification_dispatcher.dispatch(
                                user_id=reg.user_id,
                                title=f"Match Reminder: {match.team_a} vs {match.team_b}",
                                body=f"Your scheduled match on Court {match.court_number} starts in ~1 hour.",
                                kind="MATCH_REMINDER",
                                db=db
                            )
            finally:
                db.close()
        except asyncio.CancelledError:
            logger.info("Match reminder background worker stopped.")
            break
        except Exception as e:
            logger.warning(f"Error in match reminder worker: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    global match_reminder_task
    logger.info("Starting Sports Hub Platform...")

    # 1. Create DB tables
    Base.metadata.create_all(bind=engine)

    # 2. Seed initial data
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()

    # 3. Initialize ChromaDB RAG
    rag_service.initialize()

    # 4. Start background reminder task
    match_reminder_task = asyncio.create_task(match_reminder_worker())

    yield

    # Shutdown
    if match_reminder_task:
        match_reminder_task.cancel()
        try:
            await match_reminder_task
        except asyncio.CancelledError:
            pass
    logger.info("Sports Hub Platform shutdown complete.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    description="Full-stack Sports Hub MVP - Events, Document Vault, Court Bookings, Payments, Live Scores & AI RAG.",
    lifespan=lifespan
)

# Middlewares
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(SimpleRateLimiter, max_requests=300, window_seconds=60)
app.add_middleware(RequestLoggingMiddleware)

# Static file uploads
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# Health check
@app.get("/health", tags=["Health"])
def health():
    return {
        "status": "ok",
        "app": settings.PROJECT_NAME,
        "payment_mode": settings.PAYMENT_MODE,
        "notify_mode": settings.NOTIFY_MODE
    }

# API v1 Routers
api_v1 = settings.API_V1_PREFIX
app.include_router(auth_router, prefix=api_v1)
app.include_router(vault_router, prefix=api_v1)
app.include_router(events_router, prefix=api_v1)
app.include_router(bookings_router, prefix=api_v1)
app.include_router(payments_router, prefix=api_v1)
app.include_router(notifications_router, prefix=api_v1)
app.include_router(injury_router, prefix=api_v1)
app.include_router(scheduler_router, prefix=api_v1)
app.include_router(live_router, prefix=api_v1)

# Root level WebSocket mount
app.include_router(live_router)

