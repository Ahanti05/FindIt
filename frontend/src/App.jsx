import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';

import Layout from './components/Layout';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import DashboardPage from './pages/DashboardPage';
import ReportLostPage from './pages/ReportLostPage';
import ReportFoundPage from './pages/ReportFoundPage';
import BrowsePage from './pages/BrowsePage';
import ItemDetailPage from './pages/ItemDetailPage';
import MatchDetailPage from './pages/MatchDetailPage';
import RecoveryPage from './pages/RecoveryPage';
import AdminDashboard from './pages/AdminDashboard';
import ProfilePage from './pages/ProfilePage';
import NotFoundPage from './pages/NotFoundPage';

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><span className="skeleton w-8 h-8 rounded-full" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return children;
};

const PublicOnlyRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
};

function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/browse" element={<BrowsePage />} />
        <Route path="/items/lost/:id" element={<ItemDetailPage type="lost" />} />
        <Route path="/items/found/:id" element={<ItemDetailPage type="found" />} />

        <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
        <Route path="/register" element={<PublicOnlyRoute><RegisterPage /></PublicOnlyRoute>} />
        <Route path="/forgot-password" element={<PublicOnlyRoute><ForgotPasswordPage /></PublicOnlyRoute>} />

        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/report/lost" element={<ProtectedRoute><ReportLostPage /></ProtectedRoute>} />
        <Route path="/report/found" element={<ProtectedRoute><ReportFoundPage /></ProtectedRoute>} />
        <Route path="/matches/:matchId" element={<ProtectedRoute><MatchDetailPage /></ProtectedRoute>} />
        <Route path="/recovery/:id" element={<ProtectedRoute><RecoveryPage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />

        <Route path="/admin" element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <AppRoutes />
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontSize: '0.875rem',
                borderRadius: '10px',
                boxShadow: '0 4px 16px rgba(13,27,42,0.12)',
              },
              success: { iconTheme: { primary: '#14b8a6', secondary: '#fff' } },
              error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
            }}
          />
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
