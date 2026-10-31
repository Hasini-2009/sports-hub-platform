import base64
import hashlib
import json
import logging
from typing import Dict, Any, Tuple
from app.config import settings
from app.services.payments.base import PaymentGateway

logger = logging.getLogger(__name__)


class PhonePeGateway(PaymentGateway):
    def __init__(self):
        self.merchant_id = settings.PHONEPE_MERCHANT_ID
        self.salt_key = settings.PHONEPE_SALT_KEY
        self.salt_index = settings.PHONEPE_SALT_INDEX
        self.env = settings.PHONEPE_ENV

    def create_order(self, amount: int, currency: str, purpose: str, ref_id: str) -> Dict[str, Any]:
        try:
            import httpx
            transaction_id = f"TXN_{ref_id[:16]}_{int(hashlib.md5(ref_id.encode()).hexdigest()[:8], 16)}"
            payload_data = {
                "merchantId": self.merchant_id,
                "merchantTransactionId": transaction_id,
                "merchantUserId": "U_SPORTSHUB",
                "amount": amount,
                "redirectUrl": f"https://sportshub.internal/payments/callback?ref={ref_id}",
                "redirectMode": "POST",
                "callbackUrl": f"https://sportshub.internal/api/v1/payments/webhook/phonepe",
                "paymentInstrument": {"type": "PAY_PAGE"}
            }
            base64_payload = base64.b64encode(json.dumps(payload_data).encode("utf-8")).decode("utf-8")
            data_to_hash = f"{base64_payload}/pg/v1/pay{self.salt_key}"
            checksum = hashlib.sha256(data_to_hash.encode("utf-8")).hexdigest() + f"###{self.salt_index}"

            endpoint = "https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/pay" if self.env == "UAT" else "https://api.phonepe.com/apis/hermes/pg/v1/pay"
            with httpx.Client() as client:
                resp = client.post(
                    endpoint,
                    json={"request": base64_payload},
                    headers={"Content-Type": "application/json", "X-VERIFY": checksum},
                    timeout=10.0
                )
                data = resp.json()
                redirect_url = data.get("data", {}).get("instrumentResponse", {}).get("redirectInfo", {}).get("url", "")
                return {
                    "order_id": transaction_id,
                    "checkout_url_or_token": redirect_url or transaction_id,
                    "raw": data
                }
        except Exception as e:
            logger.error(f"PhonePe order creation failed: {e}")
            raise RuntimeError(f"PhonePe error: {e}")

    def verify_webhook(self, headers: Dict[str, str], body: bytes) -> Tuple[bool, str, Dict[str, Any]]:
        x_verify = headers.get("X-VERIFY") or headers.get("x-verify", "")
        if not x_verify or not self.salt_key:
            return (False, "", {"error": "Missing X-VERIFY or salt"})

        try:
            body_str = body.decode("utf-8")
            # Expected format: SHA256(response_base64 + salt_key) + ### + salt_index
            data_to_hash = f"{body_str}{self.salt_key}"
            calc_hash = hashlib.sha256(data_to_hash.encode("utf-8")).hexdigest()
            expected_verify = f"{calc_hash}###{self.salt_index}"

            if x_verify == expected_verify:
                data = json.loads(body_str)
                order_id = data.get("response", {}).get("data", {}).get("merchantTransactionId", "")
                return (True, order_id, data)
        except Exception as e:
            logger.error(f"PhonePe verification exception: {e}")
        return (False, "", {"error": "Verification failed"})

