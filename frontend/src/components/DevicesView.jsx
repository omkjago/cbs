import React, { useState, useEffect } from 'react';
import { Api } from '../services/api';
import { IconDevices, IconPlus, IconRefresh, IconTrash } from './Icons';

export default function DevicesView({ onToast }) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [testingId, setTestingId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
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

  const loadDevices = async () => {
    setLoading(true);
    try {
      const res = await Api.getDevices();
      setDevices(res.data || []);
    } catch (err) {
      if (onToast) onToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
  }, []);

  const handleTestDevice = async (id, name) => {
    setTestingId(id);
    try {
      const res = await Api.testDevice(id);
      if (onToast) {
        onToast(`[${name}] ${res.message} (Latensi: ${res.data?.latency_ms || 0}ms)`, 'success');
      }
      loadDevices();
    } catch (err) {
      if (onToast) onToast(`[${name}] Gagal terhubung: ${err.message}`, 'error');
    } finally {
      setTestingId(null);
    }
  };

  const handleDeleteDevice = async (id, name) => {
    const confirmDelete = window.confirm(`Hapus konfigurasi perangkat ${name}?`);
    if (!confirmDelete) return;

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
      await Api.createDevice(newDevice);
      if (onToast) onToast(`Perangkat ${newDevice.device_name} berhasil didaftarkan.`, 'success');
      setShowAddModal(false);
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

  return (
    <div className="devices-view-layout">
      {/* Header */}
      <div className="view-header-bar">
        <div>
          <h2 className="view-title">Manajemen Perangkat Keras OLT &amp; Router</h2>
          <p className="view-subtitle">
            Integrasi multi-vendor transmisi aktif melalui socket driver biner RouterOS API, Telnet/CLI OLT ZTE C320, dan Generic SNMP UDP Socket.
          </p>
        </div>
        <div className="view-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={loadDevices}>
            <IconRefresh size={14} />
            <span>Segarkan</span>
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>
            <IconPlus size={14} />
            <span>Daftarkan Perangkat Baru</span>
          </button>
        </div>
      </div>

      {/* Device List Table / Cards */}
      {loading ? (
        <div className="loading-state-card">Memeriksa status perangkat...</div>
      ) : devices.length === 0 ? (
        <div className="enterprise-card empty-state-card">
          <div className="empty-title">Belum Ada Perangkat Jaringan Terdaftar</div>
          <p className="empty-desc">
            Daftarkan perangkat OLT ZTE C320 atau MikroTik CCR/RB Anda untuk mengaktifkan telemetri sinyal optik (OPM dBm) dan polling berkala otomatis.
          </p>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setShowAddModal(true)}
            style={{ marginTop: '14px' }}
          >
            <span>+ Daftarkan OLT / Router Pertama</span>
          </button>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="enterprise-table">
            <thead>
              <tr>
                <th>Status Koneksi</th>
                <th>Nama Perangkat</th>
                <th>Tipe</th>
                <th>Vendor Driver</th>
                <th>Alamat IP &amp; Port</th>
                <th>Kredensial</th>
                <th>Terakhir Dipolling</th>
                <th>Tindakan</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((device) => (
                <tr key={device.id}>
                  <td>
                    <span
                      className={`badge ${
                        device.is_active ? 'badge-success' : 'badge-neutral'
                      }`}
                    >
                      {device.is_active ? '[TERHUBUNG]' : '[OFFLINE]'}
                    </span>
                  </td>
                  <td>
                    <strong>{device.device_name}</strong>
                  </td>
                  <td>
                    <span className="node-type-badge">{device.device_type?.toUpperCase()}</span>
                  </td>
                  <td className="font-mono text-cyan">{device.vendor_driver}</td>
                  <td className="font-mono text-muted">
                    {device.ip_address} (API: {device.api_port || '-'} | SNMP: {device.snmp_port || '-'})
                  </td>
                  <td className="font-mono">
                    {device.username ? `User: ${device.username}` : `Comm: ${device.snmp_community || 'public'}`}
                  </td>
                  <td className="font-mono text-muted">{device.last_polled_at || 'Belum pernah'}</td>
                  <td>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleTestDevice(device.id, device.device_name)}
                        disabled={testingId === device.id}
                      >
                        {testingId === device.id ? 'Menguji...' : 'Uji Koneksi'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger-outline btn-sm"
                        onClick={() => handleDeleteDevice(device.id, device.device_name)}
                        title="Hapus perangkat"
                      >
                        <IconTrash size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Tambah Perangkat */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <span className="modal-title-text">Daftarkan Perangkat Jaringan Baru</span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowAddModal(false)}
              >
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
                    placeholder="Contoh: OLT-CORE-ZTE-01"
                    value={newDevice.device_name}
                    onChange={(e) => setNewDevice({ ...newDevice, device_name: e.target.value })}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="form-group">
                    <label className="form-label">Tipe Perangkat</label>
                    <select
                      className="form-select"
                      value={newDevice.device_type}
                      onChange={(e) => setNewDevice({ ...newDevice, device_type: e.target.value })}
                    >
                      <option value="olt">OLT (Optical Line Terminal)</option>
                      <option value="router">Router Core / Aggregation</option>
                      <option value="switch">Switch Distribusi / L2/L3</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Vendor Driver</label>
                    <select
                      className="form-select"
                      value={newDevice.vendor_driver}
                      onChange={(e) => setNewDevice({ ...newDevice, vendor_driver: e.target.value })}
                    >
                      <option value="zte_c320">ZTE C320 (Socket Telnet)</option>
                      <option value="mikrotik_ros">MikroTik RouterOS (ROS API)</option>
                      <option value="generic_snmp">Generic SNMP (UDP 161)</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Alamat IP Perangkat</label>
                  <input
                    type="text"
                    className="form-input font-mono"
                    placeholder="Contoh: 10.10.1.254"
                    value={newDevice.ip_address}
                    onChange={(e) => setNewDevice({ ...newDevice, ip_address: e.target.value })}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="form-group">
                    <label className="form-label">API Port</label>
                    <input
                      type="number"
                      className="form-input font-mono"
                      value={newDevice.api_port}
                      onChange={(e) => setNewDevice({ ...newDevice, api_port: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">SNMP Port</label>
                    <input
                      type="number"
                      className="form-input font-mono"
                      value={newDevice.snmp_port}
                      onChange={(e) => setNewDevice({ ...newDevice, snmp_port: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="form-group">
                    <label className="form-label">Username</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Username perangkat"
                      value={newDevice.username}
                      onChange={(e) => setNewDevice({ ...newDevice, username: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Password</label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="Password terenkripsi AES-256"
                      value={newDevice.password}
                      onChange={(e) => setNewDevice({ ...newDevice, password: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">SNMP Community</label>
                  <input
                    type="text"
                    className="form-input font-mono"
                    placeholder="public"
                    value={newDevice.snmp_community}
                    onChange={(e) => setNewDevice({ ...newDevice, snmp_community: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowAddModal(false)}
                >
                  Batal
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
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
