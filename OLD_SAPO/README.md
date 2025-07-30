# OLD_SAPO - Archived SAPO Mode Files

This folder contains all the files related to the SAPO (Street Activity Permit Office) mode that was removed from the Space Stager application.

## What was SAPO Mode?

SAPO mode was a feature that allowed users to:
- Define street segments by drawing lines between two addresses
- Create rectangular zones around street segments for event planning
- Plan events within those street zones

## Files Moved to This Folder

### Components
- `components/SapoStager.jsx` - Main SAPO stager component
- `components/Sidebar/SapoModePanel.jsx` - SAPO mode panel for sidebar
- `components/Sidebar/SapoStreetSearch.jsx` - Street search component for SAPO mode
- `components/OLD_DO_NOT_USE.jsx` - Old component that contained SAPO references

### Hooks
- `hooks/useSapoMode.js` - Custom hook for SAPO mode functionality

### Styles
- `styles/eventStager-sapo.css` - SAPO-specific styles
- `styles/eventStager-main-sapo-styles.css` - SAPO styles extracted from main CSS file

## Date Archived
January 2025

## Reason for Removal
SAPO mode functionality was removed to simplify the application and focus on the Parks & Recreation (DPR) permit workflow.

## Note
These files are preserved for reference but are no longer part of the active codebase. The imports and dependencies have been removed from the main application. 