import React from 'react';
import { api } from '../services/api.js';
import { useLoad } from '../hooks/useLoad.js';
import { Badge, EmptyState, ErrorBanner, PageHeader, Spinner, StatCard, WarnBanner } from '../components/ui.jsx';
import FileTable from '../components/FileTable.jsx';
import ActivityTable from '../components/ActivityTable.jsx';
import ServiceBadges from '../components/ServiceBadges.jsx';
import { formatBytes } from '../utils/format.js';

export default function DashboardPage() {
  const { data, error, loading, reload } = useLoad(() => api.overview());
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBanner>{error}</ErrorBanner>;
  const { stats, security, services, warnings } = data;
  const allUp = ['gateway', 'authentication', 'file', 'permission', 'audit'].every((k) => services[k] === 'ok');

  return (
    <>
      <PageHeader title={`Welcome, ${data.user.name.split(' ')[0]}`} subtitle="Your encrypted file overview"><button className="btn" onClick={reload}>Refresh</button></PageHeader>
      <WarnBanner items={warnings} />
      <div className="grid stats">
        <StatCard label="Total Files" value={stats.totalFiles} hint={formatBytes(stats.totalBytes)} />
        <StatCard label="Shared Files" value={stats.sharedByMe} hint="files you shared" tone="purple" />
        <StatCard label="Shared With Me" value={stats.sharedWithMe} hint={`${stats.accessibleFiles} accessible in total`} tone="blue" />
        <StatCard label="My Downloads" value={stats.myDownloads} hint="successful, decrypted" tone="green" />
      </div>

      <div className="card">
        <h3>Security &amp; system status</h3>
        <div className="chips">
          <span className="chip">Encryption <Badge tone="green">{security.encryption}</Badge></span>
          <span className="chip">Authentication <Badge tone="green">{security.authentication}</Badge></span>
          <span className="chip">Database <Badge tone={security.database === 'connected' ? 'green' : 'red'}>MongoDB {security.database}</Badge></span>
          <span className="chip">Backend <Badge tone={allUp ? 'green' : 'amber'}>{allUp ? 'All services online' : 'Degraded'}</Badge></span>
        </div>
        <ServiceBadges services={services} />
      </div>

      <div className="card">
        <div className="card-head"><h3>Recent uploads</h3><a href="#/files">View all</a></div>
        {data.recentUploads.length ? <FileTable compact files={data.recentUploads} onChange={reload} />
          : <EmptyState title="No files yet">Upload your first secret file - it is encrypted before it is stored. <a href="#/upload">Upload now</a></EmptyState>}
      </div>

      <div className="card">
        <div className="card-head"><h3>Recent activity</h3><a href="#/logs">Full audit log</a></div>
        {data.recentActivity.length ? <ActivityTable logs={data.recentActivity} /> : <EmptyState icon="📜" title="No activity yet">Uploads, shares and downloads will appear here.</EmptyState>}
      </div>
    </>
  );
}
