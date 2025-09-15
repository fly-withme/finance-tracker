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
   * Bestimmt die Füllfarbe basierend auf dem Investment-Prozentsatz.
   * @param {number} percentage - Der Investment-Prozentsatz.
   * @returns {string} - Die Hex-Farbe.
   */
  const getColorForPercentage = (percentage) => {
    if (percentage >= 75) return '#C71585'; // Deep Magenta
    if (percentage >= 50) return '#FF1493'; // Deep Pink
    if (percentage >= 25) return '#FF69B4'; // Hot Pink
    if (percentage > 0) return '#FFB6C1';   // Light Pink
    return '#F3F4F6'; // Sehr helles Grau für 0%
  };

  // Erstellt die Datenstruktur für die Weltkarte aus den regionalen Daten.
  const worldMapData = React.useMemo(() => {
    if (!data || data.length === 0) return [];

    const mapData = [];
    data.forEach(({ region, investmentPercentage }) => {
      const countryCodes = regionCountryMapping[region] || [];
      const color = getColorForPercentage(investmentPercentage);
      
      countryCodes.forEach(countryCode => {
        mapData.push({
          country: countryCode,
          value: investmentPercentage, // value wird für Tooltip und Styling verwendet
          region: region,
          color: color,
        });
      });
    });
    return mapData;
  }, [data]);

  // Benutzerdefinierte Styling-Funktion nach react-svg-worldmap Spezifikation
  const styleFunction = ({ country, countryValue, color, minValue, maxValue }) => {
    // Debug-Ausgabe um die Parameter zu verstehen
    console.log('StyleFunction called with:', { country, countryValue, color, minValue, maxValue });
    
    // Finde die Daten für dieses Land in unserem worldMapData
    const countryData = worldMapData.find(d => d.country === country);

    if (countryData && countryData.value > 0) {
      const percentage = countryData.value;
      
      // Berechne Deckkraft basierend auf Prozentsatz
      let fillOpacity = 0.5;
      if (percentage >= 75) fillOpacity = 1.0;
      else if (percentage >= 50) fillOpacity = 0.9;
      else if (percentage >= 25) fillOpacity = 0.7;
      else if (percentage > 0) fillOpacity = 0.6;

      return {
        fill: countryData.color, // Verwende unsere berechnete Farbe
        fillOpacity: fillOpacity,
        stroke: strokeColor,
        strokeWidth: 0.8,
        cursor: 'pointer',
        transition: 'all 0.3s ease',
      };
    }

    // Fallback für Länder ohne Daten oder 0%
    return {
      fill: '#F9FAFB',
      fillOpacity: 0.1,
      stroke: strokeColor,
      strokeWidth: 0.3,
      cursor: 'default',
    };
  };
  
  // Benutzerdefinierte Tooltip-Funktion beim Hovern.
  const tooltipFunction = (context) => {
    const countryCode = context.country;
    const countryData = worldMapData.find(d => d.country === countryCode);
    if (countryData && countryData.value > 0) {
      return `${countryData.region}: ${countryData.value.toFixed(1)}% des Portfolios`;
    }
    return ''; // Kein Tooltip für 0%-Regionen
  };


  return (
    <div className="w-full h-full flex items-center justify-center">
      {/* Skalierung, um die Karte etwas größer und zentrierter darzustellen */}
      <div style={{ width: '100%', height: '100%' }}>
        <WorldMapSvg
          backgroundColor={backgroundColor}
          data={worldMapData} // ✅ KORREKT - Echte Daten übergeben
          styleFunction={styleFunction}
          tooltipFunction={tooltipFunction}
          richInteraction
        />
      </div>
    </div>
  );
};

export default WorldMap;