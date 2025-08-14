// utils/transitParkingUtils.js
// Transit & Parking information helper functions for PDF siteplan exports

// Import utility functions from exportUtils
import { wrapPdfLines } from './exportUtils';
import autoTable from 'jspdf-autotable';

// Draw prefixed labels for parking features on PDF
export const drawParkingFeatureLabelsOnPdf = (pdf, project, toMm, features, prefix) => {
  pdf.setTextColor(17, 24, 39);
  const oldSize = pdf.getFontSize();
  pdf.setFontSize(9);
  features.forEach((s) => {
    const p = toMm(project(s.lng, s.lat));
    const label = `${prefix}${s.index}`;
    pdf.setFillColor(255, 255, 255);
    const textW = pdf.getTextWidth(label) + 2;
    const textH = 5;
    pdf.rect(p.x - textW / 2, p.y - textH / 2, textW, textH, 'F');
    pdf.setDrawColor(200, 200, 200);
    pdf.rect(p.x - textW / 2, p.y - textH / 2, textW, textH);
    pdf.text(label, p.x, p.y + 1.5, { align: 'center' });
  });
  pdf.setFontSize(oldSize);
};

// Project and draw P{index} labels for parking signs on canvas
export const drawParkingFeatureLabelsOnCanvas = (ctx, offscreen, originPx, features, prefix) => {
  const project = (lng, lat) => offscreen.project([lng, lat]);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 11px Arial';
  features.forEach((s) => {
    const p = project(s.lng, s.lat);
    const x = originPx.x + p.x;
    const y = originPx.y + p.y;
    const label = `${prefix}${s.index}`;
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    const w = ctx.measureText(label).width + 6;
    const h = 14;
    ctx.fillRect(x - w / 2, y - h / 2, w, h);
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - w / 2, y - h / 2, w, h);
    ctx.fillStyle = '#111827';
    ctx.fillText(label, x, y + 0.5);
  });
  ctx.restore();
};

// Number point features within the focused area and return sorted label list
export const numberParkingFeaturesWithinArea = (features, focusedArea) => {
  if (!features || features.length === 0 || !focusedArea) return [];
  const inArea = features
    .filter(f => f?.geometry?.type === 'Point')
    .map((f) => ({
      feature: f,
      lng: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
      props: f.properties || {}
    }))
    .filter(p => isPointInFocusedArea(p.lng, p.lat, focusedArea));
  inArea.sort((a, b) => {
    const as = String(a.props.on_street || '').toLowerCase();
    const bs = String(b.props.on_street || '').toLowerCase();
    if (as !== bs) return as.localeCompare(bs);
    const af = String(a.props.from_street || '').toLowerCase();
    const bf = String(b.props.from_street || '').toLowerCase();
    if (af !== bf) return af.localeCompare(bf);
    if (a.lng !== b.lng) return a.lng - b.lng;
    return a.lat - b.lat;
  });
  // Assign independent sequences by feature type so P and M both start at 1
  return inArea.map((p, idx) => ({ index: idx + 1, lng: p.lng, lat: p.lat, props: p.props }));
};

// List subway stations within focused area from subway entrances dataset
export const listSubwayStationsWithinArea = (features, focusedArea) => {
  if (!features || features.length === 0 || !focusedArea) return [];
  const stations = new Map();
  try {
    features.forEach((f) => {
      const g = f?.geometry;
      if (!g || g.type !== 'Point') return;
      const coords = g.coordinates;
      const lng = coords[0];
      const lat = coords[1];
      if (!isPointInFocusedArea(lng, lat, focusedArea)) return;
      const name = f.properties?.constituent_station_name || f.properties?.stop_name || null;
      const routes = f.properties?.daytime_routes || '';
      const key = `${name || 'Station'}|${routes}`;
      stations.set(key, { name: name || 'Station', routes });
    });
  } catch (_) {}
  return Array.from(stations.values()).sort((a, b) => a.name.localeCompare(b.name));
};

