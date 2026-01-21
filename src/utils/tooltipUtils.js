// utils/tooltipUtils.js

const formatFieldName = (key) => {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
};

// Format wheelchair accessibility value
const formatWheelchair = (value) => {
  if (value === '1' || value === 1 || value === 'true' || value === true) return '✓ Accessible';
  if (value === '0' || value === 0 || value === 'false' || value === false) return '✗ Not Accessible';
  return value || 'Unknown';
};

// Format boolean-like values
const formatBoolean = (value) => {
  const v = String(value).toLowerCase();
  if (v === 'yes' || v === 'true' || v === '1' || v === 'y') return 'Yes';
  if (v === 'no' || v === 'false' || v === '0' || v === 'n') return 'No';
  return value;
};

export const buildTooltipContent = (properties) => {
  if (!properties) return null;
  
  const fields = [];
  
  // Priority fields for permit areas
  if (properties.name) {
    fields.push({ label: 'Name', value: properties.name });
  }
  
  if (properties.propertyname) {
    fields.push({ label: 'Property', value: properties.propertyname });
  }
  
  if (properties.subpropertyname) {
    fields.push({ label: 'Sub-Property', value: properties.subpropertyname });
  }

  if (properties.address) {
    fields.push({ label: 'Address', value: properties.address });
  }

  if (properties.borough) {
    fields.push({ label: 'Borough', value: properties.borough });
  }

  if (properties.zipcode) {
    fields.push({ label: 'Zip Code', value: properties.zipcode });
  }

  // If no specific fields found, try to show any available string properties
  if (fields.length === 0) {
    Object.entries(properties)
      .filter(([key, value]) => 
        value && 
        typeof value === 'string' && 
        !['geom', 'geometry', 'the_geom', 'shape'].includes(key.toLowerCase())
      )
      .slice(0, 3)
      .forEach(([key, value]) => {
        fields.push({ 
          label: formatFieldName(key), 
          value: value 
        });
      });
  }
  
  return fields.length > 0 ? fields : null;
};

