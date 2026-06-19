import sqlite3 from 'sqlite3';
import bcrypt from 'bcrypt';

const db = new sqlite3.Database('./last_race.db', err => {
  if (err) console.error(err.message);
  else console.log('Connected to the database.');
});

const run = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function callback(err) {
    if (err) reject(err);
    else resolve(this);
  });
});

const get = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
});

const ANKARA_NETWORK_VERSION = 'ankara-compact-four-lines-v2';
const EVENTS_VERSION = 'ankara-funny-events-en-v2';

const stations = [
  [1, 'Kızılay'],
  [2, 'Batıkent'],
  [3, 'Sıhhiye'],
  [4, 'Ulus'],
  [5, 'AKM'],
  [6, 'Akköprü'],
  [7, 'Yenimahalle'],
  [8, 'Demetevler'],
  [9, 'OSTİM'],
  [10, 'Bilkent'],
  [11, 'Çayyolu'],
  [12, 'Koru']
];

const lines = [
  [1, 'M1 Red'],
  [2, 'M2 Turquoise'],
  [3, 'M3 Blue'],
  [4, 'M3 Blue Branch']
];

const network = {
  1: [1, 2, 3, 4],
  2: [1, 5, 6, 7],
  3: [2, 5, 8, 9],
  4: [4, 8, 7, 10, 11, 12]
};

const events = [
  ['Quiet journey: absolutely nothing happened for once.', 0],
  ['You got off at the wrong platform and had to run back.', -2],
  ['A helpful passenger showed you a shortcut.', 1],
  ['You found a forgotten coin under your seat.', 4],
  ['The ticket inspector discovered your card had no balance.', -4],
  ['The carriage musician played your favorite song.', 2],
  ['The train doors closed right in front of you.', -1],
  ['You returned a lost phone to its owner.', 3],
  ['An old gentleman explained the entire history of Ankara transport.', 0],
  ['You misunderstood the announcement and left one stop early.', -3],
  ['You claimed an empty seat and finally got some rest.', 1],
  ['A mysterious promotion added credit to your metro card.', 3],
  ['Your earphones came out of your pocket tied in an impossible knot.', -1],
  ['Your water bottle leaked inside your bag. A minor disaster.', -2],
  ['The carriage arrived completely empty. An Ankara miracle!', 4],
  ['A child defeated you in a metro-map challenge.', -1],
  ['A security guard returned the coin you dropped.', 2],
  ['Your phone lost signal, granting you five minutes of peace.', 1],
  ['The passenger next to you started watching reels at full volume.', -3],
  ['You found the Kızılay interchange correctly on your first attempt.', 4]
];

async function createTables() {
  await run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    salt TEXT
  )`);
  await run(`CREATE TABLE IF NOT EXISTS stations (
    id INTEGER PRIMARY KEY,
    name TEXT UNIQUE
  )`);
  await run(`CREATE TABLE IF NOT EXISTS lines (
    id INTEGER PRIMARY KEY,
    name TEXT UNIQUE
  )`);
  await run(`CREATE TABLE IF NOT EXISTS line_stations (
    line_id INTEGER,
    station_id INTEGER,
    order_idx INTEGER,
    FOREIGN KEY(line_id) REFERENCES lines(id),
    FOREIGN KEY(station_id) REFERENCES stations(id)
  )`);
  await run(`CREATE TABLE IF NOT EXISTS connections (
    station1 INTEGER,
    station2 INTEGER,
    line_id INTEGER
  )`);
  await run(`CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    description TEXT,
    effect INTEGER
  )`);
  await run(`CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    score INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);
  await run(`CREATE TABLE IF NOT EXISTS app_meta (
    key TEXT PRIMARY KEY,
    value TEXT
  )`);
}

async function migrateGamesTable() {
  const columns = await new Promise((resolve, reject) => {
    db.all('PRAGMA table_info(games)', [], (err, rows) => err ? reject(err) : resolve(rows));
  });
  if (!columns.some(column => column.name === 'level')) {
    await run("ALTER TABLE games ADD COLUMN level TEXT NOT NULL DEFAULT 'Ankara'");
  }
  await run("UPDATE games SET level = 'Ankara' WHERE level IS NULL OR TRIM(level) = ''");
}

async function seedUsers() {
  const row = await get('SELECT COUNT(*) AS count FROM users');
  if (row.count > 0) return;

  for (let index = 1; index <= 3; index += 1) {
    const salt = await bcrypt.genSalt(10);
    const password = await bcrypt.hash(`password${index}`, salt);
    await run(
      'INSERT INTO users (username, password, salt) VALUES (?, ?, ?)',
      [`user${index}`, password, salt]
    );
  }
}

async function seedEvents() {
  const version = await get("SELECT value FROM app_meta WHERE key = 'events_version'");
  if (version?.value === EVENTS_VERSION) return;

  await run('BEGIN TRANSACTION');
  try {
    await run('DELETE FROM events');
    for (const event of events) {
      await run('INSERT INTO events (description, effect) VALUES (?, ?)', event);
    }
    await run(
      `INSERT INTO app_meta (key, value) VALUES ('events_version', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [EVENTS_VERSION]
    );
    await run('COMMIT');
  } catch (err) {
    await run('ROLLBACK');
    throw err;
  }
}

async function seedRanking() {
  const row = await get('SELECT COUNT(*) AS count FROM games');
  if (row.count > 0) return;
  await run('INSERT INTO games (user_id, score) VALUES (2, 10), (3, 12)');
}

async function seedAnkaraNetwork() {
  const version = await get("SELECT value FROM app_meta WHERE key = 'network_version'");
  if (version?.value === ANKARA_NETWORK_VERSION) return;

  await run('BEGIN TRANSACTION');
  try {
    await run('DELETE FROM connections');
    await run('DELETE FROM line_stations');
    await run('DELETE FROM lines');
    await run('DELETE FROM stations');

    for (const station of stations) {
      await run('INSERT INTO stations (id, name) VALUES (?, ?)', station);
    }
    for (const line of lines) {
      await run('INSERT INTO lines (id, name) VALUES (?, ?)', line);
    }
    for (const [lineId, stationIds] of Object.entries(network)) {
      for (let index = 0; index < stationIds.length; index += 1) {
        const stationId = stationIds[index];
        await run(
          'INSERT INTO line_stations (line_id, station_id, order_idx) VALUES (?, ?, ?)',
          [Number(lineId), stationId, index]
        );
        if (index > 0) {
          await run(
            'INSERT INTO connections (station1, station2, line_id) VALUES (?, ?, ?)',
            [stationIds[index - 1], stationId, Number(lineId)]
          );
        }
      }
    }
    await run(
      `INSERT INTO app_meta (key, value) VALUES ('network_version', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [ANKARA_NETWORK_VERSION]
    );
    await run('COMMIT');
  } catch (err) {
    await run('ROLLBACK');
    throw err;
  }
}

export const dbReady = (async () => {
  await createTables();
  await migrateGamesTable();
  await seedUsers();
  await seedEvents();
  await seedRanking();
  await seedAnkaraNetwork();
  console.log('Compact Ankara-inspired network is ready.');
})().catch(err => {
  console.error('Database initialization failed:', err);
  throw err;
});

export default db;
