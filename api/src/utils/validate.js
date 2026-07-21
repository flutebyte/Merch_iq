// Returns true if `value` is null/undefined (field not being set) or a finite,
// non-negative number. Used to reject negative prices/quantities that would
// otherwise silently corrupt inventory valuation, revenue, and dead-stock math.
function isNonNegativeNumber(value) {
  if (value === null || value === undefined) return true;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0;
}

module.exports = { isNonNegativeNumber };
