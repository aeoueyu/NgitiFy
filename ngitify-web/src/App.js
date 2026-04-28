import React, { Suspense, lazy, useEffect } from 'react';
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
const QueueManagement = lazy(() => import('./pages/admin/QueueManagement'));
const Notifications = lazy(() => import('./pages/admin/Notifications'));
const RolesPermissions = lazy(() => import('./pages/admin/RolesPermissions'));
const BranchManagement = lazy(() => import('./pages/admin/BranchManagement'));
const BranchAnalytics  = lazy(() => import('./pages/admin/BranchAnalytics'));
const ChatSupport = lazy(() => import('./pages/admin/ChatSupport'));
const DatabaseBackup = lazy(() => import('./pages/admin/DatabaseBackup'));
const IntegrityTools = lazy(() => import('./pages/admin/IntegrityTools'));
const ActivityLogs = lazy(() => import('./pages/admin/ActivityLogs'));

// Pages - Dentist
const DentistDashboard = lazy(() => import('./pages/dentist/DentistDashboard'));
const DentistAppointments = lazy(() => import('./pages/dentist/DentistAppointments'));
const DentistPatientEMR = lazy(() => import('./pages/dentist/PatientEMR'));
const DentistEMRList = lazy(() => import('./pages/dentist/DentistEMRList'));
const DentistNotifications = lazy(() => import('./pages/dentist/Notifications'));
const DentistActivityLogs  = lazy(() => import('./pages/dentist/ActivityLogs'));
const DentistMaterialUsage = lazy(() => import('./pages/dentist/MaterialUsageLog'));
const DentistOdontogram    = lazy(() => import('./pages/dentist/DentistOdontogramPage'));
const DentistSettings      = lazy(() => import('./pages/dentist/DentistSettings'));

// Pages - Secretary
const SecretaryDashboard    = lazy(() => import('./pages/secretary/SecretaryDashboard'));
const SecretaryAppointments = lazy(() => import('./pages/secretary/SecretaryAppointments'));
const SecretaryPatients     = lazy(() => import('./pages/secretary/SecretaryPatients'));
const SecretaryAddPatient   = lazy(() => import('./pages/secretary/SecretaryAddPatient'));
const SecretaryEditPatient  = lazy(() => import('./pages/secretary/SecretaryEditPatient'));
const SecretaryViewPatient  = lazy(() => import('./pages/secretary/SecretaryViewPatient'));
const SecretaryPatientEMR   = lazy(() => import('./pages/secretary/SecretaryPatientEMR'));
const SecretaryQueue        = lazy(() => import('./pages/secretary/SecretaryQueue'));
const SecretaryChatSupport  = lazy(() => import('./pages/secretary/SecretaryChatSupport'));
const SecretaryNotifications = lazy(() => import('./pages/secretary/SecretaryNotifications'));
const SecretaryActivityLogs = lazy(() => import('./pages/secretary/SecretaryActivityLogs'));
const SecretarySettings     = lazy(() => import('./pages/secretary/SecretarySettings'));

// Pages - Branch Manager
const BranchManagerDashboard = lazy(() => import('./pages/branch-manager/BranchManagerDashboard'));
const BranchManagerAppointments = lazy(() => import('./pages/branch-manager/BranchManagerAppointments'));
const BranchManagerManageUsers = lazy(() => import('./pages/branch-manager/BranchManagerManageUsers'));
const BranchManagerQueue = lazy(() => import('./pages/branch-manager/BranchManagerQueue'));
const BranchManagerChatSupport = lazy(() => import('./pages/branch-manager/BranchManagerChatSupport'));
const BranchManagerAnalytics = lazy(() => import('./pages/branch-manager/BranchManagerAnalytics'));
const BranchManagerPatientEMR = lazy(() => import('./pages/branch-manager/BranchManagerPatientEMR'));
const BranchManagerActivityLogs = lazy(() => import('./pages/admin/ActivityLogs'));
const BranchManagerNotifications = lazy(() => import('./pages/admin/Notifications'));