// Layer-specific configuration for tooltip fields
const LAYER_TOOLTIP_CONFIG = {
  busStops: {
    icon: '🚌',
    title: 'Bus Stop',
    titleField: 'stop_name',
    hoverFields: ['stop_name', 'route_ids'],
    detailFields: [
      { key: 'stop_name', label: 'Stop Name' },
      { key: 'stop_id', label: 'Stop ID' },
      { key: 'stop_code', label: 'Stop Code' },
      { key: 'route_ids', label: 'Routes', format: (v) => v ? String(v).split(',').join(', ') : null },
      { key: 'wheelchair_boarding', label: 'Wheelchair', format: formatWheelchair },
      { key: 'direction', label: 'Direction' }
    ]
  },
  subwayEntrances: {
    icon: '🚇',
    title: 'Subway Entrance',
    titleField: 'stop_name',
    hoverFields: ['stop_name', 'daytime_routes'],
    detailFields: [
      { key: 'stop_name', label: 'Station' },
      { key: 'daytime_routes', label: 'Routes', format: (v) => v ? String(v).split(' ').join(', ') : null },
      { key: 'entrance_type', label: 'Entrance Type' },
      { key: 'entry_allowed', label: 'Entry', format: formatBoolean },
      { key: 'exit_allowed', label: 'Exit', format: formatBoolean },
      { key: 'borough', label: 'Borough' },
      { key: 'line', label: 'Line' }
    ]
  },
  parkingMeters: {
    icon: '🅿️',
    title: 'Parking Meter',
    titleField: 'on_street',
    hoverFields: ['on_street', 'meter_number'],
    detailFields: [
      { key: 'meter_number', label: 'Meter #' },
      { key: 'on_street', label: 'Street' },
      { key: 'from_street', label: 'From' },
      { key: 'to_street', label: 'To' },
      { key: 'side_of_street', label: 'Side' },
      { key: 'status', label: 'Status' },
      { key: 'meter_hours', label: 'Hours' },
      { key: 'parking_facility_name', label: 'Facility' }
    ]
  },
  parkingLots: {
    icon: '🚗',
    title: 'Parking Lot',
    titleField: 'name',
    hoverFields: ['name', 'type'],
    detailFields: [
      { key: 'name', label: 'Name' },
      { key: 'type', label: 'Type' },
      { key: 'address', label: 'Address' },
      { key: 'capacity', label: 'Capacity' },
      { key: 'operator', label: 'Operator' }
    ]
  },
  dcwpParkingGarages: {
    icon: '🏢',
    title: 'Parking Garage',
    titleField: 'business_name',
    hoverFields: ['business_name', 'address_street_name'],
    detailFields: [
      { key: 'business_name', label: 'Name' },
      { key: 'detail', label: 'Details' },
      { key: 'address_building', label: 'Building' },
      { key: 'address_street_name', label: 'Street' },
      { key: 'address_borough', label: 'Borough' },
      { key: 'license_status', label: 'License' }
    ]
  },
  linknycKiosks: {
    icon: '📶',
    title: 'LinkNYC Kiosk',
    titleField: 'street_address',
    hoverFields: ['street_address', 'status'],
    detailFields: [
      { key: 'kiosk_id', label: 'Kiosk ID' },
      { key: 'street_address', label: 'Address' },
      { key: 'cross_streets', label: 'Cross Streets' },
      { key: 'kiosk_type', label: 'Type' },
      { key: 'status', label: 'Status' },
      { key: 'borough', label: 'Borough' },
      { key: 'neighborhood', label: 'Neighborhood' }
    ]
  },
  citibikeStations: {
    icon: '🚲',
    title: 'Citi Bike Station',
    titleField: 'name',
    hoverFields: ['name', 'capacity'],
    detailFields: [
      { key: 'name', label: 'Station' },
      { key: 'station_id', label: 'Station ID' },
      { key: 'capacity', label: 'Capacity' },
      { key: 'rental_methods', label: 'Rental Methods' },
      { key: 'is_virtual_station', label: 'Virtual', format: formatBoolean }
    ]
  },
  bikeParking: {
    icon: '🚲',
    title: 'Bike Parking',
    titleField: 'on_street',
    hoverFields: ['on_street', 'type'],
    detailFields: [
      { key: 'on_street', label: 'Street' },
      { key: 'type', label: 'Type' },
      { key: 'racks', label: 'Racks' },
      { key: 'capacity', label: 'Capacity' },
      { key: 'address', label: 'Address' }
    ]
  },
  hydrants: {
    icon: '🔴',
    title: 'Fire Hydrant',
    titleField: 'unitid',
    hoverFields: ['unitid', 'status'],
    detailFields: [
      { key: 'unitid', label: 'Hydrant ID' },
      { key: 'status', label: 'Status' },
      { key: 'rj_type', label: 'Type' },
      { key: 'borough', label: 'Borough' }
    ]
  },
  trees: {
    icon: '🌳',
    title: 'Street Tree',
    titleField: 'spc_common',
    hoverFields: ['spc_common', 'health'],
    detailFields: [
      { key: 'spc_common', label: 'Species' },
      { key: 'spc_latin', label: 'Latin Name' },
      { key: 'health', label: 'Health' },
      { key: 'status', label: 'Status' },
      { key: 'tree_dbh', label: 'Diameter' },
      { key: 'address', label: 'Address' },
      { key: 'zipcode', label: 'Zip Code' }
    ]
  },
  benches: {
    icon: '🪑',
    title: 'Bench',
    titleField: 'address',
    hoverFields: ['address', 'bench_type'],
    detailFields: [
      { key: 'address', label: 'Address' },
      { key: 'bench_type', label: 'Type' },
      { key: 'material', label: 'Material' },
      { key: 'condition', label: 'Condition' }
    ]
  },
  publicRestrooms: {
    icon: '🚻',
    title: 'Public Restroom',
    titleField: 'name',
    hoverFields: ['name', 'location'],
    detailFields: [
      { key: 'name', label: 'Name' },
      { key: 'location', label: 'Location' },
      { key: 'open', label: 'Open' },
      { key: 'accessible', label: 'Accessible', format: formatBoolean },
      { key: 'hours', label: 'Hours' }
    ]
  },
  trashBaskets: {
    icon: '🗑️',
    title: 'Litter Basket',
    titleField: 'basketid',
    hoverFields: ['basketid', 'district'],
    detailFields: [
      { key: 'basketid', label: 'Basket ID' },
      { key: 'district', label: 'District' },
      { key: 'section', label: 'Section' },
      { key: 'baskettype', label: 'Type' }
    ]
  },
  streetParkingSigns: {
    icon: '🪧',
    title: 'Parking Sign',
    titleField: 'sign_description',
    hoverFields: ['sign_description', 'on_street'],
    detailFields: [
      { key: 'sign_description', label: 'Sign' },
      { key: 'on_street', label: 'Street' },
      { key: 'from_street', label: 'From' },
      { key: 'to_street', label: 'To' },
      { key: 'side_of_street', label: 'Side' },
      { key: 'arrow_direction', label: 'Arrow' }
    ]
  },
  accessiblePedSignals: {
    icon: '🚶',
    title: 'Accessible Pedestrian Signal',
    titleField: 'location',
    hoverFields: ['location', 'boroname'],
    detailFields: [
      { key: 'location', label: 'Location' },
      { key: 'boroname', label: 'Borough' },
      { key: 'date_insta', label: 'Installed' }
    ]
  },
  fireLanes: {
    icon: '🚒',
    title: 'Fire Lane',
    titleField: 'full_street_name',
    hoverFields: ['full_street_name'],
    detailFields: [
      { key: 'full_street_name', label: 'Street' },
      { key: 'posted_speed', label: 'Speed Limit' },
      { key: 'number_total_lanes', label: 'Lanes' },
      { key: 'streetwidth', label: 'Width' }
    ]
  },
  specialDisasterRoutes: {
    icon: '⚠️',
    title: 'Special Disaster Route',
    titleField: 'full_street_name',
    hoverFields: ['full_street_name'],
    detailFields: [
      { key: 'full_street_name', label: 'Street' },
      { key: 'posted_speed', label: 'Speed Limit' },
      { key: 'number_total_lanes', label: 'Lanes' }
    ]
  },
  drinkingFountains: {
    icon: '🚰',
    title: 'Drinking Fountain',
    titleField: 'name',
    hoverFields: ['name', 'location'],
    detailFields: [
      { key: 'name', label: 'Name' },
      { key: 'location', label: 'Location' },
      { key: 'type', label: 'Type' }
    ]
  },
  sprayShowers: {
    icon: '💦',
    title: 'Spray Shower',
    titleField: 'location',
    hoverFields: ['location'],
    detailFields: [
      { key: 'location', label: 'Location' },
      { key: 'type', label: 'Type' },
      { key: 'status', label: 'Status' }
    ]
  }
};

