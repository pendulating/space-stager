---
sidebar_position: 11
title: Architecture Decisions (ADRs)
---

- Map events centralized via `useMapEvents` to avoid scattered handlers; reattach on `style.load`.
- Enhanced sprites: keep `icon-rotation-alignment: viewport` and swap variants on bearing changes.
- Draw tools: initialize early; rebind after `style.load`; provide Retry control in UI.


