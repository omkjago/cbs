import React, { useState, useEffect } from 'react';
import { IconCable } from './Icons';

export default function AddCableModal({
  isOpen,
  onClose,
  nodes = [],
  onSubmit,
  onToast
}) {
  const [startNodeId, setStartNodeId] = useState('');
  const [endNodeId, setEndNodeId] = useState('');
  const [cableCode, setCableCode] = useState('');
  const [cableType, setCableType] = useState('distribution');
  const [coreCount, setCoreCount] = useState('12');
  const [loading, setLoading] = useState(false);
  const [estimatedLength, setEstimatedLength] = useState(null);

  // Auto-generate Cable Code when start/end changes
  useEffect(() => {
    if (!startNodeId || !endNodeId) return;
    const startNode = nodes.find((n) => String(n.id) === String(startNodeId));
    const endNode = nodes.find((n) => String(n.id) === String(endNodeId));
    if (startNode && endNode) {
      setCableCode(`CBL-${startNode.node_code}-${endNode.node_code}`);
    }
  }, [startNodeId, endNodeId, nodes]);

  // Adjust default core count by cable type
  useEffect(() => {
    if (cableType === 'feeder') setCoreCount('48');
    else if (cableType === 'distribution') setCoreCount('12');
    else if (cableType === 'drop_core') setCoreCount('1');
  }, [cableType]);

  // Calculate direct Haversine distance estimate
  useEffect(() => {
    if (!startNodeId || !endNodeId) {
      setEstimatedLength(null);
      return;
    }
    const startNode = nodes.find((n) => String(n.id) === String(startNodeId));
    const endNode = nodes.find((n) => String(n.id) === String(endNodeId));
    if (!startNode || !endNode) return;

    const lat1 = parseFloat(startNode.latitude);
    const lng1 = parseFloat(startNode.longitude);
    const lat2 = parseFloat(endNode.latitude);
    const lng2 = parseFloat(endNode.longitude);

    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    setEstimatedLength(Math.round(R * c));
  }, [startNodeId, endNodeId, nodes]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!startNodeId || !endNodeId) {
      if (onToast) onToast('Pilih titik awal dan titik akhir kabel.', 'error');
      return;
    }
    if (startNodeId === endNodeId) {
      if (onToast) onToast('Titik awal dan titik akhir tidak boleh sama.', 'error');
      return;
    }

    const startNode = nodes.find((n) => String(n.id) === String(startNodeId));
    const endNode = nodes.find((n) => String(n.id) === String(endNodeId));
    if (!startNode || !endNode) return;

    setLoading(true);

    try {
      const lat1 = parseFloat(startNode.latitude);
      const lng1 = parseFloat(startNode.longitude);
      const lat2 = parseFloat(endNode.latitude);
      const lng2 = parseFloat(endNode.longitude);

      const waypoints = [
        [lat1, lng1],
        [lat2, lng2]
      ];

      await onSubmit({
        cable_code: cableCode.trim(),
        cable_type: cableType,
        core_count: parseInt(coreCount, 10) || 12,
        start_node_id: parseInt(startNodeId, 10),
        end_node_id: parseInt(endNodeId, 10),
        waypoints,
        length_meters: estimatedLength || 0
      });

      onClose();
    } catch (err) {
      if (onToast) onToast('Gagal memasang kabel: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-header">
          <div className="modal-title-row">
            <IconCable size={18} />
            <h2 className="modal-title">Tarik Jalur Kabel Fiber Optik Baru</h2>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} title="Tutup">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Titik Awal (Infrastruktur Asal)</label>
              <select
                className="form-select"
                value={startNodeId}
                onChange={(e) => setStartNodeId(e.target.value)}
                required
              >
                <option value="">-- Pilih Titik Awal --</option>
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    [{n.node_type}] {n.node_code} - {n.node_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Titik Akhir (Infrastruktur Tujuan)</label>
              <select
                className="form-select"
                value={endNodeId}
                onChange={(e) => setEndNodeId(e.target.value)}
                required
              >
                <option value="">-- Pilih Titik Akhir --</option>
                {nodes
                  .filter((n) => String(n.id) !== String(startNodeId))
                  .map((n) => (
                    <option key={n.id} value={n.id}>
                      [{n.node_type}] {n.node_code} - {n.node_name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="form-grid-3">
            <div className="form-group">
              <label className="form-label">Kode Jalur Kabel</label>
              <input
                type="text"
                className="form-input"
                value={cableCode}
                onChange={(e) => setCableCode(e.target.value.toUpperCase())}
                placeholder="CBL-ODC-ODP"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Tipe Kabel</label>
              <select
                className="form-select"
                value={cableType}
                onChange={(e) => setCableType(e.target.value)}
              >
                <option value="feeder">Feeder Backbone (Kapasitas Besar)</option>
                <option value="distribution">Distribusi ODP (Sedang)</option>
                <option value="drop_core">Drop Core Pelanggan (Kecil)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Kapasitas Core</label>
              <input
                type="number"
                className="form-input"
                value={coreCount}
                onChange={(e) => setCoreCount(e.target.value)}
                min="1"
                max="144"
                required
              />
            </div>
          </div>

          <div className="routing-estimate-box">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                Koneksi Fisik Terhubung:
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-main)', fontWeight: 600 }}>
                Kabel terhubung langsung antar kedua titik. Titik belokan dapat ditambahkan kapan saja di peta.
              </span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-dim)', display: 'block' }}>PANJANG LANGSUNG</span>
              <strong>{estimatedLength !== null ? `${estimatedLength} Meter` : '-'}</strong>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Batal
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading || !startNodeId || !endNodeId}>
              {loading ? 'Memasang Jalur Kabel...' : 'Simpan & Pasang Kabel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
