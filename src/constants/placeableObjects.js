// constants/placeableObjects.js
export const PLACEABLE_OBJECTS = [
  {
    id: 'grill',
    name: 'Grill',
    category: 'Equipment',
    icon: '🔥', // Fallback for export or if image fails
    imageUrl: '/data/dropped-objects/grill-isometric-1.png',
    color: '#dc2626',
    size: { width: 36, height: 36 }
  },
  {
    id: 'trash-bag',
    name: 'Trash Bag',
    category: 'Waste Management',
    icon: '🗑️', // Fallback
    imageUrl: '/data/dropped-objects/trash-bag-isometric-1.png',
    color: '#374151',
    size: { width: 32, height: 32 }
  },
  {
    id: 'chair',
    name: 'Chair',
    category: 'Furniture',
    icon: '🪑', // Fallback
    imageUrl: '/data/dropped-objects/camping-chair-isometric-1.png',
    color: '#2563eb',
    size: { width: 34, height: 34 }
  },
  {
    id: 'cooler',
    name: 'Cooler',
    category: 'Equipment',
    icon: '🧊', // Fallback
    imageUrl: '/data/dropped-objects/cooler-isometric-1.png',
    color: '#0ea5e9',
    size: { width: 34, height: 34 }
  },
  {
    id: 'plastic-table',
    name: 'Plastic Table',
    category: 'Furniture',
    icon: '🔲', // Fallback
    imageUrl: '/data/dropped-objects/plastic-table-isometric-2.png',
    color: '#6b7280',
    size: { width: 36, height: 36 }
  },
  {
    id: 'speaker',
    name: 'Speaker',
    category: 'Audio',
    icon: '🔊', // Fallback
    imageUrl: '/data/dropped-objects/speaker-isometric-2.png',
    color: '#111827',
    size: { width: 34, height: 34 }
  }
];