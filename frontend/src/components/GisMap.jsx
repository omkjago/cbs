import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

const escapeHtml = (unsafe) => {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

export default function GisMap({
  nodes = [],
  cables = [],
  filters = {},
  isPicking = false,
  pickerCoords = null,
  focusCoords = null,
  onPickerMove = null,
  onUpdateCoords = null,
  onLiveOpm = null
}) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef(new Map());
  const cablesRef = useRef(new Map());
  const pickerMarkerRef = useRef(null);

  // 1. Initialize Leaflet Map
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const map = L.map(mapRef.current, {
      center: [-6.991, 110.423],
      zoom: 16,
      zoomControl: false
    });

    L.control.zoom({ position: 'topright' }).addTo(map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors | NMS-GIS ISP'
    }).addTo(map);

    mapInstance.current = map;

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  useEffect(() => {
    if (focusCoords && mapInstance.current && focusCoords.lat && focusCoords.lng) {
      mapInstance.current.flyTo([focusCoords.lat, focusCoords.lng], 18);
    }
  }, [focusCoords]);

  // 2. Custom Icon Factory
  const createCustomIcon = (nodeType, status, isPulsing = false) => {
    let pinClass = 'pin-generic';
    let svgIcon = '';

    switch (nodeType) {
      case 'POP':
        pinClass = 'pin-pop';
        svgIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>`;
        break;
      case 'ODC':
        pinClass = 'pin-odc';
        svgIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M4 4h16v16H4z"/><path d="M12 4v16"/><circle cx="8" cy="12" r="1"/><circle cx="16" cy="12" r="1"/></svg>`;
        break;
      case 'JB':
        pinClass = 'pin-jb';
        svgIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" transform="rotate(45 12 12)"/></svg>`;
        break;
      case 'ODP':
        pinClass = 'pin-odp';
        svgIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><circle cx="15.5" cy="8.5" r="1.5"/><circle cx="8.5" cy="15.5" r="1.5"/><circle cx="15.5" cy="15.5" r="1.5"/></svg>`;
        break;
      case 'CUSTOMER':
      default:
        if (status === 'LOS') {
          pinClass = 'pin-cust-red';
        } else if (status === 'WARNING_DBM') {
          pinClass = 'pin-cust-yellow';
        } else if (status === 'DYING_GASP' || status === 'OFFLINE') {
          pinClass = 'pin-cust-gray';
        } else {
          pinClass = 'pin-cust-green';
        }
        svgIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
        break;
    }

    const pulseClass = isPulsing ? 'pulse-animation' : '';

    return L.divIcon({
      className: 'leaflet-custom-icon',
      html: `<div class="marker-pin ${pinClass} ${pulseClass}">${svgIcon}</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -18]
    });
  };

  // 3. Render Nodes & Cables
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    // Clear old cables
    cablesRef.current.forEach((c) => map.removeLayer(c));
    cablesRef.current.clear();

    // Render Cables
    cables.forEach((cable) => {
      if (!cable.waypoints || cable.waypoints.length < 2) return;

      const polyline = L.polyline(cable.waypoints, {
        color: cable.status_color || '#10B981',
        weight: cable.cable_type === 'feeder' ? 6 : cable.cable_type === 'distribution' ? 4 : 2,
        opacity: 0.85,
        dashArray: cable.is_flashing ? '8, 8' : null
      }).addTo(map);

      polyline.bindTooltip(
        `<strong>Kabel: ${cable.cable_code}</strong><br>Tipe: ${cable.cable_type} (${cable.core_count} Core)<br>Status: ${cable.current_visual_status}`,
        { sticky: true }
      );

      cablesRef.current.set(cable.id, polyline);
    });

    // Clear old markers
    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current.clear();

    // Render Nodes
    nodes.forEach((node) => {
      // Check layer filter
      let isVisible = true;
      if (node.node_type === 'CUSTOMER') {
        const isFault = node.status === 'LOS' || node.status === 'WARNING_DBM' || node.status === 'DYING_GASP';
        isVisible = isFault ? (filters.CUSTOMER_FAULT ?? true) : (filters.CUSTOMER_NORMAL ?? true);
      } else {
        isVisible = filters[node.node_type] ?? true;
      }

      if (!isVisible) return;

      const isPulsing = node.status === 'LOS';
      const icon = createCustomIcon(node.node_type, node.status, isPulsing);

      const marker = L.marker([node.latitude, node.longitude], {
        icon,
        draggable: true
      }).addTo(map);

      // Handle dragend to update coordinates
      marker.on('dragend', (e) => {
        const pos = e.target.getLatLng();
        if (onUpdateCoords) {
          onUpdateCoords(node.id, pos.lat, pos.lng, node.node_name);
        }
      });

      // Status Badge HTML
      const rxText = node.rx_power_dbm !== null ? `${node.rx_power_dbm} dBm` : 'N/A';
      const popupContent = document.createElement('div');
      popupContent.style.minWidth = '200px';
      popupContent.innerHTML = `
        <div style="font-weight:bold; font-size:14px; margin-bottom:4px; color:#1e293b;">${escapeHtml(node.node_name)}</div>
        <div style="font-size:11px; color:#64748b; margin-bottom:8px;">Kode: <strong>${escapeHtml(node.node_code)}</strong> (${escapeHtml(node.node_type)})</div>
        <div style="font-size:12px; margin-bottom:4px; color:#1e293b;">Rx Power (OPM): <strong>${escapeHtml(rxText)}</strong></div>
        ${node.address_note ? `<div style="font-size:11px; color:#475569; margin-top:4px;">📍 <em>${escapeHtml(node.address_note)}</em></div>` : ''}
        <hr style="border:none; border-top:1px solid #e2e8f0; margin:8px 0;">
        <div style="display:flex; gap:6px;">
          <button id="btn-opm-${node.id}" style="flex:1; background:#2563eb; color:white; border:none; border-radius:4px; padding:4px 8px; font-size:11px; cursor:pointer;">
            ⚡ Cek OPM Live
          </button>
          <a href="https://www.google.com/maps/dir/?api=1&destination=${node.latitude},${node.longitude}" target="_blank" style="text-decoration:none; background:#10b981; color:white; border-radius:4px; padding:4px 8px; font-size:11px; display:flex; align-items:center;">
            🗺️ Navigasi
          </a>
        </div>
      `;

      popupContent.querySelector(`#btn-opm-${node.id}`)?.addEventListener('click', () => {
        if (onLiveOpm) onLiveOpm(node);
      });

      marker.bindPopup(popupContent);
      markersRef.current.set(node.id, marker);
    });
  }, [nodes, cables, filters]);

  // 4. Handle Location Picker Pin (When AddNodeModal is active)
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    if (isPicking && pickerCoords) {
      if (!pickerMarkerRef.current) {
        const pickerIcon = L.divIcon({
          className: 'leaflet-custom-icon',
          html: `<div class="marker-pin" style="background:#f43f5e; transform:scale(1.2);"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg></div>`,
          iconSize: [36, 36],
          iconAnchor: [18, 18]
        });

        const pMarker = L.marker([pickerCoords.lat, pickerCoords.lng], {
          icon: pickerIcon,
          draggable: true,
          zIndexOffset: 1000
        }).addTo(map);

        pMarker.on('drag', (e) => {
          const pos = e.target.getLatLng();
          if (onPickerMove) {
            onPickerMove(pos.lat, pos.lng, 'map_marker');
          }
        });

        pickerMarkerRef.current = pMarker;
      } else {
        pickerMarkerRef.current.setLatLng([pickerCoords.lat, pickerCoords.lng]);
      }
    } else if (!isPicking && pickerMarkerRef.current) {
      map.removeLayer(pickerMarkerRef.current);
      pickerMarkerRef.current = null;
    }
  }, [isPicking, pickerCoords]);

  return <div ref={mapRef} className="map-container" />;
}
