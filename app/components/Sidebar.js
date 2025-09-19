import React from 'react';
import { Settings, Repeat, Inbox, Users, PiggyBank, Calculator, Target, CreditCard, LogOut, TrendingUp } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../utils/db';
import { useAuth } from './hooks/useAuth';
import { jonyColors } from '../theme';

// Tooltip-Komponente ausgelagert, um Redundanz zu vermeiden
const SidebarTooltip = ({ label, count }) => (
  <div
    className="absolute left-full ml-3 px-3 py-2 text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50"
    style={{ backgroundColor: jonyColors.surface, color: jonyColors.textPrimary, border: `1px solid ${jonyColors.cardBorder}` }}
  >
    {label}
    {count > 0 && ` (${count})`}
  </div>
);

// Sidebar-Item-Komponente für sauberen Code
const SidebarItem = ({ item, isActive, setPage }) => {
  const Icon = item.icon;
  
  return (
    <button
      key={item.id}
      onClick={() => setPage(item.id)}
      className={`w-12 h-12 flex items-center justify-center rounded-xl group relative transition-all duration-200 ${
        isActive ? '' : 'hover:bg-opacity-80'
      }`}
      style={{
        backgroundColor: isActive ? jonyColors.accent1Alpha : jonyColors.cardBackground,
        border: `1px solid ${isActive ? jonyColors.accent1 : jonyColors.cardBorder}`
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = jonyColors.surface;
          e.currentTarget.style.border = `1px solid ${jonyColors.cardBorder}`;
          const icon = e.currentTarget.querySelector('svg');
          if (icon) icon.style.color = jonyColors.textPrimary;
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = jonyColors.cardBackground;
          e.currentTarget.style.border = `1px solid ${jonyColors.cardBorder}`;
          const icon = e.currentTarget.querySelector('svg');
          if (icon) icon.style.color = jonyColors.textSecondary;
        }
      }}
      title={item.label}
    >
      <div className="relative">
        <Icon
          className="w-5 h-5"
          strokeWidth={1.5}
          style={{
            color: isActive ? jonyColors.accent1 : jonyColors.textSecondary,
            transition: 'color 0.2s ease'
          }}
        />
        {item.count > 0 && (
          <span className="absolute -top-2 -right-2 w-4 h-4 text-xs font-medium rounded-full flex items-center justify-center"
            style={{ backgroundColor: jonyColors.accent1, color: jonyColors.background }}>
            {item.count > 9 ? '9+' : item.count}
          </span>
        )}
      </div>
      <SidebarTooltip label={item.label} count={item.count} />
    </button>
  );
};

const Sidebar = ({ currentPage, setPage }) => {
  const { logout } = useAuth();
  const userSettings = useLiveQuery(() => db.settings.get('userProfile'), []) || {};
  const inboxCount = useLiveQuery(() => db.inbox.count(), []) || 0;
  const pageVisibilitySettings = useLiveQuery(() => db.settings.get('pageVisibility'), []);
  
  const allNavItems = [
    { id: 'inbox', label: 'Posteingang', icon: Inbox, count: inboxCount },
    { id: 'transactions', label: 'Transactions', icon: Repeat },
    { id: 'investments', label: 'Investments', icon: TrendingUp },
    { id: 'shared-expenses', label: 'Geteilte Ausgaben', icon: Users },
    { id: 'budget', label: 'Budget', icon: Calculator },
    { id: 'debts', label: 'Schulden', icon: CreditCard },
    { id: 'savings-goals', label: 'Sparziele', icon: Target },
  ];
  
  const visibilitySettings = pageVisibilitySettings?.value || {};
  const navItems = allNavItems.filter(item => visibilitySettings[item.id] !== false);
  
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
      <div className="flex justify-center mb-12 mt-4">
        <button
          onClick={() => setPage('dashboard')}
          className="w-12 h-12 flex items-center justify-center rounded-xl transition-all duration-200"
          style={{
            background: `linear-gradient(135deg, ${jonyColors.accent1}, ${jonyColors.greenDark})`,
            border: 'none',
            boxShadow: '0 4px 16px rgba(34, 197, 94, 0.2)'
          }}
          onMouseEnter={(e) => {
            e.target.style.transform = 'scale(1.05)';
            e.target.style.boxShadow = '0 8px 32px rgba(34, 197, 94, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'scale(1)';
            e.target.style.boxShadow = '0 4px 16px rgba(34, 197, 94, 0.2)';
          }}
          title="Dashboard"
        >
          <PiggyBank className="w-6 h-6 text-black" strokeWidth={1.5} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col items-center space-y-4">
        {navItems.map(item => (
          <SidebarItem key={item.id} item={item} isActive={currentPage === item.id} setPage={setPage} />
        ))}
      </nav>

      {/* Bottom Items */}
      <div className="pt-4 flex flex-col items-center space-y-6" style={{ borderTop: `1px solid ${jonyColors.border}` }}>
        {bottomItems.map(item => (
          <SidebarItem key={item.id} item={item} isActive={currentPage === item.id} setPage={setPage} />
        ))}
        
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
          {/* Tooltip for Logout */}
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