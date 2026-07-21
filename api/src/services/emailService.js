// Minimal email-sending abstraction. No SMTP/provider is wired up yet — when
// EMAIL_PROVIDER is unset (the default for local dev and this environment),
// messages are logged instead of sent so the reset flow is still usable and
// testable end-to-end. Swap the else-branch for a real provider (SES, Postgrid,
// Resend, etc.) when one is configured.

async function sendPasswordResetEmail({ to, resetUrl }) {
  if (process.env.EMAIL_PROVIDER) {
    throw new Error(`EMAIL_PROVIDER "${process.env.EMAIL_PROVIDER}" is not implemented yet`);
  }

  console.log(`[email:dev-mode] Password reset requested for ${to}`);
  console.log(`[email:dev-mode] Reset link: ${resetUrl}`);
}

module.exports = { sendPasswordResetEmail };
