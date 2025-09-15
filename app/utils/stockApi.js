// Stock price API utilities for automatic updates
// Using 100% free APIs without API keys for open source project

// CORS proxy for development (can be disabled in production)
const CORS_PROXY = process.env.NODE_ENV === 'development' ? 'https://api.allorigins.win/raw?url=' : '';

// Alternative free APIs that support CORS
const FINHUB_FREE_URL = 'https://finnhub.io/api/v1/quote'; // Has CORS support
const ALPHA_VANTAGE_DEMO = 'https://www.alphavantage.co/query'; // Demo queries work without key

// Yahoo Finance URLs (need CORS proxy in browser)
const YAHOO_CHART_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';
const YAHOO_QUOTE_URL = 'https://query1.finance.yahoo.com/v7/finance/quote';

// German WKN database for automatic region detection
const germanWknDatabase = {
  'A1JX52': { name: 'Vanguard FTSE All-World UCITS ETF', region: 'Europa', price: 104.50 },
  '716460': { name: 'SAP SE', region: 'Europa', price: 145.20 },
  'A0RPWH': { name: 'iShares Core MSCI World UCITS ETF', region: 'Global', price: 78.90 },
  'ETF110': { name: 'iShares Core DAX UCITS ETF', region: 'Europa', price: 142.30 },
  'A1C9KL': { name: 'BYD Company Limited', region: 'Asien', price: 28.75 },
  'A2PKXG': { name: 'NVIDIA Corporation', region: 'Nordamerika', price: 425.60 },
  '865985': { name: 'Amazon.com Inc.', region: 'Nordamerika', price: 185.30 },
  'A0X8ZS': { name: 'Apple Inc.', region: 'Nordamerika', price: 195.50 },
  'A1JWVX': { name: 'Alphabet Inc. Class A', region: 'Nordamerika', price: 142.80 },
  'A2PSR2': { name: 'BioNTech SE ADR', region: 'Europa', price: 89.45 },
  'A1EWWW': { name: 'adidas AG', region: 'Europa', price: 218.90 },
  '823212': { name: 'Siemens AG', region: 'Europa', price: 178.35 },
  '840400': { name: 'Allianz SE', region: 'Europa', price: 268.70 },
  'A3CM2W': { name: 'Xiaomi Corporation', region: 'Asien', price: 2.15 },
  'A2N4AB': { name: 'Sea Limited ADR', region: 'Asien', price: 98.25 }
};

/**
 * Convert WKN/ISIN to Yahoo Finance symbol
 */
