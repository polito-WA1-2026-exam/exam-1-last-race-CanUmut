import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './app.css';

const Board3D = React.lazy(() => import('./Board3D.jsx'));

const API = 'http://localhost:3001/api';
const LINE_COLORS = {
  'M1 Red': '#ff2638',
  'M2 Turquoise': '#18e6d1',
  'M3 Blue': '#334cff',
  'M3 Blue Branch': '#35a7ff'
};

const STATION_POSITIONS = {
  1: [12, 22], 2: [31, 22], 3: [51, 22], 4: [72, 22],
  5: [31, 43], 6: [51, 43], 7: [72, 43], 8: [52, 64],
  9: [31, 78], 10: [82, 58], 11: [82, 75], 12: [92, 88]
};

const stationName = (stations, id) =>
  stations.find(station => station.id === Number(id))?.name || `Station ${id}`;

function MetroMap({
  map,
  connectionsVisible = true,
  startId,
  destinationId,
  route = [],
  activeStationId,
  availableStationIds = [],
  visitedStationIds = [],
  onStationSelect,
  onStationHover
}) {
  return (
    <React.Suspense fallback={<div className="board-loading">Setting up the board...</div>}>
      <Board3D
        key={`${connectionsVisible ? 'setup' : 'planning'}-${startId ?? 'none'}-${destinationId ?? 'none'}`}
        map={map}
        connectionsVisible={connectionsVisible}
        startId={startId}
        destinationId={destinationId}
        route={route}
        activeStationId={activeStationId}
        availableStationIds={availableStationIds}
        visitedStationIds={visitedStationIds}
        onStationSelect={onStationSelect}
        onStationHover={onStationHover}
      />
    </React.Suspense>
  );
}

function StatusLight({ online }) {
  return <span className={`status-light ${online ? 'online' : 'offline'}`} />;
}

function SystemStatus() {
  const [status, setStatus] = useState({ server: false, database: false, checking: true });

  const checkStatus = async () => {
    setStatus(previous => ({ ...previous, checking: true }));
    try {
      const { data } = await axios.get(`${API}/health`, { timeout: 3000 });
      setStatus({
        server: data.server === 'online',
        database: data.database === 'online',
        checking: false
      });
    } catch (error) {
      setStatus({ server: Boolean(error.response), database: false, checking: false });
    }
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <aside className="system-status" aria-live="polite">
      <div className="status-title">
        <span>CORE STATUS</span>
        <button onClick={checkStatus} disabled={status.checking}>
          {status.checking ? '···' : '↻'}
        </button>
      </div>
      <div><StatusLight online={status.server} /> API Server</div>
      <div><StatusLight online={status.database} /> SQLite Core</div>
    </aside>
  );
}

function Home({ user }) {
  return (
    <main className="page home-page">
      <section className="hero-panel">
        <div className="eyebrow">UNDERGROUND ROUTE PROTOCOL</div>
        <h1>LAST <span>RACE</span></h1>
        <p className="hero-copy">
          The metro map is visible only before the mission begins. Memorize the lines,
          then rebuild a valid route before the 90-second signal window closes.
        </p>
        <div className="rules-grid">
          <article><b>01</b><h3>Study</h3><p>Learn the network and interchange stations.</p></article>
          <article><b>02</b><h3>Plan</h3><p>Connect the assigned start and destination.</p></article>
          <article><b>03</b><h3>Survive</h3><p>Every stop triggers a random coin event.</p></article>
        </div>
        <Link className="primary-action" to={user ? '/levels' : '/login'}>
          {user ? 'PLAY' : 'LOGIN TO PLAY'} <span>→</span>
        </Link>
      </section>
      <div className="hero-orb" aria-hidden="true"><div className="orb-core">LR</div></div>
    </main>
  );
}

