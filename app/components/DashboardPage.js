"use client";

import React, { useMemo, useRef, useState, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, Sector, AreaChart, Area } from 'recharts';
import { UploadCloud, Loader2, TrendingUp, TrendingDown, ChevronLeft, ChevronRight, BarChart3, PieChart as PieChartIcon, Target, AlertTriangle, Repeat, PiggyBank, ToggleLeft, ToggleRight, Plus, X } from 'lucide-react';
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

  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [processingStage, setProcessingStage] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState(null);
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState(null); // Für Drill-down
  const [hoveredIndex, setHoveredIndex] = useState(-1); // Für Hover-Effekt

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
    const name = prompt('Name des Abonnements:');
    const amount = parseFloat(prompt('Monatliche Kosten (€):'));
    
    if (name && !isNaN(amount) && amount > 0) {
      try {
        await db.subscriptions.add({
          name: name.trim(),
          amount,
          isActive: true,
          detectedFrom: null,
          lastSeen: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error adding custom subscription:', error);
      }
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
                  Willkommen Daniel 👋
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
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <Card className="lg:col-span-5 !p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Abonnements</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Verwalte deine erkannten und manuell hinzugefügten Abonnements.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={addCustomSubscription}
                  className="flex items-center gap-1 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-sm rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Hinzufügen
                </button>
                <div className="flex items-center gap-2">
                  <Repeat className="w-5 h-5 text-slate-400" />
                  <span className="text-sm font-bold text-red-600">{formatCurrency(totalSubscriptionCost)}</span>
                </div>
              </div>
            </div>
            {allSubscriptions && allSubscriptions.length > 0 ? (
              <div className="space-y-3">
                {allSubscriptions.map((subscription) => (
                  <div key={subscription.id} className={`flex items-center gap-4 p-4 rounded-lg transition-all ${
                    subscription.isActive 
                      ? 'bg-slate-50 dark:bg-slate-800' 
                      : 'bg-slate-100 dark:bg-slate-700 opacity-60'
                  }`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      subscription.isActive ? 'bg-indigo-500' : 'bg-slate-400'
                    }`}>
                      <Repeat className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <span className={`font-medium block ${
                        subscription.isActive 
                          ? 'text-slate-900 dark:text-slate-100' 
                          : 'text-slate-500 dark:text-slate-400 line-through'
                      }`}>{subscription.name}</span>
                      {subscription.lastSeen && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          Zuletzt: {new Date(subscription.lastSeen).toLocaleDateString('de-DE')}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className={`font-bold ${
                        subscription.isActive ? 'text-red-600' : 'text-slate-400'
                      }`}>{formatCurrency(subscription.amount)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleSubscription(subscription.id, subscription.isActive)}
                        className="p-1 rounded transition-colors hover:bg-slate-200 dark:hover:bg-slate-600"
                        title={subscription.isActive ? 'Deaktivieren' : 'Aktivieren'}
                      >
                        {subscription.isActive ? (
                          <ToggleRight className="w-5 h-5 text-purple-500" />
                        ) : (
                          <ToggleLeft className="w-5 h-5 text-slate-400" />
                        )}
                      </button>
                      <button
                        onClick={() => deleteSubscription(subscription.id)}
                        className="p-1 rounded transition-colors hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-400 hover:text-red-500"
                        title="Löschen"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <Repeat className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Noch keine Abonnements erkannt oder hinzugefügt.</p>
                <p className="text-xs mt-1">Kategorisiere Transaktionen mit "Abo" oder füge manuell hinzu.</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
