import React, { useState } from 'react';
import { api } from '../services/api.js';
import { useLoad } from '../hooks/useLoad.js';
import { EmptyState, ErrorBanner, PageHeader, Spinner, WarnBanner } from '../components/ui.jsx';
import FileTable from '../components/FileTable.jsx';

// scope = 'owned' (My Files) or 'shared' (Shared With Me)
export default function FilesPage({ scope }) {
  const { data, error, loading, reload } = useLoad(() => api.files(scope), [scope]);
  const [q, setQ] = useState('');
  const mine = scope === 'owned';
  const files = (data ? data.files : []).filter((f) => f.originalName.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <PageHeader title={mine ? 'My Files' : 'Shared With Me'} subtitle={mine ? 'Files you uploaded - stored encrypted' : 'Files other users granted you access to'}>
        <input className="search" placeholder="Search files..." value={q} onChange={(e) => setQ(e.target.value)} />
        {mine && <a className="btn btn-primary" href="#/upload">+ Upload</a>}
      </PageHeader>
      <ErrorBanner>{error}</ErrorBanner>
      <WarnBanner items={data && data.warnings} />
      <div className="card">
        {loading && !data ? <Spinner /> : files.length ? <FileTable files={files} onChange={reload} compact={!mine} />
          : mine ? <EmptyState title={q ? 'No matching files' : 'No files uploaded'}>Upload a file to see it here. <a href="#/upload">Upload a file</a></EmptyState>
            : <EmptyState icon="🤝" title="Nothing shared with you yet">When someone shares a file with your email, it appears here.</EmptyState>}
      </div>
    </>
  );
}