function Login({ onLogin }) {
  const [username, setUsername] = useState('user1');
  const [password, setPassword] = useState('password1');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async event => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const response = await axios.post(`${API}/login`, { username, password }, { withCredentials: true });
      onLogin(response.data);
      navigate('/levels');
    } catch {
      setError('Access denied. Check your username and password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="page centered-page">
      <form className="glass-card login-card" onSubmit={handleLogin}>
        <div className="eyebrow">OPERATOR AUTHENTICATION</div>
        <h2>Access Terminal</h2>
        <label>Operator ID<input value={username} onChange={e => setUsername(e.target.value)} required /></label>
        <label>Passcode<input type="password" value={password} onChange={e => setPassword(e.target.value)} required /></label>
        {error && <div className="error-message">{error}</div>}
        <button className="primary-action" disabled={submitting}>
          {submitting ? 'AUTHENTICATING…' : 'AUTHORIZE'}
        </button>
        <p className="demo-note">Demo access: user1 / password1</p>
      </form>
    </main>
  );
}

function LevelSelection() {
  return (
    <main className="page level-page">
      <section className="section-heading level-heading">
        <div className="eyebrow">CHOOSE YOUR BOARD</div>
        <h2>Select a Level</h2>
        <p>Each board has a different network size, memory challenge, and route complexity.</p>
      </section>
      <section className="level-grid">
        <article className="level-card available-level">
          <div className="level-card-top">
            <span className="level-number">01</span>
            <span className="difficulty easy">EASY</span>
          </div>
          <div className="level-map-mark">ANK</div>
          <h3>Ankara</h3>
          <p>A compact network designed to teach the route-building rules.</p>
          <ul>
            <li>12 stations</li>
            <li>4 colored lines</li>
            <li>90 seconds</li>
          </ul>
          <Link className="primary-action level-play" to="/game">PLAY ANKARA <span>→</span></Link>
        </article>

        <article className="level-card locked-level">
          <div className="level-card-top">
            <span className="level-number">02</span>
            <span className="difficulty medium">MEDIUM</span>
          </div>
          <div className="level-map-mark">IST</div>
          <h3>Istanbul</h3>
          <p>A larger network with more transfers and longer routes.</p>
          <span className="coming-soon">COMING SOON</span>
        </article>

        <article className="level-card locked-level">
          <div className="level-card-top">
            <span className="level-number">03</span>
            <span className="difficulty hard">HARD</span>
          </div>
          <div className="level-map-mark">LDN</div>
          <h3>London</h3>
          <p>A dense underground maze for experienced route planners.</p>
          <span className="coming-soon">COMING SOON</span>
        </article>
      </section>
    </main>
  );
}

function GameProgress({ current }) {
  const steps = ['Setup', 'Plan', 'Journey', 'Result'];
  return (
    <ol className="game-progress" aria-label="Game progress">
      {steps.map((step, index) => (
        <li
          key={step}
          className={`${index === current ? 'current' : ''} ${index < current ? 'complete' : ''}`}
        >
          <span>{index < current ? '✓' : index + 1}</span>
          <b>{step}</b>
        </li>
      ))}
    </ol>
  );
}

function Ranking() {
  const levels = ['Ankara', 'Istanbul', 'London'];
  const [selectedLevel, setSelectedLevel] = useState('Ankara');
  const [ranks, setRanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    axios.get(`${API}/ranking`, {
      params: { level: selectedLevel },
      withCredentials: true
    })
      .then(response => setRanks(response.data.rankings))
      .catch(() => setError('Ranking data could not be loaded.'))
      .finally(() => setLoading(false));
  }, [selectedLevel]);

  return (
    <main className="page">
      <section className="section-heading">
        <div className="eyebrow">HALL OF OPERATORS</div>
        <h2>Global Ranking</h2>
      </section>
      <div className="ranking-tabs" role="tablist" aria-label="Level rankings">
        {levels.map(level => (
          <button
            key={level}
            type="button"
            role="tab"
            aria-selected={selectedLevel === level}
            className={selectedLevel === level ? 'active' : ''}
            onClick={() => setSelectedLevel(level)}
          >
            {level}
          </button>
        ))}
      </div>
      <div className="ranking-table glass-card">
        {loading && <div className="ranking-state">LOADING RANKING...</div>}
        {error && <div className="ranking-state ranking-error">{error}</div>}
        {!loading && !error && ranks.length === 0 && (
          <div className="ranking-state">NO SCORES YET FOR {selectedLevel.toUpperCase()}</div>
        )}
        {ranks.map((rank, index) => (
          <div className="ranking-row" key={rank.username}>
            <span className="rank-number">#{String(index + 1).padStart(2, '0')}</span>
            <span className="rank-name">{rank.username}</span>
            <span className="rank-score">{rank.best_score} <small>COINS</small></span>
          </div>
        ))}
      </div>
    </main>
  );
}

