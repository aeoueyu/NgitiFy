import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';

// Layouts
import DashboardLayout from './components/layout/DashboardLayout';

// Auth & Public Pages
import LoginPage from './pages/auth/LoginPage';
import WebsiteHome from './pages/website/WebsiteHome';

// Pages - Owner
import OwnerDashboard from './pages/owner/OwnerDashboard';
import ManageStaff from './pages/owner/ManageStaff'; 
import FinancialReports from './pages/owner/FinancialReports';
import SystemAuditLogs from './pages/owner/SystemAuditLogs';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<WebsiteHome />} />
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Routes - Owner Area */}
          <Route element={<ProtectedRoute allowedRoles={['owner']} />}>
            <Route element={<DashboardLayout />}>
              <Route path="/owner/dashboard" element={<OwnerDashboard />} />
              <Route path="/owner/manage-staff" element={<ManageStaff />} /> 
              <Route path="/owner/financial-reports" element={<FinancialReports />} />
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