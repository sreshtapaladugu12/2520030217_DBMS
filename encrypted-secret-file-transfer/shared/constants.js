// Constants shared by every service.
const ACTIONS = [
  'REGISTER', 'LOGIN', 'LOGIN_FAILED', 'UPLOAD', 'DOWNLOAD', 'DOWNLOAD_DENIED',
  'SHARE', 'REVOKE', 'DELETE', 'ADMIN_ACTION'
];

const ROLES = ['user', 'admin'];
const PERMISSION_LEVELS = ['view', 'download'];

// Only these extensions may be uploaded (simple allow-list validation).
const ALLOWED_EXTENSIONS = [
  '.txt', '.md', '.csv', '.json', '.pdf', '.png', '.jpg', '.jpeg', '.gif',
  '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.zip'
];

// MIME types we are happy to echo back on download; anything else -> octet-stream.
const SAFE_DOWNLOAD_MIME = [
  'text/plain', 'text/markdown', 'text/csv', 'application/json', 'application/pdf',
  'image/png', 'image/jpeg', 'image/gif', 'application/zip'
];

module.exports = { ACTIONS, ROLES, PERMISSION_LEVELS, ALLOWED_EXTENSIONS, SAFE_DOWNLOAD_MIME };
