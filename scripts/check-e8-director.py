"""Verify the E8 Director demo with Chromium and the shared E8 renderer."""

import argparse
import json
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from playwright.sync_api import sync_playwright


def main(url: str, output: Path) -> None:
    output.mkdir(parents=True, exist_ok=True)
    errors = []
    wuri = parse_qs(urlsplit(url).query).get("site") == ["wuri"]
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            channel="chrome", args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
        )
        page = browser.new_page(viewport={"width": 1240, "height": 820})
        page.set_default_timeout(12000)
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
        street_tiles = []
        page.on("response", lambda response: street_tiles.append(response.url)
                if response.ok and response.url.startswith("https://wmts.nlsc.gov.tw/wmts/EMAP/") else None)
        page.goto(url, wait_until="domcontentloaded")
        slider = page.locator("#seek")
        camera = page.locator("#camera")
        note = page.locator("#notes span")
        page.wait_for_function("!document.querySelector('#seek').disabled")
        assert page.locator("#map canvas").count() == 1

        def seek(frame: int) -> None:
            slider.evaluate("(slider, frame) => { slider.value=frame; slider.dispatchEvent(new Event('input')); }", frame)

        def phase(frame: int, text: str) -> None:
            seek(frame)
            page.get_by_text(text, exact=True).first.wait_for(state="visible")

        phase(90, "閥片打開，正向通過")
        page.screenshot(path=str(output / "forward.png"))
        phase(150, "停流")
        assert "停流" in page.locator("#caption").inner_text()
        phase(240, "逆流在閥座截止")
        page.screenshot(path=str(output / "reverse.png"))

        page.locator("#play").click()
        page.wait_for_function("Number(document.querySelector('#seek').value) > 240")
        page.locator("#play").click()
        assert page.locator("#play").inner_text() == "播放"
        phase(90, "閥片打開，正向通過")
        moved_note = """prior => {
            const element = document.querySelector('#notes span');
            return element && element.style.cssText !== prior;
        }"""
        first = note.evaluate("element => element.style.cssText")
        canvas = page.locator("#map canvas").bounding_box()
        assert canvas is not None
        x, y = canvas["x"] + canvas["width"] / 2, canvas["y"] + canvas["height"] / 2
        page.mouse.move(x, y)
        page.mouse.down()
        page.mouse.move(x + 75, y + 27, steps=8)
        page.mouse.up()
        page.wait_for_function(moved_note, arg=first)
        note.wait_for(state="visible")
        after_pan = note.evaluate("element => element.style.cssText")
        page.mouse.wheel(0, -135)
        page.wait_for_function(moved_note, arg=after_pan)
        note.wait_for(state="visible")

        camera.click()
        page.get_by_role("button", name="回地圖操作").wait_for()
        assert slider.input_value() == "90"
        page.screenshot(path=str(output / "director.png"))
        camera.click()
        page.get_by_role("button", name="切換導演視角").wait_for()
        assert slider.input_value() == "90"

        if wuri:
            page.get_by_text("高鐵台中站｜站前步行區。示範排水逆止與模型定位。", exact=True).wait_for()
            page.get_by_role("button", name="站區總覽", exact=True).click()
            page.get_by_role("button", name="回到單向閥", exact=True).wait_for()
            page.get_by_text("底圖 © 內政部國土測繪中心", exact=True).wait_for(state="attached")
            assert street_tiles, "Wuri street tiles did not load"
            assert slider.input_value() == "90"
            page.screenshot(path=str(output / "wuri-overview.png"))
            page.get_by_role("button", name="回到單向閥", exact=True).click()
            page.get_by_role("button", name="站區總覽", exact=True).wait_for()
            note.wait_for(state="visible")
            assert slider.input_value() == "90"

        page.locator("#detach").click()
        assert slider.is_disabled() and not note.count() and page.locator("#caption").is_hidden()
        assert page.locator("#overview").is_disabled()
        assert page.locator("#map canvas").count() == 1
        page.screenshot(path=str(output / "detached.png"))

        page.locator("#altitude").fill("3")
        page.locator("#heading").fill("125")
        page.locator("#attach").click()
        page.get_by_text("使用指定的圖台高程。底圖未啟用地形。", exact=True).wait_for()
        phase(90, "閥片打開，正向通過")
        assert not errors, errors
        browser.close()

    proof = {
        "url": url, "browser": "Chrome WebGL",
        "phases": ["forward", "stopped", "reverse cutoff"],
        "map_pan_zoom_updates_projected_note": True,
        "play_pause_and_reverse_seek": True,
        "director_camera_switch_keeps_frame": True,
        "detach_unloads_labels_and_remount_with_height": True,
        "javascript_errors": errors,
    }
    if wuri:
        proof["wuri_overview_returns_to_valve_at_same_frame"] = True
        proof["street_tile_responses_ok"] = len(street_tiles)
    (output / "results.json").write_text(json.dumps(proof, indent=2) + "\n", encoding="utf-8")
    print(output / "results.json")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("url", help="URL of the demo, optionally with ?site=wuri")
    parser.add_argument("output", type=Path, help="Folder for validation results and screenshots")
    args = parser.parse_args()
    main(args.url, args.output)
