// utils/tooltipUtils.js
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
  }
  
  // Generic handling for other layers
  return filteredProps
    .slice(0, 5)
    .map(([key, value]) => ({
      label: formatFieldName(key), 
      value: value
    }));
};

const formatFieldName = (key) => {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
};

export const highlightSearchTerm = (text, term) => {
  if (!text || !term.trim()) return text;
  
  const regex = new RegExp(`(${term.trim()})`, 'gi');
  const parts = text.split(regex);
  
  return parts.map((part, index) => 
    regex.test(part) ? { type: 'highlight', text: part, key: index } : { type: 'normal', text: part, key: index }
  );
};