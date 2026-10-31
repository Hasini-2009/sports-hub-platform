from typing import List, Tuple
from sqlalchemy.orm import Session
from app.models import User, Event, Document
from app.schemas import EligibilityCheckItem, EligibilityResult


def evaluate_eligibility(user: User, event: Event, db: Session) -> EligibilityResult:
    """
    Evaluates whether the user satisfies all mandatory requirements for the event.
    Requirements:
    - 'MIN_AGE:n': Checks profile_metrics['age'].
    - 'MEDICAL': Verified MEDICAL document required.
    - 'ID': Verified ID document required.
    - 'WAIVER': Verified WAIVER document required.
    """
    checks: List[EligibilityCheckItem] = []

    # Pre-fetch user's verified documents
    verified_docs = {
        doc.doc_type
        for doc in db.query(Document).filter(
            Document.user_id == user.id,
            Document.is_verified == True
        ).all()
    }

    user_metrics = user.profile_metrics or {}
    user_age = user_metrics.get("age")

    for req in event.mandatory_requirements or []:
        req_clean = req.strip()
        if req_clean.startswith("MIN_AGE:"):
            try:
                min_age = int(req_clean.split(":")[1])
                if user_age is None:
                    checks.append(EligibilityCheckItem(
                        requirement=req_clean,
                        passed=False,
                        message=f"Age not set in profile. Minimum required age is {min_age}."
                    ))
                elif user_age < min_age:
                    checks.append(EligibilityCheckItem(
                        requirement=req_clean,
                        passed=False,
                        message=f"Current age ({user_age}) does not meet the minimum requirement of {min_age}."
                    ))
                else:
                    checks.append(EligibilityCheckItem(
                        requirement=req_clean,
                        passed=True,
                        message=f"Age requirement satisfied ({user_age} >= {min_age})."
                    ))
            except ValueError:
                checks.append(EligibilityCheckItem(
                    requirement=req_clean,
                    passed=False,
                    message=f"Invalid age requirement format: {req_clean}."
                ))

        elif req_clean == "MEDICAL":
            if "MEDICAL" in verified_docs:
                checks.append(EligibilityCheckItem(
                    requirement="MEDICAL",
                    passed=True,
                    message="Verified medical certificate on file."
                ))
            else:
                checks.append(EligibilityCheckItem(
                    requirement="MEDICAL",
                    passed=False,
                    message="Missing verified MEDICAL certificate in Document Vault."
                ))

        elif req_clean == "ID":
            if "ID" in verified_docs:
                checks.append(EligibilityCheckItem(
                    requirement="ID",
                    passed=True,
                    message="Verified government ID on file."
                ))
            else:
                checks.append(EligibilityCheckItem(
                    requirement="ID",
                    passed=False,
                    message="Missing verified ID document in Document Vault."
                ))

        elif req_clean == "WAIVER":
            if "WAIVER" in verified_docs:
                checks.append(EligibilityCheckItem(
                    requirement="WAIVER",
                    passed=True,
                    message="Verified liability waiver on file."
                ))
            else:
                checks.append(EligibilityCheckItem(
                    requirement="WAIVER",
                    passed=False,
                    message="Missing verified signed WAIVER in Document Vault."
                ))

        else:
            # Custom requirement fallback
            checks.append(EligibilityCheckItem(
                requirement=req_clean,
                passed=True,
                message=f"Requirement '{req_clean}' noted."
            ))

    eligible = all(item.passed for item in checks) if checks else True
    return EligibilityResult(eligible=eligible, checks=checks)

