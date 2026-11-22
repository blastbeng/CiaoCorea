import type { ReactNode } from 'react';
import { Outlet, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import { AppShell } from './components/AppShell';
import { AboutPage } from './pages/AboutPage';
import { AnalysisPage } from './pages/AnalysisPage';
import { ChallengePage } from './pages/ChallengePage';
import { AlphabetPage } from './pages/AlphabetPage';
import { WritingPracticePage } from './pages/WritingPracticePage';
import { ConiugaPage } from './pages/ConiugaPage';
import { CoursePage } from './pages/CoursePage';
import { Dashboard } from './pages/Dashboard';
import { DialoguePage } from './pages/DialoguePage';
import { DialoguesPage } from './pages/DialoguesPage';
import { LessonPage } from './pages/LessonPage';
import { MistakesPage } from './pages/MistakesPage';
import { MyProfilePage } from './pages/MyProfilePage';
import { NotFound } from './pages/NotFound';
import { NumbersPage } from './pages/NumbersPage';
import { ProfilePage } from './pages/ProfilePage';
import { PronunciationPage } from './pages/PronunciationPage';
import { ProfilesPage } from './pages/ProfilesPage';
import { ReviewPage } from './pages/ReviewPage';
import { SkipCoursePage } from './pages/SkipCoursePage';
import { SyncPage } from './pages/SyncPage';
import { VocabularyPage } from './pages/VocabularyPage';
import { GrammarPage } from './pages/GrammarPage';
import { WritingPage } from './pages/WritingPage';

function Gate({ children }: { children: ReactNode }) {
  const { state, start } = useAuth();

  if (state.status === 'loading') {
    return <div className="loading">Un momento…</div>;
  }

  if (state.status === 'error') {
    // Non c'è un login da mostrare: il database non si è aperto. L'unica via
    // è riprovare, e spesso il reload basta.
    return (
      <div className="loading">
        <p className="muted">{state.message}</p>
        <button type="button" className="btn" onClick={() => void start()}>
          Riprova
        </button>
      </div>
    );
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
      <Route
        element={
          <Gate>
            <Shell />
          </Gate>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="corso/:slug" element={<CoursePage />} />
        <Route path="corso/:slug/lezione/:lessonId" element={<LessonPage />} />
        <Route path="corso/:slug/salta" element={<SkipCoursePage />} />
        <Route path="dialoghi" element={<DialoguesPage />} />
        <Route path="dialoghi/:slug" element={<DialoguePage />} />
        <Route path="sfida" element={<ChallengePage />} />
        <Route path="ripassi" element={<ReviewPage />} />
        <Route path="errori" element={<MistakesPage />} />
        <Route path="alfabeto" element={<AlphabetPage />} />
        <Route path="scrittura" element={<WritingPracticePage />} />
        <Route path="pronuncia" element={<PronunciationPage />} />
        <Route path="numeri" element={<NumbersPage />} />
        <Route path="dizionario" element={<VocabularyPage />} />
        <Route path="coniuga" element={<ConiugaPage />} />
        <Route path="analisi" element={<AnalysisPage />} />
        <Route path="repertorio" element={<GrammarPage />} />
        <Route path="quaderno" element={<WritingPage />} />
        <Route path="progressi" element={<ProfilePage />} />
        <Route path="profilo" element={<MyProfilePage />} />
        <Route path="profili" element={<ProfilesPage />} />
        <Route path="sincronizza" element={<SyncPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
