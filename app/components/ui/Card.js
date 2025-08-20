import React from 'react';

const Card = ({ children, className = '' }) => (
  // REDESIGN: A single, clean card style. Soft shadow, subtle border, generous padding.
  <div
    className={`
      bg-white dark:bg-slate-800
      border border-slate-200 dark:border-slate-700
      rounded-2xl 
      shadow-sm dark:shadow-slate-900/50
      p-6
      transition-all duration-300 hover:shadow-md dark:hover:shadow-slate-900/60
      ${className}
    `}
  >
    {children}
  </div>
);

export default Card;