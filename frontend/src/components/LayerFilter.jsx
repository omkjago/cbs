import React from 'react';

export default function LayerFilter({ filters, onToggleFilter }) {
  const options = [
    { key: 'POP', label: '🏢 POP / Core Server' },
    { key: 'ODC', label: '🗄️ ODC (Optical Cabinet)' },
    { key: 'JB', label: '🔷 JB (Joint Box Closure)' },
    { key: 'ODP', label: '📦 ODP (Distribution Point)' },
    { key: 'CUSTOMER_NORMAL', label: '🟢 Pelanggan Normal' },
    { key: 'CUSTOMER_FAULT', label: '🔴 Pelanggan Gangguan (LOS / dBm)' }
  ];

  return (
    <div>
      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
        FILTER TAMPILAN LAYER:
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
        {options.map((opt) => (
          <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={filters[opt.key] ?? true}
              onChange={(e) => onToggleFilter(opt.key, e.target.checked)}
            />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
