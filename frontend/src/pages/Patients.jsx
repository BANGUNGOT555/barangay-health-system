import {
  useCallback,
  useEffect,
  useState,
} from "react";

import { Link } from "react-router-dom";

import {
  useSystemSettings,
} from "../context/SystemSettingsContext";

import {
  createPatient,
  getPaginatedPatients,
} from "../api/patientApi";

import {
  PATIENT_PHONE_LENGTH,
  sanitizePatientFormField,
  validatePatientContactFields,
} from "../utils/patientValidation";

import "../styles/Patients.css";
import "../styles/PatientsPagination.css";


/* =========================================================
   LOCATION
========================================================= */

const BARANGAY_NAME = "Krus na Ligas";
const CITY_NAME = "Quezon City";



/* =========================================================
   KRUS NA LIGAS STREETS
========================================================= */

const KRUS_NA_LIGAS_STREETS = [
  "Angeles St.",
  "Baluyot St.",
  "C.P. Garcia",
  "E. Ramos St.",
  "Eugenio St.",
  "Fernando St.",
  "Flores St.",
  "Gonzales St.",
  "Kabalitang St.",
  "M. Dela Cruz St.",
  "Manansala St.",
  "P. Francisco St.",
  "Panginiban St.",
  "Salvador St.",
  "Santos St.",
  "T. Fulgencio St.",
  "Tiburcio St.",
  "Tiburcio Ext.",
  "V. Francisco St.",
];


/* =========================================================
   OPTIONS
========================================================= */

const SEX_OPTIONS = [
  {
    value: "Male",
    label: "Male",
  },
  {
    value: "Female",
    label: "Female",
  },
];


const CIVIL_STATUS_OPTIONS = [
  {
    value: "Single",
    label: "Single",
  },
  {
    value: "Married",
    label: "Married",
  },
  {
    value: "Widowed",
    label: "Widowed",
  },
  {
    value: "Separated",
    label: "Separated",
  },
];


const PWD_OPTIONS = [
  {
    value: "NO",
    label: "No",
  },
  {
    value: "YES",
    label: "Yes",
  },
];


const SUFFIX_OPTIONS = [
  {
    value: "Jr.",
    label: "Jr.",
  },
  {
    value: "Sr.",
    label: "Sr.",
  },
  {
    value: "II",
    label: "II",
  },
  {
    value: "III",
    label: "III",
  },
  {
    value: "IV",
    label: "IV",
  },
  {
    value: "V",
    label: "V",
  },
];


const CATEGORY_OPTIONS = [
  {
    value: "PWD",
    label: "PWD",
  },
  {
    value: "SENIOR",
    label: "Senior",
  },
  {
    value: "TODDLER",
    label: "Toddler",
  },
  {
    value: "MINOR",
    label: "Minor",
  },
  {
    value: "ADULT",
    label: "Adult",
  },
];


/* =========================================================
   DEFAULT NEW PATIENT FORM
========================================================= */

const EMPTY_PATIENT_FORM = {
  first_name: "",
  middle_name: "",
  last_name: "",
  suffix: "",

  date_of_birth: "",
  sex: "",
  civil_status: "",
  is_pwd: "NO",

  street: "",
  address: "",

  contact_number: "",
  emergency_contact_name: "",
  emergency_contact_number: "",
};


/* =========================================================
   DEFAULT FILTERS
========================================================= */

const EMPTY_FILTERS = {
  category: "",
  gender: "",
  search: "",
};


/* =========================================================
   HELPERS
========================================================= */

function optionalText(value) {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.trim();

  return cleaned || null;
}


function getApiErrorMessage(
  error,
  fallback
) {
  const detail =
    error?.response?.data?.detail;

  if (Array.isArray(detail)) {
    return detail
      .map(
        (item) =>
          item?.msg ||
          "Invalid information."
      )
      .join(", ");
  }

  if (typeof detail === "string") {
    return detail;
  }

  return fallback;
}


