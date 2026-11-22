import {
 BufferGeometry, Color, DoubleSide, DynamicDrawUsage, ExtrudeGeometry, Float32BufferAttribute, Group,
 InstancedMesh, LatheGeometry, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial,
 Quaternion, Shape, SphereGeometry, Vector2, Vector3,
} from 'three';

const UP = new Vector3(0, 1, 0);
const EAST = new Vector3(1, 0, 0);
const FRONT = new Vector3(0, 0, 1);
const UNIT = new Vector3(1, 1, 1);
const MARGIN = .0002;
const COLORS = { water: [0x18d9bf, 0x9bf7fe], air: [0xffb558, 0xffe4b9] };
const PRESET_COLORS = { viscous: [0xffad46, 0xffc16b], mist: [0x9cc4ff, 0xbcccfb] };
const TRACE_COLORS = [0x316eee, 0x22d9f0, 0x58e186, 0xffb14f].map(color => new Color(color));

function routeFor(points, traceValues) {
 const vertices = [new Vector3().fromArray(points[0])];
 const distances = [0];
 const values = traceValues ? [traceValues[0]] : null;
 for (let i = 1; i < points.length; i++) {
  const v = new Vector3().fromArray(points[i]);
  const length = vertices.at(-1).distanceTo(v);
  if (length <= 1e-9) continue;
  vertices.push(v);
  distances.push(distances.at(-1) + length);
  values?.push(traceValues[i]);
 }
 if (vertices.length < 2) throw new RangeError('Director flow needs a nonzero path.');
 return { vertices, distances, values, length: distances.at(-1) };
}

function segmentAt(distances, distance, direction) {
 let lo = 0, hi = distances.length - 1;
 while (hi - lo > 1) {
  const mid = Math.floor((lo + hi) / 2);
  if (distance > distances[mid] || (distance === distances[mid] && direction > 0)) lo = mid;
  else hi = mid;
 }
 return lo;
}

function sample(route, distance, direction, position, tangent) {
 const { vertices, distances } = route;
 const lo = segmentAt(distances, distance, direction), hi = lo + 1;
 const span = distances[hi] - distances[lo];
 position.lerpVectors(vertices[lo], vertices[hi], (distance - distances[lo]) / span);
 if (tangent) tangent.subVectors(vertices[hi], vertices[lo]).multiplyScalar(direction / span);
}

function signedDistance(point, plane) {
 return point.dot(plane.normal) - plane.origin;
}

function stopLimit(route, stage, plane, margin) {
 const { vertices, distances, length } = route;
 const { direction, stop } = stage;
 let index = direction > 0 ? 0 : vertices.length - 1;
 const toSeat = direction > 0 ? stop.distance : length - stop.distance;
 let previousProgress = 0;
 let previousClearance = signedDistance(vertices[index], plane) - margin;
 if (previousClearance <= 0 || toSeat <= 0) return 0;

 // Follow the contiguous safe path from the emitting end. A bend may reach the
 // seat's half-space boundary before the explicit seat point along the route.
 for (index += direction; index >= 0 && index < vertices.length; index += direction) {
  const progress = direction > 0 ? distances[index] : length - distances[index];
  const end = Math.min(progress, toSeat);
  const clearance = progress >= toSeat ? -margin : signedDistance(vertices[index], plane) - margin;
  if (clearance < 0) {
   return previousProgress + (end - previousProgress) * previousClearance / (previousClearance - clearance);
  }
  previousProgress = end;
  previousClearance = clearance;
 }
 return 0;
}

function sameStop(a, b) {
 return a === b || Boolean(a && b && a.distance === b.distance && a.normal.every((value, i) => value === b.normal[i]));
}

function stagesFor(track, route, effects) {
 const stages = [];
 for (const stage of track.stages) {
  const previous = stages.at(-1);
  const continuous = previous && previous.end === stage.start &&
   previous.direction === stage.direction && sameStop(previous.stop, stage.stop);
  let plane = null;
  if (stage.stop) {
   const seat = new Vector3();
   sample(route, stage.stop.distance, stage.direction, seat);
   const normal = new Vector3().fromArray(stage.stop.normal).normalize().multiplyScalar(-stage.direction);
   plane = { normal, origin: normal.dot(seat) };
  }
  const limits = effects.map(({ radius, spread }) =>
   plane ? stopLimit(route, stage, plane, radius + spread + MARGIN) : route.length);
  stages.push({
   ...stage, plane, limits,
   offset: continuous ? previous.offset + previous.speed * (previous.end - previous.start) : 0,
  });
 }
 return stages;
}

