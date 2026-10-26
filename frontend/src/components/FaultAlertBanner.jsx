import React from 'react';

export default function FaultAlertBanner({ faults = [], onFocusNode }) {
  if (!faults || faults.length === 0) return null;

  return (
    <div className="fault-banner-card">
      <div className="fault-banner-title-bar">
        <span className="badge badge-danger">GANGGUAN AKTIF ({faults.length})</span>
        <span className="fault-banner-heading">Peringatan Serat Optik Terputus</span>
      </div>

      <div className="fault-banner-items-list">
        {faults.map((cut, idx) => {
          const lat = cut.check_coordinates?.latitude;
          const lng = cut.check_coordinates?.longitude;
          const isBackbone = cut.fault_type === 'BACKBONE_FEEDER_CUT';

          return (
            <div key={idx} className="fault-banner-item">
              <div className="fault-item-top">
                <span className={`fault-tag ${isBackbone ? 'fault-tag-danger' : 'fault-tag-warning'}`}>
                  {isBackbone ? 'PUTUS BACKBONE / FEEDER' : 'PUTUS DISTRIBUSI / DROP'}
                </span>
                <span className="fault-impact-badge">
                  Dampak: {cut.affected_customers_count} Pelanggan
                </span>
              </div>

              <div className="fault-item-route">
                Jalur: <strong>{cut.from_node}</strong> menuju <strong>{cut.to_node}</strong> (Kode: {cut.cable_code})
              </div>

              <div className="fault-item-desc">
                {cut.recommendation}
              </div>

              {lat && lng && (
                <div className="fault-item-actions">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => onFocusNode && onFocusNode(lat, lng)}
                  >
                    Fokus di Peta
                  </button>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-secondary btn-sm"
                  >
                    Buka Google Maps
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
