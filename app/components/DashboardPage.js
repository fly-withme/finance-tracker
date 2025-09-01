"use client";

import React, { useMemo, useRef, useState, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, Sector, AreaChart, Area } from 'recharts';
import { UploadCloud, Loader2, TrendingDown, ChevronLeft, ChevronRight, BarChart3, PieChart as PieChartIcon, Target, AlertTriangle, Repeat, PiggyBank, X, Plus } from 'lucide-react';
import Card from './ui/Card';
import { bankStatementParser } from '../utils/pdfParser';
import { db } from '../utils/db';
import { uploadLogger } from '../utils/uploadLogger';

const formatCurrency = (amount) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);

// Custom Tooltip for Charts
const CustomBarTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="p-3 bg-slate-900/80 backdrop-blur-sm border border-slate-700 rounded-lg shadow-xl">
        <p className="label text-sm font-bold text-slate-100">{`${label}`}</p>
        <p className="text-green-400 flex items-center"><span className="w-2 h-2 rounded-full bg-green-400 mr-2"></span>Einnahmen: {formatCurrency(payload[0].value)}</p>
        <p className="text-red-400 flex items-center"><span className="w-2 h-2 rounded-full bg-red-400 mr-2"></span>Ausgaben: {formatCurrency(payload[1].value)}</p>
      </div>
    );
  }
  return null;
};

const CustomAreaTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="p-3 bg-slate-900/80 backdrop-blur-sm border border-slate-700 rounded-lg shadow-xl">
        <p className="label text-sm font-bold text-slate-100">{`Tag ${label}`}</p>
        <p className="text-red-400 flex items-center"><span className="w-2 h-2 rounded-full bg-red-400 mr-2"></span>Ausgaben: {formatCurrency(payload[0].value)}</p>
      </div>
    );
  }
  return null;
};

const CustomSavingsTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="p-3 bg-slate-900/80 backdrop-blur-sm border border-slate-700 rounded-lg shadow-xl">
        <p className="label text-sm font-bold text-slate-100">{label}</p>
        <p className="text-purple-400 flex items-center"><span className="w-2 h-2 rounded-full bg-purple-400 mr-2"></span>Sparrate: {payload[0].value.toFixed(1)}%</p>
        <p className="text-green-400 flex items-center"><span className="w-2 h-2 rounded-full bg-green-400 mr-2"></span>Gespart: {formatCurrency(data.savings)}</p>
        <p className="text-blue-400 flex items-center"><span className="w-2 h-2 rounded-full bg-blue-400 mr-2"></span>Einkommen: {formatCurrency(data.income)}</p>
      </div>
    );
  }
  return null;
};


