import React, { useState } from 'react';

const TransactionForm = ({ transaction, onSave, onCancel, categories, accounts }) => {
  const [formData, setFormData] = useState({
    description: transaction?.description || '',
    amount: transaction ? Math.abs(transaction.amount) : '',
    date: transaction?.date || new Date().toISOString().slice(0, 10),
    category: transaction?.category || categories.find(c => c.name !== 'Income')?.name || '',
    account: transaction?.account || accounts[0].name,
    type: transaction ? (transaction.amount > 0 ? 'income' : 'expense') : 'expense'
  });

  const handleChange = (e) => { 
    const { name, value } = e.target; 
    setFormData(prev => ({ ...prev, [name]: value })); 
  };

  const handleSubmit = (e) => { 
    e.preventDefault(); 
    const finalAmount = formData.type === 'expense' ? -Math.abs(parseFloat(formData.amount)) : Math.abs(parseFloat(formData.amount)); 
    const finalCategory = formData.type === 'income' ? 'Income' : formData.category; 
    onSave({ ...formData, amount: finalAmount, category: finalCategory }); 
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <button 
          type="button" 
          onClick={() => handleChange({target: {name: 'type', value: 'expense'}})} 
          className={`p-3 rounded-lg font-semibold transition-colors ${
            formData.type === 'expense' ? 'bg-red-500/20 text-red-400' : 'bg-gray-700 text-gray-400'
          }`}
        >
          Expense
        </button>
        <button 
          type="button" 
          onClick={() => handleChange({target: {name: 'type', value: 'income'}})} 
          className={`p-3 rounded-lg font-semibold transition-colors ${
            formData.type === 'income' ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-400'
          }`}
        >
          Income
        </button>
      </div>
      
      <div>
        <label className="text-sm font-medium text-white">Description</label>
        <input 
          type="text" 
          name="description" 
          value={formData.description} 
          onChange={handleChange} 
          required 
          className="w-full mt-2 p-3 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" 
        />
      </div>
      
      <div>
        <label className="text-sm font-medium text-white">Amount</label>
        <input 
          type="number" 
          step="0.01" 
          name="amount" 
          value={formData.amount} 
          onChange={handleChange} 
          required 
          className="w-full mt-2 p-3 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" 
        />
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-white">Date</label>
          <input 
            type="date" 
            name="date" 
            value={formData.date} 
            onChange={handleChange} 
            required 
            className="w-full mt-2 p-3 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" 
          />
        </div>
        <div>
          <label className="text-sm font-medium text-white">Category</label>
          <select 
            name="category" 
            value={formData.category} 
            onChange={handleChange} 
            disabled={formData.type === 'income'} 
            className="w-full mt-2 p-3 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-700"
          >
            {formData.type === 'income' ? (
              <option>Income</option>
            ) : (
              categories.filter(c => c.name !== 'Income').map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))
            )}
          </select>
        </div>
      </div>
      
      <div>
        <label className="text-sm font-medium text-white">Account</label>
        <select 
          name="account" 
          value={formData.account} 
          onChange={handleChange} 
          className="w-full mt-2 p-3 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {accounts.map(a => (
            <option key={a.id} value={a.name}>{a.name}</option>
          ))}
        </select>
      </div>
      
      <div className="flex justify-end space-x-4 pt-4">
        <button 
          type="button" 
          onClick={onCancel} 
          className="px-6 py-3 rounded-lg bg-gray-700 hover:bg-gray-600 font-semibold text-white transition-colors"
        >
          Cancel
        </button>
        <button 
          type="submit" 
          className="px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold text-white transition-colors"
        >
          Save Transaction
        </button>
      </div>
    </form>
  );
};

export default TransactionForm;