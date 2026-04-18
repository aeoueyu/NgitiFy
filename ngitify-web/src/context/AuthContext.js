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
    // ✅ Remove the else block entirely — don't wipe tokens on a race condition

    setLoading(false);
  }, []);

  // Update login to accept the userData object passed from LoginPage.js
  const login = async (userData) => {
    
    // Task 13 & 14 Fix: Hydrate the User model with the FULL REAL data
    const loggedInUser = new User({
      id: userData.userId,
      email: userData.userEmail || userData.email,
      role: userData.role,
      firstName: userData.name?.first || '',
      lastName: userData.name?.last || '',
      profileImage: userData.profileImage || '',
      permissions: userData.permissions || {}
    });
    
    setCurrentUser(loggedInUser);
    
    // Store the user object for UI purposes (Token is already saved in LoginPage.js)
    localStorage.setItem('ngitify_user', JSON.stringify(loggedInUser));
  };

  const logout = async () => {
    try {
      await authFetch('/logout', {
        method: 'POST',
        body: JSON.stringify({ email: currentUser?.email, role: currentUser?.role })
      });
    } catch (e) { /* silent fail — still log out locally even if server is unreachable */ }
    setCurrentUser(null);
    localStorage.removeItem('ngitify_user');
    localStorage.removeItem('token');
  };

  const value = {
    user: currentUser, // Exposed as 'user' so MyProfile.js (const { user } = useAuth()) works perfectly!
    currentUser,       // Kept for backwards compatibility if your other files use it
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