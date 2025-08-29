import React, { useState, useEffect, useCallback } from 'react';
import { Tag, Euro, Calendar, Building, FileText, Users, ChevronDown, ChevronUp } from 'lucide-react';
import SharedExpenseSelector from '../SharedExpenseSelector';
import AutocompleteCategorySelector from '../AutocompleteCategorySelector';
import { db } from '../../utils/db';

const TransactionForm = ({ transaction, onSave, onCancel, categories, accounts }) => {
  const [formData, setFormData] = useState({
    description: transaction?.description || '',
    amount: transaction ? Math.abs(transaction.amount) : '',
    date: transaction?.date || new Date().toISOString().slice(0, 10),
    category: transaction?.category || categories.find(c => c.name !== 'Income')?.name || '',
    account: transaction?.account || accounts[0]?.name || '',
    type: transaction ? (transaction.amount > 0 ? 'income' : 'expense') : 'expense'
  });
  
  const [sharedExpenseData, setSharedExpenseData] = useState(
    transaction?.sharedWith ? {
      sharedWith: transaction.sharedWith,
      splitType: transaction.splitType,
      splitDetails: transaction.splitDetails
    } : null
  );

  const [showSharedExpenses, setShowSharedExpenses] = useState(
    !!(transaction?.sharedWith && transaction.sharedWith.length > 0) || transaction?._openSharing
  );

  const getCategoryColor = (categoryName) => categories.find(c => c.name === categoryName)?.color || '#4F46E5';

  const handleChange = (e) => { 
    const { name, value } = e.target; 
    setFormData(prev => ({ ...prev, [name]: value })); 
  };

  const handleCategorySelect = (categoryName) => {
    setFormData(prev => ({ ...prev, category: categoryName }));
  };

  const handleCreateCategory = async (categoryName) => {
    try {
      const colors = ['#3B82F6', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#EF4444'];
      const newCategory = {
        name: categoryName,
        color: colors[Math.floor(Math.random() * colors.length)]
      };
      
      await db.categories.add(newCategory);
      setFormData(prev => ({ ...prev, category: categoryName }));
      
      // Note: The parent component should refresh categories after this
      return newCategory;
    } catch (error) {
      console.error('Error creating category:', error);
      throw error;
    }
  };

  const handleSharedExpenseChange = useCallback((newSharedExpenseData) => {
    setSharedExpenseData(newSharedExpenseData);
  }, []);

  const toggleSharedExpenses = () => {
    setShowSharedExpenses(!showSharedExpenses);
    if (showSharedExpenses) {
      // When hiding, clear the shared expense data
      setSharedExpenseData(null);
    }
  };

  const handleSubmit = (e) => { 
    e.preventDefault(); 
    const finalAmount = formData.type === 'expense' ? -Math.abs(parseFloat(formData.amount)) : Math.abs(parseFloat(formData.amount)); 
    const finalCategory = formData.type === 'income' ? 'Income' : formData.category; 
    
    const transactionData = { 
      ...formData, 
      amount: finalAmount, 
      category: finalCategory,
      ...(sharedExpenseData && {
        sharedWith: sharedExpenseData.sharedWith,
        splitType: sharedExpenseData.splitType,
        splitDetails: sharedExpenseData.splitDetails
      })
    };
    
    onSave(transactionData); 
  };

  return (
    <div className={`h-full flex flex-col ${showSharedExpenses && formData.type === 'expense' ? 'grid grid-cols-2 gap-6' : ''}`}>
      <form onSubmit={handleSubmit} className={`space-y-4 flex-1 ${showSharedExpenses && formData.type === 'expense' ? '' : 'col-span-full'}`}>
        {/* Type Selection */}
        <div className="grid grid-cols-2 gap-3">
          <button 
            type="button" 
            onClick={() => handleChange({target: {name: 'type', value: 'expense'}})} 
            className={`p-3 rounded-lg font-medium transition-colors ${
              formData.type === 'expense' 
                ? 'bg-red-500 text-white' 
                : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            Ausgabe
          </button>
          <button 
            type="button" 
            onClick={() => handleChange({target: {name: 'type', value: 'income'}})} 
            className={`p-3 rounded-lg font-medium transition-colors ${
              formData.type === 'income' 
                ? 'bg-green-500 text-white' 
                : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            Einnahme
          </button>
        </div>

        {/* Category */}
        {formData.type !== 'income' && (
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Kategorie</label>
            <AutocompleteCategorySelector
              categories={categories.filter(c => c.name !== 'Income')}
              selected={formData.category}
              onSelect={handleCategorySelect}
              onCreateCategory={handleCreateCategory}
              defaultValue={formData.category}
            />
          </div>
        )}
        
        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Betrag</label>
          <input 
            type="number" 
            step="0.01" 
            name="amount" 
            value={formData.amount} 
            onChange={handleChange} 
            required 
            className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
          />
        </div>
        
        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Beschreibung</label>
          <input 
            type="text" 
            name="description" 
            value={formData.description} 
            onChange={handleChange}
            className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
          />
        </div>
        
        {/* Date and Account */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Datum</label>
            <input 
              type="date" 
              name="date" 
              value={formData.date} 
              onChange={handleChange} 
              required 
              className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Konto</label>
            <select 
              name="account" 
              value={formData.account} 
              onChange={handleChange} 
              className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              {accounts.map(a => (
                <option key={a.id} value={a.name}>{a.name}</option>
              ))}
            </select>
          </div>
        </div>
        
        {/* Shared Expenses Toggle */}
        {formData.type === 'expense' && (
          <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={toggleSharedExpenses}
              className={`group flex items-center justify-between w-full p-4 rounded-lg border-2 transition-all duration-200 ease-in-out ${
                showSharedExpenses
                  ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-700 shadow-sm'
                  : 'bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg transition-colors duration-200 ${
                  showSharedExpenses
                    ? 'bg-indigo-100 dark:bg-indigo-800'
                    : 'bg-slate-200 dark:bg-slate-600 group-hover:bg-slate-300 dark:group-hover:bg-slate-500'
                }`}>
                  <Users className={`w-4 h-4 transition-colors duration-200 ${
                    showSharedExpenses
                      ? 'text-indigo-600 dark:text-indigo-400'
                      : 'text-slate-600 dark:text-slate-400'
                  }`} />
                </div>
                <div className="flex flex-col items-start">
                  <span className={`text-sm font-semibold transition-colors duration-200 ${
                    showSharedExpenses
                      ? 'text-indigo-700 dark:text-indigo-300'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}>
                    Ausgabe teilen
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {showSharedExpenses
                      ? sharedExpenseData?.sharedWith?.length > 0
                        ? `Mit ${sharedExpenseData.sharedWith.length} Person${sharedExpenseData.sharedWith.length !== 1 ? 'en' : ''} geteilt`
                        : 'Wähle Personen zum Teilen aus'
                      : 'Klicke um Ausgaben mit anderen zu teilen'
                    }
                  </span>
                </div>
                {sharedExpenseData?.sharedWith?.length > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="bg-indigo-500 text-white px-2.5 py-1 rounded-full text-xs font-semibold shadow-sm">
                      {sharedExpenseData.sharedWith.length}
                    </span>
                  </div>
                )}
              </div>
              <div className={`transition-transform duration-200 ease-in-out ${
                showSharedExpenses ? 'rotate-180' : 'rotate-0'
              }`}>
                <ChevronDown className={`w-5 h-5 transition-colors duration-200 ${
                  showSharedExpenses
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-slate-600 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-300'
                }`} />
              </div>
            </button>
          </div>
        )}
        
        {/* Action Buttons */}
        <div className={`flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700 ${showSharedExpenses && formData.type === 'expense' ? 'col-span-2' : ''}`}>
          <button 
            type="button" 
            onClick={onCancel} 
            className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-medium transition-colors"
          >
            Abbrechen
          </button>
          <button 
            type="submit" 
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors"
          >
            Speichern
          </button>
        </div>
      </form>

      {/* Shared Expenses Panel */}
      {formData.type === 'expense' && (
        <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
          showSharedExpenses ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}>
          <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/30 dark:to-blue-900/30 rounded-lg p-5 border border-indigo-200 dark:border-indigo-700 shadow-sm">
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-indigo-100 dark:bg-indigo-800 rounded-lg">
                  <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h3 className="text-sm font-semibold text-indigo-800 dark:text-indigo-200">
                  Ausgaben teilen
                </h3>
              </div>
              <p className="text-xs text-indigo-600 dark:text-indigo-300 ml-8">
                Teile diese Ausgabe fair mit anderen Personen auf
              </p>
            </div>
            {showSharedExpenses && (
              <SharedExpenseSelector
                transactionAmount={-Math.abs(parseFloat(formData.amount) || 0)}
                onSharedExpenseChange={handleSharedExpenseChange}
                initialSharedWith={sharedExpenseData?.sharedWith || []}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TransactionForm;