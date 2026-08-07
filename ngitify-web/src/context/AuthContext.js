import React, { createContext, useState, useEffect } from 'react';
import { User } from '../models/User';
import { authFetch } from '../utils/api';

export const AuthContext = createContext();

const getUserIdFromToken = (token = '') => {
  try {
    const [, payload] = token.split('.');
    if (!payload) return '';
    const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decodedPayload = JSON.parse(window.atob(normalizedPayload));
    return decodedPayload.id || decodedPayload.userId || decodedPayload._id || '';
  } catch {
    return '';
  }
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const restoreSession = async () => {
      const storedUser = localStorage.getItem('ngitify_user');
      const token = localStorage.getItem('token');

      if (!storedUser || !token) {
        setLoading(false);
        return;
      }

      try {
        const parsedUser = JSON.parse(storedUser);
        const restoredUser = new User(parsedUser);
        const tokenUserId = getUserIdFromToken(token);
        const userId = tokenUserId || restoredUser.id || restoredUser.userId || restoredUser._id;

        if (!userId) {
          throw new Error('Missing stored user id.');
        }

        const response = await authFetch(`/user/${userId}`);
        if (!response.ok) {
          throw new Error('Session is no longer valid.');
        }

        const liveUser = await response.json();
        setCurrentUser(new User({
          ...parsedUser,
          id: liveUser._id || parsedUser.id,
          email: liveUser.email || parsedUser.email,
          role: liveUser.role || parsedUser.role,
          firstName: liveUser.name?.first || parsedUser.firstName || '',
          lastName: liveUser.name?.last || parsedUser.lastName || '',
          profileImage: liveUser.profileImage || parsedUser.profileImage || '',
          assignedBranch: liveUser.assignedBranch || liveUser.assignedBranches?.[0] || parsedUser.assignedBranch || null,
          isDentist: typeof liveUser.isDentist === 'boolean' ? liveUser.isDentist : parsedUser.isDentist || false,
        }));
      } catch (error) {
        localStorage.removeItem('ngitify_user');
        localStorage.removeItem('token');
        setCurrentUser(null);
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
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
      assignedBranch: userData.assignedBranch || userData.assignedBranches?.[0] || null,
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
