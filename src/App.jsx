// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { TutorialProvider } from './contexts/TutorialContext';
import { SitePlanProvider } from './contexts/SitePlanContext';
import LandingPage from './pages/LandingPage';
import DprStager from './components/DprStager';

function App() {
  return (
    <TutorialProvider>
      <SitePlanProvider>
        <Router>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/dpr" element={<DprStager />} />
          </Routes>
        </Router>
      </SitePlanProvider>
    </TutorialProvider>
  );
}

export default App;