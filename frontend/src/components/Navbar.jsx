import React from 'react';

export default function Navbar({ user, onOpenAddNode, onOpenLogin, onLogout }) {
  return (
    <header className="navbar">
      <div className="brand">
        <span style={{ fontSize: '20px' }}>🌐</span>
        <span>NMS-GIS ISP</span>
        <span className="brand-badge">React SPA</span>
      </div>

      <div className="nav-actions">
        {user ? (
          <>
            <span className="brand-badge" style={{ backgroundColor: '#334155' }}>
              {user.name} ({user.role?.toUpperCase()})
            </span>
            <button className="btn btn-primary btn-sm" onClick={onOpenAddNode}>
              ➕ Tambah Titik GIS
            </button>
            <button className="btn btn-secondary btn-sm" onClick={onLogout}>
              Keluar
            </button>
          </>
        ) : (
          <button className="btn btn-secondary btn-sm" onClick={onOpenLogin}>
            Masuk
          </button>
        )}
      </div>
    </header>
  );
}
