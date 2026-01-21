// src/hooks/useOpenStreets.js
import { useEffect, useCallback, useRef, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import { useOpenStreetsContext } from '../contexts/OpenStreetsContext';

const SOURCE_ID = 'open-streets-source';
const LAYER_ID = 'open-streets-layer';

// Day name mapping for display
const DAY_NAMES = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday'
};

const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

/**
 * Format a date string (ISO or timestamp) to a readable format
 */
const formatDate = (dateStr) => {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  } catch {
    return null;
  }
};

/**
 * Build HTML content for hover tooltip (brief)
 */
const buildHoverContent = (props) => {
  const streetName = props.appronstre || 'Unknown Street';
  const fromTo = props.apprfromst && props.apprtostre 
    ? `${props.apprfromst} to ${props.apprtostre}` 
    : '';
  const orgName = props.orgname;
  const density = props.activation_density || 0;
  const isActiveToday = props.is_active_today;
  
  const densityLabel = density === 7 ? 'Daily' : 
                       density >= 5 ? 'Frequent' :
                       density >= 3 ? 'Weekend' : 'Occasional';
  
  return `
    <div style="font-family: system-ui, -apple-system, sans-serif; min-width: 200px;">
      <div style="font-weight: 600; font-size: 13px; color: #111; margin-bottom: 2px;">${streetName}</div>
      ${fromTo ? `<div style="font-size: 11px; color: #666; margin-bottom: 4px;">${fromTo}</div>` : ''}
      ${orgName ? `<div style="font-size: 11px; color: #3b82f6; margin-bottom: 6px;">🏢 ${orgName}</div>` : ''}
      <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
        <span style="
          display: inline-block;
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 10px;
          font-weight: 500;
          background: ${density >= 7 ? '#a855f7' : density >= 5 ? '#ea580c' : density >= 3 ? '#fb923c' : '#fed7aa'};
          color: ${density >= 5 ? '#fff' : '#333'};
        ">${densityLabel} (${density}/7)</span>
        ${isActiveToday ? `<span style="
          display: inline-block;
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 10px;
          font-weight: 500;
          background: #22c55e;
          color: #fff;
        ">Active Now</span>` : ''}
      </div>
      <div style="font-size: 10px; color: #888; margin-top: 6px;">Click for schedule details</div>
    </div>
  `;
};

/**
 * Build HTML content for click popup (detailed)
 */
const buildClickContent = (props) => {
  const streetName = props.appronstre || 'Unknown Street';
  const fromTo = props.apprfromst && props.apprtostre 
    ? `${props.apprfromst} to ${props.apprtostre}` 
    : '';
  const orgName = props.orgname;
  const borough = props.boroughname;
  const status = props.reviewstat;
  const startDate = formatDate(props.apprstartd);
  const endDate = formatDate(props.apprenddat);
  const density = props.activation_density || 0;
  const isActiveToday = props.is_active_today;
  const approvedDays = (props.apprdayswe || '').toLowerCase().split(',').filter(d => d.trim());
  
  // Build schedule rows
  const scheduleRows = DAY_ORDER.map(day => {
    const isActive = approvedDays.includes(day);
    const openKey = `appr${day}ope`;
    const closeKey = `appr${day}clo`;
    const openTime = props[openKey];
    const closeTime = props[closeKey];
    
    const timeStr = isActive && openTime && closeTime 
      ? `${formatTime(openTime)} - ${formatTime(closeTime)}`
      : isActive ? 'All Day' : '—';
    
    return `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 4px 8px; font-size: 11px; color: ${isActive ? '#111' : '#999'}; font-weight: ${isActive ? '500' : '400'};">${DAY_NAMES[day]}</td>
        <td style="padding: 4px 8px; font-size: 11px; color: ${isActive ? '#111' : '#999'}; text-align: right;">
          ${isActive ? `<span style="color: #22c55e;">●</span> ${timeStr}` : timeStr}
        </td>
      </tr>
    `;
  }).join('');
  
  const densityLabel = density === 7 ? 'Daily' : 
                       density >= 5 ? 'Frequent' :
                       density >= 3 ? 'Weekend' : 'Occasional';

  // Build date range string
  const dateRange = startDate && endDate 
    ? `${startDate} — ${endDate}` 
    : startDate 
      ? `Starting ${startDate}` 
      : endDate 
        ? `Until ${endDate}` 
        : null;

  return `
    <div style="font-family: system-ui, -apple-system, sans-serif; min-width: 260px; max-width: 320px;">
      <div style="padding-bottom: 8px; border-bottom: 1px solid #e5e7eb; margin-bottom: 8px;">
        <div style="font-weight: 600; font-size: 14px; color: #111; margin-bottom: 2px;">${streetName}</div>
        ${fromTo ? `<div style="font-size: 12px; color: #666;">${fromTo}</div>` : ''}
        ${borough ? `<div style="font-size: 11px; color: #888; margin-top: 2px;">📍 ${borough}</div>` : ''}
      </div>
      
      ${orgName ? `
        <div style="background: #eff6ff; border-radius: 8px; padding: 8px 10px; margin-bottom: 10px;">
          <div style="font-size: 10px; color: #3b82f6; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">Hosted by</div>
          <div style="font-size: 12px; color: #1e40af; font-weight: 500;">${orgName}</div>
        </div>
      ` : ''}
      
      <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 10px; flex-wrap: wrap;">
        <span style="
          display: inline-block;
          padding: 3px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 500;
          background: ${density >= 7 ? '#a855f7' : density >= 5 ? '#ea580c' : density >= 3 ? '#fb923c' : '#fed7aa'};
          color: ${density >= 5 ? '#fff' : '#333'};
        ">${densityLabel} (${density}/7 days)</span>
        ${isActiveToday ? `<span style="
          display: inline-block;
          padding: 3px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 500;
          background: #22c55e;
          color: #fff;
          animation: pulse 2s infinite;
        ">🟢 Active Now</span>` : ''}
        ${status ? `<span style="
          display: inline-block;
          padding: 3px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 500;
          background: #e0e7ff;
          color: #4338ca;
        ">${status}</span>` : ''}
      </div>
      
      ${dateRange ? `
        <div style="background: #fef3c7; border-radius: 8px; padding: 8px 10px; margin-bottom: 10px;">
          <div style="font-size: 10px; color: #92400e; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">📅 Permit Period</div>
          <div style="font-size: 12px; color: #78350f; font-weight: 500;">${dateRange}</div>
        </div>
      ` : ''}
      
      <div style="font-size: 11px; font-weight: 600; color: #444; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">Weekly Schedule</div>
      <table style="width: 100%; border-collapse: collapse; background: #fafafa; border-radius: 6px; overflow: hidden;">
        ${scheduleRows}
      </table>
      
      ${props.apprno || props.object_id ? `
        <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #888;">
          ${props.apprno ? `Permit #${props.apprno}` : ''}${props.apprno && props.object_id ? ' • ' : ''}${props.object_id ? `ID: ${props.object_id}` : ''}
        </div>
      ` : ''}
    </div>
    <style>
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }
    </style>
  `;
};

/**
 * Format time string (HH:MM:SS -> h:mm AM/PM)
 */
const formatTime = (timeStr) => {
  if (!timeStr) return '';
  try {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const h = hours % 12 || 12;
    return `${h}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  } catch {
    return timeStr;
  }
};

export const useOpenStreets = (map, focusedArea) => {
  const { openStreetsData, isVisible, fetchOpenStreets, fetchOpenStreetsForBounds } = useOpenStreetsContext();
  const focusedAreaId = focusedArea?.id || focusedArea?.properties?.id;
  const prevFocusedAreaIdRef = useRef(null);
  const moveEndTimeoutRef = useRef(null);
  const hoverPopupRef = useRef(null);
  const clickPopupRef = useRef(null);

  // Fetch data when focused area changes
  useEffect(() => {
    if (focusedAreaId !== prevFocusedAreaIdRef.current) {
      prevFocusedAreaIdRef.current = focusedAreaId;
      if (focusedArea) {
        fetchOpenStreets(focusedArea);
      }
    }
  }, [focusedArea, focusedAreaId, fetchOpenStreets]);

  // Fetch data based on map viewport when visible and no focused area
  useEffect(() => {
    if (!map || !isVisible || focusedArea) return;

    const fetchForViewport = () => {
      try {
        const bounds = map.getBounds();
        if (!bounds) return;
        const sw = bounds.getSouthWest();
        const ne = bounds.getNorthEast();
        fetchOpenStreetsForBounds([[sw.lng, sw.lat], [ne.lng, ne.lat]]);
      } catch (err) {
        console.warn('[useOpenStreets] Error getting map bounds:', err);
      }
    };

    // Fetch immediately when visibility is toggled on
    fetchForViewport();

    // Debounced fetch on map move
    const onMoveEnd = () => {
      if (moveEndTimeoutRef.current) {
        clearTimeout(moveEndTimeoutRef.current);
      }
      moveEndTimeoutRef.current = setTimeout(fetchForViewport, 300);
    };

    map.on('moveend', onMoveEnd);

    return () => {
      map.off('moveend', onMoveEnd);
      if (moveEndTimeoutRef.current) {
        clearTimeout(moveEndTimeoutRef.current);
      }
    };
  }, [map, isVisible, focusedArea, fetchOpenStreetsForBounds]);

  // Handle map layers
  const updateLayers = useCallback(() => {
    if (!map || !map.getStyle()) return;

    // Remove existing
    if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
    if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);

    if (!isVisible || !openStreetsData) return;

    // Add source
    map.addSource(SOURCE_ID, {
      type: 'geojson',
      data: openStreetsData
    });

    // Add layer with density-based styling
    map.addLayer({
      id: LAYER_ID,
      type: 'line',
      source: SOURCE_ID,
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
        'visibility': isVisible ? 'visible' : 'none'
      },
      paint: {
        // Activation density color scale: 
        // 1-2 days: Light Orange
        // 3-4 days: Orange
        // 5-6 days: Dark Orange/Red
        // 7 days (Daily): Purple
        'line-color': [
          'interpolate',
          ['linear'],
          ['get', 'activation_density'],
          0, '#fed7aa', // Light Orange
          2, '#fb923c', // Orange
          5, '#ea580c', // Dark Orange
          7, '#a855f7'  // Purple
        ],
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          12, 2,
          15, 6,
          18, 12
        ],
        'line-opacity': 0.8
      }
    });

    // Create popups if they don't exist
    if (!hoverPopupRef.current) {
      hoverPopupRef.current = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 15,
        className: 'open-streets-hover-popup'
      });
    }
    
    if (!clickPopupRef.current) {
      clickPopupRef.current = new maplibregl.Popup({
        closeButton: true,
        closeOnClick: true,
        offset: 15,
        maxWidth: '320px',
        className: 'open-streets-click-popup'
      });
    }

    // Hover handler - show brief tooltip
    const onMouseMove = (e) => {
      if (!e.features?.[0]) return;
      const feature = e.features[0];
      const coordinates = e.lngLat;
      
      // Don't show hover popup if click popup is open on same feature
      if (clickPopupRef.current?.isOpen()) {
        return;
      }
      
      hoverPopupRef.current
        .setLngLat(coordinates)
        .setHTML(buildHoverContent(feature.properties))
        .addTo(map);
    };

    // Click handler - show detailed popup
    const onClick = (e) => {
      if (!e.features?.[0]) return;
      const feature = e.features[0];
      const coordinates = e.lngLat;
      
      // Close hover popup
      if (hoverPopupRef.current) {
        hoverPopupRef.current.remove();
      }
      
      clickPopupRef.current
        .setLngLat(coordinates)
        .setHTML(buildClickContent(feature.properties))
        .addTo(map);
    };

    // Mouse enter - change cursor
    const onMouseEnter = () => {
      map.getCanvas().style.cursor = 'pointer';
    };

    // Mouse leave - reset cursor and close hover popup
    const onMouseLeave = () => {
      map.getCanvas().style.cursor = '';
      if (hoverPopupRef.current) {
        hoverPopupRef.current.remove();
      }
    };

    map.on('mousemove', LAYER_ID, onMouseMove);
    map.on('click', LAYER_ID, onClick);
    map.on('mouseenter', LAYER_ID, onMouseEnter);
    map.on('mouseleave', LAYER_ID, onMouseLeave);

    return () => {
      if (map.getLayer(LAYER_ID)) {
        map.off('mousemove', LAYER_ID, onMouseMove);
        map.off('click', LAYER_ID, onClick);
        map.off('mouseenter', LAYER_ID, onMouseEnter);
        map.off('mouseleave', LAYER_ID, onMouseLeave);
      }
    };
  }, [map, openStreetsData, isVisible]);

  useEffect(() => {
    const cleanup = updateLayers();
    return () => {
      if (cleanup) cleanup();
      // Also cleanup popups
      if (hoverPopupRef.current) {
        hoverPopupRef.current.remove();
      }
      if (clickPopupRef.current) {
        clickPopupRef.current.remove();
      }
    };
  }, [updateLayers]);

  return useMemo(() => ({
    openStreetsData,
    isVisible
  }), [openStreetsData, isVisible]);
};

