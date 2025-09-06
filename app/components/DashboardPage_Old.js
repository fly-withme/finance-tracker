"use client";

import React, { useMemo, useRef, useState, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, LineChart, Line } from 'recharts';
import { UploadCloud, Loader2, TrendingDown, ChevronLeft, ChevronRight, BarChart3, PieChart as PieChartIcon, Target, AlertTriangle, Repeat, PiggyBank, X, Plus } from 'lucide-react';
// Removed Card import - using custom cyberpunk cards
import { bankStatementParser } from '../utils/pdfParser';
import { db } from '../utils/db';
import { uploadLogger } from '../utils/uploadLogger';

const formatCurrency = (amount) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);

// Modern Minimalist Color Palette
const modernColors = {
  // Backgrounds
  background: '#fafafa',
  surface: '#ffffff',
  surfaceSecondary: '#f8fafc',
  secondary: '#f8fafc',
  
  // Text
  textPrimary: '#1e293b',
  textSecondary: '#64748b',
  textTertiary: '#94a3b8',
  
  // Accent colors
  primary: '#0f172a',
  accent: '#3b82f6',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  
  // Borders
  border: '#e2e8f0',
  borderLight: '#f1f5f9',
  
  // Subtle backgrounds
  gray50: '#f8fafc',
  gray100: '#f1f5f9',
  gray200: '#e2e8f0'
};

// Custom Tooltip for Charts
const CustomBarTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div 
        className="p-3 rounded-lg shadow-lg border"
        style={{
          backgroundColor: modernColors.surface,
          borderColor: modernColors.border,
          boxShadow: '0 10px 25px -3px rgb(0 0 0 / 0.1)'
        }}
      >
        <p className="text-sm font-semibold mb-2" style={{ color: modernColors.textPrimary }}>{`${label}`}</p>
        {payload[0] && (
          <p className="flex items-center text-sm mb-1" style={{ color: modernColors.accent }}>
            <span className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: modernColors.accent }}></span>
            Income: {formatCurrency(payload[0].value)}
          </p>
        )}
        {payload[1] && (
          <p className="flex items-center text-sm" style={{ color: modernColors.warning }}>
            <span className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: modernColors.warning }}></span>
            Expenses: {formatCurrency(payload[1].value)}
          </p>
        )}
      </div>
    );
  }
  return null;
};

const CustomAreaTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div 
        className="p-3 rounded-lg shadow-lg border"
        style={{
          backgroundColor: modernColors.surface,
          borderColor: modernColors.border,
          boxShadow: '0 10px 25px -3px rgb(0 0 0 / 0.1)'
        }}
      >
        <p className="text-sm font-semibold mb-1" style={{ color: modernColors.textPrimary }}>Day {label}</p>
        <p className="flex items-center text-sm" style={{ color: modernColors.warning }}>
          <span className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: modernColors.warning }}></span>
          Expenses: {formatCurrency(payload[0].value)}
        </p>
      </div>
    );
  }
  return null;
};

// Removed savings tooltip as savings rate is now displayed in dedicated card


// Removed complex pie chart shapes for simplified design

