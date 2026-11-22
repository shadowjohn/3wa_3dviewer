const assert = require('node:assert/strict');
const test = require('node:test');

const adapter = import('../src/e8-director-map.mjs');
const three = import('three');

function makeMap(THREE) {
  const callbacks = new Set();
  const root = new THREE.Group();
  const initial = { center: [121, 24], zoom: 12, pitch: 35, bearing: 20, roll: 2, elevation: 62 };
  const state = { ...initial, fov: 40, clamped: true, maxZoom: 24, maxPitch: 85 };
  const handlers = [true, false];
  let repaintCount = 0, cameraArguments;
  const map = {
    getCenter: () => ({ lng: state.center[0], lat: state.center[1] }),
    getZoom: () => state.zoom,
    getPitch: () => state.pitch,
    getBearing: () => state.bearing,
    getRoll: () => state.roll,
    getCenterElevation: () => state.elevation,
    getCenterClampedToGround: () => state.clamped,
    getMaxZoom: () => state.maxZoom,
    getMaxPitch: () => state.maxPitch,
    getVerticalFieldOfView: () => state.fov,
    setCenterClampedToGround: value => { state.clamped = value; },
    setMaxZoom: value => { state.maxZoom = value; },
    setMaxPitch: value => { state.maxPitch = value; },
    setVerticalFieldOfView: value => { state.fov = value; },
    calculateCameraOptionsFromTo(...args) {
      cameraArguments = args;
      return { center: args[2], elevation: args[3], zoom: 22, pitch: 55, bearing: 45 };
    },
    jumpTo: pose => { Object.assign(state, pose); },
    stop() {},
    triggerRepaint() { repaintCount++; },
  };
  for (const [index, name] of ['dragPan', 'dragRotate'].entries()) {
    map[name] = {
      isEnabled: () => handlers[index],
      enable: () => { handlers[index] = true; },
      disable: () => { handlers[index] = false; },
    };
  }
  const SceneTransform = {
    projectedUnitsPerMeter: () => 2,
    lngLatToVector3: ([lng, lat, altitude]) => new THREE.Vector3(-lng * 100, -lat * 100, altitude * 2),
    vector3ToLngLat: point => [point.x / -100, point.y / -100, point.z / 2],
  };
  const host = {
    getNativeContext: () => ({ maplibre: { map }, three: { THREE, root, SceneTransform } }),
    attachEvent: (name, callback) => { assert.equal(name, 'destroy'); callbacks.add(callback); },
    detachEvent: (name, callback) => { assert.equal(name, 'destroy'); callbacks.delete(callback); },
  };
  return {
    host, root, initial, state, handlers,
    get cameraArguments() { return cameraArguments; },
    get repaintCount() { return repaintCount; },
    destroy: () => { for (const callback of callbacks) callback(); },
  };
}

function near(actual, expected) {
  assert.equal(actual.length, expected.length);
  expected.forEach((value, i) => assert.ok(Math.abs(actual[i] - value) < 1e-9, `${actual[i]} vs ${value}`));
}

test('E8 anchor uses meters and compass heading without moving the Director root', async () => {
  const { mountE8DirectorScene } = await adapter;
  const THREE = await three, fixture = makeMap(THREE), local = new THREE.Group();
  const scene = mountE8DirectorScene({ map: fixture.host, root: local, longitude: 120, latitude: 23, altitude: 18, heading: 90, scale: 3 });
  near(scene.localToGeo([0, 0, 0]), [120, 23, 18]);
  near(scene.localToGeo([5, 4, 2]), [120.3, 22.88, 30]);
  assert.equal(local.parent.parent, fixture.root);
  assert.deepEqual(local.position.toArray(), [0, 0, 0]);
  assert.equal(fixture.repaintCount, 1);
  scene.dispose();
  scene.dispose();
  assert.equal(local.parent, null);
  assert.equal(fixture.root.children.length, 0);
  assert.equal(fixture.repaintCount, 2);
});

test('Director camera uses projected eye and target, then restores the original map state and gestures', async () => {
  const { mountE8DirectorScene } = await adapter;
  const THREE = await three, fixture = makeMap(THREE);
  const options = { map: fixture.host, longitude: 120, latitude: 23, altitude: 8 };
  const a = mountE8DirectorScene({ ...options, root: new THREE.Group() });
  const b = mountE8DirectorScene({ ...options, root: new THREE.Group() });
  const original = { ...fixture.state };
  const pose = { position: [-10, 6, 4], lookAt: [0, 2, 0], fov: 32 };
  assert.throws(() => a.applyCamera(pose), /Begin/);
  a.beginCamera();
  assert.equal(fixture.state.clamped, false);
  assert.deepEqual(fixture.handlers, [false, false]);
  assert.throws(() => b.beginCamera(), /Another Director/);
  a.applyCamera(pose);
  near(fixture.cameraArguments[0], [120.08, 22.8]);
  assert.ok(Math.abs(fixture.cameraArguments[1] - 14) < 1e-9);
  near(fixture.cameraArguments[2], [120, 23]);
  assert.ok(Math.abs(fixture.cameraArguments[3] - 10) < 1e-9);
  assert.equal(fixture.state.fov, 32);
  a.restoreCamera();
  assert.deepEqual(fixture.state, original);
  assert.deepEqual(fixture.handlers, [true, false]);
  b.beginCamera();
  b.dispose();
  assert.deepEqual(fixture.state, original);
  fixture.destroy();
  assert.equal(fixture.root.children.length, 0);
  assert.throws(() => a.repaint(), /detached/);
});
