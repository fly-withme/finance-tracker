import React, { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCircle, Save } from 'lucide-react';
import Modal from './ui/Modal';
import CategorySelector from './CategorySelector';
import SharedExpenseSelector from './SharedExpenseSelector';

// Kleine Helferkomponente für den Fortschrittsbalken
const ProgressBar = ({ value, max }) => {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  return (
    // Dark-Klasse entfernt
    <div className="w-full bg-slate-200 rounded-full h-2.5">
      <div
        className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
        style={{ width: `${percentage}%` }}
      ></div>
    </div>
  );
};

const ReviewModal = ({ 
  isOpen, 
  transactions: initialTransactions, 
  categories, 
  classifier, 
  onClose, 
  onSaveAll,
  onAddCategory
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reviewedTransactions, setReviewedTransactions] = useState([]);
  // NEU: State für das client-seitig formatierte Datum
  const [formattedDate, setFormattedDate] = useState('');

  const reviewedCount = reviewedTransactions.filter(tx => !tx.needsReview).length;
  const totalCount = reviewedTransactions.length;
  const allReviewed = reviewedCount === totalCount;

  useEffect(() => {
    if (isOpen && initialTransactions.length > 0) {
      setReviewedTransactions([...initialTransactions]);
      setCurrentIndex(0);
    }
  }, [isOpen, initialTransactions]);

  const currentTransaction = reviewedTransactions[currentIndex];

  // NEU: useEffect, um das Datum sicher auf dem Client zu formatieren
  useEffect(() => {
    if (currentTransaction?.date) {
      const date = new Date(currentTransaction.date);
      setFormattedDate(date.toLocaleDateString('de-DE', {day: '2-digit', month: '2-digit', year: 'numeric'}));
    }
  }, [currentTransaction?.date]);


  if (!isOpen || totalCount === 0) {
    return null;
  }

  const handleCategorySelect = (newCategory) => {
    const updatedTransactions = reviewedTransactions.map((tx, index) =>
      index === currentIndex ? { ...tx, category: newCategory, needsReview: false } : tx
    );
    setReviewedTransactions(updatedTransactions);

    if (currentIndex < totalCount - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleSharedExpenseChange = (sharedExpenseData) => {
    const updatedTransactions = reviewedTransactions.map((tx, index) => {
      if (index === currentIndex) {
        if (sharedExpenseData) {
          return {
            ...tx,
            sharedWith: sharedExpenseData.sharedWith,
            splitType: sharedExpenseData.splitType,
            splitDetails: sharedExpenseData.splitDetails
          };
        } else {
          // Remove shared expense data
          const { sharedWith, splitType, splitDetails, ...txWithoutShared } = tx;
          return txWithoutShared;
        }
      }
      return tx;
    });
    setReviewedTransactions(updatedTransactions);
  };

  const handleCreateAndSelectCategory = (newCategoryName) => {
    if (onAddCategory) {
      onAddCategory(newCategoryName);
    }
    const updatedTransactions = reviewedTransactions.map((tx, index) =>
      index === currentIndex ? { ...tx, category: newCategoryName, needsReview: false } : tx
    );
    setReviewedTransactions(updatedTransactions);

    if (currentIndex < totalCount - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < totalCount - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };
  
  const handleSaveAndClose = () => {
    if (onSaveAll) {
      onSaveAll(reviewedTransactions);
    }
    onClose();
  };

  const CompletionView = () => (
    <div className="flex flex-col items-center justify-center text-center" style={{ minHeight: '400px' }}>
      <div className="p-4 bg-green-100 rounded-full">
        <CheckCircle className="w-12 h-12 text-green-600" />
      </div>
      <h3 className="mt-6 text-2xl font-semibold text-slate-800">Alles erledigt!</h3>
      <p className="mt-2 text-slate-500">
        Du hast alle {totalCount} Transaktionen erfolgreich überprüft.
      </p>
    </div>
  );

  const ReviewView = () => (
    <div className="flex flex-col" style={{ minHeight: '400px' }}>
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-slate-600">
            Fortschritt ({reviewedCount} / {totalCount})
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrevious}
              disabled={currentIndex === 0}
              className="p-1.5 rounded-full hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <button
              onClick={handleNext}
              disabled={currentIndex === totalCount - 1}
              className="p-1.5 rounded-full hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ArrowRight className="w-5 h-5 text-slate-600" />
            </button>
          </div>
        </div>
        <ProgressBar value={reviewedCount} max={totalCount} />
      </div>

      <div className="flex-grow flex flex-col items-center justify-center bg-white p-6 rounded-xl ring-1 ring-slate-200 shadow-sm text-center my-4">
        <div className="flex items-center gap-2">
            {/* GEÄNDERT: Verwenden Sie den State für das formatierte Datum */}
            <p className="text-sm text-slate-500">
              {formattedDate}
            </p>
            {!currentTransaction.needsReview && (
                 <span className="flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                    <Check className="w-3 h-3" />
                    Überprüft
                 </span>
            )}
        </div>
        
        <div className="my-2">
            <p className="text-xs text-slate-400 uppercase tracking-wider">Empfänger</p>
            <p className="text-xl font-semibold text-slate-800 break-all">{currentTransaction.recipient || 'N/A'}</p>
        </div>
         <div className="mb-2 w-full">
            <p className="text-xs text-slate-400 uppercase tracking-wider">Beschreibung</p>
            <p className="text-slate-600 break-words">{currentTransaction.description || 'Keine Beschreibung'}</p>
        </div>

        <p className={`text-3xl font-bold ${currentTransaction.amount > 0 ? 'text-green-600' : 'text-slate-800'}`}>
          {currentTransaction.amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
        </p>
      </div>

      <div className="mt-4 space-y-4">
        <CategorySelector
          categories={categories}
          selected={currentTransaction.category}
          suggestions={classifier.getCategorySuggestions(currentTransaction.description, categories).slice(0, 1)}
          onSelect={handleCategorySelect}
          onCategoryCreate={handleCreateAndSelectCategory}
        />
        
        {currentTransaction.amount < 0 && (
          <SharedExpenseSelector
            transactionAmount={currentTransaction.amount}
            onSharedExpenseChange={handleSharedExpenseChange}
            initialSharedWith={currentTransaction.sharedWith || []}
          />
        )}
      </div>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Überprüfe ${totalCount} Transaktionen`}>
      {allReviewed ? <CompletionView /> : <ReviewView />}
      
      <div className="flex justify-end mt-6 pt-5 border-t border-slate-200">
        <button
          onClick={handleSaveAndClose}
          className={`flex items-center justify-center gap-2.5 px-6 py-3 font-semibold text-white rounded-full cursor-pointer hover:brightness-110 transition-all duration-300 ease-in-out disabled:opacity-60 disabled:cursor-not-allowed ${
            allReviewed
              ? 'bg-gradient-to-r from-green-500 to-teal-500'
              : 'bg-gradient-to-r from-indigo-600 to-purple-600'
          }`}
        >
          {allReviewed ? <CheckCircle className="w-5 h-5" /> : <Save className="w-5 h-5" />}
          {allReviewed ? `Abschließen` : `Alle ${totalCount} speichern & schließen`}
        </button>
      </div>
    </Modal>
  );
};

export default ReviewModal;
