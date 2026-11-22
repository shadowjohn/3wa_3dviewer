import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import directorPolicy from '../../src/director-policy.cjs';
import {createDirectorContent} from '../../src/director-content.mjs';
import {mountE8DirectorScene} from '../../src/e8-director-map.mjs';

const byId = id => document.getElementById(id);
const form = byId('anchor');
const play = byId('play');
const seek = byId('seek');
const camera = byId('camera');
const overview = byId('overview');
const detach = byId('detach');
const attach = byId('attach');
const caption = byId('caption');
const notes = byId('notes');
const status = byId('status');
const pickup = document.body.dataset.scene === 'pickup';
const wuri = !pickup && new URLSearchParams(location.search).get('site') === 'wuri';
const located = pickup || wuri;
const sceneFile = pickup ? 'pickup.scene.json' : 'check-valve.scene.json';
const sceneName = pickup ? '載客區' : '合成單向閥';
const chapters = Array.from(document.querySelectorAll('button[data-seconds]'));
const detailView = pickup ? {zoom: 20.25, pitch: 47, bearing: 15} : {zoom: 21, pitch: 52, bearing: 15};
const emptyFeatures = {type: 'FeatureCollection', features: []};

if (wuri) {
  document.title = 'E8 腳本寶｜烏日高鐵站前';
  byId('longitude').value = '120.615115';
  byId('latitude').value = '24.111754';
  byId('site-description').hidden = false;
  byId('site-link').href = './';
  byId('site-link').textContent = '示意格線';
  overview.hidden = false;
}

function readAnchor() {
  const longitude = byId('longitude').valueAsNumber;
  const latitude = byId('latitude').valueAsNumber;
  const altitude = byId('altitude').valueAsNumber;
  const heading = byId('heading').valueAsNumber;
  const scale = byId('scale').valueAsNumber;
  if (![longitude, latitude, heading, scale].every(Number.isFinite) ||
      Math.abs(longitude) > 180 || Math.abs(latitude) > 85.05112878 || scale <= 0) {
    throw Error('請檢查經緯度、朝向與比例。比例須大於零。');
  }
  return {longitude, latitude, altitude: Number.isNaN(altitude) ? undefined : altitude, heading, scale};
}

function anchorPoint({longitude, latitude}) {
  return {type: 'Point', coordinates: [longitude, latitude]};
}

function mapStyle(anchor) {
  const {longitude, latitude} = anchor;
  const features = [];
  const latStep = .000045;
  const lonStep = latStep / Math.cos(latitude * Math.PI / 180);
  for (let i = -80; i <= 80; i += 1) {
    const x = longitude + i * lonStep;
    const y = latitude + i * latStep;
    features.push(
      {type: 'Feature', properties: {major: i % 5 === 0}, geometry: {
        type: 'LineString', coordinates: [[x, latitude - 80 * latStep], [x, latitude + 80 * latStep]],
      }},
      {type: 'Feature', properties: {major: i % 5 === 0}, geometry: {
        type: 'LineString', coordinates: [[longitude - 80 * lonStep, y], [longitude + 80 * lonStep, y]],
      }},
    );
  }
  const style = {version: 8, sources: {grid: {type: 'geojson', data: {type: 'FeatureCollection', features}}}, layers: [
    {id: 'background', type: 'background', paint: {'background-color': '#122537'}},
    {id: 'grid', source: 'grid', type: 'line', paint: {
      'line-color': ['case', ['get', 'major'], '#406281', '#263f58'], 'line-width': 1,
    }},
  ]};
  if (located) {
    style.sources.anchor = {type: 'geojson', data: emptyFeatures};
    style.layers.push({id: 'anchor', source: 'anchor', type: 'circle', maxzoom: 20, paint: {
      'circle-radius': 7, 'circle-color': '#22cfc8', 'circle-stroke-color': '#112535', 'circle-stroke-width': 2,
    }});
  }
  return style;
}

function addStreetMap(map) {
  map.addSource('street', {
    type: 'raster',
    tiles: ['https://wmts.nlsc.gov.tw/wmts/EMAP/default/EPSG:3857/{z}/{y}/{x}'],
    tileSize: 256, maxzoom: 19, bounds: [120.6, 24.10, 120.63, 24.125],
    attribution: '底圖 © 內政部國土測繪中心',
  });
  map.addLayer({id: 'street', source: 'street', type: 'raster', paint: {
    'raster-opacity': 0.85, 'raster-saturation': -0.45, 'raster-brightness-max': 0.74,
  }}, 'anchor');
}

