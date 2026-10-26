import React, { useState, useEffect } from 'react';
import { Api } from '../services/api';

export default function InteractiveDashboard({
  nodes = [],
  cables = [],
  summary = {},
  faults = [],
  onFocusNode,
  onOpenAddNode,
  onRefresh,
  onToast
}) {
  const [activeSubTab, setActiveSubTab] = useState('nodes'); // 'nodes' | 'devices' | 'logs'
  const [nodeTypeFilter, setNodeTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Device management state
  const [devices, setDevices] = useState([]);
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [showAddDeviceModal, setShowAddDeviceModal] = useState(false);
  const [newDevice, setNewDevice] = useState({
    device_name: '',
    device_type: 'olt',
    vendor_driver: 'zte_c320',
    ip_address: '',
    api_port: '8728',
    snmp_port: '161',
    username: '',
    password: '',
    snmp_community: 'public'
  });

  // Log management state
  const [logStats, setLogStats] = useState(null);
  const [recentLogs, setRecentLogs] = useState([]);
  const [retentionDays, setRetentionDays] = useState(7);
  const [logLoading, setLogLoading] = useState(false);

  // Fetch devices and log stats when switching tabs
  useEffect(() => {
    if (activeSubTab === 'devices') {
      loadDevices();
    } else if (activeSubTab === 'logs') {
      loadLogs();
    }
  }, [activeSubTab]);

  const loadDevices = async () => {
    setDeviceLoading(true);
    try {
      const res = await Api.getDevices();
      setDevices(res.data || []);
    } catch (err) {
      if (onToast) onToast(err.message, 'error');
    } finally {
      setDeviceLoading(false);
    }
  };

  const loadLogs = async () => {
    setLogLoading(true);
    try {
      const res = await Api.getTempLogs();
      if (res.data) {
        setLogStats(res.data.stats || null);
        setRecentLogs(res.data.recent_logs || []);
        if (res.data.stats?.retention_days) {
          setRetentionDays(res.data.stats.retention_days);
        }
      }
    } catch (err) {
      if (onToast) onToast(err.message, 'error');
    } finally {
      setLogLoading(false);
    }
  };

  const handleTestDevice = async (id, name) => {
    try {
      if (onToast) onToast(`Menguji koneksi ke perangkat ${name}...`, 'info');
      const res = await Api.testDevice(id);
      if (onToast) onToast(`Koneksi ke ${name} berhasil. Respons: ${res.data?.system_description || 'OK'}`, 'success');
      loadDevices();
    } catch (err) {
      if (onToast) onToast(`Uji koneksi ke ${name} gagal: ${err.message}`, 'error');
    }
  };

  const handleDeleteDevice = async (id, name) => {
    if (!window.confirm(`Hapus perangkat ${name}?`)) return;
    try {
      await Api.deleteDevice(id);
      if (onToast) onToast(`Perangkat ${name} berhasil dihapus.`, 'success');
      loadDevices();
    } catch (err) {
      if (onToast) onToast(err.message, 'error');
    }
  };

  const handleCreateDevice = async (e) => {
    e.preventDefault();
    try {
      await Api.createDevice({
        ...newDevice,
        api_port: parseInt(newDevice.api_port) || 8728,
        snmp_port: parseInt(newDevice.snmp_port) || 161
      });
      if (onToast) onToast(`Perangkat ${newDevice.device_name} berhasil didaftarkan.`, 'success');
      setShowAddDeviceModal(false);
      setNewDevice({
        device_name: '',
        device_type: 'olt',
        vendor_driver: 'zte_c320',
        ip_address: '',
        api_port: '8728',
        snmp_port: '161',
        username: '',
        password: '',
        snmp_community: 'public'
      });
      loadDevices();
    } catch (err) {
      if (onToast) onToast(err.message, 'error');
    }
  };

  const handleSaveRetention = async () => {
    try {
      await Api.updateLogRetention(parseInt(retentionDays));
      if (onToast) onToast(`Kebijakan retensi berhasil diperbarui menjadi ${retentionDays} hari.`, 'success');
      loadLogs();
    } catch (err) {
      if (onToast) onToast(err.message, 'error');
    }
  };

  const handlePurgeLogs = async () => {
    if (!window.confirm('Bersihkan seluruh tabel temporary log sekarang? Riwayat log lama akan dihapus permanen.')) return;
    try {
      await Api.purgeTempLogs();
      if (onToast) onToast('Tabel temporary monitoring logs berhasil dibersihkan.', 'success');
      loadLogs();
    } catch (err) {
      if (onToast) onToast(err.message, 'error');
    }
  };

  const handleCheckOpm = async (node) => {
    try {
      if (onToast) onToast(`Memeriksa redaman OPM untuk ${node.node_code}...`, 'info');
      const res = await Api.getLiveOpm(node.id);
      const rx = res.data?.rx_power_dbm !== null ? `${res.data.rx_power_dbm} dBm` : 'N/A';
      if (onToast) onToast(`[OPM] ${node.node_code}: Rx Power = ${rx} (Status: ${res.data?.connection_status})`, 'success');
      if (onRefresh) onRefresh();
    } catch (err) {
      if (onToast) onToast(err.message, 'error');
    }
  };

  const handleDeleteNode = async (node) => {
    if (!window.confirm(`Hapus titik ${node.node_name} (${node.node_code})? Seluruh data status terkait akan terhapus.`)) return;
    try {
      await Api.deleteNode(node.id);
      if (onToast) onToast(`Titik ${node.node_code} berhasil dihapus.`, 'success');
      if (onRefresh) onRefresh();
    } catch (err) {
      if (onToast) onToast(err.message, 'error');
    }
  };

  // Filtered nodes calculation
  const filteredNodes = nodes.filter(n => {
    // Type filter
    if (nodeTypeFilter !== 'ALL') {
      if (nodeTypeFilter === 'CUSTOMER' && n.node_type !== 'CUSTOMER') return false;
      if (nodeTypeFilter !== 'CUSTOMER' && n.node_type !== nodeTypeFilter) return false;
    }

    // Status filter
    if (statusFilter !== 'ALL') {
      const st = n.connection_status || 'ONLINE';
      if (statusFilter === 'ONLINE' && st !== 'ONLINE') return false;
      if (statusFilter === 'WARNING' && st !== 'WARNING_DBM') return false;
      if (statusFilter === 'LOS' && st !== 'LOS') return false;
      if (statusFilter === 'OFFLINE' && st !== 'OFFLINE' && st !== 'DYING_GASP') return false;
    }

    // Search query
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const matchName = (n.node_name || '').toLowerCase().includes(q);
      const matchCode = (n.node_code || '').toLowerCase().includes(q);
      const matchNote = (n.address_note || '').toLowerCase().includes(q);
      const matchUser = (n.pppoe_username || '').toLowerCase().includes(q);
      if (!matchName && !matchCode && !matchNote && !matchUser) return false;
    }

    return true;
  });

  return (
    <div className="dashboard-wrapper">
      {/* 1. Header Overview & KPI Metric Cards */}
      <section className="dashboard-header-section">
        <div className="dashboard-title-row">
          <div>
            <h1 className="dashboard-heading">Dashboard Operasional & Pemantauan Jaringan</h1>
            <p className="dashboard-subheading">
              Monitoring status infrastruktur fiber optik, redaman daya optik (OPM), dan penanganan gangguan real-time.
            </p>
          </div>
          <div className="dashboard-actions">
            <button className="btn btn-primary" onClick={onOpenAddNode}>
              Tambah Titik GIS
            </button>
            <button className="btn btn-secondary" onClick={onRefresh}>
              Muat Ulang Data
            </button>
          </div>
        </div>

        {/* 4 KPI Cards */}
        <div className="kpi-grid">
          <div 
            className={`kpi-stat-card ${statusFilter === 'ALL' && nodeTypeFilter === 'ALL' ? 'active-filter' : ''}`}
            onClick={() => { setNodeTypeFilter('ALL'); setStatusFilter('ALL'); }}
            role="button"
            tabIndex={0}
          >
            <div className="kpi-stat-label">Total Titik Terpasang</div>
            <div className="kpi-stat-value">{nodes.length}</div>
            <div className="kpi-stat-desc">{cables.length} segmen kabel terpetakan</div>
          </div>

          <div 
            className={`kpi-stat-card kpi-success ${statusFilter === 'ONLINE' ? 'active-filter' : ''}`}
            onClick={() => { setNodeTypeFilter('ALL'); setStatusFilter('ONLINE'); }}
            role="button"
            tabIndex={0}
          >
            <div className="kpi-stat-label">Pelanggan Normal</div>
            <div className="kpi-stat-value">{summary.online || 0}</div>
            <div className="kpi-stat-desc">Status koneksi stabil</div>
          </div>

          <div 
            className={`kpi-stat-card kpi-warning ${statusFilter === 'WARNING' ? 'active-filter' : ''}`}
            onClick={() => { setNodeTypeFilter('ALL'); setStatusFilter('WARNING'); }}
            role="button"
            tabIndex={0}
          >
            <div className="kpi-stat-label">Peringatan Redaman</div>
            <div className="kpi-stat-value">{summary.warning || 0}</div>
            <div className="kpi-stat-desc">Rx Power di bawah ambang batas</div>
          </div>

          <div 
            className={`kpi-stat-card kpi-danger ${statusFilter === 'LOS' ? 'active-filter' : ''}`}
            onClick={() => { setNodeTypeFilter('ALL'); setStatusFilter('LOS'); }}
            role="button"
            tabIndex={0}
          >
            <div className="kpi-stat-label">Putus Sinyal (LOS)</div>
            <div className="kpi-stat-value">{(summary.los || 0) + (summary.dying_gasp || 0)}</div>
            <div className="kpi-stat-desc">{faults.length} titik putus dicurigai</div>
          </div>
        </div>
      </section>

      {/* 2. Fiber Cut Alert Banner if any faults exist */}
      {faults && faults.length > 0 ? (
        <section className="fault-alert-section">
          <div className="fault-alert-container">
            <div className="fault-alert-header">
              <span className="badge badge-danger">PERINGATAN GANGGUAN SERAT OPTIK</span>
              <span className="fault-alert-title">
                Terdeteksi {faults.length} segmen kabel serat optik mengalami putus atau anomali massal
              </span>
            </div>
            <div className="fault-alert-list">
              {faults.map((cut, idx) => (
                <div key={idx} className="fault-alert-item">
                  <div className="fault-item-info">
                    <span className="fault-type-tag">
                      {cut.fault_type === 'BACKBONE_FEEDER_CUT' ? 'PUTUS JALUR BACKBONE / FEEDER' :
                       cut.fault_type === 'ODP_DISTRIBUTION_CUT' ? 'PUTUS DISTRIBUSI MENUJU ODP' :
                       'PUTUS DROP CORE PELANGGAN'}
                    </span>
                    <span className="fault-segment-text">
                      Jalur: <strong>{cut.from_node}</strong> menuju <strong>{cut.to_node}</strong> (Kode: {cut.cable_code})
                    </span>
                    <span className="fault-impact-text">
                      Dampak: {cut.affected_customers_count} pelanggan kehilangan sinyal.
                    </span>
                    <p className="fault-recommendation-text">{cut.recommendation}</p>
                  </div>
                  <div className="fault-item-actions">
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => onFocusNode && onFocusNode(cut.check_coordinates.latitude, cut.check_coordinates.longitude)}
                    >
                      Fokus di Peta
                    </button>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${cut.check_coordinates.latitude},${cut.check_coordinates.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary btn-sm"
                    >
                      Buka Google Maps
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : (
        <section className="fault-healthy-section">
          <div className="healthy-box">
            <span className="badge badge-success">SISTEM NORMAL</span>
            <span className="healthy-text">
              Seluruh segmen kabel optik dan distribusi jaringan beroperasi tanpa indikasi pemutusan serat optik.
            </span>
          </div>
        </section>
      )}

      {/* 3. Sub-Navigation Tabs */}
      <section className="dashboard-content-tabs">
        <div className="tab-control-bar">
          <button
            className={`tab-btn ${activeSubTab === 'nodes' ? 'tab-btn-active' : ''}`}
            onClick={() => setActiveSubTab('nodes')}
          >
            Daftar Titik Infrastruktur GIS ({filteredNodes.length})
          </button>
          <button
            className={`tab-btn ${activeSubTab === 'devices' ? 'tab-btn-active' : ''}`}
            onClick={() => setActiveSubTab('devices')}
          >
            Perangkat Jaringan OLT & Router ({devices.length})
          </button>
          <button
            className={`tab-btn ${activeSubTab === 'logs' ? 'tab-btn-active' : ''}`}
            onClick={() => setActiveSubTab('logs')}
          >
            Log Pemantauan & Retensi
          </button>
        </div>

        {/* TAB 1: GIS NODES TABLE */}
        {activeSubTab === 'nodes' && (
          <div className="tab-panel">
            <div className="filter-toolbar">
              <div className="filter-group">
                <input
                  type="text"
                  className="form-input search-input"
                  placeholder="Cari kode, nama titik, alamat, atau username..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="filter-group">
                <select
                  className="form-select filter-select"
                  value={nodeTypeFilter}
                  onChange={(e) => setNodeTypeFilter(e.target.value)}
                >
                  <option value="ALL">Semua Tipe Node</option>
                  <option value="POP">POP (Core Server)</option>
                  <option value="ODC">ODC (Cabinet)</option>
                  <option value="JB">JB (Joint Box)</option>
                  <option value="ODP">ODP (Distribusi)</option>
                  <option value="CUSTOMER">Pelanggan</option>
                </select>
              </div>

              <div className="filter-group">
                <select
                  className="form-select filter-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="ALL">Semua Status Koneksi</option>
                  <option value="ONLINE">Online (Normal)</option>
                  <option value="WARNING">Peringatan Redaman (dBm)</option>
                  <option value="LOS">Putus Sinyal (LOS)</option>
                  <option value="OFFLINE">Offline / Dying Gasp</option>
                </select>
              </div>

              {(searchQuery || nodeTypeFilter !== 'ALL' || statusFilter !== 'ALL') && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => { setSearchQuery(''); setNodeTypeFilter('ALL'); setStatusFilter('ALL'); }}
                >
                  Reset Filter
                </button>
              )}
            </div>

            {filteredNodes.length === 0 ? (
              <div className="empty-state-box">
                <div className="empty-state-title">Tidak ada data titik GIS</div>
                <p className="empty-state-desc">
                  {nodes.length === 0
                    ? 'Belum ada titik infrastruktur jaringan yang didaftarkan pada database. Silakan klik "Tambah Titik GIS" untuk mulai memetakan POP, ODC, JB, ODP, atau pelanggan.'
                    : 'Tidak ada data titik yang cocok dengan kriteria pencarian dan filter yang Anda pilih.'}
                </p>
                {nodes.length === 0 && (
                  <button className="btn btn-primary" onClick={onOpenAddNode}>
                    Tambah Titik Sekarang
                  </button>
                )}
              </div>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Kode Titik</th>
                      <th>Nama & Tipe</th>
                      <th>Status Sinyal</th>
                      <th>Redaman (Rx dBm)</th>
                      <th>Koordinat Lokasi</th>
                      <th>Catatan Alamat</th>
                      <th style={{ textAlign: 'right' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredNodes.map((n) => {
                      const st = n.connection_status || 'ONLINE';
                      const badgeClass =
                        st === 'ONLINE' ? 'badge-success' :
                        st === 'WARNING_DBM' ? 'badge-warning' :
                        st === 'LOS' ? 'badge-danger' : 'badge-neutral';
                      const statusLabel =
                        st === 'ONLINE' ? 'ONLINE' :
                        st === 'WARNING_DBM' ? 'PERINGATAN DBM' :
                        st === 'LOS' ? 'PUTUS (LOS)' : 'OFFLINE';

                      return (
                        <tr key={n.id}>
                          <td>
                            <strong className="code-font">{n.node_code}</strong>
                          </td>
                          <td>
                            <div className="node-title-cell">{n.node_name}</div>
                            <div className="node-type-label">Tipe: {n.node_type}</div>
                          </td>
                          <td>
                            <span className={`badge ${badgeClass}`}>{statusLabel}</span>
                          </td>
                          <td>
                            {n.rx_power_dbm !== null ? (
                              <span className={n.rx_power_dbm < -25 ? 'text-danger font-bold' : 'text-primary'}>
                                {n.rx_power_dbm} dBm
                              </span>
                            ) : (
                              <span className="text-muted">-</span>
                            )}
                          </td>
                          <td>
                            <span className="coordinate-font">
                              {Number(n.latitude).toFixed(6)}, {Number(n.longitude).toFixed(6)}
                            </span>
                          </td>
                          <td className="note-cell">
                            {n.address_note || '-'}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div className="action-buttons-group">
                              {n.node_type === 'CUSTOMER' && (
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => handleCheckOpm(n)}
                                  title="Cek redaman optik langsung ke perangkat OLT"
                                >
                                  Periksa OPM
                                </button>
                              )}
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => onFocusNode && onFocusNode(n.latitude, n.longitude)}
                                title="Fokus tampilan peta ke titik ini"
                              >
                                Lihat di Peta
                              </button>
                              <button
                                className="btn btn-danger-outline btn-sm"
                                onClick={() => handleDeleteNode(n)}
                                title="Hapus titik ini"
                              >
                                Hapus
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
          </div>
        )}

        {/* TAB 2: NETWORK DEVICES TABLE */}
        {activeSubTab === 'devices' && (
          <div className="tab-panel">
            <div className="panel-top-actions">
              <span className="panel-section-title">Daftar Perangkat Jaringan Terdaftar</span>
              <button className="btn btn-primary btn-sm" onClick={() => setShowAddDeviceModal(true)}>
                Daftarkan Perangkat Baru
              </button>
            </div>

            {deviceLoading ? (
              <div className="loading-state-box">Memuat daftar perangkat jaringan...</div>
            ) : devices.length === 0 ? (
              <div className="empty-state-box">
                <div className="empty-state-title">Belum ada perangkat jaringan terdaftar</div>
                <p className="empty-state-desc">
                  Daftarkan perangkat OLT (ZTE C300/C320) atau Router MikroTik untuk mengaktifkan pemantauan otomatis status ONU dan redaman kabel secara real-time.
                </p>
                <button className="btn btn-primary" onClick={() => setShowAddDeviceModal(true)}>
                  Daftarkan Perangkat Baru
                </button>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Nama Perangkat</th>
                      <th>Tipe</th>
                      <th>Driver Vendor</th>
                      <th>Alamat IP & Port</th>
                      <th>Status Terakhir</th>
                      <th>Terakhir Dipantau</th>
                      <th style={{ textAlign: 'right' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {devices.map((d) => (
                      <tr key={d.id}>
                        <td><strong>{d.device_name}</strong></td>
                        <td><span className="badge badge-neutral">{d.device_type.toUpperCase()}</span></td>
                        <td>{d.vendor_driver}</td>
                        <td><code>{d.ip_address}:{d.api_port || d.snmp_port}</code></td>
                        <td>
                          <span className={`badge ${d.is_online ? 'badge-success' : 'badge-danger'}`}>
                            {d.is_online ? 'TERHUBUNG' : 'TERPUTUS'}
                          </span>
                        </td>
                        <td>{d.last_polled_at || 'Belum pernah'}</td>
                        <td style={{ textAlign: 'right' }}>
                          <div className="action-buttons-group">
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleTestDevice(d.id, d.device_name)}
                            >
                              Uji Koneksi
                            </button>
                            <button
                              className="btn btn-danger-outline btn-sm"
                              onClick={() => handleDeleteDevice(d.id, d.device_name)}
                            >
                              Hapus
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: LOGS & RETENTION CONTROL */}
        {activeSubTab === 'logs' && (
          <div className="tab-panel">
            <div className="log-retention-cards-grid">
              <div className="card-box">
                <div className="card-box-header">Statistik Penyimpanan Log Sementara</div>
                <div className="stat-metric-row">
                  <div>
                    <div className="stat-mini-label">Total Baris Log</div>
                    <div className="stat-mini-value">{logStats?.total_rows ?? 0} baris</div>
                  </div>
                  <div>
                    <div className="stat-mini-label">Estimasi Ukuran Tabel</div>
                    <div className="stat-mini-value">{logStats?.size_mb ?? 0} MB</div>
                  </div>
                </div>
                <div className="card-box-footer">
                  <button className="btn btn-danger-outline btn-sm" onClick={handlePurgeLogs}>
                    Bersihkan Semua Log Sekarang
                  </button>
                </div>
              </div>

              <div className="card-box">
                <div className="card-box-header">Kebijakan Retensi Otomatis</div>
                <p className="card-box-desc">
                  Data log status sementara yang lebih tua dari batas hari yang ditentukan akan dihapus secara berkala oleh background worker pembersih.
                </p>
                <div className="retention-form-row">
                  <label className="form-label" style={{ marginBottom: 0 }}>Simpan log selama:</label>
                  <select
                    className="form-select"
                    style={{ width: '140px' }}
                    value={retentionDays}
                    onChange={(e) => setRetentionDays(e.target.value)}
                  >
                    <option value="1">1 Hari</option>
                    <option value="3">3 Hari</option>
                    <option value="7">7 Hari</option>
                    <option value="14">14 Hari</option>
                    <option value="30">30 Hari</option>
                  </select>
                  <button className="btn btn-primary btn-sm" onClick={handleSaveRetention}>
                    Simpan Pengaturan
                  </button>
                </div>
              </div>
            </div>

            <div className="recent-logs-section">
              <div className="panel-section-title">Riwayat Log Kejadian Terkini (Maksimal 10 Terakhir)</div>
              {recentLogs.length === 0 ? (
                <div className="empty-state-box" style={{ padding: '24px' }}>
                  Tidak ada catatan log kejadian yang tersimpan saat ini.
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Waktu Kejadian</th>
                        <th>Kode Titik</th>
                        <th>Perubahan Status</th>
                        <th>Redaman (dBm)</th>
                        <th>Keterangan Gangguan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentLogs.map((log) => (
                        <tr key={log.id}>
                          <td>{log.created_at}</td>
                          <td><strong>{log.node_code || `Node #${log.node_id}`}</strong></td>
                          <td>
                            <span className="badge badge-neutral">{log.previous_status || 'N/A'}</span>
                            <span style={{ margin: '0 6px' }}>menjadi</span>
                            <span className={`badge ${log.new_status === 'ONLINE' ? 'badge-success' : 'badge-danger'}`}>
                              {log.new_status}
                            </span>
                          </td>
                          <td>{log.rx_power_dbm !== null ? `${log.rx_power_dbm} dBm` : '-'}</td>
                          <td>{log.fault_note || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* MODAL: DAFTARKAN PERANGKAT BARU */}
      {showAddDeviceModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <span className="modal-title-text">Daftarkan Perangkat Jaringan Baru</span>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowAddDeviceModal(false)}>
                Tutup
              </button>
            </div>
            <form onSubmit={handleCreateDevice}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Nama Perangkat</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Contoh: OLT-ZTE-CENTRAL-01"
                    value={newDevice.device_name}
                    onChange={(e) => setNewDevice({ ...newDevice, device_name: e.target.value })}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Tipe Perangkat</label>
                    <select
                      className="form-select"
                      value={newDevice.device_type}
                      onChange={(e) => setNewDevice({ ...newDevice, device_type: e.target.value })}
                    >
                      <option value="olt">OLT (Optical Line Terminal)</option>
                      <option value="router">Router / Switch</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Driver Vendor</label>
                    <select
                      className="form-select"
                      value={newDevice.vendor_driver}
                      onChange={(e) => setNewDevice({ ...newDevice, vendor_driver: e.target.value })}
                    >
                      <option value="zte_c320">ZTE OLT C300/C320 (SNMP)</option>
                      <option value="mikrotik_ros">MikroTik RouterOS (ROS API)</option>
                      <option value="generic_snmp">Generic SNMP v2c</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Alamat IP Perangkat</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Contoh: 192.168.10.1"
                      value={newDevice.ip_address}
                      onChange={(e) => setNewDevice({ ...newDevice, ip_address: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Port</label>
                    <input
                      type="number"
                      className="form-input"
                      value={newDevice.vendor_driver === 'mikrotik_ros' ? newDevice.api_port : newDevice.snmp_port}
                      onChange={(e) => {
                        if (newDevice.vendor_driver === 'mikrotik_ros') {
                          setNewDevice({ ...newDevice, api_port: e.target.value });
                        } else {
                          setNewDevice({ ...newDevice, snmp_port: e.target.value });
                        }
                      }}
                      required
                    />
                  </div>
                </div>

                {newDevice.vendor_driver === 'mikrotik_ros' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="form-group">
                      <label className="form-label">Username API</label>
                      <input
                        type="text"
                        className="form-input"
                        value={newDevice.username}
                        onChange={(e) => setNewDevice({ ...newDevice, username: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Password API</label>
                      <input
                        type="password"
                        className="form-input"
                        value={newDevice.password}
                        onChange={(e) => setNewDevice({ ...newDevice, password: e.target.value })}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="form-group">
                    <label className="form-label">SNMP Community (v2c)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Contoh: public"
                      value={newDevice.snmp_community}
                      onChange={(e) => setNewDevice({ ...newDevice, snmp_community: e.target.value })}
                    />
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddDeviceModal(false)}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary">
                  Simpan Perangkat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
