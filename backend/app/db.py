import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import settings

logger = logging.getLogger(__name__)

Base = declarative_base()

def get_engine():
    db_url = settings.DATABASE_URL
    if db_url and db_url.strip():
        try:
            logger.info("Testing connection to configured DATABASE_URL...")
            test_engine = create_engine(db_url, pool_pre_ping=True)
            with test_engine.connect() as conn:
                logger.info("Successfully connected to primary database.")
            return test_engine
        except Exception as e:
            logger.warning(f"Could not connect to primary DATABASE_URL ({e}). Falling back to SQLite.")

    import os
    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    db_file = os.path.join(backend_dir, "sportshub.db").replace("\\", "/")
    sqlite_url = f"sqlite:///{db_file}"
    logger.info(f"Using SQLite fallback database: {sqlite_url}")
    return create_engine(
        sqlite_url,
        connect_args={"check_same_thread": False}
    )

engine = get_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

