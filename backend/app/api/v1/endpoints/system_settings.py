from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Request,
    status,
)
from sqlalchemy import select
from sqlalchemy.orm import (
    Session,
    selectinload,
)

from app.api.dependencies import (
    get_current_user,
    get_db,
)
from app.models.permission import Permission
from app.models.role import Role
from app.models.user import User
from app.schemas.system_settings import (
    BackupScheduleUpdate,
    ClientSystemSettings,
    GeneralSettingsUpdate,
    PermissionOption,
    RolePermissionCatalog,
    RolePermissionSummary,
    RolePermissionsUpdate,
    SystemSettingsResponse,
)
from app.services.audit_log_service import (
    create_audit_log,
    get_request_ip,
)
from app.services.backup_recovery_service import (
    get_backup_recovery_status,
)
from app.services.system_settings_service import (
    BackupScheduleApplyError,
    get_system_settings,
    update_backup_settings,
    update_general_settings,
)


router = APIRouter()

PROTECTED_PERMISSION_PREFIXES = (
    "SENSITIVE_",
)


# =========================================================
# ACCESS HELPERS
# =========================================================

def _role_names(
    user: User,
) -> set[str]:
    return {
        role.name
        for role in user.roles
    }


def _require_system_admin(
    user: User,
) -> None:
    if "SYSTEM_ADMIN" not in _role_names(
        user
    ):
        raise HTTPException(
            status_code=(
                status.HTTP_403_FORBIDDEN
            ),
            detail=(
                "System Settings is restricted "
                "to the System Administrator."
            ),
        )


def _is_protected_permission(
    permission_code: str,
) -> bool:
    return any(
        permission_code.startswith(
            prefix
        )
        for prefix
        in PROTECTED_PERMISSION_PREFIXES
    )


def _settings_response() -> dict:
    settings = get_system_settings()

    backup_status = (
        get_backup_recovery_status(
            viewer_can_run_actions=True,
        )
    )

    scheduled_task = (
        backup_status.get(
            "scheduled_task",
            {},
        )
    )

    return {
        "default_page_size": (
            settings[
                "default_page_size"
            ]
        ),
        "backup_schedule": (
            settings[
                "backup_schedule"
            ]
        ),
        "backup_task_installed": bool(
            scheduled_task.get(
                "installed",
                False,
            )
        ),
        "backup_next_run_time": (
            scheduled_task.get(
                "next_run_time"
            )
        ),
    }


# =========================================================
# CLIENT SETTINGS
# =========================================================

@router.get(
    "/client",
    response_model=ClientSystemSettings,
)
def client_settings(
    current_user: User = Depends(
        get_current_user
    ),
):
    del current_user

    settings = get_system_settings()

    return {
        "default_page_size": (
            settings[
                "default_page_size"
            ]
        )
    }


# =========================================================
# ADMIN SETTINGS
# =========================================================

@router.get(
    "/",
    response_model=SystemSettingsResponse,
)
def admin_settings(
    current_user: User = Depends(
        get_current_user
    ),
):
    _require_system_admin(
        current_user
    )

    return _settings_response()


@router.put(
    "/general",
    response_model=SystemSettingsResponse,
)
def save_general_settings(
    data: GeneralSettingsUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    ),
):
    _require_system_admin(
        current_user
    )

    old_settings = get_system_settings()

    update_general_settings(
        default_page_size=(
            data.default_page_size
        )
    )

    create_audit_log(
        db,
        action="SYSTEM_SETTINGS_UPDATED",
        module="SYSTEM_SETTINGS",
        user=current_user,
        subject_label_snapshot=(
            "General Settings"
        ),
        description=(
            "Default pagination changed from "
            f"{old_settings['default_page_size']} "
            f"to {data.default_page_size}."
        ),
        ip_address=get_request_ip(
            request
        ),
    )

    db.commit()

    return _settings_response()


@router.put(
    "/backup-schedule",
    response_model=SystemSettingsResponse,
)
def save_backup_schedule(
    data: BackupScheduleUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    ),
):
    _require_system_admin(
        current_user
    )

    old_settings = get_system_settings()

    try:
        update_backup_settings(
            data.model_dump()
        )
    except BackupScheduleApplyError as exc:
        raise HTTPException(
            status_code=(
                status.HTTP_409_CONFLICT
            ),
            detail=(
                "Backup schedule was not changed. "
                f"{str(exc)}"
            ),
        ) from exc

    old_backup = old_settings[
        "backup_schedule"
    ]

    create_audit_log(
        db,
        action="BACKUP_SCHEDULE_UPDATED",
        module="SYSTEM_SETTINGS",
        user=current_user,
        subject_label_snapshot=(
            "Automatic Backup Schedule"
        ),
        description=(
            "Automatic backup schedule changed: "
            f"enabled {old_backup['enabled']} -> "
            f"{data.enabled}; frequency "
            f"{old_backup['frequency']} -> "
            f"{data.frequency}; time "
            f"{old_backup['time']} -> {data.time}; "
            f"day {old_backup['day_of_week']} -> "
            f"{data.day_of_week}."
        ),
        ip_address=get_request_ip(
            request
        ),
    )

    db.commit()

    return _settings_response()


