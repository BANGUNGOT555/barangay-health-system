import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(
    "access_token"
  );

  if (token) {
    config.headers.Authorization =
      `Bearer ${token}`;
  }

  return config;
});

let refreshPromise = null;

function isAuthEndpoint(url = "") {
  return (
    url.includes("/auth/login") ||
    url.includes("/auth/register") ||
    url.includes("/auth/refresh") ||
    url.includes("/auth/logout")
  );
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;

    if (
      status !== 401 ||
      !originalRequest ||
      originalRequest._retry ||
      originalRequest.skipAuthRefresh ||
      isAuthEndpoint(
        originalRequest.url
      )
    ) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      if (!refreshPromise) {
        refreshPromise = api
          .post(
            "/auth/refresh",
            null,
            {
              skipAuthRefresh: true,
            }
          )
          .then((response) => {
            const newToken =
              response.data.access_token;

            localStorage.setItem(
              "access_token",
              newToken
            );

            return newToken;
          })
          .finally(() => {
            refreshPromise = null;
          });
      }

      const newToken =
        await refreshPromise;

      originalRequest.headers =
        originalRequest.headers || {};

      originalRequest.headers.Authorization =
        `Bearer ${newToken}`;

      return api(originalRequest);
    }
    catch (refreshError) {
      localStorage.removeItem(
        "access_token"
      );

      if (
        window.location.pathname !==
        "/login"
      ) {
        window.location.replace(
          "/login?reason=session_expired"
        );
      }

      return Promise.reject(
        refreshError
      );
    }
  }
);

export default api;
