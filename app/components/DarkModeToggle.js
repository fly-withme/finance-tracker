'use client';

import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useDarkMode } from './hooks/useDarkMode';

const DarkModeToggle = () => {
  const { isDarkMode, isSystemMode, toggleDarkMode, enableSystemMode } = useDarkMode();

  const getIcon = () => {
    if (isSystemMode) {
      return <Monitor className="w-5 h-5" />;
    }
    return isDarkMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />;
  };

  const getLabel = () => {
    if (isSystemMode) {
      return 'System';
    }
    return isDarkMode ? 'Dark' : 'Light';
  };

  return (
    <div className="flex items-center space-x-2">
      <button
        onClick={toggleDarkMode}
        className={`btn w-full flex items-center space-x-3 text-base transition-colors cursor-pointer ${
          false // Never highlighted as active since it's a toggle
            ? 'bg-indigo-50 text-indigo-700 font-semibold dark:bg-indigo-900/50 dark:text-indigo-300'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-slate-200'
        }`}
        title={isSystemMode ? 'Using system preference' : `Switch to ${isDarkMode ? 'light' : 'dark'} mode`}
      >
        {getIcon()}
        <span>{getLabel()}</span>
      </button>
      
      {!isSystemMode && (
        <button
          onClick={enableSystemMode}
          className="btn-icon text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
          title="Use system preference"
        >
          <Monitor className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default DarkModeToggle;