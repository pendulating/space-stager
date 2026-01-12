// src/hooks/useZoneCreator.js
import { useCallback, useEffect, useRef } from 'react';
import { useGlobalKeymap } from './useGlobalKeymap';
import { useZoneCreatorContext, WORKFLOW_STEPS } from '../contexts/ZoneCreatorContext.jsx';
import * as turf from '@turf/turf';

// This hook wires map interactions for Step 1 (type toggle via context) and Step 2 (node selection)
// It only operates in intersections mode and when isActive is true.

export function useZoneCreator(map, geographyType) {
  const { 
    addNode, 
    selectedNodeIds, 
    selectedNodes, 
    widthFeet, 
    previewActive,
    setPreviewActive, 
    clearNodes,
    workflowStep,
    setWorkflowStep,
    setAvailableExtensions
  } = useZoneCreatorContext();
  const listenerRef = useRef({ click: null, mouseenter: null, mouseleave: null });
  const zoneLayerIdsRef = useRef({ line: null, fill: null });
  const pendingExtensionsRef = useRef([]);
  const isSettlingRef = useRef(false);

  // Visual feedback layer ids from intersections source
  const idPrefix = 'intersections';
  const layerId = `${idPrefix}-points`;

  // Listen for map settle to apply pending extensions
  useEffect(() => {
    if (!map) return;
    const onMoveEnd = () => {
      isSettlingRef.current = false;
      if (pendingExtensionsRef.current.length > 0) {
        const next = pendingExtensionsRef.current;
        setAvailableExtensions(prev => {
          if (prev.length === next.length && prev.every((ext, i) => ext.id === next[i].id)) {
            return prev;
          }
          return next;
        });
        pendingExtensionsRef.current = [];
      }
    };
    map.on('moveend', onMoveEnd);
    return () => map.off('moveend', onMoveEnd);
  }, [map, setAvailableExtensions]);

  // Connectivity helper: Find valid next intersections
  const findAvailableExtensions = useCallback((lastNode) => {
    if (!map || !lastNode) return [];
    try {
      const src = map.getSource('intersections');
      const data = src?._data || src?._options?.data;
      if (!data?.features) return [];

      const lastProps = lastNode.properties || {};
      const lastCoord = lastNode.coord;
      const lastStreets = [lastProps.FSN_1, lastProps.FSN_2].filter(Boolean);

      const allPossible = data.features
        .filter(f => {
          if (selectedNodeIds.includes(f.id)) return false;
          const fProps = f.properties || {};
          const fStreets = [fProps.FSN_1, fProps.FSN_2].filter(Boolean);
          
          // Must share at least one street
          const sharesStreet = lastStreets.some(s => fStreets.includes(s));
          if (!sharesStreet) return false;

          // Must be within reasonable distance (e.g. 500m for city blocks)
          const fCoord = f.geometry.coordinates;
          const dist = turf.distance(lastCoord, fCoord, { units: 'meters' });
          return dist < 500;
        })
        .map(f => {
          const fCoord = f.geometry.coordinates;
          const dist = turf.distance(lastCoord, fCoord, { units: 'meters' });
          return {
            id: f.id,
            coord: fCoord,
            properties: f.properties,
            dist,
            streetName: [f.properties.FSN_1, f.properties.FSN_2].find(s => lastStreets.includes(s))
          };
        });

      // Filter to only the NEAREST point for each shared street
      const nearestByStreet = {};
      allPossible.forEach(p => {
        if (!nearestByStreet[p.streetName] || p.dist < nearestByStreet[p.streetName].dist) {
          nearestByStreet[p.streetName] = p;
        }
      });

      return Object.values(nearestByStreet).sort((a, b) => a.dist - b.dist);
    } catch (_) {
      return [];
    }
  }, [map, selectedNodeIds]);

  // Update workflow step and available extensions based on state
  useEffect(() => {
    if (geographyType !== 'intersections') {
      if (workflowStep !== WORKFLOW_STEPS.IDLE) setWorkflowStep(WORKFLOW_STEPS.IDLE);
      return;
    }

    if (selectedNodeIds.length === 0) {
      if (workflowStep !== WORKFLOW_STEPS.PICK_START) setWorkflowStep(WORKFLOW_STEPS.PICK_START);
      setAvailableExtensions(prev => prev.length === 0 ? prev : []);
      pendingExtensionsRef.current = [];
    } else if (selectedNodeIds.length > 0 && !previewActive) {
      if (workflowStep !== WORKFLOW_STEPS.EXTEND_ZONE) setWorkflowStep(WORKFLOW_STEPS.EXTEND_ZONE);
      
      const lastNode = selectedNodes[selectedNodes.length - 1];
      const extensions = findAvailableExtensions(lastNode);
      
      // Clear current extensions immediately to avoid "ghost" pills during pan
      setAvailableExtensions(prev => prev.length === 0 ? prev : []);
      
      // If we are settling (panning), always defer.
      // Otherwise, check if map is already moving.
      if (isSettlingRef.current || (map && map.isMoving())) {
        pendingExtensionsRef.current = extensions;
      } else {
        setAvailableExtensions(extensions);
        pendingExtensionsRef.current = [];
      }
    } else if (previewActive) {
      if (workflowStep !== WORKFLOW_STEPS.PREVIEW) setWorkflowStep(WORKFLOW_STEPS.PREVIEW);
      setAvailableExtensions(prev => prev.length === 0 ? prev : []);
      pendingExtensionsRef.current = [];
    }
  }, [geographyType, selectedNodeIds, previewActive, selectedNodes, findAvailableExtensions, workflowStep, setAvailableExtensions, setWorkflowStep, map]);

  // Pan map to keep selection and extensions in view
  useEffect(() => {
    if (!map || workflowStep !== WORKFLOW_STEPS.EXTEND_ZONE) return;
    if (selectedNodes.length < 1) return;

    try {
      const lastNode = selectedNodes[selectedNodes.length - 1];
      if (map.easeTo) {
        isSettlingRef.current = true;
        map.easeTo({
          center: lastNode.coord,
          duration: 600,
          essential: true
        });
      }
    } catch (_) {}
  }, [map, selectedNodeIds.length, workflowStep]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync intersection nodes visibility based on workflow step
  useEffect(() => {
    if (!map || geographyType !== 'intersections') return;
    try {
      const visibility = (workflowStep === WORKFLOW_STEPS.PICK_START) ? 'visible' : 'none';
      if (map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', visibility);
    } catch (_) {}
  }, [map, geographyType, workflowStep, layerId]);

  // Highlight selected nodes by setting a feature-state flag
  const setSelectedState = useCallback((id, selected) => {
    if (!map) return;
    try {
      map.setFeatureState({ source: idPrefix, id }, { selected: !!selected });
    } catch (_) {}
  }, [map]);

  // Live preview of the zone during creation
  useEffect(() => {
    if (!map || geographyType !== 'intersections' || workflowStep !== WORKFLOW_STEPS.EXTEND_ZONE) {
      // Cleanup live layers if we leave the EXTEND_ZONE step
      try {
        if (map.getLayer('zone-creator-live-fill')) map.removeLayer('zone-creator-live-fill');
        if (map.getLayer('zone-creator-live-line')) map.removeLayer('zone-creator-live-line');
        if (map.getLayer('zone-creator-live-nodes')) map.removeLayer('zone-creator-live-nodes');
        if (map.getSource('zone-creator-live')) map.removeSource('zone-creator-live');
        if (map.getSource('zone-creator-live-nodes')) map.removeSource('zone-creator-live-nodes');
      } catch (_) {}
      return;
    }

    // Always update/add the nodes source to show selected points (start point, etc.)
    const nodeFc = {
      type: 'FeatureCollection',
      features: selectedNodes.map(n => ({
        type: 'Feature',
        id: n.id,
        geometry: { type: 'Point', coordinates: n.coord },
        properties: n.properties
      }))
    };

    try {
      if (!map.getSource('zone-creator-live-nodes')) {
        map.addSource('zone-creator-live-nodes', { type: 'geojson', data: nodeFc });
        map.addLayer({
          id: 'zone-creator-live-nodes',
          type: 'circle',
          source: 'zone-creator-live-nodes',
          paint: {
            'circle-color': '#2563eb',
            'circle-radius': 6,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff'
          }
        });
      } else {
        map.getSource('zone-creator-live-nodes').setData(nodeFc);
      }
    } catch (_) {}

    if (selectedNodes.length < 2) {
      try {
        if (map.getSource('zone-creator-live')) {
          map.getSource('zone-creator-live').setData({ type: 'FeatureCollection', features: [] });
        }
      } catch (_) {}
      return;
    }

    try {
      const coords = selectedNodes.map(n => n.coord).filter(Array.isArray);
      if (coords.length < 2) return;

      const line = turf.lineString(coords);
      const metersPerFoot = 0.3048;
      const halfWidthMeters = Math.max(1, (widthFeet * metersPerFoot) / 2);
      const buffered = turf.buffer(line, halfWidthMeters, { units: 'meters', steps: 16 });

      if (!map.getSource('zone-creator-live')) {
        map.addSource('zone-creator-live', { type: 'geojson', data: buffered });
        map.addLayer({
          id: 'zone-creator-live-fill',
          type: 'fill',
          source: 'zone-creator-live',
          paint: { 
            'fill-color': '#3b82f6', 
            'fill-opacity': 0.15 
          }
        });
        map.addLayer({
          id: 'zone-creator-live-line',
          type: 'line',
          source: 'zone-creator-live',
          paint: { 
            'line-color': '#3b82f6', 
            'line-width': 2,
            'line-dasharray': [2, 2]
          }
        });
      } else {
        map.getSource('zone-creator-live').setData(buffered);
      }
    } catch (_) {}
  }, [map, geographyType, workflowStep, selectedNodes, widthFeet]);

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
        const ids = selectedNodeIds;
        if (!ids || ids.length < 2) return;
        // Build a simple polyline by connecting selected node coordinates in order
        // Prefer live-captured coords so we don't depend on internal source fields
        const coords = (selectedNodes || []).map(n => n.coord).filter(Array.isArray);
        if (coords.length < 2) return;

        const line = turf.lineString(coords);
        // Convert width feet to meters; buffer takes radius (half width) in meters
        const metersPerFoot = 0.3048;
        const halfWidthMeters = Math.max(1, (widthFeet * metersPerFoot) / 2);
        const buffered = turf.buffer(line, halfWidthMeters, { units: 'meters', steps: 16 });
        if (!buffered) return;

        // Add/replace zone layers
        const lineId = 'zone-creator-path';
        const fillId = 'zone-creator-preview';
        zoneLayerIdsRef.current = { line: lineId, fill: fillId };

        try { if (map.getLayer(fillId)) map.removeLayer(fillId); } catch (_) {}
        try { if (map.getLayer(lineId)) map.removeLayer(lineId); } catch (_) {}
        try { if (map.getSource('zone-creator')) map.removeSource('zone-creator'); } catch (_) {}
        
        // Remove live layers
        try { if (map.getLayer('zone-creator-live-fill')) map.removeLayer('zone-creator-live-fill'); } catch (_) {}
        try { if (map.getLayer('zone-creator-live-line')) map.removeLayer('zone-creator-live-line'); } catch (_) {}
        try { if (map.getLayer('zone-creator-live-nodes')) map.removeLayer('zone-creator-live-nodes'); } catch (_) {}
        try { if (map.getSource('zone-creator-live')) map.removeSource('zone-creator-live'); } catch (_) {}
        try { if (map.getSource('zone-creator-live-nodes')) map.removeSource('zone-creator-live-nodes'); } catch (_) {}

        map.addSource('zone-creator', { type: 'geojson', data: buffered });
        map.addLayer({ id: fillId, type: 'fill', source: 'zone-creator', paint: { 'fill-color': '#2563eb', 'fill-opacity': 0.2 } });
        map.addLayer({ id: lineId, type: 'line', source: 'zone-creator', paint: { 'line-color': '#2563eb', 'line-width': 3 } });

        // Hide intersection nodes while previewing the zone
        try { map.setLayoutProperty(layerId, 'visibility', 'none'); } catch (_) {}

        // Zoom to fit buffered polygon
        const bb = turf.bbox(buffered);
        try { map.fitBounds([[bb[0], bb[1]], [bb[2], bb[3]]], { padding: 30, duration: 600, maxZoom: 20 }); } catch (_) {}
        // Snap bearing after fit to nearest 45° for design consistency
        try {
          const currentBearing = (typeof map.getBearing === 'function') ? map.getBearing() : 0;
          const snapped = (() => {
            const d = ((currentBearing % 360) + 360) % 360;
            const step = 45;
            return Math.round(d / step) * step;
          })();
          if (map.rotateTo) map.rotateTo(snapped, { duration: 300 });
        } catch (_) {}

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
        // Remove live layers
        try { if (map.getLayer('zone-creator-live-fill')) map.removeLayer('zone-creator-live-fill'); } catch (_) {}
        try { if (map.getLayer('zone-creator-live-line')) map.removeLayer('zone-creator-live-line'); } catch (_) {}
        try { if (map.getLayer('zone-creator-live-nodes')) map.removeLayer('zone-creator-live-nodes'); } catch (_) {}
        try { if (map.getSource('zone-creator-live')) map.removeSource('zone-creator-live'); } catch (_) {}
        try { if (map.getSource('zone-creator-live-nodes')) map.removeSource('zone-creator-live-nodes'); } catch (_) {}
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
        // Also clear any focused/hover outline specific to intersections mode
        try {
          const hoverFocusedId = `${idPrefix}-focused-points`;
          if (map.getLayer(hoverFocusedId)) map.setFilter(hoverFocusedId, ['==', ['id'], '']);
        } catch (_) {}
        // Clear node selections in context and reset preview state
        try { clearNodes(); } catch(_) {}
        try { setPreviewActive(false); } catch(_) {}
        pendingExtensionsRef.current = [];
      } catch (_) {}
    };
    window.addEventListener('zonecreator:reset', resetHandler);
    window.addEventListener('zonecreator:clear', resetHandler);
    return () => {
      window.removeEventListener('zonecreator:generate', handler);
      window.removeEventListener('zonecreator:reset', resetHandler);
      window.removeEventListener('zonecreator:clear', resetHandler);
    };
  }, [map, selectedNodeIds, selectedNodes, widthFeet, clearNodes, setPreviewActive, layerId, idPrefix]);

  // Install listeners to capture node clicks (always on in intersections mode)
  useEffect(() => {
    if (!map) return;
    if (geographyType !== 'intersections') return cleanup();

    const onClick = (e) => {
      if (!e?.features?.length) return;
      
      // If we're already extending, clicks on the map points should be disabled in favor of pills
      // unless we want to keep them as a fallback. The user said "ONLY valid, connected sequences...".
      // Let's restrict clicking to only the START point.
      if (workflowStep !== WORKFLOW_STEPS.PICK_START) return;

      const feat = e.features[0];
      const id = feat?.id;
      if (id === undefined || id === null) return;
      const coord = feat?.geometry?.type === 'Point' ? feat.geometry.coordinates : [e.lngLat?.lng, e.lngLat?.lat].filter(v => typeof v === 'number').length === 2 ? [e.lngLat.lng, e.lngLat.lat] : undefined;
      // Enforce max node count
      const maxNodes = 12;
      if (selectedNodeIds.length >= maxNodes) return;
      if (Array.isArray(coord)) {
        addNode(id, coord, feat.properties);
        
        // Guided view change: Zoom in on first pick
        if (selectedNodeIds.length === 0 && map.easeTo) {
          isSettlingRef.current = true;
          map.easeTo({
            center: coord,
            zoom: 18,
            duration: 800,
            essential: true
          });
        }

        // Immediate visual feedback
        try { setSelectedState(id, true); } catch (_) {}
      }
    };

    const onEnter = () => { try { map.getCanvas().style.cursor = 'crosshair'; } catch (_) {} };
    const onLeave = () => { try { map.getCanvas().style.cursor = ''; } catch (_) {} };

    try { 
      map.on('click', layerId, onClick); 
    } catch (_) {}
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
  }, [map, geographyType, addNode, selectedNodeIds, setSelectedState, workflowStep, layerId]);

  // Global ESC handler to clear current in-progress selection
  useGlobalKeymap([
    {
      key: 'Escape',
      onEvent: () => {
        try { const evt = new CustomEvent('zonecreator:clear'); window.dispatchEvent(evt); } catch (_) {}
      },
      priority: 55
    }
  ]);

  return {
    selectedNodeIds
  };
}


