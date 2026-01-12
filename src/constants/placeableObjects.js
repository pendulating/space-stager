// constants/placeableObjects.js
export const PLACEABLE_OBJECTS = [
  // STRUCTURES (Tileable Areas)
  {
    id: 'stage',
    name: 'Stage Riser',
    category: 'Structures',
    icon: '⬛',
    color: '#1f2937',
    geometryType: 'rect',
    units: 'ft',
    defaults: { min: { w: 8, h: 6 } },
    description: 'Standard 8ft x 6ft riser sections.'
  },
  {
    id: 'tent',
    name: 'Pop-up Tent',
    category: 'Structures',
    icon: '⛺',
    color: '#3b82f6',
    geometryType: 'rect',
    units: 'ft',
    defaults: { min: { w: 10, h: 10 } },
    description: 'Standard 10ft x 10ft canopy.'
  },
  {
    id: 'kiosk',
    name: 'Plaza Kiosk',
    category: 'Structures',
    icon: '🏪',
    color: '#4b5563',
    geometryType: 'rect',
    units: 'ft',
    defaults: { min: { w: 12, h: 9 } },
    description: 'Standard 12ft x 9ft plaza kiosk.'
  },

  // FURNITURE (Tileable Areas with dynamic icons)
  {
    id: 'seating-area',
    name: 'Seating Area',
    category: 'Furniture',
    icon: '🪑',
    color: '#2563eb',
    geometryType: 'rect',
    units: 'ft',
    defaults: { min: { w: 10, h: 10 } },
    tileIcon: 'camping-chair',
    tileSpacingFt: 4,
    description: 'Area for chairs or bistro sets.'
  },
  {
    id: 'bistro-sets',
    name: 'Bistro Sets',
    category: 'Furniture',
    icon: '☕',
    color: '#d97706',
    geometryType: 'rect',
    units: 'ft',
    defaults: { min: { w: 11, h: 5.5 } }, // ~2 sets
    tileIcon: 'table',
    tileSpacingFt: 6,
    description: '30 sq. ft. per table/chair set.'
  },

  // ACTIVITIES (Tileable Areas)
  {
    id: 'yoga-mats',
    name: 'Yoga Area',
    category: 'Activities',
    icon: '🧘',
    color: '#10b981',
    geometryType: 'rect',
    units: 'ft',
    defaults: { min: { w: 10, h: 10 } },
    tileIcon: 'trash', // placeholder
    tileSpacingFt: 5,
    description: '25 sq. ft. per person.'
  },
  {
    id: 'dynamic-activity',
    name: 'Zumba/Dance Area',
    category: 'Activities',
    icon: '💃',
    color: '#ec4899',
    geometryType: 'rect',
    units: 'ft',
    defaults: { min: { w: 14, h: 14 } },
    tileIcon: 'balloons', // placeholder
    tileSpacingFt: 7,
    description: '50 sq. ft. per person for movement.'
  },

  // EQUIPMENT (Critical Point Objects - Simplified)
  {
    id: 'first-aid',
    name: 'First Aid',
    category: 'Equipment',
    icon: '🏥',
    imageUrl: '/data/icons/dropped-objects/sound.svg', // placeholder
    color: '#ef4444',
    geometryType: 'point',
    size: { width: 32, height: 32 },
    description: 'Emergency medical station.'
  },
  {
    id: 'grill',
    name: 'Grill/Cooking',
    category: 'Equipment',
    icon: '🔥',
    imageUrl: '/data/icons/dropped-objects/grill.svg',
    color: '#dc2626',
    geometryType: 'point',
    size: { width: 32, height: 32 },
    description: 'Cooking or heating equipment.'
  },
  {
    id: 'sound-system',
    name: 'Sound System',
    category: 'Equipment',
    icon: '🔊',
    imageUrl: '/data/icons/dropped-objects/sound.svg',
    color: '#111827',
    geometryType: 'point',
    size: { width: 32, height: 32 },
    description: 'Speakers and audio gear.'
  },

  // SAFETY
  {
    id: 'barricade',
    name: 'Movable Barricade',
    category: 'Safety',
    icon: '🚧',
    color: '#f59e0b',
    geometryType: 'rect',
    units: 'ft',
    defaults: { min: { w: 8.5, h: 2 } },
    description: 'Standard 8ft 6in barricade section.'
  }
];
