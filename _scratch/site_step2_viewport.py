#!/usr/bin/env python
"""STEP 2 — Responsive baseline + viewport audit for the D&D site (2026-09-29).

Part A: CSS architecture inventory (grid/flex/media-queries per page, viewport meta).
Part B: headless viewport stress test across 8 resolutions (320x480 mobile -> 3840x2160 4K):
for each page and each viewport, drive a real Chromium and measure
  * horizontal overflow (document.scrollWidth vs clientWidth)  -> parasitic scrollbar
  * layout-shift proxy: element count + the widest element right edge
  * text clipping: elements whose scrollWidth > clientWidth with overflow hidden

Usage:  python site_step2_viewport.py [--part a|b|both]
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

SITE = Path(r"C:\Users\Fabrizio\workspace\public-site")
OUT = SITE / "_scratch" / "step2_viewport.json"
PAGES = ["index.html", "personaggi.html", "cerca.html", "risorse.html", "tavolo.html",
         "stats.html", "widgets.html", "lfg.html"]
VIEWPORTS = [(320, 480), (375, 667), (414, 896), (768, 1024), (1024, 768),
             (1366, 768), (1920, 1080), (3840, 2160)]


def part_a() -> dict:
    out = {}
    for pg in PAGES:
        c = (SITE / pg).read_text(encoding="utf-8", errors="replace")
        vp = re.search(r'<meta[^>]*name="viewport"[^>]*>', c, re.I)
        out[pg] = {
            "kb": round(len(c) / 1024, 1),
            "viewport_meta": vp.group(0)[:80] if vp else "MISSING",
            "display_grid": len(re.findall(r"display:\s*grid", c)),
            "display_flex": len(re.findall(r"display:\s*flex", c)),
            "media_queries": len(re.findall(r"@media", c)),
            "safe_area": len(re.findall(r"env\(safe-area", c, re.I)),
            "contrast_tokens": len(re.findall(r"--(fg|bg|border|accent)", c)),
        }
    return out


def part_b() -> dict:
    """Real headless viewport stress via browser_exec is done OUTSIDE this script (the
    browser tool runs in its own session). Here we prepare the per-page JS probe payload
    that the browser will evaluate at each viewport."""
    probe_js = """
    (() => {
      const doc = document.documentElement;
      const overflowX = doc.scrollWidth - doc.clientWidth;
      const parasitic = overflowX > 2;
      let clipped = 0, worst = null;
      document.querySelectorAll('body *').forEach(el => {
        const cs = getComputedStyle(el);
        if (cs.position === 'fixed' || cs.display === 'none') return;
        if (el.scrollWidth > el.clientWidth + 4 && el.clientWidth > 0) {
          clipped++;
          if (!worst || el.scrollWidth > worst.sw) worst = {
            tag: el.tagName, cls: (el.className||'').toString().slice(0,40),
            sw: el.scrollWidth, cw: el.clientWidth };
        }
      });
      return { overflowX, parasitic, clipped, worst,
               vw: window.innerWidth, vh: window.innerHeight };
    })()
    """
    (SITE / "_scratch" / "viewport_probe.js").write_text(probe_js, encoding="utf-8")
    return {"pages": PAGES, "viewports": VIEWPORTS,
            "probe": "_scratch/viewport_probe.js (evaluated by the headless browser per viewport)"}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--part", default="both")
    args = ap.parse_args()
    out = {}
    if args.part in ("a", "both"):
        out["a_css_inventory"] = part_a()
        print("=== A. CSS architecture (baseline) ===")
        for pg, d in out["a_css_inventory"].items():
            print(f"   {pg:16s} {d['kb']:7.1f}KB grid={d['display_grid']:3d} flex={d['display_flex']:3d} "
                  f"media={d['media_queries']:3d} safe-area={d['safe_area']} vp={'ok' if 'MISSING' not in d['viewport_meta'] else 'MISSING!'}")
    if args.part in ("b", "both"):
        out["b_viewport_plan"] = part_b()
        print("\n=== B. viewport stress plan written (probe for the headless browser) ===")
        print(f"    resolutions: {VIEWPORTS[0]} ... {VIEWPORTS[-1]} ({len(VIEWPORTS)} total)")
    OUT.write_text(json.dumps(out, indent=1), encoding="utf-8")
    print(f"\nartifact: {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
