from datetime import date, datetime

from sqlalchemy import (
    func,
    or_,
    select,
)
from sqlalchemy.orm import Session

from app.models.patient import Patient
from app.schemas.patient import (
    PatientCreate,
    PatientUpdate,
)


# =========================================================
# HELPERS
# =========================================================

def _clean_optional_text(
    value: str | None,
) -> str | None:
    if value is None:
        return None

    cleaned = value.strip()

    return cleaned or None


def _years_ago(
    reference: date,
    years: int,
) -> date:
    """
    Return the date exactly N calendar years before reference.

    Feb. 29 is normalized to Feb. 28 when the target year
    is not a leap year.
    """
    try:
        return reference.replace(
            year=(
                reference.year
                - years
            )
        )

    except ValueError:
        return reference.replace(
            year=(
                reference.year
                - years
            ),
            month=2,
            day=28,
        )


# =========================================================
# GENERATE PATIENT CODE
# =========================================================

def generate_patient_code(
    db: Session,
) -> str:
    last_patient = db.scalar(
        select(Patient)
        .order_by(
            Patient.id.desc()
        )
        .limit(1)
    )

    next_number = 1

    if last_patient:
        next_number = (
            last_patient.id + 1
        )

    current_year = (
        datetime.now().year
    )

    return (
        f"KNL-{current_year}-"
        f"{next_number:05d}"
    )


# =========================================================
# CREATE PATIENT
# =========================================================

def create_patient(
    db: Session,
    data: PatientCreate,
    registered_by: int | None = None,
) -> Patient:
    patient = Patient(
        patient_code=
            generate_patient_code(db),

        first_name=
            data.first_name.strip(),

        middle_name=
            _clean_optional_text(
                data.middle_name
            ),

        last_name=
            data.last_name.strip(),

        suffix=
            data.suffix,

        date_of_birth=
            data.date_of_birth,

        sex=
            data.sex,

        civil_status=
            data.civil_status,

        is_pwd=
            data.is_pwd,

        street=
            _clean_optional_text(
                data.street
            ),

        barangay=
            _clean_optional_text(
                data.barangay
            ),

        city=
            _clean_optional_text(
                data.city
            ),

        address=
            data.address.strip(),

        contact_number=
            _clean_optional_text(
                data.contact_number
            ),

        emergency_contact_name=
            _clean_optional_text(
                data.emergency_contact_name
            ),

        emergency_contact_number=
            _clean_optional_text(
                data.emergency_contact_number
            ),

        record_status="ACTIVE",
    )


    # -----------------------------------------------------
    # REGISTERED BY
    #
    # Keep this only if the Patient model actually has
    # a registered_by column.
    # -----------------------------------------------------

    if hasattr(
        patient,
        "registered_by",
    ):
        patient.registered_by = (
            registered_by
        )


    # -----------------------------------------------------
    # SAVE
    # -----------------------------------------------------

    try:
        db.add(patient)
        db.commit()
        db.refresh(patient)

    except Exception:
        db.rollback()
        raise


    return patient


# =========================================================
# GET ALL PATIENTS
#
# Kept for pages that still need the legacy array response.
# =========================================================

def get_patients(
    db: Session,
):
    return db.scalars(
        select(Patient)
        .order_by(
            Patient.created_at.desc()
        )
    ).all()


# =========================================================
# GET PAGINATED PATIENTS
# =========================================================

def get_paginated_patients(
    db: Session,
    *,
    page: int = 1,
    page_size: int = 25,
    search: str | None = None,
    gender: str | None = None,
    category: str | None = None,
):
    conditions = []


    # -----------------------------------------------------
    # SEARCH
    # -----------------------------------------------------

    if search:
        cleaned_search = (
            search.strip()
        )

        if cleaned_search:
            search_value = (
                f"%{cleaned_search}%"
            )

            conditions.append(
                or_(
                    Patient.patient_code.ilike(
                        search_value
                    ),
                    Patient.first_name.ilike(
                        search_value
                    ),
                    Patient.last_name.ilike(
                        search_value
                    ),
                    Patient.street.ilike(
                        search_value
                    ),
                    Patient.sex.ilike(
                        search_value
                    ),
                    Patient.civil_status.ilike(
                        search_value
                    ),
                )
            )


    # -----------------------------------------------------
    # GENDER
    # -----------------------------------------------------

    if gender:
        conditions.append(
            Patient.sex
            == gender
        )


    # -----------------------------------------------------
    # CATEGORY
    # -----------------------------------------------------

    if category:
        today = date.today()

        if category == "PWD":
            conditions.append(
                Patient.is_pwd.is_(
                    True
                )
            )

        elif category == "TODDLER":
            conditions.extend([
                Patient.date_of_birth
                > _years_ago(
                    today,
                    5,
                ),

                Patient.date_of_birth
                <= today,
            ])

        elif category == "MINOR":
            conditions.extend([
                Patient.date_of_birth
                <= _years_ago(
                    today,
                    5,
                ),

                Patient.date_of_birth
                > _years_ago(
                    today,
                    18,
                ),
            ])

        elif category == "ADULT":
            conditions.extend([
                Patient.date_of_birth
                <= _years_ago(
                    today,
                    18,
                ),

                Patient.date_of_birth
                > _years_ago(
                    today,
                    60,
                ),
            ])

        elif category == "SENIOR":
            conditions.append(
                Patient.date_of_birth
                <= _years_ago(
                    today,
                    60,
                )
            )


    # -----------------------------------------------------
    # TOTAL COUNT
    # -----------------------------------------------------

    count_statement = (
        select(
            func.count(
                Patient.id
            )
        )
    )

    if conditions:
        count_statement = (
            count_statement.where(
                *conditions
            )
        )

    total = (
        db.scalar(
            count_statement
        )
        or 0
    )


    # -----------------------------------------------------
    # PAGE DATA
    # -----------------------------------------------------

    statement = (
        select(Patient)
    )

    if conditions:
        statement = (
            statement.where(
                *conditions
            )
        )

    offset = (
        page - 1
    ) * page_size

    items = db.scalars(
        statement
        .order_by(
            Patient.created_at.desc(),
            Patient.id.desc(),
        )
        .offset(offset)
        .limit(page_size)
    ).all()


    return items, total


# =========================================================
# GET PATIENT BY ID
# =========================================================

def get_patient_by_id(
    db: Session,
    patient_id: int,
):
    return db.scalar(
        select(Patient).where(
            Patient.id == patient_id
        )
    )


# =========================================================
# UPDATE PATIENT
# =========================================================

def update_patient(
    db: Session,
    patient: Patient,
    data: PatientUpdate,
) -> Patient:
    update_data = (
        data.model_dump(
            exclude_unset=True
        )
    )


    # -----------------------------------------------------
    # CLEAN STRING VALUES
    # -----------------------------------------------------

    for field, value in (
        update_data.items()
    ):
        if (
            isinstance(
                value,
                str,
            )
        ):
            value = (
                value.strip()
                or None
            )

        setattr(
            patient,
            field,
            value,
        )


    # -----------------------------------------------------
    # SAVE
    # -----------------------------------------------------

    try:
        db.commit()
        db.refresh(patient)

    except Exception:
        db.rollback()
        raise


    return patient