# =========================================================
# ROLE / PERMISSION MANAGEMENT
# =========================================================

@router.get(
    "/role-permissions",
    response_model=RolePermissionCatalog,
)
def role_permission_catalog(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    ),
):
    _require_system_admin(
        current_user
    )

    roles = list(
        db.scalars(
            select(Role)
            .options(
                selectinload(
                    Role.permissions
                )
            )
            .order_by(Role.name.asc())
        ).all()
    )

    permissions = list(
        db.scalars(
            select(Permission)
            .order_by(
                Permission.module.asc(),
                Permission.name.asc(),
            )
        ).all()
    )

    editable_permissions = [
        permission
        for permission in permissions
        if not _is_protected_permission(
            permission.code
        )
    ]

    role_items = []

    for role in roles:
        current_codes = {
            permission.code
            for permission
            in role.permissions
        }

        role_items.append(
            RolePermissionSummary(
                id=role.id,
                name=role.name,
                description=(
                    role.description
                ),
                editable=(
                    role.name !=
                    "SYSTEM_ADMIN"
                ),
                permission_codes=sorted(
                    code
                    for code
                    in current_codes
                    if not (
                        _is_protected_permission(
                            code
                        )
                    )
                ),
                protected_permission_codes=(
                    sorted(
                        code
                        for code
                        in current_codes
                        if (
                            _is_protected_permission(
                                code
                            )
                        )
                    )
                ),
            )
        )

    return RolePermissionCatalog(
        roles=role_items,
        permissions=[
            PermissionOption(
                id=permission.id,
                code=permission.code,
                name=permission.name,
                module=permission.module,
                description=(
                    permission.description
                ),
            )
            for permission
            in editable_permissions
        ],
        protected_prefixes=[
            "SENSITIVE_"
        ],
    )


@router.put(
    "/roles/{role_id}/permissions",
    response_model=RolePermissionCatalog,
)
def save_role_permissions(
    role_id: int,
    data: RolePermissionsUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    ),
):
    _require_system_admin(
        current_user
    )

    role = db.scalar(
        select(Role)
        .options(
            selectinload(
                Role.permissions
            )
        )
        .where(
            Role.id == role_id
        )
    )

    if role is None:
        raise HTTPException(
            status_code=(
                status.HTTP_404_NOT_FOUND
            ),
            detail="Role not found.",
        )

    if role.name == "SYSTEM_ADMIN":
        raise HTTPException(
            status_code=(
                status.HTTP_403_FORBIDDEN
            ),
            detail=(
                "SYSTEM_ADMIN permissions are "
                "protected from in-app editing."
            ),
        )

    requested_codes = {
        str(code).strip()
        for code
        in data.permission_codes
        if str(code).strip()
    }

    protected_requested = sorted(
        code
        for code in requested_codes
        if _is_protected_permission(
            code
        )
    )

    if protected_requested:
        raise HTTPException(
            status_code=(
                status.HTTP_400_BAD_REQUEST
            ),
            detail=(
                "Sensitive permissions cannot "
                "be changed from System Settings."
            ),
        )

    all_permissions = list(
        db.scalars(
            select(Permission)
        ).all()
    )

    permission_map = {
        permission.code: permission
        for permission
        in all_permissions
    }

    unknown_codes = sorted(
        requested_codes
        - set(permission_map)
    )

    if unknown_codes:
        raise HTTPException(
            status_code=(
                status.HTTP_400_BAD_REQUEST
            ),
            detail=(
                "Unknown permission code(s): "
                + ", ".join(
                    unknown_codes
                )
            ),
        )

    current_codes = {
        permission.code
        for permission
        in role.permissions
    }

    protected_permissions = [
        permission
        for permission
        in role.permissions
        if _is_protected_permission(
            permission.code
        )
    ]

    role.permissions = (
        [
            permission_map[code]
            for code
            in sorted(
                requested_codes
            )
        ]
        + protected_permissions
    )

    added = sorted(
        requested_codes
        - {
            code
            for code in current_codes
            if not _is_protected_permission(
                code
            )
        }
    )

    removed = sorted(
        {
            code
            for code in current_codes
            if not _is_protected_permission(
                code
            )
        }
        - requested_codes
    )

    create_audit_log(
        db,
        action="ROLE_PERMISSIONS_UPDATED",
        module="SYSTEM_SETTINGS",
        user=current_user,
        record_id=role.id,
        subject_label_snapshot=(
            role.name
        ),
        description=(
            f"Updated permissions for {role.name}. "
            f"Added: {', '.join(added) if added else 'None'}. "
            f"Removed: {', '.join(removed) if removed else 'None'}. "
            "Sensitive permissions were preserved "
            "and were not editable."
        ),
        ip_address=get_request_ip(
            request
        ),
    )

    db.commit()

    return role_permission_catalog(
        db=db,
        current_user=current_user,
    )
