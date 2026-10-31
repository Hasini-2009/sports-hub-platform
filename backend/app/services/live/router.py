import json
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Match, User
from app.schemas import MatchOut, ScoreUpdate
from app.security import require_role

logger = logging.getLogger(__name__)

live_router = APIRouter(tags=["Live Scores"])


class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket client connected. Total clients: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info(f"WebSocket client disconnected. Total clients: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        stale_connections = []
        payload_text = json.dumps(message)
        for connection in self.active_connections:
            try:
                await connection.send_text(payload_text)
            except Exception as e:
                logger.warning(f"Error sending message to websocket: {e}")
                stale_connections.append(connection)

        for stale in stale_connections:
            if stale in self.active_connections:
                self.active_connections.remove(stale)


manager = ConnectionManager()


@live_router.get("/live/matches", response_model=List[MatchOut])
def get_live_matches(
    tournament_id: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db)
):
    query = db.query(Match)
    if tournament_id:
        query = query.filter(Match.tournament_id == tournament_id)
    if status_filter:
        query = query.filter(Match.status == status_filter)
    return query.order_by(Match.start_time.asc()).all()


@live_router.put("/live/matches/{match_id}/score", response_model=MatchOut)
async def update_match_score(
    match_id: str,
    payload: ScoreUpdate,
    editor: User = Depends(require_role("referee", "organizer")),
    db: Session = Depends(get_db)
):
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Match not found.")

    match.score_a = payload.score_a
    match.score_b = payload.score_b
    if payload.status:
        match.status = payload.status
    elif match.status == "SCHEDULED":
        match.status = "LIVE"

    db.commit()
    db.refresh(match)

    # Broadcast update to all live WebSocket subscribers
    broadcast_data = {
        "event": "SCORE_UPDATE",
        "match": {
            "id": match.id,
            "tournament_id": match.tournament_id,
            "team_a": match.team_a,
            "team_b": match.team_b,
            "court_number": match.court_number,
            "start_time": match.start_time.isoformat(),
            "score_a": match.score_a,
            "score_b": match.score_b,
            "status": match.status
        }
    }
    await manager.broadcast(broadcast_data)

    return match


@live_router.websocket("/ws/live")
async def websocket_live_scores(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        # Send initial confirmation
        await websocket.send_text(json.dumps({"event": "CONNECTED", "message": "Subscribed to live scoreboard feed"}))
        while True:
            # Keep receiving pings or heartbeat messages
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text(json.dumps({"event": "PONG"}))
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.warning(f"WebSocket loop exception: {e}")
        manager.disconnect(websocket)

