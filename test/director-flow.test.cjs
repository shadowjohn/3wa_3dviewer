const assert = require('node:assert/strict');
const test = require('node:test');

const flow = import('../src/director-flow.mjs');
const three = import('three');
const makeTrack = (options = {}) => ({
  id: 'test', object: 'pipe', points: [[-2, 0, 0], [0, 0, 0], [0, 0, 4]],
  medium: 'water', seed: 13, arrows: true, particles: true, arrowCount: 8, particleCount: 12,
  stages: [{ start: 1, end: 5, direction: 1, speed: 1, stop: null }],
  ...options,
});
const snapshot = ({ root }) => root.children.map(mesh =>
  Array.from(mesh.instanceMatrix.array.slice(0, mesh.count * 16)));

test('absolute time seeks, a bend, and inactive bounds', async () => {
  const { createDirectorFlow } = await flow;
  const { Matrix4, Vector3 } = await three;
  const vectorUp = new Vector3(0, 1, 0);
  const layer = createDirectorFlow(makeTrack());
  const matrix = new Matrix4();
  layer.update(.5);
  assert.equal(layer.root.visible, false);
  layer.update(4);
  const reference = snapshot(layer);
  assert.equal(layer.root.visible, true);
  assert.equal(layer.root.children[0].count, 8);
  const axes = new Set();
  const arrows = layer.root.children[0];
  for (let i = 0; i < arrows.count; i++) {
    arrows.getMatrixAt(i, matrix);
    const position = new Vector3().setFromMatrixPosition(matrix);
    const axis = vectorUp.clone().transformDirection(matrix).toArray().map(Math.round).join(',');
    axes.add(axis);
    assert.ok(Math.abs(position.x) < 1e-6 || Math.abs(position.z) < 1e-6);
  }
  assert.deepEqual(axes, new Set(['1,0,0', '0,0,1']));
  for (let frame = 30; frame <= 120; frame++) layer.update(frame / 30);
  assert.deepEqual(snapshot(layer), reference);
  layer.update(5);
  assert.equal(layer.root.visible, false);
  layer.update(4);
  assert.deepEqual(snapshot(layer), reference);
  layer.dispose();
});

test('full mesh extents stop on the source side of an oblique valve in either direction', async () => {
  const { createDirectorFlow } = await flow;
  const { Matrix4, Vector3 } = await three;
  const vectorUp = new Vector3(0, 1, 0);
  const matrix = new Matrix4();
  const h = Math.sqrt(3);
  for (const [direction, normal, shape] of [
    [1, [1, 0, 0]], [-1, [1, 0, 0]], [1, [.8, .36, .48]], [-1, [.8, .36, .48]],
    [1, [.8, .36, .48], 'viscous'], [-1, [.8, .36, .48], 'viscous'],
    [1, [.8, .36, .48], 'mist'], [-1, [.8, .36, .48], 'mist'],
  ]) {
    const seatNormal = new Vector3(...normal);
    const layer = createDirectorFlow(makeTrack({
      points: [[-1, 0, -h], [0, 0, 0], [1, 0, h]],
      stages: [{ start: 0, end: 4, direction, speed: 1.3, stop: { distance: 2, normal } }],
      appearance: shape ? { shape } : undefined,
    }));
    for (const time of [0, 1, 2, 3.5]) {
      layer.update(time);
      assert.ok(layer.root.children.every(mesh => mesh.count > 0));
      for (const mesh of layer.root.children) {
        const vertices = mesh.geometry.getAttribute('position');
        for (let instance = 0; instance < mesh.count; instance++) {
          mesh.getMatrixAt(instance, matrix);
          for (let vertex = 0; vertex < vertices.count; vertex++) {
            const world = new Vector3().fromBufferAttribute(vertices, vertex).applyMatrix4(matrix);
            assert.ok(-direction * seatNormal.dot(world) >= 0, 'mesh vertex crossed the oriented valve plane');
          }
        }
      }
    }
    const arrow = layer.root.children[0];
    arrow.getMatrixAt(0, matrix);
    assert.equal(Math.sign(vectorUp.clone().transformDirection(matrix).x), direction);
    layer.dispose();
  }
});

