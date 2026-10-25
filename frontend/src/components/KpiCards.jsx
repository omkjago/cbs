import React from 'react';

export default function KpiCards({ summary = {} }) {
  return (
    <div className="kpi-grid">
      <div className="kpi-card">
        <div className="kpi-title">Pelanggan Aktif</div>
        <div className="kpi-value text-success">{summary.online ?? 0}</div>
      </div>
      <div className="kpi-card">
        <div className="kpi-title">Redaman Warning</div>
        <div className="kpi-value text-warning">{summary.warning_dbm ?? 0}</div>
      </div>
      <div className="kpi-card">
        <div className="kpi-title">Gangguan (LOS)</div>
        <div className="kpi-value text-danger">{summary.los_cut ?? 0}</div>
      </div>
      <div className="kpi-card">
        <div className="kpi-title">Total Terdata</div>
        <div className="kpi-value text-muted">{summary.total_customers ?? 0}</div>
      </div>
    </div>
  );
}
