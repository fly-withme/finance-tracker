import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Settings, Palette, Trash2, Plus, Edit, Save, X, Target, Euro, Folder, Users, Sliders, Bell, Shield, Database, Download, Upload, RefreshCw } from 'lucide-react';
import Card from './ui/Card';
import PageHeader from './ui/PageHeader';
import ConfirmationModal from './ui/ConfirmationModal';
import CategoryEditModal from './CategoryEditModal';
import { db } from '../utils/db';

const SettingsPage = ({ settings, setSettings, categories, setCategories }) => {
  // Live-Daten aus der Datenbank
  const liveCategories = useLiveQuery(() => db.categories.toArray(), []) || [];
  const budgets = useLiveQuery(() => db.budgets.toArray(), []) || [];
  
  // UI States
  const [activeTab, setActiveTab] = useState('categories');
  const [categoryToDelete, setCategoryToDelete] = useState(null);
  const [isConfirmOpen, setConfirmOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [editingBudgets, setEditingBudgets] = useState({});
  
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
      id: 'budgets', 
      label: 'Budgets', 
      icon: Target, 
      description: 'Setze monatliche Ausgabenlimits',
      count: budgets.length
    },
    { 
      id: 'preferences', 
      label: 'Präferenzen', 
      icon: Sliders, 
      description: 'App-Einstellungen und Personalisierung',
      badge: 'NEU'
    },
    { 
      id: 'data', 
      label: 'Daten', 
      icon: Database, 
      description: 'Import, Export und Datenverwaltung'
    }
  ];

  const handleDeleteRequest = (id) => { 
    setCategoryToDelete(id); 
    setConfirmOpen(true); 
  };

  const handleDeleteConfirm = async () => { 
    try {
      await db.categories.delete(categoryToDelete);
      await db.budgets.where('categoryName').equals(
        liveCategories.find(c => c.id === categoryToDelete)?.name
      ).delete();
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
  
  const handleSaveCategory = async (categoryData, budgetAmount) => {
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
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  // Organize categories into hierarchical structure
  const organizedCategories = React.useMemo(() => {
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
    <div className="space-y-6">
      {/* Header with Action */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Kategorien verwalten</h3>
          <p className="text-sm text-slate-500 mt-1">Organisiere deine Ausgabenkategorien in Gruppen</p>
        </div>
        <button
          onClick={() => {
            setEditingCategory(null);
            setEditModalOpen(true);
          }}
          className="btn bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Neue Kategorie
        </button>
      </div>

      {/* Grouped Categories */}
      {organizedCategories.grouped.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-slate-700 uppercase tracking-wide">Gruppierte Kategorien</h4>
          {organizedCategories.grouped.map((group) => (
            <div key={group.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              {/* Group Header */}
              <div className="flex items-center justify-between p-4 bg-slate-50 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleGroupExpansion(group.id)}
                    className="p-1 text-slate-500 hover:text-slate-700 rounded transition-colors"
                  >
                    {expandedGroups.has(group.id) ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                  </button>
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: group.color }}></div>
                  <div>
                    <h5 className="font-semibold text-slate-900">{group.name}</h5>
                    <p className="text-xs text-slate-500">{group.subcategories.length} Unterkategorien</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEditCategory(group)}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Bearbeiten"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteRequest(group.id)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Löschen"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Subcategories */}
              {expandedGroups.has(group.id) && (
                <div className="p-4 space-y-2">
                  {group.subcategories.map((subcat) => (
                    <div key={subcat.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: subcat.color }}></div>
                        <span className="font-medium text-slate-800">{subcat.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleUngroupCategory(subcat)}
                          className="px-2 py-1 text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded transition-colors"
                          title="Aus Gruppe entfernen"
                        >
                          Entgruppieren
                        </button>
                        <button
                          onClick={() => handleEditCategory(subcat)}
                          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Bearbeiten"
                        >
                          <Edit className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteRequest(subcat.id)}
                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Löschen"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
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
          <h4 className="text-sm font-medium text-slate-700 uppercase tracking-wide">Einzelne Kategorien</h4>
          <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
            {organizedCategories.ungrouped.map((category) => (
              <div key={category.id} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: category.color }}></div>
                  <span className="font-medium text-slate-900">{category.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleGroupCategory(category)}
                    className="px-3 py-1 text-xs text-green-600 hover:text-green-700 hover:bg-green-50 rounded-full transition-colors flex items-center gap-1"
                    title="In Gruppe verschieben"
                  >
                    <Users className="w-3 h-3" />
                    Gruppieren
                  </button>
                  <button
                    onClick={() => handleEditCategory(category)}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Bearbeiten"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteRequest(category.id)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Löschen"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Orphaned Categories */}
      {organizedCategories.orphaned.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-amber-700 uppercase tracking-wide">Verwaiste Kategorien</h4>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm text-amber-800 mb-3">Diese Kategorien gehören zu nicht existierenden Gruppen:</p>
            <div className="space-y-2">
              {organizedCategories.orphaned.map((category) => (
                <div key={category.id} className="flex items-center justify-between p-2 bg-white rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: category.color }}></div>
                    <span className="font-medium text-slate-900">{category.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleUngroupCategory(category)}
                      className="px-2 py-1 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                    >
                      Reparieren
                    </button>
                    <button
                      onClick={() => handleDeleteRequest(category.id)}
                      className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {liveCategories.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
            <Palette className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-medium text-slate-900 mb-2">Keine Kategorien vorhanden</h3>
          <p className="text-slate-500 mb-6">Erstelle deine erste Kategorie um anzufangen</p>
          <button
            onClick={() => {
              setEditingCategory(null);
              setEditModalOpen(true);
            }}
            className="btn bg-indigo-600 text-white hover:bg-indigo-700"
          >
            Erste Kategorie erstellen
          </button>
        </div>
      )}
    </div>
  );

  // Budgets Tab Component  
  const BudgetsTab = () => {
    const [editingBudget, setEditingBudget] = useState(null);
    const [budgetAmount, setBudgetAmount] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState('');

    const formatCurrency = (amount) => amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

    const handleSaveBudget = async (categoryName, amount) => {
      const budgetValue = parseFloat(amount) || 0;
      if (budgetValue <= 0) return;

      try {
        const existingBudget = budgets.find(b => b.categoryName === categoryName);
        
        if (existingBudget) {
          await db.budgets.update(existingBudget.id, { amount: budgetValue });
        } else {
          await db.budgets.add({
            categoryName,
            amount: budgetValue
          });
        }
        
        setEditingBudget(null);
        setBudgetAmount('');
        setShowAddForm(false);
        setSelectedCategory('');
      } catch (error) {
        console.error('Fehler beim Speichern des Budgets:', error);
      }
    };

    const handleDeleteBudget = async (budgetId) => {
      try {
        await db.budgets.delete(budgetId);
      } catch (error) {
        console.error('Fehler beim Löschen des Budgets:', error);
      }
    };

    const availableCategories = liveCategories.filter(cat => !budgets.find(b => b.categoryName === cat.name));

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Budget verwalten</h3>
            <p className="text-sm text-slate-500 mt-1">Setze monatliche Ausgabenlimits für deine Kategorien</p>
          </div>
          
          {availableCategories.length > 0 && !showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="btn bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Budget hinzufügen
            </button>
          )}
        </div>

        {/* Add Budget Form */}
        {showAddForm && (
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-slate-800">Neues Budget erstellen</h4>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setBudgetAmount('');
                  setSelectedCategory('');
                }}
                className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Kategorie auswählen</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
                >
                  <option value="">Kategorie wählen...</option>
                  {availableCategories.map(category => (
                    <option key={category.id} value={category.name}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Monatliches Budget (€)</label>
                <input
                  type="number"
                  value={budgetAmount}
                  onChange={(e) => setBudgetAmount(e.target.value)}
                  placeholder="z.B. 500"
                  className="w-full px-3 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
            
            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={() => {
                  if (selectedCategory && budgetAmount) {
                    handleSaveBudget(selectedCategory, budgetAmount);
                  }
                }}
                disabled={!selectedCategory || !budgetAmount || parseFloat(budgetAmount) <= 0}
                className="btn bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Budget speichern
              </button>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setBudgetAmount('');
                  setSelectedCategory('');
                }}
                className="btn bg-slate-100 text-slate-700 hover:bg-slate-200"
              >
                Abbrechen
              </button>
            </div>
          </div>
        )}
        
        {/* Existing Budgets */}
        {budgets.length > 0 ? (
          <div className="space-y-3">
            <h4 className="font-medium text-slate-700">
              Aktuelle Budgets ({budgets.length})
            </h4>
            <div className="space-y-3">
              {budgets.map(budget => {
                const category = liveCategories.find(cat => cat.name === budget.categoryName);
                return (
                  <div key={budget.id} className="group p-4 bg-white border border-slate-200 rounded-xl hover:shadow-md transition-all duration-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div 
                          className="w-4 h-4 rounded-full flex-shrink-0" 
                          style={{ backgroundColor: category?.color || '#6366f1' }}
                        />
                        <div>
                          <h5 className="font-semibold text-slate-900">{budget.categoryName}</h5>
                          <p className="text-sm text-slate-500">Monatliches Limit</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {editingBudget === budget.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={budgetAmount}
                              onChange={(e) => setBudgetAmount(e.target.value)}
                              className="w-28 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              autoFocus
                              step="0.01"
                              min="0"
                            />
                            <button
                              onClick={() => handleSaveBudget(budget.categoryName, budgetAmount)}
                              className="btn-icon text-green-600 hover:bg-green-50"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setEditingBudget(null);
                                setBudgetAmount('');
                              }}
                              className="btn-icon text-slate-400 hover:bg-slate-100"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <span className="text-xl font-bold text-slate-800">
                              {formatCurrency(budget.amount)}
                            </span>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => {
                                  setEditingBudget(budget.id);
                                  setBudgetAmount(budget.amount.toString());
                                }}
                                className="btn-icon text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                title="Bearbeiten"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteBudget(budget.id)}
                                className="btn-icon text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                title="Löschen"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Target className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">Noch keine Budgets erstellt</h3>
            <p className="text-slate-500 mb-6">Erstelle dein erstes Budget um deine Ausgaben zu verfolgen</p>
            {availableCategories.length > 0 && (
              <button
                onClick={() => setShowAddForm(true)}
                className="btn bg-indigo-600 text-white hover:bg-indigo-700"
              >
                Erstes Budget erstellen
              </button>
            )}
          </div>
        )}

        {/* No categories available */}
        {liveCategories.length === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Folder className="w-6 h-6 text-amber-600" />
            </div>
            <h4 className="font-medium text-amber-900 mb-2">Keine Kategorien vorhanden</h4>
            <p className="text-amber-700 text-sm">Erstelle zuerst Kategorien im "Kategorien"-Tab, um Budgets hinzuzufügen.</p>
          </div>
        )}
      </div>
    );
  };

  // Preferences Tab Component
  const PreferencesTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900">App-Einstellungen</h3>
        <p className="text-sm text-slate-500 mt-1">Personalisiere deine Zenith Finance Erfahrung</p>
      </div>
      
      <div className="space-y-4">
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-slate-600" />
              <div>
                <h4 className="font-medium text-slate-900">Benachrichtigungen</h4>
                <p className="text-sm text-slate-500">Erhalte Updates über deine Finanzen</p>
              </div>
            </div>
            <div className="w-12 h-6 bg-slate-200 rounded-full relative cursor-pointer">
              <div className="w-5 h-5 bg-white rounded-full shadow absolute top-0.5 left-0.5 transition-transform"></div>
            </div>
          </div>
        </div>
        
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-slate-600" />
              <div>
                <h4 className="font-medium text-slate-900">Datenschutz</h4>
                <p className="text-sm text-slate-500">Verwalte deine Privatsphäre-Einstellungen</p>
              </div>
            </div>
            <button className="btn btn-sm bg-slate-100 text-slate-700 hover:bg-slate-200">
              Konfigurieren
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Data Tab Component
  const DataTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900">Daten verwalten</h3>
        <p className="text-sm text-slate-500 mt-1">Importiere, exportiere und verwalte deine Finanzdaten</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Upload className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h4 className="font-medium text-slate-900">Daten importieren</h4>
              <p className="text-sm text-slate-500">Lade Transaktionen aus anderen Quellen hoch</p>
            </div>
          </div>
          <button className="btn w-full bg-green-600 text-white hover:bg-green-700">
            CSV/Excel importieren
          </button>
        </div>
        
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Download className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h4 className="font-medium text-slate-900">Daten exportieren</h4>
              <p className="text-sm text-slate-500">Sichere deine Daten als Backup</p>
            </div>
          </div>
          <button className="btn w-full bg-blue-600 text-white hover:bg-blue-700">
            Als CSV exportieren
          </button>
        </div>
        
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h4 className="font-medium text-slate-900">Cache leeren</h4>
              <p className="text-sm text-slate-500">Setze die App-Daten zurück</p>
            </div>
          </div>
          <button className="btn w-full bg-orange-600 text-white hover:bg-orange-700">
            Cache zurücksetzen
          </button>
        </div>
        
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
              <Database className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <h4 className="font-medium text-slate-900">Datenbank-Info</h4>
              <p className="text-sm text-slate-500">{liveCategories.length} Kategorien, {budgets.length} Budgets</p>
            </div>
          </div>
          <div className="text-xs text-slate-500">
            Version: {typeof window !== 'undefined' && window.db ? window.db.verno : 'N/A'}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-6 xl:p-8 bg-slate-50 min-h-screen w-full overflow-hidden">
      <div className="w-full max-w-6xl mx-auto">
        {/* Modern Header */}
        <PageHeader title={
          <div className="flex items-center gap-3">
            <Settings className="w-8 h-8 text-indigo-600" />
            <div>
              <h1 className="text-4xl font-extrabold text-slate-800 tracking-tight">Einstellungen</h1>
              <p className="text-slate-500 mt-1">Konfiguriere deine Zenith Finance App</p>
            </div>
          </div>
        } />

        {/* Minimalist Tab Navigation */}
        <div className="mt-8 mb-8">
          <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl w-fit">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                    isActive
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                      isActive
                        ? 'bg-slate-100 text-slate-600'
                        : 'bg-slate-200 text-slate-600'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Card */}
        <Card>
          <div className="p-6 min-h-[600px]">
            {activeTab === 'categories' && <CategoriesTab />}
            {activeTab === 'budgets' && <BudgetsTab />}
            {activeTab === 'preferences' && <PreferencesTab />}
            {activeTab === 'data' && <DataTab />}
          </div>
        </Card>
      </div>

      {/* Modals */}
      <ConfirmationModal 
        isOpen={isConfirmOpen} 
        onClose={() => setConfirmOpen(false)} 
        onConfirm={handleDeleteConfirm} 
        title="Kategorie löschen" 
        message="Möchtest du diese Kategorie wirklich löschen? Transaktionen mit dieser Kategorie müssen neu kategorisiert werden." 
      />
      
      <CategoryEditModal
        category={editingCategory}
        isOpen={isEditModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setEditingCategory(null);
        }}
        onSave={handleSaveCategory}
        onDelete={handleDeleteCategory}
      />

      {/* Grouping Modal */}
      {isGroupModalOpen && categoryToGroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900">
                  "{categoryToGroup.name}" gruppieren
                </h3>
                <button
                  onClick={() => {
                    setGroupModalOpen(false);
                    setCategoryToGroup(null);
                  }}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <p className="text-slate-600 mb-4">
                Wähle eine Hauptkategorie aus, unter der "{categoryToGroup.name}" gruppiert werden soll:
              </p>
              
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {liveCategories
                  .filter(cat => !cat.parentId && cat.id !== categoryToGroup.id)
                  .map((category) => (
                    <button
                      key={category.id}
                      onClick={() => handleGroupToParent(category.id)}
                      className="w-full flex items-center gap-3 p-3 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors text-left"
                    >
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: category.color }}></div>
                      <div className="flex-1">
                        <span className="font-medium text-slate-900">{category.name}</span>
                        {organizedCategories.grouped.find(org => org.id === category.id)?.subcategories.length > 0 && (
                          <p className="text-xs text-slate-500">
                            {organizedCategories.grouped.find(org => org.id === category.id)?.subcategories.length} Unterkategorien
                          </p>
                        )}
                      </div>
                      <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  ))}
              </div>
              
              {liveCategories.filter(cat => !cat.parentId && cat.id !== categoryToGroup.id).length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  <Folder className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>Keine anderen Hauptkategorien verfügbar</p>
                  <p className="text-sm">Erstelle zuerst eine andere Kategorie</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


export default SettingsPage;