import React from 'react';

export default function LayerFilter({ filters, onToggleFilter }) {
  const options = [
    { key: 'POP', label: 'POP (Core Server)', dotColor: '#3b82f6' },
    { key: 'ODC', label: 'ODC (Optical Cabinet)', dotColor: '#8b5cf6' },
    { key: 'JB', label: 'JB (Joint Box Closure)', dotColor: '#0ea5e9' },
    { key: 'ODP', label: 'ODP (Distribution Point)', dotColor: '#f97316' },
    { key: 'CUSTOMER_NORMAL', label: 'Pelanggan Normal (Online)', dotColor: '#10b981' },
    { key: 'CUSTOMER_FAULT', label: 'Pelanggan Gangguan (LOS / dBm)', dotColor: '#ef4444' }
  ];

  return (
    <div className="layer-filter-container">
      <div className="filter-section-title">
        FILTER LAYER INFRASTRUKTUR
      </div>
      <div className="filter-checkbox-list">
        {options.map((opt) => (
          <label key={opt.key} className="layer-checkbox-label">
            <input
              type="checkbox"
              checked={filters[opt.key] ?? true}
              onChange={(e) => onToggleFilter(opt.key, e.target.checked)}
              className="layer-checkbox-input"
            />
            <span
              className="layer-indicator-circle"
              style={{ backgroundColor: opt.dotColor }}
            />
            <span className="layer-label-text">{opt.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
