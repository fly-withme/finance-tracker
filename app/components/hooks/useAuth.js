'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasPassword, setHasPassword] = useState(false);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = () => {
    setIsLoading(true);
    
    // Check if password is set up
    const passwordHash = localStorage.getItem('finance_password_hash');
    setHasPassword(!!passwordHash);
    
    if (!passwordHash) {
      // No password set up yet, user needs to set one up
      setIsAuthenticated(false);
      setIsLoading(false);
      return;
    }

    // Check if user is authenticated in this session
    const isSessionValid = sessionStorage.getItem('finance_authenticated');
    setIsAuthenticated(!!isSessionValid);
    setIsLoading(false);
  };

  const login = () => {
    sessionStorage.setItem('finance_authenticated', 'true');
    setIsAuthenticated(true);
  };

  const logout = () => {
    sessionStorage.removeItem('finance_authenticated');
    setIsAuthenticated(false);
  };

  const setupPassword = () => {
    setHasPassword(true);
    // After password setup, user is automatically logged in
    login();
  };

  const resetPassword = () => {
    // Password reset doesn't change authentication state immediately
    // User still needs to login with new password
    logout();
  };

  const value = {
    isAuthenticated,
    isLoading,
    hasPassword,
    login,
    logout,
    setupPassword,
    resetPassword,
    checkAuthStatus
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};