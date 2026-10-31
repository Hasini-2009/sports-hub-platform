import time
import threading
import logging
from typing import Optional, Any

logger = logging.getLogger(__name__)

class InMemoryCache:
    """Thread-safe in-memory cache mimicking Redis key-value operations with TTL."""
    def __init__(self):
        self._store: dict[str, tuple[Any, Optional[float]]] = {}
        self._lock = threading.Lock()

    def _purge_expired(self, key: str) -> bool:
        if key in self._store:
            val, expiry = self._store[key]
            if expiry is not None and time.time() > expiry:
                del self._store[key]
                return True
        return False

    def get(self, key: str) -> Optional[str]:
        with self._lock:
            self._purge_expired(key)
            if key in self._store:
                return str(self._store[key][0])
            return None

    def set(self, key: str, value: Any, ex: Optional[int] = None) -> bool:
        with self._lock:
            expiry = time.time() + ex if ex else None
            self._store[key] = (str(value), expiry)
            return True

    def setnx(self, key: str, value: Any) -> bool:
        with self._lock:
            self._purge_expired(key)
            if key in self._store:
                return False
            self._store[key] = (str(value), None)
            return True

    def set_with_lock(self, key: str, value: Any, ex: int) -> bool:
        """Atomic SET key value NX EX seconds."""
        with self._lock:
            self._purge_expired(key)
            if key in self._store:
                return False
            expiry = time.time() + ex
            self._store[key] = (str(value), expiry)
            return True

    def expire(self, key: str, seconds: int) -> bool:
        with self._lock:
            self._purge_expired(key)
            if key in self._store:
                val, _ = self._store[key]
                self._store[key] = (val, time.time() + seconds)
                return True
            return False

    def delete(self, key: str) -> int:
        with self._lock:
            if key in self._store:
                del self._store[key]
                return 1
            return 0


class RedisWrapper:
    """Wraps redis.Redis with graceful fallback to in-memory on error."""
    def __init__(self, redis_client, fallback: InMemoryCache):
        self.client = redis_client
        self.fallback = fallback

    def get(self, key: str) -> Optional[str]:
        try:
            val = self.client.get(key)
            return val.decode("utf-8") if isinstance(val, bytes) else val
        except Exception as e:
            logger.warning(f"Redis get failed: {e}. Using fallback.")
            return self.fallback.get(key)

    def set(self, key: str, value: Any, ex: Optional[int] = None) -> bool:
        try:
            return bool(self.client.set(key, value, ex=ex))
        except Exception as e:
            logger.warning(f"Redis set failed: {e}. Using fallback.")
            return self.fallback.set(key, value, ex=ex)

    def setnx(self, key: str, value: Any) -> bool:
        try:
            return bool(self.client.setnx(key, value))
        except Exception as e:
            logger.warning(f"Redis setnx failed: {e}. Using fallback.")
            return self.fallback.setnx(key, value)

    def set_with_lock(self, key: str, value: Any, ex: int) -> bool:
        try:
            res = self.client.set(key, value, nx=True, ex=ex)
            return bool(res)
        except Exception as e:
            logger.warning(f"Redis set_with_lock failed: {e}. Using fallback.")
            return self.fallback.set_with_lock(key, value, ex)

    def expire(self, key: str, seconds: int) -> bool:
        try:
            return bool(self.client.expire(key, seconds))
        except Exception as e:
            logger.warning(f"Redis expire failed: {e}. Using fallback.")
            return self.fallback.expire(key, seconds)

    def delete(self, key: str) -> int:
        try:
            return int(self.client.delete(key))
        except Exception as e:
            logger.warning(f"Redis delete failed: {e}. Using fallback.")
            return self.fallback.delete(key)


def init_cache():
    from app.config import settings
    in_memory = InMemoryCache()
    if settings.REDIS_URL:
        try:
            import redis
            r = redis.from_url(settings.REDIS_URL, decode_responses=True, socket_timeout=2)
            r.ping()
            logger.info("Successfully connected to Redis.")
            return RedisWrapper(r, in_memory)
        except Exception as e:
            logger.warning(f"Could not connect to Redis ({e}). Using in-memory cache.")
    else:
        logger.info("REDIS_URL not set. Using in-memory cache.")
    return in_memory

cache = init_cache()

