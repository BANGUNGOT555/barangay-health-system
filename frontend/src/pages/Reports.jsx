import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getMedicines,
} from "../api/medicineApi";

import {
  getInventoryTransactions,
} from "../api/inventoryApi";

import {
  getPaginatedPatients,
} from "../api/patientApi";

import {
  getConsultationReport,
  getDiseaseSurveillanceReport,
  recordReportAudit,
} from "../api/reportApi";

import {
  getDiseaseForecast,
  getDiseaseForecastCatalog,
  getMedicineForecast,
  getMedicineForecasts,
} from "../api/forecastApi";

import {
  useAuth,
} from "../context/AuthContext";

import {
  useSystemSettings,
} from "../context/SystemSettingsContext";

import {
  hasPermission,
} from "../utils/permissions";

import "../styles/Reports.css";


/* =========================================================
   CONSTANTS
========================================================= */

const PATIENT_FETCH_SIZE = 100;


const REPORT_TYPE = {
  PATIENTS:
    "PATIENT_REGISTRY",
  CONSULTATIONS:
    "CONSULTATION_REPORT",
  DISEASE:
    "DISEASE_SURVEILLANCE",
  INVENTORY:
    "MEDICINE_INVENTORY",
  STOCK:
    "STOCK_MOVEMENT",
  FORECAST:
    "FORECAST_REPORT",
};


const FORECAST_SCOPE = {
  DISEASE:
    "DISEASE",
  MEDICINE:
    "MEDICINE",
};


const STOCK_TYPES = [
  {
    value: "ALL",
    label: "All Transactions",
  },
  {
    value: "STOCK_IN",
    label: "Stock In",
  },
  {
    value: "ADJUSTMENT_IN",
    label: "Adjustment In",
  },
  {
    value: "ADJUSTMENT_OUT",
    label: "Adjustment Out",
  },
  {
    value: "DISPENSE",
    label: "Dispensed",
  },
];


/* =========================================================
   DATE HELPERS
========================================================= */

function localIsoDate(
  value = new Date()
) {
  const year =
    value.getFullYear();

  const month =
    String(
      value.getMonth() + 1
    ).padStart(
      2,
      "0"
    );

  const day =
    String(
      value.getDate()
    ).padStart(
      2,
      "0"
    );

  return `${year}-${month}-${day}`;
}


function firstDayOfMonth() {
  const now =
    new Date();

  return localIsoDate(
    new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    )
  );
}


function toDateOnly(
  value
) {
  if (!value) {
    return "";
  }

  const parsed =
    new Date(value);

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return String(value)
      .slice(
        0,
        10
      );
  }

  return localIsoDate(
    parsed
  );
}


function formatDate(
  value
) {
  if (!value) {
    return "—";
  }

  const parsed =
    new Date(value);

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return String(value);
  }

  return parsed
    .toLocaleDateString(
      "en-PH",
      {
        year: "numeric",
        month: "short",
        day: "numeric",
      }
    );
}


function formatDateTime(
  value
) {
  if (!value) {
    return "—";
  }

  const parsed =
    new Date(value);

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return String(value);
  }

  return parsed
    .toLocaleString(
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


function isWithinRange(
  value,
  startDate,
  endDate
) {
  if (!value) {
    return false;
  }

  const current =
    toDateOnly(
      value
    );

  if (
    startDate &&
    current < startDate
  ) {
    return false;
  }

  if (
    endDate &&
    current > endDate
  ) {
    return false;
  }

  return true;
}


/* =========================================================
   DISPLAY HELPERS
========================================================= */

function getApiErrorMessage(
  error,
  fallback
) {
  const detail =
    error?.response?.data
      ?.detail;

  if (
    Array.isArray(detail)
  ) {
    return detail
      .map(
        (item) =>
          item?.msg ||
          String(item)
      )
      .join(", ");
  }

  return (
    detail ||
    fallback
  );
}


function formatText(
  value
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  return String(value);
}


function titleCase(
  value
) {
  if (!value) {
    return "—";
  }

  return String(value)
    .replaceAll(
      "_",
      " "
    )
    .toLowerCase()
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );
}


function formatNumber(
  value,
  decimals = 1
) {
  const numeric =
    Number(value);

  if (
    Number.isNaN(numeric)
  ) {
    return "—";
  }

  return numeric
    .toLocaleString(
      "en-PH",
      {
        maximumFractionDigits:
          decimals,
      }
    );
}


function patientName(
  patient
) {
  return [
    patient?.first_name,
    patient?.middle_name,
    patient?.last_name,
    patient?.suffix,
  ]
    .filter(Boolean)
    .join(" ")
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}


function calculateAge(
  dateOfBirth
) {
  if (!dateOfBirth) {
    return null;
  }

  const birth =
    new Date(
      `${dateOfBirth}T00:00:00`
    );

  if (
    Number.isNaN(
      birth.getTime()
    )
  ) {
    return null;
  }

  const today =
    new Date();

  let age =
    today.getFullYear() -
    birth.getFullYear();

  const monthDifference =
    today.getMonth() -
    birth.getMonth();

  if (
    monthDifference < 0 ||
    (
      monthDifference === 0 &&
      today.getDate() <
        birth.getDate()
    )
  ) {
    age -= 1;
  }

  return Math.max(
    age,
    0
  );
}


function getAgeGroup(
  patient
) {
  if (patient?.is_pwd) {
    return "PWD";
  }

  const age =
    calculateAge(
      patient
        ?.date_of_birth
    );

  if (age === null) {
    return "Unknown";
  }

  if (age <= 4) {
    return "Toddler";
  }

  if (age <= 17) {
    return "Minor";
  }

  if (age <= 59) {
    return "Adult";
  }

  return "Senior";
}


function getStockQuantity(
  medicine
) {
  const packageStock =
    Number(
      medicine
        ?.package_stock ??
        0
    );

  const looseStock =
    Number(
      medicine
        ?.loose_stock ??
        0
    );

  const unitsPerPackage =
    Number(
      medicine
        ?.units_per_package ??
        0
    );

  if (
    unitsPerPackage > 0
  ) {
    return (
      packageStock *
        unitsPerPackage +
      looseStock
    );
  }

  return (
    packageStock +
    looseStock
  );
}


function getStockStatus(
  medicine
) {
  const stock =
    getStockQuantity(
      medicine
    );

  const reorderLevel =
    Number(
      medicine
        ?.reorder_level ??
        0
    );

  if (stock <= 0) {
    return "OUT OF STOCK";
  }

  if (
    stock <=
    reorderLevel
  ) {
    return "LOW STOCK";
  }

  return "IN STOCK";
}


