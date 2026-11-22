import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Link,
} from "react-router-dom";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  getDashboardAnalytics,
  getDashboardSummary,
} from "../api/dashboardApi";

import {
  useAuth,
} from "../context/AuthContext";

import {
  hasPermission,
} from "../utils/permissions";

import "../styles/Dashboard.css";


const STOCK_COLORS = [
  "#3d8a67",
  "#d7a62a",
  "#c95a5a",
];


function formatNumber(
  value
) {
  return Number(
    value || 0
  ).toLocaleString(
    "en-PH"
  );
}


function formatDateTime(
  value
) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }

  return date.toLocaleString(
    "en-PH",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }
  );
}


function formatShortDateTime(
  value
) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }

  return date.toLocaleString(
    "en-PH",
    {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }
  );
}


function shortenLabel(
  value,
  maxLength = 18
) {
  if (!value) {
    return "—";
  }

  if (
    value.length <=
    maxLength
  ) {
    return value;
  }

  return (
    value.slice(
      0,
      maxLength - 1
    ) + "…"
  );
}


function getTrendLabel(
  current,
  previous
) {
  const difference =
    Number(current || 0) -
    Number(previous || 0);

  if (difference > 0) {
    return {
      label:
        `+${formatNumber(
          difference
        )} vs previous week`,
      tone: "up",
    };
  }

  if (difference < 0) {
    return {
      label:
        `${formatNumber(
          difference
        )} vs previous week`,
      tone: "down",
    };
  }

  return {
    label:
      "No change vs previous week",
    tone: "flat",
  };
}


