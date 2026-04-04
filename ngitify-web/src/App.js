import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';

// Layouts
import DashboardLayout from './components/layout/DashboardLayout';

// Auth & Public Pages
import WebsiteHome from './pages/website/WebsiteHome';
import LoginPage from './pages/auth/LoginPage';
import ForgotPassPage from './pages/auth/ForgotPassPage';
import VerificationCodePage from './pages/auth/VerificationCodePage';
import NewPasswordPage from './pages/auth/NewPasswordPage';
import NewPasswordRedirectPage from './pages/auth/NewPasswordRedirectPage';

// Pages - Owner
import OwnerDashboard from './pages/owner/OwnerDashboard';
import ManageDentists from './pages/owner/ManageDentists';
import ManageSecretaries from './pages/owner/ManageSecretaries';
import ManagePatients from './pages/owner/ManagePatients';
import SystemAuditLogs from './pages/owner/SystemAuditLogs';

import AddDentist from './pages/owner/AddDentist';
import AddSecretary from './pages/owner/AddSecretary';
import AddPatient from './pages/owner/AddPatient';
import EditDentist from './pages/owner/EditDentist';
import InventoryTracker from './pages/owner/InventoryTracker';

import MyProfile from './pages/owner/MyProfile';
import Settings from './pages/owner/Settings';



function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public & Authentication Routes */}
          <Route path="/" element={<WebsiteHome />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPassPage />} />
          <Route path="/verification-code" element={<VerificationCodePage />} />
          <Route path="/new-password" element={<NewPasswordPage />} />
          <Route path="/password-reset-success" element={<NewPasswordRedirectPage />} />

          {/* Protected Routes - Owner Area */}
          <Route element={<ProtectedRoute allowedRoles={['owner']} />}>
            <Route element={<DashboardLayout />}>
              <Route path="/owner/dashboard" element={<OwnerDashboard />} />

              <Route path="/owner/profile" element={<MyProfile />} />
              <Route path="/owner/settings" element={<Settings />} />
              
              {/* UPDATED: URL-based Routing for User Management Tabs */}
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
      </Router>
    </AuthProvider>
  );
}

export default App;