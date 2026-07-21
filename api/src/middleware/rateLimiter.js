const rateLimit = require('express-rate-limit');

// OWASP guidance: authentication endpoints need stricter, dedicated limits —
// separate from general API rate limiting — since they're the target of
// credential stuffing and brute-force attacks. Counted per-IP; a captcha or
// per-account lockout would add defense-in-depth but isn't in scope here.
// https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
function createLoginLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts. Please wait a few minutes and try again.' },
    skipSuccessfulRequests: true,
  });
}

function createSignupLimiter() {
  return rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many accounts created from this network. Please try again later.' },
  });
}

module.exports = {
  loginLimiter: createLoginLimiter(),
  signupLimiter: createSignupLimiter(),
  createLoginLimiter,
  createSignupLimiter,
};
