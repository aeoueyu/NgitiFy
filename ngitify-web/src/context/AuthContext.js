import React, { createContext, useState, useEffect } from 'react';
import { User } from '../models/User';
import { authFetch } from '../utils/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('ngitify_user');
    const token = localStorage.getItem('token');

    if (storedUser && token) {
        setCurrentUser(new User(JSON.parse(storedUser)));
    }

    setLoading(false);
  }, []);

  const login = async (userData) => {
    const loggedInUser = new User({
      id: userData.userId,
      email: userData.userEmail || userData.email,
      role: userData.role,
      firstName: userData.name?.first || '',
      lastName: userData.name?.last || '',
      profileImage: userData.profileImage || '',
      permissions: userData.permissions || {},
      assignedBranch: userData.assignedBranch || null,
      isDentist: userData.isDentist || false,   // ✅ PHASE 3
    });
    
    setCurrentUser(loggedInUser);
    localStorage.setItem('ngitify_user', JSON.stringify(loggedInUser));
  };

  const logout = async (reason = 'user_initiated') => {
    try {
      await authFetch('/logout', {
        method: 'POST',
        body: JSON.stringify({ email: currentUser?.email, role: currentUser?.role, reason })
      });
    } catch (e) { /* silent fail */ }
    setCurrentUser(null);
    localStorage.removeItem('ngitify_user');
    localStorage.removeItem('token');
  };

  const value = {
    user: currentUser,
    currentUser,
    login,
    logout,
    isAuthenticated: !!currentUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};