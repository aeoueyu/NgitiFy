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

// Pages - Owner
const OwnerDashboard = lazy(() => import('./pages/owner/OwnerDashboard'));
const Appointments = lazy(() => import('./pages/owner/Appointments')); 
const ManageDentists = lazy(() => import('./pages/owner/ManageDentists'));
const ManageSecretaries = lazy(() => import('./pages/owner/ManageSecretaries'));
const ManagePatients = lazy(() => import('./pages/owner/ManagePatients'));
const SystemAuditLogs = lazy(() => import('./pages/owner/SystemAuditLogs'));

const AddDentist = lazy(() => import('./pages/owner/AddDentist'));
const AddSecretary = lazy(() => import('./pages/owner/AddSecretary'));
const AddPatient = lazy(() => import('./pages/owner/AddPatient'));
const EditDentist = lazy(() => import('./pages/owner/EditDentist'));
const InventoryTracker = lazy(() => import('./pages/owner/InventoryTracker'));

const MyProfile = lazy(() => import('./pages/owner/MyProfile'));
const Settings = lazy(() => import('./pages/owner/Settings'));

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
                  <Route path="/dentist/profile" element={<MyProfile />} /> 
                  <Route path="/dentist/patients/:patientId/emr" element={<PatientEMR />} />
                </Route>
              </Route>

              {/* Protected Routes - Secretary Area */}
              <Route element={<ProtectedRoute allowedRoles={['secretary']}/>}>
                <Route element={<DashboardLayout />}>
                  <Route path="/secretary/dashboard" element={<SecretaryDashboard />} />
                  <Route path="/secretary/appointments" element={<SecretaryAppointments />} />
                  <Route path="/secretary/profile" element={<MyProfile />} />
                  <Route path="/secretary/settings" element={<Settings />} />
                  <Route path="/secretary/patients" element={<ManagePatients />} />
                  <Route path="/secretary/inventory" element={<InventoryTracker />} />
                </Route>
              </Route>

              {/* Protected Routes - Owner Area */}
              <Route element={<ProtectedRoute allowedRoles={['owner', 'co-owner']} />}>
                <Route element={<DashboardLayout />}>
                  <Route path="/owner/dashboard" element={<OwnerDashboard />} />

                  <Route path="/owner/profile" element={<MyProfile />} />
                  <Route path="/owner/settings" element={<Settings />} />
                  
                  {/* Appointments Route */}
                  <Route path="/owner/appointments" element={<Appointments />} />
                  
                  {/* URL-based Routing for User Management Tabs */}
                  <Route path="/owner/manage-users" element={<Navigate to="/owner/manage-users/dentists" replace />} />
                  <Route path="/owner/manage-users/dentists" element={<ManageDentists />} /> 
                  <Route path="/owner/manage-users/secretaries" element={<ManageSecretaries />} />
                  <Route path="/owner/manage-users/patients" element={<ManagePatients />} />
                  
                  {/* Add/Edit specific routes kept for deep linking */}
                  <Route path="/owner/add-dentist" element={<AddDentist />} /> 
                  <Route path="/owner/edit-dentist" element={<EditDentist />} /> 
                  <Route path="/owner/add-secretary" element={<AddSecretary />} />
                  <Route path="/owner/add-patient" element={<AddPatient />} />
                  
                  <Route path="/owner/audit-logs" element={<SystemAuditLogs />} />
                  <Route path="/owner/inventory" element={<InventoryTracker />} />
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