import React from 'react';
import { Navigate } from 'react-router-dom';

export default function UserManagement() {
    // TASK 4.1 UPDATE: 
    // To resolve the "Double Tab" issue, UserTabs.js is now the single source of truth 
    // located inside the individual Manage files. This file now cleanly acts as an 
    // index redirect for the base '/admin/manage-users' route.
    return <Navigate to="/admin/manage-users/dentists" replace />;
}