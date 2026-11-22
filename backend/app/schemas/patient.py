from datetime import date, datetime
from typing import Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
)


# =========================================================
# ALLOWED VALUES
# =========================================================

SexValue = Literal[
    "Male",
    "Female",
]


CivilStatusValue = Literal[
    "Single",
    "Married",
    "Widowed",
    "Separated",
]


RecordStatusValue = Literal[
    "ACTIVE",
    "INACTIVE",
]


SuffixValue = Literal[
    "Jr.",
    "Sr.",
    "II",
    "III",
    "IV",
    "V",
]


# =========================================================
# VALIDATION HELPERS
# =========================================================

PHONE_NUMBER_LENGTH = 11


def _validate_optional_phone_number(
    value: str | None,
    field_label: str,
) -> str | None:
    if value is None:
        return None

    if not value.isdigit():
        raise ValueError(
            f"{field_label} must contain digits only."
        )

    if len(value) != PHONE_NUMBER_LENGTH:
        raise ValueError(
            f"{field_label} must contain exactly "
            f"{PHONE_NUMBER_LENGTH} digits."
        )

    return value


def _validate_optional_person_name(
    value: str | None,
) -> str | None:
    if value is None:
        return None

    allowed_separators = {
        " ",
        "-",
        "'",
    }

    if not all(
        character.isalpha()
        or character in allowed_separators
        for character in value
    ):
        raise ValueError(
            "Emergency contact name must contain "
            "letters only. Spaces, hyphens, and "
            "apostrophes are allowed."
        )

    return value


# =========================================================
# BASE PATIENT SCHEMA
#
# Contact fields are intentionally not strictly validated
# here because PatientResponse also inherits this schema.
# Strict contact validation is applied to create/update
# inputs so existing legacy records cannot break responses.
# =========================================================

class PatientBase(BaseModel):
    first_name: str = Field(
        min_length=1,
        max_length=100,
    )

    middle_name: str | None = Field(
        default=None,
        max_length=100,
    )

    last_name: str = Field(
        min_length=1,
        max_length=100,
    )

    suffix: SuffixValue | None = None

    date_of_birth: date

    sex: SexValue

    civil_status: CivilStatusValue | None = None

    # Boolean category flag used by the Patient Records PWD filter.
    # No disability diagnosis/details are stored here.
    is_pwd: bool = False

    street: str | None = Field(
        default=None,
        max_length=150,
    )

    barangay: str | None = Field(
        default=None,
        max_length=150,
    )

    city: str | None = Field(
        default=None,
        max_length=150,
    )

    address: str = Field(
        min_length=1,
    )

    contact_number: str | None = Field(
        default=None,
        max_length=30,
    )

    emergency_contact_name: str | None = Field(
        default=None,
        max_length=150,
    )

    emergency_contact_number: str | None = Field(
        default=None,
        max_length=30,
    )


    # =====================================================
    # CLEAN TEXT
    # =====================================================

    @field_validator(
        "first_name",
        "middle_name",
        "last_name",
        "street",
        "barangay",
        "city",
        "address",
        "contact_number",
        "emergency_contact_name",
        "emergency_contact_number",
        mode="before",
    )
    @classmethod
    def clean_text(
        cls,
        value,
    ):
        if value is None:
            return None

        if not isinstance(
            value,
            str,
        ):
            return value

        cleaned = value.strip()

        return cleaned or None


    # =====================================================
    # DATE VALIDATION
    # =====================================================

    @field_validator(
        "date_of_birth"
    )
    @classmethod
    def validate_date_of_birth(
        cls,
        value: date,
    ) -> date:
        if value > date.today():
            raise ValueError(
                "Date of birth cannot be in the future."
            )

        return value


# =========================================================
# CREATE PATIENT
# =========================================================

