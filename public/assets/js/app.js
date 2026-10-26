/**
 * Main Application Controller (NMS-GIS ISP SPA)
 */

document.addEventListener('DOMContentLoaded', () => {
    const mapManager = new LeafletMapManager('map');
    mapManager.init();
    window.mapManager = mapManager;

    // Toast Notification helper
    window.showToast = (message, type = 'info') => {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `<span>${type === 'success' ? '' : (type === 'error' ? '' : '')}</span> <span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    };

    // Live OPM On-Demand Check (Mock/Preparation for Phase 2)
    window.checkLiveOpm = async (nodeId) => {
        try {
            showToast('Menghubungi OLT untuk pembacaan OPM real-time...', 'info');
            // Phase 1 preview: returns current reading or informs technician
            const res = await Api.getMapData();
            const node = res.nodes.find(n => n.id === nodeId);
            if (node) {
                const rx = node.rx_power_dbm !== null ? `${node.rx_power_dbm} dBm` : '-19.50 dBm';
                showToast(`[Live OPM] ${node.node_code}: Rx Power = ${rx}`, 'success');
            }
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    // 1. Check Authentication State
    function updateAuthUi() {
        const user = Api.getUser();
        const userBadge = document.getElementById('userBadge');
        const loginBtn = document.getElementById('loginBtn');
        const logoutBtn = document.getElementById('logoutBtn');
        const addNodeBtn = document.getElementById('addNodeBtn');

        if (user) {
            if (userBadge) {
                userBadge.textContent = `${user.name} (${user.role.toUpperCase()})`;
                userBadge.style.display = 'inline-block';
            }
            if (loginBtn) loginBtn.style.display = 'none';
            if (logoutBtn) logoutBtn.style.display = 'inline-block';
            if (addNodeBtn) addNodeBtn.style.display = 'inline-flex';
        } else {
            if (userBadge) userBadge.style.display = 'none';
            if (loginBtn) loginBtn.style.display = 'inline-block';
            if (logoutBtn) logoutBtn.style.display = 'none';
            if (addNodeBtn) addNodeBtn.style.display = 'none';
        }
    }

    // 2. Load Map Data & Update KPIs
    async function refreshMapData() {
        if (!Api.getToken()) {
            openLoginModal();
            return;
        }

        try {
            const data = await Api.getMapData();
            mapManager.renderTopology(data);

            // Update KPI cards
            const s = data.summary || {};
            document.getElementById('kpiTotalCustomers').textContent = s.total_customers || 0;
            document.getElementById('kpiOnline').textContent = s.online || 0;
            document.getElementById('kpiWarning').textContent = s.warning_dbm || 0;
            document.getElementById('kpiLos').textContent = s.los_cut || 0;

            // Populate parent node options in modal
            const parentSelect = document.getElementById('nodeParentSelect');
            if (parentSelect) {
                parentSelect.innerHTML = '<option value="">-- Tanpa Parent (Root POP) --</option>';
                data.nodes.filter(n => n.node_type !== 'CUSTOMER').forEach(n => {
                    const opt = document.createElement('option');
                    opt.value = n.id;
                    opt.textContent = `[${n.node_type}] ${n.node_code} - ${n.node_name}`;
                    parentSelect.appendChild(opt);
                });
            }

        } catch (err) {
            showToast(err.message, 'error');
        }
    }

    // 3. Login Modal Handling
    const loginModal = document.getElementById('loginModal');
    const loginForm = document.getElementById('loginForm');

    function openLoginModal() {
        loginModal.classList.add('active');
    }
    function closeLoginModal() {
        loginModal.classList.remove('active');
    }

    document.getElementById('loginBtn')?.addEventListener('click', openLoginModal);
    document.getElementById('closeLoginModalBtn')?.addEventListener('click', closeLoginModal);

    loginForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        try {
            await Api.login(email, password);
            showToast('Login berhasil!', 'success');
            closeLoginModal();
            updateAuthUi();
            refreshMapData();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        Api.clearTokens();
        updateAuthUi();
        showToast('Anda telah logout.', 'info');
        openLoginModal();
    });

    window.addEventListener('auth-expired', () => {
        updateAuthUi();
        openLoginModal();
    });

    // 4. Add Node Modal & 3-Method Location Picker Handling
    const addNodeModal = document.getElementById('addNodeModal');
    const addNodeForm = document.getElementById('addNodeForm');
    const latInput = document.getElementById('nodeLat');
    const lngInput = document.getElementById('nodeLng');
    const inputMethodField = document.getElementById('nodeInputMethod');

    function openAddNodeModal() {
        const center = mapManager.map.getCenter();
        latInput.value = center.lat.toFixed(7);
        lngInput.value = center.lng.toFixed(7);
        inputMethodField.value = 'map_marker';

        addNodeModal.classList.add('active');

        // Start location picking mode on map
        mapManager.startLocationPicker(center.lat, center.lng, (lat, lng, method) => {
            latInput.value = lat.toFixed(7);
            lngInput.value = lng.toFixed(7);
            inputMethodField.value = method;
        });
    }

    function closeAddNodeModal() {
        addNodeModal.classList.remove('active');
        mapManager.stopLocationPicker();
    }

    document.getElementById('addNodeBtn')?.addEventListener('click', openAddNodeModal);
    document.getElementById('closeAddNodeModalBtn')?.addEventListener('click', closeAddNodeModal);
    document.getElementById('cancelAddNodeBtn')?.addEventListener('click', closeAddNodeModal);

    // Method 2: HTML5 GPS Button
    document.getElementById('btnUseGps')?.addEventListener('click', () => {
        showToast('Mencari koordinat GPS...', 'info');
        mapManager.detectCurrentGpsLocation(
            (lat, lng, accuracy) => {
                latInput.value = lat.toFixed(7);
                lngInput.value = lng.toFixed(7);
                inputMethodField.value = 'gps';
                showToast(`Lokasi GPS didapatkan! Akurasi: ±${Math.round(accuracy)}m`, 'success');
            },
            (err) => {
                showToast(`Gagal mendapatkan GPS: ${err.message}`, 'error');
            }
        );
    });

    // Method 3: Manual Input Lat/Lng change syncs to map pin
    function syncManualInputToMap() {
        const lat = parseFloat(latInput.value);
        const lng = parseFloat(lngInput.value);
        if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            mapManager.setPickerLocation(lat, lng, 'manual_latlong');
            inputMethodField.value = 'manual_latlong';
        }
    }
    latInput?.addEventListener('input', syncManualInputToMap);
    lngInput?.addEventListener('input', syncManualInputToMap);

    // Node Type toggle additional fields (Customer ONT fields)
    const nodeTypeSelect = document.getElementById('nodeTypeSelect');
    const customerFields = document.getElementById('customerFields');
    nodeTypeSelect?.addEventListener('change', () => {
        if (nodeTypeSelect.value === 'CUSTOMER') {
            customerFields.style.display = 'block';
        } else {
            customerFields.style.display = 'none';
        }
    });

    // Submit Add Node Form
    addNodeForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nodeData = {
            node_code: document.getElementById('nodeCode').value.trim(),
            node_name: document.getElementById('nodeName').value.trim(),
            node_type: document.getElementById('nodeTypeSelect').value,
            latitude: parseFloat(latInput.value),
            longitude: parseFloat(lngInput.value),
            input_method: inputMethodField.value,
            parent_node_id: document.getElementById('nodeParentSelect').value || null,
            port_capacity: parseInt(document.getElementById('nodePortCapacity').value) || 0,
            address_note: document.getElementById('nodeAddressNote').value.trim(),
            onu_sn: document.getElementById('onuSn')?.value.trim() || null,
            pppoe_username: document.getElementById('pppoeUser')?.value.trim() || null
        };

        try {
            const res = await Api.createNode(nodeData);
            showToast(res.message, 'success');
            closeAddNodeModal();
            addNodeForm.reset();
            refreshMapData();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    // 5. Layer Filters
    document.querySelectorAll('.filter-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const filterKey = e.target.dataset.filter;
            mapManager.setFilter(filterKey, e.target.checked);
        });
    });

    // 6. Sidebar Toggle
    document.getElementById('toggleSidebarBtn')?.addEventListener('click', () => {
        const panel = document.getElementById('dashboardPanel');
        panel.classList.toggle('collapsed');
    });

    // 7. Initial Bootstrap
    updateAuthUi();
    if (Api.getToken()) {
        refreshMapData();
    } else {
        openLoginModal();
    }
});
