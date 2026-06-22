import React, { useMemo, useState } from 'react';

const POSITIONS = {
  1: [12, 22], 2: [31, 22], 3: [51, 22], 4: [72, 22],
  5: [31, 43], 6: [51, 43], 7: [72, 43], 8: [52, 64],
  9: [31, 78], 10: [82, 58], 11: [82, 75], 12: [92, 88],
  101: [43, 20], 102: [36, 30], 103: [43, 39], 104: [43, 49], 105: [43, 60],
  106: [34, 69], 107: [25, 78], 108: [16, 87], 109: [7, 94],
  110: [91, 88], 111: [81, 78], 112: [69, 67], 113: [69, 51],
  114: [69, 18], 115: [57, 25], 116: [69, 35],
  201: [9, 31], 202: [22, 31], 203: [39, 31], 204: [53, 31],
  205: [67, 31], 206: [82, 31], 207: [67, 14], 208: [53, 14],
  209: [39, 7], 210: [82, 49], 211: [82, 69], 212: [67, 69],
  213: [39, 69], 214: [53, 55], 215: [39, 49], 216: [22, 69],
  217: [9, 69], 218: [9, 49], 219: [94, 19], 220: [94, 57]
};
const COLORS = {
  'M1 Red': '#e05d55',
  'M2 Turquoise': '#44c7b4',
  'M3 Blue': '#607be4',
  'M3 Blue Branch': '#71a8e2',
  'M2 Emerald': '#42c98a',
  'M1 Crimson': '#e14f62',
  'M4 Azure': '#4d8ee8',
  'M5 Violet': '#9a63d8',
  'Marmaray Gold': '#d5aa3e',
  'Metrobus Orange': '#e8873d',
  'Central Red': '#dc4b4b',
  'Bakerloo Brown': '#a6794d',
  'Victoria Cyan': '#45b8d8',
  'Northern Black': '#9aa5a0',
  'Jubilee Silver': '#c1c7c5',
  'District Green': '#4db875',
  'Circle Gold': '#d8b84c',
  'Piccadilly Blue': '#557ee3'
};

const stationName = (stations, id) =>
  stations.find(station => station.id === Number(id))?.name || `Station ${id}`;
const segmentKey = (s1, s2) => [Number(s1), Number(s2)].sort((a, b) => a - b).join('-');

