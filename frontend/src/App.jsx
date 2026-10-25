import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import KpiCards from './components/KpiCards';
import LayerFilter from './components/LayerFilter';
import GisMap from './components/GisMap';
import AddNodeModal from './components/AddNodeModal';
import LoginModal from './components/LoginModal';
import FaultAlertBanner from './components/FaultAlertBanner';
import { Api } from './services/api';

export default function App() {
  const [user, setUser] = useState(Api.getUser());
  const [mapData, setMapData] = useState({ nodes: [], cables: [], summary: {} });
  const [filters, setFilters] = useState({
    POP: true,
    ODC: true,
    JB: true,
    ODP: true,
    CUSTOMER_NORMAL: true,
    CUSTOMER_FAULT: true
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isAddNodeOpen, setIsAddNodeOpen] = useState(false);
  const [coords, setCoords] = useState({ lat: -6.991, lng: 110.423 });
  const [inputMethod, setInputMethod] = useState('map_marker');
  const [toast, setToast] = useState(null);
  const [focusCoords, setFocusCoords] = useState(null);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadMapData = async () => {
    if (!Api.getToken()) {
      setIsLoginOpen(true);
      return;
    }
    try {
      const data = await Api.getMapData();
      setMapData(data);
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
      showToast('Sesi Anda telah berakhir. Silakan masuk kembali.', 'error');
    };

    window.addEventListener('auth-expired', onAuthExpired);
    return () => window.removeEventListener('auth-expired', onAuthExpired);
  }, [user]);

  const handleLoginSuccess = async (email, password) => {
    const res = await Api.login(email, password);
    setUser(res.data.user);
    showToast('Login berhasil!', 'success');
    loadMapData();
  };

  const handleLogout = () => {
    Api.clearTokens();
    setUser(null);
    setMapData({ nodes: [], cables: [], summary: {} });
    showToast('Anda telah logout.', 'info');
    setIsLoginOpen(true);
  };

  // 3-Method Location Sync
  const handlePickerMove = (lat, lng, method) => {
    setCoords({ lat: parseFloat(lat).toFixed(7), lng: parseFloat(lng).toFixed(7) });
    setInputMethod(method);
  };

  const handleUseGps = () => {
    if (!navigator.geolocation) {
      showToast('Browser Anda tidak mendukung GPS Geolocation.', 'error');
      return;
    }
    showToast('Mencari posisi GPS...', 'info');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(7);
        const lng = pos.coords.longitude.toFixed(7);
        setCoords({ lat, lng });
        setInputMethod('gps');
        showToast(`Lokasi GPS didapatkan! (Akurasi: ±${Math.round(pos.coords.accuracy)}m)`, 'success');
      },
      (err) => {
        showToast(`Gagal mendeteksi GPS: ${err.message}`, 'error');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleUpdateCoords = async (nodeId, lat, lng, nodeName) => {
    const confirmUpdate = window.confirm(`Pindahkan koordinat ${nodeName} ke [${lat.toFixed(6)}, ${lng.toFixed(6)}]?`);
    if (!confirmUpdate) {
      loadMapData();
      return;
    }

    try {
      await Api.updateNode(nodeId, { latitude: lat, longitude: lng, input_method: 'map_marker' });
      showToast(`Koordinat ${nodeName} berhasil diperbarui!`, 'success');
      loadMapData();
    } catch (err) {
      showToast(err.message, 'error');
      loadMapData();
    }
  };

  const handleLiveOpm = (node) => {
    Api.getLiveOpm(node.id).then(res => {
      const rx = res.data?.rx_power_dbm !== null ? `${res.data.rx_power_dbm} dBm` : 'N/A';
      showToast(`[Live OPM] ${node.node_code}: Rx Power = ${rx} (Status: ${res.data?.connection_status})`, 'success');
      loadMapData();
    }).catch(err => showToast(err.message, 'error'));
    return;

  };

  const handleCreateNode = async (nodeData) => {
    const res = await Api.createNode(nodeData);
    showToast(res.message, 'success');
    loadMapData();
  };

  const parentCandidates = mapData.nodes.filter((n) => n.node_type !== 'CUSTOMER');

  return (
    <>
      <Navbar
        user={user}
        onOpenAddNode={() => setIsAddNodeOpen(true)}
        onOpenLogin={() => setIsLoginOpen(true)}
        onLogout={handleLogout}
      />

      <main className="main-container">
        <aside className={`floating-panel ${!isSidebarOpen ? 'collapsed' : ''}`}>
          <div className="panel-header">
            <span>Monitoring Jaringan & Layer</span>
            <button className="btn btn-secondary btn-sm" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
              {isSidebarOpen ? '✕' : '☰'}
            </button>
          </div>

          <div className="panel-body">
            <FaultAlertBanner
              faults={mapData.suspected_fiber_cuts}
              onFocusNode={(lat, lng) => setFocusCoords({ lat, lng })}
            />

            <KpiCards summary={mapData.summary} />

            <LayerFilter
              filters={filters}

              onToggleFilter={(key, val) => setFilters((prev) => ({ ...prev, [key]: val }))}
            />
          </div>
        </aside>

        <GisMap
          nodes={mapData.nodes}
          cables={mapData.cables}
          filters={filters}
          focusCoords={focusCoords}

          isPicking={isAddNodeOpen}
          pickerCoords={coords}
          onPickerMove={handlePickerMove}
          onUpdateCoords={handleUpdateCoords}
          onLiveOpm={handleLiveOpm}
        />
      </main>

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
      />

      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            <span>{toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'}</span>
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </>
  );
}
