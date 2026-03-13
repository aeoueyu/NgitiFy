import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Import ang ating Layout Component
import DashboardLayout from './components/layout/DashboardLayout';

// ========================================================
// TAMANG IMPORTS BASE SA MGA FILES SA FOLDER MO
// ========================================================
import OwnerDashboard from './pages/owner/OwnerDashboard';
import ManageDentists from './pages/owner/ManageDentists'; 
import FinancialReports from './pages/owner/FinancialReports';
import SystemAuditLogs from './pages/owner/SystemAuditLogs';

function App() {
  return (
    <Router>
      <Routes>
        {/* I-redirect ang user sa owner dashboard pagbukas pa lang ng app */}
        <Route path="/" element={<Navigate to="/owner/dashboard" replace />} />

        {/* LAHAT NG PAGES SA LOOB NG LAYOUT NA ITO AY MAY SIDEBAR */}
        <Route element={<DashboardLayout />}>
          
          <Route path="/owner/dashboard" element={<OwnerDashboard />} />
          
          {/* Kinabit ko muna ang ManageDentists para sa Manage Staff route */}
          <Route path="/owner/manage-staff" element={<ManageDentists />} /> 
          <Route path="/owner/financial-reports" element={<FinancialReports />} />
          <Route path="/owner/audit-logs" element={<SystemAuditLogs />} />

        </Route>

      </Routes>
    </Router>
  );
}

export default App;