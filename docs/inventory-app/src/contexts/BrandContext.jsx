import React, { createContext, useContext, useState, useCallback } from 'react';

const BrandContext = createContext(null);

export function BrandProvider({ children }) {
  const [brand, setBrandState] = useState(() => {
    try { return JSON.parse(localStorage.getItem('inv_brand')); } catch { return null; }
  });

  const setBrand = useCallback((brandData) => {
    if (brandData) {
      localStorage.setItem('inv_brand', JSON.stringify(brandData));
    } else {
      localStorage.removeItem('inv_brand');
    }
    setBrandState(brandData);
  }, []);

  return (
    <BrandContext.Provider value={{ brand, setBrand }}>
      {children}
    </BrandContext.Provider>
  );
}

export function useBrand() {
  const ctx = useContext(BrandContext);
  if (!ctx) throw new Error('useBrand must be used within BrandProvider');
  return ctx;
}
