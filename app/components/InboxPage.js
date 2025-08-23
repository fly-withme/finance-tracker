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
  
  const handleCategorizeTransaction = async (transaction, categoryName) => {
    if (!categoryName?.trim()) return;
    setProcessingIds(prev => new Set(prev).add(transaction.id));
    
    try {
      if (!categories?.find(cat => cat.name.toLowerCase() === categoryName.toLowerCase())) {
        await handleCreateCategory(categoryName);
      }

      const finalTransaction = {
        date: transaction.date, 
        description: transaction.description, 
        recipient: transaction.recipient,
        amount: transaction.amount, 
        account: transaction.account, 
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
          description: transaction.description,
          totalAmount: Math.abs(transaction.amount),
          date: transaction.date,
          paidBy: 'Me',
          settledAmount: 0,
          createdAt: new Date().toISOString(),
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
      
      // ML Learning
      if (classifier && transaction.description) {
        classifier.learn(transaction.description, categoryName);
        await db.settings.put({ key: 'mlModel', model: classifier.getModel() });
      }
      
      if (enhancedClassifier && useEnhancedML) {
        enhancedClassifier.learn(finalTransaction, categoryName);
        await db.settings.put({ key: 'enhancedMLModel', model: enhancedClassifier.getEnhancedModel() });
      }
      
      await db.inbox.delete(transaction.id);
      
      setSharedExpenseData(null);
      setSelectedCategory('');
      
      // Smart navigation
      const newLength = inboxTransactions.length - 1;
      if (newLength === 0) {
        setCurrentTransactionIndex(0);
      } else if (currentTransactionIndex >= newLength) {
        setCurrentTransactionIndex(newLength - 1);
      }

    } catch (error) {
      console.error('Error categorizing transaction:', error);
    } finally {
      setProcessingIds(prev => { 
        const newSet = new Set(prev); 
        newSet.delete(transaction.id); 
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

  // Reset states on transaction change
  useEffect(() => {
    setSharedExpenseData(null);
    setPersonSearch('');
    setSelectedCategory('');
  }, [currentTransactionIndex]);

  if (!isClient || !allInboxTransactions) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 flex items-center justify-center">
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
      
      {/* Unified Header */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            
            {/* Brand */}
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                Posteingang
              </h1>
            </div>
            
            {/* Centered Progress Bar */}
            <div className="absolute left-1/2 transform -translate-x-1/2">
              {inboxTransactions.length > 0 && currentTx && (
                <div className="flex items-center space-x-6">
                  <div className="w-[424px] h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500 ease-out rounded-full"
                      style={{width: `${((currentTransactionIndex + 1) / inboxTransactions.length) * 100}%`}}
                    />
                  </div>
                  <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                    {currentTransactionIndex + 1} von {inboxTransactions.length}
                  </span>
                </div>
              )}
            </div>
            
            {/* Action */}
            {inboxTransactions.length > 0 && (
              <button
                onClick={() => setShowClearConfirmation(true)}
                className="px-6 py-3 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800 rounded-2xl transition-all duration-200 font-semibold shadow-sm hover:shadow-md"
                disabled={isClearing}
              >
                Alle löschen
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Flow */}
      <div className="max-w-7xl mx-auto p-8">
        
        {inboxTransactions.length === 0 || !currentTx ? (
          /* Unified Empty State */
          <div className="min-h-[60vh] flex items-center justify-center">
            <div className="text-center p-12 bg-transparent rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xl">
              <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-600 rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-lg">
                <CheckCircle className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-3">
                Perfekt organisiert!
              </h2>
              <p className="text-slate-600 dark:text-slate-400 text-lg">
                Alle Transaktionen wurden erfolgreich kategorisiert.
              </p>
            </div>
          </div>
        ) : (
          
          /* Single Display View Layout */
          <div className="h-[calc(100vh-180px)] grid lg:grid-cols-12 gap-8">
            
            {/* Transaction Card - Large Left Side */}
            <div className="lg:col-span-8 flex flex-col">
              <div className="bg-transparent rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xl p-8 relative overflow-hidden flex-1 flex flex-col">
                <div className="absolute inset-0 bg-gradient-to-br from-slate-50/30 to-transparent dark:from-slate-700/20" />
                
                <button 
                  onClick={() => handleDeleteTransaction(currentTx.id)}
                  className="absolute top-6 right-6 p-3 text-slate-400 hover:text-red-500 bg-white dark:bg-slate-700 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-2xl transition-all duration-300 shadow-lg hover:shadow-xl z-10 group"
                  title="Transaktion löschen"
                >
                  <Trash2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
                </button>

                <div className="relative z-10 flex-1 flex flex-col">
                  {/* Header with Date and Account */}
                  <div className="flex items-center space-x-6 mb-8">
                    <div className="flex items-center space-x-4 px-4 py-3 bg-slate-50 dark:bg-slate-700/50 rounded-2xl">
                      <Calendar className="w-5 h-5 text-blue-500" />
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Datum</p>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                          {new Date(currentTx.date).toLocaleDateString('de-DE', { 
                            day: '2-digit', 
                            month: 'long', 
                            year: 'numeric' 
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4 px-4 py-3 bg-slate-50 dark:bg-slate-700/50 rounded-2xl">
                      <Wallet className="w-5 h-5 text-purple-500" />
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Konto</p>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                          {currentTx.account || 'Import'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Amount Display - Centered */}
                  <div className="text-center py-16 flex-1 flex flex-col justify-center">
                    {currentTx.amount > 0 && (
                      <div className="inline-flex items-center space-x-3 px-4 py-2 rounded-2xl mb-6 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        <TrendingUp className="w-5 h-5" />
                        <span className="font-semibold">Einnahme</span>
                      </div>
                    )}
                    
                    <div className={`text-8xl font-black tracking-tight mb-6 ${
                      currentTx.amount > 0 
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}>
                      {formatCurrency(Math.abs(currentTx.amount))}
                    </div>
                    
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                      {currentTx.recipient || 'Unbekannter Empfänger'}
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-lg">
                      {currentTx.description || 'Keine Beschreibung verfügbar'}
                    </p>
                  </div>

                  {/* Footer with Navigation */}
                  <div className="flex items-center justify-between pt-8 border-t border-slate-200/50 dark:border-slate-700/50 mt-auto">
                    <button 
                      onClick={() => setCurrentTransactionIndex(prev => prev - 1)} 
                      disabled={currentTransactionIndex === 0}
                      className="group flex items-center space-x-3 px-6 py-4 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl border border-slate-200 dark:border-slate-700 transition-all duration-200 shadow-sm hover:shadow-md"
                    >
                      <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                      <span className="font-semibold">Zurück</span>
                    </button>
                    
                    <button 
                      onClick={handleSkipTransaction}
                      className="group flex items-center space-x-3 px-6 py-4 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-2xl transition-all duration-200 shadow-sm hover:shadow-md font-semibold"
                    >
                      <span>Überspringen</span>
                      <SkipForward className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Sidebar - Category and Sharing */}
            <div className="lg:col-span-4 flex flex-col space-y-6 h-full">
              
              {/* Category Div */}
              <div className="bg-transparent rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xl p-6 flex-1">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center">
                    <Tag className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200">Kategorie</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Ausgaben organisieren</p>
                  </div>
                </div>
                
                <AutocompleteCategorySelector
                  key={currentTx.id} 
                  categories={categories || []}
                  suggestions={getMLSuggestions(currentTx).map(s => s.name)}
                  defaultValue={selectedCategory || currentTx.category || ''}
                  onSelect={(categoryName) => {
                    setSelectedCategory(categoryName);
                    handleCategorizeTransaction(currentTx, categoryName);
                  }}
                  onCreateCategory={(categoryName) => {
                    setSelectedCategory(categoryName);
                    handleCategorizeTransaction(currentTx, categoryName);
                  }} 
                />
                
                {getMLSuggestions(currentTx).length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs text-slate-400 dark:text-slate-500 mb-2 font-medium">KI-Vorschläge</p>
                    <div className="flex flex-wrap gap-2">
                      {getMLSuggestions(currentTx).map((suggestion, idx) => {
                        const IconComponent = suggestion.icon;
                        return (
                          <button 
                            key={idx}
                            onClick={() => setSelectedCategory(suggestion.name)}
                            className="group flex items-center space-x-2 px-3 py-2 bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 rounded-xl transition-all duration-200 border border-slate-200/50 dark:border-slate-600/50 hover:border-slate-300 dark:hover:border-slate-500"
                          >
                            <IconComponent className="w-3.5 h-3.5" />
                            <span className="text-sm font-medium">{suggestion.name}</span>
                            <span className="text-xs px-2 py-0.5 bg-slate-200 dark:bg-slate-600 rounded-full font-bold">
                              {Math.round(suggestion.confidence * 100)}%
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                
              </div>

              {/* Teilen Div - Only for negative amounts */}
              {currentTx.amount < 0 && (
                <div className="bg-transparent rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xl p-6 flex-1 overflow-y-auto">
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center">
                      <Users className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200">Teilen</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Mit anderen aufteilen</p>
                    </div>
                  </div>
                  
                  <div className="relative mb-6">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input 
                      type="text" 
                      value={personSearch} 
                      onChange={(e) => setPersonSearch(e.target.value)}
                      onFocus={() => setShowPersonSuggestions(true)} 
                      onBlur={() => setTimeout(() => setShowPersonSuggestions(false), 150)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddPerson(personSearch)}
                      placeholder="Person hinzufügen..."
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 transition-all duration-200 placeholder-slate-500 dark:placeholder-slate-400 shadow-sm" 
                    />
                    
                    {showPersonSuggestions && (personSuggestions.length > 0 || personSearch) && (
                      <div className="absolute z-30 w-full mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
                        {personSuggestions.map(person => (
                          <div key={person.name} onClick={() => handleAddPerson(person.name)} className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer flex items-center space-x-3 transition-colors">
                            <div className="w-3 h-3 rounded-full shadow-sm" style={{backgroundColor: person.color}} />
                            <span className="font-medium text-slate-800 dark:text-slate-200">{person.name}</span>
                          </div>
                        ))}
                        {personSearch && !allContacts.some(c => c.name.toLowerCase() === personSearch.toLowerCase()) && (
                          <div onClick={() => handleAddPerson(personSearch)} className="px-4 py-3 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 cursor-pointer flex items-center space-x-3 text-emerald-600 dark:text-emerald-400 border-t border-slate-200 dark:border-slate-700 font-medium transition-colors">
                            <Plus className="w-4 h-4" />
                            <span>"{personSearch}" hinzufügen</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {frequentContacts.length > 0 && (
                    <div className="mb-6">
                      <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-3">Häufige Kontakte</p>
                      <div className="flex flex-wrap gap-2">
                        {frequentContacts.map((person) => {
                          const isSelected = sharedExpenseData?.sharedWith?.some(s => s.name === person.name);
                          if (isSelected) return null;
                          return (
                            <button 
                              key={person.name} 
                              onClick={() => toggleContactInShare(person)} 
                              className="flex items-center space-x-2 px-3 py-2 bg-slate-50 dark:bg-slate-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-slate-700 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 rounded-xl transition-all duration-200 border border-slate-200 dark:border-slate-600 hover:border-emerald-300 dark:hover:border-emerald-700 shadow-sm font-medium"
                            >
                              <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{backgroundColor: person.color}} />
                              <span>{person.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {sharedExpenseData && sharedExpenseData.sharedWith.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Teilende Personen</p>
                      
                      {sharedExpenseData.sharedWith.map(person => (
                        <div key={person.name} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-2xl border border-slate-200 dark:border-slate-600">
                          <div className="flex items-center space-x-3">
                            <div className="w-3 h-3 rounded-full shadow-sm" style={{backgroundColor: person.color}} />
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{person.name}</span>
                          </div>
                          <div className="flex items-center space-x-3">
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {formatCurrency(person.amount)}
                            </span>
                            <button 
                              onClick={() => toggleContactInShare(person)} 
                              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                      
                      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-2xl border-2 border-purple-200 dark:border-purple-700">
                        <div className="flex items-center space-x-3">
                          <User className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                          <span className="font-bold text-purple-800 dark:text-purple-300">Dein Anteil</span>
                        </div>
                        <span className="font-bold text-purple-800 dark:text-purple-300 text-lg">
                          {formatCurrency(Math.abs(currentTx.amount) - (sharedExpenseData.sharedWith.reduce((acc, p) => acc + p.amount, 0)))}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal - Unified Design */}
      {showClearConfirmation && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-lg flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md border border-slate-200/50 dark:border-slate-700/50">
            <div className="p-8">
              <div className="flex items-center space-x-4 mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg">
                  <AlertCircle className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">Alle löschen?</h3>
                  <p className="text-slate-500 dark:text-slate-400">Unwiderrufliche Aktion</p>
                </div>
              </div>
              
              <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-2xl mb-6 border border-red-200 dark:border-red-800">
                <p className="text-slate-700 dark:text-slate-300 font-medium">
                  Alle <span className="font-bold text-red-600 dark:text-red-400">{inboxTransactions.length} Transaktionen</span> werden permanent gelöscht.
                </p>
              </div>
              
              <div className="flex space-x-4">
                <button
                  onClick={() => setShowClearConfirmation(false)}
                  className="flex-1 py-4 px-6 text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-2xl transition-all duration-200 font-semibold shadow-sm hover:shadow-md"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleClearInbox}
                  disabled={isClearing}
                  className="flex-1 py-4 px-6 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 disabled:from-red-400 disabled:to-pink-400 text-white rounded-2xl transition-all duration-200 flex items-center justify-center space-x-3 font-bold shadow-lg hover:shadow-2xl"
                >
                  {isClearing ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Lösche...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-5 h-5" />
                      <span>Löschen</span>
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