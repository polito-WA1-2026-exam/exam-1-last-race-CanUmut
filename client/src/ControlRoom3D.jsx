import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { PointerLockControls as ThreePointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import TerminalScreen from './TerminalScreen.jsx';

const API = 'http://localhost:3001/api';
const stationName = (stations, id) =>
  stations.find(station => station.id === Number(id))?.name || `Station ${id}`;
const segmentKey = (s1, s2) => [s1, s2].sort((a, b) => a - b).join('-');

function RoundedBox({ args, children, ...props }) {
  return (
    <mesh {...props}>
      <boxGeometry args={args} />
      {children}
    </mesh>
  );
}

function FirstPersonLook({ onLockChange }) {
  const { camera, gl } = useThree();

  useEffect(() => {
    const controls = new ThreePointerLockControls(camera, gl.domElement);
    const lock = () => controls.lock();
    const handleLock = () => onLockChange(true);
    const handleUnlock = () => onLockChange(false);
    const lockFromCanvas = () => {
      if (!document.pointerLockElement) lock();
    };
    const lockFromMenu = () => lock();
    gl.domElement.addEventListener('click', lockFromCanvas);
    window.addEventListener('last-race-continue', lockFromMenu);
    controls.addEventListener('lock', handleLock);
    controls.addEventListener('unlock', handleUnlock);
    controls.connect();
    return () => {
      gl.domElement.removeEventListener('click', lockFromCanvas);
      window.removeEventListener('last-race-continue', lockFromMenu);
      controls.removeEventListener('lock', handleLock);
      controls.removeEventListener('unlock', handleUnlock);
      controls.disconnect();
      controls.dispose();
    };
  }, [camera, gl, onLockChange]);

  return null;
}

function useFirstPersonMovement() {
  const { camera } = useThree();
  const keys = useRef(new Set());
  const forward = useMemo(() => new THREE.Vector3(), []);
  const right = useMemo(() => new THREE.Vector3(), []);
  const movement = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    const down = event => keys.current.add(event.key.toLowerCase());
    const up = event => keys.current.delete(event.key.toLowerCase());
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  useFrame((_, delta) => {
    if (!document.pointerLockElement) return;
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    right.crossVectors(forward, camera.up).normalize();
    movement.set(0, 0, 0);

    if (keys.current.has('w') || keys.current.has('arrowup')) movement.add(forward);
    if (keys.current.has('s') || keys.current.has('arrowdown')) movement.sub(forward);
    if (keys.current.has('d') || keys.current.has('arrowright')) movement.add(right);
    if (keys.current.has('a') || keys.current.has('arrowleft')) movement.sub(right);

    if (movement.lengthSq()) {
      movement.normalize().multiplyScalar(3.4 * delta);
      const nextX = THREE.MathUtils.clamp(camera.position.x + movement.x, -5.7, 5.7);
      const nextZ = THREE.MathUtils.clamp(camera.position.z + movement.z, -3.7, 5.3);
      const hitsConsole = nextZ < -0.72;
      if (!hitsConsole) {
        camera.position.x = nextX;
        camera.position.z = nextZ;
      }
      camera.position.y = 2.25;
    }
  });
}

function useLabelTexture(text, {
  color = '#d8f7e1',
  background = 'rgba(11, 31, 25, .82)',
  border = '#72c991',
  fontSize = 54,
  width = 640,
  height = 150
} = {}) {
  return useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, width, height);
    context.fillStyle = background;
    context.fillRect(8, 8, width - 16, height - 16);
    context.strokeStyle = border;
    context.lineWidth = 7;
    context.strokeRect(8, 8, width - 16, height - 16);
    context.fillStyle = color;
    context.font = `700 ${fontSize}px "Courier New", monospace`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, width / 2, height / 2 + 2, width - 36);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    return texture;
  }, [text, color, background, border, fontSize, width, height]);
}

function HologramLabel({ text, position, scale = [0.85, 0.2, 1], disabled = false }) {
  const texture = useLabelTexture(text, {
    color: disabled ? '#77837d' : '#b8f4ca',
    background: disabled ? 'rgba(22, 31, 28, .55)' : 'rgba(7, 37, 27, .78)',
    border: disabled ? '#56615c' : '#60c985'
  });

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <sprite position={position} scale={scale}>
      <spriteMaterial map={texture} transparent depthWrite={false} opacity={disabled ? 0.45 : 0.95} />
    </sprite>
  );
}

function StaticLabel({ text, position, size = [1.2, 0.24], disabled = false }) {
  const texture = useLabelTexture(text, {
    color: disabled ? '#77837d' : '#b8f4ca',
    background: disabled ? 'rgba(22, 31, 28, .7)' : 'rgba(7, 37, 27, .94)',
    border: disabled ? '#56615c' : '#60c985'
  });
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh position={position}>
      <planeGeometry args={size} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} />
    </mesh>
  );
}

function createPanelTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  draw(context, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

function PanelPlane({ texture, size, position = [0, 0, 0.1] }) {
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh position={position}>
      <planeGeometry args={size} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

function InteractionMesh({ children, onActivate, prompt, setPrompt, ...props }) {
  const [hovered, setHovered] = useState(false);
  return (
    <group
      {...props}
      onClick={event => {
        event.stopPropagation();
        onActivate?.();
      }}
      onPointerEnter={event => {
        event.stopPropagation();
        setHovered(true);
        setPrompt(prompt);
      }}
      onPointerLeave={() => {
        setHovered(false);
        setPrompt('');
      }}
      scale={hovered ? 1.035 : 1}
    >
      {children}
    </group>
  );
}

function CrosshairInteraction({ children, onActivate, prompt, setPrompt, ...props }) {
  const group = useRef();
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const center = useMemo(() => new THREE.Vector2(0, 0), []);
  const { camera } = useThree();
  const hovered = useRef(false);

  const isTargeted = () => {
    if (!group.current) return false;
    raycaster.setFromCamera(center, camera);
    return raycaster.intersectObject(group.current, true).length > 0;
  };

  useFrame(() => {
    if (!document.pointerLockElement) return;
    const targeted = isTargeted();
    if (targeted !== hovered.current) {
      hovered.current = targeted;
      setPrompt(targeted ? prompt : '');
    }
  });

  useEffect(() => {
    const activate = event => {
      if (event.button === 0 && document.pointerLockElement && isTargeted()) onActivate?.();
    };
    window.addEventListener('mousedown', activate);
    return () => window.removeEventListener('mousedown', activate);
  });

  return <group ref={group} {...props}>{children}</group>;
}

const DIGIT_SEGMENTS = {
  0: ['a', 'b', 'c', 'd', 'e', 'f'],
  1: ['b', 'c'],
  2: ['a', 'b', 'g', 'e', 'd'],
  3: ['a', 'b', 'c', 'd', 'g'],
  4: ['f', 'g', 'b', 'c'],
  5: ['a', 'f', 'g', 'c', 'd'],
  6: ['a', 'f', 'g', 'e', 'c', 'd'],
  7: ['a', 'b', 'c'],
  8: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
  9: ['a', 'b', 'c', 'd', 'f', 'g']
};
const SEGMENT_LAYOUT = {
  a: [0, 0.42, 0, 0.48, 0.075],
  b: [0.25, 0.21, 0, 0.075, 0.36],
  c: [0.25, -0.21, 0, 0.075, 0.36],
  d: [0, -0.42, 0, 0.48, 0.075],
  e: [-0.25, -0.21, 0, 0.075, 0.36],
  f: [-0.25, 0.21, 0, 0.075, 0.36],
  g: [0, 0, 0, 0.48, 0.075]
};

function DigitalDigit({ value, position, danger }) {
  const active = new Set(DIGIT_SEGMENTS[value] || []);
  return (
    <group position={position}>
      {Object.entries(SEGMENT_LAYOUT).map(([name, [x, y, z, width, height]]) => (
        <mesh key={name} position={[x, y, z]}>
          <boxGeometry args={[width, height, 0.055]} />
          <meshStandardMaterial
            color={active.has(name) ? (danger ? '#ff594f' : '#e6d45e') : '#202a26'}
            emissive={active.has(name) ? (danger ? '#d12f28' : '#aa8e20') : '#000000'}
            emissiveIntensity={active.has(name) ? 1.6 : 0}
            roughness={0.5}
          />
        </mesh>
      ))}
    </group>
  );
}

function WallClock({ phase, timeLeft }) {
  const display = phase === 'planning' ? String(timeLeft).padStart(2, '0') : '90';
  const danger = phase === 'planning' && timeLeft <= 20;
  return (
    <group position={[0, 4.85, -4.78]}>
      <RoundedBox args={[2.8, 1.25, 0.18]} radius={0.08} castShadow>
        <meshStandardMaterial color={danger ? '#4a2220' : '#101815'} roughness={0.55} />
      </RoundedBox>
      <DigitalDigit value={Number(display[0])} position={[-0.43, -0.08, 0.13]} danger={danger} />
      <DigitalDigit value={Number(display[1])} position={[0.43, -0.08, 0.13]} danger={danger} />
      <StaticLabel
        text={phase === 'planning' ? 'ROUTE WINDOW' : 'SHIFT CLOCK'}
        position={[0, 0.5, 0.16]}
        size={[1.2, 0.19]}
      />
    </group>
  );
}

function RankingWall({ rankings, selectedLevel, setPrompt, onOpenRanking }) {
  const texture = useMemo(() => createPanelTexture(900, 760, (context, width, height) => {
    context.fillStyle = '#14231e';
    context.fillRect(0, 0, width, height);
    context.strokeStyle = '#8a764c';
    context.lineWidth = 22;
    context.strokeRect(12, 12, width - 24, height - 24);
    context.fillStyle = '#d5bb63';
    context.font = '700 28px "Courier New"';
    context.fillText('EMPLOYEE OF THE MONTH', 65, 85);
    context.fillStyle = '#eef2ed';
    context.font = '800 55px "Segoe UI"';
    context.fillText(`${selectedLevel.toUpperCase()} CONTROL`, 65, 155);
    rankings.slice(0, 5).forEach((rank, index) => {
      const y = 245 + index * 92;
      context.strokeStyle = '#40534b';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(60, y - 42);
      context.lineTo(width - 60, y - 42);
      context.stroke();
      context.fillStyle = '#d5bb63';
      context.font = '700 31px "Courier New"';
      context.fillText(String(index + 1).padStart(2, '0'), 70, y);
      context.fillStyle = '#e7ede8';
      context.font = '700 35px "Courier New"';
      context.fillText(rank.username, 180, y);
      context.fillStyle = '#9dccaa';
      context.textAlign = 'right';
      context.fillText(String(rank.best_score), width - 75, y);
      context.textAlign = 'left';
    });
    if (!rankings.length) {
      context.fillStyle = '#91a198';
      context.font = '600 31px "Courier New"';
      context.fillText('NO COMPLETED SHIFTS', 65, 270);
    }
  }), [rankings, selectedLevel]);

  return (
    <CrosshairInteraction
      position={[4.72, 1.48, -3.18]}
      rotation={[-Math.PI / 3.15, 0, 0]}
      prompt={`OPEN ${selectedLevel.toUpperCase()} RANKING`}
      setPrompt={setPrompt}
      onActivate={onOpenRanking}
    >
      <RoundedBox args={[2.65, 1.92, 0.14]} radius={0.08} castShadow>
        <meshStandardMaterial color="#24332f" roughness={0.78} />
      </RoundedBox>
      <PanelPlane texture={texture} size={[2.43, 1.7]} position={[0, 0, 0.09]} />
    </CrosshairInteraction>
  );
}

function LevelWall({ selectedLevel, phase, onSelectLevel, setPrompt }) {
  const levels = [
    { name: 'Ankara', difficulty: 'EASY', online: true },
    { name: 'Istanbul', difficulty: 'MEDIUM', online: true },
    { name: 'London', difficulty: 'HARD', online: true }
  ];
  const texture = useMemo(() => createPanelTexture(900, 760, (context, width) => {
    context.fillStyle = '#1b2b25';
    context.fillRect(0, 0, 900, 760);
    context.strokeStyle = '#8a764c';
    context.lineWidth = 22;
    context.strokeRect(12, 12, 876, 736);
    context.fillStyle = '#d5bb63';
    context.font = '700 28px "Courier New"';
    context.fillText('NETWORK ASSIGNMENTS', 65, 85);
    context.fillStyle = '#eef2ed';
    context.font = '800 55px "Segoe UI"';
    context.fillText('SELECT LEVEL', 65, 155);
    levels.forEach((level, index) => {
      const y = 255 + index * 130;
      context.fillStyle = level.name === selectedLevel ? '#31483e' : '#202f2a';
      context.fillRect(55, y - 62, width - 110, 92);
      if (level.name === selectedLevel) {
        context.fillStyle = '#d0b85d';
        context.fillRect(55, y - 62, 12, 92);
      }
      context.fillStyle = level.online ? '#eef2ed' : '#738078';
      context.font = '800 38px "Segoe UI"';
      context.fillText(level.name.toUpperCase(), 90, y - 7);
      context.fillStyle = level.online ? '#a5b6ab' : '#666f69';
      context.font = '700 24px "Courier New"';
      context.textAlign = 'right';
      context.fillText(`${level.difficulty} · ${level.online ? 'ONLINE' : 'LOCKED'}`, width - 85, y - 7);
      context.textAlign = 'left';
    });
  }), [selectedLevel]);

  return (
    <group position={[-4.72, 1.48, -3.18]} rotation={[-Math.PI / 3.15, 0, 0]}>
      <RoundedBox args={[2.65, 1.92, 0.14]} radius={0.08} castShadow>
        <meshStandardMaterial color="#2d4039" roughness={0.8} />
      </RoundedBox>
      <PanelPlane texture={texture} size={[2.43, 1.7]} position={[0, 0, 0.09]} />
      {[
        { level: 'Ankara', y: 0.28 },
        { level: 'Istanbul', y: -0.02 },
        { level: 'London', y: -0.31 }
      ].map(item => (
        <CrosshairInteraction
          key={item.level}
          position={[0, item.y, 0.14]}
          onActivate={phase === 'setup' ? () => onSelectLevel(item.level) : undefined}
          prompt={phase === 'setup' ? `SELECT ${item.level.toUpperCase()} NETWORK` : 'FINISH THE CURRENT SHIFT FIRST'}
          setPrompt={setPrompt}
        >
          <mesh>
            <planeGeometry args={[2.25, 0.25]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        </CrosshairInteraction>
      ))}
    </group>
  );
}

function BoardTrack({ from, to, color }) {
  const [x1, , z1] = toTable(from);
  const [x2, , z2] = toTable(to);
  const start = new THREE.Vector3(x1, 0, z1);
  const end = new THREE.Vector3(x2, 0, z2);
  const midpoint = start.clone().add(end).multiplyScalar(0.5);
  const direction = end.clone().sub(start);
  const length = direction.length();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize()
  );
  return (
    <mesh position={[midpoint.x, 1.12, midpoint.z]} quaternion={quaternion}>
      <cylinderGeometry args={[0.025, 0.025, length, 10]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.7} roughness={0.4} />
    </mesh>
  );
}

function StationToken({
  station,
  active,
  available,
  destination,
  disabled,
  onSelect,
  setPrompt
}) {
  const [x, , z] = toTable(station.id);
  const color = active ? '#5d8a68' : destination ? '#ad4943' : available ? '#d8a847' : '#d7d1c2';
  return (
    <InteractionMesh
      position={[x, 1.16, z]}
      onActivate={available ? () => onSelect(station.id) : undefined}
      prompt={available ? `TRAVEL TO ${station.name.toUpperCase()}` : station.name.toUpperCase()}
      setPrompt={setPrompt}
    >
      {available && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]}>
          <ringGeometry args={[0.12, 0.16, 24]} />
          <meshBasicMaterial color="#f2c754" transparent opacity={0.9} />
        </mesh>
      )}
      <mesh castShadow>
        <cylinderGeometry args={[0.1, 0.115, 0.075, 20]} />
        <meshStandardMaterial
          color={color}
          emissive={disabled ? '#000000' : color}
          emissiveIntensity={available || active || destination ? 0.75 : 0.25}
          roughness={0.55}
          transparent
          opacity={disabled ? 0.18 : 0.92}
        />
      </mesh>
      <HologramLabel
        text={station.name}
        position={[0, 0.22, 0]}
        scale={[0.64, 0.15, 1]}
        disabled={disabled}
      />
    </InteractionMesh>
  );
}

