import React, { useEffect, useRef, useState } from 'react';
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

// Euclidean/Geodesic distance from a point P to a line segment P1-P2
function distanceToSegment(p, p1, p2) {
  const x = p.lng, y = p.lat;
  const x1 = p1.lng, y1 = p1.lat;
  const x2 = p2.lng, y2 = p2.lat;
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) {
    return Math.hypot(x - x1, y - y1);
  }
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(x - projX, y - projY);
}

// Calculate total polyline distance in meters
function calculatePolylineMeters(waypoints) {
  if (!waypoints || waypoints.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const p1 = L.latLng(waypoints[i][0], waypoints[i][1]);
    const p2 = L.latLng(waypoints[i + 1][0], waypoints[i + 1][1]);
    total += p1.distanceTo(p2);
  }
  return Math.round(total);
}

export default function GisMap({
  nodes = [],
  cables = [],
  filters = {},
  isPicking = false,
  pickerCoords = null,
  focusCoords = null,
  onPickerMove = null,
  onUpdateCoords = null,
  onLiveOpm = null,
  onUpdateCableWaypoints = null,
  onDeleteCable = null,
  onToast = null
}) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef(new Map());
  const cablesRef = useRef(new Map());
  const pickerMarkerRef = useRef(null);
  const isDraggingNodeRef = useRef(null);

  // Cable Selection & Route Bending States
  const [selectedCable, setSelectedCable] = useState(null);
  const [editingCable, setEditingCable] = useState(null);
  const [editingWaypoints, setEditingWaypoints] = useState([]);

  const vertexMarkersRef = useRef([]);
  const isEditingRouteRef = useRef(false);
  const editingCableIdRef = useRef(null);
  const editingWaypointsRef = useRef([]);

  // Sync state to refs for live event listeners
  useEffect(() => {
    isEditingRouteRef.current = !!editingCable;
    editingCableIdRef.current = editingCable ? editingCable.id : null;
    editingWaypointsRef.current = editingWaypoints;
  }, [editingCable, editingWaypoints]);

  // Lookup node helper
  const getNodeById = (id) => nodes.find((n) => Number(n.id) === Number(id));

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

  // Bend point handle icon
  const createBendVertexIcon = (bendIndex) => {
    return L.divIcon({
      className: 'vertex-handle-icon',
      html: `<div class="vertex-handle-dot bend"><span class="vertex-handle-num">${bendIndex}</span></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    });
  };

  // 3. Render Nodes & Cables with In-Place Leaflet Reconciliation
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

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

      // Check if this cable is currently being edited
      const isBeingEdited = editingCableIdRef.current === cable.id;

      if (existingCable && existingCable.polyline) {
        if (!isBeingEdited && isDraggingNodeRef.current !== startId && isDraggingNodeRef.current !== endId) {
          existingCable.polyline.setLatLngs(cable.waypoints);
        }
        existingCable.polyline.setStyle({
          color: isBeingEdited ? '#f59e0b' : statusColor,
          weight: isBeingEdited ? weight + 2 : weight,
          dashArray: isBeingEdited ? '6, 6' : cable.is_flashing ? '8, 8' : null
        });
        existingCable.start_node_id = startId;
        existingCable.end_node_id = endId;
      } else {
        const polyline = L.polyline(cable.waypoints, {
          color: statusColor,
          weight,
          opacity: 0.9,
          dashArray: cable.is_flashing ? '8, 8' : null
        }).addTo(map);

        // Click Handler: Select cable or insert bend point
        polyline.on('click', (e) => {
          L.DomEvent.stopPropagation(e);

          if (isEditingRouteRef.current && editingCableIdRef.current === cable.id) {
            // IN EDIT MODE: Add a new bend point between endpoints
            const clickLatLng = e.latlng;
            const clickCoord = [
              parseFloat(clickLatLng.lat.toFixed(7)),
              parseFloat(clickLatLng.lng.toFixed(7))
            ];

            const currentWps = editingWaypointsRef.current;
            let bestIndex = 1;
            let minDistance = Infinity;

            for (let i = 0; i < currentWps.length - 1; i++) {
              const p1 = L.latLng(currentWps[i][0], currentWps[i][1]);
              const p2 = L.latLng(currentWps[i + 1][0], currentWps[i + 1][1]);
              const dist = distanceToSegment(clickLatLng, p1, p2);
              if (dist < minDistance) {
                minDistance = dist;
                bestIndex = i + 1;
              }
            }

            const nextWps = [
              ...currentWps.slice(0, bestIndex),
              clickCoord,
              ...currentWps.slice(bestIndex)
            ];

            setEditingWaypoints(nextWps);
            polyline.setLatLngs(nextWps);
            if (onToast) onToast('Titik belokan baru disisipkan. Geser untuk mengatur kelokan.', 'info');
          } else {
            // NORMAL MODE: Select Cable
            setSelectedCable(cable);
          }
        });

        const bendsCount = cable.waypoints.length > 2 ? cable.waypoints.length - 2 : 0;
        polyline.bindTooltip(
          `<strong>${cable.cable_code}</strong> (${cable.cable_type})<br>Panjang: ${Math.round(cable.length_meters || 0)}m | ${bendsCount} Titik Belokan`,
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
              `<strong>Jalur Terhubung Otomatis</strong><br>Dari: ${parent.node_code} &rarr; Ke: ${n.node_code}`,
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
        if (isDraggingNodeRef.current !== Number(node.id)) {
          existingMarker.setLatLng([node.latitude, node.longitude]);
        }
        existingMarker.setIcon(icon);
      } else {
        const marker = L.marker([node.latitude, node.longitude], {
          icon,
          draggable: true
        }).addTo(map);

        marker.on('dragstart', () => {
          isDraggingNodeRef.current = Number(node.id);
        });

        // Live dragging node updates connected cable endpoints (while preserving intermediate bends!)
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

        marker.on('dragend', (e) => {
          isDraggingNodeRef.current = null;
          const pos = e.target.getLatLng();
          if (onUpdateCoords) {
            onUpdateCoords(node.id, pos.lat, pos.lng, node.node_name);
          }
        });

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

    markersRef.current.forEach((marker, id) => {
      if (!activeNodeIds.has(id)) {
        map.removeLayer(marker);
        markersRef.current.delete(id);
      }
    });
  }, [nodes, cables, filters]);

  // 4. Interactive Draggable Handles ONLY for Intermediate Bend Points
  // Endpoints are strictly pinned to startNode and endNode!
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    // Clear old vertex markers
    vertexMarkersRef.current.forEach((m) => map.removeLayer(m));
    vertexMarkersRef.current = [];

    if (!editingCable || !editingWaypoints || editingWaypoints.length < 2) return;

    const cableKey = String(editingCable.id);
    const cableItem = cablesRef.current.get(cableKey);

    // ONLY render handles for intermediate bend points (indices 1 to length - 2)
    // Endpoints (0 and length - 1) are physically anchored to infrastructure nodes
    for (let index = 1; index < editingWaypoints.length - 1; index++) {
      const wp = editingWaypoints[index];
      const vIcon = createBendVertexIcon(index);

      const vMarker = L.marker([wp[0], wp[1]], {
        icon: vIcon,
        draggable: true,
        zIndexOffset: 3000
      }).addTo(map);

      vMarker.bindTooltip(`Titik Belok #${index}<br>Klik untuk menghapus`, {
        direction: 'top',
        offset: [0, -10]
      });

      // Drag event: smoothly stretch the polyline
      vMarker.on('drag', (e) => {
        const pos = e.target.getLatLng();
        const updated = [...editingWaypointsRef.current];
        updated[index] = [pos.lat, pos.lng];
        editingWaypointsRef.current = updated;

        if (cableItem && cableItem.polyline) {
          cableItem.polyline.setLatLngs(updated);
        }
      });

      // Dragend: commit to local state
      vMarker.on('dragend', () => {
        setEditingWaypoints([...editingWaypointsRef.current]);
      });

      // Click: prompt to delete this bend point
      vMarker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        const ok = window.confirm(`Hapus titik belokan #${index} ini?`);
        if (ok) {
          const nextWps = editingWaypointsRef.current.filter((_, idx) => idx !== index);
          setEditingWaypoints(nextWps);
          if (cableItem && cableItem.polyline) {
            cableItem.polyline.setLatLngs(nextWps);
          }
          if (onToast) onToast(`Titik belokan #${index} berhasil dihapus.`, 'info');
        }
      });

      vertexMarkersRef.current.push(vMarker);
    }
  }, [editingCable, editingWaypoints]);

  // 5. Actions: Start Route Editing (Ensuring strict anchor to nodes)
  const startEditCableRoute = (cable) => {
    setSelectedCable(null);

    const startNode = getNodeById(cable.start_node_id);
    const endNode = getNodeById(cable.end_node_id);

    // Anchor first and last waypoints strictly to the infrastructure nodes
    let wps = [...(cable.waypoints || [])];
    if (wps.length < 2) {
      if (startNode && endNode) {
        wps = [
          [startNode.latitude, startNode.longitude],
          [endNode.latitude, endNode.longitude]
        ];
      }
    } else {
      if (startNode) {
        wps[0] = [parseFloat(startNode.latitude), parseFloat(startNode.longitude)];
      }
      if (endNode) {
        wps[wps.length - 1] = [parseFloat(endNode.latitude), parseFloat(endNode.longitude)];
      }
    }

    setEditingCable(cable);
    setEditingWaypoints(wps);

    const bendCount = wps.length > 2 ? wps.length - 2 : 0;
    if (onToast) {
      onToast(
        `Mode edit belokan kabel ${cable.cable_code} aktif (${bendCount} belokan). Klik garis atau klik [+ Tambah Titik Belok].`,
        'info'
      );
    }
  };

  // Action: Add Bend Point at midpoint of the longest segment
  const handleAddBendPoint = () => {
    if (!editingCable || editingWaypoints.length < 2) return;

    let longestSegIdx = 0;
    let maxDist = -1;

    for (let i = 0; i < editingWaypoints.length - 1; i++) {
      const p1 = L.latLng(editingWaypoints[i][0], editingWaypoints[i][1]);
      const p2 = L.latLng(editingWaypoints[i + 1][0], editingWaypoints[i + 1][1]);
      const dist = p1.distanceTo(p2);
      if (dist > maxDist) {
        maxDist = dist;
        longestSegIdx = i;
      }
    }

    const p1 = editingWaypoints[longestSegIdx];
    const p2 = editingWaypoints[longestSegIdx + 1];
    const midPoint = [
      parseFloat(((p1[0] + p2[0]) / 2).toFixed(7)),
      parseFloat(((p1[1] + p2[1]) / 2).toFixed(7))
    ];

    const nextWps = [
      ...editingWaypoints.slice(0, longestSegIdx + 1),
      midPoint,
      ...editingWaypoints.slice(longestSegIdx + 1)
    ];

    setEditingWaypoints(nextWps);

    const cableKey = String(editingCable.id);
    const cableItem = cablesRef.current.get(cableKey);
    if (cableItem && cableItem.polyline) {
      cableItem.polyline.setLatLngs(nextWps);
    }

    if (onToast) {
      onToast('Titik belokan baru ditambahkan. Geser lingkaran oranye untuk meliukkan jalur.', 'success');
    }
  };

  // Action: Reset to direct straight line between the 2 infrastructure nodes
  const handleResetStraight = () => {
    if (!editingCable || editingWaypoints.length < 2) return;

    const startNode = getNodeById(editingCable.start_node_id);
    const endNode = getNodeById(editingCable.end_node_id);

    const straight = [
      startNode ? [parseFloat(startNode.latitude), parseFloat(startNode.longitude)] : editingWaypoints[0],
      endNode ? [parseFloat(endNode.latitude), parseFloat(endNode.longitude)] : editingWaypoints[editingWaypoints.length - 1]
    ];

    setEditingWaypoints(straight);

    const cableKey = String(editingCable.id);
    const cableItem = cablesRef.current.get(cableKey);
    if (cableItem && cableItem.polyline) {
      cableItem.polyline.setLatLngs(straight);
    }
    if (onToast) onToast('Semua titik belokan dihapus. Jalur kembali lurus antar infrastruktur.', 'info');
  };

  // Action: Save route waypoints
  const handleSaveRoute = async () => {
    if (!editingCable || !onUpdateCableWaypoints) return;

    const startNode = getNodeById(editingCable.start_node_id);
    const endNode = getNodeById(editingCable.end_node_id);

    // Strictly ensure endpoints are anchored to infrastructure nodes
    const finalWps = [...editingWaypoints];
    if (startNode) {
      finalWps[0] = [parseFloat(startNode.latitude), parseFloat(startNode.longitude)];
    }
    if (endNode) {
      finalWps[finalWps.length - 1] = [parseFloat(endNode.latitude), parseFloat(endNode.longitude)];
    }

    await onUpdateCableWaypoints(editingCable.id, finalWps);
    setEditingCable(null);
  };

  // Action: Cancel edit
  const handleCancelEdit = () => {
    if (editingCable) {
      const cableKey = String(editingCable.id);
      const cableItem = cablesRef.current.get(cableKey);
      if (cableItem && cableItem.polyline) {
        cableItem.polyline.setLatLngs(editingCable.waypoints);
        cableItem.polyline.setStyle({
          color: editingCable.status_color || '#10B981',
          weight: editingCable.cable_type === 'feeder' ? 6 : editingCable.cable_type === 'distribution' ? 4 : 2.5,
          dashArray: editingCable.is_flashing ? '8, 8' : null
        });
      }
    }
    setEditingCable(null);
    setEditingWaypoints([]);
    if (onToast) onToast('Pengeditan jalur kabel dibatalkan.', 'info');
  };

  // Action: Delete cable
  const confirmDeleteCable = (cable) => {
    const ok = window.confirm(`Apakah Anda yakin ingin menghapus jalur kabel ${cable.cable_code}?`);
    if (ok && onDeleteCable) {
      setSelectedCable(null);
      onDeleteCable(cable.id);
    }
  };

  // Location Picker Pin
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

  const editingStartNode = editingCable ? getNodeById(editingCable.start_node_id) : null;
  const editingEndNode = editingCable ? getNodeById(editingCable.end_node_id) : null;
  const bendsCount = editingWaypoints.length > 2 ? editingWaypoints.length - 2 : 0;

  return (
    <div className="map-viewport-wrapper">
      <div ref={mapRef} className="map-container" />

      {/* Floating Cable Route Editor Toolbar */}
      {editingCable && (
        <div className="cable-editor-bar">
          <div className="cable-editor-left">
            <span className="cable-editor-mode-badge">[MODE EDIT BELOKAN JALUR KABEL]</span>
            <div className="cable-editor-title">
              <strong>{editingCable.cable_code}</strong>
              <span className="cable-editor-meta">
                ({editingStartNode?.node_code || 'Awal'} &rarr; {editingEndNode?.node_code || 'Akhir'} |{' '}
                {bendsCount} Titik Belokan | {calculatePolylineMeters(editingWaypoints)} m)
              </span>
            </div>
            <span className="cable-editor-hint">
              Klik pada garis kabel atau tombol [+ Tambah Titik Belok]. Geser lingkaran oranye untuk meliukkan rute kabel. Titik awal &amp; akhir selalu terkunci ke infrastruktur.
            </span>
          </div>

          <div className="cable-editor-right">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleAddBendPoint}
              title="Sisipkan titik belokan baru di tengah segmen kabel terpanjang"
            >
              + Tambah Titik Belok
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleResetStraight}
              title="Hapus semua lekukan dan luruskan kembali antar kedua node"
            >
              Luruskan Jalur
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleSaveRoute}
              title="Simpan koordinat belokan ke database"
            >
              Simpan Belokan
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleCancelEdit}
              title="Batalkan pengeditan rute"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* Floating Selected Cable Detail Card */}
      {selectedCable && !editingCable && (
        <div className="cable-detail-card">
          <div className="cable-detail-header">
            <div className="cable-detail-badge-row">
              <span className={`cable-type-tag ${selectedCable.cable_type}`}>
                {selectedCable.cable_type.toUpperCase()}
              </span>
              <strong>{selectedCable.cable_code}</strong>
            </div>
            <button
              type="button"
              className="cable-detail-close"
              onClick={() => setSelectedCable(null)}
              title="Tutup"
            >
              &times;
            </button>
          </div>

          <div className="cable-detail-body">
            <div className="cable-stat-grid">
              <div className="cable-stat-item">
                <span className="stat-label">Infrastruktur</span>
                <span className="stat-val">
                  {selectedCable.start_node_code || 'Node Awal'} &rarr; {selectedCable.end_node_code || 'Node Akhir'}
                </span>
              </div>
              <div className="cable-stat-item">
                <span className="stat-label">Panjang Fisik</span>
                <span className="stat-val">{Math.round(selectedCable.length_meters || 0)} m</span>
              </div>
              <div className="cable-stat-item">
                <span className="stat-label">Kapasitas</span>
                <span className="stat-val">{selectedCable.core_count} Core</span>
              </div>
              <div className="cable-stat-item">
                <span className="stat-label">Titik Belokan</span>
                <span className="stat-val">
                  {(selectedCable.waypoints || []).length > 2
                    ? `${selectedCable.waypoints.length - 2} Titik Belok`
                    : 'Garis Lurus'}
                </span>
              </div>
            </div>
          </div>

          <div className="cable-detail-actions">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => startEditCableRoute(selectedCable)}
              title="Aktifkan mode interaktif untuk membelokkan rute kabel pada peta"
            >
              Edit Belokan Jalur
            </button>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => confirmDeleteCable(selectedCable)}
              title="Hapus jalur kabel dari sistem"
            >
              Hapus Kabel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
