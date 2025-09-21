'use client';

import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  Plus, 
  Trash2, 
  ChevronLeft, 
  ChevronRight,
  Calculator,
  Euro,
  Target,
  TrendingUp,
  AlertTriangle,
  PieChart
} from 'lucide-react';
import { db } from '../utils/db';
import { jonyColors } from '../theme';
import AutocompleteCategorySelector from './AutocompleteCategorySelector';

const formatCurrency = (amount) => {
  if (isNaN(amount) || !isFinite(amount)) {
    return '0,00 €';
  }
  return amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
};

const BudgetPage = () => {
  // State management
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInitialBudgetModal, setShowInitialBudgetModal] = useState(false);
  const [showAdjustBudgetModal, setShowAdjustBudgetModal] = useState(false);
  const [newBudget, setNewBudget] = useState({ 
    category: '', 
    amount: '', 
    period: 'monthly', 
    type: 'essentiell' 
  });
  const [initialBudgetData, setInitialBudgetData] = useState({
    monthlyIncome: '',
    essentialBudget: '',
    lifestyleBudget: '',
    savingsBudget: ''
  });
  const [adjustBudgetData, setAdjustBudgetData] = useState({
    monthlyIncome: '',
    essentialBudget: '',
    lifestyleBudget: '',
    savingsBudget: ''
  });

  // Live data queries
  const categories = useLiveQuery(() => db.categories.toArray(), []) || [];
  const budgets = useLiveQuery(() => db.budgets.toArray(), []) || [];
  const transactions = useLiveQuery(() => db.transactions.toArray(), []) || [];

  // Load current monthly income for the selected month
  const currentMonthlyIncomeData = useLiveQuery(async () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const key = `monthlyIncome_${year}_${month.toString().padStart(2, '0')}`;
    return await db.settings.get(key);
  }, [currentDate]);

  // Date calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);

  // Budget calculations
  const budgetData = useMemo(() => {
    return budgets.map(budget => {
      const categoryTransactions = transactions.filter(tx => 
        tx.category === budget.category &&
        new Date(tx.date) >= monthStart &&
        new Date(tx.date) <= monthEnd &&
        tx.amount < 0
      );

      const actualSpent = Math.abs(categoryTransactions.reduce((sum, tx) => sum + tx.amount, 0));
      const remaining = budget.amount - actualSpent;
      const progressPercentage = budget.amount > 0 ? (actualSpent / budget.amount) * 100 : 0;

      const status = remaining < 0 ? 'over' : 
                    progressPercentage > 80 ? 'warning' : 
                    'good';

      return {
        ...budget,
        actualSpent,
        remaining,
        progressPercentage: Math.min(100, progressPercentage),
        status
      };
    });
  }, [budgets, transactions, currentDate]);

  // Summary calculations
  const summary = useMemo(() => {
    const allocatedBudget = budgetData.reduce((sum, item) => sum + item.amount, 0);
    const totalSpent = budgetData.reduce((sum, item) => sum + item.actualSpent, 0);
    const totalBudget = currentMonthlyIncomeData?.value || allocatedBudget;
    const totalRemaining = totalBudget - totalSpent;

    // 50/30/20 breakdown
    const essentialBudget = budgetData.filter(b => b.type === 'essentiell').reduce((sum, b) => sum + b.amount, 0);
    const lifestyleBudget = budgetData.filter(b => b.type === 'lifestyle').reduce((sum, b) => sum + b.amount, 0);
    const savingsBudget = budgetData.filter(b => b.type === 'sparen').reduce((sum, b) => sum + b.amount, 0);

    // Actual spent amounts by category type
    const essentialSpent = budgetData.filter(b => b.type === 'essentiell').reduce((sum, b) => sum + b.actualSpent, 0);
    const lifestyleSpent = budgetData.filter(b => b.type === 'lifestyle').reduce((sum, b) => sum + b.actualSpent, 0);
    const savingsSpent = budgetData.filter(b => b.type === 'sparen').reduce((sum, b) => sum + b.actualSpent, 0);

    const income = totalBudget || 1;
    const essentialPercent = (essentialBudget / income) * 100;
    const lifestylePercent = (lifestyleBudget / income) * 100;
    const savingsPercent = (savingsBudget / income) * 100;

    const is50302oPerfect = essentialPercent <= 50 && lifestylePercent <= 30 && savingsPercent >= 20;

    return {
      totalBudget,
      allocatedBudget,
      totalSpent,
      totalRemaining,
      essentialBudget,
      lifestyleBudget,
      savingsBudget,
      essentialSpent,
      lifestyleSpent,
      savingsSpent,
      essentialPercent,
      lifestylePercent,
      savingsPercent,
      is50302oPerfect,
      income
    };
  }, [budgetData, currentMonthlyIncomeData]);

  // Event handlers
  const goToPreviousMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleCreateBudget = async () => {
    try {
      if (!newBudget.category || !newBudget.amount) return;
      
      await db.budgets.add({
        category: newBudget.category,
        amount: parseFloat(newBudget.amount),
        period: newBudget.period,
        type: newBudget.type,
        createdAt: Date.now()
      });
      
      setNewBudget({ category: '', amount: '', period: 'monthly', type: 'essentiell' });
      setShowCreateModal(false);
    } catch (error) {
      console.error('Error creating budget:', error);
    }
  };

  const handleDeleteBudget = async (budgetId) => {
    try {
      await db.budgets.delete(budgetId);
    } catch (error) {
      console.error('Error deleting budget:', error);
    }
  };

  const handleCreateCategory = async (categoryName) => {
    try {
      const colors = ['#3B82F6', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#EF4444'];
      const newCategory = { 
        name: categoryName, 
        color: colors[Math.floor(Math.random() * colors.length)] 
      };
      await db.categories.add(newCategory);
      setNewBudget(prev => ({ ...prev, category: categoryName }));
      return newCategory;
    } catch (error) { 
      console.error('Error creating category:', error); 
      throw error; 
    }
  };

  const handleCreateInitialBudget = async () => {
    try {
      const income = parseFloat(initialBudgetData.monthlyIncome);
      const essential = parseFloat(initialBudgetData.essentialBudget);
      const lifestyle = parseFloat(initialBudgetData.lifestyleBudget);
      const savings = parseFloat(initialBudgetData.savingsBudget);

      if (!income || income <= 0) {
        alert('Bitte geben Sie ein gültiges Monatseinkommen ein');
        return;
      }

      // Create default budgets
      const budgetsToCreate = [];
      
      if (essential > 0) {
        budgetsToCreate.push({
          category: 'Essentiell',
          amount: essential,
          period: 'monthly',
          type: 'essentiell',
          createdAt: Date.now()
        });
      }

      if (lifestyle > 0) {
        budgetsToCreate.push({
          category: 'Lifestyle',
          amount: lifestyle,
          period: 'monthly',
          type: 'lifestyle',
          createdAt: Date.now()
        });
      }

      if (savings > 0) {
        budgetsToCreate.push({
          category: 'Sparen',
          amount: savings,
          period: 'monthly',
          type: 'sparen',
          createdAt: Date.now()
        });
      }

      // Save budgets
      if (budgetsToCreate.length > 0) {
        await db.budgets.bulkAdd(budgetsToCreate);
      }

      // Save monthly income
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const key = `monthlyIncome_${year}_${month.toString().padStart(2, '0')}`;
      
      await db.settings.put({
        key: key,
        value: income
      });

      // Reset state
      setInitialBudgetData({
        monthlyIncome: '',
        essentialBudget: '',
        lifestyleBudget: '',
        savingsBudget: ''
      });
      setShowInitialBudgetModal(false);
    } catch (error) {
      console.error('Error creating initial budget:', error);
    }
  };

  const handleAddBudgetClick = () => {
    if (budgetData.length === 0) {
      setShowInitialBudgetModal(true);
    } else {
      setShowCreateModal(true);
    }
  };

  const handleAdjustBudgetClick = () => {
    // Pre-populate with current values
    const currentIncome = currentMonthlyIncomeData?.value || 0;
    const essentialBudget = budgetData.find(b => b.type === 'essentiell')?.amount || 0;
    const lifestyleBudget = budgetData.find(b => b.type === 'lifestyle')?.amount || 0;
    const savingsBudget = budgetData.find(b => b.type === 'sparen')?.amount || 0;

    setAdjustBudgetData({
      monthlyIncome: currentIncome.toString(),
      essentialBudget: essentialBudget.toString(),
      lifestyleBudget: lifestyleBudget.toString(),
      savingsBudget: savingsBudget.toString()
    });
    setShowAdjustBudgetModal(true);
  };

  const handleAdjustBudget = async () => {
    try {
      const income = parseFloat(adjustBudgetData.monthlyIncome);
      const essential = parseFloat(adjustBudgetData.essentialBudget);
      const lifestyle = parseFloat(adjustBudgetData.lifestyleBudget);
      const savings = parseFloat(adjustBudgetData.savingsBudget);

      if (!income || income <= 0) {
        alert('Bitte geben Sie ein gültiges Monatseinkommen ein');
        return;
      }

      // Update or create budgets
      const budgetUpdates = [
        { type: 'essentiell', amount: essential, label: 'Essentiell' },
        { type: 'lifestyle', amount: lifestyle, label: 'Lifestyle' },
        { type: 'sparen', amount: savings, label: 'Sparen' }
      ];

      for (const budgetUpdate of budgetUpdates) {
        const existingBudget = budgets.find(b => b.type === budgetUpdate.type);
        
        if (existingBudget && budgetUpdate.amount > 0) {
          // Update existing budget
          await db.budgets.update(existingBudget.id, { amount: budgetUpdate.amount });
        } else if (!existingBudget && budgetUpdate.amount > 0) {
          // Create new budget
          await db.budgets.add({
            category: budgetUpdate.label,
            amount: budgetUpdate.amount,
            period: 'monthly',
            type: budgetUpdate.type,
            createdAt: Date.now()
          });
        } else if (existingBudget && budgetUpdate.amount <= 0) {
          // Delete budget if amount is 0 or negative
          await db.budgets.delete(existingBudget.id);
        }
      }

      // Update monthly income
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const key = `monthlyIncome_${year}_${month.toString().padStart(2, '0')}`;
      
      await db.settings.put({
        key: key,
        value: income
      });

      // Reset state
      setAdjustBudgetData({
        monthlyIncome: '',
        essentialBudget: '',
        lifestyleBudget: '',
        savingsBudget: ''
      });
      setShowAdjustBudgetModal(false);
    } catch (error) {
      console.error('Error adjusting budget:', error);
    }
  };

  return (
    <div className="min-h-screen font-sans" style={{ 
      backgroundColor: jonyColors.background, 
      color: jonyColors.textPrimary 
    }}>
      {/* Header */}
      <div className="px-6 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: jonyColors.accent1 }}></div>
              <h1 className="text-3xl font-bold tracking-tight" style={{ color: jonyColors.textPrimary, letterSpacing: '-0.02em' }}>
                Budget
              </h1>
              <div className="px-3 py-1 rounded-full font-semibold text-sm" style={{ 
                backgroundColor: jonyColors.accent1Alpha, 
                color: jonyColors.accent1 
              }}>
                {budgetData.length}
              </div>
            </div>

            {/* Month Navigation */}
            <div className="flex items-center gap-3">
              <button
                onClick={goToPreviousMonth}
                className="p-3 rounded-full transition-all duration-200 hover:scale-105"
                style={{ 
                  backgroundColor: jonyColors.cardBackground, 
                  color: jonyColors.textSecondary 
                }}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="font-semibold text-center text-xl" style={{ 
                color: jonyColors.textPrimary, 
                minWidth: '200px' 
              }}>
                {currentDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
              </div>
              <button
                onClick={goToNextMonth}
                className="p-3 rounded-full transition-all duration-200 hover:scale-105"
                style={{ 
                  backgroundColor: jonyColors.cardBackground, 
                  color: jonyColors.textSecondary 
                }}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Main Content */}
          {budgetData.length > 0 ? (
            <div className="space-y-6">
              {/* Budget Metric Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Total Budget - Clickable */}
                <div 
                  onClick={handleAdjustBudgetClick}
                  className="p-6 rounded-2xl border flex items-center justify-center text-center h-32 cursor-pointer" 
                  style={{
                    backgroundColor: jonyColors.surface,
                    border: `1px solid ${jonyColors.border}`
                  }}
                >
                  <div>
                    <div className="text-xs mb-2" style={{ color: jonyColors.textSecondary }}>
                      Budget
                    </div>
                    <div className="text-2xl font-bold" style={{ color: jonyColors.textPrimary }}>
                      {formatCurrency(summary.totalBudget)}
                    </div>
                  </div>
                </div>

                {/* Essentiell */}
                <div className="p-6 rounded-2xl border flex items-center justify-center text-center h-32" style={{
                  backgroundColor: jonyColors.surface,
                  border: `1px solid ${jonyColors.border}`
                }}>
                  <div>
                    <div className="text-xs mb-2" style={{ color: jonyColors.textSecondary }}>
                      Essentiell
                    </div>
                    <div className="text-lg font-bold" style={{ color: jonyColors.accent1 }}>
                      {formatCurrency(summary.essentialSpent)} / {formatCurrency(summary.essentialBudget)}
                    </div>
                  </div>
                </div>

                {/* Lifestyle */}
                <div className="p-6 rounded-2xl border flex items-center justify-center text-center h-32" style={{
                  backgroundColor: jonyColors.surface,
                  border: `1px solid ${jonyColors.border}`
                }}>
                  <div>
                    <div className="text-xs mb-2" style={{ color: jonyColors.textSecondary }}>
                      Lifestyle
                    </div>
                    <div className="text-lg font-bold" style={{ color: jonyColors.magenta }}>
                      {formatCurrency(summary.lifestyleSpent)} / {formatCurrency(summary.lifestyleBudget)}
                    </div>
                  </div>
                </div>

                {/* Sparen */}
                <div className="p-6 rounded-2xl border flex items-center justify-center text-center h-32" style={{
                  backgroundColor: jonyColors.surface,
                  border: `1px solid ${jonyColors.border}`
                }}>
                  <div>
                    <div className="text-xs mb-2" style={{ color: jonyColors.textSecondary }}>
                      Sparen
                    </div>
                    <div className="text-lg font-bold" style={{ color: jonyColors.accent2 }}>
                      {formatCurrency(summary.savingsSpent)} / {formatCurrency(summary.savingsBudget)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Budget Items - Minimalistic */}
              <div className="space-y-2">
                {budgetData.filter(budget => !['Essentiell', 'Lifestyle', 'Sparen'].includes(budget.category)).map((budget) => (
                  <div key={budget.id} className="group p-4 rounded-xl border" style={{
                    backgroundColor: jonyColors.surface,
                    border: `1px solid ${jonyColors.border}`
                  }}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold" style={{ color: jonyColors.textPrimary }}>
                            {budget.category}
                          </h4>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-bold" style={{ 
                              color: budget.status === 'over' ? jonyColors.magenta :
                                     budget.status === 'warning' ? jonyColors.magenta :
                                     jonyColors.accent1
                            }}>
                              {Math.round(budget.progressPercentage)}%
                            </span>
                            <button
                              onClick={() => handleDeleteBudget(budget.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1"
                              style={{ color: jonyColors.magenta }}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs" style={{ color: jonyColors.textSecondary }}>
                            {formatCurrency(budget.actualSpent)} / {formatCurrency(budget.amount)}
                          </span>
                        </div>
                        
                        <div className="w-full rounded-full h-1" style={{ backgroundColor: jonyColors.border }}>
                          <div 
                            className="h-1 rounded-full"
                            style={{ 
                              width: `${Math.min(100, budget.progressPercentage)}%`,
                              backgroundColor: budget.status === 'over' ? jonyColors.magenta :
                                             budget.status === 'warning' ? jonyColors.magenta :
                                             budget.type === 'essentiell' ? jonyColors.accent1 :
                                             budget.type === 'lifestyle' ? jonyColors.magenta :
                                             budget.type === 'sparen' ? jonyColors.accent2 :
                                             jonyColors.accent1
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Savings Goals Section */}
              <div className="mt-8">
                <h2 className="text-xl font-bold mb-4" style={{ color: jonyColors.textPrimary }}>
                  Sparziele
                </h2>
                
                {/* Empty State for Savings Goals */}
                <div className="flex items-center justify-center py-16">
                  <div className="text-center p-12 rounded-3xl border-2" style={{
                    backgroundColor: jonyColors.surface,
                    border: `2px solid ${jonyColors.border}`,
                    width: '400px',
                    minHeight: '300px'
                  }}>
                    <div className="w-24 h-24 rounded-3xl mx-auto mb-8 flex items-center justify-center shadow-xl" style={{
                      backgroundColor: jonyColors.accent2
                    }}>
                      <Target className="w-12 h-12" style={{ color: jonyColors.background }} />
                    </div>
                    <h2 className="text-3xl font-black mb-4" style={{ color: jonyColors.textPrimary }}>
                      Noch keine Sparziele!
                    </h2>
                    <p className="text-lg leading-relaxed" style={{ color: jonyColors.textSecondary }}>
                      Erstelle dein erstes Sparziel und arbeite auf deine Träume hin.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Empty State */
            <div className="flex items-center justify-center py-16">
              <div className="text-center p-12 rounded-3xl border-2" style={{
                backgroundColor: jonyColors.surface,
                border: `2px solid ${jonyColors.border}`,
                width: '400px'
              }}>
                <div className="w-24 h-24 rounded-3xl mx-auto mb-8 flex items-center justify-center" style={{
                  backgroundColor: jonyColors.accent1
                }}>
                  <Calculator className="w-12 h-12" style={{ color: jonyColors.background }} />
                </div>
                <h2 className="text-3xl font-bold mb-4" style={{ color: jonyColors.textPrimary }}>
                  Budgetplanung starten!
                </h2>
                <p className="text-lg" style={{ color: jonyColors.textSecondary }}>
                  Erstelle dein erstes Budget und behalte deine Ausgaben im Blick.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating Action Button */}
      <button
        onClick={handleAddBudgetClick}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl hover:scale-110 z-50"
        style={{ backgroundColor: jonyColors.accent1, color: jonyColors.background }}
        title="Neues Budget"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Create Budget Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="rounded-2xl max-w-sm w-full p-4 shadow-xl" style={{ backgroundColor: jonyColors.surface }}>
            <h2 className="text-lg font-medium mb-4" style={{ color: jonyColors.textPrimary }}>
              Neues Budget
            </h2>
            
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: jonyColors.textSecondary }}>
                  Kategorie
                </label>
                <AutocompleteCategorySelector
                  categories={categories}
                  selected={newBudget.category}
                  onSelect={(categoryName) => setNewBudget(prev => ({ ...prev, category: categoryName }))}
                  onCreateCategory={handleCreateCategory}
                  defaultValue={newBudget.category}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: jonyColors.textSecondary }}>
                  Betrag
                </label>
                <div className="relative">
                  <Euro className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: jonyColors.textTertiary }} />
                  <input
                    type="number"
                    value={newBudget.amount}
                    onChange={(e) => setNewBudget(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="500.00"
                    className="w-full pl-12 pr-4 py-3 rounded-xl text-base transition-all duration-200"
                    style={{
                      backgroundColor: jonyColors.cardBackground,
                      color: jonyColors.textPrimary,
                      border: `1px solid ${jonyColors.border}`,
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: jonyColors.textSecondary }}>
                  Typ
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'essentiell', label: 'Essentiell', color: jonyColors.accent1 },
                    { key: 'lifestyle', label: 'Lifestyle', color: jonyColors.magenta },
                    { key: 'sparen', label: 'Sparen', color: jonyColors.accent2 }
                  ].map(type => (
                    <button
                      key={type.key}
                      type="button"
                      onClick={() => setNewBudget(prev => ({ ...prev, type: type.key }))}
                      className="px-2 py-2 text-xs rounded-lg border transition-colors"
                      style={{
                        backgroundColor: newBudget.type === type.key ? jonyColors.cardBackground : jonyColors.surface,
                        borderColor: newBudget.type === type.key ? type.color : jonyColors.border,
                        color: newBudget.type === type.key ? type.color : jonyColors.textSecondary
                      }}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-3 rounded-lg text-sm transition-colors"
                style={{ 
                  backgroundColor: jonyColors.cardBackground, 
                  color: jonyColors.textSecondary,
                  paddingTop: '15px',
                  paddingBottom: '15px'
                }}
              >
                Abbrechen
              </button>
              <button
                onClick={handleCreateBudget}
                disabled={!newBudget.category || !newBudget.amount}
                className="flex-1 px-3 rounded-lg text-sm transition-colors disabled:opacity-50"
                style={{ 
                  backgroundColor: jonyColors.accent1, 
                  color: jonyColors.background,
                  paddingTop: '15px',
                  paddingBottom: '15px'
                }}
              >
                Erstellen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Initial Budget Setup Modal */}
      {showInitialBudgetModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="rounded-2xl max-w-md w-full p-6 shadow-xl" style={{ backgroundColor: jonyColors.surface }}>
            <h2 className="text-xl font-bold mb-2" style={{ color: jonyColors.textPrimary }}>
              Budget einrichten
            </h2>
            <p className="text-sm mb-6" style={{ color: jonyColors.textSecondary }}>
              Lassen Sie uns Ihr erstes monatliches Budget nach der 50/30/20 Regel einrichten.
            </p>
            
            <div className="space-y-4">
              {/* Monthly Income */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: jonyColors.textPrimary }}>
                  Monatliches Nettoeinkommen
                </label>
                <div className="relative">
                  <Euro className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: jonyColors.textTertiary }} />
                  <input
                    type="number"
                    value={initialBudgetData.monthlyIncome}
                    onChange={(e) => {
                      const income = parseFloat(e.target.value) || 0;
                      setInitialBudgetData(prev => ({
                        ...prev,
                        monthlyIncome: e.target.value,
                        essentialBudget: income > 0 ? (income * 0.5).toString() : '',
                        lifestyleBudget: income > 0 ? (income * 0.3).toString() : '',
                        savingsBudget: income > 0 ? (income * 0.2).toString() : ''
                      }));
                    }}
                    placeholder="3000.00"
                    className="w-full pl-12 pr-4 py-3 rounded-xl text-base transition-all duration-200"
                    style={{
                      backgroundColor: jonyColors.cardBackground,
                      color: jonyColors.textPrimary,
                      border: `1px solid ${jonyColors.border}`,
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              {/* 50/30/20 Breakdown */}
              <div className="grid grid-cols-1 gap-3">
                {/* Essential 50% */}
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: jonyColors.textPrimary }}>
                    <span style={{ color: jonyColors.accent1 }}>Essentiell (50%)</span> - Miete, Lebensmittel, Transport
                  </label>
                  <div className="relative">
                    <Euro className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: jonyColors.textTertiary }} />
                    <input
                      type="number"
                      value={initialBudgetData.essentialBudget}
                      onChange={(e) => setInitialBudgetData(prev => ({ ...prev, essentialBudget: e.target.value }))}
                      placeholder="1500.00"
                      className="w-full pl-12 pr-4 py-2 rounded-lg text-sm transition-all duration-200"
                      style={{
                        backgroundColor: jonyColors.cardBackground,
                        color: jonyColors.textPrimary,
                        border: `1px solid ${jonyColors.accent1}40`,
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>

                {/* Lifestyle 30% */}
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: jonyColors.textPrimary }}>
                    <span style={{ color: jonyColors.magenta }}>Lifestyle (30%)</span> - Entertainment, Hobbys, Shopping
                  </label>
                  <div className="relative">
                    <Euro className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: jonyColors.textTertiary }} />
                    <input
                      type="number"
                      value={initialBudgetData.lifestyleBudget}
                      onChange={(e) => setInitialBudgetData(prev => ({ ...prev, lifestyleBudget: e.target.value }))}
                      placeholder="900.00"
                      className="w-full pl-12 pr-4 py-2 rounded-lg text-sm transition-all duration-200"
                      style={{
                        backgroundColor: jonyColors.cardBackground,
                        color: jonyColors.textPrimary,
                        border: `1px solid ${jonyColors.magenta}40`,
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>

                {/* Savings 20% */}
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: jonyColors.textPrimary }}>
                    <span style={{ color: jonyColors.accent2 }}>Sparen (20%)</span> - Notgroschen, Investments, Rente
                  </label>
                  <div className="relative">
                    <Euro className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: jonyColors.textTertiary }} />
                    <input
                      type="number"
                      value={initialBudgetData.savingsBudget}
                      onChange={(e) => setInitialBudgetData(prev => ({ ...prev, savingsBudget: e.target.value }))}
                      placeholder="600.00"
                      className="w-full pl-12 pr-4 py-2 rounded-lg text-sm transition-all duration-200"
                      style={{
                        backgroundColor: jonyColors.cardBackground,
                        color: jonyColors.textPrimary,
                        border: `1px solid ${jonyColors.accent2}40`,
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>
              </div>

            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowInitialBudgetModal(false)}
                className="flex-1 px-4 rounded-lg text-sm transition-colors"
                style={{ 
                  backgroundColor: jonyColors.cardBackground, 
                  color: jonyColors.textSecondary,
                  paddingTop: '15px',
                  paddingBottom: '15px'
                }}
              >
                Abbrechen
              </button>
              <button
                onClick={handleCreateInitialBudget}
                disabled={!initialBudgetData.monthlyIncome || parseFloat(initialBudgetData.monthlyIncome) <= 0}
                className="flex-1 px-4 rounded-lg text-sm transition-colors disabled:opacity-50"
                style={{ 
                  backgroundColor: jonyColors.accent1, 
                  color: jonyColors.background,
                  paddingTop: '15px',
                  paddingBottom: '15px'
                }}
              >
                Budget erstellen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Adjust Budget Modal */}
      {showAdjustBudgetModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="rounded-2xl max-w-md w-full p-6 shadow-xl" style={{ backgroundColor: jonyColors.surface }}>
            <h2 className="text-xl font-bold mb-2" style={{ color: jonyColors.textPrimary }}>
              Budget anpassen
            </h2>
            <p className="text-sm mb-6" style={{ color: jonyColors.textSecondary }}>
              Passen Sie Ihr Budget für {currentDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })} an.
            </p>
            
            <div className="space-y-4">
              {/* Monthly Income */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: jonyColors.textPrimary }}>
                  Monatliches Nettoeinkommen
                </label>
                <div className="relative">
                  <Euro className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: jonyColors.textTertiary }} />
                  <input
                    type="number"
                    value={adjustBudgetData.monthlyIncome}
                    onChange={(e) => {
                      const income = parseFloat(e.target.value) || 0;
                      setAdjustBudgetData(prev => ({
                        ...prev,
                        monthlyIncome: e.target.value,
                        essentialBudget: income > 0 && !prev.essentialBudget ? (income * 0.5).toString() : prev.essentialBudget,
                        lifestyleBudget: income > 0 && !prev.lifestyleBudget ? (income * 0.3).toString() : prev.lifestyleBudget,
                        savingsBudget: income > 0 && !prev.savingsBudget ? (income * 0.2).toString() : prev.savingsBudget
                      }));
                    }}
                    placeholder="3000.00"
                    className="w-full pl-12 pr-4 py-3 rounded-xl text-base transition-all duration-200"
                    style={{
                      backgroundColor: jonyColors.cardBackground,
                      color: jonyColors.textPrimary,
                      border: `1px solid ${jonyColors.border}`,
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              {/* 50/30/20 Breakdown */}
              <div className="grid grid-cols-1 gap-3">
                {/* Essential 50% */}
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: jonyColors.textPrimary }}>
                    <span style={{ color: jonyColors.accent1 }}>Essentiell (50%)</span> - Miete, Lebensmittel, Transport
                  </label>
                  <div className="relative">
                    <Euro className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: jonyColors.textTertiary }} />
                    <input
                      type="number"
                      value={adjustBudgetData.essentialBudget}
                      onChange={(e) => setAdjustBudgetData(prev => ({ ...prev, essentialBudget: e.target.value }))}
                      placeholder="1500.00"
                      className="w-full pl-12 pr-4 py-2 rounded-lg text-sm transition-all duration-200"
                      style={{
                        backgroundColor: jonyColors.cardBackground,
                        color: jonyColors.textPrimary,
                        border: `1px solid ${jonyColors.accent1}40`,
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>

                {/* Lifestyle 30% */}
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: jonyColors.textPrimary }}>
                    <span style={{ color: jonyColors.magenta }}>Lifestyle (30%)</span> - Entertainment, Hobbys, Shopping
                  </label>
                  <div className="relative">
                    <Euro className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: jonyColors.textTertiary }} />
                    <input
                      type="number"
                      value={adjustBudgetData.lifestyleBudget}
                      onChange={(e) => setAdjustBudgetData(prev => ({ ...prev, lifestyleBudget: e.target.value }))}
                      placeholder="900.00"
                      className="w-full pl-12 pr-4 py-2 rounded-lg text-sm transition-all duration-200"
                      style={{
                        backgroundColor: jonyColors.cardBackground,
                        color: jonyColors.textPrimary,
                        border: `1px solid ${jonyColors.magenta}40`,
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>

                {/* Savings 20% */}
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: jonyColors.textPrimary }}>
                    <span style={{ color: jonyColors.accent2 }}>Sparen (20%)</span> - Notgroschen, Investments, Rente
                  </label>
                  <div className="relative">
                    <Euro className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: jonyColors.textTertiary }} />
                    <input
                      type="number"
                      value={adjustBudgetData.savingsBudget}
                      onChange={(e) => setAdjustBudgetData(prev => ({ ...prev, savingsBudget: e.target.value }))}
                      placeholder="600.00"
                      className="w-full pl-12 pr-4 py-2 rounded-lg text-sm transition-all duration-200"
                      style={{
                        backgroundColor: jonyColors.cardBackground,
                        color: jonyColors.textPrimary,
                        border: `1px solid ${jonyColors.accent2}40`,
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAdjustBudgetModal(false)}
                className="flex-1 px-4 rounded-lg text-sm transition-colors"
                style={{ 
                  backgroundColor: jonyColors.cardBackground, 
                  color: jonyColors.textSecondary,
                  paddingTop: '15px',
                  paddingBottom: '15px'
                }}
              >
                Abbrechen
              </button>
              <button
                onClick={handleAdjustBudget}
                disabled={!adjustBudgetData.monthlyIncome || parseFloat(adjustBudgetData.monthlyIncome) <= 0}
                className="flex-1 px-4 rounded-lg text-sm transition-colors disabled:opacity-50"
                style={{ 
                  backgroundColor: jonyColors.accent1, 
                  color: jonyColors.background,
                  paddingTop: '15px',
                  paddingBottom: '15px'
                }}
              >
                Budget aktualisieren
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BudgetPage;