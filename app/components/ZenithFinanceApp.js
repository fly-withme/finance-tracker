'use client';

import React, { useState, useCallback } from 'react';
import Sidebar from './Sidebar';
import DashboardPage from './DashboardPage';
import TransactionsPage from './TransactionsPage';
import SettingsPage from './SettingsPage';
import ReviewModal from './ReviewModal';

// Mock data and initial state
const initialTransactions = [
  { id: 1, date: '2025-08-09', description: 'Netflix Subscription', amount: -15.99, category: 'Entertainment', account: 'Checking' },
  { id: 3, date: '2025-08-08', description: 'Salary Deposit', amount: 4500.00, category: 'Income', account: 'Checking' },
  { id: 10, date: '2025-08-01', description: 'Rent July', amount: -1800.00, category: 'Housing', account: 'Checking' },
  { id: 11, date: '2025-07-25', description: 'Restaurant Dinner', amount: -85.00, category: 'Food & Drink', account: 'Checking' },
  { id: 13, date: '2025-07-15', description: 'Freelance Payment', amount: 1200.00, category: 'Income', account: 'Checking' },
  { id: 16, date: '2025-06-10', description: 'Salary Deposit', amount: 4500.00, category: 'Income', account: 'Checking' },
];

const newTransactionsToReview = [
  { id: 101, date: '2025-09-02', description: 'Grocery Store', amount: -78.50, account: 'Checking' },
  { id: 102, date: '2025-09-03', description: 'Spotify Subscription', amount: -10.99, account: 'Checking' },
  { id: 103, date: '2025-09-05', description: 'Amazon.de Marketplace', amount: -49.95, account: 'Checking' },
  { id: 104, date: '2025-09-05', description: 'Rent September', amount: -1800.00, account: 'Checking' },
];

const initialCategories = [
  { id: 1, name: 'Food & Drink', color: '#EC4899' },
  { id: 2, name: 'Transportation', color: '#3B82F6' },
  { id: 3, name: 'Groceries', color: '#F59E0B' },
  { id: 4, name: 'Entertainment', color: '#8B5CF6' },
  { id: 5, name: 'Shopping', color: '#6366F1' },
  { id: 6, name: 'Housing', color: '#EF4444' },
  { id: 7, name: 'Utilities', color: '#10B981' },
  { id: 8, name: 'Health', color: '#D946EF' },
  { id: 9, name: 'Investing', color: '#14B8A6' },
  { id: 10, name: 'Income', color: '#22C55E' },
  { id: 11, name: 'Other', color: '#71717A' },
];

const initialAccounts = [
  { id: 1, name: 'Checking', balance: 5240.50 },
  { id: 2, name: 'Savings', balance: 15000.00 },
  { id: 3, name: 'Emergency Fund', balance: 10000.00 },
  { id: 4, name: 'Vacation Fund', balance: 2500.00 },
  { id: 5, name: 'Investment', balance: 75000.00 }
];

export default function ZenithFinanceApp() {
  const [currentPage, setPage] = useState('dashboard');
  const [transactions, setTransactions] = useState(initialTransactions);
  const [categories, setCategories] = useState(initialCategories);
  const [accounts, setAccounts] = useState(initialAccounts);
  const [settings, setSettings] = useState({ 
    dataPath: '/Users/CurrentUser/ZenithFinance', 
    currency: '€' 
  });
  const [transactionsToReview, setTransactionsToReview] = useState([]);
  
  const [mlModel, setMlModel] = useState({ 
    'netflix': 'Entertainment', 
    'miete': 'Housing', 
    'salary': 'Income', 
    'freelance': 'Income' 
  });

  const updateMlModel = useCallback((keyword, category) => {
    console.log(`🧠 Learning: Descriptions with "${keyword}" are now categorized as "${category}"`);
    setMlModel(prev => ({...prev, [keyword]: category}));
  }, []);

  const renderPage = () => {
    switch(currentPage) {
      case 'dashboard': 
        return (
          <DashboardPage 
            transactions={transactions} 
            categories={categories} 
            currency={settings.currency} 
            accounts={accounts} 
            setTransactionsToReview={setTransactionsToReview}
            newTransactionsToReview={newTransactionsToReview}
          />
        );
      case 'transactions': 
        return (
          <TransactionsPage 
            transactions={transactions} 
            setTransactions={setTransactions} 
            categories={categories} 
            accounts={accounts} 
            currency={settings.currency} 
          />
        );
      case 'settings': 
        return (
          <SettingsPage 
            settings={settings} 
            setSettings={setSettings} 
            categories={categories} 
            setCategories={setCategories} 
          />
        );
      default: 
        return (
          <DashboardPage 
            transactions={transactions} 
            categories={categories} 
            currency={settings.currency} 
            accounts={accounts} 
            setTransactionsToReview={setTransactionsToReview}
            newTransactionsToReview={newTransactionsToReview}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex">
      <Sidebar currentPage={currentPage} setPage={setPage} />
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          {renderPage()}
        </div>
      </main>
      <ReviewModal 
        isOpen={transactionsToReview.length > 0} 
        onClose={() => setTransactionsToReview([])} 
        transactionsToReview={transactionsToReview} 
        setTransactions={setTransactions} 
        categories={categories} 
        mlModel={mlModel} 
        updateMlModel={updateMlModel}
      />
    </div>
  );
}