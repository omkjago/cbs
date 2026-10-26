import React from 'react';
import {
  IconDashboard,
  IconMap,
  IconAlert,
  IconInventory,
  IconDevices,
  IconActivity,
  IconExternalLink,
  IconChevronRight
} from './Icons';

export default function NocDashboard({
  nodes = [],
  cables = [],
  summary = {},
  faults = [],
  onFocusNode,
  onSelectView,
  onOpenAddNode,
  onLiveOpm,
  onToast
}) {
  const totalCustomers = summary.total_customers || 0;
  const onlineCustomers = summary.online || 0;
  const warningCustomers = summary.warning_dbm || 0;
  const losCustomers = summary.los_cut || 0;

  // Calculate infrastructure nodes
  const popCount = nodes.filter((n) => n.node_type === 'POP').length;
  const odcCount = nodes.filter((n) => n.node_type === 'ODC').length;
  const jbCount = nodes.filter((n) => n.node_type === 'JB').length;
  const odpCount = nodes.filter((n) => n.node_type === 'ODP').length;
  const infraCount = popCount + odcCount + jbCount + odpCount;

  // System Health percentage
  const healthPercent =
    totalCustomers > 0
      ? Math.round(((onlineCustomers + warningCustomers * 0.5) / totalCustomers) * 100)
      : 100;

  // Recent 5 nodes with latest updates
  const recentNodes = nodes.slice(0, 6);

  return (
    <div className="noc-dashboard-layout">
      {/* 1. Executive NOC Status Header Banner */}
      <section className="noc-hero-banner">
        <div className="hero-left">
          <div className="hero-status-tag">
            <span className={`status-pill ${faults.length > 0 ? 'pill-danger' : 'pill-success'}`}>
              {faults.length > 0 ? '[PERINGATAN GANGGUAN]' : '[OPERASIONAL NORMAL]'}
            </span>
            <span className="hero-update-tag">NOC REAL-TIME TELEMETRY</span>
          </div>
          <h2 className="hero-title">
            {faults.length > 0
              ? `Terdeteksi ${faults.length} Insiden Putus Kabel Serat Optik`
              : 'Seluruh Jaringan Transmisi Fiber Optik Beroperasi Optimal'}
          </h2>
          <p className="hero-desc">
            {faults.length > 0
              ? 'Sistem analisis lokalisasi mendeteksi anomali transmisi sinyal. Segera tindak lanjuti segmen jalur kabel yang terindikasi putus di bawah ini.'
              : 'Pemantauan sinyal Rx Power (dBm) pada seluruh segmen OLT, ODC, Joint Box, dan ODP terpantau dalam batas toleransi normal.'}
          </p>
        </div>

        <div className="hero-right">
          <div className="health-score-box">
            <span className="health-score-label">SKOR KESEHATAN SISTEM</span>
            <span className="health-score-number">{healthPercent}%</span>
            <div className="health-progress-bar">
              <div
                className={`health-progress-fill ${
                  healthPercent > 90 ? 'fill-good' : healthPercent > 70 ? 'fill-warn' : 'fill-crit'
                }`}
                style={{ width: `${healthPercent}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* 2. Top Metric KPI Grid */}
      <section className="noc-kpi-grid">
        <div className="kpi-metric-card" onClick={() => onSelectView('inventory')}>
          <div className="kpi-card-head">
            <span className="kpi-tag">TOTAL PELANGGAN</span>
            <span className="badge badge-neutral">TERDAFTAR</span>
          </div>
          <div className="kpi-main-val">{totalCustomers}</div>
          <div className="kpi-subtext">Drop core aktif terdata</div>
        </div>

        <div className="kpi-metric-card" onClick={() => onSelectView('inventory')}>
          <div className="kpi-card-head">
            <span className="kpi-tag">PELANGGAN NORMAL</span>
            <span className="badge badge-success">ONLINE</span>
          </div>
          <div className="kpi-main-val text-success">{onlineCustomers}</div>
          <div className="kpi-subtext">Rx Power &gt; -25.0 dBm</div>
        </div>

        <div className="kpi-metric-card" onClick={() => onSelectView('faults')}>
          <div className="kpi-card-head">
            <span className="kpi-tag">WARNING REDAMAN</span>
            <span className="badge badge-warning">REDAMAN TINGGI</span>
          </div>
          <div className="kpi-main-val text-warning">{warningCustomers}</div>
          <div className="kpi-subtext">-25.0 dBm s/d -28.0 dBm</div>
        </div>

        <div className="kpi-metric-card" onClick={() => onSelectView('faults')}>
          <div className="kpi-card-head">
            <span className="kpi-tag">GANGGUAN KRITIS</span>
            <span className="badge badge-danger">LOS / CUT</span>
          </div>
          <div className="kpi-main-val text-danger">{losCustomers}</div>
          <div className="kpi-subtext">Rx &lt; -28.0 dBm atau putus</div>
        </div>

        <div className="kpi-metric-card" onClick={() => onSelectView('inventory')}>
          <div className="kpi-card-head">
            <span className="kpi-tag">TITIK INFRASTRUKTUR</span>
            <span className="badge badge-neutral">BACKBONE</span>
          </div>
          <div className="kpi-main-val">{infraCount}</div>
          <div className="kpi-subtext">POP, ODC, JB, &amp; ODP</div>
        </div>

        <div className="kpi-metric-card" onClick={() => onSelectView('map')}>
          <div className="kpi-card-head">
            <span className="kpi-tag">TOTAL RUTE KABEL</span>
            <span className="badge badge-neutral">TOPOLOGI</span>
          </div>
          <div className="kpi-main-val">{cables.length}</div>
          <div className="kpi-subtext">Feeder &amp; Distribusi GIS</div>
        </div>
      </section>

      {/* 3. Mid Section: Active Fiber Cut Alerts & Infrastructure Breakdown */}
      <div className="noc-split-row">
        {/* Sisi Kiri: Active Fiber Cut Spotlight */}
        <div className="noc-col-primary">
          <div className="enterprise-card">
            <div className="card-header-row">
              <div className="card-title-group">
                <span className="card-section-tag">INSIDEN FISIK</span>
                <h3 className="card-title">Peringatan Putus Serat Optik Aktif</h3>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => onSelectView('faults')}
              >
                <span>Buka Pusat Gangguan</span>
                <IconChevronRight size={14} />
              </button>
            </div>

            <div className="card-content-area">
              {faults.length === 0 ? (
                <div className="healthy-empty-state">
                  <div className="healthy-badge-text">[STATUS SISTEM NORMAL]</div>
                  <h4 className="healthy-title">Tidak Ada Indikasi Putus Kabel Saat Ini</h4>
                  <p className="healthy-desc">
                    Algoritma lokalisasi cerdas FaultAnalyzerService tidak menemukan anomali pemutusan kabel
                    pada jalur transmisi feeder backbone maupun kabel distribusi ke ODP.
                  </p>
                </div>
              ) : (
                <div className="fault-incident-list">
                  {faults.map((fault, idx) => (
                    <div key={idx} className="fault-incident-item">
                      <div className="fault-incident-left">
                        <div className="fault-tag-row">
                          <span className="badge badge-danger">
                            {fault.fault_type === 'BACKBONE_FEEDER_CUT'
                              ? '[PUTUS BACKBONE / FEEDER]'
                              : fault.fault_type === 'ODP_DISTRIBUTION_CUT'
                              ? '[PUTUS KABEL DISTRIBUSI]'
                              : '[PUTUS DROP CORE]'}
                          </span>
                          <span className="fault-target-code">{fault.target_code}</span>
                        </div>
                        <div className="fault-route-info">{fault.suspected_segment}</div>
                        <div className="fault-impact-info">
                          Dampak: <strong>{fault.affected_customers_count} Pelanggan LOS</strong> |{' '}
                          {fault.recommendation}
                        </div>
                      </div>

                      <div className="fault-incident-actions">
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => onFocusNode(fault.estimated_coordinates.lat, fault.estimated_coordinates.lng)}
                        >
                          <IconMap size={14} />
                          <span>Fokus di Peta</span>
                        </button>
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${fault.estimated_coordinates.lat},${fault.estimated_coordinates.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-secondary btn-sm"
                        >
                          <IconExternalLink size={13} />
                          <span>Google Maps</span>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sisi Kanan: Quick Operations & Topology Distribution */}
        <div className="noc-col-secondary">
          <div className="enterprise-card">
            <div className="card-header-row">
              <div className="card-title-group">
                <span className="card-section-tag">TOPOLOGI</span>
                <h3 className="card-title">Distribusi Titik Jaringan</h3>
              </div>
            </div>

            <div className="topology-distribution-list">
              <div className="distribution-row">
                <div className="dist-label-group">
                  <span className="dist-indicator dist-pop" />
                  <span className="dist-name">POP (Point of Presence / Core)</span>
                </div>
                <span className="dist-val">{popCount} Unit</span>
              </div>

              <div className="distribution-row">
                <div className="dist-label-group">
                  <span className="dist-indicator dist-odc" />
                  <span className="dist-name">ODC (Distribution Cabinet)</span>
                </div>
                <span className="dist-val">{odcCount} Unit</span>
              </div>

              <div className="distribution-row">
                <div className="dist-label-group">
                  <span className="dist-indicator dist-jb" />
                  <span className="dist-name">JB (Joint Box Closure)</span>
                </div>
                <span className="dist-val">{jbCount} Unit</span>
              </div>

              <div className="distribution-row">
                <div className="dist-label-group">
                  <span className="dist-indicator dist-odp" />
                  <span className="dist-name">ODP (Optical Distribution Point)</span>
                </div>
                <span className="dist-val">{odpCount} Unit</span>
              </div>

              <div className="distribution-row">
                <div className="dist-label-group">
                  <span className="dist-indicator dist-cust" />
                  <span className="dist-name">Drop Core Pelanggan</span>
                </div>
                <span className="dist-val">{totalCustomers} Unit</span>
              </div>
            </div>

            <div className="quick-nav-block">
              <span className="quick-nav-title">AKSI CEPAT OPERATOR</span>
              <div className="quick-nav-buttons">
                <button
                  type="button"
                  className="btn btn-primary btn-sm full-width"
                  onClick={onOpenAddNode}
                >
                  <span>+ Tambah Titik Infrastruktur GIS</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm full-width"
                  onClick={() => onSelectView('map')}
                >
                  <IconMap size={14} />
                  <span>Buka Peta Geospasial Penuh</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm full-width"
                  onClick={() => onSelectView('devices')}
                >
                  <IconDevices size={14} />
                  <span>Uji Koneksi Perangkat OLT</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Bottom Section: Recent Monitored Nodes Preview Table */}
      <section className="enterprise-card">
        <div className="card-header-row">
          <div className="card-title-group">
            <span className="card-section-tag">AUDIT FISIK</span>
            <h3 className="card-title">Ringkasan Titik Infrastruktur Terdata</h3>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => onSelectView('inventory')}
          >
            <span>Lihat Semua ({nodes.length} Titik)</span>
            <IconChevronRight size={14} />
          </button>
        </div>

        {nodes.length === 0 ? (
          <div className="empty-state-card">
            <div className="empty-title">Belum Ada Titik Infrastruktur Terdaftar</div>
            <p className="empty-desc">
              Basis data bersih tanpa data dummy. Mulai petakan jaringan Anda dengan menambahkan titik POP atau ODC pertama.
            </p>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={onOpenAddNode}
              style={{ marginTop: '12px' }}
            >
              <span>+ Tambah Titik GIS Pertama</span>
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Tipe</th>
                  <th>Kode Node</th>
                  <th>Nama Titik</th>
                  <th>Koordinat GPS</th>
                  <th>Daya Sinyal (OPM)</th>
                  <th>Status Transmisi</th>
                  <th>Catatan Alamat / Lokasi</th>
                  <th>Tindakan</th>
                </tr>
              </thead>
              <tbody>
                {recentNodes.map((node) => {
                  const rxText = node.rx_power_dbm !== null ? `${node.rx_power_dbm} dBm` : '-';
                  return (
                    <tr key={node.id}>
                      <td>
                        <span className="node-type-badge">{node.node_type}</span>
                      </td>
                      <td className="font-mono text-cyan">{node.node_code}</td>
                      <td>
                        <strong>{node.node_name}</strong>
                      </td>
                      <td className="font-mono text-muted">
                        {node.latitude.toFixed(6)}, {node.longitude.toFixed(6)}
                      </td>
                      <td className="font-mono">
                        <strong>{rxText}</strong>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            node.status === 'ONLINE'
                              ? 'badge-success'
                              : node.status === 'WARNING_DBM'
                              ? 'badge-warning'
                              : node.status === 'LOS'
                              ? 'badge-danger'
                              : 'badge-neutral'
                          }`}
                        >
                          [{node.status || 'UNKNOWN'}]
                        </span>
                      </td>
                      <td className="address-col">{node.address_note || '-'}</td>
                      <td>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => onLiveOpm(node)}
                            title="Uji bacaan OPM live"
                          >
                            <span>Periksa OPM</span>
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => onFocusNode(node.latitude, node.longitude)}
                            title="Lihat di Peta GIS"
                          >
                            <span>Peta</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
