from datetime import (
    date,
    datetime,
    time,
    timedelta,
)

from sqlalchemy import (
    func,
    or_,
    select,
)
from sqlalchemy.orm import Session

from app.models.consultation import (
    Consultation,
)
from app.models.disease import Disease
from app.models.disease_case import (
    DiseaseCase,
)
from app.models.medicine import Medicine
from app.models.patient import Patient
from app.services.surveillance_service import (
    get_disease_case_counts,
)


def _get_total_stock(
    medicine: Medicine,
) -> int:
    if (
        medicine.units_per_package
        is not None
    ):
        return (
            medicine.package_stock
            * medicine.units_per_package
            + medicine.loose_stock
        )

    return (
        medicine.package_stock
        + medicine.loose_stock
    )


def _get_stock_status(
    medicine: Medicine,
) -> str:
    stock = _get_total_stock(
        medicine
    )

    if stock <= 0:
        return "OUT OF STOCK"

    if (
        stock
        <= medicine.reorder_level
    ):
        return "LOW STOCK"

    return "IN STOCK"


def _get_stock_display(
    medicine: Medicine,
) -> str:
    parts = []

    if (
        medicine.package_stock
        > 0
    ):
        package_label = (
            medicine.package_unit
            or "package"
        )

        parts.append(
            f"{medicine.package_stock} "
            f"{package_label}"
        )

    if (
        medicine.loose_stock
        > 0
    ):
        loose_label = (
            medicine.dispensing_unit
            or "piece"
        )

        parts.append(
            f"{medicine.loose_stock} "
            f"{loose_label}"
        )

    if not parts:
        return (
            f"0 "
            f"{medicine.dispensing_unit}"
        )

    return " + ".join(
        parts
    )


def _week_bounds(
    reference_date: date,
) -> tuple[
    date,
    date,
]:
    start_date = (
        reference_date
        - timedelta(
            days=(
                reference_date
                .weekday()
            )
        )
    )

    end_date = (
        start_date
        + timedelta(days=6)
    )

    return (
        start_date,
        end_date,
    )


def _count_consultations(
    db: Session,
    start_date: date,
    end_date: date,
) -> int:
    start_datetime = (
        datetime.combine(
            start_date,
            time.min,
        )
    )

    end_datetime = (
        datetime.combine(
            end_date,
            time.max,
        )
    )

    return int(
        db.scalar(
            select(
                func.count(
                    Consultation.id
                )
            )
            .where(
                Consultation
                .consultation_date
                >= start_datetime,
                Consultation
                .consultation_date
                <= end_datetime,
            )
        )
        or 0
    )


def _get_consultation_activity(
    db: Session,
    start_date: date,
    end_date: date,
) -> list[dict]:
    start_datetime = (
        datetime.combine(
            start_date,
            time.min,
        )
    )

    end_datetime = (
        datetime.combine(
            end_date,
            time.max,
        )
    )

    day_expression = func.date(
        Consultation
        .consultation_date
    )

    rows = db.execute(
        select(
            day_expression.label(
                "activity_date"
            ),
            func.count(
                Consultation.id
            ).label(
                "consultation_count"
            ),
        )
        .where(
            Consultation
            .consultation_date
            >= start_datetime,
            Consultation
            .consultation_date
            <= end_datetime,
        )
        .group_by(
            day_expression
        )
        .order_by(
            day_expression.asc()
        )
    ).all()

    counts_by_date = {}

    for row in rows:
        raw_date = (
            row.activity_date
        )

        if isinstance(
            raw_date,
            date,
        ):
            date_key = (
                raw_date.isoformat()
            )
        else:
            date_key = str(
                raw_date
            )

        counts_by_date[
            date_key
        ] = int(
            row
            .consultation_count
            or 0
        )

    activity = []

    current = start_date

    while (
        current <= end_date
    ):
        activity.append(
            {
                "date":
                    current
                    .isoformat(),

                "label":
                    current
                    .strftime(
                        "%b %d"
                    ),

                "count":
                    counts_by_date
                    .get(
                        current
                        .isoformat(),
                        0,
                    ),
            }
        )

        current += timedelta(
            days=1
        )

    return activity