function getStockDisplay(
  medicine
) {
  const parts = [];

  const packageStock =
    Number(
      medicine
        ?.package_stock ??
        0
    );

  const looseStock =
    Number(
      medicine
        ?.loose_stock ??
        0
    );

  if (
    packageStock > 0
  ) {
    parts.push(
      `${packageStock} ${
        medicine
          ?.package_unit ||
        "package(s)"
      }`
    );
  }

  if (
    looseStock > 0
  ) {
    parts.push(
      `${looseStock} ${
        medicine
          ?.dispensing_unit ||
        "piece(s)"
      }`
    );
  }

  if (
    parts.length === 0
  ) {
    return `0 ${
      medicine
        ?.dispensing_unit ||
      "piece(s)"
    }`;
  }

  return parts.join(
    " + "
  );
}


function csvCell(
  value
) {
  const normalized =
    value === null ||
    value === undefined
      ? ""
      : String(value);

  return `"${normalized
    .replaceAll(
      '"',
      '""'
    )}"`;
}


/* =========================================================
   REPORT ACTOR HELPERS
========================================================= */

function getReportActorName(
  user
) {
  const fullName = [
    user?.first_name,
    user?.last_name,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return (
    fullName ||
    user?.username ||
    "Authenticated User"
  );
}


function getReportActorRoles(
  user
) {
  if (
    Array.isArray(
      user?.roles
    ) &&
    user.roles.length
  ) {
    return user.roles.join(
      ", "
    );
  }

  return (
    user?.role ||
    "—"
  );
}


/* =========================================================
   REPORTS PAGE
========================================================= */

function Reports() {
  const {
    user,
    loading: authLoading,
  } = useAuth();

  const {
    defaultPageSize,
  } = useSystemSettings();


  const permissions =
    user?.permissions || [];


  const canViewReports =
    hasPermission(
      permissions,
      "REPORT_VIEW"
    );

  const canViewPatients =
    hasPermission(
      permissions,
      "PATIENT_VIEW"
    );

  const canViewSurveillance =
    hasPermission(
      permissions,
      "SURVEILLANCE_VIEW"
    );

  const canViewInventory =
    hasPermission(
      permissions,
      "INVENTORY_VIEW"
    );

  const canViewForecast =
    hasPermission(
      permissions,
      "FORECAST_VIEW"
    );

  const canViewSensitive =
    hasPermission(
      permissions,
      "SENSITIVE_DISEASE_VIEW"
    );


  const reportOptions =
    useMemo(
      () => {

        const options = [];

        if (
          canViewPatients
        ) {
          options.push(
            {
              value:
                REPORT_TYPE
                  .PATIENTS,
              label:
                "Patient Registry Report",
            },
            {
              value:
                REPORT_TYPE
                  .CONSULTATIONS,
              label:
                "Consultation Report",
            }
          );
        }

        if (
          canViewSurveillance
        ) {
          options.push(
            {
              value:
                REPORT_TYPE
                  .DISEASE,
              label:
                "Disease Surveillance Report",
            }
          );
        }

        if (
          canViewInventory
        ) {
          options.push(
            {
              value:
                REPORT_TYPE
                  .INVENTORY,
              label:
                "Medicine Inventory Report",
            },
            {
              value:
                REPORT_TYPE
                  .STOCK,
              label:
                "Medicine Dispensing / Stock Movement Report",
            }
          );
        }

        if (
          canViewForecast
        ) {
          options.push(
            {
              value:
                REPORT_TYPE
                  .FORECAST,
              label:
                "Forecast Report",
            }
          );
        }

        return options;
      },
      [
        canViewPatients,
        canViewSurveillance,
        canViewInventory,
        canViewForecast,
      ]
    );


  const [
    reportType,
    setReportType,
  ] = useState(
    REPORT_TYPE.PATIENTS
  );

  const [
    startDate,
    setStartDate,
  ] = useState(
    firstDayOfMonth()
  );

  const [
    endDate,
    setEndDate,
  ] = useState(
    localIsoDate()
  );

  const [
    diseaseScope,
    setDiseaseScope,
  ] = useState(
    "GENERAL"
  );

  const [
    stockType,
    setStockType,
  ] = useState(
    "ALL"
  );

  const [
    forecastScope,
    setForecastScope,
  ] = useState(
    FORECAST_SCOPE.DISEASE
  );

  const [
    selectedForecastCode,
    setSelectedForecastCode,
  ] = useState("");

  const [
    diseaseCatalog,
    setDiseaseCatalog,
  ] = useState([]);

  const [
    medicineForecastOptions,
    setMedicineForecastOptions,
  ] = useState([]);

  const [
    forecastOptionsLoading,
    setForecastOptionsLoading,
  ] = useState(false);

  const [
    forecastOptionsError,
    setForecastOptionsError,
  ] = useState("");


  const [
    report,
    setReport,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    previewPage,
    setPreviewPage,
  ] = useState(1);


  /* =======================================================
     KEEP REPORT TYPE VALID FOR CURRENT RBAC
  ======================================================= */

  useEffect(
    () => {

      if (
        reportOptions.length ===
        0
      ) {
        return;
      }

      const isAvailable =
        reportOptions.some(
          (item) =>
            item.value ===
            reportType
        );

      if (!isAvailable) {
        setReportType(
          reportOptions[0]
            .value
        );
      }

    },
    [
      reportOptions,
      reportType,
    ]
  );


  /* =======================================================
     RESET GENERATED PREVIEW WHEN TYPE CHANGES
  ======================================================= */

  useEffect(
    () => {
      setReport(null);
      setError("");
      setPreviewPage(1);
    },
    [
      reportType,
    ]
  );


  useEffect(() => {
    setPreviewPage(1);
  }, [
    defaultPageSize,
  ]);


  /* =======================================================
     FORECAST OPTION LOAD
  ======================================================= */

  useEffect(
    () => {

      let active = true;

      if (
        reportType !==
          REPORT_TYPE.FORECAST ||
        !canViewForecast
      ) {
        return () => {
          active = false;
        };
      }

      const loadOptions =
        async () => {

          try {
            setForecastOptionsLoading(
              true
            );

            setForecastOptionsError(
              ""
            );

            setSelectedForecastCode(
              ""
            );

            if (
              forecastScope ===
              FORECAST_SCOPE.DISEASE
            ) {
              const data =
                await getDiseaseForecastCatalog(
                  {
                    includeSensitive:
                      canViewSensitive,
                  }
                );

              if (!active) {
                return;
              }

              const rows =
                Array.isArray(data)
                  ? data
                  : [];

              setDiseaseCatalog(
                rows
              );

              const firstAvailable =
                rows.find(
                  (item) =>
                    item
                      .forecast_status ===
                      "AVAILABLE" &&
                    item
                      .forecast_code
                );

              setSelectedForecastCode(
                firstAvailable
                  ?.forecast_code ||
                  ""
              );

            } else {

              const data =
                await getMedicineForecasts();

              if (!active) {
                return;
              }

              const rows =
                Array.isArray(data)
                  ? data
                  : [];

              setMedicineForecastOptions(
                rows
              );

              setSelectedForecastCode(
                rows[0]
                  ?.medicine_code ||
                  ""
              );
            }

          } catch (err) {

            if (!active) {
              return;
            }

            setForecastOptionsError(
              getApiErrorMessage(
                err,
                "Unable to load forecast options."
              )
            );

          } finally {

            if (active) {
              setForecastOptionsLoading(
                false
              );
            }
          }
        };

      loadOptions();

      return () => {
        active = false;
      };

    },
    [
      reportType,
      forecastScope,
      canViewForecast,
      canViewSensitive,
    ]
  );


  /* =======================================================
     PATIENT FETCHER
  ======================================================= */

  const fetchAllPatients =
    async () => {

      const rows = [];

      let page = 1;
      let totalPages = 1;

      do {
        const data =
          await getPaginatedPatients(
            {
              page,
              page_size:
                PATIENT_FETCH_SIZE,
            }
          );

        const items =
          Array.isArray(
            data?.items
          )
            ? data.items
            : Array.isArray(data)
              ? data
              : [];

        rows.push(
          ...items
        );

        totalPages =
          Math.max(
            Number(
              data
                ?.total_pages ||
                1
            ),
            1
          );

        page += 1;

      } while (
        page <= totalPages
      );

      return rows;
    };


  /* =======================================================
     AUDIT PAYLOAD
  ======================================================= */

  const buildAuditPayload = (
    event,
    currentReport = report
  ) => ({
    event,
    report_type:
      reportType,
    report_title:
      currentReport?.title ||
      reportOptions.find(
        (item) =>
          item.value ===
          reportType
      )?.label ||
      reportType,
    start_date:
      usesDateRange
        ? startDate || null
        : null,
    end_date:
      usesDateRange
        ? endDate || null
        : null,
    surveillance_scope:
      reportType ===
        REPORT_TYPE.DISEASE
        ? diseaseScope
        : null,
    stock_transaction_type:
      reportType ===
        REPORT_TYPE.STOCK
        ? stockType
        : null,
    forecast_scope:
      reportType ===
        REPORT_TYPE.FORECAST
        ? forecastScope
        : null,
    forecast_code:
      reportType ===
        REPORT_TYPE.FORECAST
        ? selectedForecastCode ||
          null
        : null,
    record_count:
      currentReport?.rows
        ?.length ??
      null,
  });


  /* =======================================================
     GENERATE REPORT
  ======================================================= */

  const generateReport =
    async () => {

      if (
        startDate &&
        endDate &&
        startDate > endDate
      ) {
        setError(
          "Start date cannot be later than end date."
        );

        return;
      }

      try {
        setLoading(true);
        setError("");
        setReport(null);
        setPreviewPage(1);

        let nextReport = null;


        /* ---------------------------------------------------
           PATIENT REGISTRY
        --------------------------------------------------- */

        if (
          reportType ===
          REPORT_TYPE.PATIENTS
        ) {
          const patients =
            await fetchAllPatients();

          const filtered =
            patients.filter(
              (patient) =>
                isWithinRange(
                  patient
                    .created_at,
                  startDate,
                  endDate
                )
            );

          const rows =
            filtered.map(
              (patient) => {

                const age =
                  calculateAge(
                    patient
                      .date_of_birth
                  );

                return {
                  patient_code:
                    patient
                      .patient_code,
                  name:
                    patientName(
                      patient
                    ),
                  sex:
                    patient.sex ||
                    "—",
                  age:
                    age ?? "—",
                  category:
                    getAgeGroup(
                      patient
                    ),
                  street:
                    patient.street ||
                    "—",
                  record_status:
                    patient
                      .record_status ||
                    "—",
                  registered:
                    formatDate(
                      patient
                        .created_at
                    ),
                };
              }
            );

          nextReport = {
            title:
              "Patient Registry Report",
            subtitle:
              "Registered patient records within the selected registration period.",
            columns: [
              {
                key:
                  "patient_code",
                label:
                  "Patient Code",
              },
              {
                key: "name",
                label: "Patient",
              },
              {
                key: "sex",
                label: "Sex",
              },
              {
                key: "age",
                label: "Age",
              },
              {
                key:
                  "category",
                label:
                  "Category",
              },
              {
                key: "street",
                label: "Street",
              },
              {
                key:
                  "record_status",
                label:
                  "Record Status",
              },
              {
                key:
                  "registered",
                label:
                  "Registered",
              },
            ],
            rows,
            meta: [
              {
                label:
                  "Period",
                value:
                  `${formatDate(startDate)} – ${formatDate(endDate)}`,
              },
              {
                label:
                  "Records",
                value:
                  rows.length
                    .toLocaleString(
                      "en-PH"
                    ),
              },
            ],
            notes: [
              "This report contains registered patient records and excludes contact numbers by default.",
            ],
          };
        }


        /* ---------------------------------------------------
           CONSULTATION REPORT
        --------------------------------------------------- */

        if (
          reportType ===
          REPORT_TYPE.CONSULTATIONS
        ) {
          const data =
            await getConsultationReport(
              {
                startDate,
                endDate,
              }
            );

          const sourceRows =
            Array.isArray(data)
              ? data
              : [];

          const rows =
            sourceRows.map(
              (item) => ({
                date:
                  formatDateTime(
                    item
                      .consultation_date
                  ),
                patient_code:
                  item
                    .patient_code,
                patient:
                  item
                    .patient_name,
                complaint:
                  item
                    .chief_complaint,
                diagnosis:
                  item
                    .disease_name ||
                  item
                    .diagnosis ||
                  "—",
                street:
                  item
                    .patient_street ||
                  "—",
                recorded_by:
                  item
                    .recorded_by_name_snapshot ||
                  "—",
              })
            );

          nextReport = {
            title:
              "Consultation Report",
            subtitle:
              "Recorded consultations within the selected period.",
            columns: [
              {
                key: "date",
                label: "Date",
              },
              {
                key:
                  "patient_code",
                label:
                  "Patient Code",
              },
              {
                key:
                  "patient",
                label:
                  "Patient",
              },
              {
                key:
                  "complaint",
                label:
                  "Chief Complaint",
              },
              {
                key:
                  "diagnosis",
                label:
                  "Diagnosis / Disease",
              },
              {
                key:
                  "street",
                label:
                  "Street",
              },
              {
                key:
                  "recorded_by",
                label:
                  "Recorded By",
              },
            ],
            rows,
            meta: [
              {
                label:
                  "Period",
                value:
                  `${formatDate(startDate)} – ${formatDate(endDate)}`,
              },
              {
                label:
                  "Consultations",
                value:
                  rows.length
                    .toLocaleString(
                      "en-PH"
                    ),
              },
            ],
            notes: [
              canViewSensitive
                ? "Sensitive consultation records are included only because this account has SENSITIVE_DISEASE_VIEW."
                : "Sensitive disease consultations are excluded for this account.",
            ],
          };
        }


        /* ---------------------------------------------------
           DISEASE SURVEILLANCE REPORT
        --------------------------------------------------- */

        if (
          reportType ===
          REPORT_TYPE.DISEASE
        ) {
          const data =
            await getDiseaseSurveillanceReport(
              {
                startDate,
                endDate,
                scope:
                  diseaseScope,
              }
            );

          const sourceRows =
            Array.isArray(data)
              ? data
              : [];

          const rows =
            sourceRows
              .filter(
                (item) =>
                  Number(
                    item
                      .case_count ||
                      0
                  ) > 0
              )
              .map(
                (item) => ({
                  code:
                    item.code,
                  disease:
                    item.name,
                  validated_cases:
                    Number(
                      item
                        .case_count ||
                        0
                    ),
                  status:
                    "VALIDATED",
                })
              );

          const totalCases =
            rows.reduce(
              (
                total,
                item
              ) =>
                total +
                Number(
                  item
                    .validated_cases ||
                    0
                ),
              0
            );

          nextReport = {
            title:
              diseaseScope ===
                "SENSITIVE"
                ? "Sensitive Disease Surveillance Report"
                : "Disease Surveillance Report",
            subtitle:
              "Validated disease cases only. Pending and rejected cases are excluded.",
            columns: [
              {
                key: "code",
                label: "Code",
              },
              {
                key:
                  "disease",
                label:
                  "Disease",
              },
              {
                key:
                  "validated_cases",
                label:
                  "Validated Cases",
              },
              {
                key:
                  "status",
                label:
                  "Validation",
              },
            ],
            rows,
            meta: [
              {
                label:
                  "Period",
                value:
                  `${formatDate(startDate)} – ${formatDate(endDate)}`,
              },
              {
                label:
                  "Scope",
                value:
                  diseaseScope ===
                    "SENSITIVE"
                    ? "Restricted Sensitive Aggregate"
                    : "General",
              },
              {
                label:
                  "Validated Cases",
                value:
                  totalCases
                    .toLocaleString(
                      "en-PH"
                    ),
              },
            ],
            notes: [
              "Only VALIDATED disease cases are included.",
              diseaseScope ===
                "SENSITIVE"
                ? "Sensitive disease output is aggregate-only and does not include street-level mapping."
                : "Sensitive diseases are excluded from the General scope.",
            ],
          };
        }


        /* ---------------------------------------------------
           MEDICINE INVENTORY
        --------------------------------------------------- */

        if (
          reportType ===
          REPORT_TYPE.INVENTORY
        ) {
          const data =
            await getMedicines(
              "",
              false
            );

          const medicines =
            Array.isArray(data)
              ? data
              : [];

          const rows =
            medicines.map(
              (medicine) => ({
                code:
                  medicine.code,
                medicine:
                  medicine.name,
                generic:
                  medicine
                    .generic_name ||
                  "—",
                strength:
                  medicine
                    .dosage_strength ||
                  "—",
                form:
                  medicine
                    .dosage_form ||
                  "—",
                current_stock:
                  getStockDisplay(
                    medicine
                  ),
                reorder_level:
                  medicine
                    .reorder_level ??
                  0,
                status:
                  getStockStatus(
                    medicine
                  ),
              })
            );

          const lowStock =
            rows.filter(
              (item) =>
                item.status ===
                "LOW STOCK"
            ).length;

          const outOfStock =
            rows.filter(
              (item) =>
                item.status ===
                "OUT OF STOCK"
            ).length;

          nextReport = {
            title:
              "Medicine Inventory Report",
            subtitle:
              "Current medicine master list and usable stock snapshot.",
            columns: [
              {
                key: "code",
                label: "Code",
              },
              {
                key:
                  "medicine",
                label:
                  "Medicine",
              },
              {
                key:
                  "generic",
                label:
                  "Generic",
              },
              {
                key:
                  "strength",
                label:
                  "Strength",
              },
              {
                key: "form",
                label: "Form",
              },
              {
                key:
                  "current_stock",
                label:
                  "Current Stock",
              },
              {
                key:
                  "reorder_level",
                label:
                  "Reorder Level",
              },
              {
                key:
                  "status",
                label:
                  "Status",
              },
            ],
            rows,
            meta: [
              {
                label:
                  "Medicines",
                value:
                  rows.length
                    .toLocaleString(
                      "en-PH"
                    ),
              },
              {
                label:
                  "Low Stock",
                value:
                  lowStock
                    .toLocaleString(
                      "en-PH"
                    ),
              },
              {
                label:
                  "Out of Stock",
                value:
                  outOfStock
                    .toLocaleString(
                      "en-PH"
                    ),
              },
            ],
            notes: [
              "Inventory is a current snapshot; the date-range filter does not apply to this report type.",
            ],
          };
        }


        /* ---------------------------------------------------
           STOCK MOVEMENT / DISPENSING
        --------------------------------------------------- */

        if (
          reportType ===
          REPORT_TYPE.STOCK
        ) {
          const [
            transactionData,
            medicineData,
          ] = await Promise.all([
            getInventoryTransactions(),
            getMedicines(
              "",
              false
            ),
          ]);

          const transactions =
            Array.isArray(
              transactionData
            )
              ? transactionData
              : [];

          const medicines =
            Array.isArray(
              medicineData
            )
              ? medicineData
              : [];

          const medicineMap =
            new Map(
              medicines.map(
                (medicine) => [
                  medicine.id,
                  medicine,
                ]
              )
            );

          const rows =
            transactions
              .filter(
                (item) =>
                  isWithinRange(
                    item
                      .created_at,
                    startDate,
                    endDate
                  )
              )
              .filter(
                (item) =>
                  stockType ===
                    "ALL" ||
                  item
                    .transaction_type ===
                    stockType
              )
              .map(
                (item) => {

                  const medicine =
                    medicineMap.get(
                      item
                        .medicine_id
                    );

                  return {
                    date:
                      formatDateTime(
                        item
                          .created_at
                      ),
                    code:
                      medicine
                        ?.code ||
                      `#${item
                        .medicine_id}`,
                    medicine:
                      medicine
                        ?.name ||
                      `Medicine #${item
                        .medicine_id}`,
                    type:
                      titleCase(
                        item
                          .transaction_type
                      ),
                    quantity:
                      item
                        .quantity,
                    unit:
                      titleCase(
                        item
                          .stock_unit
                      ),
                    reference:
                      item
                        .reference ||
                      "—",
                    reason:
                      item
                        .reason ||
                      "—",
                  };
                }
              );

          nextReport = {
            title:
              "Medicine Dispensing / Stock Movement Report",
            subtitle:
              "Stock-in, adjustments, and dispensing activity within the selected period.",
            columns: [
              {
                key: "date",
                label: "Date",
              },
              {
                key: "code",
                label: "Code",
              },
              {
                key:
                  "medicine",
                label:
                  "Medicine",
              },
              {
                key: "type",
                label: "Type",
              },
              {
                key:
                  "quantity",
                label:
                  "Quantity",
              },
              {
                key: "unit",
                label: "Unit",
              },
              {
                key:
                  "reference",
                label:
                  "Reference",
              },
              {
                key:
                  "reason",
                label:
                  "Reason",
              },
            ],
            rows,
            meta: [
              {
                label:
                  "Period",
                value:
                  `${formatDate(startDate)} – ${formatDate(endDate)}`,
              },
              {
                label:
                  "Transaction Filter",
                value:
                  stockType ===
                    "ALL"
                    ? "All Transactions"
                    : titleCase(
                        stockType
                      ),
              },
              {
                label:
                  "Transactions",
                value:
                  rows.length
                    .toLocaleString(
                      "en-PH"
                    ),
              },
            ],
            notes: [
              "DISPENSE transactions are included in this report when present in inventory history.",
            ],
          };
        }


        /* ---------------------------------------------------
           FORECAST REPORT
        --------------------------------------------------- */

        if (
          reportType ===
          REPORT_TYPE.FORECAST
        ) {
          if (
            !selectedForecastCode
          ) {
            throw new Error(
              "Please select an available forecast model."
            );
          }

          if (
            forecastScope ===
            FORECAST_SCOPE.DISEASE
          ) {
            const catalogItem =
              diseaseCatalog.find(
                (item) =>
                  item
                    .forecast_code ===
                  selectedForecastCode
              );

            const detail =
              await getDiseaseForecast(
                selectedForecastCode
              );

            const rows =
              (
                detail
                  ?.forecast_points ||
                []
              ).map(
                (item) => ({
                  period:
                    item
                      .week_start,
                  forecast_cases:
                    formatNumber(
                      item
                        .forecast_case_count
                    ),
                  lower_95:
                    formatNumber(
                      item.lower_95
                    ),
                  upper_95:
                    formatNumber(
                      item.upper_95
                    ),
                })
              );

            const runtime =
              detail
                ?.runtime_data ||
              {};

            nextReport = {
              title:
                `${
                  catalogItem
                    ?.disease_name ||
                  selectedForecastCode
                } Disease Forecast Report`,
              subtitle:
                "Forecast output from the currently configured forecasting model.",
              columns: [
                {
                  key:
                    "period",
                  label:
                    "Forecast Week",
                },
                {
                  key:
                    "forecast_cases",
                  label:
                    "Forecast Cases",
                },
                {
                  key:
                    "lower_95",
                  label:
                    "Lower 95%",
                },
                {
                  key:
                    "upper_95",
                  label:
                    "Upper 95%",
                },
              ],
              rows,
              meta: [
                {
                  label:
                    "Disease",
                  value:
                    `${
                      catalogItem
                        ?.disease_code ||
                      selectedForecastCode
                    } — ${
                      catalogItem
                        ?.disease_name ||
                      ""
                    }`,
                },
                {
                  label:
                    "Model",
                  value:
                    detail
                      ?.model_family ||
                    catalogItem
                      ?.model_family ||
                    "—",
                },
                {
                  label:
                    "Data Mode",
                  value:
                    runtime
                      .data_mode ||
                    "—",
                },
                {
                  label:
                    "Freshness",
                  value:
                    runtime
                      .freshness_status ||
                    "—",
                },
                {
                  label:
                    "Development Baseline Ends",
                  value:
                    runtime
                      .baseline_end ||
                    "—",
                },
                {
                  label:
                    "Live Periods Used",
                  value:
                    runtime
                      .live_periods_used ??
                    "—",
                },
              ],
              notes: [
                detail
                  ?.warning,
                runtime
                  .message,
                "Forecast values are decision-support outputs and are not automatically treated as validated disease cases.",
              ].filter(Boolean),
            };

          } else {

            const summaryItem =
              medicineForecastOptions
                .find(
                  (item) =>
                    item
                      .medicine_code ===
                    selectedForecastCode
                );

            const detail =
              await getMedicineForecast(
                selectedForecastCode
              );

            const rows =
              (
                detail
                  ?.forecast_points ||
                []
              ).map(
                (item) => ({
                  period:
                    item
                      .month_start,
                  forecast_quantity:
                    formatNumber(
                      item
                        .forecast_quantity_dispensed
                    ),
                  lower_95:
                    formatNumber(
                      item.lower_95
                    ),
                  upper_95:
                    formatNumber(
                      item.upper_95
                    ),
                })
              );

            const runtime =
              detail
                ?.runtime_data ||
              {};

            const recommendation =
              detail
                ?.recommendation ||
              {};

            const recommendationValue =
              recommendation
                .status ===
                "AVAILABLE"
                ? `${
                    recommendation
                      .recommended_additional_stock ??
                    "—"
                  } ${
                    recommendation
                      .dispensing_unit ||
                    ""
                  }`
                : "Withheld";

            nextReport = {
              title:
                `${
                  summaryItem
                    ?.medicine_name ||
                  selectedForecastCode
                } Medicine Demand Forecast Report`,
              subtitle:
                "Forecast demand and resource-allocation decision support.",
              columns: [
                {
                  key:
                    "period",
                  label:
                    "Forecast Month",
                },
                {
                  key:
                    "forecast_quantity",
                  label:
                    "Forecast Demand",
                },
                {
                  key:
                    "lower_95",
                  label:
                    "Lower 95%",
                },
                {
                  key:
                    "upper_95",
                  label:
                    "Upper 95%",
                },
              ],
              rows,
              meta: [
                {
                  label:
                    "Medicine",
                  value:
                    `${
                      summaryItem
                        ?.medicine_code ||
                      selectedForecastCode
                    } — ${
                      summaryItem
                        ?.medicine_name ||
                      ""
                    }`,
                },
                {
                  label:
                    "Model",
                  value:
                    detail
                      ?.model_family ||
                    "—",
                },
                {
                  label:
                    "Data Mode",
                  value:
                    runtime
                      .data_mode ||
                    "—",
                },
                {
                  label:
                    "Freshness",
                  value:
                    runtime
                      .freshness_status ||
                    "—",
                },
                {
                  label:
                    "6-Month Forecast",
                  value:
                    formatNumber(
                      detail
                        ?.cumulative_6_month_forecast
                    ),
                },
                {
                  label:
                    "Recommended Additional Stock",
                  value:
                    recommendationValue,
                },
              ],
              notes: [
                detail
                  ?.warning,
                runtime
                  .message,
                recommendation
                  .status !==
                  "AVAILABLE"
                  ? `Resource recommendation withheld${
                      Array.isArray(
                        recommendation
                          .withheld_reasons
                      ) &&
                      recommendation
                        .withheld_reasons
                        .length
                        ? `: ${recommendation
                            .withheld_reasons
                            .join("; ")}`
                        : "."
                    }`
                  : null,
                "Forecast values are decision-support outputs; stock recommendations remain subject to authorized health-center review.",
              ].filter(Boolean),
            };
          }
        }


        if (!nextReport) {
          throw new Error(
            "Unable to generate the selected report."
          );
        }

        const generatedAt =
          new Date();

        const actorName =
          getReportActorName(
            user
          );

        const actorRoles =
          getReportActorRoles(
            user
          );

        const finalReport = {
          ...nextReport,
          generatedAt,
          generatedBy:
            actorName,
          generatedByRoles:
            actorRoles,
          meta: [
            ...(nextReport.meta || []),
            {
              label:
                "Generated By",
              value:
                actorName,
            },
            {
              label:
                "Role",
              value:
                actorRoles,
            },
          ],
        };

        await recordReportAudit(
          buildAuditPayload(
            "GENERATED",
            finalReport
          )
        );

        setReport(
          finalReport
        );

      } catch (err) {

        console.error(
          "Report generation failed:",
          err
        );

        setError(
          err?.response
            ? getApiErrorMessage(
                err,
                "Unable to generate report."
              )
            : err?.message ||
              "Unable to generate report."
        );

      } finally {
        setLoading(false);
      }
    };


  /* =======================================================
     EXPORT CSV
  ======================================================= */

  const exportCsv =
    async () => {

      if (!report) {
        return;
      }

      try {
        await recordReportAudit(
          buildAuditPayload(
            "CSV_EXPORTED",
            report
          )
        );
      } catch (err) {
        console.error(
          "Unable to audit CSV export:",
          err
        );

        setError(
          getApiErrorMessage(
            err,
            "Unable to authorize and record the CSV export."
          )
        );

        return;
      }

      const lines = [];

      lines.push(
        csvCell(
          report.title
        )
      );

      lines.push(
        `${csvCell(
          "Generated By"
        )},${csvCell(
          report.generatedBy
        )}`
      );

      lines.push(
        `${csvCell(
          "Role"
        )},${csvCell(
          report.generatedByRoles
        )}`
      );

      lines.push(
        `${csvCell(
          "Generated"
        )},${csvCell(
          formatDateTime(
            report.generatedAt
          )
        )}`
      );

      (
        report.meta ||
        []
      )
        .filter(
          (item) =>
            ![
              "Generated By",
              "Role",
            ].includes(
              item.label
            )
        )
        .forEach(
        (item) => {
          lines.push(
            `${csvCell(
              item.label
            )},${csvCell(
              item.value
            )}`
          );
        }
      );

      lines.push("");

      lines.push(
        report.columns
          .map(
            (column) =>
              csvCell(
                column.label
              )
          )
          .join(",")
      );

      report.rows.forEach(
        (row) => {
          lines.push(
            report.columns
              .map(
                (column) =>
                  csvCell(
                    row[
                      column.key
                    ]
                  )
              )
              .join(",")
          );
        }
      );

      if (
        report.notes
          ?.length
      ) {
        lines.push("");
        lines.push(
          csvCell("Notes")
        );

        report.notes.forEach(
          (note) =>
            lines.push(
              csvCell(note)
            )
        );
      }

      const blob =
        new Blob(
          [
            "\ufeff" +
              lines.join(
                "\r\n"
              ),
          ],
          {
            type:
              "text/csv;charset=utf-8;",
          }
        );

      const url =
        URL.createObjectURL(
          blob
        );

      const anchor =
        document.createElement(
          "a"
        );

      const safeName =
        report.title
          .toLowerCase()
          .replace(
            /[^a-z0-9]+/g,
            "-"
          )
          .replace(
            /^-|-$/g,
            ""
          );

      anchor.href = url;
      anchor.download =
        `${safeName || "report"}-${localIsoDate()}.csv`;

      document.body.appendChild(
        anchor
      );

      anchor.click();
      anchor.remove();

      URL.revokeObjectURL(
        url
      );
    };


  /* =======================================================
     PRINT / SAVE PDF
  ======================================================= */

  const printReport =
    async () => {
      if (!report) {
        return;
      }

      try {
        await recordReportAudit(
          buildAuditPayload(
            "PRINT_REQUESTED",
            report
          )
        );
      } catch (err) {
        console.error(
          "Unable to audit print request:",
          err
        );

        setError(
          getApiErrorMessage(
            err,
            "Unable to authorize and record the print request."
          )
        );

        return;
      }

      window.print();
    };


  /* =======================================================
     PREVIEW PAGINATION
  ======================================================= */

  const totalPreviewPages =
    report
      ? Math.max(
          Math.ceil(
            report.rows.length /
              defaultPageSize
          ),
          1
        )
      : 1;


  const previewRows =
    useMemo(
      () => {

        if (!report) {
          return [];
        }

        const start =
          (
            previewPage - 1
          ) *
          defaultPageSize;

        return report.rows.slice(
          start,
          start +
            defaultPageSize
        );
      },
      [
        report,
        previewPage,
        defaultPageSize,
      ]
    );


  /* =======================================================
     AUTH LOADING / ACCESS
  ======================================================= */

  if (authLoading) {
    return (
      <div className="reports-page">
        <div className="reports-empty">
          Loading reports...
        </div>
      </div>
    );
  }


  if (!canViewReports) {
    return (
      <div className="reports-page">
        <section className="reports-card">
          <div className="reports-empty">
            You do not have permission to view reports.
          </div>
        </section>
      </div>
    );
  }


  /* =======================================================
     UI FLAGS
  ======================================================= */

  const usesDateRange =
    [
      REPORT_TYPE.PATIENTS,
      REPORT_TYPE.CONSULTATIONS,
      REPORT_TYPE.DISEASE,
      REPORT_TYPE.STOCK,
    ].includes(
      reportType
    );


  /* =======================================================
     PAGE
  ======================================================= */

  return (
    <div className="reports-page">


      {/* ===================================================
          HEADER
      ==================================================== */}

      <header className="reports-page-header">

        <div>
          <h1>
            Reports
          </h1>

          <p>
            Generate, review, and export
            health center operational and
            analytical reports.
          </p>
        </div>

      </header>


      {/* ===================================================
          REPORT BUILDER
      ==================================================== */}

      <section className="reports-card reports-builder no-print">

        <div className="reports-card-heading">

          <div>
            <h2>
              Report Generator
            </h2>

            <p>
              Select a report type and
              applicable filters, then
              generate the report preview.
            </p>
          </div>

        </div>


        <div className="reports-filter-grid">

          <ReportField
            label="Report Type"
          >
            <select
              value={
                reportType
              }
              onChange={
                (event) =>
                  setReportType(
                    event
                      .target
                      .value
                  )
              }
            >
              {reportOptions.map(
                (item) => (
                  <option
                    key={
                      item.value
                    }
                    value={
                      item.value
                    }
                  >
                    {item.label}
                  </option>
                )
              )}
            </select>
          </ReportField>


          {usesDateRange && (
            <>
              <ReportField
                label="Start Date"
              >
                <input
                  type="date"
                  value={
                    startDate
                  }
                  onChange={
                    (event) =>
                      setStartDate(
                        event
                          .target
                          .value
                      )
                  }
                />
              </ReportField>


              <ReportField
                label="End Date"
              >
                <input
                  type="date"
                  value={
                    endDate
                  }
                  onChange={
                    (event) =>
                      setEndDate(
                        event
                          .target
                          .value
                      )
                  }
                />
              </ReportField>
            </>
          )}


          {reportType ===
            REPORT_TYPE.DISEASE && (
            <ReportField
              label="Surveillance Scope"
            >
              <select
                value={
                  diseaseScope
                }
                onChange={
                  (event) =>
                    setDiseaseScope(
                      event
                        .target
                        .value
                    )
                }
              >
                <option value="GENERAL">
                  General / Standard
                </option>

                {canViewSensitive && (
                  <option value="SENSITIVE">
                    Sensitive / Program Aggregate
                  </option>
                )}
              </select>
            </ReportField>
          )}


          {reportType ===
            REPORT_TYPE.STOCK && (
            <ReportField
              label="Transaction Type"
            >
              <select
                value={
                  stockType
                }
                onChange={
                  (event) =>
                    setStockType(
                      event
                        .target
                        .value
                    )
                }
              >
                {STOCK_TYPES.map(
                  (item) => (
                    <option
                      key={
                        item.value
                      }
                      value={
                        item.value
                      }
                    >
                      {item.label}
                    </option>
                  )
                )}
              </select>
            </ReportField>
          )}


          {reportType ===
            REPORT_TYPE.FORECAST && (
            <>
              <ReportField
                label="Forecast Scope"
              >
                <select
                  value={
                    forecastScope
                  }
                  onChange={
                    (event) => {
                      setForecastScope(
                        event
                          .target
                          .value
                      );

                      setReport(
                        null
                      );
                    }
                  }
                >
                  <option
                    value={
                      FORECAST_SCOPE.DISEASE
                    }
                  >
                    Disease Cases
                  </option>

                  <option
                    value={
                      FORECAST_SCOPE.MEDICINE
                    }
                  >
                    Medicine Demand
                  </option>
                </select>
              </ReportField>


              <ReportField
                label={
                  forecastScope ===
                    FORECAST_SCOPE.DISEASE
                    ? "Disease"
                    : "Medicine"
                }
              >
                <select
                  value={
                    selectedForecastCode
                  }
                  onChange={
                    (event) =>
                      setSelectedForecastCode(
                        event
                          .target
                          .value
                      )
                  }
                  disabled={
                    forecastOptionsLoading
                  }
                >
                  <option value="">
                    {forecastOptionsLoading
                      ? "Loading..."
                      : "Select an available model"}
                  </option>

                  {forecastScope ===
                    FORECAST_SCOPE.DISEASE
                    ? diseaseCatalog.map(
                        (item) => (
                          <option
                            key={
                              item
                                .disease_id
                            }
                            value={
                              item
                                .forecast_code ||
                              ""
                            }
                            disabled={
                              item
                                .forecast_status !==
                                "AVAILABLE" ||
                              !item
                                .forecast_code
                            }
                          >
                            {item
                              .disease_code}
                            {" — "}
                            {item
                              .disease_name}
                            {item
                              .is_sensitive
                              ? " · Restricted"
                              : ""}
                            {item
                              .forecast_status !==
                              "AVAILABLE"
                              ? " · Model Pending"
                              : ""}
                          </option>
                        )
                      )
                    : medicineForecastOptions.map(
                        (item) => (
                          <option
                            key={
                              item
                                .medicine_code
                            }
                            value={
                              item
                                .medicine_code
                            }
                          >
                            {item
                              .medicine_code}
                            {" — "}
                            {item
                              .medicine_name}
                          </option>
                        )
                      )}
                </select>
              </ReportField>
            </>
          )}

        </div>


        {forecastOptionsError && (
          <div className="app-message app-message-error reports-message">
            {forecastOptionsError}
          </div>
        )}


        <div className="reports-builder-actions">

          <button
            type="button"
            className="app-button app-button-primary"
            onClick={
              generateReport
            }
            disabled={
              loading ||
              reportOptions.length ===
                0
            }
          >
            {loading
              ? "Generating..."
              : "Generate Report"}
          </button>


          <span>
            Report data is loaded only
            when you generate a report.
          </span>

        </div>

      </section>


      {/* ===================================================
          ERROR
      ==================================================== */}

      {error && (
        <div className="app-message app-message-error reports-message no-print">
          {error}
        </div>
      )}


      {/* ===================================================
          EMPTY STATE
      ==================================================== */}

      {!report && !loading && (
        <section className="reports-card reports-empty-state no-print">

          <div className="reports-empty-icon">
            R
          </div>

          <h2>
            No report generated yet
          </h2>

          <p>
            Choose a report type and
            click Generate Report to
            create a printable and
            exportable table.
          </p>

        </section>
      )}


      {/* ===================================================
          GENERATED REPORT
      ==================================================== */}

      {report && (

        <section className="reports-card reports-output print-report">

          <div className="reports-output-header">

            <div>
              <span className="reports-output-kicker">
                Barangay Krus na Ligas Health Center
              </span>

              <h2>
                {report.title}
              </h2>

              <p>
                {report.subtitle}
              </p>
            </div>


            <div className="reports-output-actions no-print">

              <button
                type="button"
                className="app-button app-button-secondary"
                onClick={
                  exportCsv
                }
              >
                Export CSV
              </button>

              <button
                type="button"
                className="app-button app-button-primary"
                onClick={
                  printReport
                }
              >
                Print / Save PDF
              </button>

            </div>

          </div>


          <div className="reports-generated-line">
            Generated{" "}
            {formatDateTime(
              report.generatedAt
            )}
          </div>


          {report.meta?.length >
            0 && (

            <div className="reports-meta-grid">

              {report.meta.map(
                (item) => (

                  <div
                    key={
                      item.label
                    }
                    className="reports-meta-item"
                  >
                    <span>
                      {item.label}
                    </span>

                    <strong>
                      {formatText(
                        item.value
                      )}
                    </strong>
                  </div>

                )
              )}

            </div>

          )}


          {report.rows.length ===
            0 ? (

            <div className="reports-empty">
              No records matched the selected report filters.
            </div>

          ) : (

            <>
              <div className="reports-table-wrap screen-report-table">

                <table className="reports-table">

                  <thead>
                    <tr>
                      {report.columns.map(
                        (column) => (
                          <th
                            key={
                              column.key
                            }
                          >
                            {column.label}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>


                  <tbody>
                    {previewRows.map(
                      (
                        row,
                        rowIndex
                      ) => (

                        <tr
                          key={
                            `${previewPage}-${rowIndex}`
                          }
                        >
                          {report.columns.map(
                            (column) => (

                              <td
                                key={
                                  column.key
                                }
                              >
                                {formatText(
                                  row[
                                    column.key
                                  ]
                                )}
                              </td>

                            )
                          )}
                        </tr>

                      )
                    )}
                  </tbody>

                </table>

              </div>


              <div className="reports-table-wrap print-only">

                <table className="reports-table">

                  <thead>
                    <tr>
                      {report.columns.map(
                        (column) => (
                          <th
                            key={
                              `print-${column.key}`
                            }
                          >
                            {column.label}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>


                  <tbody>
                    {report.rows.map(
                      (
                        row,
                        rowIndex
                      ) => (

                        <tr
                          key={
                            `print-${rowIndex}`
                          }
                        >
                          {report.columns.map(
                            (column) => (

                              <td
                                key={
                                  `print-${rowIndex}-${column.key}`
                                }
                              >
                                {formatText(
                                  row[
                                    column.key
                                  ]
                                )}
                              </td>

                            )
                          )}
                        </tr>

                      )
                    )}
                  </tbody>

                </table>

              </div>
            </>

          )}


          {report.rows.length >
            defaultPageSize && (

            <div className="reports-pagination no-print">

              <span>
                Showing{" "}
                {(
                  (
                    previewPage -
                    1
                  ) *
                    defaultPageSize +
                  1
                ).toLocaleString(
                  "en-PH"
                )}
                {"–"}
                {Math.min(
                  previewPage *
                    defaultPageSize,
                  report.rows.length
                ).toLocaleString(
                  "en-PH"
                )}
                {" of "}
                {report.rows.length
                  .toLocaleString(
                    "en-PH"
                  )}
              </span>


              <div>
                <button
                  type="button"
                  onClick={
                    () =>
                      setPreviewPage(
                        (
                          current
                        ) =>
                          Math.max(
                            current -
                              1,
                            1
                          )
                      )
                  }
                  disabled={
                    previewPage <= 1
                  }
                >
                  ‹ Previous
                </button>

                <strong>
                  Page{" "}
                  {previewPage}
                  {" of "}
                  {totalPreviewPages}
                </strong>

                <button
                  type="button"
                  onClick={
                    () =>
                      setPreviewPage(
                        (
                          current
                        ) =>
                          Math.min(
                            current +
                              1,
                            totalPreviewPages
                          )
                      )
                  }
                  disabled={
                    previewPage >=
                    totalPreviewPages
                  }
                >
                  Next ›
                </button>
              </div>

            </div>

          )}


          {report.notes?.length >
            0 && (

            <div className="reports-notes">

              <strong>
                Report Notes
              </strong>

              <ul>
                {report.notes.map(
                  (
                    note,
                    index
                  ) => (
                    <li
                      key={
                        `${index}-${note}`
                      }
                    >
                      {note}
                    </li>
                  )
                )}
              </ul>

            </div>

          )}

        </section>

      )}

    </div>
  );
}


/* =========================================================
   FIELD WRAPPER
========================================================= */

function ReportField({
  label,
  children,
}) {
  return (
    <label className="reports-field">

      <span>
        {label}
      </span>

      {children}

    </label>
  );
}


export default Reports;
