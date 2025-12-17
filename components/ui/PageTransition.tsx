import React from 'react';

const PageTransition: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="animate-fade-in-up">
      {children}
    </div>
  );
};

export default PageTransition;