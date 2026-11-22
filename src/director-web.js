import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import {KTX2Loader} from 'three/addons/loaders/KTX2Loader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import directorPolicy from './director-policy.cjs';
import captionsPolicy from './timed-captions.cjs';
import {createDirectorStage, directorEnvironment} from './director-stage.mjs';

const byId = id => document.getElementById(id);
const player = byId('player');
const canvas = byId('director-canvas');
const overlay = byId('director-overlay');
const play = byId('play');
const seek = byId('seek');
const cameraMode = byId('camera-mode');
const guide = byId('orbit-guide');
const time = byId('time');
const caption = byId('caption-text');
const status = byId('load-status');
const errorMessage = byId('player-error');
const params = new URLSearchParams(location.search);
player.dataset.embed = String(params.get('embed') === '1');

async function request(filename) {
  const response = await fetch('./' + filename, {mode: 'same-origin', redirect: 'error'});
  if (!response.ok) throw new Error(filename + ' (' + response.status + ')');
  return response;
}

function mediaPath(value, extensions) {
  if (typeof value !== 'string' || !/^(?:[\w.-]+\/)*[\w.-]+$/.test(value)) return null;
  if (value.split('/').some(part => part === '.' || part === '..')) return null;
  return extensions.test(value) ? './' + value : null;
}

async function prepareMedia() {
  const manifest = await (await request('manifest.json')).json();
  if (manifest?.version !== 1) return;
  const cover = mediaPath(manifest.cover, /\.(?:png|jpe?g|webp|avif)$/i);
  const video = mediaPath(manifest.video, /\.mp4$/i);
  if (cover) {
    byId('cover').src = cover;
    byId('cover').hidden = player.dataset.ready === 'true';
  }
  if (video) {
    const fallback = byId('fallback-video');
    if (cover) fallback.poster = cover;
    fallback.src = video;
    byId('fallback-link').href = video;
    byId('fallback').hidden = false;
  }
}

function showFailure(detail) {
  player.dataset.ready = 'false';
  player.dataset.failed = 'true';
  play.disabled = seek.disabled = cameraMode.disabled = true;
  byId('cover').hidden = !byId('cover').getAttribute('src');
  status.hidden = true;
  errorMessage.textContent = '無法載入 3D 場景。' + (detail ? ' ' + detail : '');
  errorMessage.hidden = false;
}

async function start() {
  const job = directorPolicy.director(await (await request('scene.json')).json());
  const {width, height, frameCount, fps} = job;
  const last = frameCount - 1;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#19212c');
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, alpha: false});
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  let stage, releaseEnvironment, ktx;
  const draco = new DRACOLoader().setDecoderPath('./decoders/draco/');
  function dispose() {
    stage?.dispose();
    releaseEnvironment?.();
    ktx?.dispose();
    draco.dispose();
    renderer.dispose();
  }

  try {
    releaseEnvironment = directorEnvironment(renderer, scene);
    ktx = new KTX2Loader().setTranscoderPath('./decoders/basis/').detectSupport(renderer);
    const loader = new GLTFLoader().setDRACOLoader(draco).setKTX2Loader(ktx).setMeshoptDecoder(MeshoptDecoder);
    stage = await createDirectorStage({
      job, renderer, scene, loader,
      async readModel(index) {
        const name = 'assets/model-' + (index + 1) + '.glb';
        if (job.objects[index].file !== name) throw new Error('無效的模型檔案路徑。');
        return new Uint8Array(await (await request(name)).arrayBuffer());
      },
    });
  } catch (error) {
    dispose();
    throw error;
  }

  const orbitCamera = new THREE.PerspectiveCamera(45, width / height, .001, 1000);
  const durationText = job.seconds.toFixed(2) + ' 秒';
  const seconds = Number(params.get('t'));
  let frame = Number.isFinite(seconds) ? Math.round(Math.max(0, Math.min(job.seconds, seconds)) * fps) : 0;
  frame = Math.min(frame, last);
  let orbit = null;
  let animation = null;
  let startedAt = 0;
  let startFrame = 0;

  function draw() {
    const override = orbit ? {
      position: orbitCamera.position.toArray(),
      lookAt: orbit.target.toArray(),
      fov: orbitCamera.fov,
    } : undefined;
    stage.draw(frame, width, height, overlay, override);
    player.dataset.frame = String(frame);
    seek.value = String(frame);
    const now = (frame / fps).toFixed(2) + ' 秒';
    seek.setAttribute('aria-valuetext', now);
    time.value = (frame / fps).toFixed(2) + ' / ' + durationText;
    const text = captionsPolicy.captionAt(job.captions, frame / fps) ?? '';
    if (caption.textContent !== text) caption.textContent = text;
  }

  function pause() {
    if (animation !== null) cancelAnimationFrame(animation);
    animation = null;
    play.textContent = frame === last ? '重播' : '播放';
  }

  function tick(now) {
    const next = Math.min(last, startFrame + Math.floor((now - startedAt) * fps / 1000));
    if (frame !== next) {
      frame = next;
      draw();
    }
    if (frame === last) pause();
    else animation = requestAnimationFrame(tick);
  }

  function togglePlayback() {
    if (animation !== null) {
      pause();
      return;
    }
    if (frame === last) {
      frame = 0;
      draw();
    }
    startFrame = frame;
    startedAt = performance.now();
    play.textContent = '暫停';
    animation = requestAnimationFrame(tick);
  }

  function toggleCamera() {
    if (orbit) {
      orbit.dispose();
      orbit = null;
    } else {
      pause();
      const pose = directorPolicy.directorCamera(job, frame);
      orbitCamera.position.fromArray(pose.position);
      orbitCamera.fov = pose.fov;
      orbitCamera.updateProjectionMatrix();
      orbit = new OrbitControls(orbitCamera, canvas);
      orbit.target.fromArray(pose.lookAt);
      const distance = orbit.target.distanceTo(orbitCamera.position);
      orbit.minDistance = Math.max(.002, distance * .18);
      orbit.maxDistance = distance * 8;
      orbit.update();
      orbit.addEventListener('change', draw);
    }
    const free = Boolean(orbit);
    player.dataset.camera = free ? 'orbit' : 'director';
    play.disabled = free;
    cameraMode.setAttribute('aria-pressed', String(free));
    cameraMode.textContent = free ? '回到導演視角' : '自由轉視角';
    guide.hidden = !free;
    draw();
  }

  try {
    seek.max = String(last);
    draw();
  } catch (error) {
    dispose();
    throw error;
  }
  player.dataset.ready = 'true';
  byId('cover').hidden = true;
  status.hidden = true;
  play.disabled = seek.disabled = cameraMode.disabled = false;
  pause();
  play.addEventListener('click', togglePlayback);
  cameraMode.addEventListener('click', toggleCamera);
  seek.addEventListener('input', () => {
    frame = seek.valueAsNumber;
    pause();
    draw();
  });
  canvas.addEventListener('webglcontextlost', () => {
    pause();
    orbit?.dispose();
    showFailure('圖形裝置已中斷，可重新整理或觀看 MP4。');
  });
  addEventListener('pagehide', event => {
    if (event.persisted) return;
    pause();
    orbit?.dispose();
    dispose();
  });
}

prepareMedia().catch(() => {});
start().catch(error => showFailure(error.message));
