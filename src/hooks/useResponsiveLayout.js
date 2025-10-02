import { useMemo } from 'react';
import { useWindowSize } from './useWindowSize.js';

const BREAKPOINTS = {
  laptop: 1440,
  compact: 1280,
  tablet: 1024,
};

export function useResponsiveLayout() {
  const { width } = useWindowSize();

  return useMemo(() => {
    const isLaptop = width > 0 && width <= BREAKPOINTS.laptop;
    const isCompact = width > 0 && width <= BREAKPOINTS.compact;
    const isTablet = width > 0 && width <= BREAKPOINTS.tablet;

    return {
      width,
      isLaptop,
      isCompact,
      isTablet,
      sidebarMode: isCompact ? 'icon-rail' : 'expanded',
    };
  }, [width]);
}


