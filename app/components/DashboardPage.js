"use client";

import React, { useMemo, useRef, useState, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, Sector, AreaChart, Area } from 'recharts';
import { UploadCloud, Loader2, TrendingUp, TrendingDown, ChevronLeft, ChevronRight, BarChart3, PieChart as PieChartIcon, Target } from 'lucide-react';
import Card from './ui/Card';
import PageHeader from './ui/PageHeader';
import { bankStatementParser } from '../utils/pdfParser';
import { db } from '../utils/db';
import { uploadLogger } from '../utils/uploadLogger';

const formatCurrency = (amount) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);

// Custom Tooltip for Charts
const CustomBarTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="p-3 bg-slate-800/80 dark:bg-slate-900/80 backdrop-blur-sm border border-slate-700 rounded-lg shadow-xl">
        <p className="label text-sm font-bold text-slate-100">{`${label}`}</p>
        <p className="text-green-400">{`Einnahmen: ${formatCurrency(payload[0].value)}`}</p>
        <p className="text-red-400">{`Ausgaben: ${formatCurrency(payload[1].value)}`}</p>
      </div>
    );
  }
  return null;
};

const CustomAreaTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="p-3 bg-slate-800/80 dark:bg-slate-900/80 backdrop-blur-sm border border-slate-700 rounded-lg shadow-xl">
        <p className="label text-sm font-bold text-slate-100">{`Tag ${label}`}</p>
        <p className="text-red-400">{`Ausgaben: ${formatCurrency(payload[0].value)}`}</p>
      </div>
    );
  }
  return null;
};


// Doughnut Chart Active Shape
const renderActiveShape = (props) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
  return (
    <g>
      <text x={cx} y={cy - 10} dy={8} textAnchor="middle" fill={fill} className="text-2xl font-bold">
        {formatCurrency(value)}
      </text>
      <text x={cx} y={cy + 10} dy={8} textAnchor="middle" fill="#94a3b8" className="text-sm">
        {payload.name} ({(percent * 100).toFixed(0)}%)
      </text>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      <Sector
        cx={cx}
        cy={cy}
        startAngle={startAngle}
        endAngle={endAngle}
        innerRadius={outerRadius + 6}
        outerRadius={outerRadius + 10}
        fill={fill}
      />
    </g>
  );
};


