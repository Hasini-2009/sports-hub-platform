import os
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models import User, Document
from app.schemas import (
    UserRegister,
    UserLogin,
    UserOut,
    Token,
    MetricsUpdate,
    DeviceTokenUpdate,
    DocumentOut,
)
from app.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    get_current_user,
    require_role,
)

auth_router = APIRouter(prefix="/auth", tags=["Auth"])
vault_router = APIRouter(prefix="/vault", tags=["Document Vault"])


# ========================== AUTH ==========================

@auth_router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: UserRegister, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email.lower()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists."
        )

    user = User(
        name=payload.name,
        email=payload.email.lower(),
        password_hash=get_password_hash(payload.password),
        role=payload.role,
        profile_metrics=payload.profile_metrics or {}
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@auth_router.post("/login", response_model=Token)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    access_token = create_access_token(data={"sub": user.id, "email": user.email, "role": user.role})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }


@auth_router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@auth_router.put("/me/metrics", response_model=UserOut)
def update_metrics(payload: MetricsUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    metrics = dict(current_user.profile_metrics or {})
    if payload.height is not None:
        metrics["height"] = payload.height
    if payload.weight is not None:
        metrics["weight"] = payload.weight
    if payload.age is not None:
        metrics["age"] = payload.age
    if payload.fitness_score is not None:
        metrics["fitness_score"] = payload.fitness_score

    current_user.profile_metrics = metrics
    db.commit()
    db.refresh(current_user)
    return current_user


@auth_router.put("/me/device-token", response_model=UserOut)
def update_device_token(payload: DeviceTokenUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    current_user.device_token = payload.device_token
    db.commit()
    db.refresh(current_user)
    return current_user


# ========================== VAULT ==========================

ALLOWED_DOC_TYPES = {"ID", "MEDICAL", "WAIVER"}

@vault_router.post("/documents", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def upload_document(
    doc_type: str = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    normalized_doc_type = doc_type.upper().strip()
    if normalized_doc_type not in ALLOWED_DOC_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid doc_type. Must be one of: {', '.join(sorted(ALLOWED_DOC_TYPES))}"
        )

    # Ensure uploads directory exists
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    # Generate safe randomized filename
    ext = os.path.splitext(file.filename or "")[1] or ".dat"
    storage_filename = f"{uuid.uuid4().hex}{ext}"
    storage_path = os.path.join(settings.UPLOAD_DIR, storage_filename)

    contents = await file.read()
    with open(storage_path, "wb") as f:
        f.write(contents)

    doc = Document(
        user_id=current_user.id,
        doc_type=normalized_doc_type,
        storage_url=f"/uploads/{storage_filename}",
        is_verified=False
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


@vault_router.get("/documents", response_model=List[DocumentOut])
def get_user_documents(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Uploaded documents are private to their owner
    docs = db.query(Document).filter(Document.user_id == current_user.id).order_by(Document.uploaded_at.desc()).all()
    return docs


@vault_router.get("/pending-verifications", response_model=List[DocumentOut])
def get_pending_verifications(
    organizer: User = Depends(require_role("organizer")),
    db: Session = Depends(get_db)
):
    """Allows organizers to list documents awaiting verification."""
    docs = db.query(Document).filter(Document.is_verified == False).order_by(Document.uploaded_at.desc()).all()
    return docs


@vault_router.post("/documents/{document_id}/verify", response_model=DocumentOut)
def verify_document(
    document_id: str,
    organizer: User = Depends(require_role("organizer")),
    db: Session = Depends(get_db)
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    doc.is_verified = True
    db.commit()
    db.refresh(doc)
    return doc