async function start() {
  const response = await fetch('./' + sceneFile, {mode: 'same-origin'});
  if (!response.ok) throw Error('找不到' + sceneName + '導演腳本。');
  const job = directorPolicy.director(await response.json());
  const anchor = readAnchor();
  const host = new window.Easymap('map', {
    center: anchor, ...detailView, style: mapStyle(anchor),
  });
  await host.ready;
  const native = host.getNativeContext();
  const map = native.maplibre.map;
  const loader = new GLTFLoader();
  let mounted = null;
  let content = null;
  let controlsDirector = false;
  let animation = 0;
  let frame = 0;
  let shot = null;
  let activeAnchor = anchor;
  let activeChapter = null;
  const last = job.frameCount - 1;

  function showNotes() {
    const fragment = document.createDocumentFragment();
    // The E8 floating origin moves while the Director timeline is paused.
    for (const note of shot ? content.worldNotes(frame) : []) {
      const point = new THREE.Vector3(...note.point).project(native.three.camera);
      if (![point.x, point.y, point.z].every(n => Number.isFinite(n) && Math.abs(n) <= 1)) continue;
      const tag = document.createElement('span');
      tag.textContent = note.text;
      tag.style.left = ((point.x + 1) * 50) + '%';
      tag.style.top = ((1 - point.y) * 50) + '%';
      fragment.append(tag);
    }
    notes.replaceChildren(fragment);
  }

  function draw(index) {
    frame = Math.min(last, Math.max(0, index));
    shot = content.applyFrame(frame);
    if (controlsDirector) mounted.applyCamera(shot.camera);
    mounted.repaint();
    seek.value = frame;
    byId('time').textContent = shot.time.toFixed(2) + ' / ' + job.seconds.toFixed(2) + ' 秒';
    const chapter = chapters.findLast(item => shot.time >= Number(item.dataset.start));
    if (chapter !== activeChapter) {
      activeChapter?.setAttribute('aria-pressed', 'false');
      chapter?.setAttribute('aria-pressed', 'true');
      activeChapter = chapter;
    }
    caption.textContent = shot.caption || '';
    caption.hidden = !shot.caption;
  }

  function pause() {
    cancelAnimationFrame(animation);
    animation = 0;
    play.textContent = frame === last ? '重播' : '播放';
  }

  function togglePlayback() {
    if (animation) { pause(); return; }
    if (frame === last) draw(0);
    const first = frame;
    const started = performance.now();
    play.textContent = '暫停';
    function tick(now) {
      const next = Math.min(last, first + Math.floor(Math.max(0, now - started) * job.fps / 1000));
      if (next !== frame) draw(next);
      if (next < last) animation = requestAnimationFrame(tick);
      else pause();
    }
    animation = requestAnimationFrame(tick);
  }

  function detachScene() {
    if (!mounted) return;
    pause();
    map.off('render', showNotes);
    mounted.dispose();
    content.dispose();
    mounted = content = shot = null;
    controlsDirector = false;
    notes.replaceChildren();
    caption.hidden = true;
    camera.textContent = '切換導演視角';
    for (const item of [play, camera, detach, seek, overview, ...chapters]) item.disabled = true;
    if (located) map.getSource('anchor').setData(emptyFeatures);
    attach.textContent = '掛載場景';
    status.textContent = '場景已卸載，可以繼續操作地圖。';
  }

  async function attachScene() {
    const options = readAnchor();
    detachScene();
    attach.disabled = true;
    status.textContent = '載入' + sceneName + '…';
    const root = new THREE.Group();
    root.add(new THREE.HemisphereLight(0xe4f0ff, 0x464e59, 1.8));
    const sunlight = new THREE.DirectionalLight(0xeef4ff, 2);
    sunlight.position.set(4, 6, 3);
    root.add(sunlight);
    try {
      content = await createDirectorContent({job, scene: root, loadModel(index) {
        return loader.loadAsync(job.objects[index].file);
      }});
      mounted = mountE8DirectorScene({map: host, root, ...options});
      root.updateWorldMatrix(true, true);
      activeAnchor = options;
      if (located) {
        map.getSource('anchor').setData(anchorPoint(activeAnchor));
        overview.disabled = false;
      }
      map.jumpTo({center: anchorPoint(activeAnchor).coordinates});
      map.on('render', showNotes);
      for (const item of [play, camera, detach, seek, ...chapters]) item.disabled = false;
      attach.textContent = '套用錨點';
      status.textContent = options.altitude === undefined
        ? '目前使用圖台零面。底圖未啟用地形。'
        : '使用指定的圖台高程。底圖未啟用地形。';
      draw(0);
      if (pickup) useDirectorCamera();
      pause();
    } catch (error) {
      if (mounted) detachScene();
      else if (content) { content.dispose(); content = null; }
      throw error;
    } finally {
      attach.disabled = false;
    }
  }

  play.onclick = togglePlayback;
  seek.max = last;
  function seekTo(index) {
    draw(index);
    pause();
  }
  seek.oninput = () => seekTo(seek.valueAsNumber);
  for (const chapter of chapters) {
    chapter.onclick = () => seekTo(Math.round(Number(chapter.dataset.seconds) * job.fps));
  }
  function restoreMapCamera() {
    if (!controlsDirector) return;
    controlsDirector = false;
    mounted.restoreCamera();
    camera.textContent = '切換導演視角';
  }

  function useDirectorCamera() {
    mounted.beginCamera();
    controlsDirector = true;
    try { draw(frame); }
    catch (error) {
      restoreMapCamera();
      throw error;
    }
    camera.textContent = '回地圖操作';
  }

  camera.onclick = () => {
    try {
      if (controlsDirector) restoreMapCamera();
      else useDirectorCamera();
    } catch (error) {
      status.textContent = error.message;
    }
  };
  if (located) {
    const updateOverviewLabel = () => {
      overview.textContent = !controlsDirector && map.getZoom() < 20
        ? (pickup ? '回到載客區' : '回到單向閥')
        : '站區總覽';
    };
    map.on('moveend', updateOverviewLabel);
    overview.onclick = () => {
      const goToDetail = !controlsDirector && map.getZoom() < 20;
      restoreMapCamera();
      const view = goToDetail ? detailView : {zoom: 18, pitch: 0, bearing: 0};
      map.easeTo({center: anchorPoint(activeAnchor).coordinates, ...view, duration: 650});
    };
  }
  detach.onclick = detachScene;
  form.onsubmit = event => {
    event.preventDefault();
    attachScene().catch(error => { status.textContent = error.message; });
  };
  await attachScene();
  // Optional street tiles must not block the standalone scene from initializing.
  if (located) addStreetMap(map);
}

start().catch(error => { status.textContent = error.message; console.error(error); });
