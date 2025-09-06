import React from 'react';
import { Settings, LayoutDashboard, Repeat, Inbox, Users, PiggyBank, Calculator, Target, CreditCard, LogOut } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../utils/db';
import { useAuth } from './hooks/useAuth';
import { jonyColors } from '../theme';

const Sidebar = ({ currentPage, setPage }) => {
  const { logout } = useAuth();
  const userSettings = useLiveQuery(() => db.settings.get('userProfile'), []) || {};
  const inboxCount = useLiveQuery(() => db.inbox.count(), []) || 0;
  const pageVisibilitySettings = useLiveQuery(() => db.settings.get('pageVisibility'), []);
  
  const allNavItems = [
    { id: 'inbox', label: 'Posteingang', icon: Inbox, count: inboxCount },
    { id: 'transactions', label: 'Transactions', icon: Repeat },
    { id: 'shared-expenses', label: 'Geteilte Ausgaben', icon: Users },
    { id: 'budget', label: 'Budget', icon: Calculator },
    { id: 'debts', label: 'Schulden', icon: CreditCard },
    { id: 'savings-goals', label: 'Sparziele', icon: Target },
  ];
  
  // Filter visible nav items based on settings
  const visibilitySettings = pageVisibilitySettings?.value || {};
  const navItems = allNavItems.filter(item => {
    // Check visibility settings (default to true if not set)
    return visibilitySettings[item.id] !== false;
  });
  
  const bottomItems = [
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleLogout = () => {
    const confirmLogout = window.confirm('Möchtest du dich wirklich abmelden?');
    if (confirmLogout) {
      logout();
    }
  };

  return (
    <aside className="w-20 p-4 flex-shrink-0 hidden md:flex flex-col h-screen sticky top-0" style={{ backgroundColor: jonyColors.background, borderRight: `1px solid ${jonyColors.border}` }}>
      {/* Logo */}
      <div className="flex justify-center mb-8">
        <button 
          onClick={() => setPage('dashboard')}
          className="w-12 h-12 flex items-center justify-center rounded-xl" 
          style={{ backgroundColor: jonyColors.surface, border: `1px solid ${jonyColors.cardBorder}` }}
          title="Dashboard"
        >
          <PiggyBank className="w-6 h-6" style={{ color: jonyColors.accent1 }} strokeWidth={1.5} />
        </button>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 flex flex-col items-center space-y-3">
        {navItems.map(item => {
          const isActive = currentPage === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className="w-12 h-12 flex items-center justify-center rounded-xl transition-colors duration-200 group relative"
              style={{
                backgroundColor: isActive ? jonyColors.accent1Alpha : jonyColors.cardBackground,
                color: isActive ? jonyColors.accent1 : jonyColors.textSecondary,
                border: `1px solid ${isActive ? jonyColors.accent1 : jonyColors.cardBorder}`
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.target.style.backgroundColor = jonyColors.surface;
                  e.target.style.color = jonyColors.textPrimary;
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.target.style.backgroundColor = jonyColors.cardBackground;
                  e.target.style.color = jonyColors.textSecondary;
                }
              }}
              title={item.label}
            >
              <div className="relative">
                <item.icon className="w-5 h-5" strokeWidth={1.5} />
                {/* Badge for inbox count */}
                {item.count > 0 && (
                  <span className="absolute -top-2 -right-2 w-4 h-4 text-xs font-medium rounded-full flex items-center justify-center" 
                        style={{ backgroundColor: jonyColors.red, color: jonyColors.background }}>
                    {item.count > 9 ? '9+' : item.count}
                  </span>
                )}
              </div>
              {/* Tooltip */}
              <div className="absolute left-full ml-3 px-3 py-2 text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50" 
                   style={{ backgroundColor: jonyColors.surface, color: jonyColors.textPrimary, border: `1px solid ${jonyColors.cardBorder}` }}>
                {item.label}
                {item.count > 0 && ` (${item.count})`}
              </div>
            </button>
          );
        })}
      </nav>
      
      {/* Bottom Items */}
      <div className="pt-4 flex flex-col items-center space-y-3" style={{ borderTop: `1px solid ${jonyColors.border}` }}>
        {bottomItems.map(item => {
          const isActive = currentPage === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className="w-12 h-12 flex items-center justify-center rounded-xl transition-colors duration-200 group relative"
              style={{
                backgroundColor: isActive ? jonyColors.accent2Alpha : jonyColors.cardBackground,
                color: isActive ? jonyColors.accent2 : jonyColors.textSecondary,
                border: `1px solid ${isActive ? jonyColors.accent2 : jonyColors.cardBorder}`
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.target.style.backgroundColor = jonyColors.surface;
                  e.target.style.color = jonyColors.textPrimary;
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.target.style.backgroundColor = jonyColors.cardBackground;
                  e.target.style.color = jonyColors.textSecondary;
                }
              }}
              title={item.label}
            >
              <item.icon className="w-5 h-5" strokeWidth={1.5} />
              {/* Tooltip */}
              <div className="absolute left-full ml-3 px-3 py-2 text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50" 
                   style={{ backgroundColor: jonyColors.surface, color: jonyColors.textPrimary, border: `1px solid ${jonyColors.cardBorder}` }}>
                {item.label}
              </div>
            </button>
          );
        })}
        
        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="w-12 h-12 flex items-center justify-center rounded-xl transition-colors duration-200 group relative"
          style={{ 
            color: jonyColors.red, 
            backgroundColor: jonyColors.cardBackground, 
            border: `1px solid ${jonyColors.cardBorder}` 
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = jonyColors.redAlpha;
            e.target.style.color = jonyColors.red;
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = jonyColors.cardBackground;
            e.target.style.color = jonyColors.red;
          }}
          title="Abmelden"
        >
          <LogOut className="w-5 h-5" strokeWidth={1.5} />
          {/* Tooltip */}
          <div className="absolute left-full ml-3 px-3 py-2 text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50" 
               style={{ backgroundColor: jonyColors.surface, color: jonyColors.textPrimary, border: `1px solid ${jonyColors.cardBorder}` }}>
            Abmelden
          </div>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;