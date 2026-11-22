import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getClientSystemSettings,
} from "../api/systemSettingsApi";
import {
  useAuth,
} from "./AuthContext";


const FALLBACK_PAGE_SIZE = 25;
const ALLOWED_PAGE_SIZES = new Set([
  10,
  25,
  50,
  100,
]);


const SystemSettingsContext = createContext({
  defaultPageSize: FALLBACK_PAGE_SIZE,
  settingsLoading: true,
  refreshSystemSettings: async () => {},
  applyClientSettings: () => {},
});


function normalizePageSize(value) {
  const parsed = Number(value);

  return ALLOWED_PAGE_SIZES.has(parsed)
    ? parsed
    : FALLBACK_PAGE_SIZE;
}


export function SystemSettingsProvider({
  children,
}) {
  const {
    isAuthenticated,
    loading: authLoading,
  } = useAuth();

  const [defaultPageSize, setDefaultPageSize] =
    useState(FALLBACK_PAGE_SIZE);
  const [settingsLoading, setSettingsLoading] =
    useState(true);


  const applyClientSettings = useCallback(
    (settings) => {
      setDefaultPageSize(
        normalizePageSize(
          settings?.default_page_size
        )
      );
    },
    []
  );


  const refreshSystemSettings = useCallback(
    async () => {
      if (!isAuthenticated) {
        setDefaultPageSize(
          FALLBACK_PAGE_SIZE
        );
        setSettingsLoading(false);
        return;
      }

      try {
        setSettingsLoading(true);

        const data =
          await getClientSystemSettings();

        applyClientSettings(data);
      } catch (error) {
        console.error(
          "Unable to load client system settings:",
          error
        );

        setDefaultPageSize(
          FALLBACK_PAGE_SIZE
        );
      } finally {
        setSettingsLoading(false);
      }
    },
    [
      isAuthenticated,
      applyClientSettings,
    ]
  );


  useEffect(() => {
    if (authLoading) {
      return;
    }

    refreshSystemSettings();
  }, [
    authLoading,
    refreshSystemSettings,
  ]);


  const value = useMemo(
    () => ({
      defaultPageSize,
      settingsLoading,
      refreshSystemSettings,
      applyClientSettings,
    }),
    [
      defaultPageSize,
      settingsLoading,
      refreshSystemSettings,
      applyClientSettings,
    ]
  );


  return (
    <SystemSettingsContext.Provider
      value={value}
    >
      {children}
    </SystemSettingsContext.Provider>
  );
}


export function useSystemSettings() {
  return useContext(
    SystemSettingsContext
  );
}
