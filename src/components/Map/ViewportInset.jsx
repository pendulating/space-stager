import React, { useEffect, useMemo, useState } from 'react';

const NYC_BOUNDS = {
  minLng: -74.258,
  maxLng: -73.700,
  minLat: 40.477,
  maxLat: 40.917
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const isWithinBounds = ({ lng, lat }) => (
  lng >= NYC_BOUNDS.minLng &&
  lng <= NYC_BOUNDS.maxLng &&
  lat >= NYC_BOUNDS.minLat &&
  lat <= NYC_BOUNDS.maxLat
);

const ViewportInset = ({ map, mapLoaded, permitAreas, responsive, isSitePlanMode = false, isRightSidebarOpen = false }) => {
  const [viewportBounds, setViewportBounds] = useState(() => ({ 
    north: null, 
    south: null, 
    east: null, 
    west: null 
  }));
  const [screenSize, setScreenSize] = useState(() => ({ width: typeof window === 'undefined' ? 0 : window.innerWidth }));

  useEffect(() => {
    if (!map || !mapLoaded) return undefined;

    const updateViewportBounds = () => {
      try {
        const bounds = map.getBounds();
        if (!bounds) return;
        setViewportBounds({
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest()
        });
      } catch (_) {
        // ignore
      }
    };

    // Prime immediately once ready, then subscribe to camera updates
    updateViewportBounds();
    map.on('move', updateViewportBounds);
    map.on('moveend', updateViewportBounds);

    return () => {
      try { map.off('move', updateViewportBounds); } catch (_) {}
      try { map.off('moveend', updateViewportBounds); } catch (_) {}
    };
  }, [map, mapLoaded]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const updateSize = () => {
      setScreenSize({ width: window.innerWidth });
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const viewportRect = useMemo(() => {
    if (viewportBounds.north == null || viewportBounds.south == null || 
        viewportBounds.east == null || viewportBounds.west == null) return null;

    // Check if any part of the viewport is within NYC bounds
    const overlaps = !(
      viewportBounds.east < NYC_BOUNDS.minLng ||
      viewportBounds.west > NYC_BOUNDS.maxLng ||
      viewportBounds.north < NYC_BOUNDS.minLat ||
      viewportBounds.south > NYC_BOUNDS.maxLat
    );

    // Calculate the center to determine if fully within bounds
    const centerLng = (viewportBounds.west + viewportBounds.east) / 2;
    const centerLat = (viewportBounds.north + viewportBounds.south) / 2;
    const fullyWithin = isWithinBounds({ lng: centerLng, lat: centerLat });

    // Normalize viewport bounds to 0..1 in both axes with north at top
    // Clamp to NYC bounds for rendering
    const westClamped = clamp(viewportBounds.west, NYC_BOUNDS.minLng, NYC_BOUNDS.maxLng);
    const eastClamped = clamp(viewportBounds.east, NYC_BOUNDS.minLng, NYC_BOUNDS.maxLng);
    const northClamped = clamp(viewportBounds.north, NYC_BOUNDS.minLat, NYC_BOUNDS.maxLat);
    const southClamped = clamp(viewportBounds.south, NYC_BOUNDS.minLat, NYC_BOUNDS.maxLat);

    // Convert to normalized coordinates (0..1)
    const leftNorm = (westClamped - NYC_BOUNDS.minLng) / (NYC_BOUNDS.maxLng - NYC_BOUNDS.minLng);
    const rightNorm = (eastClamped - NYC_BOUNDS.minLng) / (NYC_BOUNDS.maxLng - NYC_BOUNDS.minLng);
    const topNorm = (NYC_BOUNDS.maxLat - northClamped) / (NYC_BOUNDS.maxLat - NYC_BOUNDS.minLat);
    const bottomNorm = (NYC_BOUNDS.maxLat - southClamped) / (NYC_BOUNDS.maxLat - NYC_BOUNDS.minLat);

    return {
      overlaps,
      fullyWithin,
      leftPct: leftNorm * 100,
      topPct: topNorm * 100,
      widthPct: (rightNorm - leftNorm) * 100,
      heightPct: (bottomNorm - topNorm) * 100
    };
  }, [viewportBounds]);

  const shouldRender = useMemo(() => {
    if (!map || !mapLoaded) return false;
    if (!viewportRect) return false;
    if (!responsive || responsive.sidebarMode === 'icon-rail') {
      return screenSize.width > 768;
    }
    return true;
  }, [map, mapLoaded, viewportRect, responsive, screenSize.width]);

  if (!shouldRender) return null;

  const { overlaps, fullyWithin, leftPct, topPct, widthPct, heightPct } = viewportRect;

  // Position inset with 16px margin from the right edge of the map container
  // The parent MapContainer handles its own width transitions when sidebar opens/closes
  // and the inset glides along with it via CSS transitions
  const offsetY = 72;

  const insetRight = '16px';

  return (
    <div
      className="pointer-events-none select-none absolute"
      style={{
        bottom: offsetY,
        right: insetRight,
        width: 150,
        height: 150,
        borderRadius: 16,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        boxShadow: '0 20px 40px rgba(15, 23, 42, 0.45)',
        zIndex: 55
      }}
    >
      <div
        className="relative w-full h-full"
        style={{
          borderRadius: 12,
          overflow: 'hidden',
          border: '1px solid rgba(255, 255, 255, 0.35)',
          backgroundImage: "url('/static/nybb.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        <div className="absolute inset-0" style={{ background: 'linear-gradient(145deg, rgba(148, 163, 184, 0.45), rgba(15, 23, 42, 0.2))' }} />
        <div className="absolute inset-3 rounded-lg border border-white/20" />
        {/* Viewport rectangle indicator */}
        <div
          className="absolute"
          style={{
            left: `${leftPct}%`,
            top: `${topPct}%`,
            width: `${widthPct}%`,
            height: `${heightPct}%`,
            pointerEvents: 'none'
          }}
        >
          <div
            className="w-full h-full rounded-sm"
            style={{
              border: fullyWithin 
                ? '2px solid rgba(249, 115, 22, 0.9)' 
                : '2px solid rgba(148, 163, 184, 0.9)',
              backgroundColor: fullyWithin
                ? 'rgba(249, 115, 22, 0.15)'
                : 'rgba(148, 163, 184, 0.15)',
              boxShadow: fullyWithin
                ? '0 0 0 1px rgba(255, 255, 255, 0.6), inset 0 0 8px rgba(249, 115, 22, 0.3)'
                : '0 0 0 1px rgba(255, 255, 255, 0.6), inset 0 0 8px rgba(148, 163, 184, 0.3)'
            }}
          />
        </div>
        <div
          className="absolute left-3 bottom-3 text-[11px] tracking-[0.15em] font-semibold uppercase text-white/85 bg-slate-900/65 px-2 py-1 rounded"
        >
          Context
        </div>
        {!fullyWithin && overlaps && (
          <div
            className="absolute inset-x-3 top-3 text-[11px] font-medium text-yellow-100 bg-amber-500/80 px-2 py-1 rounded"
          >
            Partially outside bounds
          </div>
        )}
        {!overlaps && (
          <div
            className="absolute inset-x-3 top-3 text-[11px] font-medium text-yellow-100 bg-amber-500/80 px-2 py-1 rounded"
          >
            Outside city bounds
          </div>
        )}
      </div>
    </div>
  );
};

export default ViewportInset;