function ReadyButton({ phase, disabled, onReady, onSubmit, onReset, setPrompt }) {
  const action = phase === 'setup' ? onReady : phase === 'planning' ? onSubmit : phase === 'result' ? onReset : undefined;
  const label = phase === 'setup' ? 'READY' : phase === 'planning' ? 'LOCK ROUTE' : phase === 'result' ? 'NEW SHIFT' : 'JOURNEY';
  const inactive = disabled || phase === 'execution';
  return (
    <InteractionMesh
      position={[0, 1.17, 1.48]}
      onActivate={inactive ? undefined : action}
      prompt={inactive ? (phase === 'execution' ? 'JOURNEY IN PROGRESS' : 'SELECT AT LEAST ONE SEGMENT') : label}
      setPrompt={setPrompt}
    >
      <mesh castShadow>
        <boxGeometry args={[1.1, 0.12, 0.42]} />
        <meshStandardMaterial
          color={inactive ? '#39443f' : '#a9463f'}
          emissive={inactive ? '#000000' : '#6d1f1a'}
          emissiveIntensity={inactive ? 0 : 0.7}
          roughness={0.45}
        />
      </mesh>
      <HologramLabel text={label} position={[0, 0.18, 0]} scale={[0.9, 0.2, 1]} disabled={inactive} />
    </InteractionMesh>
  );
}