function Dashboard() {
  const {
    user,
  } = useAuth();

  const permissions =
    user?.permissions || [];

  const canViewInventory =
    hasPermission(
      permissions,
      "INVENTORY_VIEW"
    );

  const canViewSurveillance =
    hasPermission(
      permissions,
      "SURVEILLANCE_VIEW"
    );

  const canValidateDiseaseCases =
    hasPermission(
      permissions,
      "DISEASE_CASE_VALIDATE"
    );


  const [
    dashboard,
    setDashboard,
  ] = useState(null);

  const [
    analytics,
    setAnalytics,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    refreshedAt,
    setRefreshedAt,
  ] = useState(null);


  const loadDashboard =
    async () => {

      try {
        setLoading(true);
        setError("");

        const [
          summaryData,
          analyticsData,
        ] = await Promise.all([
          getDashboardSummary(),
          getDashboardAnalytics(),
        ]);

        setDashboard(
          summaryData
        );

        setAnalytics(
          analyticsData
        );

        setRefreshedAt(
          new Date()
        );

      } catch (err) {
        console.error(err);

        setError(
          err.response?.data
            ?.detail ||
          "Unable to load dashboard."
        );

      } finally {
        setLoading(false);
      }
    };


  useEffect(
    () => {
      loadDashboard();
    },
    []
  );


  const decisionSupport =
    useMemo(
      () => {

        if (
          !dashboard ||
          !analytics
        ) {
          return [];
        }

        const actions = [];


        if (
          canViewInventory &&
          Number(
            dashboard
              .out_of_stock_medicines ||
              0
          ) > 0
        ) {
          actions.push(
            {
              severity:
                "critical",
              label:
                "Critical",
              title:
                "Medicine replenishment requires attention",
              message:
                `${formatNumber(
                  dashboard
                    .out_of_stock_medicines
                )} active medicine(s) are currently out of stock. Review and prioritize replenishment.`,
              to:
                "/inventory",
              action:
                "Review Inventory",
            }
          );
        }


        if (
          canViewInventory &&
          Number(
            dashboard
              .low_stock_medicines ||
              0
          ) > 0
        ) {
          actions.push(
            {
              severity:
                "warning",
              label:
                "Warning",
              title:
                "Low-stock medicines need planning",
              message:
                `${formatNumber(
                  dashboard
                    .low_stock_medicines
                )} active medicine(s) are at or below their reorder level. Prepare a restocking plan.`,
              to:
                "/inventory",
              action:
                "View Stock Risk",
            }
          );
        }


        if (
          canValidateDiseaseCases &&
          Number(
            analytics
              .pending_standard_disease_cases ||
              0
          ) > 0
        ) {
          actions.push(
            {
              severity:
                "attention",
              label:
                "Attention",
              title:
                "Disease cases are awaiting validation",
              message:
                `${formatNumber(
                  analytics
                    .pending_standard_disease_cases
                )} standard disease case(s) are pending validation and are not yet included in surveillance statistics.`,
              to:
                "/surveillance",
              action:
                "Review Pending Cases",
            }
          );
        }


        const risingDisease =
          canViewSurveillance
            ? analytics
                .top_rising_disease
            : null;


        if (risingDisease) {
          actions.push(
            {
              severity:
                "trend",
              label:
                "Trend",
              title:
                "Increasing validated disease activity",
              message:
                `${risingDisease.name} increased from ${formatNumber(
                  risingDisease
                    .previous_count
                )} to ${formatNumber(
                  risingDisease
                    .current_count
                )} validated case(s) compared with the previous week.`,
              to:
                "/surveillance",
              action:
                "View Surveillance",
            }
          );
        }


        if (
          actions.length ===
          0
        ) {
          actions.push(
            {
              severity:
                "stable",
              label:
                "Stable",
              title:
                "No immediate rule-based alerts",
              message:
                "Current dashboard thresholds do not indicate an immediate operational action. Continue routine monitoring.",
              to:
                null,
              action:
                null,
            }
          );
        }


        return actions.slice(
          0,
          4
        );
      },
      [
        dashboard,
        analytics,
        canViewInventory,
        canViewSurveillance,
        canValidateDiseaseCases,
      ]
    );


  if (loading) {
    return (
      <div className="dashboard-state">
        <div className="dashboard-loading-dot" />
        Loading dashboard...
      </div>
    );
  }


  if (error) {
    return (
      <div className="dashboard-state">

        <p>
          {error}
        </p>

        <button
          type="button"
          onClick={
            loadDashboard
          }
          className="dashboard-button"
        >
          Retry
        </button>

      </div>
    );
  }


  if (
    !dashboard ||
    !analytics
  ) {
    return (
      <div className="dashboard-state">
        Dashboard data unavailable.
      </div>
    );
  }


  const validatedCasesThisWeek =
    Number(
      analytics
        .current_week_disease_total ||
        0
    );


  const medicinesAtRisk =
    Number(
      dashboard
        .low_stock_medicines ||
        0
    ) +
    Number(
      dashboard
        .out_of_stock_medicines ||
        0
    );


  const inStockMedicines =
    Math.max(
      Number(
        dashboard
          .active_medicines ||
          0
      ) -
      medicinesAtRisk,
      0
    );


  const stockChartData = [
    {
      name: "In Stock",
      value:
        inStockMedicines,
    },
    {
      name: "Low Stock",
      value:
        Number(
          dashboard
            .low_stock_medicines ||
            0
        ),
    },
    {
      name:
        "Out of Stock",
      value:
        Number(
          dashboard
            .out_of_stock_medicines ||
            0
        ),
    },
  ];


  const priorityMedicines =
    [
      ...(
        dashboard
          .low_stock_list ||
        []
      ),
    ]
      .sort(
        (a, b) => {

          const priority = {
            "OUT OF STOCK": 0,
            "LOW STOCK": 1,
          };

          const statusDiff =
            (
              priority[
                a.status
              ] ?? 9
            ) -
            (
              priority[
                b.status
              ] ?? 9
            );

          if (
            statusDiff !== 0
          ) {
            return statusDiff;
          }

          return String(
            a.name || ""
          ).localeCompare(
            String(
              b.name || ""
            )
          );
        }
      )
      .slice(
        0,
        5
      );


  const consultationTrend =
    getTrendLabel(
      dashboard
        .consultations_this_week,
      analytics
        .consultations_previous_week
    );


  const diseaseTrend =
    getTrendLabel(
      analytics
        .current_week_disease_total,
      analytics
        .previous_week_disease_total
    );


  const summaryCards = [
    {
      label:
        "Total Patients",
      value:
        dashboard
          .total_patients,
      note:
        "Registered records",
      tone:
        "neutral",
    },
    {
      label:
        "Consultations Today",
      value:
        dashboard
          .consultations_today,
      note:
        "Recorded today",
      tone:
        "neutral",
    },
    {
      label:
        "Consultations This Week",
      value:
        dashboard
          .consultations_this_week,
      note:
        consultationTrend
          .label,
      tone:
        consultationTrend
          .tone,
    },
  ];


  if (
    canViewSurveillance
  ) {
    summaryCards.push(
      {
        label:
          "Validated Cases This Week",
        value:
          validatedCasesThisWeek,
        note:
          diseaseTrend
            .label,
        tone:
          diseaseTrend
            .tone,
      }
    );
  }


  if (
    canViewInventory
  ) {
    summaryCards.push(
      {
        label:
          "Medicines at Risk",
        value:
          medicinesAtRisk,
        note:
          `${formatNumber(
            dashboard
              .out_of_stock_medicines
          )} out · ${formatNumber(
            dashboard
              .low_stock_medicines
          )} low`,
        tone:
          medicinesAtRisk > 0
            ? "warning"
            : "flat",
      }
    );
  }


  if (
    canValidateDiseaseCases
  ) {
    summaryCards.push(
      {
        label:
          "Pending Disease Cases",
        value:
          analytics
            .pending_standard_disease_cases,
        note:
          "Awaiting validation",
        tone:
          Number(
            analytics
              .pending_standard_disease_cases ||
              0
          ) > 0
            ? "attention"
            : "flat",
      }
    );
  }


  return (
    <div className="dashboard-page">


      {/* =================================================
          HEADER
      ================================================= */}

      <header className="dashboard-header">

        <div>
          <span className="dashboard-eyebrow">
            Health Center Overview
          </span>

          <h1>
            Dashboard
          </h1>

          <p>
            Operational monitoring,
            weekly trends, and
            rule-based decision support.
          </p>
        </div>


        <div className="dashboard-header-actions">

          {refreshedAt && (
            <span className="dashboard-refreshed">
              Updated{" "}
              {formatDateTime(
                refreshedAt
              )}
            </span>
          )}

          <button
            type="button"
            onClick={
              loadDashboard
            }
            className="dashboard-button"
          >
            Refresh
          </button>

        </div>

      </header>


      {/* =================================================
          KPI SUMMARY
      ================================================= */}

      <section className="dashboard-kpi-grid">

        {summaryCards.map(
          (card) => (

            <article
              className="dashboard-kpi-card"
              key={
                card.label
              }
            >
              <span className="dashboard-kpi-label">
                {card.label}
              </span>

              <strong className="dashboard-kpi-value">
                {formatNumber(
                  card.value
                )}
              </strong>

              <span
                className={
                  `dashboard-kpi-note dashboard-kpi-note-${card.tone}`
                }
              >
                {card.note}
              </span>
            </article>

          )
        )}

      </section>


      {/* =================================================
          PRIMARY CHARTS
      ================================================= */}

      <div className="dashboard-chart-grid">


        {/* CONSULTATION ACTIVITY */}

        <section className="dashboard-panel dashboard-chart-panel">

          <div className="dashboard-panel-header">

            <div>
              <h2>
                Consultation Activity
              </h2>

              <p>
                Daily consultations
                over the last 7 days.
              </p>
            </div>

            <Link
              to="/consultations"
              className="dashboard-link"
            >
              View Consultations
            </Link>

          </div>


          <div className="dashboard-chart">

            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <LineChart
                data={
                  analytics
                    .consultation_activity_7d
                }
                margin={{
                  top: 8,
                  right: 8,
                  left: -20,
                  bottom: 0,
                }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#edf1f4"
                />

                <XAxis
                  dataKey="label"
                  tick={{
                    fontSize: 11,
                    fill: "#7b8a99",
                  }}
                  axisLine={false}
                  tickLine={false}
                />

                <YAxis
                  allowDecimals={
                    false
                  }
                  tick={{
                    fontSize: 11,
                    fill: "#7b8a99",
                  }}
                  axisLine={false}
                  tickLine={false}
                />

                <Tooltip
                  cursor={{
                    stroke:
                      "#dfe7ec",
                  }}
                  formatter={
                    (value) => [
                      formatNumber(
                        value
                      ),
                      "Consultations",
                    ]
                  }
                />

                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#347455"
                  strokeWidth={3}
                  dot={{
                    r: 3,
                    fill:
                      "#347455",
                    strokeWidth: 0,
                  }}
                  activeDot={{
                    r: 5,
                  }}
                />
              </LineChart>
            </ResponsiveContainer>

          </div>

        </section>


        {/* DISEASE CASES */}

        {canViewSurveillance && (
          <section className="dashboard-panel dashboard-chart-panel">

            <div className="dashboard-panel-header">

              <div>
                <h2>
                  Disease Cases This Week
                </h2>

                <p>
                  Top validated
                  general-scope diseases.
                </p>
              </div>

              <Link
                to="/surveillance"
                className="dashboard-link"
              >
                View Surveillance
              </Link>

            </div>


            {analytics
              .disease_cases_top5
              .length === 0 ? (

              <div className="dashboard-chart-empty">
                No validated general
                disease cases recorded
                this week.
              </div>

            ) : (

              <div className="dashboard-chart">

                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >
                  <BarChart
                    data={
                      analytics
                        .disease_cases_top5
                        .map(
                          (item) => ({
                            ...item,
                            chart_name:
                              shortenLabel(
                                item.name
                              ),
                          })
                        )
                    }
                    layout="vertical"
                    margin={{
                      top: 4,
                      right: 18,
                      left: 2,
                      bottom: 0,
                    }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      horizontal={
                        false
                      }
                      stroke="#edf1f4"
                    />

                    <XAxis
                      type="number"
                      allowDecimals={
                        false
                      }
                      tick={{
                        fontSize: 11,
                        fill: "#7b8a99",
                      }}
                      axisLine={false}
                      tickLine={false}
                    />

                    <YAxis
                      type="category"
                      dataKey="chart_name"
                      width={115}
                      tick={{
                        fontSize: 11,
                        fill: "#5c6d7c",
                      }}
                      axisLine={false}
                      tickLine={false}
                    />

                    <Tooltip
                      formatter={
                        (value) => [
                          formatNumber(
                            value
                          ),
                          "Validated cases",
                        ]
                      }
                      labelFormatter={
                        (
                          label,
                          payload
                        ) =>
                          payload?.[0]
                            ?.payload
                            ?.name ||
                          label
                      }
                    />

                    <Bar
                      dataKey="current_count"
                      fill="#4f8c70"
                      radius={[
                        0,
                        5,
                        5,
                        0,
                      ]}
                      barSize={18}
                    />
                  </BarChart>
                </ResponsiveContainer>

              </div>

            )}

          </section>
        )}

      </div>


      {/* =================================================
          DECISION SUPPORT + STOCK
      ================================================= */}

      <div className="dashboard-support-grid">


        {/* DECISION SUPPORT */}

        <section className="dashboard-panel dashboard-decision-panel">

          <div className="dashboard-panel-header">

            <div>
              <span className="dashboard-panel-kicker">
                Fixed Operational Rules
              </span>

              <h2>
                Decision Support
              </h2>

              <p>
                Priority actions generated
                from current system data.
                No generative AI is used.
              </p>
            </div>

          </div>


          <div className="dashboard-decision-list">

            {decisionSupport.map(
              (
                item,
                index
              ) => (

                <article
                  className={
                    `dashboard-decision-item dashboard-decision-${item.severity}`
                  }
                  key={
                    `${item.title}-${index}`
                  }
                >
                  <div className="dashboard-decision-marker" />

                  <div className="dashboard-decision-content">

                    <div className="dashboard-decision-heading">

                      <span className="dashboard-decision-label">
                        {item.label}
                      </span>

                      <strong>
                        {item.title}
                      </strong>

                    </div>

                    <p>
                      {item.message}
                    </p>

                    {item.to && (
                      <Link
                        to={
                          item.to
                        }
                        className="dashboard-decision-link"
                      >
                        {item.action}
                      </Link>
                    )}

                  </div>

                </article>

              )
            )}

          </div>

        </section>


        {/* MEDICINE STOCK STATUS */}

        {canViewInventory && (
          <section className="dashboard-panel dashboard-stock-panel">

            <div className="dashboard-panel-header">

              <div>
                <h2>
                  Medicine Stock Status
                </h2>

                <p>
                  Current active
                  medicine stock health.
                </p>
              </div>

              <Link
                to="/inventory"
                className="dashboard-link"
              >
                View Inventory
              </Link>

            </div>


            <div className="dashboard-stock-chart-wrap">

              <div className="dashboard-stock-chart">

                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >
                  <PieChart>
                    <Pie
                      data={
                        stockChartData
                      }
                      dataKey="value"
                      nameKey="name"
                      innerRadius={58}
                      outerRadius={82}
                      paddingAngle={2}
                    >
                      {stockChartData.map(
                        (
                          item,
                          index
                        ) => (
                          <Cell
                            key={
                              item.name
                            }
                            fill={
                              STOCK_COLORS[
                                index
                              ]
                            }
                          />
                        )
                      )}
                    </Pie>

                    <Tooltip
                      formatter={
                        (
                          value,
                          name
                        ) => [
                          formatNumber(
                            value
                          ),
                          name,
                        ]
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>


                <div className="dashboard-stock-center">
                  <strong>
                    {formatNumber(
                      dashboard
                        .active_medicines
                    )}
                  </strong>

                  <span>
                    Active
                  </span>
                </div>

              </div>


              <div className="dashboard-stock-legend">

                {stockChartData.map(
                  (
                    item,
                    index
                  ) => (

                    <div
                      className="dashboard-stock-legend-row"
                      key={
                        item.name
                      }
                    >
                      <span
                        className="dashboard-stock-dot"
                        style={{
                          background:
                            STOCK_COLORS[
                              index
                            ],
                        }}
                      />

                      <span>
                        {item.name}
                      </span>

                      <strong>
                        {formatNumber(
                          item.value
                        )}
                      </strong>
                    </div>

                  )
                )}

              </div>

            </div>

          </section>
        )}

      </div>


      {/* =================================================
          COMPACT OPERATIONAL LISTS
      ================================================= */}

      <div className="dashboard-list-grid">


        {/* PRIORITY MEDICINES */}

        {canViewInventory && (
          <section className="dashboard-panel">

            <div className="dashboard-panel-header">

              <div>
                <h2>
                  Priority Medicines
                </h2>

                <p>
                  Top stock items
                  needing attention.
                </p>
              </div>

              <Link
                to="/inventory"
                className="dashboard-link"
              >
                View All
              </Link>

            </div>


            {priorityMedicines.length ===
              0 ? (

              <div className="dashboard-empty-card">
                No low-stock or
                out-of-stock medicines.
              </div>

            ) : (

              <div className="dashboard-compact-list">

                {priorityMedicines.map(
                  (medicine) => (

                    <div
                      className="dashboard-compact-row"
                      key={
                        medicine
                          .medicine_id
                      }
                    >
                      <div>
                        <strong>
                          {medicine.name}
                        </strong>

                        <span>
                          {medicine.code}
                          {" · "}
                          {medicine
                            .stock_display}
                        </span>
                      </div>

                      <span
                        className={
                          medicine.status ===
                          "OUT OF STOCK"
                            ? "status-badge status-out"
                            : "status-badge status-low"
                        }
                      >
                        {medicine.status}
                      </span>
                    </div>

                  )
                )}

              </div>

            )}

          </section>
        )}


        {/* RECENT CONSULTATIONS */}

        <section className="dashboard-panel">

          <div className="dashboard-panel-header">

            <div>
              <h2>
                Recent Consultations
              </h2>

              <p>
                Latest general
                consultation activity.
              </p>
            </div>

            <Link
              to="/consultations"
              className="dashboard-link"
            >
              View All
            </Link>

          </div>


          {dashboard
            .recent_consultations
            .length === 0 ? (

            <div className="dashboard-empty-card">
              No consultations recorded.
            </div>

          ) : (

            <div className="dashboard-compact-list">

              {dashboard
                .recent_consultations
                .slice(
                  0,
                  5
                )
                .map(
                  (item) => (

                    <div
                      className="dashboard-consultation-row"
                      key={
                        item
                          .consultation_id
                      }
                    >
                      <div className="dashboard-consultation-main">

                        <strong>
                          {item.patient_name}
                        </strong>

                        <span>
                          {formatShortDateTime(
                            item
                              .consultation_date
                          )}
                        </span>

                      </div>

                      <span className="dashboard-consultation-diagnosis">
                        {item.diagnosis ||
                          "No diagnosis recorded"}
                      </span>
                    </div>

                  )
                )}

            </div>

          )}

        </section>

      </div>

    </div>
  );
}


export default Dashboard;
