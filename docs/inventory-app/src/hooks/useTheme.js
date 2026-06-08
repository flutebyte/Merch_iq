import { useState, useCallback } from 'react';

export function useTheme() {
  const [theme, setThemeState] = useState(() => localStorage.getItem('inv_theme') || 'dark');

  const setTheme = useCallback((t) => {
    localStorage.setItem('inv_theme', t);
    setThemeState(t);
    if (t === 'system') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', t);
    }
  }, []);

  return { theme, setTheme };
}
