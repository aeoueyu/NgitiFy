// ngitify-web/src/App.js
import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './routes/ProtectedRoute';

import DashboardLayout from './components/layout/DashboardLayout';

import WebsiteHome from './pages/website/WebsiteHome';
import LoginPage from './pages/auth/LoginPage';

const ForgotPassPage = lazy(() => import('./pages/auth/ForgotPassPage'));
const VerificationCodePage = lazy(() => import('./pages/auth/VerificationCodePage'));
const NewPasswordPage = lazy(() => import('./pages/auth/NewPasswordPage'));
const NewPasswordRedirectPage = lazy(() => import('./pages/auth/NewPasswordRedirectPage'));
const ActivateAccountPage = lazy(() => import('./pages/auth/ActivateAccountPage'));

// Pages - Admin
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminAppointments = lazy(() => import('./pages/admin/AdminAppointments'));
const ManageDentists = lazy(() => import('./pages/admin/ManageDentists'));
const ManageSecretaries = lazy(() => import('./pages/admin/ManageSecretaries'));
const ManagePatients = lazy(() => import('./pages/admin/ManagePatients'));
const AuditTrail = lazy(() => import('./pages/admin/AuditTrail'));
const AddDentist = lazy(() => import('./pages/admin/AddDentist'));
const AddSecretary = lazy(() => import('./pages/admin/AddSecretary'));
const AddPatient = lazy(() => import('./pages/admin/AddPatient'));
const EditDentist = lazy(() => import('./pages/admin/EditDentist'));
const InventoryTracker = lazy(() => import('./pages/admin/InventoryTracker'));
const AdminProfile = lazy(() => import('./pages/admin/AdminProfile'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'));
const AppointmentNotifications = lazy(() => import('./pages/admin/AppointmentNotifications'));

// ✅ PHASE 2: New admin pages
const ManageBranchManagers = lazy(() => import('./pages/admin/ManageBranchManagers'));
const AddBranchManager = lazy(() => import('./pages/admin/AddBranchManager'));
const ManageCoAdmins = lazy(() => import('./pages/admin/ManageCoAdmins'));
const AddCoAdmin = lazy(() => import('./pages/admin/AddCoAdmin'));
const EditBranchManager = lazy(() => import('./pages/admin/EditBranchManager'));
const EditCoAdmin = lazy(() => import('./pages/admin/EditCoAdmin'));
const AdminPatientEMR = lazy(() => import('./pages/admin/PatientEMR'));
const SystemConfig = lazy(() => import('./pages/admin/SystemConfig'));

// Pages - Dentist
const DentistDashboard = lazy(() => import('./pages/dentist/DentistDashboard'));
const DentistAppointments = lazy(() => import('./pages/dentist/DentistAppointments'));
const PatientEMR = lazy(() => import('./pages/dentist/PatientEMR'));

// Pages - Secretary
const SecretaryDashboard = lazy(() => import('./pages/secretary/SecretaryDashboard'));
const SecretaryAppointments = lazy(() => import('./pages/secretary/SecretaryAppointments'));

const PageLoader = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100vw', backgroundColor: '#f4f7f6', color: '#01538b', fontFamily: 'sans-serif' }}>
    <h2>Loading...</h2>
  </div>
);

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Router>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public & Authentication Routes */}
              <Route path="/" element={<WebsiteHome />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/forgot-password" element={<ForgotPassPage />} />
              <Route path="/verification-code" element={<VerificationCodePage />} />
              <Route path="/new-password" element={<NewPasswordPage />} />
              <Route path="/password-reset-success" element={<NewPasswordRedirectPage />} />
              <Route path="/activate-account/:token" element={<ActivateAccountPage />} />

              {/* Protected Routes - Dentist Area */}
              <Route element={<ProtectedRoute allowedRoles={['dentist']}/>}>
                <Route element={<DashboardLayout />}>
                  <Route path="/dentist/dashboard" element={<DentistDashboard />} />
                  <Route path="/dentist/appointments" element={<DentistAppointments />} />
                  <Route path="/dentist/profile" element={<AdminProfile />} />
                  <Route path="/dentist/patients/:patientId/emr" element={<PatientEMR />} />
                </Route>
              </Route>

              {/* Protected Routes - Secretary Area */}
              <Route element={<ProtectedRoute allowedRoles={['secretary']}/>}>
                <Route element={<DashboardLayout />}>
                  <Route path="/secretary/dashboard" element={<SecretaryDashboard />} />
                  <Route path="/secretary/appointments" element={<SecretaryAppointments />} />
                  <Route path="/secretary/profile" element={<AdminProfile />} />
                  <Route path="/secretary/settings" element={<AdminSettings />} />
                  <Route path="/secretary/patients" element={<ManagePatients />} />
                  <Route path="/secretary/inventory" element={<InventoryTracker />} />
                </Route>
              </Route>

              {/* Protected Routes - Administrator Area */}
              <Route element={<ProtectedRoute allowedRoles={['administrator', 'co-administrator', 'branch-manager']} />}>
                <Route element={<DashboardLayout />}>
                  <Route path="/admin/dashboard" element={<AdminDashboard />} />
                  <Route path="/admin/profile" element={<AdminProfile />} />
                  <Route path="/admin/settings" element={<AdminSettings />} />
                  <Route path="/admin/appointments" element={<AdminAppointments />} />
                  <Route path="/admin/appointment-notifications" element={<AppointmentNotifications />} />
                  <Route path="/admin/audit-trail" element={<AuditTrail />} />
                  <Route path="/admin/inventory" element={<InventoryTracker />} />

                  {/* User Management */}
                  <Route path="/admin/manage-users" element={<Navigate to="/admin/manage-users/dentists" replace />} />
                  <Route path="/admin/manage-users/dentists" element={<ManageDentists />} />
                  <Route path="/admin/manage-users/secretaries" element={<ManageSecretaries />} />
                  <Route path="/admin/manage-users/patients" element={<ManagePatients />} />
                  <Route path="/admin/manage-users/branch-managers" element={<ManageBranchManagers />} />
                  <Route path="/admin/manage-users/co-admins" element={<ManageCoAdmins />} />

                  {/* Add/Edit staff */}
                  <Route path="/admin/add-dentist" element={<AddDentist />} />
                  <Route path="/admin/edit-dentist" element={<EditDentist />} />
                  <Route path="/admin/add-secretary" element={<AddSecretary />} />
                  <Route path="/admin/add-patient" element={<AddPatient />} />
                  <Route path="/admin/add-branch-manager" element={<AddBranchManager />} />
                  <Route path="/admin/add-co-admin" element={<AddCoAdmin />} />

                  {/* ✅ PHASE 2: Admin EMR */}
                  <Route path="/admin/patients/:patientId/emr" element={<AdminPatientEMR />} />

                  {/* ✅ PHASE 2: System Config */}
                  <Route path="/admin/system-config" element={<SystemConfig />} />

                  {/* Stubs for Phase 3+ (uncomment as you build them) */}
                  {/* <Route path="/admin/queue" element={<QueueManagement />} /> */}
                  {/* <Route path="/admin/notifications" element={<Notifications />} /> */}
                  {/* <Route path="/admin/branches" element={<BranchManagement />} /> */}
                  {/* <Route path="/admin/roles" element={<RolesPermissions />} /> */}
                  {/* <Route path="/admin/backup" element={<DatabaseBackup />} /> */}
                  {/* <Route path="/admin/chat-support" element={<ChatSupport />} /> */}
                  {/* <Route path="/admin/integrity" element={<IntegrityTools />} /> */}
                </Route>
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </Router>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;