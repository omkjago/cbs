import React, { useState, useEffect } from 'react';
import { Api } from '../services/api';
import { IconActivity, IconRefresh, IconTrash } from './Icons';

export default function LogsView({ onToast }) {
  const [logStats, setLogStats] = useState(null);
  const [recentLogs, setRecentLogs] = useState([]);
  const [retentionDays, setRetentionDays] = useState(7);
  const [loading, setLoading] = useState(false);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await Api.getTempLogs();
      if (res.data) {
        setLogStats(res.data.stats || null);
        setRecentLogs(res.data.recent_logs || []);
        if (res.data.retention_days) {
          setRetentionDays(res.data.retention_days);
        }
      }
    } catch (err) {
      if (onToast) onToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const handleUpdateRetention = async () => {
    try {
      const res = await Api.updateLogRetention(retentionDays);
      if (onToast) onToast(res.message, 'success');
      loadLogs();
    } catch (err) {
      if (onToast) onToast(err.message, 'error');
    }
  };

  const handlePurgeLogs = async () => {
    const confirmPurge = window.confirm(
      'Apakah Anda yakin ingin menghapus seluruh log telemetri sementara? Tindakan ini tidak dapat dibatalkan.'
    );
    if (!confirmPurge) return;

    try {
      const res = await Api.purgeTempLogs();
      if (onToast) onToast(res.message, 'success');
      loadLogs();
    } catch (err) {
      if (onToast) onToast(err.message, 'error');
    }
  };

  return (
    <div className="logs-view-layout">
      {/* Header */}
      <div className="view-header-bar">
        <div>
          <h2 className="view-title">Log Pemantauan &amp; Telemetri Jaringan</h2>
          <p className="view-subtitle">
            Penyimpanan time-series pembacaan sinyal OPM dan telemetri sementara dengan kebijakan auto-purge agar database hosting tetap ramping dan kencang.
          </p>
        </div>
        <div className="view-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={loadLogs}>
            <IconRefresh size={14} />
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      {/* Retention and Storage Cards */}
      <div className="log-cards-grid">
        <div className="enterprise-card">
          <div className="card-header-row">
            <div className="card-title-group">
              <span className="card-section-tag">KEBIJAKAN RETENSI</span>
              <h3 className="card-title">Masa Simpan Data Log Sementara</h3>
            </div>
          </div>
          <p className="card-subtext">
            Log pemantauan yang berusia melebihi batas hari akan dipangkas otomatis setiap siklus polling background dijalankan.
          </p>

          <div className="retention-control-row">
            <select
              className="form-select"
              value={retentionDays}
              onChange={(e) => setRetentionDays(parseInt(e.target.value, 10))}
              style={{ width: '220px' }}
            >
              <option value="1">Simpan 1 Hari (Optimal)</option>
              <option value="3">Simpan 3 Hari</option>
              <option value="7">Simpan 7 Hari (Direkomendasikan)</option>
              <option value="14">Simpan 14 Hari</option>
              <option value="30">Simpan 30 Hari</option>
            </select>
            <button type="button" className="btn btn-primary btn-sm" onClick={handleUpdateRetention}>
              <span>Terapkan Kebijakan</span>
            </button>
          </div>
        </div>

        <div className="enterprise-card">
          <div className="card-header-row">
            <div className="card-title-group">
              <span className="card-section-tag">KAPASITAS DATABASE</span>
              <h3 className="card-title">Metrik Pemakaian Disk Log</h3>
            </div>
          </div>

          <div className="stat-metric-row">
            <span className="stat-mini-label">Total Baris Log:</span>
            <span className="stat-mini-value font-mono">{logStats?.total_rows ?? 0} Rekaman</span>
          </div>
          <div className="stat-metric-row">
            <span className="stat-mini-label">Estimasi Ukuran Tabel:</span>
            <span className="stat-mini-value font-mono">{logStats?.size_mb ?? 0} MB</span>
          </div>
          <div className="stat-metric-row">
            <span className="stat-mini-label">Log Terlama:</span>
            <span className="stat-mini-value font-mono text-muted">{logStats?.oldest_log ?? '-'}</span>
          </div>

          <div style={{ marginTop: '14px' }}>
            <button type="button" className="btn btn-danger-outline btn-sm" onClick={handlePurgeLogs}>
              <IconTrash size={12} />
              <span>Hapus Bersih Seluruh Log Sekarang</span>
            </button>
          </div>
        </div>
      </div>

      {/* Telemetry Log Entries Table */}
      <div className="enterprise-card" style={{ marginTop: '20px' }}>
        <div className="card-header-row">
          <div className="card-title-group">
            <span className="card-section-tag">AUDIT REAL-TIME</span>
            <h3 className="card-title">Riwayat Pembacaan Sinyal OPM Terbaru</h3>
          </div>
        </div>

        {recentLogs.length === 0 ? (
          <div className="empty-state-card">
            <div className="empty-title">Belum Ada Rekaman Log</div>
            <p className="empty-desc">
              Log akan otomatis terisi saat pengujian OPM langsung dijalankan atau worker poller mengeksekusi siklus pemeriksaan.
            </p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Waktu Pengukuran</th>
                  <th>Kode Node</th>
                  <th>Daya Sinyal (Rx dBm)</th>
                  <th>Status Transmisi</th>
                  <th>Metode Polling</th>
                  <th>Detail Hasil Ukur</th>
                </tr>
              </thead>
              <tbody>
                {recentLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="font-mono text-muted">{log.created_at}</td>
                    <td className="font-mono text-cyan">{log.node_code || '-'}</td>
                    <td className="font-mono">
                      <strong>{log.rx_power_dbm !== null ? `${log.rx_power_dbm} dBm` : '-'}</strong>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          log.status === 'ONLINE'
                            ? 'badge-success'
                            : log.status === 'WARNING_DBM'
                            ? 'badge-warning'
                            : log.status === 'LOS'
                            ? 'badge-danger'
                            : 'badge-neutral'
                        }`}
                      >
                        [{log.status}]
                      </span>
                    </td>
                    <td>
                      <span className="node-type-badge">{log.poll_type?.toUpperCase() || 'SNMP'}</span>
                    </td>
                    <td className="font-mono text-muted" style={{ fontSize: '11px' }}>
                      {log.raw_payload ? JSON.stringify(log.raw_payload).slice(0, 50) + '...' : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
