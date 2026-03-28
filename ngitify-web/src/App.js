import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Layouts
import DashboardLayout from './components/layout/DashboardLayout';

// Pages - Owner
import OwnerDashboard from './pages/owner/OwnerDashboard';
import ManageStaff from './pages/owner/ManageStaff'; 
import FinancialReports from './pages/owner/FinancialReports';
import SystemAuditLogs from './pages/owner/SystemAuditLogs';

function App() {
  return (
    <Router>
      <Routes>
        {/* Default Redirect */}
        <Route path="/" element={<Navigate to="/owner/dashboard" replace />} />

        {/* Dashboard Layout Wrapper */}
        <Route element={<DashboardLayout />}>
          <Route path="/owner/dashboard" element={<OwnerDashboard />} />
          <Route path="/owner/manage-staff" element={<ManageStaff />} /> 
          <Route path="/owner/financial-reports" element={<FinancialReports />} />
          <Route path="/owner/audit-logs" element={<SystemAuditLogs />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;