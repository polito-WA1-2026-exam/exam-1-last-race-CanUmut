import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const WIDTH = 1200;
const HEIGHT = 800;
const TEXTURE_SCALE = 1.5;
const MAP = { left: 48, top: 80, width: 780, height: 610 };
const BUTTON = { left: 850, top: 650, width: 305, height: 105 };
const POSITIONS = {
  1: [12, 22], 2: [31, 22], 3: [51, 22], 4: [72, 22],
  5: [31, 43], 6: [51, 43], 7: [72, 43], 8: [52, 64],
  9: [31, 78], 10: [82, 58], 11: [82, 75], 12: [92, 88]
};
const COLORS = {
  'M1 Red': '#e05d55',
  'M2 Turquoise': '#44c7b4',
  'M3 Blue': '#607be4',
  'M3 Blue Branch': '#71a8e2'
};

const stationName = (stations, id) =>
  stations.find(station => station.id === Number(id))?.name || `Station ${id}`;
const toScreen = id => {
  const [x, y] = POSITIONS[id];
  return [MAP.left + x / 100 * MAP.width, MAP.top + y / 100 * MAP.height];
};

function label(context, value, x, y, {
  color = '#c8efd5',
  size = 22,
  weight = 700,
  align = 'left',
  family = '"Courier New", monospace'
} = {}) {
  context.fillStyle = color;
  context.font = `${weight} ${size}px ${family}`;
  context.textAlign = align;
  context.textBaseline = 'middle';
  context.fillText(value, x, y);
}

function createTexture(draw) {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH * TEXTURE_SCALE;
  canvas.height = HEIGHT * TEXTURE_SCALE;
  const context = canvas.getContext('2d');
  context.scale(TEXTURE_SCALE, TEXTURE_SCALE);
  draw(context);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 8;
  texture.generateMipmaps = false;
  return texture;
}

