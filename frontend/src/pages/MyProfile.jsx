import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  removeMyProfilePhoto,
  updateMyProfile,
  uploadMyProfilePhoto,
} from "../api/profileApi";
import {
  useAuth,
} from "../context/AuthContext";

import "../styles/Profile.css";


const MAX_PHOTO_BYTES =
  2 * 1024 * 1024;

const ALLOWED_PHOTO_TYPES =
  new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
  ]);


const getApiErrorMessage = (
  error,
  fallback
) => {
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
};


const readFileAsDataUrl = (
  file
) =>
  new Promise(
    (resolve, reject) => {
      const reader =
        new FileReader();

      reader.onload = () => {
        resolve(
          reader.result
        );
      };

      reader.onerror = () => {
        reject(
          new Error(
            "Unable to read the selected photo."
          )
        );
      };

      reader.readAsDataURL(
        file
      );
    }
  );


function MyProfile() {
  const {
    user,
    refreshUser,
    profilePhotoUrl,
  } = useAuth();

  const fileInputRef =
    useRef(null);

  const [
    formData,
    setFormData,
  ] = useState({
    first_name: "",
    last_name: "",
    email: "",
    contact_number: "",
  });

  const [
    selectedPhoto,
    setSelectedPhoto,
  ] = useState(null);

  const [
    selectedPreviewUrl,
    setSelectedPreviewUrl,
  ] = useState(null);

  const [
    savingProfile,
    setSavingProfile,
  ] = useState(false);

  const [
    savingPhoto,
    setSavingPhoto,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState("");


  useEffect(() => {
    setFormData({
      first_name:
        user?.first_name || "",
      last_name:
        user?.last_name || "",
      email:
        user?.email || "",
      contact_number:
        user?.contact_number || "",
    });
  }, [
    user,
  ]);


  useEffect(() => {
    return () => {
      if (selectedPreviewUrl) {
        URL.revokeObjectURL(
          selectedPreviewUrl
        );
      }
    };
  }, [
    selectedPreviewUrl,
  ]);


  const clearMessages = () => {
    setError("");
    setSuccess("");
  };


  const handleChange = (
    event
  ) => {
    const {
      name,
      value,
    } = event.target;

    setFormData(
      (current) => ({
        ...current,
        [name]: value,
      })
    );

    clearMessages();
  };


  const handleProfileSubmit =
    async (event) => {
      event.preventDefault();
      clearMessages();

      const contact =
        formData
          .contact_number
          .trim();

      if (
        contact &&
        (
          contact.length !== 11 ||
          !/^\d+$/.test(contact)
        )
      ) {
        setError(
          "Contact number must contain exactly 11 digits."
        );

        return;
      }

      try {
        setSavingProfile(
          true
        );

        await updateMyProfile({
          first_name:
            formData
              .first_name
              .trim(),
          last_name:
            formData
              .last_name
              .trim(),
          email:
            formData
              .email
              .trim(),
          contact_number:
            contact || null,
        });

        await refreshUser();

        setSuccess(
          "Profile information updated successfully."
        );
      }
      catch (requestError) {
        console.error(
          "Unable to update profile:",
          requestError
        );

        setError(
          getApiErrorMessage(
            requestError,
            "Unable to update profile information."
          )
        );
      }
      finally {
        setSavingProfile(
          false
        );
      }
    };


  const handlePhotoSelect = (
    event
  ) => {
    clearMessages();

    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    if (
      !ALLOWED_PHOTO_TYPES.has(
        file.type
      )
    ) {
      setError(
        "Profile photo must be JPG, PNG, or WebP."
      );

      event.target.value = "";
      return;
    }

    if (
      file.size >
      MAX_PHOTO_BYTES
    ) {
      setError(
        "Profile photo must not exceed 2 MB."
      );

      event.target.value = "";
      return;
    }

    if (selectedPreviewUrl) {
      URL.revokeObjectURL(
        selectedPreviewUrl
      );
    }

    const previewUrl =
      URL.createObjectURL(
        file
      );

    setSelectedPhoto(
      file
    );

    setSelectedPreviewUrl(
      previewUrl
    );
  };


  const handleUploadPhoto =
    async () => {
      if (!selectedPhoto) {
        setError(
          "Choose a photo first."
        );

        return;
      }

      clearMessages();

      try {
        setSavingPhoto(
          true
        );

        const dataUrl =
          await readFileAsDataUrl(
            selectedPhoto
          );

        const base64Data =
          String(dataUrl)
            .split(",")[1];

        if (!base64Data) {
          throw new Error(
            "Unable to prepare the selected photo."
          );
        }

        await uploadMyProfilePhoto({
          contentType:
            selectedPhoto.type,
          dataBase64:
            base64Data,
        });

        await refreshUser();

        if (selectedPreviewUrl) {
          URL.revokeObjectURL(
            selectedPreviewUrl
          );
        }

        setSelectedPhoto(
          null
        );

        setSelectedPreviewUrl(
          null
        );

        if (
          fileInputRef.current
        ) {
          fileInputRef.current.value =
            "";
        }

        setSuccess(
          "Profile photo updated successfully."
        );
      }
      catch (requestError) {
        console.error(
          "Unable to update profile photo:",
          requestError
        );

        setError(
          getApiErrorMessage(
            requestError,
            requestError?.message ||
              "Unable to update profile photo."
          )
        );
      }
      finally {
        setSavingPhoto(
          false
        );
      }
    };


  const handleRemovePhoto =
    async () => {
      if (
        !user?.has_profile_photo
      ) {
        return;
      }

      const confirmed =
        window.confirm(
          "Remove your current profile photo?"
        );

      if (!confirmed) {
        return;
      }

      clearMessages();

      try {
        setSavingPhoto(
          true
        );

        await removeMyProfilePhoto();
        await refreshUser();

        setSuccess(
          "Profile photo removed successfully."
        );
      }
      catch (requestError) {
        console.error(
          "Unable to remove profile photo:",
          requestError
        );

        setError(
          getApiErrorMessage(
            requestError,
            "Unable to remove profile photo."
          )
        );
      }
      finally {
        setSavingPhoto(
          false
        );
      }
    };


  const initials = [
    user?.first_name?.[0],
    user?.last_name?.[0],
  ]
    .filter(Boolean)
    .join("")
    .toUpperCase();


  const displayedPhoto =
    selectedPreviewUrl ||
    profilePhotoUrl;


  return (
    <div className="profile-page">

      <header className="profile-page-header">
        <div>
          <span className="profile-kicker">
            Account
          </span>

          <h1>
            My Profile
          </h1>

          <p>
            Manage your personal account information and profile photo.
          </p>
        </div>
      </header>


      {error && (
        <div className="app-message app-message-error profile-message">
          {error}
        </div>
      )}

      {success && (
        <div className="app-message app-message-success profile-message">
          {success}
        </div>
      )}


      <div className="profile-layout">

        <section className="profile-card profile-photo-card">

          <div className="profile-section-heading">
            <div>
              <h2>
                Profile Photo
              </h2>

              <p>
                JPG, PNG, or WebP. Maximum 2 MB.
              </p>
            </div>
          </div>


          <div className="profile-photo-content">

            <div className="profile-photo-preview">
              {displayedPhoto ? (
                <img
                  src={displayedPhoto}
                  alt="Profile"
                />
              ) : (
                <span>
                  {initials || "U"}
                </span>
              )}
            </div>


            <div className="profile-photo-actions">

              <input
                ref={fileInputRef}
                id="profile-photo-input"
                className="profile-file-input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={
                  handlePhotoSelect
                }
                disabled={
                  savingPhoto
                }
              />

              <label
                htmlFor="profile-photo-input"
                className="app-button app-button-secondary profile-photo-picker"
              >
                Choose Photo
              </label>


              {selectedPhoto && (
                <button
                  type="button"
                  className="app-button app-button-primary"
                  onClick={
                    handleUploadPhoto
                  }
                  disabled={
                    savingPhoto
                  }
                >
                  {savingPhoto
                    ? "Uploading..."
                    : "Upload Photo"}
                </button>
              )}


              {user?.has_profile_photo && (
                <button
                  type="button"
                  className="profile-remove-photo"
                  onClick={
                    handleRemovePhoto
                  }
                  disabled={
                    savingPhoto
                  }
                >
                  Remove Photo
                </button>
              )}

            </div>

          </div>

        </section>


        <section className="profile-card">

          <div className="profile-section-heading">
            <div>
              <h2>
                Personal Information
              </h2>

              <p>
                Changes are applied to your own account only.
              </p>
            </div>
          </div>


          <form
            onSubmit={
              handleProfileSubmit
            }
            className="profile-form"
          >

            <div className="profile-form-grid">

              <div className="profile-field">
                <label htmlFor="profile-first-name">
                  First Name
                </label>

                <input
                  id="profile-first-name"
                  name="first_name"
                  value={
                    formData.first_name
                  }
                  onChange={
                    handleChange
                  }
                  maxLength={100}
                  required
                />
              </div>


              <div className="profile-field">
                <label htmlFor="profile-last-name">
                  Last Name
                </label>

                <input
                  id="profile-last-name"
                  name="last_name"
                  value={
                    formData.last_name
                  }
                  onChange={
                    handleChange
                  }
                  maxLength={100}
                  required
                />
              </div>


              <div className="profile-field">
                <label htmlFor="profile-email">
                  Email
                </label>

                <input
                  id="profile-email"
                  name="email"
                  type="email"
                  value={
                    formData.email
                  }
                  onChange={
                    handleChange
                  }
                  required
                />
              </div>


              <div className="profile-field">
                <label htmlFor="profile-contact-number">
                  Contact Number
                </label>

                <input
                  id="profile-contact-number"
                  name="contact_number"
                  type="tel"
                  inputMode="numeric"
                  value={
                    formData
                      .contact_number
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="09XXXXXXXXX"
                  maxLength={11}
                />

                <small>
                  Optional. Use exactly 11 digits.
                </small>
              </div>


              <div className="profile-field profile-field-readonly">
                <label>
                  Username
                </label>

                <div className="profile-readonly-value">
                  @{user?.username || "-"}
                </div>

                <small>
                  Username cannot be changed here.
                </small>
              </div>


              <div className="profile-field profile-field-readonly">
                <label>
                  Role
                </label>

                <div className="profile-readonly-value">
                  {user?.roles?.join(", ") ||
                    "-"}
                </div>

                <small>
                  Role assignments are managed separately.
                </small>
              </div>

            </div>


            <div className="profile-form-actions">
              <button
                type="submit"
                className="app-button app-button-primary"
                disabled={
                  savingProfile
                }
              >
                {savingProfile
                  ? "Saving..."
                  : "Save Changes"}
              </button>
            </div>

          </form>

        </section>

      </div>

    </div>
  );
}


export default MyProfile;
