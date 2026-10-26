/**
 * React REST API Service with JWT Token Management
 */

const BASE_URL = '/api/v1';

export const Api = {
  getToken() {
    return localStorage.getItem('nms_access_token');
  },

  getRefreshToken() {
    return localStorage.getItem('nms_refresh_token');
  },

  setTokens(accessToken, refreshToken) {
    localStorage.setItem('nms_access_token', accessToken);
    if (refreshToken) {
      localStorage.setItem('nms_refresh_token', refreshToken);
    }
  },

  clearTokens() {
    localStorage.removeItem('nms_access_token');
    localStorage.removeItem('nms_refresh_token');
    localStorage.removeItem('nms_user');
  },

  getUser() {
    try {
      return JSON.parse(localStorage.getItem('nms_user') || 'null');
    } catch {
      return null;
    }
  },

  setUser(user) {
    localStorage.setItem('nms_user', JSON.stringify(user));
  },

  async request(endpoint, options = {}) {
    const url = `${BASE_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let response = await fetch(url, { ...options, headers });

    // Handle 401 refresh
    if (response.status === 401 && this.getRefreshToken() && !endpoint.includes('/auth/')) {
      const refreshed = await this.refreshToken();
      if (refreshed) {
        headers['Authorization'] = `Bearer ${this.getToken()}`;
        response = await fetch(url, { ...options, headers });
      } else {
        this.clearTokens();
        window.dispatchEvent(new CustomEvent('auth-expired'));
        throw new Error('Sesi Anda telah kedaluwarsa. Silakan masuk kembali.');
      }
    }

    const data = await response.json();
    if (!response.ok) {
      const errMsg = data.message || (data.errors ? data.errors.join(', ') : 'Terjadi kesalahan pada server.');
      throw new Error(errMsg);
    }

    return data;
  },

  async login(email, password) {
    const res = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    if (res.data?.token) {
      this.setTokens(res.data.token.access_token, res.data.token.refresh_token);
      this.setUser(res.data.user);
    }
    return res;
  },

  async refreshToken() {
    try {
      const refreshToken = this.getRefreshToken();
      if (!refreshToken) return false;

      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken })
      });

      if (!res.ok) return false;
      const data = await res.json();
      if (data.data?.access_token) {
        this.setTokens(data.data.access_token);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  async getMapData() {
    return this.request('/gis/map-data');
  },

  async createNode(nodeData) {
    return this.request('/gis/nodes', {
      method: 'POST',
      body: JSON.stringify(nodeData)
    });
  },

  async updateNode(id, nodeData) {
    return this.request(`/gis/nodes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(nodeData)
    });
  },

  async deleteNode(id) {
    return this.request(`/gis/nodes/${id}`, {
      method: 'DELETE'
    });
  },

  async getDevices() {
    return this.request('/devices');
  },

  async createDevice(deviceData) {
    return this.request('/devices', {
      method: 'POST',
      body: JSON.stringify(deviceData)
    });
  },

  async testDevice(id) {
    return this.request(`/devices/${id}/test`, {
      method: 'POST'
    });
  },

  async deleteDevice(id) {
    return this.request(`/devices/${id}`, {
      method: 'DELETE'
    });
  },

  async getLiveOpm(nodeId) {
    return this.request(`/monitoring/nodes/${nodeId}/live-opm`);
  },

  async getActiveFaults() {
    return this.request('/monitoring/active-faults');
  },

  async getTempLogs() {
    return this.request('/logs/temp');
  },

  async updateLogRetention(days) {
    return this.request('/settings/log-retention', {
      method: 'PUT',
      body: JSON.stringify({ retention_days: days })
    });
  },

  async purgeTempLogs() {
    return this.request('/logs/temp/purge', {
      method: 'DELETE'
    });
  },

  async createCable(cableData) {
    return this.request('/gis/cables', {
      method: 'POST',
      body: JSON.stringify(cableData)
    });
  },

  async updateCable(id, cableData) {
    return this.request(`/gis/cables/${id}`, {
      method: 'PUT',
      body: JSON.stringify(cableData)
    });
  },

  async deleteCable(id) {
    return this.request(`/gis/cables/${id}`, {
      method: 'DELETE'
    });
  }
};
