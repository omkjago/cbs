import React from 'react';

export default function LayerFilter({ filters, onToggleFilter }) {
  const nodeLayers = [
    {
      key: 'POP',
      tag: 'POP',
      label: 'Point of Presence (Core)',
      bgColor: '#6366f1',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <rect x="2" y="2" width="20" height="8" rx="2" />
          <rect x="2" y="14" width="20" height="8" rx="2" />
          <line x1="6" y1="6" x2="6.01" y2="6" />
          <line x1="6" y1="18" x2="6.01" y2="18" />
        </svg>
      )
    },
    {
      key: 'ODC',
      tag: 'ODC',
      label: 'Optical Distribution Cabinet',
      bgColor: '#0284c7',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <path d="M4 4h16v16H4z" />
          <path d="M12 4v16" />
          <circle cx="8" cy="12" r="1" />
          <circle cx="16" cy="12" r="1" />
        </svg>
      )
    },
    {
      key: 'JB',
      tag: 'JB',
      label: 'Joint Box Closure',
      bgColor: '#0d9488',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" transform="rotate(45 12 12)" />
        </svg>
      )
    },
    {
      key: 'ODP',
      tag: 'ODP',
      label: 'Optical Distribution Point',
      bgColor: '#8b5cf6',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <circle cx="15.5" cy="8.5" r="1.5" />
          <circle cx="8.5" cy="15.5" r="1.5" />
          <circle cx="15.5" cy="15.5" r="1.5" />
        </svg>
      )
    },
    {
      key: 'CUSTOMER_NORMAL',
      tag: 'CUST',
      label: 'Pelanggan Normal (Online)',
      bgColor: '#10b981',
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      )
    },
    {
      key: 'CUSTOMER_FAULT',
      tag: 'LOS',
      label: 'Pelanggan Gangguan (LOS / dBm)',
      bgColor: '#ef4444',
      isPulse: true,
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      )
    }
  ];

  return (
    <div className="layer-filter-container">
      {/* 1. Node Layer Filters */}
      <div className="filter-section-title">
        FILTER LAYER TITIK INFRASTRUKTUR
      </div>

      <div className="filter-checkbox-list">
        {nodeLayers.map((layer) => {
          const isChecked = filters[layer.key] ?? true;
          return (
            <label
              key={layer.key}
              className={`layer-item-row ${isChecked ? 'layer-item-active' : 'layer-item-inactive'}`}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={(e) => onToggleFilter(layer.key, e.target.checked)}
                className="layer-checkbox-input"
              />

              {/* Exact Matching Mini Map Marker Pin Icon */}
              <div
                className={`filter-mini-pin ${layer.isPulse ? 'pulse-animation' : ''}`}
                style={{ backgroundColor: layer.bgColor }}
              >
                {layer.icon}
              </div>

              <div className="layer-info-col">
                <div className="layer-tag-label-row">
                  <span className="layer-tag-pill">{layer.tag}</span>
                  <span className="layer-main-title">{layer.label}</span>
                </div>
              </div>
            </label>
          );
        })}
      </div>

      {/* 2. Cable Route Legend */}
      <div className="filter-section-title" style={{ marginTop: '16px' }}>
        LEGENDA JALUR KABEL SERAT OPTIK
      </div>

      <div className="cable-legend-list">
        <div className="cable-legend-item">
          <div className="cable-legend-line cable-line-feeder" />
          <span className="cable-legend-text">Feeder Backbone (POP - ODC)</span>
        </div>
        <div className="cable-legend-item">
          <div className="cable-legend-line cable-line-distribution" />
          <span className="cable-legend-text">Distribusi (ODC - JB - ODP)</span>
        </div>
        <div className="cable-legend-item">
          <div className="cable-legend-line cable-line-drop" />
          <span className="cable-legend-text">Drop Core Pelanggan (ODP - ONT)</span>
        </div>
        <div className="cable-legend-item">
          <div className="cable-legend-line cable-line-cut" />
          <span className="cable-legend-text">Terindikasi Putus / Warning</span>
        </div>
      </div>
    </div>
  );
}
