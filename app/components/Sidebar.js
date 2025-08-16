import React from 'react';
// 1. Das PiggyBank-Icon wird direkt aus der professionellen Bibliothek importiert.
import { Settings, LayoutDashboard, Repeat, Inbox, Users, PiggyBank } from 'lucide-react';

const Sidebar = ({ currentPage, setPage }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'inbox', label: 'Posteingang', icon: Inbox },
    { id: 'transactions', label: 'Transactions', icon: Repeat },
    { id: 'shared-expenses', label: 'Geteilte Ausgaben', icon: Users },
  ];
  
  const bottomItems = [
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-72 bg-white border-r border-slate-100 p-6 flex-shrink-0 hidden md:flex flex-col h-screen sticky top-0">
      <button 
        onClick={() => setPage('dashboard')}
        className="flex items-center space-x-4 mb-12 cursor-pointer"
      >
        {/* 2. Das inline-SVG wurde durch einen Container und die Icon-Komponente ersetzt. */}
        {/* Das sorgt für Konsistenz und ist einfacher zu warten. */}
        <div className="w-10 h-10 flex items-center justify-center bg-violet-500 rounded-lg">
          <PiggyBank className="w-6 h-6 text-white" strokeWidth={2} />
        </div>
        
        <h1 className="text-2xl font-bold text-slate-800">Zenith Finance</h1>
      </button>
      
      <nav className="space-y-3 flex-1">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => setPage(item.id)}
            className={`btn w-full flex items-center space-x-3 text-base transition-colors cursor-pointer ${
              currentPage === item.id
                ? 'bg-indigo-50 text-indigo-700 font-semibold'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
            }`}
          >
            <item.icon className="w-5 h-5" />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      
      <div className="mt-6 pt-6 border-t border-slate-100 space-y-3">
        {bottomItems.map(item => (
          <button
            key={item.id}
            onClick={() => setPage(item.id)}
            className={`btn w-full flex items-center space-x-3 text-base transition-colors cursor-pointer ${
              currentPage === item.id
                ? 'bg-indigo-50 text-indigo-700 font-semibold'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
            }`}
          >
            <item.icon className="w-5 h-5" />
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </aside>
  );
};

export default Sidebar;