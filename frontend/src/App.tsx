import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LiveDataProvider } from './context/LiveDataContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { RegisterGate } from './components/RegisterGate';
import { DashboardPage } from './pages/DashboardPage';
import { BinDetailPage } from './pages/BinDetailPage';
import { AlertsPage } from './pages/AlertsPage';
import { AdminPage } from './pages/AdminPage';
import { LoginPage } from './pages/LoginPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 0, refetchOnWindowFocus: true },
  },
});

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link
      to={to}
      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        isActive
          ? 'bg-blue-500/20 text-blue-400'
          : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
      }`}
    >
      {children}
    </Link>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  const { user, token, logout, registrationOpen, isLoading } = useAuth();

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      <header className="bg-gray-900/80 backdrop-blur-xl border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="font-bold text-xl bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              SmartBin
            </Link>
            <nav className="hidden sm:flex items-center gap-1">
              <NavLink to="/">Dashboard</NavLink>
              <NavLink to="/alerts">Alerts</NavLink>
              {token && <NavLink to="/admin">Admin</NavLink>}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            {user ? (
              <>
                <span className="text-gray-400 hidden sm:inline">{user.email}</span>
                <button
                  onClick={logout}
                  className="px-3 py-1.5 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-gray-400 hover:text-white">Login</Link>
                {!isLoading && registrationOpen && (
                  <Link to="/register" className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white">
                    Setup Admin
                  </Link>
                )}
              </>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-7xl w-full mx-auto">
        {children}
      </main>
      <footer className="border-t border-gray-800 py-4 text-center text-xs text-gray-600">
        SmartBin IoT Monitoring System
      </footer>
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/bins/:id" element={<BinDetailPage />} />
      <Route path="/alerts" element={<AlertsPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterGate />} />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LiveDataProvider>
        <AuthProvider>
          <BrowserRouter>
            <Layout>
              <AppRoutes />
            </Layout>
          </BrowserRouter>
        </AuthProvider>
      </LiveDataProvider>
    </QueryClientProvider>
  );
}
