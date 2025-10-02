import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import TrainLineCluster from '../MTA/TrainLineCluster';
import { parseTrainLines } from '../../utils/mtaUtils';

const DEV_MODE = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV;

const CATEGORY_CONFIG = {
  busStops: {
    id: 'busStops',
    icon: '/data/icons/layers/bus-stop.svg',
    accent: 'bg-sky-600/95 border-sky-700 text-white',
    getPrimaryLabel: (properties = {}) => {
      const raw = Array.isArray(properties.route_id)
        ? properties.route_id.join(', ')
        : properties.route_id || properties.routes || properties.route || '';
      if (typeof raw === 'string' && raw.trim()) {
        return raw.split(',')[0].trim();
      }
      return 'BUS';
    },
    getSecondaryLabel: (properties = {}) => {
      if (typeof properties.stop_name === 'string' && properties.stop_name.trim()) {
        return properties.stop_name.trim();
      }
      return null;
    }
  },
  parkingMeters: {
    id: 'parkingMeters',
    icon: '/data/icons/layers/parking-meter.svg',
    accent: 'bg-emerald-600/95 border-emerald-700 text-white',
    getPrimaryLabel: (properties = {}) => {
      const raw = properties.meter_number || properties.meter || properties.meter_id;
      if (typeof raw === 'string' && raw.trim()) {
        return raw.trim().slice(0, 6).toUpperCase();
      }
      return 'METER';
    },
    getSecondaryLabel: (properties = {}) => {
      const street = properties.on_street || properties.street_name || properties.street;
      if (typeof street === 'string' && street.trim()) {
        return street.trim();
      }
      return null;
    }
  },
  subwayEntrances: {
    id: 'subwayEntrances',
    icon: '/data/icons/layers/subway-entrance.svg',
    accent: 'bg-indigo-600/95 border-indigo-700 text-white',
    getTrainLines: (properties = {}) => {
      const candidates = [
        properties.train_lines, // Pre-parsed array
        properties.daytime_routes,
        properties.routes,
        properties.line,
        properties.lines,
        properties.route_id,
        properties.station_lines
      ];
      for (const value of candidates) {
        if (!value) continue;
        if (Array.isArray(value)) {
          return value.filter(item => item && String(item).trim());
        }
        if (typeof value === 'string' && value.trim()) {
          return parseTrainLines(value);
        }
      }
      return [];
    },
    getPrimaryLabel: (properties = {}) => {
      const lines = CATEGORY_CONFIG.subwayEntrances.getTrainLines(properties);
      return lines.length > 0 ? lines.join(' ') : 'SUB';
    },
    getSecondaryLabel: (properties = {}) => {
      const names = [properties.station_name, properties.name, properties.stop_name];
      for (const value of names) {
        if (typeof value === 'string' && value.trim()) {
          return value.trim();
        }
      }
      return null;
    }
  }
};

const DEFAULT_CATEGORIES = ['busStops', 'parkingMeters', 'subwayEntrances'];
const EARTH_RADIUS_METERS = 6371000;
const EDGE_PADDING_PX = 24;
const MAX_MARKERS = 8;

// Priority weights for sorting (lower = higher priority)
// These weights are multiplied by distance to create a weighted score
const CATEGORY_WEIGHTS = {
  subwayEntrances: 0.5,  // Highest priority
  busStops: 0.75,        // High priority
  parkingMeters: 1.0     // Normal priority
};

const toRadians = (deg) => (deg * Math.PI) / 180;

const haversineDistanceMeters = (aLng, aLat, bLng, bLat) => {
  const dLat = toRadians(bLat - aLat);
  const dLng = toRadians(bLng - aLng);
  const lat1 = toRadians(aLat);
  const lat2 = toRadians(bLat);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
};

const formatDistance = (meters) => {
  if (!Number.isFinite(meters) || meters <= 0) return null;
  if (meters < 400) {
    return `${Math.round(meters / 0.3048)} ft`;
  }
  return `${(meters / 1609.344).toFixed(meters < 1609 ? 1 : 1)} mi`;
};

