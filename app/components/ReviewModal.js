import React, { useState, useEffect } from 'react';
import { Cpu } from 'lucide-react';
import Modal from './ui/Modal';
import CategorySelector from './CategorySelector';

const ReviewModal = ({ isOpen, onClose, transactionsToReview, setTransactions, categories, mlModel, updateMlModel }) => {
  const [reviewData, setReviewData] = useState([]);

  useEffect(() => { 
    if (isOpen) { 
      const dataWithPredictions = transactionsToReview.map(t => { 
        let predictedCategory = null; 
        const descriptionWords = t.description.toLowerCase().split(' '); 
        for (const keyword in mlModel) { 
          if (descriptionWords.some(word => word.includes(keyword))) { 
            predictedCategory = mlModel[keyword]; 
            break; 
          } 
        } 
        return { ...t, category: predictedCategory }; 
      }); 
      setReviewData(dataWithPredictions); 
    } 
  }, [isOpen, transactionsToReview, mlModel]);

  const handleCategoryChange = (id, newCategory) => 
    setReviewData(prev => prev.map(t => t.id === id ? {...t, category: newCategory} : t));

  const handleConfirm = () => { 
    const learnedTransactions = []; 
    reviewData.forEach(t => { 
      if (t.category) { 
        const originalPrediction = mlModel[t.description.toLowerCase().split(' ').find(w => mlModel[w])]; 
        if (t.category !== originalPrediction) { 
          const keyword = t.description.toLowerCase().split(' ')[0]; 
          updateMlModel(keyword, t.category); 
        } 
        learnedTransactions.push({ ...t, category: t.category }); 
      } 
    }); 
    setTransactions(prev => [...learnedTransactions, ...prev].sort((a,b) => new Date(b.date) - new Date(a.date))); 
    onClose(); 
  };

  const allReviewed = reviewData.every(t => t.category);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Review New Transactions">
      <div className="space-y-4 max-h-[60vh] overflow-y-auto p-1">
        <div className="flex items-start p-4 rounded-lg bg-blue-900/20 border border-blue-500/30">
          <Cpu className="w-8 h-8 text-blue-400 mr-4 mt-1 flex-shrink-0" />
          <div>
            <h4 className="font-bold text-blue-300">AI Assistant</h4>
            <p className="text-sm text-blue-300/80">
              I've analyzed your statement. Please review my predictions. Your corrections help me get smarter!
            </p>
          </div>
        </div>
        {reviewData.map(tx => (
          <div key={tx.id} className="grid grid-cols-3 gap-4 items-center">
            <div className="col-span-1">
              <p className="font-medium text-white truncate">{tx.description}</p>
              <p className="text-sm text-gray-300">{tx.date}</p>
            </div>
            <p className="font-semibold text-right col-span-1">
              {tx.amount.toLocaleString('en-US', { style: 'currency', currency: 'EUR' })}
            </p>
            <CategorySelector 
              categories={categories} 
              selected={tx.category} 
              onSelect={(cat) => handleCategoryChange(tx.id, cat)} 
              hasPrediction={!!tx.category}
            />
          </div>
        ))}
      </div>
      <div className="pt-6 flex justify-end">
        <button 
          onClick={handleConfirm} 
          disabled={!allReviewed} 
          className="w-full px-6 py-3 rounded-lg bg-indigo-600 font-semibold transition-all disabled:bg-gray-600 disabled:cursor-not-allowed hover:bg-indigo-500"
        >
          {allReviewed ? 'Confirm & Add Transactions' : 'Please review all items'}
        </button>
      </div>
    </Modal>
  );
};

export default ReviewModal;