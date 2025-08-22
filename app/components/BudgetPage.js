'use client';

import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  Calculator, 
  Target, 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  Edit, 
  Trash2, 
  ChevronLeft, 
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  Calendar,
  Euro,
  BarChart3
} from 'lucide-react';
import Card from './ui/Card';
import { db } from '../utils/db';

const formatCurrency = (amount) => amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

const BudgetPage = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [newBudget, setNewBudget] = useState({ category: '', amount: '', period: 'monthly' });
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [monthlyIncomeInput, setMonthlyIncomeInput] = useState('');

  // Load monthly income from database
  const monthlyIncomeData = useLiveQuery(async () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const key = `monthlyIncome_${year}_${month.toString().padStart(2, '0')}`;
    return await db.settings.get(key);
  }, [currentDate]);

  const currentMonthlyIncome = monthlyIncomeData?.value || 0;

  // Live data
  const categories = useLiveQuery(() => db.categories.toArray(), []) || [];
  const budgets = useLiveQuery(() => db.budgets.toArray(), []) || [];
  const transactions = useLiveQuery(() => db.transactions.toArray(), []) || [];

  // Navigation functions
  const goToPreviousMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  // Budget calculations
  const budgetData = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);

    return budgets.map(budget => {
      // Calculate actual spending for this category this month
      const categoryTransactions = transactions.filter(tx => 
        tx.category === budget.category &&
        new Date(tx.date) >= monthStart &&
        new Date(tx.date) <= monthEnd &&
        tx.amount < 0 // Only expenses
      );

      const actualSpent = Math.abs(categoryTransactions.reduce((sum, tx) => sum + tx.amount, 0));
      const budgetAmount = budget.amount;
      const remaining = budgetAmount - actualSpent;
      const progressPercentage = budgetAmount > 0 ? (actualSpent / budgetAmount) * 100 : 0;

      const status = remaining < 0 ? 'over' : 
                    progressPercentage > 80 ? 'warning' : 
                    'good';

      return {
        ...budget,
        actualSpent,
        remaining,
        progressPercentage: Math.min(100, progressPercentage),
        status,
        transactionCount: categoryTransactions.length
      };
    });
  }, [budgets, transactions, currentDate]);

  // Summary calculations
  const summary = useMemo(() => {
    const totalBudget = budgetData.reduce((sum, item) => sum + item.amount, 0);
    const totalSpent = budgetData.reduce((sum, item) => sum + item.actualSpent, 0);
    const totalRemaining = totalBudget - totalSpent;
    const overBudgetCount = budgetData.filter(item => item.status === 'over').length;
    const warningCount = budgetData.filter(item => item.status === 'warning').length;

    return {
      totalBudget,
      totalSpent,
      totalRemaining,
      overBudgetCount,
      warningCount,
      overallProgress: totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0
    };
  }, [budgetData]);

  const handleCreateBudget = async () => {
    try {
      await db.budgets.add({
        category: newBudget.category,
        amount: parseFloat(newBudget.amount),
        period: newBudget.period,
        createdAt: Date.now()
      });
      setNewBudget({ category: '', amount: '', period: 'monthly' });
      setShowCreateModal(false);
    } catch (error) {
      console.error('Error creating budget:', error);
    }
  };

  const handleEditBudget = async (budget) => {
    try {
      await db.budgets.update(budget.id, {
        amount: parseFloat(budget.amount),
        period: budget.period
      });
      setEditingBudget(null);
    } catch (error) {
      console.error('Error updating budget:', error);
    }
  };

  const handleDeleteBudget = async (budgetId) => {
    try {
      await db.budgets.delete(budgetId);
    } catch (error) {
      console.error('Error deleting budget:', error);
    }
  };

  const handleSaveIncome = async () => {
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const key = `monthlyIncome_${year}_${month.toString().padStart(2, '0')}`;
      
      await db.settings.put({
        key: key,
        value: parseFloat(monthlyIncomeInput) || 0
      });
      
      setShowIncomeModal(false);
      setMonthlyIncomeInput('');
    } catch (error) {
      console.error('Error saving monthly income:', error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'over': return 'bg-red-500';
      case 'warning': return 'bg-yellow-500';
      default: return 'bg-green-500';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'over': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'warning': return <TrendingUp className="w-4 h-4 text-yellow-500" />;
      default: return <CheckCircle className="w-4 h-4 text-green-500" />;
    }
  };

  const availableCategories = categories.filter(cat => 
    !budgets.some(budget => budget.category === cat.name)
  );

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 font-sans text-slate-800 dark:text-slate-200 p-4 sm:p-6 md:p-8 flex flex-col items-center">
      <div className="w-full max-w-7xl mx-auto">
        {/* ## Page Header mit Grid-Layout ## */}
        <header className="mb-8">
          <div className="grid grid-cols-3 items-center">
            {/* Linke Spalte: Titel */}
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Budget</h1>
              <div className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-sm rounded-full">
                {budgetData.length}
              </div>
            </div>

            {/* Mittlere Spalte: Monats-Toggle, zentriert */}
            <div className="flex items-center justify-center">
              <div className="flex items-center gap-3">
                <button
                  onClick={goToPreviousMonth}
                  className="bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-200 p-3 rounded-full transition-colors"
                  title="Vorheriger Monat"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="px-4 py-2 min-w-[180px] text-center">
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-2xl tracking-wide">
                    {currentDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
                  </span>
                </div>
                <button
                  onClick={goToNextMonth}
                  className="bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-200 p-3 rounded-full transition-colors"
                  title="Nächster Monat"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Rechte Spalte: Buttons, ausgerichtet am Ende */}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setMonthlyIncomeInput(currentMonthlyIncome.toString());
                  setShowIncomeModal(true);
                }}
                className="flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-700 dark:to-indigo-700 hover:from-purple-700 hover:to-indigo-700 dark:hover:from-purple-600 dark:hover:to-indigo-600 text-white rounded-lg transition-all duration-300 ease-in-out font-medium shadow-lg hover:shadow-xl py-3 px-6 text-base"
              >
                <Euro className="w-5 h-5" />
                <span className="hidden sm:inline">Einkommen</span>
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-700 dark:to-purple-700 hover:from-indigo-700 hover:to-purple-700 dark:hover:from-indigo-600 dark:hover:to-purple-600 text-white rounded-lg transition-all duration-300 ease-in-out font-medium shadow-lg hover:shadow-xl py-3 px-6 text-base"
              >
                <Plus className="w-5 h-5" />
                <span className="hidden sm:inline">Neues Budget</span>
              </button>
            </div>
          </div>
        </header>

        {/* Monthly Income Overview */}
        {currentMonthlyIncome > 0 && (
          <Card className="mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <Euro className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-1">Monatseinkommen</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                    Geplant für {currentDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                  {formatCurrency(currentMonthlyIncome)}
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                  Gesamtbudget: {formatCurrency(summary.totalBudget)}
                </div>
              </div>
            </div>
            
            {/* Income vs Budget Bar */}
            <div className="mt-6">
              <div className="flex justify-between text-sm text-slate-600 dark:text-slate-300 mb-2">
                <span className="font-semibold">Budget Aufteilung</span>
                <span className="font-bold">
                  {summary.totalBudget > 0 ? ((summary.totalBudget / currentMonthlyIncome) * 100).toFixed(1) : 0}% zugeteilt
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 shadow-inner">
                <div 
                  className="h-3 rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 transition-all duration-700 shadow-sm"
                  style={{ width: `${Math.min(100, (summary.totalBudget / currentMonthlyIncome) * 100)}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-1">
                <span>Verbleibendes Einkommen: {formatCurrency(Math.max(0, currentMonthlyIncome - summary.totalBudget))}</span>
                <span>Zugeteilt: {formatCurrency(summary.totalBudget)}</span>
              </div>
            </div>
          </Card>
        )}
        
        {/* Budget Overview */}
        <Card className="relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <BarChart3 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-1">Budget Übersicht</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Deine monatlichen Budgets im Überblick</p>
                </div>
              </div>
              
              {(summary.overBudgetCount > 0 || summary.warningCount > 0) && (
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-3 shadow-sm">
                  <div className="flex items-center gap-4 text-sm">
                    {summary.overBudgetCount > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500"/>
                        <span className="font-medium text-slate-700 dark:text-slate-300">{summary.overBudgetCount} überschritten</span>
                      </div>
                    )}
                    {summary.warningCount > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-yellow-500"/>
                        <span className="font-medium text-slate-700 dark:text-slate-300">{summary.warningCount} Warnung</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

        {budgetData.length > 0 ? (
          <div className="space-y-6">
            {budgetData.map((budget) => (
              <div key={budget.id} className="group relative p-6 rounded-2xl transition-all duration-300 bg-gradient-to-br from-white/90 to-slate-50/90 dark:from-slate-800/90 dark:to-slate-900/90 backdrop-blur-sm border border-white/60 dark:border-slate-700/60 hover:scale-[1.01] hover:border-indigo-200 dark:hover:border-indigo-700/50">
                {/* Header Row */}
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${
                      budget.status === 'over' ? 'bg-gradient-to-br from-red-500 to-red-600' :
                      budget.status === 'warning' ? 'bg-gradient-to-br from-yellow-500 to-orange-500' :
                      'bg-gradient-to-br from-purple-500 to-indigo-600'
                    }`}>
                      <Target className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-bold text-xl text-slate-800 dark:text-slate-200">
                          {budget.category}
                        </h3>
                        <div className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          budget.status === 'over' ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300' :
                          budget.status === 'warning' ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300' :
                          'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
                        }`}>
                          {budget.status === 'over' ? 'Überschritten' :
                           budget.status === 'warning' ? 'Warnung' : 'Im Rahmen'}
                        </div>
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                        {budget.transactionCount} Transaktionen in diesem Monat
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button
                      onClick={() => setEditingBudget(budget)}
                      className="btn-icon bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/70 hover:scale-105 transition-all duration-200"
                      title="Bearbeiten"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteBudget(budget.id)}
                      className="btn-icon bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/70 hover:scale-105 transition-all duration-200"
                      title="Löschen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Amount Row */}
                <div className="grid grid-cols-2 gap-6 mb-6">
                  <div className="bg-white/50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200/50 dark:border-slate-700/50">
                    <div className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-1">
                      {formatCurrency(budget.actualSpent)}
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                      von {formatCurrency(budget.amount)} ausgegeben
                    </div>
                  </div>
                  
                  <div className="bg-white/50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200/50 dark:border-slate-700/50">
                    <div className={`text-2xl font-bold mb-1 ${budget.remaining >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {budget.remaining >= 0 ? '+' : ''}{formatCurrency(budget.remaining)}
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                      {budget.remaining >= 0 ? 'verbleibt' : 'überschritten'}
                    </div>
                  </div>
                </div>

                {/* Dual Progress Bars */}
                <div className="space-y-4">
                  {/* Budget Allocation vs Income */}
                  {currentMonthlyIncome > 0 && (
                    <div className="bg-white/50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200/50 dark:border-slate-700/50">
                      <div className="flex justify-between text-sm text-slate-600 dark:text-slate-300 mb-3">
                        <span className="font-semibold">Budget aus Einkommen</span>
                        <span className="font-bold">
                          {((budget.amount / currentMonthlyIncome) * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 shadow-inner">
                        <div 
                          className="h-3 rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 transition-all duration-700 shadow-sm"
                          style={{ width: `${Math.min(100, (budget.amount / currentMonthlyIncome) * 100)}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-1">
                        <span>Budget: {formatCurrency(budget.amount)}</span>
                        <span>von {formatCurrency(currentMonthlyIncome)} Einkommen</span>
                      </div>
                    </div>
                  )}
                  
                  {/* Actual Spending Progress */}
                  <div className="bg-white/50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200/50 dark:border-slate-700/50">
                    <div className="flex justify-between text-sm text-slate-600 dark:text-slate-300 mb-3">
                      <span className="font-semibold">Ausgaben Fortschritt</span>
                      <span className="font-bold">{budget.progressPercentage.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 shadow-inner">
                      <div 
                        className={`h-3 rounded-full transition-all duration-700 shadow-sm ${
                          budget.status === 'over' ? 'bg-gradient-to-r from-red-500 to-red-600' :
                          budget.status === 'warning' ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
                          'bg-gradient-to-r from-purple-500 to-indigo-600'
                        }`}
                        style={{ width: `${Math.min(100, budget.progressPercentage)}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-1">
                      <span>Ausgegeben: {formatCurrency(budget.actualSpent)}</span>
                      <span>Budget: {formatCurrency(budget.amount)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center py-16">
            <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-3xl border border-white/60 dark:border-slate-700/60 p-12 shadow-lg text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                <Calculator className="w-8 h-8 text-white" />
              </div>
              <h4 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-3">Noch keine Budgets</h4>
              <p className="text-slate-500 dark:text-slate-400 font-medium mb-6 max-w-sm">
                Erstelle dein erstes Budget um deine Ausgaben zu verfolgen und bessere Kontrolle über deine Finanzen zu haben
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                Erstes Budget erstellen
              </button>
            </div>
          </div>
        )}
          </div>
        </Card>

      {/* Create Budget Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-3xl max-w-lg w-full p-8 shadow-2xl border border-white/20 dark:border-slate-700/50">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Plus className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Neues Budget erstellen</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Setze ein Ausgabenlimit für eine Kategorie</p>
              </div>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                  Kategorie
                </label>
                <div className="relative">
                  <select
                    value={newBudget.category}
                    onChange={(e) => setNewBudget(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white/80 dark:bg-slate-700/80 text-slate-800 dark:text-slate-200 text-base font-medium transition-all duration-200"
                  >
                    <option value="">Kategorie auswählen</option>
                    {availableCategories.map(cat => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                  Budget Betrag
                </label>
                <div className="relative">
                  <Euro className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="number"
                    value={newBudget.amount}
                    onChange={(e) => setNewBudget(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="500.00"
                    className="w-full pl-12 pr-4 py-3 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white/80 dark:bg-slate-700/80 text-slate-800 dark:text-slate-200 text-base font-medium transition-all duration-200"
                  />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Gib den maximalen Betrag ein, den du in dieser Kategorie ausgeben möchtest</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                  Zeitraum
                </label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <select
                    value={newBudget.period}
                    onChange={(e) => setNewBudget(prev => ({ ...prev, period: e.target.value }))}
                    className="w-full pl-12 pr-4 py-3 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white/80 dark:bg-slate-700/80 text-slate-800 dark:text-slate-200 text-base font-medium transition-all duration-200"
                  >
                    <option value="monthly">Monatlich</option>
                    <option value="weekly">Wöchentlich</option>
                    <option value="yearly">Jährlich</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-4 mt-8">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-6 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl font-semibold transition-all duration-200"
              >
                Abbrechen
              </button>
              <button
                onClick={handleCreateBudget}
                disabled={!newBudget.category || !newBudget.amount}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg"
              >
                Budget erstellen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Budget Modal */}
      {editingBudget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-3xl max-w-lg w-full p-8 shadow-2xl border border-white/20 dark:border-slate-700/50">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Edit className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">
                  Budget bearbeiten
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {editingBudget.category} Budget anpassen
                </p>
              </div>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                  Budget Betrag
                </label>
                <div className="relative">
                  <Euro className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="number"
                    value={editingBudget.amount}
                    onChange={(e) => setEditingBudget(prev => ({ ...prev, amount: e.target.value }))}
                    className="w-full pl-12 pr-4 py-3 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white/80 dark:bg-slate-700/80 text-slate-800 dark:text-slate-200 text-base font-medium transition-all duration-200"
                  />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Aktualisiere das Ausgabenlimit für diese Kategorie</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                  Zeitraum
                </label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <select
                    value={editingBudget.period}
                    onChange={(e) => setEditingBudget(prev => ({ ...prev, period: e.target.value }))}
                    className="w-full pl-12 pr-4 py-3 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white/80 dark:bg-slate-700/80 text-slate-800 dark:text-slate-200 text-base font-medium transition-all duration-200"
                  >
                    <option value="monthly">Monatlich</option>
                    <option value="weekly">Wöchentlich</option>
                    <option value="yearly">Jährlich</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-4 mt-8">
              <button
                onClick={() => setEditingBudget(null)}
                className="flex-1 px-6 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl font-semibold transition-all duration-200"
              >
                Abbrechen
              </button>
              <button
                onClick={() => handleEditBudget(editingBudget)}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                Änderungen speichern
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Income Modal */}
      {showIncomeModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-3xl max-w-lg w-full p-8 shadow-2xl border border-white/20 dark:border-slate-700/50">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Euro className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Monatseinkommen festlegen</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Für {currentDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                  Erwartetes Einkommen
                </label>
                <div className="relative">
                  <Euro className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="number"
                    value={monthlyIncomeInput}
                    onChange={(e) => setMonthlyIncomeInput(e.target.value)}
                    placeholder="3000.00"
                    className="w-full pl-12 pr-4 py-3 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white/80 dark:bg-slate-700/80 text-slate-800 dark:text-slate-200 text-base font-medium transition-all duration-200"
                  />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  Dein voraussichtliches Nettoeinkommen für diesen Monat
                </p>
              </div>
              
              {summary.totalBudget > 0 && (
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                  <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Budget Übersicht
                  </div>
                  <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                    <span>Gesamtbudget:</span>
                    <span className="font-medium">{formatCurrency(summary.totalBudget)}</span>
                  </div>
                  {monthlyIncomeInput && (
                    <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400 mt-1">
                      <span>Verbleibendes Einkommen:</span>
                      <span className={`font-medium ${
                        (parseFloat(monthlyIncomeInput) - summary.totalBudget) >= 0 
                          ? 'text-purple-600 dark:text-purple-400' 
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {formatCurrency(parseFloat(monthlyIncomeInput) - summary.totalBudget)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-4 mt-8">
              <button
                onClick={() => setShowIncomeModal(false)}
                className="flex-1 px-6 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl font-semibold transition-all duration-200"
              >
                Abbrechen
              </button>
              <button
                onClick={handleSaveIncome}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                Einkommen speichern
              </button>
            </div>
          </div>
        </div>
      )}

      </div>
    </div>
  );
};

export default BudgetPage;