function LegacyGameTable({
  map,
  selectedLevel,
  phase,
  gameData,
  route,
  activeStation,
  availableStationIds,
  result,
  visibleSteps,
  onReady,
  onSelectStation,
  onSubmit,
  onReset,
  setPrompt
}) {
  const usedKeys = new Set(route.map(segment => segmentKey(segment.s1, segment.s2)));
  return (
    <group position={[0, 0, 0.2]}>
      <RoundedBox args={[5.3, 0.28, 3.8]} radius={0.12} position={[0, 0.82, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#263630" roughness={0.75} />
      </RoundedBox>
      <RoundedBox args={[4.95, 0.08, 3.45]} radius={0.08} position={[0, 0.99, 0]} receiveShadow>
        <meshStandardMaterial color="#d8d6c7" roughness={0.92} />
      </RoundedBox>
      <mesh position={[0, 1.045, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4.72, 3.2]} />
        <meshStandardMaterial
          color="#2a8f6a"
          emissive="#174c39"
          emissiveIntensity={0.45}
          transparent
          opacity={0.16}
          depthWrite={false}
        />
      </mesh>
      {[-2.15, 2.15].map(x => (
        <mesh key={x} position={[x, 0.4, 0]} castShadow>
          <boxGeometry args={[0.18, 0.85, 3.1]} />
          <meshStandardMaterial color="#202d29" />
        </mesh>
      ))}

      <HologramLabel
        text={`${selectedLevel.toUpperCase()} · ${phase === 'setup' ? 'STUDY MAP' : phase === 'planning' ? 'BUILD ROUTE' : 'SHIFT REPORT'}`}
        position={[-1.55, 1.32, -1.38]}
        scale={[1.6, 0.25, 1]}
      />

      {phase === 'setup' && map.lines.map(line =>
        line.stationIds.slice(0, -1).map((stationId, index) => (
          <BoardTrack
            key={`${line.id}-${stationId}`}
            from={stationId}
            to={line.stationIds[index + 1]}
            color={LINE_COLORS[line.name]}
          />
        ))
      )}

      {phase === 'planning' && route.map(segment => (
        <BoardTrack key={segmentKey(segment.s1, segment.s2)} from={segment.s1} to={segment.s2} color="#d6b24d" />
      ))}

      {map.stations.map(station => (
        <StationToken
          key={station.id}
          station={station}
          active={phase === 'planning' && station.id === activeStation}
          available={phase === 'planning' && availableStationIds.includes(station.id)}
          destination={phase === 'planning' && station.id === gameData?.destinationStationId}
          disabled={phase === 'planning' && station.id !== activeStation && !availableStationIds.includes(station.id)}
          onSelect={onSelectStation}
          setPrompt={setPrompt}
        />
      ))}

      {phase === 'planning' && (
        <HologramLabel
          text={`${stationName(map.stations, gameData.startStationId)}  >  ${stationName(map.stations, gameData.destinationStationId)}`}
          position={[0.65, 1.34, -1.38]}
          scale={[1.55, 0.24, 1]}
        />
      )}

      {(phase === 'execution' || phase === 'result') && (
        <>
          <HologramLabel
            text={result?.valid ? 'ROUTE COMPLETED' : 'ROUTE REJECTED'}
            position={[0, 1.48, -0.18]}
            scale={[1.65, 0.28, 1]}
          />
          <HologramLabel
            text={`${result?.finalScore ?? 0} COINS`}
            position={[0, 1.27, 0.18]}
            scale={[1.25, 0.25, 1]}
          />
        </>
      )}

      <ReadyButton
        phase={phase}
        disabled={phase === 'planning' && !route.length}
        onReady={onReady}
        onSubmit={onSubmit}
        onReset={onReset}
        setPrompt={setPrompt}
      />
    </group>
  );
}

function GameTable({ phase, route, setPrompt, onOpenGame }) {
  const texture = useMemo(() => createPanelTexture(1100, 720, context => {
    const gradient = context.createLinearGradient(0, 0, 0, 720);
    gradient.addColorStop(0, '#071812');
    gradient.addColorStop(1, '#0b2a1e');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 1100, 720);
    context.strokeStyle = '#4b9369';
    context.lineWidth = 10;
    context.strokeRect(20, 20, 1060, 680);
    context.fillStyle = '#d5bb5e';
    context.font = '800 28px "Courier New"';
    context.fillText('LAST RACE // ROUTE TERMINAL', 65, 82);
    context.fillStyle = '#edf2ed';
    context.font = '900 72px "Segoe UI"';
    context.fillText(
      phase === 'setup' ? 'BEGIN MISSION' :
        phase === 'planning' ? 'ROUTE IN PROGRESS' :
          phase === 'execution' ? 'JOURNEY ACTIVE' : 'SHIFT COMPLETE',
      65,
      205
    );
    context.fillStyle = '#8eaa99';
    context.font = '600 29px "Courier New"';
    context.fillText(
      phase === 'setup'
        ? 'Open the terminal to study the network and start your shift.'
        : phase === 'planning'
          ? `${route.length} SEGMENTS SELECTED // OPEN TO CONTINUE`
          : phase === 'execution'
            ? 'Journey events are being processed.'
            : 'Open the terminal to review your result or begin a new shift.',
      65,
      275
    );
    context.fillStyle = '#9a762b';
    context.fillRect(65, 500, 970, 125);
    context.strokeStyle = '#efd36c';
    context.lineWidth = 6;
    context.strokeRect(65, 500, 970, 125);
    context.fillStyle = '#07130e';
    context.font = '900 42px "Courier New"';
    context.textAlign = 'center';
    context.fillText('OPEN ROUTE TERMINAL', 550, 565);
    context.textAlign = 'left';
  }), [phase, route.length]);

  return (
    <group>
      <RoundedBox args={[12.45, 0.28, 3.25]} radius={0.12} position={[0, 0.78, -2.45]} castShadow receiveShadow>
        <meshStandardMaterial color="#263630" roughness={0.75} />
      </RoundedBox>
      <RoundedBox args={[12.08, 0.08, 2.98]} radius={0.08} position={[0, 0.95, -2.45]} receiveShadow>
        <meshStandardMaterial color="#17241f" roughness={0.84} />
      </RoundedBox>
      {[-5.65, -2.7, 2.7, 5.65].map(x => (
        <mesh key={x} position={[x, 0.38, -2.45]} castShadow>
          <boxGeometry args={[0.2, 0.8, 2.55]} />
          <meshStandardMaterial color="#202d29" />
        </mesh>
      ))}

      <group position={[0, 1.45, -2.4]} rotation={[-Math.PI / 2 + 0.22, 0, 0]}>
        <RoundedBox args={[4.85, 3.22, 0.14]} radius={0.11} castShadow>
          <meshStandardMaterial color="#111b17" metalness={0.36} roughness={0.48} />
        </RoundedBox>
        <CrosshairInteraction
          position={[0, 0, 0.11]}
          prompt="OPEN ROUTE TERMINAL"
          setPrompt={setPrompt}
          onActivate={onOpenGame}
        >
          <PanelPlane texture={texture} size={[4.7, 3.02]} position={[0, 0, 0]} />
        </CrosshairInteraction>
      </group>

      <ConsoleClutter />
    </group>
  );
}

function ConsoleClutter() {
  return (
    <group>
      <group position={[-3.3, 1.06, -1.42]}>
        {['#bf473f', '#d3a940', '#4c9c6b', '#5579a9'].map((color, index) => (
          <mesh key={color} position={[index * 0.27, 0, 0]} castShadow>
            <cylinderGeometry args={[0.075, 0.09, 0.06, 20]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} />
          </mesh>
        ))}
      </group>

      <group position={[3.25, 1.08, -1.48]} rotation={[0, -0.12, 0]}>
        <mesh castShadow>
          <boxGeometry args={[1.05, 0.14, 0.62]} />
          <meshStandardMaterial color="#1d2824" metalness={0.35} roughness={0.52} />
        </mesh>
        <mesh position={[0, 0.21, 0]} rotation={[0, 0, -0.25]} castShadow>
          <cylinderGeometry args={[0.045, 0.06, 0.42, 14]} />
          <meshStandardMaterial color="#767d76" metalness={0.7} roughness={0.28} />
        </mesh>
        <mesh position={[-0.1, 0.43, 0]} castShadow>
          <sphereGeometry args={[0.11, 18, 12]} />
          <meshStandardMaterial color="#302c27" roughness={0.72} />
        </mesh>
      </group>

      <group position={[5.45, 1.12, -2.05]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.2, 0.17, 0.35, 24]} />
          <meshStandardMaterial color="#d5c8a2" roughness={0.82} />
        </mesh>
        <mesh position={[0.22, 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.13, 0.035, 10, 20]} />
          <meshStandardMaterial color="#d5c8a2" />
        </mesh>
      </group>

      <group position={[-5.1, 1.03, -2.05]} rotation={[0, 0.17, 0]}>
        {[0, 0.025, 0.05].map((height, index) => (
          <mesh key={height} position={[0, height, index * 0.035]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.95, 0.62]} />
            <meshStandardMaterial color={index === 2 ? '#d9d0b7' : '#bdb69f'} roughness={0.95} />
          </mesh>
        ))}
      </group>

      <group position={[4.05, 1.06, -3.7]}>
        <mesh castShadow>
          <boxGeometry args={[0.72, 0.18, 0.46]} />
          <meshStandardMaterial color="#202b27" roughness={0.72} />
        </mesh>
        <mesh position={[0, 0.18, -0.05]} rotation={[0.25, 0, 0]}>
          <boxGeometry args={[0.5, 0.16, 0.07]} />
          <meshStandardMaterial color="#344e41" emissive="#173b2a" emissiveIntensity={0.5} />
        </mesh>
        <mesh position={[0.28, 0.26, 0]} rotation={[0, 0, -0.2]}>
          <cylinderGeometry args={[0.018, 0.018, 0.55, 8]} />
          <meshStandardMaterial color="#686d68" metalness={0.6} />
        </mesh>
      </group>
    </group>
  );
}

