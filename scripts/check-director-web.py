"""Run browser QA on the valve-flow Director web export.

Usage: python scripts/check-director-web.py PACKAGE [--mp4 VIDEO] [--proof-dir DIR]
Requires Playwright, Chrome, and FFmpeg when comparing the optional 12-second video.
"""

import argparse
from contextlib import contextmanager
from functools import partial
from hashlib import sha256
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import re
import shutil
import subprocess
from tempfile import TemporaryDirectory
from threading import Thread
from time import monotonic
from urllib.parse import quote

from playwright.sync_api import expect, sync_playwright


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


@contextmanager
def relocated(package):
    with TemporaryDirectory(prefix='director-web-qa-') as sandbox:
        parent = Path(sandbox)
        folder = 'moved/a new location'
        shutil.copytree(package, parent / folder)
        with ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=sandbox)) as server:
            thread = Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                yield f'http://127.0.0.1:{server.server_port}/{quote(folder)}/'
            finally:
                server.shutdown()
                thread.join()


def network_guard(context, base):
    requested, denied = [], []

    def handle(route):
        url = route.request.url
        requested.append(url)
        if url.startswith(base) or url.startswith(('data:', 'blob:')):
            route.continue_()
        else:
            denied.append(url)
            route.abort()

    context.route('**/*', handle)
    return requested, denied


def ready(page):
    player = page.locator('#player')
    expect(player).to_have_attribute('data-ready', 'true', timeout=20_000)
    expect(page.locator('#director-view')).to_be_visible()
    return player


def frame_of(player):
    return int(player.get_attribute('data-frame'))


def wait_for(page, condition, description, seconds=8):
    deadline = monotonic() + seconds
    while not condition():
        assert monotonic() < deadline, description
        page.wait_for_timeout(50)


def drag(page, x, y, end_x, end_y, device=None):
    if device is None:
        page.mouse.move(x, y)
        page.mouse.down()
        page.mouse.move(end_x, end_y, steps=12)
        page.mouse.up()
    else:
        device.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x, 'y': y}]})
        for step in range(1, 13):
            point = {'x': x + (end_x - x) * step / 12, 'y': y + (end_y - y) * step / 12}
            device.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [point]})
        device.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})


def play_pause_seek(page, last, touch=None):
    player = ready(page)
    play = page.locator('#play')
    press_play = play.tap if touch else play.click
    expect(player).to_have_attribute('data-frame', '0')
    page.wait_for_timeout(280)
    assert frame_of(player) == 0, 'player should initially be paused'
    press_play()
    wait_for(page, lambda: frame_of(player) >= 3, 'playing did not move the timeline')
    press_play()
    paused = frame_of(player)
    page.wait_for_timeout(280)
    assert frame_of(player) == paused, 'pause failed to hold the timeline'
    box = page.locator('#seek').bounding_box()
    left, right = box['x'] + 8, box['x'] + 0.74 * box['width']
    y = box['y'] + box['height'] / 2
    drag(page, left, y, right, y, touch)
    selected = frame_of(player)
    assert 0.62 * last < selected < 0.85 * last, f'actual drag landed on unexpected frame {selected}'
    page.wait_for_timeout(280)
    assert frame_of(player) == selected, 'dragged frame failed to hold'
    return selected


def camera_round_trip(page, selected, touch=None):
    player, view = page.locator('#player'), page.locator('#director-view')
    toggle = page.locator('#camera-mode')
    press_camera = toggle.tap if touch else toggle.click
    expect(player).to_have_attribute('data-camera', 'director')
    before = view.screenshot()
    press_camera()
    expect(player).to_have_attribute('data-camera', 'orbit')
    expect(page.locator('#play')).to_be_disabled()
    box = view.bounding_box()
    x, y = box['x'] + box['width'] * 0.52, box['y'] + box['height'] * 0.58
    drag(page, x, y, x + 80, y - 40, touch)
    assert frame_of(player) == selected, 'orbit moved the timeline'
    assert before != view.screenshot(), 'manual orbit did not alter the rendered frame'
    press_camera()
    expect(player).to_have_attribute('data-camera', 'director')
    expect(page.locator('#play')).to_be_enabled()
    assert frame_of(player) == selected, 'returning to Director changed the selected frame'
    assert before == view.screenshot(), 'returning to Director did not restore the same frame and camera'


def link_at(page, base, seconds, endpoint):
    page.goto(f'{base}index.html?t={seconds}')
    player = ready(page)
    expect(player).to_have_attribute('data-frame', str(endpoint))
    page.wait_for_timeout(200)
    assert frame_of(player) == endpoint, f'deep-linked frame {endpoint} did not stay paused'


