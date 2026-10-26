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
      <div className="modal-card" style={{ maxWidth: '420px' }}>
        <div className="modal-header">
          <span className="modal-title-text">Masuk ke Sistem NMS-GIS</span>
          <button className="btn btn-secondary btn-sm" onClick={onClose} type="button">
            Tutup
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div className="alert-box-error">
                {error}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Alamat Email</label>
              <input
                type="email"
                className="form-input"
                placeholder="nama@domain.isp"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label">Kata Sandi Akun</label>
              <input
                type="password"
                className="form-input"
                placeholder="Masukkan kata sandi..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="login-helper-box">
              <span className="helper-title">Akun Bawaan Sistem:</span>
              <div>Super Admin: <code>admin@nms.isp</code> / <code>AdminPassword123!</code></div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Memverifikasi...' : 'Masuk ke Sistem'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
