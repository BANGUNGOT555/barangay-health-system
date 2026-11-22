import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getAuditLogs,
} from "../api/auditLogApi";

import {
  useSystemSettings,
} from "../context/SystemSettingsContext";

import "../styles/AuditLogs.css";


const ACTION_META = {
  REPORT_GENERATED: {
    label: "Generated Report",
    tone: "info",
  },
  REPORT_CSV_EXPORTED: {
    label: "Exported CSV",
    tone: "success",
  },
  REPORT_PRINT_REQUESTED: {
    label: "Print Requested",
    tone: "purple",
  },
  SYSTEM_SETTINGS_UPDATED: {
    label: "Updated System Settings",
    tone: "warning",
  },
  BACKUP_SCHEDULE_UPDATED: {
    label: "Updated Backup Schedule",
    tone: "warning",
  },
  ROLE_PERMISSIONS_UPDATED: {
    label: "Updated Role Permissions",
    tone: "warning",
  },
  LOGIN_SUCCESS: {
    label: "Signed In",
    tone: "success",
  },
  LOGIN_FAILED: {
    label: "Failed Sign In",
    tone: "danger",
  },
  REGISTER: {
    label: "Registration Submitted",
    tone: "info",
  },
  USER_CREATE: {
    label: "Created User",
    tone: "info",
  },
  USER_APPROVE: {
    label: "Approved User",
    tone: "success",
  },
  USER_DEACTIVATE: {
    label: "Deactivated User",
    tone: "danger",
  },
  USER_REACTIVATE: {
    label: "Reactivated User",
    tone: "success",
  },
  USER_PENDING_DELETE: {
    label: "Deleted Pending Request",
    tone: "danger",
  },
  PATIENT_CREATE: {
    label: "Created Patient Record",
    tone: "info",
  },
  PATIENT_UPDATE: {
    label: "Updated Patient Record",
    tone: "warning",
  },
  CONSULTATION_CREATE: {
    label: "Recorded Consultation",
    tone: "info",
  },
  CONSULTATION_UPDATE: {
    label: "Updated Consultation",
    tone: "warning",
  },
  DISEASE_CASE_VALIDATE: {
    label: "Validated Disease Case",
    tone: "success",
  },
  DISEASE_CASE_REJECT: {
    label: "Rejected Disease Case",
    tone: "danger",
  },
  INVENTORY_TRANSACTION_CREATE: {
    label: "Recorded Stock Activity",
    tone: "info",
  },
};


const MODULE_LABELS = {
  AUTHENTICATION: "Authentication",
  ADMINISTRATION: "Administration",
  REPORTS: "Reports",
  PATIENTS: "Patients",
  CONSULTATIONS: "Consultations",
  SURVEILLANCE: "Surveillance",
  INVENTORY: "Inventory",
  FORECASTS: "Forecasts",
  SYSTEM_SETTINGS: "System Settings",
};


function prettifyCode(value) {
  if (!value) {
    return "—";
  }

  return String(value)
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(
      /\b\w/g,
      (letter) => letter.toUpperCase()
    );
}


function getActionMeta(action) {
  if (ACTION_META[action]) {
    return ACTION_META[action];
  }

  const upper = String(action || "")
    .toUpperCase();

  let tone = "neutral";

  if (
    upper.includes("FAIL") ||
    upper.includes("REJECT") ||
    upper.includes("DELETE") ||
    upper.includes("DEACTIVATE")
  ) {
    tone = "danger";
  } else if (
    upper.includes("CREATE") ||
    upper.includes("GENERATE") ||
    upper.includes("RECORD")
  ) {
    tone = "info";
  } else if (
    upper.includes("UPDATE") ||
    upper.includes("ADJUST")
  ) {
    tone = "warning";
  } else if (
    upper.includes("SUCCESS") ||
    upper.includes("APPROVE") ||
    upper.includes("VALIDATE") ||
    upper.includes("EXPORT") ||
    upper.includes("REACTIVATE")
  ) {
    tone = "success";
  }

  return {
    label: prettifyCode(action),
    tone,
  };
}


function getModuleLabel(moduleName) {
  const normalized = String(
    moduleName || ""
  ).toUpperCase();

  return (
    MODULE_LABELS[normalized] ||
    prettifyCode(moduleName)
  );
}


function getRoleLabel(roleNames) {
  if (!roleNames) {
    return "System / Unassigned";
  }

  return String(roleNames)
    .split(",")
    .map((role) =>
      prettifyCode(role.trim())
    )
    .join(", ");
}