// Build HTML content for hover popup (brief)
export const buildInfrastructureHoverContent = (properties, layerId) => {
  if (!properties) return '';
  
  const config = LAYER_TOOLTIP_CONFIG[layerId];
  if (!config) {
    // Fallback for unconfigured layers
    const firstProp = Object.entries(properties).find(([k, v]) => 
      v && typeof v === 'string' && !['geom', 'geometry', 'the_geom', 'shape'].includes(k.toLowerCase())
    );
    return `<div class="infra-hover-content"><strong>${formatFieldName(layerId)}</strong>${firstProp ? `<br/><span class="text-muted">${firstProp[1]}</span>` : ''}</div>`;
  }
  
  const titleValue = properties[config.titleField] || config.title;
  const lines = [`<div class="infra-hover-content">`, `<div class="infra-hover-title">${config.icon} ${titleValue}</div>`];
  
  // Add hover fields
  config.hoverFields.forEach(fieldKey => {
    if (fieldKey === config.titleField) return; // Skip title field
    const value = properties[fieldKey];
    if (value) {
      const fieldConfig = config.detailFields.find(f => f.key === fieldKey);
      const formatted = fieldConfig?.format ? fieldConfig.format(value) : value;
      if (formatted) {
        lines.push(`<div class="infra-hover-detail">${formatted}</div>`);
      }
    }
  });
  
  lines.push('</div>');
  return lines.join('');
};

// Build HTML content for click popup (detailed)
export const buildInfrastructureClickContent = (properties, layerId) => {
  if (!properties) return '';
  
  const config = LAYER_TOOLTIP_CONFIG[layerId];
  if (!config) {
    // Fallback for unconfigured layers
    const items = Object.entries(properties)
      .filter(([k, v]) => v && typeof v === 'string' && !['geom', 'geometry', 'the_geom', 'shape'].includes(k.toLowerCase()))
      .slice(0, 6);
    
    return `<div class="infra-click-content">
      <div class="infra-click-title">${formatFieldName(layerId)}</div>
      <div class="infra-click-body">
        ${items.map(([k, v]) => `<div class="infra-click-row"><span class="infra-click-label">${formatFieldName(k)}</span><span class="infra-click-value">${v}</span></div>`).join('')}
      </div>
    </div>`;
  }
  
  const titleValue = properties[config.titleField] || config.title;
  const lines = [
    `<div class="infra-click-content">`,
    `<div class="infra-click-header">`,
    `<span class="infra-click-icon">${config.icon}</span>`,
    `<div class="infra-click-title">${titleValue}</div>`,
    `<div class="infra-click-subtitle">${config.title}</div>`,
    `</div>`,
    `<div class="infra-click-body">`
  ];
  
  // Add detail fields
  config.detailFields.forEach(field => {
    const value = properties[field.key];
    if (value) {
      const formatted = field.format ? field.format(value) : value;
      if (formatted) {
        lines.push(`<div class="infra-click-row">`);
        lines.push(`<span class="infra-click-label">${field.label}</span>`);
        lines.push(`<span class="infra-click-value">${formatted}</span>`);
        lines.push(`</div>`);
      }
    }
  });
  
  lines.push('</div></div>');
  return lines.join('');
};