def blog(page, base, chapter_start, requests):
    mark = len(requests)
    page.goto(f'{base}blog-example.html')
    fallback = page.locator('#fallback-video')
    expect(fallback).to_be_visible()
    embed = page.locator('#director-embed')
    assert not embed.count() or embed.get_attribute('src') in (None, '', 'about:blank'), 'player requested before click'
    page.wait_for_timeout(300)
    early = [url.split('?', 1)[0] for url in requests[mark:]]
    assert not any(url.endswith(('/index.html', '/scene.json', '.glb')) for url in early), 'eager blog asset fetch'
    page.locator('#load-player').click()
    player = page.frame_locator('#director-embed').locator('#player')
    expect(player).to_have_attribute('data-ready', 'true', timeout=20_000)
    expect(player).to_have_attribute('data-frame', '0')
    expect(fallback).to_be_visible()
    if chapter_start is not None:
        page.reload()
        page.locator('#load-chapter').click()
        expect(player).to_have_attribute('data-ready', 'true', timeout=20_000)
        expect(player).to_have_attribute('data-frame', str(chapter_start))
        expect(fallback).to_be_visible()
    # Exercise the MP4 from a native video element after the embed has loaded.
    assert fallback.evaluate('video => video.poster') == f'{base}cover.png'
    fallback.evaluate('video => video.load()')
    wait_for(page, lambda: fallback.evaluate('video => video.readyState >= 2'), 'fallback did not decode', 12)
    assert fallback.evaluate('video => video.videoWidth > 0 && !video.error'), 'invalid fallback video'


def parity(page, base, movie, proof, fps):
    results = []
    for frame in (0, 67, 187, 246):
        link_at(page, base, frame / fps, frame)
        stage = page.locator('#director-view')
        # Align browser pixel size with the reference MP4 render for this comparison.
        stage.evaluate("el => { el.style.width = '640px'; el.style.maxWidth = 'none'; }")
        wait_for(page, lambda: stage.bounding_box()['width'] == 640, 'stage did not resize to reference width')
        page.evaluate('() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
        screen = proof / f'web-frame-{frame:03d}.png'
        decoded = proof / f'mp4-frame-{frame:03d}.png'
        stage.screenshot(path=screen)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(movie), '-vf', f'select=eq(n\\,{frame})',
                        '-frames:v', '1', str(decoded)], check=True)
        # Crop the outer margin and watermark, then compare geometry and captions.
        compare = '[0:v]scale=640:480,crop=576:424:32:52,format=yuv420p[a];[1:v]crop=576:424:32:52,format=yuv420p[b];[a][b]ssim'
        measured = subprocess.run(['ffmpeg', '-i', str(screen), '-i', str(decoded), '-filter_complex', compare, '-f', 'null', '-'],
                                  capture_output=True, text=True, check=True)
        score = float(re.search(r'All:([\d.]+)', measured.stderr).group(1))
        assert score >= 0.95, f'web/MP4 similarity too low at frame {frame}: {score:.4f}'
        results.append({'frame': frame, 'ssim': score})
    return results