// Render combined Parking & Transit summary page
export const drawParkingAndTransitPage = (pdf, regulationsInArea, metersInArea, stationsInArea, dcwpGarages = []) => {
  console.log('[ParkingTransit] Starting to draw parking & transit page with data:', {
    regulationsInArea: regulationsInArea?.length || 0,
    metersInArea: metersInArea?.length || 0,
    stationsInArea: stationsInArea?.length || 0,
    dcwpGarages: dcwpGarages?.length || 0
  });
  
  pdf.addPage('a4', 'landscape');
  const page = { w: 297, h: 210 };
  const margin = 12;
  const sectionGap = 8;
  const rowGap = 3;
  let y = 15;
  const lineH = 5;

  // Page title
  pdf.setFontSize(14);
  pdf.setTextColor(31, 41, 55);
  pdf.text('Parking & Transit Summary', margin, y);
  y += sectionGap; // extra space after title

  // Helper to render an AutoTable section with a repeating section header
  const renderAutoTableSection = (sectionTitle, columns, rows) => {
    console.log('[ParkingTransit] Rendering section:', sectionTitle, 'with', rows?.length || 0, 'rows');
    if (!rows || rows.length === 0) return;
    const head = [
      // Make the section header bar bold and opaque
      [{ content: sectionTitle, colSpan: columns.length, styles: { halign: 'left', fontStyle: 'bold', fillColor: [59, 130, 246], textColor: 255 } }],
      columns.map(c => c.header)
    ];
    const body = rows.map(r => columns.map(c => (typeof c.accessor === 'function' ? c.accessor(r) : r[c.accessor])));
    
    console.log('[ParkingTransit] Calling autoTable for section:', sectionTitle, 'with', body?.length || 0, 'rows');
    try {
      autoTable(pdf, {
        startY: y,
        margin: { left: margin, right: margin },
        head,
        body,
        theme: 'grid',
        styles: { fontSize: 10, cellPadding: 2, overflow: 'linebreak', valign: 'middle' },
        // Keep column headers bold and opaque as well
        headStyles: { fillColor: [31, 41, 55], textColor: 255, fontStyle: 'bold' },
        columnStyles: columns.reduce((acc, c, idx) => { acc[idx] = { cellWidth: c.width || 'auto', halign: c.align || 'left' }; return acc; }, {}),
        pageBreak: 'auto',
        rowPageBreak: 'auto',
        showHead: 'everyPage'
      });
      y = pdf.lastAutoTable.finalY + sectionGap;
      console.log('[ParkingTransit] autoTable completed for section:', sectionTitle, 'new y position:', y);
    } catch (error) {
      console.error('[ParkingTransit] Error in autoTable for section:', sectionTitle, error);
    }
  };

  // Section: Street Parking Regulations (visible on map)
  renderAutoTableSection('Street Parking Regulations', [
    { header: 'ID', accessor: (s) => `P${s.index}`, width: 12, align: 'left' },
    { header: 'Order #', accessor: (s) => String(s.props?.order_number || ''), width: 20 },
    { header: 'On', accessor: (s) => String(s.props?.on_street || ''), width: 36 },
    { header: 'From', accessor: (s) => String(s.props?.from_street || ''), width: 36 },
    { header: 'To', accessor: (s) => String(s.props?.to_street || ''), width: 24 },
    { header: 'Side', accessor: (s) => String(s.props?.side_of_street || ''), width: 18 },
    { header: 'Description', accessor: (s) => String(s.props?.sign_description || ''), width: 'auto' }
  ], regulationsInArea);

  // Section: Parking Meters
  renderAutoTableSection('Parking Meters', [
    { header: 'ID', accessor: (m) => `M${m.index}`, width: 12, align: 'left' },
    { header: 'On', accessor: (m) => String(m.props?.on_street || ''), width: 30 },
    { header: 'From', accessor: (m) => String(m.props?.from_street || ''), width: 30 },
    { header: 'To', accessor: (m) => String(m.props?.to_street || ''), width: 30 },
    { header: 'Side', accessor: (m) => String(m.props?.side_of_street || ''), width: 14 },
    { header: 'Meter #', accessor: (m) => String(m.props?.meter_number || ''), width: 20 },
    { header: 'Status', accessor: (m) => String(m.props?.status || ''), width: 20 },
    { header: 'Hours', accessor: (m) => String(m.props?.meter_hours || ''), width: 24 },
    { header: 'Facility', accessor: (m) => String(m.props?.parking_facility_name || m.props?.facility || ''), width: 'auto' }
  ], metersInArea);

  // Section: Subway Stations in Zone
  renderAutoTableSection('Subway Stations in Zone', [
    { header: 'Station', accessor: (s) => String(s.name || 'Station'), width: 80 },
    { header: 'Routes', accessor: (s) => String(s.routes || ''), width: 'auto' }
  ], stationsInArea.map(s => ({ name: s.name, routes: s.routes })));

  // Section: DCWP Parking Garages (from DCWP dataset + building footprints)
  if ((dcwpGarages || []).length > 0) {
    renderAutoTableSection('DCWP Parking Garages (Licensed)', [
      { header: 'Business', accessor: (g) => String(g.business_name || ''), width: 60 },
      { header: 'Detail', accessor: (g) => String(g.detail || ''), width: 60 },
      { header: 'Address', accessor: (g) => [g.address_building, g.address_street_name, g.address_street_name_2].filter(Boolean).join(' '), width: 'auto' }
    ], dcwpGarages);
  }
};

