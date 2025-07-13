'use client'

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, SkipForward, ChevronDown, Search } from 'lucide-react';
import type { Transaction, ParsedTransaction } from '@/lib/types';

function ReviewCard({ transaction, categories, onConfirm, onSkip }: { 
  transaction: ParsedTransaction, 
  categories: string[], 
  onConfirm: (updatedTransaction: Omit<Transaction, 'id'|'user_id'|'created_at'>) => void,
  onSkip: () => void
}) {
  const [name, setName] = useState(transaction.name);
  const [amount, setAmount] = useState(transaction.amount.toString());
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [newCategory, setNewCategory] = useState("");

  const filteredCategories = useMemo(() => 
    categories.filter(cat => cat.toLowerCase().includes(searchTerm.toLowerCase())),
    [searchTerm, categories]
  );

  const handleSelectCategory = (category: string) => {
    setSelectedCategory(category);
    setIsPickerOpen(false);
    setSearchTerm("");
    setNewCategory("");
  };

  const handleCreateCategory = () => {
    if (newCategory.trim() === "") return;
    handleSelectCategory(newCategory.trim());
  };

  const handleConfirm = () => {
    if (!name || isNaN(parseFloat(amount)) || !selectedCategory) {
      alert("Bitte fülle alle Felder aus und wähle eine Kategorie.");
      return;
    }
    onConfirm({
      name,
      amount: parseFloat(amount),
      category: selectedCategory,
    });
  };

  return (
    <>
      <motion.div
        key={transaction.name}
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        className="bg-surface p-6 rounded-3xl shadow-soft w-full"
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-secondary-text">Beschreibung</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-2 mt-1 bg-base rounded-lg border-transparent focus:border-accent focus:ring-0"/>
          </div>
          <div>
            <label className="text-sm font-medium text-secondary-text">Betrag (€)</label>
            <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className="w-full p-2 mt-1 bg-base rounded-lg border-transparent focus:border-accent focus:ring-0"/>
          </div>
        </div>
        
        <div className="mt-6">
          <label className="text-sm font-medium text-secondary-text">Kategorie</label>
          <button onClick={() => setIsPickerOpen(true)} className="w-full flex justify-between items-center text-left p-2 mt-1 bg-base rounded-lg">
            <span>{selectedCategory || "Kategorie auswählen"}</span>
            <ChevronDown size={20} className="text-secondary-text"/>
          </button>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button onClick={onSkip} className="w-1/3 p-3 bg-base text-secondary-text font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors">
            <SkipForward size={20} />
            Skip
          </button>
          <button onClick={handleConfirm} className="w-2/3 p-3 bg-accent text-white font-semibold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity">
            <Check size={20} />
            Bestätigen
          </button>
        </div>
      </motion.div>

      <AnimatePresence>
        {isPickerOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-20 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm bg-surface rounded-2xl p-4"
            >
              <h3 className="font-semibold mb-3">Kategorie auswählen</h3>
              <div className="relative mb-3">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-text" />
                <input type="text" placeholder="Suchen..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full p-2 pl-9 bg-base rounded-lg border-transparent focus:border-accent focus:ring-0"/>
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1 mb-3">
                {filteredCategories.map(cat => (
                  <button key={cat} onClick={() => handleSelectCategory(cat)} className="w-full text-left p-2 rounded-lg hover:bg-base">{cat}</button>
                ))}
              </div>
              <div className="flex gap-2">
                <input type="text" placeholder="Neue Kategorie erstellen..." value={newCategory} onChange={e => setNewCategory(e.target.value)} className="w-full p-2 bg-base rounded-lg border-transparent focus:border-accent focus:ring-0"/>
                <button onClick={handleCreateCategory} className="p-2 bg-accent text-white rounded-lg font-semibold">OK</button>
              </div>
               <button onClick={() => setIsPickerOpen(false)} className="w-full mt-4 p-2 text-center text-accent font-semibold">Abbrechen</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default function ReviewView({ transactions, categories, onDoneAction }: { 
  transactions: ParsedTransaction[], 
  categories: string[], 
  onDoneAction: (reviewed: Omit<Transaction, 'id'|'user_id'|'created_at'>[]) => void 
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reviewedTransactions, setReviewedTransactions] = useState<Omit<Transaction, 'id'|'user_id'|'created_at'>[]>([]);

  const handleConfirmTransaction = (confirmedTx: Omit<Transaction, 'id'|'user_id'|'created_at'>) => {
    const newReviewed = [...reviewedTransactions, confirmedTx];
    setReviewedTransactions(newReviewed);
    
    if (currentIndex + 1 < transactions.length) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onDoneAction(newReviewed);
    }
  };
  
  const handleSkipTransaction = () => {
    if (currentIndex + 1 < transactions.length) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onDoneAction(reviewedTransactions);
    }
  };
  
  const isReviewing = currentIndex < transactions.length;

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-4">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-semibold">Kurzer Check</h2>
        {isReviewing && <p className="text-secondary-text mt-1">{`Überprüfe Transaktion ${currentIndex + 1} von ${transactions.length}`}</p>}
      </div>
      <div className="w-full max-w-sm">
        <AnimatePresence mode="wait">
          {isReviewing && (
            <ReviewCard 
              key={transactions[currentIndex].name}
              transaction={transactions[currentIndex]} 
              categories={categories}
              onConfirm={handleConfirmTransaction}
              onSkip={handleSkipTransaction}
            />
          )}
        </AnimatePresence>
      </div>
       {!isReviewing && (
         <motion.div initial={{opacity: 0}} animate={{opacity: 1}} className="text-center">
            <h3 className="text-xl font-semibold">Super!</h3>
            <p className="text-secondary-text mt-1">Alle Transaktionen wurden bearbeitet.</p>
         </motion.div>
       )}
    </div>
  );
}