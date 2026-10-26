import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';

export default function AddNodeModal({
  isOpen,
  onClose,
  parentNodes = [],
  coords,
  onCoordsChange,
  inputMethod,
  onSubmit,
  onUseGps,
  onToast
}) {
  const [nodeType, setNodeType] = useState('ODP');
  const [nodeCode, setNodeCode] = useState('');
  const [nodeName, setNodeName] = useState('');
  const [parentId, setParentId] = useState('');
  const [addressNote, setAddressNote] = useState('');
  const [portCapacity, setPortCapacity] = useState('16');
  const [onuSn, setOnuSn] = useState('');
  const [pppoeUsername, setPppoeUsername] = useState('');
  const [onuInterface, setOnuInterface] = useState('');
  const [loading, setLoading] = useState(false);

  // 4 Location Modes: 'map' (toggle pin), 'gps', 'search' (Nominatim live), 'manual'
  const [locationMode, setLocationMode] = useState('map');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Local Coordinate State
  const [lat, setLat] = useState(coords?.lat || '-6.9910000');
  const [lng, setLng] = useState(coords?.lng || '110.4230000');

  // Preview Map references
  const mapContainerRef = useRef(null);
  const previewMapRef = useRef(null);
  const previewMarkerRef = useRef(null);

  // Sync coords from parent props
  useEffect(() => {
    if (coords) {
      setLat(parseFloat(coords.lat).toFixed(7));
      setLng(parseFloat(coords.lng).toFixed(7));
    }
  }, [coords]);

  // Set default port capacity on node type change
  useEffect(() => {
    switch (nodeType) {
      case 'POP':
        setPortCapacity('144');
        break;
      case 'ODC':
        setPortCapacity('96');
        break;
      case 'JB':
        setPortCapacity('48');
        break;
      case 'ODP':
        setPortCapacity('16');
        break;
      case 'CUSTOMER':
      default:
        setPortCapacity('1');
        break;
    }
  }, [nodeType]);

  // Initialize Embedded Leaflet Preview Map
  useEffect(() => {
    if (!isOpen) {
      if (previewMapRef.current) {
        previewMapRef.current.remove();
        previewMapRef.current = null;
        previewMarkerRef.current = null;
      }
      return;
    }

    const timer = setTimeout(() => {
      if (!mapContainerRef.current || previewMapRef.current) return;

      const initialLat = parseFloat(lat) || -6.991;
      const initialLng = parseFloat(lng) || 110.423;

      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLng],
        zoom: 16,
        zoomControl: true
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
      }).addTo(map);

      // Create interactive pin icon
      const pinIcon = L.divIcon({
        className: 'preview-map-pin',
        html: `<div style="background:#2563eb; width:28px; height:28px; border-radius:50% 50% 50% 0; transform:rotate(-45deg); border:2px solid #ffffff; box-shadow:0 2px 6px rgba(0,0,0,0.4); display:flex; align-items:center; justify-content:center;">
          <div style="background:#ffffff; width:10px; height:10px; border-radius:50%;"></div>
        </div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 28]
      });

      // Add draggable marker
      const marker = L.marker([initialLat, initialLng], {
        icon: pinIcon,
        draggable: true
      }).addTo(map);

      // Map Click Event: set location directly
      map.on('click', (e) => {
        const clickedLat = e.latlng.lat.toFixed(7);
        const clickedLng = e.latlng.lng.toFixed(7);
        setLat(clickedLat);
        setLng(clickedLng);
        if (onCoordsChange) onCoordsChange(clickedLat, clickedLng, 'map_marker');
        marker.setLatLng(e.latlng);
      });

      // Marker Drag Event
      marker.on('dragend', (e) => {
        const pos = e.target.getLatLng();
        const draggedLat = pos.lat.toFixed(7);
        const draggedLng = pos.lng.toFixed(7);
        setLat(draggedLat);
        setLng(draggedLng);
        if (onCoordsChange) onCoordsChange(draggedLat, draggedLng, 'map_marker');
      });

      previewMapRef.current = map;
      previewMarkerRef.current = marker;

      // Invalidate size to guarantee smooth rendering inside modal
      setTimeout(() => map.invalidateSize(), 200);
    }, 150);

    return () => clearTimeout(timer);
  }, [isOpen]);

  // Synchronize Leaflet map view when coordinates change
  const updateCoordsAndPan = (newLat, newLng, method) => {
    const parsedLat = parseFloat(newLat);
    const parsedLng = parseFloat(newLng);
    if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
      setLat(parsedLat.toFixed(7));
      setLng(parsedLng.toFixed(7));
      if (onCoordsChange) onCoordsChange(parsedLat.toFixed(7), parsedLng.toFixed(7), method);

      if (previewMapRef.current && previewMarkerRef.current) {
        previewMarkerRef.current.setLatLng([parsedLat, parsedLng]);
        previewMapRef.current.panTo([parsedLat, parsedLng]);
      }
    }
  };

  // GPS Geolocation Handler
  const handleGetGps = () => {
    if (!navigator.geolocation) {
      if (onToast) onToast('Peramban web tidak mendukung fitur GPS Geolocation.', 'error');
      return;
    }

    if (onToast) onToast('Mencari posisi koordinat GPS perangkat...', 'info');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const gpsLat = pos.coords.latitude.toFixed(7);
        const gpsLng = pos.coords.longitude.toFixed(7);
        updateCoordsAndPan(gpsLat, gpsLng, 'gps');
        if (onToast) onToast(`Lokasi GPS berhasil didapatkan (Akurasi: ±${Math.round(pos.coords.accuracy)}m)`, 'success');
      },
      (err) => {
        if (onToast) onToast(`Gagal mendeteksi GPS: ${err.message}`, 'error');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Live Geocoding Search with Debounce (Automatic typing search)
  useEffect(() => {
    if (locationMode !== 'search') return;
    const query = searchQuery.trim();
    if (query.length < 3) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=6&countrycodes=id`;
        const res = await fetch(url, { headers: { 'Accept-Language': 'id,en' } });
        const data = await res.json();
        if (Array.isArray(data)) {
          setSearchResults(data);
        }
      } catch {
        // silent error during rapid typing
      } finally {
        setSearchLoading(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery, locationMode]);

  // Manual Trigger for Location Search
  const handleSearchLocation = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearchLoading(true);
    setSearchResults([]);

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery.trim())}&limit=6&countrycodes=id`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'id,en' } });
      const data = await res.json();

      if (!data || data.length === 0) {
        if (onToast) onToast('Lokasi tidak ditemukan. Coba gunakan kata kunci pencarian yang lebih umum.', 'error');
      } else {
        setSearchResults(data);
      }
    } catch {
      if (onToast) onToast('Gagal menghubungi layanan pencarian lokasi.', 'error');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSelectSearchResult = (result) => {
    const resLat = parseFloat(result.lat).toFixed(7);
    const resLng = parseFloat(result.lon).toFixed(7);
    updateCoordsAndPan(resLat, resLng, 'search');
    setSearchResults([]);
    setSearchQuery(result.display_name);
    if (!addressNote) {
      setAddressNote(result.display_name.split(',').slice(0, 3).join(', '));
    }
    if (onToast) onToast('Lokasi dipilih dari hasil pencarian.', 'info');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await onSubmit({
        node_code: nodeCode.trim(),
        node_name: nodeName.trim(),
        node_type: nodeType,
        latitude: parseFloat(lat),
        longitude: parseFloat(lng),
        input_method: inputMethod,
        parent_node_id: parentId ? parseInt(parentId, 10) : null,
        port_capacity: parseInt(portCapacity, 10) || 0,
        address_note: addressNote.trim(),
        onu_sn: onuSn.trim(),
        pppoe_username: pppoeUsername.trim(),
        onu_interface: onuInterface.trim()
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-card modal-card-wide">
        <div className="modal-header">
          <span className="modal-title-text">Tambah Titik Infrastruktur GIS Jaringan</span>
          <button className="btn btn-secondary btn-sm" onClick={onClose} type="button">
            Tutup
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body-split">
            {/* SISI KIRI: PREVIEW MAP & METODE PENENTUAN LOKASI */}
            <div className="modal-map-pane">
              <div className="pane-section-header">
                <span className="form-label" style={{ marginBottom: 0 }}>Penentuan Lokasi Titik</span>
                <span className="coordinate-badge font-mono">
                  Lat: {lat}, Lng: {lng}
                </span>
              </div>

              {/* Mode Selector Segmented Tabs */}
              <div className="mode-segmented-bar">
                <button
                  type="button"
                  className={`mode-btn ${locationMode === 'map' ? 'mode-btn-active' : ''}`}
                  onClick={() => setLocationMode('map')}
                >
                  Pilih di Peta
                </button>
                <button
                  type="button"
                  className={`mode-btn ${locationMode === 'gps' ? 'mode-btn-active' : ''}`}
                  onClick={() => { setLocationMode('gps'); handleGetGps(); }}
                >
                  Lokasi Saat Ini
                </button>
                <button
                  type="button"
                  className={`mode-btn ${locationMode === 'search' ? 'mode-btn-active' : ''}`}
                  onClick={() => setLocationMode('search')}
                >
                  Cari Lokasi
                </button>
                <button
                  type="button"
                  className={`mode-btn ${locationMode === 'manual' ? 'mode-btn-active' : ''}`}
                  onClick={() => setLocationMode('manual')}
                >
                  Input Manual
                </button>
              </div>

              {/* Embedded Interactive Preview Map Container */}
              <div
                ref={mapContainerRef}
                className="interactive-preview-map"
                style={{ height: '260px', width: '100%', borderRadius: '6px', border: '1px solid #334155' }}
              />

              {/* Mode-Specific Sub-Panels */}
              {locationMode === 'map' && (
                <div className="mode-helper-box">
                  Klik langsung pada area peta preview di atas atau geser pin penanda biru untuk menentukan posisi koordinat secara interaktif.
                </div>
              )}

              {locationMode === 'gps' && (
                <div className="mode-helper-box">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Menggunakan koordinat satelit GPS perangkat peramban web Anda.</span>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={handleGetGps}>
                      Deteksi Ulang GPS
                    </button>
                  </div>
                </div>
              )}

              {locationMode === 'search' && (
                <div className="mode-search-container">
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Ketik nama jalan, desa, kota (pencarian live)..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      autoFocus
                    />
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={handleSearchLocation}
                      disabled={searchLoading}
                    >
                      {searchLoading ? 'Mencari...' : 'Cari'}
                    </button>
                  </div>

                  {searchLoading && (
                    <div style={{ fontSize: '11px', color: '#94a3b8', padding: '2px 4px' }}>
                      Mencari lokasi live...
                    </div>
                  )}

                  {searchResults.length > 0 && (
                    <div className="search-results-dropdown">
                      {searchResults.map((item, idx) => (
                        <div
                          key={idx}
                          className="search-result-item"
                          onClick={() => handleSelectSearchResult(item)}
                        >
                          <div className="search-result-title">{item.display_name}</div>
                          <div className="search-result-coords font-mono">
                            Koordinat: {parseFloat(item.lat).toFixed(6)}, {parseFloat(item.lon).toFixed(6)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {locationMode === 'manual' && (
                <div className="mode-manual-inputs-grid">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Latitude</label>
                    <input
                      type="number"
                      step="0.0000001"
                      className="form-input font-mono"
                      value={lat}
                      onChange={(e) => updateCoordsAndPan(e.target.value, lng, 'manual_latlong')}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Longitude</label>
                    <input
                      type="number"
                      step="0.0000001"
                      className="form-input font-mono"
                      value={lng}
                      onChange={(e) => updateCoordsAndPan(lat, e.target.value, 'manual_latlong')}
                      required
                    />
                  </div>
                </div>
              )}
            </div>

            {/* SISI KANAN: FORM IDENTITAS DAN ATRIBUT INFRASTRUKTUR */}
            <div className="modal-form-pane">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Tipe Titik Node</label>
                  <select
                    className="form-select"
                    value={nodeType}
                    onChange={(e) => setNodeType(e.target.value)}
                  >
                    <option value="ODP">ODP (Distribution Point)</option>
                    <option value="JB">JB (Joint Box Closure)</option>
                    <option value="ODC">ODC (Distribution Cabinet)</option>
                    <option value="POP">POP (Core / Server)</option>
                    <option value="CUSTOMER">Drop Core Pelanggan</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Kapasitas Port</label>
                  <input
                    type="number"
                    className="form-input font-mono"
                    value={portCapacity}
                    onChange={(e) => setPortCapacity(e.target.value)}
                    placeholder="16"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Kode Node (Unik)</label>
                  <input
                    type="text"
                    className="form-input font-mono"
                    value={nodeCode}
                    onChange={(e) => setNodeCode(e.target.value)}
                    placeholder="Contoh: ODP-SMG-001"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Nama Titik</label>
                  <input
                    type="text"
                    className="form-input"
                    value={nodeName}
                    onChange={(e) => setNodeName(e.target.value)}
                    placeholder="Contoh: ODP Jl. Pemuda No 12"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Node Induk (Parent Node / Sumber Jalur)</label>
                <select
                  className="form-select"
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                >
                  <option value="">-- Tanpa Induk (Titik Core / Mandiri) --</option>
                  {parentNodes.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.node_type}] {p.node_code} - {p.node_name}
                    </option>
                  ))}
                </select>
              </div>

              {nodeType === 'CUSTOMER' && (
                <div style={{ background: '#0b1120', border: '1px solid #1e293b', padding: '10px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8', marginBottom: '8px' }}>
                    DATA PERANGKAT ONT MODEM
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">PPPoE Username</label>
                      <input
                        type="text"
                        className="form-input font-mono"
                        placeholder="user@isp.net"
                        value={pppoeUsername}
                        onChange={(e) => setPppoeUsername(e.target.value)}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Serial Number Modem (SN)</label>
                      <input
                        type="text"
                        className="form-input font-mono"
                        placeholder="ZTEG12345678"
                        value={onuSn}
                        onChange={(e) => setOnuSn(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Catatan Alamat / Landmark</label>
                <textarea
                  className="form-textarea"
                  rows="2"
                  value={addressNote}
                  onChange={(e) => setAddressNote(e.target.value)}
                  placeholder="Detail lokasi tiang, patokan jalan, atau nomor rumah..."
                />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
              Batal
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>
              {loading ? 'Menyimpan...' : 'Simpan Titik Jaringan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
