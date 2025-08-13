// src/App.jsx
import React, { useEffect, useState } from 'react';
import { TutorialProvider } from './contexts/TutorialContext';
import { SitePlanProvider } from './contexts/SitePlanContext';
import { GeographyProvider } from './contexts/GeographyContext';
import SpaceStager from './components/SpaceStager';
import MobileLanding from './components/MobileLanding';

function App() {
  const [isSmallViewport, setIsSmallViewport] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768; // Tailwind 'md' breakpoint
  });

  useEffect(() => {
    const onResize = () => {
      setIsSmallViewport(window.innerWidth < 768);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (isSmallViewport) {
    return <MobileLanding />;
  }

  return (
    <TutorialProvider>
      <SitePlanProvider>
        <GeographyProvider>
          <SpaceStager />
        </GeographyProvider>
      </SitePlanProvider>
    </TutorialProvider>
  );
}

export default App;