class PatientCreate(PatientBase):

    @field_validator(
        "contact_number"
    )
    @classmethod
    def validate_contact_number(
        cls,
        value: str | None,
    ) -> str | None:
        return _validate_optional_phone_number(
            value,
            "Contact number",
        )


    @field_validator(
        "emergency_contact_number"
    )
    @classmethod
    def validate_emergency_contact_number(
        cls,
        value: str | None,
    ) -> str | None:
        return _validate_optional_phone_number(
            value,
            "Emergency contact number",
        )


    @field_validator(
        "emergency_contact_name"
    )
    @classmethod
    def validate_emergency_contact_name(
        cls,
        value: str | None,
    ) -> str | None:
        return _validate_optional_person_name(
            value
        )


# =========================================================
# UPDATE PATIENT
# =========================================================

class PatientUpdate(BaseModel):
    first_name: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )

    middle_name: str | None = Field(
        default=None,
        max_length=100,
    )

    last_name: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )

    suffix: SuffixValue | None = None

    date_of_birth: date | None = None

    sex: SexValue | None = None

    civil_status: CivilStatusValue | None = None

    is_pwd: bool | None = None

    street: str | None = Field(
        default=None,
        max_length=150,
    )

    barangay: str | None = Field(
        default=None,
        max_length=150,
    )

    city: str | None = Field(
        default=None,
        max_length=150,
    )

    address: str | None = None

    contact_number: str | None = Field(
        default=None,
        max_length=30,
    )

    emergency_contact_name: str | None = Field(
        default=None,
        max_length=150,
    )

    emergency_contact_number: str | None = Field(
        default=None,
        max_length=30,
    )

    record_status: RecordStatusValue | None = None


    # =====================================================
    # CLEAN TEXT
    # =====================================================

    @field_validator(
        "first_name",
        "middle_name",
        "last_name",
        "street",
        "barangay",
        "city",
        "address",
        "contact_number",
        "emergency_contact_name",
        "emergency_contact_number",
        mode="before",
    )
    @classmethod
    def clean_text(
        cls,
        value,
    ):
        if value is None:
            return None

        if not isinstance(
            value,
            str,
        ):
            return value

        cleaned = value.strip()

        return cleaned or None


    # =====================================================
    # DATE VALIDATION
    # =====================================================

    @field_validator(
        "date_of_birth"
    )
    @classmethod
    def validate_date_of_birth(
        cls,
        value: date | None,
    ) -> date | None:
        if value is None:
            return None

        if value > date.today():
            raise ValueError(
                "Date of birth cannot be in the future."
            )

        return value


    # =====================================================
    # CONTACT VALIDATION
    # =====================================================

    @field_validator(
        "contact_number"
    )
    @classmethod
    def validate_contact_number(
        cls,
        value: str | None,
    ) -> str | None:
        return _validate_optional_phone_number(
            value,
            "Contact number",
        )


    @field_validator(
        "emergency_contact_number"
    )
    @classmethod
    def validate_emergency_contact_number(
        cls,
        value: str | None,
    ) -> str | None:
        return _validate_optional_phone_number(
            value,
            "Emergency contact number",
        )


    @field_validator(
        "emergency_contact_name"
    )
    @classmethod
    def validate_emergency_contact_name(
        cls,
        value: str | None,
    ) -> str | None:
        return _validate_optional_person_name(
            value
        )


# =========================================================
# PATIENT RESPONSE
# =========================================================

class PatientResponse(PatientBase):
    model_config = ConfigDict(
        from_attributes=True
    )

    id: int

    patient_code: str

    record_status: RecordStatusValue

    created_at: datetime | None = None

    updated_at: datetime | None = None


# =========================================================
# OPTIONAL LIST RESPONSE
# =========================================================

class PatientListResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True
    )

    id: int

    patient_code: str

    first_name: str

    middle_name: str | None = None

    last_name: str

    suffix: SuffixValue | None = None

    date_of_birth: date

    sex: SexValue

    civil_status: CivilStatusValue | None = None

    is_pwd: bool = False

    street: str | None = None

    contact_number: str | None = None

    record_status: RecordStatusValue
