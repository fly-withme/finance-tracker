import React from 'react';

const CustomTooltip = ({ active, payload, label, currency = '€' }) => {
  if (active && payload && payload.length) {
    return (
      <div className="p-4 bg-gray-800 border border-gray-600 rounded-xl shadow-lg">
        <p className="font-bold text-lg text-white mb-2">{label || payload[0].payload.name}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color || '#71717A' }}>
            {`${p.name}: ${p.value.toLocaleString('en-US', { style: 'currency', currency: 'EUR' })}`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default CustomTooltip;