function EventWall({ phase, result, visibleSteps }) {
  const currentStep = phase === 'execution' ? result?.steps?.[visibleSteps - 1] : null;
  const headline = currentStep?.event.description || (phase === 'result' ? 'SHIFT COMPLETE' : 'STANDING BY');
  const change = currentStep
    ? `${currentStep.event.effect >= 0 ? '+' : ''}${currentStep.event.effect}`
    : phase === 'result' ? 'FINAL' : '--';
  const balance = currentStep
    ? `${currentStep.coins} COINS`
    : phase === 'result' ? `${result?.finalScore ?? 0} COINS` : 'NO ACTIVE EVENT';
  const texture = useMemo(() => createPanelTexture(1000, 390, context => {
    context.fillStyle = '#07110e';
    context.fillRect(0, 0, 1000, 390);
    context.strokeStyle = '#344b41';
    context.lineWidth = 18;
    context.strokeRect(9, 9, 982, 372);
    context.fillStyle = '#708e7a';
    context.font = '700 25px "Courier New"';
    context.fillText('JOURNEY MONITOR', 55, 65);
    context.fillStyle = '#e1e8e1';
    context.font = '700 36px "Courier New"';
    const words = headline.toUpperCase().split(' ');
    const lines = [];
    let line = '';
    words.forEach(word => {
      const test = `${line} ${word}`.trim();
      if (context.measureText(test).width > 860 && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    });
    if (line) lines.push(line);
    lines.slice(0, 3).forEach((text, index) => context.fillText(text, 55, 135 + index * 48));
    context.fillStyle = currentStep?.event.effect < 0 ? '#e6675e' : '#79d99c';
    context.font = '900 58px "Courier New"';
    context.fillText(change, 55, 330);
    context.fillStyle = '#708e7a';
    context.font = '700 22px "Courier New"';
    context.fillText('CURRENT BALANCE', 250, 302);
    context.fillStyle = '#dbc365';
    context.font = '900 39px "Courier New"';
    context.fillText(balance, 250, 342);
  }), [headline, change, balance, currentStep]);

  return (
    <group position={[0, 2.12, -4.02]} rotation={[-0.32, 0, 0]}>
      <RoundedBox args={[3.4, 1.3, 0.12]} radius={0.06}>
        <meshStandardMaterial color="#111a18" />
      </RoundedBox>
      <PanelPlane texture={texture} size={[3.15, 1.12]} position={[0, 0, 0.075]} />
    </group>
  );
}

function ExitDoor() {
  return (
    <group position={[6.64, 1.65, -1.7]} rotation={[0, -Math.PI / 2, 0]}>
      <mesh castShadow>
        <boxGeometry args={[2.15, 3.3, 0.18]} />
        <meshStandardMaterial color="#53362d" roughness={0.88} />
      </mesh>
      <mesh position={[-0.62, 0, 0.13]}>
        <sphereGeometry args={[0.07, 14, 10]} />
        <meshStandardMaterial color="#a88755" metalness={0.65} roughness={0.3} />
      </mesh>
    </group>
  );
}

function MountainView() {
  const texture = useMemo(() => createPanelTexture(1600, 620, (context, width, height) => {
    const sky = context.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#7694a2');
    sky.addColorStop(0.58, '#b9c7bf');
    sky.addColorStop(1, '#d7c69e');
    context.fillStyle = sky;
    context.fillRect(0, 0, width, height);

    const sun = context.createRadialGradient(1210, 145, 8, 1210, 145, 150);
    sun.addColorStop(0, 'rgba(255,239,178,.95)');
    sun.addColorStop(0.25, 'rgba(246,218,147,.45)');
    sun.addColorStop(1, 'rgba(246,218,147,0)');
    context.fillStyle = sun;
    context.fillRect(1030, 0, 360, 330);

    const ridge = (points, color) => {
      context.beginPath();
      context.moveTo(0, height);
      points.forEach(([x, y]) => context.lineTo(x, y));
      context.lineTo(width, height);
      context.closePath();
      context.fillStyle = color;
      context.fill();
    };

    ridge([
      [0, 390], [150, 300], [270, 350], [420, 235], [570, 350],
      [735, 255], [910, 350], [1080, 270], [1270, 360], [1430, 275], [1600, 350]
    ], '#73827b');
    ridge([
      [0, 455], [170, 370], [310, 430], [500, 320], [690, 445],
      [875, 345], [1040, 435], [1230, 335], [1400, 425], [1600, 350]
    ], '#4f645a');
    ridge([
      [0, 520], [190, 460], [390, 500], [590, 405], [790, 505],
      [980, 420], [1180, 500], [1380, 410], [1600, 480]
    ], '#2e493d');

    context.fillStyle = '#1d342b';
    context.fillRect(0, 520, width, 100);
    context.fillStyle = 'rgba(205,219,199,.34)';
    for (let index = 0; index < 34; index += 1) {
      const x = (index * 137) % width;
      const y = 500 + (index % 4) * 16;
      context.beginPath();
      context.arc(x, y, 3 + (index % 3), 0, Math.PI * 2);
      context.fill();
    }
  }), []);

  return (
    <mesh position={[0, 3.55, -5.35]}>
      <planeGeometry args={[11.7, 3.75]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

function RoomScene(props) {
  useFirstPersonMovement();
  return (
    <>
      <color attach="background" args={['#101715']} />
      <fog attach="fog" args={['#101715', 10, 24]} />
      <ambientLight intensity={1.18} />
      <hemisphereLight args={['#c9d3c7', '#25302b', 1.35]} />
      <directionalLight position={[-4, 8, 5]} intensity={1.7} color="#d8c997" />
      <MountainView />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[14, 11]} />
        <meshStandardMaterial color="#29332f" roughness={0.94} />
      </mesh>
      <mesh position={[0, 3.55, -5]} receiveShadow>
        <boxGeometry args={[11.9, 3.9, 0.08]} />
        <meshStandardMaterial
          color="#172b29"
          roughness={0.26}
          metalness={0.08}
          transparent
          opacity={0.38}
        />
      </mesh>
      <mesh position={[0, 0.72, -5]} receiveShadow>
        <boxGeometry args={[14, 1.45, 0.28]} />
        <meshStandardMaterial color="#394740" roughness={0.9} />
      </mesh>
      <mesh position={[0, 5.82, -5]} receiveShadow>
        <boxGeometry args={[14, 0.76, 0.3]} />
        <meshStandardMaterial color="#35423c" roughness={0.84} />
      </mesh>
      {[-6.1, 0, 6.1].map(x => (
        <mesh key={x} position={[x, 3.55, -4.92]} receiveShadow>
          <boxGeometry args={[0.28, 4.45, 0.32]} />
          <meshStandardMaterial color="#283630" metalness={0.28} roughness={0.62} />
        </mesh>
      ))}
      <mesh position={[0, 3.55, -5.18]}>
        <planeGeometry args={[11.7, 3.75]} />
        <meshBasicMaterial
          color="#d7e2db"
          transparent
          opacity={0.035}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, 3.0, -5.28]}>
        <planeGeometry args={[10.8, 0.035]} />
        <meshBasicMaterial color="#86b6a5" transparent opacity={0.22} />
      </mesh>
      <mesh position={[-6.8, 3.2, 0]} receiveShadow>
        <boxGeometry args={[0.24, 6.4, 10]} />
        <meshStandardMaterial color="#46534d" roughness={0.96} />
      </mesh>
      <mesh position={[6.8, 3.2, 0]} receiveShadow>
        <boxGeometry args={[0.24, 6.4, 10]} />
        <meshStandardMaterial color="#46534d" roughness={0.96} />
      </mesh>

      <WallClock phase={props.phase} timeLeft={props.timeLeft} />
      {props.map && <GameTable {...props} />}
      <LevelWall selectedLevel={props.selectedLevel} phase={props.phase} onSelectLevel={props.onSelectLevel} setPrompt={props.setPrompt} />
      <RankingWall rankings={props.rankings} selectedLevel={props.selectedLevel} setPrompt={props.setPrompt} onOpenRanking={props.onOpenRanking} />
      <EventWall phase={props.phase} result={props.result} visibleSteps={props.visibleSteps} />
      <ExitDoor />
      <FirstPersonLook onLockChange={props.onLockChange} />
    </>
  );
}

function playTick(audioContextRef) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  if (!audioContextRef.current) audioContextRef.current = new AudioContextClass();
  const context = audioContextRef.current;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'square';
  oscillator.frequency.value = 760;
  gain.gain.setValueAtTime(0.025, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.035);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.04);
}

