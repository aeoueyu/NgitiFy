import React, { createContext, useState, useEffect } from 'react';
import { User } from '../models/User';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check local storage for BOTH the user object and the JWT token
    const storedUser = localStorage.getItem('ngitify_user');
    const token = localStorage.getItem('token');

    // Only hydrate the session if both exist
    if (storedUser && token) {
      setCurrentUser(new User(JSON.parse(storedUser)));
    } else {
      // Safety cleanup if they somehow get out of sync
      localStorage.removeItem('ngitify_user');
      localStorage.removeItem('token');
    }
    
    setLoading(false);
  }, []);

  // Update login to accept the userData object passed from LoginPage.js
  const login = async (userData) => {
    
    // Hydrate the User model with the REAL data from your backend
    const loggedInUser = new User({
      id: userData.userId,
      email: userData.userEmail,
      role: userData.role,
    });
    
    setCurrentUser(loggedInUser);
    
    // Store the user object for UI purposes (Token is already saved in LoginPage.js)
    localStorage.setItem('ngitify_user', JSON.stringify(loggedInUser));
  };

  const logout = () => {
    setCurrentUser(null);
    // Remove BOTH the user object and the JWT token on logout
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