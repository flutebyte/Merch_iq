import { useState } from 'react';

// Reads/writes a user preference stored in localStorage under `inv_pref_${key}`.
// Shared so that screens which write a preference (Settings) and screens which
// need to honor it (Dashboard, etc.) always agree on the storage key and shape.
export function useLocalPref(key, defaultVal) {
  const [val, setVal] = useState(() => {
    try {
      const s = localStorage.getItem(`inv_pref_${key}`);
      return s !== null ? JSON.parse(s) : defaultVal;
    } catch { return defaultVal; }
  });
  const save = (v) => {
    setVal(v);
    localStorage.setItem(`inv_pref_${key}`, JSON.stringify(v));
  };
  return [val, save];
}
