import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../utils/db';

// Icons from Lucide React
import { CheckCircle, Trash2, ArrowLeft, ArrowRight, Plus, X, Building, Calendar, Wallet } from 'lucide-react';

import AutocompleteCategorySelector from './AutocompleteCategorySelector'; // Your existing component

// Helper function for currency formatting
const formatCurrency = (amount) => 
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);

// The Final, Polished Inbox Page Component
const InboxPage = ({ categories, classifier }) => {
  const [isClient, setIsClient] = useState(false);
  const [currentTransactionIndex, setCurrentTransactionIndex] = useState(0);
  const [processingIds, setProcessingIds] = useState(new Set());
  const [sharedExpenseData, setSharedExpenseData] = useState(null);
  const [showClearConfirmation, setShowClearConfirmation] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  
  // State for the new people autocomplete
  const [personSearch, setPersonSearch] = useState('');
  const [showPersonSuggestions, setShowPersonSuggestions] = useState(false);

  // --- MOCK DATA ---
  const allContacts = [
    { name: 'Lukas', color: '#6366F1' },
    { name: 'Lotta', color: '#EC4899' },
    { name: 'Simon', color: '#10B981' },
    { name: 'Anna M.', color: '#F59E0B' },
    { name: 'Max K.', color: '#3B82F6' },
  ];
  const frequentContacts = allContacts.slice(0, 2);
  const personSuggestions = allContacts.filter(c => 
    c.name.toLowerCase().includes(personSearch.toLowerCase()) &&
    !sharedExpenseData?.sharedWith?.some(s => s.name === c.name)
  );
  
  useEffect(() => { setIsClient(true); }, []);

  const allInboxTransactions = useLiveQuery(() => 
    isClient ? db.inbox.orderBy('uploadedAt').reverse().toArray() : [],
    [isClient]
  );
  
  const inboxTransactions = allInboxTransactions?.filter(tx => !tx.skipped) || [];
  
  const currentTx = inboxTransactions?.[currentTransactionIndex];

  // --- Core Logic & Handlers (unchanged) ---

  const extractCategoryName = (suggestion) => {
    if (typeof suggestion === 'string') return suggestion;
    if (suggestion && typeof suggestion === 'object') {
      return suggestion.category?.name || suggestion.category || suggestion.name;
    }
    return null;
  };

  const handleCreateCategory = async (categoryName) => {
    try {
      const newCategory = { name: categoryName, color: `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}` };
      await db.categories.add(newCategory);
      return categoryName;
    } catch (error) { console.error('Error creating category:', error); return categoryName; }
  };
  
  const handleCategorizeTransaction = async (transaction, categoryName) => {
    if (!categoryName?.trim()) return;
    setProcessingIds(prev => new Set(prev).add(transaction.id));
    
    try {
      if (!categories?.find(cat => cat.name.toLowerCase() === categoryName.toLowerCase())) {
        await handleCreateCategory(categoryName);
      }

      const finalTransaction = {
        date: transaction.date, description: transaction.description, recipient: transaction.recipient,
        amount: transaction.amount, account: transaction.account, category: categoryName,
        ...(sharedExpenseData && {
          sharedWith: sharedExpenseData.sharedWith, splitType: sharedExpenseData.splitType
        })
      };
      
      await db.transactions.add(finalTransaction);
      if (classifier && transaction.description) {
        classifier.learn(transaction.description, categoryName);
        await db.settings.put({ key: 'mlModel', model: classifier.getModel() });
      }
      await db.inbox.delete(transaction.id);
      
      setSharedExpenseData(null);
      
      if (currentTransactionIndex >= inboxTransactions.length - 1) {
          setCurrentTransactionIndex(Math.max(0, inboxTransactions.length - 2));
      }

    } catch (error) {
      console.error('Error categorizing transaction:', error);
    } finally {
      setProcessingIds(prev => { const newSet = new Set(prev); newSet.delete(transaction.id); return newSet; });
    }
  };

  const handleDeleteTransaction = async (transactionId) => {
    try {
      await db.inbox.delete(transactionId);
      if (currentTransactionIndex >= inboxTransactions.length - 1) {
        setCurrentTransactionIndex(Math.max(0, inboxTransactions.length - 2));
      }
    } catch (error) { console.error('Error deleting transaction:', error); }
  };

  const handleClearInbox = async () => {
    setIsClearing(true);
    try {
      await db.inbox.clear();
      setShowClearConfirmation(false);
    } catch (error) { console.error('Error clearing inbox:', error); } 
    finally { setIsClearing(false); }
  };
  
  const toggleContactInShare = (contact) => {
    const existingContacts = sharedExpenseData?.sharedWith || [];
    const isSelected = existingContacts.some(c => c.name === contact.name);
    let newSharedWith = isSelected
      ? existingContacts.filter(c => c.name !== contact.name)
      : [...existingContacts, contact];

    if (newSharedWith.length === 0) {
        setSharedExpenseData(null);
        return;
    }

    const splitAmount = Math.abs(currentTx.amount) / (newSharedWith.length + 1);
    setSharedExpenseData({
      splitType: 'equal',
      sharedWith: newSharedWith.map(c => ({...c, amount: splitAmount}))
    });
  };

  const handleAddPerson = (name) => {
    const trimmedName = name.trim();
    if (!trimmedName || sharedExpenseData?.sharedWith?.some(c => c.name === trimmedName)) {
        setPersonSearch('');
        return;
    }
    const existingContact = allContacts.find(c => c.name.toLowerCase() === trimmedName.toLowerCase());
    const newContact = existingContact 
        ? existingContact 
        : { name: trimmedName, color: '#737373', amount: 0 }; 
        
    toggleContactInShare(newContact);
    setPersonSearch('');
    setShowPersonSuggestions(false);
  };

  useEffect(() => {
    setSharedExpenseData(null);
    setPersonSearch('');
  }, [currentTransactionIndex]);

  useEffect(() => {
    const handleKeyPress = (e) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) return;
      if (!currentTx) return;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          if (currentTransactionIndex > 0) setCurrentTransactionIndex(prev => prev - 1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (currentTransactionIndex < inboxTransactions.length - 1) setCurrentTransactionIndex(prev => prev + 1);
          break;
        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          handleDeleteTransaction(currentTx.id);
          break;
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentTransactionIndex, inboxTransactions]);

  if (!isClient || !allInboxTransactions) {
    return <div className="flex items-center justify-center min-h-screen bg-white text-slate-500 font-sans">Lade Transaktionen...</div>;
  }

  // --- UI-Rendering ---
  return (
    <div className="min-h-screen bg-white font-sans text-slate-800 p-4 sm:p-6 md:p-8 flex flex-col items-center">
      
      <header className="w-full max-w-7xl mx-auto mb-6">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
                <h1 className="text-3xl font-bold text-slate-900">Posteingang</h1>
                {inboxTransactions.length > 0 && (
                  <div className="px-3 py-1 bg-slate-100 text-slate-700 font-semibold text-sm rounded-full">
                    {inboxTransactions.length}
                  </div>
                )}
            </div>
            {inboxTransactions.length > 0 && (
                <button
                    onClick={() => setShowClearConfirmation(true)}
                    className="flex items-center justify-center gap-2 bg-white text-slate-700 border border-slate-300 hover:bg-red-50 hover:text-red-600 hover:border-red-300 rounded-lg transition-colors duration-200 text-base font-medium py-3 px-6"
                    disabled={isClearing}>
                    <Trash2 className="w-5 h-5" />
                    <span className="hidden sm:inline">Alles leeren</span>
                </button>
            )}
        </div>
      </header>
      
      <main className="w-full max-w-7xl flex-grow flex flex-col">
        {inboxTransactions.length === 0 || !currentTx ? (
          <div className="flex-grow flex flex-col items-center justify-center bg-white rounded-3xl border border-slate-200">
            <div className="text-center p-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-5">
                <CheckCircle className="w-9 h-9 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800">Perfekt organisiert</h2>
              <p className="text-slate-500 mt-2 max-w-sm mx-auto">Dein Posteingang ist leer. Gute Arbeit!</p>
            </div>
          </div>
        ) : (
          <div className="w-full bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden flex flex-col flex-grow">
            <div className="grid lg:grid-cols-2 flex-grow">
              
              <div className="p-6 bg-slate-50/50 h-full">
                {/* ## UPDATED: Unified Card with a Single Surface ## */}
                <div className="relative h-full bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] rounded-2xl text-white p-8 flex flex-col overflow-hidden shadow-[0_10px_20px_rgba(0,0,0,0.15),_0_3px_6px_rgba(0,0,0,0.1)] ring-1 ring-inset ring-white/20">

                    {/* Background elements for texture */}
                    <div className="absolute top-0 left-0 w-full h-full bg-grid-slate-700/20 [mask-image:linear-gradient(0deg,transparent,black)] opacity-50"></div>
                    <div className="absolute -top-1/4 -right-1/4 w-80 h-80 bg-white/5 rounded-full blur-3xl opacity-70"></div>

                    {/* Header Section */}
                    <div className="flex items-center gap-4 z-10">
                        <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center border border-white/20 backdrop-blur-sm">
                            <Building className="w-6 h-6 text-white/80"/>
                        </div>
                        <div>
                            <p className="text-xl font-bold">{currentTx.recipient || 'Unbekannter Empfänger'}</p>
                            <p className="text-sm text-purple-200">{currentTx.description || 'Keine Beschreibung'}</p>
                        </div>
                    </div>

                    {/* Main Content Area - Simplified */}
                    <div className="flex-grow flex flex-col items-center justify-center z-10">
                        <p className={`text-7xl font-extrabold tracking-tighter text-shadow-lg ${currentTx.amount > 0 ? 'text-green-300' : 'text-white'}`}>
                            {formatCurrency(currentTx.amount)}
                        </p>
                    </div>

                    {/* Footer Section - Simplified */}
                    <div className="flex justify-between items-center z-10">
                        <div className="flex items-center gap-2 text-sm">
                            <Calendar className="w-4 h-4 text-purple-200"/>
                            <span className="font-medium">{new Date(currentTx.date).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            <Wallet className="w-4 h-4 text-purple-200"/>
                            <span className="font-medium">{currentTx.account || 'Importiert'}</span>
                        </div>
                    </div>
                </div>
              </div>

              <div className="p-8 flex flex-col space-y-6">
                 <div>
                    <h3 className="text-lg font-semibold text-slate-800 mb-4">Kategorie zuweisen</h3>
                    <AutocompleteCategorySelector
                        key={currentTx.id} categories={categories || []}
                        suggestions={classifier?.getCategorySuggestions(currentTx.description, categories || []).map(extractCategoryName).filter(Boolean) || []}
                        onSelect={(categoryName) => handleCategorizeTransaction(currentTx, categoryName)}
                        onCreateCategory={(categoryName) => handleCategorizeTransaction(currentTx, categoryName)} />
                 </div>

                 {classifier?.getCategorySuggestions(currentTx.description, categories || []).length > 0 && (
                    <div>
                        <p className="text-xs font-medium text-slate-500 mb-2">Vorschläge</p>
                        <div className="flex flex-wrap gap-2">
                            {classifier.getCategorySuggestions(currentTx.description, categories || []).slice(0, 3).map((suggestion, idx) => (
                                <button key={idx} onClick={() => handleCategorizeTransaction(currentTx, extractCategoryName(suggestion))}
                                    className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium transition-colors">
                                    {extractCategoryName(suggestion)}
                                </button>
                            ))}
                        </div>
                    </div>
                 )}

                {currentTx.amount < 0 && (
                  <div className="pt-6 border-t border-slate-200">
                    <h3 className="text-lg font-semibold text-slate-800 mb-4">Ausgabe teilen</h3>
                    <div className="relative">
                      <input type="text" value={personSearch} onChange={(e) => setPersonSearch(e.target.value)}
                        onFocus={() => setShowPersonSuggestions(true)} onBlur={() => setTimeout(() => setShowPersonSuggestions(false), 150)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddPerson(personSearch)}
                        placeholder="Person suchen oder hinzufügen..."
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow" />
                      {showPersonSuggestions && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg">
                          {personSuggestions.map(person => ( <div key={person.name} onClick={() => handleAddPerson(person.name)} className="px-4 py-2 hover:bg-slate-100 cursor-pointer text-sm">{person.name}</div> ))}
                          {personSearch && !allContacts.some(c => c.name.toLowerCase() === personSearch.toLowerCase()) && (
                             <div onClick={() => handleAddPerson(personSearch)} className="px-4 py-2 hover:bg-slate-100 cursor-pointer text-sm flex items-center gap-2">
                                <Plus className="w-4 h-4 text-indigo-500"/> <span className="font-semibold">"{personSearch}"</span> hinzufügen
                             </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="mt-4">
                        <p className="text-xs font-medium text-slate-500 mb-2">Häufige Kontakte</p>
                        <div className="flex flex-wrap gap-2">
                            {frequentContacts.map((person) => {
                                const isSelected = sharedExpenseData?.sharedWith?.some(s => s.name === person.name); if (isSelected) return null;
                                return ( <button key={person.name} onClick={() => toggleContactInShare(person)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors">{person.name}</button> );
                            })}
                        </div>
                    </div>
                    {sharedExpenseData && sharedExpenseData.sharedWith.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-slate-200 space-y-2">
                           <ul className="space-y-1">
                              {sharedExpenseData.sharedWith.map(person => (
                                 <li key={person.name} className="flex justify-between items-center text-sm p-2 rounded-md bg-slate-50">
                                    <div className="flex items-center gap-2">
                                       <div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: person.color}}></div>
                                       <span className="font-medium text-slate-700">{person.name}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="font-semibold text-slate-800">{formatCurrency(person.amount)}</span>
                                        <button onClick={() => toggleContactInShare(person)} className="text-slate-400 hover:text-red-500"><X className="w-3.5 h-3.5"/></button>
                                    </div>
                                 </li>
                              ))}
                               <li className="flex justify-between items-center text-sm p-2 rounded-md bg-indigo-50 mt-2">
                                  <span className="font-semibold text-indigo-800">Dein Anteil</span>
                                  <span className="font-bold text-indigo-800">{formatCurrency(Math.abs(currentTx.amount) - (sharedExpenseData.sharedWith.reduce((acc, p) => acc + p.amount, 0)))}</span>
                               </li>
                           </ul>
                        </div>
                    )}
                  </div>
                )}
                <div className="flex-grow flex items-end justify-end">
                    <button onClick={() => handleDeleteTransaction(currentTx.id)} className="bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-base font-medium transition-colors py-3 px-6">Löschen</button>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50/70 border-t border-slate-200 flex justify-between items-center">
                <button onClick={() => setCurrentTransactionIndex(prev => prev - 1)} disabled={currentTransactionIndex === 0}
                    className="flex items-center justify-center gap-2 bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 rounded-lg text-base font-medium py-3 px-6">
                    <ArrowLeft className="w-5 h-5" />
                    <span>Zurück</span>
                </button>
                <div className="text-sm font-medium text-slate-600">{currentTransactionIndex + 1} von {inboxTransactions.length}</div>
                <button onClick={() => setCurrentTransactionIndex(prev => prev + 1)} disabled={currentTransactionIndex === inboxTransactions.length - 1}
                    className="flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 ease-in-out rounded-lg shadow-lg hover:shadow-xl text-base font-medium py-3 px-6">
                    <span>Nächste</span>
                    <ArrowRight className="w-5 h-5" />
                </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default InboxPage;