function MissionBrief({ map, onStart }) {
  return (
    <main className="page game-page">
      <GameProgress current={0} />
      <section className="game-header">
        <div><div className="eyebrow">PHASE 01 · RECONNAISSANCE</div><h2>Study the Network</h2></div>
        <div className="coin-chip">STARTING BALANCE <b>20</b></div>
      </section>
      <div className="game-layout">
        <MetroMap map={map} />
        <aside className="mission-panel glass-card">
          <h3>Mission Rules</h3>
          <div className="mission-step"><b>1</b><span>Memorize line colors and interchange stations.</span></div>
          <div className="mission-step"><b>2</b><span>The lines disappear when planning starts.</span></div>
          <div className="mission-step"><b>3</b><span>Build a continuous route in under 90 seconds.</span></div>
          <div className="line-legend">
            {map.lines.map(line => (
              <span key={line.id}><i style={{ background: LINE_COLORS[line.name] }} />{line.name}</span>
            ))}
          </div>
          <button className="primary-action" onClick={onStart}>I'M READY <span>→</span></button>
        </aside>
      </div>
    </main>
  );
}

function Planning({ map, gameData, onSubmit }) {
  const [route, setRoute] = useState([]);
  const [timeLeft, setTimeLeft] = useState(90);
  const [hoveredSegmentKey, setHoveredSegmentKey] = useState(null);
  const submitted = useRef(false);

  const routeWithDirection = useMemo(() => {
    let current = gameData.startStationId;
    return route.map(segment => {
      const next = segment.s1 === current ? segment.s2 : segment.s1;
      const directed = { ...segment, from: current, next };
      current = next;
      return directed;
    });
  }, [route, gameData.startStationId]);

  const activeStation = routeWithDirection.at(-1)?.next ?? gameData.startStationId;
  const usedKeys = new Set(route.map(({ s1, s2 }) => [s1, s2].sort((a, b) => a - b).join('-')));
  const availableSegments = gameData.segments.filter(segment => {
    const key = [segment.s1, segment.s2].sort((a, b) => a - b).join('-');
    return !usedKeys.has(key) && (segment.s1 === activeStation || segment.s2 === activeStation);
  });
  const availableStationIds = availableSegments.map(segment =>
    segment.s1 === activeStation ? segment.s2 : segment.s1
  );
  const visitedStationIds = [
    gameData.startStationId,
    ...routeWithDirection.map(segment => segment.next)
  ];

  const submit = () => {
    if (submitted.current) return;
    submitted.current = true;
    onSubmit(route);
  };

  useEffect(() => {
    if (timeLeft <= 0) {
      submit();
      return;
    }
    const timer = setTimeout(() => setTimeLeft(value => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft]);

  const chooseSegment = segment => {
    const key = [segment.s1, segment.s2].sort((a, b) => a - b).join('-');
    const touchesCurrent = segment.s1 === activeStation || segment.s2 === activeStation;
    if (!usedKeys.has(key) && touchesCurrent) setRoute(previous => [...previous, segment]);
  };

  const chooseStation = stationId => {
    const segment = availableSegments.find(item =>
      item.s1 === stationId || item.s2 === stationId
    );
    if (segment) chooseSegment(segment);
    setHoveredSegmentKey(null);
  };

  const hoverStation = stationId => {
    setHoveredSegmentKey(
      stationId ? [activeStation, stationId].sort((a, b) => a - b).join('-') : null
    );
  };

  return (
    <main className="page game-page">
      <GameProgress current={1} />
      <section className="game-header">
        <div><div className="eyebrow">PHASE 02 · SIGNAL BLACKOUT</div><h2>Rebuild the Route</h2></div>
        <div className={`timer ${timeLeft <= 20 ? 'danger' : ''}`}><small>TIME LEFT</small>{timeLeft}<span>s</span></div>
      </section>
      <div className="objective-bar">
        <span><small>START</small>{stationName(map.stations, gameData.startStationId)}</span>
        <i>→</i>
        <span><small>DESTINATION</small>{stationName(map.stations, gameData.destinationStationId)}</span>
      </div>
      <div className="planning-layout">
        <MetroMap
          map={map}
          connectionsVisible={false}
          startId={gameData.startStationId}
          destinationId={gameData.destinationStationId}
          activeStationId={activeStation}
          availableStationIds={availableStationIds}
          visitedStationIds={visitedStationIds}
          onStationSelect={chooseStation}
          onStationHover={hoverStation}
        />
        <aside className="segments-panel glass-card">
          <div className="panel-title"><h3>Available Segments</h3><span>Current: {stationName(map.stations, activeStation)}</span></div>
          <div className="segments-list">
            {gameData.segments.map(segment => {
              const key = [segment.s1, segment.s2].sort((a, b) => a - b).join('-');
              const used = usedKeys.has(key);
              const available = segment.s1 === activeStation || segment.s2 === activeStation;
              return (
                <div
                  key={key}
                  className={`segment-button ${available && !used ? 'available' : ''} ${used ? 'used' : ''} ${hoveredSegmentKey === key ? 'map-hovered' : ''}`}
                >
                  <span>{stationName(map.stations, segment.s1)}</span>
                  <i>—</i>
                  <span>{stationName(map.stations, segment.s2)}</span>
                </div>
              );
            })}
          </div>
        </aside>
      </div>
      <section className="route-console glass-card">
        <div><small>YOUR ROUTE</small>
          <div className="route-path">
            <b>{stationName(map.stations, gameData.startStationId)}</b>
            {routeWithDirection.map((segment, index) => (
              <React.Fragment key={`${segment.from}-${segment.next}-${index}`}>
                <i>→</i><b>{stationName(map.stations, segment.next)}</b>
              </React.Fragment>
            ))}
          </div>
        </div>
        <div className="route-actions">
          <button className="secondary-action" onClick={() => setRoute(previous => previous.slice(0, -1))} disabled={!route.length}>UNDO</button>
          <button className="primary-action compact" onClick={submit} disabled={!route.length}>LOCK ROUTE</button>
        </div>
      </section>
    </main>
  );
}

function Execution({ map, result, onAgain }) {
  const [visibleSteps, setVisibleSteps] = useState(result.valid ? 1 : 0);

  useEffect(() => {
    if (!result.valid || visibleSteps >= result.steps.length) return;
    const timer = setTimeout(() => setVisibleSteps(value => value + 1), 900);
    return () => clearTimeout(timer);
  }, [visibleSteps, result]);

  if (!result.valid) {
    return (
      <main className="page centered-page">
        <div className="result-page-wrap">
          <GameProgress current={3} />
          <section className="result-card glass-card failure">
            <div className="result-icon">×</div><div className="eyebrow">ROUTE REJECTED</div>
            <h2>Signal Lost</h2><p>The route was incomplete or invalid. All 20 coins were lost.</p>
            <strong className="final-score">0 <small>COINS</small></strong>
            <button className="primary-action" onClick={onAgain}>BACK TO LEVELS</button>
          </section>
        </div>
      </main>
    );
  }

  const complete = visibleSteps >= result.steps.length;
  return (
    <main className="page game-page">
      <GameProgress current={complete ? 3 : 2} />
      <section className="game-header">
        <div><div className="eyebrow">PHASE 03 · LIVE EXECUTION</div><h2>Journey Events</h2></div>
        <div className="coin-chip">FINAL BALANCE <b>{complete ? result.finalScore : '··'}</b></div>
      </section>
      <div className="execution-track">
        {result.steps.slice(0, visibleSteps).map((step, index) => (
          <article className="event-card glass-card" key={index}>
            <span className="event-index">{String(index + 1).padStart(2, '0')}</span>
            <div><small>{stationName(map.stations, step.segment.s1)} → {stationName(map.stations, step.segment.s2)}</small>
              <h3>{step.event.description}</h3></div>
            <strong className={step.event.effect >= 0 ? 'positive' : 'negative'}>
              {step.event.effect > 0 ? '+' : ''}{step.event.effect}
            </strong>
            <b>{step.coins} coins</b>
          </article>
        ))}
      </div>
      {complete && (
        <section className="result-banner">
          <div><div className="eyebrow">MISSION COMPLETE</div><h2>{result.finalScore} COINS SECURED</h2></div>
          <button className="primary-action compact" onClick={onAgain}>BACK TO LEVELS</button>
        </section>
      )}
    </main>
  );
}

function GamePage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState('loading');
  const [map, setMap] = useState(null);
  const [gameData, setGameData] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    axios.get(`${API}/map`, { withCredentials: true })
      .then(response => { setMap(response.data); setPhase('brief'); });
  }, []);

  const startPlanning = async () => {
    const response = await axios.get(`${API}/game/init`, { withCredentials: true });
    setGameData(response.data);
    setPhase('planning');
  };

  const submitRoute = async route => {
    setPhase('validating');
    const response = await axios.post(`${API}/game/validate`, { route }, { withCredentials: true });
    setResult(response.data);
    setPhase('execution');
  };

  if (!map || phase === 'loading' || phase === 'validating') {
    return <main className="page centered-page"><div className="loader-ring" /><p className="loading-copy">{phase === 'validating' ? 'Validating route…' : 'Loading network…'}</p></main>;
  }
  if (phase === 'brief') return <MissionBrief map={map} onStart={startPlanning} />;
  if (phase === 'planning') return <Planning map={map} gameData={gameData} onSubmit={submitRoute} />;
  return <Execution map={map} result={result} onAgain={() => navigate('/levels')} />;
}