export default function TerminalScreen({
  map,
  selectedLevel,
  phase,
  gameData,
  route,
  activeStation,
  availableStationIds,
  result,
  onReady,
  onSelectStation,
  onSubmit,
  onReset,
  setPrompt
}) {
  const mesh = useRef();
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const center = useMemo(() => new THREE.Vector2(0, 0), []);
  const { camera } = useThree();
  const [hoveredStation, setHoveredStation] = useState(null);
  const [hoveredButton, setHoveredButton] = useState(false);
  const hoveredStationRef = useRef(null);
  const hoveredButtonRef = useRef(false);
  const available = useMemo(() => new Set(availableStationIds), [availableStationIds]);
  const buttonLabel =
    phase === 'setup' ? 'INITIALIZE MISSION' :
      phase === 'planning' ? 'LOCK ROUTE' :
        phase === 'result' ? 'NEW SHIFT' : 'JOURNEY ACTIVE';
  const buttonDisabled = phase === 'execution' || (phase === 'planning' && !route.length);

  const texture = useMemo(() => createTexture(context => {
    const gradient = context.createLinearGradient(0, 0, 0, HEIGHT);
    gradient.addColorStop(0, '#061410');
    gradient.addColorStop(1, '#0b241b');
    context.fillStyle = gradient;
    context.fillRect(0, 0, WIDTH, HEIGHT);

    context.strokeStyle = 'rgba(64, 132, 96, .14)';
    context.lineWidth = 2;
    for (let x = 0; x < WIDTH; x += 40) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, HEIGHT);
      context.stroke();
    }
    for (let y = 0; y < HEIGHT; y += 40) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(WIDTH, y);
      context.stroke();
    }

    context.fillStyle = 'rgba(2, 12, 9, .78)';
    context.fillRect(20, 18, WIDTH - 40, 54);
    label(context, 'LAST RACE // ROUTE CONTROL', 40, 45, { color: '#e6c963', size: 25 });
    label(context, `${selectedLevel.toUpperCase()} NETWORK`, 1142, 45, {
      color: '#8ed8a6', size: 19, align: 'right'
    });

    context.fillStyle = 'rgba(3, 17, 12, .82)';
    context.fillRect(28, 88, 820, 650);
    context.fillRect(864, 88, 304, 650);
    context.strokeStyle = '#418761';
    context.lineWidth = 3;
    context.strokeRect(28, 88, 820, 650);
    context.strokeRect(864, 88, 304, 650);

    const connection = (from, to, color, width = 8) => {
      const [x1, y1] = toScreen(from);
      const [x2, y2] = toScreen(to);
      context.save();
      context.strokeStyle = color;
      context.lineWidth = width;
      context.lineCap = 'round';
      context.shadowColor = color;
      context.shadowBlur = 12;
      context.beginPath();
      context.moveTo(x1, y1);
      context.lineTo(x2, y2);
      context.stroke();
      context.restore();
    };

    if (phase === 'setup') {
      map.lines.forEach(line => line.stationIds.slice(0, -1).forEach((id, index) => {
        connection(id, line.stationIds[index + 1], COLORS[line.name]);
      }));
    } else {
      route.forEach(segment => connection(segment.s1, segment.s2, '#edca5c', 10));
    }

    map.stations.forEach(station => {
      const [x, y] = toScreen(station.id);
      const canVisit = available.has(station.id);
      const active = phase === 'planning' && station.id === activeStation;
      const destination = phase === 'planning' && station.id === gameData?.destinationStationId;
      const hovered = station.id === hoveredStation;
      const disabled = phase === 'planning' && !canVisit && !active;
      let fill = '#0d221a';
      let stroke = '#c3efd1';
      if (disabled) [fill, stroke] = ['#14201b', '#52645b'];
      if (destination) [fill, stroke] = ['#702729', '#ff7169'];
      if (active) [fill, stroke] = ['#235f41', '#72f0a2'];
      if (canVisit) [fill, stroke] = hovered
        ? ['#84651f', '#ffe787']
        : ['#59481e', '#e3c45e'];

      context.save();
      context.fillStyle = fill;
      context.strokeStyle = stroke;
      context.lineWidth = hovered ? 6 : 4;
      context.shadowColor = stroke;
      context.shadowBlur = disabled ? 0 : hovered ? 25 : 12;
      context.beginPath();
      context.arc(x, y, hovered ? 19 : 15, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.restore();
      label(context, station.name, x, y + 31, {
        color: disabled ? '#617169' : '#d7eadc',
        size: 17,
        align: 'center',
        family: '"Segoe UI", sans-serif'
      });
    });

    label(context, phase === 'setup' ? 'NETWORK OVERVIEW' : 'ROUTE RECONSTRUCTION', 884, 119, {
      color: '#e6c963', size: 18
    });
    context.strokeStyle = '#315d49';
    context.beginPath();
    context.moveTo(884, 145);
    context.lineTo(1148, 145);
    context.stroke();

    if (phase === 'setup') {
      label(context, 'MISSION BRIEF', 884, 183, { color: '#91d9aa', size: 18 });
      [
        'Study the network.',
        'Lines vanish after start.',
        'Choose connected stations.',
        'Reach the target in 90s.'
      ].forEach((line, index) => label(context, line, 884, 228 + index * 45, {
        color: '#b6c9bd', size: 16, weight: 500
      }));
      label(context, 'CROSSHAIR OPERATED TERMINAL', 884, 448, { color: '#6f8f7c', size: 14 });
    } else if (phase === 'planning') {
      const field = (name, value, y, color = '#d9eee0') => {
        label(context, name, 884, y, { color: '#708d7c', size: 13 });
        label(context, value, 884, y + 29, { color, size: 19 });
      };
      field('START', stationName(map.stations, gameData?.startStationId), 177);
      field('DESTINATION', stationName(map.stations, gameData?.destinationStationId), 250, '#ff7770');
      field('CURRENT POSITION', stationName(map.stations, activeStation), 323, '#75e9a0');
      label(context, 'AVAILABLE CONNECTIONS', 884, 405, { color: '#e6c963', size: 15 });
      availableStationIds.slice(0, 5).forEach((id, index) => {
        const hovered = id === hoveredStation;
        context.fillStyle = hovered ? 'rgba(229, 197, 88, .22)' : 'rgba(49, 91, 70, .35)';
        context.fillRect(880, 429 + index * 40, 272, 31);
        label(context, `> ${stationName(map.stations, id)}`, 892, 445 + index * 40, {
          color: hovered ? '#ffe889' : '#bbd9c4', size: 16
        });
      });
      label(context, `SEGMENTS LOCKED: ${route.length}`, 884, 642, { color: '#718e7d', size: 14 });
    } else {
      const valid = Boolean(result?.valid);
      label(context, valid ? 'ROUTE ACCEPTED' : 'ROUTE REJECTED', 1016, 220, {
        color: valid ? '#76efa4' : '#ff6b64', size: 25, align: 'center'
      });
      label(context, String(result?.finalScore ?? 0), 1016, 335, {
        color: '#e6c75e', size: 84, align: 'center'
      });
      label(context, 'COINS', 1016, 402, { color: '#88a394', size: 18, align: 'center' });
      label(context, result?.message || 'SHIFT REPORT COMPLETE', 1016, 475, {
        color: '#b8cec0', size: 14, align: 'center'
      });
    }

    context.fillStyle = buttonDisabled ? '#26352f' : hoveredButton ? '#c29a35' : '#947128';
    context.strokeStyle = buttonDisabled ? '#53635b' : '#f0d475';
    context.lineWidth = 4;
    context.shadowColor = buttonDisabled ? 'transparent' : '#d7b74e';
    context.shadowBlur = hoveredButton ? 22 : 10;
    context.fillRect(BUTTON.left, BUTTON.top, BUTTON.width, BUTTON.height);
    context.strokeRect(BUTTON.left, BUTTON.top, BUTTON.width, BUTTON.height);
    context.shadowBlur = 0;
    label(context, buttonLabel, BUTTON.left + BUTTON.width / 2, BUTTON.top + BUTTON.height / 2, {
      color: buttonDisabled ? '#6c7972' : '#07140f', size: 20, align: 'center'
    });

    context.fillStyle = 'rgba(134, 255, 174, .035)';
    for (let y = 0; y < HEIGHT; y += 5) context.fillRect(0, y, WIDTH, 1);
  }), [
    map, selectedLevel, phase, gameData, route, activeStation, available,
    availableStationIds, result, hoveredStation, hoveredButton, buttonLabel, buttonDisabled
  ]);

  useEffect(() => () => texture.dispose(), [texture]);

  const pointFromUv = uv => ({ x: uv.x * WIDTH, y: (1 - uv.y) * HEIGHT });
  const stationAt = ({ x, y }) => map.stations.find(station => {
    const [sx, sy] = toScreen(station.id);
    return Math.hypot(x - sx, y - sy) <= 38;
  });
  const isButton = ({ x, y }) =>
    x >= BUTTON.left && x <= BUTTON.left + BUTTON.width &&
    y >= BUTTON.top && y <= BUTTON.top + BUTTON.height;

  const crosshairHit = () => {
    if (!mesh.current) return null;
    raycaster.setFromCamera(center, camera);
    return raycaster.intersectObject(mesh.current, false)[0] || null;
  };

  const updateHover = cursor => {
    const station = cursor ? stationAt(cursor) : null;
    const stationId = phase === 'planning' && station && available.has(station.id) ? station.id : null;
    const button = Boolean(cursor && isButton(cursor) && !buttonDisabled);
    if (hoveredStationRef.current !== stationId) {
      hoveredStationRef.current = stationId;
      setHoveredStation(stationId);
    }
    if (hoveredButtonRef.current !== button) {
      hoveredButtonRef.current = button;
      setHoveredButton(button);
    }
    if (stationId) setPrompt(`TRAVEL TO ${station.name.toUpperCase()}`);
    else if (button) setPrompt(buttonLabel);
    else if (cursor) setPrompt('ROUTE CONTROL TERMINAL');
    else setPrompt('');
  };

  useFrame(() => {
    if (!document.pointerLockElement) return;
    const hit = crosshairHit();
    updateHover(hit?.uv ? pointFromUv(hit.uv) : null);
  });

  useEffect(() => {
    const activate = event => {
      if (event.button !== 0 || !document.pointerLockElement) return;
      const hit = crosshairHit();
      if (!hit?.uv) return;
      const cursor = pointFromUv(hit.uv);
      const station = stationAt(cursor);
      if (phase === 'planning' && station && available.has(station.id)) {
        onSelectStation(station.id);
        return;
      }
      if (!isButton(cursor) || buttonDisabled) return;
      if (phase === 'setup') onReady();
      else if (phase === 'planning') onSubmit();
      else if (phase === 'result') onReset();
    };
    window.addEventListener('mousedown', activate);
    return () => window.removeEventListener('mousedown', activate);
  });

  return (
    <mesh ref={mesh} position={[0, 0, 0.11]}>
      <planeGeometry args={[4.7, 3.02]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}
