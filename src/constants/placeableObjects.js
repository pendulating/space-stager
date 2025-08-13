// constants/placeableObjects.js
export const PLACEABLE_OBJECTS = [
  {
    id: 'grill',
    name: 'Grill',
    category: 'Equipment',
    icon: '🔥', // Fallback for export or if image fails
    imageUrl: '/data/icons/dropped-objects/grill.svg',
    color: '#dc2626',
    size: { width: 36, height: 36 }
  },
  {
    id: 'trash-bag',
    name: 'Trash Bag',
    category: 'Waste Management',
    icon: '🗑️', // Fallback
    imageUrl: '/data/icons/dropped-objects/trash.svg',
    color: '#374151',
    size: { width: 32, height: 32 }
  },
  {
    id: 'chair',
    name: 'Chair',
    category: 'Furniture',
    icon: '🪑', // Fallback
    imageUrl: '/data/icons/dropped-objects/camping-chair.svg',
    color: '#2563eb',
    size: { width: 34, height: 34 }
  },
  {
    id: 'plastic-table',
    name: 'Plastic Table',
    category: 'Furniture',
    icon: '🔲', // Fallback
    imageUrl: '/data/icons/dropped-objects/table.svg',
    color: '#6b7280',
    size: { width: 36, height: 36 }
  },
  {
    id: 'speaker',
    name: 'Speaker',
    category: 'Audio',
    icon: '🔊', // Fallback
    imageUrl: '/data/icons/dropped-objects/sound.svg',
    color: '#111827',
    size: { width: 34, height: 34 }
  },
  {
    id: 'balloons',
    name: 'Balloons',
    category: 'Decor',
    icon: '🎈',
    imageUrl: '/data/icons/dropped-objects/balloons.svg',
    color: '#ef4444',
    size: { width: 32, height: 32 }
  }
];