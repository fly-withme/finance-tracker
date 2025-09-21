import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../utils/db';
import { jonyColors } from '../theme';

// Import more icons for categories
import { Plus, Trash2, Search, Filter, ChevronLeft, ChevronRight, Users, X, Repeat, Utensils, ShoppingCart, Home, Gift, Fuel, Film, PiggyBank, Briefcase } from 'lucide-react';

// UI Components
import Modal from './ui/Modal';
import ConfirmationModal from './ui/ConfirmationModal';
import TransactionForm from './forms/TransactionForm';

// --- THEME ENGINE (Improved with more categories) ---
const transactionThemes = [
  { name: 'Food & Dining', keywords: ['essen', 'food', 'restaurant', 'lieferando', 'rewe', 'edeka', 'supermarkt', 'groceries'], Icon: Utensils },
  { name: 'Shopping', keywords: ['shopping', 'einkauf', 'zalando', 'amazon', 'kleidung', 'ikea', 'electronics', 'clothing'], Icon: ShoppingCart },
  { name: 'Transportation', keywords: ['transport', 'auto', 'car', 'db', 'bahn', 'fuel', 'tanken', 'gas'], Icon: Fuel },
  { name: 'Housing', keywords: ['miete', 'wohnen', 'rent', 'housing'], Icon: Home },
  { name: 'Entertainment', keywords: ['kino', 'cinema', 'film', 'spotify', 'netflix', 'music'], Icon: Film },
  { name: 'Salary', keywords: ['gehalt', 'salary', 'einkommen', 'paycheck'], Icon: PiggyBank },
  { name: 'Business', keywords: ['work', 'business', 'geschäft'], Icon: Briefcase },
];

const defaultTheme = {
  Icon: Gift,
};

const getTransactionTheme = (categoryName) => {
  if (!categoryName) return defaultTheme;
  const name = categoryName.toLowerCase();
  const theme = transactionThemes.find(theme => 
    theme.keywords.some(keyword => name.includes(keyword))
  );
  return theme || defaultTheme;
};
// --- END THEMING ENGINE ---


