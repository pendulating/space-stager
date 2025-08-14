// src/hooks/useZoneCreator.js
import { useCallback, useEffect, useRef } from 'react';
import { useZoneCreatorContext, PRIMARY_TYPES } from '../contexts/ZoneCreatorContext.jsx';
import * as turf from '@turf/turf';

// This hook wires map interactions for Step 1 (type toggle via context) and Step 2 (node selection)
// It only operates in intersections mode and when isActive is true.

export function useZoneCreator(map, geographyType) {
  const { addNode, selectedNodeIds, selectedNodes, primaryType, widthFeet, setPreviewActive, clearNodes } = useZoneCreatorContext();
  const listenerRef = useRef({ click: null, mouseenter: null, mouseleave: null });
  const zoneLayerIdsRef = useRef({ line: null, fill: null });

  // Visual feedback layer ids from intersections source
  const idPrefix = 'intersections';
  const layerId = `${idPrefix}-points`;

  // Highlight selected nodes by setting a feature-state flag
  const setSelectedState = useCallback((id, selected) => {
    if (!map) return;
    try {
      map.setFeatureState({ source: idPrefix, id }, { selected: !!selected });
    } catch (_) {}
  }, [map]);

  // Sync feature-state to reflect current selectedNodeIds
  useEffect(() => {
    if (!map) return;
    let cancelled = false;
    // brute-force resync: clear all and re-apply current selection if needed
    // Note: intersections source uses generateId: true so ids are stable for session
    (async () => {
      if (cancelled) return;
      try {
        const src = map.getSource(idPrefix);
        if (!src) return;
        const data = src._data || src._options?.data || null;
        if (!data || !data.features) return;
        for (const f of data.features) {
          if (f && (f.id !== undefined && f.id !== null)) {
            setSelectedState(f.id, selectedNodeIds.includes(f.id));
          }
        }
      } catch (_) {}
    })();
    return () => { cancelled = true; };
  }, [map, selectedNodeIds, setSelectedState]);

  // Generate zone: compute rectangular buffer around centerline between selected nodes, draw layer, hide nodes, zoom to fit
  useEffect(() => {
    if (!map) return;
    const handler = async () => {
      try {
        console.log('[ZoneCreator] Generate event received');
        const ids = selectedNodeIds;
        if (!ids || ids.length < 2) { console.warn('[ZoneCreator] Need at least 2 nodes'); return; }
        // Build a simple polyline by connecting selected node coordinates in order
        // Prefer live-captured coords so we don't depend on internal source fields
        const coords = (selectedNodes || []).map(n => n.coord).filter(Array.isArray);
        if (coords.length < 2) { console.warn('[ZoneCreator] not enough coordinates resolved from ids', { ids, resolved: coords.length }); return; }

        const line = turf.lineString(coords);
        // Convert width feet to meters; buffer takes radius (half width) in meters
        const metersPerFoot = 0.3048;
        const halfWidthMeters = Math.max(1, (widthFeet * metersPerFoot) / 2);
        console.log('[ZoneCreator] Buffering line', { coordsCount: coords.length, widthFeet, halfWidthMeters });
        const buffered = turf.buffer(line, halfWidthMeters, { units: 'meters', steps: 16 });
        if (!buffered) { console.warn('[ZoneCreator] buffer result undefined'); return; }

        // Add/replace zone layers
        const lineId = 'zone-creator-path';
        const fillId = 'zone-creator-preview';
        zoneLayerIdsRef.current = { line: lineId, fill: fillId };

        try { if (map.getLayer(fillId)) map.removeLayer(fillId); } catch (_) {}
        try { if (map.getLayer(lineId)) map.removeLayer(lineId); } catch (_) {}
        try { if (map.getSource('zone-creator')) map.removeSource('zone-creator'); } catch (_) {}
        console.log('[ZoneCreator] Adding preview layers');
        map.addSource('zone-creator', { type: 'geojson', data: buffered });
        map.addLayer({ id: fillId, type: 'fill', source: 'zone-creator', paint: { 'fill-color': '#2563eb', 'fill-opacity': 0.2 } });
        map.addLayer({ id: lineId, type: 'line', source: 'zone-creator', paint: { 'line-color': '#2563eb', 'line-width': 3 } });

        // Hide intersection nodes while previewing the zone
        try { console.log('[ZoneCreator] Hiding intersection nodes'); map.setLayoutProperty(layerId, 'visibility', 'none'); } catch (_) {}

        // Zoom to fit buffered polygon
        const bb = turf.bbox(buffered);
        console.log('[ZoneCreator] Fitting bounds', { bbox: bb });
        try { map.fitBounds([[bb[0], bb[1]], [bb[2], bb[3]]], { padding: 30, duration: 600, maxZoom: 20 }); } catch (_) {}

        // Mark preview as active to show Exit button/UI
        try { setPreviewActive(true); } catch(_) {}

        // Notify system to enter siteplan design with this generated zone
        const feature = {
          type: 'Feature',
          id: 'zonecreator-preview',
          properties: { name: 'Custom Street Zone' },
          geometry: buffered.geometry
        };
        try {
          const evtFocus = new CustomEvent('zonecreator:focus', { detail: { feature } });
          window.dispatchEvent(evtFocus);
        } catch (_) {}
      } catch (_) {}
    };
    window.addEventListener('zonecreator:generate', handler);
    const resetHandler = async () => {
      try {
        // Remove preview layers/source
        try { if (map.getLayer('zone-creator-preview')) map.removeLayer('zone-creator-preview'); } catch (_) {}
        try { if (map.getLayer('zone-creator-path')) map.removeLayer('zone-creator-path'); } catch (_) {}
        try { if (map.getSource('zone-creator')) map.removeSource('zone-creator'); } catch (_) {}
        // Re-show intersection nodes
        try { map.setLayoutProperty(layerId, 'visibility', 'visible'); } catch (_) {}
        // Clear selection highlight states – first explicitly clear for selected ids
        try {
          const idsToClear = Array.isArray(selectedNodeIds) ? [...new Set(selectedNodeIds)] : [];
          for (const id of idsToClear) {
            try { map.setFeatureState({ source: idPrefix, id }, { selected: false, hoverProgress: 0 }); } catch (_) {}
          }
        } catch (_) {}
        // Then clear any residual feature-states from source data
        try {
          const src = map.getSource(idPrefix);
          const data = src?._data || src?._options?.data;
          if (data?.features) {
            for (const f of data.features) {
              if (f && (f.id !== undefined && f.id !== null)) {
                try { map.setFeatureState({ source: idPrefix, id: f.id }, { selected: false, hoverProgress: 0 }); } catch (_) {}
              }
            }
          }
        } catch (_) {}
        // Clear node selections in context and reset preview state
        try { clearNodes(); } catch(_) {}
        try { setPreviewActive(false); } catch(_) {}
      } catch (_) {}
    };
    window.addEventListener('zonecreator:reset', resetHandler);
    return () => {
      window.removeEventListener('zonecreator:generate', handler);
      window.removeEventListener('zonecreator:reset', resetHandler);
    };
  }, [map, selectedNodeIds, selectedNodes, widthFeet]);

  // Install listeners to capture node clicks (always on in intersections mode)
  useEffect(() => {
    if (!map) return;
    if (geographyType !== 'intersections') return cleanup();

    const onClick = (e) => {
      if (!e?.features?.length) return;
      const feat = e.features[0];
      const id = feat?.id;
      if (id === undefined || id === null) return;
      const coord = feat?.geometry?.type === 'Point' ? feat.geometry.coordinates : [e.lngLat?.lng, e.lngLat?.lat].filter(v => typeof v === 'number').length === 2 ? [e.lngLat.lng, e.lngLat.lat] : undefined;
      // Enforce max node count based on type
      const maxNodes = primaryType === PRIMARY_TYPES.SINGLE_BLOCK ? 2 : 12;
      if (selectedNodeIds.length >= maxNodes) return;
      if (Array.isArray(coord)) {
        addNode(id, coord);
        // Immediate visual feedback
        try { setSelectedState(id, true); } catch (_) {}
      }
    };

    const onEnter = () => { try { map.getCanvas().style.cursor = 'crosshair'; } catch (_) {} };
    const onLeave = () => { try { map.getCanvas().style.cursor = ''; } catch (_) {} };

    try { map.on('click', layerId, onClick); } catch (_) {}
    try { map.on('mouseenter', layerId, onEnter); } catch (_) {}
    try { map.on('mouseleave', layerId, onLeave); } catch (_) {}

    listenerRef.current.click = onClick;
    listenerRef.current.mouseenter = onEnter;
    listenerRef.current.mouseleave = onLeave;

    return cleanup;

    function cleanup() {
      try { if (listenerRef.current.click) map.off('click', layerId, listenerRef.current.click); } catch (_) {}
      try { if (listenerRef.current.mouseenter) map.off('mouseenter', layerId, listenerRef.current.mouseenter); } catch (_) {}
      try { if (listenerRef.current.mouseleave) map.off('mouseleave', layerId, listenerRef.current.mouseleave); } catch (_) {}
      listenerRef.current = { click: null, mouseenter: null, mouseleave: null };
    }
  }, [map, geographyType, addNode, selectedNodeIds, primaryType, setSelectedState]);

  // Global ESC handler to clear current in-progress selection
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        try {
          const evt = new CustomEvent('zonecreator:clear');
          window.dispatchEvent(evt);
        } catch (_) {}
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return {
    selectedNodeIds
  };
}


