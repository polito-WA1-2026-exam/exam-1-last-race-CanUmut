import express from 'express';
import cors from 'cors';
import session from 'express-session';
import passport from 'passport';
import LocalStrategy from 'passport-local';
import bcrypt from 'bcrypt';
import db, { dbReady } from './db.js';

const app = express();
app.use(express.json());
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(async (req, res, next) => {
  try {
    await dbReady;
    next();
  } catch {
    res.status(503).json({ error: 'Database is not ready' });
  }
});

app.use(session({
  secret: 'supersecret',
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(async (username, password, done) => {
  db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
    if (err) return done(err);
    if (!user) return done(null, false);
    const match = await bcrypt.compare(password, user.password);
    if (!match) return done(null, false);
    return done(null, user);
  });
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
  db.get("SELECT * FROM users WHERE id = ?", [id], (err, user) => done(err, user));
});

// Middleware to ensure auth
const isAuth = (req, res, next) => {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ error: "Unauthorized" });
};

const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
});

const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
});

const segmentKey = (s1, s2) => [Number(s1), Number(s2)].sort((a, b) => a - b).join('-');

const buildGraph = (connections) => {
  const graph = new Map();
  connections.forEach(({ station1, station2 }) => {
    if (!graph.has(station1)) graph.set(station1, []);
    if (!graph.has(station2)) graph.set(station2, []);
    graph.get(station1).push(station2);
    graph.get(station2).push(station1);
  });
  return graph;
};

const shortestDistance = (graph, start, destination) => {
  const queue = [[start, 0]];
  const visited = new Set([start]);

  while (queue.length) {
    const [station, distance] = queue.shift();
    if (station === destination) return distance;

    for (const next of graph.get(station) || []) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push([next, distance + 1]);
      }
    }
  }

  return Infinity;
};

const shuffle = (items) => [...items].sort(() => Math.random() - 0.5);

// Public health check used by the client status panel.
app.get('/api/health', (req, res) => {
  db.get('SELECT 1 AS ok', [], (err, row) => {
    if (err || row?.ok !== 1) {
      return res.status(503).json({
        server: 'online',
        database: 'offline'
      });
    }

    res.json({
      server: 'online',
      database: 'online',
      checkedAt: new Date().toISOString()
    });
  });
});

// Get Map Data
app.get('/api/map', isAuth, async (req, res) => {
  try {
    const [lines, stations, lineStations] = await Promise.all([
      dbAll("SELECT * FROM lines ORDER BY id"),
      dbAll("SELECT * FROM stations ORDER BY id"),
      dbAll("SELECT line_id, station_id, order_idx FROM line_stations ORDER BY line_id, order_idx")
    ]);

    const linesWithStations = lines.map(line => ({
      ...line,
      stationIds: lineStations
        .filter(item => item.line_id === line.id)
        .map(item => item.station_id)
    }));

    res.json({ lines: linesWithStations, stations });
  } catch (err) {
    res.status(500).json({ error: "Unable to load the network map" });
  }
});

// Start Game - Generate start/dest with min 3 segments
app.get('/api/game/init', isAuth, async (req, res) => {
  try {
    const connections = await dbAll("SELECT station1, station2, line_id FROM connections");
    const graph = buildGraph(connections);
    const stationIds = [...graph.keys()];
    const validPairs = [];

    stationIds.forEach(start => {
      stationIds.forEach(destination => {
        if (start !== destination && shortestDistance(graph, start, destination) >= 3) {
          validPairs.push([start, destination]);
        }
      });
    });

    if (!validPairs.length) {
      return res.status(500).json({ error: "No valid start and destination pair exists" });
    }

    const [startStationId, destinationStationId] =
      validPairs[Math.floor(Math.random() * validPairs.length)];
    const uniqueSegments = new Map();

    connections.forEach(connection => {
      const key = segmentKey(connection.station1, connection.station2);
      if (!uniqueSegments.has(key)) {
        uniqueSegments.set(key, {
          s1: Math.min(connection.station1, connection.station2),
          s2: Math.max(connection.station1, connection.station2)
        });
      }
    });

    req.session.game = { startStationId, destinationStationId, level: 'Ankara' };

    res.json({
      startStationId,
      destinationStationId,
      segments: shuffle([...uniqueSegments.values()])
    });
  } catch (err) {
    res.status(500).json({ error: "Unable to start a new game" });
  }
});

