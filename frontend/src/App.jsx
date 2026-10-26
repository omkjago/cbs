import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import NocDashboard from './components/NocDashboard';
import FaultCenter from './components/FaultCenter';
import InventoryView from './components/InventoryView';
import DevicesView from './components/DevicesView';
import LogsView from './components/LogsView';
import SettingsView from './components/SettingsView';
import GisMap from './components/GisMap';
import LayerFilter from './components/LayerFilter';
import KpiCards from './components/KpiCards';
import FaultAlertBanner from './components/FaultAlertBanner';
import AddNodeModal from './components/AddNodeModal';
import LoginModal from './components/LoginModal';
import { IconInventory } from './components/Icons';
import { Api } from './services/api';

export default function App() {
  const [user, setUser] = useState(Api.getUser());
  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard' | 'map' | 'faults' | 'inventory' | 'devices' | 'logs' | 'settings'
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isMapFilterOpen, setIsMapFilterOpen] = useState(true);

  const [mapData, setMapData] = useState({ nodes: [], cables: [], summary: {}, suspected_fiber_cuts: [] });
  const [filters, setFilters] = useState({
    POP: true,
    ODC: true,
    JB: true,
    ODP: true,
    CUSTOMER_NORMAL: true,
    CUSTOMER_FAULT: true
  });

  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isAddNodeOpen, setIsAddNodeOpen] = useState(false);
  const [coords, setCoords] = useState({ lat: -6.991, lng: 110.423 });
  const [inputMethod, setInputMethod] = useState('map_marker');
  const [toast, setToast] = useState(null);
  const [focusCoords, setFocusCoords] = useState(null);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  const loadMapData = async () => {
    if (!Api.getToken()) {
      setIsLoginOpen(true);
      return;
    }
    try {
      const data = await Api.getMapData();
      setMapData(data || { nodes: [], cables: [], summary: {}, suspected_fiber_cuts: [] });
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  useEffect(() => {
    if (user) {
      loadMapData();
    } else {
      setIsLoginOpen(true);
    }

    const onAuthExpired = () => {
      setUser(null);
      setIsLoginOpen(true);
      showToast('Sesi autentikasi telah berakhir. Silakan masuk kembali.', 'error');
    };

    window.addEventListener('auth-expired', onAuthExpired);
    return () => window.removeEventListener('auth-expired', onAuthExpired);
  }, [user]);

  const handleLoginSuccess = async (email, password) => {
    const res = await Api.login(email, password);
    setUser(res.data.user);
    showToast('Autentikasi berhasil. Selamat datang di NMS-GIS Enterprise.', 'success');
    loadMapData();
  };

  const handleLogout = () => {
    Api.clearTokens();
    setUser(null);
    setMapData({ nodes: [], cables: [], summary: {}, suspected_fiber_cuts: [] });
    showToast('Anda telah keluar dari sesi kerja.', 'info');
    setIsLoginOpen(true);
  };

  const handleSelectView = (view) => {
    setCurrentView(view);
    setIsMobileSidebarOpen(false);
    if (view === 'map') {
      setTimeout(() => window.dispatchEvent(new Event('resize')), 150);
    }
  };

  const handleFocusNode = (lat, lng) => {
    setCurrentView('map');
    setFocusCoords({ lat, lng });
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 150);
  };

  const handlePickerMove = (lat, lng, method) => {
    setCoords({ lat: parseFloat(lat).toFixed(7), lng: parseFloat(lng).toFixed(7) });
    setInputMethod(method);
  };

  const handleUseGps = () => {
    if (!navigator.geolocation) {
      showToast('Peramban web tidak mendukung sensor GPS Geolocation.', 'error');
      return;
    }
    showToast('Menghubungi satelit/layanan lokasi GPS...', 'info');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(7);
        const lng = pos.coords.longitude.toFixed(7);
        setCoords({ lat, lng });
        setInputMethod('gps');
        showToast(`Koordinat GPS diterima (Akurasi: ±${Math.round(pos.coords.accuracy)} meter)`, 'success');
      },
      (err) => {
        showToast(`Gagal mendeteksi koordinat GPS: ${err.message}`, 'error');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Live Interactive Node Movement & Immediate Coordinate Sync
  const handleUpdateCoords = async (nodeId, lat, lng, nodeName) => {
    // 1. Optimistically update local node position and connected cables in mapData
    setMapData((prev) => {
      const updatedNodes = (prev.nodes || []).map((n) =>
        n.id === nodeId ? { ...n, latitude: lat, longitude: lng } : n
      );
      const updatedCables = (prev.cables || []).map((c) => {
        if (c.start_node_id === nodeId || c.end_node_id === nodeId) {
          const wps = [...(c.waypoints || [])];
          if (wps.length >= 2) {
            if (c.start_node_id === nodeId) wps[0] = [lat, lng];
            if (c.end_node_id === nodeId) wps[wps.length - 1] = [lat, lng];
          }
          return { ...c, waypoints: wps };
        }
        return c;
      });
      return { ...prev, nodes: updatedNodes, cables: updatedCables };
    });

    // 2. Persist to backend without blocking modal dialog
    try {
      await Api.updateNode(nodeId, { latitude: lat, longitude: lng, input_method: 'map_marker' });
      showToast(`Koordinat ${nodeName} berhasil diperbarui.`, 'success');
    } catch (err) {
      showToast(`Gagal menyimpan koordinat: ${err.message}`, 'error');
      loadMapData();
    }
  };

  const handleLiveOpm = (node) => {
    Api.getLiveOpm(node.id).then((res) => {
      const rx = res.data?.rx_power_dbm !== null ? `${res.data.rx_power_dbm} dBm` : '-';
      showToast(`[OPM] ${node.node_code}: Rx Power = ${rx} (Status: ${res.data?.connection_status})`, 'success');
      loadMapData();
    }).catch((err) => showToast(err.message, 'error'));
  };

  const handleCreateNode = async (nodeData) => {
    const res = await Api.createNode(nodeData);
    showToast(res.message || 'Titik jaringan berhasil ditambahkan.', 'success');
    loadMapData();
  };

  const handleDeleteNode = async (id) => {
    try {
      const res = await Api.deleteNode(id);
      showToast(res.message || 'Titik berhasil dihapus.', 'success');
      loadMapData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const parentCandidates = (mapData.nodes || []).filter((n) => n.node_type !== 'CUSTOMER');
  const faultCount = (mapData.suspected_fiber_cuts || []).length;
  const nodeCount = (mapData.nodes || []).length;

  return (
    <div className="app-shell">
      {/* 1. Collapsible Enterprise Sidebar */}
      <Sidebar
        currentView={currentView}
        onSelectView={handleSelectView}
        user={user}
        nodeCount={nodeCount}
        faultCount={faultCount}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      {/* 2. Main Content Area */}
      <div className="app-main-viewport">
        {/* Top Header Bar */}
        <Topbar
          currentView={currentView}
          onOpenAddNode={() => setIsAddNodeOpen(true)}
          onRefresh={loadMapData}
          onLogout={handleLogout}
          onOpenLogin={() => setIsLoginOpen(true)}
          user={user}
          faultCount={faultCount}
          onToggleSidebarMobile={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
        />

        {/* Dynamic View Router */}
        <div className="app-view-container">
          {/* VIEW: NOC DASHBOARD */}
          {currentView === 'dashboard' && (
            <div className="view-scrollable">
              <NocDashboard
                nodes={mapData.nodes || []}
                cables={mapData.cables || []}
                summary={mapData.summary || {}}
                faults={mapData.suspected_fiber_cuts || []}
                onFocusNode={handleFocusNode}
                onSelectView={handleSelectView}
                onOpenAddNode={() => setIsAddNodeOpen(true)}
                onLiveOpm={handleLiveOpm}
                onToast={showToast}
              />
            </div>
          )}

          {/* VIEW: PETA GIS FULLSCREEN */}
          <div
            className="view-map-fullscreen"
            style={{ display: currentView === 'map' ? 'flex' : 'none' }}
          >
            {/* Reopen Floating Button when panel is collapsed */}
            {!isMapFilterOpen && (
              <button
                type="button"
                className="btn btn-primary btn-sm floating-reopen-panel-btn"
                onClick={() => setIsMapFilterOpen(true)}
                title="Buka Panel Filter Layer"
              >
                <IconInventory size={14} />
                <span>Buka Panel Filter</span>
              </button>
            )}

            <aside className={`floating-map-panel ${!isMapFilterOpen ? 'collapsed' : ''}`}>
              <div className="panel-header">
                <span>Filter Layer &amp; Topologi</span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsMapFilterOpen(false)}
                  title="Sembunyikan Panel"
                >
                  Tutup Panel
                </button>
              </div>

              <div className="panel-body">
                <FaultAlertBanner
                  faults={mapData.suspected_fiber_cuts || []}
                  onFocusNode={(lat, lng) => setFocusCoords({ lat, lng })}
                />

                <KpiCards summary={mapData.summary || {}} />

                <LayerFilter
                  filters={filters}
                  onToggleFilter={(key, val) => setFilters((prev) => ({ ...prev, [key]: val }))}
                />
              </div>
            </aside>

            <GisMap
              nodes={mapData.nodes || []}
              cables={mapData.cables || []}
              filters={filters}
              focusCoords={focusCoords}
              isPicking={isAddNodeOpen}
              pickerCoords={coords}
              onPickerMove={handlePickerMove}
              onUpdateCoords={handleUpdateCoords}
              onLiveOpm={handleLiveOpm}
            />
          </div>

          {/* VIEW: PUSAT GANGGUAN */}
          {currentView === 'faults' && (
            <div className="view-scrollable">
              <FaultCenter
                faults={mapData.suspected_fiber_cuts || []}
                onFocusNode={handleFocusNode}
                onRefresh={loadMapData}
                onToast={showToast}
              />
            </div>
          )}

          {/* VIEW: INVENTARIS INFRASTRUKTUR */}
          {currentView === 'inventory' && (
            <div className="view-scrollable">
              <InventoryView
                nodes={mapData.nodes || []}
                onOpenAddNode={() => setIsAddNodeOpen(true)}
                onFocusNode={handleFocusNode}
                onLiveOpm={handleLiveOpm}
                onDeleteNode={handleDeleteNode}
                onRefresh={loadMapData}
                onToast={showToast}
              />
            </div>
          )}

          {/* VIEW: PERANGKAT OLT & ROUTER */}
          {currentView === 'devices' && (
            <div className="view-scrollable">
              <DevicesView onToast={showToast} />
            </div>
          )}

          {/* VIEW: LOG TELEMETRI & PEMELIHARAAN */}
          {currentView === 'logs' && (
            <div className="view-scrollable">
              <LogsView onToast={showToast} />
            </div>
          )}

          {/* VIEW: PENGATURAN & EKSTENSI */}
          {currentView === 'settings' && (
            <div className="view-scrollable">
              <SettingsView onToast={showToast} />
            </div>
          )}
        </div>
      </div>

      {/* MODALS */}
      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      <AddNodeModal
        isOpen={isAddNodeOpen}
        onClose={() => setIsAddNodeOpen(false)}
        parentNodes={parentCandidates}
        coords={coords}
        onCoordsChange={handlePickerMove}
        inputMethod={inputMethod}
        onSubmit={handleCreateNode}
        onUseGps={handleUseGps}
        onToast={showToast}
      />

      {/* TOAST NOTIFICATION */}
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            <span className="toast-badge">
              {toast.type === 'success' ? '[BERHASIL]' : toast.type === 'error' ? '[GAGAL]' : '[INFO]'}
            </span>
            <span className="toast-message">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
