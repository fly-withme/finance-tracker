import React, { useState, useRef, useEffect } from 'react';
import { Plus, ChevronDown } from 'lucide-react';
import { useOutsideClick } from './hooks/useOutsideClick';
import { jonyColors } from '../theme';

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
            w-full p-2.5 text-base border border-slate-300 rounded-xl
            placeholder-slate-400 dark:placeholder-slate-500
            focus:outline-none
            transition-colors duration-200
            ${hasPrediction 
              ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-400 dark:border-blue-700' 
              : ''
            }
          `}
          style={{
            backgroundColor: hasPrediction ? undefined : jonyColors.cardBackground,
            borderColor: hasPrediction ? undefined : '#cbd5e1',
            color: jonyColors.textPrimary
          }}
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
        <div className="absolute z-50 mt-1 w-full rounded-xl shadow-xl max-h-60 overflow-y-auto" style={{ backgroundColor: '#111113', border: '1px solid #333333' }}>
          {/* AI Suggestions */}
          {suggestions.length > 0 && inputValue.length === 0 && (
             <div className="p-2 border-b" style={{ borderColor: '#333333' }}>
              <div className="text-xs mb-1 px-2" style={{ color: jonyColors.accent1 }}>Vorschläge</div>
              {suggestions.slice(0, 3).map(suggestion => (
                <button
                  key={suggestion}
                  onClick={() => handleSelectCategory(suggestion)}
                  className="w-full text-left px-3 py-2 text-sm rounded flex items-center space-x-3"
                  style={{ 
                    color: jonyColors.accent1,
                    ':hover': { backgroundColor: `${jonyColors.accent1}20` }
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = `${jonyColors.accent1}20`;
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = 'transparent';
                  }}
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
                  className="w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:opacity-80 transition-opacity"
                  style={{ color: '#ffffff' }}
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
            <div className="border-t" style={{ borderColor: '#333333' }}>
              <button
                onClick={handleCreateNew}
                className="w-full text-left px-3 py-2 text-sm flex items-center space-x-2 hover:opacity-80 transition-opacity"
                style={{ color: jonyColors.accent1 }}
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
