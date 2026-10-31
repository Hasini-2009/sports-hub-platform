import logging
from app.config import settings

logger = logging.getLogger(__name__)

class FCMClient:
    def __init__(self):
        self.server_key = settings.FCM_SERVER_KEY

    def send_push(self, token: str, title: str, body: str, data: dict = None) -> bool:
        if not self.server_key or not token:
            logger.info(f"[FCM Mock/Disabled] Push to token {token[:10]}...: '{title}' - {body}")
            return True

        try:
            import httpx
            headers = {
                "Authorization": f"key={self.server_key}",
                "Content-Type": "application/json"
            }
            payload = {
                "to": token,
                "notification": {"title": title, "body": body},
                "data": data or {}
            }
            with httpx.Client(timeout=5.0) as client:
                res = client.post("https://fcm.googleapis.com/fcm/send", json=payload, headers=headers)
                return res.status_code == 200
        except Exception as e:
            logger.error(f"FCM push failed: {e}")
            return False

