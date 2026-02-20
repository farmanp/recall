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
  RelaysPage,
  CommitDetailPage,
} from './pages';
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

          {/* Relays (Commit-Centric View) */}
          <Route path="/relays" element={<RelaysPage />} />
          <Route path="/relays/:hash" element={<CommitDetailPage />} />

          {/* Session Player (full-screen, sidebar hidden) */}
          <Route path="/session/:sessionId/artifacts" element={<ArtifactsFullPage />} />
          <Route path="/session/:sessionId/:frameIndex?" element={<SessionPlayerPage />} />

          {/* Shared Sessions (full-screen, sidebar hidden) */}
          <Route path="/shared/:shareId" element={<SharedSessionPage />} />
        </Routes>
      </AppLayout>
    </Router>
  );
}

export default App;
