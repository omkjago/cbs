import React, { useState } from 'react';

export default function AddNodeModal({
  isOpen,
  onClose,
  parentNodes = [],
  coords,
  onCoordsChange,
  inputMethod,
  onSubmit,
  onUseGps
}) {
  const [nodeType, setNodeType] = useState('ODP');
  const [nodeCode, setNodeCode] = useState('');
  const [nodeName, setNodeName] = useState('');
  const [parentId, setParentId] = useState('');
  const [portCapacity, setPortCapacity] = useState('16');
  const [addressNote, setAddressNote] = useState('');
  const [onuSn, setOnuSn] = useState('');
  const [pppoeUser, setPppoeUser] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await onSubmit({
        node_code: nodeCode.trim(),
        node_name: nodeName.trim(),
        node_type: nodeType,
        latitude: parseFloat(coords.lat),
        longitude: parseFloat(coords.lng),
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

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-header">
          <span>📍 Tambah Titik Infrastruktur GIS</span>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Metode 2: Tombol GPS Cepat */}
            <div style={{ background: 'rgba(37, 99, 235, 0.15)', border: '1px dashed var(--primary)', padding: '10px', borderRadius: '8px' }}>
              <button type="button" className="btn btn-primary btn-sm" style={{ width: '100%' }} onClick={onUseGps}>
                🎯 Gunakan Lokasi GPS Saya Saat Ini
              </button>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '4px' }}>
                Atau geser Pin Merah langsung di peta (Metode 1)
              </div>
            </div>

            {/* Metode 3: Koordinat Manual / Sinkronisasi */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div className="form-group">
                <label className="form-label">Latitude</label>
                <input
                  type="number"
                  step="0.0000001"
                  className="form-input"
                  value={coords.lat}
                  onChange={(e) => onCoordsChange(e.target.value, coords.lng, 'manual_latlong')}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Longitude</label>
                <input
                  type="number"
                  step="0.0000001"
                  className="form-input"
                  value={coords.lng}
                  onChange={(e) => onCoordsChange(coords.lat, e.target.value, 'manual_latlong')}
                  required
                />
              </div>
            </div>

            {/* Tipe & Kapasitas */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div className="form-group">
                <label className="form-label">Tipe Node</label>
                <select className="form-select" value={nodeType} onChange={(e) => setNodeType(e.target.value)}>
                  <option value="ODP">ODP (Distribution Point)</option>
                  <option value="JB">JB (Joint Box Closure)</option>
                  <option value="ODC">ODC (Cabinet)</option>
                  <option value="POP">POP (Core Server)</option>
                  <option value="CUSTOMER">Pelanggan (ONT / ONU)</option>
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

            {/* Kode & Nama */}
            <div className="form-group">
              <label className="form-label">Kode Node Unik</label>
              <input
                type="text"
                className="form-input"
                placeholder="Contoh: ODP-SMG-045"
                value={nodeCode}
                onChange={(e) => setNodeCode(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Nama Node / Alamat</label>
              <input
                type="text"
                className="form-input"
                placeholder="Contoh: ODP Tiang Depan Ruko 5"
                value={nodeName}
                onChange={(e) => setNodeName(e.target.value)}
                required
              />
            </div>

            {/* Parent Node */}
            <div className="form-group">
              <label className="form-label">Parent Node (Hierarki Jalur)</label>
              <select className="form-select" value={parentId} onChange={(e) => setParentId(e.target.value)}>
                <option value="">-- Tanpa Parent (Root POP) --</option>
                {parentNodes.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.node_type}] {p.node_code} - {p.node_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Customer specific */}
            {nodeType === 'CUSTOMER' && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div className="form-group">
                    <label className="form-label">Serial Number ONT</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="ZTEGC1234567"
                      value={onuSn}
                      onChange={(e) => setOnuSn(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Username PPPoE</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="budi_isp"
                      value={pppoeUser}
                      onChange={(e) => setPppoeUser(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Patokan Lokasi Lapangan</label>
              <textarea
                className="form-textarea"
                rows="2"
                placeholder="Klem tiang stainless samping warung"
                value={addressNote}
                onChange={(e) => setAddressNote(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Batal</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Menyimpan...' : 'Simpan Node GIS'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
