import React, { useMemo } from 'react';

const PlacementPreview = ({ placementMode, cursorPosition, placeableObjects }) => {
  const previewStyle = useMemo(() => {
    if (!placementMode || !cursorPosition || !placeableObjects) {
      return { display: 'none' };
    }

    const objectType = placeableObjects.find(p => p.id === placementMode.objectType.id);
    if (!objectType) {
      return { display: 'none' };
    }

    // Use the object's defined size or default to 24px
    const iconSize = Math.max(objectType.size.width, objectType.size.height, 24);
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

    const objectType = placeableObjects.find(p => p.id === placementMode.objectType.id);
    if (!objectType) return {};

    const iconSize = Math.max(objectType.size.width, objectType.size.height, 24);
    const fontSize = Math.max(iconSize * 0.6, 14);

    if (objectType.imageUrl) {
      return { width: iconSize, height: iconSize };
    }

    return {
      color: objectType.color,
      fontSize: `${fontSize}px`,
      lineHeight: '1',
      opacity: 0.8
    };
  }, [placementMode, placeableObjects]);

  if (!placementMode || !cursorPosition) {
    return null;
  }

  const objectType = placeableObjects?.find(p => p.id === placementMode.objectType.id);
  if (!objectType) {
    return null;
  }

  return (
    <div style={previewStyle}>
      {objectType.imageUrl ? (
        <img src={objectType.imageUrl} alt={objectType.name} style={iconStyle} draggable={false} />
      ) : (
        <div style={iconStyle}>{objectType.icon}</div>
      )}
    </div>
  );
};

export default PlacementPreview; 