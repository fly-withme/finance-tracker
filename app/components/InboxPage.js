import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../utils/db';

// Unified icon system
import { 
  CheckCircle, Trash2, ArrowLeft, Plus, X, Building, Calendar, 
  Wallet, SkipForward, Tag, Users, Sparkles, Clock, TrendingUp,
  AlertCircle, Search, Brain, Send, Target, Receipt, User, Crown, 
  Flame, CreditCard, ChevronRight, Zap
} from 'lucide-react';

import AutocompleteCategorySelector from './AutocompleteCategorySelector';

const formatCurrency = (amount) => 
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);

const InboxPage = ({ categories, classifier, enhancedClassifier, useEnhancedML }) => {
  const [isClient, setIsClient] = useState(false);
  const [currentTransactionIndex, setCurrentTransactionIndex] = useState(0);
  const [processingIds, setProcessingIds] = useState(new Set());
  const [sharedExpenseData, setSharedExpenseData] = useState(null);
  const [showClearConfirmation, setShowClearConfirmation] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [personSearch, setPersonSearch] = useState('');
  const [showPersonSuggestions, setShowPersonSuggestions] = useState(false);

  // Load contacts
  const allContacts = useLiveQuery(() => 
    isClient ? db.contacts?.toArray() : [], [isClient]
  ) || [];
  const frequentContacts = allContacts.slice(0, 4);
  const personSuggestions = allContacts.filter(c => 
    c.name.toLowerCase().includes(personSearch.toLowerCase()) &&
    !sharedExpenseData?.sharedWith?.some(s => s.name === c.name)
  );
  
  useEffect(() => { setIsClient(true); }, []);

  const allInboxTransactions = useLiveQuery(() => 
    isClient ? db.inbox.orderBy('uploadedAt').reverse().toArray() : [], [isClient]
  );
  
  const inboxTransactions = allInboxTransactions?.filter(tx => !tx.skipped) || [];
  const currentTx = inboxTransactions?.[currentTransactionIndex];

  // Enhanced ML suggestions with unified styling
  const getMLSuggestions = (transaction) => {
    if (!transaction) return [];
    const suggestions = [];
    const classifierSuggestions = useEnhancedML && enhancedClassifier 
      ? enhancedClassifier.getCategorySuggestions(transaction, categories || [])
      : classifier?.getCategorySuggestions(transaction.description, categories || [], 3) || [];
    
    classifierSuggestions.forEach(suggestion => {
      const categoryName = useEnhancedML ? suggestion.category?.name : 
        typeof suggestion === 'string' ? suggestion : suggestion.category?.name || suggestion.category || suggestion.name;
      if (categoryName) {
        const confidence = useEnhancedML ? suggestion.confidence : (suggestion.confidence || 0.7);
        suggestions.push({
          name: categoryName,
          confidence,
          ...getConfidenceStyle(confidence)
        });
      }
    });
    return suggestions.slice(0, 3);
  };

  const getConfidenceStyle = (confidence) => {
    if (confidence >= 0.9) return { 
      icon: Crown, 
      iconColor: 'text-amber-500', 
      bgColor: 'bg-amber-50 dark:bg-amber-950/30',
      borderColor: 'border-amber-200 dark:border-amber-800',
      textColor: 'text-amber-900 dark:text-amber-100'
    };
    if (confidence >= 0.75) return { 
      icon: Flame, 
      iconColor: 'text-orange-500', 
      bgColor: 'bg-orange-50 dark:bg-orange-950/30',
      borderColor: 'border-orange-200 dark:border-orange-800',
      textColor: 'text-orange-900 dark:text-orange-100'
    };
    return { 
      icon: Target, 
      iconColor: 'text-blue-500', 
      bgColor: 'bg-blue-50 dark:bg-blue-950/30',
      borderColor: 'border-blue-200 dark:border-blue-800',
      textColor: 'text-blue-900 dark:text-blue-100'
    };
  };

  const handleCreateCategory = async (categoryName) => {
    try {
      const newCategory = { 
        name: categoryName, 
        color: `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`,
        createdAt: new Date().toISOString()
      };
      await db.categories.add(newCategory);
      return categoryName;
    } catch (error) { 
      console.error('Error creating category:', error); 
      return categoryName; 
    }
  };
  
  const handleProcessTransaction = async () => {
    if (!currentTx || !selectedCategory.trim()) return;
    const categoryName = selectedCategory.trim();
    
    setProcessingIds(prev => new Set(prev).add(currentTx.id));
    
    try {
      if (!categories?.find(cat => cat.name.toLowerCase() === categoryName.toLowerCase())) {
        await handleCreateCategory(categoryName);
      }

      const finalTransaction = {
        date: currentTx.date, 
        description: currentTx.description, 
        recipient: currentTx.recipient,
        amount: currentTx.amount, 
        account: currentTx.account, 
        category: categoryName,
        processedAt: new Date().toISOString(),
        ...(sharedExpenseData && {
          sharedWith: sharedExpenseData.sharedWith, 
          splitType: sharedExpenseData.splitType
        })
      };
      
      await db.transactions.add(finalTransaction);
      
      if (sharedExpenseData && sharedExpenseData.sharedWith.length > 0) {
        const expense = {
          description: currentTx.description,
          totalAmount: Math.abs(currentTx.amount),
          date: currentTx.date,
          paidBy: 'Me',
          settledAmount: 0,
          createdAt: new Date().toISOString(),
          sharedWith: sharedExpenseData.sharedWith.map(p => ({
            ...p,
            amount: sharedExpenseData.splitType === 'equal' 
              ? Math.abs(currentTx.amount) / (sharedExpenseData.sharedWith.length + 1)
              : p.amount
          })),
          splitType: sharedExpenseData.splitType
        };
        await db.sharedExpenses.add(expense);
      }
      
      if (classifier && typeof classifier.getModel === 'function' && currentTx.description) {
        classifier.learn(currentTx.description, categoryName);
        await db.settings.put({ key: 'mlModel', model: classifier.getModel() });
      }
      
      if (enhancedClassifier && typeof enhancedClassifier.getEnhancedModel === 'function' && useEnhancedML) {
        enhancedClassifier.learn(finalTransaction, categoryName);
        await db.settings.put({ key: 'enhancedMLModel', model: enhancedClassifier.getEnhancedModel() });
      }
      
      await db.inbox.delete(currentTx.id);
      
      setSharedExpenseData(null);
      setSelectedCategory('');
      
      const newLength = inboxTransactions.length - 1;
      if (newLength === 0) {
        setCurrentTransactionIndex(0);
      } else if (currentTransactionIndex >= newLength) {
        setCurrentTransactionIndex(newLength - 1);
      }

    } catch (error) {
      console.error('Error processing transaction:', error);
    } finally {
      setProcessingIds(prev => { 
        const newSet = new Set(prev); 
        newSet.delete(currentTx.id); 
        return newSet; 
      });
    }
  };

  const handleDeleteTransaction = async (transactionId) => {
    try {
      await db.inbox.delete(transactionId);
      const newLength = inboxTransactions.length - 1;
      if (newLength === 0) {
        setCurrentTransactionIndex(0);
      } else if (currentTransactionIndex >= newLength) {
        setCurrentTransactionIndex(newLength - 1);
      }
      setSelectedCategory('');
      setSharedExpenseData(null);
    } catch (error) { 
      console.error('Error deleting transaction:', error); 
    }
  };

  const handleSkipTransaction = () => {
    setSelectedCategory('');
    setSharedExpenseData(null);
    
    if (currentTransactionIndex < inboxTransactions.length - 1) {
      setCurrentTransactionIndex(prev => prev + 1);
    } else {
      setCurrentTransactionIndex(0);
    }
  };

  const handleClearInbox = async () => {
    setIsClearing(true);
    try {
      await db.inbox.clear();
      setShowClearConfirmation(false);
    } catch (error) { 
      console.error('Error clearing inbox:', error); 
    } finally { 
      setIsClearing(false); 
    }
  };

  const toggleContactInShare = (contact) => {
    const existingContacts = sharedExpenseData?.sharedWith || [];
    const isSelected = existingContacts.some(c => c.name === contact.name);
    let newSharedWith = isSelected
      ? existingContacts.filter(c => c.name !== contact.name)
      : [...existingContacts, contact];

    // Limitiere auf maximal 3 Personen
    if (!isSelected && newSharedWith.length > 3) {
      return;
    }

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
    
    // Limitiere auf maximal 3 Personen
    if (sharedExpenseData?.sharedWith?.length >= 3) {
      setPersonSearch('');
      return;
    }
    
    let contact = allContacts.find(c => c.name.toLowerCase() === trimmedName.toLowerCase());
    
    if (!contact) {
      const colors = ['#3B82F6', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#EF4444'];
      contact = { 
        name: trimmedName, 
        color: colors[Math.floor(Math.random() * colors.length)],
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
  
  const isActionable = selectedCategory.trim() !== '';

  useEffect(() => {
    setSharedExpenseData(null);
    setPersonSearch('');
    setSelectedCategory('');
  }, [currentTransactionIndex, currentTx?.id]);

  if (!isClient || !allInboxTransactions) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
            <Sparkles className="w-6 h-6 text-white animate-pulse" />
          </div>
          <p className="text-slate-600 dark:text-slate-400 font-medium">Lade Transaktionen...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-white dark:bg-slate-900 flex flex-col">
      
      <div className="flex-shrink-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl">
        <div className="p-4 sm:p-6 md:p-8">
          <div className="relative flex items-center">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
              Posteingang
            </h1>
            
            {inboxTransactions.length > 0 && currentTx && (
              <>
                <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center space-x-3">
                  <div className="w-[360px] h-2 bg-slate-200/50 dark:bg-slate-700/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-700 ease-out rounded-full"
                      style={{ width: `${((currentTransactionIndex + 1) / inboxTransactions.length) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">
                    {currentTransactionIndex + 1} / {inboxTransactions.length}
                  </span>
                </div>
                
                <div className="ml-auto">
                  <button
                    onClick={() => setShowClearConfirmation(true)}
                    className="px-4 py-2.5 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-xl transition-all duration-200 font-semibold shadow-sm hover:shadow-md text-sm"
                  >
                    <Trash2 className="w-4 h-4 inline mr-2" />
                    Alle löschen
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col px-8 py-6 min-h-0">
        
        {inboxTransactions.length === 0 || !currentTx ? (
          <div className="flex items-center justify-center flex-1">
            <div className="text-center p-12 bg-white dark:bg-slate-800 rounded-3xl border-2 border-slate-200/60 dark:border-slate-700/60 max-w-md">
              <div className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-green-600 rounded-3xl mx-auto mb-8 flex items-center justify-center shadow-xl">
                <CheckCircle className="w-12 h-12 text-white" />
              </div>
              <h2 className="text-3xl font-black text-slate-800 dark:text-slate-200 mb-4">
                Perfekt organisiert!
              </h2>
              <p className="text-slate-600 dark:text-slate-400 text-lg leading-relaxed">
                Alle Transaktionen wurden erfolgreich kategorisiert. Dein Posteingang ist leer!
              </p>
            </div>
          </div>
        ) : (
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
            
            <div className="lg:col-span-2">
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 flex flex-col" style={{ height: '580px' }}>
                
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                      <Calendar className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                      <span className="text-sm text-slate-700 dark:text-slate-300">
                        {new Date(currentTx.date).toLocaleDateString('de-DE', { 
                          day: '2-digit', month: 'short', year: 'numeric' 
                        })}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                      <CreditCard className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                      <span className="text-sm text-slate-700 dark:text-slate-300">
                        {currentTx.account || 'Import'}
                      </span>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleDeleteTransaction(currentTx.id)}
                    className="p-3 text-slate-400 hover:text-red-500 bg-slate-100 dark:bg-slate-700 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-all duration-300 shadow-sm hover:shadow-lg group"
                    title="Transaktion löschen"
                  >
                    <Trash2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  </button>
                </div>

                <div className="text-center flex-1 flex flex-col justify-center py-8">
                  <div className={`text-7xl font-black tracking-tight mb-4 ${
                    currentTx.amount > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                  }`}>
                    {formatCurrency(Math.abs(currentTx.amount))}
                  </div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 mb-2">
                    {currentTx.recipient || 'Unbekannter Empfänger'}
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-sm max-w-md mx-auto">
                    {currentTx.description || 'Keine Beschreibung verfügbar'}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-200/50 dark:border-slate-700/50 mt-auto">
                  <button 
                    onClick={() => setCurrentTransactionIndex(prev => prev - 1)} 
                    disabled={currentTransactionIndex === 0}
                    className="flex items-center space-x-2 px-5 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl border border-slate-200 dark:border-slate-600 transition-all duration-200 shadow-sm hover:shadow-md font-bold text-sm"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Zurück</span>
                  </button>
                  
                  {isActionable ? (
                    <button
                      onClick={handleProcessTransaction}
                      className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white rounded-2xl transition-all duration-200 font-bold shadow-lg hover:shadow-xl text-sm"
                    >
                      <span>Verarbeiten</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button 
                      onClick={handleSkipTransaction}
                      className="flex items-center space-x-2 px-5 py-3 bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-500 rounded-2xl transition-all duration-200 shadow-sm hover:shadow-md font-bold text-sm"
                    >
                      <span>Überspringen</span>
                      <SkipForward className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-6">
              
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex flex-col" style={{ height: '280px' }}>
                <div className="flex items-center space-x-2 mb-4 flex-shrink-0">
                  <Tag className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                  <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Kategorie</h4>
                </div>
                
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="flex-shrink-0">
                    <AutocompleteCategorySelector
                      key={currentTx.id} 
                      categories={categories || []}
                      suggestions={getMLSuggestions(currentTx).map(s => s.name)}
                      defaultValue={selectedCategory || currentTx.category || ''}
                      onSelect={(categoryName) => setSelectedCategory(categoryName)}
                      onCreateCategory={(categoryName) => setSelectedCategory(categoryName)} 
                    />
                  </div>
                  
                  {getMLSuggestions(currentTx).length > 0 && (
                    <div className="mt-4 flex-1 min-h-0 overflow-y-auto">
                      <div className="space-y-1">
                        {getMLSuggestions(currentTx).map((suggestion, idx) => (
                          <button 
                            key={idx}
                            onClick={() => setSelectedCategory(suggestion.name)}
                            className={`w-full group flex items-center justify-between p-2 rounded-lg transition-all duration-200 ${
                              selectedCategory === suggestion.name 
                                ? 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200' 
                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-slate-800 dark:hover:text-slate-200'
                            }`}
                          >
                            <span className="text-sm text-left">{suggestion.name}</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {Math.round(suggestion.confidence * 100)}%
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 flex flex-col" style={{ height: '280px' }}>
                {currentTx.amount < 0 ? (
                  <>
                  <div className="flex items-center space-x-3 mb-4 flex-shrink-0">
                    <Users className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Teilen</h3>
                  </div>
                  
                  <div className="flex-1 flex flex-col">
                    {/* Input zum Hinzufügen neuer Personen */}
                    <div className="mb-4">
                      <div className="relative">
                        <input 
                          type="text" 
                          value={personSearch} 
                          onChange={(e) => setPersonSearch(e.target.value)} 
                          onFocus={() => setShowPersonSuggestions(true)} 
                          onBlur={() => setTimeout(() => setShowPersonSuggestions(false), 150)} 
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              if (personSearch.trim()) {
                                handleAddPerson(personSearch.trim());
                              }
                            }
                          }}
                          placeholder="Person hinzufügen..." 
                          className="w-full px-4 py-3 text-base border rounded-lg text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors duration-200 bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600" 
                        />
                        {showPersonSuggestions && personSearch && (
                          <div className="absolute z-30 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto">
                            {frequentContacts.filter(p => 
                              p.name.toLowerCase().includes(personSearch.toLowerCase()) && 
                              !sharedExpenseData?.sharedWith?.some(s => s.name === p.name)
                            ).slice(0, 5).map(person => (
                              <button 
                                key={person.name} 
                                onClick={() => {
                                  toggleContactInShare(person);
                                  setPersonSearch('');
                                }} 
                                className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center space-x-3"
                              >
                                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold text-white" style={{backgroundColor: person.color}}>
                                  {person.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                </div>
                                <span>{person.name}</span>
                              </button>
                            ))}
                            {personSearch && !allContacts.some(c => c.name.toLowerCase() === personSearch.toLowerCase()) && (
                              <div className="border-t border-slate-200 dark:border-slate-700">
                                <button 
                                  onClick={() => {
                                    handleAddPerson(personSearch.trim());
                                    setPersonSearch('');
                                  }} 
                                  className="w-full text-left px-3 py-2 text-sm text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/50 flex items-center space-x-2"
                                >
                                  <Plus className="w-4 h-4" />
                                  <span>Person "{personSearch}" erstellen</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Geteilte Personen anzeigen */}
                    {sharedExpenseData && sharedExpenseData.sharedWith.length > 0 ? (
                      <div className="flex-1">
                        <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-3 uppercase tracking-wide">
                          Geteilt mit {sharedExpenseData.sharedWith.length} Person{sharedExpenseData.sharedWith.length > 1 ? 'en' : ''}
                        </div>
                        <div className="space-y-2 mb-4">
                          {sharedExpenseData.sharedWith.map(person => (
                            <div 
                              key={person.name} 
                              className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700 rounded-lg"
                            >
                              <div className="flex items-center space-x-3">
                                <div 
                                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold text-white"
                                  style={{backgroundColor: person.color}}
                                >
                                  {person.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                </div>
                                <div>
                                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{person.name}</span>
                                  <div className="text-xs text-slate-500 dark:text-slate-400">{formatCurrency(person.amount)}</div>
                                </div>
                              </div>
                              <button 
                                onClick={() => toggleContactInShare(person)} 
                                className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors"
                                title="Person entfernen"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="mt-auto pt-3 border-t border-slate-200 dark:border-slate-700">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-600 dark:text-slate-400">Dein Anteil:</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {formatCurrency(Math.abs(currentTx.amount) / (sharedExpenseData.sharedWith.length + 1))}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col justify-center">
                        <div className="text-center mb-4">
                          <p className="text-slate-500 dark:text-slate-400">Häufige Kontakte:</p>
                        </div>
                        <div className="space-y-2">
                          {frequentContacts.slice(0, 4).map((person) => (
                            <button 
                              key={person.name} 
                              onClick={() => toggleContactInShare(person)} 
                              className="w-full flex items-center space-x-3 p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg transition-all duration-200"
                            >
                              <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold text-white" style={{backgroundColor: person.color}}>
                                {person.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                              </div>
                              <span className="text-sm">{person.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-400 dark:text-slate-500">
                    <div className="text-center p-6">
                      <div className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-2xl mx-auto mb-3 flex items-center justify-center">
                        <Users className="w-5 h-5 opacity-50" />
                      </div>
                      <p className="text-sm font-bold">Nur bei Ausgaben verfügbar</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Diese Transaktion ist eine Einnahme</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {showClearConfirmation && ( <div className="fixed inset-0 bg-black/60 backdrop-blur-lg flex items-center justify-center z-50 p-4"> <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md border border-slate-200/50 dark:border-slate-700/50"> <div className="p-8"> <div className="flex items-center space-x-4 mb-6"> <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg"> <AlertCircle className="w-8 h-8 text-white" /> </div> <div> <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">Alle löschen?</h3> <p className="text-slate-500 dark:text-slate-400">Unwiderrufliche Aktion</p> </div> </div> <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-2xl mb-6 border border-red-200 dark:border-red-800"> <p className="text-slate-700 dark:text-slate-300 font-medium"> Alle <span className="font-bold text-red-600 dark:text-red-400">{inboxTransactions.length} Transaktionen</span> werden permanent gelöscht. </p> </div> <div className="flex space-x-4"> <button onClick={() => setShowClearConfirmation(false)} className="flex-1 py-4 px-6 text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-2xl transition-all duration-200 font-semibold shadow-sm hover:shadow-md"> Abbrechen </button> <button onClick={handleClearInbox} disabled={isClearing} className="flex-1 py-4 px-6 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 disabled:from-red-400 disabled:to-pink-400 text-white rounded-2xl transition-all duration-200 flex items-center justify-center space-x-3 font-bold shadow-lg hover:shadow-2xl"> {isClearing ? ( <> <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> <span>Lösche...</span> </> ) : ( <> <Trash2 className="w-5 h-5" /> <span>Löschen</span> </> )} </button> </div> </div> </div> </div> )}
    </div>
  );
};

export default InboxPage;