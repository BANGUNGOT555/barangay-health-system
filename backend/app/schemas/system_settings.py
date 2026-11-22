from typing import Literal

from pydantic import BaseModel, field_validator


PageSizeValue = Literal[10, 25, 50, 100]
BackupFrequency = Literal["DAILY", "WEEKLY"]
BackupDay = Literal[
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
    "SUNDAY",
]


class ClientSystemSettings(BaseModel):
    default_page_size: PageSizeValue = 25


class GeneralSettingsUpdate(BaseModel):
    default_page_size: PageSizeValue


class BackupScheduleSettings(BaseModel):
    enabled: bool = True
    frequency: BackupFrequency = "DAILY"
    time: str = "02:00"
    day_of_week: BackupDay = "SUNDAY"
    timezone: Literal["Asia/Manila"] = "Asia/Manila"

    @field_validator("time")
    @classmethod
    def validate_time(cls, value: str) -> str:
        parts = value.split(":")

        if len(parts) != 2:
            raise ValueError(
                "Backup time must use HH:MM format."
            )

        try:
            hour = int(parts[0])
            minute = int(parts[1])
        except ValueError as exc:
            raise ValueError(
                "Backup time must use HH:MM format."
            ) from exc

        if not (0 <= hour <= 23 and 0 <= minute <= 59):
            raise ValueError(
                "Backup time must be a valid 24-hour time."
            )

        return f"{hour:02d}:{minute:02d}"


class BackupScheduleUpdate(BackupScheduleSettings):
    pass


class SystemSettingsResponse(BaseModel):
    default_page_size: PageSizeValue = 25
    backup_schedule: BackupScheduleSettings
    backup_task_installed: bool = False
    backup_next_run_time: str | None = None


class PermissionOption(BaseModel):
    id: int
    code: str
    name: str
    module: str
    description: str | None = None


class RolePermissionSummary(BaseModel):
    id: int
    name: str
    description: str | None = None
    editable: bool = True
    permission_codes: list[str]
    protected_permission_codes: list[str]


class RolePermissionCatalog(BaseModel):
    roles: list[RolePermissionSummary]
    permissions: list[PermissionOption]
    protected_prefixes: list[str] = ["SENSITIVE_"]


class RolePermissionsUpdate(BaseModel):
    permission_codes: list[str]
