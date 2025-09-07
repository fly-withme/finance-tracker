import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Settings, Palette, Trash2, Plus, Edit, Folder, Users, Sliders, Database, Download, Upload, X, ChevronRight, ChevronDown, Moon, Eye, EyeOff, LayoutDashboard, Repeat, Calculator, CreditCard, Target, Inbox, User, Save } from 'lucide-react';
import ConfirmationModal from './ui/ConfirmationModal';
import CategoryEditModal from './CategoryEditModal';
import { db } from '../utils/db';
import { jonyColors } from '../theme';

const SettingsPage = ({ settings, setSettings, categories, setCategories, enhancedClassifier, useEnhancedML }) => {
  // Profile States (need to be declared first since they're used in useLiveQuery)
  const [profileData, setProfileData] = useState({
    userName: '',
    age: '',
    annualIncome: '',
    monthlyExpenses: ''
  });
  const [hasProfileChanges, setHasProfileChanges] = useState(false);

  // Live-Daten aus der Datenbank
  const liveCategories = useLiveQuery(() => db.categories.toArray(), []) || [];
  const pageVisibilitySettings = useLiveQuery(() => db.settings.get('pageVisibility'), []);
  // userSettings nur laden, nicht bei jedem Re-Render aktualisieren
  const userSettingsRaw = useLiveQuery(() => db.settings.get('userProfile'), []);
  const userSettings = React.useMemo(() => userSettingsRaw || {}, [userSettingsRaw?.value]);
  
  // UI States
  const [activeTab, setActiveTab] = useState('profile');
  const [categoryToDelete, setCategoryToDelete] = useState(null);
  const [isConfirmOpen, setConfirmOpen] = useState(false);
  const [isDeleteAllConfirmOpen, setDeleteAllConfirmOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [editingCategory, setEditingCategory] = useState(null);
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [deleteAllCategoriesConfirm, setDeleteAllCategoriesConfirm] = useState(false);
  const [deleteAllCategoriesText, setDeleteAllCategoriesText] = useState('');
  
  // Grouping States
  const [isGroupModalOpen, setGroupModalOpen] = useState(false);
  const [categoryToGroup, setCategoryToGroup] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState(new Set());

  // Tab content definitions
  const tabs = [
    { 
      id: 'profile', 
      label: 'Profil', 
      icon: User, 
      description: 'Persönliche Einstellungen und Benutzerdaten'
    },
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

  // Load profile data when userSettings changes - but only when not actively editing
  React.useEffect(() => {
    if (!hasProfileChanges) {
      if (userSettings?.value) {
        setProfileData({
          userName: userSettings.value.userName || '',
          age: userSettings.value.age || '',
          annualIncome: userSettings.value.annualIncome || '',
          monthlyExpenses: userSettings.value.monthlyExpenses || ''
        });
      } else {
        setProfileData({
          userName: '',
          age: '',
          annualIncome: '',
          monthlyExpenses: ''
        });
      }
    }
  }, [userSettings?.value, hasProfileChanges]);

  // --- HANDLERS ---
  
  // Profile Management
  const handleProfileSave = async () => {
    try {
      await db.settings.put({
        key: 'userProfile',
        value: {
          ...userSettings?.value,
          userName: profileData.userName || 'Benutzer',
          age: profileData.age ? parseInt(profileData.age) : null,
          annualIncome: profileData.annualIncome ? parseFloat(profileData.annualIncome) : null,
          monthlyExpenses: profileData.monthlyExpenses ? parseFloat(profileData.monthlyExpenses) : null,
          appName: userSettings?.value?.appName || 'Finance App',
          updatedAt: new Date().toISOString()
        }
      });
      setHasProfileChanges(false);
    } catch (error) {
      console.error('Fehler beim Speichern der Profildaten:', error);
    }
  };

  const handleProfileInputChange = (field, value) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value
    }));
    setHasProfileChanges(true);
  };
  
  // Page Visibility Management
  const handlePageVisibilityToggle = async (pageId) => {
    const currentSettings = pageVisibilitySettings?.value || {};
    
    // Get current visibility (default to true if not set)
    const currentVisibility = currentSettings[pageId] !== false;
    
    const newSettings = {
      ...currentSettings,
      [pageId]: !currentVisibility
    };
    
    try {
      await db.settings.put({
        key: 'pageVisibility',
        value: newSettings
      });
      console.log(`Sichtbarkeit für ${pageId} geändert zu:`, !currentVisibility);
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

  const handleDeleteAllCategories = async () => {
    if (deleteAllCategoriesText !== 'ALLE LÖSCHEN') {
      return;
    }
    
    try {
      // Delete all categories and their associated budgets
      await Promise.all([
        db.categories.clear(),
        db.budgets.clear()
      ]);
      console.log('Alle Kategorien wurden gelöscht.');
      setDeleteAllCategoriesConfirm(false);
      setDeleteAllCategoriesText('');
    } catch (error) {
      console.error('Fehler beim Löschen aller Kategorien:', error);
    }
  };

  const handleCloseDeleteAllCategoriesModal = () => {
    setDeleteAllCategoriesConfirm(false);
    setDeleteAllCategoriesText('');
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

  // Pages Tab Component - Matching Profile Style
  const PagesTab = () => {
    const visibilitySettings = pageVisibilitySettings?.value || {};
    
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold" style={{ color: jonyColors.textPrimary }}>Seiten verwalten</h2>
            <p className="text-sm mt-1" style={{ color: jonyColors.textSecondary }}>Konfiguriere sichtbare Navigation</p>
          </div>
        </div>

        {/* Pages List - Direct Style */}
        <div className="space-y-3">
          {availablePages.map((page) => {
            const Icon = page.icon;
            const isVisible = visibilitySettings[page.id] !== false;
            
            return (
              <div 
                key={page.id} 
                className="flex items-center justify-between p-4 border rounded-xl group transition-colors"
                style={{
                  backgroundColor: jonyColors.cardBackground,
                  border: `1px solid ${jonyColors.border}`
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = jonyColors.surface;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = jonyColors.cardBackground;
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{
                    backgroundColor: jonyColors.accent1Alpha
                  }}>
                    <Icon className="w-4 h-4" style={{ color: jonyColors.accent1 }} />
                  </div>
                  <div>
                    <h3 className="font-medium" style={{ color: jonyColors.textPrimary }}>{page.label}</h3>
                    <p className="text-xs" style={{ color: jonyColors.textSecondary }}>{page.description}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium" style={{
                    color: isVisible ? jonyColors.accent1 : jonyColors.textSecondary
                  }}>
                    {isVisible ? 'Sichtbar' : 'Versteckt'}
                  </span>
                  
                  <button
                    onClick={() => handlePageVisibilityToggle(page.id)}
                    disabled={page.id === 'dashboard'}
                    className="relative inline-flex items-center h-5 w-9 rounded-full transition-colors"
                    style={{
                      backgroundColor: page.id === 'dashboard' 
                        ? jonyColors.border
                        : isVisible 
                          ? jonyColors.accent1
                          : jonyColors.border,
                      opacity: page.id === 'dashboard' ? 0.5 : 1,
                      cursor: page.id === 'dashboard' ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <span
                      className={`inline-block w-3 h-3 transform rounded-full bg-white shadow-sm transition-transform ${
                        isVisible ? 'translate-x-5' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Info Note */}
        <div className="p-4 border rounded-xl" style={{ 
          backgroundColor: jonyColors.cardBackground, 
          border: `1px solid ${jonyColors.border}` 
        }}>
          <p className="text-xs" style={{ color: jonyColors.textSecondary }}>
            Versteckte Seiten sind über die URL erreichbar, aber nicht in der Sidebar sichtbar. Das Dashboard kann nicht versteckt werden.
          </p>
        </div>
      </div>
    );
  };

  // Categories Tab Component - Matching Profile Style
  const CategoriesTab = () => (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: jonyColors.textPrimary }}>Kategorien verwalten</h2>
          <p className="text-sm mt-1" style={{ color: jonyColors.textSecondary }}>Organisiere deine Ausgabenkategorien</p>
        </div>
        <div className="flex items-center gap-3">
          {liveCategories.length > 0 && (
            <button
              onClick={() => setDeleteAllCategoriesConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition-all duration-200"
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
              Alle löschen
            </button>
          )}
          <button
            onClick={() => { setEditingCategory(null); setEditModalOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition-all duration-200"
            style={{ 
              backgroundColor: jonyColors.accent1,
              color: 'black'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'scale(1)';
            }}
          >
            <Plus className="w-4 h-4" />
            Neue Kategorie
          </button>
        </div>
      </div>

      {/* Categories List - Direct Style */}
      <div className="space-y-3">
        {liveCategories.map((category) => (
          <div key={category.id} className="flex items-center justify-between p-4 border rounded-xl group transition-colors"
            style={{
              backgroundColor: jonyColors.cardBackground,
              border: `1px solid ${jonyColors.border}`
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = jonyColors.surface;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = jonyColors.cardBackground;
            }}>
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full" style={{ backgroundColor: category.color }}></div>
              <span className="font-medium" style={{ color: jonyColors.textPrimary }}>{category.name}</span>
            </div>
            
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => handleEditCategory(category)} className="p-2 rounded-lg transition-colors" style={{ 
                backgroundColor: jonyColors.accent1Alpha,
                color: jonyColors.accent1
              }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = jonyColors.accent1;
                  e.target.style.color = 'black';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = jonyColors.accent1Alpha;
                  e.target.style.color = jonyColors.accent1;
                }}
                title="Bearbeiten">
                <Edit className="w-4 h-4" />
              </button>
              <button onClick={() => handleDeleteRequest(category.id)} className="p-2 rounded-lg transition-colors" style={{ 
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
                title="Löschen">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        
        {/* Empty State */}
        {liveCategories.length === 0 && (
          <div className="p-8 text-center border rounded-xl" style={{
            backgroundColor: jonyColors.cardBackground,
            border: `1px solid ${jonyColors.border}`
          }}>
            <div className="text-sm" style={{ color: jonyColors.textSecondary }}>Keine Kategorien vorhanden</div>
          </div>
        )}
      </div>
    </div>
  );

  // Data Tab Component - Matching Profile Style
  const DataTab = () => (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: jonyColors.textPrimary }}>Datenverwaltung</h2>
          <p className="text-sm mt-1" style={{ color: jonyColors.textSecondary }}>Exportiere oder lösche deine Daten</p>
        </div>
      </div>

      {/* Data Actions - Direct Style */}
      <div className="space-y-4">
        {/* Export Action */}
        <div className="flex items-center justify-between p-4 border rounded-xl group transition-colors cursor-pointer"
          style={{
            backgroundColor: jonyColors.cardBackground,
            border: `1px solid ${jonyColors.border}`
          }}
          onClick={handleExportData}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = jonyColors.surface;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = jonyColors.cardBackground;
          }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{
              backgroundColor: jonyColors.accent1Alpha
            }}>
              <Download className="w-4 h-4" style={{ color: jonyColors.accent1 }} />
            </div>
            <div>
              <h3 className="font-medium" style={{ color: jonyColors.textPrimary }}>Backup erstellen</h3>
              <p className="text-xs" style={{ color: jonyColors.textSecondary }}>Exportiere alle deine Finanzdaten</p>
            </div>
          </div>
          <span className="text-xs opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: jonyColors.accent1 }}>
            Klicken zum Exportieren
          </span>
        </div>

        {/* Delete Action */}
        <div className="flex items-center justify-between p-4 border rounded-xl group transition-colors cursor-pointer"
          style={{
            backgroundColor: jonyColors.cardBackground,
            border: `1px solid ${jonyColors.border}`
          }}
          onClick={() => setDeleteAllConfirmOpen(true)}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = jonyColors.redAlpha;
            e.currentTarget.style.borderColor = jonyColors.red;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = jonyColors.cardBackground;
            e.currentTarget.style.borderColor = jonyColors.border;
          }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center group-hover:bg-red-500 transition-colors" style={{
              backgroundColor: jonyColors.redAlpha
            }}>
              <Trash2 className="w-4 h-4 group-hover:text-white transition-colors" style={{ color: jonyColors.red }} />
            </div>
            <div>
              <h3 className="font-medium group-hover:text-red-600 transition-colors" style={{ color: jonyColors.textPrimary }}>Alle Daten löschen</h3>
              <p className="text-xs group-hover:text-red-500 transition-colors" style={{ color: jonyColors.textSecondary }}>Komplett zurücksetzen (unwiderruflich)</p>
            </div>
          </div>
          <span className="text-xs opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: jonyColors.red }}>
            Mit Vorsicht verwenden
          </span>
        </div>
      </div>
    </div>
  );

  // Profile Tab Component - Direct Edit Style
  const ProfileTab = () => (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: jonyColors.textPrimary }}>Profil verwalten</h2>
          <p className="text-sm mt-1" style={{ color: jonyColors.textSecondary }}>Deine persönlichen Finanzdaten</p>
        </div>
        {hasProfileChanges && (
          <button
            onClick={handleProfileSave}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition-all duration-200"
            style={{ 
              backgroundColor: jonyColors.accent1,
              color: 'black'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'scale(1)';
            }}
          >
            <Save className="w-4 h-4" />
            Speichern
          </button>
        )}
      </div>

      {/* Profile Fields - Direct Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* User Name */}
        <div>
          <label className="block text-sm font-semibold mb-2" style={{ color: jonyColors.textPrimary }}>
            Name
          </label>
          <input
            type="text"
            value={profileData.userName || ''}
            onChange={(e) => handleProfileInputChange('userName', e.target.value)}
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
            placeholder="Dein Name"
            autoComplete="off"
            spellCheck="false"
          />
        </div>

        {/* Age */}
        <div>
          <label className="block text-sm font-semibold mb-2" style={{ color: jonyColors.textPrimary }}>
            Alter
          </label>
          <input
            type="number"
            min="18"
            max="120"
            value={profileData.age || ''}
            onChange={(e) => handleProfileInputChange('age', e.target.value)}
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
            placeholder="30"
          />
        </div>

        {/* Annual Income */}
        <div>
          <label className="block text-sm font-semibold mb-2" style={{ color: jonyColors.textPrimary }}>
            Jahreseinkommen
          </label>
          <input
            type="number"
            min="0"
            step="1000"
            value={profileData.annualIncome || ''}
            onChange={(e) => handleProfileInputChange('annualIncome', e.target.value)}
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
            placeholder="50000"
          />
        </div>

        {/* Monthly Expenses */}
        <div>
          <label className="block text-sm font-semibold mb-2" style={{ color: jonyColors.textPrimary }}>
            Monatliche Ausgaben (Ruhestand)
          </label>
          <input
            type="number"
            min="0"
            step="100"
            value={profileData.monthlyExpenses || ''}
            onChange={(e) => handleProfileInputChange('monthlyExpenses', e.target.value)}
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
            placeholder="2500"
          />
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'profile': return <ProfileTab />;
      case 'categories': return <CategoriesTab />;
      case 'pages': return <PagesTab />;
      case 'data': return <DataTab />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen font-sans flex flex-col items-center" style={{ backgroundColor: jonyColors.background, color: jonyColors.textPrimary }}>
      <div className="w-full max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="px-6 py-8 mb-8">
          <div className="grid grid-cols-3 items-center">
            {/* Left: Title */}
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: jonyColors.accent1 }}></div>
              <h1 className="text-3xl font-bold tracking-tight" style={{ color: jonyColors.textPrimary, letterSpacing: '-0.02em' }}>
                Einstellungen
              </h1>
            </div>

            {/* Middle: Empty */}
            <div></div>

            {/* Right: Navigation */}
            <div className="flex justify-end">
              <nav className="flex items-center gap-1">
                {tabs.map((tab, index) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className="relative flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all duration-200"
                      style={{
                        color: isActive ? jonyColors.accent1 : '#ffffff'
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          e.target.style.color = '#ffffff';
                          const icon = e.target.querySelector('svg');
                          if (icon) icon.style.color = '#ffffff';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          e.target.style.color = '#ffffff';
                          const icon = e.target.querySelector('svg');
                          if (icon) icon.style.color = '#ffffff';
                        }
                      }}
                    >
                      <Icon className="w-4 h-4" style={{
                        color: isActive ? jonyColors.accent1 : '#ffffff'
                      }} />
                      <span>{tab.label}</span>
                      {tab.count && (
                        <span 
                          className="ml-1 px-1.5 py-0.5 text-xs font-medium rounded-full"
                          style={{
                            backgroundColor: isActive ? jonyColors.accent1Alpha : jonyColors.cardBackground,
                            color: isActive ? jonyColors.accent1 : '#ffffff'
                          }}
                        >
                          {tab.count}
                        </span>
                      )}
                      
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 mb-12">
          <div className="max-w-7xl mx-auto">
            {renderContent()}
          </div>
        </div>
      </div>

      {/* Modals */}
      <ConfirmationModal isOpen={isConfirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={handleDeleteConfirm} title="Kategorie löschen" message="Möchtest du diese Kategorie wirklich löschen? Zugehörige Budgets werden ebenfalls entfernt." />
{/* Enhanced Delete All Data Modal */}
      {isDeleteAllConfirmOpen && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
          <div className="rounded-2xl shadow-2xl w-full max-w-lg border" style={{ 
            backgroundColor: jonyColors.surface, 
            border: `1px solid ${jonyColors.red}` 
          }}>
            <div className="p-8">
              {/* Header */}
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center shadow-lg" style={{
                  background: `linear-gradient(to bottom right, ${jonyColors.red}, ${jonyColors.redDark})`
                }}>
                  <Trash2 className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold" style={{ color: jonyColors.red }}>Alle Daten löschen?</h2>
                  <p className="text-sm font-medium" style={{ color: jonyColors.red }}>Dieser Vorgang ist unwiderruflich</p>
                </div>
              </div>
              
              {/* Warning Message */}
              <div className="rounded-xl p-4 mb-6 border" style={{ 
                backgroundColor: jonyColors.redAlpha, 
                border: `1px solid ${jonyColors.red}` 
              }}>
                <p className="text-sm leading-relaxed" style={{ color: jonyColors.textPrimary }}>
                  <span className="font-semibold">Warnung:</span> Diese Aktion löscht permanent alle deine:
                </p>
                <ul className="text-sm mt-2 ml-4 space-y-1" style={{ color: jonyColors.textPrimary }}>
                  <li>• Transaktionen und Kategorien</li>
                  <li>• Budgets und Sparziele</li>
                  <li>• Kontakte und geteilte Ausgaben</li>
                  <li>• Alle Einstellungen</li>
                </ul>
              </div>
              
              {/* Confirmation Input */}
              <div className="mb-8">
                <label className="block text-sm font-semibold mb-3" style={{ color: jonyColors.textPrimary }}>
                  Tippe <span className="px-2 py-1 rounded font-mono text-xs" style={{ backgroundColor: jonyColors.redAlpha, color: jonyColors.red }}>LÖSCHEN</span> um zu bestätigen:
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  className="w-full px-4 py-3 border-2 rounded-xl focus:ring-2 font-mono transition-colors"
                  style={{ 
                    backgroundColor: jonyColors.cardBackground,
                    color: jonyColors.textPrimary,
                    borderColor: jonyColors.red,
                    '--tw-ring-color': jonyColors.red
                  }}
                  placeholder="LÖSCHEN"
                />
              </div>
              
              {/* Actions */}
              <div className="flex gap-4">
                <button
                  onClick={handleCloseDeleteModal}
                  className="flex-1 px-6 py-3 rounded-xl font-semibold transition-all duration-200"
                  style={{
                    backgroundColor: jonyColors.cardBackground,
                    color: jonyColors.textSecondary
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
                  onClick={handleDeleteAllData}
                  disabled={deleteConfirmText !== 'LÖSCHEN'}
                  className="flex-1 px-6 py-3 text-white rounded-xl font-bold transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg"
                  style={{
                    background: `linear-gradient(to right, ${jonyColors.red}, ${jonyColors.redDark})`
                  }}
                  onMouseEnter={(e) => {
                    if (!e.target.disabled) {
                      e.target.style.transform = 'scale(1.02)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!e.target.disabled) {
                      e.target.style.transform = 'scale(1)';
                    }
                  }}
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

      {/* Delete All Categories Modal */}
      {deleteAllCategoriesConfirm && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
          <div className="rounded-2xl shadow-2xl w-full max-w-lg border" style={{ 
            backgroundColor: jonyColors.surface, 
            border: `1px solid ${jonyColors.red}` 
          }}>
            <div className="p-8">
              {/* Header */}
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center shadow-lg" style={{
                  background: `linear-gradient(to bottom right, ${jonyColors.red}, ${jonyColors.redDark})`
                }}>
                  <Trash2 className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold" style={{ color: jonyColors.red }}>Alle Kategorien löschen?</h2>
                  <p className="text-sm font-medium" style={{ color: jonyColors.red }}>Dieser Vorgang ist unwiderruflich</p>
                </div>
              </div>
              
              {/* Warning Message */}
              <div className="rounded-xl p-4 mb-6 border" style={{ 
                backgroundColor: jonyColors.redAlpha, 
                border: `1px solid ${jonyColors.red}` 
              }}>
                <p className="text-sm leading-relaxed" style={{ color: jonyColors.textPrimary }}>
                  <span className="font-semibold">Warnung:</span> Diese Aktion löscht permanent alle deine:
                </p>
                <ul className="text-sm mt-2 ml-4 space-y-1" style={{ color: jonyColors.textPrimary }}>
                  <li>• Alle {liveCategories.length} Kategorien</li>
                  <li>• Alle damit verbundenen Budgets</li>
                  <li>• Kategorisierung bestehender Transaktionen geht verloren</li>
                </ul>
              </div>
              
              {/* Confirmation Input */}
              <div className="mb-8">
                <label className="block text-sm font-semibold mb-3" style={{ color: jonyColors.textPrimary }}>
                  Tippe <span className="px-2 py-1 rounded font-mono text-xs" style={{ backgroundColor: jonyColors.redAlpha, color: jonyColors.red }}>ALLE LÖSCHEN</span> um zu bestätigen:
                </label>
                <input
                  type="text"
                  value={deleteAllCategoriesText}
                  onChange={(e) => setDeleteAllCategoriesText(e.target.value)}
                  className="w-full px-4 py-3 border-2 rounded-xl focus:ring-2 font-mono transition-colors"
                  style={{ 
                    backgroundColor: jonyColors.cardBackground,
                    color: jonyColors.textPrimary,
                    borderColor: jonyColors.red,
                    '--tw-ring-color': jonyColors.red
                  }}
                  placeholder="ALLE LÖSCHEN"
                />
              </div>
              
              {/* Actions */}
              <div className="flex gap-4">
                <button
                  onClick={handleCloseDeleteAllCategoriesModal}
                  className="flex-1 px-6 py-3 rounded-xl font-semibold transition-all duration-200"
                  style={{
                    backgroundColor: jonyColors.cardBackground,
                    color: jonyColors.textSecondary
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
                  onClick={handleDeleteAllCategories}
                  disabled={deleteAllCategoriesText !== 'ALLE LÖSCHEN'}
                  className="flex-1 px-6 py-3 text-white rounded-xl font-bold transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg"
                  style={{
                    background: `linear-gradient(to right, ${jonyColors.red}, ${jonyColors.redDark})`
                  }}
                  onMouseEnter={(e) => {
                    if (!e.target.disabled) {
                      e.target.style.transform = 'scale(1.02)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!e.target.disabled) {
                      e.target.style.transform = 'scale(1)';
                    }
                  }}
                >
                  Alle Kategorien löschen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
