import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../utils/db';

// Import more icons for categories
import { Plus, Edit, Trash2, Search, Filter, ChevronLeft, ChevronRight, Users, X, List, Utensils, ShoppingCart, Car, Home, Shirt, Gift, Fuel, Film, PiggyBank } from 'lucide-react';

// UI Components
import Modal from './ui/Modal';
import TransactionForm from './forms/TransactionForm';

// --- UPDATED: THEMING ENGINE for Transaction Icons & Colors ---
const transactionThemes = [
  // A warm purple for food/dining experiences
  { name: 'Food & Dining', keywords: ['essen', 'food', 'restaurant', 'lieferando', 'rewe', 'edeka', 'supermarkt'], Icon: Utensils, color: 'bg-purple-100', iconColor: 'text-purple-600' },
  // A standard, brand-like indigo for shopping
  { name: 'Shopping', keywords: ['shopping', 'einkauf', 'zalando', 'amazon', 'kleidung', 'ikea'], Icon: ShoppingCart, color: 'bg-indigo-100', iconColor: 'text-indigo-600' },
  // Violet as a bridge between purple and indigo for movement/transport
  { name: 'Transportation', keywords: ['transport', 'auto', 'car', 'db', 'bahn', 'fuel', 'tanken'], Icon: Fuel, color: 'bg-violet-100', iconColor: 'text-violet-600' },
  // A slightly deeper, more "serious" indigo for housing
  { name: 'Housing', keywords: ['miete', 'wohnen', 'rent', 'housing'], Icon: Home, color: 'bg-indigo-100', iconColor: 'text-indigo-700' },
  // A vibrant, energetic fuchsia for entertainment
  { name: 'Entertainment', keywords: ['kino', 'cinema', 'film', 'spotify', 'netflix'], Icon: Film, color: 'bg-fuchsia-100', iconColor: 'text-fuchsia-600' },
  // A strong, dependable indigo for important income
  { name: 'Salary', keywords: ['gehalt', 'salary', 'einkommen'], Icon: PiggyBank, color: 'bg-indigo-100', iconColor: 'text-indigo-800' },
];

const defaultTheme = {
  Icon: Gift,
  // A neutral, muted indigo for uncategorized items
  color: 'bg-indigo-50',
  iconColor: 'text-indigo-500'
};

const getTransactionTheme = (categoryName) => {
  if (!categoryName) return defaultTheme;
  const name = categoryName.toLowerCase();
  return transactionThemes.find(theme => 
    theme.keywords.some(keyword => name.includes(keyword))
  ) || defaultTheme;
};
// --- END THEMING ENGINE ---


