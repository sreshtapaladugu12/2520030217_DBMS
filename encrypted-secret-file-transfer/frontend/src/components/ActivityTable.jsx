import React from 'react';
import { Badge } from './ui.jsx';
import { ACTION_LABELS, actionTone, formatDate } from '../utils/format.js';

export default function ActivityTable({ logs, showTarget = true }) {
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>User</th><th>File</th><th>Action</th>{showTarget && <th>Target</th>}<th>Date/Time</th><th>Status</th></tr></thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id}>
              <td>{l.userName || l.userEmail || '-'}</td>
              <td>{l.fileName || <span className="muted">-</span>}</td>
              <td><Badge tone={actionTone(l.action, l.status)}>{ACTION_LABELS[l.action] || l.action}</Badge></td>
              {showTarget && <td>{l.targetEmail || <span className="muted">-</span>}</td>}
              <td>{formatDate(l.timestamp)}</td>
              <td><Badge tone={l.status === 'success' ? 'green' : 'red'}>{l.status}</Badge></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
