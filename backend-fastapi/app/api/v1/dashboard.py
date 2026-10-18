from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.dashboard import (
    AttendanceReport,
    DashboardStats,
    DepartmentStat,
    PatientReport,
    RecentActivity,
    RevenueReport,
    TodayAppointment,
    WardOccupancy,
)
from app.services import dashboard_service

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats")
async def get_stats(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stats = await dashboard_service.get_dashboard_stats(db)
    return {"success": True, "data": DashboardStats.model_validate(stats)}


@router.get("/today-appointments")
async def get_today_appointments(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    items = await dashboard_service.get_today_appointments(db)
    return {"success": True, "data": [TodayAppointment.model_validate(i) for i in items]}


@router.get("/revenue")
async def get_revenue(
    period: str | None = Query(None, pattern=r"^\d+months$", description="e.g. 12months"),
    date_from: date | None = None,
    date_to: date | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    start, end = dashboard_service.resolve_range(period, date_from, date_to, default_months=12)
    series = await dashboard_service.get_revenue_series(db, start, end)
    totals = await dashboard_service.get_revenue_totals(db)
    return {"success": True, "data": RevenueReport.model_validate({"series": series, "totals": totals})}


@router.get("/occupancy")
async def get_occupancy(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    wards = await dashboard_service.get_occupancy_by_ward(db)
    return {"success": True, "data": [WardOccupancy.model_validate(w) for w in wards]}


@router.get("/department-stats")
async def get_department_stats(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stats = await dashboard_service.get_department_stats(db)
    return {"success": True, "data": [DepartmentStat.model_validate(s) for s in stats]}


@router.get("/recent-activity")
async def get_recent_activity(
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    activities = await dashboard_service.get_recent_activity(db, limit=limit)
    return {"success": True, "data": [RecentActivity.model_validate(a) for a in activities]}


@router.get("/patient-trends")
async def get_patient_trends(
    period: str | None = Query(None, pattern=r"^\d+months$"),
    date_from: date | None = None,
    date_to: date | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    start, end = dashboard_service.resolve_range(period, date_from, date_to, default_months=6)
    series = await dashboard_service.get_patient_trends(db, start, end)
    summary = await dashboard_service.get_patient_summary(db, start, end)
    return {"success": True, "data": PatientReport.model_validate({"series": series, "summary": summary})}


@router.get("/attendance-trends")
async def get_attendance_trends(
    period: str | None = Query(None, pattern=r"^\d+months$"),
    date_from: date | None = None,
    date_to: date | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    start, end = dashboard_service.resolve_range(period, date_from, date_to, default_months=6)
    report = await dashboard_service.get_attendance_trends(db, start, end)
    return {"success": True, "data": AttendanceReport.model_validate(report)}
