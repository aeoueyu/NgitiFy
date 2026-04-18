import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './routes/ProtectedRoute';

// Layouts (Loaded eagerly to prevent UI shifts)
import DashboardLayout from './components/layout/DashboardLayout';

// Auth & Public Pages (Loaded eagerly for immediate first paint)
import WebsiteHome from './pages/website/WebsiteHome';
import LoginPage from './pages/auth/LoginPage';

// --- TASK 23: LAZY LOADED ROUTES ---
const ForgotPassPage = lazy(() => import('./pages/auth/ForgotPassPage'));
const VerificationCodePage = lazy(() => import('./pages/auth/VerificationCodePage'));
const NewPasswordPage = lazy(() => import('./pages/auth/NewPasswordPage'));
const NewPasswordRedirectPage = lazy(() => import('./pages/auth/NewPasswordRedirectPage'));

// Pages - Admin (Formerly Owner)
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminAppointments = lazy(() => import('./pages/admin/AdminAppointments')); 
const ManageDentists = lazy(() => import('./pages/admin/ManageDentists'));
const ManageSecretaries = lazy(() => import('./pages/admin/ManageSecretaries'));
const ManagePatients = lazy(() => import('./pages/admin/ManagePatients'));
const AuditTrail = lazy(() => import('./pages/admin/AuditTrail')); // Renamed

const AddDentist = lazy(() => import('./pages/admin/AddDentist'));
const AddSecretary = lazy(() => import('./pages/admin/AddSecretary'));
const AddPatient = lazy(() => import('./pages/admin/AddPatient'));
const EditDentist = lazy(() => import('./pages/admin/EditDentist'));
const InventoryTracker = lazy(() => import('./pages/admin/InventoryTracker'));

const AdminProfile = lazy(() => import('./pages/admin/AdminProfile'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'));
const AppointmentNotifications = lazy(() => import('./pages/admin/AppointmentNotifications'));

// Pages - Dentist
const DentistDashboard = lazy(() => import('./pages/dentist/DentistDashboard'));
const DentistAppointments = lazy(() => import('./pages/dentist/DentistAppointments'));
const PatientEMR = lazy(() => import('./pages/dentist/PatientEMR')); 

// Pages - Secretary 
const SecretaryDashboard = lazy(() => import('./pages/secretary/SecretaryDashboard'));
const SecretaryAppointments = lazy(() => import('./pages/secretary/SecretaryAppointments'));

// Add import at the top with other lazy imports
const ActivateAccountPage = lazy(() => import('./pages/auth/ActivateAccountPage'));

// Simple Full-Screen Loader for Suspense Fallback
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
                  
                  {/* Appointments Route */}
                  <Route path="/admin/appointments" element={<AdminAppointments />} />
                  
                  {/* URL-based Routing for User Management Tabs */}
                  <Route path="/admin/manage-users" element={<Navigate to="/admin/manage-users/dentists" replace />} />
                  <Route path="/admin/manage-users/dentists" element={<ManageDentists />} /> 
                  <Route path="/admin/manage-users/secretaries" element={<ManageSecretaries />} />
                  <Route path="/admin/manage-users/patients" element={<ManagePatients />} />
                  
                  {/* Add/Edit specific routes kept for deep linking */}
                  <Route path="/admin/add-dentist" element={<AddDentist />} /> 
                  <Route path="/admin/edit-dentist" element={<EditDentist />} /> 
                  <Route path="/admin/add-secretary" element={<AddSecretary />} />
                  <Route path="/admin/add-patient" element={<AddPatient />} />
                  
                  <Route path="/admin/audit-trail" element={<AuditTrail />} />
                  <Route path="/admin/inventory" element={<InventoryTracker />} />

                  <Route path="/admin/appointment-notifications" element={<AppointmentNotifications />} />

                  {/* NEW ADMIN ROUTES (Placeholders for upcoming phases) */}
                  {/* <Route path="/admin/queue" element={<QueueManagement />} /> */}
                  {/* <Route path="/admin/notifications" element={<Notifications />} /> */}
                  {/* <Route path="/admin/branches" element={<BranchManagement />} /> */}
                  {/* <Route path="/admin/roles" element={<RolesPermissions />} /> */}
                  {/* <Route path="/admin/backup" element={<DatabaseBackup />} /> */}
                  {/* <Route path="/admin/chat-support" element={<ChatSupport />} /> */}
                  {/* <Route path="/admin/integrity" element={<IntegrityTools />} /> */}
                  {/* <Route path="/admin/system-config" element={<SystemConfig />} /> */}
                </Route>
              </Route>

              {/* Fallback Redirect */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </Router>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;