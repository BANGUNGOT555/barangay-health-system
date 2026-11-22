from datetime import date, datetime
from typing import Literal

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Request,
    status,
)
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.dependencies import (
    get_db,
    require_permission,
)
from app.models.user import User
from app.services.audit_log_service import (
    create_audit_log,
    get_request_ip,
)


router = APIRouter()


REPORT_PERMISSION_MAP = {
    "PATIENT_REGISTRY": "PATIENT_VIEW",
    "CONSULTATION_REPORT": "PATIENT_VIEW",
    "DISEASE_SURVEILLANCE": "SURVEILLANCE_VIEW",
    "MEDICINE_INVENTORY": "INVENTORY_VIEW",
    "STOCK_MOVEMENT": "INVENTORY_VIEW",
    "FORECAST_REPORT": "FORECAST_VIEW",
}


class ReportAuditRequest(BaseModel):
    event: Literal[
        "GENERATED",
        "CSV_EXPORTED",
        "PRINT_REQUESTED",
    ]

    report_type: Literal[
        "PATIENT_REGISTRY",
        "CONSULTATION_REPORT",
        "DISEASE_SURVEILLANCE",
        "MEDICINE_INVENTORY",
        "STOCK_MOVEMENT",
        "FORECAST_REPORT",
    ]

    report_title: str = Field(
        min_length=1,
        max_length=250,
    )

    start_date: date | None = None
    end_date: date | None = None

    surveillance_scope: Literal[
        "GENERAL",
        "SENSITIVE",
    ] | None = None

    stock_transaction_type: str | None = Field(
        default=None,
        max_length=50,
    )

    forecast_scope: Literal[
        "DISEASE",
        "MEDICINE",
    ] | None = None

    forecast_code: str | None = Field(
        default=None,
        max_length=100,
    )

    record_count: int | None = Field(
        default=None,
        ge=0,
    )


def user_has_permission(
    user: User,
    permission_code: str,
) -> bool:
    return any(
        permission.code == permission_code
        for role in user.roles
        for permission in role.permissions
    )


def _require_report_permission(
    user: User,
    data: ReportAuditRequest,
) -> None:
    required_permission = (
        REPORT_PERMISSION_MAP[
            data.report_type
        ]
    )

    if not user_has_permission(
        user,
        required_permission,
    ):
        raise HTTPException(
            status_code=(
                status.HTTP_403_FORBIDDEN
            ),
            detail=(
                "You do not have permission "
                "to generate or export this "
                "report type."
            ),
        )

    if (
        data.report_type
        == "DISEASE_SURVEILLANCE"
        and data.surveillance_scope
        == "SENSITIVE"
        and not user_has_permission(
            user,
            "SENSITIVE_DISEASE_VIEW",
        )
    ):
        raise HTTPException(
            status_code=(
                status.HTTP_403_FORBIDDEN
            ),
            detail=(
                "Sensitive disease reporting "
                "requires "
                "SENSITIVE_DISEASE_VIEW."
            ),
        )


def _build_description(
    data: ReportAuditRequest,
) -> str:
    details = [
        f"report_type={data.report_type}",
        f"title={data.report_title}",
    ]

    if data.start_date is not None:
        details.append(
            f"start_date={data.start_date.isoformat()}"
        )

    if data.end_date is not None:
        details.append(
            f"end_date={data.end_date.isoformat()}"
        )

    if data.surveillance_scope:
        details.append(
            "surveillance_scope="
            f"{data.surveillance_scope}"
        )

    if data.stock_transaction_type:
        details.append(
            "stock_transaction_type="
            f"{data.stock_transaction_type}"
        )

    if data.forecast_scope:
        details.append(
            "forecast_scope="
            f"{data.forecast_scope}"
        )

    if data.forecast_code:
        details.append(
            "forecast_code="
            f"{data.forecast_code}"
        )

    if data.record_count is not None:
        details.append(
            f"record_count={data.record_count}"
        )

    return "; ".join(details)


@router.post(
    "/reports/audit",
)
def record_report_audit_event(
    data: ReportAuditRequest,
    request: Request,
    db: Session = Depends(
        get_db
    ),
    current_user: User = Depends(
        require_permission(
            "REPORT_VIEW"
        )
    ),
):
    """
    Record report generation/export activity.

    Actor identity is always derived from the authenticated
    current_user and cannot be supplied by the browser payload.
    """

    if (
        data.start_date is not None
        and data.end_date is not None
        and data.start_date > data.end_date
    ):
        raise HTTPException(
            status_code=(
                status.HTTP_400_BAD_REQUEST
            ),
            detail=(
                "start_date cannot be later "
                "than end_date."
            ),
        )

    _require_report_permission(
        current_user,
        data,
    )

    action_map = {
        "GENERATED":
            "REPORT_GENERATED",
        "CSV_EXPORTED":
            "REPORT_CSV_EXPORTED",
        "PRINT_REQUESTED":
            "REPORT_PRINT_REQUESTED",
    }

    action = action_map[
        data.event
    ]

    description = (
        "Report activity: "
        + _build_description(
            data
        )
    )

    try:
        create_audit_log(
            db,
            action=action,
            module="REPORTS",
            user=current_user,
            record_id=None,
            subject_label_snapshot=(
                data.report_type
            ),
            description=description,
            ip_address=(
                get_request_ip(
                    request
                )
            ),
        )

        db.commit()

    except Exception:
        db.rollback()
        raise

    roles = sorted({
        role.name
        for role in current_user.roles
    })

    full_name = " ".join(
        part.strip()
        for part in [
            current_user.first_name,
            current_user.last_name,
        ]
        if part
        and part.strip()
    )

    return {
        "logged": True,
        "action": action,
        "report_type": (
            data.report_type
        ),
        "actor": {
            "user_id": (
                current_user.id
            ),
            "username": (
                current_user.username
            ),
            "name": (
                full_name
                or current_user.username
            ),
            "roles": roles,
        },
        "recorded_at": (
            datetime.now()
            .isoformat()
        ),
    }
