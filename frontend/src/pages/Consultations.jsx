import {
  useEffect,
  useState,
} from "react";

import {
  Link,
  useNavigate,
} from "react-router-dom";

import {
  createConsultation,
} from "../api/consultationApi";

import {
  predictDisease,
} from "../api/predictionApi";

import {
  getPaginatedPatients,
} from "../api/patientApi";

import {
  getActiveDiseases,
} from "../api/diseaseApi";

import PatientSearchSelect
  from "../components/PatientSearchSelect";

import {
  useAuth,
} from "../context/AuthContext";

import {
  useSystemSettings,
} from "../context/SystemSettingsContext";

import {
  hasPermission,
} from "../utils/permissions";

import "../styles/Consultations.css";
import "../styles/ConsultationsSymptoms.css";
import "../styles/ConsultationsPrediction.css";
import "../styles/ConsultationsPagination.css";


const SYMPTOM_OPTIONS = [
  {
    code: "FEVER",
    label: "Fever",
  },
  {
    code: "COUGH",
    label: "Cough",
  },
  {
    code: "RUNNY_NOSE",
    label: "Colds / Runny Nose",
  },
  {
    code: "SORE_THROAT",
    label: "Sore Throat",
  },
  {
    code: "HEADACHE",
    label: "Headache",
  },
  {
    code: "BODY_PAIN",
    label: "Body Pain",
  },
  {
    code: "VOMITING",
    label: "Vomiting",
  },
  {
    code: "DIARRHEA",
    label: "Diarrhea",
  },
  {
    code: "ABDOMINAL_PAIN",
    label: "Abdominal Pain",
  },
  {
    code: "RASH",
    label: "Rash",
  },
  {
    code: "NAUSEA",
    label: "Nausea",
  },
  {
    code: "FATIGUE",
    label: "Weakness / Fatigue",
  },
  {
    code: "DIFFICULTY_BREATHING",
    label: "Difficulty Breathing",
  },
  {
    code: "LOSS_OF_APPETITE",
    label: "Loss of Appetite",
  },
  {
    code: "CHILLS",
    label: "Chills",
  },
];

const DISEASE_DISPLAY_NAMES = {
  DENGUE:
    "Dengue",

  ARI:
    "Acute Respiratory Infection (ARI)",

  ILI:
    "Influenza-Like Illness (ILI)",

  DIARRHEA_GASTROENTERITIS:
    "Diarrhea / Gastroenteritis",
};


const PREDICTION_RELEVANT_FIELDS =
  new Set([
    "patient_id",
    "temperature",
    "heart_rate",
    "respiratory_rate",
    "oxygen_saturation",
  ]);


const EMPTY_FORM = {
  patient_id: "",
  disease_id: "",
  chief_complaint: "",
  symptoms: "",
  symptom_codes: [],
  temperature: "",
  systolic_bp: "",
  diastolic_bp: "",
  heart_rate: "",
  respiratory_rate: "",
  oxygen_saturation: "",
  weight_kg: "",
  height_cm: "",
  assessment: "",
  diagnosis: "",
  treatment_plan: "",
  notes: "",
};


const CONSULTATION_DRAFT_VERSION = 1;

const CONSULTATION_DRAFT_MAX_AGE_MS =
  8 * 60 * 60 * 1000;

const CONSULTATION_DRAFT_KEY_PREFIX =
  "knl_consultation_draft";



const hasConsultationDraftData = (
  data,
  includePatient = true
) => {
  if (!data) {
    return false;
  }

  return Object.entries(data).some(
    ([key, value]) => {
      if (
        !includePatient &&
        key === "patient_id"
      ) {
        return false;
      }

      if (Array.isArray(value)) {
        return value.length > 0;
      }

      return String(
        value ?? ""
      ).trim() !== "";
    }
  );
};


