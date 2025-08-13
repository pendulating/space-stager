// src/hooks/useNudges.js
// Purpose: React hook to orchestrate nudge evaluation: gather facts, manage indexes, debounce, and expose nudges.
// Linked files:
// - Consumes rules from `src/constants/nudgeRules.js`
// - Calls `src/utils/nudgeEngine.js` (optionally via worker with Comlink)
// - May build indexes with `src/utils/nudgeSpatialIndex.js` and `src/utils/nudgeTextIndex.js`
// - Used by UI `src/components/Nudges/NudgeCenter.jsx`

// Implementation outline (no logic yet):
// - Inputs: { map, droppedObjects, customShapes, infrastructureData, focusedArea, rules, options }
// - Keep refs to indexes and caches
// - Debounce evaluation with 50–100ms window
// - Return { nudges, dismiss, snooze, highlight, zoomTo }

import { useMemo, useRef, useState, useEffect } from 'react';
import { evaluateNudges } from '../utils/nudgeEngine';
import { NUDGE_RULES } from '../constants/nudgeRules';

export function useNudges({
  map,
  droppedObjects,
  customShapes,
  infrastructureData,
  layers,
  labelScan = false
}) {
  const [nudges, setNudges] = useState([]);
  const ignoreSetRef = useRef(new Set()); // stores nudge ids ignored by user
  const debounceRef = useRef(null);
  const lastSigRef = useRef('');
  const lastOutRef = useRef([]);
  const [highlightedIds, setHighlightedIds] = useState(new Set());

  // Debounce evaluation
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      // Build lightweight signature for memoization
      const proxLayerIds = Array.from(new Set(NUDGE_RULES
        .filter(r => r.type === 'proximity' && r.target?.layerId)
        .map(r => r.target.layerId)));
      const droppedSig = (droppedObjects || [])
        .map(o => `${o.id}:${o.type}:${o.position?.lng?.toFixed(6)},${o.position?.lat?.toFixed(6)}`)
        .sort().join('|');
      const layersVisSig = proxLayerIds.map(id => `${id}:${!!layers?.[id]?.visible}`).join('|');
      const infraSig = proxLayerIds.map(id => {
        const feats = infrastructureData?.[id]?.features || [];
        const len = feats.length;
        const first = feats[0];
        const firstKey = first?.id || (first?.geometry?.coordinates ? String(first.geometry.coordinates.slice(0,2)) : '');
        return `${id}:${len}:${firstKey}`;
      }).join('|');
      const textSig = labelScan ? `labelScan:${Date.now()}` : 'labelScan:0';
      const sig = `${droppedSig}||${layersVisSig}||${infraSig}||${textSig}`;

      if (sig === lastSigRef.current) {
        // No significant changes; keep previous
        const filteredPrev = (lastOutRef.current || []).filter(n => !ignoreSetRef.current.has(n.id));
        setNudges(filteredPrev);
        return;
      }
      lastSigRef.current = sig;

      const { nudges: out } = evaluateNudges({
        rules: NUDGE_RULES,
        droppedObjects,
        customShapes,
        infrastructureData,
        layers,
        options: { labelScan }
      });
      lastOutRef.current = out;
      const filtered = out.filter(n => !ignoreSetRef.current.has(n.id));
      setNudges(filtered);
    }, 100);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [droppedObjects, customShapes, infrastructureData, layers, labelScan]);

  const dismiss = (id) => {
    ignoreSetRef.current.add(id);
    setNudges(prev => prev.filter(n => n.id !== id));
  };

  const zoomTo = (n) => {
    if (!map || !n?.subject?.position) return;
    map.easeTo({ center: n.subject.position, duration: 600 });
  };

  const highlight = (n) => {
    if (!n?.id) return;
    setHighlightedIds(prev => {
      const next = new Set(prev);
      next.add(n.id);
      return next;
    });
    setTimeout(() => {
      setHighlightedIds(prev => {
        const next = new Set(prev);
        next.delete(n.id);
        return next;
      });
    }, 1500);
  };

  return { nudges, dismiss, zoomTo, highlight, highlightedIds };
}


