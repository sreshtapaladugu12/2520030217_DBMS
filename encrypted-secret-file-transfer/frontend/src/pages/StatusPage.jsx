import React, { useEffect } from 'react';
import { api } from '../services/api.js';
import { useLoad } from '../hooks/useLoad.js';
import { Badge, PageHeader, Spinner } from '../components/ui.jsx';
import { SERVICE_LABELS } from '../components/ServiceBadges.jsx';

const DESCRIPTIONS = {
  gateway: 'Single entry point, JWT check, routing',
  authentication: 'Register, login, bcrypt, JWT issue',
  file: 'Upload, AES-256-GCM encrypt/decrypt, storage',
  permission: 'Grant / revoke / check access',
  audit: 'Transfer and activity log'
};

export default function StatusPage() {
  const { data, loading, reload } = useLoad(() => api.serviceStatus());
  useEffect(() => { const t = setInterval(reload, 5000); return () => clearInterval(t); }, [reload]);
  if (loading && !data) return <Spinner label="Checking services..." />;
  const detail = (k) => (k === 'gateway' ? { latencyMs: 0 } : data.details[k] || {});
  return (
    <>
      <PageHeader title="System status" subtitle="Live health of every logical backend service (auto-refreshes every 5 s)">
        <Badge tone={data.database === 'connected' ? 'green' : 'red'}>MongoDB {data.database}</Badge>
        <button className="btn" onClick={reload}>Check now</button>
      </PageHeader>
      <div className="grid services">
        {Object.keys(SERVICE_LABELS).map((k) => (
          <div key={k} className={`card svc ${data[k] === 'ok' ? 'svc-ok' : 'svc-down'}`}>
            <div className="card-head"><h3>{SERVICE_LABELS[k]}</h3><Badge tone={data[k] === 'ok' ? 'green' : 'red'}>{data[k] === 'ok' ? 'Online' : 'Unavailable'}</Badge></div>
            <p className="muted">{DESCRIPTIONS[k]}</p>
            <small className="muted">{data[k] === 'ok' ? `${detail(k).latencyMs} ms` : 'Not responding - other services keep working'}</small>
          </div>
        ))}
      </div>
      <p className="muted small">Last checked {new Date(data.checkedAt).toLocaleTimeString()}. Stop any one service and refresh: only that card turns red.</p>
    </>
  );
}
