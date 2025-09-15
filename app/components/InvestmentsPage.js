import React, { useState, useMemo, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  TrendingUp, 
  DollarSign, 
  PieChart, 
  BarChart3, 
  Plus,
  Edit,
  Trash2,
  TrendingDown,
  Globe,
  RefreshCw,
  Loader,
  MapPin,
  FileText
} from 'lucide-react';
import { ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line } from 'recharts';
import { jonyColors } from '../theme';
import { db } from '../utils/db';
import dynamic from 'next/dynamic';

import { fetchCurrentPrice, updateAllInvestmentPrices, detectRegionFromSymbol } from '../utils/stockApi';
const WorldMap = dynamic(() => import('./WorldMap'), {
  ssr: false, // Diese Option deaktiviert das Server-Side Rendering
  loading: () => <div className="h-full w-full flex items-center justify-center"><p>Karte lädt...</p></div>
});
const InvestmentsPage = () => {
  // State for modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState(null);
  
  // State for price refresh
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState({ current: 0, total: 0, name: '' });
  const [performancePeriod, setPerformancePeriod] = useState('1year');
  const [investmentFilter, setInvestmentFilter] = useState('all');
  const [performanceFilter, setPerformanceFilter] = useState('all'); // 'all', 'positive', 'negative'
  const [sortBy, setSortBy] = useState('name'); // 'name', 'value', 'performance', 'date'
  const [expandedInvestment, setExpandedInvestment] = useState(null);
  
  // Form state for new investment
  const [newInvestment, setNewInvestment] = useState({
    name: '',
    wkn: '', // WKN or ISIN for German securities
    purchaseDate: new Date().toISOString().split('T')[0],
    purchasePrice: '',
    quantity: '',
    region: '', // Optional, manual fallback
    // Auto-filled fields
    symbol: '',
    type: 'etf',
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
    if (geographicDistribution.length === 0) {
      // Return all 6 categories with 0% if no investments
      return [
        { name: 'Nordamerika', value: 0, count: 0, percentage: '0.0', color: jonyColors.accent2 },
        { name: 'Europa', value: 0, count: 0, percentage: '0.0', color: jonyColors.accent1 },
        { name: 'Asien', value: 0, count: 0, percentage: '0.0', color: jonyColors.chartTertiary },
        { name: 'Australien & Ozeanien', value: 0, count: 0, percentage: '0.0', color: jonyColors.chartSecondary },
        { name: 'Lateinamerika', value: 0, count: 0, percentage: '0.0', color: jonyColors.chartQuaternary },
        { name: 'Afrika & Naher Osten', value: 0, count: 0, percentage: '0.0', color: jonyColors.magenta }
      ];
    }
    
    // ✅ POLITISCHE REGIONEN-ZUORDNUNG - Nach EU/NATO/politischen Definitionen
    const categoryMapping = {
      'Nordamerika': ['USA', 'United States', 'Kanada', 'Canada', 'Mexiko', 'Mexico', 'Nordamerika', 'North America'],
      'Europa': [
        // EU-Länder + EWR + Schweiz + UK + Balkan (politisches Europa)
        'Deutschland', 'Germany', 'Europa', 'Europe', 'Schweiz', 'Switzerland', 'UK', 'United Kingdom', 
        'Frankreich', 'France', 'Italien', 'Italy', 'Spanien', 'Spain', 'Niederlande', 'Netherlands', 
        'Österreich', 'Austria', 'Belgien', 'Belgium', 'Portugal', 'Schweden', 'Sweden', 'Norwegen', 'Norway', 
        'Dänemark', 'Denmark', 'Finnland', 'Finland', 'Polen', 'Poland', 'Tschechien', 'Czech Republic', 
        'Ungarn', 'Hungary', 'Slowakei', 'Slovakia', 'Slowenien', 'Slovenia', 'Kroatien', 'Croatia', 
        'Rumänien', 'Romania', 'Bulgarien', 'Bulgaria', 'Griechenland', 'Greece', 'Zypern', 'Cyprus',
        'Irland', 'Ireland', 'Island', 'Iceland', 'Estland', 'Estonia', 'Lettland', 'Latvia', 'Litauen', 'Lithuania',
        'Malta', 'Luxemburg', 'Luxembourg',
        // Osteuropäische Länder (politisch Europa)
        'Ukraine', 'Belarus', 'Weißrussland', 'Moldau', 'Moldova', 'Serbien', 'Serbia', 'Montenegro', 
        'Bosnien', 'Bosnia', 'Albanien', 'Albania', 'Nordmazedonien', 'North Macedonia', 'Kosovo'
      ],
      'Asien': [
        'Asien', 'Asia', 'China', 'Japan', 'Südkorea', 'South Korea', 'Korea', 'Indien', 'India', 
        'Taiwan', 'Hong Kong', 'Singapur', 'Singapore', 'Thailand', 'Malaysia', 'Indonesien', 'Indonesia', 
        'Philippinen', 'Philippines', 'Vietnam', 'Kambodscha', 'Cambodia', 'Laos', 'Myanmar', 'Bangladesch', 'Bangladesh',
        'Pakistan', 'Afghanistan', 'Kasachstan', 'Kazakhstan', 'Usbekistan', 'Uzbekistan', 'Kirgisistan', 'Kyrgyzstan',
        'Tadschikistan', 'Tajikistan', 'Turkmenistan', 'Nepal', 'Bhutan', 'Sri Lanka', 'Malediven', 'Maldives',
        'Mongolei', 'Mongolia', 'Nordkorea', 'North Korea',
        // Politisch zu Asien gehörend (nicht Europa!)
        'Türkei', 'Turkey', 'Georgien', 'Georgia', 'Armenien', 'Armenia', 'Aserbaidschan', 'Azerbaijan', 
        'Russland', 'Russia', 'Russian Federation'
      ],
      'Australien & Ozeanien': ['Australien', 'Australia', 'Neuseeland', 'New Zealand', 'Ozeanien', 'Oceania', 'Fiji', 'Papua-Neuguinea', 'Papua New Guinea'],
      'Lateinamerika': [
        'Lateinamerika', 'Latin America', 'South America', 'Südamerika', 'Brasilien', 'Brazil', 
        'Argentinien', 'Argentina', 'Chile', 'Kolumbien', 'Colombia', 'Peru', 'Venezuela', 'Ecuador', 
        'Uruguay', 'Paraguay', 'Bolivien', 'Bolivia', 'Guyana', 'Suriname', 'Französisch-Guayana',
        // Mittelamerika und Karibik
        'Mexiko', 'Mexico', 'Guatemala', 'Belize', 'El Salvador', 'Honduras', 'Nicaragua', 'Costa Rica', 'Panama',
        'Kuba', 'Cuba', 'Haiti', 'Dominikanische Republik', 'Dominican Republic', 'Puerto Rico', 'Jamaika', 'Jamaica'
      ],
      'Afrika & Naher Osten': [
        // Afrika
        'Afrika', 'Africa', 'Südafrika', 'South Africa', 'Nigeria', 'Kenia', 'Kenya', 'Marokko', 'Morocco', 
        'Ägypten', 'Egypt', 'Äthiopien', 'Ethiopia', 'Ghana', 'Algerien', 'Algeria', 'Tunesien', 'Tunisia',
        'Libyen', 'Libya', 'Sudan', 'Tansania', 'Tanzania', 'Uganda', 'Ruanda', 'Rwanda',
        // Naher Osten (ohne Türkei, Georgien, etc. - die sind jetzt in Asien)
        'Naher Osten', 'Middle East', 'Saudi-Arabien', 'Saudi Arabia', 'Israel', 'Iran', 'Irak', 'Iraq', 
        'Jordanien', 'Jordan', 'Libanon', 'Lebanon', 'Syrien', 'Syria', 'Vereinigte Arabische Emirate', 'UAE', 
        'Kuwait', 'Katar', 'Qatar', 'Bahrain', 'Oman', 'Jemen', 'Yemen', 'Palästina', 'Palestine'
      ]
    };
    
    const categoryColors = {
      'Nordamerika': jonyColors.accent2,
      'Europa': jonyColors.accent1,
      'Asien': jonyColors.chartTertiary,
      'Australien & Ozeanien': jonyColors.chartSecondary,
      'Lateinamerika': jonyColors.chartQuaternary,
      'Afrika & Naher Osten': jonyColors.magenta
    };
    
    const totalInvestments = geographicDistribution.reduce((sum, region) => sum + region.value, 0);
    
    // Find Global investments to distribute across categories
    const globalRegion = geographicDistribution.find(region => region.name === 'Global');
    const globalValue = globalRegion ? globalRegion.value : 0;
    const globalCount = globalRegion ? globalRegion.count : 0;
    
    // Find Emerging Markets investments to distribute across Asia, Latin America, and Africa
    const emergingMarketsRegion = geographicDistribution.find(region => region.name === 'Emerging Markets');
    const emergingMarketsValue = emergingMarketsRegion ? emergingMarketsRegion.value : 0;
    const emergingMarketsCount = emergingMarketsRegion ? emergingMarketsRegion.count : 0;
    
    const categories = Object.keys(categoryMapping).map(categoryName => {
      const mappedRegions = categoryMapping[categoryName];
      
      // Get direct regional investments
      const directData = geographicDistribution.filter(region => 
        mappedRegions.includes(region.name)
      );
      
      
      let totalValue = directData.reduce((sum, region) => sum + region.value, 0);
      let totalCount = directData.reduce((sum, region) => sum + region.count, 0);
      
      // Distribute Emerging Markets across Asien, Lateinamerika, and Afrika & Naher Osten
      if (emergingMarketsValue > 0 && ['Asien', 'Lateinamerika', 'Afrika & Naher Osten'].includes(categoryName)) {
        totalValue += emergingMarketsValue / 3;
        totalCount += Math.ceil(emergingMarketsCount / 3);
      }
      
      // Distribute Global investments equally across all 6 categories
      if (globalValue > 0) {
        const globalPortionFactor = 1/6;
        totalValue += globalValue * globalPortionFactor;
        totalCount += Math.ceil(globalCount * globalPortionFactor);
      }
      
      return {
        name: categoryName,
        value: totalValue,
        count: totalCount,
        percentage: totalInvestments > 0 ? ((totalValue / totalInvestments) * 100).toFixed(1) : '0.0',
        color: categoryColors[categoryName]
      };
    });
    
    // Always show all 6 categories, even with 0%
    return categories;
  }, [geographicDistribution]);


  // CRUD operations
  const handleCreateInvestment = async () => {
    try {
      let currentPrice = parseFloat(newInvestment.purchasePrice) || 0;
      
      // Try to fetch current price if WKN is provided
      if (newInvestment.wkn) {
        try {
          const priceData = await fetchCurrentPrice(newInvestment.wkn);
          currentPrice = priceData.price;
          
          if (priceData.isDemo) {
            console.log(`🎭 Using mock price for ${newInvestment.name}: ${currentPrice} (WKN: ${newInvestment.wkn})`);
          } else {
            console.log(`✅ Fetched live price for ${newInvestment.name}: ${currentPrice} from ${priceData.source}`);
          }
        } catch (error) {
          console.warn('Could not fetch current price, using purchase price as fallback');
        }
      }
      
      // Automatically detect region if not manually set
      let finalRegion = newInvestment.region;
      if (!finalRegion && newInvestment.wkn) {
        try {
          finalRegion = detectRegionFromSymbol(newInvestment.wkn);
          console.log(`🌍 Auto-detected region for ${newInvestment.name}: ${finalRegion}`);
        } catch (error) {
          console.warn('Could not auto-detect region:', error);
          finalRegion = 'Unbekannt';
        }
      }
      
      await db.investments.add({
        name: newInvestment.name,
        symbol: newInvestment.symbol || newInvestment.wkn, // Use WKN as symbol if no symbol provided
        wkn: newInvestment.wkn,
        type: newInvestment.type,
        purchasePrice: parseFloat(newInvestment.purchasePrice) || 0,
        quantity: parseFloat(newInvestment.quantity) || 0,
        purchaseDate: newInvestment.purchaseDate,
        currentPrice: currentPrice,
        currency: newInvestment.currency,
        broker: newInvestment.broker,
        notes: newInvestment.notes,
        region: finalRegion || 'Unbekannt', // Fallback if region not determined
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      setNewInvestment({
        name: '',
        wkn: '',
        purchaseDate: new Date().toISOString().split('T')[0],
        purchasePrice: '',
        quantity: '',
        region: '',
        // Auto-filled fields
        symbol: '',
        type: 'etf',
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

  // Auto-detect region from WKN/symbol when adding investment
  const handleWknChange = useCallback(async (wkn) => {
    setNewInvestment(prev => ({ ...prev, wkn: wkn.toUpperCase() }));
    
    // Try to auto-detect region if not manually set
    if (!newInvestment.region && wkn) {
      try {
        const region = detectRegionFromSymbol(wkn);
        if (region && region !== 'Global') {
          setNewInvestment(prev => ({ ...prev, region }));
        }
      } catch (error) {
        console.warn('Could not auto-detect region:', error);
      }
    }
  }, [newInvestment.region]);

  // Refresh all investment prices
  const handleRefreshPrices = useCallback(async () => {
    if (isRefreshing || investments.length === 0) return;
    
    setIsRefreshing(true);
    setRefreshProgress({ current: 0, total: investments.length, name: '' });
    
    try {
      const results = await updateAllInvestmentPrices(
        investments,
        (current, total, name) => {
          setRefreshProgress({ current, total, name });
        }
      );
      
      // Update successful price fetches in database
      for (const result of results) {
        if (result.success) {
          await db.investments.update(result.id, {
            currentPrice: result.currentPrice,
            updatedAt: Date.now()
          });
        }
      }
      
      console.log('Price refresh completed:', results);
    } catch (error) {
      console.error('Error refreshing prices:', error);
    } finally {
      setIsRefreshing(false);
      setRefreshProgress({ current: 0, total: 0, name: '' });
    }
  }, [investments, isRefreshing]);

  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: jonyColors.background, color: jonyColors.textPrimary }}>
      {/* Header */}
      <div className="px-6 py-8 mb-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: jonyColors.accent1 }}></div>
              <h1 className="text-3xl font-bold tracking-tight" style={{ color: jonyColors.textPrimary, letterSpacing: '-0.02em' }}>
                Investments & Assets
              </h1>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Refresh Progress */}
              {isRefreshing && (
                <div className="text-sm" style={{ color: jonyColors.textSecondary }}>
                  {refreshProgress.name ? (
                    <>Aktualisiere: {refreshProgress.name} ({refreshProgress.current}/{refreshProgress.total})</>
                  ) : (
                    <>Kurse werden aktualisiert...</>
                  )}
                </div>
              )}
              
              {/* Price Refresh Button */}
              {investments.length > 0 && (
                <button
                  onClick={handleRefreshPrices}
                  disabled={isRefreshing}
                  className="w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed border-2"
                  style={{
                    backgroundColor: '#000000',
                    borderColor: jonyColors.accent2,
                    color: jonyColors.accent2,
                    transform: isRefreshing ? 'scale(0.95)' : 'scale(1)',
                  }}
                  onMouseEnter={(e) => {
                    if (!isRefreshing) {
                      e.target.style.transform = 'scale(1.05)';
                      e.target.style.backgroundColor = '#000000';
                      e.target.style.borderColor = jonyColors.accent2;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isRefreshing) {
                      e.target.style.transform = 'scale(1)';
                      e.target.style.backgroundColor = '#000000';
                      e.target.style.borderColor = jonyColors.accent2;
                    }
                  }}
                >
                  {isRefreshing ? (
                    <Loader className="w-5 h-5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-5 h-5" />
                  )}
                </button>
              )}
            </div>
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
                <div className="p-3 rounded-xl" style={{ backgroundColor: jonyColors.accent2Alpha }}>
                  <PieChart className="w-5 h-5" style={{ color: jonyColors.accent2, strokeWidth: 1.5 }} />
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

            {/* Investment Summary Card - Minimalistic Design */}
            <div 
              className="p-6 rounded-2xl border h-[28rem]"
              style={{
                backgroundColor: jonyColors.surface,
                border: `1px solid ${jonyColors.border}`
              }}>
              
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 rounded-xl" style={{ backgroundColor: jonyColors.accent2Alpha }}>
                  <DollarSign className="w-5 h-5" style={{ color: jonyColors.accent2, strokeWidth: 1.5 }} />
                </div>
                <h3 className="text-lg font-light tracking-tight" style={{ color: jonyColors.textPrimary }}>
                  Investment Übersicht
                </h3>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* Beste Position (% Performance) */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium leading-tight mb-1" style={{ color: jonyColors.textSecondary }}>
                      Beste Position
                    </div>
                    <div className="text-lg font-semibold" style={{ color: jonyColors.textPrimary }}>
                      {investments.length > 0 
                        ? investments.reduce((best, inv) => {
                            const perf = getInvestmentPerformance(inv);
                            const bestPerf = getInvestmentPerformance(best);
                            return perf.changePercent > bestPerf.changePercent ? inv : best;
                          }).name
                        : 'Keine Daten'
                      }
                    </div>
                  </div>
                  {investments.length > 0 && (
                    <div className="text-lg font-bold" style={{ color: jonyColors.accent1 }}>
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

                {/* Schlechteste Position (% Performance) */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium leading-tight mb-1" style={{ color: jonyColors.textSecondary }}>
                      Schlechteste Position
                    </div>
                    <div className="text-lg font-semibold" style={{ color: jonyColors.textPrimary }}>
                      {investments.length > 0 
                        ? investments.reduce((worst, inv) => {
                            const perf = getInvestmentPerformance(inv);
                            const worstPerf = getInvestmentPerformance(worst);
                            return perf.changePercent < worstPerf.changePercent ? inv : worst;
                          }).name
                        : 'Keine Daten'
                      }
                    </div>
                  </div>
                  {investments.length > 0 && (
                    <div className="text-lg font-bold" style={{ color: jonyColors.magenta }}>
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

                {/* Größter Gewinnbringer (Absolute € Impact) */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium leading-tight mb-1" style={{ color: jonyColors.textSecondary }}>
                      Größter Gewinnbringer
                    </div>
                    <div className="text-lg font-semibold" style={{ color: jonyColors.textPrimary }}>
                      {investments.length > 0 
                        ? investments.reduce((bestGainer, inv) => {
                            const perf = getInvestmentPerformance(inv);
                            const bestGainerPerf = getInvestmentPerformance(bestGainer);
                            return perf.change > bestGainerPerf.change ? inv : bestGainer;
                          }).name
                        : 'Keine Daten'
                      }
                    </div>
                  </div>
                  {investments.length > 0 && (
                    <div className="text-lg font-bold" style={{ color: jonyColors.accent1 }}>
                      {(() => {
                        const bestGainer = investments.reduce((bestGainer, inv) => {
                          const perf = getInvestmentPerformance(inv);
                          const bestGainerPerf = getInvestmentPerformance(bestGainer);
                          return perf.change > bestGainerPerf.change ? inv : bestGainer;
                        }, investments[0] || {});
                        const change = getInvestmentPerformance(bestGainer).change;
                        return change > 0 ? `+${formatCurrency(change)}` : formatCurrency(change);
                      })()}
                    </div>
                  )}
                </div>

                {/* Größter Verlustbringer (Absolute € Impact) */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium leading-tight mb-1" style={{ color: jonyColors.textSecondary }}>
                      Größter Verlustbringer
                    </div>
                    <div className="text-lg font-semibold" style={{ color: jonyColors.textPrimary }}>
                      {investments.length > 0 
                        ? investments.reduce((worstLoser, inv) => {
                            const perf = getInvestmentPerformance(inv);
                            const worstLoserPerf = getInvestmentPerformance(worstLoser);
                            return perf.change < worstLoserPerf.change ? inv : worstLoser;
                          }).name
                        : 'Keine Daten'
                      }
                    </div>
                  </div>
                  {investments.length > 0 && (
                    <div className="text-lg font-bold" style={{ color: jonyColors.magenta }}>
                      {(() => {
                        const worstLoser = investments.reduce((worstLoser, inv) => {
                          const perf = getInvestmentPerformance(inv);
                          const worstLoserPerf = getInvestmentPerformance(worstLoser);
                          return perf.change < worstLoserPerf.change ? inv : worstLoser;
                        }, investments[0] || {});
                        return formatCurrency(getInvestmentPerformance(worstLoser).change);
                      })()}
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
                  className="p-8 rounded-2xl border h-[36rem]"
                  style={{
                    backgroundColor: jonyColors.surface,
                    border: `1px solid ${jonyColors.border}`
                  }}>
                  <div className="flex items-center gap-4 mb-8">
                    <div className="p-3 rounded-xl" style={{ backgroundColor: jonyColors.accent2Alpha }}>
                      <Globe className="w-5 h-5" style={{ color: jonyColors.accent2, strokeWidth: 1.5 }} />
                    </div>
                    <h3 className="text-lg font-light tracking-tight" style={{ color: jonyColors.textPrimary }}>
                      Weltweite Verteilung
                    </h3>
                  </div>
                  
                  <div className="flex items-center justify-end h-[26rem]">
                    <div className="w-full h-full pl-8">
                      <WorldMap
                        data={riskCategories.map(category => {
                          // Translate German region names to English for WorldMap component
                          const regionTranslation = {
                            'Nordamerika': 'North America',
                            'Europa': 'Europe', 
                            'Asien': 'Asia',
                            'Australien & Ozeanien': 'Australia & Oceania',
                            'Lateinamerika': 'Latin America',
                            'Afrika & Naher Osten': 'Africa & Middle East'
                          };
                          
                          return {
                            region: regionTranslation[category.name] || category.name,
                            investmentPercentage: parseFloat(category.percentage)
                          };
                        })}
                        backgroundColor="transparent"
                        strokeColor={jonyColors.border}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Geographic Categories Card - 1/3 width */}
              <div className="col-span-1">
                <div 
                  className="p-6 rounded-2xl border h-[36rem]"
                  style={{
                    backgroundColor: jonyColors.surface,
                    border: `1px solid ${jonyColors.border}`
                  }}>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 rounded-xl" style={{ backgroundColor: jonyColors.accent2Alpha }}>
                      <MapPin className="w-5 h-5" style={{ color: jonyColors.accent2, strokeWidth: 1.5 }} />
                    </div>
                    <h3 className="text-lg font-light tracking-tight" style={{ color: jonyColors.textPrimary }}>
                      Regionale Aufteilung
                    </h3>
                  </div>
                  
                  <div className="flex flex-col justify-between" style={{ height: 'calc(36rem - 6rem)' }}>
                    {/* Region Percentages */}
                    <div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {riskCategories && riskCategories.map((category) => (
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
                    
                    {/* Color Legend - positioned 24px higher from bottom */}
                    <div className="pt-6 border-t mb-6" style={{ borderColor: jonyColors.border }}>
                      <div className="flex items-center gap-4 justify-center flex-wrap">
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 rounded" style={{ backgroundColor: '#FFB6C1' }}></div>
                          <span className="text-xs" style={{ color: jonyColors.textSecondary }}>0-25%</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 rounded" style={{ backgroundColor: '#FF69B4' }}></div>
                          <span className="text-xs" style={{ color: jonyColors.textSecondary }}>25-50%</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 rounded" style={{ backgroundColor: '#FF1493' }}></div>
                          <span className="text-xs" style={{ color: jonyColors.textSecondary }}>50-75%</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 rounded" style={{ backgroundColor: '#C71585' }}></div>
                          <span className="text-xs" style={{ color: jonyColors.textSecondary }}>75-100%</span>
                        </div>
                      </div>
                    </div>
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
                  <FileText className="w-5 h-5" style={{ color: jonyColors.accent2, strokeWidth: 1.5 }} />
                </div>
                <h3 className="text-lg font-light tracking-tight" style={{ color: jonyColors.textPrimary }}>
                  Einzelne Investments
                </h3>
              </div>
              
              <div className="flex items-center gap-2">
                {/* Asset Type Filter */}
                {availableTypes.length > 0 && (
                  <div className="relative">
                    <select
                      value={investmentFilter}
                      onChange={(e) => setInvestmentFilter(e.target.value)}
                      className="px-3 py-2 pr-8 rounded-lg text-sm font-medium cursor-pointer appearance-none transition-all duration-200 hover:shadow-sm"
                      style={{
                        backgroundColor: investmentFilter !== 'all' ? jonyColors.accent2Alpha : jonyColors.surface,
                        color: investmentFilter !== 'all' ? jonyColors.accent2 : jonyColors.textPrimary,
                        border: `1px solid ${investmentFilter !== 'all' ? jonyColors.accent2 : jonyColors.border}`,
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
                    <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                )}
                
                {/* Performance Filter */}
                <div className="relative">
                  <select
                    value={performanceFilter}
                    onChange={(e) => setPerformanceFilter(e.target.value)}
                    className="px-3 py-2 pr-8 rounded-lg text-sm font-medium cursor-pointer appearance-none transition-all duration-200 hover:shadow-sm"
                    style={{
                      backgroundColor: performanceFilter !== 'all' ? jonyColors.accent2Alpha : jonyColors.surface,
                      color: performanceFilter !== 'all' ? jonyColors.accent2 : jonyColors.textPrimary,
                      border: `1px solid ${performanceFilter !== 'all' ? jonyColors.accent2 : jonyColors.border}`,
                      outline: 'none'
                    }}
                  >
                    <option value="all">Alle Performance</option>
                    <option value="positive">Nur Gewinner</option>
                    <option value="negative">Nur Verlierer</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Sort Filter */}
                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-3 py-2 pr-8 rounded-lg text-sm font-medium cursor-pointer appearance-none transition-all duration-200 hover:shadow-sm"
                    style={{
                      backgroundColor: sortBy !== 'name' ? jonyColors.accent2Alpha : jonyColors.surface,
                      color: sortBy !== 'name' ? jonyColors.accent2 : jonyColors.textPrimary,
                      border: `1px solid ${sortBy !== 'name' ? jonyColors.accent2 : jonyColors.border}`,
                      outline: 'none'
                    }}
                  >
                    <option value="name">Nach Name</option>
                    <option value="value">Nach Wert</option>
                    <option value="performance">Nach Performance</option>
                    <option value="date">Nach Kaufdatum</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

              </div>
            </div>
            
            {filteredInvestments.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {filteredInvestments.map((investment, index) => {
                  const performance = getInvestmentPerformance(investment);
                  const isPositive = performance.change >= 0;
                  const changeColor = isPositive ? jonyColors.accent1 : jonyColors.magenta;
                  const isExpanded = expandedInvestment === investment.id;
                  
                  // Calculate portfolio percentage
                  const portfolioPercentage = investmentMetrics.totalValue > 0 
                    ? ((performance.currentValue / investmentMetrics.totalValue) * 100) 
                    : 0;
                  
                  return (
                    <div key={investment.id || index}>
                      {/* Investment Preview - Name, Money In, Performance */}
                      <div 
                        className="group flex items-center justify-between py-4 px-4 cursor-pointer transition-all duration-200 hover:bg-opacity-50 rounded-lg"
                        style={{
                          backgroundColor: isExpanded ? jonyColors.accent2Alpha : 'transparent'
                        }}
                        onClick={() => setExpandedInvestment(isExpanded ? null : investment.id)}
                      >
                        {/* Investment Name */}
                        <div className="flex-1">
                          <div className="text-base font-medium" style={{ color: jonyColors.textPrimary }}>
                            {investment.name}
                          </div>
                        </div>

                        {/* How much money you have in it (current value) */}
                        <div className="text-right mr-8">
                          <div className="text-lg font-semibold" style={{ color: jonyColors.textPrimary }}>
                            {formatCurrency(performance.currentValue)}
                          </div>
                          <div className="text-xs" style={{ color: jonyColors.textSecondary }}>
                            aktueller Wert
                          </div>
                        </div>

                        {/* Performance */}
                        <div className="text-right min-w-[100px]">
                          <div className="text-base font-medium" style={{ color: changeColor }}>
                            {formatPercentage(performance.changePercent)}
                          </div>
                          <div className="text-xs font-medium" style={{ color: changeColor }}>
                            {isPositive ? '+' : ''}{formatCurrency(performance.change)}
                          </div>
                        </div>
                      </div>

                      {/* Detail View - Focus on Key Investment Information */}
                      {isExpanded && (
                        <div className="mt-2 p-6 rounded-lg border" style={{
                          backgroundColor: jonyColors.cardBackground,
                          border: `1px solid ${jonyColors.cardBorder}`,
                          marginLeft: '16px'
                        }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            
                            {/* Header with Actions */}
                            <div className="flex items-center justify-between pb-4 border-b" style={{ borderColor: jonyColors.border }}>
                              <div>
                                <div className="text-lg font-semibold" style={{ color: jonyColors.textPrimary }}>
                                  {investment.name}
                                </div>
                                <div className="text-sm" style={{ color: jonyColors.textSecondary }}>
                                  WKN: {investment.wkn || 'Nicht verfügbar'}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingInvestment(investment);
                                  }}
                                  className="px-3 py-1.5 rounded transition-colors text-sm"
                                  style={{ 
                                    backgroundColor: jonyColors.accent2Alpha, 
                                    color: jonyColors.accent2
                                  }}
                                >
                                  Bearbeiten
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteInvestment(investment.id);
                                  }}
                                  className="px-3 py-1.5 rounded transition-colors text-sm"
                                  style={{ 
                                    backgroundColor: jonyColors.magentaAlpha, 
                                    color: jonyColors.magenta
                                  }}
                                >
                                  Löschen
                                </button>
                              </div>
                            </div>

                            {/* Purchase Information */}
                            <div>
                              <h4 className="text-base font-semibold mb-4" style={{ color: jonyColors.textPrimary }}>
                                Kauf-Information
                              </h4>
                              <div className="grid grid-cols-3 gap-6">
                                <div>
                                  <div className="text-sm font-medium mb-1" style={{ color: jonyColors.textSecondary }}>
                                    Kaufdatum
                                  </div>
                                  <div className="text-base font-semibold" style={{ color: jonyColors.textPrimary }}>
                                    {new Date(investment.purchaseDate).toLocaleDateString('de-DE')}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-sm font-medium mb-1" style={{ color: jonyColors.textSecondary }}>
                                    Investiertes Kapital
                                  </div>
                                  <div className="text-base font-semibold" style={{ color: jonyColors.textPrimary }}>
                                    {formatCurrency(performance.purchaseValue)}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-sm font-medium mb-1" style={{ color: jonyColors.textSecondary }}>
                                    Ø Kaufkurs
                                  </div>
                                  <div className="text-base font-semibold" style={{ color: jonyColors.textPrimary }}>
                                    {formatCurrency(parseFloat(investment.purchasePrice) || 0)}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Portfolio Context */}
                            <div>
                              <h4 className="text-base font-semibold mb-4" style={{ color: jonyColors.textPrimary }}>
                                Portfolio-Kontext
                              </h4>
                              <div className="grid grid-cols-3 gap-6">
                                <div>
                                  <div className="text-sm font-medium mb-1" style={{ color: jonyColors.textSecondary }}>
                                    Anteil am Portfolio
                                  </div>
                                  <div className="text-lg font-bold" style={{ color: jonyColors.accent2 }}>
                                    {portfolioPercentage.toFixed(1)}%
                                  </div>
                                </div>
                                <div>
                                  <div className="text-sm font-medium mb-1" style={{ color: jonyColors.textSecondary }}>
                                    Anzahl Anteile
                                  </div>
                                  <div className="text-lg font-bold" style={{ color: jonyColors.textPrimary }}>
                                    {investment.quantity}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-sm font-medium mb-1" style={{ color: jonyColors.textSecondary }}>
                                    Asset-Klasse
                                  </div>
                                  <div className="text-lg font-bold" style={{ color: jonyColors.textPrimary }}>
                                    {getTypeDisplayName(investment.type)}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Performance seit Investment */}
                            <div>
                              <h4 className="text-base font-semibold mb-4" style={{ color: jonyColors.textPrimary }}>
                                Performance seit Investment
                              </h4>
                              <div className="grid grid-cols-3 gap-6">
                                <div>
                                  <div className="text-sm font-medium mb-1" style={{ color: jonyColors.textSecondary }}>
                                    Aktueller Wert
                                  </div>
                                  <div className="text-xl font-bold" style={{ color: jonyColors.textPrimary }}>
                                    {formatCurrency(performance.currentValue)}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-sm font-medium mb-1" style={{ color: jonyColors.textSecondary }}>
                                    Gewinn/Verlust (€)
                                  </div>
                                  <div className="text-xl font-bold" style={{ color: changeColor }}>
                                    {isPositive ? '+' : ''}{formatCurrency(performance.change)}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-sm font-medium mb-1" style={{ color: jonyColors.textSecondary }}>
                                    Gesamtperformance (%)
                                  </div>
                                  <div className="text-xl font-bold" style={{ color: changeColor }}>
                                    {formatPercentage(performance.changePercent)}
                                  </div>
                                </div>
                              </div>
                            </div>

                          </div>
                        </div>
                      )}
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
                
                <div className="space-y-5">
                  {/* Investment Name */}
                  <div>
                    <input
                      type="text"
                      value={newInvestment.name}
                      onChange={(e) => setNewInvestment(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Name (z.B. Apple, MSCI World ETF)"
                      className="w-full px-4 py-3 rounded-xl text-base transition-all duration-200"
                      style={{
                        backgroundColor: jonyColors.cardBackground,
                        color: jonyColors.textPrimary,
                        border: `1px solid ${jonyColors.border}`,
                        outline: 'none'
                      }}
                    />
                  </div>

                  {/* WKN/ISIN */}
                  <div>
                    <input
                      type="text"
                      value={newInvestment.wkn}
                      onChange={(e) => handleWknChange(e.target.value)}
                      placeholder="WKN oder ISIN (z.B. A1JX52, US0378331005)"
                      className="w-full px-4 py-3 rounded-xl text-base transition-all duration-200"
                      style={{
                        backgroundColor: jonyColors.cardBackground,
                        color: jonyColors.textPrimary,
                        border: `1px solid ${jonyColors.border}`,
                        outline: 'none'
                      }}
                    />
                    <div className="text-xs mt-1 ml-1" style={{ color: jonyColors.textTertiary }}>
                      Für automatische Kursaktualisierung
                    </div>
                  </div>

                  {/* Purchase Date & Price */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <input
                        type="date"
                        value={newInvestment.purchaseDate}
                        onChange={(e) => setNewInvestment(prev => ({ ...prev, purchaseDate: e.target.value }))}
                        className="w-full px-4 py-3 rounded-xl text-base transition-all duration-200"
                        style={{
                          backgroundColor: jonyColors.cardBackground,
                          color: jonyColors.textPrimary,
                          border: `1px solid ${jonyColors.border}`,
                          outline: 'none'
                        }}
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        step="0.01"
                        value={newInvestment.purchasePrice}
                        onChange={(e) => setNewInvestment(prev => ({ ...prev, purchasePrice: e.target.value }))}
                        placeholder="Kaufpreis (€)"
                        className="w-full px-4 py-3 rounded-xl text-base transition-all duration-200"
                        style={{
                          backgroundColor: jonyColors.cardBackground,
                          color: jonyColors.textPrimary,
                          border: `1px solid ${jonyColors.border}`,
                          outline: 'none'
                        }}
                      />
                    </div>
                  </div>

                  {/* Quantity */}
                  <div>
                    <input
                      type="number"
                      step="0.001"
                      value={newInvestment.quantity}
                      onChange={(e) => setNewInvestment(prev => ({ ...prev, quantity: e.target.value }))}
                      placeholder="Anzahl Anteile (z.B. 10 oder 0.5)"
                      className="w-full px-4 py-3 rounded-xl text-base transition-all duration-200"
                      style={{
                        backgroundColor: jonyColors.cardBackground,
                        color: jonyColors.textPrimary,
                        border: `1px solid ${jonyColors.border}`,
                        outline: 'none'
                      }}
                    />
                  </div>

                  {/* Asset Type */}
                  <div>
                    <select
                      value={newInvestment.type}
                      onChange={(e) => setNewInvestment(prev => ({ ...prev, type: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl text-base transition-all duration-200"
                      style={{
                        backgroundColor: jonyColors.cardBackground,
                        color: jonyColors.textPrimary,
                        border: `1px solid ${jonyColors.border}`,
                        outline: 'none'
                      }}
                    >
                      <option value="stock">Aktien</option>
                      <option value="etf">ETFs</option>
                      <option value="bond">Anleihen</option>
                      <option value="crypto">Kryptowährungen</option>
                      <option value="reit">REITs</option>
                      <option value="commodity">Rohstoffe</option>
                      <option value="other">Sonstige</option>
                    </select>
                    <div className="text-xs mt-1 ml-1" style={{ color: jonyColors.textTertiary }}>
                      Wählen Sie die Asset-Klasse für Ihr Investment
                    </div>
                  </div>

                  {/* Region (Optional) */}
                  <div>
                    <select
                      value={newInvestment.region}
                      onChange={(e) => setNewInvestment(prev => ({ ...prev, region: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl text-base transition-all duration-200"
                      style={{
                        backgroundColor: jonyColors.cardBackground,
                        color: jonyColors.textPrimary,
                        border: `1px solid ${jonyColors.border}`,
                        outline: 'none'
                      }}
                    >
                      <option value="">Region automatisch bestimmen</option>
                      <option value="Europa">Europa</option>
                      <option value="Nordamerika">Nordamerika</option>
                      <option value="Asien">Asien</option>
                      <option value="Australien & Ozeanien">Australien & Ozeanien</option>
                      <option value="Lateinamerika">Lateinamerika</option>
                      <option value="Afrika & Naher Osten">Afrika & Naher Osten</option>
                      <option value="Global">Global</option>
                      <option value="Emerging Markets">Emerging Markets</option>
                    </select>
                    <div className="text-xs mt-1 ml-1" style={{ color: jonyColors.textTertiary }}>
                      Optional - falls automatische Bestimmung fehlschlägt
                    </div>
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
                    disabled={!newInvestment.name || !newInvestment.wkn || !newInvestment.purchasePrice || !newInvestment.quantity}
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
                      value={editingInvestment.region || 'Europa'}
                      onChange={(e) => setEditingInvestment(prev => ({ ...prev, region: e.target.value }))}
                      className="w-full px-4 py-3 border-2 rounded-xl text-base transition-all duration-200"
                      style={{
                        backgroundColor: jonyColors.cardBackground,
                        color: jonyColors.textPrimary,
                        borderColor: jonyColors.border,
                        outline: 'none'
                      }}
                    >
                      <option value="Nordamerika">Nordamerika</option>
                      <option value="Europa">Europa</option>
                      <option value="Asien">Asien</option>
                      <option value="Australien & Ozeanien">Australien & Ozeanien</option>
                      <option value="Lateinamerika">Lateinamerika</option>
                      <option value="Afrika & Naher Osten">Afrika & Naher Osten</option>
                      <option value="Global">Global</option>
                      <option value="Emerging Markets">Emerging Markets</option>
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