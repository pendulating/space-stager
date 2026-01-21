// src/App.jsx
import React, { useEffect, useState } from 'react';
import { useWindowSize } from './hooks/useWindowSize';
import { TutorialProvider } from './contexts/TutorialContext';
import { SitePlanProvider } from './contexts/SitePlanContext';
import { GeographyProvider } from './contexts/GeographyContext';
import { ZoneCreatorProvider } from './contexts/ZoneCreatorContext.jsx';
import { OpenStreetsProvider } from './contexts/OpenStreetsContext.jsx';
import SpaceStager from './components/SpaceStager';
import MobileLanding from './components/MobileLanding';
import { GeoclientAuthProvider } from './contexts/GeoclientAuthContext.jsx';

function App() {
  const { width } = useWindowSize();
  const [isSmallViewport, setIsSmallViewport] = useState(() => (typeof window === 'undefined' ? false : window.innerWidth < 768));

  useEffect(() => {
    setIsSmallViewport((width || 0) < 768);
  }, [width]);

  if (isSmallViewport) {
    return <MobileLanding />;
  }

  return (
    <TutorialProvider>
      <SitePlanProvider>
        <GeographyProvider>
          <ZoneCreatorProvider>
            <OpenStreetsProvider>
              <GeoclientAuthProvider>
                <SpaceStager />
              </GeoclientAuthProvider>
            </OpenStreetsProvider>
          </ZoneCreatorProvider>
        </GeographyProvider>
      </SitePlanProvider>
    </TutorialProvider>
  );
}

export default App;