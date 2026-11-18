import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { UiProvider } from './context/UiContext.jsx';
import AppShell from './components/AppShell.jsx';
import { Loader } from './components/ui.jsx';
import AuthPage from './pages/AuthPage.jsx';
import TodayPage from './pages/TodayPage.jsx';

// Heavier pages are code-split so the first screen loads fast on mobile data
const GymPage = lazy(() => import('./pages/GymPage.jsx'));
const MealsPage = lazy(() => import('./pages/MealsPage.jsx'));
const WaterPage = lazy(() => import('./pages/WaterPage.jsx'));
const ProgressPage = lazy(() => import('./pages/ProgressPage.jsx'));
const SettingsPage = lazy(() => import('./pages/SettingsPage.jsx'));
const OnboardingPage = lazy(() => import('./pages/OnboardingPage.jsx'));

function Protected({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loader label="Loading your coach" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (!user.profile?.onboarded && location.pathname !== '/welcome') return <Navigate to="/welcome" replace />;
  return children;
}

function PublicOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Loader />;
  return user ? <Navigate to="/" replace /> : children;
}

export default function App() {
  return (
    <AuthProvider>
      <UiProvider>
        <Suspense fallback={<Loader />}>
          <Routes>
            <Route path="/login" element={<PublicOnly><AuthPage mode="login" /></PublicOnly>} />
            <Route path="/register" element={<PublicOnly><AuthPage mode="register" /></PublicOnly>} />
            <Route path="/welcome" element={<Protected><OnboardingPage /></Protected>} />
            <Route element={<Protected><AppShell /></Protected>}>
              <Route index element={<TodayPage />} />
              <Route path="gym" element={<GymPage />} />
              <Route path="meals" element={<MealsPage />} />
              <Route path="water" element={<WaterPage />} />
              <Route path="progress" element={<ProgressPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </UiProvider>
    </AuthProvider>
  );
}