function seedUnit(seed, index) {
 let hash = Math.imul(seed ^ (index + 1), 0x9e3779b1);
 hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b);
 return ((hash ^ (hash >>> 13)) >>> 0) / 4294967296;
}

function lathe(profile) {
 return new LatheGeometry(profile.map(([x, y]) => new Vector2(x, y)), 12);
}

function arrowGeometry(style) {
 if (style !== 'schematic') return lathe([[0, -.20], [.036, -.20], [.036, .026], [.119, .026], [0, .202]]);
 const outline = [[-.074, -.21], [.074, -.21], [.074, .027], [.171, .027],
  [0, .236], [-.171, .027], [-.074, .027]];
 const shape = new Shape(outline.map(([x, y]) => new Vector2(x, y)));
 return new ExtrudeGeometry(shape, { depth: .018, bevelEnabled: false }).translate(0, 0, -.009);
}

function particleGeometry(shape) {
 switch (shape) {
  case 'bead': return new SphereGeometry(.045, 8, 6);
  case 'viscous': return new SphereGeometry(1, 16, 12).scale(.092, .175, .092);
  case 'mist': return new SphereGeometry(1, 12, 8).scale(.097, .073, .097);
  default: return lathe([[0, -.089], [.029, -.049], [.056, -.015], [.065, .018], [.048, .056], [.022, .072], [0, .077]]);
 }
}

function appearanceFor(track) {
 const appearance = track.appearance ?? {};
 const shape = appearance.shape ?? (track.medium === 'water' ? 'drop' : 'bead');
 const colors = PRESET_COLORS[shape] ?? COLORS[track.medium];
 return {
  ...appearance, shape,
  arrowColor: appearance.arrowColor ?? colors[0],
  particleColor: appearance.particleColor ?? colors[1],
 };
}

function effectFor(particle, count, track) {
 const appearance = appearanceFor(track);
 const { shape } = appearance;
 const mist = shape === 'mist';
 const geometry = particle ? particleGeometry(shape) : arrowGeometry(appearance.arrowStyle);
 const color = particle ? appearance.particleColor : appearance.arrowColor;
 const opacity = appearance.opacity ?? (mist ? .34 : 1);
 const translucent = mist || opacity < 1;
 const material = particle
  ? new MeshStandardMaterial({
   color, emissive: color, emissiveIntensity: .32, roughness: .60, opacity,
   transparent: translucent, depthWrite: !translucent,
  })
  : new MeshBasicMaterial({ color, toneMapped: false });
 const mesh = new InstancedMesh(geometry, material, count);
 mesh.name = particle ? 'particles' : 'arrows';
 mesh.count = 0;
 mesh.frustumCulled = false;
 mesh.instanceMatrix.setUsage(DynamicDrawUsage);

 // Bound every vertex about the animated origin, independent of arrow heading.
 const vertices = geometry.getAttribute('position');
 const vertex = new Vector3();
 let radius = 0;
 for (let i = 0; i < vertices.count; i++) {
  radius = Math.max(radius, vertex.fromBufferAttribute(vertices, i).length());
 }
 const spread = particle ? .14 : 0;
 const scatter = particle ? Array.from({ length: count }, (_, i) => {
  const angle = seedUnit(track.seed, i * 3 + 200) * Math.PI * 2;
  const distance = spread * Math.sqrt(seedUnit(track.seed, i * 3 + 201));
  return {
   sideways: distance * Math.cos(angle),
   vertical: distance * Math.sin(angle),
   phase: .36 * seedUnit(track.seed, i * 3 + 202),
  };
 }) : [];
 return {
  mesh, count, radius, spread,
  offset: seedUnit(track.seed, particle ? 142 : 26),
  scatter,
 };
}

