import React, { useState } from 'react';
import { IconAlert, IconMap, IconExternalLink, IconRefresh } from './Icons';

export default function FaultCenter({
  faults = [],
  onFocusNode,
  onRefresh,
  onToast
}) {
  const [filterType, setFilterType] = useState('ALL');

  const filteredFaults = faults.filter((f) => {
    if (filterType === 'ALL') return true;
    return f.fault_type === filterType;
  });

  const getSeverityBadge = (type) => {
    switch (type) {
      case 'BACKBONE_FEEDER_CUT':
        return <span className="badge badge-danger">[KRITIS: BACKBONE / FEEDER]</span>;
      case 'ODP_DISTRIBUTION_CUT':
        return <span className="badge badge-warning">[TINGGI: KABEL DISTRIBUSI]</span>;
      case 'INDIVIDUAL_DROP_CUT':
      default:
        return <span className="badge badge-neutral">[DROP CORE PELANGGAN]</span>;
    }
  };

  return (
    <div className="fault-center-layout">
      {/* Header Bar */}
      <div className="view-header-bar">
        <div>
          <h2 className="view-title">Pusat Gangguan &amp; Lokalisasi Alarm</h2>
          <p className="view-subtitle">
            Mesin inferensi FaultAnalyzerService melakukan penelusuran graf topologi dari bawah ke atas (Bottom-Up Traversal) untuk mengisolasi titik putus kabel serat optik.
          </p>
        </div>
        <div className="view-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onRefresh}>
            <IconRefresh size={14} />
            <span>Audit Ulang Sinyal</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="filter-toolbar-bar">
        <div className="filter-tabs-group">
          <button
            type="button"
            className={`filter-tab-pill ${filterType === 'ALL' ? 'active' : ''}`}
            onClick={() => setFilterType('ALL')}
          >
            Semua Insiden ({faults.length})
          </button>
          <button
            type="button"
            className={`filter-tab-pill ${filterType === 'BACKBONE_FEEDER_CUT' ? 'active' : ''}`}
            onClick={() => setFilterType('BACKBONE_FEEDER_CUT')}
          >
            Backbone Feeder ({faults.filter((f) => f.fault_type === 'BACKBONE_FEEDER_CUT').length})
          </button>
          <button
            type="button"
            className={`filter-tab-pill ${filterType === 'ODP_DISTRIBUTION_CUT' ? 'active' : ''}`}
            onClick={() => setFilterType('ODP_DISTRIBUTION_CUT')}
          >
            Distribusi ODP ({faults.filter((f) => f.fault_type === 'ODP_DISTRIBUTION_CUT').length})
          </button>
          <button
            type="button"
            className={`filter-tab-pill ${filterType === 'INDIVIDUAL_DROP_CUT' ? 'active' : ''}`}
            onClick={() => setFilterType('INDIVIDUAL_DROP_CUT')}
          >
            Drop Core ({faults.filter((f) => f.fault_type === 'INDIVIDUAL_DROP_CUT').length})
          </button>
        </div>
      </div>

      {/* Incident List */}
      {filteredFaults.length === 0 ? (
        <div className="enterprise-card healthy-full-card">
          <div className="healthy-badge-text">[KONDISI NORMAL]</div>
          <h3 className="healthy-heading">Tidak Ditemukan Indikasi Kabel Putus</h3>
          <p className="healthy-body">
            Seluruh segmen kabel transmisi dan titik distribusi beroperasi tanpa pemutusan sinyal.
            Jika pelanggan melaporkan gangguan, gunakan fitur <strong>Periksa OPM Live</strong> pada menu Inventaris
            atau tambahkan log hasil ukur redaman baru.
          </p>
        </div>
      ) : (
        <div className="incident-grid">
          {filteredFaults.map((fault, index) => (
            <div key={index} className="incident-card">
              <div className="incident-card-top">
                <div className="incident-header-left">
                  {getSeverityBadge(fault.fault_type)}
                  <span className="incident-target-code font-mono text-cyan">
                    {fault.target_code}
                  </span>
                </div>
                <div className="incident-impact-badge">
                  Dampak: <strong>{fault.affected_customers_count} Pelanggan</strong>
                </div>
              </div>

              <div className="incident-body">
                <div className="incident-segment-name">
                  <strong>Segmen Terindikasi:</strong> {fault.suspected_segment}
                </div>
                <div className="incident-recommendation">
                  <strong>Rekomendasi Teknisi:</strong> {fault.recommendation}
                </div>
                <div className="incident-coords-info">
                  Estimasi Koordinat: <span className="font-mono text-muted">{fault.estimated_coordinates.lat}, {fault.estimated_coordinates.lng}</span>
                </div>
              </div>

              <div className="incident-footer">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => onFocusNode(fault.estimated_coordinates.lat, fault.estimated_coordinates.lng)}
                >
                  <IconMap size={14} />
                  <span>Fokus di Peta GIS</span>
                </button>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${fault.estimated_coordinates.lat},${fault.estimated_coordinates.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary btn-sm"
                >
                  <IconExternalLink size={13} />
                  <span>Buka Google Maps</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
