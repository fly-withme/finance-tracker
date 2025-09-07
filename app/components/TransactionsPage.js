import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../utils/db';
import { jonyColors } from '../theme';

// Import more icons for categories
import { Plus, Edit, Trash2, Search, Filter, ChevronLeft, ChevronRight, Users, X, List, Utensils, ShoppingCart, Car, Home, Shirt, Gift, Fuel, Film, PiggyBank } from 'lucide-react';

// UI Components
import Modal from './ui/Modal';
import ConfirmationModal from './ui/ConfirmationModal';
import TransactionForm from './forms/TransactionForm';

// --- UPDATED: THEMING ENGINE for Transaction Icons & Colors ---
const transactionThemes = [
  // Food & Dining
  { name: 'Food & Dining', keywords: ['essen', 'food', 'restaurant', 'lieferando', 'rewe', 'edeka', 'supermarkt'], Icon: Utensils, bgColor: jonyColors.accent2Alpha, iconColor: jonyColors.accent2 },
  // Shopping
  { name: 'Shopping', keywords: ['shopping', 'einkauf', 'zalando', 'amazon', 'kleidung', 'ikea'], Icon: ShoppingCart, bgColor: jonyColors.accent1Alpha, iconColor: jonyColors.accent1 },
  // Transportation
  { name: 'Transportation', keywords: ['transport', 'auto', 'car', 'db', 'bahn', 'fuel', 'tanken'], Icon: Fuel, bgColor: jonyColors.magentaAlpha, iconColor: jonyColors.magenta },
  // Housing
  { name: 'Housing', keywords: ['miete', 'wohnen', 'rent', 'housing'], Icon: Home, bgColor: jonyColors.accent2Alpha, iconColor: jonyColors.accent2 },
  // Entertainment
  { name: 'Entertainment', keywords: ['kino', 'cinema', 'film', 'spotify', 'netflix'], Icon: Film, bgColor: jonyColors.magentaAlpha, iconColor: jonyColors.magenta },
  // Salary - Income gets accent1 (neon green)
  { name: 'Salary', keywords: ['gehalt', 'salary', 'einkommen'], Icon: PiggyBank, bgColor: jonyColors.accent1Alpha, iconColor: jonyColors.accent1 },
];