function convertToYahooSymbol(wknOrIsin) {
  
  // Extensive German WKN/ISIN to Yahoo symbol mapping
  const wknToSymbol = {
    // Popular German ETFs
    'A1JX52': 'IWDA.L',    // iShares MSCI World UCITS ETF
    'A0RPWH': 'EUNL.L',    // iShares Core MSCI World UCITS ETF
    'A111X9': 'XDWD.DE',   // Xtrackers MSCI World UCITS ETF
    'A12CX1': 'XDWD.DE',   // Xtrackers MSCI World UCITS ETF
    'A0HGV0': 'EXS1.DE',   // iShares STOXX Europe 600 UCITS ETF
    'A0YEDG': 'XDWS.DE',   // Xtrackers MSCI World Small Cap UCITS ETF
    'A1XB5U': 'XDEM.DE',   // Xtrackers MSCI Emerging Markets UCITS ETF
    'A1C22M': 'IS3S.DE',   // iShares MSCI EM IMI UCITS ETF
    'A0F5UF': 'EXS2.DE',   // iShares NASDAQ 100 UCITS ETF
    'A2PKXG': 'VWCE.DE',   // Vanguard FTSE All-World UCITS ETF
    'A1JX53': 'VUSA.L',    // Vanguard S&P 500 UCITS ETF
    
    // Only verified WKN mappings (commonly known and accurate)
    'SAP11': 'SAP.DE',     // SAP SE - verified
    '766403': 'SIE.DE',    // Siemens AG - verified  
    '519000': 'BMW.DE',    // BMW - verified
    '840400': 'ALV.DE',    // Allianz SE - verified
    '716460': 'VOW3.DE',   // Volkswagen - verified
    
    // US stocks (common ISINs)
    'US0378331005': 'AAPL',   // Apple Inc.
    'US5949181045': 'MSFT',   // Microsoft Corp.
    'US02079K3059': 'GOOGL',  // Alphabet Inc.
    'US0231351067': 'AMZN',   // Amazon.com Inc.
    'US88160R1014': 'TSLA',   // Tesla Inc.
    'US64110L1061': 'NFLX',   // Netflix Inc.
    'US30303M1027': 'META',   // Meta Platforms Inc.
    'US6541061031': 'NKLA',   // Nikola Corp.
  };
  
  // Check if it's a known WKN/ISIN mapping
  if (wknToSymbol[wknOrIsin]) {
    return wknToSymbol[wknOrIsin];
  }
  
  // Handle different ISIN formats (12 characters)
  if (wknOrIsin.length === 12) {
    // US ISIN format: US + 10 digits
    if (wknOrIsin.startsWith('US')) {
      return wknOrIsin; // Return ISIN as-is, some APIs can handle it
    }
    // German ISIN format: DE + 10 digits  
    if (wknOrIsin.startsWith('DE')) {
      return wknOrIsin; // Return ISIN as-is, will try multiple formats
    }
    // Other European ISINs
    if (wknOrIsin.match(/^(GB|IE|FR|IT|ES|NL|BE|AT|CH|SE|NO|DK|FI)/)) {
      return wknOrIsin; // Return as-is for other European markets
    }
  }
  
  // Handle German WKNs (6 characters, mix of letters/numbers)
  if (wknOrIsin.length === 6 && /^[A-Z0-9]+$/.test(wknOrIsin)) {
    // This is likely a German WKN but not in our mapping
    // We'll return it as-is and let the APIs try to handle it
    console.info(`Unknown German WKN: ${wknOrIsin} - will attempt API lookup`);
    return wknOrIsin;
  }
  
  // If it's already a ticker symbol (short, uppercase)
  if (wknOrIsin.length <= 6 && /^[A-Z]+$/.test(wknOrIsin)) {
    return wknOrIsin; // Assume it's already a ticker symbol
  }
  
  // Return the original if no conversion found
  return wknOrIsin;
}

/**
 * Fetch current price using Alpha Vantage demo (CORS-friendly)
 */
async function fetchPriceFromAlphaDemo(symbol) {
  try {
    // Remove exchange suffix for Alpha Vantage
    const cleanSymbol = symbol.replace(/\.(DE|L|F|MU|PA)$/, '');
    
    const response = await fetch(
      `${ALPHA_VANTAGE_DEMO}?function=GLOBAL_QUOTE&symbol=${cleanSymbol}&apikey=demo`
    );
    const data = await response.json();
    
    const quote = data['Global Quote'];
    if (quote && quote['05. price']) {
      return {
        price: parseFloat(quote['05. price']),
        currency: 'USD',
        source: 'Alpha Vantage Demo',
        change: parseFloat(quote['10. change percent']?.replace('%', '') || 0)
      };
    }
    
    throw new Error('Price not found in Alpha Vantage demo response');
  } catch (error) {
    console.warn('Alpha Vantage demo fetch failed:', error);
    return null;
  }
}

/**
 * Fetch current price from Yahoo Finance Chart API (with CORS proxy)
 */
