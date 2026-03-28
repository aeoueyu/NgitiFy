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
import ManageStaff from './pages/owner/ManageStaff'; 
import SystemAuditLogs from './pages/owner/SystemAuditLogs';

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
              <Route path="/owner/manage-staff" element={<ManageStaff />} /> 
              <Route path="/owner/audit-logs" element={<SystemAuditLogs />} />
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