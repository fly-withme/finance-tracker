import React, { useState, useRef, useEffect } from 'react';
import { Check, Plus, Lightbulb } from 'lucide-react';
import { useOutsideClick } from './hooks/useOutsideClick';
import { jonyColors } from '../theme';

const CategorySelector = ({ categories, selected, onSelect, onCategoryCreate, suggestions = [] }) => {
  const [inputValue, setInputValue] = useState('');
  const [isDropdownOpen, setDropdownOpen] = useState(false);
  const ref = useRef();
  
  // Setzt den Input-Wert auf die ausgewählte Kategorie, wenn sie sich ändert
  useEffect(() => {
    setInputValue(selected || '');
  }, [selected]);

  // Schließt das Dropdown, wenn außerhalb geklickt wird
  useOutsideClick(ref, () => setDropdownOpen(false));

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
    setDropdownOpen(true);
  };

  const handleSelect = (categoryName) => {
    setInputValue(categoryName);
    onSelect(categoryName);
    setDropdownOpen(false);
  };

  // Filtert die Kategorien basierend auf der Eingabe
  const filteredCategories = (categories || []).filter(cat =>
    cat?.name?.toLowerCase().includes(inputValue.toLowerCase())
  );
  
  // Kombiniert KI-Vorschläge und gefilterte Kategorien
  const combinedSuggestions = [
    ...(suggestions || []).map(s => ({ ...s.category, isSuggestion: true, confidence: s.confidence })),
    ...filteredCategories
  ];
  
  // Entfernt Duplikate
  const uniqueSuggestions = Array.from(new Map(combinedSuggestions.map(item => [item?.name, item]).filter(([name]) => name)).values());

  return (
    <div className="relative" ref={ref}>
      <input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => setDropdownOpen(true)}
        placeholder="Kategorie suchen oder erstellen..."
        className="w-full p-2.5 pr-10 rounded-xl border border-slate-300 focus:ring-2 transition-colors"
        style={{
          '--tw-ring-color': jonyColors.accent1,
          ':focus': {
            borderColor: jonyColors.accent1,
            ringColor: jonyColors.accent1
          }
        }}
        onFocus={(e) => {
          setDropdownOpen(true);
          e.target.style.borderColor = jonyColors.accent1;
          e.target.style.boxShadow = `0 0 0 2px ${jonyColors.accent1}40`;
        }}
        onBlur={(e) => {
          e.target.style.borderColor = '#cbd5e1';
          e.target.style.boxShadow = 'none';
        }}
      />
      {selected && (
        <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: jonyColors.accent1 }} />
      )}

      {isDropdownOpen && (
        <div className="absolute z-10 top-full mt-2 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
          {uniqueSuggestions.length > 0 ? (
            uniqueSuggestions.map(cat => (
              <a
                href="#"
                key={cat.id}
                onClick={(e) => { e.preventDefault(); handleSelect(cat.name); }}
                className="flex items-center justify-between p-3 hover:bg-slate-100"
              >
                <div className="flex items-center space-x-3">
                  {cat.isSuggestion && <Lightbulb className="w-4 h-4" style={{ color: jonyColors.accent1 }} />}
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }}></div>
                  <span>{cat.name}</span>
                </div>
                {cat.isSuggestion && (
                    <span className="text-xs font-medium" style={{ color: jonyColors.accent1 }}>
                        {Math.round(cat.confidence * 100)}%
                    </span>
                )}
              </a>
            ))
          ) : (
            <div className="p-3 text-slate-500">Keine Kategorien gefunden.</div>
          )}

          {/* Option zum Erstellen einer neuen Kategorie */}
          {inputValue.trim() && (
            <button
              onClick={() => {
                const categoryName = inputValue.trim();
                if (onCategoryCreate) {
                  onCategoryCreate(categoryName);
                } else {
                  handleSelect(categoryName);
                }
                setDropdownOpen(false);
              }}
              className="w-full flex items-center space-x-3 p-3 hover:bg-slate-100 border-t border-slate-200"
              style={{ color: jonyColors.accent1 }}
            >
              <Plus className="w-4 h-4" />
              <span>"{inputValue}" als neue Kategorie erstellen</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default CategorySelector;
