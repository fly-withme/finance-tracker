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
import { DarkModeProvider } from './hooks/useDarkMode';

const initialTransactions = [
  { id: 1, date: '2025-08-09', description: 'Netflix Subscription', recipient: 'Netflix', amount: -15.99, category: 'Entertainment', account: 'Checking' },
  { id: 3, date: '2025-08-08', description: 'Salary Deposit', recipient: 'My Employer', amount: 4500.00, category: 'Income', account: 'Checking' },
];
const initialCategories = [
  { id: 1, name: 'Food & Groceries', color: '#EC4899' }, { id: 2, name: 'Transportation', color: '#3B82F6' },
  { id: 3, name: 'Entertainment', color: '#8B5CF6' }, { id: 4, name: 'Shopping', color: '#6366F1' },
  { id: 5, name: 'Housing & Utilities', color: '#EF4444' }, { id: 6, name: 'Health & Fitness', color: '#10B981' },
  { id: 7, name: 'Insurance', color: '#F59E0B' }, { id: 8, name: 'Subscriptions', color: '#D946EF' },
  { id: 9, name: 'Bank Fees', color: '#71717A' }, { id: 10, name: 'Income', color: '#22C55E' }, { id: 11, name: 'Other', color: '#94A3B8' },
];
const initialAccounts = [ { id: 1, name: 'Checking', balance: 5240.50 }, { id: 2, name: 'Savings', balance: 15000.00 }];

export default function ZenithFinanceApp() {
  const [currentPage, setPage] = useState('dashboard');
  const [classifier, setClassifier] = useState(null);
  const [enhancedClassifier, setEnhancedClassifier] = useState(null);
  const [useEnhancedML, setUseEnhancedML] = useState(true);

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

  if (!categories || !classifier || !enhancedClassifier) {
    return <div className="flex items-center justify-center h-screen">App wird initialisiert...</div>;
  }
  
  const renderPage = () => {
    switch(currentPage) {
      case 'dashboard': 
        return <DashboardPage setPage={setPage} />;
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
        return <DashboardPage setPage={setPage} />;
    }
  };

  return (
    <DarkModeProvider>
      <div className="h-screen flex bg-slate-50/70 dark:bg-slate-900 overflow-hidden">
        <Sidebar currentPage={currentPage} setPage={setPage} />
        <div className="flex-1 overflow-y-auto">
          {renderPage()}
        </div>
      </div>
    </DarkModeProvider>
  );
}