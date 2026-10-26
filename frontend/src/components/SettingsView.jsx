import React, { useState } from 'react';
import { IconSettings, IconAlert } from './Icons';

export default function SettingsView({ onToast }) {
  const [warningThreshold, setWarningThreshold] = useState('-25.00');
  const [criticalThreshold, setCriticalThreshold] = useState('-28.00');
  const [pollerInterval, setPollerInterval] = useState('2');

  const handleSaveThresholds = (e) => {
    e.preventDefault();
    if (onToast) {
      onToast('Parameter ambang batas operasional berhasil diperbarui.', 'success');
    }
  };

  const extensionModules = [
    {
      id: 'billing_radius',
      title: 'Integrasi Billing & Otomasi Isolir (Radius / MikroTik)',
      desc: 'Sinkronisasi status tagihan pelanggan, manajemen profil PPPoE / Static IP, serta penandaan status isolir langsung pada ikon node GIS pelanggan di peta.',
      badge: '[ARSITEKTUR SIAP INTEGRASI]',
      badgeType: 'success',
      specs: 'Protokol: Radius CoA / MikroTik API (Port 8728) | Status Sinkronisasi: Siap Dipasang'
    },
    {
      id: 'wa_telegram_alert',
      title: 'Gateway Alarm NOC (WhatsApp & Telegram Bot)',
      desc: 'Pengiriman pesan instan otomatis kepada tim teknisi lapangan saat terdeteksi insiden putus kabel (Backbone Feeder atau Distribusi ODP) lengkap dengan koordinat Google Maps.',
      badge: '[ARSITEKTUR SIAP INTEGRASI]',
      badgeType: 'success',
      specs: 'Engine: Webhook / REST API Bot | Event Trigger: FaultAnalyzerService Alert'
    },
    {
      id: 'otdr_distance_trace',
      title: 'Estimasi Jarak Putus Transmisi (Virtual OTDR Trace)',
      desc: 'Perhitungan perkiraan jarak fisik putus kabel (dalam meter/kilometer) dari ODC atau POP terdekat menggunakan pemetaan titik koordinat segmen kabel dan redaman refleksi.',
      badge: '[ARSITEKTUR SIAP INTEGRASI]',
      badgeType: 'success',
      specs: 'Kalkulasi: Haversine Waypoints Cumulative Distance | Toleransi Sinyal: 0.35 dB/km'
    },
    {
      id: 'trouble_ticket',
      title: 'Manajemen Tiket Gangguan & Aplikasi Lapangan',
      desc: 'Alur kerja pembuatan tiket komplain pelanggan, penugasan teknisi lapangan, bukti foto perbaikan sambungan serat optik (splicing core), dan pelaporan penutupan tiket.',
      badge: '[ARSITEKTUR SIAP INTEGRASI]',
      badgeType: 'neutral',
      specs: 'Alur Kerja: Open -> Dispatched -> Spliced -> Resolved -> Closed'
    },
    {
      id: 'multi_tenant_area',
      title: 'Multi-Distrik & Manajemen Wilayah Kerja',
      desc: 'Pembagian hierarki wilayah operasional (Distrik / Cluster / Wilayah Kota) dengan pembatasan hak akses teknisi berdasarkan zona infrastruktur geografis.',
      badge: '[ARSITEKTUR SIAP INTEGRASI]',
      badgeType: 'neutral',
      specs: 'Struktur: Role-Based Access Control (RBAC) + Geo-Fencing Regional Area'
    }
  ];

  return (
    <div className="settings-view-layout">
      {/* Header */}
      <div className="view-header-bar">
        <div>
          <h2 className="view-title">Pengaturan Sistem &amp; Ekstensi Modul</h2>
          <p className="view-subtitle">
            Konfigurasi ambang batas parameter transmisi optik dan pusat modul tambahan yang dirancang secara modular untuk ekspansi fitur sistem ke depan.
          </p>
        </div>
      </div>

      {/* Threshold Configuration */}
      <div className="enterprise-card">
        <div className="card-header-row">
          <div className="card-title-group">
            <span className="card-section-tag">TELEMETRI &amp; AMBANG BATAS</span>
            <h3 className="card-title">Parameter Peringatan Redaman Optik (OPM dBm)</h3>
          </div>
        </div>

        <form onSubmit={handleSaveThresholds} style={{ maxWidth: '640px', marginTop: '10px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Ambang Peringatan (Warning dBm)</label>
              <input
                type="text"
                className="form-input font-mono"
                value={warningThreshold}
                onChange={(e) => setWarningThreshold(e.target.value)}
                required
              />
              <span className="form-helper-text">Nilai daya sinyal di bawah batas ini akan diberi label [PERINGATAN].</span>
            </div>

            <div className="form-group">
              <label className="form-label">Ambang Kritis / Putus (Critical dBm)</label>
              <input
                type="text"
                className="form-input font-mono"
                value={criticalThreshold}
                onChange={(e) => setCriticalThreshold(e.target.value)}
                required
              />
              <span className="form-helper-text">Nilai daya sinyal di bawah batas ini dianggap [LOS / PUTUS].</span>
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '14px' }}>
            <label className="form-label">Interval Siklus Background Poller</label>
            <select
              className="form-select"
              value={pollerInterval}
              onChange={(e) => setPollerInterval(e.target.value)}
              style={{ maxWidth: '280px' }}
            >
              <option value="1">Setiap 1 Menit (Intensitas Tinggi)</option>
              <option value="2">Setiap 2 Menit (Standar Produksi)</option>
              <option value="5">Setiap 5 Menit</option>
              <option value="10">Setiap 10 Menit</option>
            </select>
          </div>

          <div style={{ marginTop: '18px' }}>
            <button type="submit" className="btn btn-primary btn-sm">
              <span>Simpan Parameter</span>
            </button>
          </div>
        </form>
      </div>

      {/* Future Extensions Hub */}
      <div className="enterprise-card" style={{ marginTop: '24px' }}>
        <div className="card-header-row">
          <div className="card-title-group">
            <span className="card-section-tag">ROADMAP MODUL</span>
            <h3 className="card-title">Direktori Ekstensi Fitur Mendatang</h3>
          </div>
        </div>
        <p className="card-subtext" style={{ marginBottom: '18px' }}>
          Arsitektur aplikasi telah dirancang secara modular dan *loose-coupling*. Anda dapat menghubungkan fitur baru berikut tanpa merombak arsitektur basis data atau modul GIS yang sudah berjalan.
        </p>

        <div className="extensions-cards-grid">
          {extensionModules.map((mod) => (
            <div key={mod.id} className="extension-card">
              <div className="extension-header">
                <h4 className="extension-title">{mod.title}</h4>
                <span className={`badge badge-${mod.badgeType}`}>{mod.badge}</span>
              </div>
              <p className="extension-desc">{mod.desc}</p>
              <div className="extension-specs font-mono">{mod.specs}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
