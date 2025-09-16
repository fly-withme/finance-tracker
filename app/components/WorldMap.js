import React from 'react';
import WorldMapSvg from 'react-svg-worldmap';

/**
 * WorldMap Komponente zur Visualisierung von regionalen Investment-Prozentsätzen.
 * @param {object[]} data - Array von Objekten mit { region: string, investmentPercentage: number }
 * @param {string} [backgroundColor='transparent'] - Hintergrundfarbe der SVG-Karte.
 * @param {string} [strokeColor='#D1D5DB'] - Farbe der Ländergrenzen.
 */
const WorldMap = ({ data, backgroundColor = 'transparent', strokeColor = '#D1D5DB' }) => {
  // Politische Regionen-Zuordnung nach EU/NATO/politischen Definitionen
  const regionCountryMapping = {
    'North America': ['us', 'ca', 'mx'],
    'Europe': [
      // EU-Mitglieder + EWR + Schweiz + UK + Balkan + Osteuropa (politisch)
      'al', 'ad', 'at', 'be', 'ba', 'bg', 'hr', 'cy', 'cz', 'dk', 'ee', 
      'fi', 'fr', 'de', 'gr', 'hu', 'is', 'ie', 'it', 'xk', 'lv', 'li', 
      'lt', 'lu', 'mt', 'md', 'mc', 'me', 'nl', 'mk', 'no', 'pl', 'pt', 'ro', 
      'sm', 'rs', 'sk', 'si', 'es', 'se', 'ch', 'gb',
      // Osteuropäische Länder (politisch Europa)
      'by', 'ua'
    ],
    'Asia': [
      // Asiatische Länder (ohne geografische Überschneidungen)
      'af', 'am', 'az', 'bh', 'bd', 'bt', 'bn', 'kh', 'cn', 'in', 
      'id', 'jp', 'kz', 'kw', 'kg', 'la', 'my', 'mv', 'mn', 'mm', 'np', 
      'kp', 'kr', 'om', 'pk', 'ph', 'qa', 'sa', 'sg', 'lk', 'tw', 'tj', 
      'th', 'tl', 'tm', 'uz', 'vn',
      // Politisch zu Asien gehörend
      'tr', 'ge', 'ru'
    ],
    'Australia & Oceania': [
      'au', 'nz', 'pg', 'fj', 'sb', 'vu', 'ws', 'to', 'tv', 'ki', 'nr', 'pw', 
      'mh', 'fm'
    ],
    'Latin America': [
      'ag', 'ar', 'bs', 'bb', 'bz', 'bo', 'br', 'cl', 'co', 'cr', 'cu', 'dm', 
      'do', 'ec', 'sv', 'gd', 'gt', 'gy', 'ht', 'hn', 'jm', 'ni', 'pa', 
      'py', 'pe', 'kn', 'lc', 'vc', 'sr', 'tt', 'uy', 've'
    ],
    'Africa & Middle East': [
      // Afrika
      'dz', 'ao', 'bj', 'bw', 'bf', 'bi', 'cm', 'cv', 'cf', 'td', 'km', 'cg', 
      'cd', 'dj', 'eg', 'gq', 'er', 'et', 'ga', 'gm', 'gh', 'gn', 'gw', 'ci', 
      'ke', 'ls', 'lr', 'ly', 'mg', 'mw', 'ml', 'mr', 'mu', 'ma', 'mz', 'na', 
      'ne', 'ng', 'rw', 'st', 'sn', 'sc', 'sl', 'so', 'za', 'ss', 'sd', 'sz', 
      'tz', 'tg', 'tn', 'ug', 'zm', 'zw',
      // Naher Osten (arabische Länder + Israel + Iran)
      'ae', 'ye', 'bh', 'jo', 'lb', 'iq', 'ir', 'il', 'ps', 'sy'
    ]
  };

  /**
   * Bestimmt die Füllfarbe basierend auf dem Investment-Prozentsatz mit Blau-zu-Pink Gradient.
   * @param {number} percentage - Der Investment-Prozentsatz (0-100).
   * @returns {string} - Die interpolierte Hex-Farbe.
   */
  const getColorForPercentage = (percentage) => {
    if (percentage <= 0) return '#F3F4F6'; // Sehr helles Grau für 0%
    
    // Blau zu Pink Gradient: #00d4ff (0%) → #ff41d4 (100%)
    const blueColor = { r: 0, g: 212, b: 255 };     // #00d4ff (Neon Cyan)
    const pinkColor = { r: 255, g: 65, b: 212 };    // #ff41d4 (Neon Magenta)
    
    // Normalisiere Prozentsatz auf 0-1
    const factor = Math.min(percentage / 100, 1);
    
    // Lineare Interpolation zwischen Blau und Pink
    const r = Math.round(blueColor.r + (pinkColor.r - blueColor.r) * factor);
    const g = Math.round(blueColor.g + (pinkColor.g - blueColor.g) * factor);
    const b = Math.round(blueColor.b + (pinkColor.b - blueColor.b) * factor);
    
    // Konvertiere zu Hex
    const toHex = (value) => Math.max(0, Math.min(255, value)).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };

  // Erstellt die Datenstruktur für die Weltkarte aus den regionalen Daten.
  const worldMapData = React.useMemo(() => {
    console.log('🗺️ WorldMap received data:', data);
    
    if (!data || data.length === 0) {
      console.log('❌ No data provided to WorldMap');
      // For debugging - add test data for North America with strong pink color
      console.log('🧪 Adding test data for debugging');
      const testData = [
        { country: 'us', value: 100, color: getColorForPercentage(100) },
        { country: 'ca', value: 100, color: getColorForPercentage(100) },
        { country: 'mx', value: 100, color: getColorForPercentage(100) },
        { country: 'de', value: 50, color: getColorForPercentage(50) },
        { country: 'fr', value: 50, color: getColorForPercentage(50) },
        { country: 'gb', value: 50, color: getColorForPercentage(50) },
        { country: 'cn', value: 25, color: getColorForPercentage(25) },
        { country: 'jp', value: 25, color: getColorForPercentage(25) },
        { country: 'au', value: 10, color: getColorForPercentage(10) },
        { country: 'br', value: 75, color: getColorForPercentage(75) }
      ];
      console.log('🧪 Test data with colors:', testData);
      return testData;
    }

    const mapData = [];
    data.forEach(({ region, investmentPercentage }) => {
      const countryCodes = regionCountryMapping[region] || [];
      const color = getColorForPercentage(investmentPercentage);
      
      console.log(`🌍 Processing ${region}: ${investmentPercentage}% → Color: ${color}`);
      console.log(`🏳️ Country codes for ${region}:`, countryCodes);
      
      countryCodes.forEach(countryCode => {
        const gradientColor = getColorForPercentage(investmentPercentage);
        mapData.push({
          country: countryCode,
          value: investmentPercentage,
          color: gradientColor
        });
      });
    });
    
    console.log('📊 Generated worldMapData:', mapData);
    console.log(`🔢 Total countries in data: ${mapData.length}`);
    
    return mapData;
  }, [data]);

  // Tooltip-Funktion für Länder-Hover mit Gradient-Logik
  const tooltipFunction = (context) => {
    const countryCode = context.country;
    const countryData = worldMapData.find(d => d.country === countryCode);
    
    if (countryData && countryData.value > 0) {
      const percentage = countryData.value;
      let riskLevel = '';
      
      if (percentage >= 75) riskLevel = 'Kritisch';
      else if (percentage >= 50) riskLevel = 'Hoch';
      else if (percentage >= 25) riskLevel = 'Moderat';
      else riskLevel = 'Optimal';
      
      // Find the region name for this country
      let regionName = '';
      for (const [region, countries] of Object.entries(regionCountryMapping)) {
        if (countries.includes(countryCode)) {
          regionName = region;
          break;
        }
      }
      
      return `${regionName}: ${percentage.toFixed(1)}% des Portfolios • ${riskLevel}`;
    }
    return '';
  };

  // Style-Funktion um unsere benutzerdefinierten Gradient-Farben zu forcieren
  const styleFunction = ({ country, countryValue, color, minValue, maxValue }) => {
    console.log(`🎨 StyleFunction called for: ${country}, countryValue: ${countryValue}`);
    
    // Verwende countryValue direkt von der Bibliothek
    if (countryValue && countryValue > 0) {
      const gradientColor = getColorForPercentage(countryValue);
      console.log(`✅ Country ${country} with ${countryValue}% gets color: ${gradientColor}`);
      
      return {
        fill: gradientColor,
        fillOpacity: 0.9,
        stroke: 'rgba(255, 255, 255, 0.1)',
        strokeWidth: 0.5,
        cursor: 'pointer'
      };
    }
    
    // Default style für Länder ohne Daten
    return {
      fill: 'rgba(255, 255, 255, 0.05)',
      fillOpacity: 0.3,
      stroke: 'rgba(255, 255, 255, 0.1)',
      strokeWidth: 0.3
    };
  };

  return (
    <div className="w-full h-full flex items-center justify-center">
      {/* Optimale Skalierung für 26rem Container (416px) */}
      <div style={{ 
        width: '100%', 
        height: '100%',
        transform: 'scale(1.134) translate(16px, -16px)',
        transformOrigin: 'center center',
        maxWidth: '100%',
        maxHeight: '100%'
      }}>
        <WorldMapSvg
          backgroundColor={backgroundColor}
          data={worldMapData}
          color="#ff41d4"
          title=""
          size="xl"
          borderColor="transparent"
          styleFunction={styleFunction}
          tooltipFunction={tooltipFunction}
          tooltipBgColor="rgba(26, 26, 28, 0.95)"
          tooltipTextColor="#ffffff"
          richInteraction={true}
        />
      </div>
    </div>
  );
};

export default WorldMap;