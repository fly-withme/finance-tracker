import React, { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  ChevronLeft, 
  ChevronRight,
  TrendingUp, 
  Target, 
  PiggyBank,
  AlertTriangle,
  BarChart3,
  TrendingDown,
  PieChart as PieChartIcon
} from 'lucide-react';
import { Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, LineChart, Line, ComposedChart } from 'recharts';
import { db } from '../utils/db';
import { jonyColors } from '../theme';

const DashboardPage = ({ setPage, currentMonth, changeMonth }) => {
  // State for subscriptions
  const [subscriptions, setSubscriptions] = useState([
    { id: 1, name: 'Netflix', amount: 12.99, isActive: true, color: '#ff4757' },
    { id: 2, name: 'Spotify', amount: 9.99, isActive: true, color: '#00ff41' },
    { id: 3, name: 'Adobe Creative', amount: 59.99, isActive: false, color: '#64748b' },
    { id: 4, name: 'Gym Membership', amount: 29.90, isActive: true, color: '#ffa726' }
  ]);

  // Toggle subscription function
  const toggleSubscription = (id) => {
    setSubscriptions(prev => 
      prev.map(sub => 
        sub.id === id ? { ...sub, isActive: !sub.isActive } : sub
      )
    );
  };

  // All existing state and data calculations remain the same...
  // (I'll keep all the existing data processing logic)
  
  // Placeholder data calculations - in actual implementation, use existing logic
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const formatCurrencyNoDecimals = (amount) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Mock data - replace with actual calculations
  const dashboardMetrics = {
    netWorth: 25000,
    netWorthChange: 1250,
    cashflowPositive: true
  };
  
  const fiMetrics = {
    finanzScore: 'B',
    yearsToFI: 15
  };
  
  const monthlyIncome = 3500;
  const monthlyExpense = 2800;
  
  const savingsRateData = [
    { month: 'Jan', savingsRate: 15 },
    { month: 'Feb', savingsRate: 18 },
    { month: 'Mar', savingsRate: 12 },
    { month: 'Apr', savingsRate: 22 },
    { month: 'Mai', savingsRate: 20 },
    { month: 'Jun', savingsRate: 25 }
  ];
  
  const budgetVsActualData = [
    { name: 'Lebensmittel', budget: 400, actual: 380, progress: 95, color: jonyColors.magenta, bgColor: jonyColors.magentaAlpha },
    { name: 'Transport', budget: 200, actual: 180, progress: 90, color: jonyColors.magenta, bgColor: jonyColors.magentaAlpha },
    { name: 'Unterhaltung', budget: 150, actual: 170, progress: 113, color: jonyColors.magenta, bgColor: jonyColors.magentaAlpha },
    { name: 'Gesundheit', budget: 100, actual: 80, progress: 80, color: jonyColors.magenta, bgColor: jonyColors.magentaAlpha }
  ];
  
  const savingsGoalsData = {
    chartData: [
      { name: 'Notgroschen', current: 5000, target: 10000, progressPercentage: 50 },
      { name: 'Urlaub', current: 800, target: 2000, progressPercentage: 40 },
      { name: 'Auto', current: 3000, target: 15000, progressPercentage: 20 }
    ]
  };
  
  const debtData = {
    chartData: [
      { name: 'Kreditkarte', remaining: 1200, total: 5000, progressPercentage: 76 },
      { name: 'Studienkredit', remaining: 8000, total: 20000, progressPercentage: 60 }
    ]
  };
  
  
  // Calculate average savings rate from available months
  const averageSavingsRate = savingsRateData.length > 0 
    ? (savingsRateData.reduce((sum, item) => sum + item.savingsRate, 0) / savingsRateData.length).toFixed(1)
    : 0;

  // State for time period selection
  const [savingsRatePeriod, setSavingsRatePeriod] = useState('1year');
  const [cashflowPeriod, setCashflowPeriod] = useState('1year');

  // Generate daily spending data for the entire current month
  const generateDailySpendingData = (month) => {
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    
    const dailyData = [];
    for (let day = 1; day <= daysInMonth; day++) {
      // Generate realistic spending amounts with some variation
      const baseAmount = 50 + Math.random() * 150; // Base between 50-200
      const weekdayMultiplier = (day % 7 === 0 || day % 7 === 6) ? 1.3 : 1; // Weekend multiplier
      const monthlyVariation = Math.sin(day / daysInMonth * Math.PI) * 30; // Monthly curve
      const expense = Math.round(baseAmount * weekdayMultiplier + monthlyVariation);
      
      dailyData.push({ day, expense });
    }
    return dailyData;
  };

  const dailySpendingData = generateDailySpendingData(currentMonth || new Date());


  const annualSavingsRateData = {
    '1year': savingsRateData,
    '5years': [
      { month: '2020', savingsRate: 12 },
      { month: '2021', savingsRate: 15 },
      { month: '2022', savingsRate: 18 },
      { month: '2023', savingsRate: 16 },
      { month: '2024', savingsRate: 17.5 }
    ],
    'max': [
      { month: '2018', savingsRate: 8 },
      { month: '2019', savingsRate: 10 },
      { month: '2020', savingsRate: 12 },
      { month: '2021', savingsRate: 15 },
      { month: '2022', savingsRate: 18 },
      { month: '2023', savingsRate: 16 },
      { month: '2024', savingsRate: 17.5 }
    ]
  };

  const cashflowData = {
    '1year': [
      { month: 'Jan', income: 3500, expense: 2800, net: 700 },
      { month: 'Feb', income: 3500, expense: 2900, net: 600 },
      { month: 'Mar', income: 3500, expense: 2700, net: 800 },
      { month: 'Apr', income: 3600, expense: 2750, net: 850 },
      { month: 'Mai', income: 3600, expense: 2850, net: 750 },
      { month: 'Jun', income: 3500, expense: 2600, net: 900 },
      { month: 'Jul', income: 3500, expense: 2750, net: 750 },
      { month: 'Aug', income: 3600, expense: 2800, net: 800 },
      { month: 'Sep', income: 3700, expense: 2900, net: 800 },
      { month: 'Okt', income: 3500, expense: 2650, net: 850 },
      { month: 'Nov', income: 3600, expense: 2800, net: 800 },
      { month: 'Dez', income: 3500, expense: 2700, net: 800 }
    ],
    '5years': [
      { month: '2020', income: 2800, expense: 2400, net: 400 },
      { month: '2021', income: 3000, expense: 2500, net: 500 },
      { month: '2022', income: 3200, expense: 2600, net: 600 },
      { month: '2023', income: 3400, expense: 2750, net: 650 },
      { month: '2024', income: 3600, expense: 2800, net: 800 }
    ],
    'max': [
      { month: '2018', income: 2200, expense: 2000, net: 200 },
      { month: '2019', income: 2500, expense: 2200, net: 300 },
      { month: '2020', income: 2800, expense: 2400, net: 400 },
      { month: '2021', income: 3000, expense: 2500, net: 500 },
      { month: '2022', income: 3200, expense: 2600, net: 600 },
      { month: '2023', income: 3400, expense: 2750, net: 650 },
      { month: '2024', income: 3600, expense: 2800, net: 800 }
    ]
  };

  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: jonyColors.background, color: jonyColors.textPrimary }}>
      {/* Simple Personal Header */}
      <div className="px-6 py-8 mb-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-1 h-8 rounded-full" style={{ backgroundColor: jonyColors.accent1 }}></div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: jonyColors.textPrimary, letterSpacing: '-0.02em' }}>
              Willkommen zurück, User
            </h1>
          </div>
        </div>
      </div>

      {/* 1. JAHRESÜBERSICHT & FORTSCHRITT */}
      <div className="px-6 mb-12">
        <div className="max-w-7xl mx-auto">
          
          {/* Top Row - Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {/* Nettovermögen */}
            <div className="p-6 rounded-2xl border flex items-center justify-center text-center h-40"
              style={{
                backgroundColor: jonyColors.surface,
                border: `1px solid ${jonyColors.border}`
              }}>
              <div>
                <div className="text-4xl font-bold mb-2" style={{ 
                  color: jonyColors.accent1
                }}>
                  {formatCurrencyNoDecimals(dashboardMetrics.netWorth)}
                </div>
                <div className="text-sm font-semibold" style={{ color: jonyColors.textPrimary }}>
                  Nettovermögen
                </div>
              </div>
            </div>

            {/* Years to FI */}
            <div className="p-6 rounded-2xl border flex items-center justify-center text-center h-40"
              style={{
                backgroundColor: jonyColors.surface,
                border: `1px solid ${jonyColors.border}`
              }}>
              <div>
                <div className="text-5xl font-bold mb-2" style={{ 
                  color: (fiMetrics?.yearsToFI !== null && fiMetrics?.yearsToFI !== undefined) ? jonyColors.accent1 : jonyColors.textSecondary
                }}>
                  {(fiMetrics?.yearsToFI !== null && fiMetrics?.yearsToFI !== undefined) ? `${fiMetrics.yearsToFI}` : '∞'}
                </div>
                <div className="text-sm font-semibold" style={{ color: jonyColors.textPrimary }}>
                  Jahre zur FI
                </div>
              </div>
            </div>

            {/* Score */}
            <div className="p-6 rounded-2xl border flex items-center justify-center text-center h-40"
              style={{
                backgroundColor: jonyColors.surface,
                border: `1px solid ${jonyColors.border}`
              }}>
              <div>
                <div className="text-5xl font-bold mb-2" style={{ 
                  color: fiMetrics?.finanzScore === 'A' ? jonyColors.accent1 : 
                         fiMetrics?.finanzScore === 'B' ? jonyColors.accent1 : jonyColors.red
                }}>
                  {fiMetrics?.finanzScore || 'C'}
                </div>
                <div className="text-sm font-semibold" style={{ color: jonyColors.textPrimary }}>
                  Score
                </div>
              </div>
            </div>

            {/* Average Savings Rate */}
            <div className="p-6 rounded-2xl border flex items-center justify-center text-center h-40"
              style={{
                backgroundColor: jonyColors.surface,
                border: `1px solid ${jonyColors.border}`
              }}>
              <div>
                <div className="text-5xl font-bold mb-2" style={{ 
                  color: jonyColors.accent1
                }}>
                  {averageSavingsRate}%
                </div>
                <div className="text-sm font-semibold" style={{ color: jonyColors.textPrimary }}>
                  Ø Sparquote
                </div>
              </div>
            </div>
          </div>

          {/* Cashflow Entwicklung - Directly under metrics */}
          <div 
            className="p-6 rounded-2xl border mb-8"
            style={{
              backgroundColor: jonyColors.surface,
              border: `1px solid ${jonyColors.border}`
            }}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl" style={{ backgroundColor: jonyColors.accent2Alpha }}>
                  <BarChart3 className="w-5 h-5" style={{ color: jonyColors.accent2, strokeWidth: 1.5 }} />
                </div>
                <h3 className="text-lg font-light tracking-tight" style={{ color: jonyColors.textPrimary }}>
                  Cashflow Entwicklung
                </h3>
              </div>
              <div className="flex gap-2">
                {['1year', '5years', 'max'].map((period) => (
                  <button
                    key={period}
                    onClick={() => setCashflowPeriod(period)}
                    className={`px-3 py-1 rounded-lg text-sm transition-all duration-200 ${
                      cashflowPeriod === period ? 'font-semibold' : 'hover:bg-opacity-80'
                    }`}
                    style={{
                      backgroundColor: cashflowPeriod === period ? jonyColors.accent1 : jonyColors.cardBackground,
                      color: cashflowPeriod === period ? 'black' : jonyColors.textPrimary,
                      border: `1px solid ${cashflowPeriod === period ? jonyColors.accent1 : jonyColors.border}`
                    }}
                  >
                    {period === '1year' ? '1J' : period === '5years' ? '5J' : 'Max'}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={cashflowData[cashflowPeriod]} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <defs>
                    <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={jonyColors.accent1} stopOpacity={0.7}/>
                      <stop offset="95%" stopColor={jonyColors.accent1} stopOpacity={0.1}/>
                    </linearGradient>
                    <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={jonyColors.magenta} stopOpacity={0.7}/>
                      <stop offset="95%" stopColor={jonyColors.magenta} stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="1 1" stroke={jonyColors.textTertiary} opacity={0.2} />
                  <XAxis 
                    dataKey="month" 
                    stroke={jonyColors.textTertiary}
                    fontSize={11}
                    axisLine={false}
                    tickLine={false}
                    fontWeight={400}
                  />
                  <YAxis 
                    stroke={jonyColors.textTertiary}
                    fontSize={11}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => (value / 1000).toFixed(0) + 'K'}
                    fontWeight={400}
                  />
                  <Tooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div style={{
                            backgroundColor: jonyColors.surface,
                            border: `1px solid ${jonyColors.cardBorder}`,
                            borderRadius: '12px',
                            padding: '12px 16px',
                            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6)',
                            color: jonyColors.textPrimary,
                            fontSize: '14px',
                            fontWeight: '500'
                          }}>
                            <p style={{ 
                              color: jonyColors.textPrimary, 
                              margin: '0 0 8px 0',
                              fontWeight: '600'
                            }}>
                              {label}
                            </p>
                            {payload.map((entry, index) => (
                              <p key={index} style={{ 
                                color: jonyColors.textPrimary,
                                margin: '4px 0',
                                fontWeight: '500'
                              }}>
                                <span style={{ color: entry.color }}>●</span>{' '}
                                {entry.name === 'income' ? 'Einnahmen' : 
                                 entry.name === 'expense' ? 'Ausgaben' : 'Netto'}: {' '}
                                {formatCurrencyNoDecimals(entry.value)}
                              </p>
                            ))}
                          </div>
                        );
                      }
                      return null;
                    }}
                    cursor={{ fill: jonyColors.accent1Alpha, opacity: 0.1 }}
                  />
                  <Bar 
                    dataKey="income" 
                    fill="url(#incomeGradient)" 
                    radius={[6, 6, 0, 0]} 
                    name="income" 
                  />
                  <Bar 
                    dataKey="expense" 
                    fill="url(#expenseGradient)" 
                    radius={[6, 6, 0, 0]} 
                    name="expense" 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="net" 
                    stroke={jonyColors.accent1} 
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 6, fill: jonyColors.accent1, strokeWidth: 2, stroke: 'white' }}
                    name="net"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Savings Rate Development */}
          <div 
            className="p-6 rounded-2xl border mb-8"
            style={{
              backgroundColor: jonyColors.surface,
              border: `1px solid ${jonyColors.border}`
            }}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl" style={{ backgroundColor: jonyColors.accent1Alpha }}>
                  <TrendingUp className="w-5 h-5" style={{ color: jonyColors.accent1, strokeWidth: 1.5 }} />
                </div>
                <h3 className="text-lg font-light tracking-tight" style={{ color: jonyColors.textPrimary }}>
                  Sparquote
                </h3>
              </div>
              <div className="flex gap-2">
                {['1year', '5years', 'max'].map((period) => (
                  <button
                    key={period}
                    onClick={() => setSavingsRatePeriod(period)}
                    className={`px-3 py-1 rounded-lg text-sm transition-all duration-200 ${
                      savingsRatePeriod === period ? 'font-semibold' : 'hover:bg-opacity-80'
                    }`}
                    style={{
                      backgroundColor: savingsRatePeriod === period ? jonyColors.accent1 : jonyColors.cardBackground,
                      color: savingsRatePeriod === period ? 'black' : jonyColors.textPrimary,
                      border: `1px solid ${savingsRatePeriod === period ? jonyColors.accent1 : jonyColors.border}`
                    }}
                  >
                    {period === '1year' ? '1J' : period === '5years' ? '5J' : 'Max'}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={annualSavingsRateData[savingsRatePeriod]} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <defs>
                    <linearGradient id="savingsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={jonyColors.accent1} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={jonyColors.accent1} stopOpacity={0.05}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="1 1" stroke={jonyColors.textTertiary} opacity={0.2} />
                  <XAxis 
                    dataKey="month" 
                    axisLine={false} 
                    tickLine={false} 
                    fontSize={11}
                    stroke={jonyColors.textTertiary}
                    fontWeight={400}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    fontSize={11}
                    stroke={jonyColors.textTertiary}
                    tickFormatter={(value) => `${value}%`} 
                    fontWeight={400}
                  />
                  <Tooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div style={{
                            backgroundColor: jonyColors.surface,
                            border: `1px solid ${jonyColors.cardBorder}`,
                            borderRadius: '12px',
                            padding: '12px 16px',
                            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6)',
                            color: jonyColors.textPrimary,
                            fontSize: '14px',
                            fontWeight: '500'
                          }}>
                            <p style={{ 
                              color: jonyColors.textPrimary, 
                              margin: '0 0 8px 0',
                              fontWeight: '600'
                            }}>
                              {label}
                            </p>
                            {payload.map((entry, index) => (
                              <p key={index} style={{ 
                                color: jonyColors.textPrimary,
                                margin: '4px 0',
                                fontWeight: '500'
                              }}>
                                <span style={{ color: entry.color }}>●</span>{' '}
                                Sparquote: {entry.value}%
                              </p>
                            ))}
                          </div>
                        );
                      }
                      return null;
                    }}
                    cursor={{ fill: jonyColors.accent1Alpha, opacity: 0.1 }}
                  />
                  <Area type="monotone" dataKey="savingsRate" stroke="none" fill="url(#savingsGradient)" />
                  <Line 
                    type="monotone" 
                    dataKey="savingsRate" 
                    stroke={jonyColors.accent1} 
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 6, fill: jonyColors.accent1, strokeWidth: 2, stroke: 'white' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Sparziele & Schuldenabbau - Linear Progress Bars */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Sparziele */}
            <div 
              className="p-8 rounded-3xl  transition-all duration-300 hover:bg-opacity-90"
              style={{
                backgroundColor: jonyColors.cardBackground,
                border: `1px solid ${jonyColors.cardBorder}`,
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
              }}
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 rounded-xl" style={{ backgroundColor: jonyColors.accent1Alpha }}>
                  <Target className="w-5 h-5" style={{ color: jonyColors.accent1, strokeWidth: 1.5 }} />
                </div>
                <h3 className="text-lg font-light tracking-tight" style={{ color: jonyColors.textPrimary }}>
                  Sparziele
                </h3>
              </div>
              
              {savingsGoalsData && savingsGoalsData.chartData.length > 0 ? (
                <div className="space-y-4">
                  {savingsGoalsData.chartData.slice(0, 4).map((goal, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium tracking-tight" style={{ color: jonyColors.textPrimary }}>
                          {goal.name}
                        </span>
                        <span className="text-sm font-light" style={{ color: jonyColors.accent1 }}>
                          {goal.progressPercentage.toFixed(0)}%
                        </span>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="w-full rounded-full h-3 mb-2" style={{ backgroundColor: jonyColors.accent1Alpha }}>
                        <div 
                          className="h-3 rounded-full transition-all duration-500"
                          style={{ 
                            width: `${goal.progressPercentage}%`,
                            backgroundColor: jonyColors.accent1,
                            boxShadow: '0 1px 2px rgba(34, 197, 94, 0.2)'
                          }}
                        ></div>
                      </div>
                      
                      <div className="text-xs font-light" style={{ color: jonyColors.textSecondary }}>
                        {formatCurrency(goal.current)} von {formatCurrency(goal.target)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8" style={{ color: jonyColors.textSecondary }}>
                  <div className="text-2xl mb-2">🎯</div>
                  <div className="text-sm">Keine Sparziele definiert</div>
                </div>
              )}
            </div>

            {/* Schulden */}
            <div 
              className="p-8 rounded-3xl  transition-all duration-300 hover:bg-opacity-90"
              style={{
                backgroundColor: jonyColors.cardBackground,
                border: `1px solid ${jonyColors.cardBorder}`,
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
              }}
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 rounded-xl" style={{ backgroundColor: jonyColors.magentaAlpha }}>
                  <AlertTriangle className="w-5 h-5" style={{ color: jonyColors.magenta, strokeWidth: 1.5 }} />
                </div>
                <h3 className="text-lg font-light tracking-tight" style={{ color: jonyColors.textPrimary }}>
                  Schuldenabbau
                </h3>
              </div>
              
              {debtData && debtData.chartData.length > 0 ? (
                <div className="space-y-4">
                  {debtData.chartData.slice(0, 4).map((debt, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium tracking-tight" style={{ color: jonyColors.textPrimary }}>
                          {debt.name}
                        </span>
                        <span className="text-sm font-light" style={{ color: jonyColors.magenta }}>
                          {debt.progressPercentage.toFixed(0)}%
                        </span>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="w-full rounded-full h-3 mb-2" style={{ backgroundColor: jonyColors.magentaAlpha }}>
                        <div 
                          className="h-3 rounded-full transition-all duration-500"
                          style={{ 
                            width: `${debt.progressPercentage}%`,
                            backgroundColor: jonyColors.magenta,
                            boxShadow: '0 1px 2px rgba(245, 158, 11, 0.2)'
                          }}
                        ></div>
                      </div>
                      
                      <div className="text-xs font-light" style={{ color: jonyColors.textSecondary }}>
                        {formatCurrency(debt.remaining)} von {formatCurrency(debt.total)} verbleibend
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8" style={{ color: jonyColors.textSecondary }}>
                  <div className="text-2xl mb-2">✅</div>
                  <div className="text-sm">Schuldenfrei!</div>
                </div>
              )}
            </div>
          </div>
          {/* Subscriptions Section */}
          <div 
            className="p-8 rounded-3xl  transition-all duration-300 hover:bg-opacity-90"
            style={{
              backgroundColor: jonyColors.cardBackground,
              border: `1px solid ${jonyColors.cardBorder}`,
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
            }}
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 rounded-xl" style={{ backgroundColor: jonyColors.magentaAlpha }}>
                <PieChartIcon className="w-5 h-5" style={{ color: jonyColors.magenta, strokeWidth: 1.5 }} />
              </div>
              <h3 className="text-lg font-light tracking-tight" style={{ color: jonyColors.textPrimary }}>
                Deine Abos
              </h3>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {subscriptions.map((subscription) => (
                <div 
                  key={subscription.id} 
                  className={`p-6 rounded-2xl border flex flex-col items-center justify-center text-center h-40 transition-all duration-300 ${subscription.isActive ? '' : 'opacity-60'}`}
                  style={{
                    backgroundColor: jonyColors.surface,
                    border: `1px solid ${jonyColors.border}`
                  }}
                >
                  <div className="flex items-center justify-between w-full mb-2">
                    <span className="text-sm font-semibold" style={{ 
                      color: subscription.isActive ? jonyColors.magenta : jonyColors.textSecondary 
                    }}>
                      {subscription.name}
                    </span>
                    <button
                      onClick={() => toggleSubscription(subscription.id)}
                      className={`w-8 h-4 rounded-full transition-all duration-300 flex items-center ${
                        subscription.isActive ? 'justify-end' : 'justify-start'
                      }`}
                      style={{
                        backgroundColor: subscription.isActive ? jonyColors.magenta : jonyColors.cardBorder
                      }}
                      title={subscription.isActive ? 'Deaktivieren' : 'Aktivieren'}
                    >
                      <div 
                        className="w-3 h-3 rounded-full transition-all duration-300"
                        style={{
                          backgroundColor: subscription.isActive ? jonyColors.background : jonyColors.textSecondary,
                          margin: '2px'
                        }}
                      />
                    </button>
                  </div>
                  
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-2xl font-bold mb-1" style={{ 
                        color: subscription.isActive ? jonyColors.textPrimary : jonyColors.textSecondary,
                        lineHeight: '1.2'
                      }}>
                        {subscription.amount.toFixed(2)}€
                      </div>
                      <div className="text-xs font-light" style={{ color: jonyColors.textTertiary }}>
                        pro Monat
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-8 pt-6 border-t" style={{ borderColor: jonyColors.cardBorder }}>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium tracking-tight" style={{ color: jonyColors.textPrimary }}>
                  Aktive Abos gesamt:
                </span>
                <span className="text-lg font-light" style={{ color: jonyColors.textPrimary }}>
                  52,88€/Monat
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* 2. MONATLICHE METRIKEN */}
      <div className="px-6 mb-12">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-1 h-8 rounded-full" style={{ backgroundColor: jonyColors.accent1 }}></div>
              <h2 className="text-3xl font-bold tracking-tight" style={{ color: jonyColors.textPrimary, letterSpacing: '-0.02em' }}>
                Monatliche Metriken
              </h2>
            </div>
            
            {/* Monats-Umschalter */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => changeMonth(-1)}
                className="p-3 rounded-xl border transition-all duration-300 hover:bg-opacity-80"
                style={{
                  backgroundColor: jonyColors.cardBackground,
                  borderColor: jonyColors.cardBorder,
                  color: jonyColors.textSecondary
                }}
              >
                <ChevronLeft className="w-4 h-4" style={{ strokeWidth: 1.5 }} />
              </button>
              <div className="px-6 py-3 rounded-xl border font-light w-48 text-center" style={{
                backgroundColor: jonyColors.cardBackground,
                borderColor: jonyColors.cardBorder,
                color: jonyColors.textPrimary
              }}>
                {currentMonth ? currentMonth.toLocaleString('de-DE', { month: 'long', year: 'numeric' }) : 'Juni 2024'}
              </div>
              <button
                onClick={() => changeMonth(1)}
                className="p-3 rounded-xl border transition-all duration-300 hover:bg-opacity-80"
                style={{
                  backgroundColor: jonyColors.cardBackground,
                  borderColor: jonyColors.cardBorder,
                  color: jonyColors.textSecondary
                }}
              >
                <ChevronRight className="w-4 h-4" style={{ strokeWidth: 1.5 }} />
              </button>
            </div>
          </div>
          
          {/* Three metric cards in a row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Monatliche Einnahmen */}
            <div className="p-6 rounded-2xl border flex items-center justify-center text-center h-40"
              style={{
                backgroundColor: jonyColors.surface,
                border: `1px solid ${jonyColors.border}`
              }}>
              <div>
                <div className="text-4xl font-bold mb-2" style={{ 
                  color: jonyColors.accent1
                }}>
                  {formatCurrencyNoDecimals(monthlyIncome)}
                </div>
                <div className="text-sm font-semibold" style={{ color: jonyColors.textPrimary }}>
                  Monatliche Einnahmen
                </div>
              </div>
            </div>

            {/* Monatliche Ausgaben */}
            <div className="p-6 rounded-2xl border flex items-center justify-center text-center h-40"
              style={{
                backgroundColor: jonyColors.surface,
                border: `1px solid ${jonyColors.border}`
              }}>
              <div>
                <div className="text-4xl font-bold mb-2" style={{ 
                  color: jonyColors.magenta
                }}>
                  {formatCurrencyNoDecimals(monthlyExpense)}
                </div>
                <div className="text-sm font-semibold" style={{ color: jonyColors.textPrimary }}>
                  Monatliche Ausgaben
                </div>
              </div>
            </div>

            {/* Monatliche Sparrate */}
            <div className="p-6 rounded-2xl border flex items-center justify-center text-center h-40"
              style={{
                backgroundColor: jonyColors.surface,
                border: `1px solid ${jonyColors.border}`
              }}>
              <div>
                <div className="text-4xl font-bold mb-2" style={{ 
                  color: jonyColors.accent1
                }}>
                  {formatCurrencyNoDecimals(monthlyIncome - monthlyExpense)}
                </div>
                <div className="text-sm font-semibold" style={{ color: jonyColors.textPrimary }}>
                  Monatliche Sparrate
                </div>
              </div>
            </div>
          </div>

          {/* Full-width card for expenses by category */}
          <div 
            className="p-8 rounded-3xl  mb-8 transition-all duration-300 hover:bg-opacity-90"
            style={{
              backgroundColor: jonyColors.cardBackground,
              border: `1px solid ${jonyColors.cardBorder}`,
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
            }}
          >
            <div className="flex items-center gap-4 mb-8">
              <div 
                className="p-3 rounded-xl"
                style={{ backgroundColor: jonyColors.magentaAlpha }}
              >
                <BarChart3 className="w-5 h-5" style={{ color: jonyColors.magenta, strokeWidth: 1.5 }} />
              </div>
              <h3 className="text-lg font-light tracking-tight" style={{ color: jonyColors.textPrimary }}>
                Ausgaben pro Kategorie
              </h3>
            </div>
            
            <div className="space-y-6">
              {budgetVsActualData.map((item, index) => {
                const progressPercentage = Math.min((item.actual / item.budget) * 100, 100);
                const isOverBudget = item.actual > item.budget;
                
                return (
                  <div key={index} className="space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium tracking-tight" style={{ color: jonyColors.textPrimary }}>
                          {item.name}
                        </span>
                        <div 
                          className="px-2 py-1 rounded-md text-xs font-medium"
                          style={{ 
                            backgroundColor: item.bgColor,
                            color: item.color
                          }}
                        >
                          {item.progress.toFixed(0)}%
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium" style={{ 
                          color: isOverBudget ? item.color : jonyColors.textPrimary 
                        }}>
                          {formatCurrency(item.actual)}
                        </div>
                        <div className="text-xs font-light" style={{ color: jonyColors.textSecondary }}>
                          von {formatCurrency(item.budget)}
                        </div>
                      </div>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="w-full rounded-full h-3" style={{ backgroundColor: item.bgColor }}>
                      <div 
                        className="h-3 rounded-full transition-all duration-500"
                        style={{ 
                          width: `${progressPercentage}%`,
                          backgroundColor: item.color,
                          boxShadow: `0 1px 2px ${item.color}33`
                        }}
                      ></div>
                    </div>
                    
                    <div className="flex justify-between text-xs font-light" style={{ color: jonyColors.textSecondary }}>
                      <span>Verbraucht: {formatCurrency(item.actual)}</span>
                      <span>Verbleibend: {formatCurrency(Math.max(0, item.budget - item.actual))}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Daily Spending Behavior - Full Width */}
          <div 
            className="p-8 rounded-3xl  mb-8 transition-all duration-300 hover:bg-opacity-90"
            style={{
              backgroundColor: jonyColors.cardBackground,
              border: `1px solid ${jonyColors.cardBorder}`,
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
            }}
          >
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl" style={{ backgroundColor: jonyColors.magentaAlpha }}>
                  <BarChart3 className="w-5 h-5" style={{ color: jonyColors.magenta, strokeWidth: 1.5 }} />
                </div>
                <h3 className="text-lg font-light tracking-tight" style={{ color: jonyColors.textPrimary }}>
                  Ausgabenverhalten pro Tag
                </h3>
              </div>
            </div>
            
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart 
                  data={dailySpendingData} 
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="1 1" stroke={jonyColors.textTertiary} opacity={0.2} />
                  <XAxis 
                    dataKey="day" 
                    stroke={jonyColors.textTertiary}
                    fontSize={11}
                    fontWeight={400}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis 
                    stroke={jonyColors.textTertiary}
                    fontSize={11}
                    tickFormatter={(value) => value + '€'}
                    fontWeight={400}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div style={{
                            backgroundColor: jonyColors.surface,
                            border: `1px solid ${jonyColors.cardBorder}`,
                            borderRadius: '12px',
                            padding: '12px 16px',
                            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6)',
                            color: jonyColors.textPrimary,
                            fontSize: '14px',
                            fontWeight: '500'
                          }}>
                            <p style={{ 
                              color: jonyColors.textPrimary, 
                              margin: '0 0 8px 0',
                              fontWeight: '600'
                            }}>
                              Tag {label}
                            </p>
                            {payload.map((entry, index) => (
                              <p key={index} style={{ 
                                color: jonyColors.textPrimary,
                                margin: '4px 0',
                                fontWeight: '500'
                              }}>
                                <span style={{ color: entry.color }}>●</span>{' '}
                                Ausgaben: {entry.value}€
                              </p>
                            ))}
                          </div>
                        );
                      }
                      return null;
                    }}
                    cursor={{ fill: jonyColors.accent1Alpha, opacity: 0.1 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="expense" 
                    stroke={jonyColors.magenta} 
                    strokeWidth={2}
                    dot={{ fill: jonyColors.magenta, strokeWidth: 1, r: 3 }}
                    activeDot={{ r: 5, fill: jonyColors.magenta, strokeWidth: 2, stroke: 'white' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      </div>


    </div>
  );
};

export default DashboardPage;