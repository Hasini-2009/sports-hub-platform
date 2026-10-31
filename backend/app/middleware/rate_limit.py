import time
from collections import defaultdict
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

class SimpleRateLimiter(BaseHTTPMiddleware):
    """Simple in-memory token rate limiter per client IP (120 req/minute)."""
    def __init__(self, app, max_requests: int = 240, window_seconds: int = 60):
        super().__init__(app)
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests: dict[str, list[float]] = defaultdict(list)

    async def dispatch(self, request: Request, call_next):
        # Exclude websockets and health check from rate limiting
        if request.url.path.startswith("/ws") or request.url.path == "/health":
            return await call_next(request)

        client_ip = request.client.host if request.client else "127.0.0.1"
        now = time.time()
        window_start = now - self.window_seconds

        # Clean old timestamps
        timestamps = [t for t in self.requests[client_ip] if t > window_start]
        self.requests[client_ip] = timestamps

        if len(timestamps) >= self.max_requests:
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please slow down."}
            )

        self.requests[client_ip].append(now)
        return await call_next(request)

