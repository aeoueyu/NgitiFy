import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const ProtectedRoute = ({ allowedRoles }) => {
  const { currentUser, isAuthenticated } = useAuth();

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Redirect to their specific dashboard if role is unauthorized for this route
  if (allowedRoles && !allowedRoles.includes(currentUser?.role)) {
    return <Navigate to={`/${currentUser.role}/dashboard`} replace />;
  }

  // Authorized: Render the children components (via Outlet)
  return <Outlet />;
};

export default ProtectedRoute;