// Render a separate PDF page with a table of parking signs
export const drawParkingSignsSummaryPage = (pdf, signs) => {
  pdf.setFontSize(14);
  pdf.setTextColor(31, 41, 55);
  pdf.text('Street Parking Signs within Permit Area', 10, 15);

  const headers = ['ID', 'Order #', 'On', 'From', 'To', 'Side', 'Description'];
  const colX = [10, 26, 44, 78, 112, 146, 164];
  const colW = [14, 16, 32, 32, 32, 16, 120];
  let y = 22;
  const lineH = 5;

  pdf.setFontSize(10);
  pdf.setTextColor(55, 65, 81);
  headers.forEach((h, i) => pdf.text(h, colX[i], y));
  y += 2;
  pdf.setDrawColor(200, 200, 200);
  pdf.line(10, y, 287, y);
  y += 3;

  pdf.setTextColor(31, 41, 55);
  signs.forEach((s) => {
    const idText = `P${s.index}`;
    const order = String(s.props.order_number || '');
    const on = String(s.props.on_street || '');
    const from = String(s.props.from_street || '');
    const to = String(s.props.to_street || '');
    const side = String(s.props.side_of_street || '');
    const desc = String(s.props.sign_description || '');

    const cells = [idText, order, on, from, to, side, desc];
    const wrapped = cells.map((t, i) => wrapPdfLines(pdf, t, colW[i]));
    const rowLines = Math.max(...wrapped.map(arr => Math.max(1, arr.length)));
    const rowH = rowLines * lineH + 2;

    pdf.setDrawColor(235, 235, 235);
    pdf.rect(10, y - 2, 277, rowH, 'S');

    wrapped.forEach((arr, i) => {
      arr.forEach((line, li) => {
        pdf.text(line, colX[i], y + li * lineH);
      });
    });
    y += rowH;

    if (y > 200) {
      pdf.addPage('a4', 'landscape');
      y = 15;
    }
  });
};

// Render a separate PDF page with a table of parking meters
export const drawParkingMetersSummaryPage = (pdf, meters) => {
  pdf.setFontSize(14);
  pdf.setTextColor(31, 41, 55);
  pdf.text('Parking Meters within Permit Area', 10, 15);

  // Columns: ID, On, From, To, Side, Meter #, Status, Hours, Facility
  const headers = ['ID', 'On', 'From', 'To', 'Side', 'Meter #', 'Status', 'Hours', 'Facility'];
  const colX = [10, 26, 60, 94, 128, 146, 168, 184, 206];
  const colW = [14, 30, 30, 30, 14, 16, 20, 20, 78];
  let y = 22;
  const lineH = 5;

  pdf.setFontSize(10);
  pdf.setTextColor(55, 65, 81);
  headers.forEach((h, i) => pdf.text(h, colX[i], y));
  y += 2;
  pdf.setDrawColor(200, 200, 200);
  pdf.line(10, y, 287, y);
  y += 3;

  pdf.setTextColor(31, 41, 55);
  meters.forEach((m) => {
    const idText = `M${m.index}`;
    const on = String(m.props.on_street || '');
    const from = String(m.props.from_street || '');
    const to = String(m.props.to_street || '');
    const side = String(m.props.side_of_street || '');
    const meterNo = String(m.props.meter_number || '');
    const status = String(m.props.status || '');
    const hours = String(m.props.meter_hours || '');
    const facility = String(m.props.parking_facility_name || m.props.facility || '');

    const cells = [idText, on, from, to, side, meterNo, status, hours, facility];
    const wrapped = cells.map((t, i) => wrapPdfLines(pdf, t, colW[i]));
    const rowLines = Math.max(...wrapped.map(arr => Math.max(1, arr.length)));
    const rowH = rowLines * lineH + 2;

    pdf.setDrawColor(235, 235, 235);
    pdf.rect(10, y - 2, 277, rowH, 'S');

    wrapped.forEach((arr, i) => {
      arr.forEach((line, li) => {
        pdf.text(line, colX[i], y + li * lineH);
      });
    });
    y += rowH;

    if (y > 200) {
      pdf.addPage('a4', 'landscape');
      y = 15;
    }
  });
};