def get_dashboard_summary(
    db: Session,
    include_inventory: bool = True,
    include_surveillance: bool = True,
):
    today = date.today()

    # =====================================================
    # DATE RANGES
    # =====================================================

    today_start = (
        datetime.combine(
            today,
            time.min,
        )
    )

    today_end = (
        datetime.combine(
            today,
            time.max,
        )
    )

    (
        week_start_date,
        week_end_date,
    ) = _week_bounds(
        today
    )

    week_start = (
        datetime.combine(
            week_start_date,
            time.min,
        )
    )

    week_end = (
        datetime.combine(
            week_end_date,
            time.max,
        )
    )

    # =====================================================
    # PATIENT COUNT
    # =====================================================

    total_patients = (
        db.scalar(
            select(
                func.count(
                    Patient.id
                )
            )
        )
        or 0
    )

    # =====================================================
    # CONSULTATIONS TODAY
    # =====================================================

    consultations_today = (
        db.scalar(
            select(
                func.count(
                    Consultation.id
                )
            )
            .where(
                Consultation
                .consultation_date
                >= today_start,
                Consultation
                .consultation_date
                <= today_end,
            )
        )
        or 0
    )

    # =====================================================
    # CONSULTATIONS THIS WEEK
    # =====================================================

    consultations_this_week = (
        db.scalar(
            select(
                func.count(
                    Consultation.id
                )
            )
            .where(
                Consultation
                .consultation_date
                >= week_start,
                Consultation
                .consultation_date
                <= week_end,
            )
        )
        or 0
    )

    # =====================================================
    # MEDICINE INVENTORY
    # =====================================================

    medicines = []

    if include_inventory:
        medicines = db.scalars(
            select(Medicine)
            .where(
                Medicine
                .is_active
                .is_(True)
            )
            .order_by(
                Medicine.name.asc()
            )
        ).all()

    active_medicines = len(
        medicines
    )

    low_stock_list = []

    low_stock_count = 0
    out_of_stock_count = 0

    for medicine in medicines:
        stock_status = (
            _get_stock_status(
                medicine
            )
        )

        if (
            stock_status
            == "LOW STOCK"
        ):
            low_stock_count += 1

        if (
            stock_status
            == "OUT OF STOCK"
        ):
            out_of_stock_count += 1

        if (
            stock_status
            in {
                "LOW STOCK",
                "OUT OF STOCK",
            }
        ):
            low_stock_list.append(
                {
                    "medicine_id":
                        medicine.id,

                    "code":
                        medicine.code,

                    "name":
                        medicine.name,

                    "stock_display":
                        _get_stock_display(
                            medicine
                        ),

                    "status":
                        stock_status,
                }
            )

    # =====================================================
    # DISEASE CASES THIS WEEK
    #
    # The surveillance service already restricts this to
    # VALIDATED, non-sensitive general-scope disease cases.
    # =====================================================

    disease_cases = []

    if include_surveillance:
        disease_cases = (
            get_disease_case_counts(
                db=db,
                start_date=(
                    week_start_date
                ),
                end_date=(
                    week_end_date
                ),
            )
        )

    # =====================================================
    # RECENT CONSULTATIONS
    #
    # General dashboard intentionally excludes consultations
    # linked to a structured sensitive disease. Sensitive
    # clinical review stays in restricted workflows.
    # =====================================================

    recent_rows = db.execute(
        select(
            Consultation,
            Patient,
        )
        .join(
            Patient,
            Patient.id
            == Consultation.patient_id,
        )
        .outerjoin(
            Disease,
            Disease.id
            == Consultation.disease_id,
        )
        .where(
            or_(
                Consultation
                .disease_id
                .is_(None),

                Disease
                .is_sensitive
                .is_(False),
            )
        )
        .order_by(
            Consultation
            .consultation_date
            .desc()
        )
        .limit(5)
    ).all()

    recent_consultations = []

    for (
        consultation,
        patient,
    ) in recent_rows:
        patient_name = " ".join(
            part
            for part in [
                patient.first_name,
                patient.middle_name,
                patient.last_name,
            ]
            if part
        )

        recent_consultations.append(
            {
                "consultation_id":
                    consultation.id,

                "patient_id":
                    patient.id,

                "patient_name":
                    patient_name,

                "diagnosis":
                    consultation.diagnosis,

                "consultation_date":
                    consultation
                    .consultation_date
                    .isoformat(),
            }
        )

    # =====================================================
    # RESPONSE
    # =====================================================

    return {
        "total_patients":
            total_patients,

        "consultations_today":
            consultations_today,

        "consultations_this_week":
            consultations_this_week,

        "active_medicines":
            active_medicines,

        "low_stock_medicines":
            low_stock_count,

        "out_of_stock_medicines":
            out_of_stock_count,

        "disease_cases_this_week":
            disease_cases,

        "low_stock_list":
            low_stock_list,

        "recent_consultations":
            recent_consultations,
    }


# =========================================================
# DASHBOARD ANALYTICS
# =========================================================

