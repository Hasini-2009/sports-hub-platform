import logging
from typing import Dict, Any, Tuple
from app.config import settings
from app.services.payments.base import PaymentGateway

logger = logging.getLogger(__name__)


class StripeGateway(PaymentGateway):
    def __init__(self):
        self.api_key = settings.STRIPE_API_KEY
        self.webhook_secret = settings.STRIPE_WEBHOOK_SECRET

    def create_order(self, amount: int, currency: str, purpose: str, ref_id: str) -> Dict[str, Any]:
        try:
            import stripe
            stripe.api_key = self.api_key
            # Amount in cents/paise
            session = stripe.checkout.Session.create(
                payment_method_types=["card"],
                line_items=[{
                    "price_data": {
                        "currency": currency.lower(),
                        "product_data": {"name": f"SportsHub {purpose}: {ref_id}"},
                        "unit_amount": amount,
                    },
                    "quantity": 1,
                }],
                mode="payment",
                success_url=f"https://sportshub.internal/payments/success?ref={ref_id}",
                cancel_url=f"https://sportshub.internal/payments/cancel?ref={ref_id}",
                metadata={"purpose": purpose, "ref_id": ref_id}
            )
            return {
                "order_id": session.id,
                "checkout_url_or_token": session.url,
                "raw": session
            }
        except Exception as e:
            logger.error(f"Stripe order creation failed: {e}")
            raise RuntimeError(f"Stripe error: {e}")

    def verify_webhook(self, headers: Dict[str, str], body: bytes) -> Tuple[bool, str, Dict[str, Any]]:
        try:
            import stripe
            stripe.api_key = self.api_key
            sig = headers.get("stripe-signature") or headers.get("Stripe-Signature", "")
            event = stripe.Webhook.construct_event(body, sig, self.webhook_secret)
            order_id = event["data"]["object"]["id"]
            return (True, order_id, event)
        except Exception as e:
            logger.error(f"Stripe webhook signature verification failed: {e}")
            return (False, "", {"error": str(e)})

