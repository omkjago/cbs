import React from 'react';

export default function Navbar({
  user,
  activeTab = 'map',
  onSelectTab,
  onOpenAddNode,
  onOpenLogin,
  onLogout
}) {
  return (
    <header className="navbar">
      <div className="navbar-left">
        <div className="brand" onClick={() => onSelectTab && onSelectTab('map')} style={{ cursor: 'pointer' }}>
          <div className="brand-logo-badge">NMS</div>
          <div className="brand-text-block">
            <span className="brand-name">NMS-GIS FIBER OPTIC</span>
            <span className="brand-sub">Sistem Pemetaan & Monitoring Jaringan ISP</span>
          </div>
        </div>

        {/* View Switcher Tabs */}
        {user && (
          <nav className="nav-tabs-group">
            <button
              type="button"
              className={`nav-tab-button ${activeTab === 'map' ? 'nav-tab-active' : ''}`}
              onClick={() => onSelectTab && onSelectTab('map')}
            >
              Peta Jaringan
            </button>
            <button
              type="button"
              className={`nav-tab-button ${activeTab === 'dashboard' ? 'nav-tab-active' : ''}`}
              onClick={() => onSelectTab && onSelectTab('dashboard')}
            >
              Dashboard Monitoring
            </button>
          </nav>
        )}
      </div>

      <div className="nav-actions">
        {user ? (
          <>
            <button type="button" className="btn btn-primary btn-sm" onClick={onOpenAddNode}>
              Tambah Titik GIS
            </button>
            <div className="user-profile-badge">
              <span className="user-role-tag">{user.role?.toUpperCase() || 'OPERATOR'}</span>
              <span className="user-name-text">{user.name}</span>
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onLogout}>
              Keluar
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-primary btn-sm" onClick={onOpenLogin}>
            Masuk Sistem
          </button>
        )}
      </div>
    </header>
  );
}
