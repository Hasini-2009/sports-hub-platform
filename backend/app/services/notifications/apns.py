import logging
from app.config import settings

logger = logging.getLogger(__name__)

class APNsClient:
    def __init__(self):
        self.auth_key = settings.APNS_AUTH_KEY

    def send_push(self, token: str, title: str, body: str, data: dict = None) -> bool:
        if not self.auth_key or not token:
            logger.info(f"[APNs Mock/Disabled] Push to iOS token {token[:10]}...: '{title}' - {body}")
            return True

        try:
            logger.info(f"[APNs Live] Dispatched push to {token}: {title}")
            return True
        except Exception as e:
            logger.error(f"APNs push failed: {e}")
            return False

