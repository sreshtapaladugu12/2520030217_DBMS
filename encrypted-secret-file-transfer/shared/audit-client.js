// Fire-and-log helper used by services to send events to the Audit Service.
// Fail-open by design: if the audit service is down, the user's action still works
// and a warning is printed (documented trade-off in docs/security.md).
const { callService } = require('./http');

async function logEvent(entry) {
  try {
    const r = await callService('audit', `${process.env.AUDIT_SERVICE_URL}/internal/logs`, {
      method: 'POST', body: entry, internal: true, timeoutMs: 3000
    });
    if (!r.ok) console.warn('[audit-client] audit service rejected event');
    return r.ok;
  } catch (e) {
    console.warn('[audit-client] audit service unavailable - event not recorded:', entry.action);
    return false;
  }
}

module.exports = { logEvent };
