import { createBrowserRouter } from 'react-router-dom';
import MainLayout from '../components/layout/MainLayout';
import ProtectedRoute from '../features/auth/ProtectedRoute';
import RoleGuard from '../features/auth/RoleGuard';
import NotFoundPage from '../features/errors/NotFoundPage';
import UserListPage from '../features/users/UserListPage';
import ProfilePage from '../features/account/ProfilePage';
import DepartmentListPage from '../features/departments/DepartmentListPage';
import CategoryListPage from '../features/pharmacy/CategoryListPage';
import LeavePage from '../features/staff/LeavePage';
import InsuranceClaimsPage from '../features/billing/InsuranceClaimsPage';
import AuditLogPage from '../features/audit/AuditLogPage';
import SettingsPage from '../features/settings/SettingsPage';
import AdmissionDetailPage from '../features/ipd/AdmissionDetailPage';
import AppointmentDetailPage from '../features/appointments/AppointmentDetailPage';
import LoginPage from '../features/auth/LoginPage';
import DashboardPage from '../features/dashboard/DashboardPage';
import PatientListPage from '../features/patients/PatientListPage';
import PatientDetailPage from '../features/patients/PatientDetailPage';
import PatientForm from '../features/patients/PatientForm';
import DoctorListPage from '../features/doctors/DoctorListPage';
import DoctorForm from '../features/doctors/DoctorForm';
import AppointmentListPage from '../features/appointments/AppointmentListPage';
import BookAppointmentForm from '../features/appointments/BookAppointmentForm';
import OpdListPage from '../features/opd/OpdListPage';
import OpdVisitForm from '../features/opd/OpdVisitForm';
import IpdListPage from '../features/ipd/IpdListPage';
import AdmissionForm from '../features/ipd/AdmissionForm';
import WardOverview from '../features/ipd/WardOverview';
import MedicineListPage from '../features/pharmacy/MedicineListPage';
import DispensationPage from '../features/pharmacy/DispensationPage';
import LabRequestListPage from '../features/laboratory/LabRequestListPage';
import TestCatalogPage from '../features/laboratory/TestCatalogPage';
import InvoiceListPage from '../features/billing/InvoiceListPage';
import InvoiceForm from '../features/billing/InvoiceForm';
import InvoiceDetail from '../features/billing/InvoiceDetail';
import StaffListPage from '../features/staff/StaffListPage';
import AttendancePage from '../features/staff/AttendancePage';
import PayrollPage from '../features/staff/PayrollPage';
import NotificationList from '../features/notifications/NotificationList';
import ReportsPage from '../features/reports/ReportsPage';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <MainLayout />,
        children: [
          { path: '/', element: <DashboardPage /> },

          // Patients
          { path: '/patients', element: <PatientListPage /> },
          { path: '/patients/new', element: <PatientForm /> },
          { path: '/patients/:id', element: <PatientDetailPage /> },
          { path: '/patients/:id/edit', element: <PatientForm /> },

          // Doctors
          { path: '/doctors', element: <DoctorListPage /> },
          {
            element: <RoleGuard roles={['admin']} />,
            children: [
              { path: '/doctors/new', element: <DoctorForm /> },
              { path: '/doctors/:id/edit', element: <DoctorForm /> },
            ],
          },

          // Appointments
          { path: '/appointments', element: <AppointmentListPage /> },
          { path: '/appointments/book', element: <BookAppointmentForm /> },
          {
            element: <RoleGuard roles={['admin', 'doctor', 'nurse', 'receptionist']} />,
            children: [{ path: '/appointments/:id', element: <AppointmentDetailPage /> }],
          },

          // OPD
          {
            element: <RoleGuard roles={['admin', 'doctor', 'nurse', 'receptionist']} />,
            children: [
              { path: '/opd', element: <OpdListPage /> },
              { path: '/opd/new', element: <OpdVisitForm /> },
              { path: '/opd/:id', element: <OpdVisitForm /> },
            ],
          },

          // IPD
          {
            element: <RoleGuard roles={['admin', 'doctor', 'nurse']} />,
            children: [
              { path: '/ipd', element: <IpdListPage /> },
              { path: '/ipd/wards', element: <WardOverview /> },
              { path: '/ipd/admissions/:id', element: <AdmissionDetailPage /> },
            ],
          },
          {
            element: <RoleGuard roles={['admin', 'doctor', 'receptionist']} />,
            children: [{ path: '/ipd/admit', element: <AdmissionForm /> }],
          },

          // Pharmacy
          {
            element: <RoleGuard roles={['admin', 'pharmacist', 'doctor']} />,
            children: [{ path: '/pharmacy', element: <MedicineListPage /> }],
          },
          {
            element: <RoleGuard roles={['admin', 'pharmacist']} />,
            children: [
              { path: '/pharmacy/dispense', element: <DispensationPage /> },
              { path: '/pharmacy/categories', element: <CategoryListPage /> },
            ],
          },

          // Laboratory
          {
            element: <RoleGuard roles={['admin', 'lab_tech', 'doctor']} />,
            children: [
              { path: '/laboratory', element: <LabRequestListPage /> },
              { path: '/laboratory/catalog', element: <TestCatalogPage /> },
            ],
          },

          // Billing
          {
            element: <RoleGuard roles={['admin', 'receptionist']} />,
            children: [
              { path: '/billing', element: <InvoiceListPage /> },
              { path: '/billing/new', element: <InvoiceForm /> },
              { path: '/billing/claims', element: <InsuranceClaimsPage /> },
              { path: '/billing/:id', element: <InvoiceDetail /> },
            ],
          },

          // Staff & Reports (admin)
          {
            element: <RoleGuard roles={['admin']} />,
            children: [
              { path: '/staff', element: <StaffListPage /> },
              { path: '/staff/attendance', element: <AttendancePage /> },
              { path: '/staff/leave', element: <LeavePage /> },
              { path: '/staff/payroll', element: <PayrollPage /> },
              { path: '/reports', element: <ReportsPage /> },
              { path: '/users', element: <UserListPage /> },
              { path: '/departments', element: <DepartmentListPage /> },
              { path: '/audit-logs', element: <AuditLogPage /> },
              { path: '/settings', element: <SettingsPage /> },
            ],
          },

          { path: '/notifications', element: <NotificationList /> },
          { path: '/profile', element: <ProfilePage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