// ✅ PHASE 3: Owner pages
const OwnerDashboard = lazy(() => import('./pages/owner/OwnerDashboard'));
const ManageOwners = lazy(() => import('./pages/admin/ManageOwners'));


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
              <Route path="/login" element={<LoginPage />} />
              <Route path="/forgot-password" element={<ForgotPassPage />} />
              <Route path="/verification-code" element={<VerificationCodePage />} />
              <Route path="/new-password" element={<NewPasswordPage />} />
              <Route path="/password-reset-success" element={<NewPasswordRedirectPage />} />
              <Route path="/activate-account/:token" element={<ActivateAccountPage />} />

              {/* Protected Routes - Dentist Area */}
              <Route element={<ProtectedRoute allowedRoles={['dentist']}/>}>
                <Route element={<DashboardLayout />}>
                  <Route path="/dentist/dashboard"               element={<DentistDashboard />} />
                  <Route path="/dentist/appointments"            element={<DentistAppointments />} />
                  <Route path="/dentist/emr"                     element={<DentistEMRList />} />
                  <Route path="/dentist/patients/:patientId/emr" element={<DentistPatientEMR />} />
                  <Route path="/dentist/material-usage"          element={<DentistMaterialUsage />} />
                  <Route path="/dentist/odontogram"              element={<DentistOdontogram />} />
                  <Route path="/dentist/notifications"           element={<DentistNotifications />} />
                  <Route path="/dentist/activity-logs"           element={<DentistActivityLogs />} />
                  <Route path="/dentist/profile"                 element={<AdminProfile />} />
                  <Route path="/dentist/settings"                element={<DentistSettings />} />
                  <Route path="/dentist/inventory"               element={<InventoryTracker />} />
                </Route>
              </Route>

              {/* Protected Routes - Branch Manager Area */}
              <Route element={<ProtectedRoute allowedRoles={['branch-manager']} />}>
                <Route element={<DashboardLayout />}>
                  <Route path="/branch-manager/dashboard"   element={<BranchManagerDashboard />} />
                  <Route path="/branch-manager/appointments" element={<BranchManagerAppointments />} />
                  <Route path="/branch-manager/manage-users" element={<BranchManagerManageUsers />} />
                  <Route path="/branch-manager/queue"        element={<BranchManagerQueue />} />
                  <Route path="/branch-manager/chat-support" element={<BranchManagerChatSupport />} />
                  <Route path="/branch-manager/analytics"    element={<BranchManagerAnalytics />} />
                  <Route path="/branch-manager/activity-logs" element={<BranchManagerActivityLogs />} />
                  <Route path="/branch-manager/notifications" element={<BranchManagerNotifications />} />
                  <Route path="/branch-manager/inventory"    element={<InventoryTracker />} />
                  <Route path="/branch-manager/profile"      element={<AdminProfile />} />
                  <Route path="/branch-manager/settings"     element={<AdminSettings />} />
                  <Route path="/branch-manager/patients/:patientId/emr" element={<BranchManagerPatientEMR />} />
                </Route>
              </Route>

              {/* ✅ PHASE 3: Protected Routes - Owner Area */}
              <Route element={<ProtectedRoute allowedRoles={['owner']} />}>
                <Route element={<DashboardLayout />}>
                  <Route path="/owner"                              element={<Navigate to="/owner/dashboard" replace />} />
                  <Route path="/owner/dashboard"                    element={<OwnerDashboard />} />
                  <Route path="/owner/appointments"                 element={<AdminAppointments />} />
                  <Route path="/owner/manage-users"                 element={<Navigate to="/owner/manage-users/dentists" replace />} />
                  <Route path="/owner/manage-users/dentists"        element={<ManageDentists />} />
                  <Route path="/owner/manage-users/secretaries"     element={<ManageSecretaries />} />
                  <Route path="/owner/manage-users/patients"        element={<ManagePatients />} />
                  <Route path="/owner/patients/:patientId/emr"      element={<AdminPatientEMR />} />
                  <Route path="/owner/branches"                     element={<BranchManagement />} />
                  <Route path="/owner/branches/analytics"           element={<BranchAnalytics />} />
                  <Route path="/owner/inventory"                    element={<InventoryTracker />} />
                  <Route path="/owner/notifications"                element={<Notifications />} />
                  <Route path="/owner/activity-logs"                element={<ActivityLogs />} />
                  <Route path="/owner/profile"                      element={<AdminProfile />} />
                  <Route path="/owner/settings"                     element={<AdminSettings />} />
                  <Route path="/owner/roles"                        element={<RolesPermissions />} />
                  <Route path="/owner/system-config"                element={<SystemConfig />} />  {/* ✅ owner system config */}
                </Route>
              </Route>

              {/* Protected Routes - Secretary Area */}
              <Route element={<ProtectedRoute allowedRoles={['secretary']}/>}>
                <Route element={<DashboardLayout />}>
                  <Route path="/secretary/dashboard"                    element={<SecretaryDashboard />} />
                  <Route path="/secretary/appointments"                 element={<SecretaryAppointments />} />
                  <Route path="/secretary/patients"                     element={<SecretaryPatients />} />
                  <Route path="/secretary/patients/add"                 element={<SecretaryAddPatient />} />
                  <Route path="/secretary/patients/:patientId/edit"     element={<SecretaryEditPatient />} />
                  <Route path="/secretary/patients/:patientId"          element={<SecretaryViewPatient />} />
                  <Route path="/secretary/patients/:patientId/emr"      element={<SecretaryPatientEMR />} />
                  <Route path="/secretary/queue"                        element={<SecretaryQueue />} />
                  <Route path="/secretary/chat-support"                 element={<SecretaryChatSupport />} />
                  <Route path="/secretary/notifications"                element={<SecretaryNotifications />} />
                  <Route path="/secretary/activity-logs"                element={<SecretaryActivityLogs />} />
                  <Route path="/secretary/profile"                      element={<AdminProfile />} />
                  <Route path="/secretary/settings"                     element={<SecretarySettings />} />
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
                  <Route path="/admin/manage-users/owners" element={<ManageOwners />} />   {/* ✅ PHASE 3 */}

                  {/* Add/Edit staff */}
                  <Route path="/admin/add-dentist" element={<AddDentist />} />
                  <Route path="/admin/add-secretary" element={<AddSecretary />} />
                  <Route path="/admin/add-patient" element={<AddPatient />} />
                  <Route path="/admin/add-branch-manager" element={<AddBranchManager />} />
                  <Route path="/admin/add-co-admin" element={<AddCoAdmin />} />

                  {/* ✅ PHASE 2: Admin EMR */}
                  <Route path="/admin/patients/:patientId/emr" element={<AdminPatientEMR />} />

                  {/* ✅ PHASE 2: System Config */}
                  <Route path="/admin/system-config" element={<SystemConfig />} />

                  {/* Stubs for Phase 3+ (uncomment as you build them) */}
                  <Route path="/admin/queue" element={<QueueManagement />} />
                  <Route path="/admin/notifications" element={<Notifications />} />
                  <Route path="/admin/branches" element={<BranchManagement />} />
                  <Route path="/admin/branches/analytics" element={<BranchAnalytics />} />
                  <Route path="/admin/roles" element={<RolesPermissions />} />
                  <Route path="/admin/backup" element={<DatabaseBackup />} />
                  <Route path="/admin/chat-support" element={<ChatSupport />} />
                  <Route path="/admin/integrity" element={<IntegrityTools />} />
                  <Route path="/admin/activity-logs" element={<ActivityLogs />} />
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