function traceColorAt(route, distance, color) {
 const { distances, values } = route;
 const i = segmentAt(distances, distance, 1);
 const t = (distance - distances[i]) / (distances[i + 1] - distances[i]);
 const value = values[i] + (values[i + 1] - values[i]) * t;
 const ramp = value * (TRACE_COLORS.length - 1);
 const index = Math.min(Math.floor(ramp), TRACE_COLORS.length - 2);
 return color.copy(TRACE_COLORS[index]).lerp(TRACE_COLORS[index + 1], ramp - index);
}

function traceDistances(route, start, end) {
 const { distances, values } = route;
 const stops = [start, ...distances.filter(distance => distance > start && distance < end), end];
 if (!values) return stops;
 // Supply gradient knots even when two adjacent authored samples span the whole ramp.
 for (let i = 1; i < distances.length; i++) {
  if (distances[i - 1] >= end || distances[i] <= start || values[i - 1] === values[i]) continue;
  for (let channel = 1; channel < TRACE_COLORS.length - 1; channel++) {
   const value = channel / (TRACE_COLORS.length - 1);
   const t = (value - values[i - 1]) / (values[i] - values[i - 1]);
   if (t <= 0 || t >= 1) continue;
   const distance = distances[i - 1] + (distances[i] - distances[i - 1]) * t;
   if (distance > start && distance < end) stops.push(distance);
  }
 }
 return stops.sort((a, b) => a - b);
}

function traceGeometry(route, stage, radius, sides) {
 const span = stage.plane ? stopLimit(route, stage, stage.plane, radius + MARGIN) : route.length;
 if (span <= 0) return null;
 const start = stage.direction > 0 ? 0 : route.length - span;
 const end = stage.direction > 0 ? span : route.length;
 const distances = traceDistances(route, start, end);
 const centres = distances.map(distance => {
  const point = new Vector3();
  sample(route, distance, 1, point);
  return point;
 });
 const positions = [], colors = [], indices = [];
 const tangent = new Vector3(), across = new Vector3(), outside = new Vector3(), point = new Vector3();
 const previousTangent = new Vector3(), turn = new Quaternion();
 const color = new Color();
 for (let i = 0; i < centres.length; i++) {
  const centre = centres[i], behind = centres[Math.max(0, i - 1)], ahead = centres[Math.min(i + 1, centres.length - 1)];
  tangent.subVectors(ahead, behind);
  if (tangent.lengthSq() < 1e-12) tangent.subVectors(ahead, centre);
  tangent.normalize();
  if (i === 0) {
   across.crossVectors(FRONT, tangent);
   if (across.lengthSq() < 1e-8) across.crossVectors(UP, tangent);
  } else if (previousTangent.dot(tangent) + 1 < 1e-8) {
   // Preserve the width axis when a reversal has no unique rotation axis.
   across.addScaledVector(tangent, -across.dot(tangent));
  } else {
   across.applyQuaternion(turn.setFromUnitVectors(previousTangent, tangent));
  }
  across.normalize();
  outside.crossVectors(tangent, across);
  previousTangent.copy(tangent);
  if (route.values) traceColorAt(route, distances[i], color);
  for (let j = 0; j < sides; j++) {
   const angle = j * Math.PI * 2 / sides;
   point.copy(centre).addScaledVector(across, Math.cos(angle) * radius)
    .addScaledVector(outside, Math.sin(angle) * radius);
   positions.push(point.x, point.y, point.z);
   if (route.values) colors.push(color.r, color.g, color.b);
  }
 }
 const faces = sides === 2 ? 1 : sides;
 for (let i = 1; i < centres.length; i++) {
  for (let j = 0; j < faces; j++) {
   const next = (j + 1) % sides;
   const a = (i - 1) * sides + j, b = (i - 1) * sides + next;
   const c = i * sides + j, d = i * sides + next;
   indices.push(a, c, b, b, c, d);
  }
 }
 const geometry = new BufferGeometry();
 geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
 if (route.values) geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
 geometry.setIndex(indices);
 geometry.computeBoundingSphere();
 return geometry;
}

