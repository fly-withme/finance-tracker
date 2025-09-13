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
    const hasSetPassword = !!passwordHash;
    setHasPassword(hasSetPassword);
    
    // Debug logging
    console.log('🔍 AUTH STATUS CHECK:');
    console.log('Password hash exists:', !!passwordHash);
    console.log('Password hash value:', passwordHash);
    
    if (!hasSetPassword) {
      // No password set up yet, user needs to set one up
      console.log('👤 No password set up - showing setup');
      setIsAuthenticated(false);
      setIsLoading(false);
      return;
    }

    // Check authentication in both session and persistent storage
    const isSessionValid = sessionStorage.getItem('finance_authenticated') === 'true';
    const isPersistentValid = localStorage.getItem('finance_authenticated_persistent') === 'true';
    const authTimestamp = localStorage.getItem('finance_auth_timestamp');
    
    console.log('Session auth:', isSessionValid);
    console.log('Persistent auth:', isPersistentValid);
    console.log('Auth timestamp:', authTimestamp);
    
    // Check if persistent auth is still valid (30 days)
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const isPersistentStillValid = authTimestamp && parseInt(authTimestamp) > thirtyDaysAgo;
    
    console.log('Persistent still valid:', isPersistentStillValid);
    
    // User is authenticated if either session is valid OR persistent auth is still valid
    const authenticated = isSessionValid || (isPersistentValid && isPersistentStillValid);
    
    console.log('Final authenticated status:', authenticated);
    
    // If persistent auth is valid but session is not, restore session
    if (!isSessionValid && isPersistentValid && isPersistentStillValid) {
      console.log('🔄 Restoring session from persistent auth');
      sessionStorage.setItem('finance_authenticated', 'true');
    }
    
    setIsAuthenticated(authenticated);
    setIsLoading(false);
  };

  const login = (rememberMe = true) => {
    // Always set session storage for current session
    sessionStorage.setItem('finance_authenticated', 'true');
    
    // Set persistent authentication if user wants to be remembered
    if (rememberMe) {
      localStorage.setItem('finance_authenticated_persistent', 'true');
      localStorage.setItem('finance_auth_timestamp', Date.now().toString());
    }
    
    setIsAuthenticated(true);
  };

  const logout = () => {
    sessionStorage.removeItem('finance_authenticated');
    localStorage.removeItem('finance_authenticated_persistent');
    localStorage.removeItem('finance_auth_timestamp');
    setIsAuthenticated(false);
  };

  const setupPassword = () => {
    // Re-check auth status to ensure password is properly set
    checkAuthStatus();
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