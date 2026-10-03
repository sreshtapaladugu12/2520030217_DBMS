export function formatBytes(n) {
  if (n == null) return '-';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}
export const formatDate = (d) => (d ? new Date(d).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '-');
export const fileType = (name = '') => (name.includes('.') ? name.split('.').pop().toUpperCase() : 'FILE');

export const ACTION_LABELS = {
  REGISTER: 'Registered', LOGIN: 'Login', LOGIN_FAILED: 'Failed login', UPLOAD: 'Upload', DOWNLOAD: 'Download',
  DOWNLOAD_DENIED: 'Download denied', SHARE: 'Shared', REVOKE: 'Access revoked', DELETE: 'Deleted', ADMIN_ACTION: 'Admin action'
};
export const actionTone = (a, status) => {
  if (status === 'denied' || status === 'failed') return 'red';
  return { UPLOAD: 'blue', DOWNLOAD: 'green', SHARE: 'purple', REVOKE: 'amber', DELETE: 'red', LOGIN: 'gray', REGISTER: 'gray', ADMIN_ACTION: 'amber' }[a] || 'gray';
};
