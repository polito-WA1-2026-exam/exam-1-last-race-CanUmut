import sqlite3 from 'sqlite3';
import bcrypt from 'bcrypt';

const db = new sqlite3.Database('./last_race.db', err => {
  if (err) console.error(err.message);
  else {
    db.run('PRAGMA foreign_keys = ON');
    console.log('Connected to the database.');
  }
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

const NETWORK_VERSION = 'ankara-istanbul-london-levels-v4';
const EVENTS_VERSION = 'ankara-funny-events-en-v3';

const ankaraStations = [
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

const ankaraLines = [
  [1, 'M1 Red'],
  [2, 'M2 Turquoise'],
  [3, 'M3 Blue'],
  [4, 'M3 Blue Branch']
];

const ankaraNetwork = {
  1: [1, 2, 3, 4],
  2: [1, 5, 6, 7],
  3: [2, 5, 8, 9],
  4: [4, 8, 7, 10, 11, 12]
};

const istanbulStations = [
  [101, 'Taksim'],
  [102, 'Şişhane'],
  [103, 'Haliç'],
  [104, 'Vezneciler'],
  [105, 'Yenikapı'],
  [106, 'Aksaray'],
  [107, 'Topkapı'],
  [108, 'Merter'],
  [109, 'Bakırköy'],
  [110, 'Kadıköy'],
  [111, 'Ayrılık Çeşmesi'],
  [112, 'Üsküdar'],
  [113, 'Altunizade'],
  [114, 'Levent'],
  [115, 'Gayrettepe'],
  [116, 'Mecidiyeköy']
];

const istanbulLines = [
  [101, 'M2 Emerald'],
  [102, 'M1 Crimson'],
  [103, 'M4 Azure'],
  [104, 'M5 Violet'],
  [105, 'Marmaray Gold'],
  [106, 'Metrobus Orange']
];

const istanbulNetwork = {
  101: [105, 104, 103, 102, 101, 114],
  102: [105, 106, 107, 108, 109],
  103: [110, 111, 113, 116],
  104: [112, 113, 116, 114],
  105: [105, 112, 111, 110],
  106: [107, 116, 115]
};

const londonStations = [
  [201, 'Paddington'],
  [202, 'Baker Street'],
  [203, 'Oxford Circus'],
  [204, 'Tottenham Court Road'],
  [205, 'Holborn'],
  [206, 'Liverpool Street'],
  [207, "King's Cross"],
  [208, 'Euston'],
  [209, 'Camden Town'],
  [210, 'Bank'],
  [211, 'London Bridge'],
  [212, 'Waterloo'],
  [213, 'Victoria'],
  [214, 'Westminster'],
  [215, 'Green Park'],
  [216, 'South Kensington'],
  [217, "Earl's Court"],
  [218, 'Notting Hill Gate'],
  [219, 'Stratford'],
  [220, 'Canary Wharf']
];

const londonLines = [
  [201, 'Central Red'],
  [202, 'Bakerloo Brown'],
  [203, 'Victoria Cyan'],
  [204, 'Northern Black'],
  [205, 'Jubilee Silver'],
  [206, 'District Green'],
  [207, 'Circle Gold'],
  [208, 'Piccadilly Blue']
];

const londonNetwork = {
  201: [218, 201, 202, 203, 204, 205, 206],
  202: [201, 214, 212],
  203: [209, 203, 215, 213],
  204: [208, 207, 205, 210, 211],
  205: [214, 220, 219],
  206: [217, 216, 213, 210],
  207: [206, 210, 214],
  208: [216, 207, 208]
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
    line_id INTEGER NOT NULL,
    station_id INTEGER NOT NULL,
    order_idx INTEGER NOT NULL CHECK(order_idx >= 0),
    PRIMARY KEY(line_id, station_id),
    UNIQUE(line_id, order_idx),
    FOREIGN KEY(line_id) REFERENCES lines(id) ON DELETE CASCADE,
    FOREIGN KEY(station_id) REFERENCES stations(id) ON DELETE CASCADE
  )`);
  await run(`CREATE TABLE IF NOT EXISTS connections (
    station1 INTEGER NOT NULL,
    station2 INTEGER NOT NULL,
    line_id INTEGER NOT NULL,
    PRIMARY KEY(station1, station2, line_id),
    CHECK(station1 <> station2),
    FOREIGN KEY(station1) REFERENCES stations(id) ON DELETE CASCADE,
    FOREIGN KEY(station2) REFERENCES stations(id) ON DELETE CASCADE,
    FOREIGN KEY(line_id) REFERENCES lines(id) ON DELETE CASCADE
  )`);
  await run(`CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    description TEXT NOT NULL,
    effect INTEGER NOT NULL CHECK(effect BETWEEN -4 AND 4)
  )`);
  await run(`CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    score INTEGER NOT NULL CHECK(score >= 0),
    level TEXT NOT NULL DEFAULT 'Ankara',
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
  const ankara = await get("SELECT COUNT(*) AS count FROM games WHERE level = 'Ankara'");
  if (ankara.count === 0) {
    await run(`
      INSERT INTO games (user_id, score, level) VALUES
        (2, 22, 'Ankara'),
        (2, 27, 'Ankara'),
        (3, 18, 'Ankara'),
        (3, 24, 'Ankara')
    `);
  }
  const istanbul = await get("SELECT COUNT(*) AS count FROM games WHERE level = 'Istanbul'");
  if (istanbul.count === 0) {
    await run(`
      INSERT INTO games (user_id, score, level) VALUES
        (2, 19, 'Istanbul'),
        (2, 25, 'Istanbul'),
        (3, 21, 'Istanbul'),
        (3, 23, 'Istanbul')
    `);
  }
  const london = await get("SELECT COUNT(*) AS count FROM games WHERE level = 'London'");
  if (london.count === 0) {
    await run(`
      INSERT INTO games (user_id, score, level) VALUES
        (2, 18, 'London'),
        (2, 22, 'London'),
        (3, 17, 'London'),
        (3, 20, 'London')
    `);
  }
}

async function seedNetworks() {
  const version = await get("SELECT value FROM app_meta WHERE key = 'network_version'");
  if (version?.value === NETWORK_VERSION) return;

  await run('BEGIN TRANSACTION');
  try {
    await run('DELETE FROM connections');
    await run('DELETE FROM line_stations');
    await run('DELETE FROM lines');
    await run('DELETE FROM stations');

    for (const station of [...ankaraStations, ...istanbulStations, ...londonStations]) {
      await run('INSERT INTO stations (id, name) VALUES (?, ?)', station);
    }
    for (const line of [...ankaraLines, ...istanbulLines, ...londonLines]) {
      await run('INSERT INTO lines (id, name) VALUES (?, ?)', line);
    }
    for (const network of [ankaraNetwork, istanbulNetwork, londonNetwork]) {
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
    }
    await run(
      `INSERT INTO app_meta (key, value) VALUES ('network_version', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [NETWORK_VERSION]
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
  await seedNetworks();
  console.log('Ankara, Istanbul and London networks are ready.');
})().catch(err => {
  console.error('Database initialization failed:', err);
  throw err;
});

export default db;