/* =========================================================
   AGE CALCULATION
========================================================= */

function calculateAge(dateOfBirth) {
  if (!dateOfBirth) {
    return null;
  }

  const parts = String(
    dateOfBirth
  )
    .split("-")
    .map(Number);

  if (parts.length !== 3) {
    return null;
  }

  const [
    birthYear,
    birthMonth,
    birthDay,
  ] = parts;

  if (
    !birthYear ||
    !birthMonth ||
    !birthDay
  ) {
    return null;
  }

  const today = new Date();

  let age =
    today.getFullYear() -
    birthYear;

  const currentMonth =
    today.getMonth() + 1;

  const currentDay =
    today.getDate();

  if (
    currentMonth < birthMonth ||
    (
      currentMonth === birthMonth &&
      currentDay < birthDay
    )
  ) {
    age -= 1;
  }

  return age >= 0
    ? age
    : null;
}


/* =========================================================
   PATIENTS PAGE
========================================================= */

function Patients() {
  const {
    defaultPageSize,
  } = useSystemSettings();

  /* =======================================================
     PATIENT DATA
  ======================================================= */

  const [
    patients,
    setPatients,
  ] = useState([]);


  const [
    page,
    setPage,
  ] = useState(1);


  const [
    pagination,
    setPagination,
  ] = useState({
    total: 0,
    total_pages: 1,
    page_size: defaultPageSize,
  });


  /* =======================================================
     NEW PATIENT FORM
  ======================================================= */

  const [
    formData,
    setFormData,
  ] = useState({
    ...EMPTY_PATIENT_FORM,
  });


  /* =======================================================
     FILTER FORM
  ======================================================= */

  const [
    filterForm,
    setFilterForm,
  ] = useState({
    ...EMPTY_FILTERS,
  });


  /* =======================================================
     APPLIED FILTERS
  ======================================================= */

  const [
    appliedFilters,
    setAppliedFilters,
  ] = useState({
    ...EMPTY_FILTERS,
  });


  /* =======================================================
     UI STATE
  ======================================================= */

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    showForm,
    setShowForm,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState("");


  /* =======================================================
     MESSAGE HELPERS
  ======================================================= */

  const clearMessages = () => {
    setError("");
    setSuccess("");
  };


  /* =======================================================
     PATIENT FORM HELPERS
  ======================================================= */

  const resetForm = () => {
    setFormData({
      ...EMPTY_PATIENT_FORM,
    });
  };


  const openPatientForm = () => {
    clearMessages();
    resetForm();

    setShowForm(true);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };


  const closePatientForm = () => {
    clearMessages();
    resetForm();

    setShowForm(false);
  };


  const handleChange = (
    event
  ) => {
    const {
      name,
      value,
    } = event.target;

    const cleanedValue =
      sanitizePatientFormField(
        name,
        value
      );

    setFormData(
      (current) => ({
        ...current,
        [name]: cleanedValue,
      })
    );

    if (error) {
      setError("");
    }
  };


  /* =======================================================
     LOAD PATIENTS
  ======================================================= */

  const loadPatients =
    useCallback(async () => {
      try {
        setLoading(true);
        setError("");

        const data =
          await getPaginatedPatients({
            page,
            page_size:
              defaultPageSize,

            category:
              appliedFilters.category ||
              undefined,

            gender:
              appliedFilters.gender ||
              undefined,

            search:
              appliedFilters.search ||
              undefined,
          });

        setPatients(
          Array.isArray(
            data?.items
          )
            ? data.items
            : []
        );

        setPagination({
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
            ) || defaultPageSize,
        });

      } catch (err) {
        console.error(
          "Unable to load patients:",
          err
        );

        setError(
          getApiErrorMessage(
            err,
            "Unable to load patient records."
          )
        );

      } finally {
        setLoading(false);
      }
    }, [
      page,
      appliedFilters,
      defaultPageSize,
    ]);


  useEffect(() => {
    loadPatients();
  }, [
    loadPatients,
  ]);


  useEffect(() => {
    setPage(1);
  }, [
    defaultPageSize,
  ]);


  /* =======================================================
     REGISTER PATIENT
  ======================================================= */

  const handleSubmit =
    async (event) => {
      event.preventDefault();

      clearMessages();


      /* -----------------------------------------------
         VALIDATE DATE OF BIRTH
      ------------------------------------------------ */

      if (
        formData.date_of_birth
      ) {
        const birthDate =
          new Date(
            `${formData.date_of_birth}T00:00:00`
          );

        if (
          birthDate >
          new Date()
        ) {
          setError(
            "Date of birth cannot be in the future."
          );

          return;
        }
      }


      /* -----------------------------------------------
         VALIDATE CONTACT INFORMATION
      ------------------------------------------------ */

      const contactValidationError =
        validatePatientContactFields(
          formData
        );

      if (contactValidationError) {
        setError(
          contactValidationError
        );

        return;
      }


      /* -----------------------------------------------
         CREATE PAYLOAD
      ------------------------------------------------ */

      const payload = {
        first_name:
          formData
            .first_name
            .trim(),

        middle_name:
          optionalText(
            formData.middle_name
          ),

        last_name:
          formData
            .last_name
            .trim(),

        suffix:
          optionalText(
            formData.suffix
          ),

        date_of_birth:
          formData.date_of_birth,

        sex:
          formData.sex,

        civil_status:
          optionalText(
            formData.civil_status
          ),

        is_pwd:
          formData.is_pwd === "YES",

        street:
          formData
            .street
            .trim(),

        barangay:
          BARANGAY_NAME,

        city:
          CITY_NAME,

        address:
          formData
            .address
            .trim(),

        contact_number:
          optionalText(
            formData.contact_number
          ),

        emergency_contact_name:
          optionalText(
            formData
              .emergency_contact_name
          ),

        emergency_contact_number:
          optionalText(
            formData
              .emergency_contact_number
          ),
      };


      try {
        setSaving(true);

        await createPatient(
          payload
        );

        resetForm();

        setShowForm(false);

        if (page === 1) {
          await loadPatients();
        } else {
          setPage(1);
        }

        setSuccess(
          "Patient registered successfully."
        );

      } catch (err) {
        console.error(
          "Unable to register patient:",
          err
        );

        setError(
          getApiErrorMessage(
            err,
            "Unable to register patient."
          )
        );

      } finally {
        setSaving(false);
      }
    };


  /* =======================================================
     FILTER FORM HANDLER
  ======================================================= */

  const handleFilterChange = (
    event
  ) => {
    const {
      name,
      value,
    } = event.target;

    setFilterForm(
      (current) => ({
        ...current,
        [name]: value,
      })
    );
  };


  /* =======================================================
     APPLY FILTERS
  ======================================================= */

  const applyFilters = (
    event
  ) => {
    event.preventDefault();

    setPage(1);

    setAppliedFilters({
      category:
        filterForm.category,

      gender:
        filterForm.gender,

      search:
        filterForm
          .search
          .trim(),
    });
  };


  /* =======================================================
     CLEAR FILTERS
  ======================================================= */

  const clearFilters = () => {
    setPage(1);

    setFilterForm({
      ...EMPTY_FILTERS,
    });

    setAppliedFilters({
      ...EMPTY_FILTERS,
    });
  };


  /* =======================================================
     SERVER-SIDE RESULT SET
  ======================================================= */

  const displayedPatients =
    patients;


  /* =======================================================
     FILTER STATUS
  ======================================================= */

  const filtersActive =
    Boolean(
      appliedFilters.category ||
      appliedFilters.gender ||
      appliedFilters.search
    );


  /* =======================================================
     PAGINATION HELPERS
  ======================================================= */

  const getVisiblePages = () => {
    const totalPages =
      Math.max(
        pagination.total_pages || 1,
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

    /*
     * Examples:
     *
     * Page 1:
     * 1 2 3 ... 61
     *
     * Middle:
     * 1 ... 29 30 31 ... 61
     *
     * Near end:
     * 1 ... 59 60 61
     */

    if (page <= 3) {
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
      page >=
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
      page - 1,
      page,
      page + 1,
      "...",
      totalPages,
    ];
  };


  const goToPage = (
    requestedPage
  ) => {
    const totalPages =
      Math.max(
        pagination.total_pages || 1,
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
      safePage === page ||
      loading
    ) {
      return;
    }

    setPage(
      safePage
    );
  };


  /* =======================================================
     PAGE
  ======================================================= */

  return (
    <div className="patients-page">

      {/* ===================================================
          PAGE HEADER
      ==================================================== */}

      <header className="patients-header">

        <div>

          <h1>
            Patients
          </h1>

          <p>
            Manage registered patients
            and health records.
          </p>

        </div>


        {!showForm && (

          <button
            type="button"
            className="patients-primary-button"
            onClick={
              openPatientForm
            }
          >
            + New Patient
          </button>

        )}

      </header>


      {/* ===================================================
          MESSAGES
      ==================================================== */}

      {error && (

        <div
          className="patients-message patients-error"
          role="alert"
        >
          {error}
        </div>

      )}


      {success && (

        <div
          className="patients-message patients-success"
          role="status"
        >
          {success}
        </div>

      )}


      {/* ===================================================
          NEW PATIENT FORM
      ==================================================== */}

      {showForm && (

        <section className="patients-card">

          <div className="patients-section-header">

            <div>

              <h2>
                Register New Patient
              </h2>

              <p>
                Enter the patient's
                personal, address, and
                contact information.
              </p>

            </div>


            <button
              type="button"
              className="patients-secondary-button"
              onClick={
                closePatientForm
              }
              disabled={
                saving
              }
            >
              Cancel
            </button>

          </div>


          <form
            className="patients-form"
            onSubmit={
              handleSubmit
            }
          >

            <div className="patients-form-grid">

              {/* ===========================================
                  PERSONAL INFORMATION
              ============================================ */}

              <div className="patients-form-section-title">
                Personal Information
              </div>


              <PatientField
                label="Last Name"
                name="last_name"
                value={
                  formData.last_name
                }
                onChange={
                  handleChange
                }
                required
              />


              <PatientField
                label="First Name"
                name="first_name"
                value={
                  formData.first_name
                }
                onChange={
                  handleChange
                }
                required
              />


              <PatientField
                label="Middle Name"
                name="middle_name"
                value={
                  formData.middle_name
                }
                onChange={
                  handleChange
                }
              />


              <PatientSelect
                label="Suffix"
                name="suffix"
                value={
                  formData.suffix
                }
                onChange={
                  handleChange
                }
                options={
                  SUFFIX_OPTIONS
                }
                placeholder="No suffix"
              />


              <PatientField
                label="Date of Birth"
                name="date_of_birth"
                type="date"
                value={
                  formData
                    .date_of_birth
                }
                onChange={
                  handleChange
                }
                required
              />


              <PatientSelect
                label="Sex"
                name="sex"
                value={
                  formData.sex
                }
                onChange={
                  handleChange
                }
                options={
                  SEX_OPTIONS
                }
                placeholder="Select sex"
                required
              />


              <PatientSelect
                label="Civil Status"
                name="civil_status"
                value={
                  formData
                    .civil_status
                }
                onChange={
                  handleChange
                }
                options={
                  CIVIL_STATUS_OPTIONS
                }
                placeholder="Select civil status"
              />


              <PatientSelect
                label="PWD Status"
                name="is_pwd"
                value={
                  formData.is_pwd
                }
                onChange={
                  handleChange
                }
                options={
                  PWD_OPTIONS
                }
                placeholder="Select PWD status"
                required
              />


              {/* ===========================================
                  ADDRESS INFORMATION
              ============================================ */}

              <div className="patients-form-section-title">
                Address Information
              </div>


              <PatientSelect
                label="Street"
                name="street"
                value={
                  formData.street
                }
                onChange={
                  handleChange
                }
                options={
                  KRUS_NA_LIGAS_STREETS.map(
                    (street) => ({
                      value: street,
                      label: street,
                    })
                  )
                }
                placeholder="Select street"
                required
              />


              <ReadOnlyField
                label="Barangay"
                value={
                  BARANGAY_NAME
                }
              />


              <ReadOnlyField
                label="City"
                value={
                  CITY_NAME
                }
              />


              <div className="patients-field patients-field-full">

                <label htmlFor="address">
                  Complete Address
                </label>

                <textarea
                  id="address"
                  name="address"
                  value={
                    formData.address
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="House number, landmark, or other address details"
                  required
                />

              </div>


              {/* ===========================================
                  CONTACT INFORMATION
              ============================================ */}

              <div className="patients-form-section-title">
                Contact Information
              </div>


              <PatientField
                label="Contact Number"
                name="contact_number"
                type="tel"
                value={
                  formData
                    .contact_number
                }
                onChange={
                  handleChange
                }
                placeholder="09XXXXXXXXX"
                inputMode="numeric"
                maxLength={
                  PATIENT_PHONE_LENGTH
                }
                pattern="[0-9]{11}"
                title="Enter exactly 11 digits."
              />


              <PatientField
                label="Emergency Contact Name"
                name="emergency_contact_name"
                value={
                  formData
                    .emergency_contact_name
                }
                onChange={
                  handleChange
                }
                placeholder="e.g. Juan Dela Cruz"
                title="Letters only. Spaces, hyphens, and apostrophes are allowed."
              />


              <PatientField
                label="Emergency Contact Number"
                name="emergency_contact_number"
                type="tel"
                value={
                  formData
                    .emergency_contact_number
                }
                onChange={
                  handleChange
                }
                placeholder="09XXXXXXXXX"
                inputMode="numeric"
                maxLength={
                  PATIENT_PHONE_LENGTH
                }
                pattern="[0-9]{11}"
                title="Enter exactly 11 digits."
              />

            </div>


            <div className="patients-form-actions">

              <button
                type="button"
                className="patients-secondary-button"
                onClick={
                  closePatientForm
                }
                disabled={
                  saving
                }
              >
                Cancel
              </button>


              <button
                type="submit"
                className="patients-primary-button"
                disabled={
                  saving
                }
              >
                {saving
                  ? "Registering..."
                  : "Register Patient"}
              </button>

            </div>

          </form>

        </section>

      )}


      {/* ===================================================
          PATIENT RECORDS
      ==================================================== */}

      <section
        id="patient-records"
        className="patients-card"
      >

        <div className="patients-section-header">

          <div>

            <h2>
              Patient Records
            </h2>

            <p>
              Registered patient profiles.
            </p>

          </div>


          <span className="patients-count">

            {pagination.total}{" "}

            {pagination.total === 1
              ? "record"
              : "records"}

            {pagination.total > 0 && (
              <>
                {" · "}Page {page} of{" "}
                {pagination.total_pages}
              </>
            )}

          </span>

        </div>


        {/* =================================================
            FILTER BAR
        ================================================== */}

        <form
          className="patients-filter-bar"
          onSubmit={
            applyFilters
          }
        >

          {/* CATEGORY */}

          <FilterSelect
            label="Category"
            name="category"
            value={
              filterForm.category
            }
            onChange={
              handleFilterChange
            }
            options={
              CATEGORY_OPTIONS
            }
            placeholder="All Categories"
          />


          {/* GENDER */}

          <FilterSelect
            label="Gender"
            name="gender"
            value={
              filterForm.gender
            }
            onChange={
              handleFilterChange
            }
            options={
              SEX_OPTIONS
            }
            placeholder="All"
          />


          {/* SEARCH */}

          <div className="patients-filter-field patients-filter-search">

            <label htmlFor="patient-search">
              Search
            </label>

            <input
              id="patient-search"
              name="search"
              type="search"
              value={
                filterForm.search
              }
              onChange={
                handleFilterChange
              }
              placeholder="Patient code, first name, last name, street, sex, civil status..."
              autoComplete="off"
            />

          </div>


          {/* ACTION BUTTONS */}

          <div className="patients-filter-actions">

            <button
              type="submit"
              className="patients-filter-apply"
            >
              Apply
            </button>


            <button
              type="button"
              className="patients-filter-clear"
              onClick={
                clearFilters
              }
            >
              Clear
            </button>

          </div>

        </form>


        {/* =================================================
            TABLE STATES
        ================================================== */}

        {loading ? (

          <div className="patients-empty">
            Loading patients...
          </div>

        ) : pagination.total === 0 &&
          !filtersActive ? (

          <div className="patients-empty">

            <strong>
              No patient records found.
            </strong>

            <span>
              Register a patient to
              create the first record.
            </span>

          </div>

        ) : pagination.total === 0 ? (

          <div className="patients-empty">

            <strong>
              No matching patient found.
            </strong>

            <span>
              Check the search information
              or change the selected filters.
            </span>


            <button
              type="button"
              className="patients-filter-clear patients-empty-clear"
              onClick={
                clearFilters
              }
            >
              Clear Filters
            </button>

          </div>

        ) : (

          <div className="patients-table-wrap">

            <table className="patients-table">

              <thead>

                <tr>
                  <th>
                    Patient Code
                  </th>

                  <th>
                    Last Name
                  </th>

                  <th>
                    First Name
                  </th>

                  <th>
                    Middle Name
                  </th>

                  <th>
                    Suffix
                  </th>

                  <th>
                    Age
                  </th>

                  <th>
                    Date of Birth
                  </th>

                  <th>
                    Sex
                  </th>

                  <th>
                    Civil Status
                  </th>

                  <th>
                    Street
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

                {displayedPatients.map(
                  (patient) => {
                    const age =
                      calculateAge(
                        patient
                          .date_of_birth
                      );

                    const isActive =
                      patient
                        .record_status ===
                      "ACTIVE";


                    return (

                      <tr
                        key={
                          patient.id
                        }
                      >

                        <td>

                          <span className="patients-code">
                            {patient.patient_code}
                          </span>

                        </td>


                        <td>

                          <strong className="patients-last-name">
                            {patient.last_name ||
                              "-"}
                          </strong>

                        </td>


                        <td>
                          {patient.first_name ||
                            "-"}
                        </td>


                        <td>
                          {patient.middle_name ||
                            "-"}
                        </td>


                        <td>
                          {patient.suffix ||
                            "-"}
                        </td>


                        <td>
                          {age != null
                            ? age
                            : "-"}
                        </td>


                        <td>
                          {patient.date_of_birth ||
                            "-"}
                        </td>


                        <td>
                          {patient.sex ||
                            "-"}
                        </td>


                        <td>
                          {patient.civil_status ||
                            "-"}
                        </td>


                        <td>
                          {patient.street ||
                            "-"}
                        </td>


                        <td>
                          {patient.contact_number ||
                            "-"}
                        </td>


                        <td>

                          <span
                            className={
                              isActive
                                ? "patients-status patients-status-active"
                                : "patients-status patients-status-inactive"
                            }
                          >
                            {patient.record_status ||
                              "-"}
                          </span>

                        </td>


                        <td>

                          <Link
                            className="patients-action-link"
                            to={
                              `/patients/${patient.id}`
                            }
                          >
                            View Record
                          </Link>

                        </td>

                      </tr>

                    );
                  }
                )}

              </tbody>

            </table>

          </div>

        )}


        {!loading &&
          pagination.total > 0 && (

          <nav
            className="patients-pagination"
            aria-label="Patient records pagination"
          >

            <div className="patients-pagination-summary">
              Showing{" "}
              <strong>
                {
                  (
                    (page - 1) *
                    pagination.page_size
                  ) + 1
                }
                {"–"}
                {
                  Math.min(
                    page *
                      pagination.page_size,
                    pagination.total
                  )
                }
              </strong>
              {" "}of{" "}
              <strong>
                {pagination.total}
              </strong>
              {" "}records
            </div>


            <div className="patients-pagination-controls">

              <button
                type="button"
                className="patients-pagination-nav"
                disabled={
                  page <= 1 ||
                  loading
                }
                onClick={() =>
                  goToPage(
                    page - 1
                  )
                }
                aria-label="Go to previous page"
              >
                <span aria-hidden="true">
                  ‹
                </span>
                Back
              </button>


              <div
                className="patients-pagination-pages"
                aria-label="Page numbers"
              >

                {getVisiblePages().map(
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
                          className="patients-pagination-ellipsis"
                          aria-hidden="true"
                        >
                          …
                        </span>
                      );
                    }


                    const isCurrent =
                      item === page;

                    return (
                      <button
                        key={item}
                        type="button"
                        className={
                          `patients-pagination-page${
                            isCurrent
                              ? " patients-pagination-page-active"
                              : ""
                          }`
                        }
                        onClick={() =>
                          goToPage(
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
                )}

              </div>


              <button
                type="button"
                className="patients-pagination-nav"
                disabled={
                  page >=
                    pagination.total_pages ||
                  loading
                }
                onClick={() =>
                  goToPage(
                    page + 1
                  )
                }
                aria-label="Go to next page"
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
   TEXT FIELD
========================================================= */

function PatientField({
  label,
  name,
  value,
  onChange,
  type = "text",
  placeholder = "",
  required = false,
  inputMode,
  maxLength,
  pattern,
  title,
}) {
  return (
    <div className="patients-field">

      <label htmlFor={name}>
        {label}
      </label>

      <input
        id={name}
        name={name}
        type={type}
        value={
          value ?? ""
        }
        onChange={
          onChange
        }
        placeholder={
          placeholder
        }
        required={
          required
        }
        inputMode={
          inputMode
        }
        maxLength={
          maxLength
        }
        pattern={
          pattern
        }
        title={
          title
        }
      />

    </div>
  );
}


/* =========================================================
   SELECT FIELD
========================================================= */

function PatientSelect({
  label,
  name,
  value,
  onChange,
  options,
  placeholder,
  required = false,
}) {
  return (
    <div className="patients-field">

      <label htmlFor={name}>
        {label}
      </label>

      <select
        id={name}
        name={name}
        value={
          value ?? ""
        }
        onChange={
          onChange
        }
        required={
          required
        }
      >

        <option value="">
          {placeholder}
        </option>


        {options.map(
          (option) => (

            <option
              key={
                option.value
              }
              value={
                option.value
              }
            >
              {option.label}
            </option>

          )
        )}

      </select>

    </div>
  );
}


/* =========================================================
   READ-ONLY FIELD
========================================================= */

function ReadOnlyField({
  label,
  value,
}) {
  return (
    <div className="patients-field">

      <label>
        {label}
      </label>

      <input
        type="text"
        value={
          value
        }
        readOnly
      />

    </div>
  );
}


/* =========================================================
   FILTER SELECT
========================================================= */

function FilterSelect({
  label,
  name,
  value,
  onChange,
  options,
  placeholder,
}) {
  return (
    <div className="patients-filter-field">

      <label htmlFor={`filter-${name}`}>
        {label}
      </label>

      <select
        id={`filter-${name}`}
        name={name}
        value={
          value
        }
        onChange={
          onChange
        }
      >

        <option value="">
          {placeholder}
        </option>


        {options.map(
          (option) => (

            <option
              key={
                option.value
              }
              value={
                option.value
              }
            >
              {option.label}
            </option>

          )
        )}

      </select>

    </div>
  );
}


export default Patients;
