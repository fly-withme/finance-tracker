import React from 'react';
import { Settings, LayoutDashboard, Repeat } from 'lucide-react';

const Sidebar = ({ currentPage, setPage }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'transactions', label: 'Transactions', icon: Repeat }, 
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-gray-900/50 border-r border-gray-700/50 p-6 flex-shrink-0 hidden md:flex flex-col">
      <div className="flex items-center space-x-3 mb-12">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M16 0L32 16L16 32L0 16L16 0Z" fill="url(#paint0_linear_sidebar)"/>
          <defs>
            <linearGradient id="paint0_linear_sidebar" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
              <stop stopColor="#6366F1"/>
              <stop offset="1" stopColor="#8B5CF6"/>
            </linearGradient>
          </defs>
        </svg>
        <h1 className="text-2xl font-bold text-white">Zenith</h1>
      </div>
      <nav className="space-y-2">
        {navItems.map(item => (
          <button 
            key={item.id} 
            onClick={() => setPage(item.id)} 
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg font-medium transition-colors ${
              currentPage === item.id 
                ? 'bg-indigo-600 text-white' 
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <item.icon className="w-5 h-5" />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;