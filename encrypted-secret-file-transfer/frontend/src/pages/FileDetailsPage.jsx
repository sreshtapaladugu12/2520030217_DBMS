import React, { useState } from 'react';
import { api } from '../services/api.js';
import { useLoad } from '../hooks/useLoad.js';
import { useToast } from '../context/ToastContext.jsx';
import { navigate } from '../hooks/useHashRoute.js';
import { Badge, ConfirmDialog, EmptyState, ErrorBanner, PageHeader, Spinner } from '../components/ui.jsx';
import ShareModal from '../components/ShareModal.jsx';
import ActivityTable from '../components/ActivityTable.jsx';
import { formatBytes, formatDate } from '../utils/format.js';

export default function FileDetailsPage({ id }) {
  const toast = useToast();
  const { data, error, loading, reload } = useLoad(() => api.file(id), [id]);
  const logs = useLoad(() => api.logs({ fileId: id, limit: 20 }), [id]);
  const [sharing, setSharing] = useState(false);
  const [revoking, setRevoking] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  if (loading && !data) return <Spinner />;
  if (error) return <><ErrorBanner>{error}</ErrorBanner><a className="btn" href="#/files">Back to files</a></>;
  const f = data.file;
  const owner = f.access === 'owner';

  const refresh = () => { reload(); logs.reload(); };
  async function revoke() {
    setBusy(true);
    try { await api.revoke(revoking.permissionId); toast.success(`Access revoked for ${revoking.email}`); setRevoking(null); refresh(); }
    catch (e) { toast.error(e.message); } finally { setBusy(false); }
  }
  async function download() {
    try { await api.download(f); toast.success('Decrypted and downloaded'); logs.reload(); } catch (e) { toast.error(e.message); }
  }
  async function remove() {
    setBusy(true);
    try { await api.deleteFile(f.id); toast.success('File deleted'); navigate('/files'); } catch (e) { toast.error(e.message); setBusy(false); }
  }

  return (
    <>
      <PageHeader title={f.originalName} subtitle={`Owned by ${f.ownerName} - uploaded ${formatDate(f.createdAt)}`}>
        {(owner || f.access === 'download') && <button className="btn btn-primary" onClick={download}>Download (decrypts)</button>}
        {owner && <button className="btn" onClick={() => setSharing(true)}>Share</button>}
        {owner && <button className="btn btn-danger-outline" onClick={() => setConfirmDelete(true)}>Delete</button>}
      </PageHeader>

      <div className="grid two">
        <div className="card">
          <h3>File information</h3>
          <dl className="kv">
            <dt>Name</dt><dd>{f.originalName}</dd>
            <dt>Owner</dt><dd>{f.ownerName} ({f.ownerEmail})</dd>
            <dt>Size</dt><dd>{formatBytes(f.size)}</dd>
            <dt>Type</dt><dd>{f.mimeType}</dd>
            <dt>Your access</dt><dd><Badge tone="teal">{f.access}</Badge></dd>
          </dl>
        </div>
        <div className="card">
          <h3>Encryption</h3>
          <dl className="kv">
            <dt>Status</dt><dd><Badge tone="green">Encrypted at rest</Badge></dd>
            <dt>Algorithm</dt><dd>{f.encryption.algorithm}</dd>
            <dt>Stored size</dt><dd>{formatBytes(f.encryptedSize)} (ciphertext)</dd>
            <dt>SHA-256</dt><dd className="mono">{f.sha256.slice(0, 24)}...</dd>
          </dl>
          <p className="muted small">The plaintext exists only in memory during upload and authorised download. Keys never reach the browser.</p>
        </div>
      </div>

      {owner && (
        <div className="card">
          <div className="card-head"><h3>Shared with</h3><button className="btn btn-sm btn-primary" onClick={() => setSharing(true)}>+ Grant access</button></div>
          {f.sharedWith.length ? (
            <div className="table-wrap"><table>
              <thead><tr><th>User</th><th>Email</th><th>Permission</th><th>Since</th><th className="right">Actions</th></tr></thead>
              <tbody>{f.sharedWith.map((s) => (
                <tr key={s.permissionId}><td>{s.name}</td><td>{s.email}</td><td><Badge tone="blue">{s.level}</Badge></td><td>{formatDate(s.grantedAt)}</td>
                  <td className="right"><button className="btn btn-sm btn-danger-outline" onClick={() => setRevoking(s)}>Revoke</button></td></tr>
              ))}</tbody>
            </table></div>
          ) : <EmptyState icon="🔒" title="Private file">Only you can access this file. Share it with a registered user by email.</EmptyState>}
        </div>
      )}

      <div className="card">
        <h3>File activity</h3>
        {logs.data && logs.data.logs.length ? <ActivityTable logs={logs.data.logs} /> : <p className="muted">{logs.loading ? 'Loading...' : 'No activity recorded.'}</p>}
      </div>

      {sharing && <ShareModal file={f} onClose={() => setSharing(false)} onShared={refresh} />}
      {revoking && <ConfirmDialog danger title="Revoke access?" confirmLabel="Revoke" busy={busy} onCancel={() => setRevoking(null)} onConfirm={revoke}
        message={`${revoking.email} will immediately lose the ability to download this file.`} />}
      {confirmDelete && <ConfirmDialog danger title="Delete file?" confirmLabel="Delete permanently" busy={busy} onCancel={() => setConfirmDelete(false)} onConfirm={remove}
        message="The encrypted copy and all permissions will be permanently removed." />}
    </>
  );
}
