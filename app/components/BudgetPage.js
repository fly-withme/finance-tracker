'use client';

import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  Calculator, 
  Plus, 
  Edit, 
  Trash2, 
  ChevronLeft, 
  ChevronRight,
  ChevronDown,
  AlertTriangle,
  Calendar,
  Euro,
  BarChart3
} from 'lucide-react';
import Card from './ui/Card';
import { db } from '../utils/db';

const formatCurrency = (amount) => {
  if (isNaN(amount) || !isFinite(amount)) {
    return '0,00 €';
  }
  return amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
};

const BudgetPage = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [newBudget, setNewBudget] = useState({ category: '', amount: '', period: 'monthly', type: 'essentiell' });
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [monthlyIncomeInput, setMonthlyIncomeInput] = useState('');
  const [editBudgetDisplayAmount, setEditBudgetDisplayAmount] = useState('');
  const [newBudgetDisplayAmount, setNewBudgetDisplayAmount] = useState('');
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);

  // Live data
  const categories = useLiveQuery(() => db.categories.toArray(), []) || [];
  const budgets = useLiveQuery(() => db.budgets.toArray(), []) || [];
  const transactions = useLiveQuery(() => db.transactions.toArray(), []) || [];

  // Calculate monthly income from transactions
  const calculatedMonthlyIncome = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);

    // Calculate income from transactions (positive amounts)
    const monthIncomeTransactions = transactions.filter(tx => 
      new Date(tx.date) >= monthStart &&
      new Date(tx.date) <= monthEnd &&
      tx.amount > 0 // Only income transactions
    );

    return monthIncomeTransactions.reduce((sum, tx) => sum + tx.amount, 0);
  }, [transactions, currentDate]);

  // Load manual monthly income from database (fallback for future months)
  const monthlyIncomeData = useLiveQuery(async () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const key = `monthlyIncome_${year}_${month.toString().padStart(2, '0')}`;
    return await db.settings.get(key);
  }, [currentDate]);

  // Use calculated income if available, otherwise use manual income
  const currentMonthlyIncome = calculatedMonthlyIncome > 0 ? calculatedMonthlyIncome : (monthlyIncomeData?.value || 0);

  // Helper to determine if current date is in future
  const today = new Date();
  const isFutureMonth = currentDate > today;

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

  // Formula calculation helper
  const evaluateFormula = (input) => {
    if (!input) {
      return 0;
    }
    
    if (!input.startsWith('=')) {
      const num = parseFloat(input);
      return isNaN(num) ? 0 : num;
    }
    
    try {
      // Remove the = sign and clean the expression
      const expression = input.slice(1).trim();
      
      if (!expression) {
        return 0;
      }
      
      // Basic validation - only allow numbers, +, -, *, /, (, ), decimal points, and spaces
      if (!/^[0-9+\-*/.() ]+$/.test(expression)) {
        return NaN;
      }
      
      // Clean the expression
      const cleanExpression = expression.replace(/\s+/g, '');
      
      // Check if expression is incomplete (ends with operator or has unbalanced parentheses)
      if (/[+\-*/]$/.test(cleanExpression) || 
          cleanExpression.includes('()') || 
          cleanExpression === '' ||
          /^[+\-*/]/.test(cleanExpression)) {
        return NaN; // Don't evaluate incomplete expressions
      }
      
      // Check for balanced parentheses
      let parenthesesCount = 0;
      for (let char of cleanExpression) {
        if (char === '(') parenthesesCount++;
        else if (char === ')') parenthesesCount--;
        if (parenthesesCount < 0) return NaN; // More closing than opening
      }
      if (parenthesesCount !== 0) return NaN; // Unbalanced parentheses
      
      // Check for consecutive operators (except for negative numbers)
      if (/[+\-*/]{2,}/.test(cleanExpression) && !/\d-\d/.test(cleanExpression)) {
        return NaN;
      }
      
      // Check for valid number-operator pattern
      if (!/^\d+(\.\d+)?([+\-*/]\d+(\.\d+)?)*$/.test(cleanExpression) && 
          !/^[\(\d].*[\)\d]$/.test(cleanExpression)) {
        return NaN;
      }
      
      console.log('Evaluating formula:', cleanExpression);
      
      // Evaluate the expression safely
      const result = new Function('return (' + cleanExpression + ')')();
      
      console.log('Formula result:', result);
      
      if (isNaN(result) || !isFinite(result)) {
        return NaN;
      }
      
      return result;
    } catch (error) {
      console.error('Formula evaluation error:', error.message);
      return NaN;
    }
  };

  // Summary calculations
  const summary = useMemo(() => {
    const totalBudget = budgetData.reduce((sum, item) => sum + item.amount, 0);
    const totalSpent = budgetData.reduce((sum, item) => sum + item.actualSpent, 0);
    const totalRemaining = totalBudget - totalSpent;
    const overBudgetCount = budgetData.filter(item => item.status === 'over').length;
    const warningCount = budgetData.filter(item => item.status === 'warning').length;

    // Calculate by type
    const typeBreakdown = {
      essentiell: { budget: 0, spent: 0 },
      lifestyle: { budget: 0, spent: 0 },
      sparen: { budget: 0, spent: 0 }
    };
    
    budgetData.forEach(budget => {
      if (budget.type && typeBreakdown[budget.type]) {
        typeBreakdown[budget.type].budget += budget.amount;
        typeBreakdown[budget.type].spent += budget.actualSpent;
      }
    });

    return {
      totalBudget,
      totalSpent,
      totalRemaining,
      overBudgetCount,
      warningCount,
      overallProgress: totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0,
      typeBreakdown
    };
  }, [budgetData]);

  const handleCreateBudget = async () => {
    try {
      const inputValue = newBudgetDisplayAmount || newBudget.amount;
      const calculatedAmount = evaluateFormula(inputValue);
      
      console.log('Creating budget with input:', inputValue, 'calculated:', calculatedAmount);
      
      if (isNaN(calculatedAmount) || calculatedAmount <= 0) {
        alert('Bitte geben Sie einen gültigen Betrag oder eine gültige Formel ein (z.B. =40+30+60)');
        return;
      }
      
      await db.budgets.add({
        category: newBudget.category,
        amount: calculatedAmount,
        period: newBudget.period,
        type: newBudget.type,
        createdAt: Date.now()
      });
      
      setNewBudget({ category: '', amount: '', period: 'monthly', type: 'essentiell' });
      setNewBudgetDisplayAmount('');
      setShowCreateModal(false);
    } catch (error) {
      console.error('Error creating budget:', error);
    }
  };

  const handleEditBudget = async (budget) => {
    try {
      const inputValue = editBudgetDisplayAmount || budget.amount.toString();
      const calculatedAmount = evaluateFormula(inputValue);
      
      console.log('Editing budget with input:', inputValue, 'calculated:', calculatedAmount);
      
      if (isNaN(calculatedAmount) || calculatedAmount <= 0) {
        alert('Bitte geben Sie einen gültigen Betrag oder eine gültige Formel ein (z.B. =40+30+60)');
        return;
      }
      
      await db.budgets.update(budget.id, {
        amount: calculatedAmount,
        period: budget.period
      });
      
      setEditingBudget(null);
      setEditBudgetDisplayAmount('');
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

  const handleDeleteAllBudgets = async () => {
    try {
      // Delete all budgets
      await db.budgets.clear();
      
      // Delete current month's income
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const incomeKey = `monthlyIncome_${year}_${month.toString().padStart(2, '0')}`;
      await db.settings.delete(incomeKey);
      
      setShowDeleteAllModal(false);
    } catch (error) {
      console.error('Error deleting budgets:', error);
    }
  };


  // Helper function to identify income categories
  const isIncomeCategory = (categoryName) => {
    const incomeCategoryNames = [
      'gehalt', 'einkommen', 'income', 'salary', 'lohn', 'bonus', 'dividende', 
      'zinsen', 'rente', 'pension', 'arbeitgeber', 'employer', 'wage', 'wages'
    ];
    return incomeCategoryNames.some(keyword => 
      categoryName.toLowerCase().includes(keyword.toLowerCase())
    );
  };

  // Filter out income categories and already budgeted categories
  const availableCategories = categories.filter(cat => 
    !budgets.some(budget => budget.category === cat.name) && 
    !isIncomeCategory(cat.name)
  );

  // Filter out income categories for modal dropdown too
  const availableCategoriesForModal = categories.filter(cat => 
    !budgets.some(budget => budget.category === cat.name) && 
    !isIncomeCategory(cat.name)
  );

  // Quick budget entry
  const [quickBudgets, setQuickBudgets] = useState({});
  const [quickBudgetTypes, setQuickBudgetTypes] = useState({});
  const [showQuickBudget, setShowQuickBudget] = useState(false);
  
  const handleQuickBudgetChange = (categoryName, amount) => {
    setQuickBudgets(prev => ({
      ...prev,
      [categoryName]: amount
    }));
  };

  const handleQuickBudgetTypeChange = (categoryName, type) => {
    setQuickBudgetTypes(prev => ({
      ...prev,
      [categoryName]: type
    }));
  };

  const handleQuickBudgetSave = async (categoryName) => {
    const amount = parseFloat(quickBudgets[categoryName]);
    const type = quickBudgetTypes[categoryName] || 'essentiell'; // Default to essentiell
    if (amount && amount > 0) {
      try {
        await db.budgets.add({
          category: categoryName,
          amount: amount,
          period: 'monthly',
          type: type,
          createdAt: Date.now()
        });
        // Clear the inputs
        setQuickBudgets(prev => ({
          ...prev,
          [categoryName]: ''
        }));
        setQuickBudgetTypes(prev => ({
          ...prev,
          [categoryName]: 'essentiell'
        }));
      } catch (error) {
        console.error('Error saving quick budget:', error);
      }
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
                onClick={() => setShowCreateModal(true)}
                className="flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-700 dark:to-purple-700 hover:from-indigo-700 hover:to-purple-700 dark:hover:from-indigo-600 dark:hover:to-purple-600 text-white rounded-lg transition-all duration-300 ease-in-out font-medium shadow-lg hover:shadow-xl py-3 px-6 text-base"
              >
                <Plus className="w-5 h-5" />
                <span className="hidden sm:inline">Neues Budget</span>
              </button>
            </div>
          </div>
        </header>

        {/* Monthly Budget Overview */}
        {(
          <div className="mb-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
              {/* Income Input for future months when no calculated income is available */}
              {!currentMonthlyIncome && isFutureMonth ? (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Erwartetes Einkommen
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="number"
                        value={monthlyIncomeInput}
                        onChange={(e) => setMonthlyIncomeInput(e.target.value)}
                        placeholder="3000"
                        className="w-full px-3 py-2 pr-8 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">€</span>
                    </div>
                    <button
                      onClick={() => {
                        if (monthlyIncomeInput && parseFloat(monthlyIncomeInput) > 0) {
                          handleSaveIncome();
                        }
                      }}
                      disabled={!monthlyIncomeInput || parseFloat(monthlyIncomeInput) <= 0}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      OK
                    </button>
                  </div>
                </div>
              ) : currentMonthlyIncome > 0 ? (
                /* Show recommendations when income is set */
                <>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                        {formatCurrency(currentMonthlyIncome)}
                      </div>
                      {calculatedMonthlyIncome > 0 ? (
                        <div className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs rounded-full font-medium">
                          Aus Transaktionen
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setMonthlyIncomeInput(currentMonthlyIncome.toString());
                            setShowIncomeModal(true);
                          }}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                        {formatCurrency(Math.max(0, currentMonthlyIncome - summary.totalBudget))}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">verfügbar</div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    {/* Essentiell */}
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
                      <div className="text-center space-y-4">
                        <div className="border-b border-slate-200 dark:border-slate-700 pb-3">
                          <div className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">
                            Essentiell (50%)
                          </div>
                          <div className="text-2xl font-bold text-slate-800 dark:text-slate-200">
                            {formatCurrency(currentMonthlyIncome * 0.5)}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {isFutureMonth ? 'Empfohlenes Maximum' : 'Empfohlen gewesen wäre'}
                          </div>
                        </div>
                        
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-slate-500 dark:text-slate-400">Budgetiert:</span>
                            <span className={`font-medium ${
                              summary.typeBreakdown.essentiell.budget > currentMonthlyIncome * 0.5
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-slate-700 dark:text-slate-300'
                            }`}>
                              {formatCurrency(summary.typeBreakdown.essentiell.budget)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500 dark:text-slate-400">Ausgegeben:</span>
                            <span className={`font-medium ${
                              summary.typeBreakdown.essentiell.spent > summary.typeBreakdown.essentiell.budget
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-slate-700 dark:text-slate-300'
                            }`}>
                              {formatCurrency(summary.typeBreakdown.essentiell.spent)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Unterhaltung */}
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
                      <div className="text-center space-y-4">
                        <div className="border-b border-slate-200 dark:border-slate-700 pb-3">
                          <div className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">
                            Unterhaltung (30%)
                          </div>
                          <div className="text-2xl font-bold text-slate-800 dark:text-slate-200">
                            {formatCurrency(currentMonthlyIncome * 0.3)}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {isFutureMonth ? 'Empfohlenes Maximum' : 'Empfohlen gewesen wäre'}
                          </div>
                        </div>
                        
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-slate-500 dark:text-slate-400">Budgetiert:</span>
                            <span className={`font-medium ${
                              summary.typeBreakdown.lifestyle.budget > currentMonthlyIncome * 0.3
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-slate-700 dark:text-slate-300'
                            }`}>
                              {formatCurrency(summary.typeBreakdown.lifestyle.budget)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500 dark:text-slate-400">Ausgegeben:</span>
                            <span className={`font-medium ${
                              summary.typeBreakdown.lifestyle.spent > summary.typeBreakdown.lifestyle.budget
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-slate-700 dark:text-slate-300'
                            }`}>
                              {formatCurrency(summary.typeBreakdown.lifestyle.spent)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Sparen */}
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
                      <div className="text-center space-y-4">
                        <div className="border-b border-slate-200 dark:border-slate-700 pb-3">
                          <div className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">
                            Sparen (20%)
                          </div>
                          <div className="text-2xl font-bold text-slate-800 dark:text-slate-200">
                            {formatCurrency(currentMonthlyIncome * 0.2)}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {isFutureMonth ? 'Empfohlenes Minimum' : 'Empfohlen gewesen wäre'}
                          </div>
                        </div>
                        
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-slate-500 dark:text-slate-400">Budgetiert:</span>
                            <span className="font-medium text-slate-700 dark:text-slate-300">
                              {formatCurrency(summary.typeBreakdown.sparen.budget)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500 dark:text-slate-400">Ausgegeben:</span>
                            <span className={`font-medium ${
                              summary.typeBreakdown.sparen.spent > summary.typeBreakdown.sparen.budget
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-slate-700 dark:text-slate-300'
                            }`}>
                              {formatCurrency(summary.typeBreakdown.sparen.spent)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                /* Show message when no income is available for current/past months */
                !isFutureMonth && (
                  <div className="text-center py-8">
                    <div className="text-slate-500 dark:text-slate-400 mb-4">
                      Keine Einkommen-Transaktionen für diesen Monat gefunden
                    </div>
                    <div className="text-sm text-slate-400 dark:text-slate-500 mb-4">
                      Das Einkommen wird automatisch aus deinen Einnahme-Transaktionen berechnet
                    </div>
                    <button
                      onClick={() => {
                        setShowIncomeModal(true);
                      }}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
                    >
                      Manuell erfassen
                    </button>
                  </div>
                )
              )}
            </div>
          </div>
        )}


        
        {/* Budget Overview */}
        <Card className="relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-1">Budget Übersicht</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Deine monatlichen Budgets im Überblick</p>
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
              <div key={budget.id} className={`group relative p-6 rounded-2xl border ${
                isFutureMonth 
                  ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
              }`}>
                {/* Header Row */}
                <div className="flex items-start justify-between mb-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-bold text-xl text-slate-800 dark:text-slate-200">
                        {budget.category}
                      </h3>
                      
                      {/* Budget Type Badge */}
                      {budget.type && (
                        <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                          budget.type === 'essentiell' ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300' :
                          budget.type === 'lifestyle' ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300' :
                          budget.type === 'sparen' ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300' :
                          'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}>
                          {budget.type === 'essentiell' && <Calculator className="w-3 h-3" />}
                          {budget.type === 'lifestyle' && <BarChart3 className="w-3 h-3" />}
                          {budget.type === 'sparen' && <Euro className="w-3 h-3" />}
                          {budget.type === 'essentiell' ? 'Essentiell' :
                           budget.type === 'lifestyle' ? 'Unterhaltung' :
                           budget.type === 'sparen' ? 'Sparen' : 'Unbekannt'}
                        </div>
                      )}
                      
                      {/* Status Badge */}
                      <div className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        budget.status === 'over' ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300' :
                        budget.status === 'warning' ? 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300' :
                        'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300'
                      }`}>
                        {budget.status === 'over' ? 'Überschritten' :
                         budget.status === 'warning' ? 'Warnung' : 'Im Rahmen'}
                      </div>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                      {budget.transactionCount} Transaktionen in diesem Monat
                    </p>
                  </div>

                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button
                      onClick={() => {
                        setEditingBudget(budget);
                        setEditBudgetDisplayAmount('');
                      }}
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

                {/* Simple Progress Bar */}
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-3">
                    <div className="text-sm text-slate-600 dark:text-slate-300 font-medium">
                      {formatCurrency(budget.actualSpent)} von {formatCurrency(budget.amount)}
                    </div>
                    <div className={`text-sm font-semibold ${
                      budget.remaining >= 0 ? 'text-slate-600 dark:text-slate-300' : 'text-red-600 dark:text-red-400'
                    }`}>
                      {budget.remaining >= 0 ? formatCurrency(budget.remaining) + ' verfügbar' : formatCurrency(Math.abs(budget.remaining)) + ' überschritten'}
                    </div>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 shadow-inner">
                    <div 
                      className={`h-3 rounded-full transition-all duration-700 shadow-sm ${
                        budget.status === 'over' ? 'bg-gradient-to-r from-red-500 to-red-600' :
                        budget.status === 'warning' ? 'bg-gradient-to-r from-orange-500 to-yellow-500' :
                        'bg-gradient-to-r from-indigo-500 to-purple-600'
                      }`}
                      style={{ width: `${Math.min(100, budget.progressPercentage)}%` }}
                    ></div>
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

        {/* Quick Budget Entry for Available Categories */}
        {availableCategories.length > 0 && (
          <Card className="mt-6">
            <div 
              className="flex items-center justify-between cursor-pointer"
              onClick={() => setShowQuickBudget(!showQuickBudget)}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <Plus className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-1">Schnell-Budget</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Budgets für weitere Kategorien festlegen</p>
                </div>
              </div>
              <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                <ChevronDown 
                  className={`w-5 h-5 text-slate-600 dark:text-slate-400 transition-transform duration-200 ${
                    showQuickBudget ? 'rotate-180' : ''
                  }`} 
                />
              </button>
            </div>

            {showQuickBudget && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
              {availableCategories.map(category => (
                <div key={category.id} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-slate-800 dark:text-slate-200">{category.name}</h4>
                  </div>
                  
                  <div className="space-y-3">
                    {/* Amount Input and Save Button */}
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type="number"
                          value={quickBudgets[category.name] || ''}
                          onChange={(e) => handleQuickBudgetChange(category.name, e.target.value)}
                          placeholder="Budget eingeben"
                          className="w-full px-3 py-2 pr-8 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleQuickBudgetSave(category.name);
                            }
                          }}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">€</span>
                      </div>
                      <button
                        onClick={() => handleQuickBudgetSave(category.name)}
                        disabled={!quickBudgets[category.name] || parseFloat(quickBudgets[category.name]) <= 0}
                        className="w-10 h-10 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-full flex items-center justify-center transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105"
                        title="Budget speichern"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    
                    {/* Type Tags */}
                    <div className="flex gap-2 justify-start">
                      <button
                        type="button"
                        onClick={() => handleQuickBudgetTypeChange(category.name, 'essentiell')}
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all duration-200 ${
                          (quickBudgetTypes[category.name] || 'essentiell') === 'essentiell'
                            ? 'bg-indigo-100 border-2 border-indigo-500 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-400 dark:text-indigo-300 scale-110'
                            : 'bg-slate-100 border border-slate-300 text-slate-500 hover:bg-indigo-50 hover:border-indigo-300 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-indigo-900/20'
                        }`}
                        title="Essentiell"
                      >
                        <Calculator className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickBudgetTypeChange(category.name, 'lifestyle')}
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all duration-200 ${
                          (quickBudgetTypes[category.name] || 'essentiell') === 'lifestyle'
                            ? 'bg-indigo-100 border-2 border-indigo-500 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-400 dark:text-indigo-300 scale-110'
                            : 'bg-slate-100 border border-slate-300 text-slate-500 hover:bg-indigo-50 hover:border-indigo-300 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-indigo-900/20'
                        }`}
                        title="Unterhaltung"
                      >
                        <BarChart3 className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickBudgetTypeChange(category.name, 'sparen')}
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all duration-200 ${
                          (quickBudgetTypes[category.name] || 'essentiell') === 'sparen'
                            ? 'bg-indigo-100 border-2 border-indigo-600 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-500 dark:text-indigo-300 scale-110'
                            : 'bg-slate-100 border border-slate-300 text-slate-500 hover:bg-indigo-50 hover:border-indigo-300 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-indigo-900/20'
                        }`}
                        title="Sparen"
                      >
                        <Euro className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              </div>
            )}
          </Card>
        )}

      {/* Create Budget Modal - Minimalist */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-6">Neues Budget</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Kategorie
                </label>
                <select
                  value={newBudget.category}
                  onChange={(e) => setNewBudget(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">Kategorie wählen</option>
                  {availableCategoriesForModal.map(cat => (
                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Budget
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={newBudgetDisplayAmount || newBudget.amount || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      setNewBudgetDisplayAmount(value);
                      setNewBudget(prev => ({ ...prev, amount: value }));
                    }}
                    placeholder="500 oder =40+30+60"
                    className="w-full px-3 py-2 pr-8 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">€</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Typ
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewBudget(prev => ({ ...prev, type: 'essentiell' }))}
                    className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                      newBudget.type === 'essentiell'
                        ? 'bg-green-100 border-green-300 text-green-700 dark:bg-green-900/30 dark:border-green-600 dark:text-green-300'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-600'
                    }`}
                  >
                    Essentiell
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewBudget(prev => ({ ...prev, type: 'lifestyle' }))}
                    className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                      newBudget.type === 'lifestyle'
                        ? 'bg-yellow-100 border-yellow-300 text-yellow-700 dark:bg-yellow-900/30 dark:border-yellow-600 dark:text-yellow-300'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-600'
                    }`}
                  >
                    Lifestyle
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewBudget(prev => ({ ...prev, type: 'sparen' }))}
                    className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                      newBudget.type === 'sparen'
                        ? 'bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-900/30 dark:border-blue-600 dark:text-blue-300'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-600'
                    }`}
                  >
                    Sparen
                  </button>
                </div>
              </div>

              {currentMonthlyIncome > 0 && newBudget.type && (
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Empfehlung ({newBudget.type === 'essentiell' ? '50%' : newBudget.type === 'lifestyle' ? '30%' : '20%'}): <span className="font-medium text-slate-700 dark:text-slate-300">{formatCurrency(currentMonthlyIncome * (newBudget.type === 'essentiell' ? 0.5 : newBudget.type === 'lifestyle' ? 0.3 : 0.2))}</span>
                  </div>
                  {newBudgetDisplayAmount && newBudgetDisplayAmount.startsWith('=') && (
                    <div className="text-xs mt-1">
                      <span className="text-slate-500 dark:text-slate-400">Berechnet: </span>
                      <span className="font-medium text-indigo-600 dark:text-indigo-400">
                        {isNaN(evaluateFormula(newBudgetDisplayAmount)) ? 'Ungültige Formel' : formatCurrency(evaluateFormula(newBudgetDisplayAmount))}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg font-medium transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={handleCreateBudget}
                disabled={!newBudget.category || (!newBudget.amount && !newBudgetDisplayAmount)}
                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Erstellen
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
                    type="text"
                    value={editBudgetDisplayAmount || (editingBudget.amount ? editingBudget.amount.toString() : '')}
                    onChange={(e) => {
                      const value = e.target.value;
                      setEditBudgetDisplayAmount(value);
                      setEditingBudget(prev => ({ ...prev, amount: value }));
                    }}
                    className="w-full pl-12 pr-4 py-3 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white/80 dark:bg-slate-700/80 text-slate-800 dark:text-slate-200 text-base font-medium transition-all duration-200"
                  />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Geben Sie einen Betrag ein oder verwenden Sie Formeln wie =40+30+60</p>
                {editBudgetDisplayAmount && editBudgetDisplayAmount.startsWith('=') && (
                  <div className="text-xs mt-2">
                    <span className="text-slate-500 dark:text-slate-400">Berechnet: </span>
                    <span className="font-medium text-indigo-600 dark:text-indigo-400">
                      {isNaN(evaluateFormula(editBudgetDisplayAmount)) ? 'Ungültige Formel' : formatCurrency(evaluateFormula(editBudgetDisplayAmount))}
                    </span>
                  </div>
                )}
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

      {/* Delete All Budgets Modal */}
      {showDeleteAllModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-3xl max-w-lg w-full p-8 shadow-2xl border border-white/20 dark:border-slate-700/50">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Trash2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Alle Budgets löschen</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Komplett neu anfangen mit der Budget-Planung
                </p>
              </div>
            </div>
            
            <div className="space-y-6">
              <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border border-red-200 dark:border-red-800">
                <div className="flex items-center gap-3 mb-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                  <div className="text-sm font-semibold text-red-800 dark:text-red-200">
                    Achtung: Diese Aktion kann nicht rückgängig gemacht werden
                  </div>
                </div>
                <ul className="space-y-2 text-sm text-red-700 dark:text-red-300">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                    Alle {budgets.length} Budget-Kategorien werden gelöscht
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                    Das geplante Einkommen für diesen Monat wird entfernt
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                    Du kannst danach komplett neu mit der Budget-Planung beginnen
                  </li>
                </ul>
              </div>
            </div>

            <div className="flex gap-4 mt-8">
              <button
                onClick={() => setShowDeleteAllModal(false)}
                className="flex-1 px-6 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl font-semibold transition-all duration-200"
              >
                Abbrechen
              </button>
              <button
                onClick={handleDeleteAllBudgets}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                Alle Budgets löschen
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