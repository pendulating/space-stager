// src/constants/nudgeRules.js
// Purpose: Central, declarative configuration of contextual nudge rules.
// Linked files:
// - Evaluated by `src/utils/nudgeEngine.js`
// - Consumed by `src/hooks/useNudges.js`
// - Displayed via `src/components/Nudges/NudgeCenter.jsx`

// NOTE: Keep this file simple and data-only so non-devs can extend rules easily.
// Best practices applied:
// - Rules are small JSON-like objects
// - No imports; engine owns library usage and evaluation semantics

export const NUDGE_RULES = [
  {
    id: 'proximity-grill-trees-10ft',
    type: 'proximity',
    severity: 'warning',
    message: 'Grill is within ${distanceFt.toFixed(0)} ft of a tree. Keep at least ${thresholdFt} ft clearance.',
    subject: { source: 'droppedObjects', where: { type: 'grill' } },
    target: { source: 'infrastructure', layerId: 'trees' },
    thresholdFt: 10,
    citation: 'https://www.nyc.gov/site/parks/permits/barbecuing.page',
    actions: ['zoomToSubject', 'highlight']
  },
  {
    id: 'proximity-grill-benches-6ft',
    type: 'proximity',
    severity: 'info',
    message: 'Grill is within ${distanceFt.toFixed(0)} ft of a bench. Maintain at least ${thresholdFt} ft for safety and comfort.',
    subject: { source: 'droppedObjects', where: { type: 'grill' } },
    target: { source: 'infrastructure', layerId: 'benches' },
    thresholdFt: 6,
    citation: 'https://www.nyc.gov/site/parks/permits/barbecuing.page',
    actions: ['zoomToSubject', 'highlight']
  },
  {
    id: 'proximity-anything-to-ped-ramp-3ft',
    type: 'proximity',
    severity: 'info',
    message: 'You cannot place anything within 3 ft of a pedestrian ramp, as equipment can not block wheelchair access on sidewalks.',
    subject: { source: 'droppedObjects', where: { type: 'anything' } },
    target: { source: 'infrastructure', layerId: 'pedestrian_ramps' },
    thresholdFt: 3,
    citation: 'https://www.nyc.gov/site/parks/rules/parks-rules.page',
  },
  {
    id: 'proximity-anything-fastened-to-tree-2ft',
    type: 'proximity',
    severity: 'info',
    message: 'Per NYC Parks rules, you cannot fasten or attach any sign, banner, flier or other object to any tree, shrub or park feature.',
    subject: { source: 'droppedObjects', where: { type: 'anything' } },
    target: { source: 'infrastructure', layerId: 'trees' },
    thresholdFt: 2,
    citation: 'https://www.nycgovparks.org/rules/section-1-04e',
  },
  {
    id: 'text-glass-prohibited',
    type: 'text',
    severity: 'info',
    message: '“Glass” is prohibited in NYC parks. Found in label: "${labelSnippet}"',
    source: { kind: 'customShapes', field: 'properties.label' },
    match: { mode: 'regex', pattern: '\\bglass\\b', flags: 'i' },
    citation: 'https://www.nyc.gov/site/parks/rules/parks-rules.page',
    actions: ['zoomToShape', 'highlight']
  },
  {
    id: 'text-alcohol-prohibited',
    type: 'text',
    severity: 'info',
    message: 'Alcohol is prohibited in NYC parks. Found: "${labelSnippet}"',
    source: { kind: 'customShapes', field: 'properties.label' },
    match: { mode: 'regex', pattern: '\\b(alcohol|beer|wine|liquor)\\b', flags: 'i' },
    citation: 'https://www.nyc.gov/site/parks/rules/parks-rules.page',
    actions: ['zoomToShape', 'highlight']
  },
  {
    id: 'text-generator-permit',
    type: 'text',
    severity: 'info',
    message: 'Generators may require permits and safety clearances. Found: "${labelSnippet}"',
    source: { kind: 'customShapes', field: 'properties.label' },
    match: { mode: 'regex', pattern: '\\bgenerator(s)?\\b', flags: 'i' },
    citation: 'https://www.nyc.gov/site/fdny/about/resources/code-regulations/permit-requirements.page',
    actions: ['zoomToShape', 'highlight']
  },
  {
    id: 'text-propane-permit',
    type: 'text',
    severity: 'warning',
    message: 'Propane (LPG) usage is regulated and may require permits. Found: "${labelSnippet}"',
    source: { kind: 'customShapes', field: 'properties.label' },
    match: { mode: 'regex', pattern: '\\b(propane|lpg)\\b', flags: 'i' },
    citation: 'https://www.nyc.gov/site/fdny/about/resources/code-regulations/permit-requirements.page',
    actions: ['zoomToShape', 'highlight']
  },
  // Object placement rules: triggered whenever object types are placed (location-independent)
  {
    id: 'object-generator-permit',
    type: 'object',
    severity: 'info',
    message: 'Generators require permits and must comply with FDNY rules. Object: ${objectName}',
    subject: { source: 'droppedObjects', where: { type: 'generator' } },
    citation: 'https://www.nyc.gov/site/fdny/about/resources/code-regulations/permit-requirements.page',
    actions: ['zoomToSubject', 'highlight']
  },
  {
    id: 'object-loudspeaker-permit',
    type: 'object',
    severity: 'info',
    message: 'Sound amplification may need a permit (NYPD Sound Device Permit). Object: ${objectName}',
    subject: { source: 'droppedObjects', where: { type: 'speaker' } },
    citation: 'https://portal.311.nyc.gov/article/?kanumber=KA-01012',
    actions: ['zoomToSubject', 'highlight']
  }
];

// Export preset groups (optional future extension)
export const NUDGE_RULE_GROUPS = {
  // parksDefault: ['proximity-grill-trees-10ft', 'text-glass-prohibited']
};


