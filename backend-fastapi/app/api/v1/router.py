from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.patients import router as patients_router
from app.api.v1.doctors import router as doctors_router
from app.api.v1.doctors import departments_router
from app.api.v1.appointments import router as appointments_router
from app.api.v1.opd import router as opd_router
from app.api.v1.ipd import router as ipd_router
from app.api.v1.pharmacy import router as pharmacy_router
from app.api.v1.laboratory import router as laboratory_router
from app.api.v1.billing import router as billing_router
from app.api.v1.staff import router as staff_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.users import router as users_router
from app.api.v1.audit import router as audit_router
from app.api.v1.settings import router as settings_router

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth_router)
api_router.include_router(patients_router)
api_router.include_router(doctors_router)
api_router.include_router(departments_router)
api_router.include_router(appointments_router)
api_router.include_router(opd_router)
api_router.include_router(ipd_router)
api_router.include_router(pharmacy_router)
api_router.include_router(laboratory_router)
api_router.include_router(billing_router)
api_router.include_router(staff_router)
api_router.include_router(notifications_router)
api_router.include_router(dashboard_router)
api_router.include_router(users_router)
api_router.include_router(audit_router)
api_router.include_router(settings_router)
