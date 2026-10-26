import React from 'react';
import {
  IconDashboard,
  IconMap,
  IconAlert,
  IconInventory,
  IconDevices,
  IconActivity,
  IconSettings,
  IconChevronRight
} from './Icons';

export default function Sidebar({
  currentView = 'dashboard',
  onSelectView,
  user,
  nodeCount = 0,
  faultCount = 0,
  isCollapsed = false,
  onToggleCollapse
}) {
  const navSections = [
    {
      label: 'OPERASIONAL NOC',
      items: [
        {
          id: 'dashboard',
          label: 'Dashboard Utama',
          desc: 'Ringkasan Eksekutif & Status NOC',
          icon: <IconDashboard size={18} />
        },
        {
          id: 'map',
          label: 'Peta Jaringan GIS',
          desc: 'Topologi Spasial & Rute Transmisi',
          icon: <IconMap size={18} />,
          badge: nodeCount > 0 ? `${nodeCount} Titik` : null,
          badgeType: 'neutral'
        },
        {
          id: 'faults',
          label: 'Pusat Gangguan & Alarm',
          desc: 'Deteksi Putus Kabel & Isolasi Root Cause',
          icon: <IconAlert size={18} />,
          badge: faultCount > 0 ? `${faultCount} Putus` : null,
          badgeType: 'danger'
        }
      ]
    },
    {
      label: 'INVENTARIS & PERANGKAT',
      items: [
        {
          id: 'inventory',
          label: 'Infrastruktur Kabel & Titik',
          desc: 'Manajemen POP, ODC, JB, ODP, Pelanggan',
          icon: <IconInventory size={18} />
        },
        {
          id: 'devices',
          label: 'Perangkat OLT & Router',
          desc: 'Integrasi Multi-Vendor (ZTE, MikroTik)',
          icon: <IconDevices size={18} />
        }
      ]
    },
    {
      label: 'SISTEM & EKSTENSI',
      items: [
        {
          id: 'logs',
          label: 'Log Pemantauan & Audit',
          desc: 'Riwayat Telemetri & Retensi Otomatis',
          icon: <IconActivity size={18} />
        },
        {
          id: 'settings',
          label: 'Pengaturan & Ekstensi',
          desc: 'Ambang Batas dBm & Fitur Mendatang',
          icon: <IconSettings size={18} />
        }
      ]
    }
  ];

  return (
    <aside className={`app-sidebar ${isCollapsed ? 'app-sidebar-collapsed' : ''}`}>
      {/* Brand Header */}
      <div className="sidebar-brand-box">
        <div className="sidebar-brand-badge">NMS</div>
        {!isCollapsed && (
          <div className="sidebar-brand-text">
            <span className="sidebar-brand-title">NMS-GIS ENTERPRISE</span>
            <span className="sidebar-brand-subtitle">ISP Infrastructure & NOC Suite</span>
          </div>
        )}
      </div>

      {/* System Status Pill */}
      {!isCollapsed && (
        <div className="sidebar-status-banner">
          <div className={`status-dot ${faultCount > 0 ? 'status-dot-danger' : 'status-dot-success'}`} />
          <span className="status-banner-text">
            {faultCount > 0 ? `PERINGATAN: ${faultCount} SEGMEN PUTUS` : 'SISTEM NORMAL & OPTIMAL'}
          </span>
        </div>
      )}

      {/* Navigation Groups */}
      <nav className="sidebar-nav-scroll">
        {navSections.map((section, idx) => (
          <div key={idx} className="sidebar-nav-group">
            {!isCollapsed && <div className="sidebar-nav-header">{section.label}</div>}
            <div className="sidebar-nav-items">
              {section.items.map((item) => {
                const isActive = currentView === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`sidebar-nav-link ${isActive ? 'active' : ''}`}
                    onClick={() => onSelectView(item.id)}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <span className="sidebar-nav-icon">{item.icon}</span>
                    {!isCollapsed && (
                      <div className="sidebar-nav-info">
                        <span className="sidebar-nav-label">{item.label}</span>
                        <span className="sidebar-nav-desc">{item.desc}</span>
                      </div>
                    )}
                    {!isCollapsed && item.badge && (
                      <span className={`sidebar-nav-badge badge-${item.badgeType}`}>
                        {item.badge}
                      </span>
                    )}
                    {!isCollapsed && isActive && (
                      <span className="sidebar-nav-arrow">
                        <IconChevronRight size={12} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Sidebar Footer with User Role and Version */}
      <div className="sidebar-footer">
        {!isCollapsed && user && (
          <div className="sidebar-user-block">
            <div className="user-avatar-badge">
              {user.name ? user.name.slice(0, 2).toUpperCase() : 'OP'}
            </div>
            <div className="user-details">
              <span className="user-name">{user.name}</span>
              <span className="user-role-pill">{user.role?.toUpperCase() || 'OPERATOR'}</span>
            </div>
          </div>
        )}
        <div className="sidebar-collapse-bar">
          {!isCollapsed && <span className="version-tag">BUILD v2.4-PRO</span>}
          <button
            type="button"
            className="sidebar-toggle-btn"
            onClick={onToggleCollapse}
            title={isCollapsed ? 'Perluas Menu Sidebar' : 'Ciutkan Menu Sidebar'}
          >
            {isCollapsed ? '>' : '<'}
          </button>
        </div>
      </div>
    </aside>
  );
}
