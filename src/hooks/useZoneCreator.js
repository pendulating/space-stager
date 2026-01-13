// src/hooks/useZoneCreator.js
import { useCallback, useEffect, useRef } from 'react';
import { useGlobalKeymap } from './useGlobalKeymap';
import { useZoneCreatorContext, WORKFLOW_STEPS } from '../contexts/ZoneCreatorContext.jsx';
import * as turf from '@turf/turf';
import { analyzeTurnRadii, generateSweptPath } from '../utils/safetyUtils';
import { autoDetectPedestrianDemand } from '../services/pedestrianDemandService';

// This hook wires map interactions for Step 1 (type toggle via context) and Step 2 (node selection)
// It only operates in intersections mode and when isActive is true.

import { INFRASTRUCTURE_ENDPOINTS } from '../constants/endpoints';
import { expandBounds } from '../utils/geometryUtils';

export function useZoneCreator(map, geographyType) {
  const { 
    addNode, 
    selectedNodeIds, 
    selectedNodes, 
    widthFeet, 
    setWidthFeet,
    previewActive,
    setPreviewActive, 
    clearNodes,
    workflowStep,
    setWorkflowStep,
    setAvailableExtensions,
    setEmergencyLaneGeometry,
    setSidewalkClearPathFt,
    setPmpClassification
  } = useZoneCreatorContext();

  // Auto-detect road + sidewalk width from CSCL
  useEffect(() => {
    if (selectedNodes.length < 1) return;

    const detectWidth = async () => {
      try {
        const nodes = selectedNodes;
        const lastNode = nodes[nodes.length - 1];
        const prevNode = nodes.length >= 2 ? nodes[nodes.length - 2] : null;
        const coord = lastNode.coord;
        
        const ep = INFRASTRUCTURE_ENDPOINTS.csclCenterlines;
        if (!ep?.baseUrl) return;

        let queryUrl;
        // Use physicalid for exact match if available (from extension pills)
        const physicalid = lastNode.properties?.physicalid;
        
        if (physicalid) {
          queryUrl = `${ep.baseUrl}?physicalid=${physicalid}&$select=the_geom,streetwidth,full_street_name,stname_label`;
        } else if (prevNode) {
          // Use the segment connecting last two nodes for more precise detection
          const p1 = prevNode.coord, p2 = lastNode.coord;
          const wktLine = `LINESTRING(${p1[0]} ${p1[1]}, ${p2[0]} ${p2[1]})`;
          const select = encodeURIComponent('the_geom,streetwidth,full_street_name,stname_label');
          const where = encodeURIComponent(`intersects(${ep.geoField}, '${wktLine}')`);
          queryUrl = `${ep.baseUrl}?$where=${where}&$select=${select}&$limit=5`;
        } else {
          // Fallback to radius search around start point
          const expanded = expandBounds([coord, coord], 0.0005);
          const minLng = expanded[0][0], minLat = expanded[0][1];
          const maxLng = expanded[1][0], maxLat = expanded[1][1];
          const wktPoly = `POLYGON((${minLng} ${minLat}, ${minLng} ${maxLat}, ${maxLng} ${maxLat}, ${maxLng} ${minLat}, ${minLng} ${minLat}))`;
          const select = encodeURIComponent('the_geom,streetwidth,full_street_name,stname_label');
          const where = encodeURIComponent(`intersects(${ep.geoField}, '${wktPoly}')`);
          queryUrl = `${ep.baseUrl}?$where=${where}&$select=${select}&$limit=10`;
        }

        console.log(`[ZoneCreator] Width detection query: ${queryUrl}`);
        const resp = await fetch(queryUrl);
        if (!resp.ok) return;
        const results = await resp.json();
        
        // Handle both FeatureCollection (geojson) and Array (json)
        const features = Array.isArray(results) ? results : (results.features || []);
        
        if (features.length > 0) {
          // Find the feature closest to our node(s)
          let nearest = features[0];
          const getGeom = (f) => f.geometry || f.the_geom;
          const getProps = (f) => f.properties || f;

          if (features.length > 1) {
            let minDist = turf.pointToLineDistance(turf.point(coord), getGeom(nearest));
            for (let i = 1; i < features.length; i++) {
              const dist = turf.pointToLineDistance(turf.point(coord), getGeom(features[i]));
              if (dist < minDist) {
                minDist = dist;
                nearest = features[i];
              }
            }
          }

          const props = getProps(nearest);
          const roadwayWidth = parseFloat(props.streetwidth);
          
          if (!isNaN(roadwayWidth) && roadwayWidth > 0) {
            // Heuristic for total width: roadway + 30ft (15ft sidewalks each side)
            // unless we find sidewalk polygons. 
            let totalWidth = roadwayWidth + 30; 
            
            try {
              const swEp = INFRASTRUCTURE_ENDPOINTS.sidewalks;
              if (swEp?.baseUrl) {
                const bufferMeters = 30; 
                const buffered = turf.buffer({ type: 'Feature', geometry: getGeom(nearest) }, bufferMeters, { units: 'meters' });
                const swWhere = encodeURIComponent(`intersects(${swEp.geoField}, '${JSON.stringify(buffered.geometry)}')`);
                const swUrl = `${swEp.baseUrl}?$where=${swWhere}&$limit=20`;
                
                const swResp = await fetch(swUrl);
                if (swResp.ok) {
                  const swResults = await swResp.json();
                  const swFeatures = Array.isArray(swResults) ? swResults : (swResults.features || []);
                  
                  if (swFeatures.length >= 2) {
                    const swWidths = swFeatures.map(f => {
                      const p = getProps(f);
                      const area = parseFloat(p.shape_area);
                      const len = parseFloat(p.shape_leng);
                      return (area && len && len > 0) ? (area / len) : 15;
                    });
                    const validWidths = swWidths.filter(w => w > 5 && w < 40);
                    if (validWidths.length > 0) {
                      const avgSw = validWidths.reduce((a, b) => a + b, 0) / validWidths.length;
                      totalWidth = roadwayWidth + (avgSw * 2);
                    }
                  }
                }
              }
            } catch (swErr) {
              console.warn('[ZoneCreator] Sidewalk width detection failed, using fallback:', swErr);
            }

            totalWidth = Math.round(totalWidth);

            if (Math.abs(totalWidth - widthFeet) >= 1) {
              console.log(`[ZoneCreator] AUTO-SETTING WIDTH: ${totalWidth}ft (roadway: ${roadwayWidth}) for ${props.full_street_name || props.stname_label || 'unknown'}`);
              setWidthFeet(totalWidth);
            }
          }
        }
      } catch (err) {
        console.warn('[ZoneCreator] Failed to auto-detect width:', err);
      }
    };

    detectWidth();
  }, [selectedNodes.length, setWidthFeet]); // Only re-run when a new node is added
  const listenerRef = useRef({ click: null, mouseenter: null, mouseleave: null });
  const zoneLayerIdsRef = useRef({ line: null, fill: null, emergency: null });
  const pendingExtensionsRef = useRef([]);
  const isSettlingRef = useRef(false);

  // Auto-detect pedestrian demand classification
  useEffect(() => {
    if (selectedNodes.length < 2) {
      setPmpClassification(null);
      return;
    }

    const timer = setTimeout(async () => {
      const coords = selectedNodes.map(n => n.coord);
      const detection = await autoDetectPedestrianDemand(coords);
      if (detection) {
        setPmpClassification(detection);
        // Automatically set the clear path based on detection to minimize user burden
        setSidewalkClearPathFt(detection.clearPathFt);
      }
    }, 1000); // Debounce to avoid excessive API calls during rapid extension

    return () => clearTimeout(timer);
  }, [selectedNodes, setPmpClassification, setSidewalkClearPathFt]);

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

  // Connectivity helper: Find valid next intersections using CSCL API
  const findAvailableExtensions = useCallback(async (lastNode) => {
    if (!map || !lastNode || !lastNode.coord) return [];
    try {
      const lastCoord = lastNode.coord;
      const ep = INFRASTRUCTURE_ENDPOINTS.csclCenterlines;
      if (!ep?.baseUrl) return [];

      // Use a slightly larger bounding box to handle precision and intersection gaps
      const buffer = 0.0002; // ~20m
      const minLng = lastCoord[0] - buffer, maxLng = lastCoord[0] + buffer;
      const minLat = lastCoord[1] - buffer, maxLat = lastCoord[1] + buffer;
      const wktPoly = `POLYGON((${minLng} ${minLat}, ${minLng} ${maxLat}, ${maxLng} ${maxLat}, ${maxLng} ${minLat}, ${minLng} ${minLat}))`;
      
      const where = encodeURIComponent(`intersects(${ep.geoField}, '${wktPoly}')`);
      const select = encodeURIComponent('the_geom,streetwidth,full_street_name,physicalid');
      const url = `${ep.baseUrl}?$where=${where}&$select=${select}&$limit=40`;

      console.log(`[ZoneCreator] Extension query: ${url}`);
      const resp = await fetch(url);
      if (!resp.ok) {
        console.error(`[ZoneCreator] Extension fetch failed: ${resp.status}`);
        return [];
      }
      const gj = await resp.json();
      
      // Handle both FeatureCollection and JSON array
      const features = gj.features || (Array.isArray(gj) ? gj : []);
      console.log(`[ZoneCreator] API returned ${features.length} features`);
      
      const allPossible = [];
      const seenCoords = new Set();
      // Filter out the current point and very close points
      const lastCoordKey = lastCoord.map(c => c.toFixed(5)).join(',');
      seenCoords.add(lastCoordKey);

      features.forEach(f => {
        const geom = f.geometry || f.the_geom;
        const props = f.properties || f;
        
        if (!geom || !geom.coordinates) return;
        
        const coords = geom.coordinates;
        // MultiLineString or LineString?
        const segments = geom.type === 'MultiLineString' ? coords : [coords];
        
        segments.forEach(seg => {
          if (!seg || seg.length < 2) return;
          const start = seg[0];
          const end = seg[seg.length - 1];
          
          // Check proximity to current node
          const dStart = turf.distance(lastCoord, start, { units: 'meters' });
          const dEnd = turf.distance(lastCoord, end, { units: 'meters' });
          
          let extCoord = null;
          // Intersection tolerance ~15m for connectivity
          if (dStart < 15) extCoord = end;
          else if (dEnd < 15) extCoord = start;
          
          if (extCoord) {
            const key = extCoord.map(c => c.toFixed(5)).join(',');
            if (!seenCoords.has(key)) {
              seenCoords.add(key);
              allPossible.push({
                id: `${props.physicalid || Math.random()}-${allPossible.length}`,
                coord: extCoord,
                properties: {
                  ...props,
                  FSN_1: props.full_street_name || props.stname_label
                },
                dist: turf.distance(lastCoord, extCoord, { units: 'meters' }),
                streetName: props.full_street_name || props.stname_label || 'Unnamed Street',
                bearing: turf.bearing(lastCoord, extCoord)
              });
            }
          }
        });
      });

      if (allPossible.length === 0) {
        console.warn('[ZoneCreator] No extensions found for coordinate:', lastCoord);
        return [];
      }

      // Filter to only the NEAREST point for each shared street in each direction
      const streetGroups = {};
      allPossible.forEach(p => {
        const name = p.streetName;
        if (!streetGroups[name]) streetGroups[name] = [];
        streetGroups[name].push(p);
      });

      const finalExtensions = [];
      Object.entries(streetGroups).forEach(([name, points]) => {
        points.sort((a, b) => a.dist - b.dist);
        
        const nearest = points[0];
        finalExtensions.push(nearest);

        // Find the nearest point in the "opposite" direction (bearing diff > 90)
        const bearing0 = nearest.bearing;
        const opposite = points.find(p => {
          let diff = Math.abs(p.bearing - bearing0);
          if (diff > 180) diff = 360 - diff;
          return diff > 90;
        });

        if (opposite) {
          finalExtensions.push(opposite);
        }
      });

      console.log(`[ZoneCreator] Success! Generated ${finalExtensions.length} final extensions.`);
      return finalExtensions.sort((a, b) => a.dist - b.dist);
    } catch (err) {
      console.error('[ZoneCreator] findAvailableExtensions error:', err);
      return [];
    }
  }, [map]);

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
      
      // Async fetch extensions
      (async () => {
        const extensions = await findAvailableExtensions(lastNode);
        
        // Clear current extensions immediately to avoid "ghost" pills during pan
        setAvailableExtensions(prev => prev.length === 0 ? prev : []);
        
        if (isSettlingRef.current || (map && map.isMoving())) {
          pendingExtensionsRef.current = extensions;
        } else {
          setAvailableExtensions(extensions);
          pendingExtensionsRef.current = [];
        }
      })();
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
        setEmergencyLaneGeometry(null);
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

      // Also update emergency lane in context for real-time compliance during creation
      const emergencyHalfWidthMeters = (15 * metersPerFoot) / 2;
      const emergencyLane = turf.buffer(line, emergencyHalfWidthMeters, { units: 'meters', steps: 16 });
      setEmergencyLaneGeometry(emergencyLane);

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

        // Emergency Lane: 15ft width (7.5ft radius)
        const emergencyHalfWidthMeters = (15 * metersPerFoot) / 2;
        const emergencyLane = turf.buffer(line, emergencyHalfWidthMeters, { units: 'meters', steps: 16 });
        setEmergencyLaneGeometry(emergencyLane);

        // Turn radius analysis
        const turnAnalysis = analyzeTurnRadii(coords);
        const sweptPath = generateSweptPath(line);

        // Add/replace zone layers
        const lineId = 'zone-creator-path';
        const fillId = 'zone-creator-preview';
        const emergencyId = 'zone-creator-emergency-lane';
        const sweptPathId = 'zone-creator-swept-path';
        zoneLayerIdsRef.current = { line: lineId, fill: fillId, emergency: emergencyId, swept: sweptPathId };

        try { if (map.getLayer(fillId)) map.removeLayer(fillId); } catch (_) {}
        try { if (map.getLayer(lineId)) map.removeLayer(lineId); } catch (_) {}
        try { if (map.getLayer(emergencyId)) map.removeLayer(emergencyId); } catch (_) {}
        try { if (map.getLayer(sweptPathId)) map.removeLayer(sweptPathId); } catch (_) {}
        try { if (map.getSource('zone-creator')) map.removeSource('zone-creator'); } catch (_) {}
        try { if (map.getSource('zone-creator-emergency')) map.removeSource('zone-creator-emergency'); } catch (_) {}
        try { if (map.getSource('zone-creator-swept')) map.removeSource('zone-creator-swept'); } catch (_) {}
        
        // Remove live layers
        try { if (map.getLayer('zone-creator-live-fill')) map.removeLayer('zone-creator-live-fill'); } catch (_) {}
        try { if (map.getLayer('zone-creator-live-line')) map.removeLayer('zone-creator-live-line'); } catch (_) {}
        try { if (map.getLayer('zone-creator-live-nodes')) map.removeLayer('zone-creator-live-nodes'); } catch (_) {}
        try { if (map.getSource('zone-creator-live')) map.removeSource('zone-creator-live'); } catch (_) {}
        try { if (map.getSource('zone-creator-live-nodes')) map.removeSource('zone-creator-live-nodes'); } catch (_) {}

        map.addSource('zone-creator', { type: 'geojson', data: buffered });
        map.addLayer({ id: fillId, type: 'fill', source: 'zone-creator', paint: { 'fill-color': '#2563eb', 'fill-opacity': 0.2 } });
        map.addLayer({ id: lineId, type: 'line', source: 'zone-creator', paint: { 'line-color': '#2563eb', 'line-width': 3 } });

        map.addSource('zone-creator-emergency', { type: 'geojson', data: emergencyLane });
        map.addLayer({ 
          id: emergencyId, 
          type: 'line', 
          source: 'zone-creator-emergency', 
          paint: { 
            'line-color': '#f59e0b', 
            'line-width': 2,
            'line-dasharray': [2, 2]
          } 
        });

        if (sweptPath) {
          map.addSource('zone-creator-swept', { type: 'geojson', data: sweptPath });
          map.addLayer({
            id: sweptPathId,
            type: 'fill',
            source: 'zone-creator-swept',
            paint: {
              'fill-color': '#ef4444',
              'fill-opacity': 0.1,
              'fill-outline-color': '#ef4444'
            }
          });
        }

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
          properties: { 
            name: 'Custom Street Zone',
            safety: {
              turnAnalysis,
              emergencyLane: emergencyLane,
              sweptPath: sweptPath
            }
          },
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
        try { if (map.getLayer('zone-creator-emergency-lane')) map.removeLayer('zone-creator-emergency-lane'); } catch (_) {}
        try { if (map.getLayer('zone-creator-swept-path')) map.removeLayer('zone-creator-swept-path'); } catch (_) {}
        try { if (map.getSource('zone-creator')) map.removeSource('zone-creator'); } catch (_) {}
        try { if (map.getSource('zone-creator-emergency')) map.removeSource('zone-creator-emergency'); } catch (_) {}
        try { if (map.getSource('zone-creator-swept')) map.removeSource('zone-creator-swept'); } catch (_) {}
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
        try { setEmergencyLaneGeometry(null); } catch (_) {}
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