def verify(args, proof):
    scene = json.loads((args.package / 'scene.json').read_text(encoding='utf-8'))
    manifest = json.loads((args.package / 'manifest.json').read_text(encoding='utf-8'))
    fps = scene.get('fps', 30)
    last = scene['frameCount'] - 1 if 'frameCount' in scene else round(scene['seconds'] * fps) - 1
    chapter = manifest.get('chapter')
    chapter_start = round(chapter['seconds'] * fps) if chapter else None
    results = {'package_sha256': {name: sha256((args.package / name).read_bytes()).hexdigest()
                                  for name in ('player.js', 'scene.json', 'blog-example.js')}}
    if args.mp4:
        results['reference_mp4_sha256'] = sha256(args.mp4.read_bytes()).hexdigest()
    with relocated(args.package) as base, sync_playwright() as playwright:
        browser = playwright.chromium.launch(channel='chrome', args=['--enable-unsafe-swiftshader'])
        desktop = browser.new_context(viewport={'width': 1024, 'height': 820}, device_scale_factor=1, service_workers='block')
        requests, denied = network_guard(desktop, base)
        errors = []
        page = desktop.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(f'{base}index.html')
        results['desktop_frame'] = play_pause_seek(page, last)
        camera_round_trip(page, results['desktop_frame'])
        for seconds, frame in [('6.233333333333333', 187), ('8.2', 246), ('-5', 0), ('999', last), ('invalid', 0)]:
            link_at(page, base, seconds, min(frame, last))
        if last == 359 and fps == 30 and chapter_start == 187:
            captions = scene['captions']
            for frame in (186, 187, 246):
                seconds = frame / fps
                expected = next(caption['text'] for caption in captions if caption['start'] <= seconds < caption['end'])
                link_at(page, base, seconds, frame)
                expect(page.locator('#caption-text')).to_have_text(expected)
        link_at(page, base, (last - 5) / fps, last - 5)
        page.locator('#play').click()
        expect(page.locator('#player')).to_have_attribute('data-frame', str(last))
        page.wait_for_timeout(280)
        assert frame_of(page.locator('#player')) == last, 'playback failed to stop on the final frame'
        if args.mp4:
            assert fps == 30 and last == 359, 'the MP4 comparison expects the finalized 12-second FLOW1 scene'
            results['mp4_parity'] = parity(page, base, args.mp4, proof, fps)
        blog_page = desktop.new_page()
        blog_page.on('pageerror', lambda error: errors.append(str(error)))
        blog(blog_page, base, chapter_start, requests)
        assert not denied, f'out-of-package desktop requests: {denied}'
        assert not errors, f'desktop page errors: {errors}'
        results['desktop_requests'] = len(requests)

        failure = desktop.new_page()
        failure.route('**/assets/model-*.glb', lambda route: route.fulfill(status=404))
        failure.goto(f'{base}blog-example.html')
        with failure.expect_response(lambda response: '/assets/model-' in response.url and response.status == 404):
            failure.locator('#load-player').click()
        failed_player = failure.frame_locator('#director-embed').locator('#player')
        expect(failed_player).to_have_attribute('data-failed', 'true')
        expect(failed_player).not_to_have_attribute('data-ready', 'true')
        expect(failure.frame_locator('#director-embed').locator('#player-error')).to_be_visible()
        expect(failure.locator('#fallback-video')).to_be_visible()
        failed_fallback = failure.locator('#fallback-video')
        failed_fallback.evaluate('video => video.load()')
        wait_for(failure, lambda: failed_fallback.evaluate('video => video.readyState >= 2'), 'fallback did not decode after missing model', 12)
        assert not denied, f'out-of-package desktop requests: {denied}'
        results['missing_model_fallback'] = 'passed'

        mobile = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1,
                                     is_mobile=True, has_touch=True, service_workers='block')
        mobile_requests, mobile_denied = network_guard(mobile, base)
        phone = mobile.new_page()
        mobile_errors = []
        phone.on('pageerror', lambda error: mobile_errors.append(str(error)))
        phone.goto(f'{base}index.html')
        touch = mobile.new_cdp_session(phone)
        results['mobile_frame'] = play_pause_seek(phone, last, touch)
        camera_round_trip(phone, results['mobile_frame'], touch)
        for width in (390, 320):
            phone.set_viewport_size({'width': width, 'height': 844})
            wait_for(phone, lambda: phone.evaluate('document.documentElement.clientWidth') == width, f'incorrect layout width at {width}px')
            assert phone.evaluate('document.documentElement.scrollWidth <= innerWidth'), f'viewport overflows at {width}px'
            stage = phone.locator('#director-view').bounding_box()
            assert abs(stage['width'] / stage['height'] - 4 / 3) < 0.02, f'wrong stage aspect at {width}px'
            phone.screenshot(path=proof / f'phone-{width}.png')
        assert not mobile_denied, f'out-of-package mobile requests: {mobile_denied}'
        assert not mobile_errors, f'mobile page errors: {mobile_errors}'
        results['mobile_requests'] = len(mobile_requests)
        results['out_of_package_requests'] = len(denied) + len(mobile_denied)
        results['browser'] = browser.version
        browser.close()
    return results


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('package', type=Path)
    parser.add_argument('--mp4', type=Path)
    parser.add_argument('--proof-dir', type=Path)
    args = parser.parse_args()
    with TemporaryDirectory(prefix='director-web-proof-') as temporary:
        proof = args.proof_dir or Path(temporary)
        proof.mkdir(parents=True, exist_ok=True)
        results = json.dumps(verify(args, proof), indent=2)
        if args.proof_dir:
            (proof / 'results.json').write_text(results + '\n', encoding='utf-8')
        print(results)


if __name__ == '__main__':
    main()
