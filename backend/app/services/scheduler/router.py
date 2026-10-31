import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User, Event, Match, Registration
from app.schemas import SchedulerGenerateRequest, SchedulerResponse, MatchOut
from app.security import get_current_user, require_role
from app.services.scheduler.solver import TournamentScheduler
from app.services.notifications.dispatcher import notification_dispatcher

logger = logging.getLogger(__name__)

scheduler_router = APIRouter(prefix="/scheduler", tags=["AI Tournament Scheduler"])


@scheduler_router.post("/generate", response_model=SchedulerResponse)
def generate_schedule(
    payload: SchedulerGenerateRequest,
    current_user: User = Depends(get_current_user)
):
    try:
        scheduler = TournamentScheduler(
            teams=payload.teams,
            courts_count=payload.courts_count,
            match_duration_mins=payload.match_duration_mins,
            start_time=payload.start_time,
            min_rest_slots=payload.min_rest_slots,
            format_type=payload.format
        )
        result = scheduler.solve()
        return SchedulerResponse(**result)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Tournament schedule generation failed: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Solver internal error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Scheduling error: {str(e)}"
        )


@scheduler_router.post("/generate/{event_id}/commit", response_model=List[MatchOut])
def commit_schedule(
    event_id: str,
    payload: SchedulerGenerateRequest,
    organizer: User = Depends(require_role("organizer")),
    db: Session = Depends(get_db)
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found.")

    try:
        scheduler = TournamentScheduler(
            teams=payload.teams,
            courts_count=payload.courts_count,
            match_duration_mins=payload.match_duration_mins,
            start_time=payload.start_time,
            min_rest_slots=payload.min_rest_slots,
            format_type=payload.format
        )
        solution = scheduler.solve()
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Tournament schedule generation failed: {str(e)}"
        )

    # Clean existing matches for this tournament
    db.query(Match).filter(Match.tournament_id == event.id).delete()

    created_matches = []
    for sm in solution["matches"]:
        match_row = Match(
            tournament_id=event.id,
            team_a=sm["team_a"],
            team_b=sm["team_b"],
            court_number=sm["court_number"],
            start_time=sm["start_time"],
            score_a=0,
            score_b=0,
            status="SCHEDULED"
        )
        db.add(match_row)
        created_matches.append(match_row)

    db.commit()

    # Dispatch MATCH_SCHEDULE_UPDATED notification to all registered participants
    registrations = db.query(Registration).filter(
        Registration.event_id == event.id,
        Registration.status == "CONFIRMED"
    ).all()

    for reg in registrations:
        notification_dispatcher.dispatch(
            user_id=reg.user_id,
            title="Tournament Schedule Published!",
            body=f"Timetable for '{event.title}' has been scheduled across {payload.courts_count} courts.",
            kind="MATCH_SCHEDULE_UPDATED",
            db=db
        )

    # Also notify the organizer
    notification_dispatcher.dispatch(
        user_id=organizer.id,
        title="Schedule Committed Successfully",
        body=f"Committed {len(created_matches)} matches for '{event.title}'.",
        kind="MATCH_SCHEDULE_UPDATED",
        db=db
    )

    return created_matches

