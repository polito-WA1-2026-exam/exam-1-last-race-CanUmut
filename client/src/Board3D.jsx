import React, { useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, Html, OrbitControls, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';

const LINE_COLORS = {
  'M1 Red': '#c94b43',
  'M2 Turquoise': '#3b9d91',
  'M3 Blue': '#465f9d',
  'M3 Blue Branch': '#6d89b8'
};

const STATION_POSITIONS = {
  1: [12, 22], 2: [31, 22], 3: [51, 22], 4: [72, 22],
  5: [31, 43], 6: [51, 43], 7: [72, 43], 8: [52, 64],
  9: [31, 78], 10: [82, 58], 11: [82, 75], 12: [92, 88]
};

const toWorld = stationId => {
  const [x, y] = STATION_POSITIONS[stationId];
  return [(x - 50) / 6.3, 0, (y - 52) / 8];
};

function Track({ from, to, color, raised = false }) {
  const start = new THREE.Vector3(...toWorld(from));
  const end = new THREE.Vector3(...toWorld(to));
  const midpoint = start.clone().add(end).multiplyScalar(0.5);
  const direction = end.clone().sub(start);
  const length = direction.length();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize()
  );

  return (
    <mesh
      position={[midpoint.x, raised ? 0.43 : 0.36, midpoint.z]}
      quaternion={quaternion}
      castShadow
      receiveShadow
    >
      <cylinderGeometry args={[raised ? 0.13 : 0.105, raised ? 0.13 : 0.105, length, 18]} />
      <meshStandardMaterial color={color} roughness={0.48} metalness={0.03} />
    </mesh>
  );
}

function StationPiece({
  station,
  lineCount,
  start,
  destination,
  active,
  available,
  visited,
  disabled,
  onSelect,
  onHover
}) {
  const [hovered, setHovered] = useState(false);
  const [x, , z] = toWorld(station.id);
  const interactive = Boolean(onSelect);
  let color = '#eadcc2';
  let edge = '#5c4935';

  if (destination) {
    color = '#b74c46';
    edge = '#74302d';
  }
  if (start || active) {
    color = '#64836b';
    edge = '#3c5943';
  } else if (visited) {
    color = '#c8b795';
  } else if (available) {
    color = hovered ? '#f1bf66' : '#e2a84d';
    edge = '#8b642b';
  }

  const opacity = disabled ? 0.26 : 1;
  const scale = hovered && available ? 1.15 : 1;

  return (
    <group
      position={[x, 0.39, z]}
      scale={scale}
      onClick={event => {
        event.stopPropagation();
        if (available) onSelect?.(station.id);
      }}
      onPointerEnter={event => {
        event.stopPropagation();
        setHovered(true);
        if (available) {
          document.body.style.cursor = 'pointer';
          onHover?.(station.id);
        }
      }}
      onPointerLeave={() => {
        setHovered(false);
        document.body.style.cursor = 'default';
        onHover?.(null);
      }}
    >
      {available && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.12, 0]}>
          <ringGeometry args={[0.38, 0.49, 32]} />
          <meshBasicMaterial color="#d89a3f" transparent opacity={hovered ? 0.9 : 0.55} />
        </mesh>
      )}
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[lineCount > 1 ? 0.34 : 0.28, lineCount > 1 ? 0.37 : 0.31, 0.22, 32]} />
        <meshStandardMaterial color={color} roughness={0.5} transparent opacity={opacity} />
      </mesh>
      <mesh position={[0, 0.13, 0]} castShadow>
        <cylinderGeometry args={[lineCount > 1 ? 0.24 : 0.19, lineCount > 1 ? 0.24 : 0.19, 0.035, 32]} />
        <meshStandardMaterial color={edge} roughness={0.65} transparent opacity={opacity} />
      </mesh>
      <Html position={[0, 0.3, 0.48]} rotation={[-Math.PI / 2, 0, 0]} center transform distanceFactor={7} style={{ pointerEvents: 'none' }}>
        <span className={`board-station-label ${disabled ? 'disabled' : ''}`}>{station.name}</span>
      </Html>
    </group>
  );
}

