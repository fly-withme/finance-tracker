import React from 'react';

const PageHeader = ({ title, children }) => (
  <div className="flex items-center justify-between mb-8">
    <h2 className="text-3xl font-bold text-white">{title}</h2>
    <div>{children}</div>
  </div>
);

export default PageHeader;