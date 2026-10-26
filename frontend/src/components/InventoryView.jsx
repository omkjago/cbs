import React, { useState } from 'react';
import { IconSearch, IconPlus, IconMap, IconTrash, IconRefresh } from './Icons';

export default function InventoryView({
  nodes = [],
  onOpenAddNode,
  onFocusNode,
  onLiveOpm,
  onDeleteNode,
  onRefresh,
  onToast
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Filter nodes
  const filteredNodes = nodes.filter((node) => {
    if (typeFilter !== 'ALL' && node.node_type !== typeFilter) return false;
    if (statusFilter !== 'ALL' && node.status !== statusFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = (node.node_name || '').toLowerCase().includes(q);
      const matchCode = (node.node_code || '').toLowerCase().includes(q);
      const matchAddr = (node.address_note || '').toLowerCase().includes(q);
      if (!matchName && !matchCode && !matchAddr) return false;
    }

    return true;
  });

  const handleDelete = (node) => {
    const confirmDelete = window.confirm(`Hapus titik ${node.node_code} (${node.node_name})?`);
    if (confirmDelete && onDeleteNode) {
      onDeleteNode(node.id);
    }
  };

  return (
    <div className="inventory-view-layout">
      {/* View Header */}
      <div className="view-header-bar">
        <div>
          <h2 className="view-title">Infrastruktur Kabel &amp; Titik Jaringan</h2>
          <p className="view-subtitle">
            Katalog lengkap transmisi pasif dan aktif: Point of Presence (POP), Optical Distribution Cabinet (ODC), Joint Box (JB), Optical Distribution Point (ODP), dan Pelanggan.
          </p>
        </div>
        <div className="view-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onRefresh}>
            <IconRefresh size={14} />
            <span>Segarkan</span>
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={onOpenAddNode}>
            <IconPlus size={14} />
            <span>+ Tambah Titik GIS</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="inventory-filter-bar">
        <div className="search-input-box">
          <IconSearch size={14} color="#94a3b8" />
          <input
            type="text"
            className="clean-search-input"
            placeholder="Cari berdasarkan nama, kode node, atau catatan alamat..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filter-dropdowns-group">
          <select
            className="form-select filter-select"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="ALL">Semua Tipe Node</option>
            <option value="POP">POP (Core / Server)</option>
            <option value="ODC">ODC (Distribution Cabinet)</option>
            <option value="JB">JB (Joint Box Closure)</option>
            <option value="ODP">ODP (Distribution Point)</option>
            <option value="CUSTOMER">Drop Pelanggan</option>
          </select>

          <select
            className="form-select filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">Semua Status Transmisi</option>
            <option value="ONLINE">ONLINE (Normal)</option>
            <option value="WARNING_DBM">WARNING (Redaman Tinggi)</option>
            <option value="LOS">LOS (Loss of Signal / Putus)</option>
            <option value="DYING_GASP">DYING GASP (Power Off)</option>
            <option value="OFFLINE">OFFLINE</option>
          </select>
        </div>
      </div>

      {/* Stats counter bar */}
      <div className="inventory-counter-strip">
        <span className="counter-item">
          Total Hasil: <strong>{filteredNodes.length}</strong> dari {nodes.length} Titik
        </span>
      </div>

      {/* Data Table */}
      <div className="table-responsive">
        <table className="enterprise-table">
          <thead>
            <tr>
              <th>Tipe</th>
              <th>Kode Node</th>
              <th>Nama Titik Infrastruktur</th>
              <th>Koordinat Latitude, Longitude</th>
              <th>Daya Sinyal (OPM)</th>
              <th>Status Transmisi</th>
              <th>Catatan Alamat / Penanda</th>
              <th>Tindakan Operasional</th>
            </tr>
          </thead>
          <tbody>
            {filteredNodes.length === 0 ? (
              <tr>
                <td colSpan="8" className="empty-table-cell">
                  {nodes.length === 0
                    ? 'Belum ada data titik infrastruktur di database. Klik "+ Tambah Titik GIS" untuk memulai.'
                    : 'Tidak ada data yang sesuai dengan kriteria pencarian dan filter.'}
                </td>
              </tr>
            ) : (
              filteredNodes.map((node) => {
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
                          title="Uji bacaan OPM live dari perangkat"
                        >
                          <span>Periksa OPM</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => onFocusNode(node.latitude, node.longitude)}
                          title="Fokuskan titik di Peta GIS"
                        >
                          <IconMap size={12} />
                          <span>Peta</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger-outline btn-sm"
                          onClick={() => handleDelete(node)}
                          title="Hapus titik dari inventaris"
                        >
                          <IconTrash size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
