from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    status,
)
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.dependencies import (
    get_db,
    require_permission,
)
from app.models.user import User
from app.schemas.patient import (
    PatientCreate,
    PatientResponse,
    PatientUpdate,
)
from app.services.patient_service import (
    create_patient,
    get_paginated_patients,
    get_patient_by_id,
    get_patients,
    update_patient,
)


router = APIRouter()


class PatientPageResponse(BaseModel):
    items: list[PatientResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


# =========================================================
# LIST PATIENTS
#
# Kept for backward compatibility with other pages that
# currently expect a plain array, including Consultations.
# =========================================================

@router.get(
    "/",
    response_model=list[PatientResponse],
)
def list_patients(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission(
            "PATIENT_VIEW"
        )
    ),
):
    return get_patients(db)


# =========================================================
# PAGINATED PATIENT LIST
# =========================================================

@router.get(
    "/paginated",
    response_model=PatientPageResponse,
)
def list_paginated_patients(
    page: int = Query(
        default=1,
        ge=1,
    ),
    page_size: int = Query(
        default=25,
        ge=1,
        le=100,
    ),
    search: str | None = Query(
        default=None,
        max_length=120,
    ),
    gender: str | None = Query(
        default=None,
    ),
    category: str | None = Query(
        default=None,
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission(
            "PATIENT_VIEW"
        )
    ),
):
    items, total = (
        get_paginated_patients(
            db,
            page=page,
            page_size=page_size,
            search=search,
            gender=gender,
            category=category,
        )
    )

    total_pages = max(
        1,
        (
            total
            + page_size
            - 1
        )
        // page_size,
    )

    return PatientPageResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


# =========================================================
# REGISTER PATIENT
# =========================================================

@router.post(
    "/",
    response_model=PatientResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_patient(
    data: PatientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission(
            "PATIENT_CREATE"
        )
    ),
):
    return create_patient(
        db,
        data,
        registered_by=current_user.id,
    )


# =========================================================
# VIEW PATIENT
# =========================================================

@router.get(
    "/{patient_id}",
    response_model=PatientResponse,
)
def view_patient(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission(
            "PATIENT_VIEW"
        )
    ),
):
    patient = get_patient_by_id(
        db,
        patient_id,
    )

    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found",
        )

    return patient


# =========================================================
# UPDATE PATIENT
# =========================================================

@router.patch(
    "/{patient_id}",
    response_model=PatientResponse,
)
def edit_patient(
    patient_id: int,
    data: PatientUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission(
            "PATIENT_UPDATE"
        )
    ),
):
    patient = get_patient_by_id(
        db,
        patient_id,
    )

    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found",
        )

    return update_patient(
        db,
        patient,
        data,
    )
