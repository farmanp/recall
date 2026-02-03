/**
 * App Component
 *
 * Application root with routing
 */

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { SessionListPage, SessionPlayerPage } from './pages';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<SessionListPage />} />
        <Route path="/session/:sessionId" element={<SessionPlayerPage />} />
      </Routes>
    </Router>
  );
}

export default App;
