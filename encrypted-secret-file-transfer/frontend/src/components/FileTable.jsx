import React, { useState } from 'react';
import { Badge } from './ui.jsx';
import { ConfirmDialog } from './ui.jsx';
import ShareModal from './ShareModal.jsx';
import { api } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { fileType, formatBytes, formatDate } from '../utils/format.js';

const accessBadge = (a) => (a === 'owner' ? <Badge tone="teal">Owner</Badge> : <Badge tone="blue">{a === 'view' ? 'View only' : 'Can download'}</Badge>);

export default function FileTable({ files, onChange, compact }) {
  const toast = useToast();
  const [sharing, setSharing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(null);

  async function download(f) {
    setDownloading(f.id);
    try { await api.download(f); toast.success(`Decrypted and downloaded ${f.originalName}`); onChange && onChange(); }
    catch (e) { toast.error(e.message); } finally { setDownloading(null); }
  }
  async function confirmDelete() {
    setBusy(true);
    try { await api.deleteFile(deleting.id); toast.success('File deleted'); setDeleting(null); onChange && onChange(); }
    catch (e) { toast.error(e.message); } finally { setBusy(false); }
  }

  return (
    <>
      <div className="table-wrap">
        <table>
          <thead><tr><th>File Name</th><th>Owner</th><th>Size</th><th>Type</th><th>Date</th><th>Access</th>{!compact && <th>Shared with</th>}<th className="right">Actions</th></tr></thead>
          <tbody>
            {files.map((f) => (
              <tr key={f.id}>
                <td><a className="file-link" href={`#/files/${f.id}`}>🔒 {f.originalName}</a></td>
                <td>{f.ownerName}</td>
                <td>{formatBytes(f.size)}</td>
                <td><Badge>{fileType(f.originalName)}</Badge></td>
                <td>{formatDate(f.createdAt)}</td>
                <td>{accessBadge(f.access)}</td>
                {!compact && <td>{f.access === 'owner' ? (f.sharedWith.length ? f.sharedWith.map((s) => s.email).join(', ') : <span className="muted">Private</span>) : <span className="muted">-</span>}</td>}
                <td className="right actions">
                  <a className="btn btn-sm" href={`#/files/${f.id}`}>Details</a>
                  {(f.access === 'owner' || f.access === 'download') && <button className="btn btn-sm btn-primary" disabled={downloading === f.id} onClick={() => download(f)}>{downloading === f.id ? '...' : 'Download'}</button>}
                  {f.access === 'owner' && <button className="btn btn-sm" onClick={() => setSharing(f)}>Share</button>}
                  {f.access === 'owner' && <button className="btn btn-sm btn-danger-outline" onClick={() => setDeleting(f)}>Delete</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sharing && <ShareModal file={sharing} onClose={() => setSharing(null)} onShared={onChange} />}
      {deleting && <ConfirmDialog danger title="Delete file?" confirmLabel="Delete permanently" busy={busy} onCancel={() => setDeleting(null)} onConfirm={confirmDelete}
        message={`"${deleting.originalName}" and its encrypted copy will be permanently removed, and all shared access revoked.`} />}
    </>
  );
}
