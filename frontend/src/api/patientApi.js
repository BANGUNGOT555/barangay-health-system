import api from "./axios";


/*
 * Legacy unpaginated patient list.
 *
 * Kept for existing pages such as Consultations that currently
 * expect getPatients() to return a plain array.
 */
export const getPatients = async () => {
  const response =
    await api.get(
      "/patients/"
    );

  return response.data;
};


export const getPaginatedPatients =
  async (params = {}) => {
    const response =
      await api.get(
        "/patients/paginated",
        {
          params,
        }
      );

    return response.data;
  };


export const getPatient = async (
  patientId
) => {
  const response =
    await api.get(
      `/patients/${patientId}`
    );

  return response.data;
};


export const createPatient = async (
  patientData
) => {
  const response =
    await api.post(
      "/patients/",
      patientData
    );

  return response.data;
};


export const updatePatient = async (
  patientId,
  patientData
) => {
  const response =
    await api.patch(
      `/patients/${patientId}`,
      patientData
    );

  return response.data;
};
