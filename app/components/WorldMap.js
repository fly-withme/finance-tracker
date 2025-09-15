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
          value: investmentPercentage,
          region: region,
          color: color,
        });
      });
    });
    
    return mapData;
  }, [data]);

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
          color="#FF1493"
          title=""
          size="xl"
          borderColor="transparent"
        />
      </div>
    </div>
  );
};

export default WorldMap;