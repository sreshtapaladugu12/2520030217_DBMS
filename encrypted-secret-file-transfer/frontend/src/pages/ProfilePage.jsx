import React from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Badge, PageHeader } from '../components/ui.jsx';
import { formatDate } from '../utils/format.js';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  return (
    <>
      <PageHeader title="Profile" subtitle="Your account and security details" />
      <div className="grid two">
        <div className="card">
          <div className="profile-head"><div className="avatar big">{user.name[0].toUpperCase()}</div><div><h3>{user.name}</h3><p className="muted">{user.email}</p></div></div>
          <dl className="kv">
            <dt>Role</dt><dd><Badge tone={user.role === 'admin' ? 'purple' : 'blue'}>{user.role}</Badge></dd>
            <dt>Member since</dt><dd>{formatDate(user.createdAt)}</dd>
            <dt>Last login</dt><dd>{formatDate(user.lastLoginAt)}</dd>
          </dl>
          <button className="btn btn-danger-outline" onClick={logout}>Log out</button>
        </div>
        <div className="card">
          <h3>How your account is protected</h3>
          <ul className="checks">
            <li>Password stored only as a <strong>bcrypt</strong> hash</li>
            <li>Sessions use short-lived <strong>JWT</strong> tokens</li>
            <li>Files encrypted with <strong>AES-256-GCM</strong></li>
            <li>Every action recorded in the audit log</li>
          </ul>
        </div>
      </div>
    </>
  );
}
