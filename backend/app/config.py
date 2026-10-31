import os
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Sports Hub Platform"
    API_V1_PREFIX: str = "/api/v1"
    SECRET_KEY: str = "sports-hub-jwt-super-secret-key-min-32-chars-long!"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # Database & Cache
    DATABASE_URL: Optional[str] = None
    REDIS_URL: Optional[str] = None

    # Modes: mock | live
    PAYMENT_MODE: str = "mock"
    NOTIFY_MODE: str = "mock"

    # AI & RAG
    OLLAMA_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "gemma3:1b"
    CHROMA_PERSIST_DIR: str = "./chroma_db"

    # File uploads
    UPLOAD_DIR: str = "./uploads"

    # Live gateway credentials (optional, default empty)
    STRIPE_API_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""
    PHONEPE_MERCHANT_ID: str = ""
    PHONEPE_SALT_KEY: str = ""
    PHONEPE_SALT_INDEX: str = "1"
    PHONEPE_ENV: str = "UAT"  # UAT or PROD

    # Notification credentials (optional)
    FCM_SERVER_KEY: str = ""
    APNS_AUTH_KEY: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()

