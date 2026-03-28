import React, { createContext, useState, useEffect } from 'react';
import { User } from '../models/User';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check local storage for an existing session on app load
    const storedUser = localStorage.getItem('ngitify_user');
    if (storedUser) {
      setCurrentUser(new User(JSON.parse(storedUser)));
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    // TODO: Replace with actual backend API call.
    // Simulating Previous Repo's login validation logic:
    const mockUser = new User({
      id: 'usr_001',
      firstName: 'Admin',
      lastName: 'Owner',
      email: email,
      role: 'owner', // Defaulting to owner for current active routes
    });
    
    setCurrentUser(mockUser);
    localStorage.setItem('ngitify_user', JSON.stringify(mockUser));
    return mockUser;
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('ngitify_user');
  };

  const value = {
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