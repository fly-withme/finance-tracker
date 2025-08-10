import React, { useState } from 'react';
import { Folder, Palette, Trash2, Plus, Dices } from 'lucide-react';
import Card from './ui/Card';
import PageHeader from './ui/PageHeader';
import ConfirmationModal from './ui/ConfirmationModal';

const SettingsPage = ({ settings, setSettings, categories, setCategories }) => {
  const [catName, setCatName] = useState('');
  const [catColor, setCatColor] = useState('#8B5CF6');
  const [categoryToDelete, setCategoryToDelete] = useState(null);
  const [isConfirmOpen, setConfirmOpen] = useState(false);

  const handleAddCategory = (e) => { 
    e.preventDefault(); 
    if (catName.trim() === '') return; 
    setCategories(prev => [...prev, { id: Date.now(), name: catName, color: catColor }]); 
    setCatName(''); 
    setCatColor('#8B5CF6'); 
  };

  const handleDeleteRequest = (id) => { 
    setCategoryToDelete(id); 
    setConfirmOpen(true); 
  };

  const handleDeleteConfirm = () => { 
    setCategories(prev => prev.filter(c => c.id !== categoryToDelete)); 
    setConfirmOpen(false); 
    setCategoryToDelete(null); 
  };

  const generateRandomColor = () => { 
    const randomColor = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0'); 
    setCatColor(randomColor); 
  };

  return (
    <div>
      <PageHeader title="Settings" />
      <div className="space-y-8">
        <Card className="p-6">
          <h3 className="text-xl font-bold flex items-center space-x-3">
            <Folder className="text-indigo-400" />
            <span>Local Data Configuration</span>
          </h3>
          <p className="text-gray-400 mt-2 mb-4">
            The app runs 100% locally. All data is stored in the folder you specify.
          </p>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-white">Data Storage Path</label>
              <input 
                type="text" 
                value={settings.dataPath} 
                onChange={(e) => setSettings(s => ({ ...s, dataPath: e.target.value }))} 
                className="w-full mt-2 p-3 bg-gray-800 border border-gray-600 rounded-lg text-white" 
              />
            </div>
            <div>
              <label className="text-sm font-medium text-white">Default Currency</label>
              <input 
                type="text" 
                value={settings.currency} 
                onChange={(e) => setSettings(s => ({ ...s, currency: e.target.value }))} 
                className="w-full mt-2 p-3 bg-gray-800 border border-gray-600 rounded-lg text-white" 
              />
            </div>
          </div>
        </Card>
        
        <Card className="p-6">
          <h3 className="text-xl font-bold flex items-center space-x-3">
            <Palette className="text-indigo-400" />
            <span>Categories Management</span>
          </h3>
          <div className="mt-4 space-y-2">
            {categories.map(cat => (
              <div key={cat.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-800">
                <div className="flex items-center space-x-3">
                  <div className="w-5 h-5 rounded-full" style={{ backgroundColor: cat.color }}></div>
                  <span className="font-medium text-white">{cat.name}</span>
                </div>
                <button 
                  onClick={() => handleDeleteRequest(cat.id)} 
                  className="text-gray-500 hover:text-red-500"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <form onSubmit={handleAddCategory} className="mt-6 pt-6 border-t border-gray-700">
            <div className="flex gap-4">
              <div className="relative w-12 h-12">
                <input 
                  type="color" 
                  value={catColor} 
                  onChange={e => setCatColor(e.target.value)} 
                  className="custom-color-input absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                />
                <div className="w-12 h-12 rounded-full" style={{ backgroundColor: catColor }}></div>
              </div>
              <button 
                type="button" 
                onClick={generateRandomColor} 
                className="w-12 h-12 flex-shrink-0 flex items-center justify-center bg-gray-800 hover:bg-gray-700 rounded-full text-gray-400 transition-colors"
              >
                <Dices className="w-6 h-6"/>
              </button>
              <input 
                type="text" 
                value={catName} 
                onChange={e => setCatName(e.target.value)} 
                placeholder="New category name" 
                className="flex-grow h-12 px-4 bg-gray-800 border border-gray-600 rounded-lg text-white" 
              />
              <button 
                type="submit" 
                className="h-12 px-6 bg-indigo-600 rounded-lg font-semibold text-white hover:bg-indigo-500 transition-colors flex items-center gap-2"
              > 
                <Plus className="w-5 h-5"/> Add
              </button>
            </div>
          </form>
        </Card>
      </div>
      <ConfirmationModal 
        isOpen={isConfirmOpen} 
        onClose={() => setConfirmOpen(false)} 
        onConfirm={handleDeleteConfirm} 
        title="Delete Category" 
        message="Are you sure you want to delete this category? Transactions with this category will need to be re-categorized." 
      />
    </div>
  );
};

export default SettingsPage;