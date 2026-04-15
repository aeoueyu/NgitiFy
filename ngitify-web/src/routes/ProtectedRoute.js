import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const ProtectedRoute = ({ allowedRoles }) => {
  // TASK 3.3 UPDATE: Destructure `user` to match the AuthContext export used across the app
  const { user, isAuthenticated } = useAuth();

  // Redirect to login if not authenticated or if the user object hasn't loaded
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // Redirect to their specific dashboard if role is unauthorized for this route
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Determine the safest fallback path based on their actual role
    let fallbackPath = '/login';
    
    switch (user.role) {
      case 'administrator':
        case 'co-administrator':
        case 'branch-manager':
            fallbackPath = '/admin/dashboard';
            break;
        case 'dentist':
            fallbackPath = '/dentist/dashboard';
            break;
        case 'secretary':
            fallbackPath = '/secretary/dashboard';
            break;
        default:
            fallbackPath = '/login';
    }

    return <Navigate to={fallbackPath} replace />;
  }

  // Authorized: Render the child components (via Outlet)
  return <Outlet />;
};

export default ProtectedRoute;