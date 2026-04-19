import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/auth-store';
import LoginPage from './pages/LoginPage';
import DashboardLayout from './layouts/DashboardLayout';
import DashboardPage from './pages/DashboardPage';
import UsersPage from './pages/UsersPage';
import UserDetailPage from './pages/UserDetailPage';
import TradesPage from './pages/TradesPage';
import SymbolsPage from './pages/SymbolsPage';
import SettingsPage from './pages/SettingsPage';
import TradeHistoryPage from './pages/TradeHistoryPage';
import SlideshowPage from './pages/SlideshowPage';
import CategoriesPage from './pages/CategoriesPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="users/:id" element={<UserDetailPage />} />
          <Route path="trades" element={<TradesPage />} />
          <Route path="history" element={<TradeHistoryPage />} />
          <Route path="symbols" element={<SymbolsPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="slideshow" element={<SlideshowPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