function AppShell() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/check-login`, { withCredentials: true })
      .then(response => setUser(response.data)).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);

  const logout = async () => {
    await axios.post(`${API}/logout`, {}, { withCredentials: true });
    setUser(null);
  };

  if (loading) return <main className="page centered-page"><div className="loader-ring" /></main>;

  return (
    <>
      <header className="topbar">
        <Link className="brand" to="/"><span>LR</span> LAST RACE</Link>
        <nav>
          {user && <Link to="/levels">PLAY</Link>}
          {user && <Link to="/ranking">RANKING</Link>}
        </nav>
        <div className="operator">
          {user ? <><span>OPERATOR <b>{user.username}</b></span><button onClick={logout}>LOGOUT</button></> : <Link to="/login">LOGIN</Link>}
        </div>
      </header>
      <Routes>
        <Route path="/" element={<Home user={user} />} />
        <Route path="/login" element={user ? <Navigate to="/levels" /> : <Login onLogin={setUser} />} />
        <Route path="/levels" element={user ? <LevelSelection /> : <Navigate to="/login" />} />
        <Route path="/game" element={user ? <GamePage /> : <Navigate to="/login" />} />
        <Route path="/ranking" element={user ? <Ranking /> : <Navigate to="/login" />} />
      </Routes>
      <SystemStatus />
    </>
  );
}

export default function App() {
  return <BrowserRouter><AppShell /></BrowserRouter>;
}
