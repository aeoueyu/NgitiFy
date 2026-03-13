import logo from './logo.svg';
import './App.css';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import WebsiteHome from './pages/website/WebsiteHome';
import LoginPage from './pages/auth/LoginPage';
import ForgotPassPage from './pages/auth/ForgotPassPage';
import VerificationCodePage from './pages/auth/VerificationCodePage';
import NewPasswordPage from './pages/auth/NewPasswordPage';
import NewPasswordRedirectPage from './pages/auth/NewPasswordRedirectPage';


function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<WebsiteHome/>}/>
        <Route path="/login" element={<LoginPage/>}/>
        <Route path="/forgot-password" element={<ForgotPassPage/>}/>
        <Route path="/verification-code" element={<VerificationCodePage/>}/>
        <Route path="/new-password" element={<NewPasswordPage/>}/>
        <Route path="/redirecting" element={<NewPasswordRedirectPage/>}/>
      </Routes>
    </Router>
  );
}

export default App;
