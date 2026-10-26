import React, { useState, useEffect } from 'react';
import { IconPlus, IconRefresh, IconMenu } from './Icons';

export default function Topbar({
  currentView,
  onOpenAddNode,
  onRefresh,
  onLogout,
  onOpenLogin,
  user,
  faultCount = 0,
  onToggleSidebarMobile
}) {
  const [timeStr, setTimeStr] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const options = {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      };
      const dateOptions = {
        timeZone: 'Asia/Jakarta',
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      };
      const time = new Intl.DateTimeFormat('id-ID', options).format(now);
      const date = new Intl.DateTimeFormat('id-ID', dateOptions).format(now);
      setTimeStr(`${date} - ${time} WIB`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const viewTitles = {
    dashboard: {
      title: 'Dashboard Utama',
      subtitle: 'Network Operations Center (NOC) Executive Overview'
    },
    map: {
      title: 'Peta Topologi GIS',
      subtitle: 'Visualisasi Geospasial Infrastruktur Serat Optik & Drop Pelanggan'
    },
    faults: {
      title: 'Pusat Gangguan & Alarm',
      subtitle: 'Analisis Root-Cause Putus Kabel (Drop, Distribusi, Feeder Backbone)'
    },
    inventory: {
      title: 'Inventaris Titik & Kabel',
      subtitle: 'Katalog Transmisi Jaringan (POP, ODC, Joint Box, ODP, Drop Core)'
    },
    devices: {
      title: 'Perangkat OLT & Router',
      subtitle: 'Monitoring & Uji Komunikasi Multi-Vendor (ZTE C320, MikroTik ROS, SNMP)'
    },
    logs: {
      title: 'Log Telemetri & Pemeliharaan',
      subtitle: 'Riwayat Audit Monitoring, Polling Berkala, & Manajemen Retensi Data'
    },
    settings: {
      title: 'Pengaturan & Ekstensi Modul',
      subtitle: 'Konfigurasi Ambang Batas dBm & Direktori Ekstensi Fitur Mendatang'
    }
  };

  const currentInfo = viewTitles[currentView] || {
    title: 'NMS-GIS ISP Suite',
    subtitle: 'Sistem Pemetaan & Manajemen Jaringan Fiber Optik'
  };

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          type="button"
          className="topbar-mobile-btn"
          onClick={onToggleSidebarMobile}
          title="Buka Menu"
        >
          <IconMenu size={18} />
        </button>

        <div className="topbar-title-block">
          <div className="topbar-heading-row">
            <h1 className="topbar-heading">{currentInfo.title}</h1>
            <span className="topbar-badge-noc">NOC LIVE</span>
          </div>
          <span className="topbar-subheading">{currentInfo.subtitle}</span>
        </div>
      </div>

      <div className="topbar-right">
        {/* Live Digital Clock */}
        <div className="topbar-clock-box">
          <span className="clock-label">WAKTU OPERASIONAL</span>
          <span className="clock-value">{timeStr || 'Memuat waktu...'}</span>
        </div>

        {/* Global Action Buttons */}
        {user ? (
          <div className="topbar-actions-group">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onRefresh}
              title="Perbarui data jaringan live"
            >
              <IconRefresh size={14} />
              <span>Segarkan</span>
            </button>

            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={onOpenAddNode}
              title="Tambah Titik Infrastruktur Baru dengan Preview Map"
            >
              <IconPlus size={14} />
              <span>Tambah Titik GIS</span>
            </button>

            <div className="topbar-divider" />

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onLogout}
              title="Keluar dari sesi operator"
            >
              <span>Keluar</span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onOpenLogin}
          >
            <span>Masuk Sistem</span>
          </button>
        )}
      </div>
    </header>
  );
}
