// constants/placeableObjects.js
export const PLACEABLE_OBJECTS = [
  {
    id: 'stage',
    name: 'Stage',
    category: 'Structures',
    icon: '⬛',
    color: '#1f2937',
    size: { width: 36, height: 36 },
    geometryType: 'rect',
    units: 'ft',
    defaults: { min: { w: 8, h: 6 } },
    texture: { url: '/data/textures/stage.png', size: 48 }
  },
  {
    id: 'tent',
    name: 'Tent',
    category: 'Structures',
    icon: '⛺',
    color: '#f8f9fa',
    size: { width: 48, height: 48 },
    geometryType: 'rect',
    units: 'ft',
    defaults: { min: { w: 10, h: 10 } },
    texture: { url: '/data/textures/tent.svg', size: 64 }
  },
  {
    id: 'grill',
    name: 'Grill',
    category: 'Equipment',
    icon: '🔥', // Fallback for export or if image fails
    imageUrl: '/static/charcoal-grill/isometric/renders/charcoal-grill_000.png',
    color: '#dc2626',
    size: { width: 36, height: 36 },
    enhancedRendering: {
      enabled: true,
      spriteBase: 'charcoal-grill',
      publicDir: '/static/charcoal-grill/isometric/renders',
      angles: [0, 45, 90, 135, 180, 225, 270, 315]
    }
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
    size: { width: 34, height: 34 },
    // Enable 8-angle isometric variants for camping chairs (assets copied to public dir)
    enhancedRendering: {
      enabled: true,
      spriteBase: 'camping-chair',
      publicDir: '/static/camping-chair/isometric/renders',
      angles: [0, 45, 90, 135, 180, 225, 270, 315]
    }
  },
  {
    id: 'cooler',
    name: 'Cooler',
    category: 'Equipment',
    icon: '🧊', // Fallback
    // Base image is not used for enhanced variants but kept for compatibility
    imageUrl: '/static/cooler/isometric/renders/cooler_000.png',
    color: '#0ea5e9',
    size: { width: 34, height: 34 },
    enhancedRendering: {
      enabled: true,
      spriteBase: 'cooler',
      publicDir: '/static/cooler/isometric/renders',
      angles: [0, 45, 90, 135, 180, 225, 270, 315]
    }
  },
  {
    id: 'plastic-table',
    name: 'Plastic Table',
    category: 'Furniture',
    icon: '🔲', // Fallback
    imageUrl: '/data/icons/isometric-bw/folding-table_000.png',
    color: '#6b7280',
    size: { width: 36, height: 36 },
    enhancedRendering: {
      enabled: true,
      spriteBase: 'folding-table',
      publicDir: '/data/icons/isometric-bw',
      angles: [0, 45, 90, 135, 180, 225, 270, 315]
    }
  },
  {
    id: 'speaker',
    name: 'Speaker',
    category: 'Audio',
    icon: '🔊', // Fallback
    imageUrl: '/data/icons/isometric-bw/speaker_000.png',
    color: '#111827',
    size: { width: 34, height: 34 },
    enhancedRendering: {
      enabled: true,
      spriteBase: 'speaker',
      publicDir: '/data/icons/isometric-bw',
      angles: [0, 45, 90, 135, 180, 225, 270, 315]
    }
  },
  {
    id: 'balloons',
    name: 'Balloons',
    category: 'Decor',
    icon: '🎈',
    imageUrl: '/data/icons/dropped-objects/balloons.svg',
    color: '#ef4444',
    size: { width: 32, height: 32 }
  },
  {
    id: 'banner',
    name: 'Banner',
    category: 'Decor',
    icon: '🏳️',
    imageUrl: '/data/icons/isometric-bw/banner_000.png',
    color: '#f59e0b',
    size: { width: 36, height: 36 },
    enhancedRendering: {
      enabled: true,
      spriteBase: 'banner',
      publicDir: '/data/icons/isometric-bw',
      angles: [0, 45, 90, 135, 180, 225, 270, 315]
    }
  },
  {
    id: 'projector-screen',
    name: 'Projector Screen',
    category: 'Structures',
    icon: '🖼️',
    imageUrl: '/data/icons/isometric-bw/projector-screen_000.png',
    color: '#6b7280',
    size: { width: 36, height: 36 },
    enhancedRendering: {
      enabled: true,
      spriteBase: 'projector-screen',
      publicDir: '/data/icons/isometric-bw',
      angles: [0, 45, 90, 135, 180, 225, 270, 315]
    }
  },
  {
    id: 'outdoor-fan',
    name: 'Outdoor Fan',
    category: 'Equipment',
    icon: '🌀',
    imageUrl: '/data/icons/isometric-bw/outdoor-fan_000.png',
    color: '#06b6d4',
    size: { width: 34, height: 34 },
    enhancedRendering: {
      enabled: true,
      spriteBase: 'outdoor-fan',
      publicDir: '/data/icons/isometric-bw',
      angles: [0, 45, 90, 135, 180, 225, 270, 315]
    }
  },
  {
    id: 'heat-lamp',
    name: 'Heat Lamp',
    category: 'Equipment',
    icon: '🔆',
    imageUrl: '/data/icons/isometric-bw/heat-lamp_000.png',
    color: '#f97316',
    size: { width: 34, height: 34 },
    enhancedRendering: {
      enabled: true,
      spriteBase: 'heat-lamp',
      publicDir: '/data/icons/isometric-bw',
      angles: [0, 45, 90, 135, 180, 225, 270, 315]
    }
  },
  {
    id: 'fire-extinguisher',
    name: 'Fire Extinguisher',
    category: 'Safety',
    icon: '🧯',
    imageUrl: '/data/icons/isometric-bw/fire-extinguisher_000.png',
    color: '#ef4444',
    size: { width: 28, height: 28 },
    enhancedRendering: {
      enabled: true,
      spriteBase: 'fire-extinguisher',
      publicDir: '/data/icons/isometric-bw',
      angles: [0, 45, 90, 135, 180, 225, 270, 315]
    }
  },
  {
    id: 'first-aid',
    name: 'First Aid Kit',
    category: 'Safety',
    icon: '🧰',
    imageUrl: '/data/icons/isometric-bw/first-aid_000.png',
    color: '#22c55e',
    size: { width: 28, height: 28 },
    enhancedRendering: {
      enabled: true,
      spriteBase: 'first-aid',
      publicDir: '/data/icons/isometric-bw',
      angles: [0, 45, 90, 135, 180, 225, 270, 315]
    }
  },
  {
    id: 'trash-can',
    name: 'Trash Can',
    category: 'Waste Management',
    icon: '🗑️',
    imageUrl: '/data/icons/isometric-bw/trash-can_000.png',
    color: '#374151',
    size: { width: 34, height: 34 },
    enhancedRendering: {
      enabled: true,
      spriteBase: 'trash-can',
      publicDir: '/data/icons/isometric-bw',
      angles: [0, 45, 90, 135, 180, 225, 270, 315]
    }
  },
  {
    id: 'plastic-seat-0',
    name: 'Plastic Seat',
    category: 'Furniture',
    icon: '💺',
    imageUrl: '/data/icons/isometric-bw/plastic-seat-0_000.png',
    color: '#6b7280',
    size: { width: 32, height: 32 },
    enhancedRendering: {
      enabled: true,
      spriteBase: 'plastic-seat-0',
      publicDir: '/data/icons/isometric-bw',
      angles: [0, 45, 90, 135, 180, 225, 270, 315]
    }
  }
];