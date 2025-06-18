// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import DprStager from './components/DprStager';
import SapoStager from './components/SapoStager';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/dpr" element={<DprStager />} />
        <Route path="/sapo" element={<SapoStager />} />
      </Routes>
    </Router>
  );
}

export default App;