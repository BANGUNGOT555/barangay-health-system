import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getRolePermissionCatalog,
  getSystemSettings,
  updateBackupSchedule,
  updateGeneralSystemSettings,
  updateRolePermissions,
} from "../api/systemSettingsApi";
import {
  useSystemSettings,
} from "../context/SystemSettingsContext";

import "../styles/SystemSettings.css";


const PAGE_SIZE_OPTIONS = [
  10,
  25,
  50,
  100,
];

const DAY_OPTIONS = [
  ["MONDAY", "Monday"],
  ["TUESDAY", "Tuesday"],
  ["WEDNESDAY", "Wednesday"],
  ["THURSDAY", "Thursday"],
  ["FRIDAY", "Friday"],
  ["SATURDAY", "Saturday"],
  ["SUNDAY", "Sunday"],
];


function friendlyModule(value) {
  if (!value) {
    return "Other";
  }

  return String(value)
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(
      /\b\w/g,
      (letter) => letter.toUpperCase()
    );
}


function getErrorMessage(
  error,
  fallback
) {
  const detail =
    error?.response?.data?.detail;

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail
      .map(
        (item) => item?.msg
      )
      .filter(Boolean)
      .join(", ");
  }

  return fallback;
}


function SystemSettings() {
  const {
    applyClientSettings,
  } = useSystemSettings();

  const [settings, setSettings] =
    useState(null);
  const [catalog, setCatalog] =
    useState(null);
  const [selectedRoleId, setSelectedRoleId] =
    useState("");
  const [selectedPermissions, setSelectedPermissions] =
    useState(new Set());

  const [loading, setLoading] =
    useState(true);
  const [savingGeneral, setSavingGeneral] =
    useState(false);
  const [savingBackup, setSavingBackup] =
    useState(false);
  const [savingRole, setSavingRole] =
    useState(false);
  const [error, setError] =
    useState("");
  const [message, setMessage] =
    useState("");


  const loadSettings = async () => {
    try {
      setLoading(true);
      setError("");

      const [settingsData, roleData] =
        await Promise.all([
          getSystemSettings(),
          getRolePermissionCatalog(),
        ]);

      setSettings(settingsData);
      setCatalog(roleData);

      const firstEditableRole =
        roleData?.roles?.find(
          (role) => role.editable
        );

      if (firstEditableRole) {
        setSelectedRoleId(
          String(firstEditableRole.id)
        );
        setSelectedPermissions(
          new Set(
            firstEditableRole
              .permission_codes || []
          )
        );
      }
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Unable to load System Settings."
        )
      );
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    loadSettings();
  }, []);


  const selectedRole = useMemo(
    () => (
      catalog?.roles?.find(
        (role) =>
          String(role.id) ===
          String(selectedRoleId)
      ) || null
    ),
    [catalog, selectedRoleId]
  );


  const groupedPermissions = useMemo(
    () => {
      const groups = new Map();

      for (
        const permission
        of catalog?.permissions || []
      ) {
        const key =
          permission.module || "other";

        if (!groups.has(key)) {
          groups.set(key, []);
        }

        groups.get(key).push(
          permission
        );
      }

      return Array.from(
        groups.entries()
      );
    },
    [catalog]
  );


  const handleRoleChange = (event) => {
    const nextRoleId = event.target.value;

    setSelectedRoleId(nextRoleId);
    setMessage("");
    setError("");

    const role =
      catalog?.roles?.find(
        (item) =>
          String(item.id) ===
          String(nextRoleId)
      );

    setSelectedPermissions(
      new Set(
        role?.permission_codes || []
      )
    );
  };


  const togglePermission = (
    permissionCode
  ) => {
    setSelectedPermissions(
      (current) => {
        const next = new Set(current);

        if (next.has(permissionCode)) {
          next.delete(permissionCode);
        } else {
          next.add(permissionCode);
        }

        return next;
      }
    );
  };


  const handleGeneralSave = async () => {
    try {
      setSavingGeneral(true);
      setError("");
      setMessage("");

      const data =
        await updateGeneralSystemSettings({
          default_page_size:
            Number(
              settings.default_page_size
            ),
        });

      setSettings(data);
      applyClientSettings(data);

      setMessage(
        "General settings saved. The new default pagination is now active."
      );
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Unable to save general settings."
        )
      );
    } finally {
      setSavingGeneral(false);
    }
  };


  const handleBackupSave = async () => {
    try {
      setSavingBackup(true);
      setError("");
      setMessage("");

      const data =
        await updateBackupSchedule(
          settings.backup_schedule
        );

      setSettings(data);

      setMessage(
        "Automatic backup schedule updated successfully."
      );
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Unable to update the backup schedule."
        )
      );
    } finally {
      setSavingBackup(false);
    }
  };


  const handleRoleSave = async () => {
    if (!selectedRole) {
      return;
    }

    try {
      setSavingRole(true);
      setError("");
      setMessage("");

      const data =
        await updateRolePermissions(
          selectedRole.id,
          Array.from(
            selectedPermissions
          ).sort()
        );

      setCatalog(data);

      const refreshedRole =
        data.roles.find(
          (role) =>
            role.id === selectedRole.id
        );

      setSelectedPermissions(
        new Set(
          refreshedRole
            ?.permission_codes || []
        )
      );

      setMessage(
        `Permissions for ${selectedRole.name} were updated.`
      );
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Unable to update role permissions."
        )
      );
    } finally {
      setSavingRole(false);
    }
  };


  if (loading) {
    return (
      <div className="settings-page">
        <div className="settings-loading">
          Loading System Settings...
        </div>
      </div>
    );
  }


  if (!settings || !catalog) {
    return (
      <div className="settings-page">
        <div className="settings-alert error">
          {error ||
            "System Settings could not be loaded."}
        </div>
      </div>
    );
  }


  return (
    <div className="settings-page">
      <header className="settings-header">
        <div>
          <p className="settings-eyebrow">
            Administration
          </p>
          <h1>System Settings</h1>
          <p>
            Configure system-wide defaults,
            automatic backups, and ordinary
            role permissions.
          </p>
        </div>
      </header>

      {message && (
        <div className="settings-alert success">
          {message}
        </div>
      )}

      {error && (
        <div className="settings-alert error">
          {error}
        </div>
      )}

      <section className="settings-card">
        <div className="settings-card-heading">
          <div>
            <h2>General</h2>
            <p>
              Set the default number of records
              shown on paginated system screens.
            </p>
          </div>
        </div>

        <div className="settings-form-grid compact">
          <label className="settings-field">
            <span>Default rows per page</span>
            <select
              value={
                settings.default_page_size
              }
              onChange={(event) =>
                setSettings(
                  (current) => ({
                    ...current,
                    default_page_size:
                      Number(
                        event.target.value
                      ),
                  })
                )
              }
            >
              {PAGE_SIZE_OPTIONS.map(
                (value) => (
                  <option
                    key={value}
                    value={value}
                  >
                    {value} rows
                  </option>
                )
              )}
            </select>
            <small>
              Applied to Patients, Consultation
              patient records, Audit Logs, and
              generated report previews.
            </small>
          </label>
        </div>

        <div className="settings-actions">
          <button
            type="button"
            className="settings-primary-button"
            onClick={handleGeneralSave}
            disabled={savingGeneral}
          >
            {savingGeneral
              ? "Saving..."
              : "Save General Settings"}
          </button>
        </div>
      </section>

      <section className="settings-card">
        <div className="settings-card-heading">
          <div>
            <h2>Automatic Backup Schedule</h2>
            <p>
              Controls the existing Windows
              scheduled database backup task on
              the deployment computer.
            </p>
          </div>

          <span
            className={`settings-status ${
              settings.backup_task_installed
                ? "good"
                : "warning"
            }`}
          >
            {settings.backup_task_installed
              ? "Scheduled task detected"
              : "Scheduled task not detected"}
          </span>
        </div>

        <div className="settings-form-grid">
          <label className="settings-toggle-field">
            <span>
              <strong>Automatic backup</strong>
              <small>
                Enable or disable the scheduled
                backup task.
              </small>
            </span>

            <input
              type="checkbox"
              checked={
                settings.backup_schedule.enabled
              }
              onChange={(event) =>
                setSettings(
                  (current) => ({
                    ...current,
                    backup_schedule: {
                      ...current.backup_schedule,
                      enabled:
                        event.target.checked,
                    },
                  })
                )
              }
            />
          </label>

          <label className="settings-field">
            <span>Frequency</span>
            <select
              value={
                settings.backup_schedule.frequency
              }
              onChange={(event) =>
                setSettings(
                  (current) => ({
                    ...current,
                    backup_schedule: {
                      ...current.backup_schedule,
                      frequency:
                        event.target.value,
                    },
                  })
                )
              }
            >
              <option value="DAILY">
                Daily
              </option>
              <option value="WEEKLY">
                Weekly
              </option>
            </select>
          </label>

          {settings.backup_schedule.frequency ===
            "WEEKLY" && (
            <label className="settings-field">
              <span>Backup day</span>
              <select
                value={
                  settings.backup_schedule
                    .day_of_week
                }
                onChange={(event) =>
                  setSettings(
                    (current) => ({
                      ...current,
                      backup_schedule: {
                        ...current.backup_schedule,
                        day_of_week:
                          event.target.value,
                      },
                    })
                  )
                }
              >
                {DAY_OPTIONS.map(
                  ([value, label]) => (
                    <option
                      key={value}
                      value={value}
                    >
                      {label}
                    </option>
                  )
                )}
              </select>
            </label>
          )}

          <label className="settings-field">
            <span>Backup time</span>
            <input
              type="time"
              value={
                settings.backup_schedule.time
              }
              onChange={(event) =>
                setSettings(
                  (current) => ({
                    ...current,
                    backup_schedule: {
                      ...current.backup_schedule,
                      time:
                        event.target.value,
                    },
                  })
                )
              }
            />
            <small>
              Deployment computer local time.
            </small>
          </label>

          <label className="settings-field">
            <span>Time zone</span>
            <input
              value="Asia/Manila"
              readOnly
            />
            <small>
              Keep the deployment PC configured
              for Philippine time.
            </small>
          </label>
        </div>

        <div className="settings-schedule-note">
          <strong>Next scheduled run:</strong>{" "}
          {settings.backup_next_run_time ||
            "Not available"}
        </div>

        <div className="settings-actions">
          <button
            type="button"
            className="settings-primary-button"
            onClick={handleBackupSave}
            disabled={savingBackup}
          >
            {savingBackup
              ? "Updating schedule..."
              : "Save Backup Schedule"}
          </button>
        </div>
      </section>

      <section className="settings-card">
        <div className="settings-card-heading">
          <div>
            <h2>Roles &amp; Permissions</h2>
            <p>
              Assign ordinary system permissions
              to health-center roles.
            </p>
          </div>
        </div>

        <div className="settings-protected-note">
          <strong>Protected privacy rule:</strong>{" "}
          permissions beginning with
          <code>SENSITIVE_</code> are not editable
          here. Their existing assignments are
          preserved by the backend.
        </div>

        <label className="settings-field settings-role-select">
          <span>Role</span>
          <select
            value={selectedRoleId}
            onChange={handleRoleChange}
          >
            {catalog.roles.map(
              (role) => (
                <option
                  key={role.id}
                  value={role.id}
                  disabled={!role.editable}
                >
                  {role.name}
                  {!role.editable
                    ? " (Protected)"
                    : ""}
                </option>
              )
            )}
          </select>
        </label>

        {selectedRole && (
          <>
            {selectedRole
              .protected_permission_codes
              ?.length > 0 && (
              <div className="settings-protected-current">
                <span>
                  Protected permissions currently
                  assigned to this role:
                </span>
                <strong>
                  {selectedRole
                    .protected_permission_codes
                    .join(", ")}
                </strong>
              </div>
            )}

            <div className="settings-permission-groups">
              {groupedPermissions.map(
                ([moduleName, permissions]) => (
                  <div
                    className="settings-permission-group"
                    key={moduleName}
                  >
                    <h3>
                      {friendlyModule(
                        moduleName
                      )}
                    </h3>

                    <div className="settings-permission-list">
                      {permissions.map(
                        (permission) => (
                          <label
                            className="settings-permission-item"
                            key={permission.code}
                          >
                            <input
                              type="checkbox"
                              checked={
                                selectedPermissions.has(
                                  permission.code
                                )
                              }
                              onChange={() =>
                                togglePermission(
                                  permission.code
                                )
                              }
                            />

                            <span>
                              <strong>
                                {permission.name}
                              </strong>
                              <small>
                                {permission.description ||
                                  permission.code}
                              </small>
                            </span>
                          </label>
                        )
                      )}
                    </div>
                  </div>
                )
              )}
            </div>

            <div className="settings-actions">
              <button
                type="button"
                className="settings-primary-button"
                onClick={handleRoleSave}
                disabled={
                  savingRole ||
                  !selectedRole.editable
                }
              >
                {savingRole
                  ? "Saving permissions..."
                  : "Save Role Permissions"}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}


export default SystemSettings;