function BoardScene({
  map,
  connectionsVisible,
  route,
  startId,
  destinationId,
  activeStationId,
  availableStationIds,
  visitedStationIds,
  onStationSelect,
  onStationHover
}) {
  const available = useMemo(() => new Set(availableStationIds), [availableStationIds]);
  const visited = useMemo(() => new Set(visitedStationIds), [visitedStationIds]);
  const routeKeys = useMemo(
    () => new Set(route.map(({ s1, s2 }) => [s1, s2].sort((a, b) => a - b).join('-'))),
    [route]
  );
  const interactive = typeof onStationSelect === 'function';

  return (
    <>
      <ambientLight intensity={1.3} />
      <hemisphereLight args={['#fff1d5', '#76583a', 1.25]} />
      <directionalLight
        position={[-5, 11, 6]}
        intensity={2.6}
        color="#fff1d5"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <pointLight position={[6, 6, -5]} intensity={18} color="#e6c79b" distance={18} />

      <RoundedBox args={[17.4, 0.45, 12.2]} radius={0.25} smoothness={5} position={[0, -0.12, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#cdb98f" roughness={0.88} />
      </RoundedBox>
      <RoundedBox args={[16.7, 0.12, 11.5]} radius={0.18} smoothness={4} position={[0, 0.16, 0]} receiveShadow>
        <meshStandardMaterial color="#e9dcc0" roughness={0.95} />
      </RoundedBox>

      {connectionsVisible && map.lines.map(line =>
        line.stationIds.slice(0, -1).map((stationId, index) => {
          const nextId = line.stationIds[index + 1];
          const key = [stationId, nextId].sort((a, b) => a - b).join('-');
          return (
            <Track
              key={`${line.id}-${stationId}-${nextId}`}
              from={stationId}
              to={nextId}
              color={routeKeys.has(key) ? '#f4d28a' : LINE_COLORS[line.name]}
              raised={routeKeys.has(key)}
            />
          );
        })
      )}

      {map.stations.map(station => (
        <StationPiece
          key={station.id}
          station={station}
          lineCount={map.lines.filter(line => line.stationIds.includes(station.id)).length}
          start={station.id === startId}
          destination={station.id === destinationId}
          active={station.id === activeStationId}
          available={available.has(station.id)}
          visited={visited.has(station.id)}
          disabled={interactive && station.id !== activeStationId && !available.has(station.id)}
          onSelect={onStationSelect}
          onHover={onStationHover}
        />
      ))}

      {!connectionsVisible && (
        <Html position={[0, 0.28, -5.2]} rotation={[-Math.PI / 2, 0, 0]} center transform distanceFactor={7} style={{ pointerEvents: 'none' }}>
          <span className="board-message">LINES HIDDEN — CHOOSE YOUR NEXT STATION</span>
        </Html>
      )}

      <ContactShadows position={[0, -0.31, 0]} opacity={0.42} scale={22} blur={2.6} far={8} />
      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={11}
        maxDistance={16}
        minPolarAngle={0.72}
        maxPolarAngle={1.05}
        minAzimuthAngle={-0.28}
        maxAzimuthAngle={0.28}
        target={[0, 0, 0]}
      />
    </>
  );
}

export default function Board3D(props) {
  return (
    <div className="board-3d" aria-label="Interactive 3D underground board">
      <Canvas
        shadows
        dpr={[1, 1.6]}
        camera={{ position: [0, 11.8, 12.8], fov: 44 }}
        gl={{ antialias: true, alpha: true }}
      >
        <BoardScene {...props} />
      </Canvas>
      <div className="board-hint">Drag to tilt · Scroll to zoom · Click a highlighted station</div>
    </div>
  );
}