test('adjacent zero-speed stages preserve the last pose and disposal detaches the layer', async () => {
  const { createDirectorFlow } = await flow;
  const { Group } = await three;
  const layer = createDirectorFlow(makeTrack({
    stages: [
      { start: 0, end: 1, direction: 1, speed: 1.3, stop: null },
      { start: 1, end: 2, direction: 1, speed: 0, stop: null },
      { start: 2, end: 3, direction: -1, speed: 1.3, stop: null },
    ],
  }));
  const parent = new Group();
  parent.add(layer.root);
  layer.update(1 - 1e-8);
  const before = snapshot(layer);
  layer.update(1);
  const paused = snapshot(layer);
  assert.ok(before.every((row, i) => row.every((value, j) => Math.abs(value - paused[i][j]) < 1e-6)));
  layer.update(1.9);
  assert.deepEqual(snapshot(layer), paused);
  layer.update(2);
  assert.notDeepEqual(snapshot(layer), paused);
  let disposed = 0;
  for (const mesh of layer.root.children) mesh.geometry.addEventListener('dispose', () => disposed++);
  layer.dispose();
  layer.dispose();
  layer.update(1.5);
  assert.equal(parent.children.length, 0);
  assert.equal(layer.root.visible, false);
  assert.equal(disposed, 2);
});

test('blocked motion freezes across an equal stop and never jumps across an unsafe bend', async () => {
  const { createDirectorFlow } = await flow;
  const { Matrix4, Vector3 } = await three;
  const stop = { distance: 2, normal: [1, 0, 0] };
  const layer = createDirectorFlow(makeTrack({
    points: [[-2, 0, 0], [0, 0, 0], [2, 0, 0], [-1, 0, 2], [3, 0, 2]],
    stages: [
      { start: 0, end: 1, direction: -1, speed: 1.2, stop },
      { start: 1, end: 3, direction: -1, speed: 0, stop: { distance: 2, normal: [1, 0, 0] } },
    ],
  }));
  layer.update(1 - 1e-8);
  const before = snapshot(layer);
  layer.update(2);
  const paused = snapshot(layer);
  assert.ok(before.every((row, i) => row.every((value, j) => Math.abs(value - paused[i][j]) < 1e-6)));
  const arrows = layer.root.children[0];
  const matrix = new Matrix4();
  for (let index = 0; index < arrows.count; index++) {
    arrows.getMatrixAt(index, matrix);
    const { x, z } = new Vector3().setFromMatrixPosition(matrix);
    assert.ok(x > 0 && z === 2, 'reverse motion stayed on the contiguous safe source span');
  }
  layer.dispose();
});


test('running particles distribute across both cross-section axes and keep deterministic spacing', async () => {
  const { createDirectorFlow } = await flow;
  const { Matrix4, Vector3 } = await three;
  const count = 56;
  const layer = createDirectorFlow(makeTrack({
    points: [[-2.7, 0, 0], [2.7, 0, 0]], arrows: false, particleCount: count,
  }));
  layer.update(2.25);
  const reference = snapshot(layer);
  const particles = layer.root.children[0];
  const matrix = new Matrix4();
  const centres = [];
  assert.equal(particles.count, count);
  for (let i = 0; i < count; i++) {
    particles.getMatrixAt(i, matrix);
    const point = new Vector3().setFromMatrixPosition(matrix);
    assert.ok(Math.hypot(point.y, point.z) <= .140001, 'particle center must stay within the cross-section disk');
    centres.push(point);
  }
  for (const axis of ['y', 'z']) {
    const values = centres.map(point => point[axis]);
    assert.ok(Math.max(...values) - Math.min(...values) > .10, 'particles span both transverse axes');
  }
  const xs = centres.map(point => point.x).sort((a, b) => a - b);
  assert.ok(xs.some((x, i) => i && Math.abs(x - xs[i - 1] - 5.4 / count) > .01), 'open flow has mild axial spacing variation');
  layer.update(4.5);
  layer.update(1.15);
  layer.update(2.25);
  assert.deepEqual(snapshot(layer), reference);
  layer.dispose();
});

