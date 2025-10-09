import React, { useMemo, useEffect } from 'react';
import { useMapViewState } from '../../hooks/useMapViewState';
import { useStableImageSrc } from '../../hooks/useStableImageSrc';
import { getCandidateSrcs, prefetchView } from '../../utils/spriteResolver';
import { buildSpriteFallbacks, quantizeAngleTo45, quantizeToSlices, computeDominantBearingFromPolygon, computeDominantViewportBearing, computeSpriteTransform, extractCameraState, buildSpriteImageId } from '../../utils/enhancedRenderingUtils';
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

  // Use the EXACT same sprite transform logic as DroppedObjects for perfect alignment
  const spriteTransform = useMemo(() => {
    if (!objectType?.enhancedRendering?.enabled) return null;
    try {
      const zeroOffset = (objectType?.enhancedRendering?.zeroOffsetDegByView?.[view?.viewType])
        ?? (objectType?.enhancedRendering?.zeroOffsetDeg)
        ?? (view?.viewType === 'isometric' ? -90 : 0);
      const cameraState = extractCameraState({ map, view });
      return computeSpriteTransform({
        map,
        view,
        cameraState,
        spriteBase: objectType.enhancedRendering.spriteBase,
        baseAngleDeg: angle || 0,
        zeroOffsetDeg: zeroOffset
      });
    } catch (_) {
      return null;
    }
  }, [objectType, angle, view?.viewType, view?.bearing, map]);

  // Compute candidate sprite sources using transform result or fallback
  const candidates = useMemo(() => {
    if (!objectType) return [];
    
    // If enhanced rendering with sprite transform, use the computed imageId
    if (spriteTransform?.imageId) {
      const base = objectType?.enhancedRendering?.spriteBase;
      const spriteAngle = spriteTransform.spriteAngle || 0;
      if (base) {
        return buildSpriteFallbacks(base, spriteAngle, view?.viewType);
      }
    }
    
    // Fallback for non-enhanced or when transform fails
    try {
      const base = objectType?.enhancedRendering?.spriteBase || objectType.id;
      const q = view?.viewType === 'top-down' ? 0 : quantizeAngleTo45(angle || 0);
      if (base) return buildSpriteFallbacks(base, q, view?.viewType);
    } catch (_) {}
    
    return [];
  }, [objectType, spriteTransform, angle, view?.viewType]);
  const src = useStableImageSrc(candidates, `${view?.viewType || ''}:${qAngle}`);
  const previewStyle = useMemo(() => {
    if (!placementMode || !cursorPosition || !objectType) {
      return { display: 'none' };
    }

    const baseSize = Math.max(objectType.size.width, objectType.size.height, 24);
    const previewScale = 1.25;
    const iconSize = baseSize * previewScale;

    return {
      position: 'absolute',
      left: cursorPosition.x,
      top: cursorPosition.y,
      width: iconSize,
      height: iconSize,
      transform: 'translate(-50%, -50%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'none',
      zIndex: 999,
      backgroundColor: 'rgba(255, 255, 255, 0.3)',
      borderRadius: '50%',
      border: '1px solid rgba(0,0,0,0.1)',
      opacity: 0.6,
      transformOrigin: 'center center'
    };
  }, [placementMode, cursorPosition, objectType]);

  const iconStyle = useMemo(() => {
    if (!placementMode || !placeableObjects) return {};
    if (!objectType) return {};

    const baseSize = Math.max(objectType.size.width, objectType.size.height, 24);
    const previewScale = 1.25;
    const iconSize = baseSize * previewScale;
    const fontSize = Math.max(iconSize * 0.6, 14);

    // Use the EXACT iconRotate from computeSpriteTransform (same as DroppedObjects)
    const iconRotate = spriteTransform?.iconRotate ?? 0;

    const transforms = [];
    // Apply rotation from sprite transform (in 2D this is continuous, in isometric it's 0)
    if (iconRotate !== 0) {
      transforms.push(`rotate(${iconRotate}deg)`);
    }
    if (placementMode.isFlipped) {
      transforms.push('scaleX(-1)');
    }

    return {
      width: iconSize,
      height: iconSize,
      color: objectType.color,
      fontSize: `${fontSize}px`,
      lineHeight: '1',
      opacity: 0.8,
      transform: transforms.length > 0 ? transforms.join(' ') : undefined,
      backgroundColor: objectType.geometryType === 'rect' ? (objectType.color || 'rgba(148, 163, 184, 0.7)') : undefined,
      borderRadius: objectType.geometryType === 'rect' ? '4px' : undefined,
      border: objectType.geometryType === 'rect' ? '1px solid rgba(17,24,39,0.35)' : undefined
    };
  }, [placementMode, placeableObjects, objectType, spriteTransform, view?.viewType]);

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