const TransactionsPage = () => {
  // --- STATE MANAGEMENT ---
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedAccount, setSelectedAccount] = useState('');
  const [amountFilter, setAmountFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  // --- DATABASE QUERIES ---
  const transactions = useLiveQuery(() => db.transactions.toArray(), []) || [];
  const categories = useLiveQuery(() => db.categories.toArray(), []) || [];
  const accounts = useLiveQuery(() => db.accounts.toArray(), []) || [];

  // --- DATA PROCESSING & FILTERING ---
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const txDate = new Date(tx.date);
      if (txDate.getMonth() !== selectedDate.getMonth() || txDate.getFullYear() !== selectedDate.getFullYear()) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const searchFields = [tx.recipient, tx.description, tx.category, tx.account];
        if (!searchFields.some(field => field?.toLowerCase().includes(query))) return false;
      }
      if (selectedCategory && tx.category !== selectedCategory) return false;
      if (selectedAccount && tx.account !== selectedAccount) return false;
      if (amountFilter === 'income' && tx.amount <= 0) return false;
      if (amountFilter === 'expense' && tx.amount >= 0) return false;
      return true;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [transactions, selectedDate, searchQuery, selectedCategory, selectedAccount, amountFilter]);

  const hasActiveFilters = searchQuery || selectedCategory || selectedAccount || amountFilter !== 'all';

  // --- Group transactions by date for the feed view ---
  const groupedTransactions = useMemo(() => {
    return filteredTransactions.reduce((acc, tx) => {
      const date = new Date(tx.date).toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(tx);
      return acc;
    }, {});
  }, [filteredTransactions]);
  
  const formatDateGroup = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Heute';
    if (date.toDateString() === yesterday.toDateString()) return 'Gestern';
    
    return new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: 'long' }).format(date);
  };


  // --- HANDLERS & HELPERS ---
  const goToPreviousMonth = () => setSelectedDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  const goToNextMonth = () => setSelectedDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  const handleSave = async (data) => {
    try {
      if (data.id) await db.transactions.update(data.id, data);
      else await db.transactions.add(data);
      setModalOpen(false);
      setEditingTransaction(null);
    } catch (error) { console.error('Error saving transaction:', error); }
  };
  const handleEdit = (tx) => { setEditingTransaction(tx); setModalOpen(true); };
  const handleShareExpense = (tx) => { setEditingTransaction({ ...tx, _openSharing: true }); setModalOpen(true); };
  const handleDelete = async (id) => {
    if (window.confirm('Möchtest du diese Transaktion wirklich löschen?')) {
      try {
        await db.transactions.delete(id);
      } catch (error) { console.error('Error deleting transaction:', error); }
    }
  };
  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedCategory('');
    setSelectedAccount('');
    setAmountFilter('all');
  };
  const formatCurrency = (amount) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);

  return (
    <div className="min-h-screen bg-white font-sans text-slate-800 p-4 sm:p-6 md:p-8 flex flex-col items-center">
      <div className="w-full max-w-7xl mx-auto">
        {/* ## Page Header ## */}
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-bold text-slate-900">Transaktionen</h1>
              <div className="px-3 py-1 bg-slate-100 text-slate-700 font-semibold text-sm rounded-full">{filteredTransactions.length}</div>
            </div>
            <button
              onClick={() => { setEditingTransaction(null); setModalOpen(true); }}
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg transition-all duration-300 ease-in-out font-medium shadow-lg hover:shadow-xl py-3 px-6 text-base"
            >
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">Neue Transaktion</span>
              <span className="sm:hidden">Neu</span>
            </button>
          </div>
        </header>

        {/* ## Controls Bar ## */}
        <div className="mb-6 space-y-4">
          <div className="flex flex-col md:flex-row gap-6 items-center">
            {/* Search and Filter */}
            <div className="flex-grow flex items-center gap-4 w-full">
              <div className="relative flex-grow">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Suchen..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-6 border border-slate-300 rounded-full focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow text-base py-3"
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex-shrink-0 flex items-center gap-2 rounded-lg transition-all duration-300 ease-in-out font-medium py-3 px-6 text-base ${
                  hasActiveFilters
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-700 hover:text-indigo-600'
                }`}
              >
                <Filter className="w-5 h-5" />
                <span>Filter</span>
              </button>
            </div>
            {/* Minimalist Month Navigator */}
            <div className="flex items-center gap-4 shrink-0">
                <button onClick={goToPreviousMonth} title="Vorheriger Monat" className="p-2 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors">
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="text-center min-w-[180px]">
                    <span className="font-semibold text-slate-800 text-base">
                        {selectedDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
                    </span>
                </div>
                <button onClick={goToNextMonth} title="Nächster Monat" className="p-2 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors">
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>
          </div>
          {/* Expanded Filters */}
          {showFilters && (
             <div className="p-5 bg-white border border-slate-100 rounded-xl shadow-xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[ { label: 'Kategorie', value: selectedCategory, onChange: setSelectedCategory, options: categories.map(c => c.name) }, { label: 'Konto', value: selectedAccount, onChange: setSelectedAccount, options: accounts.map(a => a.name) }, { label: 'Typ', value: amountFilter, onChange: setAmountFilter, options: { 'all': 'Alle', 'income': 'Nur Einnahmen', 'expense': 'Nur Ausgaben' } } ].map(filter => ( <div key={filter.label}> <label className="block text-xs font-medium text-slate-600 mb-1.5">{filter.label}</label> <select value={filter.value} onChange={(e) => filter.onChange(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"> <option value="">Alle</option> {Array.isArray(filter.options) ? filter.options.map(opt => <option key={opt} value={opt}>{opt}</option>) : Object.entries(filter.options).map(([val, name]) => <option key={val} value={val}>{name}</option>)} </select> </div> ))} {hasActiveFilters && ( <div className="sm:col-span-2 lg:col-span-3 flex justify-end"> <button onClick={clearAllFilters} className="flex items-center gap-2 text-slate-600 hover:text-red-600 font-medium text-sm"> <X className="w-4 h-4" /> Alle Filter zurücksetzen </button> </div> )}
            </div>
          )}
        </div>

        {/* ## REDESIGNED Transactions List ## */}
        <main className="w-full">
          {filteredTransactions.length === 0 ? (
            <div className="text-center p-12 bg-slate-50 rounded-2xl">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-full mb-5"> <List className="w-8 h-8 text-indigo-600" /> </div>
              <h2 className="text-2xl font-bold text-slate-800">Keine Transaktionen</h2>
              <p className="text-slate-500 mt-2 max-w-sm mx-auto">{hasActiveFilters ? 'Für deine Filterauswahl wurden keine Ergebnisse gefunden.' : 'Für diesen Monat sind keine Transaktionen vorhanden.'}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.keys(groupedTransactions).map(date => (
                <div key={date}>
                  <h3 className="text-sm font-semibold text-slate-500 px-4 py-2 bg-slate-50 rounded-lg inline-block mb-4">
                    {formatDateGroup(date)}
                  </h3>
                  <div className="space-y-2">
                    {groupedTransactions[date].map(tx => {
                      const { Icon, color, iconColor } = getTransactionTheme(tx.category);
                      return (
                        <div key={tx.id} className="group flex items-center justify-between p-4 bg-white hover:bg-slate-50 rounded-2xl border border-slate-100 transition-all duration-200 ease-in-out">
                          <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
                              <Icon className={`w-6 h-6 ${iconColor}`} />
                            </div>
                            <div>
                              <p className="font-bold text-slate-800 text-base">{tx.recipient || 'Unbekannt'}</p>
                              <p className="text-slate-500 text-sm">{tx.description || tx.category || 'Keine Beschreibung'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <p className={`font-bold text-base text-right ${tx.amount > 0 ? 'text-green-600' : 'text-slate-800'}`}>
                              {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
                            </p>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {tx.amount < 0 && (!tx.sharedWith || tx.sharedWith.length === 0) && ( <button onClick={() => handleShareExpense(tx)} className="btn-icon text-slate-400 hover:bg-indigo-100 hover:text-indigo-600" title="Ausgabe teilen"><Users className="w-4 h-4"/></button> )}
                              <button onClick={() => handleEdit(tx)} className="btn-icon text-slate-400 hover:bg-slate-200 hover:text-slate-700" title="Bearbeiten"><Edit className="w-4 h-4"/></button>
                              <button onClick={() => handleDelete(tx.id)} className="btn-icon text-slate-400 hover:bg-red-100 hover:text-red-600" title="Löschen"><Trash2 className="w-4 h-4"/></button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title={editingTransaction?.id ? "Transaktion bearbeiten" : "Neue Transaktion erstellen"} size="large">
        <TransactionForm transaction={editingTransaction} onSave={handleSave} onCancel={() => setModalOpen(false)} categories={categories} accounts={accounts} />
      </Modal>
    </div>
  );
};

export default TransactionsPage;