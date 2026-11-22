import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import api from "../api/axios";


const AuthContext =
  createContext(null);


const CONSULTATION_DRAFT_KEY_PREFIX =
  "knl_consultation_draft:";


// =========================================================
// CONSULTATION DRAFT HELPERS
// =========================================================

const hasUnsavedConsultationDraft =
  () => {
    try {
      for (
        let index = 0;
        index < sessionStorage.length;
        index += 1
      ) {
        const key =
          sessionStorage.key(index);

        if (
          key?.startsWith(
            CONSULTATION_DRAFT_KEY_PREFIX
          )
        ) {
          return true;
        }
      }
    }
    catch (error) {
      console.error(
        "Unable to inspect consultation drafts:",
        error
      );
    }

    return false;
  };


const clearConsultationDrafts =
  () => {
    try {
      const keysToRemove = [];

      for (
        let index = 0;
        index < sessionStorage.length;
        index += 1
      ) {
        const key =
          sessionStorage.key(index);

        if (
          key?.startsWith(
            CONSULTATION_DRAFT_KEY_PREFIX
          )
        ) {
          keysToRemove.push(
            key
          );
        }
      }

      keysToRemove.forEach(
        (key) => {
          sessionStorage.removeItem(
            key
          );
        }
      );
    }
    catch (error) {
      console.error(
        "Unable to clear consultation drafts:",
        error
      );
    }
  };


export function AuthProvider({
  children,
}) {
  const [
    user,
    setUser,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);


  const [
    profilePhotoUrl,
    setProfilePhotoUrl,
  ] = useState(null);

  const profilePhotoObjectUrlRef =
    useRef(null);


  const clearProfilePhoto = () => {
    if (
      profilePhotoObjectUrlRef.current
    ) {
      URL.revokeObjectURL(
        profilePhotoObjectUrlRef.current
      );

      profilePhotoObjectUrlRef.current =
        null;
    }

    setProfilePhotoUrl(
      null
    );
  };


  const loadProfilePhoto = async (
    hasProfilePhoto
  ) => {
    if (!hasProfilePhoto) {
      clearProfilePhoto();
      return;
    }

    try {
      const response =
        await api.get(
          "/auth/profile-photo",
          {
            responseType: "blob",
          }
        );

      const nextUrl =
        URL.createObjectURL(
          response.data
        );

      if (
        profilePhotoObjectUrlRef.current
      ) {
        URL.revokeObjectURL(
          profilePhotoObjectUrlRef.current
        );
      }

      profilePhotoObjectUrlRef.current =
        nextUrl;

      setProfilePhotoUrl(
        nextUrl
      );
    }
    catch (error) {
      console.error(
        "Unable to load profile photo:",
        error
      );

      clearProfilePhoto();
    }
  };


  // =====================================================
  // LOAD CURRENT USER
  // =====================================================

  const loadUser = async () => {
    const token =
      localStorage.getItem(
        "access_token"
      );


    if (!token) {
      setUser(null);
      clearProfilePhoto();
      setLoading(false);

      return;
    }


    try {
      const response =
        await api.get(
          "/auth/me"
        );

      setUser(
        response.data
      );

      await loadProfilePhoto(
        Boolean(
          response.data
            ?.has_profile_photo
        )
      );

    }
    catch (error) {
      console.error(
        "Unable to load current user:",
        error
      );

      localStorage.removeItem(
        "access_token"
      );

      setUser(null);
      clearProfilePhoto();

    }
    finally {
      setLoading(false);
    }
  };


  // =====================================================
  // LOGIN
  // =====================================================

  const login = async (
    username,
    password
  ) => {
    const response =
      await api.post(
        "/auth/login",
        {
          username,
          password,
        }
      );


    localStorage.setItem(
      "access_token",
      response.data.access_token
    );


    await loadUser();
  };


  // =====================================================
  // REGISTER
  // =====================================================

  const register = async (
    registrationData
  ) => {
    const response =
      await api.post(
        "/auth/register",
        registrationData
      );

    return response.data;
  };


  // =====================================================
  // LOGOUT
  // =====================================================

  const logout = async () => {
    const hasDraft =
      hasUnsavedConsultationDraft();


    if (hasDraft) {
      const confirmed =
        window.confirm(
          "You have an unsaved consultation draft. Logging out will discard it. Are you sure you want to log out?"
        );

      if (!confirmed) {
        return false;
      }
    }


    try {
      await api.post(
        "/auth/logout",
        null,
        {
          skipAuthRefresh: true,
        }
      );
    }
    catch (error) {
      console.error(
        "Unable to revoke session:",
        error
      );
    }
    finally {
      /*
       * Manual logout intentionally clears consultation
       * drafts so patient information is not left behind
       * on a shared health-center workstation.
       *
       * Automatic session expiry does NOT call this
       * function, so the consultation draft can still be
       * restored after the user signs in again in the
       * same browser tab.
       */
      clearConsultationDrafts();

      localStorage.removeItem(
        "access_token"
      );

      setUser(null);
      clearProfilePhoto();
    }


    return true;
  };


  // =====================================================
  // INITIAL LOAD
  // =====================================================

  useEffect(() => {
    loadUser();
  }, []);


  return (
    <AuthContext.Provider
      value={{
        user,
        loading,

        login,
        register,
        logout,
        refreshUser:
          loadUser,
        profilePhotoUrl,

        isAuthenticated:
          Boolean(user),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}


export function useAuth() {
  return useContext(
    AuthContext
  );
}
