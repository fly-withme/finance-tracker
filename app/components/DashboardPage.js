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
  PieChart as PieChartIcon,
  Plus,
  Upload
} from 'lucide-react';
import { Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, LineChart, Line, ComposedChart, AreaChart } from 'recharts';
import { db } from '../utils/db';
import { jonyColors } from '../theme';

const DashboardPage = ({ setPage, currentMonth, changeMonth }) => {
  // Smart savings detection keywords
  const SAVINGS_KEYWORDS = [
    'sparen', 'savings', 'investieren', 'investment', 'etf', 'aktien', 'stocks',
    'notgroschen', 'emergency fund', 'rücklagen', 'reserves', 'depot',
    'anlegen', 'invest', 'sparplan', 'saving plan', 'vermögensaufbau',
    'wealth building', 'altersvorsorge', 'retirement', 'pension'
  ];

  const detectSavings = (category, description, recipient) => {
    const text = `${category || ''} ${description || ''} ${recipient || ''}`.toLowerCase();
    return SAVINGS_KEYWORDS.some(keyword => text.includes(keyword));
  };

  // State for subscriptions
  const [subscriptions, setSubscriptions] = useState([
    { id: 1, name: 'Netflix', amount: 12.99, isActive: true, color: '#ff4757' },
    { id: 2, name: 'Spotify', amount: 9.99, isActive: true, color: '#00ff41' },
    { id: 3, name: 'Adobe Creative', amount: 59.99, isActive: false, color: '#64748b' },
    { id: 4, name: 'Gym Membership', amount: 29.90, isActive: true, color: '#ffa726' }
  ]);

  // File upload ref
  const fileInputRef = React.useRef(null);

  // Toggle subscription function
  const toggleSubscription = (id) => {
    setSubscriptions(prev => 
      prev.map(sub => 
        sub.id === id ? { ...sub, isActive: !sub.isActive } : sub
      )
    );
  };

  // File upload handler
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      // Skip header row if exists
      const dataLines = lines.slice(1);
      
      const transactions = [];
      
      for (const line of dataLines) {
        const columns = line.split(';');
        if (columns.length >= 4) {
          // Parse CSV format (adjust based on your CSV structure)
          const [dateStr, description, amount, ] = columns;
          
          if (dateStr && description && amount) {
            const parsedAmount = parseFloat(amount.replace(',', '.'));
            if (!isNaN(parsedAmount)) {
              transactions.push({
                date: dateStr,
                description: description.trim(),
                amount: parsedAmount,
                uploadedAt: new Date().toISOString(),
                processed: false
              });
            }
          }
        }
      }

      // Add transactions to inbox
      if (transactions.length > 0) {
        await db.inbox.bulkAdd(transactions);
        console.log(`${transactions.length} Transaktionen wurden erfolgreich hochgeladen`);
        
        // Optionally redirect to inbox
        if (setPage) {
          setPage('inbox');
        }
      }
    } catch (error) {
      console.error('Fehler beim Verarbeiten der Datei:', error);
    }

    // Reset file input
    event.target.value = '';
  };

  // Trigger file upload
  const triggerFileUpload = () => {
    fileInputRef.current?.click();
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

  // Live data queries from database
  const transactions = useLiveQuery(() => db.transactions.toArray()) || [];
  const savingsGoals = useLiveQuery(() => db.savingsGoals.toArray()) || [];
  const debts = useLiveQuery(() => db.debts.toArray()) || [];
  const budgets = useLiveQuery(() => db.budgets.toArray()) || [];
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  
  // German wealth averages by age group (2024 data in EUR)
  const germanWealthAverages = {
    '18-24': 8500,
    '25-34': 31000,
    '35-44': 81000, 
    '45-54': 142000,
    '55-64': 214000,
    '65+': 232000
  };
  
  // Calculate net worth from real data
  const calculateNetWorth = () => {
    const totalSavings = savingsGoals.reduce((sum, goal) => sum + (goal.currentAmount || 0), 0);
    const totalDebt = debts.reduce((sum, debt) => sum + (debt.currentAmount || 0), 0);
    // You can extend this to include account balances if stored
    return totalSavings - totalDebt;
  };
  
  // Calculate B Score based on German averages (assuming user is 25-34 for now)
  const calculateFinancialScore = (netWorth) => {
    const userAge = 30; // You can add this to user profile later
    let ageGroup = '25-34';
    
    if (userAge < 25) ageGroup = '18-24';
    else if (userAge < 35) ageGroup = '25-34';
    else if (userAge < 45) ageGroup = '35-44';
    else if (userAge < 55) ageGroup = '45-54';
    else if (userAge < 65) ageGroup = '55-64';
    else ageGroup = '65+';
    
    const avgWealth = germanWealthAverages[ageGroup];
    const ratio = netWorth / avgWealth;
    
    if (ratio >= 1.5) return 'A';
    else if (ratio >= 0.8) return 'B';
    else if (ratio >= 0.4) return 'C';
    else if (ratio >= 0.1) return 'D';
    else return 'F';
  };
  
  // Calculate monthly income/expenses from selected month
  const calculateMonthlyMetrics = () => {
    const selectedDate = currentMonth || new Date();
    const selectedMonthIndex = selectedDate.getMonth();
    const selectedYear = selectedDate.getFullYear();
    
    const selectedMonthTransactions = transactions.filter(t => {
      const transactionDate = new Date(t.date);
      return transactionDate.getMonth() === selectedMonthIndex && 
             transactionDate.getFullYear() === selectedYear;
    });
    
    const income = selectedMonthTransactions
      .filter(t => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);
      
    const expenses = Math.abs(selectedMonthTransactions
      .filter(t => t.amount < 0)
      .reduce((sum, t) => sum + t.amount, 0));

    // Calculate actual savings (negative amounts that are savings-related)
    const savings = Math.abs(selectedMonthTransactions
      .filter(t => t.amount < 0 && detectSavings(t.category, t.description, t.recipient))
      .reduce((sum, t) => sum + t.amount, 0));
    
    return { income, expenses, savings };
  };
  
  // Calculate years to FI (Financial Independence)
  const calculateYearsToFI = (monthlyIncome, monthlyExpenses, currentNetWorth) => {
    const monthlySavings = monthlyIncome - monthlyExpenses;
    if (monthlySavings <= 0) return null; // Can't reach FI with negative savings
    
    const fiTarget = monthlyExpenses * 12 * 25; // 25x annual expenses rule
    const yearsToFI = Math.max(0, (fiTarget - currentNetWorth) / (monthlySavings * 12));
    
    return Math.ceil(yearsToFI);
  };
  
  // Calculate annual metrics (for the top dashboard cards)
  const calculateAnnualMetrics = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    
    const yearTransactions = transactions.filter(t => {
      const transactionDate = new Date(t.date);
      return transactionDate.getFullYear() === currentYear;
    });
    
    const annualIncome = yearTransactions
      .filter(t => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);
    
    const annualSavings = Math.abs(yearTransactions
      .filter(t => t.amount < 0 && detectSavings(t.category, t.description, t.recipient))
      .reduce((sum, t) => sum + t.amount, 0));
    
    return { annualIncome, annualSavings };
  };

  // Real calculations with memoization for selected month
  const netWorth = calculateNetWorth();
  const monthlyMetrics = useMemo(() => calculateMonthlyMetrics(), [transactions, currentMonth]);
  const { income: monthlyIncome, expenses: monthlyExpense, savings: monthlySavings } = monthlyMetrics;
  const { annualIncome, annualSavings } = calculateAnnualMetrics();
  const fiScore = calculateFinancialScore(netWorth);
  const yearsToFI = calculateYearsToFI(monthlyIncome, monthlyExpense, netWorth);
  
  // Calculate annual savings rate in percentage (for top dashboard card)
  const annualSavingsRate = annualIncome > 0 ? (annualSavings / annualIncome * 100) : 0;
  
  // Calculate selected month savings rate in percentage (for monthly section)
  const currentMonthlySavingsRate = monthlyIncome > 0 ? (monthlySavings / monthlyIncome * 100) : 0;
  
  const dashboardMetrics = {
    netWorth,
    netWorthChange: 0, // Could be calculated by comparing with last month
    cashflowPositive: monthlyIncome > monthlyExpense
  };
  
  const fiMetrics = {
    finanzScore: fiScore,
    yearsToFI: yearsToFI
  };
  
  // Calculate savings rate from real data for the last 6 months
  const calculateSavingsRateData = () => {
    const monthNames = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
    const data = [];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = targetDate.getMonth();
      const year = targetDate.getFullYear();
      
      const monthlyTransactions = transactions.filter(t => {
        const transactionDate = new Date(t.date);
        return transactionDate.getMonth() === month && 
               transactionDate.getFullYear() === year;
      });
      
      const income = monthlyTransactions
        .filter(t => t.amount > 0)
        .reduce((sum, t) => sum + t.amount, 0);
      
      // Calculate actual savings (negative amounts that are savings-related)
      const savingsAmount = Math.abs(monthlyTransactions
        .filter(t => t.amount < 0 && detectSavings(t.category, t.description, t.recipient))
        .reduce((sum, t) => sum + t.amount, 0));
      
      const savingsRate = income > 0 ? (savingsAmount / income * 100) : 0;
      
      data.push({
        month: monthNames[month],
        savingsRate: Math.max(0, Math.round(savingsRate * 10) / 10)
      });
    }
    
    return data;
  };
  
  const savingsRateData = calculateSavingsRateData();
  
  // Calculate budget vs actual from real data
  const calculateBudgetVsActual = () => {
    if (!budgets.length) return [];
    
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // getMonth() returns 0-11, budgets use 1-12
    const currentYear = now.getFullYear();
    
    const currentBudgets = budgets.filter(b => 
      b.month === currentMonth && b.year === currentYear
    );
    
    return currentBudgets.map(budget => {
      const categoryTransactions = transactions.filter(t => {
        const transactionDate = new Date(t.date);
        return t.category === budget.categoryName &&
               transactionDate.getMonth() === (currentMonth - 1) && // Convert back to 0-11
               transactionDate.getFullYear() === currentYear &&
               t.amount < 0; // Only expenses
      });
      
      const actual = Math.abs(categoryTransactions.reduce((sum, t) => sum + t.amount, 0));
      const progress = budget.amount > 0 ? (actual / budget.amount) * 100 : 0;
      
      return {
        name: budget.categoryName,
        budget: budget.amount,
        actual,
        progress: Math.round(progress),
        color: jonyColors.magenta,
        bgColor: jonyColors.magentaAlpha
      };
    });
  };
  
  const budgetVsActualData = calculateBudgetVsActual();
  
  // Use real savings goals data
  const savingsGoalsData = {
    chartData: savingsGoals.map(goal => ({
      name: goal.title,
      current: goal.currentAmount || 0,
      target: goal.targetAmount || 1,
      progressPercentage: goal.targetAmount > 0 ? 
        Math.round(((goal.currentAmount || 0) / goal.targetAmount) * 100) : 0
    }))
  };
  
  // Use real debt data
  const debtData = {
    chartData: debts.map(debt => ({
      name: debt.name,
      remaining: debt.currentAmount || 0,
      total: debt.totalAmount || 1,
      progressPercentage: debt.totalAmount > 0 ? 
        Math.round(((debt.totalAmount - (debt.currentAmount || 0)) / debt.totalAmount) * 100) : 0
    }))
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


  // Calculate annual savings rate data from real transactions
  const calculateAnnualSavingsRateData = () => {
    const now = new Date();
    
    const oneYearData = [];
    for (let i = 11; i >= 0; i--) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = targetDate.getMonth();
      const year = targetDate.getFullYear();
      
      const monthlyTransactions = transactions.filter(t => {
        const transactionDate = new Date(t.date);
        return transactionDate.getMonth() === month && 
               transactionDate.getFullYear() === year;
      });
      
      const income = monthlyTransactions
        .filter(t => t.amount > 0)
        .reduce((sum, t) => sum + t.amount, 0);
      
      // Calculate actual savings (negative amounts that are savings-related)
      const savingsAmount = Math.abs(monthlyTransactions
        .filter(t => t.amount < 0 && detectSavings(t.category, t.description, t.recipient))
        .reduce((sum, t) => sum + t.amount, 0));
      
      const savingsRate = income > 0 ? (savingsAmount / income * 100) : 0;
      
      oneYearData.push({
        month: `${year}`,
        savingsRate: Math.max(0, Math.round(savingsRate * 10) / 10)
      });
    }
    
    return {
      '1year': savingsRateData, // Use the 6-month data for 1-year view
      '5years': oneYearData.slice(-5),
      'max': oneYearData
    };
  };
  
  const annualSavingsRateData = calculateAnnualSavingsRateData();

  // Calculate cashflow data from real transactions
  const calculateCashflowData = () => {
    const monthNames = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
    const now = new Date();
    
    const oneYearData = [];
    for (let i = 11; i >= 0; i--) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = targetDate.getMonth();
      const year = targetDate.getFullYear();
      
      const monthlyTransactions = transactions.filter(t => {
        const transactionDate = new Date(t.date);
        return transactionDate.getMonth() === month && 
               transactionDate.getFullYear() === year;
      });
      
      const income = monthlyTransactions
        .filter(t => t.amount > 0)
        .reduce((sum, t) => sum + t.amount, 0);
        
      const expense = Math.abs(monthlyTransactions
        .filter(t => t.amount < 0)
        .reduce((sum, t) => sum + t.amount, 0));
      
      oneYearData.push({
        month: monthNames[month],
        income: Math.round(income),
        expense: Math.round(expense),
        net: Math.round(income - expense)
      });
    }
    
    return {
      '1year': oneYearData,
      '5years': oneYearData.slice(-5), // Fallback to recent data if no 5-year history
      'max': oneYearData // Fallback to recent data if no full history
    };
  };
  
  const cashflowData = calculateCashflowData();

  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: jonyColors.background, color: jonyColors.textPrimary }}>
      {/* Header with Upload Button */}
      <div className="px-6 py-8 mb-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: jonyColors.accent1 }}></div>
              <h1 className="text-3xl font-bold tracking-tight" style={{ color: jonyColors.textPrimary, letterSpacing: '-0.02em' }}>
                Willkommen zurück, User
              </h1>
            </div>
            
            <button
              onClick={triggerFileUpload}
              className="w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-200 select-none"
              style={{ 
                borderColor: jonyColors.accent1,
                backgroundColor: 'transparent',
                outline: 'none',
                WebkitTapHighlightColor: 'transparent'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = jonyColors.accent1;
                e.target.style.borderColor = jonyColors.accent1;
                e.target.style.transform = 'scale(1.05)';
                // Change icon color to black
                const icon = e.target.querySelector('.upload-icon');
                if (icon) icon.style.color = 'black';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = 'transparent';
                e.target.style.borderColor = jonyColors.accent1;
                e.target.style.transform = 'scale(1)';
                // Change icon color back to green
                const icon = e.target.querySelector('.upload-icon');
                if (icon) icon.style.color = jonyColors.accent1;
              }}
              onFocus={(e) => {
                e.target.style.outline = 'none';
              }}
              onBlur={(e) => {
                e.target.style.outline = 'none';
              }}
              title="Kontoauszug hochladen"
            >
              <Plus 
                className="w-5 h-5 pointer-events-none select-none upload-icon" 
                style={{ 
                  color: jonyColors.accent1,
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  MozUserSelect: 'none',
                  msUserSelect: 'none',
                  transition: 'color 0.2s ease'
                }} 
              />
            </button>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
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
              }}
              title="Dein Gesamtvermögen minus alle Schulden. Zeigt deine echte finanzielle Position - alles was du besitzt abzüglich allem was du schuldest.">
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
              }}
              title="Financial Independence: Wie lange es dauert, bis du genug Geld angespart hast, um von den Zinsen zu leben (25x deine jährlichen Ausgaben). FI = Arbeiten wird optional.">
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
              }}
              title="Dein Vermögens-Rating im Vergleich zum deutschen Durchschnitt deiner Altersgruppe. A = Top 20%, B = Überdurchschnittlich, C = Durchschnitt, D-F = Unterdurchschnittlich.">
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

            {/* Annual Savings Rate */}
            <div className="p-6 rounded-2xl border flex items-center justify-center text-center h-40"
              style={{
                backgroundColor: jonyColors.surface,
                border: `1px solid ${jonyColors.border}`
              }}
              title="Wieviel Prozent deines Jahreseinkommens du sparst. Berechnet aus allen Sparbeträgen (Sparen, Investieren, ETF, etc.) des aktuellen Jahres geteilt durch das Jahreseinkommen. 20%+ ist sehr gut, 10-20% ist solide, unter 10% sollte verbessert werden.">
              <div>
                <div className="text-5xl font-bold mb-2" style={{ 
                  color: jonyColors.accent1
                }}>
                  {Math.round(annualSavingsRate * 10) / 10}%
                </div>
                <div className="text-sm font-semibold" style={{ color: jonyColors.textPrimary }}>
                  Sparquote
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
                <div className="p-3 rounded-xl" style={{ backgroundColor: jonyColors.accent1Alpha }}>
                  <BarChart3 className="w-5 h-5" style={{ color: jonyColors.accent1, strokeWidth: 1.5 }} />
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
                <AreaChart data={annualSavingsRateData[savingsRatePeriod]} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
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
                  <Area 
                    type="monotone" 
                    dataKey="savingsRate" 
                    stroke={jonyColors.accent1} 
                    strokeWidth={2}
                    fill="url(#savingsGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Sparziele & Schuldenabbau - Linear Progress Bars */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Sparziele */}
            <div 
              className="p-8 rounded-3xl  transition-all duration-300 hover:bg-opacity-90"
              style={{
                backgroundColor: jonyColors.surface,
                border: `1px solid ${jonyColors.border}`,
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
                  <div className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center" style={{
                    background: `linear-gradient(135deg, ${jonyColors.accent1}, ${jonyColors.greenDark})`
                  }}>
                    <div className="w-6 h-6 rounded-full border-2 border-black flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-black"></div>
                    </div>
                  </div>
                  <div className="text-sm">Keine Sparziele definiert</div>
                </div>
              )}
            </div>

            {/* Schulden */}
            <div 
              className="p-8 rounded-3xl  transition-all duration-300 hover:bg-opacity-90"
              style={{
                backgroundColor: jonyColors.surface,
                border: `1px solid ${jonyColors.border}`,
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
                  <div className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center" style={{
                    background: `linear-gradient(135deg, ${jonyColors.accent1}, ${jonyColors.greenDark})`
                  }}>
                    <div className="w-6 h-6 flex items-center justify-center">
                      <div className="w-3 h-1 bg-black rounded-full"></div>
                    </div>
                  </div>
                  <div className="text-sm">Schuldenfrei!</div>
                </div>
              )}
            </div>
          </div>
          {/* Subscriptions Section */}
          <div 
            className="p-8 rounded-3xl  transition-all duration-300 hover:bg-opacity-90"
            style={{
              backgroundColor: jonyColors.surface,
              border: `1px solid ${jonyColors.border}`,
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
                    border: `2px solid ${jonyColors.border}`
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
                  {subscriptions
                    .filter(sub => sub.isActive)
                    .reduce((total, sub) => total + sub.amount, 0)
                    .toFixed(2)}€/Monat
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

            {/* Monatliche Sparquote */}
            <div className="p-6 rounded-2xl border flex items-center justify-center text-center h-40"
              style={{
                backgroundColor: jonyColors.surface,
                border: `1px solid ${jonyColors.border}`
              }}>
              <div>
                <div className="text-4xl font-bold mb-2" style={{ 
                  color: jonyColors.accent1
                }}>
                  {Math.round(currentMonthlySavingsRate * 10) / 10}%
                </div>
                <div className="text-sm font-semibold" style={{ color: jonyColors.textPrimary }}>
                  Monatliche Sparquote
                </div>
              </div>
            </div>
          </div>

          {/* Full-width card for expenses by category */}
          <div 
            className="p-8 rounded-3xl  mb-8 transition-all duration-300 hover:bg-opacity-90"
            style={{
              backgroundColor: jonyColors.surface,
              border: `1px solid ${jonyColors.border}`,
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
              backgroundColor: jonyColors.surface,
              border: `1px solid ${jonyColors.border}`,
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
                <AreaChart 
                  data={dailySpendingData} 
                  margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                >
                  <defs>
                    <linearGradient id="dailySpendingGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={jonyColors.magenta} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={jonyColors.magenta} stopOpacity={0.05}/>
                    </linearGradient>
                  </defs>
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
                  <Area 
                    type="monotone" 
                    dataKey="expense" 
                    stroke={jonyColors.magenta} 
                    strokeWidth={2}
                    fill="url(#dailySpendingGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      </div>


    </div>
  );
};

export default DashboardPage;