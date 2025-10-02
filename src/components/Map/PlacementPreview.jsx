import React, { useMemo, useEffect } from 'react';
import { useMapViewState } from '../../hooks/useMapViewState';
import { useStableImageSrc } from '../../hooks/useStableImageSrc';
import { getCandidateSrcs, prefetchView } from '../../utils/spriteResolver';
import { buildSpriteFallbacks, quantizeAngleTo45, quantizeToSlices, computeDominantBearingFromPolygon, computeDominantViewportBearing } from '../../utils/enhancedRenderingUtils';
import { quantizeBearingForView } from '../../utils/bearingUtils';

const PlacementPreview = ({ placementMode, cursorPosition, placeableObjects, map }) => {
  const view = useMapViewState(map);

  // Resolve object type once per render (used by hooks below)
  const objectType = useMemo(() => {
    try { return placeableObjects?.find(p => p.id === placementMode?.objectType?.id) || null; } catch (_) { return null; }
  }, [placeableObjects, placementMode?.objectType?.id]);

  // Compute angle and its quantized variant early so effects can depend on it
  const angle = typeof placementMode?.rotationDeg === 'number' ? placementMode.rotationDeg : 0;
  const qAngle = useMemo(() => {
    try { 
      // In top-down mode, always use 0 (rotation handled by CSS)
      // In isometric mode, quantize to nearest 45° for 3D simulation
      return view?.viewType === 'top-down' ? 0 : quantizeAngleTo45(angle || 0);
    } catch (_) { return 0; }
  }, [angle, view?.viewType]);

  // Prefetch for the current view when enhanced; include quantized angle for immediate candidate readiness
  useEffect(() => {
    try {
      if (objectType?.enhancedRendering?.enabled && objectType.enhancedRendering?.spriteBase && view?.viewType) {
        const allAngles = objectType.enhancedRendering.angles || [0,45,90,135,180,225,270,315];
        // In top-down mode, only prefetch 0-degree sprite (continuous rotation)
        // In isometric mode, prefetch all angles for 3D perspective simulation
        const angles = view.viewType === 'top-down' ? [0] : allAngles;
        prefetchView(objectType.enhancedRendering.spriteBase, angles, view.viewType, { map });
      }
    } catch (_) {}
  }, [objectType?.enhancedRendering?.spriteBase, objectType?.enhancedRendering?.enabled, objectType?.enhancedRendering?.angles, view?.viewType, qAngle, map]);

  // Compute candidate sprite sources and resolve a stable src (hooks must be unconditional)
  const candidates = useMemo(() => {
    if (!objectType) return [];
    // Compensate for map bearing so the preview doesn't appear to rotate when the map rotates
    const bearing = typeof view?.bearing === 'number' ? view.bearing : 0;
    const areaBearing = (() => {
      try {
        const g = (window?.__app?.permitAreas?.hasSubFocus ? window?.__app?.permitAreas?.subFocusArea?.geometry : window?.__app?.permitAreas?.focusedArea?.geometry) || null; // fallback if accessible
        // Prefer map-linked context when available (MapContainer passes via global __app)
        if (g) {
          const isIso = (map?.getPitch ? map.getPitch() : 0) > 15;
          return (isIso && map) ? (computeDominantViewportBearing(map, g) || 0) : (computeDominantBearingFromPolygon(g) || 0);
        }
      } catch (_) {}
      return 0;
    })();
    const zeroOffset = (objectType?.enhancedRendering?.zeroOffsetDegByView?.[view?.viewType])
      ?? (objectType?.enhancedRendering?.zeroOffsetDeg)
      ?? (view?.viewType === 'isometric' ? -90 : 0);
    const p = (map?.getPitch ? map.getPitch() : 0);
    const camQ = quantizeBearingForView(bearing, p);
    const angleForSprite = (((angle - camQ + zeroOffset) % 360 + 360) % 360);
    const primary = getCandidateSrcs(objectType, angleForSprite, view?.viewType) || [];
    if (primary.length > 0) return primary;
    // Fallback: assume public/static/{id} structure when spriteBase missing
    try {
      const base = objectType?.enhancedRendering?.spriteBase || objectType.id;
      // In top-down mode, always use 0-degree sprite (rotation handled by CSS)
      // In isometric mode, quantize to nearest 45° angle for 3D simulation
      const q = view?.viewType === 'top-down' ? 0 : quantizeAngleTo45(angleForSprite || 0);
      if (base) return buildSpriteFallbacks(base, q, view?.viewType);
    } catch (_) {}
    return [];
  }, [objectType, angle, view?.viewType]);
  const src = useStableImageSrc(candidates, `${view?.viewType || ''}:${qAngle}`);
  const previewStyle = useMemo(() => {
    if (!placementMode || !cursorPosition || !placeableObjects) {
      return { display: 'none' };
    }

    const objectType = placeableObjects.find(p => p.id === placementMode.objectType.id);
    if (!objectType) {
      return { display: 'none' };
    }

    // Use the object's defined size or default to 24px, then scale up slightly for clearer preview
    const baseSize = Math.max(objectType.size.width, objectType.size.height, 24);
    const previewScale = 1.25;
    const iconSize = baseSize * previewScale;
    const halfSize = iconSize / 2;
    const fontSize = Math.max(iconSize * 0.6, 14);

    return {
      position: 'absolute',
      left: cursorPosition.x - halfSize,
      top: cursorPosition.y - halfSize,
      width: iconSize,
      height: iconSize,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'none',
      zIndex: 999,
      // Faded preview styling
      backgroundColor: 'rgba(255, 255, 255, 0.3)',
      borderRadius: '50%',
      border: '1px solid rgba(0,0,0,0.1)',
      opacity: 0.6,
      transform: 'translateZ(0)',
      willChange: 'transform'
    };
  }, [placementMode, cursorPosition, placeableObjects]);

  const iconStyle = useMemo(() => {
    if (!placementMode || !placeableObjects) return {};
    if (!objectType) return {};

    const baseSize = Math.max(objectType.size.width, objectType.size.height, 24);
    const previewScale = 1.25;
    const iconSize = baseSize * previewScale;
    const fontSize = Math.max(iconSize * 0.6, 14);

    return {
      width: iconSize,
      height: iconSize,
      color: objectType.color,
      fontSize: `${fontSize}px`,
      lineHeight: '1',
      opacity: 0.8,
      transform: placementMode.isFlipped ? 'scaleX(-1)' : undefined
    };
  }, [placementMode, placeableObjects]);

  if (!placementMode || !cursorPosition) {
    return null;
  }

  if (!objectType) {
    return null;
  }

  return (
    <div style={previewStyle}>
      {src ? (
        <img src={src} alt={objectType.name} style={iconStyle} draggable={false} />
      ) : (
        <div style={iconStyle}>{objectType.icon}</div>
      )}
    </div>
  );
};

export default PlacementPreview; 