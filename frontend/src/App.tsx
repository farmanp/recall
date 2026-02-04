/**
 * App Component
 *
 * Application root with routing
 */

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { SessionListPage, SessionPlayerPage } from './pages';
import { CommandPalette } from './components/CommandPalette';

function App() {
  return (
    <Router>
      <CommandPalette />
      <Routes>
        <Route path="/" element={<SessionListPage />} />
        <Route path="/session/:sessionId/:frameIndex?" element={<SessionPlayerPage />} />
      </Routes>
    </Router>
  );
}

export default App;
