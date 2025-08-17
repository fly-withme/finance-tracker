import React, { useState, useRef, useEffect } from 'react';
import { Plus, ChevronDown } from 'lucide-react';
import { useOutsideClick } from './hooks/useOutsideClick';

const AutocompleteCategorySelector = ({ 
  categories, 
  selected, 
  onSelect, 
  onCreateCategory,
  suggestions = [],
  hasPrediction = false,
  defaultValue = ''
}) => {
  const [isOpen, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(selected || defaultValue || '');
  const [filteredCategories, setFilteredCategories] = useState(categories);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  
  useOutsideClick(dropdownRef, () => setOpen(false));
  
  useEffect(() => {
    setInputValue(selected || defaultValue || '');
  }, [selected, defaultValue]);

  useEffect(() => {
    if (!inputValue.trim()) {
      setFilteredCategories(categories);
      return;
    }
    
    const filtered = categories.filter(cat =>
      cat.name.toLowerCase().startsWith(inputValue.toLowerCase())
    );
    
    setFilteredCategories(filtered);
  }, [inputValue, categories]);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputValue(value);
    setOpen(true);
  };

  const handleSelectCategory = (categoryName) => {
    setInputValue(categoryName);
    onSelect(categoryName);
    setOpen(false);
  };

  const handleCreateNew = () => {
    if (inputValue.trim() && !categories.find(c => c.name.toLowerCase() === inputValue.toLowerCase())) {
      onCreateCategory(inputValue.trim());
      setOpen(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCategories.length > 0) {
        handleSelectCategory(filteredCategories[0].name);
      } else if (inputValue.trim()) {
        handleCreateNew();
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  const showCreateOption = inputValue.trim() && 
    !categories.find(c => c.name.toLowerCase() === inputValue.toLowerCase());

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => {
            setOpen(true);
            inputRef.current?.select(); // Select text on focus
          }}
          onKeyDown={handleKeyDown}
          placeholder="Kategorie suchen oder erstellen..."
          className={`
            w-full px-4 py-3 text-base border rounded-lg
            text-slate-800 dark:text-slate-200
            placeholder-slate-400 dark:placeholder-slate-500
            focus:outline-none focus:ring-2 focus:ring-purple-500
            transition-colors duration-200
            ${hasPrediction 
              ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-400 dark:border-blue-700' 
              : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600'
            }
          `}
        />
        <button
          type="button"
          onClick={() => setOpen(!isOpen)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
        >
          <ChevronDown className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-60 overflow-y-auto">
          {/* AI Suggestions */}
          {suggestions.length > 0 && inputValue.length === 0 && (
             <div className="p-2 border-b border-slate-200 dark:border-slate-700">
              <div className="text-xs text-blue-600 dark:text-blue-400 mb-1 px-2">Vorschläge</div>
              {suggestions.slice(0, 3).map(suggestion => (
                <button
                  key={suggestion}
                  onClick={() => handleSelectCategory(suggestion)}
                  className="w-full text-left px-3 py-2 text-sm rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-800 dark:text-blue-300 flex items-center space-x-3"
                >
                  <div 
                    className="w-2.5 h-2.5 rounded-full" 
                    style={{ backgroundColor: categories.find(c => c.name === suggestion)?.color || '#3B82F6' }}
                  />
                  <span>{suggestion}</span>
                </button>
              ))}
            </div>
          )}
          
          {/* Filtered categories */}
          {filteredCategories.length > 0 && (
            <div className="py-1">
              {filteredCategories.map(category => (
                <button
                  key={category.id}
                  onClick={() => handleSelectCategory(category.name)}
                  className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: category.color }} />
                    <span>{category.name}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Create new category option */}
          {showCreateOption && (
            <div className="border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={handleCreateNew}
                className="w-full text-left px-3 py-2 text-sm text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/50 flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Erstelle Kategorie "{inputValue}"</span>
              </button>
            </div>
          )}

          {/* No results */}
          {filteredCategories.length === 0 && !showCreateOption && inputValue.trim() && (
            <div className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">
              Keine Kategorien gefunden
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AutocompleteCategorySelector;
