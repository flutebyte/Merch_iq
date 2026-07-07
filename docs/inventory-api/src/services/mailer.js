// Password-reset delivery. No ESP is wired up yet (see render.yaml note on
// integration credentials being set in the Render dashboard) — until one is,
// the link is written to the server log so ops can retrieve it, and echoed
// back in the API response outside production so the flow is testable
// end-to-end without real email infra.
function sendPasswordResetEmail(email, resetUrl) {
  console.log(`[mailer] Password reset requested for ${email}: ${resetUrl}`);
}

module.exports = { sendPasswordResetEmail };
