/**
 * Leaflet Map Manager - GIS Inventory, Location Picker & Topology Visualization
 * Compliant with PRD FR-2.1, FR-2.2, FR-2.3, FR-2.4
 */

class LeafletMapManager {
    constructor(containerId = 'map') {
        this.containerId = containerId;
        this.map = null;
        this.nodeMarkers = new Map(); // id -> marker
        this.cablePolylines = new Map(); // id -> polyline
        this.pickerMarker = null; // Marker for location picking modal
        this.activeFilters = {
            POP: true,
            ODC: true,
            JB: true,
            ODP: true,
            CUSTOMER_NORMAL: true,
            CUSTOMER_FAULT: true
        };
        this.onPickerLocationChanged = null;
    }

    init(defaultLat = -6.991, defaultLng = 110.423, zoom = 16) {
        this.map = L.map(this.containerId, {
            center: [defaultLat, defaultLng],
            zoom: zoom,
            zoomControl: false
        });

        // Add standard zoom control at top-right
        L.control.zoom({ position: 'topright' }).addTo(this.map);

        // Tile layer: OpenStreetMap Standard
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors | NMS-GIS ISP'
        }).addTo(this.map);

        // Event: Click on map during location picking mode
        this.map.on('click', (e) => {
            if (this.isPickingMode) {
                this.setPickerLocation(e.latlng.lat, e.latlng.lng);
            }
        });
    }

    /**
     * Create custom SVG Leaflet DivIcon
     */
    createCustomIcon(nodeType, status, isPulsing = false) {
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
    }

    /**
     * Render nodes and cables from API payload
     */
    renderTopology(mapData) {
        // Clear existing markers & cables
        this.nodeMarkers.forEach(m => this.map.removeLayer(m));
        this.nodeMarkers.clear();

        this.cablePolylines.forEach(c => this.map.removeLayer(c));
        this.cablePolylines.clear();

        const { nodes = [], cables = [] } = mapData;

        // 1. Render FO Cables (Polylines)
        cables.forEach(cable => {
            if (!cable.waypoints || cable.waypoints.length < 2) return;

            const polyline = L.polyline(cable.waypoints, {
                color: cable.status_color || '#10B981',
                weight: cable.cable_type === 'feeder' ? 6 : (cable.cable_type === 'distribution' ? 4 : 2),
                opacity: 0.85,
                dashArray: cable.is_flashing ? '8, 8' : null
            }).addTo(this.map);

            const tooltipHtml = `
                <strong>Kabel: ${this.escapeHtml(cable.cable_code)}</strong><br>
                Tipe: ${this.escapeHtml(cable.cable_type)} (${cable.core_count} Core)<br>
                Panjang: ${cable.length_meters} meter<br>
                Status: <span style="color:${cable.status_color}">${this.escapeHtml(cable.current_visual_status)}</span>
            `;
            polyline.bindTooltip(tooltipHtml, { sticky: true });
            this.cablePolylines.set(cable.id, polyline);
        });

        // 2. Render GIS Nodes
        nodes.forEach(node => {
            const isPulsing = (node.status === 'LOS');
            const icon = this.createCustomIcon(node.node_type, node.status, isPulsing);

            const marker = L.marker([node.latitude, node.longitude], {
                icon: icon,
                draggable: true // Allow dragging node to update coordinates
            }).addTo(this.map);

            // Dragend event -> quick coordinate update
            marker.on('dragend', async (e) => {
                const newPos = e.target.getLatLng();
                const confirmUpdate = confirm(`Pindahkan koordinat ${node.node_name} (${node.node_code}) ke [${newPos.lat.toFixed(6)}, ${newPos.lng.toFixed(6)}]?`);
                if (confirmUpdate) {
                    try {
                        await Api.updateNode(node.id, {
                            latitude: newPos.lat,
                            longitude: newPos.lng,
                            input_method: 'map_marker'
                        });
                        window.showToast?.(`Koordinat ${node.node_code} berhasil diperbarui!`, 'success');
                    } catch (err) {
                        window.showToast?.(err.message, 'error');
                        marker.setLatLng([node.latitude, node.longitude]); // revert
                    }
                } else {
                    marker.setLatLng([node.latitude, node.longitude]); // revert
                }
            });

            // Popup content
            const popupHtml = this.generatePopupHtml(node);
            marker.bindPopup(popupHtml);

            marker.nodeData = node;
            this.nodeMarkers.set(node.id, marker);
        });

        this.applyFilters();
    }

    generatePopupHtml(node) {
        let statusBadge = '';
        if (node.status === 'LOS') {
            statusBadge = `<span style="background:#ef4444; color:white; padding:2px 6px; border-radius:4px; font-weight:bold;">LOS (Putus)</span>`;
        } else if (node.status === 'WARNING_DBM') {
            statusBadge = `<span style="background:#f59e0b; color:black; padding:2px 6px; border-radius:4px; font-weight:bold;">High Attenuation</span>`;
        } else if (node.status === 'DYING_GASP' || node.status === 'OFFLINE') {
            statusBadge = `<span style="background:#64748b; color:white; padding:2px 6px; border-radius:4px;">Power Off / Dying Gasp</span>`;
        } else {
            statusBadge = `<span style="background:#10b981; color:white; padding:2px 6px; border-radius:4px;">ONLINE</span>`;
        }

        const rxPowerText = (node.rx_power_dbm !== null) ? `${node.rx_power_dbm} dBm` : 'N/A';

        return `
            <div style="font-family:sans-serif; min-width:200px; color:#1e293b;">
                <div style="font-weight:bold; font-size:14px; margin-bottom:4px;">${this.escapeHtml(node.node_name)}</div>
                <div style="font-size:11px; color:#64748b; margin-bottom:8px;">Kode: <strong>${this.escapeHtml(node.node_code)}</strong> (${this.escapeHtml(node.node_type)})</div>
                <div style="font-size:12px; margin-bottom:6px;">Status: ${statusBadge}</div>
                <div style="font-size:12px; margin-bottom:4px;">Rx Power (OPM): <strong>${rxPowerText}</strong></div>
                ${node.address_note ? `<div style="font-size:11px; color:#475569; margin-top:4px;"> <em>${this.escapeHtml(node.address_note)}</em></div>` : ''}
                <hr style="border:none; border-top:1px solid #e2e8f0; margin:8px 0;">
                <div style="display:flex; gap:6px;">
                    <button onclick="window.checkLiveOpm(${node.id})" style="flex:1; background:#2563eb; color:white; border:none; border-radius:4px; padding:4px 8px; font-size:11px; cursor:pointer;">
                         Cek OPM Live
                    </button>
                    <a href="https://www.google.com/maps/dir/?api=1&destination=${node.latitude},${node.longitude}" target="_blank" style="text-decoration:none; background:#10b981; color:white; border-radius:4px; padding:4px 8px; font-size:11px; display:flex; align-items:center;">
                         Navigasi
                    </a>
                </div>
            </div>
        `;
    }

    /**
     * Start Location Picker Mode for Add/Edit Modal
     */
    startLocationPicker(initialLat, initialLng, onLocationChanged) {
        this.isPickingMode = true;
        this.onPickerLocationChanged = onLocationChanged;

        if (this.pickerMarker) {
            this.map.removeLayer(this.pickerMarker);
        }

        const pickerIcon = L.divIcon({
            className: 'leaflet-custom-icon',
            html: `<div class="marker-pin" style="background:#f43f5e; transform:scale(1.2);"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg></div>`,
            iconSize: [36, 36],
            iconAnchor: [18, 18]
        });

        this.pickerMarker = L.marker([initialLat, initialLng], {
            icon: pickerIcon,
            draggable: true,
            zIndexOffset: 1000
        }).addTo(this.map);

        this.pickerMarker.on('drag', (e) => {
            const pos = e.target.getLatLng();
            if (this.onPickerLocationChanged) {
                this.onPickerLocationChanged(pos.lat, pos.lng, 'map_marker');
            }
        });

        this.map.flyTo([initialLat, initialLng], 17);
    }

    stopLocationPicker() {
        this.isPickingMode = false;
        if (this.pickerMarker) {
            this.map.removeLayer(this.pickerMarker);
            this.pickerMarker = null;
        }
        this.onPickerLocationChanged = null;
    }

    /**
     * Set picker location programmatically (e.g. from GPS or manual input)
     */
    setPickerLocation(lat, lng, method = 'manual_latlong') {
        if (this.pickerMarker) {
            this.pickerMarker.setLatLng([lat, lng]);
            this.map.panTo([lat, lng]);
        }
        if (this.onPickerLocationChanged) {
            this.onPickerLocationChanged(lat, lng, method);
        }
    }

    /**
     * Detect current location using HTML5 navigator.geolocation (FR-2.1 Method 2)
     */
    detectCurrentGpsLocation(onSuccess, onError) {
        if (!navigator.geolocation) {
            onError(new Error('Geolocation tidak didukung oleh browser Anda.'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                if (this.isPickingMode) {
                    this.setPickerLocation(lat, lng, 'gps');
                } else {
                    this.map.flyTo([lat, lng], 17);
                }
                if (onSuccess) onSuccess(lat, lng, pos.coords.accuracy);
            },
            (err) => {
                onError(err);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    }

    /**
     * Apply filter layer visibility
     */
    setFilter(key, enabled) {
        this.activeFilters[key] = enabled;
        this.applyFilters();
    }

    applyFilters() {
        this.nodeMarkers.forEach((marker) => {
            const node = marker.nodeData;
            let visible = true;

            if (node.node_type === 'CUSTOMER') {
                const isFault = (node.status === 'LOS' || node.status === 'WARNING_DBM' || node.status === 'DYING_GASP');
                visible = isFault ? this.activeFilters.CUSTOMER_FAULT : this.activeFilters.CUSTOMER_NORMAL;
            } else {
                visible = this.activeFilters[node.node_type] ?? true;
            }

            if (visible && !this.map.hasLayer(marker)) {
                this.map.addLayer(marker);
            } else if (!visible && this.map.hasLayer(marker)) {
                this.map.removeLayer(marker);
            }
        });
    }

    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

window.LeafletMapManager = LeafletMapManager;