function formatDateTime(value) {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return parsed.toLocaleString(
    "en-PH",
    {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }
  );
}


function formatShortDate(value) {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return parsed.toLocaleDateString(
    "en-PH",
    {
      year: "numeric",
      month: "short",
      day: "numeric",
    }
  );
}


function formatTime(value) {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toLocaleTimeString(
    "en-PH",
    {
      hour: "numeric",
      minute: "2-digit",
    }
  );
}


function parseAuditDescription(description) {
  if (!description) {
    return {};
  }

  const source = String(description);

  if (!source.includes("=")) {
    return {};
  }

  const withoutPrefix = source.replace(
    /^Report activity:\s*/i,
    ""
  );

  return withoutPrefix
    .split(";")
    .reduce(
      (result, item) => {
        const trimmed = item.trim();
        const separatorIndex =
          trimmed.indexOf("=");

        if (separatorIndex <= 0) {
          return result;
        }

        const key = trimmed
          .slice(0, separatorIndex)
          .trim();

        const value = trimmed
          .slice(separatorIndex + 1)
          .trim();

        if (key) {
          result[key] = value;
        }

        return result;
      },
      {}
    );
}


function getActivityContext(log) {
  const parsed = parseAuditDescription(
    log.description
  );

  if (parsed.title) {
    return parsed.title;
  }

  if (log.subject_label_snapshot) {
    return prettifyCode(
      log.subject_label_snapshot
    );
  }

  if (log.description) {
    const description = String(
      log.description
    );

    return description.length > 90
      ? `${description.slice(0, 87)}...`
      : description;
  }

  return "System activity";
}


function matchesDateFilter(
  createdAt,
  dateFilter
) {
  if (dateFilter === "ALL") {
    return true;
  }

  const created = new Date(createdAt);

  if (Number.isNaN(created.getTime())) {
    return false;
  }

  const now = new Date();

  if (dateFilter === "TODAY") {
    return (
      created.getFullYear() === now.getFullYear() &&
      created.getMonth() === now.getMonth() &&
      created.getDate() === now.getDate()
    );
  }

  const diffMs = now.getTime() - created.getTime();
  const diffDays = diffMs / 86400000;

  if (dateFilter === "7_DAYS") {
    return diffDays <= 7;
  }

  if (dateFilter === "30_DAYS") {
    return diffDays <= 30;
  }

  return true;
}