// Enhanced Donut Chart Active Shape with Hover Effects
const renderEnhancedActiveShape = (props) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
  
  return (
    <g>
      {/* Hover Info Box im Zentrum */}
      <rect
        x={cx - 60}
        y={cy - 25}
        width={120}
        height={50}
        fill="rgba(15, 23, 42, 0.9)"
        rx={8}
        ry={8}
        className="drop-shadow-lg"
      />
      
      {/* Kategorie Name */}
      <text 
        x={cx} 
        y={cy - 8} 
        textAnchor="middle" 
        fill="white" 
        className="text-xs font-medium"
        style={{ fontSize: '12px' }}
      >
        {payload.name}
      </text>
      
      {/* Betrag */}
      <text 
        x={cx} 
        y={cy + 8} 
        textAnchor="middle" 
        fill="#10b981" 
        className="text-sm font-bold"
        style={{ fontSize: '14px' }}
      >
        {formatCurrency(value)}
      </text>
      
      {/* Prozent */}
      <text 
        x={cx} 
        y={cy + 22} 
        textAnchor="middle" 
        fill="#94a3b8" 
        className="text-xs"
        style={{ fontSize: '10px' }}
      >
        {(percent * 100).toFixed(1)}%
      </text>

      {/* Highlighted Sector (leicht vergrößert) */}
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 8}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      
      {/* Outer glow effect */}
      <Sector
        cx={cx}
        cy={cy}
        startAngle={startAngle}
        endAngle={endAngle}
        innerRadius={outerRadius + 8}
        outerRadius={outerRadius + 12}
        fill={fill}
        fillOpacity={0.6}
      />
    </g>
  );
};


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
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState(null); // Für Drill-down
  const [hoveredIndex, setHoveredIndex] = useState(-1); // Für Hover-Effekt
  const [showAddSubscriptionModal, setShowAddSubscriptionModal] = useState(false);
  const [newSubscription, setNewSubscription] = useState({
    name: '',
    amount: '',
    startDate: ''
  });

  const onPieEnter = useCallback((_, index) => {
    setActiveIndex(index);
    setHoveredIndex(index);
  }, [setActiveIndex]);

  const onPieLeave = useCallback(() => {
    setHoveredIndex(-1);
  }, []);


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

  // --- GRAPH 2: SPENDING BY CATEGORY (DOUGHNUT) ---
  const categorySpendingData = useMemo(() => {
    const month = currentMonth.getMonth();
    const year = currentMonth.getFullYear();

    if (selectedCategory) {
      // Drill-down: Zeige nur Unterkategorien der ausgewählten Hauptkategorie
      const mainCategory = categories.find(cat => cat.name === selectedCategory && !cat.parentId);
      if (!mainCategory) return [];

      const spending = transactions
        .filter(t => new Date(t.date).getFullYear() === year && new Date(t.date).getMonth() === month && t.amount < 0)
        .reduce((acc, t) => {
          const categoryName = t.category || 'Unkategorisiert';
          const category = categories.find(cat => cat.name === categoryName);
          
          // Nur Transaktionen von Unterkategorien der ausgewählten Hauptkategorie
          if (category && category.parentId === mainCategory.id) {
            acc[categoryName] = (acc[categoryName] || 0) + Math.abs(t.amount);
          }
          return acc;
        }, {});
        
      return Object.entries(spending)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
    } else {
      // Standard-Ansicht: Zeige Hauptkategorien
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
    }
  }, [transactions, currentMonth, categories, selectedCategory]);
  
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

  const chartColors = ['#4f46e5', '#7c3aed', '#c026d3', '#db2777', '#be185d', '#9f1239'];

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-white dark:bg-slate-900 min-h-screen font-sans">
      <div className="flex items-center justify-between w-full mb-8">
          <div className="flex-1">
              <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                  Willkommen {userSettings?.value?.userName || 'Benutzer'} 👋
              </h1>
          </div>
          <div className="flex-1 flex items-center justify-center">
               <div className="flex items-center gap-3">
                  <button onClick={() => changeMonth(-1)} className="bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-200 p-3 rounded-full transition-colors">
                      <ChevronLeft className="w-5 h-5" />
                  </button>
                  <div className="px-4 py-2 min-w-[180px] text-center">
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-2xl tracking-wide">
                        {currentMonth.toLocaleString('de-DE', { month: 'long', year: 'numeric' })}
                    </span>
                  </div>
                  <button onClick={() => changeMonth(1)} className="bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-200 p-3 rounded-full transition-colors">
                      <ChevronRight className="w-5 h-5" />
                  </button>
              </div>
          </div>
          <div className="flex-1 flex justify-end">
              <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileUpload} className="hidden" />
              <button onClick={triggerFileUpload} disabled={isUploading} className="flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-700 dark:to-purple-700 hover:from-indigo-700 hover:to-purple-700 dark:hover:from-indigo-600 dark:hover:to-purple-600 text-white rounded-lg transition-all duration-300 ease-in-out font-medium shadow-lg hover:shadow-xl py-3 px-6 text-base disabled:opacity-50 disabled:cursor-not-allowed">
                {isUploading ? <><Loader2 className="w-5 h-5 animate-spin" /> Verarbeite...</> : <><UploadCloud className="w-5 h-5" /> Hochladen</>}
              </button>
          </div>
      </div>
      
      {(isUploading || uploadSuccess) && (
        <div className="mb-8 p-4 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-300">
          {isUploading ? processingStage : uploadSuccess}
        </div>
      )}

      {/* --- TOP CARDS --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card><p className="text-sm text-slate-500 dark:text-slate-400">Gesamtbilanz</p><p className={`text-2xl font-bold ${totalBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(totalBalance)}</p></Card>
        <Card><p className="text-sm text-slate-500 dark:text-slate-400">Einnahmen ({currentMonth.toLocaleString('de-DE', { month: 'short' })})</p><p className="text-2xl font-bold text-green-600">{formatCurrency(monthlyIncome)}</p></Card>
        <Card><p className="text-sm text-slate-500 dark:text-slate-400">Ausgaben ({currentMonth.toLocaleString('de-DE', { month: 'short' })})</p><p className="text-2xl font-bold text-red-600">{formatCurrency(monthlyExpense)}</p></Card>
      </div>

      {/* --- SPARZIELE SECTION --- */}
      {savingsGoalsData && (
        <div className="mt-8">
          <Card className="!p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Sparziele</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">{formatCurrency(savingsGoalsData.totalRemaining)} verbleibt · {savingsGoalsData.progressPercentage.toFixed(0)}% erreicht</p>
              </div>
              <button
                onClick={() => setPage('savings-goals')}
                className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              >
                Verwalten →
              </button>
            </div>

            {/* Main Progress Bar */}
            <div className="mb-6">
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                <div 
                  className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-1000"
                  style={{ width: `${Math.min(100, savingsGoalsData.progressPercentage)}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-2">
                <span>{formatCurrency(savingsGoalsData.totalSaved)}</span>
                <span>{formatCurrency(savingsGoalsData.totalTarget)}</span>
              </div>
            </div>

            {/* Individual Goals */}
            <div className="space-y-3">
              {savingsGoalsData.chartData.slice(0, 3).map((goal) => (
                <div key={goal.name} className="flex items-center justify-between py-2">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{goal.name}</span>
                      <span className="text-sm text-slate-500 dark:text-slate-400">{formatCurrency(goal.remaining)}</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1">
                      <div 
                        className="h-1 rounded-full bg-blue-500"
                        style={{ width: `${goal.progressPercentage}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
              {savingsGoalsData.chartData.length > 3 && (
                <div className="text-center pt-2">
                  <button
                    onClick={() => setPage('savings-goals')}
                    className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  >
                    +{savingsGoalsData.chartData.length - 3} weitere Sparziele
                  </button>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}


      {/* --- GRAPHS --- */}
      <div className="mt-8 space-y-8">
        
        {/* Graph 1: Jahresübersicht - Full Width */}
        <Card className="!p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Jahresübersicht {currentMonth.getFullYear()}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Einnahmen vs. Ausgaben pro Monat.</p>
            </div>
            <BarChart3 className="w-5 h-5 text-slate-400" />
          </div>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={annualData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
               <defs>
                  <linearGradient id="colorIncomeBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.4}/>
                  </linearGradient>
                  <linearGradient id="colorExpenseBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.4}/>
                  </linearGradient>
                </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-700/50" />
              <XAxis dataKey="name" stroke="currentColor" fontSize={12} className="text-slate-500 dark:text-slate-400" />
              <YAxis stroke="currentColor" fontSize={12} tickFormatter={formatCurrency} className="text-slate-500 dark:text-slate-400" />
              <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(100, 116, 139, 0.1)' }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{paddingTop: '20px'}}/>
              <Bar dataKey="income" name="Einnahmen" fill="url(#colorIncomeBar)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" name="Ausgaben" fill="url(#colorExpenseBar)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Row with Savings Rate and Daily Spending */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Savings Rate Chart */}
          <Card className="!p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Sparrate Entwicklung</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Monatliche Sparrate in % (Jan - {new Date().toLocaleString('de-DE', { month: 'short' })}).</p>
              </div>
              <PiggyBank className="w-5 h-5 text-slate-400" />
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={savingsRateData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorSavingsRate" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.6}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-700/50" />
                <XAxis dataKey="month" stroke="currentColor" fontSize={12} className="text-slate-500 dark:text-slate-400" />
                <YAxis stroke="currentColor" fontSize={12} tickFormatter={(value) => `${value.toFixed(0)}%`} className="text-slate-500 dark:text-slate-400" />
                <Tooltip content={<CustomSavingsTooltip />} cursor={{ stroke: '#8b5cf6', strokeWidth: 2, strokeDasharray: '3 3' }} />
                <Area 
                  type="monotone" 
                  dataKey="savingsRate" 
                  name="Sparrate" 
                  stroke="#8b5cf6" 
                  strokeWidth={3} 
                  fillOpacity={1} 
                  fill="url(#colorSavingsRate)" 
                  dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: '#8b5cf6', strokeWidth: 2, fill: 'white' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          {/* Daily Spending */}
          <Card className="!p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Tägliche Ausgaben</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Ausgaben für {currentMonth.toLocaleString('de-DE', { month: 'long', year: 'numeric' })}.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                    className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="Vorheriger Monat"
                  >
                    <ChevronLeft className="w-4 h-4 text-slate-500" />
                  </button>
                  <button
                    onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                    className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="Nächster Monat"
                  >
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  </button>
                  <TrendingDown className="w-5 h-5 text-slate-400" />
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={dailySpendingData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                      <defs>
                          <linearGradient id="colorExpenseArea" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4}/>
                              <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                          </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-700/50" />
                      <XAxis dataKey="day" stroke="currentColor" fontSize={12} className="text-slate-500 dark:text-slate-400" />
                      <YAxis stroke="currentColor" fontSize={12} tickFormatter={formatCurrency} className="text-slate-500 dark:text-slate-400" />
                      <Tooltip content={<CustomAreaTooltip />} cursor={{ stroke: '#ef4444', strokeWidth: 1, strokeDasharray: '3 3' }} />
                      <Area type="monotone" dataKey="expense" name="Ausgaben" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorExpenseArea)" />
                  </AreaChart>
              </ResponsiveContainer>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Graph 2: Ausgaben nach Kategorie */}
          <Card className="lg:col-span-3 !p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {selectedCategory ? `${selectedCategory} - Unterkategorien` : 'Ausgaben nach Kategorie'}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {selectedCategory ? 'Aufschlüsselung der Unterkategorien' : 'Top-Ausgaben für den Monat.'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {selectedCategory && (
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className="text-xs bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 px-3 py-1 rounded-full transition-colors"
                  >
                    ← Zurück
                  </button>
                )}
                <button
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                  className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="Vorheriger Monat"
                >
                  <ChevronLeft className="w-4 h-4 text-slate-500" />
                </button>
                <button
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                  className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="Nächster Monat"
                >
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </button>
                <PieChartIcon className="w-5 h-5 text-slate-400" />
              </div>
            </div>
            {categorySpendingData.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <ResponsiveContainer width="100%" height={350}>
                  <PieChart>
                    <Pie
                      activeIndex={hoveredIndex >= 0 ? hoveredIndex : activeIndex}
                      activeShape={hoveredIndex >= 0 ? renderEnhancedActiveShape : undefined}
                      data={categorySpendingData}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={110}
                      dataKey="value"
                      onMouseEnter={onPieEnter}
                      onMouseLeave={onPieLeave}
                    >
                      {categorySpendingData.map((entry, index) => (
                        <Cell 
                          key={`cell-${entry.name}-${index}`} 
                          fill={chartColors[index % chartColors.length]}
                          fillOpacity={hoveredIndex >= 0 ? (hoveredIndex === index ? 1 : 0.3) : 1}
                          stroke={hoveredIndex === index ? chartColors[index % chartColors.length] : 'none'}
                          strokeWidth={hoveredIndex === index ? 2 : 0}
                          className="focus:outline-none transition-all duration-200" 
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2">
                    {categorySpendingData.map((entry, index) => {
                      // Prüfe ob diese Kategorie Unterkategorien hat (nur für Hauptkategorien-Ansicht)
                      const hasSubcategories = !selectedCategory && categories.some(cat => 
                        cat.parentId && categories.find(parent => parent.id === cat.parentId)?.name === entry.name
                      );
                      
                      return (
                        <div key={`legend-${entry.name}-${index}`} 
                             onClick={() => hasSubcategories ? setSelectedCategory(entry.name) : null}
                             className={`p-2 rounded-lg transition-all duration-200 ${
                               hoveredIndex === index ? 'bg-slate-200 dark:bg-slate-700/50' : 
                               hoveredIndex >= 0 ? 'opacity-50' : 
                               hasSubcategories ? 'hover:bg-slate-100 dark:hover:bg-slate-800/50 cursor-pointer' : 'cursor-default'
                             }`}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div 
                                      className="w-3 h-3 rounded-full transition-all duration-200" 
                                      style={{
                                        backgroundColor: chartColors[index % chartColors.length],
                                        opacity: hoveredIndex >= 0 ? (hoveredIndex === index ? 1 : 0.4) : 1
                                      }}
                                    ></div>
                                    <span className={`text-sm font-medium transition-all duration-200 ${
                                      hoveredIndex === index ? 'text-slate-900 dark:text-slate-100 font-semibold' : 
                                      hoveredIndex >= 0 ? 'text-slate-400 dark:text-slate-500' : 
                                      'text-slate-700 dark:text-slate-300'
                                    }`}>
                                      {entry.name}
                                      {hasSubcategories && <span className="ml-1 text-xs text-slate-400">▶</span>}
                                    </span>
                                </div>
                                <span className={`text-sm font-bold transition-all duration-200 ${
                                  hoveredIndex === index ? 'text-slate-900 dark:text-slate-100' : 
                                  hoveredIndex >= 0 ? 'text-slate-400 dark:text-slate-500' : 
                                  'text-slate-900 dark:text-slate-100'
                                }`}>{formatCurrency(entry.value)}</span>
                            </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            ) : (
              <div className="h-[350px] flex flex-col items-center justify-center text-slate-500 dark:text-slate-400">
                <PieChartIcon className="w-12 h-12 opacity-50 mb-2" />
                <p>Keine Ausgabendaten für diesen Monat.</p>
              </div>
            )}
          </Card>

          {/* Graph 3: Budget-Fortschritt */}
          <Card className="lg:col-span-2 !p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Budget-Fortschritt</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">{currentMonth.toLocaleString('de-DE', { month: 'long', year: 'numeric' })}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                  className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="Vorheriger Monat"
                >
                  <ChevronLeft className="w-4 h-4 text-slate-500" />
                </button>
                <button
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                  className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="Nächster Monat"
                >
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </button>
                <Target className="w-5 h-5 text-slate-400" />
              </div>
            </div>
            <div className="space-y-4 h-[350px] overflow-y-auto pr-2">
              {budgetVsActualData.length > 0 ? budgetVsActualData.map((item, index) => {
                const isOverBudget = item.actual > item.budget;
                const color = isOverBudget ? 'bg-red-500' : 'bg-indigo-500';
                const progressPercentage = item.progress.toFixed(0);
                return (
                  <div key={`budget-${item.name}-${index}`}>
                    <div className="flex justify-between items-end mb-1">
                      <div className="flex items-center gap-2">
                         <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{item.name}</span>
                         {isOverBudget && <AlertTriangle className="w-4 h-4 text-red-500" />}
                      </div>
                      <span className={`text-sm font-semibold ${isOverBudget ? 'text-red-500' : 'text-slate-600 dark:text-slate-400'}`}>
                        {formatCurrency(item.actual)} / {formatCurrency(item.budget)}
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-4 relative">
                      <div className={`${color} h-4 rounded-full flex items-center justify-center transition-all duration-500`} style={{ width: `${item.progress}%` }}>
                         {item.progress > 15 && <span className="text-xs font-bold text-white px-2">{progressPercentage}%</span>}
                      </div>
                    </div>
                  </div>
                );
              }) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 dark:text-slate-400">
                  <Target className="w-12 h-12 opacity-50 mb-2" />
                  <p>Keine Budgets für diesen Monat gesetzt.</p>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* --- SUBSCRIPTIONS SECTION --- */}
        <Card className="!p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Abonnements</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">{formatCurrency(totalSubscriptionCost)} monatlich · {activeSubscriptions.length} aktiv</p>
            </div>
            <button
              onClick={() => setShowAddSubscriptionModal(true)}
              className="w-8 h-8 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-full flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl"
              title="Neues Abonnement hinzufügen"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {allSubscriptions && allSubscriptions.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {allSubscriptions.slice(0, 8).map((subscription) => (
                <div 
                  key={subscription.id} 
                  className={`p-4 rounded-xl border transition-all ${
                    subscription.isActive 
                      ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700' 
                      : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h4 
                        className={`text-sm font-medium truncate ${
                          subscription.isActive 
                            ? 'text-slate-800 dark:text-slate-200' 
                            : 'text-slate-500 dark:text-slate-400 line-through'
                        }`}
                        title={subscription.name}
                      >
                        {subscription.name}
                      </h4>
                      {subscription.lastSeen && (
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                          {new Date(new Date(subscription.lastSeen).getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                        </p>
                      )}
                    </div>
                    
                    <button
                      onClick={() => deleteSubscription(subscription.id)}
                      className="text-slate-400 hover:text-red-500 transition-colors ml-2 flex-shrink-0"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className={`text-lg font-bold ${
                      subscription.isActive 
                        ? 'text-slate-800 dark:text-slate-200' 
                        : 'text-slate-400 dark:text-slate-500'
                    }`}>
                      {formatCurrency(subscription.amount)}
                    </span>
                    
                    {/* Modern Toggle */}
                    <button
                      onClick={() => toggleSubscription(subscription.id, subscription.isActive)}
                      className={`relative inline-flex items-center h-5 w-9 rounded-full transition-colors duration-200 focus:outline-none ${
                        subscription.isActive 
                          ? 'bg-purple-500 hover:bg-purple-600' 
                          : 'bg-slate-300 dark:bg-slate-600 hover:bg-slate-400 dark:hover:bg-slate-500'
                      }`}
                    >
                      <span
                        className={`inline-block w-3 h-3 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                          subscription.isActive ? 'translate-x-5' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              ))}
              
              {allSubscriptions.length > 8 && (
                <div className="col-span-full text-center pt-2">
                  <span className="text-xs text-slate-400">
                    +{allSubscriptions.length - 8} weitere Abonnements
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
              <Repeat className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Keine Abonnements gefunden</p>
            </div>
          )}
        </Card>


        {/* --- DEBT PAYOFF SECTION --- */}
        {debtData && (
          <Card className="!p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Schulden</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">{formatCurrency(debtData.totalDebt)} verbleibt · {debtData.progressPercentage.toFixed(0)}% abbezahlt</p>
              </div>
              <button
                onClick={() => setPage('debts')}
                className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              >
                Verwalten →
              </button>
            </div>

            {/* Main Progress Bar */}
            <div className="mb-6">
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                <div 
                  className="h-2 rounded-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-1000"
                  style={{ width: `${Math.min(100, debtData.progressPercentage)}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-2">
                <span>{formatCurrency(debtData.totalPaid)}</span>
                <span>{formatCurrency(debtData.totalOriginalAmount)}</span>
              </div>
            </div>

            {/* Individual Debts */}
            <div className="space-y-3">
              {debtData.chartData.slice(0, 3).map((debt) => (
                <div key={debt.name} className="flex items-center justify-between py-2">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{debt.name}</span>
                      <span className="text-sm text-slate-500 dark:text-slate-400">{formatCurrency(debt.remaining)}</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1">
                      <div 
                        className="h-1 rounded-full bg-green-500"
                        style={{ width: `${debt.progressPercentage}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
              {debtData.chartData.length > 3 && (
                <div className="text-center pt-2">
                  <button
                    onClick={() => setPage('debts')}
                    className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  >
                    +{debtData.chartData.length - 3} weitere Schulden
                  </button>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Add Subscription Modal */}
        {showAddSubscriptionModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <Repeat className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">
                    Neues Abonnement
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Füge ein neues Abonnement hinzu
                  </p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Name des Abonnements
                  </label>
                  <input
                    type="text"
                    value={newSubscription.name}
                    onChange={(e) => setNewSubscription(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="z.B. Netflix, Spotify, Adobe..."
                    className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-base transition-all duration-200"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Monatliche Kosten
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      value={newSubscription.amount}
                      onChange={(e) => setNewSubscription(prev => ({ ...prev, amount: e.target.value }))}
                      placeholder="9.99"
                      className="w-full px-4 py-3 pr-12 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-base transition-all duration-200"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">€</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Startdatum (optional)
                  </label>
                  <input
                    type="date"
                    value={newSubscription.startDate ? newSubscription.startDate.split('T')[0] : ''}
                    onChange={(e) => setNewSubscription(prev => ({ ...prev, startDate: e.target.value ? new Date(e.target.value).toISOString() : '' }))}
                    className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-base transition-all duration-200"
                  />
                </div>
              </div>

              <div className="flex gap-4 mt-8">
                <button
                  onClick={() => {
                    setShowAddSubscriptionModal(false);
                    setNewSubscription({ name: '', amount: '', startDate: '' });
                  }}
                  style={{paddingTop: '15px', paddingBottom: '15px', paddingLeft: '25px', paddingRight: '25px'}}
                  className="flex-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl font-semibold transition-all duration-200"
                >
                  Abbrechen
                </button>
                <button
                  onClick={addCustomSubscription}
                  disabled={!newSubscription.name || !newSubscription.amount}
                  style={{paddingTop: '15px', paddingBottom: '15px', paddingLeft: '25px', paddingRight: '25px'}}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Hinzufügen
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
