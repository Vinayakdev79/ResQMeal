import { Link, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import { RequireAuth } from './auth/RequireAuth';
import { AppStateProvider } from './lib/AppStateContext';
import ImpactPage from './pages/ImpactPage';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import ReportsPage from './pages/ReportsPage';
import DonorDashboardPage from './pages/donor/DonorDashboardPage';
import PostFoodPage from './pages/donor/PostFoodPage';
import DonorDonationsPage from './pages/donor/DonorDonationsPage';
import DonorRequestsPage from './pages/donor/DonorRequestsPage';
import DonorNotificationsPage from './pages/donor/DonorNotificationsPage';
import DonorProfilePage from './pages/donor/DonorProfilePage';
import ReceiverDashboardPage from './pages/receiver/ReceiverDashboardPage';
import ReceiverProfilePage from './pages/receiver/ReceiverProfilePage';
import ReceiverSettingsPage from './pages/receiver/ReceiverSettingsPage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';

function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-3xl font-bold">Page not found</h1>
      <p className="text-ink/80">The page you are looking for does not exist.</p>
      <Link
        to="/"
        className="rounded-lg bg-primary-600 px-4 py-2 font-medium text-white transition-colors hover:bg-primary-700"
      >
        Back to home
      </Link>
    </main>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppStateProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route
            path="/donor"
            element={
              <RequireAuth roles={['donor']}>
                <DonorDashboardPage />
              </RequireAuth>
            }
          />
          <Route
            path="/donor/post"
            element={
              <RequireAuth roles={['donor']}>
                <PostFoodPage />
              </RequireAuth>
            }
          />
          <Route
            path="/donor/donations"
            element={
              <RequireAuth roles={['donor']}>
                <DonorDonationsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/donor/requests"
            element={
              <RequireAuth roles={['donor']}>
                <DonorRequestsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/donor/notifications"
            element={
              <RequireAuth roles={['donor']}>
                <DonorNotificationsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/donor/profile"
            element={
              <RequireAuth roles={['donor']}>
                <DonorProfilePage />
              </RequireAuth>
            }
          />
          <Route
            path="/donor/settings"
            element={
              <RequireAuth roles={['donor']}>
                <ReceiverSettingsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/receiver"
            element={
              <RequireAuth roles={['receiver']}>
                <ReceiverDashboardPage />
              </RequireAuth>
            }
          />
          <Route
            path="/receiver/profile"
            element={
              <RequireAuth roles={['receiver']}>
                <ReceiverProfilePage />
              </RequireAuth>
            }
          />
          <Route
            path="/receiver/settings"
            element={
              <RequireAuth roles={['receiver']}>
                <ReceiverSettingsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireAuth roles={['admin']}>
                <AdminDashboardPage />
              </RequireAuth>
            }
          />
          <Route
            path="/impact"
            element={
              <RequireAuth roles={['donor', 'receiver', 'admin']}>
                <ImpactPage />
              </RequireAuth>
            }
          />
          <Route
            path="/reports"
            element={
              <RequireAuth roles={['donor', 'receiver', 'admin']}>
                <ReportsPage />
              </RequireAuth>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AppStateProvider>
    </AuthProvider>
  );
}
