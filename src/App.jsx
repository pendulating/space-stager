// src/App.jsx
import React from 'react';
import { TutorialProvider } from './contexts/TutorialContext';
import { SitePlanProvider } from './contexts/SitePlanContext';
import DprStager from './components/DprStager';

function App() {
  return (
    <TutorialProvider>
      <SitePlanProvider>
        <DprStager />
      </SitePlanProvider>
    </TutorialProvider>
  );
}

export default App;