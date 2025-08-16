import React from 'react';

const Card = ({ children, className = '' }) => (
  // REDESIGN: A single, clean card style. Soft shadow, subtle border, generous padding.
  <div
    className={`
      bg-white 
      border border-slate-100 
      rounded-2xl 
      shadow-sm 
      p-6
      transition-all duration-300 hover:shadow-md
      ${className}
    `}
  >
    {children}
  </div>
);

export default Card;