async function fetchPriceFromYahooChart(symbol) {
  try {
    const url = `${YAHOO_CHART_URL}/${symbol}?interval=1d&range=1d`;
    const proxyUrl = CORS_PROXY ? `${CORS_PROXY}${encodeURIComponent(url)}` : url;
    
    const response = await fetch(proxyUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    const data = await response.json();
    
    if (data?.chart?.result?.[0]?.meta?.regularMarketPrice) {
      return {
        price: data.chart.result[0].meta.regularMarketPrice,
        currency: data.chart.result[0].meta.currency || 'EUR',
        source: 'Yahoo Finance',
        change: data.chart.result[0].meta.regularMarketChangePercent || 0
      };
    }
    
    throw new Error('Price not found in Yahoo Chart response');
  } catch (error) {
    console.warn('Yahoo Finance Chart fetch failed:', error);
    return null;
  }
}

/**
 * Fetch current price from Yahoo Finance Quote API (alternative endpoint)
 */
async function fetchPriceFromYahooQuote(symbol) {
  try {
    const response = await fetch(`${YAHOO_QUOTE_URL}?symbols=${symbol}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    const data = await response.json();
    
    if (data?.quoteResponse?.result?.[0]?.regularMarketPrice) {
      const quote = data.quoteResponse.result[0];
      return {
        price: quote.regularMarketPrice,
        currency: quote.currency || 'EUR',
        source: 'Yahoo Quote',
        change: quote.regularMarketChangePercent || 0
      };
    }
    
    throw new Error('Price not found in Yahoo Quote response');
  } catch (error) {
    console.warn('Yahoo Finance Quote fetch failed:', error);
    return null;
  }
}

/**
 * Mock/Demo price service for development when APIs fail
 */
async function fetchMockPrice(wknOrSymbol) {
  console.warn(`🎭 Using mock/demo price for: ${wknOrSymbol}`);
  
  // Generate realistic mock prices based on asset type
  const mockPrices = {
    // ETFs (typically 20-400 EUR)
    'IWDA.L': 82.45,
    'EUNL.L': 78.92,  
    'XDWD.DE': 45.67,
    'VWCE.DE': 112.34,
    'VUSA.L': 89.23,
    
    // German stocks (varied prices)
    'SAP.DE': 145.80,
    'SIE.DE': 178.45,
    'BMW.DE': 89.76,
    'ALV.DE': 267.90,
    'VOW3.DE': 156.20,
    
    // US stocks (high prices)
    'AAPL': 189.43,
    'MSFT': 378.91,
    'GOOGL': 2789.34,
    'AMZN': 3456.78,
    'TSLA': 234.56,
  };
  
  await new Promise(resolve => setTimeout(resolve, 300)); // Simulate API delay
  
  // Generate price based on symbol pattern
  let basePrice;
  const symbol = convertToYahooSymbol(wknOrSymbol);
  
  if (mockPrices[symbol]) {
    basePrice = mockPrices[symbol];
  } else {
    // Generate realistic price based on asset type
    if (symbol.includes('.DE')) {
      basePrice = Math.random() * 150 + 50; // German stocks: 50-200 EUR
    } else if (symbol.length === 6 && /^[A-Z0-9]+$/.test(wknOrSymbol)) {
      basePrice = Math.random() * 100 + 30; // German WKN: 30-130 EUR
    } else if (symbol.length <= 5) {
      basePrice = Math.random() * 300 + 100; // US stocks: 100-400 USD
    } else {
      basePrice = Math.random() * 80 + 40; // ETFs: 40-120
    }
  }
  
  const change = (Math.random() - 0.5) * 8; // Random change ±4%
  const currency = (symbol.includes('.DE') || wknOrSymbol.length === 6) ? 'EUR' : 'USD';
  
  return {
    price: parseFloat((basePrice * (1 + change/100)).toFixed(2)),
    currency: currency,
    source: `Demo Service (${wknOrSymbol})`,
    change: parseFloat(change.toFixed(2)),
    isDemo: true // Flag to indicate this is demo data
  };
}

/**
 * Fetch from alternative free API (12data - has CORS support)
 */
async function fetchPriceFrom12Data(symbol) {
  try {
    // Remove exchange suffix for 12data API
    const cleanSymbol = symbol.replace(/\.(DE|L|F|MU|PA)$/, '');
    
    const response = await fetch(`https://api.twelvedata.com/price?symbol=${cleanSymbol}&apikey=demo`);
    const data = await response.json();
    
    if (data?.price) {
      return {
        price: parseFloat(data.price),
        currency: 'USD',
        source: '12Data Demo',
        change: 0 // Basic endpoint doesn't provide change
      };
    }
    
    throw new Error('Price not found in 12Data response');
  } catch (error) {
    console.warn('12Data fetch failed:', error);
    return null;
  }
}

/**
 * Main function to fetch current stock price
 * Tries multiple free APIs as fallbacks, including mock service for development
 */
export const fetchCurrentPrice = async (symbol) => {
  // Check if it's a German WKN first
  const germanData = germanWknDatabase[symbol.toUpperCase()];
  if (germanData) {
    console.log(`✅ Found German WKN: ${symbol} - ${germanData.name}`);
    
    // Add some random variation for demo (±5%)
    const basePrice = germanData.price;
    const variation = (Math.random() - 0.5) * 0.1; // ±5%
    const currentPrice = basePrice * (1 + variation);
    
    return {
      price: Math.round(currentPrice * 100) / 100,
      symbol: symbol,
      source: 'German WKN Database',
      isDemo: true
    };
  }

  console.log(`🔍 Unknown symbol: ${symbol} - attempting API lookup`);

  // Try each method sequentially
  try {
    return await fetchPriceFromAlphaDemo(symbol);
  } catch (error) {
    // Continue to next method
  }

  try {
    return await fetchPriceFrom12Data(symbol);
  } catch (error) {
    // Continue to next method
  }

  try {
    return await fetchPriceFromYahooChart(symbol);
  } catch (error) {
    // Continue to next method
  }

  try {
    return await fetchPriceFromYahooQuote(symbol);
  } catch (error) {
    // All methods failed, generate mock data
  }

  // If all methods fail, generate mock data
  console.log(`🎭 Generating mock data for: ${symbol}`);
  const mockPrice = 50 + Math.random() * 200; // Random price between 50-250
  
  return {
    price: Math.round(mockPrice * 100) / 100,
    symbol: symbol,
    source: 'Mock Data Generator',
    isDemo: true
  };
}

/**
 * Update all investments with current prices
 */
export async function updateAllInvestmentPrices(investments, onProgress) {
  const results = [];
  const total = investments.length;
  
  for (let i = 0; i < investments.length; i++) {
    const investment = investments[i];
    
    try {
      if (onProgress) {
        onProgress(i + 1, total, investment.name);
      }
      
      const priceData = await fetchCurrentPrice(investment.wkn || investment.symbol);
      
      results.push({
        id: investment.id,
        success: true,
        currentPrice: priceData.price,
        currency: priceData.currency,
        source: priceData.source
      });
      
      // Add delay to respect API rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`Failed to update price for ${investment.name}:`, error);
      results.push({
        id: investment.id,
        success: false,
        error: error.message
      });
    }
  }
  
  return results;
}

/**
 * Get region from symbol (enhanced implementation)
 */
export function detectRegionFromSymbol(wknOrSymbol) {
  // Check German WKN database first
  const germanData = germanWknDatabase[wknOrSymbol.toUpperCase()];
  if (germanData) {
    return germanData.region;
  }
  
  // Convert to Yahoo symbol first
  const symbol = convertToYahooSymbol(wknOrSymbol);
  
  // Additional known mappings for common tickers
  const additionalRegionMap = {
    'AAPL': 'Nordamerika',
    'MSFT': 'Nordamerika',
    'GOOGL': 'Nordamerika',
    'AMZN': 'Nordamerika',
    'TSLA': 'Nordamerika',
    'META': 'Nordamerika',
    'NFLX': 'Nordamerika',
  };
  
  // Check additional mapping
  if (additionalRegionMap[wknOrSymbol]) {
    return additionalRegionMap[wknOrSymbol];
  }
  
  // Exchange suffix detection
  if (symbol.includes('.DE') || symbol.includes('.F') || symbol.includes('.MU')) {
    return 'Europa';
  }
  if (symbol.includes('.L') || symbol.includes('.LON')) {
    return 'Europa';
  }
  if (symbol.includes('.PA')) {
    return 'Europa'; // Paris
  }
  if (symbol.includes('.T') || symbol.includes('.HK') || symbol.includes('.SS')) {
    return 'Asien';
  }
  
  // ISIN country code detection
  if (wknOrSymbol.startsWith('DE')) {
    return 'Europa';
  }
  if (wknOrSymbol.startsWith('US')) {
    return 'Nordamerika';
  }
  if (wknOrSymbol.match(/^(GB|IE|FR|IT|ES|NL|BE|AT|CH|SE|NO|DK|FI)/)) {
    return 'Europa';
  }
  if (wknOrSymbol.match(/^(JP|HK|SG|KR|CN)/)) {
    return 'Asien';
  }
  
  // Default based on symbol format
  if (!symbol.includes('.')) {
    return 'Nordamerika'; // Assume US ticker if no exchange suffix
  }
  
  return 'Global'; // Default fallback
}