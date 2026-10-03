const { callService, HttpError } = require('../../../shared/http');

const base = () => process.env.PERMISSION_SERVICE_URL;

// Returns 'download' | 'view' | null. Fails CLOSED: if the permission service cannot be reached
// the request is rejected (502) rather than allowing access.
async function sharedLevel(fileId, userId) {
  const r = await callService('permission', `${base()}/internal/check?fileId=${fileId}&userId=${userId}`, { internal: true });
  if (!r.ok) throw new HttpError(502, 'permission service is unavailable', { service: 'permission' });
  return r.data.allowed ? r.data.level : null;
}

async function sharedFileIds(userId) {
  const r = await callService('permission', `${base()}/internal/shared/${userId}`, { internal: true });
  if (!r.ok) throw new HttpError(502, 'permission service is unavailable', { service: 'permission' });
  return r.data.shares; // [{ fileId, level }]
}

async function sharesForFiles(fileIds) {
  if (!fileIds.length) return {};
  const r = await callService('permission', `${base()}/internal/file-shares?fileIds=${fileIds.join(',')}`, { internal: true });
  if (!r.ok) throw new HttpError(502, 'permission service is unavailable', { service: 'permission' });
  return r.data.shares;
}

const revokeAllForFile = (fileId, actor) =>
  callService('permission', `${base()}/internal/file/${fileId}`, { method: 'DELETE', internal: true, body: actor }).catch(() => null);

module.exports = { sharedLevel, sharedFileIds, sharesForFiles, revokeAllForFile };
