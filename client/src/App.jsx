import React, { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './app.css';

const ControlRoom3D = React.lazy(() => import('./ControlRoom3D.jsx'));
const API = 'http://localhost:3001/api';

function MainMenu({ onLogin }) {
  const [showLogin, setShowLogin] = useState(false);
  const [username, setUsername] = useState('user1');
  const [password, setPassword] = useState('password1');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const login = async event => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const response = await axios.post(`${API}/login`, { username, password }, { withCredentials: true });
      onLogin(response.data);
      navigate('/hub');
    } catch {
      setError('ACCESS DENIED — CHECK OPERATOR CREDENTIALS');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="main-menu">
      <div className="menu-noise" />
      <section className="menu-brand">
        <span className="menu-kicker">ANKARA METRO OPERATIONS</span>
        <h1>LAST<br /><b>RACE</b></h1>
        <p>Night shift route control simulation</p>
      </section>

      {!showLogin ? (
        <section className="menu-actions">
          <button className="menu-primary" onClick={() => setShowLogin(true)}>START SHIFT</button>
          <div className="menu-status"><i /> CONTROL SYSTEM ONLINE</div>
          <small>WASD TO MOVE · MOUSE TO LOOK · ESC TO RELEASE</small>
        </section>
      ) : (
        <form className="login-console" onSubmit={login}>
          <header>
            <span>OPERATOR AUTHENTICATION</span>
            <button type="button" onClick={() => setShowLogin(false)}>×</button>
          </header>
          <label>
            OPERATOR ID
            <input autoFocus value={username} onChange={event => setUsername(event.target.value)} autoComplete="username" required />
          </label>
          <label>
            PASSCODE
            <input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" required />
          </label>
          {error && <p className="login-error">{error}</p>}
          <button className="menu-primary" disabled={submitting}>
            {submitting ? 'AUTHENTICATING...' : 'ENTER DRIVER CABIN'}
          </button>
          <small>DEMO: user1 / password1</small>
        </form>
      )}

      <footer className="menu-footer">
        <span>LR-CTRL / 2026</span>
        <span>POLITECNICO DI TORINO</span>
      </footer>
    </main>
  );
}

function AppRoutes() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    axios.get(`${API}/check-login`, { withCredentials: true })
      .then(response => setUser(response.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const logout = async () => {
    await axios.post(`${API}/logout`, {}, { withCredentials: true });
    setUser(null);
    navigate('/login');
  };

  if (loading) return <main className="boot-screen"><span>BOOTING CONTROL SYSTEM</span></main>;

  return (
    <Routes>
      <Route path="/" element={<Navigate to={user ? '/hub' : '/login'} replace />} />
      <Route path="/login" element={user ? <Navigate to="/hub" replace /> : <MainMenu onLogin={setUser} />} />
      <Route
        path="/hub"
        element={user ? (
          <React.Suspense fallback={<main className="boot-screen"><span>LOADING DRIVER CABIN</span></main>}>
            <ControlRoom3D onLogout={logout} />
          </React.Suspense>
        ) : <Navigate to="/login" replace />}
      />
      <Route path="*" element={<Navigate to={user ? '/hub' : '/login'} replace />} />
    </Routes>
  );
}

export default function App() {
  return <BrowserRouter><AppRoutes /></BrowserRouter>;
}
