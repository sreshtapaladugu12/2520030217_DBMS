import React, { useEffect } from 'react';

export const Spinner = ({ label = 'Loading...' }) => <div className="center-note"><span className="spinner" /> {label}</div>;

export const Badge = ({ tone = 'gray', children }) => <span className={`badge badge-${tone}`}>{children}</span>;

export const EmptyState = ({ icon = '📂', title, children }) => (
  <div className="empty"><div className="empty-icon">{icon}</div><h3>{title}</h3><p>{children}</p></div>
);

export const StatCard = ({ label, value, hint, tone = 'teal' }) => (
  <div className={`card stat stat-${tone}`}><span className="stat-label">{label}</span><strong className="stat-value">{value ?? '-'}</strong>{hint && <span className="stat-hint">{hint}</span>}</div>
);

export const ErrorBanner = ({ children }) => (children ? <div className="banner banner-error">{children}</div> : null);
export const WarnBanner = ({ items }) => (items && items.length ? <div className="banner banner-warn">{items.map((w) => <div key={w}>⚠ {w}</div>)}</div> : null);

export function Modal({ title, onClose, children, footer }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head"><h3>{title}</h3><button className="icon-btn" onClick={onClose} aria-label="Close">✕</button></div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ title, message, confirmLabel = 'Confirm', danger, busy, onConfirm, onCancel }) {
  return (
    <Modal title={title} onClose={onCancel} footer={<>
      <button className="btn" onClick={onCancel}>Cancel</button>
      <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} disabled={busy} onClick={onConfirm}>{busy ? 'Working...' : confirmLabel}</button>
    </>}>
      <p>{message}</p>
    </Modal>
  );
}

export const PageHeader = ({ title, subtitle, children }) => (
  <div className="page-head"><div><h1>{title}</h1>{subtitle && <p className="muted">{subtitle}</p>}</div><div className="page-actions">{children}</div></div>
);
