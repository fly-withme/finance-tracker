import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../utils/db';

// Icons from Lucide React
import { CheckCircle, Trash2, ArrowLeft, ArrowRight, Plus, X, Building, Calendar, Wallet, SkipForward } from 'lucide-react';

import AutocompleteCategorySelector from './AutocompleteCategorySelector'; // Your existing component

// Helper function for currency formatting
const formatCurrency = (amount) => 
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);

// The Final, Polished Inbox Page Component
const InboxPage = ({ categories, classifier, enhancedClassifier, useEnhancedML }) => {
  const [isClient, setIsClient] = useState(false);
  const [currentTransactionIndex, setCurrentTransactionIndex] = useState(0);
  const [processingIds, setProcessingIds] = useState(new Set());
  const [sharedExpenseData, setSharedExpenseData] = useState(null);
  const [showClearConfirmation, setShowClearConfirmation] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [isReadyToSubmit, setIsReadyToSubmit] = useState(false);
  
  // State for the new people autocomplete
  const [personSearch, setPersonSearch] = useState('');
  const [showPersonSuggestions, setShowPersonSuggestions] = useState(false);

  // Load contacts from database
  const allContacts = useLiveQuery(() => 
    isClient ? db.contacts?.toArray() : [],
    [isClient]
  ) || [];
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

  // --- Core Logic & Handlers ---

  const extractCategoryName = (suggestion) => {
    if (typeof suggestion === 'string') return suggestion;
    if (suggestion && typeof suggestion === 'object') {
      return suggestion.category?.name || suggestion.category || suggestion.name;
    }
    return null;
  };

  // Get top 3 ML-based category suggestions
  const getMLSuggestions = (transaction) => {
    const suggestions = [];
    
    // Get classifier suggestions (top 3)
    const classifierSuggestions = useEnhancedML && enhancedClassifier 
      ? enhancedClassifier.getCategorySuggestions(transaction, categories || [])
      : classifier?.getCategorySuggestions(transaction.description, categories || [], 3) || [];
    
    classifierSuggestions.forEach(suggestion => {
      const categoryName = useEnhancedML ? suggestion.category?.name : extractCategoryName(suggestion);
      if (categoryName) {
        suggestions.push({
          name: categoryName,
          source: useEnhancedML ? 'Enhanced ML' : 'ML',
          confidence: useEnhancedML ? suggestion.confidence : (suggestion.confidence || 0.7)
        });
      }
    });
    
    // Always return exactly 3 suggestions, pad with empty ones if needed
    while (suggestions.length < 3) {
      suggestions.push(null);
    }
    
    return suggestions.slice(0, 3);
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
      
      // NEUER TEIL: Erstellen eines Eintrags für geteilte Ausgaben
      if (sharedExpenseData && sharedExpenseData.sharedWith.length > 0) {
          const expense = {
              description: transaction.description,
              totalAmount: Math.abs(transaction.amount),
              date: transaction.date,
              paidBy: 'Me', // Annahme: Du hast bezahlt
              settledAmount: 0,
              sharedWith: sharedExpenseData.sharedWith.map(p => ({
                  ...p,
                  amount: sharedExpenseData.splitType === 'equal' 
                      ? Math.abs(transaction.amount) / (sharedExpenseData.sharedWith.length + 1)
                      : p.amount
              })),
              splitType: sharedExpenseData.splitType
          };
          await db.sharedExpenses.add(expense);
      }
      
      // Lerne mit ML-System
      if (classifier && transaction.description && typeof classifier.learn === 'function' && typeof classifier.getModel === 'function') {
        classifier.learn(transaction.description, categoryName);
        await db.settings.put({ key: 'mlModel', model: classifier.getModel() });
      }
      
      if (enhancedClassifier && useEnhancedML && typeof enhancedClassifier.learn === 'function' && typeof enhancedClassifier.getEnhancedModel === 'function') {
        enhancedClassifier.learn(finalTransaction, categoryName);
        await db.settings.put({ key: 'enhancedMLModel', model: enhancedClassifier.getEnhancedModel() });
      }
      await db.inbox.delete(transaction.id);
      
      setSharedExpenseData(null);
      setSelectedCategory(''); // Reset der Kategorieauswahl
      
      // Index korrekt anpassen nach dem Löschen einer Transaktion
      const newLength = inboxTransactions.length - 1; // Nach dem Löschen
      if (newLength === 0) {
        // Keine Transaktionen mehr übrig
        setCurrentTransactionIndex(0);
      } else if (currentTransactionIndex >= newLength) {
        // Wenn wir bei der letzten Transaktion waren, gehe zur vorletzten
        setCurrentTransactionIndex(newLength - 1);
      }
      // Sonst bleibt der Index gleich (zeigt automatisch die nächste Transaktion)

    } catch (error) {
      console.error('Error categorizing transaction:', error);
    } finally {
      setProcessingIds(prev => { const newSet = new Set(prev); newSet.delete(transaction.id); return newSet; });
    }
  };

  const handleDeleteTransaction = async (transactionId) => {
    try {
      await db.inbox.delete(transactionId);
      // Index korrekt anpassen nach dem Löschen einer Transaktion
      const newLength = inboxTransactions.length - 1; // Nach dem Löschen
      if (newLength === 0) {
        // Keine Transaktionen mehr übrig
        setCurrentTransactionIndex(0);
      } else if (currentTransactionIndex >= newLength) {
        // Wenn wir bei der letzten Transaktion waren, gehe zur vorletzten
        setCurrentTransactionIndex(newLength - 1);
      }
      // Reset der Auswahlen
      setSelectedCategory('');
      setSharedExpenseData(null);
    } catch (error) { console.error('Error deleting transaction:', error); }
  };

  const handleSkipTransaction = () => {
    // Reset der aktuellen Auswahlen
    setSelectedCategory('');
    setSharedExpenseData(null);
    
    // Zur nächsten Transaktion springen
    if (currentTransactionIndex < inboxTransactions.length - 1) {
      setCurrentTransactionIndex(prev => prev + 1);
    } else {
      // Wenn bei der letzten Transaktion, zur ersten springen
      setCurrentTransactionIndex(0);
    }
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

  const handleAddPerson = async (name) => {
    const trimmedName = name.trim();
    if (!trimmedName || sharedExpenseData?.sharedWith?.some(c => c.name === trimmedName)) {
        setPersonSearch('');
        return;
    }
    
    let contact = allContacts.find(c => c.name.toLowerCase() === trimmedName.toLowerCase());
    
    if (!contact) {
        // Create new contact and save to database
        const colors = ['#6366F1', '#EC4899', '#10B981', '#F59E0B', '#3B82F6', '#8B5CF6', '#F97316', '#06B6D4'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        
        contact = { 
            name: trimmedName, 
            color: randomColor,
            createdAt: new Date().toISOString()
        };
        
        try {
            await db.contacts.add(contact);
        } catch (error) {
            console.error('Error adding contact:', error);
        }
    }
        
    toggleContactInShare(contact);
    setPersonSearch('');
    setShowPersonSuggestions(false);
  };

  useEffect(() => {
    setSharedExpenseData(null);
    setPersonSearch('');
    setSelectedCategory('');
    setIsReadyToSubmit(false);
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
    return <div className="flex items-center justify-center min-h-screen bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-sans">Lade Transaktionen...</div>;
  }

  // --- UI-Rendering ---
  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 font-sans text-slate-800 dark:text-slate-200 p-4 sm:p-6 md:p-8 flex flex-col items-center">
      
      <header className="w-full max-w-7xl mx-auto mb-6">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
                <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Posteingang</h1>
                {inboxTransactions.length > 0 && (
                  <div className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-sm rounded-full">
                    {inboxTransactions.length}
                  </div>
                )}
            </div>
            {inboxTransactions.length > 0 && (
                <button
                    onClick={() => setShowClearConfirmation(true)}
                    className="flex items-center justify-center gap-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:bg-red-50 dark:hover:bg-red-900/50 hover:text-red-600 dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-800 rounded-lg transition-colors duration-200 text-base font-medium py-3 px-6"
                    disabled={isClearing}>
                    <Trash2 className="w-5 h-5" />
                    <span className="hidden sm:inline">Alles leeren</span>
                </button>
            )}
        </div>
      </header>
      

      <main className="w-full max-w-7xl flex-grow flex flex-col">
        {inboxTransactions.length === 0 || !currentTx ? (
          <div className="h-[calc(100vh-200px)] flex flex-col items-center justify-center bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700">
            <div className="text-center p-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 dark:bg-purple-900/50 rounded-full mb-5">
                <CheckCircle className="w-9 h-9 text-purple-600 dark:text-purple-400" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Perfekt organisiert</h2>
              <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-sm mx-auto">Dein Posteingang ist leer. Gute Arbeit!</p>
            </div>
          </div>
        ) : (
          <div className="w-full bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xl dark:shadow-slate-900/50 overflow-hidden h-[calc(100vh-200px)] flex flex-col">
            <div className="grid lg:grid-cols-2 flex-grow min-h-0">
              
              <div className="p-6 bg-white dark:bg-slate-800 h-full flex justify-center">
                {/* Dark Mode kompatible Transaktionskarte */}
                <div className="relative h-full w-full max-w-[calc(100%-32px)] bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-3xl p-8 flex flex-col overflow-hidden shadow-xl dark:shadow-slate-900/50">

                    {/* Delete Button - rechts oben */}
                    <button 
                      onClick={() => handleDeleteTransaction(currentTx.id)}
                      className="absolute top-6 right-6 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors z-20"
                      title="Transaktion löschen"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>

                    {/* Header Section */}
                    <div className="flex items-center gap-4 z-10 pr-12">
                        <div className="w-12 h-12 bg-slate-100 dark:bg-slate-600 rounded-lg flex items-center justify-center border border-slate-200 dark:border-slate-500">
                            <Building className="w-6 h-6 text-slate-600 dark:text-slate-400"/>
                        </div>
                        <div>
                            <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{currentTx.recipient || 'Unbekannter Empfänger'}</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{currentTx.description || 'Keine Beschreibung'}</p>
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="flex-grow flex flex-col items-center justify-center z-10">
                        <p className={`text-7xl font-extrabold tracking-tighter ${
                          currentTx.amount > 0 
                            ? 'text-green-600 dark:text-green-400' 
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                            {formatCurrency(currentTx.amount)}
                        </p>
                    </div>

                    {/* Footer Section */}
                    <div className="flex justify-between items-center z-10">
                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                            <Calendar className="w-4 h-4"/>
                            <span className="font-medium">{new Date(currentTx.date).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                            <Wallet className="w-4 h-4"/>
                            <span className="font-medium">{currentTx.account || 'Importiert'}</span>
                        </div>
                    </div>
                </div>
              </div>

              <div className="p-6 bg-white dark:bg-slate-800 flex flex-col space-y-4 overflow-y-auto min-h-0">
                 <div>
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">Kategorie zuweisen</h3>
                    {/* HINWEIS: Wenden Sie die gleichen Klassen wie beim unteren Input-Feld auf das Input-Element INNENHALB Ihrer AutocompleteCategorySelector Komponente an. */}
                    <AutocompleteCategorySelector
                        key={currentTx.id} categories={categories || []}
                        suggestions={getMLSuggestions(currentTx).filter(s => s !== null).map(s => s.name)}
                        defaultValue={selectedCategory || currentTx.category || ''}
                        onSelect={(categoryName) => setSelectedCategory(categoryName)}
                        onCreateCategory={(categoryName) => setSelectedCategory(categoryName)} />
                 </div>

                 {getMLSuggestions(currentTx).filter(s => s !== null).length > 0 && (
                    <div>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                          Top 3 Kategorievorschläge (ML-basiert)
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                            {getMLSuggestions(currentTx).map((suggestion, idx) => (
                                suggestion ? (
                                    <button 
                                      key={idx} 
                                      onClick={() => setSelectedCategory(suggestion.name)}
                                      className="flex flex-col items-center p-3 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 hover:from-blue-100 hover:to-indigo-100 dark:hover:from-blue-900/30 dark:hover:to-indigo-900/30 text-blue-700 dark:text-blue-300 rounded-lg transition-all duration-200 border border-blue-200 dark:border-blue-800"
                                      title={`${suggestion.source} - Confidence: ${Math.round(suggestion.confidence * 100)}%`}
                                    >
                                        <span className="text-sm font-medium text-center">{suggestion.name}</span>
                                        <span className="text-xs opacity-75 mt-1">
                                          {Math.round(suggestion.confidence * 100)}%
                                        </span>
                                    </button>
                                ) : (
                                    <div key={idx} className="flex flex-col items-center p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 opacity-50">
                                        <span className="text-sm text-slate-400">Keine weitere</span>
                                        <span className="text-xs text-slate-400">Vorhersage</span>
                                    </div>
                                )
                            ))}
                        </div>
                    </div>
                 )}

                {currentTx.amount < 0 && (
                  <div className="pt-6 border-t border-slate-200 dark:border-slate-700">
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">Ausgabe teilen</h3>
                    <div className="relative">
                      <input type="text" value={personSearch} onChange={(e) => setPersonSearch(e.target.value)}
                        onFocus={() => setShowPersonSuggestions(true)} onBlur={() => setTimeout(() => setShowPersonSuggestions(false), 150)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddPerson(personSearch)}
                        placeholder="Person suchen oder hinzufügen..."
                        className="w-full px-4 py-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-shadow placeholder-slate-400 dark:placeholder-slate-500" />
                      {showPersonSuggestions && (
                        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg">
                          {personSuggestions.map(person => ( <div key={person.name} onClick={() => handleAddPerson(person.name)} className="px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-600 cursor-pointer text-sm">{person.name}</div> ))}
                          {personSearch && !allContacts.some(c => c.name.toLowerCase() === personSearch.toLowerCase()) && (
                             <div onClick={() => handleAddPerson(personSearch)} className="px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-600 cursor-pointer text-sm flex items-center gap-2">
                                <Plus className="w-4 h-4 text-purple-500"/> <span className="font-semibold">"{personSearch}"</span> hinzufügen
                             </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="mt-4">
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Häufige Kontakte</p>
                        <div className="flex flex-wrap gap-2">
                            {frequentContacts.map((person) => {
                                const isSelected = sharedExpenseData?.sharedWith?.some(s => s.name === person.name); if (isSelected) return null;
                                return ( <button key={person.name} onClick={() => toggleContactInShare(person)} className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium transition-colors">{person.name}</button> );
                            })}
                        </div>
                    </div>
                    {sharedExpenseData && sharedExpenseData.sharedWith.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 space-y-2">
                           <ul className="space-y-1">
                              {sharedExpenseData.sharedWith.map(person => (
                                 <li key={person.name} className="flex justify-between items-center text-sm p-2 rounded-md bg-slate-50 dark:bg-slate-800">
                                    <div className="flex items-center gap-2">
                                       <div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: person.color}}></div>
                                       <span className="font-medium text-slate-700 dark:text-slate-300">{person.name}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="font-semibold text-slate-800 dark:text-slate-200">{formatCurrency(person.amount)}</span>
                                        <button onClick={() => toggleContactInShare(person)} className="text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400"><X className="w-3.5 h-3.5"/></button>
                                    </div>
                                 </li>
                              ))}
                               <li className="flex justify-between items-center text-sm p-2 rounded-md bg-purple-50 dark:bg-purple-900/50 mt-2">
                                  <span className="font-semibold text-purple-800 dark:text-purple-300">Dein Anteil</span>
                                  <span className="font-bold text-purple-800 dark:text-purple-300">{formatCurrency(Math.abs(currentTx.amount) - (sharedExpenseData.sharedWith.reduce((acc, p) => acc + p.amount, 0)))}</span>
                               </li>
                           </ul>
                        </div>
                    )}
                  </div>
                )}
                
                <div className="flex-grow"></div>
              </div>
            </div>

            <div className="flex-shrink-0 px-6 py-4 bg-slate-50 dark:bg-slate-800/70 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                <button onClick={() => setCurrentTransactionIndex(prev => prev - 1)} disabled={currentTransactionIndex === 0}
                    className="flex items-center justify-center gap-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 rounded-lg text-base font-medium py-3 px-6">
                    <ArrowLeft className="w-5 h-5" />
                    <span>Zurück</span>
                </button>
                <div className="text-sm font-medium text-slate-600 dark:text-slate-400">{currentTransactionIndex + 1} von {inboxTransactions.length}</div>
                {/* Dynamischer Button - Überspringen oder Speichern */}
                {selectedCategory || (sharedExpenseData && sharedExpenseData.sharedWith.length > 0) ? (
                  <button 
                    onClick={() => handleCategorizeTransaction(currentTx, selectedCategory)}
                    disabled={processingIds.has(currentTx.id)}
                    className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white border border-purple-600 transition-all duration-200 rounded-lg text-base font-semibold py-3 px-6"
                  >
                    {processingIds.has(currentTx.id) ? 'Wird verarbeitet...' : 'Speichern'}
                  </button>
                ) : (
                  <button 
                    onClick={handleSkipTransaction}
                    className="flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-all duration-200 rounded-lg text-base font-medium py-3 px-6"
                  >
                    <span>Überspringen</span>
                    <SkipForward className="w-4 h-4" />
                  </button>
                )}
            </div>
          </div>
        )}
      </main>

      {/* Clear Confirmation Modal */}
      {showClearConfirmation && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Posteingang leeren</h3>
                <button 
                  onClick={() => setShowClearConfirmation(false)} 
                  className="p-1 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                Möchtest du wirklich alle {inboxTransactions.length} Transaktionen aus dem Posteingang löschen? 
                Diese Aktion kann nicht rückgängig gemacht werden.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowClearConfirmation(false)}
                  className="flex-1 py-2 px-4 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleClearInbox}
                  disabled={isClearing}
                  className="flex-1 py-2 px-4 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {isClearing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Wird geleert...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Alles löschen
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InboxPage;