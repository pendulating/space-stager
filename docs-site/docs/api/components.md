---
title: React Components Reference
sidebar_position: 1
---

Component prop reference generated from source via react-docgen.

## src/components/Header/Header.jsx

### Header


Name | Required | Default | Type
--- | --- | --- | ---
isDarkMode | No | `false` | 
onToggleDarkMode | No | `() => {}` | 
onImportClick | No | `null` | 
onShowExamples | No | `null` | 


## src/components/MTA/TrainLineCluster.jsx

### TrainLineCluster

Cluster of MTA train line icons
Shows multiple train lines together with smart overflow handling

@param \{string[]\} lines - Array of train line identifiers
@param \{string\} size - Size variant: 'small', 'medium', 'large'
@param \{number\} maxVisible - Maximum number of icons to show before overflow
@param \{string\} className - Additional CSS classes


Name | Required | Default | Type
--- | --- | --- | ---
lines | No | `[]` | 
size | No | `'medium'` | 
maxVisible | No | `4` | 
className | No | `''` | 


## src/components/MTA/TrainLineIcon.jsx

### TrainLineIcon

Individual MTA train line icon component
Based on NYC Core Framework subway icon styles
https://www.nyc.gov/assets/oti/html/nyc-core-framework/subway-icons.html

@param \{string\} line - Train line identifier (e.g., '1', 'A', 'Q')
@param \{string\} size - Size variant: 'small' (16px), 'medium' (20px), 'large' (24px)
@param \{string\} className - Additional CSS classes


Name | Required | Default | Type
--- | --- | --- | ---
size | No | `'medium'` | 
className | No | `''` | 


## src/components/Map/ActiveToolIndicator.jsx

### ActiveToolIndicator


_No props_


## src/components/Map/ClickPopover.jsx

### ClickPopover


_No props_


## src/components/Map/CustomShapeLabels.jsx

### CustomShapeLabels


Name | Required | Default | Type
--- | --- | --- | ---
showLabels | No | `true` | 


## src/components/Map/DroppedObjectNoteEditor.jsx

### DroppedObjectNoteEditor


_No props_


## src/components/Map/DroppedObjects.jsx

### DroppedObjects


Name | Required | Default | Type
--- | --- | --- | ---
objects | No | `[]` | 
placeableObjects | No | `[]` | 


## src/components/Map/DroppedRectangles.jsx

### DroppedRectangles


Name | Required | Default | Type
--- | --- | --- | ---
objects | No | `[]` | 
placeableObjects | No | `[]` | 


## src/components/Map/EdgeMarkers.jsx

### EdgeMarkers


Name | Required | Default | Type
--- | --- | --- | ---
categories | No | `['busStops', 'parkingMeters', 'subwayEntrances']` | 


## src/components/Map/LoadingOverlay.jsx

### LoadingOverlay


Name | Required | Default | Type
--- | --- | --- | ---
showDebugInfo | No | `false` | 


## src/components/Map/MapContainer.jsx

### MapContainer


Name | Required | Default | Type
--- | --- | --- | ---
isSitePlanMode | No | `false` | 
isRightSidebarOpen | No | `false` | 


## src/components/Map/MapTooltip.jsx

### MapTooltip


_No props_


## src/components/Map/NudgeMarkers.jsx

### NudgeMarkers


Name | Required | Default | Type
--- | --- | --- | ---
nudges | No | `[]` | 
objectUpdateTrigger | No | `0` | 
highlightedIds | No | `new Set()` | 


## src/components/Map/OverlapSelector.jsx

### OverlapSelector


Name | Required | Default | Type
--- | --- | --- | ---
overlappingAreas | No | `[]` | 
selectedIndex | No | `0` | 
clickPosition | No | `{ x: 0, y: 0 }` | 


## src/components/Map/PlacementPreview.jsx

### PlacementPreview


_No props_


## src/components/Map/ViewportInset.jsx

### ViewportInset


Name | Required | Default | Type
--- | --- | --- | ---
isSitePlanMode | No | `false` | 
isRightSidebarOpen | No | `false` | 


## src/components/MobileLanding.jsx

### MobileLanding


_No props_


## src/components/Modals/ConfirmModal.jsx