function RankingPage({ rankings, selectedLevel, onClose }) {
  return (
    <section className="ranking-page">
      <article>
        <header><span>ANKARA METRO OPERATIONS</span><button onClick={onClose}>ESC · CLOSE</button></header>
        <h2>Global Ranking</h2>
        <p>Each operator is listed with the best score achieved on the {selectedLevel} level.</p>
        <div className="ranking-list">
          {rankings.length ? rankings.map((rank, index) => (
            <div className="ranking-entry" key={rank.username}>
              <span>#{String(index + 1).padStart(2, '0')}</span>
              <b>{rank.username}</b>
              <strong>{rank.best_score} <small>COINS</small></strong>
            </div>
          )) : <div className="ranking-empty">NO COMPLETED SHIFTS</div>}
        </div>
      </article>
    </section>
  );
}

export default function ControlRoom3D({
  onLogout,
  rankingOpen,
  gameOpen,
  onOpenRanking,
  onCloseRanking,
  onOpenGame,
  onCloseGame
}) {
  const [map, setMap] = useState(null);
  const [rankings, setRankings] = useState([]);
  const [selectedLevel, setSelectedLevel] = useState('Ankara');
  const [phase, setPhase] = useState('setup');
  const [gameData, setGameData] = useState(null);
  const [route, setRoute] = useState([]);
  const [timeLeft, setTimeLeft] = useState(90);
  const [result, setResult] = useState(null);
  const [visibleSteps, setVisibleSteps] = useState(0);
  const [prompt, setPrompt] = useState('');
  const [paused, setPaused] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [quality, setQuality] = useState('balanced');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const audioContext = useRef(null);
  const submitted = useRef(false);
  const hasControlled = useRef(false);
  const overlayOpening = useRef(false);

  const loadRanking = () =>
    fetch(`${API}/ranking?level=${selectedLevel}`, { credentials: 'include' })
      .then(response => response.json())
      .then(data => setRankings(data.rankings || []))
      .catch(() => setRankings([]));

  useEffect(() => {
    fetch(`${API}/map?level=${selectedLevel}`, { credentials: 'include' })
      .then(response => response.json())
      .then(setMap)
      .catch(() => setMap(null));
  }, [selectedLevel]);
  useEffect(() => {
    loadRanking();
  }, [selectedLevel]);
  const handleLockChange = React.useCallback(locked => {
    if (locked) {
      hasControlled.current = true;
      setPaused(false);
      setSettingsOpen(false);
    } else if (hasControlled.current && !overlayOpening.current) {
      setPaused(true);
    }
  }, []);

  const openRanking = React.useCallback(() => {
    overlayOpening.current = true;
    if (document.pointerLockElement) document.exitPointerLock();
    onOpenRanking();
  }, [onOpenRanking]);

  const closeRanking = React.useCallback(() => {
    overlayOpening.current = false;
    hasControlled.current = false;
    onCloseRanking();
  }, [onCloseRanking]);

  const openGame = React.useCallback(() => {
    overlayOpening.current = true;
    if (document.pointerLockElement) document.exitPointerLock();
    onOpenGame();
  }, [onOpenGame]);

  const closeGame = React.useCallback(() => {
    overlayOpening.current = false;
    hasControlled.current = false;
    onCloseGame();
  }, [onCloseGame]);

  useEffect(() => {
    if (!rankingOpen) return;
    const closeOnEscape = event => {
      if (event.key === 'Escape') closeRanking();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [rankingOpen, closeRanking]);

  useEffect(() => {
    if (!gameOpen) return;
    const closeOnEscape = event => {
      if (event.key === 'Escape') closeGame();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [gameOpen, closeGame]);

  const submitRoute = async () => {
    if (submitted.current || phase !== 'planning') return;
    submitted.current = true;
    try {
      const response = await fetch(`${API}/game/validate`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ route })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Route validation failed');
      setResult(data);
      setVisibleSteps(data.valid ? 1 : 0);
      setPhase(data.valid ? 'execution' : 'result');
    } catch (err) {
      submitted.current = false;
      setPrompt(err.message.toUpperCase());
    }
  };

  useEffect(() => {
    if (phase !== 'planning') return;
    if (timeLeft <= 0) {
      submitRoute();
      return;
    }
    const timer = setTimeout(() => {
      if (soundEnabled) playTick(audioContext);
      setTimeLeft(value => value - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [phase, timeLeft, soundEnabled]);

  useEffect(() => {
    if (phase !== 'execution' || !result?.valid || paused) return;
    if (visibleSteps >= result.steps.length) {
      const timer = setTimeout(() => {
        setPhase('result');
        loadRanking();
      }, 900);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => setVisibleSteps(value => value + 1), 1100);
    return () => clearTimeout(timer);
  }, [phase, visibleSteps, result, paused]);

  const startPlanning = async () => {
    try {
      const response = await fetch(`${API}/game/init?level=${selectedLevel}`, { credentials: 'include' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to initialize mission');
      setGameData(data);
      setRoute([]);
      setResult(null);
      setTimeLeft(data.durationSeconds || 90);
      submitted.current = false;
      setPhase('planning');
      if (soundEnabled) playTick(audioContext);
    } catch (err) {
      setPrompt(err.message.toUpperCase());
    }
  };

  const selectSegment = segment => {
    const key = segmentKey(segment.s1, segment.s2);
    setRoute(previous => (
      previous.some(item => segmentKey(item.s1, item.s2) === key)
        ? previous
        : [...previous, segment]
    ));
  };

  const resetShift = () => {
    setPhase('setup');
    setGameData(null);
    setRoute([]);
    setResult(null);
    setVisibleSteps(0);
    setTimeLeft(90);
    submitted.current = false;
  };

  const selectLevel = level => {
    if (phase !== 'setup' || level === selectedLevel) return;
    setSelectedLevel(level);
    setMap(null);
    setGameData(null);
    setRoute([]);
    setResult(null);
    setVisibleSteps(0);
    setTimeLeft(90);
    submitted.current = false;
  };

  return (
    <main className="control-room fps-room">
      <Canvas
        key={quality}
        frameloop={paused ? 'demand' : 'always'}
        camera={{ position: [0, 2.25, 3.45], fov: 74 }}
        dpr={quality === 'quality' ? 1 : 0.82}
        gl={{ antialias: quality === 'quality', powerPreference: 'high-performance', precision: 'highp' }}
        performance={{ min: 0.55 }}
      >
        <RoomScene
          map={map}
          rankings={rankings}
          selectedLevel={selectedLevel}
          onSelectLevel={selectLevel}
          phase={phase}
          gameData={gameData}
          route={route}
          result={result}
          visibleSteps={visibleSteps}
          timeLeft={timeLeft}
          onReady={startPlanning}
          onSelectSegment={selectSegment}
          onSubmit={submitRoute}
          onReset={resetShift}
          onLockChange={handleLockChange}
          onOpenRanking={openRanking}
          onOpenGame={openGame}
          setPrompt={setPrompt}
        />
      </Canvas>

      {paused && !rankingOpen && !gameOpen && (
        <section className="pause-menu">
          <div className="pause-logo">
            <span>ANKARA METRO OPERATIONS</span>
            <h1>LAST<br /><b>RACE</b></h1>
          </div>
          {!settingsOpen ? (
            <div className="pause-actions">
              <button className="pause-primary" onClick={() => window.dispatchEvent(new Event('last-race-continue'))}>CONTINUE</button>
              <button onClick={() => setSettingsOpen(true)}>SETTINGS</button>
              <button onClick={onLogout}>LOG OUT</button>
              <small>ESC PAUSES THE SHIFT · PROGRESS IS KEPT</small>
            </div>
          ) : (
            <div className="pause-settings">
              <header><b>SETTINGS</b><button onClick={() => setSettingsOpen(false)}>BACK</button></header>
              <label>
                RENDER QUALITY
                <span>
                  <button className={quality === 'balanced' ? 'active' : ''} onClick={() => setQuality('balanced')}>BALANCED</button>
                  <button className={quality === 'quality' ? 'active' : ''} onClick={() => setQuality('quality')}>HIGH</button>
                </span>
              </label>
              <label>
                TICK SOUND
                <button className={soundEnabled ? 'active' : ''} onClick={() => setSoundEnabled(value => !value)}>
                  {soundEnabled ? 'ON' : 'OFF'}
                </button>
              </label>
            </div>
          )}
        </section>
      )}
      {!paused && !rankingOpen && !gameOpen && <div className="fps-crosshair" aria-hidden="true" />}
      {!paused && !rankingOpen && !gameOpen && <div className="fps-prompt">{prompt || (hasControlled.current ? 'LOOK AROUND THE DRIVER CABIN' : 'CLICK TO TAKE CONTROL')}</div>}
      {gameOpen && map && (
        <TerminalScreen
          map={map}
          selectedLevel={selectedLevel}
          phase={phase}
          gameData={gameData}
          route={route}
          result={result}
          visibleSteps={visibleSteps}
          timeLeft={timeLeft}
          onReady={startPlanning}
          onSelectSegment={selectSegment}
          onSubmit={submitRoute}
          onReset={resetShift}
          onClose={closeGame}
        />
      )}
      {rankingOpen && <RankingPage rankings={rankings} selectedLevel={selectedLevel} onClose={closeRanking} />}
    </main>
  );
}