function AuditLogs() {
  const {
    defaultPageSize,
  } = useSystemSettings();

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] =
    useState("ALL");
  const [actionFilter, setActionFilter] =
    useState("ALL");
  const [dateFilter, setDateFilter] =
    useState("ALL");
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] =
    useState(null);


  const loadAuditLogs = useCallback(
    async () => {
      try {
        setLoading(true);
        setError("");

        const data = await getAuditLogs({
          limit: 500,
        });

        setLogs(
          Array.isArray(data)
            ? data
            : []
        );
      } catch (err) {
        console.error(err);

        setError(
          err.response?.data?.detail ||
            "Unable to load audit logs."
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );


  useEffect(() => {
    loadAuditLogs();
  }, [loadAuditLogs]);


  useEffect(() => {
    setPage(1);
  }, [
    search,
    moduleFilter,
    actionFilter,
    dateFilter,
    defaultPageSize,
  ]);


  useEffect(() => {
    if (!selectedLog) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setSelectedLog(null);
      }
    };

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";
    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [selectedLog]);


  const moduleOptions = useMemo(
    () =>
      Array.from(
        new Set(
          logs
            .map((log) => log.module)
            .filter(Boolean)
        )
      ).sort((a, b) =>
        getModuleLabel(a).localeCompare(
          getModuleLabel(b)
        )
      ),
    [logs]
  );


  const actionOptions = useMemo(
    () =>
      Array.from(
        new Set(
          logs
            .map((log) => log.action)
            .filter(Boolean)
        )
      ).sort((a, b) =>
        getActionMeta(a).label.localeCompare(
          getActionMeta(b).label
        )
      ),
    [logs]
  );


  const filteredLogs = useMemo(
    () => {
      const normalizedSearch = search
        .trim()
        .toLowerCase();

      return logs.filter((log) => {
        if (
          moduleFilter !== "ALL" &&
          log.module !== moduleFilter
        ) {
          return false;
        }

        if (
          actionFilter !== "ALL" &&
          log.action !== actionFilter
        ) {
          return false;
        }

        if (
          !matchesDateFilter(
            log.created_at,
            dateFilter
          )
        ) {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        const searchable = [
          log.actor_name_snapshot,
          log.username,
          log.role_names,
          log.module,
          getModuleLabel(log.module),
          log.action,
          getActionMeta(log.action).label,
          log.record_id,
          log.subject_label_snapshot,
          log.ip_address,
          log.description,
        ]
          .filter(
            (value) =>
              value !== null &&
              value !== undefined
          )
          .join(" ")
          .toLowerCase();

        return searchable.includes(
          normalizedSearch
        );
      });
    },
    [
      logs,
      search,
      moduleFilter,
      actionFilter,
      dateFilter,
    ]
  );


  const totalPages = Math.max(
    Math.ceil(
      filteredLogs.length / defaultPageSize
    ),
    1
  );


  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);


  const visibleLogs = useMemo(
    () => {
      const start =
        (page - 1) * defaultPageSize;

      return filteredLogs.slice(
        start,
        start + defaultPageSize
      );
    },
    [
      filteredLogs,
      page,
      defaultPageSize,
    ]
  );


  const clearFilters = () => {
    setSearch("");
    setModuleFilter("ALL");
    setActionFilter("ALL");
    setDateFilter("ALL");
  };


  const hasActiveFilters = Boolean(
    search.trim() ||
      moduleFilter !== "ALL" ||
      actionFilter !== "ALL" ||
      dateFilter !== "ALL"
  );


  return (
    <div className="audit-page">

      <section className="audit-header">
        <div>
          <h1>Audit Logs</h1>
          <p>
            Review security and administrative
            activity recorded by the system.
          </p>
        </div>

        <button
          type="button"
          className="audit-button"
          onClick={loadAuditLogs}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </section>


      <section className="audit-card audit-activity-card">

        <div className="audit-card-header">
          <div>
            <h2>Recent Activity</h2>
            <p>
              Latest recorded actions across
              protected modules.
            </p>
          </div>

          <div className="audit-record-count">
            <strong>
              {filteredLogs.length}
            </strong>
            <span>
              {filteredLogs.length === 1
                ? "record"
                : "records"}
            </span>
          </div>
        </div>


        <div className="audit-toolbar">

          <label className="audit-search-field">
            <span className="audit-field-label">
              Search Activity
            </span>

            <div className="audit-search-input-wrap">
              <span
                className="audit-search-icon"
                aria-hidden="true"
              >
                ⌕
              </span>

              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search user, activity, record, or IP..."
              />
            </div>
          </label>


          <label className="audit-filter-field">
            <span className="audit-field-label">
              Module
            </span>

            <select
              value={moduleFilter}
              onChange={(event) =>
                setModuleFilter(
                  event.target.value
                )
              }
            >
              <option value="ALL">
                All Modules
              </option>

              {moduleOptions.map(
                (moduleName) => (
                  <option
                    key={moduleName}
                    value={moduleName}
                  >
                    {getModuleLabel(
                      moduleName
                    )}
                  </option>
                )
              )}
            </select>
          </label>


          <label className="audit-filter-field">
            <span className="audit-field-label">
              Activity
            </span>

            <select
              value={actionFilter}
              onChange={(event) =>
                setActionFilter(
                  event.target.value
                )
              }
            >
              <option value="ALL">
                All Activities
              </option>

              {actionOptions.map(
                (actionName) => (
                  <option
                    key={actionName}
                    value={actionName}
                  >
                    {
                      getActionMeta(
                        actionName
                      ).label
                    }
                  </option>
                )
              )}
            </select>
          </label>


          <label className="audit-filter-field">
            <span className="audit-field-label">
              Date
            </span>

            <select
              value={dateFilter}
              onChange={(event) =>
                setDateFilter(
                  event.target.value
                )
              }
            >
              <option value="ALL">
                All Dates
              </option>
              <option value="TODAY">
                Today
              </option>
              <option value="7_DAYS">
                Last 7 Days
              </option>
              <option value="30_DAYS">
                Last 30 Days
              </option>
            </select>
          </label>


          {hasActiveFilters && (
            <button
              type="button"
              className="audit-clear-button"
              onClick={clearFilters}
            >
              Clear Filters
            </button>
          )}

        </div>


        {error && (
          <div className="audit-error">
            {error}
          </div>
        )}


        {loading ? (
          <div className="audit-empty">
            Loading audit logs...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="audit-empty audit-empty-filtered">
            <strong>
              No matching activity found
            </strong>
            <span>
              Try changing your search or filters.
            </span>

            {hasActiveFilters && (
              <button
                type="button"
                className="audit-link-button"
                onClick={clearFilters}
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="audit-table-wrap">
              <table className="audit-table audit-friendly-table">
                <thead>
                  <tr>
                    <th>Date &amp; Time</th>
                    <th>User</th>
                    <th>Activity</th>
                    <th>Module</th>
                    <th className="audit-details-column">
                      Details
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {visibleLogs.map((log) => {
                    const actionMeta =
                      getActionMeta(
                        log.action
                      );

                    return (
                      <tr key={log.id}>
                        <td className="audit-date-cell">
                          <strong>
                            {formatShortDate(
                              log.created_at
                            )}
                          </strong>
                          <span>
                            {formatTime(
                              log.created_at
                            )}
                          </span>
                        </td>

                        <td>
                          <div className="audit-user-cell">
                            <div className="audit-user-avatar">
                              {(
                                log.actor_name_snapshot ||
                                log.username ||
                                "S"
                              )
                                .trim()
                                .charAt(0)
                                .toUpperCase()}
                            </div>

                            <div className="audit-user-copy">
                              <strong>
                                {log.actor_name_snapshot ||
                                  log.username ||
                                  "System"}
                              </strong>

                              <span>
                                {log.username
                                  ? `@${log.username}`
                                  : getRoleLabel(
                                      log.role_names
                                    )}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td>
                          <div className="audit-activity-cell">
                            <span
                              className={`audit-action-badge audit-action-${actionMeta.tone}`}
                            >
                              {actionMeta.label}
                            </span>

                            <span className="audit-activity-context">
                              {getActivityContext(
                                log
                              )}
                            </span>
                          </div>
                        </td>

                        <td>
                          <span className="audit-chip">
                            {getModuleLabel(
                              log.module
                            )}
                          </span>
                        </td>

                        <td className="audit-details-cell">
                          <button
                            type="button"
                            className="audit-view-button"
                            onClick={() =>
                              setSelectedLog(log)
                            }
                            aria-label={`View details for ${actionMeta.label}`}
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>


            <div className="audit-pagination">
              <span>
                Showing{" "}
                {(
                  (page - 1) * defaultPageSize +
                  1
                ).toLocaleString("en-PH")}
                {"–"}
                {Math.min(
                  page * defaultPageSize,
                  filteredLogs.length
                ).toLocaleString("en-PH")}
                {" of "}
                {filteredLogs.length.toLocaleString(
                  "en-PH"
                )}
              </span>

              <div className="audit-pagination-controls">
                <button
                  type="button"
                  onClick={() =>
                    setPage((current) =>
                      Math.max(
                        current - 1,
                        1
                      )
                    )
                  }
                  disabled={page <= 1}
                >
                  ‹ Previous
                </button>

                <div className="audit-page-numbers">
                  {Array.from(
                    { length: totalPages },
                    (_, index) => index + 1
                  ).map((pageNumber) => (
                    <button
                      type="button"
                      key={pageNumber}
                      className={
                        pageNumber === page
                          ? "active"
                          : ""
                      }
                      onClick={() =>
                        setPage(pageNumber)
                      }
                      aria-label={`Go to page ${pageNumber}`}
                      aria-current={
                        pageNumber === page
                          ? "page"
                          : undefined
                      }
                    >
                      {pageNumber}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setPage((current) =>
                      Math.min(
                        current + 1,
                        totalPages
                      )
                    )
                  }
                  disabled={page >= totalPages}
                >
                  Next ›
                </button>
              </div>
            </div>
          </>
        )}
      </section>


      {selectedLog && (
        <AuditDetailsModal
          log={selectedLog}
          onClose={() =>
            setSelectedLog(null)
          }
        />
      )}

    </div>
  );
}


function AuditDetailsModal({
  log,
  onClose,
}) {
  const actionMeta = getActionMeta(
    log.action
  );

  const parsed = parseAuditDescription(
    log.description
  );

  const isReportActivity =
    String(log.module || "")
      .toUpperCase() === "REPORTS" ||
    String(log.action || "")
      .startsWith("REPORT_");

  const reportRows = [
    {
      label: "Report",
      value: parsed.title,
    },
    {
      label: "Period",
      value:
        parsed.start_date || parsed.end_date
          ? `${
              parsed.start_date
                ? formatShortDate(
                    `${parsed.start_date}T00:00:00`
                  )
                : "Beginning"
            } – ${
              parsed.end_date
                ? formatShortDate(
                    `${parsed.end_date}T00:00:00`
                  )
                : "Present"
            }`
          : null,
    },
    {
      label: "Records",
      value:
        parsed.record_count !== undefined
          ? Number(
              parsed.record_count
            ).toLocaleString("en-PH")
          : null,
    },
    {
      label: "Surveillance Scope",
      value: parsed.surveillance_scope
        ? prettifyCode(
            parsed.surveillance_scope
          )
        : null,
    },
    {
      label: "Transaction Type",
      value: parsed.stock_transaction_type
        ? prettifyCode(
            parsed.stock_transaction_type
          )
        : null,
    },
    {
      label: "Forecast Scope",
      value: parsed.forecast_scope
        ? prettifyCode(
            parsed.forecast_scope
          )
        : null,
    },
    {
      label: "Forecast Code",
      value: parsed.forecast_code,
    },
  ].filter((item) => item.value);


  return (
    <div
      className="audit-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className="audit-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="audit-modal-title"
      >
        <div className="audit-modal-header">
          <div>
            <span className="audit-modal-kicker">
              Audit Trail
            </span>
            <h2 id="audit-modal-title">
              Activity Details
            </h2>
            <p>
              Complete information recorded for
              this system activity.
            </p>
          </div>

          <button
            type="button"
            className="audit-modal-close"
            onClick={onClose}
            aria-label="Close activity details"
          >
            ×
          </button>
        </div>


        <div className="audit-modal-body">

          <div className="audit-modal-summary">
            <span
              className={`audit-action-badge audit-action-${actionMeta.tone}`}
            >
              {actionMeta.label}
            </span>

            <strong>
              {getActivityContext(log)}
            </strong>

            <span>
              {formatDateTime(
                log.created_at
              )}
            </span>
          </div>


          {isReportActivity &&
            reportRows.length > 0 && (
            <div className="audit-detail-section audit-report-detail-section">
              <div className="audit-detail-section-heading">
                <div>
                  <h3>Report Details</h3>
                  <p>
                    Key report information is shown first
                    for faster review.
                  </p>
                </div>
              </div>

              <div className="audit-detail-grid audit-report-detail-grid">
                {reportRows.map(
                  (item) => (
                    <DetailItem
                      key={item.label}
                      label={item.label}
                      value={item.value}
                    />
                  )
                )}
              </div>
            </div>
          )}


          <div className="audit-detail-section">
            <h3>User &amp; Activity</h3>

            <div className="audit-detail-grid">
              <DetailItem
                label="User"
                value={
                  log.actor_name_snapshot ||
                  log.username ||
                  "System"
                }
              />

              <DetailItem
                label="Username"
                value={
                  log.username
                    ? `@${log.username}`
                    : "—"
                }
              />

              <DetailItem
                label="Role"
                value={getRoleLabel(
                  log.role_names
                )}
              />

              <DetailItem
                label="Module"
                value={getModuleLabel(
                  log.module
                )}
              />

              <DetailItem
                label="Date & Time"
                value={formatDateTime(
                  log.created_at
                )}
              />

              <DetailItem
                label="IP Address"
                value={
                  log.ip_address || "—"
                }
              />
            </div>
          </div>


          <div className="audit-detail-section">
            <h3>Technical Details</h3>

            <div className="audit-detail-grid">
              <DetailItem
                label="Technical Action"
                value={log.action || "—"}
                mono
              />

              <DetailItem
                label="Record ID"
                value={
                  log.record_id || "—"
                }
              />

              <DetailItem
                label="Subject"
                value={
                  log.subject_label_snapshot ||
                  "—"
                }
              />

              <DetailItem
                label="Audit Log ID"
                value={log.id}
              />
            </div>

            <div className="audit-description-box">
              <span>Description</span>
              <p>
                {log.description ||
                  "No description recorded."}
              </p>
            </div>
          </div>

        </div>


        <div className="audit-modal-footer">
          <span>
            Audit entries are displayed for
            traceability and accountability.
          </span>

          <button
            type="button"
            className="audit-button"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </section>
    </div>
  );
}


function DetailItem({
  label,
  value,
  mono = false,
}) {
  return (
    <div className="audit-detail-item">
      <span>{label}</span>
      <strong
        className={
          mono
            ? "audit-mono"
            : ""
        }
      >
        {value === null ||
        value === undefined ||
        value === ""
          ? "—"
          : String(value)}
      </strong>
    </div>
  );
}


export default AuditLogs;
