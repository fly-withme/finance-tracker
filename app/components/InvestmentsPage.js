import React, { useState } from 'react';
import { TrendingUp, DollarSign, PieChart, BarChart3, Target, AlertCircle } from 'lucide-react';
import { ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line } from 'recharts';
import { jonyColors } from '../theme';

const InvestmentsPage = () => {
  // Sample investment data
  const portfolioData = [
    { name: 'Aktien', value: 45000, percentage: 45, color: jonyColors.accent1 },
    { name: 'ETFs', value: 30000, percentage: 30, color: jonyColors.accent2 },
    { name: 'Anleihen', value: 15000, percentage: 15, color: jonyColors.magenta },
    { name: 'Kryptowährungen', value: 7000, percentage: 7, color: jonyColors.green },
    { name: 'Cash', value: 3000, percentage: 3, color: jonyColors.textSecondary }
  ];

  const totalPortfolioValue = portfolioData.reduce((sum, item) => sum + item.value, 0);

  const individualInvestments = [
    { 
      name: 'MSCI World ETF',
      symbol: 'A1XB5U',
      currentValue: 15000,
      purchaseValue: 12000,
      change: 3000,
      changePercent: 25,
      type: 'ETF'
    },
    {
      name: 'Apple Inc.',
      symbol: 'AAPL',
      currentValue: 8500,
      purchaseValue: 7000,
      change: 1500,
      changePercent: 21.4,
      type: 'Aktie'
    },
    {
      name: 'Bitcoin',
      symbol: 'BTC',
      currentValue: 5200,
      purchaseValue: 6000,
      change: -800,
      changePercent: -13.3,
      type: 'Krypto'
    },
    {
      name: 'FTSE Developed Europe',
      symbol: 'A1XB5V',
      currentValue: 12000,
      purchaseValue: 10000,
      change: 2000,
      changePercent: 20,
      type: 'ETF'
    }
  ];

  const performanceData = [
    { month: 'Jan', value: 95000 },
    { month: 'Feb', value: 97000 },
    { month: 'Mär', value: 94000 },
    { month: 'Apr', value: 98000 },
    { month: 'Mai', value: 102000 },
    { month: 'Jun', value: 100000 }
  ];

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const formatPercentage = (value) => {
    return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: jonyColors.background, color: jonyColors.textPrimary }}>
      {/* Header */}
      <div className="px-6 py-8 mb-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-1 h-8 rounded-full" style={{ backgroundColor: jonyColors.accent1 }}></div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: jonyColors.textPrimary, letterSpacing: '-0.02em' }}>
              Investments & Assets
            </h1>
          </div>
        </div>
      </div>

      {/* Portfolio Overview */}
      <div className="px-6 mb-12">
        <div className="max-w-7xl mx-auto">
          
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {/* Portfolio Wert */}
            <div className="p-6 rounded-2xl border flex items-center justify-center text-center h-40"
              style={{
                backgroundColor: jonyColors.surface,
                border: `1px solid ${jonyColors.border}`
              }}>
              <div>
                <div className="text-3xl font-bold mb-2" style={{ color: jonyColors.accent1 }}>
                  {formatCurrency(totalPortfolioValue)}
                </div>
                <div className="text-sm font-semibold" style={{ color: jonyColors.textPrimary }}>
                  Portfolio Wert
                </div>
              </div>
            </div>

            {/* Gesamtrendite */}
            <div className="p-6 rounded-2xl border flex items-center justify-center text-center h-40"
              style={{
                backgroundColor: jonyColors.surface,
                border: `1px solid ${jonyColors.border}`
              }}>
              <div>
                <div className="text-3xl font-bold mb-2" style={{ color: jonyColors.accent1 }}>
                  +18.7%
                </div>
                <div className="text-sm font-semibold" style={{ color: jonyColors.textPrimary }}>
                  Gesamtrendite
                </div>
              </div>
            </div>

            {/* Monatsgewinn */}
            <div className="p-6 rounded-2xl border flex items-center justify-center text-center h-40"
              style={{
                backgroundColor: jonyColors.surface,
                border: `1px solid ${jonyColors.border}`
              }}>
              <div>
                <div className="text-3xl font-bold mb-2" style={{ color: jonyColors.accent1 }}>
                  {formatCurrency(2100)}
                </div>
                <div className="text-sm font-semibold" style={{ color: jonyColors.textPrimary }}>
                  Monatsgewinn
                </div>
              </div>
            </div>

            {/* Anzahl Positionen */}
            <div className="p-6 rounded-2xl border flex items-center justify-center text-center h-40"
              style={{
                backgroundColor: jonyColors.surface,
                border: `1px solid ${jonyColors.border}`
              }}>
              <div>
                <div className="text-3xl font-bold mb-2" style={{ color: jonyColors.accent1 }}>
                  {individualInvestments.length}
                </div>
                <div className="text-sm font-semibold" style={{ color: jonyColors.textPrimary }}>
                  Positionen
                </div>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Asset Allocation */}
            <div 
              className="p-6 rounded-2xl border mb-8"
              style={{
                backgroundColor: jonyColors.surface,
                border: `1px solid ${jonyColors.border}`
              }}>
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 rounded-xl" style={{ backgroundColor: jonyColors.accent1Alpha }}>
                  <PieChart className="w-5 h-5" style={{ color: jonyColors.accent1, strokeWidth: 1.5 }} />
                </div>
                <h3 className="text-lg font-light tracking-tight" style={{ color: jonyColors.textPrimary }}>
                  Asset Allocation
                </h3>
              </div>
              
              <div className="h-80 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie 
                      data={portfolioData} 
                      cx="50%" 
                      cy="50%" 
                      innerRadius={60}
                      outerRadius={120} 
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {portfolioData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div style={{
                              backgroundColor: jonyColors.surface,
                              border: `1px solid ${jonyColors.cardBorder}`,
                              borderRadius: '12px',
                              padding: '12px 16px',
                              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6)',
                              color: jonyColors.textPrimary,
                              fontSize: '14px'
                            }}>
                              <p style={{ margin: '0 0 4px 0', fontWeight: '600' }}>{data.name}</p>
                              <p style={{ margin: '0', color: data.color }}>{formatCurrency(data.value)} ({data.percentage}%)</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Performance Chart */}
            <div 
              className="p-6 rounded-2xl border mb-8"
              style={{
                backgroundColor: jonyColors.surface,
                border: `1px solid ${jonyColors.border}`
              }}>
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 rounded-xl" style={{ backgroundColor: jonyColors.accent2Alpha }}>
                  <TrendingUp className="w-5 h-5" style={{ color: jonyColors.accent2, strokeWidth: 1.5 }} />
                </div>
                <h3 className="text-lg font-light tracking-tight" style={{ color: jonyColors.textPrimary }}>
                  Portfolio Performance
                </h3>
              </div>
              
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={performanceData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                    <defs>
                      <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={jonyColors.accent2} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={jonyColors.accent2} stopOpacity={0.05}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="1 1" stroke={jonyColors.textTertiary} opacity={0.2} />
                    <XAxis 
                      dataKey="month" 
                      axisLine={false} 
                      tickLine={false} 
                      fontSize={11}
                      stroke={jonyColors.textTertiary}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      fontSize={11}
                      stroke={jonyColors.textTertiary}
                      tickFormatter={(value) => `${(value/1000)}k€`}
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
                              fontSize: '14px'
                            }}>
                              <p style={{ margin: '0 0 4px 0', fontWeight: '600' }}>{label}</p>
                              <p style={{ margin: '0', color: jonyColors.accent2 }}>
                                Portfolio: {formatCurrency(payload[0].value)}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area type="monotone" dataKey="value" stroke={jonyColors.accent2} strokeWidth={2} fill="url(#portfolioGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Individual Investments */}
          <div 
            className="p-8 rounded-3xl  transition-all duration-300 hover:bg-opacity-90"
            style={{
              backgroundColor: jonyColors.surface,
              border: `1px solid ${jonyColors.border}`,
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
            }}
          >
            <div className="flex items-center gap-4 mb-8">
              <div className="p-3 rounded-xl" style={{ backgroundColor: jonyColors.magentaAlpha }}>
                <BarChart3 className="w-5 h-5" style={{ color: jonyColors.magenta, strokeWidth: 1.5 }} />
              </div>
              <h3 className="text-lg font-light tracking-tight" style={{ color: jonyColors.textPrimary }}>
                Einzelne Investments
              </h3>
            </div>
            
            <div className="space-y-6">
              {individualInvestments.map((investment, index) => {
                const isPositive = investment.change > 0;
                const changeColor = isPositive ? jonyColors.accent1 : jonyColors.magenta;
                
                return (
                  <div key={index} className="p-6 rounded-2xl border" style={{
                    backgroundColor: jonyColors.cardBackground,
                    border: `1px solid ${jonyColors.cardBorder}`
                  }}>
                    <div className="flex justify-between items-center">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-lg font-semibold" style={{ color: jonyColors.textPrimary }}>
                            {investment.name}
                          </span>
                          <span className="px-2 py-1 rounded-md text-xs font-medium" style={{
                            backgroundColor: jonyColors.accent1Alpha,
                            color: jonyColors.accent1
                          }}>
                            {investment.type}
                          </span>
                        </div>
                        <span className="text-sm" style={{ color: jonyColors.textSecondary }}>
                          {investment.symbol}
                        </span>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-xl font-bold mb-1" style={{ color: jonyColors.textPrimary }}>
                          {formatCurrency(investment.currentValue)}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium" style={{ color: changeColor }}>
                            {isPositive ? '+' : ''}{formatCurrency(investment.change)}
                          </span>
                          <span className="text-sm font-medium" style={{ color: changeColor }}>
                            ({formatPercentage(investment.changePercent)})
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvestmentsPage;