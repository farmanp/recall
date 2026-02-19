/**
 * App Component
 *
 * Application root with routing and sidebar navigation
 */

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import {
  SessionListPage,
  SessionPlayerPage,
  ArtifactsFullPage,
  SharedSessionPage,
  OverviewPage,
  FoldersPage,
} from './pages';
import { WorkUnitListPage } from './pages/WorkUnitListPage';
import { WorkUnitPlayerPage } from './pages/WorkUnitPlayerPage';
import { CommandPalette } from './components/CommandPalette';
import { AppLayout } from './components/layout';

function App() {
  return (
    <Router>
      <CommandPalette />
      <AppLayout>
        <Routes>
          {/* Overview Dashboard */}
          <Route path="/" element={<OverviewPage />} />

          {/* Session Navigation */}
          <Route path="/sessions" element={<SessionListPage />} />
          <Route path="/folders" element={<FoldersPage />} />

          {/* Session Player (full-screen, sidebar hidden) */}
          <Route path="/session/:sessionId/artifacts" element={<ArtifactsFullPage />} />
          <Route path="/session/:sessionId/:frameIndex?" element={<SessionPlayerPage />} />

          {/* Shared Sessions (full-screen, sidebar hidden) */}
          <Route path="/shared/:shareId" element={<SharedSessionPage />} />

          {/* Work Units */}
          <Route path="/work-units" element={<WorkUnitListPage />} />
          <Route path="/work-units/:workUnitId" element={<WorkUnitPlayerPage />} />
        </Routes>
      </AppLayout>
    </Router>
  );
}

export default App;