test('arrows and particles can be enabled independently with the air preset', async () => {
  const { createDirectorFlow } = await flow;
  for (const particleOnly of [false, true]) {
    const layer = createDirectorFlow(makeTrack({
      medium: 'air', arrows: !particleOnly, particles: particleOnly,
    }));
    layer.update(2);
    assert.deepEqual(layer.root.children.map(mesh => mesh.name), [particleOnly ? 'particles' : 'arrows']);
    assert.ok(layer.root.children[0].count > 0);
    layer.dispose();
  }
});

test('media appearance presets and overrides preserve the approved arrow material', async () => {
  const { createDirectorFlow } = await flow;
  const { Vector3 } = await three;
  const original = createDirectorFlow(makeTrack());
  const viscous = createDirectorFlow(makeTrack({
    appearance: { shape: 'viscous', arrowColor: null, particleColor: null, opacity: null },
  }));
  const mist = createDirectorFlow(makeTrack({
    appearance: { shape: 'mist', arrowColor: '#4488cc', particleColor: '#c1bbe9', opacity: .27 },
  }));
  const [originalArrow, originalDrop] = original.root.children;
  const [thickArrow, thickDrop] = viscous.root.children;
  const [mistArrow, mistDrop] = mist.root.children;
  originalDrop.geometry.computeBoundingBox();
  thickDrop.geometry.computeBoundingBox();
  const originalSize = originalDrop.geometry.boundingBox.getSize(new Vector3());
  const thickSize = thickDrop.geometry.boundingBox.getSize(new Vector3());
  assert.ok(thickSize.y > originalSize.y * 1.7, 'viscous particles stretch along flow');
  assert.ok(thickSize.x > originalSize.x * 1.3, 'viscous particles also thicken transversely');
  assert.notEqual(thickDrop.material.color.getHex(), originalDrop.material.color.getHex());
  assert.equal(originalArrow.material.color.getHex(), 0x18d9bf);
  for (const arrow of [originalArrow, thickArrow, mistArrow]) {
    assert.equal(arrow.material.isMeshBasicMaterial, true);
    assert.equal(arrow.material.toneMapped, false);
    assert.equal(arrow.material.opacity, 1);
  }
  assert.equal(mistArrow.material.color.getHexString(), '4488cc');
  assert.equal(mistDrop.material.color.getHexString(), 'c1bbe9');
  assert.equal(mistDrop.material.opacity, .27);
  assert.equal(mistDrop.material.transparent, true);
  assert.equal(mistDrop.material.depthWrite, false);
  for (const layer of [original, viscous, mist]) layer.dispose();
});

test('schematic arrows face +Z in XY and turn with the direction of flow', async () => {
  const { createDirectorFlow } = await flow;
  const { Matrix4, Vector3 } = await three;
  const layer = createDirectorFlow(makeTrack({
    points: [[-2, 0, 0], [2, 0, 0]], particles: false,
    appearance: { arrowStyle: 'schematic' },
    stages: [{ start: 0, end: 2, direction: 1, speed: 1, stop: null },
      { start: 2, end: 4, direction: -1, speed: 1, stop: { distance: 2, normal: [1, 0, 0] } }],
  }));
  const arrows = layer.root.children[0];
  arrows.geometry.computeBoundingBox();
  const size = arrows.geometry.boundingBox.getSize(new Vector3());
  assert.ok(size.x > .30 && size.y > .40 && size.z < .025, 'arrow has a wide face and thin profile');
  const matrix = new Matrix4();
  for (const [time, direction] of [[1, 1], [3, -1]]) {
    layer.update(time);
    assert.ok(arrows.count > 0);
    arrows.getMatrixAt(0, matrix);
    assert.ok(new Vector3(0, 0, 1).transformDirection(matrix).z > .999);
    assert.ok(new Vector3(0, 1, 0).transformDirection(matrix).x * direction > .999);
    if (direction < 0) {
      const vertices = arrows.geometry.getAttribute('position');
      for (let i = 0; i < vertices.count; i++) {
        assert.ok(new Vector3().fromBufferAttribute(vertices, i).applyMatrix4(matrix).x > 0);
      }
    }
  }
  layer.dispose();
});

