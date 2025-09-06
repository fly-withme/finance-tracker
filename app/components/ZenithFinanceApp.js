'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, populateInitialData } from '../utils/db';
import { TransactionClassifier, getInitialModel } from '../utils/mlLearning';
import { EnhancedTransactionClassifier, getEnhancedInitialModel } from '../utils/enhancedMLLearning';

import Sidebar from './Sidebar';
import DashboardPage from './DashboardPage';
import InboxPage from './InboxPage';
import TransactionsPage from './TransactionsPage';
import SharedExpensesPage from './SharedExpensesPage';
import BudgetPage from './BudgetPage';
import DebtPage from './DebtPage';
import SavingsGoalsPage from './SavingsGoalsPage';
import SettingsPage from './SettingsPage';
import AuthPage from './AuthPage';
import { DarkModeProvider } from './hooks/useDarkMode';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { jonyColors } from '../theme';

const initialTransactions = [
  // Start with empty transactions - users can add their own data
];
const initialCategories = [
  // Start with empty categories - users can add their own or use default German categories from defaultCategories.js
];
const initialAccounts = [ { id: 1, name: 'Checking', balance: 5240.50 }, { id: 2, name: 'Savings', balance: 15000.00 }];

const AppContent = () => {
  const [currentPage, setPage] = useState('dashboard');
  const [classifier, setClassifier] = useState(null);
  const [enhancedClassifier, setEnhancedClassifier] = useState(null);
  const [useEnhancedML, setUseEnhancedML] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  const changeMonth = (direction) => {
    setCurrentMonth(prevMonth => {
      const newMonth = new Date(prevMonth);
      newMonth.setMonth(prevMonth.getMonth() + direction);
      return newMonth;
    });
  };
  
  const { isAuthenticated, isLoading, hasPassword, login } = useAuth();
  const categories = useLiveQuery(() => db.categories.toArray(), []);

  useEffect(() => {
    const loadModel = async () => {
      let modelData = await db.settings.get('mlModel');
      if (!modelData) {
        modelData = { key: 'mlModel', model: getInitialModel() };
        await db.settings.put(modelData);
      }
      setClassifier(new TransactionClassifier(modelData.model));
      
      let enhancedModelData = await db.settings.get('enhancedMLModel');
      if (!enhancedModelData) {
        enhancedModelData = { key: 'enhancedMLModel', model: getEnhancedInitialModel() };
        await db.settings.put(enhancedModelData);
      }
      setEnhancedClassifier(new EnhancedTransactionClassifier(enhancedModelData.model));
    };
    loadModel();
  }, []);

  useEffect(() => {
    const initialData = { initialTransactions, initialCategories, initialAccounts };
    populateInitialData(initialData);
  }, []);

  // Show loading screen
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: jonyColors.background }}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">App wird initialisiert...</p>
        </div>
      </div>
    );
  }

  // Show auth page if not authenticated
  if (!isAuthenticated) {
    return <AuthPage onAuthSuccess={login} />;
  }

  // Show loading if data is still loading
  if (!categories || !classifier || !enhancedClassifier) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: jonyColors.background }}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Daten werden geladen...</p>
        </div>
      </div>
    );
  }
  
  const renderPage = () => {
    switch(currentPage) {
      case 'dashboard': 
        return <DashboardPage setPage={setPage} currentMonth={currentMonth} changeMonth={changeMonth} />;
      case 'inbox':
        return <InboxPage 
          categories={categories} 
          classifier={useEnhancedML ? enhancedClassifier : classifier}
          enhancedClassifier={enhancedClassifier}
          useEnhancedML={useEnhancedML}
        />;
      case 'transactions': 
        return <TransactionsPage />;
      case 'shared-expenses':
        return <SharedExpensesPage />;
      case 'budget':
        return <BudgetPage />;
      case 'debts':
        return <DebtPage />;
      case 'savings-goals':
        return <SavingsGoalsPage />;
      case 'settings': 
        return <SettingsPage 
          categories={categories} 
          setCategories={() => {}} 
          settings={{ dataPath: '', currency: 'EUR' }} 
          setSettings={() => {}}
          enhancedClassifier={enhancedClassifier}
          useEnhancedML={useEnhancedML}
        />;
      default: 
        return <DashboardPage setPage={setPage} currentMonth={currentMonth} changeMonth={changeMonth} />;
    }
  };

  return (
    <div className="h-screen flex overflow-hidden" style={{ backgroundColor: jonyColors.background }}>
      <Sidebar currentPage={currentPage} setPage={setPage} />
      <div className="flex-1 overflow-y-auto">
        {renderPage()}
      </div>
    </div>
  );
};

export default function ZenithFinanceApp() {
  return (
    <DarkModeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </DarkModeProvider>
  );
}