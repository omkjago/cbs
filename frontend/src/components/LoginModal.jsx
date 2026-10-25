import React, { useState } from 'react';

export default function LoginModal({ isOpen, onClose, onLoginSuccess }) {
  const [email, setEmail] = useState('admin@nms.isp');
  const [password, setPassword] = useState('AdminPassword123!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await onLoginSuccess(email, password);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-header">
          <span>🔐 Masuk Sistem NMS-GIS</span>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid var(--danger)', padding: '8px', borderRadius: '6px', fontSize: '12px', color: '#fca5a5' }}>
                {error}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Kata Sandi</label>
              <input
                type="password"
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              <em>Akun default:</em><br />
              • Admin: <code>admin@nms.isp</code> / <code>AdminPassword123!</code><br />
              • Teknisi: <code>teknisi@nms.isp</code> / <code>TeknisiPassword123!</code>
            </div>
          </div>

          <div className="modal-footer">
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Memproses...' : 'Masuk'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
