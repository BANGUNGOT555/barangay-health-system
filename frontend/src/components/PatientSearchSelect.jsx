import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  getPaginatedPatients,
  getPatient,
} from "../api/patientApi";

import "../styles/PatientSearchSelect.css";


const SEARCH_PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;
const MIN_SEARCH_CHARACTERS = 2;


function formatPatientLabel(
  patient
) {
  if (!patient) {
    return "";
  }

  const nameParts = [
    patient.last_name,
    patient.first_name,
    patient.middle_name,
    patient.suffix,
  ]
    .filter(Boolean)
    .join(" ");

  return [
    patient.patient_code,
    nameParts,
  ]
    .filter(Boolean)
    .join(" — ");
}


function PatientSearchSelect({
  value,
  onChange,
  required = false,
}) {
  const containerRef =
    useRef(null);

  const [
    query,
    setQuery,
  ] = useState("");

  const [
    results,
    setResults,
  ] = useState([]);

  const [
    selectedPatient,
    setSelectedPatient,
  ] = useState(null);

  const [
    open,
    setOpen,
  ] = useState(false);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");


  // =====================================================
  // LOAD SELECTED PATIENT
  // Supports restored consultation drafts.
  // =====================================================

  useEffect(() => {
    let active = true;

    const patientId =
      Number(value);

    if (!patientId) {
      setSelectedPatient(
        null
      );

      return () => {
        active = false;
      };
    }


    if (
      selectedPatient?.id ===
      patientId
    ) {
      return () => {
        active = false;
      };
    }


    const loadSelectedPatient =
      async () => {
        try {
          const patient =
            await getPatient(
              patientId
            );

          if (!active) {
            return;
          }

          setSelectedPatient(
            patient
          );

          setQuery("");

        } catch (err) {
          if (!active) {
            return;
          }

          console.error(
            "Unable to load selected patient:",
            err
          );

          setSelectedPatient(
            null
          );
        }
      };


    loadSelectedPatient();

    return () => {
      active = false;
    };
  }, [
    value,
    selectedPatient?.id,
  ]);


  // =====================================================
  // SERVER-SIDE SEARCH
  // =====================================================

  useEffect(() => {
    if (
      selectedPatient
    ) {
      return undefined;
    }

    if (!open) {
      return undefined;
    }

    const cleanedQuery =
      query.trim();

    /*
     * Do not query the API until the user has entered
     * at least two characters. This avoids loading a
     * default patient list and reduces unnecessary
     * requests on large patient datasets.
     */
    if (
      cleanedQuery.length <
      MIN_SEARCH_CHARACTERS
    ) {
      setResults([]);
      setLoading(false);
      setError("");

      return undefined;
    }

    let active = true;

    const timer =
      window.setTimeout(
        async () => {
          try {
            setLoading(true);
            setError("");

            const data =
              await getPaginatedPatients({
                page: 1,
                page_size:
                  SEARCH_PAGE_SIZE,

                search:
                  cleanedQuery,
              });

            if (!active) {
              return;
            }

            setResults(
              Array.isArray(
                data?.items
              )
                ? data.items
                : []
            );

          } catch (err) {
            if (!active) {
              return;
            }

            console.error(
              "Unable to search patients:",
              err
            );

            setResults([]);

            setError(
              "Unable to search patient records."
            );

          } finally {
            if (active) {
              setLoading(false);
            }
          }
        },
        SEARCH_DEBOUNCE_MS
      );


    return () => {
      active = false;

      window.clearTimeout(
        timer
      );
    };
  }, [
    open,
    query,
    selectedPatient,
  ]);


  // =====================================================
  // CLOSE ON OUTSIDE CLICK
  // =====================================================

  useEffect(() => {
    const handlePointerDown = (
      event
    ) => {
      if (
        containerRef.current &&
        !containerRef.current
          .contains(event.target)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handlePointerDown
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handlePointerDown
      );
    };
  }, []);


  // =====================================================
  // SELECT / CHANGE
  // =====================================================

  const selectPatient = (
    patient
  ) => {
    setSelectedPatient(
      patient
    );

    setQuery("");
    setResults([]);
    setOpen(false);

    onChange(
      patient.id
    );
  };


  const changePatient = () => {
    /*
     * The parent owns the clinical-data protection
     * confirmation. If it rejects clearing patient_id,
     * `value` stays populated and this component remains
     * on the selected patient.
     */
    onChange("");

    setQuery("");
    setOpen(true);
  };


  useEffect(() => {
    if (!value) {
      setSelectedPatient(
        null
      );
    }
  }, [
    value,
  ]);


  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div
      ref={containerRef}
      className="consultations-field consultations-field-full patient-search-select"
    >

      <label htmlFor="patient-search-input">
        Patient
        {required && (
          <span
            className="patient-search-required"
            aria-hidden="true"
          >
            *
          </span>
        )}
      </label>


      {selectedPatient ? (

        <div className="patient-search-selected">

          <div className="patient-search-selected-copy">

            <span className="patient-search-selected-code">
              {
                selectedPatient
                  .patient_code
              }
            </span>

            <strong>
              {
                selectedPatient
                  .last_name
              }
              ,{" "}
              {
                selectedPatient
                  .first_name
              }
              {
                selectedPatient
                  .middle_name
                  ? ` ${selectedPatient.middle_name}`
                  : ""
              }
              {
                selectedPatient
                  .suffix
                  ? ` ${selectedPatient.suffix}`
                  : ""
              }
            </strong>

            <small>
              {
                [
                  selectedPatient.sex,
                  selectedPatient.street,
                ]
                  .filter(Boolean)
                  .join(" · ")
              }
            </small>

          </div>


          <button
            type="button"
            className="patient-search-change"
            onClick={
              changePatient
            }
          >
            Change
          </button>

        </div>

      ) : (

        <div className="patient-search-control">

          <input
            id="patient-search-input"
            type="search"
            value={query}
            onChange={
              (event) => {
                setQuery(
                  event.target.value
                );

                setOpen(true);
              }
            }
            onFocus={() =>
              setOpen(true)
            }
            placeholder="Search patient code or name..."
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls="patient-search-results"
          />


          <div className="patient-search-help">
            Type at least 2 characters of the
            patient code, first name, or last name.
            Only matching records are loaded
            from the server.
          </div>


          {open && (

            <div
              id="patient-search-results"
              className="patient-search-results"
              role="listbox"
            >

              {query.trim().length <
                MIN_SEARCH_CHARACTERS ? (

                <div className="patient-search-state">
                  Enter at least{" "}
                  {MIN_SEARCH_CHARACTERS}{" "}
                  characters to search.
                </div>

              ) : loading ? (

                <div className="patient-search-state">
                  Searching patients...
                </div>

              ) : error ? (

                <div className="patient-search-state patient-search-error">
                  {error}
                </div>

              ) : results.length === 0 ? (

                <div className="patient-search-state">
                  No matching patient found.
                </div>

              ) : (

                results.map(
                  (patient) => (

                    <button
                      key={
                        patient.id
                      }
                      type="button"
                      className="patient-search-result"
                      role="option"
                      aria-selected="false"
                      onClick={() =>
                        selectPatient(
                          patient
                        )
                      }
                    >

                      <span className="patient-search-result-code">
                        {
                          patient
                            .patient_code
                        }
                      </span>

                      <strong>
                        {
                          patient
                            .last_name
                        }
                        ,{" "}
                        {
                          patient
                            .first_name
                        }
                        {
                          patient
                            .middle_name
                            ? ` ${patient.middle_name}`
                            : ""
                        }
                      </strong>

                      <small>
                        {
                          [
                            patient.sex,
                            patient.street,
                          ]
                            .filter(Boolean)
                            .join(" · ")
                        }
                      </small>

                    </button>

                  )
                )

              )}

            </div>

          )}

        </div>

      )}


      {/*
       * Keeps native required-form semantics without
       * exposing a second visible field.
       */}
      {required && (
        <input
          className="patient-search-hidden-required"
          tabIndex={-1}
          aria-hidden="true"
          value={value || ""}
          onChange={() => {}}
          required
        />
      )}

    </div>
  );
}


export default PatientSearchSelect;
