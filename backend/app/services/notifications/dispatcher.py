import logging
from typing import Optional
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Notification, User
from app.services.notifications.fcm import FCMClient
from app.services.notifications.apns import APNsClient

logger = logging.getLogger(__name__)


class NotificationDispatcher:
    def __init__(self):
        self.fcm = FCMClient()
        self.apns = APNsClient()

    def dispatch(
        self,
        user_id: str,
        title: str,
        body: str,
        kind: str,
        db: Session,
        data: Optional[dict] = None
    ) -> Notification:
        # 1. Always write to notifications table
        notification = Notification(
            user_id=user_id,
            title=title,
            body=body,
            kind=kind,
            read=False
        )
        db.add(notification)
        db.commit()
        db.refresh(notification)

        # 2. Dispatch push if live mode or log in mock mode
        if settings.NOTIFY_MODE == "live":
            user = db.query(User).filter(User.id == user_id).first()
            if user and user.device_token:
                token = user.device_token
                # Distinguish iOS vs Android/Web by token characteristics or default to FCM
                if token.startswith("apns_") or len(token) == 64:
                    self.apns.send_push(token, title, body, data)
                else:
                    self.fcm.send_push(token, title, body, data)
            else:
                logger.info(f"[Live Push Skipped] No device token registered for user {user_id}")
        else:
            logger.info(
                f"[MOCK PUSH] User {user_id} | Kind: {kind} | Title: {title} | Body: {body}"
            )

        return notification


notification_dispatcher = NotificationDispatcher()

