"""Exercise M1's sample-data routes on an already running development build.

Requires Python 3.11+, adb, and a connected Android device/emulator. The app must
be at its sign-in screen with development fixtures enabled. This script does not
sign into a real account, clear app storage, or modify portfolio data.
"""

from __future__ import annotations

import argparse
import re
import subprocess
import time
import xml.etree.ElementTree as ET
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--adb", default="adb")
    parser.add_argument("--serial", required=True)
    parser.add_argument("--output", type=Path, default=Path("artifacts/m1"))
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    remote_xml = "/sdcard/worthfolio-smoke.xml"

    def adb(*parts: str) -> str:
        return subprocess.check_output(
            [args.adb, "-s", args.serial, *parts], text=True, encoding="utf-8", errors="replace", timeout=30
        )

    def tree() -> ET.Element:
        adb("shell", "uiautomator", "dump", remote_xml)
        return ET.fromstring(adb("shell", "cat", remote_xml))

    def matching(root: ET.Element, label: str) -> ET.Element | None:
        for node in root.iter("node"):
            description = node.get("content-desc", "")
            if label == node.get("text") or description == label or description.startswith(label + ","):
                return node
        return None

    def wait_for(label: str) -> ET.Element:
        deadline = time.monotonic() + 30
        root = tree()
        while matching(root, label) is None:
            if time.monotonic() >= deadline:
                ET.ElementTree(root).write(args.output / "failure.xml", encoding="utf-8")
                raise AssertionError(f"Expected visible UI label: {label}")
            time.sleep(0.5)
            root = tree()
        return root

    def tap(label: str) -> None:
        root = wait_for(label)
        node = matching(root, label)
        assert node is not None
        parents = {child: parent for parent in root.iter() for child in parent}
        target = node
        while target.get("clickable") != "true" and target in parents:
            target = parents[target]
        if target.get("clickable") != "true":
            target = node
        coordinates = [int(value) for value in re.findall(r"\d+", target.get("bounds", ""))]
        if len(coordinates) != 4:
            raise AssertionError(f"No tappable bounds for {label}")
        left, top, right, bottom = coordinates
        adb("shell", "input", "tap", str((left + right) // 2), str((top + bottom) // 2))

    def capture(name: str) -> None:
        root = tree()
        ET.ElementTree(root).write(args.output / f"{name}.xml", encoding="utf-8")
        remote_png = "/sdcard/worthfolio-smoke.png"
        adb("shell", "screencap", "-p", remote_png)
        adb("pull", remote_png, str(args.output / f"{name}.png"))
        print(f"PASS {name}", flush=True)

    wait_for("Explore sample portfolio")
    capture("01-sign-in")
    tap("Explore sample portfolio")
    wait_for("Your holdings")
    wait_for("$16,800.00")
    capture("02-portfolio")
    tap("Open Apple")
    wait_for("Touch the chart to inspect a price.")
    capture("03-instrument")
    adb("shell", "input", "keyevent", "4")
    tap("Watchlists")
    tap("On my radar")
    wait_for("NVDA")
    capture("04-watchlists")
    tap("Search")
    tap("Search instruments")
    adb("shell", "input", "text", "Apple")
    wait_for("Open Apple")
    capture("05-search")
    tap("Open Apple")
    wait_for("Touch the chart to inspect a price.")
    adb("shell", "input", "keyevent", "4")
    tap("Portfolio")
    tap("Account settings")
    wait_for("Your account")
    capture("06-account")
    tap("Leave sample portfolio")
    wait_for("Sign in with Authentik")
    print("PASS sample session exit", flush=True)


if __name__ == "__main__":
    main()
