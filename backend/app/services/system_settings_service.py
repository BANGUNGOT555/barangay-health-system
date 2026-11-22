from __future__ import annotations

import copy
import json
import os
from pathlib import Path
import subprocess
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[3]
SYSTEM_SETTINGS_FILE = (
    PROJECT_ROOT
    / "config"
    / "system-settings.json"
)

BACKUP_TASK_PATH = "\\BarangayHealthSystem\\"
BACKUP_TASK_NAME = "Nightly Database Backup"

DEFAULT_SETTINGS: dict[str, Any] = {
    "default_page_size": 25,
    "backup_schedule": {
        "enabled": True,
        "frequency": "DAILY",
        "time": "02:00",
        "day_of_week": "SUNDAY",
        "timezone": "Asia/Manila",
    },
}

ALLOWED_PAGE_SIZES = {10, 25, 50, 100}
ALLOWED_BACKUP_FREQUENCIES = {
    "DAILY",
    "WEEKLY",
}
ALLOWED_BACKUP_DAYS = {
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
    "SUNDAY",
}


class BackupScheduleApplyError(RuntimeError):
    pass


def _read_json(
    path: Path,
) -> dict[str, Any] | None:
    if not path.exists():
        return None

    try:
        data = json.loads(
            path.read_text(
                encoding="utf-8-sig",
            )
        )
    except (
        OSError,
        UnicodeDecodeError,
        json.JSONDecodeError,
    ):
        return None

    return data if isinstance(data, dict) else None


def _normalize_settings(
    raw: dict[str, Any] | None,
) -> dict[str, Any]:
    result = copy.deepcopy(
        DEFAULT_SETTINGS
    )

    if not raw:
        return result

    page_size = raw.get(
        "default_page_size"
    )

    try:
        page_size = int(page_size)
    except (TypeError, ValueError):
        page_size = 25

    if page_size in ALLOWED_PAGE_SIZES:
        result["default_page_size"] = (
            page_size
        )

    raw_backup = raw.get(
        "backup_schedule"
    )

    if not isinstance(raw_backup, dict):
        return result

    backup = result[
        "backup_schedule"
    ]

    if isinstance(
        raw_backup.get("enabled"),
        bool,
    ):
        backup["enabled"] = (
            raw_backup["enabled"]
        )

    frequency = str(
        raw_backup.get(
            "frequency",
            "",
        )
    ).upper()

    if frequency in (
        ALLOWED_BACKUP_FREQUENCIES
    ):
        backup["frequency"] = (
            frequency
        )

    time_value = str(
        raw_backup.get(
            "time",
            "",
        )
    )

    if _valid_time(time_value):
        backup["time"] = time_value

    day = str(
        raw_backup.get(
            "day_of_week",
            "",
        )
    ).upper()

    if day in ALLOWED_BACKUP_DAYS:
        backup["day_of_week"] = day

    backup["timezone"] = (
        "Asia/Manila"
    )

    return result


def _valid_time(value: str) -> bool:
    parts = value.split(":")

    if len(parts) != 2:
        return False

    try:
        hour = int(parts[0])
        minute = int(parts[1])
    except ValueError:
        return False

    return (
        0 <= hour <= 23
        and 0 <= minute <= 59
    )


def get_system_settings() -> dict[str, Any]:
    return _normalize_settings(
        _read_json(
            SYSTEM_SETTINGS_FILE
        )
    )


def save_system_settings(
    settings: dict[str, Any],
) -> dict[str, Any]:
    normalized = _normalize_settings(
        settings
    )

    SYSTEM_SETTINGS_FILE.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    temporary = (
        SYSTEM_SETTINGS_FILE
        .with_suffix(".json.tmp")
    )

    temporary.write_text(
        json.dumps(
            normalized,
            indent=2,
            sort_keys=True,
        ) + "\n",
        encoding="utf-8",
    )

    temporary.replace(
        SYSTEM_SETTINGS_FILE
    )

    return normalized


