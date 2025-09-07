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
import { jonyColors } from '../theme';

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
    <div className="min-h-screen font-sans" style={{ backgroundColor: jonyColors.background, color: jonyColors.textPrimary }}>
      <div className="px-6 py-8 mb-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-1 h-8 rounded-full" style={{ backgroundColor: jonyColors.accent1 }}></div>
              <h1 className="text-3xl font-bold tracking-tight" style={{ color: jonyColors.textPrimary, letterSpacing: '-0.02em' }}>
                Budget
              </h1>
              <div className="px-3 py-1 rounded-full font-semibold text-sm" style={{ backgroundColor: jonyColors.accent1Alpha, color: jonyColors.accent1 }}>
                {budgetData.length}
              </div>
            </div>

            {/* Month Navigation */}
            <div className="flex items-center gap-3">
              <button
                onClick={goToPreviousMonth}
                className="p-3 rounded-full transition-all duration-200"
                style={{ backgroundColor: jonyColors.cardBackground, color: jonyColors.textSecondary }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = jonyColors.accent1Alpha;
                  e.target.style.color = jonyColors.accent1;
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = jonyColors.cardBackground;
                  e.target.style.color = jonyColors.textSecondary;
                }}
                title="Vorheriger Monat"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="px-4 py-2 min-w-[180px] text-center w-48">
                <span className="font-bold text-xl" style={{ color: jonyColors.textPrimary }}>
                  {currentDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
                </span>
              </div>
              <button
                onClick={goToNextMonth}
                className="p-3 rounded-full transition-all duration-200"
                style={{ backgroundColor: jonyColors.cardBackground, color: jonyColors.textSecondary }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = jonyColors.accent1Alpha;
                  e.target.style.color = jonyColors.accent1;
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = jonyColors.cardBackground;
                  e.target.style.color = jonyColors.textSecondary;
                }}
                title="Nächster Monat"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-6 py-3 rounded-xl transition-all duration-200 font-semibold shadow-lg hover:shadow-xl text-base"
              style={{ backgroundColor: jonyColors.accent1, color: jonyColors.background }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = jonyColors.greenDark;
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = jonyColors.accent1;
              }}
            >
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">Neues Budget</span>
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 mb-12">
        <div className="max-w-7xl mx-auto">

          {/* Monthly Budget Overview */}
          {(
            <div className="mb-6">
              <div className="rounded-2xl p-6 border" style={{
                backgroundColor: jonyColors.surface,
                border: `1px solid ${jonyColors.border}`
              }}>
                {/* Income Input for future months when no calculated income is available */}
                {!currentMonthlyIncome && isFutureMonth ? (
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: jonyColors.textPrimary }}>
                      Erwartetes Einkommen
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type="number"
                          value={monthlyIncomeInput}
                          onChange={(e) => setMonthlyIncomeInput(e.target.value)}
                          placeholder="3000"
                          className="w-full px-3 py-2 pr-8 border rounded-lg focus:outline-none focus:ring-2"
                          style={{
                            backgroundColor: jonyColors.cardBackground,
                            color: jonyColors.textPrimary,
                            borderColor: jonyColors.cardBorder,
                            '--tw-ring-color': jonyColors.accent1
                          }}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: jonyColors.textSecondary }}>€</span>
                      </div>
                      <button
                        onClick={() => {
                          if (monthlyIncomeInput && parseFloat(monthlyIncomeInput) > 0) {
                            handleSaveIncome();
                          }
                        }}
                        disabled={!monthlyIncomeInput || parseFloat(monthlyIncomeInput) <= 0}
                        className="px-4 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ backgroundColor: jonyColors.accent1, color: jonyColors.background }}
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
                        <div className="text-lg font-semibold" style={{ color: jonyColors.textPrimary }}>
                          {formatCurrency(currentMonthlyIncome)}
                        </div>
                        {calculatedMonthlyIncome > 0 ? (
                          <div className="px-2 py-1 text-xs rounded-full font-medium" style={{
                            backgroundColor: jonyColors.accent1Alpha,
                            color: jonyColors.accent1
                          }}>
                            Aus Transaktionen
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setMonthlyIncomeInput(currentMonthlyIncome.toString());
                              setShowIncomeModal(true);
                            }}
                            className="transition-colors duration-200"
                            style={{ color: jonyColors.textSecondary }}
                            onMouseEnter={(e) => {
                              e.target.style.color = jonyColors.textPrimary;
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.color = jonyColors.textSecondary;
                            }}
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold" style={{ color: jonyColors.accent1 }}>
                          {formatCurrency(Math.max(0, currentMonthlyIncome - summary.totalBudget))}
                        </div>
                        <div className="text-xs" style={{ color: jonyColors.textSecondary }}>verfügbar</div>
                      </div>
                    </div>
                  
                    <div className="grid grid-cols-3 gap-4">
                      {/* Essentiell */}
                      <div className="p-4 rounded-xl border shadow-sm" style={{
                        backgroundColor: jonyColors.surface,
                        border: `1px solid ${jonyColors.border}`
                      }}>
                        <div className="text-center space-y-4">
                          <div className="pb-3" style={{ borderBottom: `1px solid ${jonyColors.border}` }}>
                            <div className="text-sm font-semibold mb-2" style={{ color: jonyColors.textSecondary }}>
                              Essentiell (50%)
                            </div>
                            <div className="text-2xl font-bold" style={{ color: jonyColors.accent1 }}>
                              {formatCurrency(currentMonthlyIncome * 0.5)}
                            </div>
                            <div className="text-xs" style={{ color: jonyColors.textSecondary }}>
                              {isFutureMonth ? 'Empfohlenes Maximum' : 'Empfohlen gewesen wäre'}
                            </div>
                          </div>
                          
                          <div className="space-y-2 text-xs">
                            <div className="flex justify-between">
                              <span style={{ color: jonyColors.textSecondary }}>Budgetiert:</span>
                              <span className="font-medium" style={{
                                color: summary.typeBreakdown.essentiell.budget > currentMonthlyIncome * 0.5
                                  ? jonyColors.red
                                  : jonyColors.textPrimary
                              }}>
                                {formatCurrency(summary.typeBreakdown.essentiell.budget)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span style={{ color: jonyColors.textSecondary }}>Ausgegeben:</span>
                              <span className="font-medium" style={{
                                color: summary.typeBreakdown.essentiell.spent > summary.typeBreakdown.essentiell.budget
                                  ? jonyColors.red
                                  : jonyColors.textPrimary
                              }}>
                                {formatCurrency(summary.typeBreakdown.essentiell.spent)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Unterhaltung */}
                      <div className="p-4 rounded-xl border shadow-sm" style={{
                        backgroundColor: jonyColors.surface,
                        border: `1px solid ${jonyColors.border}`
                      }}>
                        <div className="text-center space-y-4">
                          <div className="pb-3" style={{ borderBottom: `1px solid ${jonyColors.border}` }}>
                            <div className="text-sm font-semibold mb-2" style={{ color: jonyColors.textSecondary }}>
                              Unterhaltung (30%)
                            </div>
                            <div className="text-2xl font-bold" style={{ color: jonyColors.accent2 }}>
                              {formatCurrency(currentMonthlyIncome * 0.3)}
                            </div>
                            <div className="text-xs" style={{ color: jonyColors.textSecondary }}>
                              {isFutureMonth ? 'Empfohlenes Maximum' : 'Empfohlen gewesen wäre'}
                            </div>
                          </div>
                          
                          <div className="space-y-2 text-xs">
                            <div className="flex justify-between">
                              <span style={{ color: jonyColors.textSecondary }}>Budgetiert:</span>
                              <span className="font-medium" style={{
                                color: summary.typeBreakdown.lifestyle.budget > currentMonthlyIncome * 0.3
                                  ? jonyColors.red
                                  : jonyColors.textPrimary
                              }}>
                                {formatCurrency(summary.typeBreakdown.lifestyle.budget)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span style={{ color: jonyColors.textSecondary }}>Ausgegeben:</span>
                              <span className="font-medium" style={{
                                color: summary.typeBreakdown.lifestyle.spent > summary.typeBreakdown.lifestyle.budget
                                  ? jonyColors.red
                                  : jonyColors.textPrimary
                              }}>
                                {formatCurrency(summary.typeBreakdown.lifestyle.spent)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Sparen */}
                      <div className="p-4 rounded-xl border shadow-sm" style={{
                        backgroundColor: jonyColors.surface,
                        border: `1px solid ${jonyColors.border}`
                      }}>
                        <div className="text-center space-y-4">
                          <div className="pb-3" style={{ borderBottom: `1px solid ${jonyColors.border}` }}>
                            <div className="text-sm font-semibold mb-2" style={{ color: jonyColors.textSecondary }}>
                              Sparen (20%)
                            </div>
                            <div className="text-2xl font-bold" style={{ color: jonyColors.magenta }}>
                              {formatCurrency(currentMonthlyIncome * 0.2)}
                            </div>
                            <div className="text-xs" style={{ color: jonyColors.textSecondary }}>
                              {isFutureMonth ? 'Empfohlenes Minimum' : 'Empfohlen gewesen wäre'}
                            </div>
                          </div>
                          
                          <div className="space-y-2 text-xs">
                            <div className="flex justify-between">
                              <span style={{ color: jonyColors.textSecondary }}>Budgetiert:</span>
                              <span className="font-medium" style={{ color: jonyColors.textPrimary }}>
                                {formatCurrency(summary.typeBreakdown.sparen.budget)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span style={{ color: jonyColors.textSecondary }}>Ausgegeben:</span>
                              <span className="font-medium" style={{
                                color: summary.typeBreakdown.sparen.spent > summary.typeBreakdown.sparen.budget
                                  ? jonyColors.red
                                  : jonyColors.textPrimary
                              }}>
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
                      <div className="mb-4" style={{ color: jonyColors.textSecondary }}>
                        Keine Einkommen-Transaktionen für diesen Monat gefunden
                      </div>
                      <div className="text-sm mb-4" style={{ color: jonyColors.textTertiary }}>
                        Das Einkommen wird automatisch aus deinen Einnahme-Transaktionen berechnet
                      </div>
                      <button
                        onClick={() => {
                          setShowIncomeModal(true);
                        }}
                        className="px-4 py-2 rounded-lg font-medium transition-colors duration-200"
                        style={{ backgroundColor: jonyColors.accent1, color: jonyColors.background }}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = jonyColors.greenDark;
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = jonyColors.accent1;
                        }}
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
          <div className="p-8 rounded-2xl border" style={{
            backgroundColor: jonyColors.surface,
            border: `1px solid ${jonyColors.border}`
          }}>
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-2xl font-bold mb-1" style={{ color: jonyColors.textPrimary }}>Budget Übersicht</h3>
                <p className="text-sm font-medium" style={{ color: jonyColors.textSecondary }}>Deine monatlichen Budgets im Überblick</p>
              </div>
              
              {(summary.overBudgetCount > 0 || summary.warningCount > 0) && (
                <div className="rounded-2xl border p-3 shadow-sm" style={{
                  backgroundColor: jonyColors.cardBackground,
                  border: `1px solid ${jonyColors.cardBorder}`
                }}>
                  <div className="flex items-center gap-4 text-sm">
                    {summary.overBudgetCount > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: jonyColors.red }}/>
                        <span className="font-medium" style={{ color: jonyColors.textPrimary }}>{summary.overBudgetCount} überschritten</span>
                      </div>
                    )}
                    {summary.warningCount > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: jonyColors.orange }}/>
                        <span className="font-medium" style={{ color: jonyColors.textPrimary }}>{summary.warningCount} Warnung</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

        {budgetData.length > 0 ? (
          <div className="space-y-6">
            {budgetData.map((budget) => (
              <div key={budget.id} className="group relative p-6 rounded-2xl border" style={{
                backgroundColor: jonyColors.surface,
                border: `1px solid ${jonyColors.border}`
              }}>
                {/* Header Row */}
                <div className="flex items-start justify-between mb-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-bold text-xl" style={{ color: jonyColors.textPrimary }}>
                        {budget.category}
                      </h3>
                      
                      {/* Budget Type Badge */}
                      {budget.type && (
                        <div className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold" style={{
                          backgroundColor: budget.type === 'essentiell' ? jonyColors.accent1Alpha : 
                                         budget.type === 'lifestyle' ? jonyColors.accent2Alpha :
                                         budget.type === 'sparen' ? jonyColors.magentaAlpha :
                                         jonyColors.cardBackground,
                          color: budget.type === 'essentiell' ? jonyColors.accent1 :
                                budget.type === 'lifestyle' ? jonyColors.accent2 :
                                budget.type === 'sparen' ? jonyColors.magenta :
                                jonyColors.textSecondary
                        }}>
                          {budget.type === 'essentiell' && <Calculator className="w-3 h-3" />}
                          {budget.type === 'lifestyle' && <BarChart3 className="w-3 h-3" />}
                          {budget.type === 'sparen' && <Euro className="w-3 h-3" />}
                          {budget.type === 'essentiell' ? 'Essentiell' :
                           budget.type === 'lifestyle' ? 'Unterhaltung' :
                           budget.type === 'sparen' ? 'Sparen' : 'Unbekannt'}
                        </div>
                      )}
                      
                      {/* Status Badge */}
                      <div className="px-2 py-1 rounded-full text-xs font-semibold" style={{
                        backgroundColor: budget.status === 'over' ? jonyColors.redAlpha :
                                        budget.status === 'warning' ? jonyColors.orangeAlpha :
                                        jonyColors.accent1Alpha,
                        color: budget.status === 'over' ? jonyColors.red :
                               budget.status === 'warning' ? jonyColors.orange :
                               jonyColors.accent1
                      }}>
                        {budget.status === 'over' ? 'Überschritten' :
                         budget.status === 'warning' ? 'Warnung' : 'Im Rahmen'}
                      </div>
                    </div>
                    <p className="text-sm font-medium" style={{ color: jonyColors.textSecondary }}>
                      {budget.transactionCount} Transaktionen in diesem Monat
                    </p>
                  </div>

                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button
                      onClick={() => {
                        setEditingBudget(budget);
                        setEditBudgetDisplayAmount('');
                      }}
                      className="p-2 rounded-xl transition-all duration-200 hover:scale-105"
                      style={{ backgroundColor: jonyColors.magentaAlpha, color: jonyColors.magenta }}
                      onMouseEnter={(e) => {
                        e.target.style.backgroundColor = jonyColors.magenta;
                        e.target.style.color = jonyColors.background;
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.backgroundColor = jonyColors.magentaAlpha;
                        e.target.style.color = jonyColors.magenta;
                      }}
                      title="Bearbeiten"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteBudget(budget.id)}
                      className="p-2 rounded-xl transition-all duration-200 hover:scale-105"
                      style={{ backgroundColor: jonyColors.redAlpha, color: jonyColors.red }}
                      onMouseEnter={(e) => {
                        e.target.style.backgroundColor = jonyColors.red;
                        e.target.style.color = jonyColors.background;
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.backgroundColor = jonyColors.redAlpha;
                        e.target.style.color = jonyColors.red;
                      }}
                      title="Löschen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Simple Progress Bar */}
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-3">
                    <div className="text-sm font-medium" style={{ color: jonyColors.textSecondary }}>
                      {formatCurrency(budget.actualSpent)} von {formatCurrency(budget.amount)}
                    </div>
                    <div className="text-sm font-semibold" style={{ 
                      color: budget.remaining >= 0 ? jonyColors.textSecondary : jonyColors.red 
                    }}>
                      {budget.remaining >= 0 ? formatCurrency(budget.remaining) + ' verfügbar' : formatCurrency(Math.abs(budget.remaining)) + ' überschritten'}
                    </div>
                  </div>
                  <div className="w-full rounded-full h-3 shadow-inner" style={{ backgroundColor: jonyColors.cardBackground }}>
                    <div 
                      className="h-3 rounded-full transition-all duration-700 shadow-sm"
                      style={{ 
                        width: `${Math.min(100, budget.progressPercentage)}%`,
                        background: budget.status === 'over' ? `linear-gradient(to right, ${jonyColors.red}, ${jonyColors.redDark})` :
                                   budget.status === 'warning' ? `linear-gradient(to right, ${jonyColors.orange}, ${jonyColors.orangeDark})` :
                                   `linear-gradient(to right, ${jonyColors.accent1}, ${jonyColors.greenDark})`
                      }}
                    ></div>
                  </div>
                </div>

              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center py-16">
            <div className="backdrop-blur-sm rounded-3xl border p-12 shadow-lg text-center" style={{
              backgroundColor: jonyColors.surfaceAlpha,
              border: `1px solid ${jonyColors.border}`
            }}>
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg" style={{
                background: `linear-gradient(to bottom right, ${jonyColors.accent1}, ${jonyColors.greenDark})`
              }}>
                <Calculator className="w-8 h-8 text-white" />
              </div>
              <h4 className="text-xl font-bold mb-3" style={{ color: jonyColors.textPrimary }}>Noch keine Budgets</h4>
              <p className="font-medium mb-6 max-w-sm" style={{ color: jonyColors.textSecondary }}>
                Erstelle dein erstes Budget um deine Ausgaben zu verfolgen und bessere Kontrolle über deine Finanzen zu haben
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-6 py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl"
                style={{
                  background: `linear-gradient(to right, ${jonyColors.accent1}, ${jonyColors.greenDark})`,
                  color: jonyColors.background
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'scale(1.02)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'scale(1)';
                }}
              >
                Erstes Budget erstellen
              </button>
            </div>
          </div>
        )}
          </div>

        {/* Quick Budget Entry for Available Categories */}
        {availableCategories.length > 0 && (
          <div className="mt-6 p-8 rounded-2xl border" style={{
            backgroundColor: jonyColors.surface,
            border: `1px solid ${jonyColors.border}`
          }}>
            <div 
              className="flex items-center justify-between cursor-pointer"
              onClick={() => setShowQuickBudget(!showQuickBudget)}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg" style={{
                  background: `linear-gradient(to bottom right, ${jonyColors.accent1}, ${jonyColors.greenDark})`
                }}>
                  <Plus className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold mb-1" style={{ color: jonyColors.textPrimary }}>Schnell-Budget</h3>
                  <p className="text-sm font-medium" style={{ color: jonyColors.textSecondary }}>Budgets für weitere Kategorien festlegen</p>
                </div>
              </div>
              <button 
                className="p-2 rounded-lg transition-colors"
                style={{ color: jonyColors.textSecondary }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = jonyColors.cardBackground;
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = 'transparent';
                }}
              >
                <ChevronDown 
                  className={`w-5 h-5 transition-transform duration-200 ${
                    showQuickBudget ? 'rotate-180' : ''
                  }`}
                  style={{ color: jonyColors.textSecondary }}
                />
              </button>
            </div>

            {showQuickBudget && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
              {availableCategories.map(category => (
                <div key={category.id} className="rounded-xl p-4 border" style={{
                  backgroundColor: jonyColors.cardBackground,
                  border: `1px solid ${jonyColors.cardBorder}`
                }}>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold" style={{ color: jonyColors.textPrimary }}>{category.name}</h4>
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
                          className="w-full px-3 py-2 pr-8 border rounded-lg focus:ring-2 text-sm transition-colors"
                          style={{
                            backgroundColor: jonyColors.surface,
                            color: jonyColors.textPrimary,
                            borderColor: jonyColors.border,
                            '--tw-ring-color': jonyColors.accent1
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleQuickBudgetSave(category.name);
                            }
                          }}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: jonyColors.textTertiary }}>€</span>
                      </div>
                      <button
                        onClick={() => handleQuickBudgetSave(category.name)}
                        disabled={!quickBudgets[category.name] || parseFloat(quickBudgets[category.name]) <= 0}
                        className="w-10 h-10 text-white rounded-full flex items-center justify-center transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105"
                        style={{
                          background: `linear-gradient(to right, ${jonyColors.accent1}, ${jonyColors.greenDark})`
                        }}
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
                        className="w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all duration-200 border-2"
                        style={{
                          backgroundColor: (quickBudgetTypes[category.name] || 'essentiell') === 'essentiell'
                            ? jonyColors.accent1Alpha
                            : jonyColors.surface,
                          borderColor: (quickBudgetTypes[category.name] || 'essentiell') === 'essentiell'
                            ? jonyColors.accent1
                            : jonyColors.border,
                          color: (quickBudgetTypes[category.name] || 'essentiell') === 'essentiell'
                            ? jonyColors.accent1
                            : jonyColors.textSecondary,
                          transform: (quickBudgetTypes[category.name] || 'essentiell') === 'essentiell' ? 'scale(1.1)' : 'scale(1)'
                        }}
                        onMouseEnter={(e) => {
                          if ((quickBudgetTypes[category.name] || 'essentiell') !== 'essentiell') {
                            e.target.style.backgroundColor = jonyColors.accent1Alpha;
                            e.target.style.borderColor = jonyColors.accent1;
                          }
                        }}
                        onMouseLeave={(e) => {
                          if ((quickBudgetTypes[category.name] || 'essentiell') !== 'essentiell') {
                            e.target.style.backgroundColor = jonyColors.surface;
                            e.target.style.borderColor = jonyColors.border;
                          }
                        }}
                        title="Essentiell"
                      >
                        <Calculator className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickBudgetTypeChange(category.name, 'lifestyle')}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all duration-200 border-2"
                        style={{
                          backgroundColor: (quickBudgetTypes[category.name] || 'essentiell') === 'lifestyle'
                            ? jonyColors.accent2Alpha
                            : jonyColors.surface,
                          borderColor: (quickBudgetTypes[category.name] || 'essentiell') === 'lifestyle'
                            ? jonyColors.accent2
                            : jonyColors.border,
                          color: (quickBudgetTypes[category.name] || 'essentiell') === 'lifestyle'
                            ? jonyColors.accent2
                            : jonyColors.textSecondary,
                          transform: (quickBudgetTypes[category.name] || 'essentiell') === 'lifestyle' ? 'scale(1.1)' : 'scale(1)'
                        }}
                        onMouseEnter={(e) => {
                          if ((quickBudgetTypes[category.name] || 'essentiell') !== 'lifestyle') {
                            e.target.style.backgroundColor = jonyColors.accent2Alpha;
                            e.target.style.borderColor = jonyColors.accent2;
                          }
                        }}
                        onMouseLeave={(e) => {
                          if ((quickBudgetTypes[category.name] || 'essentiell') !== 'lifestyle') {
                            e.target.style.backgroundColor = jonyColors.surface;
                            e.target.style.borderColor = jonyColors.border;
                          }
                        }}
                        title="Unterhaltung"
                      >
                        <BarChart3 className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickBudgetTypeChange(category.name, 'sparen')}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all duration-200 border-2"
                        style={{
                          backgroundColor: (quickBudgetTypes[category.name] || 'essentiell') === 'sparen'
                            ? jonyColors.magentaAlpha
                            : jonyColors.surface,
                          borderColor: (quickBudgetTypes[category.name] || 'essentiell') === 'sparen'
                            ? jonyColors.magenta
                            : jonyColors.border,
                          color: (quickBudgetTypes[category.name] || 'essentiell') === 'sparen'
                            ? jonyColors.magenta
                            : jonyColors.textSecondary,
                          transform: (quickBudgetTypes[category.name] || 'essentiell') === 'sparen' ? 'scale(1.1)' : 'scale(1)'
                        }}
                        onMouseEnter={(e) => {
                          if ((quickBudgetTypes[category.name] || 'essentiell') !== 'sparen') {
                            e.target.style.backgroundColor = jonyColors.magentaAlpha;
                            e.target.style.borderColor = jonyColors.magenta;
                          }
                        }}
                        onMouseLeave={(e) => {
                          if ((quickBudgetTypes[category.name] || 'essentiell') !== 'sparen') {
                            e.target.style.backgroundColor = jonyColors.surface;
                            e.target.style.borderColor = jonyColors.border;
                          }
                        }}
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
          </div>
        )}

      {/* Create Budget Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="rounded-2xl max-w-md w-full p-6 shadow-xl" style={{ backgroundColor: jonyColors.surface }}>
            <h2 className="text-xl font-bold mb-6" style={{ color: jonyColors.textPrimary }}>Neues Budget</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: jonyColors.textPrimary }}>
                  Kategorie
                </label>
                <select
                  value={newBudget.category}
                  onChange={(e) => setNewBudget(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 transition-colors"
                  style={{
                    backgroundColor: jonyColors.cardBackground,
                    color: jonyColors.textPrimary,
                    borderColor: jonyColors.border,
                    '--tw-ring-color': jonyColors.accent1
                  }}
                >
                  <option value="">Kategorie wählen</option>
                  {availableCategoriesForModal.map(cat => (
                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: jonyColors.textPrimary }}>
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
                    className="w-full px-3 py-2 pr-8 border rounded-lg focus:ring-2 transition-colors"
                    style={{
                      backgroundColor: jonyColors.cardBackground,
                      color: jonyColors.textPrimary,
                      borderColor: jonyColors.border,
                      '--tw-ring-color': jonyColors.accent1
                    }}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: jonyColors.textTertiary }}>€</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: jonyColors.textPrimary }}>
                  Typ
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewBudget(prev => ({ ...prev, type: 'essentiell' }))}
                    className="px-3 py-2 text-sm rounded-lg border transition-colors"
                    style={{
                      backgroundColor: newBudget.type === 'essentiell' ? jonyColors.accent1Alpha : jonyColors.cardBackground,
                      borderColor: newBudget.type === 'essentiell' ? jonyColors.accent1 : jonyColors.border,
                      color: newBudget.type === 'essentiell' ? jonyColors.accent1 : jonyColors.textSecondary
                    }}
                    onMouseEnter={(e) => {
                      if (newBudget.type !== 'essentiell') {
                        e.target.style.backgroundColor = jonyColors.accent1Alpha;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (newBudget.type !== 'essentiell') {
                        e.target.style.backgroundColor = jonyColors.cardBackground;
                      }
                    }}
                  >
                    Essentiell
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewBudget(prev => ({ ...prev, type: 'lifestyle' }))}
                    className="px-3 py-2 text-sm rounded-lg border transition-colors"
                    style={{
                      backgroundColor: newBudget.type === 'lifestyle' ? jonyColors.accent2Alpha : jonyColors.cardBackground,
                      borderColor: newBudget.type === 'lifestyle' ? jonyColors.accent2 : jonyColors.border,
                      color: newBudget.type === 'lifestyle' ? jonyColors.accent2 : jonyColors.textSecondary
                    }}
                    onMouseEnter={(e) => {
                      if (newBudget.type !== 'lifestyle') {
                        e.target.style.backgroundColor = jonyColors.accent2Alpha;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (newBudget.type !== 'lifestyle') {
                        e.target.style.backgroundColor = jonyColors.cardBackground;
                      }
                    }}
                  >
                    Lifestyle
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewBudget(prev => ({ ...prev, type: 'sparen' }))}
                    className="px-3 py-2 text-sm rounded-lg border transition-colors"
                    style={{
                      backgroundColor: newBudget.type === 'sparen' ? jonyColors.magentaAlpha : jonyColors.cardBackground,
                      borderColor: newBudget.type === 'sparen' ? jonyColors.magenta : jonyColors.border,
                      color: newBudget.type === 'sparen' ? jonyColors.magenta : jonyColors.textSecondary
                    }}
                    onMouseEnter={(e) => {
                      if (newBudget.type !== 'sparen') {
                        e.target.style.backgroundColor = jonyColors.magentaAlpha;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (newBudget.type !== 'sparen') {
                        e.target.style.backgroundColor = jonyColors.cardBackground;
                      }
                    }}
                  >
                    Sparen
                  </button>
                </div>
              </div>

              {currentMonthlyIncome > 0 && newBudget.type && (
                <div className="rounded-lg p-3" style={{ backgroundColor: jonyColors.cardBackground }}>
                  <div className="text-xs" style={{ color: jonyColors.textSecondary }}>
                    Empfehlung ({newBudget.type === 'essentiell' ? '50%' : newBudget.type === 'lifestyle' ? '30%' : '20%'}): <span className="font-medium" style={{ color: jonyColors.textPrimary }}>{formatCurrency(currentMonthlyIncome * (newBudget.type === 'essentiell' ? 0.5 : newBudget.type === 'lifestyle' ? 0.3 : 0.2))}</span>
                  </div>
                  {newBudgetDisplayAmount && newBudgetDisplayAmount.startsWith('=') && (
                    <div className="text-xs mt-1">
                      <span style={{ color: jonyColors.textSecondary }}>Berechnet: </span>
                      <span className="font-medium" style={{ color: jonyColors.accent1 }}>
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
                className="flex-1 px-4 py-2 rounded-lg font-medium transition-colors"
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
                onClick={handleCreateBudget}
                disabled={!newBudget.category || (!newBudget.amount && !newBudgetDisplayAmount)}
                className="flex-1 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: jonyColors.accent1, color: jonyColors.background }}
                onMouseEnter={(e) => {
                  if (!e.target.disabled) {
                    e.target.style.backgroundColor = jonyColors.greenDark;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!e.target.disabled) {
                    e.target.style.backgroundColor = jonyColors.accent1;
                  }
                }}
              >
                Erstellen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Budget Modal */}
      {editingBudget && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="backdrop-blur-md rounded-3xl max-w-lg w-full p-8 shadow-2xl border" style={{
            backgroundColor: jonyColors.surfaceAlpha,
            border: `1px solid ${jonyColors.border}`
          }}>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg" style={{
                background: `linear-gradient(to bottom right, ${jonyColors.magenta}, ${jonyColors.magentaDark})`
              }}>
                <Edit className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold" style={{ color: jonyColors.textPrimary }}>
                  Budget bearbeiten
                </h2>
                <p className="text-sm" style={{ color: jonyColors.textSecondary }}>
                  {editingBudget.category} Budget anpassen
                </p>
              </div>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold mb-3" style={{ color: jonyColors.textPrimary }}>
                  Budget Betrag
                </label>
                <div className="relative">
                  <Euro className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: jonyColors.textTertiary }} />
                  <input
                    type="text"
                    value={editBudgetDisplayAmount || (editingBudget.amount ? editingBudget.amount.toString() : '')}
                    onChange={(e) => {
                      const value = e.target.value;
                      setEditBudgetDisplayAmount(value);
                      setEditingBudget(prev => ({ ...prev, amount: value }));
                    }}
                    className="w-full pl-12 pr-4 py-3 border-2 rounded-xl focus:ring-2 text-base font-medium transition-all duration-200"
                    style={{
                      backgroundColor: jonyColors.cardBackground,
                      color: jonyColors.textPrimary,
                      borderColor: jonyColors.border,
                      '--tw-ring-color': jonyColors.magenta
                    }}
                  />
                </div>
                <p className="text-xs mt-2" style={{ color: jonyColors.textSecondary }}>Geben Sie einen Betrag ein oder verwenden Sie Formeln wie =40+30+60</p>
                {editBudgetDisplayAmount && editBudgetDisplayAmount.startsWith('=') && (
                  <div className="text-xs mt-2">
                    <span style={{ color: jonyColors.textSecondary }}>Berechnet: </span>
                    <span className="font-medium" style={{ color: jonyColors.magenta }}>
                      {isNaN(evaluateFormula(editBudgetDisplayAmount)) ? 'Ungültige Formel' : formatCurrency(evaluateFormula(editBudgetDisplayAmount))}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold mb-3" style={{ color: jonyColors.textPrimary }}>
                  Zeitraum
                </label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: jonyColors.textTertiary }} />
                  <select
                    value={editingBudget.period}
                    onChange={(e) => setEditingBudget(prev => ({ ...prev, period: e.target.value }))}
                    className="w-full pl-12 pr-4 py-3 border-2 rounded-xl focus:ring-2 text-base font-medium transition-all duration-200"
                    style={{
                      backgroundColor: jonyColors.cardBackground,
                      color: jonyColors.textPrimary,
                      borderColor: jonyColors.border,
                      '--tw-ring-color': jonyColors.magenta
                    }}
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
                onClick={() => handleEditBudget(editingBudget)}
                className="flex-1 px-6 py-3 text-white rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl"
                style={{
                  background: `linear-gradient(to right, ${jonyColors.magenta}, ${jonyColors.magentaDark})`
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'scale(1.02)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'scale(1)';
                }}
              >
                Änderungen speichern
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Income Modal */}
      {showIncomeModal && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="backdrop-blur-md rounded-3xl max-w-lg w-full p-8 shadow-2xl border" style={{
            backgroundColor: jonyColors.surfaceAlpha,
            border: `1px solid ${jonyColors.border}`
          }}>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg" style={{
                background: `linear-gradient(to bottom right, ${jonyColors.accent2}, ${jonyColors.cyanDark})`
              }}>
                <Euro className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold" style={{ color: jonyColors.textPrimary }}>Monatseinkommen festlegen</h2>
                <p className="text-sm" style={{ color: jonyColors.textSecondary }}>
                  Für {currentDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold mb-3" style={{ color: jonyColors.textPrimary }}>
                  Erwartetes Einkommen
                </label>
                <div className="relative">
                  <Euro className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: jonyColors.textTertiary }} />
                  <input
                    type="number"
                    value={monthlyIncomeInput}
                    onChange={(e) => setMonthlyIncomeInput(e.target.value)}
                    placeholder="3000.00"
                    className="w-full pl-12 pr-4 py-3 border-2 rounded-xl focus:ring-2 text-base font-medium transition-all duration-200"
                    style={{
                      backgroundColor: jonyColors.cardBackground,
                      color: jonyColors.textPrimary,
                      borderColor: jonyColors.border,
                      '--tw-ring-color': jonyColors.accent2
                    }}
                  />
                </div>
                <p className="text-xs mt-2" style={{ color: jonyColors.textSecondary }}>
                  Dein voraussichtliches Nettoeinkommen für diesen Monat
                </p>
              </div>
              
              {summary.totalBudget > 0 && (
                <div className="rounded-xl p-4" style={{ backgroundColor: jonyColors.cardBackground }}>
                  <div className="text-sm font-semibold mb-2" style={{ color: jonyColors.textPrimary }}>
                    Budget Übersicht
                  </div>
                  <div className="flex justify-between text-sm" style={{ color: jonyColors.textSecondary }}>
                    <span>Gesamtbudget:</span>
                    <span className="font-medium">{formatCurrency(summary.totalBudget)}</span>
                  </div>
                  {monthlyIncomeInput && (
                    <div className="flex justify-between text-sm mt-1" style={{ color: jonyColors.textSecondary }}>
                      <span>Verbleibendes Einkommen:</span>
                      <span className="font-medium" style={{
                        color: (parseFloat(monthlyIncomeInput) - summary.totalBudget) >= 0 
                          ? jonyColors.accent2
                          : jonyColors.red
                      }}>
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
                onClick={handleSaveIncome}
                className="flex-1 px-6 py-3 text-white rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl"
                style={{
                  background: `linear-gradient(to right, ${jonyColors.accent2}, ${jonyColors.cyanDark})`
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'scale(1.02)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'scale(1)';
                }}
              >
                Einkommen speichern
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete All Budgets Modal */}
      {showDeleteAllModal && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="backdrop-blur-md rounded-3xl max-w-lg w-full p-8 shadow-2xl border" style={{
            backgroundColor: jonyColors.surfaceAlpha,
            border: `1px solid ${jonyColors.border}`
          }}>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg" style={{
                background: `linear-gradient(to bottom right, ${jonyColors.red}, ${jonyColors.redDark})`
              }}>
                <Trash2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold" style={{ color: jonyColors.textPrimary }}>Alle Budgets löschen</h2>
                <p className="text-sm" style={{ color: jonyColors.textSecondary }}>
                  Komplett neu anfangen mit der Budget-Planung
                </p>
              </div>
            </div>
            
            <div className="space-y-6">
              <div className="rounded-xl p-4 border" style={{
                backgroundColor: jonyColors.redAlpha,
                border: `1px solid ${jonyColors.red}`
              }}>
                <div className="flex items-center gap-3 mb-3">
                  <AlertTriangle className="w-5 h-5" style={{ color: jonyColors.red }} />
                  <div className="text-sm font-semibold" style={{ color: jonyColors.textPrimary }}>
                    Achtung: Diese Aktion kann nicht rückgängig gemacht werden
                  </div>
                </div>
                <ul className="space-y-2 text-sm" style={{ color: jonyColors.textPrimary }}>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: jonyColors.red }} />
                    Alle {budgets.length} Budget-Kategorien werden gelöscht
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: jonyColors.red }} />
                    Das geplante Einkommen für diesen Monat wird entfernt
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: jonyColors.red }} />
                    Du kannst danach komplett neu mit der Budget-Planung beginnen
                  </li>
                </ul>
              </div>
            </div>

            <div className="flex gap-4 mt-8">
              <button
                onClick={() => setShowDeleteAllModal(false)}
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
                onClick={handleDeleteAllBudgets}
                className="flex-1 px-6 py-3 text-white rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl"
                style={{
                  background: `linear-gradient(to right, ${jonyColors.red}, ${jonyColors.redDark})`
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'scale(1.02)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'scale(1)';
                }}
              >
                Alle Budgets löschen
              </button>
            </div>
          </div>
        </div>
      )}

        </div>
      </div>
    </div>
  );
};

export default BudgetPage;