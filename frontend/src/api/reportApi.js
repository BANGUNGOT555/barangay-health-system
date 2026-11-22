import api from "./axios";


/* =========================================================
   CONSULTATION REPORT
========================================================= */

export const getConsultationReport =
  async ({
    startDate = null,
    endDate = null,
    limit = 5000,
  } = {}) => {

    const params = {
      limit,
    };

    if (startDate) {
      params.start_date =
        startDate;
    }

    if (endDate) {
      params.end_date =
        endDate;
    }

    const response =
      await api.get(
        "/consultations/report",
        {
          params,
        }
      );

    return response.data;
  };


/* =========================================================
   DISEASE SURVEILLANCE REPORT
========================================================= */

export const getDiseaseSurveillanceReport =
  async ({
    startDate = null,
    endDate = null,
    scope = "GENERAL",
  } = {}) => {

    const params = {
      scope,
    };

    if (startDate) {
      params.start_date =
        startDate;
    }

    if (endDate) {
      params.end_date =
        endDate;
    }

    const response =
      await api.get(
        "/surveillance/disease-cases",
        {
          params,
        }
      );

    return response.data;
  };



/* =========================================================
   REPORT AUDIT EVENT
========================================================= */

export const recordReportAudit =
  async (payload) => {

    const response =
      await api.post(
        "/reports/audit",
        payload
      );

    return response.data;
  };