def get_dashboard_analytics(
    db: Session,
    include_surveillance: bool = True,
    include_pending_validation: bool = True,
):
    """
    Return compact, general-scope dashboard analytics.

    No generative AI is used here. All values are database
    aggregates or deterministic comparisons.
    """

    today = date.today()

    (
        current_week_start,
        current_week_end,
    ) = _week_bounds(
        today
    )

    previous_week_start = (
        current_week_start
        - timedelta(days=7)
    )

    previous_week_end = (
        current_week_start
        - timedelta(days=1)
    )

    activity_start = (
        today
        - timedelta(days=6)
    )

    # -----------------------------------------------------
    # 7-DAY CONSULTATION ACTIVITY
    # -----------------------------------------------------

    consultation_activity = (
        _get_consultation_activity(
            db=db,
            start_date=(
                activity_start
            ),
            end_date=today,
        )
    )

    consultations_previous_week = (
        _count_consultations(
            db=db,
            start_date=(
                previous_week_start
            ),
            end_date=(
                previous_week_end
            ),
        )
    )

    # -----------------------------------------------------
    # VALIDATED GENERAL DISEASE COUNTS
    # -----------------------------------------------------

    current_disease_counts = []
    previous_disease_counts = []

    if include_surveillance:
        current_disease_counts = (
            get_disease_case_counts(
                db=db,
                start_date=(
                    current_week_start
                ),
                end_date=(
                    current_week_end
                ),
            )
        )

        previous_disease_counts = (
            get_disease_case_counts(
                db=db,
                start_date=(
                    previous_week_start
                ),
                end_date=(
                    previous_week_end
                ),
            )
        )

    previous_by_id = {
        int(
            item[
                "disease_id"
            ]
        ):
        int(
            item[
                "case_count"
            ]
            or 0
        )
        for item
        in previous_disease_counts
    }

    disease_rows = []

    for item in current_disease_counts:
        current_count = int(
            item[
                "case_count"
            ]
            or 0
        )

        if current_count <= 0:
            continue

        previous_count = (
            previous_by_id.get(
                int(
                    item[
                        "disease_id"
                    ]
                ),
                0,
            )
        )

        disease_rows.append(
            {
                "disease_id":
                    item[
                        "disease_id"
                    ],

                "code":
                    item["code"],

                "name":
                    item["name"],

                "current_count":
                    current_count,

                "previous_count":
                    previous_count,

                "change":
                    (
                        current_count
                        - previous_count
                    ),
            }
        )

    disease_rows.sort(
        key=lambda item: (
            -item[
                "current_count"
            ],
            item[
                "name"
            ],
        )
    )

    current_week_disease_total = sum(
        int(
            item[
                "case_count"
            ]
            or 0
        )
        for item
        in current_disease_counts
    )

    previous_week_disease_total = sum(
        int(
            item[
                "case_count"
            ]
            or 0
        )
        for item
        in previous_disease_counts
    )

    # -----------------------------------------------------
    # PENDING STANDARD DISEASE CASES
    #
    # Aggregate count only. Sensitive diseases are excluded.
    # -----------------------------------------------------

    pending_standard_disease_cases = 0

    if include_pending_validation:
        pending_standard_disease_cases = int(
            db.scalar(
                select(
                    func.count(
                        DiseaseCase.id
                    )
                )
                .join(
                    Disease,
                    Disease.id
                    == DiseaseCase
                    .disease_id,
                )
                .where(
                    DiseaseCase
                    .validation_status
                    == "PENDING",

                    Disease
                    .is_active
                    .is_(True),

                    Disease
                    .is_sensitive
                    .is_(False),
                )
            )
            or 0
        )

    rising_diseases = sorted(
        (
            item
            for item in disease_rows
            if item["change"] > 0
        ),
        key=lambda item: (
            -item["change"],
            -item["current_count"],
            item["name"],
        ),
    )

    top_rising_disease = (
        rising_diseases[0]
        if rising_diseases
        else None
    )

    return {
        "consultation_activity_7d":
            consultation_activity,

        "consultations_previous_week":
            consultations_previous_week,

        "current_week_disease_total":
            current_week_disease_total,

        "previous_week_disease_total":
            previous_week_disease_total,

        "pending_standard_disease_cases":
            pending_standard_disease_cases,

        "disease_cases_top5":
            disease_rows[
                :5
            ],

        "top_rising_disease":
            top_rising_disease,

        "current_week":
            {
                "start_date":
                    current_week_start
                    .isoformat(),

                "end_date":
                    current_week_end
                    .isoformat(),
            },

        "previous_week":
            {
                "start_date":
                    previous_week_start
                    .isoformat(),

                "end_date":
                    previous_week_end
                    .isoformat(),
            },
    }
