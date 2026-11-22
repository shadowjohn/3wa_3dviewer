const cameraOwners = new WeakSet();
const mercatorLatitudeLimit = 85.05112878;
const cameraHandlers = [
  'dragPan', 'dragRotate', 'scrollZoom', 'boxZoom', 'keyboard',
  'doubleClickZoom', 'touchZoomRotate', 'touchPitch',
];

/** Mount a detached Director stage. Heading is clockwise from north and scale is meters per local unit. */
export function mountE8DirectorScene({ map: host, root, longitude, latitude, altitude = 0, heading = 0, scale = 1 }) {
  if (![longitude, latitude, altitude, heading, scale].every(Number.isFinite) ||
      Math.abs(longitude) > 180 || Math.abs(latitude) > mercatorLatitudeLimit || scale <= 0) {
    throw new TypeError('Invalid E8 Director anchor, heading or scale.');
  }
  if (!root?.isObject3D || root.parent) throw new TypeError('The Director stage root must be detached.');

  const context = host.getNativeContext();
  const map = context.maplibre.map;
  const { THREE, root: world, SceneTransform } = context.three;
  const anchor = new THREE.Group();
  const theta = (heading % 360) * Math.PI / 180;
  const sin = Math.sin(theta), cos = Math.cos(theta);
  const projectedScale = SceneTransform.projectedUnitsPerMeter(latitude) * scale;
  if (!Number.isFinite(projectedScale) || projectedScale <= 0) throw new TypeError('Invalid E8 Director projected scale.');
  anchor.position.copy(SceneTransform.lngLatToVector3([longitude, latitude, altitude]));
  if (!anchor.position.toArray().every(Number.isFinite)) throw new TypeError('Invalid E8 Director projected anchor.');
  anchor.scale.setScalar(projectedScale);
  // E8's bridge world uses west, south and up. Director uses forward, up and right.
  anchor.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(
    new THREE.Vector3(-sin, -cos, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(-cos, sin, 0),
  ));
  anchor.updateMatrix();

  let disposed = false, saved = null;
  const assertMounted = () => { if (disposed) throw new Error('E8 Director scene is detached.'); };

  function localToGeo(point) {
    assertMounted();
    if (!Array.isArray(point) || point.length !== 3 || !point.every(Number.isFinite)) {
      throw new TypeError('Expected a finite Director point in local coordinates.');
    }
    return SceneTransform.vector3ToLngLat(new THREE.Vector3(...point).applyMatrix4(anchor.matrix));
  }

  function getCamera() {
    assertMounted();
    const center = map.getCenter();
    return {
      center: [center.lng, center.lat], zoom: map.getZoom(), pitch: map.getPitch(),
      bearing: map.getBearing(), roll: map.getRoll(), elevation: map.getCenterElevation(),
    };
  }

  function restoreCamera() {
    if (!saved) return;
    const { view, fov, clamped, maxZoom, maxPitch, handlers } = saved;
    saved = null;
    try {
      map.setCenterClampedToGround(clamped);
      map.setMaxZoom(maxZoom);
      map.setMaxPitch(maxPitch);
      map.setVerticalFieldOfView(fov);
      for (const [handler, enabled] of handlers) {
        if (enabled) handler.enable();
        else handler.disable();
      }
      map.jumpTo(view);
    } finally {
      cameraOwners.delete(map);
    }
  }

  function beginCamera() {
    assertMounted();
    if (saved) return;
    if (cameraOwners.has(map)) throw new Error('Another Director scene controls the E8 camera.');
    const handlers = cameraHandlers.map(name => map[name]).filter(Boolean);
    const snapshot = {
      view: getCamera(), fov: map.getVerticalFieldOfView(), clamped: map.getCenterClampedToGround(),
      maxZoom: map.getMaxZoom(), maxPitch: map.getMaxPitch(),
      handlers: handlers.map(handler => [handler, handler.isEnabled()]),
    };
    saved = snapshot;
    cameraOwners.add(map);
    try {
      map.stop();
      map.setCenterClampedToGround(false);
      map.setMaxZoom(Math.max(28, snapshot.maxZoom));
      map.setMaxPitch(Math.max(170, snapshot.maxPitch));
      for (const handler of handlers) handler.disable();
    } catch (error) {
      restoreCamera();
      throw error;
    }
  }

  function applyCamera({ position, lookAt, fov }) {
    assertMounted();
    if (!saved) throw new Error('Begin the E8 Director camera before applying a frame.');
    const eye = localToGeo(position), target = localToGeo(lookAt);
    if (eye.every((value, i) => value === target[i])) throw new TypeError('Camera eye and target must differ.');
    if (Number.isFinite(fov) && Math.abs(map.getVerticalFieldOfView() - fov) > 1e-6) {
      map.setVerticalFieldOfView(fov);
    }
    const view = map.calculateCameraOptionsFromTo(eye.slice(0, 2), eye[2], target.slice(0, 2), target[2]);
    map.jumpTo({ ...view, roll: 0 });
  }

  function repaint() { assertMounted(); map.triggerRepaint(); }
  function destroyed() { dispose(false); }
  function dispose(restore = true) {
    if (disposed) return;
    disposed = true;
    try {
      if (restore) restoreCamera();
      else if (saved) { saved = null; cameraOwners.delete(map); }
    } finally {
      host.detachEvent('destroy', destroyed);
      anchor.removeFromParent();
      anchor.remove(root);
      if (restore) map.triggerRepaint();
    }
  }

  try {
    host.attachEvent('destroy', destroyed);
    anchor.add(root);
    world.add(anchor);
    repaint();
  } catch (error) {
    dispose(false);
    throw error;
  }
  return Object.freeze({ localToGeo, getCamera, beginCamera, applyCamera, restoreCamera, repaint, dispose });
}
