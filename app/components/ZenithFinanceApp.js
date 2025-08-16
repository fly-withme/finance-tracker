'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
// GEÄNDERT: Korrekter Pfad, um aus dem 'components'-Ordner herauszugehen
import { db, populateInitialData } from '../utils/db';
import { TransactionClassifier, getInitialModel } from '../utils/mlLearning';

import Sidebar from './Sidebar';
import DashboardPage from './DashboardPage';
import InboxPage from './InboxPage';
import TransactionsPage from './TransactionsPage';
import SharedExpensesPage from './SharedExpensesPage';
import SettingsPage from './SettingsPage';

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

  const categories = useLiveQuery(() => db.categories.toArray(), []);

  useEffect(() => {
    const loadModel = async () => {
      let modelData = await db.settings.get('mlModel');
      if (!modelData) {
        modelData = { key: 'mlModel', model: getInitialModel() };
        await db.settings.put(modelData);
      }
      setClassifier(new TransactionClassifier(modelData.model));
    };
    loadModel();
  }, []);

  useEffect(() => {
    const initialData = { initialTransactions, initialCategories, initialAccounts };
    populateInitialData(initialData);
  }, []);

  if (!categories || !classifier) {
    return <div className="flex items-center justify-center h-screen">App wird initialisiert...</div>;
  }
  
  const renderPage = () => {
    switch(currentPage) {
      case 'dashboard': 
        return <DashboardPage setPage={setPage} />;
      case 'inbox':
        return <InboxPage categories={categories} classifier={classifier} />;
      case 'transactions': 
        return <TransactionsPage />;
      case 'shared-expenses':
        return <SharedExpensesPage />;
      case 'settings': 
        return <SettingsPage categories={categories} setCategories={() => {}} settings={{ dataPath: '', currency: 'EUR' }} setSettings={() => {}} />;
      default: 
        return <DashboardPage setPage={setPage} />;
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50/70">
      <Sidebar currentPage={currentPage} setPage={setPage} />
      <div className="flex-1">
        {renderPage()}
      </div>
    </div>
  );
}
