// Exponential backoff retry for rate-limited API calls (Amazon SP-API, Myntra MMIP)
async function withRetry(fn, { maxAttempts = 3, baseDelayMs = 1000, label = 'request' } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const isRateLimit = err.status === 429 || err.statusCode === 429 || err.code === 'RATE_LIMITED';
      if (!isRateLimit || attempt === maxAttempts) throw err;
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      console.warn(`[retryUtil] ${label} rate-limited, attempt ${attempt}/${maxAttempts}, retrying in ${delay}ms`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastError;
}

module.exports = { withRetry };
