import React from 'react';
import { Badge } from './ui.jsx';

export const SERVICE_LABELS = { gateway: 'API Gateway', authentication: 'Authentication', file: 'File + Encryption', permission: 'Permissions', audit: 'Audit Log' };

export default function ServiceBadges({ services }) {
  if (!services) return null;
  return (
    <div className="chips">
      {Object.keys(SERVICE_LABELS).map((k) => (
        <span key={k} className="chip">{SERVICE_LABELS[k]} <Badge tone={services[k] === 'ok' ? 'green' : 'red'}>{services[k] === 'ok' ? 'Online' : 'Unavailable'}</Badge></span>
      ))}
    </div>
  );
}
