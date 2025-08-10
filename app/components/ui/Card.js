import React from 'react';

const Card = ({ children, className = '' }) => (
  <div className={`bg-gray-900/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl shadow-lg ${className}`}>
    {children}
  </div>
);

export default Card;