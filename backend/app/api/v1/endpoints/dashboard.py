from fastapi import (
    APIRouter,
    Depends,
)
from sqlalchemy.orm import Session

from app.api.dependencies import (
    get_db,
    require_permission,
)
from app.models.user import User
from app.schemas.dashboard import (
    DashboardSummaryResponse,
)
from app.services.dashboard_service import (
    get_dashboard_analytics,
    get_dashboard_summary,
)


router = APIRouter()


# =========================================================
# PERMISSION HELPER
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


# =========================================================
# DASHBOARD SUMMARY
# =========================================================

@router.get(
    "/summary",
    response_model=DashboardSummaryResponse,
)
def dashboard_summary(
    db: Session = Depends(
        get_db
    ),
    current_user: User = Depends(
        require_permission(
            "PATIENT_VIEW"
        )
    ),
):
    return get_dashboard_summary(
        db=db,
        include_inventory=(
            user_has_permission(
                current_user,
                "INVENTORY_VIEW",
            )
        ),
        include_surveillance=(
            user_has_permission(
                current_user,
                "SURVEILLANCE_VIEW",
            )
        ),
    )


# =========================================================
# DASHBOARD ANALYTICS
# =========================================================

@router.get(
    "/analytics",
)
def dashboard_analytics(
    db: Session = Depends(
        get_db
    ),
    current_user: User = Depends(
        require_permission(
            "PATIENT_VIEW"
        )
    ),
):
    """
    RBAC-aware general-scope dashboard analytics.

    All outputs are database aggregates or deterministic
    comparisons. No generative AI is used.
    """

    return get_dashboard_analytics(
        db=db,
        include_surveillance=(
            user_has_permission(
                current_user,
                "SURVEILLANCE_VIEW",
            )
        ),
        include_pending_validation=(
            user_has_permission(
                current_user,
                "DISEASE_CASE_VALIDATE",
            )
        ),
    )