const defaultTheme = {
  Icon: Gift,
  bgColor: jonyColors.cardBackground,
  iconColor: jonyColors.textSecondary
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
  const [deleteTransaction, setDeleteTransaction] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
  const handleDelete = (transaction) => {
    setDeleteTransaction(transaction);
    setShowDeleteConfirm(true);
  };
  
  const confirmDelete = async () => {
    try {
      await db.transactions.delete(deleteTransaction.id);
      setShowDeleteConfirm(false);
      setDeleteTransaction(null);
    } catch (error) { 
      console.error('Error deleting transaction:', error); 
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
    <div className="min-h-screen font-sans" style={{ backgroundColor: jonyColors.background, color: jonyColors.textPrimary }}>
      <div className="px-6 py-8 mb-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-1 h-8 rounded-full" style={{ backgroundColor: jonyColors.accent1 }}></div>
              <h1 className="text-3xl font-bold tracking-tight" style={{ color: jonyColors.textPrimary, letterSpacing: '-0.02em' }}>Transaktionen</h1>
              <div className="px-3 py-1 rounded-full font-semibold text-sm" style={{ backgroundColor: jonyColors.accent1Alpha, color: jonyColors.accent1 }}>{filteredTransactions.length}</div>
            </div>

            {/* Month Navigation */}
            <div className="flex items-center gap-3">
              <button
                onClick={goToPreviousMonth}
                className="p-3 rounded-full transition-all duration-200"
                style={{ backgroundColor: jonyColors.cardBackground, color: jonyColors.textSecondary }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = jonyColors.accent1Alpha;
                  e.target.style.color = jonyColors.accent1;
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = jonyColors.cardBackground;
                  e.target.style.color = jonyColors.textSecondary;
                }}
                title="Vorheriger Monat"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="px-4 py-2 min-w-[180px] text-center w-48">
                <span className="font-bold text-xl" style={{ color: jonyColors.textPrimary }}>
                  {selectedDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
                </span>
              </div>
              <button
                onClick={goToNextMonth}
                className="p-3 rounded-full transition-all duration-200"
                style={{ backgroundColor: jonyColors.cardBackground, color: jonyColors.textSecondary }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = jonyColors.accent1Alpha;
                  e.target.style.color = jonyColors.accent1;
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = jonyColors.cardBackground;
                  e.target.style.color = jonyColors.textSecondary;
                }}
                title="Nächster Monat"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <button
              onClick={() => { setEditingTransaction(null); setModalOpen(true); }}
              className="flex items-center gap-2 px-6 py-3 rounded-xl transition-all duration-200 font-semibold shadow-lg hover:shadow-xl text-base"
              style={{ backgroundColor: jonyColors.accent1, color: jonyColors.background }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = jonyColors.greenDark;
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = jonyColors.accent1;
              }}
            >
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">Neue Transaktion</span>
              <span className="sm:hidden">Neu</span>
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 mb-12">
        <div className="max-w-7xl mx-auto">

          {/* Search and Filter Controls */}
          <div className="mb-6 space-y-4">
            <div className="flex flex-col md:flex-row gap-6 items-center">
              <div className="flex-grow flex items-center gap-4 w-full">
                <div className="relative flex-grow">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: jonyColors.textSecondary }} />
                  <input
                    type="text"
                    placeholder="Suchen..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-6 border rounded-2xl focus:outline-none focus:ring-2 transition-all text-base py-3"
                    style={{
                      backgroundColor: jonyColors.surface,
                      color: jonyColors.textPrimary,
                      borderColor: jonyColors.border,
                      '--tw-ring-color': jonyColors.accent1
                    }}
                  />
                </div>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex-shrink-0 flex items-center gap-2 rounded-xl transition-all duration-200 font-medium py-3 px-6 text-base"
                  style={{
                    backgroundColor: hasActiveFilters ? jonyColors.accent1 : jonyColors.cardBackground,
                    color: hasActiveFilters ? jonyColors.background : jonyColors.textSecondary
                  }}
                  onMouseEnter={(e) => {
                    if (!hasActiveFilters) {
                      e.target.style.backgroundColor = jonyColors.accent1Alpha;
                      e.target.style.color = jonyColors.accent1;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!hasActiveFilters) {
                      e.target.style.backgroundColor = jonyColors.cardBackground;
                      e.target.style.color = jonyColors.textSecondary;
                    }
                  }}
                >
                  <Filter className="w-5 h-5" />
                  <span>Filter</span>
                </button>
              </div>
            </div>
            {/* Expanded Filters */}
            {showFilters && (
              <div className="p-6 rounded-2xl border shadow-xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" style={{
                backgroundColor: jonyColors.surface,
                borderColor: jonyColors.border
              }}>
                {[
                  { label: 'Kategorie', value: selectedCategory, onChange: setSelectedCategory, options: categories.map(c => c.name) },
                  { label: 'Konto', value: selectedAccount, onChange: setSelectedAccount, options: accounts.map(a => a.name) },
                  { label: 'Typ', value: amountFilter, onChange: setAmountFilter, options: { 'all': 'Alle', 'income': 'Nur Einnahmen', 'expense': 'Nur Ausgaben' } }
                ].map(filter => (
                  <div key={filter.label}>
                    <label className="block text-xs font-medium mb-2" style={{ color: jonyColors.textSecondary }}>{filter.label}</label>
                    <select
                      value={filter.value}
                      onChange={(e) => filter.onChange(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 text-sm"
                      style={{
                        backgroundColor: jonyColors.cardBackground,
                        color: jonyColors.textPrimary,
                        borderColor: jonyColors.cardBorder,
                        '--tw-ring-color': jonyColors.accent1
                      }}
                    >
                      <option value="">Alle</option>
                      {Array.isArray(filter.options)
                        ? filter.options.map(opt => <option key={opt} value={opt}>{opt}</option>)
                        : Object.entries(filter.options).map(([val, name]) => <option key={val} value={val}>{name}</option>)
                      }
                    </select>
                  </div>
                ))}
                {hasActiveFilters && (
                  <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
                    <button
                      onClick={clearAllFilters}
                      className="flex items-center gap-2 font-medium text-sm transition-colors duration-200"
                      style={{ color: jonyColors.textSecondary }}
                      onMouseEnter={(e) => {
                        e.target.style.color = jonyColors.red;
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.color = jonyColors.textSecondary;
                      }}
                    >
                      <X className="w-4 h-4" />
                      Alle Filter zurücksetzen
                    </button>
                  </div>
                )}
              </div>
            )}
        </div>

          {/* Transactions List */}
          <main className="w-full">
            {filteredTransactions.length === 0 ? (
              <div className="text-center p-12 rounded-3xl border-2 max-w-md mx-auto" style={{
                backgroundColor: jonyColors.surface,
                border: `2px solid ${jonyColors.border}`
              }}>
                <div className="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center" style={{
                  backgroundColor: jonyColors.accent1Alpha
                }}>
                  <List className="w-8 h-8" style={{ color: jonyColors.accent1 }} />
                </div>
                <h2 className="text-2xl font-bold mb-4" style={{ color: jonyColors.textPrimary }}>Keine Transaktionen</h2>
                <p className="text-lg" style={{ color: jonyColors.textSecondary }}>
                  {hasActiveFilters ? 'Für deine Filterauswahl wurden keine Ergebnisse gefunden.' : 'Für diesen Monat sind keine Transaktionen vorhanden.'}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.keys(groupedTransactions).map(date => (
                  <div key={date}>
                    <h3 className="text-sm font-semibold px-4 py-2 rounded-lg inline-block mb-4" style={{
                      backgroundColor: jonyColors.cardBackground,
                      color: jonyColors.textSecondary
                    }}>
                      {formatDateGroup(date)}
                    </h3>
                    <div className="space-y-2">
                      {groupedTransactions[date].map(tx => {
                        const { Icon, bgColor, iconColor } = getTransactionTheme(tx.category);
                        return (
                          <div key={tx.id} className="group flex items-center justify-between p-4 rounded-2xl border transition-all duration-200" style={{
                            backgroundColor: jonyColors.surface,
                            borderColor: jonyColors.border
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = jonyColors.cardBackground;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = jonyColors.surface;
                          }}>
                            <div className="flex items-center gap-4 min-w-0 flex-1">
                              <div className="relative">
                                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: bgColor }}>
                                  <Icon className="w-6 h-6" style={{ color: iconColor }} />
                                </div>
                                {/* Shared transaction indicator */}
                                {tx.sharedWith && tx.sharedWith.length > 0 && (
                                  <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: jonyColors.magenta }}>
                                    <Users className="w-3 h-3" style={{ color: jonyColors.background }} />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p 
                                  className="font-bold text-base truncate" 
                                  style={{ color: jonyColors.textPrimary }}
                                  title={tx.recipient || 'Unbekannt'}
                                >
                                  {tx.recipient || 'Unbekannt'}
                                </p>
                                <p 
                                  className="text-sm truncate" 
                                  style={{ color: jonyColors.textSecondary }}
                                  title={tx.description || tx.category || 'Keine Beschreibung'}
                                >
                                  {tx.description || tx.category || 'Keine Beschreibung'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-6">
                              <p className="font-bold text-base text-right" style={{
                                color: tx.amount > 0 ? jonyColors.accent1 : jonyColors.magenta
                              }}>
                                {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
                              </p>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {tx.amount < 0 && (!tx.sharedWith || tx.sharedWith.length === 0) && (
                                  <button 
                                    onClick={() => handleShareExpense(tx)} 
                                    className="p-2 rounded-lg transition-all duration-200" 
                                    style={{ color: jonyColors.textSecondary }}
                                    onMouseEnter={(e) => {
                                      e.target.style.backgroundColor = jonyColors.accent1Alpha;
                                      e.target.style.color = jonyColors.accent1;
                                    }}
                                    onMouseLeave={(e) => {
                                      e.target.style.backgroundColor = 'transparent';
                                      e.target.style.color = jonyColors.textSecondary;
                                    }}
                                    title="Ausgabe teilen"
                                  >
                                    <Users className="w-4 h-4"/>
                                  </button>
                                )}
                                <button 
                                  onClick={() => handleEdit(tx)} 
                                  className="p-2 rounded-lg transition-all duration-200" 
                                  style={{ color: jonyColors.textSecondary }}
                                  onMouseEnter={(e) => {
                                    e.target.style.backgroundColor = jonyColors.cardBackground;
                                    e.target.style.color = jonyColors.textPrimary;
                                  }}
                                  onMouseLeave={(e) => {
                                    e.target.style.backgroundColor = 'transparent';
                                    e.target.style.color = jonyColors.textSecondary;
                                  }}
                                  title="Bearbeiten"
                                >
                                  <Edit className="w-4 h-4"/>
                                </button>
                                <button 
                                  onClick={() => handleDelete(tx)} 
                                  className="p-2 rounded-lg transition-all duration-200" 
                                  style={{ color: jonyColors.textSecondary }}
                                  onMouseEnter={(e) => {
                                    e.target.style.backgroundColor = jonyColors.redAlpha;
                                    e.target.style.color = jonyColors.red;
                                  }}
                                  onMouseLeave={(e) => {
                                    e.target.style.backgroundColor = 'transparent';
                                    e.target.style.color = jonyColors.textSecondary;
                                  }}
                                  title="Löschen"
                                >
                                  <Trash2 className="w-4 h-4"/>
                                </button>
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
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title={editingTransaction?.id ? "Transaktion bearbeiten" : "Neue Transaktion erstellen"} size="large">
        <TransactionForm transaction={editingTransaction} onSave={handleSave} onCancel={() => setModalOpen(false)} categories={categories} accounts={accounts} />
      </Modal>

      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => { setShowDeleteConfirm(false); setDeleteTransaction(null); }}
        onConfirm={confirmDelete}
        title="Transaktion löschen"
        message={`Möchtest du die Transaktion "${deleteTransaction?.recipient || 'Unbekannt'}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`}
      />
    </div>
  );
};

export default TransactionsPage;