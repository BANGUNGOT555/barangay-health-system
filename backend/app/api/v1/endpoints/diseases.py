from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    status,
)
from sqlalchemy.orm import Session

from app.api.dependencies import (
    get_db,
    require_permission,
)
from app.models.user import User
from app.schemas.disease import (
    DiseaseCreate,
    DiseaseResponse,
    DiseaseUpdate,
)
from app.services.disease_service import (
    create_disease,
    get_active_diseases,
    get_disease_by_id,
    get_diseases,
    update_disease,
)


router = APIRouter()


# =========================================================
# PERMISSION HELPERS
# =========================================================

def user_has_permission(
    user: User,
    permission_code: str,
) -> bool:
    return any(
        permission.code
        == permission_code
        for role in user.roles
        for permission
        in role.permissions
    )


def can_view_sensitive_diseases(
    user: User,
) -> bool:
    return user_has_permission(
        user,
        "SENSITIVE_DISEASE_VIEW",
    )


def ensure_disease_access(
    disease,
    current_user: User,
) -> None:
    if (
        disease.is_sensitive
        and not can_view_sensitive_diseases(
            current_user
        )
    ):
        raise HTTPException(
            status_code=
                status.HTTP_403_FORBIDDEN,
            detail=(
                "You do not have permission to "
                "access this sensitive disease."
            ),
        )


# =========================================================
# LIST DISEASES
# =========================================================

@router.get(
    "/",
    response_model=
        list[DiseaseResponse],
)
def list_diseases(
    active_only: bool = Query(
        default=False,
    ),
    db: Session = Depends(
        get_db
    ),
    current_user: User = Depends(
        require_permission(
            "PATIENT_VIEW"
        )
    ),
):
    diseases = (
        get_active_diseases(db)
        if active_only
        else get_diseases(db)
    )

    if can_view_sensitive_diseases(
        current_user
    ):
        return diseases

    return [
        disease
        for disease in diseases
        if not disease.is_sensitive
    ]


# =========================================================
# GET DISEASE
# =========================================================

@router.get(
    "/{disease_id}",
    response_model=DiseaseResponse,
)
def get_disease(
    disease_id: int,
    db: Session = Depends(
        get_db
    ),
    current_user: User = Depends(
        require_permission(
            "PATIENT_VIEW"
        )
    ),
):
    disease = get_disease_by_id(
        db,
        disease_id,
    )

    if disease is None:
        raise HTTPException(
            status_code=
                status.HTTP_404_NOT_FOUND,
            detail="Disease not found.",
        )

    ensure_disease_access(
        disease,
        current_user,
    )

    return disease


# =========================================================
# CREATE DISEASE
# =========================================================

@router.post(
    "/",
    response_model=DiseaseResponse,
    status_code=
        status.HTTP_201_CREATED,
)
def add_disease(
    data: DiseaseCreate,
    db: Session = Depends(
        get_db
    ),
    current_user: User = Depends(
        require_permission(
            "USER_MANAGE"
        )
    ),
):
    try:
        return create_disease(
            db=db,
            data=data,
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=
                status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


# =========================================================
# UPDATE DISEASE
# =========================================================

@router.patch(
    "/{disease_id}",
    response_model=DiseaseResponse,
)
def edit_disease(
    disease_id: int,
    data: DiseaseUpdate,
    db: Session = Depends(
        get_db
    ),
    current_user: User = Depends(
        require_permission(
            "USER_MANAGE"
        )
    ),
):
    disease = get_disease_by_id(
        db,
        disease_id,
    )

    if disease is None:
        raise HTTPException(
            status_code=
                status.HTTP_404_NOT_FOUND,
            detail="Disease not found.",
        )

    try:
        return update_disease(
            db=db,
            disease=disease,
            data=data,
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=
                status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
