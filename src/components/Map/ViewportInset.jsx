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
  const [center, setCenter] = useState(() => ({ lng: null, lat: null }));
  const [screenSize, setScreenSize] = useState(() => ({ width: typeof window === 'undefined' ? 0 : window.innerWidth }));

  useEffect(() => {
    if (!map || !mapLoaded) return undefined;

    const updateCenter = () => {
      try {
        const c = map.getCenter();
        if (!c) return;
        setCenter({ lng: c.lng, lat: c.lat });
      } catch (_) {
        // ignore
      }
    };

    // Prime immediately once ready, then subscribe to camera updates
    updateCenter();
    map.on('move', updateCenter);
    map.on('moveend', updateCenter);

    return () => {
      try { map.off('move', updateCenter); } catch (_) {}
      try { map.off('moveend', updateCenter); } catch (_) {}
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

  const markerPosition = useMemo(() => {
    if (center.lng == null || center.lat == null) return null;

    const within = isWithinBounds(center);
    // Normalize to 0..1 in both axes with north at top
    const nx = (center.lng - NYC_BOUNDS.minLng) / (NYC_BOUNDS.maxLng - NYC_BOUNDS.minLng);
    const ny = (NYC_BOUNDS.maxLat - center.lat) / (NYC_BOUNDS.maxLat - NYC_BOUNDS.minLat);
    const clampedX = clamp(nx, 0, 1);
    const clampedY = clamp(ny, 0, 1);

    return {
      within,
      leftPct: clampedX * 100,
      topPct: clampedY * 100
    };
  }, [center]);

  const shouldRender = useMemo(() => {
    if (!map || !mapLoaded) return false;
    if (!markerPosition) return false;
    if (!responsive || responsive.sidebarMode === 'icon-rail') {
      return screenSize.width > 768;
    }
    return true;
  }, [map, mapLoaded, markerPosition, responsive, screenSize.width]);

  if (!shouldRender) return null;

  const { within, leftPct, topPct } = markerPosition;

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
        <div
          className="absolute"
          style={{
            left: `${leftPct}%`,
            top: `${topPct}%`,
            transform: 'translate(-50%, -50%) scale(1)',
            transition: 'transform 0.2s ease-out'
          }}
        >
          <div
            className="w-5 h-5 rounded-full"
            style={{
              boxShadow: '0 0 0 5px rgba(255, 255, 255, 0.85)',
              background: within ? 'linear-gradient(135deg, #f97316, #ea580c)' : 'linear-gradient(135deg, #94a3b8, #475569)'
            }}
          />
        </div>
        <div
          className="absolute left-3 bottom-3 text-[11px] tracking-[0.15em] font-semibold uppercase text-white/85 bg-slate-900/65 px-2 py-1 rounded"
        >
          Context
        </div>
        {!within && (
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

