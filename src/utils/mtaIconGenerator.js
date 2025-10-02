// utils/mtaIconGenerator.js
// Generates MTA train line icons as canvas images for MapLibre symbol layers

import { 
  getTrainLineHexColor, 
  getTrainLineTextColor, 
  sortTrainLines 
} from './mtaUtils';

/**
 * Generate a canvas-based icon for one or more train lines
 * Used for MapLibre GL symbol layers
 * Arranges icons in a grid with max 4 icons per row
 * 
 * @param {string[]} lines - Array of train line identifiers
 * @param {number} size - Size of each icon (default 32px)
 * @param {number} spacing - Spacing between icons (default 3px)
 * @returns {HTMLCanvasElement} - Canvas element ready to be added to map
 */
export const generateTrainLineIcon = (lines, size = 32, spacing = 3) => {
  if (!lines || lines.length === 0) {
    return generateFallbackIcon(size);
  }
  
  const sortedLines = sortTrainLines(lines);
  const iconWidth = size;
  
  // Special case: use 2x2 grid for exactly 4 icons
  const maxPerRow = sortedLines.length === 4 ? 2 : 4;
  
  // Calculate grid dimensions
  const cols = Math.min(sortedLines.length, maxPerRow);
  const rows = Math.ceil(sortedLines.length / maxPerRow);
  
  // Calculate canvas dimensions
  const totalWidth = (cols * iconWidth) + ((cols - 1) * spacing);
  const totalHeight = (rows * iconWidth) + ((rows - 1) * spacing);
  
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  // Set canvas size
  canvas.width = totalWidth;
  canvas.height = totalHeight;
  
  // Draw each train line icon in grid layout
  sortedLines.forEach((line, index) => {
    const row = Math.floor(index / maxPerRow);
    const col = index % maxPerRow;
    const x = col * (iconWidth + spacing);
    const y = row * (iconWidth + spacing);
    
    const bgColor = getTrainLineHexColor(line);
    const textColor = getTrainLineTextColor(line);
    
    // Draw circular background
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.arc(x + iconWidth / 2, y + iconWidth / 2, iconWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw train line letter/number
    ctx.fillStyle = textColor;
    const fontSize = Math.floor(iconWidth * 0.6);
    ctx.font = `bold ${fontSize}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Apply small vertical offset to optically center the text
    // Bold fonts often appear slightly high with textBaseline: 'middle'
    const yOffset = fontSize * 0.08;
    ctx.fillText(line, x + iconWidth / 2, y + iconWidth / 2 + yOffset);
  });
  
  return canvas;
};

/**
 * Generate a fallback generic subway icon
 * @param {number} size - Icon size
 * @returns {HTMLCanvasElement}
 */
export const generateFallbackIcon = (size = 32) => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  canvas.width = size;
  canvas.height = size;
  
  // Draw gray circle
  ctx.fillStyle = '#6B7280';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();
  
  // Draw "S" for subway
  ctx.fillStyle = '#FFFFFF';
  const fontSize = Math.floor(size * 0.6);
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Apply small vertical offset to optically center the text
  const yOffset = fontSize * 0.08;
  ctx.fillText('S', size / 2, size / 2 + yOffset);
  
  return canvas;
};

/**
 * Generate a unique icon ID for a set of train lines
 * @param {string[]} lines - Array of train line identifiers
 * @returns {string} - Icon ID for use with MapLibre
 */
export const generateIconId = (lines) => {
  if (!lines || lines.length === 0) {
    return 'subway-generic';
  }
  
  const sortedLines = sortTrainLines(lines);
  return `subway-${sortedLines.join('-')}`;
};

/**
 * Icon cache to avoid regenerating identical icons
 */
const iconCache = new Map();

/**
 * Get or generate a train line icon
 * Caches results for performance
 * 
 * @param {string[]} lines - Train line identifiers
 * @param {number} size - Icon size
 * @returns {object} - { iconId, canvas }
 */
export const getOrCreateTrainLineIcon = (lines, size = 32) => {
  const iconId = generateIconId(lines);
  
  if (iconCache.has(iconId)) {
    return {
      iconId,
      canvas: iconCache.get(iconId)
    };
  }
  
  const canvas = generateTrainLineIcon(lines, size);
  iconCache.set(iconId, canvas);
  
  return {
    iconId,
    canvas
  };
};

/**
 * Clear the icon cache
 * Useful for testing or memory management
 */
export const clearIconCache = () => {
  iconCache.clear();
};

/**
 * Pre-generate common train line combinations
 * Call this when map loads to prepare frequently used icons
 * 
 * @param {object} map - MapLibre map instance
 * @param {number} size - Icon size
 */
export const preloadCommonTrainLineIcons = (map, size = 32) => {
  if (!map || !map.addImage) return;
  
  // Add fallback generic subway icon first
  try {
    if (!map.hasImage('subway-generic')) {
      const fallbackCanvas = generateFallbackIcon(size);
      const ctx = fallbackCanvas.getContext('2d');
      const imageData = ctx.getImageData(0, 0, fallbackCanvas.width, fallbackCanvas.height);
      
      map.addImage('subway-generic', {
        width: fallbackCanvas.width,
        height: fallbackCanvas.height,
        data: imageData.data
      });
    }
  } catch (error) {
    console.warn('Failed to add fallback subway icon:', error);
  }
  
  // Common combinations in NYC subway
  const commonCombinations = [
    ['1'],
    ['2'],
    ['3'],
    ['1', '2', '3'],
    ['4'],
    ['5'],
    ['6'],
    ['4', '5', '6'],
    ['7'],
    ['A'],
    ['C'],
    ['E'],
    ['A', 'C', 'E'],
    ['B'],
    ['D'],
    ['F'],
    ['M'],
    ['B', 'D', 'F', 'M'],
    ['N'],
    ['Q'],
    ['R'],
    ['W'],
    ['N', 'Q', 'R', 'W'],
    ['G'],
    ['J'],
    ['Z'],
    ['J', 'Z'],
    ['L'],
    ['S']
  ];
  
  commonCombinations.forEach(lines => {
    const { iconId, canvas } = getOrCreateTrainLineIcon(lines, size);
    
    try {
      if (!map.hasImage(iconId)) {
        // Convert canvas to ImageData for MapLibre
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Create image object with required properties for MapLibre
        const image = {
          width: canvas.width,
          height: canvas.height,
          data: imageData.data
        };
        
        map.addImage(iconId, image);
      }
    } catch (error) {
      console.warn(`Failed to add train line icon ${iconId}:`, error);
    }
  });
};

/**
 * Add a train line icon to the map
 * Generates if not already in cache
 * 
 * @param {object} map - MapLibre map instance
 * @param {string[]} lines - Train line identifiers
 * @param {number} size - Icon size
 * @returns {string} - Icon ID that was added
 */
export const addTrainLineIconToMap = (map, lines, size = 32) => {
  if (!map || !map.addImage) return null;
  
  const { iconId, canvas } = getOrCreateTrainLineIcon(lines, size);
  
  try {
    if (!map.hasImage(iconId)) {
      // Convert canvas to ImageData for MapLibre
      const ctx = canvas.getContext('2d');
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // Create image object with required properties for MapLibre
      const image = {
        width: canvas.width,
        height: canvas.height,
        data: imageData.data
      };
      
      map.addImage(iconId, image);
    }
    return iconId;
  } catch (error) {
    console.warn(`Failed to add train line icon ${iconId}:`, error);
    return null;
  }
};

