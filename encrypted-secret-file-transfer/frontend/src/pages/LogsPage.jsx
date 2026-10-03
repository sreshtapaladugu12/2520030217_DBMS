import React, { useState } from 'react';
import { api } from '../services/api.js';
import { useLoad } from '../hooks/useLoad.js';
import { EmptyState, ErrorBanner, PageHeader, Spinner } from '../components/ui.jsx';
import ActivityTable from '../components/ActivityTable.jsx';
import { ACTION_LABELS } from '../utils/format.js';

export default function LogsPage() {
  const [action, setAction] = useState('');
  const { data, error, loading, reload } = useLoad(() => api.logs({ action, limit: 100 }), [action]);
  return (
    <>
      <PageHeader title="Activity & transfer logs" subtitle="Uploads, downloads, sharing and revocations involving you or your files">
        <select value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">All actions</option>
          {Object.entries(ACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="btn" onClick={reload}>Refresh</button>
      </PageHeader>
      <ErrorBanner>{error}</ErrorBanner>
      <div className="card">
        {loading && !data ? <Spinner /> : data && data.logs.length ? <ActivityTable logs={data.logs} /> : <EmptyState icon="📜" title="No log entries">Nothing matches this filter yet.</EmptyState>}
        {data && <p className="muted small">Showing {data.logs.length} of {data.total} events.</p>}
      </div>
    </>
  );
}