function Consultations() {
  const navigate =
    useNavigate();


  const {
    user,
  } = useAuth();

  const {
    defaultPageSize,
  } = useSystemSettings();


  const permissions =
    user?.permissions ?? [];


  const canPredictDisease =
    hasPermission(
      permissions,
      "DISEASE_PREDICT"
    );


  const canCreateDiagnosis =
    hasPermission(
      permissions,
      "DIAGNOSIS_CREATE"
    );

  const [
    diseases,
    setDiseases,
  ] = useState([]);


  const [
    loadingDiseases,
    setLoadingDiseases,
  ] = useState(false);


  const [
    diseaseLoadError,
    setDiseaseLoadError,
  ] = useState("");


  /*
   * The Patient Records table uses a server-side
   * paginated result set.
   *
   * The New Consultation patient selector also uses
   * server-side search through PatientSearchSelect,
   * so the full patient list is no longer loaded here.
   */
  const [
    patientRecords,
    setPatientRecords,
  ] = useState([]);


  const [
    patientRecordsPage,
    setPatientRecordsPage,
  ] = useState(1);


  const [
    patientRecordsPagination,
    setPatientRecordsPagination,
  ] = useState({
    total: 0,
    total_pages: 1,
    page_size:
      defaultPageSize,
  });


  const [
    loadingPatientRecords,
    setLoadingPatientRecords,
  ] = useState(true);


  const [
    formData,
    setFormData,
  ] = useState({
    ...EMPTY_FORM,
  });

  const [
    showForm,
    setShowForm,
  ] = useState(false);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState("");


  const [
    predictionLoading,
    setPredictionLoading,
  ] = useState(false);


  const [
    predictionResult,
    setPredictionResult,
  ] = useState(null);


  const [
    predictionError,
    setPredictionError,
  ] = useState("");


  const [
    draftReady,
    setDraftReady,
  ] = useState(false);


  const [
    draftNotice,
    setDraftNotice,
  ] = useState("");


  const draftStorageKey =
    user?.id
      ? (
          `${CONSULTATION_DRAFT_KEY_PREFIX}:user:${user.id}`
        )
      : null;


  // =====================================================
  // HELPERS
  // =====================================================

  const textOrNull = (
    value
  ) => {
    if (
      typeof value !== "string"
    ) {
      return null;
    }

    const cleaned =
      value.trim();

    return cleaned || null;
  };


  const numberOrNull = (
    value
  ) => {
    if (value === "") {
      return null;
    }

    const parsed =
      Number(value);

    return Number.isNaN(parsed)
      ? null
      : parsed;
  };


  const clearMessages = () => {
    setError("");
    setSuccess("");
  };


  const clearStoredDraft = () => {
    if (draftStorageKey) {
      sessionStorage.removeItem(
        draftStorageKey
      );
    }

    setDraftNotice("");
  };


  const resetForm = () => {
    setFormData({
      ...EMPTY_FORM,
    });

    setPredictionResult(
      null
    );

    setPredictionError(
      ""
    );
  };


  // =====================================================
  // LOAD ACTIVE DISEASES
  // =====================================================

  useEffect(() => {
    let active = true;

    if (!canCreateDiagnosis) {
      setDiseases([]);
      setDiseaseLoadError("");
      setLoadingDiseases(false);

      return () => {
        active = false;
      };
    }

    const loadDiseases =
      async () => {
        try {
          setLoadingDiseases(
            true
          );

          setDiseaseLoadError(
            ""
          );

          const data =
            await getActiveDiseases();

          if (!active) {
            return;
          }

          setDiseases(
            Array.isArray(data)
              ? data
              : []
          );

        } catch (err) {
          if (!active) {
            return;
          }

          console.error(
            "Unable to load active diseases:",
            err
          );

          setDiseases([]);

          setDiseaseLoadError(
            err?.response?.data
              ?.detail ||
            "Unable to load disease list."
          );

        } finally {
          if (active) {
            setLoadingDiseases(
              false
            );
          }
        }
      };

    loadDiseases();

    return () => {
      active = false;
    };
  }, [
    canCreateDiagnosis,
  ]);


  // =====================================================
  // LOAD PAGINATED PATIENT RECORDS
  // =====================================================

  useEffect(() => {
    let active = true;

    const loadPatientRecords =
      async () => {
        try {
          setLoadingPatientRecords(
            true
          );

          const data =
            await getPaginatedPatients({
              page:
                patientRecordsPage,

              page_size:
                defaultPageSize,
            });

          if (!active) {
            return;
          }

          setPatientRecords(
            Array.isArray(
              data?.items
            )
              ? data.items
              : []
          );

          setPatientRecordsPagination({
            total:
              Number(
                data?.total
              ) || 0,

            total_pages:
              Math.max(
                Number(
                  data?.total_pages
                ) || 1,
                1
              ),

            page_size:
              Number(
                data?.page_size
              ) ||
              defaultPageSize,
          });

        } catch (err) {
          if (!active) {
            return;
          }

          console.error(
            "Unable to load paginated patient records:",
            err
          );

          setError(
            err?.response?.data
              ?.detail ||
            "Unable to load patient records."
          );

        } finally {
          if (active) {
            setLoadingPatientRecords(
              false
            );
          }
        }
      };

    loadPatientRecords();

    return () => {
      active = false;
    };
  }, [
    patientRecordsPage,
    defaultPageSize,
  ]);


  useEffect(() => {
    setPatientRecordsPage(1);
  }, [
    defaultPageSize,
  ]);


  // =====================================================
  // CONSULTATION DRAFT
  // =====================================================

  useEffect(() => {
    if (!draftStorageKey) {
      setDraftReady(false);
      return;
    }

    setDraftReady(false);

    try {
      const rawDraft =
        sessionStorage.getItem(
          draftStorageKey
        );

      if (!rawDraft) {
        setFormData({
          ...EMPTY_FORM,
        });

        setShowForm(false);

        setPredictionResult(
          null
        );

        setPredictionError(
          ""
        );

        setDraftNotice("");
        setDraftReady(true);
        return;
      }

      const savedDraft =
        JSON.parse(rawDraft);

      const updatedAt =
        Number(
          savedDraft?.updated_at
        );

      const draftAge =
        Date.now() - updatedAt;

      const isValidDraft =
        savedDraft?.version ===
          CONSULTATION_DRAFT_VERSION &&
        savedDraft?.user_id ===
          Number(user?.id) &&
        savedDraft?.form_data &&
        Number.isFinite(updatedAt) &&
        draftAge >= 0 &&
        draftAge <=
          CONSULTATION_DRAFT_MAX_AGE_MS;

      if (!isValidDraft) {
        sessionStorage.removeItem(
          draftStorageKey
        );

        setFormData({
          ...EMPTY_FORM,
        });

        setShowForm(false);

        setDraftNotice("");
        setDraftReady(true);
        return;
      }

      const restoredForm = {
        ...EMPTY_FORM,
        ...savedDraft.form_data,
        symptom_codes:
          Array.isArray(
            savedDraft
              .form_data
              .symptom_codes
          )
            ? savedDraft
                .form_data
                .symptom_codes
            : [],
      };

      setFormData(
        restoredForm
      );

      setPredictionResult(
        null
      );

      setPredictionError(
        ""
      );

      setShowForm(true);

      setDraftNotice(
        "Unsaved consultation draft restored for this signed-in user."
      );

    } catch (err) {
      console.error(
        "Unable to restore consultation draft:",
        err
      );

      sessionStorage.removeItem(
        draftStorageKey
      );

      setFormData({
        ...EMPTY_FORM,
      });

      setShowForm(false);

      setDraftNotice("");

    } finally {
      setDraftReady(true);
    }
  }, [
    draftStorageKey,
    user?.id,
  ]);


  useEffect(() => {
    if (
      !draftReady ||
      !draftStorageKey ||
      !user?.id
    ) {
      return undefined;
    }

    const saveTimer =
      window.setTimeout(
        () => {
          try {
            if (
              !hasConsultationDraftData(
                formData
              )
            ) {
              sessionStorage.removeItem(
                draftStorageKey
              );

              return;
            }

            sessionStorage.setItem(
              draftStorageKey,
              JSON.stringify({
                version:
                  CONSULTATION_DRAFT_VERSION,

                user_id:
                  Number(user.id),

                patient_id:
                  formData.patient_id
                    ? Number(
                        formData.patient_id
                      )
                    : null,

                updated_at:
                  Date.now(),

                form_data:
                  formData,
              })
            );

          } catch (err) {
            console.error(
              "Unable to autosave consultation draft:",
              err
            );
          }
        },
        400
      );

    return () => {
      window.clearTimeout(
        saveTimer
      );
    };
  }, [
    draftReady,
    draftStorageKey,
    formData,
    user?.id,
  ]);


  useEffect(() => {
    const handleBeforeUnload = (
      event
    ) => {
      if (
        !showForm ||
        !hasConsultationDraftData(
          formData
        )
      ) {
        return;
      }

      event.preventDefault();

      event.returnValue = "";
    };

    window.addEventListener(
      "beforeunload",
      handleBeforeUnload
    );

    return () => {
      window.removeEventListener(
        "beforeunload",
        handleBeforeUnload
      );
    };
  }, [
    formData,
    showForm,
  ]);


  // =====================================================
  // FORM EVENTS
  // =====================================================

  const handleChange = (
    event
  ) => {
    const {
      name,
      value,
    } = event.target;


    if (
      name === "patient_id" &&
      formData.patient_id &&
      value !==
        formData.patient_id &&
      hasConsultationDraftData(
        formData,
        false
      )
    ) {
      const confirmed =
        window.confirm(
          "Changing the patient will clear the current unsaved consultation to prevent mixing records. Continue?"
        );

      if (!confirmed) {
        return;
      }

      clearStoredDraft();

      setFormData({
        ...EMPTY_FORM,
        patient_id: value,
      });

      setPredictionResult(
        null
      );

      setPredictionError(
        ""
      );

      return;
    }


    setFormData(
      (current) => ({
        ...current,
        [name]: value,
      })
    );


    if (
      PREDICTION_RELEVANT_FIELDS
        .has(name)
    ) {
      setPredictionResult(
        null
      );

      setPredictionError(
        ""
      );
    }
  };


  const handleSymptomToggle = (
    symptomCode
  ) => {
    setFormData(
      (current) => {
        const selected =
          current.symptom_codes;

        const nextSymptoms =
          selected.includes(
            symptomCode
          )
            ? selected.filter(
                (code) =>
                  code !==
                  symptomCode
              )
            : [
                ...selected,
                symptomCode,
              ];

        return {
          ...current,
          symptom_codes:
            nextSymptoms,
        };
      }
    );


    setPredictionResult(
      null
    );

    setPredictionError(
      ""
    );
  };


  const handleAnalyzePrediction =
    async () => {
      setPredictionError(
        ""
      );


      if (
        !canPredictDisease
      ) {
        setPredictionError(
          "You do not have permission to run disease decision support."
        );

        return;
      }


      if (
        !formData.patient_id
      ) {
        setPredictionError(
          "Please select a patient before running the analysis."
        );

        return;
      }


      if (
        formData
          .symptom_codes
          .length === 0
      ) {
        setPredictionError(
          "Select at least one structured symptom before running the analysis."
        );

        return;
      }


      try {
        setPredictionLoading(
          true
        );


        const result =
          await predictDisease({
            patient_id:
              Number(
                formData
                  .patient_id
              ),

            symptom_codes:
              formData
                .symptom_codes,

            temperature:
              numberOrNull(
                formData
                  .temperature
              ),

            heart_rate:
              numberOrNull(
                formData
                  .heart_rate
              ),

            respiratory_rate:
              numberOrNull(
                formData
                  .respiratory_rate
              ),

            oxygen_saturation:
              numberOrNull(
                formData
                  .oxygen_saturation
              ),
          });


        setPredictionResult(
          result
        );

      } catch (err) {
        console.error(
          "Unable to run disease decision support:",
          err
        );


        const detail =
          err?.response
            ?.data
            ?.detail;


        if (
          Array.isArray(
            detail
          )
        ) {
          setPredictionError(
            detail
              .map(
                (
                  item
                ) =>
                  item?.msg ||
                  "Invalid prediction request."
              )
              .join(", ")
          );

        } else {
          setPredictionError(
            detail ||
            "Unable to run disease decision support."
          );
        }

      } finally {
        setPredictionLoading(
          false
        );
      }
    };


  const discardConsultationDraft =
    () => {
      if (
        hasConsultationDraftData(
          formData
        )
      ) {
        const confirmed =
          window.confirm(
            "Discard this unsaved consultation draft?"
          );

        if (!confirmed) {
          return false;
        }
      }

      clearStoredDraft();
      resetForm();

      setShowForm(false);

      clearMessages();

      return true;
    };


  const toggleForm = () => {
    if (showForm) {
      discardConsultationDraft();
      return;
    }

    setShowForm(true);

    clearMessages();
  };


  // =====================================================
  // SAVE CONSULTATION
  // =====================================================

  const handleSubmit =
    async (event) => {
      event.preventDefault();

      clearMessages();


      if (
        !formData.patient_id
      ) {
        setError(
          "Please select a patient."
        );

        return;
      }


      try {
        setSaving(true);


        const payload = {
          disease_id:
            formData.disease_id
              ? Number(
                  formData.disease_id
                )
              : null,

          chief_complaint:
            formData
              .chief_complaint
              .trim(),

          symptom_codes:
            formData.symptom_codes,

          run_ml_analysis:
            Boolean(
              predictionResult
            ),

          symptoms:
            textOrNull(
              formData.symptoms
            ),

          temperature:
            numberOrNull(
              formData.temperature
            ),

          systolic_bp:
            numberOrNull(
              formData.systolic_bp
            ),

          diastolic_bp:
            numberOrNull(
              formData.diastolic_bp
            ),

          heart_rate:
            numberOrNull(
              formData.heart_rate
            ),

          respiratory_rate:
            numberOrNull(
              formData
                .respiratory_rate
            ),

          oxygen_saturation:
            numberOrNull(
              formData
                .oxygen_saturation
            ),

          weight_kg:
            numberOrNull(
              formData.weight_kg
            ),

          height_cm:
            numberOrNull(
              formData.height_cm
            ),

          assessment:
            textOrNull(
              formData.assessment
            ),

          diagnosis:
            textOrNull(
              formData.diagnosis
            ),

          treatment_plan:
            textOrNull(
              formData
                .treatment_plan
            ),

          notes:
            textOrNull(
              formData.notes
            ),
        };


        await createConsultation(
          formData.patient_id,
          payload
        );


        const patientId =
          formData.patient_id;


        clearStoredDraft();

        resetForm();

        setShowForm(false);

        setSuccess(
          predictionResult
            ? "Consultation and ML analysis recorded successfully."
            : "Consultation recorded successfully."
        );


        navigate(
          `/patients/${patientId}`
        );

      } catch (err) {
        console.error(err);

        const detail =
          err.response?.data
            ?.detail;


        if (
          Array.isArray(detail)
        ) {
          setError(
            detail
              .map(
                (item) =>
                  item.msg
              )
              .join(", ")
          );

        } else {
          setError(
            detail ||
              "Unable to save consultation."
          );
        }

      } finally {
        setSaving(false);
      }
    };


  // =====================================================
  // PATIENT RECORDS PAGINATION
  // =====================================================

  const getVisiblePatientRecordPages =
    () => {
      const totalPages =
        Math.max(
          patientRecordsPagination
            .total_pages || 1,
          1
        );

      if (totalPages <= 7) {
        return Array.from(
          {
            length: totalPages,
          },
          (_, index) =>
            index + 1
        );
      }

      if (
        patientRecordsPage <= 3
      ) {
        return [
          1,
          2,
          3,
          4,
          "...",
          totalPages,
        ];
      }

      if (
        patientRecordsPage >=
        totalPages - 2
      ) {
        return [
          1,
          "...",
          totalPages - 3,
          totalPages - 2,
          totalPages - 1,
          totalPages,
        ];
      }

      return [
        1,
        "...",
        patientRecordsPage - 1,
        patientRecordsPage,
        patientRecordsPage + 1,
        "...",
        totalPages,
      ];
    };


  const goToPatientRecordsPage = (
    requestedPage
  ) => {
    const totalPages =
      Math.max(
        patientRecordsPagination
          .total_pages || 1,
        1
      );

    const safePage =
      Math.min(
        Math.max(
          requestedPage,
          1
        ),
        totalPages
      );

    if (
      safePage ===
        patientRecordsPage ||
      loadingPatientRecords
    ) {
      return;
    }

    setPatientRecordsPage(
      safePage
    );
  };


  // =====================================================
  // PAGE
  // =====================================================

  return (
    <div className="consultations-page">

      {/* PAGE HEADER */}

      <header className="consultations-page-header">

        <div>
          <h1>
            Consultations
          </h1>

          <p>
            Record and manage patient
            consultations.
          </p>
        </div>


        <button
          type="button"
          className={
            showForm
              ? "app-button app-button-secondary"
              : "app-button app-button-primary"
          }
          onClick={toggleForm}
        >
          {showForm
            ? "Cancel"
            : "+ New Consultation"}
        </button>

      </header>


      {/* MESSAGES */}

      {error && (
        <div className="app-message app-message-error consultations-message">
          {error}
        </div>
      )}


      {success && (
        <div className="app-message app-message-success consultations-message">
          {success}
        </div>
      )}


      {/* NEW CONSULTATION */}

      {showForm && (
        <section className="consultations-card">

          <div className="consultations-card-header">

            <div>
              <h2>
                New Consultation
              </h2>

              <p>
                Enter patient complaints,
                vital signs, assessment,
                diagnosis, and treatment.
              </p>

              <p>
                Draft autosave is enabled
                for this signed-in user
                in this browser tab.
              </p>

              {draftNotice && (
                <div className="app-message app-message-success consultations-message">
                  {draftNotice}
                </div>
              )}
            </div>

          </div>


          <form
            className="consultations-form"
            onSubmit={
              handleSubmit
            }
          >

            {/* PATIENT */}

            <div className="consultations-form-section-title">
              Patient Information
            </div>


            <PatientSearchSelect
              value={
                formData.patient_id
              }
              onChange={
                (patientId) =>
                  handleChange({
                    target: {
                      name: "patient_id",
                      value:
                        patientId
                          ? String(
                              patientId
                            )
                          : "",
                    },
                  })
              }
              required
            />


            {/* COMPLAINT */}

            <div className="consultations-form-section-title">
              Complaint & Symptoms
            </div>


            <div className="consultations-field consultations-field-full">

              <label htmlFor="chief_complaint">
                Chief Complaint
              </label>

              <textarea
                id="chief_complaint"
                name="chief_complaint"
                value={
                  formData
                    .chief_complaint
                }
                onChange={
                  handleChange
                }
                placeholder="Describe the patient's main complaint"
                required
              />

            </div>


            <div className="consultations-field consultations-field-full">

              <label>
                Structured Symptoms
              </label>

              <p className="consultations-symptom-help">
                Select all symptoms reported
                or observed during this
                consultation. These fields
                support standardized records
                and future decision-support
                model development.
              </p>


              <div className="consultations-symptom-grid">

                {SYMPTOM_OPTIONS.map(
                  (
                    symptom
                  ) => (
                    <label
                      className="consultations-symptom-option"
                      key={
                        symptom.code
                      }
                    >

                      <input
                        type="checkbox"
                        checked={
                          formData
                            .symptom_codes
                            .includes(
                              symptom.code
                            )
                        }
                        onChange={() =>
                          handleSymptomToggle(
                            symptom.code
                          )
                        }
                      />

                      <span>
                        {symptom.label}
                      </span>

                    </label>
                  )
                )}

              </div>


              <div className="consultations-symptom-count">
                {
                  formData
                    .symptom_codes
                    .length
                }{" "}
                selected
              </div>

            </div>


            <div className="consultations-field consultations-field-full">

              <label htmlFor="symptoms">
                Other / Additional Symptoms
              </label>

              <textarea
                id="symptoms"
                name="symptoms"
                value={
                  formData.symptoms
                }
                onChange={
                  handleChange
                }
                placeholder="Enter symptoms not listed above or add clinical detail"
              />

            </div>


            {/* VITAL SIGNS */}

            <div className="consultations-form-section-title">
              Vital Signs
            </div>


            <ConsultationField
              label="Temperature (°C)"
              name="temperature"
              type="number"
              step="0.1"
              value={
                formData.temperature
              }
              onChange={
                handleChange
              }
              placeholder="e.g. 36.5"
            />


            <ConsultationField
              label="Heart Rate (bpm)"
              name="heart_rate"
              type="number"
              value={
                formData.heart_rate
              }
              onChange={
                handleChange
              }
              placeholder="e.g. 80"
            />


            <ConsultationField
              label="Systolic BP"
              name="systolic_bp"
              type="number"
              value={
                formData.systolic_bp
              }
              onChange={
                handleChange
              }
              placeholder="e.g. 120"
            />


            <ConsultationField
              label="Diastolic BP"
              name="diastolic_bp"
              type="number"
              value={
                formData.diastolic_bp
              }
              onChange={
                handleChange
              }
              placeholder="e.g. 80"
            />


            <ConsultationField
              label="Respiratory Rate"
              name="respiratory_rate"
              type="number"
              value={
                formData
                  .respiratory_rate
              }
              onChange={
                handleChange
              }
              placeholder="Breaths per minute"
            />


            <ConsultationField
              label="Oxygen Saturation (%)"
              name="oxygen_saturation"
              type="number"
              step="0.1"
              value={
                formData
                  .oxygen_saturation
              }
              onChange={
                handleChange
              }
              placeholder="e.g. 98"
            />


            <ConsultationField
              label="Weight (kg)"
              name="weight_kg"
              type="number"
              step="0.1"
              value={
                formData.weight_kg
              }
              onChange={
                handleChange
              }
              placeholder="e.g. 60"
            />


            <ConsultationField
              label="Height (cm)"
              name="height_cm"
              type="number"
              step="0.1"
              value={
                formData.height_cm
              }
              onChange={
                handleChange
              }
              placeholder="e.g. 165"
            />


            {/* ML DECISION SUPPORT */}

            {canPredictDisease && (

              <>

                <div className="consultations-form-section-title">
                  ML Decision Support
                </div>


                <div className="consultations-prediction-panel consultations-field-full">

                  <div className="consultations-prediction-heading">

                    <div>

                      <strong>
                        Development Disease Classification
                      </strong>

                      <p>
                        Uses patient age and sex,
                        selected structured symptoms,
                        and available vital signs.
                      </p>

                    </div>


                    <button
                      type="button"
                      className="app-button app-button-secondary"
                      onClick={
                        handleAnalyzePrediction
                      }
                      disabled={
                        predictionLoading ||
                        !formData.patient_id ||
                        formData
                          .symptom_codes
                          .length === 0
                      }
                    >
                      {predictionLoading
                        ? "Analyzing..."
                        : "Analyze with ML"}
                    </button>

                  </div>


                  <div className="consultations-prediction-notice">
                    Development decision-support
                    only. The result is not a
                    diagnosis and will not
                    automatically populate the
                    Diagnosis field or create a
                    disease case.
                  </div>


                  {predictionError && (

                    <div className="app-message app-message-error consultations-prediction-message">
                      {predictionError}
                    </div>

                  )}


                  {predictionResult && (

                    <div className="consultations-prediction-result">

                      <div className="consultations-prediction-summary">

                        <span>
                          Top Development Result
                        </span>

                        <strong>
                          {
                            predictionResult
                              .predicted_disease_name ||
                            DISEASE_DISPLAY_NAMES[
                              predictionResult
                                .predicted_disease_code
                            ] ||
                            predictionResult
                              .predicted_disease_code
                          }
                        </strong>

                        <small>
                          Development probability:{" "}
                          {(
                            Number(
                              predictionResult
                                .top_probability ||
                              0
                            )
                            * 100
                          ).toFixed(1)}
                          %
                        </small>

                      </div>


                      <div className="consultations-prediction-meta">

                        <span>
                          Model
                        </span>

                        <strong>
                          {
                            predictionResult
                              .selected_model
                          }
                        </strong>

                      </div>


                      <div className="consultations-prediction-probabilities">

                        {
                          predictionResult
                            .probabilities
                            ?.map(
                              (
                                item
                              ) => (

                                <div
                                  className="consultations-prediction-row"
                                  key={
                                    item
                                      .disease_code
                                  }
                                >

                                  <span>
                                    {
                                      item
                                        .disease_name ||
                                      DISEASE_DISPLAY_NAMES[
                                        item
                                          .disease_code
                                      ] ||
                                      item
                                        .disease_code
                                    }
                                  </span>

                                  <strong>
                                    {(
                                      Number(
                                        item
                                          .probability ||
                                        0
                                      )
                                      * 100
                                    ).toFixed(1)}
                                    %
                                  </strong>

                                </div>

                              )
                            )
                        }

                      </div>


                      {predictionResult
                        .input_warnings
                        ?.length > 0 && (

                        <div className="consultations-prediction-warnings">

                          <strong>
                            Input Notes
                          </strong>

                          <ul>

                            {
                              predictionResult
                                .input_warnings
                                .map(
                                  (
                                    warning
                                  ) => (

                                    <li
                                      key={
                                        warning
                                      }
                                    >
                                      {warning}
                                    </li>

                                  )
                                )
                            }

                          </ul>

                        </div>

                      )}


                      <div className="consultations-prediction-disclaimer">
                        {
                          predictionResult
                            .decision_support_notice
                        }
                      </div>

                    </div>

                  )}

                </div>

              </>

            )}


            {/* CLINICAL */}

            <div className="consultations-form-section-title">
              Clinical Information
            </div>


            <div className="consultations-field consultations-field-full">

              <label htmlFor="assessment">
                Assessment
              </label>

              <textarea
                id="assessment"
                name="assessment"
                value={
                  formData.assessment
                }
                onChange={
                  handleChange
                }
                placeholder="Clinical assessment and observations"
              />

            </div>


            {canCreateDiagnosis && (

              <div className="consultations-field consultations-field-full">

                <label htmlFor="disease_id">
                  Structured Disease / Surveillance Classification
                </label>

                <select
                  id="disease_id"
                  name="disease_id"
                  value={
                    formData.disease_id
                  }
                  onChange={
                    handleChange
                  }
                  disabled={
                    loadingDiseases
                  }
                >

                  <option value="">
                    {loadingDiseases
                      ? "Loading diseases..."
                      : "No structured disease selected"}
                  </option>

                  {diseases.map(
                    (disease) => (

                      <option
                        key={
                          disease.id
                        }
                        value={
                          disease.id
                        }
                      >
                        {disease.code}
                        {" — "}
                        {disease.name}
                      </option>

                    )
                  )}

                </select>

                <p className="consultations-symptom-help">
                  Optional. Selecting a structured disease
                  automatically creates a SUSPECTED,
                  PENDING surveillance case linked to this
                  consultation. It will not be counted as
                  validated surveillance data or mapping
                  until an authorized reviewer validates it.
                </p>

                {diseaseLoadError && (

                  <div className="app-message app-message-error consultations-message">
                    {diseaseLoadError}
                  </div>

                )}

              </div>

            )}


            <div className="consultations-field consultations-field-full">

              <label htmlFor="diagnosis">
                Diagnosis
              </label>

              <input
                id="diagnosis"
                name="diagnosis"
                value={
                  formData.diagnosis
                }
                onChange={
                  handleChange
                }
                placeholder="Enter diagnosis"
              />

            </div>


            <div className="consultations-field consultations-field-full">

              <label htmlFor="treatment_plan">
                Treatment Plan
              </label>

              <textarea
                id="treatment_plan"
                name="treatment_plan"
                value={
                  formData
                    .treatment_plan
                }
                onChange={
                  handleChange
                }
                placeholder="Enter treatment plan and recommendations"
              />

            </div>


            <div className="consultations-field consultations-field-full">

              <label htmlFor="notes">
                Notes
              </label>

              <textarea
                id="notes"
                name="notes"
                value={
                  formData.notes
                }
                onChange={
                  handleChange
                }
                placeholder="Additional consultation notes"
              />

            </div>


            {/* ACTIONS */}

            <div className="consultations-form-actions">

              <button
                type="submit"
                className="app-button app-button-primary"
                disabled={
                  saving
                }
              >
                {saving
                  ? "Saving..."
                  : "Save Consultation"}
              </button>


              <button
                type="button"
                className="app-button app-button-secondary"
                onClick={
                  discardConsultationDraft
                }
                disabled={saving}
              >
                Cancel
              </button>

            </div>

          </form>

        </section>
      )}


      {/* PATIENT RECORDS */}

      <section className="consultations-card">

        <div className="consultations-card-header">

          <div>
            <h2>
              Patient Records
            </h2>

            <p>
              Select a patient to view
              previous consultations and
              medical records.
            </p>
          </div>


          <span className="consultations-count">
            {
              patientRecordsPagination
                .total
            }{" "}
            {
              patientRecordsPagination
                .total === 1
                ? "patient"
                : "patients"
            }
          </span>

        </div>


        {loadingPatientRecords ? (

          <div className="consultations-empty">
            Loading patients...
          </div>

        ) : patientRecordsPagination
            .total === 0 ? (

          <div className="consultations-empty">
            No patients found.
          </div>

        ) : (

          <div className="consultations-table-wrap">

            <table className="consultations-table">

              <thead>
                <tr>
                  <th>
                    Patient Code
                  </th>

                  <th>
                    Patient Name
                  </th>

                  <th>
                    Sex
                  </th>

                  <th>
                    Contact
                  </th>

                  <th>
                    Status
                  </th>

                  <th>
                    Action
                  </th>
                </tr>
              </thead>


              <tbody>

                {patientRecords.map(
                  (patient) => (

                    <tr
                      key={
                        patient.id
                      }
                    >

                      <td>
                        <span className="consultations-code">
                          {
                            patient
                              .patient_code
                          }
                        </span>
                      </td>


                      <td>
                        <strong>
                          {
                            patient
                              .last_name
                          }
                          ,{" "}
                          {
                            patient
                              .first_name
                          }{" "}
                          {
                            patient
                              .middle_name ||
                            ""
                          }
                        </strong>
                      </td>


                      <td>
                        {
                          patient.sex
                        }
                      </td>


                      <td>
                        {
                          patient
                            .contact_number ||
                          "-"
                        }
                      </td>


                      <td>
                        <span
                          className={
                            patient
                              .record_status ===
                            "ACTIVE"
                              ? "consultations-status consultations-status-active"
                              : "consultations-status consultations-status-inactive"
                          }
                        >
                          {
                            patient
                              .record_status
                          }
                        </span>
                      </td>


                      <td>
                        <Link
                          className="app-action-link"
                          to={`/patients/${patient.id}`}
                        >
                          View Record
                        </Link>
                      </td>

                    </tr>
                  )
                )}

              </tbody>

            </table>

          </div>
        )}


        {!loadingPatientRecords &&
          patientRecordsPagination
            .total > 0 && (

          <nav
            className="consultations-pagination"
            aria-label="Consultation patient records pagination"
          >

            <div className="consultations-pagination-summary">
              Showing{" "}
              <strong>
                {
                  (
                    (
                      patientRecordsPage -
                      1
                    ) *
                    patientRecordsPagination
                      .page_size
                  ) + 1
                }
                {"–"}
                {
                  Math.min(
                    patientRecordsPage *
                      patientRecordsPagination
                        .page_size,
                    patientRecordsPagination
                      .total
                  )
                }
              </strong>
              {" "}of{" "}
              <strong>
                {
                  patientRecordsPagination
                    .total
                }
              </strong>
              {" "}patients
            </div>


            <div className="consultations-pagination-controls">

              <button
                type="button"
                className="consultations-pagination-nav"
                disabled={
                  patientRecordsPage <= 1 ||
                  loadingPatientRecords
                }
                onClick={() =>
                  goToPatientRecordsPage(
                    patientRecordsPage - 1
                  )
                }
                aria-label="Go to previous patient records page"
              >
                <span aria-hidden="true">
                  ‹
                </span>
                Back
              </button>


              <div
                className="consultations-pagination-pages"
                aria-label="Patient record page numbers"
              >

                {
                  getVisiblePatientRecordPages()
                    .map(
                      (
                        item,
                        index
                      ) => {

                        if (
                          item === "..."
                        ) {
                          return (
                            <span
                              key={
                                `ellipsis-${index}`
                              }
                              className="consultations-pagination-ellipsis"
                              aria-hidden="true"
                            >
                              …
                            </span>
                          );
                        }


                        const isCurrent =
                          item ===
                          patientRecordsPage;

                        return (
                          <button
                            key={item}
                            type="button"
                            className={
                              `consultations-pagination-page${
                                isCurrent
                                  ? " consultations-pagination-page-active"
                                  : ""
                              }`
                            }
                            onClick={() =>
                              goToPatientRecordsPage(
                                item
                              )
                            }
                            aria-label={
                              isCurrent
                                ? `Current page, page ${item}`
                                : `Go to page ${item}`
                            }
                            aria-current={
                              isCurrent
                                ? "page"
                                : undefined
                            }
                          >
                            {item}
                          </button>
                        );
                      }
                    )
                }

              </div>


              <button
                type="button"
                className="consultations-pagination-nav"
                disabled={
                  patientRecordsPage >=
                    patientRecordsPagination
                      .total_pages ||
                  loadingPatientRecords
                }
                onClick={() =>
                  goToPatientRecordsPage(
                    patientRecordsPage + 1
                  )
                }
                aria-label="Go to next patient records page"
              >
                Next
                <span aria-hidden="true">
                  ›
                </span>
              </button>

            </div>

          </nav>

        )}

      </section>

    </div>
  );
}


/* =========================================================
   REUSABLE INPUT FIELD
========================================================= */

function ConsultationField({
  label,
  name,
  value,
  onChange,
  type = "text",
  placeholder = "",
  step,
}) {
  return (
    <div className="consultations-field">

      <label htmlFor={name}>
        {label}
      </label>

      <input
        id={name}
        name={name}
        type={type}
        step={step}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />

    </div>
  );
}


export default Consultations;
