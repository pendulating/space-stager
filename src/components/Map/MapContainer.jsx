// components/Map/MapContainer.jsx
import React, { forwardRef, useEffect, useState, useRef } from 'react';
import MapTooltip from './MapTooltip';
import ClickPopover from './ClickPopover';
import { useZoneCreator } from '../../hooks/useZoneCreator';
import OverlapSelector from './OverlapSelector';
import DroppedObjects from './DroppedObjects';
import DroppedRectangles from './DroppedRectangles';
import DroppedObjectNoteEditor from './DroppedObjectNoteEditor';
import CustomShapeLabels from './CustomShapeLabels';
import NudgeMarkers from './NudgeMarkers';
import ActiveToolIndicator from './ActiveToolIndicator';
import LoadingOverlay from './LoadingOverlay';
import PlacementPreview from './PlacementPreview';
import { useMemo } from 'react';
import TextAnnotationEditor from './TextAnnotationEditor';

const DEBUG = false; // Set to true to enable MapContainer debug logs

const MapContainer = forwardRef(({ 
  map,
  mapLoaded, 
  focusedArea, 
  drawTools, 
  clickToPlace, 
  permitAreas,
  placeableObjects,
  infrastructure,
  nudges,
  highlightedIds,
  onDismissNudge,
  onMapClick,
  onObjectDrop,
  onObjectUpdate,
  onObjectRemove,
  onOverlapSelect,
  onOverlapDeselect,
  overlapSelector,
  activeTool,
  isLoading
}, ref) => {
  const { 
    handleMapMouseMove, 
    handleMapClick, 
    droppedObjects, 
    placementMode, 
    cursorPosition 
  } = clickToPlace;
  const mapContainerRef = useRef(null);
  const [noteEditingObject, setNoteEditingObject] = useState(null);
  const [textEditorFeatureId, setTextEditorFeatureId] = useState(null);
  const [annotationsTrigger, setAnnotationsTrigger] = useState(0);
  const subFocusArmedRef = useRef(false);
  const derivedSourceId = 'annotations-derived';
  const arrowIconId = 'annotation-arrowhead';

  // Compass / camera state
  const [bearing, setBearing] = useState(0);
  const [pitch, setPitch] = useState(0);

  // Zone Creator: mandatory in intersections mode, always wire interactions there
  useZoneCreator(map, 'intersections');

  // Listen for map camera changes
  useEffect(() => {
    if (!map) return;
    const updateCamera = () => {
      try {
        setBearing(map.getBearing ? map.getBearing() : 0);
        setPitch(map.getPitch ? map.getPitch() : 0);
      } catch (_) {}
    };
    map.on('rotate', updateCamera);
    map.on('move', updateCamera);
    // Set initial camera
    updateCamera();
    return () => {
      map.off('rotate', updateCamera);
      map.off('move', updateCamera);
    };
  }, [map]);

  // Force immediate label refresh on external annotation change events
  useEffect(() => {
    const bump = () => setAnnotationsTrigger(v => v + 1);
    window.addEventListener('annotations:changed', bump);
    return () => window.removeEventListener('annotations:changed', bump);
  }, []);

  // Listen for sub-focus arming/disarming events
  useEffect(() => {
    const arm = () => { subFocusArmedRef.current = true; };
    const disarm = () => { subFocusArmedRef.current = false; };
    window.addEventListener('subfocus:arm', arm);
    window.addEventListener('subfocus:disarm', disarm);
    return () => {
      window.removeEventListener('subfocus:arm', arm);
      window.removeEventListener('subfocus:disarm', disarm);
    };
  }, []);

  // Build derived features (text points and arrowheads) from Draw features
  const derivedAnnotations = useMemo(() => {
    try {
      const features = drawTools?.draw?.current ? drawTools.draw.current.getAll().features : [];
      const texts = [];
      const arrowheads = [];
      (features || []).forEach((f) => {
        if (!f || !f.geometry) return;
        const props = f.properties || {};
        if (props.type === 'text' && f.geometry.type === 'Point' && props.label) {
          texts.push({ type: 'Feature', geometry: f.geometry, properties: { label: props.label, textSize: props.textSize || 14, textColor: props.textColor || '#111827', halo: props.halo !== false } });
        } else if (props.type === 'arrow' && f.geometry.type === 'LineString') {
          const coords = f.geometry.coordinates || [];
          if (coords.length >= 2) {
            const a = coords[coords.length - 2];
            const b = coords[coords.length - 1];
            const dx = b[0] - a[0];
            const dy = b[1] - a[1];
            // MapLibre icon-rotate is clockwise from the icon's default orientation (our icon points East).
            // Math.atan2 returns CCW angle from East. Use negative to convert to clockwise.
            const bearing = -(Math.atan2(dy, dx) * 180) / Math.PI;
            arrowheads.push({ type: 'Feature', geometry: { type: 'Point', coordinates: b }, properties: { bearing, size: f.properties?.arrowSize || 1 } });
          }
        }
      });
      return { type: 'FeatureCollection', features: [...texts, ...arrowheads] };
    } catch (_) { return { type: 'FeatureCollection', features: [] }; }
  }, [drawTools?.draw, clickToPlace.objectUpdateTrigger, annotationsTrigger]);

  // Register arrowhead icon; re-register on style load and handle missing images
  useEffect(() => {
    if (!map) return;
    const register = () => {
      try {
        if (map.hasImage && map.hasImage(arrowIconId)) return;
      } catch (_) {}
      try {
        const size = 64;
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0,0,size,size);
        ctx.fillStyle = '#111827';
        ctx.beginPath();
        // Draw a classic triangle pointing to the right (east)
        ctx.moveTo(size*0.2, size*0.15);
        ctx.lineTo(size*0.2, size*0.85);
        ctx.lineTo(size*0.9, size*0.5);
        ctx.closePath();
        ctx.fill();
        const data = ctx.getImageData(0,0,size,size);
        if (map.addImage) map.addImage(arrowIconId, data, { pixelRatio: 2 });
      } catch (e) {
        console.warn('Failed to register arrow icon', e);
      }
    };
    // Initial attempt
    register();
    // On style load
    const onStyleLoad = () => register();
    map.on('style.load', onStyleLoad);
    // Handle on-demand missing image
    const onMissing = (e) => { try { if (e && e.id === arrowIconId) register(); } catch (_) {} };
    map.on('styleimagemissing', onMissing);
    return () => {
      try { map.off('style.load', onStyleLoad); } catch (_) {}
      try { map.off('styleimagemissing', onMissing); } catch (_) {}
    };
  }, [map]);

  // Sync derived annotations source & layers
  useEffect(() => {
    if (!map) return;
    const ensure = () => {
      try {
        if (!map.getSource(derivedSourceId)) {
          map.addSource(derivedSourceId, { type: 'geojson', data: derivedAnnotations });
        } else {
          const src = map.getSource(derivedSourceId);
          src.setData(derivedAnnotations);
        }
        // Text layer
        if (!map.getLayer('annotation-text')) {
          map.addLayer({
            id: 'annotation-text',
            type: 'symbol',
            source: derivedSourceId,
            filter: ['has', 'label'],
            layout: {
              'text-field': ['get', 'label'],
              'text-size': ['coalesce', ['get', 'textSize'], 14],
              'text-font': ['literal', ['Open Sans Bold','Arial Unicode MS Bold']],
              'text-offset': [0, 1.0],
              'text-anchor': 'top'
            },
            paint: {
              'text-color': ['coalesce', ['get', 'textColor'], '#111827'],
              'text-halo-color': '#ffffff',
              'text-halo-width': 1.0
            }
          });
        }
        // Arrowhead layer
        if (!map.getLayer('annotation-arrowheads')) {
          // Place arrowheads above draw layers if possible
          let beforeId;
          try {
            const style = map.getStyle ? map.getStyle() : null;
            const firstDrawLayer = style && Array.isArray(style.layers)
              ? style.layers.find(l => typeof l.id === 'string' && (l.id.startsWith('mapbox-gl-draw') || l.id.startsWith('gl-draw')))
              : null;
            beforeId = firstDrawLayer ? firstDrawLayer.id : undefined;
          } catch (_) {}
          map.addLayer({
            id: 'annotation-arrowheads',
            type: 'symbol',
            source: derivedSourceId,
            filter: ['all', ['!', ['has', 'label']], ['has', 'bearing']],
            layout: {
              'icon-image': arrowIconId,
              'icon-rotate': ['get', 'bearing'],
              'icon-size': ['interpolate', ['linear'], ['zoom'], 12, 0.4, 18, 0.9],
              'icon-allow-overlap': true,
              'icon-ignore-placement': true
            }
          }, beforeId);
        }
      } catch (e) {
        // noop
      }
    };
    const ready = typeof map.isStyleLoaded === 'function' ? map.isStyleLoaded() : true;
    if (ready) ensure(); else map.once('style.load', ensure);
  }, [map, derivedAnnotations]);

  // Keep annotation layers above MapboxDraw layers (which may be added later)
  useEffect(() => {
    if (!map) return;
    const bringToTop = (id) => {
      try { if (map.getLayer(id)) map.moveLayer(id); } catch (_) {}
    };
    // Slight delay to allow Draw to (re)insert its layers
    const t = setTimeout(() => {
      bringToTop('annotation-text');
      bringToTop('annotation-arrowheads');
    }, 50);
    return () => clearTimeout(t);
  }, [map, drawTools?.draw, derivedAnnotations]);

  // Expose current rect mode + id for sidebar active highlight
  useEffect(() => {
    try {
      window.__app = Object.assign({}, window.__app || {}, {
        drawMode: drawTools?.draw?.current?.getMode ? drawTools.draw.current.getMode() : null,
        activeRectId: drawTools?.activeRectObjectTypeId || null
      });
    } catch (_) {}
  }, [drawTools]);

  // Compass click handler
  const handleCompassClick = () => {
    if (map && map.rotateTo) {
      map.rotateTo(0, { duration: 500 });
    }
  };

  // Projection toggle
  const snapToNearest45 = (deg) => {
    const d = ((deg % 360) + 360) % 360;
    const step = 45;
    return Math.round(d / step) * step;
  };
  const handleToggleProjection = () => {
    if (!map) return;
    const currentCenter = map.getCenter ? map.getCenter() : null;
    const currentZoom = map.getZoom ? map.getZoom() : undefined;
    const isIso = (map.getPitch ? map.getPitch() : 0) > 15;
    if (isIso) {
      // Return to top-down
      try {
        map.easeTo({ pitch: 0, bearing: 0, center: currentCenter || undefined, zoom: currentZoom, duration: 600 });
      } catch (_) {}
    } else {
      // Go to isometric: high pitch, snap bearing to nearest 45°
      const brg = snapToNearest45(map.getBearing ? map.getBearing() : 0) || 45;
      try {
        map.easeTo({ pitch: 60, bearing: brg, center: currentCenter || undefined, zoom: currentZoom, duration: 600 });
      } catch (_) {}
    }
  };

  // Disable double-click zoom when map is loaded to prevent conflicts with permit area selection
  React.useEffect(() => {
    if (mapLoaded && map && map.doubleClickZoom) {
      map.doubleClickZoom.disable();
    }
  }, [mapLoaded, map]);

  // Open text editor on text feature creation anywhere
  useEffect(() => {
    if (!map || !drawTools?.draw?.current) return;
    const onCreateAny = (e) => {
      try {
        const f = e?.features?.[0];
        if (f && f.geometry?.type === 'Point' && f.properties?.type === 'text') {
          setTextEditorFeatureId(f.id);
        }
        setAnnotationsTrigger(v => v + 1);
      } catch (_) {}
    };
    map.on('draw.create', onCreateAny);
    return () => { try { map.off('draw.create', onCreateAny); } catch (_) {} };
  }, [map, drawTools]);

  // Refresh derived annotations on updates/deletes as well
  useEffect(() => {
    if (!map || !drawTools?.draw?.current) return;
    const bump = () => setAnnotationsTrigger(v => v + 1);
    map.on('draw.update', bump);
    map.on('draw.delete', bump);
    map.on('draw.selectionchange', bump);
    return () => {
      try { map.off('draw.update', bump); } catch (_) {}
      try { map.off('draw.delete', bump); } catch (_) {}
      try { map.off('draw.selectionchange', bump); } catch (_) {}
    };
  }, [map, drawTools]);

  // Listen for rectangle draw completion to convert into dropped object and remove draw feature
  useEffect(() => {
    if (!map || !drawTools?.draw?.current) return;
    const onCreate = (e) => {
      try {
        const f = e?.features?.[0];
        if (!f || f.geometry?.type !== 'Polygon') return;
        const typeId = f.properties?.user_rectObjectType;
        // If a rectangle-object type was set, this is an equipment rectangle → convert to dropped object
        if (typeId) {
          const objectType = placeableObjects?.find(p => p.id === typeId);
          if (!objectType) return;
          // Build dropped object
          const coords = f.geometry.coordinates?.[0] || [];
          if (coords.length < 4) return;
          const centroid = { lng: (coords[0][0] + coords[2][0]) / 2, lat: (coords[0][1] + coords[2][1]) / 2 };
          const obj = {
            id: `${typeId}-${Date.now()}`,
            type: typeId,
            name: objectType.name,
            position: centroid,
            geometry: f.geometry,
            properties: {
              label: objectType.name,
              rotationDeg: Number(f.properties?.user_rotationDeg || 0),
              dimensions: f.properties?.user_dimensions_m || null,
              timestamp: new Date().toISOString()
            }
          };
          clickToPlace.setDroppedObjects(prev => [...prev, obj]);
          try { drawTools.draw.current.delete(f.id); } catch (_) {}
          return;
        }

        // Otherwise, if sub-focus mode is armed, treat this polygon as the sub-focus scope
        if (subFocusArmedRef.current && permitAreas?.focusedArea && permitAreas?.setSubFocusPolygon) {
          const ok = permitAreas.setSubFocusPolygon({ type: 'Feature', properties: {}, geometry: f.geometry });
          // Remove the transient draw shape and disarm
          try { drawTools.draw.current.delete(f.id); } catch (_) {}
          subFocusArmedRef.current = false;
          if (ok) return;
        }
        // If a text annotation was created, open inline editor (also handle when created via point tool then tagged)
        setAnnotationsTrigger(v => v + 1);
      } catch (err) {
        console.warn('Failed to convert rect feature to dropped object', err);
      }
    };
    map.on('draw.create', onCreate);
    return () => { try { map.off('draw.create', onCreate); } catch (_) {} };
  }, [map, drawTools, placeableObjects, clickToPlace, permitAreas]);

  if (DEBUG) console.log('MapContainer: Rendering with map instance', {
    hasMap: !!map,
    hasProject: map && typeof map.project === 'function',
    mapLoaded,
    droppedObjectsCount: droppedObjects?.length || 0
  });

  return (
    <div className="flex-1 relative">
      {/* Compass + Projection Toggle Overlay */}
      <div
        className="absolute bottom-4 left-4 z-50 flex flex-row items-end gap-2"
        style={{ pointerEvents: 'none' }}
      >
        <button
          className="bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 rounded-full w-12 h-12 flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
          style={{
            transform: `rotate(${-bearing}deg)`,
            pointerEvents: 'auto',
            transition: 'transform 0.3s cubic-bezier(.4,2,.6,1)' // smooth rotation
          }}
          title="Reset North"
          onClick={handleCompassClick}
        >
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="15" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" fill="currentColor" fillOpacity="0.9" className="text-white dark:text-gray-800" />
            <polygon points="16,6 19,18 16,15 13,18" fill="#2563eb" />
            <text x="16" y="26" textAnchor="middle" fontSize="10" fill="#374151" fontWeight="bold">N</text>
          </svg>
        </button>

        <button
          className="bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 rounded-full w-12 h-12 flex items-center justify-center hover:scale-105 active:scale-95"
          style={{ pointerEvents: 'auto' }}
          title="Toggle projection (Top-down / Isometric)"
          onClick={handleToggleProjection}
        >
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">
            {(pitch > 15) ? '2D' : 'ISO'}
          </span>
        </button>
      </div>
      
      <div 
        ref={ref} 
        className={`absolute inset-0 ${placementMode ? 'cursor-crosshair' : ''}`}
        style={{ width: '100%', height: '100%' }}
        onMouseMove={handleMapMouseMove}
        onClick={handleMapClick}
      />
      
      <DroppedObjects
        objects={droppedObjects}
        placeableObjects={placeableObjects}
        map={map}
        onRemoveObject={clickToPlace.removeDroppedObject}
        objectUpdateTrigger={clickToPlace.objectUpdateTrigger}
        onEditNote={(obj) => setNoteEditingObject(obj)}
        isNoteEditing={!!noteEditingObject}
      />


      {noteEditingObject && (
        <div className="absolute inset-0" style={{ pointerEvents: 'none' }}>
          {/* Capture wheel/drag to disable map interactions while editing */}
          <div className="absolute inset-0" style={{ pointerEvents: 'auto' }} onWheel={(e) => e.preventDefault()} onMouseDown={(e) => e.preventDefault()} />
          <DroppedObjectNoteEditor
            map={map}
            object={noteEditingObject}
            objectUpdateTrigger={clickToPlace.objectUpdateTrigger}
            onSave={(text) => {
              clickToPlace.setDroppedObjectNote(noteEditingObject.id, text);
              setNoteEditingObject(null);
            }}
            onCancel={() => setNoteEditingObject(null)}
          />
        </div>
      )}
      
      <CustomShapeLabels
        draw={drawTools.draw}
        map={map}
        objectUpdateTrigger={(clickToPlace.objectUpdateTrigger || 0) + (annotationsTrigger || 0)}
        showLabels={drawTools.showLabels}
      />

      {textEditorFeatureId && (
        <TextAnnotationEditor
          map={map}
          featureId={textEditorFeatureId}
          drawRef={drawTools.draw}
          onSave={() => { setTextEditorFeatureId(null); setAnnotationsTrigger(v => v + 1); }}
          onCancel={() => setTextEditorFeatureId(null)}
        />
      )}
      
      {/* Placement Preview */}
      <PlacementPreview
        placementMode={placementMode}
        cursorPosition={cursorPosition}
        placeableObjects={placeableObjects}
      />

      {/* Floating per-instance nudge markers */}
      <NudgeMarkers
        nudges={nudges}
        map={map}
        objectUpdateTrigger={clickToPlace.objectUpdateTrigger}
        onDismiss={onDismissNudge}
        highlightedIds={highlightedIds}
      />
      
      {!mapLoaded && <LoadingOverlay />}
      
      {drawTools?.activeTool && <ActiveToolIndicator tool={drawTools.activeTool} />}
      
      {/* Only show hover tooltip when not drawing and no clicked popover is visible */}
      {!drawTools?.activeTool && !permitAreas.clickedTooltip?.visible && (
        <MapTooltip tooltip={permitAreas.tooltip} />
      )}

      {/* Clicked popover (parks mode), persists and follows camera */}
      {permitAreas.clickedTooltip?.visible && (
        <ClickPopover 
          tooltip={permitAreas.clickedTooltip}
          stats={permitAreas.clickedTooltip.stats}
          distributions={permitAreas.clickedTooltip.distributions}
          onClose={permitAreas.dismissClickedTooltip}
          onFocus={permitAreas.focusClickedTooltipArea}
        />
      )}
      
      {permitAreas.showOverlapSelector && (
        <OverlapSelector 
          overlappingAreas={permitAreas.overlappingAreas}
          selectedIndex={permitAreas.selectedOverlapIndex}
          clickPosition={permitAreas.clickPosition}
          onSelect={permitAreas.selectOverlappingArea}
          onClose={permitAreas.clearOverlapSelector}
        />
      )}
      {/* Ensure rectangles overlay renders on top of other overlays */}
      <DroppedRectangles
        objects={droppedObjects}
        placeableObjects={placeableObjects}
        map={map}
        objectUpdateTrigger={clickToPlace.objectUpdateTrigger}
      />
    </div>
  );
});

MapContainer.displayName = 'MapContainer';

export default MapContainer;