import React, { useRef, useState } from 'react';
import { api } from '../services/api.js';
import { navigate } from '../hooks/useHashRoute.js';
import { useToast } from '../context/ToastContext.jsx';
import { PageHeader, ErrorBanner } from '../components/ui.jsx';
import { formatBytes } from '../utils/format.js';

const MAX_MB = 10;
const ALLOWED = 'txt, md, csv, json, pdf, png, jpg, gif, doc(x), xls(x), ppt(x), zip';

export default function UploadPage() {
  const toast = useToast();
  const input = useRef(null);
  const [file, setFile] = useState(null);
  const [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');

  function pick(f) {
    setError('');
    if (f && f.size > MAX_MB * 1024 * 1024) { setError(`File is larger than ${MAX_MB} MB`); return; }
    setFile(f || null);
  }
  async function submit() {
    setError(''); setProgress(0);
    try {
      const r = await api.upload(file, setProgress);
      toast.success(`"${r.file.originalName}" encrypted and stored`);
      navigate(`/files/${r.file.id}`);
    } catch (e) { setError(e.message); setProgress(null); }
  }
  const uploading = progress !== null;

  return (
    <>
      <PageHeader title="Upload a secret file" subtitle="The server encrypts it with AES-256-GCM before anything is written to disk" />
      <div className="card">
        <div className={`dropzone ${drag ? 'drag' : ''}`} onClick={() => input.current.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]); }}>
          <div className="empty-icon">🔐</div>
          <strong>{file ? file.name : 'Drag & drop a file here, or click to browse'}</strong>
          <span className="muted">{file ? formatBytes(file.size) : `Max ${MAX_MB} MB - allowed: ${ALLOWED}`}</span>
          <input ref={input} type="file" hidden onChange={(e) => pick(e.target.files[0])} />
        </div>
        <ErrorBanner>{error}</ErrorBanner>
        {uploading && <div className="progress"><div style={{ width: `${progress}%` }} /><span>{progress < 100 ? `Uploading ${progress}%` : 'Encrypting and storing...'}</span></div>}
        <div className="upload-actions">
          <button className="btn" disabled={!file || uploading} onClick={() => setFile(null)}>Clear</button>
          <button className="btn btn-primary" disabled={!file || uploading} onClick={submit}>Encrypt &amp; upload</button>
        </div>
      </div>
      <div className="card note"><strong>What happens next?</strong> A fresh random key encrypts your file; that key is itself encrypted with the server master key. Only the ciphertext is stored on disk, and every upload is written to the audit log.</div>
    </>
  );
}
