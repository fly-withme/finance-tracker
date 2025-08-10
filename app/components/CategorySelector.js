import React, { useState, useRef } from 'react';
import { Check, AlertTriangle, ChevronsUpDown } from 'lucide-react';
import { useOutsideClick } from './hooks/useOutsideClick';

const CategorySelector = ({ categories, selected, onSelect, hasPrediction }) => {
  const [isOpen, setOpen] = useState(false);
  const ref = useRef();
  useOutsideClick(ref, () => setOpen(false));
  
  const selectedCategory = categories.find(c => c.name === selected);

  return (
    <div className="relative" ref={ref}>
      <button 
        onClick={() => setOpen(v => !v)} 
        className={`w-full p-2 rounded-lg flex items-center justify-between border ${
          selectedCategory ? 'bg-gray-800 border-gray-600' : 'bg-yellow-900/50 border-yellow-500/50'
        }`}
      >
        {selectedCategory ? (
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 rounded-full" style={{backgroundColor: selectedCategory.color}}></div>
            <span className="font-medium text-white">{selectedCategory.name}</span>
            {hasPrediction && <Check className="w-4 h-4 text-green-500" title="AI Prediction"/>}
          </div>
        ) : (
          <div className="flex items-center space-x-2 text-white">
            <AlertTriangle className="w-4 h-4 text-yellow-400" />
            <span>Needs Review</span>
          </div>
        )}
        <ChevronsUpDown className="w-4 h-4 text-gray-500" />
      </button>
      {isOpen && (
        <div className="absolute z-10 top-full mt-2 w-full bg-gray-800 border border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {categories.filter(c => c.name !== 'Income').map(cat => (
            <a 
              href="#" 
              key={cat.id} 
              onClick={(e) => { e.preventDefault(); onSelect(cat.name); setOpen(false); }} 
              className="flex items-center space-x-3 p-3 hover:bg-gray-700"
            >
              <div className="w-4 h-4 rounded-full" style={{backgroundColor: cat.color}}></div>
              <span>{cat.name}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
};

export default CategorySelector;