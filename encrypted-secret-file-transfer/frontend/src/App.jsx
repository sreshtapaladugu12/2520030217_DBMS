import React from 'react';
import { useAuth } from './context/AuthContext.jsx';
import { useHashRoute } from './hooks/useHashRoute.js';
import Layout from './components/Layout.jsx';
import { Spinner } from './components/ui.jsx';
import { LoginPage, RegisterPage } from './pages/AuthPages.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import FilesPage from './pages/FilesPage.jsx';
import UploadPage from './pages/UploadPage.jsx';
import FileDetailsPage from './pages/FileDetailsPage.jsx';
import LogsPage from './pages/LogsPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import StatusPage from './pages/StatusPage.jsx';

export default function App() {
  const { user, loading } = useAuth();
  const path = useHashRoute();

  if (loading) return <Spinner label="Restoring session..." />;
  if (!user) return path === '/register' ? <RegisterPage /> : <LoginPage />;

  let page;
  if (path.startsWith('/files/')) page = <FileDetailsPage key={path} id={path.split('/')[2]} />;
  else if (path === '/files') page = <FilesPage key="owned" scope="owned" />;
  else if (path === '/shared') page = <FilesPage key="shared" scope="shared" />;
  else if (path === '/upload') page = <UploadPage />;
  else if (path === '/logs') page = <LogsPage />;
  else if (path === '/profile') page = <ProfilePage />;
  else if (path === '/admin') page = <AdminPage />;
  else if (path === '/status') page = <StatusPage />;
  else page = <DashboardPage />;

  return <Layout path={path}>{page}</Layout>;
}
