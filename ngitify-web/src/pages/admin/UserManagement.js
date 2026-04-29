import React from 'react';
import { Navigate } from 'react-router-dom';

export default function UserManagement() {
    return <Navigate to="/admin/manage-users/patients" replace />;
}