export default function TerminalScreen({
  map,
  selectedLevel,
  phase,
  gameData,
  route,
  result,
  visibleSteps,
  timeLeft,
  onReady,
  onSelectSegment,
  onSubmit,
  onReset,
  onClose
}) {
  const [hoveredKey, setHoveredKey] = useState(null);
  const used = useMemo(
    () => new Set(route.map(segment => segmentKey(segment.s1, segment.s2))),
    [route]
  );
  const order = useMemo(
    () => new Map(route.map((segment, index) => [segmentKey(segment.s1, segment.s2), index + 1])),
    [route]
  );
  const hoveredSegment = gameData?.segments?.find(
    segment => segmentKey(segment.s1, segment.s2) === hoveredKey
  );
  const hoveredStations = new Set(hoveredSegment ? [hoveredSegment.s1, hoveredSegment.s2] : []);
  const currentStep = phase === 'execution' ? result?.steps?.[visibleSteps - 1] : null;
  const actionLabel =
    phase === 'setup' ? 'INITIALIZE MISSION' :
      phase === 'planning' ? 'LOCK ROUTE' :
        phase === 'result' ? 'NEW SHIFT' : 'JOURNEY ACTIVE';
  const actionDisabled = phase === 'execution' || (phase === 'planning' && !route.length);

  return (
    <section className="game-terminal-page">
      <article className="game-terminal">
        <header className="game-terminal-header">
          <div>
            <span>LAST RACE // ROUTE CONTROL</span>
            <b>{selectedLevel.toUpperCase()} NETWORK</b>
          </div>
          <div className={`terminal-timer ${timeLeft <= 20 && phase === 'planning' ? 'danger' : ''}`}>
            <small>{phase === 'planning' ? 'TIME LEFT' : 'SHIFT CLOCK'}</small>
            <strong>{String(phase === 'planning' ? timeLeft : 90).padStart(2, '0')}</strong>
          </div>
          <button onClick={onClose}>ESC · CABIN</button>
        </header>

        <div className="terminal-body">
          <section className="terminal-map-panel">
            <div className="terminal-panel-title">
              <span>{phase === 'setup' ? 'NETWORK OVERVIEW' : 'STATION REFERENCE'}</span>
              {phase === 'planning' && <small>LINES HIDDEN</small>}
            </div>
            <svg className="terminal-map" viewBox="0 0 100 100" role="img" aria-label={`${selectedLevel} underground network`}>
              {phase === 'setup' && map.lines.flatMap(line =>
                line.stationIds.slice(0, -1).map((stationId, index) => {
                  const nextId = line.stationIds[index + 1];
                  const [x1, y1] = POSITIONS[stationId];
                  const [x2, y2] = POSITIONS[nextId];
                  return (
                    <line
                      key={`${line.id}-${stationId}`}
                      x1={x1} y1={y1} x2={x2} y2={y2}
                      stroke={COLORS[line.name]}
                      className="terminal-map-line"
                    />
                  );
                })
              )}
              {(phase === 'execution' || phase === 'result') && route.map(segment => {
                const [x1, y1] = POSITIONS[segment.s1];
                const [x2, y2] = POSITIONS[segment.s2];
                return <line key={segmentKey(segment.s1, segment.s2)} x1={x1} y1={y1} x2={x2} y2={y2} className="terminal-route-line" />;
              })}
              {map.stations.map(station => {
                const [x, y] = POSITIONS[station.id];
                const start = phase === 'planning' && station.id === gameData?.startStationId;
                const destination = phase === 'planning' && station.id === gameData?.destinationStationId;
                const hovered = phase === 'planning' && hoveredStations.has(station.id);
                return (
                  <g key={station.id} className={`terminal-station ${start ? 'start' : ''} ${destination ? 'destination' : ''} ${hovered ? 'hovered' : ''}`}>
                    <circle cx={x} cy={y} r={hovered ? 2.2 : 1.7} />
                    <text x={x} y={y + 4.5} textAnchor="middle">{station.name}</text>
                  </g>
                );
              })}
            </svg>
          </section>

          <aside className="terminal-control-panel">
            {phase === 'setup' && (
              <div className="terminal-brief">
                <span>MISSION BRIEF</span>
                <h2>Study the Network</h2>
                <ol>
                  <li>Memorize line colors and interchanges.</li>
                  <li>The lines disappear when planning begins.</li>
                  <li>Select segments from the complete list.</li>
                  <li>Reach the destination within 90 seconds.</li>
                </ol>
                <div className="terminal-legend">
                  {map.lines.map(line => <span key={line.id}><i style={{ background: COLORS[line.name] }} />{line.name}</span>)}
                </div>
              </div>
            )}

            {phase === 'planning' && (
              <>
                <div className="terminal-objective">
                  <span><small>START</small>{stationName(map.stations, gameData.startStationId)}</span>
                  <i>→</i>
                  <span><small>DESTINATION</small>{stationName(map.stations, gameData.destinationStationId)}</span>
                </div>
                <div className="terminal-segments-heading">
                  <span>ALL NETWORK SEGMENTS</span>
                  <small>SELECTED {route.length}</small>
                </div>
                <div className="terminal-segments">
                  {gameData.segments.map(segment => {
                    const key = segmentKey(segment.s1, segment.s2);
                    const selected = used.has(key);
                    return (
                      <button
                        key={key}
                        className={`${selected ? 'selected' : ''} ${hoveredKey === key ? 'hovered' : ''}`}
                        disabled={selected}
                        onMouseEnter={() => setHoveredKey(key)}
                        onMouseLeave={() => setHoveredKey(null)}
                        onClick={() => onSelectSegment(segment)}
                      >
                        <b>{order.get(key) ? String(order.get(key)).padStart(2, '0') : '—'}</b>
                        <span>{stationName(map.stations, segment.s1)}</span>
                        <i>—</i>
                        <span>{stationName(map.stations, segment.s2)}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {phase === 'execution' && (
              <div className="terminal-journey">
                <span>JOURNEY IN PROGRESS · {visibleSteps}/{result?.steps?.length || 0}</span>
                <h2>{currentStep?.event.description || 'Preparing journey events...'}</h2>
                {currentStep && (
                  <div>
                    <strong className={currentStep.event.effect < 0 ? 'negative' : 'positive'}>
                      {currentStep.event.effect >= 0 ? '+' : ''}{currentStep.event.effect}
                    </strong>
                    <b>{currentStep.coins} <small>COINS</small></b>
                  </div>
                )}
              </div>
            )}

            {phase === 'result' && (
              <div className={`terminal-result ${result?.valid ? 'success' : 'failure'}`}>
                <span>{result?.valid ? 'ROUTE ACCEPTED' : 'ROUTE REJECTED'}</span>
                <strong>{result?.finalScore ?? 0}</strong>
                <small>FINAL COINS</small>
              </div>
            )}

            <button
              className="terminal-action"
              disabled={actionDisabled}
              onClick={phase === 'setup' ? onReady : phase === 'planning' ? onSubmit : onReset}
            >
              {actionLabel}
            </button>
          </aside>
        </div>
      </article>
    </section>
  );
}
