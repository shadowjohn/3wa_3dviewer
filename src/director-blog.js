const article = document.getElementById('blog-example');
const byId = id => article.querySelector('#' + id);
const packageBase = new URL('.', import.meta.url);
const slot = byId('embed-slot');
const open = byId('load-player');
const chapter = byId('load-chapter');

function loadPlayer(seconds) {
  const source = new URL('index.html', packageBase);
  source.searchParams.set('embed', '1');
  if (seconds !== undefined) source.searchParams.set('t', String(seconds));

  let frame = byId('director-embed');
  if (!frame) {
    frame = document.createElement('iframe');
    frame.id = 'director-embed';
    frame.title = '3WA 3D 場景播放器';
    frame.src = source.href;
    slot.append(frame);
    slot.hidden = false;
  } else {
    frame.src = source.href;
  }
}

function mediaPath(value, extensions) {
  if (typeof value !== 'string' || !/^(?:[\w.-]+\/)*[\w.-]+$/.test(value)) return null;
  if (value.split('/').some(part => part === '.' || part === '..')) return null;
  return extensions.test(value) ? new URL(value, packageBase).href : null;
}

async function prepareExample() {
  const response = await fetch(new URL('manifest.json', packageBase), {mode: 'same-origin', redirect: 'error'});
  if (!response.ok) return;
  const manifest = await response.json();
  if (manifest?.version !== 1) return;
  const cover = mediaPath(manifest.cover, /\.(?:png|jpe?g|webp|avif)$/i);
  const video = mediaPath(manifest.video, /\.mp4$/i);
  if (video) {
    const fallback = byId('fallback-video');
    if (cover) fallback.poster = cover;
    fallback.src = video;
    byId('fallback-link').href = video;
    byId('fallback').hidden = false;
  } else if (cover) {
    byId('cover').src = cover;
    byId('cover-only').hidden = false;
  }

  const point = manifest.chapter;
  if (typeof point?.label === 'string' && point.label.trim() && Number.isFinite(point.seconds) && point.seconds >= 0) {
    chapter.textContent = point.label;
    chapter.addEventListener('click', () => loadPlayer(point.seconds));
    chapter.hidden = false;
  }
}

open.addEventListener('click', () => loadPlayer());
prepareExample().catch(() => {});
