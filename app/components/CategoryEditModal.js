import React, { useState, useEffect } from 'react';
import { Palette, Trash2, Save, X, Dices, Euro, Target } from 'lucide-react';
import Modal from './ui/Modal';
import ConfirmationModal from './ui/ConfirmationModal';
import { jonyColors } from '../theme';

const CategoryEditModal = ({ category, isOpen, onClose, onSave, onDelete }) => {
  const [formData, setFormData] = useState({
    name: '',
    color: '#8B5CF6',
    parentId: null
  });
  const [budget, setBudget] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (category && isOpen) {
      setFormData({
        name: category.name || '',
        color: category.color || '#8B5CF6',
        parentId: category.parentId || null
      });
      setBudget(category.currentBudget?.toString() || '');
    } else if (isOpen) {
      // New category
      setFormData({
        name: '',
        color: '#8B5CF6',
        parentId: null
      });
      setBudget('');
    }
  }, [category, isOpen]);

  const generateRandomColor = () => {
    const colors = [jonyColors.accent1, jonyColors.accent2, jonyColors.magenta, jonyColors.red, '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    setFormData(prev => ({ ...prev, color: randomColor }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    const categoryData = {
      ...formData,
      name: formData.name.trim()
    };

    const budgetAmount = parseFloat(budget) || 0;
    
    onSave(categoryData, budgetAmount);
    onClose();
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    onDelete(category.id);
    setShowDeleteConfirm(false);
    onClose();
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
          <div className="rounded-2xl shadow-2xl w-full max-w-lg border" style={{ 
            backgroundColor: jonyColors.surface, 
            border: `1px solid ${jonyColors.border}` 
          }}>
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{
                    background: `linear-gradient(135deg, ${jonyColors.accent1}, ${jonyColors.greenDark})`
                  }}>
                    <Palette className="w-6 h-6 text-black" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold" style={{ color: jonyColors.textPrimary }}>
                      {category ? category.name : 'Neue Kategorie'}
                    </h2>
                    <p className="text-sm" style={{ color: jonyColors.textSecondary }}>
                      {category ? 'Bearbeiten' : 'Erstellen'}
                    </p>
                  </div>
                </div>
                <button onClick={onClose} className="p-2 rounded-lg transition-colors" style={{ 
                  backgroundColor: jonyColors.cardBackground,
                  color: jonyColors.textSecondary
                }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = jonyColors.border;
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = jonyColors.cardBackground;
                  }}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Category Name */}
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: jonyColors.textPrimary }}>
                    Kategoriename
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="z.B. Lebensmittel, Transport..."
                    className="w-full px-4 py-3 border rounded-xl font-medium transition-colors focus:outline-none"
                    style={{
                      backgroundColor: jonyColors.cardBackground,
                      color: jonyColors.textPrimary,
                      border: `1px solid ${jonyColors.border}`
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = jonyColors.textSecondary;
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = jonyColors.border;
                    }}
                    required
                    autoFocus
                  />
                </div>

                {/* Color & Budget Row */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Color Selection */}
                  <div>
                    <label className="block text-sm font-semibold mb-2" style={{ color: jonyColors.textPrimary }}>
                      Farbe
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <input
                          type="color"
                          name="color"
                          value={formData.color}
                          onChange={handleChange}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <div
                          className="w-10 h-10 rounded-lg shadow-sm transition-all cursor-pointer border"
                          style={{ 
                            backgroundColor: formData.color,
                            borderColor: jonyColors.border
                          }}
                        ></div>
                      </div>
                      
                      <button
                        type="button"
                        onClick={generateRandomColor}
                        className="p-2 rounded-lg transition-all"
                        style={{
                          backgroundColor: jonyColors.cardBackground,
                          color: jonyColors.textSecondary,
                          border: `1px solid ${jonyColors.border}`
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = jonyColors.border;
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = jonyColors.cardBackground;
                        }}
                        title="Zufällige Farbe"
                      >
                        <Dices className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Budget Setting */}
                  <div>
                    <label className="block text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: jonyColors.textPrimary }}>
                      <Target className="w-4 h-4" style={{ color: jonyColors.accent1 }} />
                      Budget
                    </label>
                    <div className="relative">
                      <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: jonyColors.textSecondary }} />
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={budget}
                        onChange={(e) => setBudget(e.target.value)}
                        placeholder="0.00"
                        className="w-full pl-9 pr-3 py-3 border rounded-xl font-medium transition-colors focus:outline-none"
                        style={{
                          backgroundColor: jonyColors.cardBackground,
                          color: jonyColors.textPrimary,
                          border: `1px solid ${jonyColors.border}`
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = jonyColors.textSecondary;
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = jonyColors.border;
                        }}
                      />
                    </div>
                  </div>
                </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-6 border-t" style={{ borderColor: jonyColors.border }}>
                {category && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-colors"
                    style={{
                      backgroundColor: jonyColors.redAlpha,
                      color: jonyColors.red
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = jonyColors.red;
                      e.target.style.color = 'white';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = jonyColors.redAlpha;
                      e.target.style.color = jonyColors.red;
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                    Löschen
                  </button>
                )}
                
                <div className="flex gap-3 ml-auto">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-lg font-medium transition-colors"
                    style={{
                      backgroundColor: jonyColors.cardBackground,
                      color: jonyColors.textSecondary,
                      border: `1px solid ${jonyColors.border}`
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = jonyColors.border;
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = jonyColors.cardBackground;
                    }}
                  >
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    disabled={!formData.name.trim()}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all"
                    style={{
                      backgroundColor: !formData.name.trim() ? jonyColors.border : jonyColors.accent1,
                      color: !formData.name.trim() ? jonyColors.textSecondary : 'black',
                      cursor: !formData.name.trim() ? 'not-allowed' : 'pointer',
                      opacity: !formData.name.trim() ? 0.5 : 1
                    }}
                    onMouseEnter={(e) => {
                      if (formData.name.trim()) {
                        e.target.style.transform = 'scale(1.02)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (formData.name.trim()) {
                        e.target.style.transform = 'scale(1)';
                      }
                    }}
                  >
                    <Save className="w-4 h-4" />
                    {category ? 'Speichern' : 'Erstellen'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
      )}

      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDelete}
        title="Kategorie löschen"
        message={`Möchtest du die Kategorie "${category?.name}" wirklich löschen? Transaktionen mit dieser Kategorie müssen neu kategorisiert werden.`}
      />
    </>
  );
};

export default CategoryEditModal;