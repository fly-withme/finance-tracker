import React, { useState, useRef } from 'react';
import { Plus, Edit, Trash2, ArrowUp, ArrowDown, MoreVertical } from 'lucide-react';
import Card from './ui/Card';
import PageHeader from './ui/PageHeader';
import Modal from './ui/Modal';
import ConfirmationModal from './ui/ConfirmationModal';
import TransactionForm from './forms/TransactionForm';
import { useOutsideClick } from './hooks/useOutsideClick';

const TransactionsPage = ({ transactions, setTransactions, categories, accounts, currency }) => {
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [isConfirmOpen, setConfirmOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState(null);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const dropdownRef = useRef(null);
  
  useOutsideClick(dropdownRef, () => setActiveDropdown(null));

  const handleSave = (transactionData) => { 
    if (editingTransaction) {
      setTransactions(prev => prev.map(t => 
        t.id === editingTransaction.id ? { ...t, ...transactionData } : t
      )); 
    } else {
      setTransactions(prev => 
        [{ id: Date.now(), ...transactionData }, ...prev]
          .sort((a,b) => new Date(b.date) - new Date(a.date))
      ); 
    }
    setModalOpen(false); 
    setEditingTransaction(null); 
  };

  const handleEdit = (transaction) => { 
    setEditingTransaction(transaction); 
    setModalOpen(true); 
    setActiveDropdown(null); 
  };

  const handleDeleteRequest = (id) => { 
    setTransactionToDelete(id); 
    setConfirmOpen(true); 
    setActiveDropdown(null); 
  };

  const handleDeleteConfirm = () => { 
    setTransactions(prev => prev.filter(t => t.id !== transactionToDelete)); 
    setConfirmOpen(false); 
    setTransactionToDelete(null); 
  };

  const getCategoryColor = (categoryName) => categories.find(c => c.name === categoryName)?.color || '#71717A';
  
  return (
    <div>
      <PageHeader title="Transactions">
        <button 
          onClick={() => { setEditingTransaction(null); setModalOpen(true); }} 
          className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-500 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Add Transaction</span>
        </button>
      </PageHeader>
      
      <Card className="p-2">
        <div className="space-y-1">
          <div className="grid grid-cols-12 gap-4 px-4 py-2 text-sm font-semibold text-gray-400">
            <div className="col-span-4">Description</div>
            <div className="col-span-2">Category</div>
            <div className="col-span-2">Account</div>
            <div className="col-span-2 text-right">Amount</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>
          {transactions.map(tx => (
            <div key={tx.id} className="grid grid-cols-12 gap-4 items-center p-4 hover:bg-gray-800/50 rounded-lg transition-colors">
              <div className="col-span-4 flex items-center space-x-4">
                <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center ${tx.amount > 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                  {tx.amount > 0 ? <ArrowUp className="w-5 h-5 text-green-400" /> : <ArrowDown className="w-5 h-5 text-red-400" />}
                </div>
                <div>
                  <p className="font-medium text-white">{tx.description}</p>
                  <p className="text-sm text-gray-400">{new Date(tx.date).toLocaleDateString('en-US')}</p>
                </div>
              </div>
              <div className="col-span-2">
                <span className="text-sm inline-flex items-center space-x-2 bg-gray-700/50 px-3 py-1 rounded-full">
                  <div className="w-2 h-2 rounded-full" style={{backgroundColor: getCategoryColor(tx.category)}}></div>
                  <span className="text-white">{tx.category}</span>
                </span>
              </div>
              <div className="col-span-2 text-gray-200">{tx.account}</div>
              <div className={`col-span-2 font-semibold text-right ${tx.amount > 0 ? 'text-green-400' : 'text-white'}`}>
                {tx.amount > 0 ? '+' : ''}{Math.abs(tx.amount).toLocaleString('en-US', { style: 'currency', currency: 'EUR' })}
              </div>
              <div className="col-span-2 flex justify-end">
                <div className="relative" ref={activeDropdown === tx.id ? dropdownRef : null}>
                  <button 
                    onClick={() => setActiveDropdown(tx.id === activeDropdown ? null : tx.id)} 
                    className="p-2 text-gray-400 hover:text-white"
                  >
                    <MoreVertical className="w-5 h-5"/>
                  </button>
                  {activeDropdown === tx.id && (
                    <div className="absolute top-full right-0 mt-2 w-32 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-10">
                      <button 
                        onClick={() => handleEdit(tx)} 
                        className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-gray-200 hover:bg-gray-700"
                      > 
                        <Edit className="w-4 h-4"/> Edit
                      </button>
                      <button 
                        onClick={() => handleDeleteRequest(tx.id)} 
                        className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-gray-700"
                      >
                        <Trash2 className="w-4 h-4"/> Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
      
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setModalOpen(false)} 
        title={editingTransaction ? "Edit Transaction" : "New Transaction"}
      >
        <TransactionForm 
          transaction={editingTransaction} 
          onSave={handleSave} 
          onCancel={() => setModalOpen(false)} 
          categories={categories} 
          accounts={accounts} 
        />
      </Modal>
      
      <ConfirmationModal 
        isOpen={isConfirmOpen} 
        onClose={() => setConfirmOpen(false)} 
        onConfirm={handleDeleteConfirm} 
        title="Delete Transaction" 
        message="Are you sure you want to delete this transaction? This action cannot be undone." 
      />
    </div>
  );
};

export default TransactionsPage;