import type { ReactNode } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth';
import { AppShell } from './components/AppShell';
import { CoursePage } from './pages/CoursePage';
import { Dashboard } from './pages/Dashboard';
import { DialoguePage } from './pages/DialoguePage';
import { DialoguesPage } from './pages/DialoguesPage';
import { LessonPage } from './pages/LessonPage';
import { Login } from './pages/Login';
import { MistakesPage } from './pages/MistakesPage';
import { NotFound } from './pages/NotFound';
import { ProfilePage } from './pages/ProfilePage';
import { Register } from './pages/Register';
import { ReviewPage } from './pages/ReviewPage';
import { SkipCoursePage } from './pages/SkipCoursePage';
import { VocabularyPage } from './pages/VocabularyPage';
import { WritingPage } from './pages/WritingPage';

function RequireAuth({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  const location = useLocation();

  if (state.status === 'loading') {
    return <div className="loading">Un momento…</div>;
  }

  if (state.status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}

function Shell() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

export default function App() {
  return (
    <Routes>
      {/* Sempre raggiungibili: sono la schermata dei profili, non solo
          l'accesso. Chi sta studiando può cambiare utente da qui. */}
      <Route path="/login" element={<Login />} />
      <Route path="/registrazione" element={<Register />} />

      <Route
        element={
          <RequireAuth>
            <Shell />
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="corso/:slug" element={<CoursePage />} />
        <Route path="corso/:slug/lezione/:lessonId" element={<LessonPage />} />
        <Route path="corso/:slug/salta" element={<SkipCoursePage />} />
        <Route path="dialoghi" element={<DialoguesPage />} />
        <Route path="dialoghi/:slug" element={<DialoguePage />} />
        <Route path="ripassi" element={<ReviewPage />} />
        <Route path="errori" element={<MistakesPage />} />
        <Route path="dizionario" element={<VocabularyPage />} />
        <Route path="quaderno" element={<WritingPage />} />
        <Route path="progressi" element={<ProfilePage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
