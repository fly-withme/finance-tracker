import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  TrendingUp, 
  DollarSign, 
  PieChart, 
  BarChart3, 
  Target, 
  AlertCircle, 
  Plus,
  Edit,
  Trash2,
  TrendingDown,
  Globe
} from 'lucide-react';
import { ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line } from 'recharts';
import WorldMap from 'react-svg-worldmap';
import { jonyColors } from '../theme';
import { db } from '../utils/db';

const InvestmentsPage = () => {
  // State for modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState(null);
  const [performancePeriod, setPerformancePeriod] = useState('1year');
  const [investmentFilter, setInvestmentFilter] = useState('all');
  const [performanceFilter, setPerformanceFilter] = useState('all'); // 'all', 'positive', 'negative'
  const [sortBy, setSortBy] = useState('name'); // 'name', 'value', 'performance', 'date'
  
  // Form state for new investment
  const [newInvestment, setNewInvestment] = useState({
    name: '',
    symbol: '',
    type: 'etf',
    totalInvestment: '',
    region: 'Global',
    // Hidden fields with smart defaults
    purchasePrice: '',
    quantity: '1',
    purchaseDate: new Date().toISOString().split('T')[0],
    currentPrice: '',
    currency: 'EUR',
    broker: '',
    notes: ''
  });

  // Live data from database
  const investments = useLiveQuery(() => db.investments.toArray(), []) || [];
  const portfolioHistory = useLiveQuery(() => db.portfolioHistory.orderBy('date').toArray(), []) || [];

  // Utility functions
  const formatCurrency = (amount, currency = 'EUR') => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(amount);
  };

  const formatPercentage = (value) => {
    return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  // Helper functions
  const getTypeDisplayName = (type) => {
    const typeMap = {
      stock: 'Aktien',
      etf: 'ETFs',
      bond: 'Anleihen',
      crypto: 'Kryptowährungen',
      reit: 'REITs',
      commodity: 'Rohstoffe',
      other: 'Sonstige'
    };
    return typeMap[type] || type;
  };

  const getTypeColor = (type, index) => {
    const colorMap = {
      stock: jonyColors.accent1,
      etf: jonyColors.accent2,
      bond: jonyColors.magenta,
      crypto: jonyColors.orange,
      reit: jonyColors.greenDark,
      commodity: jonyColors.magentaLight,
      other: jonyColors.textSecondary
    };
    return colorMap[type] || [jonyColors.accent1, jonyColors.accent2, jonyColors.magenta, jonyColors.orange][index % 4];
  };

  // Calculate individual investment performance
  const getInvestmentPerformance = (investment) => {
    const purchaseValue = (parseFloat(investment.purchasePrice) || 0) * (parseFloat(investment.quantity) || 0);
    const currentValue = (parseFloat(investment.currentPrice) || 0) * (parseFloat(investment.quantity) || 0);
    const change = currentValue - purchaseValue;
    const changePercent = purchaseValue > 0 ? (change / purchaseValue) * 100 : 0;
    
    return { purchaseValue, currentValue, change, changePercent };
  };

  // Calculate investment metrics
  const investmentMetrics = useMemo(() => {
    if (investments.length === 0) {
      return {
        totalValue: 0,
        totalInvested: 0,
        totalGainLoss: 0,
        totalGainLossPercent: 0,
        positionsCount: 0,
        dailyChange: 0
      };
    }

    const totalInvested = investments.reduce((sum, inv) => {
      return sum + (parseFloat(inv.purchasePrice) || 0) * (parseFloat(inv.quantity) || 0);
    }, 0);

    const totalValue = investments.reduce((sum, inv) => {
      return sum + (parseFloat(inv.currentPrice) || 0) * (parseFloat(inv.quantity) || 0);
    }, 0);

    const totalGainLoss = totalValue - totalInvested;
    const totalGainLossPercent = totalInvested > 0 ? (totalGainLoss / totalInvested) * 100 : 0;

    return {
      totalValue,
      totalInvested,
      totalGainLoss,
      totalGainLossPercent,
      positionsCount: investments.length,
      dailyChange: 0 // TODO: Calculate from historical data
    };
  }, [investments]);

  // Filter and sort investments
  const filteredInvestments = useMemo(() => {
    let filtered = investments;

    // Filter by asset type
    if (investmentFilter !== 'all') {
      filtered = filtered.filter(inv => inv.type === investmentFilter);
    }

    // Filter by performance
    if (performanceFilter !== 'all') {
      filtered = filtered.filter(inv => {
        const performance = getInvestmentPerformance(inv);
        if (performanceFilter === 'positive') return performance.change >= 0;
        if (performanceFilter === 'negative') return performance.change < 0;
        return true;
      });
    }

    // Sort investments
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'value':
          const aValue = (parseFloat(a.currentPrice) || 0) * (parseFloat(a.quantity) || 0);
          const bValue = (parseFloat(b.currentPrice) || 0) * (parseFloat(b.quantity) || 0);
          return bValue - aValue; // Descending
        case 'performance':
          const aPerf = getInvestmentPerformance(a).changePercent;
          const bPerf = getInvestmentPerformance(b).changePercent;
          return bPerf - aPerf; // Descending
        case 'date':
          const aDate = new Date(a.purchaseDate || 0);
          const bDate = new Date(b.purchaseDate || 0);
          return bDate - aDate; // Newest first
        case 'name':
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return filtered;
  }, [investments, investmentFilter, performanceFilter, sortBy]);

  // Get unique investment types for filter options
  const availableTypes = useMemo(() => {
    const types = [...new Set(investments.map(inv => inv.type || 'other'))];
    return types.sort();
  }, [investments]);

  // Calculate portfolio allocation
  const portfolioAllocation = useMemo(() => {
    if (investments.length === 0) return [];

    const typeGroups = investments.reduce((acc, inv) => {
      const type = inv.type || 'other';
      const value = (parseFloat(inv.currentPrice) || 0) * (parseFloat(inv.quantity) || 0);
      
      if (!acc[type]) {
        acc[type] = { name: type, value: 0 };
      }
      acc[type].value += value;
      return acc;
    }, {});

    const total = Object.values(typeGroups).reduce((sum, group) => sum + group.value, 0);
    
    return Object.values(typeGroups).map((group, index) => ({
      ...group,
      name: getTypeDisplayName(group.name),
      percentage: total > 0 ? ((group.value / total) * 100).toFixed(1) : 0,
      color: getTypeColor(group.name, index)
    }));
  }, [investments]);

  // Generate performance data based on selected period
  const performanceData = useMemo(() => {
    const now = new Date();
    const data = [];
    
    // Generate sample data based on period
    // In real app, this would come from portfolioHistory table
    switch (performancePeriod) {
      case '3months':
        for (let i = 90; i >= 0; i -= 3) {
          const date = new Date(now);
          date.setDate(date.getDate() - i);
          data.push({
            date: date.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' }),
            value: investmentMetrics.totalValue * (0.95 + Math.random() * 0.1)
          });
        }
        break;
      case '1year':
        for (let i = 12; i >= 0; i--) {
          const date = new Date(now);
          date.setMonth(date.getMonth() - i);
          data.push({
            date: date.toLocaleDateString('de-DE', { month: 'short' }),
            value: investmentMetrics.totalValue * (0.9 + Math.random() * 0.2)
          });
        }
        break;
      case '5years':
        for (let i = 5; i >= 0; i--) {
          const date = new Date(now);
          date.setFullYear(date.getFullYear() - i);
          data.push({
            date: date.getFullYear().toString(),
            value: investmentMetrics.totalValue * (0.7 + Math.random() * 0.5)
          });
        }
        break;
      case 'max':
        // Use actual portfolio history if available, otherwise generate sample
        if (portfolioHistory.length > 0) {
          return portfolioHistory.map(entry => ({
            date: new Date(entry.date).toLocaleDateString('de-DE', { month: 'short', year: 'numeric' }),
            value: entry.totalValue
          }));
        }
        // Fallback to sample data
        for (let i = 10; i >= 0; i--) {
          const date = new Date(now);
          date.setFullYear(date.getFullYear() - i);
          data.push({
            date: date.getFullYear().toString(),
            value: investmentMetrics.totalValue * (0.5 + Math.random() * 0.7)
          });
        }
        break;
      default:
        return [];
    }
    
    return data;
  }, [performancePeriod, investmentMetrics.totalValue, portfolioHistory]);

  // Generate asset performance data for different asset types
  const assetPerformanceData = useMemo(() => {
    if (portfolioAllocation.length === 0) return [];
    
    const now = new Date();
    let dataPoints = [];
    
    // Generate time points based on selected period
    switch (performancePeriod) {
      case '3months':
        for (let i = 90; i >= 0; i -= 7) {
          const date = new Date(now);
          date.setDate(date.getDate() - i);
          dataPoints.push({
            date: date.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })
          });
        }
        break;
      case '1year':
        for (let i = 12; i >= 0; i--) {
          const date = new Date(now);
          date.setMonth(date.getMonth() - i);
          dataPoints.push({
            date: date.toLocaleDateString('de-DE', { month: 'short' })
          });
        }
        break;
      case '5years':
        for (let i = 5; i >= 0; i--) {
          const date = new Date(now);
          date.setFullYear(date.getFullYear() - i);
          dataPoints.push({
            date: date.getFullYear().toString()
          });
        }
        break;
      case 'max':
        for (let i = 10; i >= 0; i--) {
          const date = new Date(now);
          date.setFullYear(date.getFullYear() - i);
          dataPoints.push({
            date: date.getFullYear().toString()
          });
        }
        break;
      default:
        return [];
    }

    // Add performance data for each asset type
    dataPoints = dataPoints.map(point => {
      const newPoint = { ...point };
      portfolioAllocation.forEach(asset => {
        // Generate realistic-looking performance data
        const baseValue = asset.value;
        const volatility = asset.name === 'Kryptowährungen' ? 0.3 : 
                          asset.name === 'Aktien' ? 0.15 : 
                          asset.name === 'ETFs' ? 0.12 : 0.08;
        const trend = asset.name === 'Kryptowährungen' ? 1.5 : 
                     asset.name === 'Aktien' ? 1.1 : 
                     asset.name === 'ETFs' ? 1.08 : 1.03;
        
        newPoint[asset.name] = baseValue * (trend + (Math.random() - 0.5) * volatility);
      });
      return newPoint;
    });

    return dataPoints;
  }, [portfolioAllocation, performancePeriod]);

  // Calculate geographic distribution mapped to 6 risk categories
  const geographicDistribution = useMemo(() => {
    if (investments.length === 0) return [];
    
    const regionGroups = investments.reduce((acc, inv) => {
      const region = inv.region || 'Unbekannt';
      const value = (parseFloat(inv.currentPrice) || 0) * (parseFloat(inv.quantity) || 0);
      
      if (!acc[region]) {
        acc[region] = { name: region, value: 0, count: 0 };
      }
      acc[region].value += value;
      acc[region].count += 1;
      return acc;
    }, {});
    
    const total = Object.values(regionGroups).reduce((sum, group) => sum + group.value, 0);
    
    const regionColors = {
      'Deutschland': jonyColors.accent1,
      'USA': jonyColors.accent2,
      'Europa': jonyColors.chartSecondary,
      'Asien': jonyColors.chartTertiary,
      'Emerging Markets': jonyColors.chartQuaternary,
      'Global': jonyColors.magenta,
      'Unbekannt': jonyColors.textTertiary
    };
    
    return Object.values(regionGroups)
      .map((group, index) => ({
        ...group,
        percentage: total > 0 ? ((group.value / total) * 100).toFixed(1) : 0,
        color: regionColors[group.name] || jonyColors.textSecondary
      }))
      .sort((a, b) => b.value - a.value);
  }, [investments]);

  // Map to 6 geographic risk categories
  const riskCategories = useMemo(() => {
    if (geographicDistribution.length === 0) return [];
    
    const categoryMapping = {
      'Nordamerika': ['USA', 'Global'], // USA, Kanada, Mexiko + Global exposure
      'Europa': ['Deutschland', 'Europa', 'Global'], // EU, Schweiz, UK + Global exposure
      'Asien': ['Asien', 'Global'], // China, Japan, Korea, Indien, Taiwan etc. + Global exposure
      'Australien & Ozeanien': ['Global'], // Australien, Neuseeland, Pazifik via Global
      'Lateinamerika': ['Emerging Markets', 'Global'], // Brasilien, Mexiko, Argentinien, Chile + Global exposure
      'Afrika & Naher Osten': ['Global'] // Südafrika, Saudi-Arabien, Ägypten etc. via Global
    };
    
    const categoryColors = {
      'Nordamerika': jonyColors.accent2,
      'Europa': jonyColors.accent1,
      'Asien': jonyColors.chartTertiary,
      'Australien & Ozeanien': jonyColors.chartSecondary,
      'Lateinamerika': jonyColors.chartQuaternary,
      'Afrika & Naher Osten': jonyColors.magenta
    };
    
    // First, get Global investment data for distribution
    const globalData = geographicDistribution.find(r => r.name === 'Global');
    const globalValue = globalData ? globalData.value : 0;
    const globalCount = globalData ? globalData.count : 0;
    const totalInvestments = geographicDistribution.reduce((sum, region) => sum + region.value, 0);
    
    const categories = Object.keys(categoryMapping).map(categoryName => {
      const mappedRegions = categoryMapping[categoryName];
      
      // Get direct regional investments (excluding Global)
      const directData = geographicDistribution.filter(region => 
        mappedRegions.includes(region.name) && region.name !== 'Global'
      );
      
      let totalValue = directData.reduce((sum, region) => sum + region.value, 0);
      let totalCount = directData.reduce((sum, region) => sum + region.count, 0);
      
      // Distribute Global investments proportionally if this category includes Global
      if (mappedRegions.includes('Global') && globalValue > 0) {
        // Each category that includes Global gets a portion
        const globalPortionFactor = 1/6; // Distribute Global equally across all 6 categories
        totalValue += globalValue * globalPortionFactor;
        totalCount += Math.ceil(globalCount * globalPortionFactor);
      }
      
      return {
        name: categoryName,
        value: totalValue,
        count: totalCount,
        percentage: totalInvestments > 0 ? ((totalValue / totalInvestments) * 100).toFixed(1) : 0,
        color: categoryColors[categoryName]
      };
    });
    
    // Always show all 6 categories, even with 0%
    return categories.sort((a, b) => b.value - a.value);
  }, [geographicDistribution]);

  // Map region data to country codes for react-svg-worldmap with risk-based coloring
  const worldMapData = useMemo(() => {
    if (riskCategories.length === 0) return [];
    
    // Map each risk category to specific countries
    const categoryToCountries = {
      'Nordamerika': ['us', 'ca', 'mx'],
      'Europa': [
        'de', 'fr', 'it', 'es', 'nl', 'be', 'at', 'ch', 'se', 'no', 'dk', 'fi', 
        'pl', 'cz', 'hu', 'pt', 'gr', 'ie', 'bg', 'ro', 'hr', 'sk', 'si', 'lt', 
        'lv', 'ee', 'lu', 'mt', 'cy', 'gb'
      ],
      'Asien': [
        'cn', 'jp', 'kr', 'in', 'sg', 'hk', 'tw', 'th', 'my', 'id', 'ph', 'vn', 
        'bd', 'pk', 'lk', 'mm', 'kh', 'la', 'bn', 'mn'
      ],
      'Australien & Ozeanien': ['au', 'nz', 'fj', 'pg', 'sb', 'vu', 'ws', 'to', 'tv', 'nr', 'ki', 'mh', 'fm', 'pw'],
      'Lateinamerika': [
        'br', 'ar', 'cl', 'co', 've', 'pe', 'uy', 'py', 'ec', 'bo', 'sr', 'gy', 
        'gt', 'bz', 'sv', 'hn', 'ni', 'cr', 'pa', 'cu', 'jm', 'ht', 'do', 'tt', 'bb'
      ],
      'Afrika & Naher Osten': [
        'za', 'ng', 'eg', 'ma', 'ke', 'gh', 'tn', 'dz', 'ao', 'mz', 'mg', 'cm', 'ne', 'bf', 'ml', 'mw', 'zm', 'sn', 'so', 'td', 'sz', 'rw', 'gn', 'bi', 'tj', 'er', 'lr', 'sl', 'tg', 'cf', 'ls', 'dj', 'gw', 'gq', 'mu', 'sc',
        'sa', 'ae', 'il', 'tr', 'ir', 'iq', 'sy', 'jo', 'lb', 'ye', 'om', 'kw', 'qa', 'bh'
      ]
    };

    // Calculate total investment value for reference
    const totalValue = riskCategories.reduce((sum, cat) => sum + cat.value, 0);
    
    const data = [];
    
    // For each category, determine risk level and assign countries
    riskCategories.forEach(category => {
      const percentage = parseFloat(category.percentage);
      const countries = categoryToCountries[category.name] || [];
      
      if (countries.length > 0) {
        // Financial best practices for geographic concentration risk:
        // - Ideal diversification: No single region >25% of portfolio
        // - Moderate risk: 25-40% in one region  
        // - High risk: 40-60% in one region
        // - Extreme risk: >60% in one region
        
        let riskLevel;
        if (percentage === 0) {
          riskLevel = 'none'; // No investment
        } else if (percentage <= 25) {
          riskLevel = 'optimal'; // Green - well diversified
        } else if (percentage <= 40) {
          riskLevel = 'moderate'; // Blue - moderate concentration
        } else {
          riskLevel = 'high'; // Pink/Magenta - high concentration risk
        }
        
        countries.forEach(countryCode => {
          data.push({
            country: countryCode,
            value: category.value / countries.length, // Distribute value across countries in region
            percentage: percentage,
            riskLevel: riskLevel,
            categoryName: category.name
          });
        });
      }
    });

    return data;
  }, [riskCategories]);

  // CRUD operations
  const handleCreateInvestment = async () => {
    try {
      await db.investments.add({
        name: newInvestment.name,
        symbol: newInvestment.symbol,
        type: newInvestment.type,
        purchasePrice: parseFloat(newInvestment.purchasePrice) || 0,
        quantity: parseFloat(newInvestment.quantity) || 0,
        purchaseDate: newInvestment.purchaseDate,
        currentPrice: parseFloat(newInvestment.currentPrice) || parseFloat(newInvestment.purchasePrice) || 0,
        currency: newInvestment.currency,
        broker: newInvestment.broker,
        notes: newInvestment.notes,
        region: newInvestment.region,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      setNewInvestment({
        name: '',
        symbol: '',
        type: 'etf',
        totalInvestment: '',
        region: 'Global',
        // Hidden fields with smart defaults
        purchasePrice: '',
        quantity: '1',
        purchaseDate: new Date().toISOString().split('T')[0],
        currentPrice: '',
        currency: 'EUR',
        broker: '',
        notes: ''
      });
      setShowCreateModal(false);
    } catch (error) {
      console.error('Error creating investment:', error);
    }
  };

  const handleEditInvestment = async (investment) => {
    try {
      await db.investments.update(investment.id, {
        currentPrice: parseFloat(investment.currentPrice) || 0,
        notes: investment.notes,
        region: investment.region,
        updatedAt: Date.now()
      });
      setEditingInvestment(null);
    } catch (error) {
      console.error('Error updating investment:', error);
    }
  };

  const handleDeleteInvestment = async (investmentId) => {
    try {
      await db.investments.delete(investmentId);
    } catch (error) {
      console.error('Error deleting investment:', error);
    }
  };

  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: jonyColors.background, color: jonyColors.textPrimary }}>
      {/* Header */}
      <div className="px-6 py-8 mb-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: jonyColors.accent1 }}></div>
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
            {/* Portfolio Wert */}
            <div className="p-6 rounded-2xl border flex items-center justify-center text-center h-40"
              style={{
                backgroundColor: jonyColors.surface,
                border: `1px solid ${jonyColors.border}`
              }}>
              <div>
                <div className="text-4xl font-bold mb-2" style={{ color: jonyColors.accent1 }}>
                  {formatCurrency(investmentMetrics.totalValue)}
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
                <div className="text-4xl font-bold mb-2" style={{ 
                  color: investmentMetrics.totalGainLoss >= 0 ? jonyColors.accent1 : jonyColors.magenta 
                }}>
                  {formatPercentage(investmentMetrics.totalGainLossPercent)}
                </div>
                <div className="text-sm font-semibold" style={{ color: jonyColors.textPrimary }}>
                  Gesamtrendite
                </div>
              </div>
            </div>

            {/* Gewinn/Verlust */}
            <div className="p-6 rounded-2xl border flex items-center justify-center text-center h-40"
              style={{
                backgroundColor: jonyColors.surface,
                border: `1px solid ${jonyColors.border}`
              }}>
              <div>
                <div className="text-4xl font-bold mb-2" style={{ 
                  color: investmentMetrics.totalGainLoss >= 0 ? jonyColors.accent1 : jonyColors.magenta 
                }}>
                  {formatCurrency(investmentMetrics.totalGainLoss)}
                </div>
                <div className="text-sm font-semibold" style={{ color: jonyColors.textPrimary }}>
                  Gewinn/Verlust
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
                <div className="text-4xl font-bold mb-2" style={{ color: jonyColors.accent1 }}>
                  {investmentMetrics.positionsCount}
                </div>
                <div className="text-sm font-semibold" style={{ color: jonyColors.textPrimary }}>
                  Positionen
                </div>
              </div>
            </div>
          </div>

          {/* Portfolio Performance Chart */}
          <div 
            className="p-6 rounded-2xl border mb-8"
            style={{
              backgroundColor: jonyColors.surface,
              border: `1px solid ${jonyColors.border}`
            }}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl" style={{ backgroundColor: jonyColors.accent2Alpha }}>
                  <TrendingUp className="w-5 h-5" style={{ color: jonyColors.accent2, strokeWidth: 1.5 }} />
                </div>
                <h3 className="text-lg font-light tracking-tight" style={{ color: jonyColors.textPrimary }}>
                  Portfolio Performance
                </h3>
              </div>
              
              <div className="flex gap-2">
                {['3months', '1year', '5years', 'max'].map((period) => (
                  <button
                    key={period}
                    onClick={() => setPerformancePeriod(period)}
                    className={`px-3 py-1 rounded-lg text-sm transition-all duration-200 ${
                      performancePeriod === period ? 'font-semibold' : 'hover:bg-opacity-80'
                    }`}
                    style={{
                      backgroundColor: performancePeriod === period ? jonyColors.accent2 : jonyColors.cardBackground,
                      color: performancePeriod === period ? 'black' : jonyColors.textPrimary,
                      border: `1px solid ${performancePeriod === period ? jonyColors.accent2 : jonyColors.border}`
                    }}
                  >
                    {period === '3months' ? '3M' : period === '1year' ? '1J' : period === '5years' ? '5J' : 'Max'}
                  </button>
                ))}
              </div>
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
                    dataKey="date" 
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
                    tickFormatter={(value) => formatCurrency(value)}
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
                            <p style={{ margin: '0', color: jonyColors.accent2 }}>
                              Portfolio: {formatCurrency(payload[0].value)}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                    cursor={{ fill: jonyColors.accent2Alpha, opacity: 0.1 }}
                  />
                  <Area type="monotone" dataKey="value" stroke={jonyColors.accent2} strokeWidth={2} fill="url(#portfolioGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Asset Performance Chart */}
          {portfolioAllocation.length > 0 && (
            <div 
              className="p-6 rounded-2xl border mb-8"
              style={{
                backgroundColor: jonyColors.surface,
                border: `1px solid ${jonyColors.border}`
              }}>
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 rounded-xl" style={{ backgroundColor: jonyColors.accent2Alpha }}>
                  <BarChart3 className="w-5 h-5" style={{ color: jonyColors.accent2, strokeWidth: 1.5 }} />
                </div>
                <h3 className="text-lg font-light tracking-tight" style={{ color: jonyColors.textPrimary }}>
                  Asset Performance
                </h3>
              </div>
              
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={assetPerformanceData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                    <defs>
                      {portfolioAllocation.map((asset, index) => (
                        <linearGradient key={`assetGradient-${index}`} id={`assetGradient-${index}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={asset.color} stopOpacity={0.3}/>
                          <stop offset="95%" stopColor={asset.color} stopOpacity={0.05}/>
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="1 1" stroke={jonyColors.textTertiary} opacity={0.2} />
                    <XAxis 
                      dataKey="date" 
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
                      tickFormatter={(value) => formatCurrency(value)}
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
                                <p key={index} style={{ margin: '2px 0', color: entry.color }}>
                                  {entry.dataKey}: {formatCurrency(entry.value)}
                                </p>
                              ))}
                            </div>
                          );
                        }
                        return null;
                      }}
                      cursor={{ fill: jonyColors.accent2Alpha, opacity: 0.1 }}
                    />
                    {portfolioAllocation.map((asset, index) => (
                      <Area 
                        key={asset.name}
                        type="monotone" 
                        dataKey={asset.name} 
                        stroke={asset.color} 
                        strokeWidth={2}
                        fill={`url(#assetGradient-${index})`}
                        fillOpacity={1}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Asset Allocation */}
            <div 
              className="p-6 rounded-2xl border"
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
              
              {portfolioAllocation.length > 0 ? (
                <div className="h-80 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie 
                        data={portfolioAllocation} 
                        cx="50%" 
                        cy="50%" 
                        innerRadius={60}
                        outerRadius={120} 
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {portfolioAllocation.map((entry, index) => (
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
                                <p style={{ margin: '0', color: data.color }}>
                                  {formatCurrency(data.value)} ({data.percentage}%)
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-sm" style={{ color: jonyColors.textSecondary }}>
                    Keine Investments vorhanden
                  </div>
                </div>
              )}
            </div>

            {/* Investment Summary Card */}
            <div 
              className="p-6 rounded-2xl border"
              style={{
                backgroundColor: jonyColors.surface,
                border: `1px solid ${jonyColors.border}`
              }}>
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 rounded-xl" style={{ backgroundColor: jonyColors.accent1Alpha }}>
                  <Target className="w-5 h-5" style={{ color: jonyColors.accent1, strokeWidth: 1.5 }} />
                </div>
                <h3 className="text-lg font-light tracking-tight" style={{ color: jonyColors.textPrimary }}>
                  Investment Übersicht
                </h3>
              </div>

              <div className="space-y-6">
                <div>
                  <div className="text-sm mb-1" style={{ color: jonyColors.textSecondary }}>Beste Position</div>
                  <div className="text-lg font-semibold" style={{ color: jonyColors.accent1 }}>
                    {investments.length > 0 
                      ? investments.reduce((best, inv) => {
                          const perf = getInvestmentPerformance(inv);
                          const bestPerf = getInvestmentPerformance(best);
                          return perf.changePercent > bestPerf.changePercent ? inv : best;
                        }).name
                      : 'Keine Daten'
                    }
                  </div>
                  {investments.length > 0 && (
                    <div className="text-sm mt-1" style={{ color: jonyColors.accent1 }}>
                      {formatPercentage(investments.reduce((best, inv) => {
                        const perf = getInvestmentPerformance(inv);
                        const bestPerf = getInvestmentPerformance(best);
                        return perf.changePercent > bestPerf.changePercent ? inv : best;
                      }, investments[0] || {}) ? getInvestmentPerformance(investments.reduce((best, inv) => {
                        const perf = getInvestmentPerformance(inv);
                        const bestPerf = getInvestmentPerformance(best);
                        return perf.changePercent > bestPerf.changePercent ? inv : best;
                      }, investments[0])).changePercent : 0)}
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-sm mb-1" style={{ color: jonyColors.textSecondary }}>Schlechteste Position</div>
                  <div className="text-lg font-semibold" style={{ color: jonyColors.magenta }}>
                    {investments.length > 0 
                      ? investments.reduce((worst, inv) => {
                          const perf = getInvestmentPerformance(inv);
                          const worstPerf = getInvestmentPerformance(worst);
                          return perf.changePercent < worstPerf.changePercent ? inv : worst;
                        }).name
                      : 'Keine Daten'
                    }
                  </div>
                  {investments.length > 0 && (
                    <div className="text-sm mt-1" style={{ color: jonyColors.magenta }}>
                      {formatPercentage(investments.reduce((worst, inv) => {
                        const perf = getInvestmentPerformance(inv);
                        const worstPerf = getInvestmentPerformance(worst);
                        return perf.changePercent < worstPerf.changePercent ? inv : worst;
                      }, investments[0] || {}) ? getInvestmentPerformance(investments.reduce((worst, inv) => {
                        const perf = getInvestmentPerformance(inv);
                        const worstPerf = getInvestmentPerformance(worst);
                        return perf.changePercent < worstPerf.changePercent ? inv : worst;
                      }, investments[0])).changePercent : 0)}
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-sm mb-1" style={{ color: jonyColors.textSecondary }}>Größte Position</div>
                  <div className="text-lg font-semibold" style={{ color: jonyColors.textPrimary }}>
                    {investments.length > 0 
                      ? investments.reduce((largest, inv) => {
                          const largestValue = getInvestmentPerformance(largest).currentValue;
                          const currentValue = getInvestmentPerformance(inv).currentValue;
                          return currentValue > largestValue ? inv : largest;
                        }).name
                      : 'Keine Daten'
                    }
                  </div>
                  {investments.length > 0 && (
                    <div className="text-sm mt-1" style={{ color: jonyColors.textSecondary }}>
                      {formatCurrency(investments.reduce((largest, inv) => {
                        const largestValue = getInvestmentPerformance(largest).currentValue;
                        const currentValue = getInvestmentPerformance(inv).currentValue;
                        return currentValue > largestValue ? inv : largest;
                      }, investments[0] || {}) ? getInvestmentPerformance(investments.reduce((largest, inv) => {
                        const largestValue = getInvestmentPerformance(largest).currentValue;
                        const currentValue = getInvestmentPerformance(inv).currentValue;
                        return currentValue > largestValue ? inv : largest;
                      }, investments[0])).currentValue : 0)}
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>

          {/* Geographic Distribution Section */}
          {investments.length > 0 && (
            <div className="grid grid-cols-3 gap-8 mb-8">
              {/* World Map Card - 2/3 width */}
              <div className="col-span-2">
                <div 
                  className="p-6 rounded-2xl border h-[28rem]"
                  style={{
                    backgroundColor: jonyColors.surface,
                    border: `1px solid ${jonyColors.border}`
                  }}>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 rounded-xl" style={{ backgroundColor: jonyColors.accent2Alpha }}>
                      <Globe className="w-5 h-5" style={{ color: jonyColors.accent2, strokeWidth: 1.5 }} />
                    </div>
                    <h3 className="text-lg font-light tracking-tight" style={{ color: jonyColors.textPrimary }}>
                      Weltweite Verteilung
                    </h3>
                  </div>
                  
                  <div className="h-80">
                    {worldMapData.length > 0 ? (
                      <div className="w-full h-full flex items-start justify-center pt-4">
                        <div style={{ transform: 'scale(1.05)' }}>
                          <WorldMap
                          color={jonyColors.accent1}
                          title=""
                          value-suffix="€"
                          size="lg"
                          data={worldMapData}
                          backgroundColor="transparent"
                          strokeColor={jonyColors.border}
                          tooltipBgColor={jonyColors.surface}
                          tooltipTextColor={jonyColors.textPrimary}
                          styleFunction={(context) => {
                            const countryData = worldMapData.find(d => d.country === context.country);
                            
                            if (countryData && context.countryValue > 0) {
                              const riskLevel = countryData.riskLevel;
                              const percentage = countryData.percentage;
                              
                              let fillColor, fillOpacity, strokeWidth;
                              
                              // Risk-based coloring according to financial best practices
                              switch (riskLevel) {
                                case 'optimal':
                                  // Green - Well diversified (≤25%)
                                  fillColor = jonyColors.accent1;
                                  fillOpacity = 0.7;
                                  strokeWidth = 0.5;
                                  break;
                                case 'moderate':
                                  // Blue - Moderate concentration (25-40%)
                                  fillColor = jonyColors.accent2;
                                  fillOpacity = 0.8;
                                  strokeWidth = 0.7;
                                  break;
                                case 'high':
                                  // Pink/Magenta - High concentration risk (>40%)
                                  fillColor = jonyColors.magenta;
                                  fillOpacity = 0.9;
                                  strokeWidth = 1.0;
                                  break;
                                default:
                                  fillColor = jonyColors.accent1;
                                  fillOpacity = 0.7;
                                  strokeWidth = 0.5;
                                  break;
                              }
                              
                              return {
                                fill: fillColor,
                                fillOpacity: fillOpacity,
                                stroke: jonyColors.textPrimary,
                                strokeWidth: strokeWidth,
                                cursor: "pointer",
                                transition: "all 0.3s ease",
                                filter: riskLevel === 'high' ? 'brightness(1.1)' : 'none'
                              };
                            }
                            
                            // No investment - light gray
                            return {
                              fill: jonyColors.gray400,
                              fillOpacity: 0.2,
                              stroke: jonyColors.border,
                              strokeWidth: 0.2
                            };
                          }}
                        />
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="text-center">
                          <div className="text-4xl mb-4">🌍</div>
                          <div className="text-sm" style={{ color: jonyColors.textSecondary }}>
                            Keine Investments für Weltkarte vorhanden
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Geographic Categories Card - 1/3 width */}
              <div className="col-span-1">
                <div 
                  className="p-6 rounded-2xl border h-[28rem]"
                  style={{
                    backgroundColor: jonyColors.surface,
                    border: `1px solid ${jonyColors.border}`
                  }}>
                  <h3 className="text-lg font-light tracking-tight mb-6" style={{ color: jonyColors.textPrimary }}>
                    Regionale Aufteilung
                  </h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {riskCategories.map((category) => (
                      <div key={category.name} className="flex items-center justify-between">
                        <span className="text-sm font-medium leading-tight" style={{ color: jonyColors.textPrimary }}>
                          {category.name}
                        </span>
                        <div className="text-sm font-bold" style={{ color: jonyColors.textPrimary }}>
                          {category.percentage}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Individual Investments */}
          <div 
            className="p-8 rounded-3xl transition-all duration-300 hover:bg-opacity-90"
            style={{
              backgroundColor: jonyColors.surface,
              border: `1px solid ${jonyColors.border}`,
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
            }}
          >
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl" style={{ backgroundColor: jonyColors.accent2Alpha }}>
                  <BarChart3 className="w-5 h-5" style={{ color: jonyColors.accent2, strokeWidth: 1.5 }} />
                </div>
                <h3 className="text-lg font-light tracking-tight" style={{ color: jonyColors.textPrimary }}>
                  Einzelne Investments
                </h3>
              </div>
              
              <div className="flex items-center gap-3 flex-wrap">
                {/* Asset Type Filter */}
                {availableTypes.length > 0 && (
                  <select
                    value={investmentFilter}
                    onChange={(e) => setInvestmentFilter(e.target.value)}
                    className="px-4 py-2 rounded-xl border transition-colors text-sm"
                    style={{
                      backgroundColor: jonyColors.cardBackground,
                      color: jonyColors.textPrimary,
                      borderColor: jonyColors.border,
                      outline: 'none'
                    }}
                  >
                    <option value="all">Alle Assets</option>
                    {availableTypes.map(type => (
                      <option key={type} value={type}>
                        {getTypeDisplayName(type)}
                      </option>
                    ))}
                  </select>
                )}
                
                {/* Performance Filter */}
                <select
                  value={performanceFilter}
                  onChange={(e) => setPerformanceFilter(e.target.value)}
                  className="px-4 py-2 rounded-xl border transition-colors text-sm"
                  style={{
                    backgroundColor: jonyColors.cardBackground,
                    color: jonyColors.textPrimary,
                    borderColor: jonyColors.border,
                    outline: 'none'
                  }}
                >
                  <option value="all">Alle Performance</option>
                  <option value="positive">Nur Gewinner</option>
                  <option value="negative">Nur Verlierer</option>
                </select>

                {/* Sort Filter */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-4 py-2 rounded-xl border transition-colors text-sm"
                  style={{
                    backgroundColor: jonyColors.cardBackground,
                    color: jonyColors.textPrimary,
                    borderColor: jonyColors.border,
                    outline: 'none'
                  }}
                >
                  <option value="name">Nach Name</option>
                  <option value="value">Nach Wert</option>
                  <option value="performance">Nach Performance</option>
                  <option value="date">Nach Kaufdatum</option>
                </select>

              </div>
            </div>
            
            {filteredInvestments.length > 0 ? (
              <div className="space-y-6">
                {filteredInvestments.map((investment, index) => {
                  const performance = getInvestmentPerformance(investment);
                  const isPositive = performance.change >= 0;
                  const changeColor = isPositive ? jonyColors.accent1 : jonyColors.magenta;
                  
                  return (
                    <div key={investment.id || index} className="group relative p-6 rounded-2xl border" style={{
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
                              {getTypeDisplayName(investment.type)}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm" style={{ color: jonyColors.textSecondary }}>
                            <span>{investment.symbol}</span>
                            <span>•</span>
                            <span>{investment.quantity} Stück</span>
                            <span>•</span>
                            <span>Ø {formatCurrency(parseFloat(investment.purchasePrice) || 0)}</span>
                          </div>
                        </div>
                        
                        <div className="text-right mr-12">
                          <div className="text-xl font-bold mb-1" style={{ color: jonyColors.textPrimary }}>
                            {formatCurrency(performance.currentValue)}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium" style={{ color: changeColor }}>
                              {isPositive ? '+' : ''}{formatCurrency(performance.change)}
                            </span>
                            <span className="text-sm font-medium" style={{ color: changeColor }}>
                              ({formatPercentage(performance.changePercent)})
                            </span>
                          </div>
                        </div>

                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
                          <button
                            onClick={() => setEditingInvestment(investment)}
                            className="p-2 rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-lg"
                            style={{ 
                              backgroundColor: jonyColors.accent2Alpha, 
                              color: jonyColors.accent2,
                              border: `1px solid transparent`
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.backgroundColor = jonyColors.accent2;
                              e.target.style.color = 'black';
                              e.target.style.transform = 'scale(1.05)';
                              e.target.style.boxShadow = `0 4px 12px ${jonyColors.accent2}33`;
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.backgroundColor = jonyColors.accent2Alpha;
                              e.target.style.color = jonyColors.accent2;
                              e.target.style.transform = 'scale(1)';
                              e.target.style.boxShadow = 'none';
                            }}
                            title="Bearbeiten"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteInvestment(investment.id)}
                            className="p-2 rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-lg"
                            style={{ 
                              backgroundColor: jonyColors.magentaAlpha, 
                              color: jonyColors.magenta,
                              border: `1px solid transparent`
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.backgroundColor = jonyColors.magenta;
                              e.target.style.color = jonyColors.background;
                              e.target.style.transform = 'scale(1.05)';
                              e.target.style.boxShadow = `0 4px 12px ${jonyColors.magenta}33`;
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.backgroundColor = jonyColors.magentaAlpha;
                              e.target.style.color = jonyColors.magenta;
                              e.target.style.transform = 'scale(1)';
                              e.target.style.boxShadow = 'none';
                            }}
                            title="Löschen"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-sm" style={{ color: jonyColors.textSecondary }}>
                  {investments.length === 0 
                    ? 'Keine Investments vorhanden' 
                    : `Keine ${getTypeDisplayName(investmentFilter)} gefunden`
                  }
                </div>
              </div>
            )}
          </div>

          {/* Create Investment Modal - Minimalistic Design */}
          {showCreateModal && (
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
              <div className="rounded-2xl max-w-md w-full p-8 shadow-2xl" style={{ backgroundColor: jonyColors.surface }}>
                <h2 className="text-xl font-semibold mb-8 text-center" style={{ color: jonyColors.textPrimary }}>Investment hinzufügen</h2>
                
                <div className="space-y-6">
                  {/* Investment Name */}
                  <div>
                    <input
                      type="text"
                      value={newInvestment.name}
                      onChange={(e) => setNewInvestment(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Name (z.B. Apple, MSCI World ETF)"
                      className="w-full px-4 py-4 rounded-xl text-base transition-all duration-200"
                      style={{
                        backgroundColor: jonyColors.cardBackground,
                        color: jonyColors.textPrimary,
                        border: `1px solid ${jonyColors.border}`,
                        outline: 'none'
                      }}
                    />
                  </div>

                  {/* Symbol & Type in one row */}
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      type="text"
                      value={newInvestment.symbol}
                      onChange={(e) => setNewInvestment(prev => ({ ...prev, symbol: e.target.value }))}
                      placeholder="Symbol (AAPL, IWDA)"
                      className="px-4 py-4 rounded-xl text-base transition-all duration-200"
                      style={{
                        backgroundColor: jonyColors.cardBackground,
                        color: jonyColors.textPrimary,
                        border: `1px solid ${jonyColors.border}`,
                        outline: 'none'
                      }}
                    />
                    
                    <select
                      value={newInvestment.type}
                      onChange={(e) => setNewInvestment(prev => ({ ...prev, type: e.target.value }))}
                      className="px-4 py-4 rounded-xl text-base transition-all duration-200"
                      style={{
                        backgroundColor: jonyColors.cardBackground,
                        color: jonyColors.textPrimary,
                        border: `1px solid ${jonyColors.border}`,
                        outline: 'none'
                      }}
                    >
                      <option value="etf">ETF</option>
                      <option value="stock">Aktie</option>
                      <option value="bond">Anleihe</option>
                      <option value="crypto">Kryptowährung</option>
                      <option value="reit">REIT</option>
                      <option value="other">Sonstige</option>
                    </select>
                  </div>

                  {/* Total Investment Amount */}
                  <div>
                    <input
                      type="number"
                      step="0.01"
                      value={newInvestment.totalInvestment || ''}
                      onChange={(e) => {
                        const totalAmount = parseFloat(e.target.value) || 0;
                        // Set quantity to 1 and purchase price to total amount for simplicity
                        setNewInvestment(prev => ({ 
                          ...prev, 
                          totalInvestment: e.target.value,
                          quantity: '1',
                          purchasePrice: e.target.value,
                          currentPrice: e.target.value // Default current price to purchase price
                        }));
                      }}
                      placeholder="Investierter Betrag (z.B. 1000)"
                      className="w-full px-4 py-4 rounded-xl text-base transition-all duration-200"
                      style={{
                        backgroundColor: jonyColors.cardBackground,
                        color: jonyColors.textPrimary,
                        border: `1px solid ${jonyColors.border}`,
                        outline: 'none'
                      }}
                    />
                    <div className="text-xs mt-1 ml-1" style={{ color: jonyColors.textTertiary }}>
                      Gesamter investierter Betrag in EUR
                    </div>
                  </div>

                  {/* Region Selection */}
                  <div>
                    <select
                      value={newInvestment.region}
                      onChange={(e) => setNewInvestment(prev => ({ ...prev, region: e.target.value }))}
                      className="w-full px-4 py-4 rounded-xl text-base transition-all duration-200"
                      style={{
                        backgroundColor: jonyColors.cardBackground,
                        color: jonyColors.textPrimary,
                        border: `1px solid ${jonyColors.border}`,
                        outline: 'none'
                      }}
                    >
                      <option value="Global">🌍 Global</option>
                      <option value="USA">🇺🇸 USA</option>
                      <option value="Europa">🇪🇺 Europa</option>
                      <option value="Deutschland">🇩🇪 Deutschland</option>
                      <option value="Asien">🏯 Asien</option>
                      <option value="Emerging Markets">🌏 Emerging Markets</option>
                    </select>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4 mt-8">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-6 py-4 rounded-xl font-medium transition-all duration-200"
                    style={{
                      backgroundColor: 'transparent',
                      color: jonyColors.textSecondary,
                      border: `1px solid ${jonyColors.border}`
                    }}
                  >
                    Abbrechen
                  </button>
                  <button
                    onClick={handleCreateInvestment}
                    disabled={!newInvestment.name || !newInvestment.symbol || !newInvestment.totalInvestment}
                    className="flex-1 px-6 py-4 rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ 
                      backgroundColor: jonyColors.accent1, 
                      color: '#000000',
                      border: 'none'
                    }}
                  >
                    Hinzufügen
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Edit Investment Modal */}
          {editingInvestment && (
            <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
              <div className="backdrop-blur-md rounded-3xl max-w-lg w-full p-8 shadow-2xl border" style={{
                backgroundColor: jonyColors.surfaceAlpha,
                border: `1px solid ${jonyColors.border}`
              }}>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg" style={{
                    background: `linear-gradient(to bottom right, ${jonyColors.accent2}, ${jonyColors.blue})`
                  }}>
                    <Edit className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold" style={{ color: jonyColors.textPrimary }}>
                      Investment bearbeiten
                    </h2>
                    <p className="text-sm" style={{ color: jonyColors.textSecondary }}>
                      {editingInvestment.name} aktualisieren
                    </p>
                  </div>
                </div>
              
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold mb-3" style={{ color: jonyColors.textPrimary }}>
                      Aktueller Preis
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        value={editingInvestment.currentPrice}
                        onChange={(e) => setEditingInvestment(prev => ({ ...prev, currentPrice: e.target.value }))}
                        className="w-full pl-4 pr-12 py-3 border-2 rounded-xl text-base font-medium transition-all duration-200"
                        style={{
                          backgroundColor: jonyColors.cardBackground,
                          color: jonyColors.textPrimary,
                          borderColor: jonyColors.border,
                          outline: 'none'
                        }}
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2" style={{ color: jonyColors.textTertiary }}>€</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-3" style={{ color: jonyColors.textPrimary }}>
                      Notizen
                    </label>
                    <textarea
                      value={editingInvestment.notes || ''}
                      onChange={(e) => setEditingInvestment(prev => ({ ...prev, notes: e.target.value }))}
                      rows="4"
                      className="w-full px-4 py-3 border-2 rounded-xl text-base transition-all duration-200"
                      style={{
                        backgroundColor: jonyColors.cardBackground,
                        color: jonyColors.textPrimary,
                        borderColor: jonyColors.border,
                        outline: 'none'
                      }}
                      placeholder="Zusätzliche Informationen oder Updates..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-3" style={{ color: jonyColors.textPrimary }}>
                      Region/Land
                    </label>
                    <select
                      value={editingInvestment.region || 'Deutschland'}
                      onChange={(e) => setEditingInvestment(prev => ({ ...prev, region: e.target.value }))}
                      className="w-full px-4 py-3 border-2 rounded-xl text-base transition-all duration-200"
                      style={{
                        backgroundColor: jonyColors.cardBackground,
                        color: jonyColors.textPrimary,
                        borderColor: jonyColors.border,
                        outline: 'none'
                      }}
                    >
                      <option value="Deutschland">Deutschland</option>
                      <option value="USA">USA</option>
                      <option value="Europa">Europa</option>
                      <option value="Asien">Asien</option>
                      <option value="Emerging Markets">Emerging Markets</option>
                      <option value="Global">Global</option>
                      <option value="Unbekannt">Unbekannt</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-4 mt-8">
                  <button
                    onClick={() => setEditingInvestment(null)}
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
                    onClick={() => handleEditInvestment(editingInvestment)}
                    className="flex-1 px-6 py-3 text-white rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl"
                    style={{
                      background: `linear-gradient(to right, ${jonyColors.accent2}, ${jonyColors.blue})`
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.transform = 'scale(1.02)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.transform = 'scale(1)';
                    }}
                  >
                    Speichern
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating Action Button */}
      <button
        onClick={() => setShowCreateModal(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl hover:shadow-3xl hover:scale-110 z-50"
        style={{
          background: `linear-gradient(to bottom right, ${jonyColors.accent1}, ${jonyColors.greenDark})`
        }}
        title="Investment hinzufügen"
      >
        <Plus className="w-6 h-6 text-black" strokeWidth={2.5} />
      </button>
    </div>
  );
};

export default InvestmentsPage;