export const createInfrastructureTooltipContent = (properties, layerId) => {
  if (!properties) return [];
  
  // Remove geometry fields
  const filteredProps = Object.entries(properties)
    .filter(([key, value]) => value && 
      typeof value === 'string' && 
      !['geom', 'geometry', 'the_geom', 'shape'].includes(key.toLowerCase())
    );
  
  // Special handling for different layer types
  if (layerId === 'hydrants') {
    const importantFields = [
      { key: 'unitid', label: 'Hydrant ID' },
      { key: 'status', label: 'Status' },
      { key: 'rj_type', label: 'Type' }
    ];
    
    const content = [];
    
    importantFields.forEach(field => {
      const value = properties[field.key];
      if (value) {
        content.push({
          label: field.label,
          value: value
        });
      }
    });
    
    filteredProps.forEach(([key, value]) => {
      if (content.length < 5 && !importantFields.some(field => field.key === key)) {
        content.push({
          label: formatFieldName(key),
          value: value
        });
      }
    });
    
    return content;
  } else if (layerId === 'busStops') {
    const importantFields = [
      { key: 'stop_name', label: 'Stop Name' },
      { key: 'stop_id', label: 'Stop ID' },
      { key: 'stop_code', label: 'Stop Code' },
      { key: 'route_ids', label: 'Routes' },
      { key: 'wheelchair_boarding', label: 'Wheelchair Access' }
    ];
    
    const content = [];
    
    importantFields.forEach(field => {
      const value = properties[field.key];
      if (value) {
        content.push({
          label: field.label,
          value: value
        });
      }
    });
    
    return content;
  } else if (layerId === 'subwayEntrances') {
    const importantFields = [
      { key: 'stop_name', label: 'Station Name' },
      { key: 'entrance_type', label: 'Entrance Type' },
      { key: 'daytime_routes', label: 'Routes' },
      { key: 'entry_allowed', label: 'Entry Allowed' },
      { key: 'exit_allowed', label: 'Exit Allowed' },
      { key: 'borough', label: 'Borough' }
    ];
    
    const content = [];
    
    importantFields.forEach(field => {
      const value = properties[field.key];
      if (value) {
        content.push({
          label: field.label,
          value: value
        });
      }
    });
    
    return content;
  } else if (layerId === 'fireLanes') {
    const importantFields = [
      { key: 'full_street_name', label: 'Street Name' },
      { key: 'fire_lane', label: 'Fire Lane Status' },
      { key: 'posted_speed', label: 'Posted Speed' },
      { key: 'number_total_lanes', label: 'Total Lanes' },
      { key: 'streetwidth', label: 'Street Width' },
      { key: 'boroughcode', label: 'Borough' }
    ];
    
    const content = [];
    
    importantFields.forEach(field => {
      const value = properties[field.key];
      if (value) {
        content.push({
          label: field.label,
          value: value
        });
      }
    });
    
    return content;
  } else if (layerId === 'specialDisasterRoutes') {
    const importantFields = [
      { key: 'full_street_name', label: 'Street Name' },
      { key: 'special_disaster', label: 'Special Disaster Status' },
      { key: 'posted_speed', label: 'Posted Speed' },
      { key: 'number_total_lanes', label: 'Total Lanes' },
      { key: 'streetwidth', label: 'Street Width' },
      { key: 'boroughcode', label: 'Borough' }
    ];
    
    const content = [];
    
    importantFields.forEach(field => {
      const value = properties[field.key];
      if (value) {
        content.push({
          label: field.label,
          value: value
        });
      }
    });
    
    return content;
  }
  
  // Generic handling for other layers
  return filteredProps
    .slice(0, 5)
    .map(([key, value]) => ({
      label: formatFieldName(key), 
      value: value
    }));
};

export const highlightSearchTerm = (text, term) => {
  if (!text || !term.trim()) return text;
  
  const regex = new RegExp(`(${term.trim()})`, 'gi');
  const parts = text.split(regex);
  
  return parts.map((part, index) => 
    regex.test(part) ? { type: 'highlight', text: part, key: index } : { type: 'normal', text: part, key: index }
  );
};