test('standalone ribbon samples the whole color ramp, clips at the valve, and cleans up', async () => {
  const { createDirectorFlow } = await flow;
  const layer = createDirectorFlow(makeTrack({
    points: [[-2, 0, 0], [2, 0, 0]], arrows: false, particles: false,
    appearance: { trace: 'ribbon' }, traceValues: [0, 1],
    stages: [{ start: 1, end: 3, direction: 1, speed: 1, stop: null },
      { start: 4, end: 5, direction: -1, speed: 0, stop: { distance: 2, normal: [1, 0, 0] } }],
  }));
  assert.deepEqual(layer.root.children.map(mesh => mesh.name), ['ribbon']);
  const ribbon = layer.root.children[0];
  assert.ok(ribbon.material.transparent && ribbon.material.opacity < 1);
  layer.update(.5);
  assert.equal(layer.root.visible, false);
  layer.update(1.5);
  assert.equal(layer.root.visible, true);
  const full = ribbon.geometry;
  const colors = full.getAttribute('color');
  const distinct = new Set();
  for (let i = 0; i < colors.count; i++) distinct.add([colors.getX(i), colors.getY(i), colors.getZ(i)].join(','));
  assert.equal(distinct.size, 4);
  layer.update(2.25);
  assert.equal(ribbon.geometry, full, 'trace remains geometrically steady within a stage');
  layer.update(3.5);
  assert.equal(layer.root.visible, false);
  layer.update(4.25);
  assert.equal(layer.root.visible, true);
  const clipped = ribbon.geometry;
  const points = clipped.getAttribute('position');
  let min = Infinity;
  for (let i = 0; i < points.count; i++) min = Math.min(min, points.getX(i));
  assert.ok(min >= 0 && min < .1, 'full ribbon extent stops before the plane');
  layer.update(1.5);
  assert.equal(ribbon.geometry, full, 'seeking restores the earlier stage geometry');
  layer.update(5);
  assert.equal(layer.root.visible, false);
  let disposed = 0;
  for (const resource of [full, clipped, ribbon.material]) resource.addEventListener('dispose', () => disposed++);
  layer.dispose();
  layer.dispose();
  assert.equal(disposed, 3);
});

test('3D ribbon keeps its width when the tangent crosses its front axis', async () => {
  const { createDirectorFlow } = await flow;
  const { Vector3 } = await three;
  const layer = createDirectorFlow(makeTrack({
    points: [[0, 0, 0], [.2, 0, 1], [-.1, 0, 2], [-.3, 0, 3]],
    arrows: false, particles: false, appearance: { trace: 'ribbon' },
  }));
  layer.update(2);
  const positions = layer.root.children[0].geometry.getAttribute('position');
  for (let i = 2; i < positions.count; i += 2) {
    const previousWidth = new Vector3().fromBufferAttribute(positions, i - 2)
      .sub(new Vector3().fromBufferAttribute(positions, i - 1));
    const width = new Vector3().fromBufferAttribute(positions, i)
      .sub(new Vector3().fromBufferAttribute(positions, i + 1));
    assert.ok(previousWidth.lerp(width, .5).length() > .17, 'adjacent rings cannot pinch the ribbon between them');
  }
  layer.dispose();
});

test('streamline is a thin solid trace and uses the particle tint without scalar values', async () => {
  const { createDirectorFlow } = await flow;
  const { Vector3 } = await three;
  const layer = createDirectorFlow(makeTrack({
    points: [[-2, 0, 0], [2, 0, 0]], arrows: false, particles: false,
    appearance: { trace: 'streamline', particleColor: '#55ca29' },
  }));
  const line = layer.root.children[0];
  layer.update(2);
  assert.equal(line.name, 'streamline');
  assert.equal(line.geometry.hasAttribute('color'), false);
  assert.equal(line.material.color.getHexString(), '55ca29');
  assert.equal(line.material.transparent, false);
  line.geometry.computeBoundingBox();
  const size = line.geometry.boundingBox.getSize(new Vector3());
  assert.ok(size.y > .02 && size.y < .04, 'streamline is thin even in world units');
  layer.dispose();
});