def update_general_settings(
    *,
    default_page_size: int,
) -> dict[str, Any]:
    if (
        default_page_size
        not in ALLOWED_PAGE_SIZES
    ):
        raise ValueError(
            "Unsupported default page size."
        )

    settings = get_system_settings()
    settings["default_page_size"] = (
        default_page_size
    )

    return save_system_settings(
        settings
    )


def update_backup_settings(
    backup_schedule: dict[str, Any],
) -> dict[str, Any]:
    settings = get_system_settings()
    settings["backup_schedule"] = {
        **settings["backup_schedule"],
        **backup_schedule,
        "timezone": "Asia/Manila",
    }

    normalized = _normalize_settings(
        settings
    )

    # Apply first so the UI cannot claim that a new
    # schedule is active when Windows rejected it.
    apply_windows_backup_schedule(
        normalized["backup_schedule"]
    )

    return save_system_settings(
        normalized
    )


def apply_windows_backup_schedule(
    backup_schedule: dict[str, Any],
) -> None:
    if os.name != "nt":
        raise BackupScheduleApplyError(
            "Automatic backup scheduling can only "
            "be changed on the Windows deployment "
            "computer."
        )

    enabled = bool(
        backup_schedule.get(
            "enabled",
            True,
        )
    )

    frequency = str(
        backup_schedule.get(
            "frequency",
            "DAILY",
        )
    ).upper()

    time_value = str(
        backup_schedule.get(
            "time",
            "02:00",
        )
    )

    day = str(
        backup_schedule.get(
            "day_of_week",
            "SUNDAY",
        )
    ).upper()

    if frequency not in (
        ALLOWED_BACKUP_FREQUENCIES
    ):
        raise BackupScheduleApplyError(
            "Unsupported backup frequency."
        )

    if not _valid_time(time_value):
        raise BackupScheduleApplyError(
            "Invalid backup time."
        )

    if day not in ALLOWED_BACKUP_DAYS:
        raise BackupScheduleApplyError(
            "Invalid weekly backup day."
        )

    ps_day = day.title()

    if frequency == "DAILY":
        trigger_command = (
            "$trigger = "
            "New-ScheduledTaskTrigger "
            f"-Daily -At '{time_value}';"
        )
    else:
        trigger_command = (
            "$trigger = "
            "New-ScheduledTaskTrigger "
            "-Weekly -WeeksInterval 1 "
            f"-DaysOfWeek {ps_day} "
            f"-At '{time_value}';"
        )

    enabled_command = (
        "Enable-ScheduledTask"
        if enabled
        else "Disable-ScheduledTask"
    )

    command = (
        "$ErrorActionPreference='Stop';"
        f"$taskPath='{BACKUP_TASK_PATH}';"
        f"$taskName='{BACKUP_TASK_NAME}';"
        "Get-ScheduledTask "
        "-TaskPath $taskPath "
        "-TaskName $taskName "
        "-ErrorAction Stop | Out-Null;"
        f"{trigger_command}"
        "Set-ScheduledTask "
        "-TaskPath $taskPath "
        "-TaskName $taskName "
        "-Trigger $trigger "
        "-ErrorAction Stop | Out-Null;"
        f"{enabled_command} "
        "-TaskPath $taskPath "
        "-TaskName $taskName "
        "-ErrorAction Stop | Out-Null;"
        "Write-Output 'SCHEDULE_UPDATED';"
    )

    try:
        completed = subprocess.run(
            [
                "powershell.exe",
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy",
                "Bypass",
                "-Command",
                command,
            ],
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )
    except (
        OSError,
        subprocess.SubprocessError,
    ) as exc:
        raise BackupScheduleApplyError(
            "Unable to update the Windows "
            "scheduled backup task."
        ) from exc

    if completed.returncode != 0:
        detail = (
            completed.stderr.strip()
            or completed.stdout.strip()
            or (
                "Windows rejected the backup "
                "schedule update."
            )
        )

        raise BackupScheduleApplyError(
            detail[:1000]
        )