// List street parking regulations that are visible within the exported map extent
export const listStreetParkingSignsVisibleOnMap = (offscreenMap, mapPx, features) => {
  if (!offscreenMap || !features || features.length === 0) return [];
  const visible = [];
  try {
    features.forEach((f) => {
      if (!f?.geometry || f.geometry.type !== 'Point') return;
      if (!isFeatureVisibleOnMap(offscreenMap, mapPx, f)) return;
      const [lng, lat] = f.geometry.coordinates || [];
      visible.push({ lng, lat, props: f.properties || {} });
    });
  } catch (_) {}
  // Sort and number
  visible.sort((a, b) => {
    const as = String(a.props.on_street || '').toLowerCase();
    const bs = String(b.props.on_street || '').toLowerCase();
    if (as !== bs) return as.localeCompare(bs);
    const af = String(a.props.from_street || '').toLowerCase();
    const bf = String(b.props.from_street || '').toLowerCase();
    if (af !== bf) return af.localeCompare(bf);
    if (a.lng !== b.lng) return a.lng - b.lng;
    return a.lat - b.lat;
  });
  return visible.map((p, idx) => ({ index: idx + 1, ...p }));
};

// Collect DCWP garages intersecting the offscreen map extent from provided features
export const listDcwpGaragesWithinMap = (offscreenMap, mapPx, features) => {
  if (!offscreenMap || !features || features.length === 0) return [];
  const rows = [];
  try {
    features.forEach((f) => {
      if (!isFeatureVisibleOnMap(offscreenMap, mapPx, f)) return;
      const p = f.properties || {};
      rows.push({
        business_name: p.business_name || '',
        detail: p.detail || '',
        address_building: p.address_building || '',
        address_street_name: p.address_street_name || '',
        address_street_name_2: p.address_street_name_2 || ''
      });
    });
  } catch (_) {}
  return rows;
};

// Generic visibility test for a feature on the offscreen map image extent
export const isFeatureVisibleOnMap = (offscreenMap, mapPx, feature) => {
  const within = (p) => p.x >= 0 && p.x <= mapPx.width && p.y >= 0 && p.y <= mapPx.height;
  const project = (lng, lat) => offscreenMap.project([lng, lat]);
  const g = feature?.geometry;
  if (!g) return false;
  try {
    if (g.type === 'Point') {
      const [lng, lat] = g.coordinates || [];
      if (typeof lng !== 'number' || typeof lat !== 'number') return false;
      const p = project(lng, lat);
      return within(p);
    }
    if (g.type === 'Polygon') {
      const ring = g.coordinates?.[0] || [];
      return ring.some(([lng, lat]) => within(project(lng, lat)));
    }
    if (g.type === 'MultiPolygon') {
      return g.coordinates.some(poly => (poly?.[0] || []).some(([lng, lat]) => within(project(lng, lat))));
    }
    if (g.type === 'LineString') {
      return g.coordinates.some(([lng, lat]) => within(project(lng, lat)));
    }
    if (g.type === 'MultiLineString') {
      return g.coordinates.some(line => line.some(([lng, lat]) => within(project(lng, lat))));
    }
  } catch (_) {}
  return false;
};

// Determine which subway entrances would be visible on the exported map image extent
export const listSubwayStationsVisibleOnMap = (offscreenMap, mapPx, features) => {
  if (!offscreenMap || !features || features.length === 0) return [];
  const stations = new Map();
  try {
    const project = (lng, lat) => offscreenMap.project([lng, lat]);
    features.forEach((f) => {
      const g = f?.geometry;
      if (!g || g.type !== 'Point') return;
      const [lng, lat] = g.coordinates || [];
      if (typeof lng !== 'number' || typeof lat !== 'number') return false;
      const p = project(lng, lat);
      // Visible if projected point falls within the exported map canvas region (0..mapPx.width/height)
      if (p.x >= 0 && p.x <= mapPx.width && p.y >= 0 && p.y <= mapPx.height) {
        const name = f.properties?.constituent_station_name || f.properties?.stop_name || null;
        const routes = f.properties?.daytime_routes || '';
        const key = `${name || 'Station'}|${routes}`;
        stations.set(key, { name: name || 'Station', routes });
      }
    });
  } catch (_) {}
  return Array.from(stations.values()).sort((a, b) => a.name.localeCompare(b.name));
};

// Helper functions that need to be imported or defined locally
export const isPointInFocusedArea = (lng, lat, focusedArea) => {
  if (!focusedArea?.geometry) return false;
  const g = focusedArea.geometry;
  try {
    if (g.type === 'Polygon') {
      const ring = g.coordinates[0];
      return isPointInPolygon(lng, lat, ring);
    }
    if (g.type === 'MultiPolygon') {
      return g.coordinates.some(poly => isPointInPolygon(lng, lat, poly[0]));
    }
  } catch (_) {}
  return false;
};

export const isPointInPolygon = (lng, lat, polygon) => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect = ((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi + 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};


