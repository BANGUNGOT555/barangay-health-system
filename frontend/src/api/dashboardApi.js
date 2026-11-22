import api from "./axios";


export const getDashboardSummary =
  async () => {
    const response =
      await api.get(
        "/dashboard/summary"
      );

    return response.data;
  };


export const getDashboardAnalytics =
  async () => {
    const response =
      await api.get(
        "/dashboard/analytics"
      );

    return response.data;
  };
