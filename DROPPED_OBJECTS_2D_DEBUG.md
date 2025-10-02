# Dropped Objects 2D Mode Debug Investigation

## Issue
Dropped object icons don't appear when placing objects in 2D map mode (pitch = 0, top-down view).

## Investigation Summary

### How Sprites Work in 2D vs 3D

**Isometric (3D) Mode:**
- Uses different sprite images for each 45° rotation (e.g., `bench_000`, `bench_045`, etc.)
- Swaps sprite images as camera/object rotates
- CSS rotation is 0

**Top-Down (2D) Mode:**
- Always uses angle `0` sprite (e.g., `bench_000`)
- Uses CSS `icon-rotate` property to rotate the sprite visually
- More performant as it doesn't require sprite swapping

### Sprite Loading Process

1. Objects are placed or view changes to 2D
2. `useEffect` in `DroppedObjects.jsx` (lines 197-248) preloads sprites
3. `addEnhancedSpritesToMap` is called with:
   - `baseName`: e.g., "bench"
   - `viewType`: "top-down"
   - `urlBuilder`: `buildFlatSpriteUrl`
4. URL is constructed: `/static/bench/bench_TOP_000.png`
5. Image loads and is registered with ID: `bench_000`
6. `rebuildDroppedData` is called to update feature properties
7. Features with ready sprites get `icon_image` property set
8. Symbol layer displays features that have `icon_image`

### Files Verified

✅ Sprite files exist in `/public/static/{object}/`
- Example: `/public/static/bench/bench_TOP_000.png` through `bench_TOP_315.png`
- All 8 angles present for both isometric and top-down views

### Debug Logging Added

**In `DroppedObjects.jsx`:**
- Logs when sprite preload effect runs
- Logs each object being processed
- Logs sprite loading attempts
- Logs when `rebuildDroppedData` is called
- Logs when icons are ready vs not ready

**In `enhancedRenderingUtils.js`:**
- Logs sprite loading attempts with URLs
- Logs successful loads with source URL
- Logs failed loads with error details
- Logs when sprites are already cached

### How to Enable Debug Mode

Open browser console and run:
```javascript
window.__DEBUG_DROPPED_OBJECTS__ = true
```

Then refresh and try placing objects in 2D mode.

### What to Look For in Logs

1. **Sprite Loading:**
   ```
   [DroppedObjects] preload sprites effect { viewType: 'top-down', objectCount: 1 }
   [DroppedObjects] will load sprite { base: 'bench', angle: 0, viewType: 'top-down' }
   [addEnhancedSprites] loading { id: 'bench_000', urls: ['/static/bench/bench_TOP_000.png', ...] }
   ```

2. **Successful Load:**
   ```
   [addEnhancedSprites] loaded successfully { id: 'bench_000', src: '/static/bench/bench_TOP_000.png' }
   [DroppedObjects] sprites loaded, incrementing nonce
   ```

3. **Icon Ready Check:**
   ```
   [DroppedObjects] rebuildDroppedData called { viewType: 'top-down', bearing: 0, objectCount: 1 }
   [DroppedObjects] icon ready { objId: 'xxx', imgId: 'bench_000', iconRotate: 45 }
   ```

4. **Icon NOT Ready (Problem):**
   ```
   [DroppedObjects] icon NOT ready { objId: 'xxx', imgId: 'bench_000', hasPrevIcon: false }
   ```

### Potential Issues to Investigate

1. **Race Condition:** Features are rebuilt before sprites finish loading
   - Solution: Sprites should trigger rebuild via `spritesReadyNonce` (line 491)

2. **URL Construction:** Wrong URL being generated for 2D sprites
   - Check: `buildFlatSpriteUrl('bench', 0, 'top-down')` should return `/static/bench/bench_TOP_000.png`

3. **Image Registration:** Sprites load but aren't registered with map
   - Check: `map.hasImage('bench_000')` should return true after load

4. **Layer Visibility:** Features have `icon_image` but layer doesn't show them
   - Check: `DROPPED_SYMBOL_LAYER_ID` layer exists and is visible
   - Check: Features have `icon_image` property in source data

### Test Procedure

1. Open app in 2D mode (pitch = 0)
2. Enable debug logging
3. Select a placeable object (e.g., bench, chair)
4. Click on map to place object
5. Observe console logs
6. Check if icon appears on map

### Expected vs Actual Behavior

**Expected:**
- Sprite loads from `/static/{object}/{object}_TOP_000.png`
- Sprite registered as `{object}_000`
- Feature gets `icon_image` property
- Icon appears on map with CSS rotation

**Actual (if broken):**
- Need to observe console logs to determine exact failure point

## Changes Made

1. **DroppedObjects.jsx:**
   - Line 13: Enabled DEBUG flag
   - Lines 202-224: Added detailed logging to sprite preload effect
   - Line 258: Added logging to `rebuildDroppedData`
   - Lines 305, 309: Added icon ready/not ready logging

2. **enhancedRenderingUtils.js:**
   - Lines 146-147: Added function entry logging
   - Lines 157, 174, 179, 197, 202: Added sprite loading lifecycle logs

## Next Steps

1. Run the app with debug logging enabled
2. Place objects in 2D mode
3. Analyze console logs to identify exact failure point
4. Apply targeted fix based on findings
5. Test with different object types
6. Verify rotation works correctly
7. Test view switching (2D ↔ 3D) to ensure sprites update properly

## Rollback Instructions

If debug logging needs to be disabled:

1. Set `DEBUG = false` in `DroppedObjects.jsx` line 13
2. Remove or comment out the debug logging additions in both files



