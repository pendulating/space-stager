import { GEOGRAPHY_ENDPOINTS } from './endpoints';
export const GEOGRAPHIES = {
  parks: {
    idPrefix: 'permit-areas',
    datasetUrl: GEOGRAPHY_ENDPOINTS.parks,
    type: 'polygon',
    displayName: 'Parks Permit Areas',
    displayNameField: 'name',
    searchKeys: ['name', 'propertyname', 'subpropertyname'],
    // Focus by a stable property present in dataset (Feature.id may not be stable)
    focusFilter: { type: 'property', key: 'system' },
    info: "Use parks permit areas if you are looking to have an event within a NYC Parks' managed space. If using this mode, you should submit your permit application to NYC Parks & Recreation.",
    link: 'https://nyceventpermits.nyc.gov/parks/Login.aspx?ReturnUrl=%2fParks%2f'
  },
  plazas: {
    idPrefix: 'plaza-areas',
    datasetUrl: GEOGRAPHY_ENDPOINTS.plazas,
    type: 'polygon',
    displayName: 'DOT Plaza Areas',
    displayNameField: 'FSN_1',
    // Allow lookups by multiple frontage street names; FSN_3/FSN_4 present in enriched dataset
    searchKeys: ['FSN_1', 'FSN_2', 'FSN_3', 'FSN_4'],
    // Focus by generated/source feature id
    focusFilter: { type: 'id' },
    info: 'Use plaza areas if you are looking to have an event within a public plaza, managed by the NYC Department of Transportation. If using this mode, you should submit your permit application to the Street Activity Permit Office (SAPO).',
    link: 'https://www.nyc.gov/site/cecm/about/sapo.page'
  },
  intersections: {
    idPrefix: 'intersections',
    displayName: 'Block-by-Block Street Network',
    datasetUrl: GEOGRAPHY_ENDPOINTS.intersections,
    type: 'point',
    displayNameField: 'FSN_1',
    secondaryNameField: 'FSN_2',
    searchKeys: ['FSN_1', 'FSN_2'],
    focusFilter: { type: 'id' },
    info: 'Use the street network mode if you are looking to have an event on a block-to-block(s) span of public street in NYC. If using this mode, you should submit your permit application to the Street Activity Permit Office (SAPO).',
    link: 'https://www.nyc.gov/site/cecm/about/sapo.page'
  }
};


