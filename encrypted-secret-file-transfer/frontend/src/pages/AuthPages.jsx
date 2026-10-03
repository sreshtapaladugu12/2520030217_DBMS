import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="auth-page">
      <div className="auth-hero">
        <div className="brand-mark big">🔐</div>
        <h1>CipherShare</h1>
        <p>Encrypted Secret File Transfer - Distributed Backend Database System</p>
        <ul>
          <li>AES-256-GCM encryption before storage</li>
          <li>JWT authentication and per-file permissions</li>
          <li>Full audit trail of every transfer</li>
        </ul>
      </div>
      <div className="auth-card">
        <h2>{title}</h2><p className="muted">{subtitle}</p>
        {children}
        <p className="auth-foot">{footer}</p>
      </div>
    </div>
  );
}

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    try { await login(email.trim(), password); } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return (
    <AuthShell title="Welcome back" subtitle="Sign in to access your encrypted files" footer={<>New here? <a href="#/register">Create an account</a></>}>
      <form className="form" onSubmit={submit}>
        <label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="alice@example.com" autoComplete="username" /></label>
        <label>Password<input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></label>
        {error && <div className="banner banner-error">{error}</div>}
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</button>
        <div className="demo-box"><strong>Demo accounts</strong> (after <code>npm run reset:data</code>)
          {[['alice@example.com', 'Alice@123'], ['bob@example.com', 'Bob@123'], ['admin@example.com', 'Admin@123']].map(([e, p]) => (
            <button type="button" key={e} className="link-btn" onClick={() => { setEmail(e); setPassword(p); }}>{e}</button>
          ))}
        </div>
      </form>
    </AuthShell>
  );
}

export function RegisterPage() {
  const { register } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    try { await register(form.name.trim(), form.email.trim(), form.password); } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return (
    <AuthShell title="Create your account" subtitle="Passwords are hashed with bcrypt - we never store them" footer={<>Already registered? <a href="#/login">Sign in</a></>}>
      <form className="form" onSubmit={submit}>
        <label>Full name<input required minLength={2} value={form.name} onChange={set('name')} /></label>
        <label>Email<input type="email" required value={form.email} onChange={set('email')} autoComplete="username" /></label>
        <label>Password<input type="password" required minLength={8} value={form.password} onChange={set('password')} autoComplete="new-password" /><small className="muted">At least 8 characters with letters and digits.</small></label>
        {error && <div className="banner banner-error">{error}</div>}
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Creating...' : 'Create account'}</button>
      </form>
    </AuthShell>
  );
}