function createTrace(track, route, stages) {
 const appearance = appearanceFor(track);
 if (!appearance.trace) return null;
 const ribbon = appearance.trace === 'ribbon';
 const geometries = stages.map(stage => traceGeometry(route, stage, ribbon ? .092 : .019, ribbon ? 2 : 6));
 const first = geometries.find(Boolean);
 if (!first) return null;
 const material = new MeshBasicMaterial({
  color: route.values ? 0xffffff : appearance.particleColor,
  vertexColors: Boolean(route.values), opacity: ribbon ? .48 : 1,
  transparent: ribbon, depthWrite: !ribbon, side: DoubleSide, forceSinglePass: true, toneMapped: false,
 });
 const mesh = new Mesh(first, material);
 mesh.name = appearance.trace;
 mesh.visible = false;
 return {
  mesh,
  update(index) {
   const geometry = geometries[index];
   mesh.visible = Boolean(geometry);
   if (geometry) mesh.geometry = geometry;
   return mesh.visible;
  },
  dispose() {
   mesh.visible = false;
   for (const geometry of geometries) geometry?.dispose();
   geometries.length = 0;
   material.dispose();
  },
 };
}

export function createDirectorFlow(track) {
 const root = new Group();
 root.name = 'director-flow-' + track.id;
 root.visible = false;
 const route = routeFor(track.points, track.traceValues);
 const effects = [];
 if (track.arrows && track.arrowCount > 0) effects.push(effectFor(false, track.arrowCount, track));
 if (track.particles && track.particleCount > 0) effects.push(effectFor(true, track.particleCount, track));
 for (const { mesh } of effects) root.add(mesh);
 const stages = stagesFor(track, route, effects);
 const trace = createTrace(track, route, stages);
 if (trace) root.add(trace.mesh);
 const position = new Vector3(), tangent = new Vector3();
 const sideways = new Vector3(), vertical = new Vector3();
 const rotation = new Quaternion(), matrix = new Matrix4();
 let disposed = false;

 function update(time) {
  if (disposed) return;
  const stageIndex = stages.findIndex(({ start, end }) => start <= time && time < end);
  const stage = stages[stageIndex];
  root.visible = trace?.update(stageIndex) ?? false;
  for (const [index, effect] of effects.entries()) {
   const { mesh, count, radius, offset, scatter } = effect;
   mesh.count = 0;
   const span = stage?.limits[index] ?? 0;
   if (span <= 0) continue;
   const motion = stage.offset + stage.speed * (time - stage.start);
   const spacing = route.length / count;
   const stoppedSpacing = Math.max(spacing, radius * 2);
   const lead = Math.min(span * (.38 + offset * .20) + motion, span);
   for (let i = 0; i < count; i++) {
    const particle = scatter[i];
    const progress = stage.plane
     ? lead - i * stoppedSpacing
     : ((i + offset + (particle?.phase ?? 0)) * spacing + motion) % span;
    if (progress < 0) break;
    const s = stage.direction > 0 ? progress : route.length - progress;
    sample(route, s, stage.direction, position, tangent);
    if (particle) {
     sideways.crossVectors(tangent, UP);
     if (sideways.lengthSq() < 1e-8) sideways.crossVectors(tangent, EAST);
     // Base the disk on the authored tangent, so reversing flips drops but not their transverse offsets.
     sideways.normalize().multiplyScalar(stage.direction);
     vertical.crossVectors(sideways, tangent).multiplyScalar(stage.direction);
     position.addScaledVector(sideways, particle.sideways).addScaledVector(vertical, particle.vertical);
    }
    if (stage.plane && signedDistance(position, stage.plane) < radius) continue;
    rotation.setFromUnitVectors(UP, tangent);
    mesh.setMatrixAt(mesh.count++, matrix.compose(position, rotation, UNIT));
   }
   if (mesh.count > 0) {
    mesh.instanceMatrix.needsUpdate = true;
    root.visible = true;
   }
  }
 }

 function dispose() {
  if (disposed) return;
  disposed = true;
  root.visible = false;
  root.removeFromParent();
  root.clear();
  trace?.dispose();
  for (const { mesh } of effects) {
   mesh.dispose();
   mesh.geometry.dispose();
   mesh.material.dispose();
  }
  effects.length = 0;
 }

 return { root, update, dispose };
}