const TransactionsPage = () => {
  // --- STATE MANAGEMENT ---
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedRecipient, setSelectedRecipient] = useState('');
  const [dateRangeFilter, setDateRangeFilter] = useState('all'); // 'all', 'week', 'month', '3months', '6months', 'year'
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
      if (!tx.date) return false; // Skip transactions without valid dates
      const txDate = new Date(tx.date);
      if (isNaN(txDate.getTime())) return false; // Skip invalid date objects
      const now = new Date();
      
      // Check if any filters are active (excluding search)
      const hasNonSearchFilters = selectedCategory || selectedRecipient || dateRangeFilter !== 'all';
      
      // Date range filter
      if (dateRangeFilter !== 'all') {
        let cutoffDate = new Date();
        switch (dateRangeFilter) {
          case 'week':
            cutoffDate.setDate(now.getDate() - 7);
            break;
          case 'month':
            cutoffDate.setMonth(now.getMonth() - 1);
            break;
          case '3months':
            cutoffDate.setMonth(now.getMonth() - 3);
            break;
          case '6months':
            cutoffDate.setMonth(now.getMonth() - 6);
            break;
          case 'year':
            cutoffDate.setFullYear(now.getFullYear() - 1);
            break;
        }
        if (txDate < cutoffDate) return false;
      }
      
      // Month filter only applies when no search query and no other filters are active
      if (!searchQuery && !hasNonSearchFilters) {
        if (txDate.getMonth() !== selectedDate.getMonth() || txDate.getFullYear() !== selectedDate.getFullYear()) return false;
      }
      
      // Search query filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const searchFields = [tx.recipient, tx.description, tx.category];
        if (!searchFields.some(field => field?.toLowerCase().includes(query))) return false;
      }
      
      // Category and recipient filters
      if (selectedCategory && tx.category !== selectedCategory) return false;
      if (selectedRecipient && tx.recipient !== selectedRecipient) return false;
      
      return true;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [transactions, selectedDate, searchQuery, selectedCategory, selectedRecipient, dateRangeFilter]);


  const hasActiveFilters = searchQuery || selectedCategory || selectedRecipient || dateRangeFilter !== 'all';

  // --- Group transactions by date for the feed view ---
  const groupedTransactions = useMemo(() => {
    return filteredTransactions.reduce((acc, tx) => {
      const date = tx.date ? new Date(tx.date).toISOString().split('T')[0] : 'invalid-date';
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(tx);
      return acc;
    }, {});
  }, [filteredTransactions]);

  // NEU: fehlende Sortierung der Datums-Gruppen
  const sortedDateKeys = useMemo(
    () => Object.keys(groupedTransactions).sort((a, b) => new Date(b) - new Date(a)),
    [groupedTransactions]
  );

  const formatDateGroup = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return 'Heute';
    if (date.toDateString() === yesterday.toDateString()) return 'Gestern';
    return new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }).format(date);
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
    setSelectedRecipient('');
    setDateRangeFilter('all');
  };
  const formatCurrency = (amount) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);

  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: jonyColors.background, color: jonyColors.textPrimary }}>
      <div className="px-6 py-8 mb-2">
        <div className="max-w-7xl mx-auto">
        
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: jonyColors.accent1 }}></div>
              <h1 className="text-3xl font-bold tracking-tight" style={{ color: jonyColors.textPrimary, letterSpacing: '-0.02em' }}>
                Transaktionen
              </h1>
              <div className="px-3 py-1 rounded-full font-semibold text-sm" style={{ 
                backgroundColor: filteredTransactions.length > 0 ? jonyColors.accent1Alpha : 'transparent', 
                color: filteredTransactions.length > 0 ? jonyColors.accent1 : 'transparent' 
              }}>
                {filteredTransactions.length || '0'}
              </div>
            </div>

            {/* Month Navigation - moved to top right */}
            <div className="flex items-center gap-3">
              <button
                onClick={goToPreviousMonth}
                className="p-3 rounded-full transition-all duration-200 hover:scale-105 focus:outline-none"
                style={{ backgroundColor: jonyColors.cardBackground, color: jonyColors.textSecondary }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = jonyColors.accent1Alpha;
                  e.target.style.color = jonyColors.accent1;
                  // Also style the icon inside
                  const icon = e.target.querySelector('svg');
                  if (icon) icon.style.color = jonyColors.accent1;
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = jonyColors.cardBackground;
                  e.target.style.color = jonyColors.textSecondary;
                  // Reset icon color
                  const icon = e.target.querySelector('svg');
                  if (icon) icon.style.color = jonyColors.textSecondary;
                }}
                title="Vorheriger Monat"
              >
                <ChevronLeft className="w-5 h-5 pointer-events-none transition-colors duration-200" style={{ color: jonyColors.textSecondary }} />
              </button>
              <div className="font-semibold text-center" style={{ color: jonyColors.textPrimary, minWidth: '200px', fontSize: '20px' }}>
                {selectedDate.toLocaleString('de-DE', { month: 'long', year: 'numeric' })}
              </div>
              <button
                onClick={goToNextMonth}
                className="p-3 rounded-full transition-all duration-200 hover:scale-105 focus:outline-none"
                style={{ backgroundColor: jonyColors.cardBackground, color: jonyColors.textSecondary }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = jonyColors.accent1Alpha;
                  e.target.style.color = jonyColors.accent1;
                  // Also style the icon inside
                  const icon = e.target.querySelector('svg');
                  if (icon) icon.style.color = jonyColors.accent1;
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = jonyColors.cardBackground;
                  e.target.style.color = jonyColors.textSecondary;
                  // Reset icon color
                  const icon = e.target.querySelector('svg');
                  if (icon) icon.style.color = jonyColors.textSecondary;
                }}
                title="Nächster Monat"
              >
                <ChevronRight className="w-5 h-5 pointer-events-none transition-colors duration-200" style={{ color: jonyColors.textSecondary }} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 mb-12">
        <div className="max-w-7xl mx-auto">
          <section className="mb-8">
              <div className="flex flex-col md:flex-row gap-4">
                  {/* UPDATE HIER: Tooltip-Logik für die Suchleiste */}
                  <div className="relative flex-grow group">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: jonyColors.textSecondary }} />
                      <input 
                          type="text" 
                          placeholder="Suchen nach Empfänger, Kategorie..." 
                          value={searchQuery} 
                          onChange={(e) => setSearchQuery(e.target.value)} 
                          className="w-full pl-12 pr-4 py-3 rounded-xl text-base transition-all duration-200" 
                          style={{ 
                            backgroundColor: jonyColors.cardBackground, 
                            color: jonyColors.textPrimary,
                            border: `1px solid ${jonyColors.border}`,
                            outline: 'none'
                          }} 
                      />
                      {/* Tooltip für die Suchleiste */}
                      <div 
                          className="absolute top-full mt-2 left-1/2 -translate-x-1/2 px-3 py-2 text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50"
                          style={{ backgroundColor: jonyColors.surface, color: jonyColors.textPrimary, border: `1px solid ${jonyColors.cardBorder}` }}
                      >
                          Suchen nach Empfänger oder Kategorie
                      </div>
                  </div>
                  <button onClick={() => setShowFilters(!showFilters)} className="flex items-center justify-center gap-2 px-4 py-3 rounded-full font-normal transition-colors" style={{ backgroundColor: jonyColors.background, color: jonyColors.textSecondary, border: `1px solid ${jonyColors.cardBorder}` }}>
                      <Filter className="w-5 h-5" strokeWidth={1.5} />
                      <span>Filter</span>
                      {hasActiveFilters && <div className="w-2 h-2 rounded-full" style={{backgroundColor: jonyColors.accent1}}></div>}
                  </button>
              </div>
              {showFilters && (
                  <div className="pt-4 mt-4 border-t" style={{ borderColor: jonyColors.border }}>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                              <label className="text-xs font-medium mb-1 block pl-4" style={{color: jonyColors.textSecondary}}>Zeitraum</label>
                              <select value={dateRangeFilter} onChange={(e) => setDateRangeFilter(e.target.value)} className="w-full px-3 py-3 rounded-full text-sm focus:outline-none appearance-none text-center" style={{ backgroundColor: jonyColors.background, border: `1px solid ${jonyColors.cardBorder}`, color: jonyColors.textPrimary }}>
                                  <option value="all">Aktueller Monat</option>
                                  <option value="week">Letzte 7 Tage</option>
                                  <option value="month">Letzter Monat</option>
                                  <option value="3months">Letzte 3 Monate</option>
                                  <option value="6months">Letzte 6 Monate</option>
                                  <option value="year">Letztes Jahr</option>
                              </select>
                          </div>
                          <div>
                              <label className="text-xs font-medium mb-1 block pl-4" style={{color: jonyColors.textSecondary}}>Kategorie</label>
                              <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="w-full px-3 py-3 rounded-full text-sm focus:outline-none appearance-none text-center" style={{ backgroundColor: jonyColors.background, border: `1px solid ${jonyColors.cardBorder}`, color: jonyColors.textPrimary }}>
                                  <option value="">Alle</option>
                                  {categories.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                              </select>
                          </div>
                          <div>
                              <label className="text-xs font-medium mb-1 block pl-4" style={{color: jonyColors.textSecondary}}>Empfänger</label>
                              <select value={selectedRecipient} onChange={(e) => setSelectedRecipient(e.target.value)} className="w-full px-3 py-3 rounded-full text-sm focus:outline-none appearance-none text-center" style={{ backgroundColor: jonyColors.background, border: `1px solid ${jonyColors.cardBorder}`, color: jonyColors.textPrimary }}>
                                  <option value="">Alle</option>
                                  {[...new Set(transactions.map(t => t.recipient).filter(Boolean))].sort().map(recipient => <option key={recipient} value={recipient}>{recipient}</option>)}
                              </select>
                          </div>
                      </div>
                      {hasActiveFilters && <button onClick={clearAllFilters} className="text-xs mt-4 flex items-center gap-1.5" style={{color: jonyColors.textSecondary}}><X className="w-4 h-4"/>Filter zurücksetzen</button>}
                  </div>
              )}
          </section>

        <main>
            {sortedDateKeys.length > 0 ? (

                <div className="space-y-8">
                    {sortedDateKeys.map(date => (
                        <div key={date}>
                            <h2 className="font-semibold mb-3 pl-2 text-sm" style={{color: jonyColors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em'}}>{formatDateGroup(date)}</h2>
                            <div className="space-y-1">
                                {groupedTransactions[date].map((tx) => {
                                    const isIncome = tx.amount > 0;
                                    const bgColor = isIncome ? jonyColors.accent1Alpha : jonyColors.magentaAlpha;
                                    const textColor = isIncome ? jonyColors.accent1 : jonyColors.magenta;
                                    const categoryInitial = tx.category ? tx.category[0].toUpperCase() : '?';
                                    return (
                                        <div key={tx.id} className="group flex items-center p-3 rounded-xl transition-colors hover:bg-[#1E1E1E] cursor-pointer" onClick={() => handleEdit(tx)}>
                                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                                <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm" style={{ backgroundColor: bgColor, color: textColor }}>{categoryInitial}</div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-semibold truncate">{tx.recipient || 'Unbekannt'}</p>
                                                    </div>
                                                    <p className="text-xs truncate" style={{ color: jonyColors.textSecondary }}>{tx.category}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-end gap-2 ml-4 flex-shrink-0">
                                                <div className="scale-0 group-hover:scale-100 origin-left transition-transform flex items-center gap-1">
                                                    <button onClick={(e) => { e.stopPropagation(); handleShareExpense(tx); }} className="p-2 rounded-lg text-gray-400 hover:text-green-500" title="Teilen"><Users className="w-4 h-4" /></button>
                                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(tx); }} className="p-2 rounded-lg text-gray-400 hover:text-pink-500" title="Löschen"><Trash2 className="w-4 h-4" /></button>
                                                </div>
                                                {tx.sharedWith && Array.isArray(tx.sharedWith) && tx.sharedWith.length > 0 && (
                                                    <div className="flex items-center gap-1 mr-2">
                                                        {(() => {
                                                            const validPersons = tx.sharedWith.filter(person => {
                                                                if (!person) {
                                                                    console.warn('Found null/undefined person in sharedWith array:', tx.id);
                                                                    return false;
                                                                }
                                                                if (!person.name) {
                                                                    console.warn('Found person without name in sharedWith array:', person, tx.id);
                                                                    return false;
                                                                }
                                                                return true;
                                                            });
                                                            return (
                                                                <>
                                                                    {validPersons.slice(0, 3).map((person, index) => {
                                                                        // Check if this person has paid (is in settledWithPersons array)
                                                                        const hasPaid = tx.settledWithPersons && tx.settledWithPersons.includes(person.name);
                                                                        const avatarColor = hasPaid ? jonyColors.accent1 : jonyColors.magenta;
                                                                        
                                                                        return (
                                                                            <div 
                                                                                key={index}
                                                                                className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold text-white"
                                                                                style={{ backgroundColor: avatarColor }}
                                                                                title={`${person.name || 'Unbekannt'}${hasPaid ? ' ✓ Bezahlt' : ''}`}
                                                                            >
                                                                                {(person.name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                    {validPersons.length > 3 && (
                                                                        <div 
                                                                            className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold"
                                                                            style={{ 
                                                                                backgroundColor: jonyColors.textSecondary,
                                                                                color: jonyColors.background
                                                                            }}
                                                                            title={`+${validPersons.length - 3} weitere`}
                                                                        >
                                                                            +{validPersons.length - 3}
                                                                        </div>
                                                                    )}
                                                                </>
                                                            );
                                                        })()}
                                                    </div>
                                                )}
                                                {tx.sharedWith && Array.isArray(tx.sharedWith) && tx.sharedWith.length > 0 ? (
                                                    <div className="text-right">
                                                        <p className="font-semibold text-lg" style={{color: isIncome ? jonyColors.accent1 : jonyColors.textPrimary}}>
                                                            {isIncome ? '+' : ''}{formatCurrency(tx.amount)}
                                                        </p>
                                                        {tx.originalAmount && tx.originalAmount !== tx.amount && (
                                                            <p className="text-xs line-through" style={{color: jonyColors.textTertiary}}>
                                                                urspr: {formatCurrency(tx.originalAmount)}
                                                            </p>
                                                        )}
                                                        <p className="text-xs" style={{color: jonyColors.textSecondary}}>
                                                            Du: {formatCurrency(Math.abs(tx.originalAmount || tx.amount) / (tx.sharedWith.length + 1))}
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <p className="font-semibold text-lg" style={{color: isIncome ? jonyColors.accent1 : jonyColors.textPrimary}}>{isIncome ? '+' : ''}{formatCurrency(tx.amount)}</p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex items-center justify-center py-16">
                    <div className="text-center p-12 rounded-3xl border-2" style={{ 
                      backgroundColor: jonyColors.surface, 
                      border: `2px solid ${jonyColors.border}`,
                      width: '400px',
                      minHeight: '300px'
                    }}>
                        <div className="w-24 h-24 rounded-3xl mx-auto mb-8 flex items-center justify-center shadow-xl" style={{ backgroundColor: jonyColors.accent1 }}>
                            <Repeat className="w-12 h-12" style={{ color: jonyColors.background }} />
                        </div>
                        <h2 className="text-3xl font-black mb-4" style={{ color: jonyColors.textPrimary }}>Keine Transaktionen</h2>
                        <p className="text-lg leading-relaxed" style={{ color: jonyColors.textSecondary }}>Für die aktuelle Auswahl wurden keine Ergebnisse gefunden.</p>
                    </div>
                </div>
            )}
        </main>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title={editingTransaction?.id ? "Transaktion bearbeiten" : "Neue Transaktion"}>
        <TransactionForm transaction={editingTransaction} onSave={handleSave} onCancel={() => setModalOpen(false)} categories={categories} accounts={accounts} />
      </Modal>

      <ConfirmationModal isOpen={showDeleteConfirm} onClose={() => { setShowDeleteConfirm(false); setDeleteTransaction(null); }} onConfirm={confirmDelete} title="Transaktion löschen" message={`Sind Sie sicher, dass Sie die Transaktion mit "${deleteTransaction?.recipient || 'Unbekannt'}" löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.`} />
      
      {/* Fixed Floating Action Button */}
      <button
        onClick={() => { setEditingTransaction(null); setModalOpen(true); }}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl hover:shadow-3xl hover:scale-110 z-50"
        style={{ backgroundColor: jonyColors.accent1, color: jonyColors.background }}
        title="Neue Transaktion"
      >
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
};

export default TransactionsPage;