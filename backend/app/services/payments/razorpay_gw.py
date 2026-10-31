import hmac
import hashlib
import json
import logging
from typing import Dict, Any, Tuple
from app.config import settings
from app.services.payments.base import PaymentGateway

logger = logging.getLogger(__name__)


class RazorpayGateway(PaymentGateway):
    def __init__(self):
        self.key_id = settings.RAZORPAY_KEY_ID
        self.key_secret = settings.RAZORPAY_KEY_SECRET

    def create_order(self, amount: int, currency: str, purpose: str, ref_id: str) -> Dict[str, Any]:
        try:
            import httpx
            auth = (self.key_id, self.key_secret)
            payload = {
                "amount": amount,
                "currency": currency.upper(),
                "receipt": f"rcpt_{ref_id[:16]}",
                "notes": {"purpose": purpose, "ref_id": ref_id}
            }
            with httpx.Client() as client:
                resp = client.post(
                    "https://api.razorpay.com/v1/orders",
                    json=payload,
                    auth=auth,
                    timeout=10.0
                )
                resp.raise_for_status()
                data = resp.json()
                return {
                    "order_id": data["id"],
                    "checkout_url_or_token": data["id"],
                    "raw": data
                }
        except Exception as e:
            logger.error(f"Razorpay order creation failed: {e}")
            raise RuntimeError(f"Razorpay error: {e}")

    def verify_webhook(self, headers: Dict[str, str], body: bytes) -> Tuple[bool, str, Dict[str, Any]]:
        signature = headers.get("X-Razorpay-Signature") or headers.get("x-razorpay-signature", "")
        if not signature or not self.key_secret:
            return (False, "", {"error": "Missing signature or secret"})

        expected = hmac.new(
            self.key_secret.encode("utf-8"),
            body,
            hashlib.sha256
        ).hexdigest()

        if hmac.compare_digest(expected, signature):
            try:
                data = json.loads(body.decode("utf-8"))
                order_id = data.get("payload", {}).get("payment", {}).get("entity", {}).get("order_id", "")
                return (True, order_id, data)
            except Exception:
                return (True, "", {})
        return (False, "", {"error": "Invalid signature"})