### ConfirmModal


Name | Required | Default | Type
--- | --- | --- | ---
confirmText | No | `'Confirm'` | 
cancelText | No | `'Cancel'` | 


## src/components/Modals/EventInfoModal.jsx

### EventInfoModal


_No props_


## src/components/Modals/ExamplesModal.jsx

### ExamplesModal


_No props_


## src/components/Modals/ExportOptionsModal.jsx

### ExportOptionsModal


_No props_


## src/components/Modals/FocusInfoPanel.jsx

### FocusInfoPanel


Name | Required | Default | Type
--- | --- | --- | ---
hasSubFocus | No | `false` | 
onBeginSubFocus | No | `null` | 
onClearSubFocus | No | `null` | 


## src/components/Modals/GeographySelector.jsx

### GeographySelector


_No props_


## src/components/Modals/ImportProgressModal.jsx

### ImportProgressModal


Name | Required | Default | Type
--- | --- | --- | ---
steps | No | `[complex value]` | 


## src/components/Modals/InfoPanel.jsx

### InfoPanel


Name | Required | Default | Type
--- | --- | --- | ---
showInfo | No | `true` | 


## src/components/Modals/InfraProgressModal.jsx

### InfraProgressModal


Name | Required | Default | Type
--- | --- | --- | ---
total | No | `0` | 
completed | No | `0` | 


## src/components/Nudges/NudgeCenter.jsx

### NudgeCenter


Name | Required | Default | Type
--- | --- | --- | ---
nudges | No | `[]` | 


## src/components/Sidebar/BasemapToggle.jsx

### BasemapToggle


_No props_


## src/components/Sidebar/CustomShapesList.jsx

### CustomShapesList


Name | Required | Default | Type
--- | --- | --- | ---
showLabels | No | `true` | 


## src/components/Sidebar/DrawingTools.jsx

### DrawingTools


Name | Required | Default | Type
--- | --- | --- | ---
drawAvailable | No | `true` | 


## src/components/Sidebar/DroppedObjectsList.jsx

### DroppedObjectsList


Name | Required | Default | Type
--- | --- | --- | ---
objects | No | `[]` | 
placeableObjects | No | `[]` | 


## src/components/Sidebar/GeographyCompactSelector.jsx

### GeographyCompactSelector


_No props_


## src/components/Sidebar/LayersPanel.jsx

### LayersPanel


Name | Required | Default | Type
--- | --- | --- | ---
isSitePlanMode | No | `false` | 
hasSubFocus | No | `false` | 
onBeginSubFocus | No | `null` | 
onClearSubFocus | No | `null` | 


## src/components/Sidebar/PermitAreaSearch.jsx

### PermitAreaSearch


Name | Required | Default | Type
--- | --- | --- | ---
title | No | `'Search Zones'` | 
placeholder | No | `'Search zones...'` | 
onChangeMode | No | `null` | 
permitAreasLayer | No | `null` | 
onToggleLayer | No | `null` | 
geographyType | No | `'parks'` | 


## src/components/Sidebar/PlaceableObjectsPanel.jsx

### PlaceableObjectsPanel


_No props_


## src/components/Sidebar/RightSidebar.jsx

### RightSidebar


Name | Required | Default | Type
--- | --- | --- | ---
mode | No | `'expanded'` | 
isOpen | No | `true` | 
onClose | No | `() => {}` | 
onToggle | No | `() => {}` | 


## src/components/Sidebar/ShapeProperties.jsx

### ShapeProperties


_No props_


## src/components/Sidebar/Sidebar.jsx

### Sidebar


Name | Required | Default | Type
--- | --- | --- | ---
isSitePlanMode | No | `false` | 
onCollapse | No | `() => {}` | 


## src/components/Sidebar/ZoneCreatorPanel.jsx

### ZoneCreatorPanel


_No props_


## src/components/SpaceStager.jsx

### SpaceStager


_No props_


## src/components/Tutorial/SapoWalkthroughModal.jsx

### SapoWalkthroughModal


_No props_


## src/components/Tutorial/TutorialTooltip.jsx

### TutorialTooltip


_No props_


## src/components/Tutorial/WelcomeOverlay.jsx

### WelcomeOverlay


_No props_

