'use client';

import { createContext, useContext, useEffect, useState } from 'react';

const DarkModeContext = createContext();

export const useDarkMode = () => {
  const context = useContext(DarkModeContext);
  if (!context) {
    throw new Error('useDarkMode must be used within a DarkModeProvider');
  }
  return context;
};

export const DarkModeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isSystemMode, setIsSystemMode] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Initial setup - only run once on mount
    const savedMode = localStorage.getItem('darkMode');
    const savedSystemMode = localStorage.getItem('systemMode');
    
    const systemModeEnabled = savedSystemMode !== null ? JSON.parse(savedSystemMode) : true;
    setIsSystemMode(systemModeEnabled);
    
    if (savedMode !== null && !systemModeEnabled) {
      // User has a manual preference
      setIsDarkMode(JSON.parse(savedMode));
    } else {
      // Use system preference
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      setIsDarkMode(mediaQuery.matches);
    }
    
    setIsInitialized(true);
  }, []); // Only run once on mount

  useEffect(() => {
    // Listen to system changes only when in system mode
    if (!isInitialized) return;
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e) => {
      if (isSystemMode) {
        setIsDarkMode(e.matches);
      }
    };
    
    if (isSystemMode) {
      mediaQuery.addEventListener('change', handleChange);
      setIsDarkMode(mediaQuery.matches); // Update immediately when switching to system mode
    }
    
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [isSystemMode, isInitialized]);

  useEffect(() => {
    console.log('Applying dark mode state:', isDarkMode);
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      console.log('Added dark class to document');
    } else {
      document.documentElement.classList.remove('dark');
      console.log('Removed dark class from document');
    }
    console.log('Current document classes:', document.documentElement.className);
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    console.log('Dark mode toggle clicked! Current state:', { isDarkMode, isSystemMode });
    if (isSystemMode) {
      setIsSystemMode(false);
      localStorage.setItem('systemMode', JSON.stringify(false));
    }
    const newMode = !isDarkMode;
    console.log('Setting dark mode to:', newMode);
    setIsDarkMode(newMode);
    localStorage.setItem('darkMode', JSON.stringify(newMode));
  };

  const enableSystemMode = () => {
    setIsSystemMode(true);
    localStorage.setItem('systemMode', JSON.stringify(true));
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(mediaQuery.matches);
    localStorage.removeItem('darkMode');
  };

  return (
    <DarkModeContext.Provider value={{
      isDarkMode,
      isSystemMode,
      toggleDarkMode,
      enableSystemMode
    }}>
      {children}
    </DarkModeContext.Provider>
  );
};