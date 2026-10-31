import uuid
from typing import Dict, Any, Tuple
from app.services.payments.base import PaymentGateway


class MockGateway(PaymentGateway):
    def create_order(self, amount: int, currency: str, purpose: str, ref_id: str) -> Dict[str, Any]:
        mock_order_id = f"mock_ord_{uuid.uuid4().hex[:12]}"
        return {
            "order_id": mock_order_id,
            "checkout_url_or_token": f"https://mock-pay.sportshub.internal/checkout/{mock_order_id}",
            "raw": {"status": "created", "mode": "mock"}
        }

    def verify_webhook(self, headers: Dict[str, str], body: bytes) -> Tuple[bool, str, Dict[str, Any]]:
        # Mock mode accepts mock signatures or test triggers
        import json
        try:
            data = json.loads(body.decode("utf-8")) if body else {}
        except Exception:
            data = {}
        order_id = data.get("order_id", "mock_order_auto")
        return (True, order_id, data)

