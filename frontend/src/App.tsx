/**
 * App Component
 *
 * Application root with routing
 */

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { SessionListPage, SessionPlayerPage, ArtifactsFullPage, SharedSessionPage } from './pages';
import { WorkUnitListPage } from './pages/WorkUnitListPage';
import { WorkUnitPlayerPage } from './pages/WorkUnitPlayerPage';
import { CommandPalette } from './components/CommandPalette';

function App() {
  return (
    <Router>
      <CommandPalette />
      <Routes>
        <Route path="/" element={<SessionListPage />} />
        <Route path="/session/:sessionId/artifacts" element={<ArtifactsFullPage />} />
        <Route path="/session/:sessionId/:frameIndex?" element={<SessionPlayerPage />} />
        <Route path="/shared/:shareId" element={<SharedSessionPage />} />
        <Route path="/work-units" element={<WorkUnitListPage />} />
        <Route path="/work-units/:workUnitId" element={<WorkUnitPlayerPage />} />
      </Routes>
    </Router>
  );
}

export default App;