const buildFeatureList = (collections, categories) => {
  const list = [];
  categories.forEach((category) => {
    const cfg = CATEGORY_CONFIG[category];
    if (!cfg) return;
    const features = collections?.[category]?.features;
    if (!Array.isArray(features)) return;
    features.forEach((feature, index) => {
      if (!feature || !feature.geometry || feature.geometry.type !== 'Point') return;
      const [lng, lat] = feature.geometry.coordinates || [];
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
      list.push({
        category,
        cfg,
        featureId: feature.id || feature.properties?.id || `${category}-${index}`,
        lng,
        lat,
        properties: feature.properties || {}
      });
    });
  });
  return list;
};

const EdgeMarkers = ({
  map,
  infrastructureData,
  categories = DEFAULT_CATEGORIES
}) => {
  const debugEnabled = useMemo(() => {
    if (DEV_MODE) return true;
    if (typeof window !== 'undefined' && window.__SPACE_STAGER_DEBUG_EDGE_MARKERS) return true;
    return false;
  }, []);

  const [markers, setMarkers] = useState([]);
  const frameRef = useRef(null);
  const isMovingRef = useRef(false);
  const animationLoopRef = useRef(null);
  const previousMarkerIdsRef = useRef(new Set());
  const previousMarkersRef = useRef([]);
  const [enteringMarkerIds, setEnteringMarkerIds] = useState(new Set());
  const [exitingMarkers, setExitingMarkers] = useState([]);

  const features = useMemo(() => {
    const list = buildFeatureList(infrastructureData, categories);
    if (debugEnabled) {
      try {
        const keys = infrastructureData ? Object.keys(infrastructureData) : [];
        console.debug('[EdgeMarkers] feature rebuild', {
          keys,
          categories,
          count: list.length
        });
      } catch (_) {}
    }
    return list;
  }, [infrastructureData, categories, debugEnabled]);

  const computeMarkers = useCallback(() => {
    if (!map || !features.length) {
      if (debugEnabled && map && infrastructureData) {
        try {
          const keys = Object.keys(infrastructureData || {});
          const details = categories.map((category) => {
            const collection = infrastructureData?.[category];
            return {
              category,
              hasCollection: !!collection,
              featureCount: Array.isArray(collection?.features) ? collection.features.length : 0
            };
          });
          console.debug('[EdgeMarkers] no features for active categories', { categories, keys, details });
        } catch (_) {}
      }
      return [];
    }

    if (typeof map.getSource === 'function') {
      const categoriesToCheck = categories.length ? categories : DEFAULT_CATEGORIES;
      const allSourcesMissing = categoriesToCheck.every((category) => {
        const sourceId = category === 'busStops' ? category : `source-${category}`;
        try {
          return !map.getSource(sourceId);
        } catch (_) {
          return true;
        }
      });
      if (allSourcesMissing) {
        if (debugEnabled) {
          try {
            console.debug('[EdgeMarkers] skipping computation (no map sources)', {
              categories: categoriesToCheck
            });
          } catch (_) {}
        }
        return [];
      }
    }

    const container = map.getContainer ? map.getContainer() : null;
    if (!container) return [];

    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height) return [];

    const centerLngLat = map.getCenter();
    const centerPoint = map.project(centerLngLat);

    const candidates = [];

    for (const item of features) {
      const projected = map.project([item.lng, item.lat]);
      
      // Only show edge markers for features that are outside the visible viewport
      if (
        projected.x >= 0 &&
        projected.x <= width &&
        projected.y >= 0 &&
        projected.y <= height
      ) {
        continue;
      }

      const distanceMeters = haversineDistanceMeters(
        centerLngLat.lng,
        centerLngLat.lat,
        item.lng,
        item.lat
      );

      candidates.push({
        ...item,
        projected,
        distanceMeters
      });
    }

    if (!candidates.length) {
      if (debugEnabled) {
        try {
          console.debug('[EdgeMarkers] no off-screen candidates', {
            featureCount: features.length,
            width,
            height
          });
        } catch (_) {}
      }
      return [];
    }

    // Weighted sort: prioritize subway/bus stops over parking meters
    // Lower weighted score = higher priority (shown first)
    candidates.sort((a, b) => {
      const weightA = CATEGORY_WEIGHTS[a.category] || 1.0;
      const weightB = CATEGORY_WEIGHTS[b.category] || 1.0;
      const scoreA = a.distanceMeters * weightA;
      const scoreB = b.distanceMeters * weightB;
      return scoreA - scoreB;
    });
    const limited = candidates.slice(0, MAX_MARKERS);

    const halfWidth = width / 2 - EDGE_PADDING_PX;
    const halfHeight = height / 2 - EDGE_PADDING_PX;

    const mapped = limited.map((item) => {
      const dx = item.projected.x - centerPoint.x;
      const dy = item.projected.y - centerPoint.y;
      const scale = Math.max(
        Math.abs(dx) / halfWidth || 1,
        Math.abs(dy) / halfHeight || 1
      );
      const clampedX = centerPoint.x + dx / scale;
      const clampedY = centerPoint.y + dy / scale;
      const x = Math.min(width - EDGE_PADDING_PX, Math.max(EDGE_PADDING_PX, clampedX));
      const y = Math.min(height - EDGE_PADDING_PX, Math.max(EDGE_PADDING_PX, clampedY));

      const angleToFeature = Math.atan2(item.projected.y - y, item.projected.x - x);
      const arrowRotation = (angleToFeature * 180) / Math.PI + 90;

      const primaryLabel = item.cfg.getPrimaryLabel(item.properties);
      const secondaryLabel = item.cfg.getSecondaryLabel(item.properties);
      const trainLines = item.cfg.getTrainLines ? item.cfg.getTrainLines(item.properties) : null;

      return {
        id: `${item.category}-${item.featureId}`,
        x,
        y,
        arrowRotation,
        primaryLabel,
        secondaryLabel,
        icon: item.cfg.icon,
        accentClass: item.cfg.accent,
        distanceText: formatDistance(item.distanceMeters),
        category: item.category,
        trainLines: trainLines
      };
    });

    if (debugEnabled) {
      try {
        console.debug('[EdgeMarkers] markers computed', {
          sample: mapped.slice(0, 5),
          total: mapped.length
        });
      } catch (_) {}
    }

    return mapped;
  }, [map, features, categories, debugEnabled]);

  useEffect(() => {
    if (!map) return () => {};

    const updateMarkers = () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
      frameRef.current = requestAnimationFrame(() => {
        setMarkers(computeMarkers());
      });
    };

    // Continuous animation loop for smooth updates during map movement
    const animationLoop = () => {
      if (isMovingRef.current) {
        setMarkers(computeMarkers());
        animationLoopRef.current = requestAnimationFrame(animationLoop);
      }
    };

    const handleMoveStart = () => {
      if (!isMovingRef.current) {
        isMovingRef.current = true;
        // Cancel any pending single-frame update
        if (frameRef.current) {
          cancelAnimationFrame(frameRef.current);
          frameRef.current = null;
        }
        // Start continuous animation loop for smooth 60fps updates
        animationLoop();
      }
    };

    const handleMoveEnd = () => {
      if (isMovingRef.current) {
        isMovingRef.current = false;
        // Cancel the animation loop
        if (animationLoopRef.current) {
          cancelAnimationFrame(animationLoopRef.current);
          animationLoopRef.current = null;
        }
        // Do one final update after movement ends
        updateMarkers();
      }
    };

    // Listen to movestart/moveend for smooth continuous updates during movement
    try { map.on('movestart', handleMoveStart); } catch (_) {}
    try { map.on('moveend', handleMoveEnd); } catch (_) {}

    // Still listen to other events for non-movement updates (zoom, rotate, pitch, resize)
    const staticEvents = ['zoom', 'rotate', 'pitch', 'resize'];
    staticEvents.forEach((event) => {
      try { map.on(event, updateMarkers); } catch (_) {}
    });

    // Initial update
    updateMarkers();

    return () => {
      // Clean up moving state
      isMovingRef.current = false;
      
      // Cancel any pending updates
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
      if (animationLoopRef.current) {
        cancelAnimationFrame(animationLoopRef.current);
      }
      
      // Remove event listeners
      try { map.off('movestart', handleMoveStart); } catch (_) {}
      try { map.off('moveend', handleMoveEnd); } catch (_) {}
      staticEvents.forEach((event) => {
        try { map.off(event, updateMarkers); } catch (_) {}
      });
    };
  }, [map, computeMarkers]);

  // Track entering and exiting markers for smooth transitions
  useEffect(() => {
    const currentIds = new Set(markers.map(m => m.id));
    const previousIds = previousMarkerIdsRef.current;
    const previousMarkers = previousMarkersRef.current;
    const newIds = new Set();
    const departingMarkers = [];

    // Find markers that are new (entering)
    currentIds.forEach(id => {
      if (!previousIds.has(id)) {
        newIds.add(id);
      }
    });

    // Find markers that are leaving (exiting)
    previousMarkers.forEach(marker => {
      if (!currentIds.has(marker.id)) {
        departingMarkers.push(marker);
      }
    });

    // Handle entering markers
    if (newIds.size > 0) {
      setEnteringMarkerIds(newIds);
      const enterTimer = setTimeout(() => {
        setEnteringMarkerIds(new Set());
      }, 200);
      
      previousMarkerIdsRef.current = currentIds;
      previousMarkersRef.current = markers;
      return () => clearTimeout(enterTimer);
    }

    // Handle exiting markers
    if (departingMarkers.length > 0) {
      setExitingMarkers(departingMarkers);
      const exitTimer = setTimeout(() => {
        setExitingMarkers([]);
      }, 200); // Keep them visible during exit animation
      
      previousMarkerIdsRef.current = currentIds;
      previousMarkersRef.current = markers;
      return () => clearTimeout(exitTimer);
    }

    previousMarkerIdsRef.current = currentIds;
    previousMarkersRef.current = markers;
  }, [markers]);

  useEffect(() => {
    if (!debugEnabled) return;
    try {
      console.debug('[EdgeMarkers] markers state updated', { count: markers.length, sample: markers.slice(0, 5) });
    } catch (_) {}
  }, [markers, debugEnabled]);

  // Combine current and exiting markers for rendering
  const exitingMarkerIds = new Set(exitingMarkers.map(m => m.id));
  const allMarkers = [
    ...markers,
    ...exitingMarkers.filter(m => !markers.some(cm => cm.id === m.id))
  ];

  if (!allMarkers.length) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[58] select-none" aria-hidden="true">
      {allMarkers.map((marker) => {
        const isEntering = enteringMarkerIds.has(marker.id);
        const isExiting = exitingMarkerIds.has(marker.id);
        return (
          <div
            key={marker.id}
            className="pointer-events-none absolute"
            style={{ 
              left: `${marker.x}px`, 
              top: `${marker.y}px`,
              opacity: isEntering ? 0 : isExiting ? 0 : 1,
              transform: isEntering ? 'scale(0.8)' : isExiting ? 'scale(0.8)' : 'scale(1)',
              transition: 'opacity 180ms ease-out, transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}
          >
          <svg
            className="absolute left-1/2 top-1/2 text-slate-700/60 dark:text-slate-200/60"
            style={{
              transform: `translate(-50%, -160%) rotate(${marker.arrowRotation}deg)`
            }}
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="currentColor"
          >
            <path d="M8 1l5 10H3z" />
          </svg>
          <div
            className={`flex items-center gap-2 rounded-full border px-2.5 py-1.5 shadow-md shadow-black/20 backdrop-blur-sm ${marker.accentClass}`}
            style={{ transform: 'translate(-50%, -50%)' }}
          >
            {marker.category === 'subwayEntrances' && marker.trainLines && marker.trainLines.length > 0 ? (
              <div className="flex items-center justify-center">
                <TrainLineCluster lines={marker.trainLines} size="small" maxVisible={3} />
              </div>
            ) : marker.icon ? (
              <img
                src={marker.icon}
                alt=""
                className="h-6 w-6 rounded-full bg-white/90 p-1 shadow-inner"
                draggable={false}
              />
            ) : (
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-xs font-bold text-slate-800">
                {marker.primaryLabel.slice(0, 2)}
              </div>
            )}
            <div className="flex flex-col leading-tight text-white">
              {marker.category === 'subwayEntrances' && marker.trainLines && marker.trainLines.length > 0 ? null : (
                <span className="text-[11px] font-semibold uppercase tracking-wide">
                  {marker.primaryLabel}
                </span>
              )}
              <div className="flex gap-2 text-[10px] font-medium text-white/80">
                {marker.distanceText && <span>{marker.distanceText}</span>}
                {marker.secondaryLabel && (
                  <span className="max-w-[140px] truncate">{marker.secondaryLabel}</span>
                )}
              </div>
            </div>
          </div>
        </div>
        );
      })}
    </div>
  );
};

export default EdgeMarkers;

