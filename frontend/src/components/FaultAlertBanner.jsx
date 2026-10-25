import React from 'react';

export default function FaultAlertBanner({ faults = [], onFocusNode }) {
  if (!faults || faults.length === 0) return null;

  return (
    <div style={{
      backgroundColor: 'rgba(239, 68, 68, 0.15)',
      border: '1px solid var(--danger)',
      borderRadius: '8px',
      padding: '12px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      marginBottom: '10px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--danger)', fontWeight: 'bold', fontSize: '13px' }}>
        <span>🚨</span>
        <span>PERINGATAN GANGGUAN FO AKTIF ({faults.length})</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
        {faults.map((cut, idx) => {
          const lat = cut.check_coordinates?.latitude;
          const lng = cut.check_coordinates?.longitude;
          const isBackbone = cut.fault_type === 'BACKBONE_FEEDER_CUT';

          return (
            <div
              key={idx}
              style={{
                backgroundColor: 'var(--surface)',
                border: `1px solid ${isBackbone ? 'var(--danger)' : 'var(--border)'}`,
                borderRadius: '6px',
                padding: '8px 10px',
                fontSize: '11px',
                lineHeight: '1.4'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontWeight: 'bold', color: isBackbone ? '#f87171' : 'var(--warning)' }}>
                  {isBackbone ? '⚡ PUTUS BACKBONE / FEEDER' : '⚠️ PUTUS DISTRIBUSI / DROP'}
                </span>
                <span style={{ backgroundColor: 'var(--surface-light)', padding: '1px 6px', borderRadius: '4px' }}>
                  {cut.affected_customers_count} Pelanggan
                </span>
              </div>

              <div style={{ color: 'var(--text-main)', marginBottom: '4px' }}>
                <strong>{cut.from_node}</strong> ➔ <strong>{cut.to_node}</strong> ({cut.cable_code})
              </div>

              <div style={{ color: 'var(--text-muted)', marginBottom: '6px', fontSize: '10px' }}>
                {cut.recommendation}
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                {lat && lng && (
                  <>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      style={{ padding: '2px 8px', fontSize: '10px' }}
                      onClick={() => onFocusNode && onFocusNode(lat, lng)}
                    >
                      🔍 Lihat di Peta
                    </button>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '2px 8px', fontSize: '10px', textDecoration: 'none' }}
                    >
                      🗺️ Navigasi Maps
                    </a>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