// Validate Route
app.post('/api/game/validate', isAuth, async (req, res) => {
  const { route } = req.body;
  const { startStationId, destinationStationId, level = 'Ankara' } = req.session.game || {};

  if (!startStationId || !destinationStationId) {
    return res.status(400).json({ error: "Start a game before submitting a route" });
  }

  if (!Array.isArray(route) || route.length === 0) {
    return res.json({ valid: false, finalScore: 0 });
  }

  let isValid = true;
  let current = startStationId;
  let possibleLines = null;
  const usedSegments = new Set();

  for (let i = 0; i < route.length; i++) {
    const seg = route[i];
    const s1 = Number(seg.s1);
    const s2 = Number(seg.s2);
    const key = segmentKey(s1, s2);

    if (!Number.isInteger(s1) || !Number.isInteger(s2) || usedSegments.has(key)) {
      isValid = false; break;
    }
    usedSegments.add(key);

    if (s1 !== current && s2 !== current) {
      isValid = false; break;
    }
    const next = (s1 === current) ? s2 : s1;
    
    // Fetch lines for this segment
    const segLines = (await dbAll(
      "SELECT line_id FROM connections WHERE (station1=? AND station2=?) OR (station1=? AND station2=?)",
      [s1, s2, s2, s1]
    )).map(row => row.line_id);

    if (segLines.length === 0) { isValid = false; break; }

    if (i === 0) {
      possibleLines = segLines;
    } else {
      const intersection = possibleLines.filter(l => segLines.includes(l));
      if (intersection.length > 0) {
        possibleLines = intersection;
      } else {
        // Check interchange at current station
        const stnLines = (await dbAll(
          "SELECT line_id FROM line_stations WHERE station_id=?",
          [current]
        )).map(row => row.line_id);
        const canChange = stnLines.some(l => possibleLines.includes(l)) && stnLines.some(l => segLines.includes(l));
        if (canChange) {
          possibleLines = segLines;
        } else {
          isValid = false; break;
        }
      }
    }
    current = next;
  }

  if (isValid && current === destinationStationId) {
    // Generate events and compute score
    let coins = 20;
    const steps = [];
    for (const seg of route) {
      const event = await dbGet("SELECT * FROM events ORDER BY RANDOM() LIMIT 1");
      coins += event.effect;
      steps.push({ segment: seg, event, coins });
    }
    const finalScore = Math.max(0, coins);
    db.run(
      "INSERT INTO games (user_id, score, level) VALUES (?, ?, ?)",
      [req.user.id, finalScore, level],
      function saveGame(err) {
        if (err) {
          console.error('Game score could not be saved:', err.message);
          return res.status(500).json({ error: 'Game score could not be saved' });
        }
        delete req.session.game;
        res.json({ valid: true, steps, finalScore, gameId: this.lastID });
      }
    );
  } else {
    delete req.session.game;
    res.json({ valid: false, finalScore: 0 });
  }
});

// Ranking
app.get('/api/ranking', isAuth, (req, res) => {
  const allowedLevels = ['Ankara', 'Istanbul', 'London'];
  const level = typeof req.query.level === 'string' ? req.query.level : 'Ankara';

  if (!allowedLevels.includes(level)) {
    return res.status(400).json({ error: 'Unknown level' });
  }

  db.all(`
    SELECT
      u.username,
      best.score AS best_score
    FROM users u
    LEFT JOIN games best ON best.id = (
      SELECT g.id
      FROM games g
      WHERE g.user_id = u.id AND g.level = ?
      ORDER BY g.score DESC, g.timestamp ASC, g.id ASC
      LIMIT 1
    )
    WHERE best.id IS NOT NULL
    ORDER BY best_score DESC, u.username ASC
  `, [level], (err, rows) => {
    if (err) {
      console.error('Ranking query failed:', err.message);
      return res.status(500).json({ error: 'Unable to load ranking' });
    }
    res.json({ level, rankings: rows });
  });
});

// Auth Routes
app.post('/api/login', passport.authenticate('local'), (req, res) => res.json({ id: req.user.id, username: req.user.username }));
app.post('/api/logout', (req, res) => { req.logout(() => res.json({ ok: true })); });
app.get('/api/check-login', (req, res) => {
  if (req.isAuthenticated()) res.json({ id: req.user.id, username: req.user.username });
  else res.status(401).json({ error: "Unauthorized" });
});

const PORT = 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
