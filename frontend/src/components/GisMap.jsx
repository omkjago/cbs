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
  const isDraggingNodeRef = useRef(null);

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
      attribution: '&copy; OpenStreetMap contributors | NMS-GIS Enterprise'
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

  // 3. Render Nodes & Cables with In-Place Leaflet Reconciliation
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    // Track active cable keys to reconcile without destroying layers
    const activeCableKeys = new Set();
    const existingPairs = new Set();

    // Render / Reconcile Explicit Cables
    cables.forEach((cable) => {
      if (!cable.waypoints || cable.waypoints.length < 2) return;
      const cableKey = String(cable.id);
      activeCableKeys.add(cableKey);

      const startId = Number(cable.start_node_id);
      const endId = Number(cable.end_node_id);
      existingPairs.add(`${startId}-${endId}`);
      existingPairs.add(`${endId}-${startId}`);

      const statusColor = cable.status_color || '#10B981';
      const weight = cable.cable_type === 'feeder' ? 6 : cable.cable_type === 'distribution' ? 4 : 2.5;
      const existingCable = cablesRef.current.get(cableKey);

      if (existingCable && existingCable.polyline) {
        // Only update waypoints if this cable endpoint is not currently being dragged by cursor
        if (isDraggingNodeRef.current !== startId && isDraggingNodeRef.current !== endId) {
          existingCable.polyline.setLatLngs(cable.waypoints);
        }
        existingCable.polyline.setStyle({
          color: statusColor,
          weight,
          dashArray: cable.is_flashing ? '8, 8' : null
        });
        existingCable.start_node_id = startId;
        existingCable.end_node_id = endId;
      } else {
        const polyline = L.polyline(cable.waypoints, {
          color: statusColor,
          weight,
          opacity: 0.85,
          dashArray: cable.is_flashing ? '8, 8' : null
        }).addTo(map);

        polyline.bindTooltip(
          `<strong>Kabel: ${cable.cable_code}</strong><br>Tipe: ${cable.cable_type} (${cable.core_count} Core)<br>Status: ${cable.current_visual_status}`,
          { sticky: true }
        );

        cablesRef.current.set(cableKey, {
          polyline,
          start_node_id: startId,
          end_node_id: endId
        });
      }
    });

    // Auto-Connect any node with parent_node_id missing a cable record
    const nodeLookup = new Map();
    nodes.forEach((n) => nodeLookup.set(n.id, n));

    nodes.forEach((n) => {
      if (n.parent_node_id && nodeLookup.has(n.parent_node_id)) {
        const parent = nodeLookup.get(n.parent_node_id);
        const pId = Number(parent.id);
        const nId = Number(n.id);
        const pairKey = `${pId}-${nId}`;

        if (!existingPairs.has(pairKey)) {
          const autoKey = `auto-${nId}`;
          activeCableKeys.add(autoKey);

          const existingAuto = cablesRef.current.get(autoKey);
          const isDrop = n.node_type === 'CUSTOMER';
          const waypoints = [
            [parent.latitude, parent.longitude],
            [n.latitude, n.longitude]
          ];

          if (existingAuto && existingAuto.polyline) {
            if (isDraggingNodeRef.current !== pId && isDraggingNodeRef.current !== nId) {
              existingAuto.polyline.setLatLngs(waypoints);
            }
          } else {
            const autoLine = L.polyline(waypoints, {
              color: '#10B981',
              weight: isDrop ? 2.5 : 4,
              opacity: 0.85,
              dashArray: isDrop ? '6, 6' : null
            }).addTo(map);

            autoLine.bindTooltip(
              `<strong>Jalur Kabel Terhubung Otomatis</strong><br>Dari: ${parent.node_code} &rarr; Ke: ${n.node_code}`,
              { sticky: true }
            );

            cablesRef.current.set(autoKey, {
              polyline: autoLine,
              start_node_id: pId,
              end_node_id: nId
            });
          }
          existingPairs.add(pairKey);
        }
      }
    });

    // Remove obsolete cables
    cablesRef.current.forEach((item, key) => {
      if (!activeCableKeys.has(key)) {
        if (item && item.polyline) {
          map.removeLayer(item.polyline);
        }
        cablesRef.current.delete(key);
      }
    });

    // Reconcile Markers In-Place
    const activeNodeIds = new Set();

    nodes.forEach((node) => {
      // Check layer filter
      let isVisible = true;
      if (node.node_type === 'CUSTOMER') {
        const isFault = node.status === 'LOS' || node.status === 'WARNING_DBM' || node.status === 'DYING_GASP';
        isVisible = isFault ? (filters.CUSTOMER_FAULT ?? true) : (filters.CUSTOMER_NORMAL ?? true);
      } else {
        isVisible = filters[node.node_type] ?? true;
      }

      const existingMarker = markersRef.current.get(node.id);

      if (!isVisible) {
        if (existingMarker) {
          map.removeLayer(existingMarker);
          markersRef.current.delete(node.id);
        }
        return;
      }

      activeNodeIds.add(node.id);
      const isPulsing = node.status === 'LOS';
      const icon = createCustomIcon(node.node_type, node.status, isPulsing);

      if (existingMarker) {
        // Only update coordinate if user is not actively dragging this marker
        if (isDraggingNodeRef.current !== Number(node.id)) {
          existingMarker.setLatLng([node.latitude, node.longitude]);
        }
        existingMarker.setIcon(icon);
      } else {
        const marker = L.marker([node.latitude, node.longitude], {
          icon,
          draggable: true
        }).addTo(map);

        // DRAGSTART: Record active dragging node
        marker.on('dragstart', () => {
          isDraggingNodeRef.current = Number(node.id);
        });

        // LIVE INTERACTIVE CABLE UPDATES WHILE DRAGGING
        marker.on('drag', (e) => {
          const pos = e.target.getLatLng();
          const targetId = Number(node.id);

          cablesRef.current.forEach((cableItem) => {
            if (!cableItem || !cableItem.polyline) return;
            const startId = Number(cableItem.start_node_id);
            const endId = Number(cableItem.end_node_id);

            if (startId === targetId || endId === targetId) {
              const currentPoints = cableItem.polyline.getLatLngs();
              if (Array.isArray(currentPoints) && currentPoints.length >= 2) {
                const updatedPoints = currentPoints.map((pt, idx) => {
                  if (startId === targetId && idx === 0) return [pos.lat, pos.lng];
                  if (endId === targetId && idx === currentPoints.length - 1) return [pos.lat, pos.lng];
                  return pt instanceof L.LatLng ? [pt.lat, pt.lng] : pt;
                });
                cableItem.polyline.setLatLngs(updatedPoints);
              }
            }
          });
        });

        // DRAGEND: Persist coordinates via optimistic auto-save
        marker.on('dragend', (e) => {
          isDraggingNodeRef.current = null;
          const pos = e.target.getLatLng();
          if (onUpdateCoords) {
            onUpdateCoords(node.id, pos.lat, pos.lng, node.node_name);
          }
        });

        // Status Badge HTML
        const rxText = node.rx_power_dbm !== null ? `${node.rx_power_dbm} dBm` : '-';
        const popupContent = document.createElement('div');
        popupContent.style.minWidth = '200px';
        popupContent.innerHTML = `
          <div style="font-weight:bold; font-size:14px; margin-bottom:4px; color:#1e293b;">${escapeHtml(node.node_name)}</div>
          <div style="font-size:11px; color:#64748b; margin-bottom:8px;">Kode: <strong>${escapeHtml(node.node_code)}</strong> (${escapeHtml(node.node_type)})</div>
          <div style="font-size:12px; margin-bottom:4px; color:#1e293b;">Rx Power (OPM): <strong>${escapeHtml(rxText)}</strong></div>
          ${node.address_note ? `<div style="font-size:11px; color:#475569; margin-top:4px;">Alamat: <strong>${escapeHtml(node.address_note)}</strong></div>` : ''}
          <hr style="border:none; border-top:1px solid #e2e8f0; margin:8px 0;">
          <div style="display:flex; gap:6px;">
            <button id="btn-opm-${node.id}" style="flex:1; background:#2563eb; color:white; border:none; border-radius:4px; padding:6px 10px; font-size:11px; font-weight:600; cursor:pointer;">
              Periksa OPM
            </button>
            <a href="https://www.google.com/maps/dir/?api=1&destination=${node.latitude},${node.longitude}" target="_blank" style="text-decoration:none; background:#0f766e; color:white; border-radius:4px; padding:6px 10px; font-size:11px; font-weight:600; display:flex; align-items:center;">
              Navigasi Maps
            </a>
          </div>
        `;

        popupContent.querySelector(`#btn-opm-${node.id}`)?.addEventListener('click', () => {
          if (onLiveOpm) onLiveOpm(node);
        });

        marker.bindPopup(popupContent);
        markersRef.current.set(node.id, marker);
      }
    });

    // Remove obsolete markers
    markersRef.current.forEach((marker, id) => {
      if (!activeNodeIds.has(id)) {
        map.removeLayer(marker);
        markersRef.current.delete(id);
      }
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
          html: `<div class="marker-pin" style="background:#2563eb; transform:scale(1.2);"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg></div>`,
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
