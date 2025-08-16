"use client"; // DIESE ZEILE BEHEBT DEN FEHLER

import React, { useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { UploadCloud, Loader2, TrendingUp, TrendingDown, ChevronLeft, ChevronRight } from 'lucide-react';
import Card from './ui/Card';
import PageHeader from './ui/PageHeader';
import OllamaStatus from './OllamaStatus';
import { bankStatementParser } from '../utils/pdfParser';
import { db } from '../utils/db';

const formatCurrency = (amount) => amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

const DashboardPage = ({ setPage }) => {
  const transactions = useLiveQuery(() => db.transactions.orderBy('date').reverse().toArray(), []) || [];
  const budgets = useLiveQuery(() => db.budgets.toArray(), []) || [];

  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [processingStage, setProcessingStage] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState(null);
  
  const [pieChartDate, setPieChartDate] = useState(new Date());
  const [budgetDate, setBudgetDate] = useState(new Date());
  
  // State to track hovered category for chart interaction
  const [hoveredData, setHoveredData] = useState(null);

  const { totalBalance, monthlyIncome, monthlyExpense } = useMemo(() => {
    if (!transactions || transactions.length === 0) return { totalBalance: 0, monthlyIncome: 0, monthlyExpense: 0 };
    const balance = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    let currentMonthIncome = 0;
    let currentMonthExpense = 0;
    transactions.forEach(t => {
      const tDate = new Date(t.date);
      if (tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear) {
        if (t.amount > 0) currentMonthIncome += t.amount;
        else currentMonthExpense += Math.abs(t.amount);
      }
    });
    return { totalBalance: balance, monthlyIncome: currentMonthIncome, monthlyExpense: currentMonthExpense };
  }, [transactions]);
  
  const annualData = useMemo(() => {
    if (!transactions || transactions.length === 0) return [];
    const months = Array.from({ length: 12 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      return { name: d.toLocaleString('de-DE', { month: 'short' }), income: 0, expense: 0 };
    }).reverse();
    transactions.forEach(t => {
      const monthShort = new Date(t.date).toLocaleString('de-DE', { month: 'short' });
      const monthData = months.find(m => m.name === monthShort)
      if (monthData) {
        if (t.amount > 0) monthData.income += t.amount;
        else monthData.expense += Math.abs(t.amount);
      }
    });
    return months;
  }, [transactions]);

  // *** MODIFIED: Calculation simplified, percentage removed ***
  const monthlySpendingData = useMemo(() => {
    if (!transactions) return [];
    const selectedMonth = pieChartDate.getMonth();
    const selectedYear = pieChartDate.getFullYear();
    
    const spendingByCategory = transactions
      .filter(t => {
        const transactionDate = new Date(t.date);
        return transactionDate.getFullYear() === selectedYear &&
               transactionDate.getMonth() === selectedMonth &&
               t.amount < 0;
      })
      .reduce((acc, t) => {
        const category = t.category || 'Unkategorisiert';
        const existing = acc.find(item => item.name === category);
        if (existing) {
          existing.value += Math.abs(t.amount);
        } else {
          acc.push({ name: category, value: Math.abs(t.amount) });
        }
        return acc;
      }, []);

    if (spendingByCategory.length === 0) return [];
    
    return spendingByCategory.sort((a, b) => b.value - a.value);
  }, [transactions, pieChartDate]);

  const budgetComparisonData = useMemo(() => {
    if (!transactions || !budgets) return [];
    const selectedMonth = budgetDate.getMonth();
    const selectedYear = budgetDate.getFullYear();
    const monthlyBudgets = budgets.filter(b => b.month === selectedMonth && b.year === selectedYear);
    
    const actualSpendingForBudgetMonth = transactions
      .filter(t => {
        const transactionDate = new Date(t.date);
        return transactionDate.getFullYear() === selectedYear &&
               transactionDate.getMonth() === selectedMonth &&
               t.amount < 0;
      })
      .reduce((acc, t) => {
        const category = t.category || 'Unkategorisiert';
        acc[category] = (acc[category] || 0) + Math.abs(t.amount);
        return acc;
      }, {});

    return monthlyBudgets.map(budget => ({
      category: budget.categoryName,
      budget: budget.amount,
      actual: actualSpendingForBudgetMonth[budget.categoryName] || 0
    })).sort((a, b) => b.budget - a.budget);
  }, [transactions, budgets, budgetDate]);

  // Check if user has any budgets at all (for different empty states)
  const hasAnyBudgets = budgets && budgets.length > 0;

  const triggerFileUpload = () => fileInputRef.current?.click();
  
  const goToPreviousPieChartMonth = () => setPieChartDate(d => new Date(d.setMonth(d.getMonth() - 1)));
  const goToNextPieChartMonth = () => setPieChartDate(d => new Date(d.setMonth(d.getMonth() + 1)));

  const goToPreviousBudgetMonth = () => setBudgetDate(d => new Date(d.setMonth(d.getMonth() - 1)));
  const goToNextBudgetMonth = () => setBudgetDate(d => new Date(d.setMonth(d.getMonth() + 1)));
  
  const chartColors = ['#4F46E5', '#7C3AED', '#EC4899', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
  
  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setProcessingStage('Datei wird verarbeitet...');
    setUploadSuccess(null);

    try {
      const transactions = await bankStatementParser.parseFile(file);
      
      if (transactions.length === 0) {
        throw new Error('Keine Transaktionen in der Datei gefunden');
      }

      setProcessingStage('Transaktionen werden gespeichert...');
      
      for (const transaction of transactions) {
        await db.inbox.add({
          ...transaction,
          uploadedAt: new Date().toISOString(),
          skipped: 0
        });
      }

      setUploadSuccess(`${transactions.length} Transaktionen erfolgreich importiert!`);
      event.target.value = '';
      
    } catch (error) {
      console.error('Upload-Fehler:', error);
      setUploadSuccess(`Fehler: ${error.message}`);
    } finally {
      setIsUploading(false);
      setProcessingStage('');
      
      // Clear success message after 5 seconds
      setTimeout(() => setUploadSuccess(null), 5000);
    }
  };

  return (
    // *** MODIFIED: Font family changed to Space Grotesk ***
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
      <PageHeader title={
          <div><h1 className="text-4xl font-extrabold text-slate-800 tracking-wide">Willkommen zurück, <span className="bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">Daniel</span><span className="ml-2">👋</span></h1></div>
        }>
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={triggerFileUpload}
            disabled={isUploading}
            className="btn-lg flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="hidden sm:inline">Wird verarbeitet...</span>
              </>
            ) : (
              <>
                <UploadCloud className="w-5 h-5" />
                <span className="hidden sm:inline">Kontoauszug hochladen</span>
                <span className="sm:hidden">Upload</span>
              </>
            )}
          </button>
        </div>
      </PageHeader>
      
      <OllamaStatus />

      {/* Upload Status Feedback */}
      {(processingStage || uploadSuccess) && (
        <div className="mt-6">
          {processingStage && (
            <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
              <span className="text-blue-800 font-medium">{processingStage}</span>
            </div>
          )}
          {uploadSuccess && (
            <div className={`flex items-center gap-3 p-4 border rounded-xl ${
              uploadSuccess.startsWith('Fehler') 
                ? 'bg-red-50 border-red-200 text-red-800' 
                : 'bg-green-50 border-green-200 text-green-800'
            }`}>
              <span className="font-medium">{uploadSuccess}</span>
            </div>
          )}
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ... Statistische Karten & Jahresübersicht (unverändert) ... */}
        <Card><h3 className="text-sm font-medium text-slate-500">Gesamtsaldo</h3><p className="text-3xl font-bold text-slate-800 mt-2">{formatCurrency(totalBalance)}</p><div className="flex items-center gap-1 mt-2 text-sm text-slate-500">{monthlyIncome - monthlyExpense >= 0 ? <TrendingUp className="w-4 h-4 text-green-500"/> : <TrendingDown className="w-4 h-4 text-red-500"/>}<span>{formatCurrency(monthlyIncome - monthlyExpense)} diesen Monat</span></div></Card>
        <Card><h3 className="text-sm font-medium text-slate-500">Monatliche Einnahmen</h3><p className="text-3xl font-bold text-slate-800 mt-2">{formatCurrency(monthlyIncome)}</p></Card>
        <Card><h3 className="text-sm font-medium text-slate-500">Monatliche Ausgaben</h3><p className="text-3xl font-bold text-slate-800 mt-2">{formatCurrency(monthlyExpense)}</p></Card>
        <Card className="lg:col-span-3 relative overflow-hidden">
          {/* Premium gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/30 via-blue-50/20 to-white pointer-events-none"></div>
          
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-800 mb-1">Finanzübersicht der letzten 12 Monate</h3>
                  <p className="text-sm text-slate-500 font-medium">Deine Einnahmen und Ausgaben im Verlauf</p>
                </div>
              </div>
              
              <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-sm">
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-indigo-500"/>
                    <span className="font-medium text-slate-700">Einnahmen</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-slate-400"/>
                    <span className="font-medium text-slate-700">Ausgaben</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={annualData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748B' }} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={(val) => `€${val/1000}k`} tick={{ fontSize: 12, fill: '#64748B' }} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: 'rgba(241, 245, 249, 0.5)' }} contentStyle={{ backgroundColor: 'white', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }} labelStyle={{ fontWeight: 'bold' }} formatter={(value, name) => [formatCurrency(value), name.charAt(0).toUpperCase() + name.slice(1)]} />
                  <Bar dataKey="income" name="Einnahmen" fill="#4F46E5" radius={[4, 4, 0, 0]} maxBarSize={30} />
                  <Bar dataKey="expense" name="Ausgaben" fill="#A1A1AA" radius={[4, 4, 0, 0]} maxBarSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>

        {/* --- AKTUALISIERTES DESIGN: Ausgaben nach Kategorie --- */}
        <Card className="lg:col-span-3 relative overflow-hidden">
          {/* Premium gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/30 via-purple-50/20 to-white pointer-events-none"></div>
          
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-800 mb-1">Ausgaben nach Kategorie</h3>
                  <p className="text-sm text-slate-500 font-medium">Verteilung deiner monatlichen Ausgaben</p>
                </div>
              </div>
              
              <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <button onClick={goToPreviousPieChartMonth} className="btn-icon bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-800" title="Vorheriger Monat">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="px-4 py-2 min-w-[180px] text-center">
                    <span className="font-bold text-slate-800 text-sm tracking-wide">{pieChartDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}</span>
                  </div>
                  <button onClick={goToNextPieChartMonth} className="btn-icon bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-800" title="Nächster Monat">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-stretch min-h-[32rem]">
              
              {/* Donut Chart Section */}
              <div className="lg:col-span-3 relative">
                <div className="relative w-full h-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={monthlySpendingData} 
                        cx="50%" 
                        cy="50%" 
                        innerRadius={95} 
                        outerRadius={135} 
                        paddingAngle={3} 
                        dataKey="value" 
                        stroke="rgba(255,255,255,0.8)"
                        strokeWidth={2}
                        onMouseEnter={(data) => setHoveredData(data.payload)}
                        onMouseLeave={() => setHoveredData(null)}
                      >
                        {monthlySpendingData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={chartColors[index % chartColors.length]}
                            className="transition-all duration-300 drop-shadow-sm"
                            fillOpacity={hoveredData && hoveredData.name !== entry.name ? 0.4 : 1}
                            style={{
                              filter: hoveredData && hoveredData.name === entry.name ? 'drop-shadow(0 4px 8px rgba(0,0,0,0.15))' : 'none',
                              transform: hoveredData && hoveredData.name === entry.name ? 'scale(1.02)' : 'scale(1)'
                            }}
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  
                  {/* Simple center content */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center transition-all duration-300">
                      {hoveredData ? (
                        <>
                          <div className="text-sm font-semibold text-slate-600 mb-2">{hoveredData.name}</div>
                          <div className="text-3xl font-black text-slate-800">
                            {formatCurrency(hoveredData.value)}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-sm font-semibold text-slate-600 mb-2">Gesamtausgaben</div>
                          <div className="text-3xl font-black text-slate-800">
                            {formatCurrency(monthlySpendingData.reduce((sum, item) => sum + item.value, 0))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Categories List Section - 8 visible items */}
              <div className="lg:col-span-2 flex flex-col">
                <h4 className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wide">Top Kategorien</h4>
                <div className="flex-1 space-y-2 overflow-hidden">
                  <div className="h-full overflow-y-auto pr-2 space-y-2" style={{ maxHeight: '28rem' }}>
                    {monthlySpendingData
                      .sort((a, b) => b.value - a.value)
                      .map((entry, index) => {
                        const percentage = ((entry.value / monthlySpendingData.reduce((sum, item) => sum + item.value, 0)) * 100);
                        const isHovered = hoveredData && hoveredData.name === entry.name;
                        
                        return (
                          <div
                            key={entry.name}
                            className={`group relative p-4 rounded-xl transition-all duration-200 cursor-pointer border bg-white/80 backdrop-blur-sm ${isHovered ? 'border-indigo-300 bg-indigo-50/50' : 'border-white/60 hover:bg-white/90'}`}
                            onMouseEnter={() => setHoveredData(entry)}
                            onMouseLeave={() => setHoveredData(null)}
                            style={{ height: '3.5rem' }}
                          >
                            <div className="flex items-center justify-between h-full">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-slate-400 w-4 text-center">#{index + 1}</span>
                                  <div 
                                    className="w-3 h-3 rounded-lg shadow-sm flex-shrink-0" 
                                    style={{ backgroundColor: chartColors[monthlySpendingData.indexOf(entry) % chartColors.length] }}
                                  ></div>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="font-semibold text-slate-800 text-sm truncate">{entry.name}</div>
                                  <div className="text-xs text-slate-500">{percentage.toFixed(1)}% der Ausgaben</div>
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <div className="font-bold text-slate-800 text-sm">
                                  {formatCurrency(entry.value)}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                  
                  {/* Scroll indicator */}
                  {monthlySpendingData.length > 8 && (
                    <div className="text-center pt-2">
                      <span className="text-xs text-slate-400 font-medium">
                        {monthlySpendingData.length - 8} weitere Kategorien verfügbar
                      </span>
                    </div>
                  )}
                </div>
              </div>

            </div>
            
            {monthlySpendingData.length === 0 && (
              <div className="flex items-center justify-center h-96">
                <div className="bg-white/60 backdrop-blur-sm rounded-3xl border border-white/60 p-12 shadow-lg text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-slate-300 to-slate-400 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h4 className="text-xl font-bold text-slate-800 mb-3">Keine Ausgaben vorhanden</h4>
                  <p className="text-slate-500 font-medium">Für {pieChartDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })} liegen keine Daten vor.</p>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* --- PREMIUM REDESIGN: Budgetübersicht --- */}
        <Card className="lg:col-span-3 relative overflow-hidden">
          {/* Premium gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-purple-50/30 via-pink-50/20 to-white pointer-events-none"></div>
          
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-800 mb-1">Budgetübersicht</h3>
                  <p className="text-sm text-slate-500 font-medium">Deine monatlichen Budgets vs. tatsächliche Ausgaben</p>
                </div>
              </div>
              
              <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <button onClick={goToPreviousBudgetMonth} className="btn-icon bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-800" title="Vorheriger Monat">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="px-4 py-2 min-w-[180px] text-center">
                    <span className="font-bold text-slate-800 text-sm tracking-wide">{budgetDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}</span>
                  </div>
                  <button onClick={goToNextBudgetMonth} className="btn-icon bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-800" title="Nächster Monat">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
            {budgetComparisonData.length > 0 ? (
              <div className="space-y-3">
                {budgetComparisonData.map((item, index) => {
                  const remaining = item.budget - item.actual;
                  const progressPercentage = item.budget > 0 ? (item.actual / item.budget) * 100 : 0;
                  const isOverBudget = remaining < 0;
                  const isNearLimit = progressPercentage > 80 && !isOverBudget;
                  
                  return (
                    <div key={item.category} className="p-5 rounded-xl transition-all duration-200 bg-white/80 backdrop-blur-sm border border-white/60 hover:bg-white/90" style={{ height: '5rem' }}>
                      <div className="flex items-center justify-between h-full">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className={`w-4 h-4 rounded-lg flex-shrink-0 ${isOverBudget ? 'bg-red-500' : isNearLimit ? 'bg-yellow-500' : 'bg-emerald-500'}`}></div>
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-slate-800 text-base truncate">{item.category}</div>
                            <div className="text-sm text-slate-500">
                              {formatCurrency(item.actual)} von {formatCurrency(item.budget)} 
                              <span className="ml-1">({progressPercentage.toFixed(0)}%)</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-right flex-shrink-0 ml-6">
                          <div className={`font-bold text-base ${isOverBudget ? 'text-red-600' : isNearLimit ? 'text-yellow-600' : 'text-emerald-600'}`}>
                            {formatCurrency(Math.abs(remaining))}
                          </div>
                          <div className={`text-xs font-medium ${isOverBudget ? 'text-red-500' : isNearLimit ? 'text-yellow-500' : 'text-emerald-500'}`}>
                            {isOverBudget ? 'Überschritten' : 'Verfügbar'}
                          </div>
                        </div>
                        
                        <div className="w-32 ml-6">
                          <div className="h-4 bg-slate-200/80 rounded-full overflow-hidden shadow-inner">
                            <div 
                              className={`h-full rounded-full transition-all duration-700 shadow-sm ${
                                isOverBudget 
                                  ? 'bg-gradient-to-r from-red-400 to-red-600' 
                                  : isNearLimit 
                                    ? 'bg-gradient-to-r from-yellow-400 to-yellow-600'
                                    : 'bg-gradient-to-r from-emerald-400 to-emerald-600'
                              }`}
                              style={{ width: `${Math.min(100, progressPercentage)}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center h-96">
                <div className="bg-white/60 backdrop-blur-sm rounded-3xl border border-white/60 p-12 shadow-lg text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  {hasAnyBudgets ? (
                    <>
                      <h4 className="text-xl font-bold text-slate-800 mb-3">Keine Budgets für {budgetDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}</h4>
                      <p className="text-slate-500 font-medium mb-6">Für diesen Monat wurden noch keine Budgets festgelegt. Du kannst deine bestehenden Budgets kopieren oder neue erstellen.</p>
                      <button className="btn bg-gradient-to-r from-purple-500 to-pink-600 text-white hover:from-purple-600 hover:to-pink-700 shadow-lg">
                        Budget für diesen Monat erstellen
                      </button>
                    </>
                  ) : (
                    <>
                      <h4 className="text-xl font-bold text-slate-800 mb-3">Keine Budgets festgelegt</h4>
                      <p className="text-slate-500 font-medium mb-6">Erstelle Budgets in den Einstellungen, um deine Ausgaben zu verfolgen.</p>
                      <button className="btn bg-gradient-to-r from-purple-500 to-pink-600 text-white hover:from-purple-600 hover:to-pink-700 shadow-lg">
                        Budgets erstellen
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default DashboardPage;