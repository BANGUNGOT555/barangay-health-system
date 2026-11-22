/* =========================================================
   PATIENT FORM VALIDATION
========================================================= */

export const PATIENT_PHONE_LENGTH = 11;


const PHONE_NUMBER_PATTERN =
  /^\d{11}$/;


const PERSON_NAME_PATTERN =
  /^[\p{L}\s'-]+$/u;


/* =========================================================
   SANITIZERS
========================================================= */

export function sanitizePhoneNumber(
  value
) {
  return String(
    value ?? ""
  )
    .replace(
      /\D/g,
      ""
    )
    .slice(
      0,
      PATIENT_PHONE_LENGTH
    );
}


export function sanitizePersonName(
  value
) {
  return String(
    value ?? ""
  ).replace(
    /[^\p{L}\s'-]/gu,
    ""
  );
}


/*
 * Centralized field sanitizer so Patients.jsx does not
 * need field-specific validation logic inside handleChange.
 */
export function sanitizePatientFormField(
  fieldName,
  value
) {
  switch (fieldName) {
    case "contact_number":
    case "emergency_contact_number":
      return sanitizePhoneNumber(
        value
      );

    case "emergency_contact_name":
      return sanitizePersonName(
        value
      );

    default:
      return value;
  }
}


/* =========================================================
   VALIDATION
========================================================= */

export function validatePatientContactFields(
  formData
) {
  const contactNumber =
    String(
      formData?.contact_number ??
      ""
    ).trim();

  const emergencyContactName =
    String(
      formData
        ?.emergency_contact_name ??
      ""
    ).trim();

  const emergencyContactNumber =
    String(
      formData
        ?.emergency_contact_number ??
      ""
    ).trim();


  if (
    contactNumber &&
    !PHONE_NUMBER_PATTERN.test(
      contactNumber
    )
  ) {
    return (
      "Contact number must contain " +
      "exactly 11 digits."
    );
  }


  if (
    emergencyContactName &&
    !PERSON_NAME_PATTERN.test(
      emergencyContactName
    )
  ) {
    return (
      "Emergency contact name must " +
      "contain letters only. Spaces, " +
      "hyphens, and apostrophes are allowed."
    );
  }


  if (
    emergencyContactNumber &&
    !PHONE_NUMBER_PATTERN.test(
      emergencyContactNumber
    )
  ) {
    return (
      "Emergency contact number must " +
      "contain exactly 11 digits."
    );
  }


  return null;
}
