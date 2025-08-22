'use client';

import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useDarkMode } from './hooks/useDarkMode';

const DarkModeToggle = () => {
  const { isDarkMode, isSystemMode, toggleDarkMode, enableSystemMode } = useDarkMode();

  return (
    <div className="flex items-center">
      <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-1 flex items-center shadow-sm">
        {/* Light Mode Button */}
        <button
          onClick={() => !isSystemMode && isDarkMode ? toggleDarkMode() : null}
          className={`flex items-center justify-center p-2 rounded-lg transition-all duration-200 ${
            !isSystemMode && !isDarkMode
              ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-md'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
          title="Light mode"
        >
          <Sun className="w-4 h-4" />
        </button>
        
        {/* Dark Mode Button */}
        <button
          onClick={() => !isSystemMode && !isDarkMode ? toggleDarkMode() : null}
          className={`flex items-center justify-center p-2 rounded-lg transition-all duration-200 ${
            !isSystemMode && isDarkMode
              ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-md'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
          title="Dark mode"
        >
          <Moon className="w-4 h-4" />
        </button>
        
        {/* System Mode Button */}
        <button
          onClick={isSystemMode ? null : enableSystemMode}
          className={`flex items-center justify-center p-2 rounded-lg transition-all duration-200 ${
            isSystemMode
              ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-md'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
          title="System preference"
        >
          <Monitor className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default DarkModeToggle;