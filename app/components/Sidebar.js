import React from 'react';
// 1. Das PiggyBank-Icon wird direkt aus der professionellen Bibliothek importiert.
import { Settings, LayoutDashboard, Repeat, Inbox, Users, PiggyBank, Calculator } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../utils/db';
import DarkModeToggle from './DarkModeToggle';

const Sidebar = ({ currentPage, setPage }) => {
  const userSettings = useLiveQuery(() => db.settings.get('userProfile'), []) || {};
  
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'inbox', label: 'Posteingang', icon: Inbox },
    { id: 'transactions', label: 'Transactions', icon: Repeat },
    { id: 'shared-expenses', label: 'Geteilte Ausgaben', icon: Users },
    { id: 'budget', label: 'Budget', icon: Calculator },
  ];
  
  const bottomItems = [
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-72 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 p-6 flex-shrink-0 hidden md:flex flex-col h-screen sticky top-0">
      <button 
        onClick={() => setPage('dashboard')}
        className="flex items-center space-x-4 mb-12 cursor-pointer"
      >
        {/* 2. Das inline-SVG wurde durch einen Container und die Icon-Komponente ersetzt. */}
        {/* Das sorgt für Konsistenz und ist einfacher zu warten. */}
        {/* Hier wurde der Gradient aus dem Dashboard-Button hinzugefügt */}
        <div className="w-10 h-10 flex items-center justify-center bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out">
          <PiggyBank className="w-6 h-6 text-white" strokeWidth={2} />
        </div>
        
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{userSettings?.appName || 'Finance App'}</h1>
      </button>
      
      <nav className="space-y-3 flex-1">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => setPage(item.id)}
            className={`btn w-full flex items-center space-x-3 text-base transition-colors cursor-pointer ${
              currentPage === item.id
                ? 'bg-indigo-50 text-indigo-700 font-semibold dark:bg-indigo-900/50 dark:text-indigo-300'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <item.icon className="w-5 h-5" />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      
      <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 space-y-3">
        {bottomItems.map(item => (
          <button
            key={item.id}
            onClick={() => setPage(item.id)}
            className={`btn w-full flex items-center space-x-3 text-base transition-colors cursor-pointer ${
              currentPage === item.id
                ? 'bg-indigo-50 text-indigo-700 font-semibold dark:bg-indigo-900/50 dark:text-indigo-300'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <item.icon className="w-5 h-5" />
            <span>{item.label}</span>
          </button>
        ))}
        
        <DarkModeToggle />
      </div>
    </aside>
  );
};

export default Sidebar;