// Main Dashboard Component
const DashboardPage = ({ setPage }) => {
  const transactions = useLiveQuery(() => db.transactions.orderBy('date').reverse().toArray(), []) || [];
  const budgets = useLiveQuery(() => db.budgets.toArray(), []) || [];
  const userSettings = useLiveQuery(() => db.settings.get('userProfile'), []) || {};
  const categories = useLiveQuery(() => db.categories.toArray(), []) || [];
  const debts = useLiveQuery(() => db.debts.toArray(), []) || [];
  const savingsGoals = useLiveQuery(() => db.savingsGoals.toArray(), []) || [];

  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [processingStage, setProcessingStage] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState(null);
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  // Removed unused state variables for simplified design
  const [showAddSubscriptionModal, setShowAddSubscriptionModal] = useState(false);
  const [newSubscription, setNewSubscription] = useState({
    name: '',
    amount: '',
    startDate: ''
  });

  // Removed pie chart interaction callbacks for simplified design


  // --- TOP CARDS DATA ---
  const { totalBalance, monthlyIncome, monthlyExpense } = useMemo(() => {
    if (!transactions || transactions.length === 0) return { totalBalance: 0, monthlyIncome: 0, monthlyExpense: 0 };
    const balance = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    const month = currentMonth.getMonth();
    const year = currentMonth.getFullYear();
    let currentMonthIncome = 0;
    let currentMonthExpense = 0;
    transactions.forEach(t => {
      const tDate = new Date(t.date);
      if (tDate.getMonth() === month && tDate.getFullYear() === year) {
        if (t.amount > 0) currentMonthIncome += t.amount;
        else currentMonthExpense += Math.abs(t.amount);
      }
    });
    return { totalBalance: balance, monthlyIncome: currentMonthIncome, monthlyExpense: currentMonthExpense };
  }, [transactions, currentMonth]);
  
  // --- GRAPH 1: ANNUAL OVERVIEW ---
  const annualData = useMemo(() => {
    const year = currentMonth.getFullYear();
    const months = Array.from({ length: 12 }, (_, i) => ({ 
      name: new Date(year, i, 1).toLocaleString('de-DE', { month: 'short' }), 
      income: 0, 
      expense: 0 
    }));
    transactions.forEach(t => {
      const tDate = new Date(t.date);
      if (tDate.getFullYear() === year) {
        const monthData = months[tDate.getMonth()];
        if (t.amount > 0) monthData.income += t.amount;
        else monthData.expense += Math.abs(t.amount);
      }
    });
    return months;
  }, [transactions, currentMonth]);

  // --- SIMPLIFIED SPENDING ANALYSIS ---
  const categorySpendingData = useMemo(() => {
    const month = currentMonth.getMonth();
    const year = currentMonth.getFullYear();

    const spending = transactions
      .filter(t => new Date(t.date).getFullYear() === year && new Date(t.date).getMonth() === month && t.amount < 0)
      .reduce((acc, t) => {
        const categoryName = t.category || 'Unkategorisiert';
        
        // Finde die Kategorie in der Datenbank
        const category = categories.find(cat => cat.name === categoryName);
        
        let displayCategory;
        if (category && category.parentId) {
          // Wenn es eine Unterkategorie ist, finde die Hauptkategorie
          const parentCategory = categories.find(cat => cat.id === category.parentId);
          displayCategory = parentCategory ? parentCategory.name : categoryName;
        } else {
          // Wenn es eine Hauptkategorie oder unkategorisiert ist
          displayCategory = categoryName;
        }
        
        acc[displayCategory] = (acc[displayCategory] || 0) + Math.abs(t.amount);
        return acc;
      }, {});
      
    return Object.entries(spending)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [transactions, currentMonth, categories]);
  
  // --- GRAPH 3: BUDGET VS ACTUAL ---
  const budgetVsActualData = useMemo(() => {
    if (!budgets || budgets.length === 0) return [];
    const month = currentMonth.getMonth();
    const year = currentMonth.getFullYear();
    const monthlyTransactions = transactions.filter(t => {
      const tDate = new Date(t.date);
      return tDate.getMonth() === month && tDate.getFullYear() === year && t.amount < 0;
    });

    return budgets.map(budget => {
      const actual = monthlyTransactions
        .filter(t => t.category === budget.categoryName)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
      return {
        name: budget.categoryName,
        actual,
        budget: budget.amount,
        progress: Math.min((actual / budget.amount) * 100, 100)
      };
    }).sort((a, b) => (b.actual / b.budget) - (a.actual / a.budget));
  }, [transactions, budgets, currentMonth]);

  // --- GRAPH 4: DAILY SPENDING BEHAVIOR ---
  const dailySpendingData = useMemo(() => {
      const month = currentMonth.getMonth();
      const year = currentMonth.getFullYear();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const dailyData = Array.from({ length: daysInMonth }, (_, i) => ({ day: i + 1, expense: 0 }));

      transactions
          .filter(t => {
              const tDate = new Date(t.date);
              return tDate.getFullYear() === year && tDate.getMonth() === month && t.amount < 0;
          })
          .forEach(t => {
              const dayOfMonth = new Date(t.date).getDate();
              dailyData[dayOfMonth - 1].expense += Math.abs(t.amount);
          });

      return dailyData;
  }, [transactions, currentMonth]);

  // --- SUBSCRIPTIONS DATA ---
  const allSubscriptions = useLiveQuery(() => db.subscriptions.orderBy('name').toArray(), []);
  
  // Auto-detect and save new subscriptions
  const detectNewSubscriptions = useCallback(async () => {
    if (!transactions || !allSubscriptions) return;
    
    const detectionKeywords = ['netflix', 'spotify', 'amazon prime', 'disney', 'apple music', 'youtube premium', 'office 365', 'adobe'];
    
    const potentialSubscriptions = transactions
      .filter(t => {
        const isExpense = t.amount < 0;
        const matchesCategory = t.category?.toLowerCase().includes('abo') || 
                               t.category?.toLowerCase().includes('abos') ||
                               t.category?.toLowerCase().includes('subscription');
        const matchesKeywords = detectionKeywords.some(keyword => 
          t.recipient?.toLowerCase().includes(keyword) ||
          t.description?.toLowerCase().includes(keyword)
        );
        
        return isExpense && (matchesCategory || matchesKeywords);
      })
      .reduce((acc, t) => {
        const name = t.recipient || t.description || 'Unbekanntes Abo';
        const cleanName = name.replace(/\d{2}\.\d{2}\.\d{4}|\d{4}-\d{2}-\d{2}/g, '').trim();
        
        if (!acc[cleanName]) {
          acc[cleanName] = {
            name: cleanName,
            amount: Math.abs(t.amount),
            detectedFrom: t.id,
            lastSeen: t.date
          };
        } else if (new Date(t.date) > new Date(acc[cleanName].lastSeen)) {
          acc[cleanName].lastSeen = t.date;
          acc[cleanName].amount = Math.abs(t.amount);
        }
        
        return acc;
      }, {});
    
    // Save new subscriptions to database
    for (const sub of Object.values(potentialSubscriptions)) {
      const existing = allSubscriptions?.find(s => s.name.toLowerCase() === sub.name.toLowerCase());
      if (!existing && sub.name !== 'Unbekanntes Abo') {
        try {
          await db.subscriptions.add({
            name: sub.name,
            amount: sub.amount,
            isActive: true,
            detectedFrom: sub.detectedFrom,
            lastSeen: sub.lastSeen,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        } catch (error) {
          console.error('Error adding subscription:', error);
        }
      } else if (existing) {
        // Update existing subscription with latest data
        if (new Date(sub.lastSeen) > new Date(existing.lastSeen)) {
          await db.subscriptions.update(existing.id, {
            amount: sub.amount,
            lastSeen: sub.lastSeen,
            updatedAt: new Date().toISOString()
          });
        }
      }
    }
  }, [transactions, allSubscriptions]);
  
  React.useEffect(() => {
    detectNewSubscriptions();
  }, [detectNewSubscriptions]);
  
  const activeSubscriptions = useMemo(() => {
    return allSubscriptions?.filter(sub => sub.isActive) || [];
  }, [allSubscriptions]);
  
  const totalSubscriptionCost = useMemo(() => {
    return activeSubscriptions.reduce((sum, sub) => sum + sub.amount, 0);
  }, [activeSubscriptions]);
  
  const toggleSubscription = async (id, isActive) => {
    try {
      await db.subscriptions.update(id, {
        isActive: !isActive,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error updating subscription:', error);
    }
  };
  
  const deleteSubscription = async (id) => {
    try {
      await db.subscriptions.delete(id);
    } catch (error) {
      console.error('Error deleting subscription:', error);
    }
  };
  
  const addCustomSubscription = async () => {
    if (!newSubscription.name || !newSubscription.amount) return;
    
    try {
      await db.subscriptions.add({
        name: newSubscription.name.trim(),
        amount: parseFloat(newSubscription.amount),
        isActive: true,
        detectedFrom: null,
        lastSeen: newSubscription.startDate || new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      // Reset form
      setNewSubscription({
        name: '',
        amount: '',
        startDate: ''
      });
      setShowAddSubscriptionModal(false);
    } catch (error) {
      console.error('Error adding custom subscription:', error);
    }
  };

  // --- SAVINGS RATE DATA ---
  const savingsRateData = useMemo(() => {
    // Erstelle Daten für das aktuelle Jahr (Januar bis aktueller Monat)
    const months = [];
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-basiert (0 = Januar)
    
    // Von Januar (0) bis zum aktuellen Monat
    for (let i = 0; i <= currentMonth; i++) {
      const date = new Date(currentYear, i, 1);
      const monthName = date.toLocaleString('de-DE', { month: 'short' });
      
      months.push({
        month: monthName,
        fullDate: date,
        savings: 0,
        income: 0,
        savingsRate: 0
      });
    }

    // Berechne Sparrate für jeden Monat
    transactions.forEach(transaction => {
      const transactionDate = new Date(transaction.date);
      const transactionMonth = transactionDate.toISOString().substring(0, 7);
      
      // Finde den entsprechenden Monat
      const monthData = months.find(m => m.fullDate.toISOString().substring(0, 7) === transactionMonth);
      if (!monthData) return;

      // Klassifiziere als Sparen wenn:
      // 1. Kategorie enthält "Spar", "Anlage", "Investment", "Rücklage"
      // 2. Oder Empfänger/Beschreibung deutet auf Sparen hin
      const category = transaction.category?.toLowerCase() || '';
      const recipient = transaction.recipient?.toLowerCase() || '';
      const description = transaction.description?.toLowerCase() || '';
      
      const isSavings = category.includes('spar') || 
                       category.includes('anlage') || 
                       category.includes('investment') || 
                       category.includes('rücklage') || 
                       category.includes('tagesgeld') ||
                       category.includes('festgeld') ||
                       recipient.includes('depot') ||
                       recipient.includes('tagesgeld') ||
                       recipient.includes('festgeld') ||
                       description.includes('spar') ||
                       description.includes('anlage');
      
      if (isSavings && transaction.amount < 0) {
        // Negative Beträge = Geld wird gespart
        monthData.savings += Math.abs(transaction.amount);
      } else if (transaction.amount > 0) {
        // Positive Beträge = Einkommen
        monthData.income += transaction.amount;
      }
    });

    // Berechne Sparrate in Prozent
    months.forEach(month => {
      if (month.income > 0) {
        month.savingsRate = (month.savings / month.income) * 100;
      }
    });

    return months;
  }, [transactions]);

  // --- DEBT DATA ---
  const debtData = useMemo(() => {
    if (!debts || debts.length === 0) return null;

    const totalDebt = debts.reduce((sum, debt) => sum + (parseFloat(debt.currentAmount) || 0), 0);
    const totalOriginalAmount = debts.reduce((sum, debt) => sum + (parseFloat(debt.totalAmount) || 0), 0);
    const totalPaid = totalOriginalAmount - totalDebt;
    const totalMonthlyPayments = debts.reduce((sum, debt) => sum + (parseFloat(debt.monthlyPayment) || 0), 0);
    
    // Calculate weighted average payoff time
    let weightedMonthsTotal = 0;
    let totalWeights = 0;
    
    debts.forEach(debt => {
      const remainingAmount = parseFloat(debt.currentAmount) || 0;
      const monthlyPayment = parseFloat(debt.monthlyPayment) || 0;
      const interestRate = parseFloat(debt.interestRate) || 0;
      
      if (monthlyPayment > 0 && remainingAmount > 0) {
        let monthsRemaining = 0;
        
        if (interestRate > 0) {
          const monthlyInterestRate = interestRate / 100 / 12;
          if (monthlyPayment > remainingAmount * monthlyInterestRate) {
            monthsRemaining = Math.ceil(
              Math.log(1 + (remainingAmount * monthlyInterestRate) / monthlyPayment) /
              Math.log(1 + monthlyInterestRate)
            );
          } else {
            monthsRemaining = 999; // Never ending
          }
        } else {
          monthsRemaining = Math.ceil(remainingAmount / monthlyPayment);
        }
        
        if (monthsRemaining < 999) {
          weightedMonthsTotal += monthsRemaining * remainingAmount;
          totalWeights += remainingAmount;
        }
      }
    });
    
    const averageMonthsRemaining = totalWeights > 0 ? Math.round(weightedMonthsTotal / totalWeights) : 0;
    const averageYearsRemaining = Math.floor(averageMonthsRemaining / 12);
    const averageMonthsDisplay = averageMonthsRemaining % 12;
    
    // Calculate debt progress for chart
    const progressPercentage = totalOriginalAmount > 0 ? (totalPaid / totalOriginalAmount) * 100 : 0;
    
    // Prepare data for visualization
    const chartData = debts.map(debt => {
      const total = parseFloat(debt.totalAmount) || 0;
      const current = parseFloat(debt.currentAmount) || 0;
      const paid = total - current;
      
      return {
        name: debt.name,
        paid: paid,
        remaining: current,
        total: total,
        progressPercentage: total > 0 ? (paid / total) * 100 : 0
      };
    }).sort((a, b) => b.total - a.total);

    return {
      totalDebt,
      totalOriginalAmount,
      totalPaid,
      totalMonthlyPayments,
      progressPercentage,
      averageMonthsRemaining,
      averageYearsRemaining,
      averageMonthsDisplay,
      chartData,
      debtCount: debts.length
    };
  }, [debts]);

  // Calculate savings goals data for dashboard
  const savingsGoalsData = useMemo(() => {
    if (!savingsGoals || savingsGoals.length === 0) return null;

    const totalTarget = savingsGoals.reduce((sum, goal) => sum + (parseFloat(goal.targetAmount) || 0), 0);
    const totalSaved = savingsGoals.reduce((sum, goal) => sum + (parseFloat(goal.currentAmount) || 0), 0);
    const totalMonthly = savingsGoals.reduce((sum, goal) => sum + (parseFloat(goal.monthlyAmount) || 0), 0);

    const progressPercentage = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;

    const chartData = savingsGoals.map(goal => {
      const target = parseFloat(goal.targetAmount) || 0;
      const current = parseFloat(goal.currentAmount) || 0;
      const progress = target > 0 ? (current / target) * 100 : 0;

      return {
        name: goal.title,
        target,
        current,
        remaining: Math.max(0, target - current),
        progressPercentage: progress
      };
    });

    return {
      totalTarget,
      totalSaved,
      totalRemaining: Math.max(0, totalTarget - totalSaved),
      progressPercentage,
      totalMonthly,
      chartData,
      goalsCount: savingsGoals.length
    };
  }, [savingsGoals]);

  // Calculate Financial Independence Metrics
  const fiMetrics = useMemo(() => {
    const userProfile = userSettings?.value;
    if (!userProfile || !userProfile.age || !userProfile.annualIncome) return null;

    const age = userProfile.age;
    const annualIncome = userProfile.annualIncome;
    const monthlyExpensesGoal = userProfile.monthlyExpenses || 0;
    
    // Calculate expected net worth (Finanz-Alter)
    const expectedNetWorth = (age * annualIncome) / 10;
    const actualNetWorth = totalBalance;
    
    // Calculate financial age
    let financialAge;
    let percentageOverExpected;
    
    if (expectedNetWorth > 0) {
      const ratio = actualNetWorth / expectedNetWorth;
      financialAge = Math.round(age * ratio);
      percentageOverExpected = ((actualNetWorth - expectedNetWorth) / expectedNetWorth) * 100;
    } else {
      financialAge = age;
      percentageOverExpected = 0;
    }
    
    // Calculate FI Number (25x rule)
    const fiNumber = monthlyExpensesGoal * 12 * 25;
    const fiProgress = fiNumber > 0 ? (actualNetWorth / fiNumber) * 100 : 0;
    
    // Calculate years to FI (simplified calculation)
    let yearsToFI = null;
    if (fiNumber > 0 && monthlyIncome > monthlyExpense) {
      const monthlySavings = monthlyIncome - monthlyExpense;
      const annualSavings = monthlySavings * 12;
      
      if (annualSavings > 0) {
        // Simple calculation assuming 7% annual return
        const annualReturn = 0.07;
        let currentAmount = actualNetWorth;
        let years = 0;
        
        // Iterative calculation to find years to reach FI number
        while (currentAmount < fiNumber && years < 100) {
          currentAmount = currentAmount * (1 + annualReturn) + annualSavings;
          years++;
        }
        
        yearsToFI = years < 100 ? years : null;
      }
    }
    
    return {
      // Finanz-Alter
      financialAge,
      actualAge: age,
      percentageOverExpected,
      expectedNetWorth,
      actualNetWorth,
      isAboveExpected: actualNetWorth >= expectedNetWorth,
      
      // FI-Zahl
      fiNumber,
      fiProgress: Math.min(fiProgress, 100),
      monthlyExpensesGoal,
      
      // Zeit zur FI
      yearsToFI,
      monthlySavingsRate: monthlyIncome > monthlyExpense ? monthlyIncome - monthlyExpense : 0
    };
  }, [userSettings, totalBalance, monthlyIncome, monthlyExpense]);

  // Enhanced Dashboard Metrics
  const dashboardMetrics = useMemo(() => {
    // Calculate savings rate
    const savingsRate = monthlyIncome > 0 ? ((monthlyIncome - monthlyExpense) / monthlyIncome) * 100 : 0;
    const monthlySavings = monthlyIncome - monthlyExpense;
    
    // Calculate Finanz-Score based on multiple criteria
    const calculateFinanzScore = () => {
      if (!userSettings?.value?.age) return 'C';
      
      const age = userSettings.value.age;
      let score = 0;
      
      // Savings rate criteria
      if (savingsRate >= 20) score += 3;
      else if (savingsRate >= 10) score += 2;
      else if (savingsRate >= 5) score += 1;
      
      // Net worth criteria (compared to age-based expected)
      if (fiMetrics?.isAboveExpected) score += 2;
      else score += 1;
      
      // Emergency fund criteria
      const emergencyFundMonths = monthlyExpense > 0 ? Math.max(0, totalBalance) / monthlyExpense : 0;
      if (emergencyFundMonths >= 6) score += 2;
      else if (emergencyFundMonths >= 3) score += 1;
      
      // Debt criteria
      const totalDebt = debtData?.totalDebt || 0;
      const totalAssets = Math.max(totalBalance, 0);
      const debtRatio = totalAssets > 0 ? (totalDebt / (totalAssets + totalDebt)) * 100 : 0;
      
      if (debtRatio <= 30) score += 2;
      else if (debtRatio <= 60) score += 1;
      
      // Convert score to letter grade
      if (score >= 8) return 'A';
      else if (score >= 5) return 'B';
      else return 'C';
    };
    
    return {
      savingsRate: Math.max(0, savingsRate),
      monthlySavings,
      netWorth: totalBalance,
      finanzScore: calculateFinanzScore(),
      cashflowPositive: monthlyIncome > monthlyExpense,
      emergencyFundMonths: monthlyExpense > 0 ? Math.max(0, totalBalance) / monthlyExpense : 0
    };
  }, [monthlyIncome, monthlyExpense, totalBalance, debtData, fiMetrics, userSettings]);

  const changeMonth = (offset) => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + offset);
      return newDate;
    });
  };

  const triggerFileUpload = () => fileInputRef.current?.click();
  
  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    uploadLogger.startSession(file.name);
    setIsUploading(true);
    setProcessingStage('Datei wird analysiert...');
    setUploadSuccess(null);
    try {
      const parsedTransactions = await bankStatementParser.parseFile(file, setProcessingStage);
      if (parsedTransactions.length === 0) throw new Error('Keine Transaktionen in der Datei gefunden.');
      setProcessingStage(`Speichere ${parsedTransactions.length} Transaktionen...`);
      await db.inbox.bulkAdd(parsedTransactions.map(t => ({ ...t, uploadedAt: new Date().toISOString(), skipped: 0 })));
      setUploadSuccess(`${parsedTransactions.length} Transaktionen erfolgreich importiert!`);
      uploadLogger.endSession(true);
    } catch (error) {
      console.error('Upload error:', error);
      setUploadSuccess(`Fehler: ${error.message}`);
      uploadLogger.log('ERROR', `Upload-Fehler: ${error.message}`, error);
      uploadLogger.endSession(false);
    } finally {
      setIsUploading(false);
      setProcessingStage('');
      event.target.value = '';
      setTimeout(() => setUploadSuccess(null), 5000);
    }
  };

  const chartColors = [modernColors.accent, modernColors.success, modernColors.warning, '#8b5cf6', '#f59e0b', '#ef4444'];

  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: modernColors.background, color: modernColors.textPrimary }}>
      {/* Modern Clean Header */}
      <div className="px-6 py-8 mb-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-semibold" style={{ color: modernColors.textPrimary }}>
                Welcome back, {userSettings?.value?.userName || 'User'}
              </h1>
              <p className="text-base mt-1" style={{ color: modernColors.textSecondary }}>
                Here's your financial overview
              </p>
            </div>
            
            <div className="flex items-center gap-6">
              {/* Month Navigation */}
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => changeMonth(-1)} 
                  className="w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-200 hover:bg-gray-100"
                  style={{ 
                    backgroundColor: modernColors.surface,
                    border: `1px solid ${modernColors.border}`,
                    color: modernColors.textSecondary
                  }}
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                
                <div className="px-4 py-2 min-w-[160px] text-center">
                  <span className="font-semibold text-lg" style={{ color: modernColors.textPrimary }}>
                    {currentMonth.toLocaleString('de-DE', { month: 'long', year: 'numeric' })}
                  </span>
                </div>
                
                <button 
                  onClick={() => changeMonth(1)} 
                  className="w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-200 hover:bg-gray-100"
                  style={{ 
                    backgroundColor: modernColors.surface,
                    border: `1px solid ${modernColors.border}`,
                    color: modernColors.textSecondary
                  }}
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
              
              {/* Upload Button */}
              <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileUpload} className="hidden" />
              <button 
                onClick={triggerFileUpload} 
                disabled={isUploading} 
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: modernColors.accent,
                  color: '#ffffff'
                }}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> 
                    Processing...
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-4 h-4" /> 
                    Upload
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {(isUploading || uploadSuccess) && (
        <div className="px-6 mb-6">
          <div className="max-w-7xl mx-auto">
            <div className="p-4 rounded-xl text-sm" style={{
              backgroundColor: isUploading ? modernColors.gray50 : (uploadSuccess?.includes('Fehler') ? '#fef2f2' : '#f0fdf4'),
              border: `1px solid ${isUploading ? modernColors.border : (uploadSuccess?.includes('Fehler') ? '#fecaca' : '#bbf7d0')}`,
              color: isUploading ? modernColors.textSecondary : (uploadSuccess?.includes('Fehler') ? modernColors.error : modernColors.success)
            }}>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{
                  backgroundColor: isUploading ? modernColors.warning : (uploadSuccess?.includes('Fehler') ? modernColors.error : modernColors.success)
                }}></div>
                {isUploading ? processingStage : uploadSuccess}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 1. DEIN STATUS & FORTSCHRITT */}
      <div className="px-6 mb-12">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h2 className="text-2xl font-bold" style={{ color: modernColors.textPrimary }}>
              Dein Status & Fortschritt
            </h2>
            <p className="text-sm mt-2" style={{ color: modernColors.textSecondary }}>
              Die wichtigsten, motivierenden Kennzahlen auf einen Blick
            </p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Nettovermögen with Line Chart */}
            <div 
              className="group p-6 rounded-2xl transition-all duration-200 hover:shadow-lg relative cursor-pointer"
              style={{
                backgroundColor: modernColors.surface,
                border: `1px solid ${modernColors.border}`,
                boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)'
              }}
            >
              <h3 className="font-semibold mb-4" style={{ color: modernColors.textPrimary }}>
                Nettovermögen
              </h3>
              <div className="text-4xl font-bold mb-4" style={{ color: totalBalance >= 0 ? modernColors.success : modernColors.error }}>
                {formatCurrency(totalBalance)}
              </div>
              
              {/* Simple line visualization */}
              <div className="w-full h-20 mb-4" style={{ backgroundColor: modernColors.gray50 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={annualData.slice(-6)} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                    <defs>
                      <linearGradient id="netWorthArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={modernColors.accent} stopOpacity={0.3}/>
                        <stop offset="100%" stopColor={modernColors.accent} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Area 
                      type="monotone" 
                      dataKey="income" 
                      stroke={modernColors.accent} 
                      strokeWidth={2} 
                      fill="url(#netWorthArea)"
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              
              <div className="text-sm" style={{ color: modernColors.textSecondary }}>
                {dashboardMetrics.monthlySavings >= 0 ? `+${formatCurrency(dashboardMetrics.monthlySavings)}` : formatCurrency(dashboardMetrics.monthlySavings)} zum Vormonat
              </div>
            </div>

            {/* Finanz-Score */}
            <div 
              className="group p-6 rounded-2xl transition-all duration-200 hover:shadow-lg relative cursor-pointer"
              style={{
                backgroundColor: modernColors.surface,
                border: `1px solid ${modernColors.border}`,
                boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)'
              }}
              title="Finanz-Score basiert auf Sparquote, Nettovermögen, Notgroschen und Schuldenstand"
            >
              <h3 className="font-semibold mb-4" style={{ color: modernColors.textPrimary }}>
                Dein Finanz-Score
              </h3>
              <div className="text-6xl font-bold mb-4" style={{ 
                color: dashboardMetrics.finanzScore === 'A' ? modernColors.success : 
                       dashboardMetrics.finanzScore === 'B' ? modernColors.warning : modernColors.error 
              }}>
                {dashboardMetrics.finanzScore}
              </div>
              <div className="text-sm" style={{ color: modernColors.textSecondary }}>
                Im Vergleich zu {userSettings?.value?.age || 30}-Jährigen
              </div>
              
              {/* Tooltip */}
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 p-3 bg-slate-800 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10 pointer-events-none whitespace-nowrap">
                <div className="font-semibold mb-1">Score-Kriterien:</div>
                <div>A = Top 10% (Excellent)</div>
                <div>B = Top 50% (Gut)</div>  
                <div>C = Durchschnitt</div>
                <div className="mt-1 text-slate-300">Basiert auf Sparquote, Nettovermögen, Notgroschen, Schulden</div>
              </div>
            </div>

            {/* Wegzeit zur FI */}
            <div 
              className="group p-6 rounded-2xl transition-all duration-200 hover:shadow-lg relative cursor-pointer"
              style={{
                backgroundColor: modernColors.surface,
                border: `1px solid ${modernColors.border}`,
                boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)'
              }}
              title="Geschätzte Zeit bis zur finanziellen Unabhängigkeit"
            >
              <h3 className="font-semibold mb-4" style={{ color: modernColors.textPrimary }}>
                Weg zur Freiheit
              </h3>
              <div className="text-4xl font-bold mb-4" style={{ 
                color: (fiMetrics?.yearsToFI !== null && fiMetrics?.yearsToFI !== undefined) ? modernColors.accent : modernColors.textSecondary 
              }}>
                {(fiMetrics?.yearsToFI !== null && fiMetrics?.yearsToFI !== undefined) ? `${fiMetrics.yearsToFI} Jahre` : 'Noch nicht berechenbar'}
              </div>
              <div className="text-sm" style={{ color: modernColors.textSecondary }}>
                Geschätzte Zeit bis zur finanziellen Unabhängigkeit
              </div>
              
              {/* Tooltip */}
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 p-3 bg-slate-800 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10 pointer-events-none whitespace-nowrap">
                <div className="font-semibold mb-1">Änderungen bei Sparrate:</div>
                <div>+5% Sparrate: {(fiMetrics?.yearsToFI !== null && fiMetrics?.yearsToFI !== undefined) ? Math.max(0, fiMetrics.yearsToFI - 2) : 'N/A'} Jahre</div>
                <div>+10% Sparrate: {(fiMetrics?.yearsToFI !== null && fiMetrics?.yearsToFI !== undefined) ? Math.max(0, fiMetrics.yearsToFI - 4) : 'N/A'} Jahre</div>
                <div className="mt-1 text-slate-300">Basierend auf 7% jährlicher Rendite</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. DEIN MONATLICHER ÜBERBLICK */}
      <div className="px-6 mb-12">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h2 className="text-2xl font-bold" style={{ color: modernColors.textPrimary }}>
              Dein monatlicher Überblick
            </h2>
            <p className="text-sm mt-2" style={{ color: modernColors.textSecondary }}>
              Monatliche Performance und Verhalten visualisiert
            </p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Monats-Cashflow */}
            <div 
              className="p-6 rounded-2xl"
              style={{
                backgroundColor: modernColors.surface,
                border: `1px solid ${modernColors.border}`,
                boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)'
              }}
            >
              <h3 className="font-semibold mb-4" style={{ color: modernColors.textPrimary }}>
                Monats-Cashflow
              </h3>
              
              <div className="w-full h-32 mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[{name: 'Aktuell', income: monthlyIncome, expense: monthlyExpense}]} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                    <XAxis dataKey="name" hide />
                    <YAxis hide />
                    <Tooltip 
                      formatter={(value, name) => [formatCurrency(value), name === 'income' ? 'Einnahmen' : 'Ausgaben']}
                      labelStyle={{ color: modernColors.textPrimary }}
                    />
                    <Bar dataKey="income" fill={modernColors.success} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expense" fill={modernColors.error} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              
              <div className="flex justify-between text-sm">
                <span style={{ color: modernColors.success }}>
                  Einnahmen: {formatCurrency(monthlyIncome)}
                </span>
                <span style={{ color: modernColors.error }}>
                  Ausgaben: {formatCurrency(monthlyExpense)}
                </span>
              </div>
              <div className="mt-2 text-center font-semibold" style={{ 
                color: dashboardMetrics.cashflowPositive ? modernColors.success : modernColors.error 
              }}>
                Saldo: {formatCurrency(monthlyIncome - monthlyExpense)}
              </div>
            </div>

            {/* Sparquote Donut */}
            <div 
              className="p-6 rounded-2xl"
              style={{
                backgroundColor: modernColors.surface,
                border: `1px solid ${modernColors.border}`,
                boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)'
              }}
            >
              <h3 className="font-semibold mb-4" style={{ color: modernColors.textPrimary }}>
                Sparquote
              </h3>
              
              {/* Donut Chart Placeholder */}
              <div className="relative w-32 h-32 mx-auto mb-4">
                <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 128 128">
                  <circle
                    cx="64"
                    cy="64"
                    r="50"
                    stroke={modernColors.border}
                    strokeWidth="12"
                    fill="none"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="50"
                    stroke={dashboardMetrics.savingsRate >= 20 ? modernColors.success : dashboardMetrics.savingsRate >= 10 ? modernColors.warning : modernColors.error}
                    strokeWidth="12"
                    fill="none"
                    strokeDasharray={`${Math.min(100, dashboardMetrics.savingsRate) * 3.14} 314`}
                    className="transition-all duration-1000"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold" style={{ 
                    color: dashboardMetrics.savingsRate >= 20 ? modernColors.success : 
                           dashboardMetrics.savingsRate >= 10 ? modernColors.warning : modernColors.error 
                  }}>
                    {dashboardMetrics.savingsRate.toFixed(0)}%
                  </span>
                </div>
              </div>
              
              <div className="text-center text-sm" style={{ color: modernColors.textSecondary }}>
                {formatCurrency(dashboardMetrics.monthlySavings)}/Monat gespart
              </div>
            </div>

            {/* Budget-Übersicht */}
            <div 
              className="p-6 rounded-2xl"
              style={{
                backgroundColor: modernColors.surface,
                border: `1px solid ${modernColors.border}`,
                boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)'
              }}
            >
              <h3 className="font-semibold mb-4" style={{ color: modernColors.textPrimary }}>
                Budget-Übersicht
              </h3>
              
              <div className="space-y-3">
                {budgetVsActualData.slice(0, 4).map((item, index) => {
                  const isOverBudget = item.actual > item.budget;
                  const color = isOverBudget ? modernColors.error : modernColors.success;
                  
                  return (
                    <div key={index} className="flex items-center justify-between">
                      <span className="text-sm" style={{ color: modernColors.textPrimary }}>
                        {item.name}
                      </span>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: color }}
                        ></div>
                        <span className="text-sm font-semibold" style={{ color }}>
                          {formatCurrency(item.actual)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* 3. DEINE SPAR- UND SCHULDENZIELE */}
      <div className="px-6 mb-12">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h2 className="text-2xl font-bold" style={{ color: modernColors.textPrimary }}>
              Deine Spar- und Schuldenziele
            </h2>
            <p className="text-sm mt-2" style={{ color: modernColors.textSecondary }}>
              Langfristige Ziele greifbar und messbar gemacht
            </p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Sparziele */}
            <div 
              className="p-6 rounded-2xl"
              style={{
                backgroundColor: modernColors.surface,
                border: `1px solid ${modernColors.border}`,
                boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)'
              }}
            >
              <h3 className="font-semibold mb-6" style={{ color: modernColors.textPrimary }}>
                Sparziele
              </h3>
              
              <div className="space-y-4">
                {savingsGoalsData?.chartData?.slice(0, 3).map((goal, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium" style={{ color: modernColors.textPrimary }}>
                        {goal.name}
                      </span>
                      <span className="text-sm font-semibold" style={{ color: modernColors.accent }}>
                        {goal.progressPercentage.toFixed(0)}%
                      </span>
                    </div>
                    
                    <div className="w-full h-3 rounded-full" style={{ backgroundColor: modernColors.border }}>
                      <div 
                        className="h-3 rounded-full transition-all duration-1000"
                        style={{ 
                          width: `${Math.min(100, goal.progressPercentage)}%`,
                          backgroundColor: modernColors.accent
                        }}
                      ></div>
                    </div>
                    
                    <div className="flex justify-between text-xs" style={{ color: modernColors.textSecondary }}>
                      <span>{formatCurrency(goal.current)}</span>
                      <span>{formatCurrency(goal.target)}</span>
                    </div>
                  </div>
                )) || (
                  <div className="text-center py-8" style={{ color: modernColors.textSecondary }}>
                    <div className="text-sm">Keine Sparziele definiert</div>
                    <button 
                      onClick={() => setPage('savings-goals')}
                      className="mt-2 text-sm px-4 py-2 rounded-lg transition-colors"
                      style={{ 
                        color: modernColors.accent,
                        backgroundColor: modernColors.gray50
                      }}
                    >
                      Erstes Sparziel erstellen
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Schulden */}
            <div 
              className="p-6 rounded-2xl"
              style={{
                backgroundColor: modernColors.surface,
                border: `1px solid ${modernColors.border}`,
                boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)'
              }}
            >
              <h3 className="font-semibold mb-6" style={{ color: modernColors.textPrimary }}>
                Schuldenabbau
              </h3>
              
              <div className="space-y-4">
                {debtData?.chartData?.slice(0, 3).map((debt, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium" style={{ color: modernColors.textPrimary }}>
                        {debt.name}
                      </span>
                      <span className="text-sm font-semibold" style={{ color: modernColors.error }}>
                        {((debt.paid / debt.total) * 100).toFixed(0)}%
                      </span>
                    </div>
                    
                    <div className="w-full h-3 rounded-full" style={{ backgroundColor: modernColors.border }}>
                      <div 
                        className="h-3 rounded-full transition-all duration-1000"
                        style={{ 
                          width: `${Math.min(100, (debt.paid / debt.total) * 100)}%`,
                          backgroundColor: modernColors.error
                        }}
                      ></div>
                    </div>
                    
                    <div className="flex justify-between text-xs" style={{ color: modernColors.textSecondary }}>
                      <span>Abbezahlt: {formatCurrency(debt.paid)}</span>
                      <span>Verbleibend: {formatCurrency(debt.remaining)}</span>
                    </div>
                  </div>
                )) || (
                  <div className="text-center py-8" style={{ color: modernColors.textSecondary }}>
                    <div className="text-sm">Keine Schulden eingetragen</div>
                    <div className="text-xs mt-1">Sehr gut! 🎉</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. DEINE GEWOHNHEITEN & DETAILS */}
      <div className="px-6 mb-12">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h2 className="text-2xl font-bold" style={{ color: modernColors.textPrimary }}>
              Deine Gewohnheiten & Details
            </h2>
            <p className="text-sm mt-2" style={{ color: modernColors.textSecondary }}>
              Details für eine tiefere Analyse
            </p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Ausgaben-Trend */}
            <div 
              className="p-6 rounded-2xl"
              style={{
                backgroundColor: modernColors.surface,
                border: `1px solid ${modernColors.border}`,
                boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)'
              }}
            >
              <h3 className="font-semibold mb-4" style={{ color: modernColors.textPrimary }}>
                Ausgaben-Trend
              </h3>
              
              <div className="w-full h-40 mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={annualData.slice(-6)} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false}
                      tick={{ fill: modernColors.textSecondary, fontSize: 12 }}
                    />
                    <YAxis hide />
                    <Tooltip 
                      formatter={(value) => [formatCurrency(value), 'Ausgaben']}
                      labelStyle={{ color: modernColors.textPrimary }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="expense" 
                      stroke={modernColors.error} 
                      strokeWidth={2}
                      dot={{ fill: modernColors.error, r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Einnahmen & Ausgaben Details */}
            <div className="space-y-8">
              {/* Einnahmen */}
              <div 
                className="p-6 rounded-2xl"
                style={{
                  backgroundColor: modernColors.surface,
                  border: `1px solid ${modernColors.border}`,
                  boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)'
                }}
              >
                <h3 className="font-semibold mb-4" style={{ color: modernColors.textPrimary }}>
                  Einnahmen
                </h3>
                
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span style={{ color: modernColors.textSecondary }}>Haupteinkommen</span>
                    <span className="font-semibold" style={{ color: modernColors.success }}>
                      {formatCurrency(monthlyIncome)}
                    </span>
                  </div>
                  {/* Add more income sources here if available */}
                </div>
              </div>

              {/* Ausgaben */}
              <div 
                className="p-6 rounded-2xl"
                style={{
                  backgroundColor: modernColors.surface,
                  border: `1px solid ${modernColors.border}`,
                  boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)'
                }}
              >
                <h3 className="font-semibold mb-4" style={{ color: modernColors.textPrimary }}>
                  Ausgaben
                </h3>
                
                <div className="space-y-3">
                  {categorySpendingData.slice(0, 4).map((category, index) => (
                    <div key={index} className="flex justify-between">
                      <span style={{ color: modernColors.textSecondary }}>{category.name}</span>
                      <span className="font-semibold" style={{ color: modernColors.error }}>
                        {formatCurrency(category.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default DashboardPage;
