import { GEOGRAPHY_ENDPOINTS } from './endpoints';
export const GEOGRAPHIES = {
  parks: {
    idPrefix: 'permit-areas',
    datasetUrl: GEOGRAPHY_ENDPOINTS.parks,
    type: 'polygon',
    displayNameField: 'name',
    searchKeys: ['name', 'propertyname', 'subpropertyname'],
    info: '',
    link: ''
  },
  plazas: {
    idPrefix: 'plaza-areas',
    datasetUrl: GEOGRAPHY_ENDPOINTS.plazas,
    type: 'polygon',
    displayNameField: 'FSN_1',
    // Allow lookups by multiple frontage street names; FSN_3/FSN_4 present in enriched dataset
    searchKeys: ['FSN_1', 'FSN_2', 'FSN_3', 'FSN_4'],
    info: '',
    link: ''
  },
  intersections: {
    idPrefix: 'intersections',
    datasetUrl: GEOGRAPHY_ENDPOINTS.intersections,
    type: 'point',
    displayNameField: 'FSN_1',
    secondaryNameField: 'FSN_2',
    searchKeys: ['FSN_1', 'FSN_2'],
    info: '',
    link: ''
  }
};