// Main Dashboard Component
const DashboardPage = ({ setPage }) => {
  const transactions = useLiveQuery(() => db.transactions.orderBy('date').reverse().toArray(), []) || [];
  const budgets = useLiveQuery(() => db.budgets.toArray(), []) || [];
  const userSettings = useLiveQuery(() => db.settings.get('userProfile'), []) || {};

  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [processingStage, setProcessingStage] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState(null);
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [activeIndex, setActiveIndex] = useState(0);

  const onPieEnter = useCallback((_, index) => {
    setActiveIndex(index);
  }, [setActiveIndex]);

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
    const spending = transactions
      .filter(t => new Date(t.date).getFullYear() === year && new Date(t.date).getMonth() === month && t.amount < 0)
      .reduce((acc, t) => {
        const category = t.category || 'Unkategorisiert';
        acc[category] = (acc[category] || 0) + Math.abs(t.amount);
        return acc;
      }, {});
    return Object.entries(spending)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [transactions, currentMonth]);
  
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
    const sessionId = uploadLogger.startSession(file.name);
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
    <div className="p-4 md:p-6 lg:p-8 bg-slate-100 dark:bg-slate-900 min-h-screen font-sans">
      <PageHeader title={
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
          Willkommen zurück, <span className="text-indigo-600 dark:text-indigo-400">{userSettings?.name || 'Finanz-Manager'}</span>!
        </h1>
      }>
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 p-1 bg-slate-200 dark:bg-slate-800 rounded-lg">
                <button onClick={() => changeMonth(-1)} className="p-1.5 rounded-md hover:bg-white dark:hover:bg-slate-700"><ChevronLeft className="w-5 h-5 text-slate-500" /></button>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 w-32 text-center">{currentMonth.toLocaleString('de-DE', { month: 'long', year: 'numeric' })}</span>
                <button onClick={() => changeMonth(1)} className="p-1.5 rounded-md hover:bg-white dark:hover:bg-slate-700"><ChevronRight className="w-5 h-5 text-slate-500" /></button>
            </div>
            <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileUpload} className="hidden" />
            <button onClick={triggerFileUpload} disabled={isUploading} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              {isUploading ? <><Loader2 className="w-5 h-5 animate-spin" /> Verarbeite...</> : <><UploadCloud className="w-5 h-5" /> Hochladen</>}
            </button>
        </div>
      </PageHeader>
      
      {(isUploading || uploadSuccess) && (
        <div className="mt-4 p-4 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-300">
          {isUploading ? processingStage : uploadSuccess}
        </div>
      )}

      {/* --- TOP CARDS --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <Card><p className="text-sm text-slate-500 dark:text-slate-400">Gesamtbilanz</p><p className={`text-2xl font-bold ${totalBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(totalBalance)}</p></Card>
        <Card><p className="text-sm text-slate-500 dark:text-slate-400">Einnahmen ({currentMonth.toLocaleString('de-DE', { month: 'short' })})</p><p className="text-2xl font-bold text-green-600">{formatCurrency(monthlyIncome)}</p></Card>
        <Card><p className="text-sm text-slate-500 dark:text-slate-400">Ausgaben ({currentMonth.toLocaleString('de-DE', { month: 'short' })})</p><p className="text-2xl font-bold text-red-600">{formatCurrency(monthlyExpense)}</p></Card>
      </div>

      {/* --- GRAPHS --- */}
      <div className="mt-8 space-y-8">
        
        {/* Graph 1: Jahresübersicht */}
        <Card className="!p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Jahresübersicht {currentMonth.getFullYear()}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Einnahmen vs. Ausgaben pro Monat.</p>
            </div>
            <BarChart3 className="w-5 h-5 text-slate-400" />
          </div>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={annualData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-700/50" />
              <XAxis dataKey="name" stroke="currentColor" fontSize={12} className="text-slate-500 dark:text-slate-400" />
              <YAxis stroke="currentColor" fontSize={12} tickFormatter={formatCurrency} className="text-slate-500 dark:text-slate-400" />
              <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(100, 116, 139, 0.1)' }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{paddingTop: '20px'}}/>
              <Bar dataKey="income" name="Einnahmen" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" name="Ausgaben" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Graph 4: Tägliche Ausgaben */}
        <Card className="!p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Tägliche Ausgaben</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Ausgabenverlauf für {currentMonth.toLocaleString('de-DE', { month: 'long', year: 'numeric' })}.</p>
              </div>
              <TrendingDown className="w-5 h-5 text-slate-400" />
            </div>
            <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={dailySpendingData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <defs>
                        <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-700/50" />
                    <XAxis dataKey="day" stroke="currentColor" fontSize={12} className="text-slate-500 dark:text-slate-400" />
                    <YAxis stroke="currentColor" fontSize={12} tickFormatter={formatCurrency} className="text-slate-500 dark:text-slate-400" />
                    <Tooltip content={<CustomAreaTooltip />} cursor={{ stroke: '#ef4444', strokeWidth: 1, strokeDasharray: '3 3' }} />
                    <Area type="monotone" dataKey="expense" name="Ausgaben" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorExpense)" />
                </AreaChart>
            </ResponsiveContainer>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Graph 2: Ausgaben nach Kategorie */}
          <Card className="lg:col-span-3 !p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Ausgaben nach Kategorie</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Top-Ausgaben für den Monat.</p>
              </div>
               <PieChartIcon className="w-5 h-5 text-slate-400" />
            </div>
            {categorySpendingData.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <ResponsiveContainer width="100%" height={350}>
                  <PieChart>
                    <Pie
                      activeIndex={activeIndex}
                      activeShape={renderActiveShape}
                      data={categorySpendingData}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={110}
                      dataKey="value"
                      onMouseEnter={onPieEnter}
                    >
                      {categorySpendingData.map((entry, index) => <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} className="focus:outline-none" />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2">
                    {categorySpendingData.map((entry, index) => (
                        <div key={`legend-${index}`} onMouseEnter={() => onPieEnter(null, index)} onMouseLeave={() => onPieEnter(null, activeIndex)}
                             className={`p-2 rounded-lg cursor-pointer transition-all ${activeIndex === index ? 'bg-slate-200 dark:bg-slate-700/50' : 'hover:bg-slate-100 dark:hover:bg-slate-800/50'}`}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full" style={{backgroundColor: chartColors[index % chartColors.length]}}></div>
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{entry.name}</span>
                                </div>
                                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{formatCurrency(entry.value)}</span>
                            </div>
                        </div>
                    ))}
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
                <p className="text-sm text-slate-500 dark:text-slate-400">Ausgaben vs. gesetzte Budgets.</p>
              </div>
              <Target className="w-5 h-5 text-slate-400" />
            </div>
            <div className="space-y-4 h-[350px] overflow-y-auto pr-2">
              {budgetVsActualData.length > 0 ? budgetVsActualData.map(item => {
                const isOverBudget = item.actual > item.budget;
                const color = isOverBudget ? 'bg-red-500' : 'bg-indigo-500';
                const progressPercentage = item.progress.toFixed(0);
                return (
                  <div key={item.name}>
                    <div className="flex justify-between items-end mb-1">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{item.name}</span>
                      <span className={`text-sm font-semibold ${isOverBudget ? 'text-red-500' : 'text-slate-600 dark:text-slate-400'}`}>
                        {formatCurrency(item.actual)} / {formatCurrency(item.budget)}
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-4 relative">
                      <div className={`${color} h-4 rounded-full flex items-center justify-center`} style={{ width: `${item.progress}%` }}>
                         <span className="text-xs font-bold text-white absolute left-2">{progressPercentage}%</span>
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
      </div>
    </div>
  );
};

export default DashboardPage;
