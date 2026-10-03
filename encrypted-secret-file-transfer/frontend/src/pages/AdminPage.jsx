import React from 'react';
import { api } from '../services/api.js';
import { useLoad } from '../hooks/useLoad.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Badge, ErrorBanner, PageHeader, Spinner, StatCard, WarnBanner } from '../components/ui.jsx';
import ActivityTable from '../components/ActivityTable.jsx';
import ServiceBadges from '../components/ServiceBadges.jsx';
import { formatBytes, formatDate } from '../utils/format.js';

export default function AdminPage() {
  const { user } = useAuth();
  const toast = useToast();
  const stats = useLoad(() => api.adminStats());
  const users = useLoad(() => api.adminUsers());
  const logs = useLoad(() => api.adminLogs({ limit: 50 }));

  if (user.role !== 'admin') return <ErrorBanner>Administrator access required.</ErrorBanner>;
  const s = stats.data;

  async function toggle(u) {
    try { await api.patchUser(u.id, { active: !u.active }); toast.success(`${u.email} ${u.active ? 'disabled' : 'enabled'}`); users.reload(); logs.reload(); }
    catch (e) { toast.error(e.message); }
  }
  const reloadAll = () => { stats.reload(); users.reload(); logs.reload(); };

  return (
    <>
      <PageHeader title="Admin dashboard" subtitle="Users, system activity and service health. Admins cannot read users' file contents."><button className="btn" onClick={reloadAll}>Refresh</button></PageHeader>
      <ErrorBanner>{stats.error}</ErrorBanner>
      {s && <WarnBanner items={s.unavailable.map((n) => `${n} service unavailable - some numbers are missing.`)} />}
      {!s ? <Spinner /> : (
        <>
          <div className="grid stats">
            <StatCard label="Total Users" value={s.totalUsers} />
            <StatCard label="Total Files" value={s.totalFiles} hint={formatBytes(s.totalBytes)} tone="blue" />
            <StatCard label="Uploads" value={s.totalUploads} tone="purple" />
            <StatCard label="Downloads" value={s.totalDownloads} tone="green" />
            <StatCard label="Shared Files" value={s.sharedFiles} hint={`${s.activePermissions ?? '-'} active permissions`} tone="amber" />
            <StatCard label="Audit Events" value={s.totalEvents} tone="gray" />
          </div>
          <div className="card"><h3>Service status</h3><ServiceBadges services={s.services} /></div>
        </>
      )}

      <div className="card">
        <h3>Users</h3>
        {users.data ? (
          <div className="table-wrap"><table>
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last login</th><th className="right">Actions</th></tr></thead>
            <tbody>{users.data.users.map((u) => (
              <tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td><Badge tone={u.role === 'admin' ? 'purple' : 'blue'}>{u.role}</Badge></td>
                <td><Badge tone={u.active ? 'green' : 'red'}>{u.active ? 'Active' : 'Disabled'}</Badge></td><td>{formatDate(u.lastLoginAt)}</td>
                <td className="right">{u.id !== user.id && <button className="btn btn-sm" onClick={() => toggle(u)}>{u.active ? 'Disable' : 'Enable'}</button>}</td></tr>
            ))}</tbody>
          </table></div>
        ) : <Spinner />}
      </div>

      <div className="card"><h3>System-wide audit log</h3>{logs.data ? <ActivityTable logs={logs.data.logs} /> : <Spinner />}</div>
    </>
  );
}
