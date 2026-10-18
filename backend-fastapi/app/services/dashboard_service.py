from datetime import date, timedelta

from sqlalchemy import and_, distinct, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.appointment import Appointment
from app.models.billing import Invoice, Payment
from app.models.doctor import Department, Doctor
from app.models.ipd import Bed, IpdAdmission, Ward
from app.models.patient import Patient
from app.models.staff import Attendance, LeaveRequest, Payroll, Staff
from app.models.user import User

# A bed counts as occupied if either flag says so (admissions set `status`)
BED_OCCUPIED = or_(Bed.status == "occupied", Bed.is_occupied == True)  # noqa: E712


# ---------- Helpers ----------

def _month_start(d: date) -> date:
    return d.replace(day=1)


def _add_months(d: date, months: int) -> date:
    idx = d.year * 12 + (d.month - 1) + months
    return date(idx // 12, idx % 12 + 1, 1)


def _month_buckets(date_from: date, date_to: date) -> list[date]:
    buckets = []
    current = _month_start(date_from)
    while current <= date_to:
        buckets.append(current)
        current = _add_months(current, 1)
    return buckets


def _month_label(d: date, multi_year: bool) -> str:
    return d.strftime("%b %Y") if multi_year else d.strftime("%b")


def resolve_range(
    period: str | None, date_from: date | None, date_to: date | None, default_months: int
) -> tuple[date, date]:
    """Resolve a reporting window from explicit dates or a period like '12months'."""
    today = date.today()
    end = date_to or today
    if date_from:
        return date_from, end
    months = default_months
    if period and period.endswith("months") and period[: -len("months")].isdigit():
        months = max(1, int(period[: -len("months")]))
    return _add_months(_month_start(end), -(months - 1)), end


def _pct_change(current: float, previous: float) -> float | None:
    if previous == 0:
        return None
    return round((current - previous) / previous * 100, 1)


async def _scalar(db: AsyncSession, stmt) -> float:
    result = await db.execute(stmt)
    return result.scalar() or 0


# ---------- Stats ----------

async def get_dashboard_stats(db: AsyncSession) -> dict:
    today = date.today()
    this_month = _month_start(today)
    last_month = _add_months(this_month, -1)
    last_week_day = today - timedelta(days=7)

    total_patients = await _scalar(db, select(func.count()).select_from(Patient))
    new_this_month = await _scalar(
        db, select(func.count()).select_from(Patient).where(func.date(Patient.created_at) >= this_month)
    )
    new_last_month = await _scalar(
        db,
        select(func.count()).select_from(Patient).where(
            func.date(Patient.created_at) >= last_month, func.date(Patient.created_at) < this_month
        ),
    )

    todays_appointments = await _scalar(
        db, select(func.count()).select_from(Appointment).where(Appointment.appointment_date == today)
    )
    last_week_appointments = await _scalar(
        db, select(func.count()).select_from(Appointment).where(Appointment.appointment_date == last_week_day)
    )

    total_beds = await _scalar(db, select(func.count()).select_from(Bed))
    occupied_beds = await _scalar(db, select(func.count()).select_from(Bed).where(BED_OCCUPIED))

    revenue_this_month = float(
        await _scalar(
            db,
            select(func.coalesce(func.sum(Payment.amount - Payment.refunded_amount), 0)).where(
                Payment.status == "completed", func.date(Payment.payment_date) >= this_month
            ),
        )
    )
    revenue_last_month = float(
        await _scalar(
            db,
            select(func.coalesce(func.sum(Payment.amount - Payment.refunded_amount), 0)).where(
                Payment.status == "completed",
                func.date(Payment.payment_date) >= last_month,
                func.date(Payment.payment_date) < this_month,
            ),
        )
    )

    # Appointments per day over the last 7 days (inclusive of today)
    week_start = today - timedelta(days=6)
    week_rows = await db.execute(
        select(Appointment.appointment_date, func.count())
        .where(Appointment.appointment_date >= week_start, Appointment.appointment_date <= today)
        .group_by(Appointment.appointment_date)
    )
    per_day = {row[0]: row[1] for row in week_rows.all()}
    weekly_visits = [
        {"day": (week_start + timedelta(days=i)).strftime("%a"), "patients": per_day.get(week_start + timedelta(days=i), 0)}
        for i in range(7)
    ]

    return {
        "total_patients": total_patients,
        "new_patients_this_month": new_this_month,
        "patients_change": _pct_change(new_this_month, new_last_month),
        "todays_appointments": todays_appointments,
        "appointments_change": _pct_change(todays_appointments, last_week_appointments),
        "total_beds": total_beds,
        "occupied_beds": occupied_beds,
        "bed_occupancy_percent": round(occupied_beds / total_beds * 100, 1) if total_beds else 0,
        "monthly_revenue": revenue_this_month,
        "revenue_change": _pct_change(revenue_this_month, revenue_last_month),
        "total_doctors": await _scalar(db, select(func.count()).select_from(Doctor)),
        "total_staff": await _scalar(db, select(func.count()).select_from(Staff)),
        "active_admissions": await _scalar(
            db, select(func.count()).select_from(IpdAdmission).where(IpdAdmission.status == "admitted")
        ),
        "weekly_visits": weekly_visits,
    }


# ---------- Today's appointments ----------

async def get_today_appointments(db: AsyncSession) -> list[dict]:
    doctor_user = User.__table__.alias("doctor_user")
    result = await db.execute(
        select(
            Appointment.id,
            Appointment.start_time,
            Appointment.status,
            Patient.first_name,
            Patient.last_name,
            doctor_user.c.first_name,
            doctor_user.c.last_name,
            Department.name,
        )
        .join(Patient, Patient.id == Appointment.patient_id)
        .join(Doctor, Doctor.id == Appointment.doctor_id)
        .join(doctor_user, doctor_user.c.id == Doctor.user_id)
        .outerjoin(Department, Department.id == Doctor.department_id)
        .where(Appointment.appointment_date == date.today())
        .order_by(Appointment.start_time)
    )
    return [
        {
            "id": str(row[0]),
            "time": row[1].strftime("%H:%M") if row[1] else None,
            "status": row[2].value if hasattr(row[2], "value") else row[2],
            "patient_name": f"{row[3]} {row[4]}",
            "doctor_name": f"Dr. {row[5]} {row[6]}",
            "department": row[7],
        }
        for row in result.all()
    ]


# ---------- Revenue ----------

async def get_revenue_series(db: AsyncSession, date_from: date, date_to: date) -> list[dict]:
    """Monthly completed payments (revenue) and payroll net salaries (expenses)."""
    month_col = func.date_trunc("month", Payment.payment_date)
    revenue_rows = await db.execute(
        select(month_col, func.sum(Payment.amount - Payment.refunded_amount))
        .where(
            Payment.status == "completed",
            func.date(Payment.payment_date) >= _month_start(date_from),
            func.date(Payment.payment_date) <= date_to,
        )
        .group_by(month_col)
    )
    revenue = {row[0].date().replace(day=1): float(row[1] or 0) for row in revenue_rows.all()}

    expense_rows = await db.execute(
        select(Payroll.year, Payroll.month, func.sum(Payroll.net_salary)).group_by(Payroll.year, Payroll.month)
    )
    expenses = {date(row[0], row[1], 1): float(row[2] or 0) for row in expense_rows.all()}

    buckets = _month_buckets(date_from, date_to)
    multi_year = len({b.year for b in buckets}) > 1
    return [
        {
            "month": _month_label(b, multi_year),
            "revenue": revenue.get(b, 0.0),
            "expenses": expenses.get(b, 0.0),
        }
        for b in buckets
    ]


async def get_revenue_totals(db: AsyncSession) -> dict:
    invoiced = float(await _scalar(db, select(func.coalesce(func.sum(Invoice.total_amount), 0))))
    paid = float(await _scalar(db, select(func.coalesce(func.sum(Invoice.paid_amount), 0))))
    return {"total_invoiced": invoiced, "total_paid": paid, "total_pending": invoiced - paid}


# ---------- Occupancy ----------

async def get_occupancy_by_ward(db: AsyncSession) -> list[dict]:
    occupied_count = func.count(Bed.id).filter(BED_OCCUPIED)
    result = await db.execute(
        select(Ward.id, Ward.name, func.count(Bed.id), occupied_count)
        .outerjoin(Bed, Bed.ward_id == Ward.id)
        .group_by(Ward.id, Ward.name)
        .order_by(Ward.name)
    )
    wards = []
    for ward_id, name, total, occupied in result.all():
        wards.append({
            "ward_id": str(ward_id),
            "ward": name,
            "total_beds": total,
            "occupied": occupied,
            "available": total - occupied,
            "occupancy_percent": round(occupied / total * 100, 1) if total else 0,
        })
    return wards


# ---------- Departments ----------

async def get_department_stats(db: AsyncSession) -> list[dict]:
    """Distinct patients seen per department (via appointments) and doctor counts."""
    patients_sub = (
        select(Doctor.department_id.label("dept_id"), func.count(distinct(Appointment.patient_id)).label("patients"))
        .join(Appointment, Appointment.doctor_id == Doctor.id)
        .group_by(Doctor.department_id)
        .subquery()
    )
    doctors_sub = (
        select(Doctor.department_id.label("dept_id"), func.count(Doctor.id).label("doctors"))
        .group_by(Doctor.department_id)
        .subquery()
    )
    result = await db.execute(
        select(
            Department.name,
            func.coalesce(patients_sub.c.patients, 0),
            func.coalesce(doctors_sub.c.doctors, 0),
        )
        .outerjoin(patients_sub, patients_sub.c.dept_id == Department.id)
        .outerjoin(doctors_sub, doctors_sub.c.dept_id == Department.id)
        .order_by(func.coalesce(patients_sub.c.patients, 0).desc(), Department.name)
    )
    return [{"department": name, "patients": patients, "doctors": doctors} for name, patients, doctors in result.all()]


# ---------- Recent activity ----------

async def get_recent_activity(db: AsyncSession, limit: int = 10) -> list[dict]:
    activities: list[dict] = []

    patients = await db.execute(select(Patient).order_by(Patient.created_at.desc()).limit(limit))
    for p in patients.scalars().all():
        activities.append({
            "id": f"patient-{p.id}",
            "type": "patient",
            "description": f"New patient registered - {p.first_name} {p.last_name} ({p.patient_number})",
            "timestamp": p.created_at,
        })

    appts = await db.execute(
        select(Appointment, Patient.first_name, Patient.last_name)
        .join(Patient, Patient.id == Appointment.patient_id)
        .order_by(Appointment.updated_at.desc())
        .limit(limit)
    )
    for apt, first, last in appts.all():
        status = apt.status.value if hasattr(apt.status, "value") else apt.status
        activities.append({
            "id": f"appointment-{apt.id}",
            "type": "appointment",
            "description": f"Appointment {apt.appointment_number} {status.replace('_', ' ')} - {first} {last}",
            "timestamp": apt.updated_at,
        })

    admissions = await db.execute(
        select(IpdAdmission, Patient.first_name, Patient.last_name)
        .join(Patient, Patient.id == IpdAdmission.patient_id)
        .order_by(IpdAdmission.updated_at.desc())
        .limit(limit)
    )
    for adm, first, last in admissions.all():
        discharged = adm.status == "discharged"
        activities.append({
            "id": f"admission-{adm.id}",
            "type": "discharge" if discharged else "admission",
            "description": f"Patient {'discharged' if discharged else 'admitted'} - {first} {last} ({adm.admission_number})",
            "timestamp": adm.discharge_date if discharged and adm.discharge_date else adm.admission_date,
        })

    payments = await db.execute(
        select(Payment, Invoice.invoice_number)
        .join(Invoice, Invoice.id == Payment.invoice_id)
        .order_by(Payment.payment_date.desc())
        .limit(limit)
    )
    for pay, invoice_number in payments.all():
        activities.append({
            "id": f"payment-{pay.id}",
            "type": "billing",
            "description": f"Payment of {float(pay.amount):,.2f} received for {invoice_number}",
            "timestamp": pay.payment_date,
        })

    activities = [a for a in activities if a["timestamp"] is not None]
    activities.sort(key=lambda a: a["timestamp"], reverse=True)
    for a in activities:
        a["timestamp"] = a["timestamp"].isoformat()
    return activities[:limit]


# ---------- Reports ----------

async def get_patient_trends(db: AsyncSession, date_from: date, date_to: date) -> list[dict]:
    """Per month: newly registered patients, and returning patients (existing patients with an appointment)."""
    buckets = _month_buckets(date_from, date_to)
    multi_year = len({b.year for b in buckets}) > 1
    reg_month = func.date_trunc("month", Patient.created_at)
    new_rows = await db.execute(
        select(reg_month, func.count())
        .where(func.date(Patient.created_at) >= buckets[0], func.date(Patient.created_at) <= date_to)
        .group_by(reg_month)
    )
    new_counts = {row[0].date().replace(day=1): row[1] for row in new_rows.all()}

    appt_month = func.date_trunc("month", Appointment.appointment_date)
    returning_rows = await db.execute(
        select(appt_month, func.count(distinct(Appointment.patient_id)))
        .join(Patient, Patient.id == Appointment.patient_id)
        .where(
            Appointment.appointment_date >= buckets[0],
            Appointment.appointment_date <= date_to,
            func.date_trunc("month", Patient.created_at) < appt_month,
        )
        .group_by(appt_month)
    )
    returning = {row[0].date().replace(day=1): row[1] for row in returning_rows.all()}

    return [
        {"month": _month_label(b, multi_year), "new_patients": new_counts.get(b, 0), "returning": returning.get(b, 0)}
        for b in buckets
    ]


async def get_patient_summary(db: AsyncSession, date_from: date, date_to: date) -> dict:
    today = date.today()
    total = await _scalar(db, select(func.count()).select_from(Patient))
    new_in_range = await _scalar(
        db,
        select(func.count()).select_from(Patient).where(
            func.date(Patient.created_at) >= date_from, func.date(Patient.created_at) <= date_to
        ),
    )
    new_this_month = await _scalar(
        db, select(func.count()).select_from(Patient).where(func.date(Patient.created_at) >= _month_start(today))
    )
    returning_in_range = await _scalar(
        db,
        select(func.count(distinct(Appointment.patient_id)))
        .join(Patient, Patient.id == Appointment.patient_id)
        .where(
            Appointment.appointment_date >= date_from,
            Appointment.appointment_date <= date_to,
            func.date(Patient.created_at) < date_from,
        ),
    )
    return {
        "total_patients": total,
        "new_in_range": new_in_range,
        "new_this_month": new_this_month,
        "returning_in_range": returning_in_range,
    }


async def get_attendance_trends(db: AsyncSession, date_from: date, date_to: date) -> dict:
    """Monthly attendance split as percentages, plus current staff/leave counts."""
    buckets = _month_buckets(date_from, date_to)
    multi_year = len({b.year for b in buckets}) > 1
    month_col = func.date_trunc("month", Attendance.date)
    rows = await db.execute(
        select(month_col, Attendance.status, func.count())
        .where(Attendance.date >= buckets[0], Attendance.date <= date_to)
        .group_by(month_col, Attendance.status)
    )
    counts: dict[date, dict[str, int]] = {}
    for month, status, count in rows.all():
        key = month.date().replace(day=1)
        bucket = counts.setdefault(key, {"present": 0, "absent": 0, "leave": 0})
        # half days count toward present; holidays are excluded from the split
        if status in ("present", "half_day"):
            bucket["present"] += count
        elif status == "absent":
            bucket["absent"] += count
        elif status == "leave":
            bucket["leave"] += count

    months = []
    total_present = total_marked = 0
    for b in buckets:
        c = counts.get(b, {"present": 0, "absent": 0, "leave": 0})
        marked = c["present"] + c["absent"] + c["leave"]
        total_present += c["present"]
        total_marked += marked
        months.append({
            "month": _month_label(b, multi_year),
            "present": round(c["present"] / marked * 100, 1) if marked else 0,
            "absent": round(c["absent"] / marked * 100, 1) if marked else 0,
            "leave": round(c["leave"] / marked * 100, 1) if marked else 0,
        })

    today = date.today()
    on_leave = await _scalar(
        db,
        select(func.count(distinct(LeaveRequest.staff_id))).where(
            LeaveRequest.status == "approved",
            and_(LeaveRequest.start_date <= today, LeaveRequest.end_date >= today),
        ),
    )
    return {
        "total_staff": await _scalar(
            db, select(func.count()).select_from(Staff).where(Staff.status.in_(["active", "on_leave"]))
        ),
        "on_leave": on_leave,
        "average_attendance": round(total_present / total_marked * 100, 1) if total_marked else 0,
        "months": months,
    }

