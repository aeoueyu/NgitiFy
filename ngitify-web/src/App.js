import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './routes/ProtectedRoute';

import DashboardLayout from './components/layout/DashboardLayout';

import WebsiteHome from './pages/website/WebsiteHome';
import WebsiteAbout from './pages/website/WebsiteAbout';
import WebsiteServices from './pages/website/WebsiteServices';
import WebsiteContact from './pages/website/WebsiteContact';
import WebsiteAppointment from './pages/website/WebsiteAppointment';
import PreRegisterPage from './pages/PreRegisterPage';
import LoginPage from './pages/auth/LoginPage';

const ForgotPassPage = lazy(() => import('./pages/auth/ForgotPassPage'));
const VerificationCodePage = lazy(() => import('./pages/auth/VerificationCodePage'));
const NewPasswordPage = lazy(() => import('./pages/auth/NewPasswordPage'));
const NewPasswordRedirectPage = lazy(() => import('./pages/auth/NewPasswordRedirectPage'));
const ActivateAccountPage = lazy(() => import('./pages/auth/ActivateAccountPage'));

// Pages - Admin
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AppointmentsPage = lazy(() => import('./pages/shared/AppointmentsPage'));
const SchedulePage = lazy(() => import('./pages/shared/SchedulePage'));
const PatientEMRPage = lazy(() => import('./pages/shared/PatientEMRPage'));
const SharedActivityLogsPage = lazy(() => import('./pages/shared/ActivityLogsPage'));
const SharedNotificationsPage = lazy(() => import('./pages/shared/NotificationsPage'));
const ProfilePage = lazy(() => import('./pages/shared/ProfilePage'));
const SettingsPage = lazy(() => import('./pages/shared/SettingsPage'));
const PatientRecordsPage = lazy(() => import('./pages/shared/PatientRecordsPage'));
const ManageDentists = lazy(() => import('./pages/admin/ManageDentists'));
const ManageSecretaries = lazy(() => import('./pages/admin/ManageSecretaries'));
const ManagePatients = lazy(() => import('./pages/admin/ManagePatients'));
const AuditTrail = lazy(() => import('./pages/admin/AuditTrail'));
const AddDentist = lazy(() => import('./pages/admin/AddDentist'));
const AddSecretary = lazy(() => import('./pages/admin/AddSecretary'));
const AddPatient = lazy(() => import('./pages/admin/AddPatient'));
const InventoryTracker = lazy(() => import('./pages/admin/InventoryTracker'));
const AdminProfile = lazy(() => import('./pages/admin/AdminProfile'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'));
const AppointmentNotifications = lazy(() => import('./pages/admin/AppointmentNotifications'));

// ✅ PHASE 2: New admin pages
const ManageBranchManagers = lazy(() => import('./pages/admin/ManageBranchManagers'));
const ManageOwners = lazy(() => import('./pages/admin/ManageOwners'));
const AddBranchManager = lazy(() => import('./pages/admin/AddBranchManager'));
const AdminPatientEMR = lazy(() => import('./pages/admin/PatientEMR'));
const SystemConfig = lazy(() => import('./pages/admin/SystemConfig'));
const Notifications = lazy(() => import('./pages/admin/Notifications'));
const RolesPermissions = lazy(() => import('./pages/admin/RolesPermissions'));
const BranchManagement = lazy(() => import('./pages/admin/BranchManagement'));
const BranchAnalytics  = lazy(() => import('./pages/admin/BranchAnalytics'));
const DatabaseBackup = lazy(() => import('./pages/admin/DatabaseBackup'));
const IntegrityTools = lazy(() => import('./pages/admin/IntegrityTools'));
const ArchiveReview = lazy(() => import('./pages/admin/ArchiveReview'));
const ActivityLogs = lazy(() => import('./pages/admin/ActivityLogs'));
const AdminAIAssistant = lazy(() => import('./pages/admin/CoAdminAIAssistant'));

// Pages - Dentist
const DentistDashboard = lazy(() => import('./pages/dentist/DentistDashboard'));
const DentistPatientEMR = lazy(() => import('./pages/dentist/PatientEMR'));
const DentistNotifications = lazy(() => import('./pages/dentist/Notifications'));
const DentistActivityLogs  = lazy(() => import('./pages/dentist/ActivityLogs'));
const DentistMaterialUsage = lazy(() => import('./pages/dentist/MaterialUsageLog'));
const DentistSettings      = lazy(() => import('./pages/dentist/DentistSettings'));
const DentistAIAssistant   = lazy(() => import('./pages/dentist/DentistAIAssistant'));

// Pages - Secretary
const SecretaryDashboard    = lazy(() => import('./pages/secretary/SecretaryDashboard'));
const SecretaryPatients     = lazy(() => import('./pages/secretary/SecretaryPatients'));
const SecretaryAddPatient   = lazy(() => import('./pages/secretary/SecretaryAddPatient'));
const SecretaryEditPatient  = lazy(() => import('./pages/secretary/SecretaryEditPatient'));
const SecretaryViewPatient  = lazy(() => import('./pages/secretary/SecretaryViewPatient'));
const SecretaryPatientEMR   = lazy(() => import('./pages/secretary/SecretaryPatientEMR'));
const SecretaryNotifications = lazy(() => import('./pages/secretary/SecretaryNotifications'));
const SecretaryActivityLogs = lazy(() => import('./pages/secretary/SecretaryActivityLogs'));
const SecretarySettings     = lazy(() => import('./pages/secretary/SecretarySettings'));

// Pages - Branch Manager
const BranchManagerDashboard = lazy(() => import('./pages/branch-manager/BranchManagerDashboard'));
const BranchManagerAnalytics = lazy(() => import('./pages/branch-manager/BranchManagerAnalytics'));
const BranchManagerPatientEMR = lazy(() => import('./pages/branch-manager/BranchManagerPatientEMR'));
const BranchManagerActivityLogs = lazy(() => import('./pages/admin/ActivityLogs'));
const BranchManagerNotifications = lazy(() => import('./pages/admin/Notifications'));
const BranchManagerAIAssistant = lazy(() => import('./pages/branch-manager/BranchManagerAIAssistant'));

// ✅ PHASE 3: Owner pages
const OwnerDashboard = lazy(() => import('./pages/owner/OwnerDashboard'));
const OwnerAIAssistant = lazy(() => import('./pages/owner/OwnerAIAssistant'));

// Pages - Patient
const PatientDashboard = lazy(() => import('./pages/patient/PatientDashboard'));
const PatientOralCare = lazy(() => import('./pages/patient/PatientOralCare'));
const PatientEditProfile = lazy(() => import('./pages/patient/PatientEditProfile'));


const PageLoader = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100vw', backgroundColor: '#f4f7f6', color: '#01538b', fontFamily: 'sans-serif' }}>
    <h2>Loading...</h2>
  </div>
);

function App() {

  useEffect(() => {
    const savedTheme = localStorage.getItem('ngitify-theme') || 'system';
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  return (
    <AuthProvider>
      <ToastProvider>
        <Router>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public & Authentication Routes */}
              <Route path="/" element={<WebsiteHome />} />
              <Route path="/about" element={<WebsiteAbout />} />
              <Route path="/services" element={<WebsiteServices />} />
              <Route path="/locations" element={<Navigate to="/about#locations" replace />} />
              <Route path="/contact-us" element={<WebsiteContact />} />
              <Route path="/appointment" element={<WebsiteAppointment />} />
              <Route path="/pre-register" element={<PreRegisterPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/forgot-password" element={<ForgotPassPage />} />
              <Route path="/verification-code" element={<VerificationCodePage />} />
              <Route path="/new-password" element={<NewPasswordPage />} />
              <Route path="/password-reset-success" element={<NewPasswordRedirectPage />} />
              <Route path="/activate-account/:token" element={<ActivateAccountPage />} />

              {/* Protected Routes - Patient Area */}
              <Route element={<ProtectedRoute allowedRoles={['patient']} />}>
                  <Route element={<DashboardLayout />}>
                  <Route path="/patient" element={<Navigate to="/patient/dashboard" replace />} />
                  <Route path="/patient/dashboard" element={<PatientDashboard />} />
                  <Route path="/patient/appointments" element={<AppointmentsPage />} />
                  <Route path="/patient/book" element={<Navigate to="/patient/appointments?mode=book" replace />} />
                  <Route path="/patient/records" element={<PatientRecordsPage />} />
                  <Route path="/patient/oral-care" element={<PatientOralCare />} />
                  <Route path="/patient/notifications" element={<SharedNotificationsPage />} />
                  <Route path="/patient/profile" element={<ProfilePage />} />
                  <Route path="/patient/profile/edit" element={<PatientEditProfile />} />
                  <Route path="/patient/settings" element={<SettingsPage />} />
                  <Route path="/patient/activity-logs" element={<SharedActivityLogsPage />} />
                  <Route
                    path="/patient/ai-companion"
                    element={<Navigate to="/patient/dashboard" replace state={{ openPatientAi: true }} />}
                  />
                </Route>
              </Route>

              {/* Protected Routes - Dentist Area */}
              <Route element={<ProtectedRoute allowedRoles={['dentist']}/>}>
                <Route element={<DashboardLayout />}>
                  <Route path="/dentist/dashboard"               element={<DentistDashboard />} />
                  <Route path="/dentist/appointments"            element={<Navigate to="/dentist/schedule" replace />} />
                  <Route path="/dentist/schedule"                element={<SchedulePage />} />
                  <Route path="/dentist/emr"                     element={<Navigate to="/dentist/patients" replace />} />
                  <Route path="/dentist/patient-emr"             element={<Navigate to="/dentist/patients" replace />} />
                  <Route path="/dentist/patients"                element={<ManagePatients />} />
                  <Route path="/dentist/patients/:patientId/emr" element={<DentistPatientEMR />} />
                  <Route path="/dentist/material-usage"          element={<DentistMaterialUsage />} />
                  <Route path="/dentist/odontogram"              element={<Navigate to="/dentist/patients" replace />} />
                  <Route path="/dentist/notifications"           element={<DentistNotifications />} />
                  <Route path="/dentist/activity-logs"           element={<DentistActivityLogs />} />
                  <Route path="/dentist/ai-assistant"            element={<DentistAIAssistant />} />
                  <Route path="/dentist/profile"                 element={<AdminProfile />} />
                  <Route path="/dentist/settings"                element={<DentistSettings />} />
                  <Route path="/dentist/inventory"               element={<Navigate to="/dentist/material-usage" replace />} />
                </Route>
              </Route>

              {/* Protected Routes - Branch Manager Area */}
              <Route element={<ProtectedRoute allowedRoles={['branch-manager']} />}>
                <Route element={<DashboardLayout />}>
                  <Route path="/branch-manager/dashboard"   element={<BranchManagerDashboard />} />
                  <Route path="/branch-manager/appointments" element={<Navigate to="/branch-manager/schedule" replace />} />
                  <Route path="/branch-manager/schedule"     element={<SchedulePage />} />
                  <Route path="/branch-manager/manage-users" element={<Navigate to="/branch-manager/manage-staffs/secretaries" replace />} />
                  <Route path="/branch-manager/manage-users/*" element={<Navigate to="/branch-manager/manage-staffs/secretaries" replace />} />
                  <Route path="/branch-manager/manage-staffs" element={<Navigate to="/branch-manager/manage-staffs/secretaries" replace />} />
                  <Route path="/branch-manager/manage-staffs/dentists" element={<ManageDentists />} />
                  <Route path="/branch-manager/manage-staffs/secretaries" element={<ManageSecretaries />} />
                  <Route path="/branch-manager/patients"     element={<ManagePatients />} />
                  <Route path="/branch-manager/queue"        element={<Navigate to="/branch-manager/schedule" replace />} />
                  <Route path="/branch-manager/branches"     element={<Navigate to="/branch-manager/dashboard" replace />} />
                  <Route path="/branch-manager/analytics"    element={<BranchManagerAnalytics />} />
                  <Route path="/branch-manager/activity-logs" element={<BranchManagerActivityLogs />} />
                  <Route path="/branch-manager/notifications" element={<BranchManagerNotifications />} />
                  <Route path="/branch-manager/ai-assistant" element={<BranchManagerAIAssistant />} />
                  <Route path="/branch-manager/inventory"    element={<InventoryTracker />} />
                  <Route path="/branch-manager/profile"      element={<AdminProfile />} />
                  <Route path="/branch-manager/settings"     element={<AdminSettings />} />
                  <Route path="/branch-manager/patient-emr"  element={<Navigate to="/branch-manager/patients" replace />} />
                  <Route path="/branch-manager/patients/:patientId/emr" element={<BranchManagerPatientEMR />} />
                </Route>
              </Route>

              {/* ✅ PHASE 3: Protected Routes - Owner Area */}
              <Route element={<ProtectedRoute allowedRoles={['owner']} />}>
                <Route element={<DashboardLayout />}>
                  <Route path="/owner"                              element={<Navigate to="/owner/dashboard" replace />} />
                  <Route path="/owner/dashboard"                    element={<OwnerDashboard />} />
                  <Route path="/owner/appointments"                 element={<Navigate to="/owner/schedule" replace />} />
                  <Route path="/owner/schedule"                     element={<SchedulePage />} />
                  <Route path="/owner/manage-users"                 element={<Navigate to="/owner/manage-staffs/secretaries" replace />} />
                  <Route path="/owner/manage-users/*"               element={<Navigate to="/owner/manage-staffs/secretaries" replace />} />
                  <Route path="/owner/manage-staffs"                element={<Navigate to="/owner/manage-staffs/secretaries" replace />} />
                  <Route path="/owner/manage-staffs/dentists"       element={<ManageDentists />} />
                  <Route path="/owner/manage-staffs/secretaries"    element={<ManageSecretaries />} />
                  <Route path="/owner/manage-staffs/patients"       element={<Navigate to="/owner/patients" replace />} />
                  <Route path="/owner/patients"                     element={<ManagePatients />} />
                  <Route path="/owner/manage-staffs/branch-managers" element={<ManageBranchManagers />} />
                  <Route path="/owner/manage-staffs/owners"          element={<Navigate to="/owner/manage-staffs/secretaries" replace />} />
                  <Route path="/owner/patients/:patientId/emr"      element={<AdminPatientEMR />} />
                  <Route path="/owner/patient-emr"                  element={<PatientEMRPage />} />
                  <Route path="/owner/material-usage"               element={<DentistMaterialUsage />} />
                  <Route path="/owner/branches"                     element={<BranchManagement />} />
                  <Route path="/owner/branches/analytics"           element={<BranchAnalytics />} />
                  <Route path="/owner/inventory"                    element={<InventoryTracker />} />
                  <Route path="/owner/notifications"                element={<Notifications />} />
                  <Route path="/owner/activity-logs"                element={<ActivityLogs />} />
                  <Route path="/owner/ai-assistant"                 element={<OwnerAIAssistant />} />
                  <Route path="/owner/profile"                      element={<AdminProfile />} />
                  <Route path="/owner/settings"                     element={<AdminSettings />} />
                  <Route path="/owner/roles"                        element={<RolesPermissions />} />
                </Route>
              </Route>

              {/* Protected Routes - Secretary Area */}
              <Route element={<ProtectedRoute allowedRoles={['secretary']}/>}>
                <Route element={<DashboardLayout />}>
                  <Route path="/secretary/dashboard"                    element={<SecretaryDashboard />} />
                  <Route path="/secretary/appointments"                 element={<Navigate to="/secretary/schedule" replace />} />
                  <Route path="/secretary/schedule"                     element={<SchedulePage />} />
                  <Route path="/secretary/patients"                     element={<SecretaryPatients />} />
                  <Route path="/secretary/patients/add"                 element={<SecretaryAddPatient />} />
                  <Route path="/secretary/patients/:patientId/edit"     element={<SecretaryEditPatient />} />
                  <Route path="/secretary/patients/:patientId"          element={<SecretaryViewPatient />} />
                  <Route path="/secretary/patient-emr"                 element={<Navigate to="/secretary/patients" replace />} />
                  <Route path="/secretary/patients/:patientId/emr"      element={<SecretaryPatientEMR />} />
                  <Route path="/secretary/queue"                        element={<Navigate to="/secretary/schedule" replace />} />
                  <Route path="/secretary/notifications"                element={<SecretaryNotifications />} />
                  <Route path="/secretary/activity-logs"                element={<SecretaryActivityLogs />} />
                  <Route path="/secretary/profile"                      element={<AdminProfile />} />
                  <Route path="/secretary/settings"                     element={<SecretarySettings />} />
                </Route>
              </Route>

              {/* Protected Routes - Administrator Area */}
              <Route element={<ProtectedRoute allowedRoles={['administrator']} />}>
                <Route element={<DashboardLayout />}>
                  <Route path="/admin/dashboard" element={<AdminDashboard />} />
                  <Route path="/admin/profile" element={<AdminProfile />} />
                  <Route path="/admin/settings" element={<AdminSettings />} />
                  <Route path="/admin/appointments" element={<Navigate to="/admin/schedule" replace />} />
                  <Route path="/admin/schedule" element={<SchedulePage />} />
                  <Route path="/admin/appointment-notifications" element={<AppointmentNotifications />} />
                  <Route path="/admin/audit-trail" element={<AuditTrail />} />
                  <Route path="/admin/inventory" element={<InventoryTracker />} />

                  {/* User Management */}
                  <Route path="/admin/manage-users" element={<Navigate to="/admin/manage-staffs/secretaries" replace />} />
                  <Route path="/admin/manage-users/*" element={<Navigate to="/admin/manage-staffs/secretaries" replace />} />
                  <Route path="/admin/manage-staffs" element={<Navigate to="/admin/manage-staffs/secretaries" replace />} />
                  <Route path="/admin/manage-staffs/dentists" element={<ManageDentists />} />
                  <Route path="/admin/manage-staffs/secretaries" element={<ManageSecretaries />} />
                  <Route path="/admin/manage-staffs/patients" element={<Navigate to="/admin/patients" replace />} />
                  <Route path="/admin/patients" element={<ManagePatients />} />
                  <Route path="/admin/manage-staffs/branch-managers" element={<ManageBranchManagers />} />
                  <Route path="/admin/manage-staffs/owners" element={<ManageOwners />} />

                  {/* Add/Edit staff */}
                  <Route path="/admin/add-dentist" element={<AddDentist />} />
                  <Route path="/admin/add-secretary" element={<AddSecretary />} />
                  <Route path="/admin/add-patient" element={<AddPatient />} />
                  <Route path="/admin/add-branch-manager" element={<AddBranchManager />} />

                  {/* ✅ PHASE 2: Admin EMR */}
                  <Route path="/admin/patient-emr" element={<Navigate to="/admin/patients" replace />} />
                  <Route path="/admin/patients/:patientId/emr" element={<AdminPatientEMR />} />

                  {/* ✅ PHASE 2: System Config */}
                  <Route path="/admin/system-config" element={<SystemConfig />} />

                  {/* Stubs for Phase 3+ (uncomment as you build them) */}
                  <Route path="/admin/queue" element={<Navigate to="/admin/schedule" replace />} />
                  <Route path="/admin/notifications" element={<Notifications />} />
                  <Route path="/admin/branches" element={<BranchManagement />} />
                  <Route path="/admin/branches/analytics" element={<BranchAnalytics />} />
                  <Route path="/admin/roles" element={<RolesPermissions />} />
                  <Route path="/admin/backup" element={<DatabaseBackup />} />
                  <Route path="/admin/archive-review" element={<ArchiveReview />} />
                  <Route path="/admin/integrity" element={<IntegrityTools />} />
                  <Route path="/admin/activity-logs" element={<ActivityLogs />} />
                  <Route path="/admin/ai-assistant" element={<AdminAIAssistant />} />
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

