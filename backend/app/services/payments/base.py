from abc import ABC, abstractmethod
from typing import Dict, Any, Tuple


class PaymentGateway(ABC):
    @abstractmethod
    def create_order(self, amount: int, currency: str, purpose: str, ref_id: str) -> Dict[str, Any]:
        """Creates an order at the gateway and returns gateway metadata and identifiers."""
        pass

    @abstractmethod
    def verify_webhook(self, headers: Dict[str, str], body: bytes) -> Tuple[bool, str, Dict[str, Any]]:
        """
        Verifies webhook payload authenticity.
        Returns: (is_valid, gateway_order_id, event_data)
        """
        pass

