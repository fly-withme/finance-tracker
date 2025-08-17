import React, { useState, useEffect } from 'react';
import { Tag, Euro, Calendar, Building, FileText, Users, ChevronDown, ChevronUp } from 'lucide-react';
import SharedExpenseSelector from '../SharedExpenseSelector';

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

  const handleSharedExpenseChange = (newSharedExpenseData) => {
    setSharedExpenseData(newSharedExpenseData);
  };

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
    <div className={`transition-all duration-300 ${showSharedExpenses && formData.type === 'expense' ? 'grid grid-cols-2 gap-6' : ''}`}>
      <form onSubmit={handleSubmit} className={`space-y-4 ${showSharedExpenses && formData.type === 'expense' ? '' : 'col-span-full'}`}>
        {/* Type Selection */}
        <div className="grid grid-cols-2 gap-3">
          <button 
            type="button" 
            onClick={() => handleChange({target: {name: 'type', value: 'expense'}})} 
            className={`p-3 rounded-lg font-medium transition-colors ${
              formData.type === 'expense' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            Ausgabe
          </button>
          <button 
            type="button" 
            onClick={() => handleChange({target: {name: 'type', value: 'income'}})} 
            className={`p-3 rounded-lg font-medium transition-colors ${
              formData.type === 'income' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            Einnahme
          </button>
        </div>

        {/* Category - Most Prominent */}
        {formData.type !== 'income' && (
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">
              <div 
                className="w-3 h-3 rounded-lg" 
                style={{ backgroundColor: getCategoryColor(formData.category) }}
              ></div>
              Kategorie
            </label>
            <select 
              name="category" 
              value={formData.category} 
              onChange={handleChange} 
              className="w-full p-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              {categories.filter(c => c.name !== 'Income').map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
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
            className="w-full p-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
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
            className="w-full p-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
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
              className="w-full p-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Konto</label>
            <select 
              name="account" 
              value={formData.account} 
              onChange={handleChange} 
              className="w-full p-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              {accounts.map(a => (
                <option key={a.id} value={a.name}>{a.name}</option>
              ))}
            </select>
          </div>
        </div>
        
        {/* Shared Expenses Toggle - Always visible for expense type */}
        {formData.type === 'expense' && (
          <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={toggleSharedExpenses}
              className="flex items-center justify-between w-full p-3 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors group"
            >
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Ausgabe teilen
                </span>
                {sharedExpenseData?.sharedWith?.length > 0 && (
                  <span className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full text-xs font-medium">
                    {sharedExpenseData.sharedWith.length}
                  </span>
                )}
              </div>
              {showSharedExpenses ? (
                <ChevronUp className="w-4 h-4 text-slate-600 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200 transition-colors" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-600 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200 transition-colors" />
              )}
            </button>
          </div>
        )}
        
        {/* Action Buttons - Full width at bottom */}
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
            className="px-4 py-2 rounded-lg bg-indigo-600 dark:bg-indigo-700 hover:bg-indigo-700 dark:hover:bg-indigo-600 text-white font-medium transition-colors"
          >
            Speichern
          </button>
        </div>
      </form>

      {/* Shared Expenses Panel - Side by side when expanded */}
      {formData.type === 'expense' && showSharedExpenses && (
        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Ausgaben teilen
            </h3>
          </div>
          <SharedExpenseSelector
            transactionAmount={-Math.abs(parseFloat(formData.amount) || 0)}
            onSharedExpenseChange={handleSharedExpenseChange}
            initialSharedWith={sharedExpenseData?.sharedWith || []}
          />
        </div>
      )}
    </div>
  );
};

export default TransactionForm;