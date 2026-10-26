import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';

export default function AddNodeModal({
  isOpen,
  onClose,
  parentNodes = [],
  onSubmit,
  onToast
}) {
  // Form State
  const [nodeType, setNodeType] = useState('ODP');
  const [nodeCode, setNodeCode] = useState('');
  const [nodeName, setNodeName] = useState('');
  const [parentId, setParentId] = useState('');
  const [portCapacity, setPortCapacity] = useState('16');
  const [addressNote, setAddressNote] = useState('');
  const [onuSn, setOnuSn] = useState('');
  const [pppoeUser, setPppoeUser] = useState('');
  const [loading, setLoading] = useState(false);

  // Location State
  const [lat, setLat] = useState('-6.9910000');
  const [lng, setLng] = useState('110.4230000');
  const [inputMethod, setInputMethod] = useState('map_marker'); // 'map_marker' | 'gps' | 'search' | 'manual_latlong'
  const [locationMode, setLocationMode] = useState('map'); // 'map' | 'gps' | 'search' | 'manual'

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Leaflet Map & Marker Refs
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);

  // Initialize or re-center preview map when modal opens
  useEffect(() => {
    if (!isOpen) {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
      return;
    }

    // Small delay to ensure modal DOM is mounted and sized properly
    const timer = setTimeout(() => {
      if (!mapContainerRef.current || mapInstanceRef.current) return;

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
        html: `<div style="background:#2563eb; width:28px; height:28px; border-radius:50% 50% 50% 0; transform:rotate(-45deg); border:2px solid #ffffff; box-shadow:0 2px 6px rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center;">
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
        setInputMethod('map_marker');
        marker.setLatLng(e.latlng);
      });

      // Marker Drag Event
      marker.on('dragend', (e) => {
        const pos = e.target.getLatLng();
        setLat(pos.lat.toFixed(7));
        setLng(pos.lng.toFixed(7));
        setInputMethod('map_marker');
      });

      mapInstanceRef.current = map;
      markerRef.current = marker;

      // Invalidate size after modal render
      setTimeout(() => {
        map.invalidateSize();
      }, 200);
    }, 100);

    return () => clearTimeout(timer);
  }, [isOpen]);

  // Synchronize map & marker when lat/lng change from inputs or search
  const updateCoordsAndPan = (newLat, newLng, method) => {
    setLat(newLat);
    setLng(newLng);
    setInputMethod(method);

    const numLat = parseFloat(newLat);
    const numLng = parseFloat(newLng);

    if (!isNaN(numLat) && !isNaN(numLng) && mapInstanceRef.current && markerRef.current) {
      markerRef.current.setLatLng([numLat, numLng]);
      mapInstanceRef.current.flyTo([numLat, numLng], 17);
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

  // Location Search Handler (Nominatim OpenStreetMap Geocoding)
  const handleSearchLocation = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearchLoading(true);
    setSearchResults([]);

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery.trim())}&limit=5&countrycodes=id`;
      const res = await fetch(url);
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
        parent_node_id: parentId ? parseInt(parentId) : null,
        port_capacity: parseInt(portCapacity) || 0,
        address_note: addressNote.trim(),
        onu_sn: onuSn.trim() || null,
        pppoe_username: pppoeUser.trim() || null
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
                <span className="coordinate-badge">
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
                style={{ height: '260px', width: '100%', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />

              {/* Mode-Specific Sub-Panels */}
              {locationMode === 'map' && (
                <div className="mode-helper-box">
                  Klik langsung pada area peta preview di atas atau geser pin penanda biru untuk menentukan posisi koordinat yang presisi.
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
                      placeholder="Cari jalan, desa, kota, atau patokan..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
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

                  {searchResults.length > 0 && (
                    <div className="search-results-dropdown">
                      {searchResults.map((item, idx) => (
                        <div
                          key={idx}
                          className="search-result-item"
                          onClick={() => handleSelectSearchResult(item)}
                        >
                          <div className="search-result-title">{item.display_name}</div>
                          <div className="search-result-coords">
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
                      className="form-input"
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
                      className="form-input"
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
                    <option value="ODC">ODC (Optical Cabinet)</option>
                    <option value="POP">POP (Core Server Room)</option>
                    <option value="CUSTOMER">Pelanggan</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Kode Titik Unik</label>
                  <input
                    type="text"
                    className="form-input code-font"
                    placeholder="Contoh: ODP-SMG-003"
                    value={nodeCode}
                    onChange={(e) => setNodeCode(e.target.value.toUpperCase())}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Nama Titik / Nama Pelanggan</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Contoh: ODP Simpang Lima Ruko C"
                  value={nodeName}
                  onChange={(e) => setNodeName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Node Induk (Parent Jaringan)</label>
                  <select
                    className="form-select"
                    value={parentId}
                    onChange={(e) => setParentId(e.target.value)}
                  >
                    <option value="">Tidak Ada (Titik Pusat POP / Root)</option>
                    {parentNodes.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.node_code} - {p.node_name} ({p.node_type})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Kapasitas Port</label>
                  <input
                    type="number"
                    className="form-input"
                    value={portCapacity}
                    onChange={(e) => setPortCapacity(e.target.value)}
                  />
                </div>
              </div>

              {nodeType === 'CUSTOMER' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Serial Number ONU (SN)</label>
                    <input
                      type="text"
                      className="form-input code-font"
                      placeholder="Contoh: ZTEGC1234567"
                      value={onuSn}
                      onChange={(e) => setOnuSn(e.target.value.toUpperCase())}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Username PPPoE</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Contoh: user_ruko_3"
                      value={pppoeUser}
                      onChange={(e) => setPppoeUser(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Catatan Alamat / Patokan Lokasi</label>
                <textarea
                  className="form-input"
                  rows="3"
                  placeholder="Contoh: Tiang besi PLN depan ruko nomor 10, samping minimarket..."
                  value={addressNote}
                  onChange={(e) => setAddressNote(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Batal
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Menyimpan...' : 'Simpan Titik GIS'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
