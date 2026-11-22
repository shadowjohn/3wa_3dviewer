import {
 DynamicDrawUsage, Group, InstancedMesh, LatheGeometry, Matrix4, MeshBasicMaterial, MeshStandardMaterial,
 Quaternion, SphereGeometry, Vector2, Vector3,
} from 'three';

const UP = new Vector3(0, 1, 0);
const EAST = new Vector3(1, 0, 0);
const UNIT = new Vector3(1, 1, 1);
const MARGIN = .0002;
const COLORS = { water: [0x18d9bf, 0x9bf7fe], air: [0xffb558, 0xffe4b9] };
const PRESET_COLORS = { viscous: [0xffad46, 0xffc16b], mist: [0x9cc4ff, 0xbcccfb] };

function routeFor(points) {
 const vertices = [new Vector3().fromArray(points[0])];
 const distances = [0];
 for (const point of points.slice(1)) {
  const v = new Vector3().fromArray(point);
  const length = vertices.at(-1).distanceTo(v);
  if (length <= 1e-9) continue;
  vertices.push(v);
  distances.push(distances.at(-1) + length);
 }
 if (vertices.length < 2) throw new RangeError('Director flow needs a nonzero path.');
 return { vertices, distances, length: distances.at(-1) };
}

function sample(route, distance, direction, position, tangent) {
 const { vertices, distances } = route;
 let lo = 0, hi = vertices.length - 1;
 while (hi - lo > 1) {
  const mid = Math.floor((lo + hi) / 2);
  if (distance > distances[mid] || (distance === distances[mid] && direction > 0)) lo = mid;
  else hi = mid;
 }
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

function particleGeometry(shape) {
 switch (shape) {
  case 'bead': return new SphereGeometry(.045, 8, 6);
  case 'viscous': return new SphereGeometry(1, 16, 12).scale(.092, .175, .092);
  case 'mist': return new SphereGeometry(1, 12, 8).scale(.097, .073, .097);
  default: return lathe([[0, -.089], [.029, -.049], [.056, -.015], [.065, .018], [.048, .056], [.022, .072], [0, .077]]);
 }
}

function effectFor(particle, count, track) {
 const appearance = track.appearance;
 const shape = appearance?.shape ?? (track.medium === 'water' ? 'drop' : 'bead');
 const mist = shape === 'mist';
 const colors = PRESET_COLORS[shape] ?? COLORS[track.medium];
 const geometry = particle ? particleGeometry(shape)
  : lathe([[0, -.20], [.036, -.20], [.036, .026], [.119, .026], [0, .202]]);
 const color = particle ? (appearance?.particleColor ?? colors[1]) : (appearance?.arrowColor ?? colors[0]);
 const opacity = appearance?.opacity ?? (mist ? .34 : 1);
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

export function createDirectorFlow(track) {
 const root = new Group();
 root.name = 'director-flow-' + track.id;
 root.visible = false;
 const route = routeFor(track.points);
 const effects = [];
 if (track.arrows && track.arrowCount > 0) effects.push(effectFor(false, track.arrowCount, track));
 if (track.particles && track.particleCount > 0) effects.push(effectFor(true, track.particleCount, track));
 for (const { mesh } of effects) root.add(mesh);
 const stages = stagesFor(track, route, effects);
 const position = new Vector3(), tangent = new Vector3();
 const sideways = new Vector3(), vertical = new Vector3();
 const rotation = new Quaternion(), matrix = new Matrix4();
 let disposed = false;

 function update(time) {
  if (disposed) return;
  const stage = stages.find(({ start, end }) => start <= time && time < end);
  root.visible = false;
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
  for (const { mesh } of effects) {
   mesh.dispose();
   mesh.geometry.dispose();
   mesh.material.dispose();
  }
  effects.length = 0;
 }

 return { root, update, dispose };
}
