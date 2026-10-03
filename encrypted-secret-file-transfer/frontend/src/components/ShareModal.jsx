import React, { useState } from 'react';
import { Modal } from './ui.jsx';
import { api } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';

export default function ShareModal({ file, onClose, onShared }) {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await api.share(file.id, email.trim());
      toast.success(`Shared "${file.originalName}" with ${email.trim()}`);
      onShared && onShared();
      onClose();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <Modal title={`Share "${file.originalName}"`} onClose={onClose}>
      <form onSubmit={submit} className="form">
        <p className="muted">The recipient must already have an account. They will be able to download and decrypt this file until you revoke access.</p>
        <label>Recipient email
          <input type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="bob@example.com" />
        </label>
        {error && <div className="banner banner-error">{error}</div>}
        <div className="modal-foot-inline">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Sharing...' : 'Grant access'}</button>
        </div>
      </form>
    </Modal>
  );
}
