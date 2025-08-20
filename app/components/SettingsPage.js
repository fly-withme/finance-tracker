import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Settings, Palette, Trash2, Plus, Edit, Folder, Users, Sliders, Database, Download, Upload, X, ChevronRight, ChevronDown } from 'lucide-react';
import ConfirmationModal from './ui/ConfirmationModal';
import CategoryEditModal from './CategoryEditModal';
import { db } from '../utils/db';

const SettingsPage = ({ settings, setSettings, categories, setCategories, enhancedClassifier, useEnhancedML }) => {
  // Live-Daten aus der Datenbank
  const liveCategories = useLiveQuery(() => db.categories.toArray(), []) || [];
  
  // UI States
  const [activeTab, setActiveTab] = useState('categories');
  const [categoryToDelete, setCategoryToDelete] = useState(null);
  const [isConfirmOpen, setConfirmOpen] = useState(false);
  const [isDeleteAllConfirmOpen, setDeleteAllConfirmOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  
  // Grouping States
  const [isGroupModalOpen, setGroupModalOpen] = useState(false);
  const [categoryToGroup, setCategoryToGroup] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState(new Set());

  // Tab content definitions
  const tabs = [
    { 
      id: 'categories', 
      label: 'Kategorien', 
      icon: Palette, 
      description: 'Verwalte und organisiere deine Ausgabenkategorien',
      count: liveCategories.length
    },
    { 
      id: 'data', 
      label: 'Daten', 
      icon: Database, 
      description: 'Import, Export und Datenverwaltung'
    }
  ];

  // --- HANDLERS ---
  
  // Category Management
  const handleDeleteRequest = (id) => { 
    setCategoryToDelete(id); 
    setConfirmOpen(true); 
  };

  const handleDeleteConfirm = async () => { 
    try {
      const categoryName = liveCategories.find(c => c.id === categoryToDelete)?.name;
      await db.categories.delete(categoryToDelete);
      if (categoryName) {
        await db.budgets.where('categoryName').equals(categoryName).delete();
      }
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
    }
    setConfirmOpen(false); 
    setCategoryToDelete(null); 
  };

  const handleEditCategory = (category) => {
    setEditingCategory(category);
    setEditModalOpen(true);
  };
  
  const handleSaveCategory = async (categoryData) => {
    try {
      if (editingCategory?.id) {
        await db.categories.update(editingCategory.id, categoryData);
      } else {
        await db.categories.add(categoryData);
      }
    } catch (error) {
      console.error('Fehler beim Speichern der Kategorie:', error);
    }
  };
  
  const handleDeleteCategory = async (categoryId) => {
    try {
      const category = liveCategories.find(c => c.id === categoryId);
      if (!category) return;
      
      await db.categories.delete(categoryId);
      await db.budgets.where('categoryName').equals(category.name).delete();
    } catch (error) {
      console.error('Fehler beim Löschen der Kategorie:', error);
    }
  };

  // Grouping Functions
  const handleGroupCategory = (category) => {
    setCategoryToGroup(category);
    setGroupModalOpen(true);
  };

  const handleGroupToParent = async (parentId) => {
    if (categoryToGroup && parentId !== categoryToGroup.id) {
      try {
        await db.categories.update(categoryToGroup.id, { parentId });
        setGroupModalOpen(false);
        setCategoryToGroup(null);
      } catch (error) {
        console.error('Fehler beim Gruppieren:', error);
      }
    }
  };

  const handleUngroupCategory = async (category) => {
    try {
      await db.categories.update(category.id, { parentId: null });
    } catch (error) {
      console.error('Fehler beim Entgruppieren:', error);
    }
  };

  const toggleGroupExpansion = (groupId) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) newSet.delete(groupId);
      else newSet.add(groupId);
      return newSet;
    });
  };
  
  const handleDeleteAllData = async () => {
    try {
      await Promise.all([
        db.inbox.clear(),
        db.transactions.clear(),
        db.budgets.clear(),
        db.categories.clear(),
        db.settings.clear(),
        db.contacts.clear(),
        db.sharedExpenses.clear()
      ]);
      console.log('Alle Daten wurden gelöscht.');
    } catch (error) {
      console.error('Fehler beim Löschen aller Daten:', error);
    }
    setDeleteAllConfirmOpen(false);
  };

  // Organize categories into hierarchical structure
  const organizedCategories = useMemo(() => {
    const mainCategories = liveCategories.filter(cat => !cat.parentId);
    const subcategories = liveCategories.filter(cat => cat.parentId);
    
    return {
      grouped: mainCategories.map(mainCat => ({
        ...mainCat,
        subcategories: subcategories.filter(cat => cat.parentId === mainCat.id)
      })).filter(cat => cat.subcategories.length > 0),
      ungrouped: mainCategories.filter(cat => 
        !subcategories.some(sub => sub.parentId === cat.id)
      ),
      orphaned: subcategories.filter(cat => 
        !mainCategories.some(main => main.id === cat.parentId)
      )
    };
  }, [liveCategories]);

  // Categories Tab Component
  const CategoriesTab = () => (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Kategorien verwalten</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Organisiere deine Ausgabenkategorien in Gruppen.</p>
        </div>
        <button
          onClick={() => { setEditingCategory(null); setEditModalOpen(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 transition-all"
        >
          <Plus className="w-5 h-5" />
          Neue Kategorie
        </button>
      </div>

      {/* Grouped Categories */}
      {organizedCategories.grouped.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Gruppen</h3>
          {organizedCategories.grouped.map((group) => (
            <div key={group.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50" onClick={() => toggleGroupExpansion(group.id)}>
                <div className="flex items-center gap-4">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: group.color }}></div>
                  <div>
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100">{group.name}</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{group.subcategories.length} Unterkategorien</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={(e) => { e.stopPropagation(); handleEditCategory(group); }} className="p-2 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors" title="Bearbeiten"><Edit className="w-4 h-4" /></button>
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteRequest(group.id); }} className="p-2 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors" title="Löschen"><Trash2 className="w-4 h-4" /></button>
                  <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${expandedGroups.has(group.id) ? 'rotate-180' : ''}`} />
                </div>
              </div>
              {expandedGroups.has(group.id) && (
                <div className="border-t border-slate-200 dark:border-slate-700 p-4 space-y-2">
                  {group.subcategories.map((subcat) => (
                    <div key={subcat.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 group">
                      <div className="flex items-center gap-3"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: subcat.color }}></div><span className="font-medium text-slate-800 dark:text-slate-200">{subcat.name}</span></div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleUngroupCategory(subcat)} className="px-2 py-1 text-xs text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/50 rounded transition-colors">Entgruppieren</button>
                        <button onClick={() => handleEditCategory(subcat)} className="p-1 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded transition-colors"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => handleDeleteRequest(subcat.id)} className="p-1 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Ungrouped Categories */}
      {organizedCategories.ungrouped.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Einzelne Kategorien</h3>
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-200 dark:divide-slate-700">
            {organizedCategories.ungrouped.map((category) => (
              <div key={category.id} className="flex items-center justify-between p-4 group hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                <div className="flex items-center gap-4"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: category.color }}></div><span className="font-semibold text-slate-900 dark:text-slate-100">{category.name}</span></div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleGroupCategory(category)} className="px-3 py-1 text-xs text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/50 rounded-full flex items-center gap-1"> <Users className="w-3 h-3" /> Gruppieren</button>
                  <button onClick={() => handleEditCategory(category)} className="p-2 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md"><Edit className="w-4 h-4" /></button>
                  <button onClick={() => handleDeleteRequest(category.id)} className="p-2 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {liveCategories.length === 0 && (
        <div className="text-center py-16 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
          <Palette className="w-12 h-12 mx-auto text-slate-400 dark:text-slate-500" />
          <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-slate-100">Keine Kategorien vorhanden</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Erstelle deine erste Kategorie, um loszulegen.</p>
        </div>
      )}
    </div>
  );

  const DataTab = () => (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Daten verwalten</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Importiere, exportiere und verwalte deine Finanzdaten.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 flex flex-col items-start">
          <div className="flex items-center gap-3 mb-2"><div className="w-10 h-10 bg-green-100 dark:bg-green-900/50 rounded-lg flex items-center justify-center"><Upload className="w-5 h-5 text-green-600 dark:text-green-400" /></div><h4 className="font-semibold text-slate-900 dark:text-slate-100">Daten importieren</h4></div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 flex-grow">Lade Transaktionen aus einer CSV-Datei hoch.</p>
          <button className="w-full px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">Import starten</button>
        </div>
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 flex flex-col items-start">
          <div className="flex items-center gap-3 mb-2"><div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/50 rounded-lg flex items-center justify-center"><Download className="w-5 h-5 text-blue-600 dark:text-blue-400" /></div><h4 className="font-semibold text-slate-900 dark:text-slate-100">Daten exportieren</h4></div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 flex-grow">Sichere alle deine Transaktionen als CSV-Datei.</p>
          <button className="w-full px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">Export starten</button>
        </div>
      </div>
      <div className="border-2 border-red-500/50 dark:border-red-500/30 bg-red-50 dark:bg-red-900/20 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-red-100 dark:bg-red-900/50 rounded-lg flex items-center justify-center flex-shrink-0"><Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" /></div>
          <div>
            <h4 className="font-semibold text-red-800 dark:text-red-300">Gefahrenzone: Alle Daten löschen</h4>
            <p className="text-sm text-red-700 dark:text-red-400 mt-1 mb-4">Dieser Vorgang ist endgültig. Alle deine Transaktionen, Budgets, Kategorien und Kontakte werden unwiderruflich gelöscht.</p>
            <button onClick={() => setDeleteAllConfirmOpen(true)} className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-red-900/20 transition-all">Ich verstehe, alle Daten löschen</button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'categories': return <CategoriesTab />;
      case 'data': return <DataTab />;
      default: return null;
    }
  };

  return (
    <div className="bg-slate-50 dark:bg-slate-900 min-h-screen font-sans">
      <div className="max-w-screen-xl mx-auto p-4 sm:p-6 lg:p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Einstellungen</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">Verwalte deine Kategorien, Präferenzen und Daten.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-12 md:gap-8">
          <aside className="md:col-span-3 lg:col-span-2 mb-8 md:mb-0">
            <nav className="space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <main className="md:col-span-9 lg:col-span-10">
            {renderContent()}
          </main>
        </div>
      </div>

      {/* Modals */}
      <ConfirmationModal isOpen={isConfirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={handleDeleteConfirm} title="Kategorie löschen" message="Möchtest du diese Kategorie wirklich löschen? Zugehörige Budgets werden ebenfalls entfernt." />
      <ConfirmationModal isOpen={isDeleteAllConfirmOpen} onClose={() => setDeleteAllConfirmOpen(false)} onConfirm={handleDeleteAllData} title="Alle Daten wirklich löschen?" message="Dieser Vorgang kann nicht rückgängig gemacht werden. Bist du absolut sicher?" />
      <CategoryEditModal category={editingCategory} isOpen={isEditModalOpen} onClose={() => { setEditModalOpen(false); setEditingCategory(null); }} onSave={handleSaveCategory} onDelete={handleDeleteCategory} />

      {isGroupModalOpen && categoryToGroup && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">"{categoryToGroup.name}" gruppieren</h3><button onClick={() => { setGroupModalOpen(false); setCategoryToGroup(null); }} className="p-1 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full"><X className="w-5 h-5" /></button></div>
              <p className="text-slate-600 dark:text-slate-400 mb-4 text-sm">Wähle eine Hauptkategorie aus, der diese Kategorie untergeordnet werden soll:</p>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                {liveCategories.filter(cat => !cat.parentId && cat.id !== categoryToGroup.id).map((category) => (
                  <button key={category.id} onClick={() => handleGroupToParent(category.id)} className="w-full flex items-center gap-3 p-3 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/50 dark:hover:bg-slate-700 rounded-lg transition-colors text-left">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: category.color }}></div>
                    <span className="flex-1 font-medium text-slate-900 dark:text-slate-100">{category.name}</span>
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  </button>
                ))}
              </div>
              {liveCategories.filter(cat => !cat.parentId && cat.id !== categoryToGroup.id).length === 0 && (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400"><Folder className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" /><p>Keine anderen Hauptkategorien verfügbar.</p></div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
