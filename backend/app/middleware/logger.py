import time
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

logger = logging.getLogger("sports_hub.access")

class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        client_ip = request.client.host if request.client else "unknown"
        response = await call_next(request)
        process_time = (time.time() - start_time) * 1000
        logger.info(
            f"{client_ip} - \"{request.method} {request.url.path}\" "
            f"{response.status_code} ({process_time:.2f}ms)"
        )
        return response

