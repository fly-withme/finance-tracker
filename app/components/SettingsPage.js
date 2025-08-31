import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Settings, Palette, Trash2, Plus, Edit, Folder, Users, Sliders, Database, Download, Upload, X, ChevronRight, ChevronDown, Moon, Eye, EyeOff, LayoutDashboard, Repeat, Calculator, CreditCard, Target, Inbox } from 'lucide-react';
import ConfirmationModal from './ui/ConfirmationModal';
import CategoryEditModal from './CategoryEditModal';
import { db } from '../utils/db';

const SettingsPage = ({ settings, setSettings, categories, setCategories, enhancedClassifier, useEnhancedML }) => {
  // Live-Daten aus der Datenbank
  const liveCategories = useLiveQuery(() => db.categories.toArray(), []) || [];
  const pageVisibilitySettings = useLiveQuery(() => db.settings.get('pageVisibility'), []);
  
  // UI States
  const [activeTab, setActiveTab] = useState('categories');
  const [categoryToDelete, setCategoryToDelete] = useState(null);
  const [isConfirmOpen, setConfirmOpen] = useState(false);
  const [isDeleteAllConfirmOpen, setDeleteAllConfirmOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
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
      id: 'pages', 
      label: 'Seiten', 
      icon: Eye, 
      description: 'Konfiguriere sichtbare Seiten in der Navigation'
    },
    { 
      id: 'data', 
      label: 'Daten', 
      icon: Database, 
      description: 'Import, Export und Datenverwaltung'
    }
  ];

  // --- HANDLERS ---
  
  // Page Visibility Management
  const handlePageVisibilityToggle = async (pageId) => {
    if (!pageVisibilitySettings) return;
    
    const currentSettings = pageVisibilitySettings.value || {};
    const newSettings = {
      ...currentSettings,
      [pageId]: !currentSettings[pageId]
    };
    
    try {
      await db.settings.put({
        key: 'pageVisibility',
        value: newSettings
      });
    } catch (error) {
      console.error('Fehler beim Aktualisieren der Seitensichtbarkeit:', error);
    }
  };
  
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
    if (deleteConfirmText !== 'LÖSCHEN') {
      return;
    }
    
    try {
      await Promise.all([
        db.inbox.clear(),
        db.transactions.clear(),
        db.budgets.clear(),
        db.categories.clear(),
        db.settings.clear(),
        db.contacts.clear(),
        db.sharedExpenses.clear(),
        db.savingsGoals.clear()
      ]);
      console.log('Alle Daten wurden gelöscht.');
    } catch (error) {
      console.error('Fehler beim Löschen aller Daten:', error);
    }
    setDeleteAllConfirmOpen(false);
    setDeleteConfirmText('');
  };

  const handleCloseDeleteModal = () => {
    setDeleteAllConfirmOpen(false);
    setDeleteConfirmText('');
  };

  const handleExportData = async () => {
    try {
      // Alle Daten aus der Datenbank abrufen
      const [
        transactions,
        categories,
        accounts,
        budgets,
        contacts,
        sharedExpenses,
        savingsGoals,
        settings
      ] = await Promise.all([
        db.transactions.toArray(),
        db.categories.toArray(),
        db.accounts.toArray(),
        db.budgets.toArray(),
        db.contacts.toArray(),
        db.sharedExpenses.toArray(),
        db.savingsGoals.toArray(),
        db.settings.toArray()
      ]);

      // Daten in JSON-Format strukturieren
      const exportData = {
        exportDate: new Date().toISOString(),
        version: '1.0',
        data: {
          transactions,
          categories,
          accounts,
          budgets,
          contacts,
          sharedExpenses,
          savingsGoals,
          settings
        },
        counts: {
          transactions: transactions.length,
          categories: categories.length,
          accounts: accounts.length,
          budgets: budgets.length,
          contacts: contacts.length,
          sharedExpenses: sharedExpenses.length,
          savingsGoals: savingsGoals.length,
          settings: settings.length
        }
      };

      // JSON zu String konvertieren
      const jsonString = JSON.stringify(exportData, null, 2);
      
      // Blob erstellen und Download starten
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `zenith-finance-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      console.log('Daten wurden erfolgreich exportiert.');
    } catch (error) {
      console.error('Fehler beim Exportieren der Daten:', error);
    }
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

  // Available pages definition
  const availablePages = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, description: 'Übersicht deiner Finanzen' },
    { id: 'inbox', label: 'Posteingang', icon: Inbox, description: 'Unverarbeitete Transaktionen' },
    { id: 'transactions', label: 'Transaktionen', icon: Repeat, description: 'Alle deine Transaktionen' },
    { id: 'shared-expenses', label: 'Geteilte Ausgaben', icon: Users, description: 'Mit anderen geteilte Kosten' },
    { id: 'budget', label: 'Budget', icon: Calculator, description: 'Budgetplanung und -verfolgung' },
    { id: 'debts', label: 'Schulden', icon: CreditCard, description: 'Kredite und Schulden verwalten' },
    { id: 'savings-goals', label: 'Sparziele', icon: Target, description: 'Langfristige Sparziele' }
  ];

  // Pages Tab Component
  const PagesTab = () => {
    const visibilitySettings = pageVisibilitySettings?.value || {};
    
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Seiten verwalten</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Wähle aus, welche Seiten in der Sidebar angezeigt werden sollen.</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-200 dark:divide-slate-700">
          {availablePages.map((page) => {
            const Icon = page.icon;
            const isVisible = visibilitySettings[page.id] !== false;
            
            return (
              <div key={page.id} className="flex items-center justify-between p-4 group hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">{page.label}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{page.description}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                    isVisible 
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' 
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                  }`}>
                    {isVisible ? 'Sichtbar' : 'Versteckt'}
                  </div>
                  
                  <button
                    onClick={() => handlePageVisibilityToggle(page.id)}
                    disabled={page.id === 'dashboard'}
                    className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 ${
                      page.id === 'dashboard'
                        ? 'bg-slate-300 dark:bg-slate-600 opacity-50 cursor-not-allowed'
                        : isVisible 
                          ? 'bg-gradient-to-r from-indigo-600 to-purple-600' 
                          : 'bg-slate-300 dark:bg-slate-600'
                    }`}
                  >
                    <span
                      className={`inline-block w-4 h-4 transform rounded-full bg-white shadow-lg transition-transform ${
                        isVisible ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <div className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full"></div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Hinweis</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Versteckte Seiten sind weiterhin über die URL erreichbar, werden aber nicht in der Sidebar angezeigt. 
                Das Dashboard kann nicht versteckt werden, da es die Startseite ist.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

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
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold rounded-lg shadow-md hover:from-purple-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 transition-all"
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
                  <button onClick={(e) => { e.stopPropagation(); handleEditCategory(group); }} className="p-2 text-slate-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors" title="Bearbeiten"><Edit className="w-4 h-4" /></button>
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
                        <button onClick={() => handleEditCategory(subcat)} className="p-1 text-slate-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 rounded transition-colors"><Edit className="w-4 h-4" /></button>
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
                  <button onClick={() => handleGroupCategory(category)} className="px-3 py-1 text-xs text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/50 rounded-full flex items-center gap-1"> <Users className="w-3 h-3" /> Gruppieren</button>
                  <button onClick={() => handleEditCategory(category)} className="p-2 text-slate-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md"><Edit className="w-4 h-4" /></button>
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
    <div className="space-y-6">
      {/* Export Section */}
      <div className="flex items-center justify-between py-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <Download className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">Daten exportieren</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Backup aller Finanzdaten erstellen</p>
          </div>
        </div>
        <button 
          onClick={handleExportData}
          className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-medium rounded-lg transition-all duration-200"
        >
          Backup erstellen
        </button>
      </div>

      {/* Delete All Section */}
      <div className="flex items-center justify-between py-4">
        <div className="flex items-center gap-3">
          <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">Alle Daten löschen</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Unwiderruflich alle Daten entfernen</p>
          </div>
        </div>
        <button 
          onClick={() => setDeleteAllConfirmOpen(true)} 
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors duration-200"
        >
          Alle löschen
        </button>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'categories': return <CategoriesTab />;
      case 'pages': return <PagesTab />;
      case 'data': return <DataTab />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 font-sans text-slate-800 dark:text-slate-200 p-4 sm:p-6 md:p-8 flex flex-col items-center">
      <div className="w-full max-w-7xl mx-auto">
        {/* ## Page Header mit Grid-Layout ## */}
        <header className="mb-8">
          <div className="grid grid-cols-3 items-center">
            {/* Linke Spalte: Titel */}
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Einstellungen</h1>
            </div>

            {/* Mittlere Spalte: Leer */}
            <div></div>

            {/* Rechte Spalte: Navigation */}
            <div className="flex justify-end">
              <nav className="flex items-center gap-1">
                {tabs.map((tab, index) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`relative flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all duration-200 ${
                        isActive
                          ? 'text-purple-600 dark:text-purple-400'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{tab.label}</span>
                      {tab.count && (
                        <span className={`ml-1 px-1.5 py-0.5 text-xs font-medium rounded-full ${
                          isActive 
                            ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' 
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                        }`}>
                          {tab.count}
                        </span>
                      )}
                      
                      {/* Active underline */}
                      {isActive && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full"></div>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>
        </header>

        {/* Content */}
        <main>
          {renderContent()}
        </main>
      </div>

      {/* Modals */}
      <ConfirmationModal isOpen={isConfirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={handleDeleteConfirm} title="Kategorie löschen" message="Möchtest du diese Kategorie wirklich löschen? Zugehörige Budgets werden ebenfalls entfernt." />
{/* Enhanced Delete All Data Modal */}
      {isDeleteAllConfirmOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg border border-red-200 dark:border-red-800/50">
            <div className="p-8">
              {/* Header */}
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
                  <Trash2 className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-red-800 dark:text-red-300">Alle Daten löschen?</h2>
                  <p className="text-sm text-red-600 dark:text-red-400 font-medium">Dieser Vorgang ist unwiderruflich</p>
                </div>
              </div>
              
              {/* Warning Message */}
              <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/50 rounded-xl p-4 mb-6">
                <p className="text-sm text-red-700 dark:text-red-300 leading-relaxed">
                  <span className="font-semibold">Warnung:</span> Diese Aktion löscht permanent alle deine:
                </p>
                <ul className="text-sm text-red-600 dark:text-red-400 mt-2 ml-4 space-y-1">
                  <li>• Transaktionen und Kategorien</li>
                  <li>• Budgets und Sparziele</li>
                  <li>• Kontakte und geteilte Ausgaben</li>
                  <li>• Alle Einstellungen</li>
                </ul>
              </div>
              
              {/* Confirmation Input */}
              <div className="mb-8">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                  Tippe <span className="px-2 py-1 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 rounded font-mono text-xs">LÖSCHEN</span> um zu bestätigen:
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-red-200 dark:border-red-700 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-mono"
                  placeholder="LÖSCHEN"
                />
              </div>
              
              {/* Actions */}
              <div className="flex gap-4">
                <button
                  onClick={handleCloseDeleteModal}
                  className="flex-1 px-6 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl font-semibold transition-all duration-200"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleDeleteAllData}
                  disabled={deleteConfirmText !== 'LÖSCHEN'}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-xl font-bold transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg"
                >
                  Alle Daten löschen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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
