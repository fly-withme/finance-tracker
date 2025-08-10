import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { UploadCloud, ArrowUp, ArrowDown, Wallet } from 'lucide-react';
import Card from './ui/Card';
import PageHeader from './ui/PageHeader';
import CustomTooltip from './ui/CustomTooltip';

const DashboardPage = ({ transactions, categories, currency, accounts, setTransactionsToReview, newTransactionsToReview }) => {
  const { totalBalance, monthlyIncome, monthlyExpense } = useMemo(() => {
    const now = new Date('2025-08-10');
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    let income = 0;
    let expense = 0;
    
    transactions.forEach(t => {
      const tDate = new Date(t.date);
      if (tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear) {
        if (t.amount > 0) income += t.amount;
        else expense += Math.abs(t.amount);
      }
    });
    
    const balance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
    return { totalBalance: balance, monthlyIncome: income, monthlyExpense: expense };
  }, [transactions, accounts]);

  const monthlySpendingData = useMemo(() => {
    const now = new Date('2025-08-10');
    return transactions
      .filter(t => 
        new Date(t.date).getFullYear() === now.getFullYear() && 
        new Date(t.date).getMonth() === now.getMonth() && 
        t.amount < 0 && 
        t.category !== 'Investing'
      )
      .reduce((acc, t) => { 
        const existing = acc.find(item => item.name === t.category); 
        if (existing) existing.value += Math.abs(t.amount); 
        else acc.push({ name: t.category, value: Math.abs(t.amount) }); 
        return acc; 
      }, [])
      .sort((a, b) => b.value - a.value);
  }, [transactions]);

  const annualData = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => { 
      const d = new Date(2025, 8, 1); 
      d.setMonth(d.getMonth() - i); 
      return { name: d.toLocaleString('en-US', { month: 'short' }), income: 0, expense: 0 }; 
    }).reverse();
    
    const monthMap = new Map(months.map((m, i) => [m.name, i]));
    
    transactions.forEach(t => { 
      const month = new Date(t.date).toLocaleString('en-US', { month: 'short' }); 
      const index = monthMap.get(month); 
      if (index !== undefined) { 
        if (t.amount > 0) months[index].income += t.amount; 
        else months[index].expense += Math.abs(t.amount); 
      } 
    });
    
    return months;
  }, [transactions]);

  const getCategoryColor = (categoryName) => categories.find(c => c.name === categoryName)?.color || '#71717A';

  const BalanceCard = ({ balance, currency }) => (
    <Card className="lg:col-span-1 p-6">
      <div className="flex justify-between items-start">
        <h3 className="text-lg font-medium text-gray-400">Total Balance</h3>
        <Wallet className="w-5 h-5 text-gray-500" />
      </div>
      <p className="text-4xl font-bold text-white mt-4">
        {balance.toLocaleString('en-US', { style: 'currency', currency: 'EUR' })}
      </p>
    </Card>
  );

  const IncomeExpenseCard = ({ income, expense, currency }) => (
    <Card className="lg:col-span-2 p-6 grid grid-cols-2 gap-6">
      <div>
        <div className="flex justify-between items-start">
          <h3 className="text-lg font-medium text-gray-400">Monthly Income</h3>
          <ArrowUp className="w-5 h-5 text-green-500" />
        </div>
        <p className="text-3xl font-bold text-green-400 mt-4">
          {income.toLocaleString('en-US', { style: 'currency', currency: 'EUR' })}
        </p>
      </div>
      <div>
        <div className="flex justify-between items-start">
          <h3 className="text-lg font-medium text-gray-400">Monthly Expense</h3>
          <ArrowDown className="w-5 h-5 text-red-500" />
        </div>
        <p className="text-3xl font-bold text-red-400 mt-4">
          {expense.toLocaleString('en-US', { style: 'currency', currency: 'EUR' })}
        </p>
      </div>
    </Card>
  );

  return (
    <div>
      <PageHeader title="Dashboard">
        <button 
          onClick={() => setTransactionsToReview(newTransactionsToReview)} 
          className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-600/20"
        >
          <UploadCloud className="w-5 h-5" />
          <span>Upload Statement</span>
        </button>
      </PageHeader>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <BalanceCard balance={totalBalance} currency={currency} />
        <IncomeExpenseCard income={monthlyIncome} expense={monthlyExpense} currency={currency} />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <Card className="lg:col-span-2 p-6">
          <h3 className="text-lg font-bold text-white mb-4">Income vs. Expense Annual Overview</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={annualData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  dataKey="name" 
                  stroke="#9ca3af" 
                  tick={{ fill: '#9ca3af', fontSize: 12 }} 
                />
                <YAxis 
                  stroke="#9ca3af" 
                  tick={{ fill: '#9ca3af', fontSize: 12 }} 
                  tickFormatter={(val) => `${currency}${(val/1000)}k`} 
                />
                <Tooltip 
                  content={<CustomTooltip currency={currency}/>} 
                  cursor={{ fill: 'rgba(107, 114, 128, 0.1)' }} 
                />
                <Legend />
                <Bar dataKey="income" fill="#22C55E" name="Income" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" fill="#EF4444" name="Expense" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        
        <Card className="p-6">
          <h3 className="text-lg font-bold text-white mb-4">Monthly Spending</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={monthlySpendingData} 
                layout="vertical" 
                margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  type="number" 
                  stroke="#9ca3af" 
                  tick={{ fill: '#9ca3af', fontSize: 12 }} 
                  tickFormatter={(value) => `${currency}${value}`} 
                />
                <YAxis 
                  type="category" 
                  dataKey="name" 
                  stroke="#9ca3af" 
                  width={100} 
                  tick={{ fill: '#d1d5db', fontSize: 12 }} 
                />
                <Tooltip 
                  cursor={{fill: 'rgba(107, 114, 128, 0.1)'}} 
                  content={<CustomTooltip currency={currency}/>} 
                />
                <Bar dataKey="value" barSize={24} radius={[0, 8, 8, 0]}>
                  {monthlySpendingData.map((entry) => (
                    <Cell key={`cell-${entry.name}`} fill={getCategoryColor(entry.name)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
      
      <Card className="p-6">
        <h3 className="text-lg font-bold text-white mb-4">Recent Transactions</h3>
        <div className="space-y-2">
          {transactions.slice(0, 5).map(tx => (
            <div key={tx.id} className="flex items-center justify-between p-2 hover:bg-gray-800/50 rounded-lg">
              <div className="flex items-center space-x-4">
                <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center ${tx.amount > 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                  {tx.amount > 0 ? <ArrowUp className="w-5 h-5 text-green-400" /> : <ArrowDown className="w-5 h-5 text-red-400" />}
                </div>
                <div>
                  <p className="font-medium text-white">{tx.description}</p>
                  <p className="text-sm text-gray-400">{new Date(tx.date).toLocaleDateString('en-US')}</p>
                </div>
              </div>
              <p className={`font-semibold ${tx.amount > 0 ? 'text-green-400' : 'text-white'}`}>
                {tx.amount > 0 ? '+' : ''}{Math.abs(tx.amount).toLocaleString('en-US', { style: 'currency', currency: 'EUR' })}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default DashboardPage;