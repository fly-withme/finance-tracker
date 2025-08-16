import React, { useState, useEffect } from 'react';
import { Palette, Trash2, Save, X, Dices, Euro, Target } from 'lucide-react';
import Modal from './ui/Modal';
import ConfirmationModal from './ui/ConfirmationModal';

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
    const randomColor = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
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
      <Modal 
        isOpen={isOpen} 
        onClose={onClose} 
        title={category ? `${category.name} bearbeiten` : 'Neue Kategorie'}
        size="default"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Category Name */}
          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-3">
              Kategoriename
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="z.B. Lebensmittel, Transport..."
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 font-medium"
              required
              autoFocus
            />
          </div>

          {/* Color Selection */}
          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-3">
              Farbe
            </label>
            <div className="flex items-center gap-4">
              <div className="relative">
                <input
                  type="color"
                  name="color"
                  value={formData.color}
                  onChange={handleChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div
                  className="w-16 h-16 rounded-xl border-2 border-white shadow-lg ring-2 ring-slate-200 hover:ring-indigo-300 transition-all cursor-pointer"
                  style={{ backgroundColor: formData.color }}
                ></div>
              </div>
              
              <button
                type="button"
                onClick={generateRandomColor}
                className="flex items-center gap-2 px-4 py-3 bg-white hover:bg-indigo-50 rounded-xl text-slate-600 hover:text-indigo-600 transition-all shadow-sm border border-slate-200 hover:border-indigo-300 font-medium"
              >
                <Dices className="w-5 h-5" />
                Zufällige Farbe
              </button>
            </div>
          </div>

          {/* Budget Setting */}
          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <Target className="w-4 h-4 text-indigo-600" />
              Monatliches Budget
            </label>
            <div className="relative">
              <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="number"
                step="0.01"
                min="0"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="0.00"
                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 font-medium"
              />
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Leer lassen für kein Budget
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-6 border-t border-slate-200">
            <div>
              {category && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium"
                >
                  <Trash2 className="w-4 h-4" />
                  Löschen
                </button>
              )}
            </div>
            
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={!formData.name.trim()}
                className="flex items-center gap-2 px-6 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold transition-all hover:from-indigo-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                Speichern
              </button>
            </div>
          </div>
        </form>
      </Modal>

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