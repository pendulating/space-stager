---
sidebar_position: 5
title: Contexts & State Architecture
---

Top-level providers wire feature modules and share state across the app:

- `SitePlanContext`: siteplan editing state and export options.
- `GeographyContext`: mode, area datasets, and layer visibility.
- `ZoneCreatorContext`: intersections-specific flows.
- `DroppedObjectsContext`: selection and operations for placed objects.
- `TutorialContext`: onboarding flows and tips.

See `src/App.jsx` for provider composition.


