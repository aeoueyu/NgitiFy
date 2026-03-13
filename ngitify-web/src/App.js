import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import WebsiteHome from './pages/website/WebsiteHome';
import LoginPage from './pages/auth/LoginPage';
import ForgotPassPage from './pages/auth/ForgotPassPage';
import VerificationCodePage from './pages/auth/VerificationCodePage';
import NewPasswordPage from './pages/auth/NewPasswordPage';
import NewPasswordRedirectPage from './pages/auth/NewPasswordRedirectPage';

// Import natin yung gagawin nating Owner Dashboard
import OwnerDashboard from './pages/owner/OwnerDashboard';
import DentistDashboard from './pages/dentist/DentistDashboard';



function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<WebsiteHome />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPassPage />} />
        <Route path="/verify-code" element={<VerificationCodePage />} />
        <Route path="/new-password" element={<NewPasswordPage />} />
        <Route path="/password-success" element={<NewPasswordRedirectPage />} />

        {/* --- TEMPORARY OPEN ROUTES PARA SA DASHBOARDS (NO SECURITY YET) --- */}
        <Route path="/owner-dashboard" element={<OwnerDashboard />} />
        <Route path="/dentist-dashboard" element={<DentistDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;