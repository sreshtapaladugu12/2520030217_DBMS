import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { navigate } from '../hooks/useHashRoute.js';

const NAV = [
  ['/dashboard', '📊', 'Dashboard'],
  ['/files', '🗂️', 'My Files'],
  ['/shared', '🤝', 'Shared With Me'],
  ['/upload', '⬆️', 'Upload'],
  ['/logs', '📜', 'Activity Logs'],
  ['/profile', '👤', 'Profile'],
  ['/admin', '🛡️', 'Admin', true],
  ['/status', '📡', 'System Status']
];

export default function Layout({ path, children }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const active = (to) => path === to || (to === '/files' && path.startsWith('/files/'));
  return (
    <div className="shell">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand"><span className="brand-mark">🔐</span><div><strong>CipherShare</strong><small>Encrypted file transfer</small></div></div>
        <nav>
          {NAV.filter(([, , , adminOnly]) => !adminOnly || user.role === 'admin').map(([to, icon, label]) => (
            <a key={to} href={`#${to}`} className={active(to) ? 'active' : ''} onClick={() => setOpen(false)}><span>{icon}</span>{label}</a>
          ))}
          <button className="nav-logout" onClick={logout}><span>🚪</span>Logout</button>
        </nav>
        <div className="sidebar-foot"><div className="avatar">{user.name[0].toUpperCase()}</div><div><strong>{user.name}</strong><small>{user.role}</small></div></div>
      </aside>
      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setOpen(!open)} aria-label="Menu">☰</button>
          <span className="topbar-title">Encrypted Secret File Transfer</span>
          <button className="btn btn-primary" onClick={() => navigate('/upload')}>+ Upload</button>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
