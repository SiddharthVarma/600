#!/usr/bin/env python3
"""Behaviour regression test for Six Hundred.

Plays the game the way a player would, in a real headless browser, and writes down what happens: SUDO's walkthrough,
a fault fixed through its ticket and terminal, a wrong procedure rejected, every celestial event (ticket, emergency
script, abort, reopen, result), the creature, a science request paid out, a replacement launch, a total loss and
relaunch, and every minigame rendering. Any JavaScript error anywhere is recorded too.

It does this twice, against a build of a base commit (HEAD by default) and against a build of the working copy, and
compares the two records line by line. Nothing needs hand-written expected values: the old build is the expected
result. A difference is either a change you meant to make or a regression.

    python3 scripts/regress.py                 # HEAD vs the working copy
    python3 scripts/regress.py --base main     # main vs the working copy
    python3 scripts/regress.py --only          # just the working copy, printing its record (a smoke test)

Needs Node (for the Vite builds) and Python Playwright (`pip install playwright`), driving the installed Google Chrome.
Randomness is seeded, so both builds roll the same faults, satellites and science requests; values that still vary
by timing (seconds left on a countdown, which satellite) are reduced to what matters before comparing.
"""

import argparse
import asyncio
import difflib
import functools
import http.server
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading

from playwright.async_api import async_playwright

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Math.random, seeded (mulberry32), so both builds roll the same dice
SEED = """(() => { let s = 1234567; Math.random = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();"""

# the procedure that fixes each everyday fault
FIX = {
    'solar': 'align_array.py', 'contact': 'contact_acq.py', 'process': 'cpu_purge.py', 'orbit': 'orbit_burn.py',
    'power': 'power_cycle.py', 'thermal': 'thermal_reroute.py', 'startracker': 'tracker_recal.py', 'wheel': 'wheel_reconfig.py',
}
# each celestial event: how to start it, its emergency script, its window, and the message its minigame sends when won
EVENTS = {
    'flare': ('triggerFlare()', 'flare_reconnect.py', 'flareModal',
              "{type:'flare-resolved', results: activeEvent.sats.map(s => ({satId: s.id, fixed: true}))}"),
    'grb': ('triggerGRB()', 'grb_scrub.py', 'grbModal',
            "{type:'grb-resolved', results: activeEvent.sats.map(s => ({satId: s.id, fixed: true}))}"),
    'debris': ('triggerDebris()', 'debris_avoidance.py', 'debrisModal', "{type:'debris-resolved', survived: true}"),
}
PANEL_OPEN = "panel.classList.contains('open')"


def norm(text):
    """Reduce what varies by timing or by which satellite was picked."""
    text = re.sub(r'\bSAT \d{3}\b', 'SAT ###', str(text))
    text = re.sub(r'\b\d+s\b', 'Ns', text)
    text = re.sub(r'\b\d+:\d\d\b', 'M:SS', text)
    return ' '.join(text.split())


def file_sel(name):
    return '.term-file[data-file="%s"]' % name


# ---- builds and servers ----

def build(src, out):
    subprocess.run(['npx', 'vite', 'build', '--outDir', out, '--emptyOutDir'], cwd=src, check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def build_base(ref, out, tmp):
    wt = os.path.join(tmp, 'base-src')
    subprocess.run(['git', 'worktree', 'add', '--detach', wt, ref], cwd=REPO, check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        os.symlink(os.path.join(REPO, 'node_modules'), os.path.join(wt, 'node_modules'))
        build(wt, out)
    finally:
        subprocess.run(['git', 'worktree', 'remove', '--force', wt], cwd=REPO,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def serve(directory):
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=directory))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, 'http://127.0.0.1:%d/' % server.server_address[1]


# ---- the session ----

class Session:
    def __init__(self, browser, url):
        self.browser, self.url, self.log, self.errors = browser, url, [], []

    def note(self, section, text):
        self.log.append('%-10s %s' % (section, norm(text)))

    async def page(self, path='', skip_intro=True):
        context = await self.browser.new_context(viewport={'width': 1440, 'height': 900})
        await context.add_init_script(SEED)
        page = await context.new_page()
        page.on('pageerror', lambda e: self.errors.append('%s: %s' % (path or 'main', e)))
        await page.goto(self.url + path)
        if not path:
            await self.until(page, "!!document.querySelector('.sudo.on')", 6000)
            if skip_intro:
                await self.click(page, '.sudo-skip')
                await page.wait_for_timeout(200)
        return page

    # small helpers, so the checks below read as plain sentences
    async def until(self, page, js, timeout=8000):
        for _ in range(timeout // 100):
            try:
                if await page.evaluate(js):
                    return True
            except Exception:
                pass
            await page.wait_for_timeout(100)
        return False

    async def text(self, page, sel):
        return await page.evaluate("(document.querySelector(%r) || {}).textContent || ''" % sel)

    async def exists(self, page, sel):
        return await page.evaluate('!!document.querySelector(%r)' % sel)

    async def click(self, page, sel):
        await page.evaluate('document.querySelector(%r).click()' % sel)

    async def shown(self, page, element_id):
        return await page.evaluate("document.getElementById(%r).classList.contains('show')" % element_id)

    def shown_js(self, element_id):
        return "document.getElementById(%r).classList.contains('show')" % element_id

    async def newest_alert(self, page):
        return await self.text(page, '.alert:not(.out) .alert-title')

    # SUDO's walkthrough opens on load, and skip hands the game over
    async def walkthrough(self):
        p = await self.page(skip_intro=False)
        self.note('sudo', 'walkthrough shows on load: %s' % await self.exists(p, '.sudo.on'))
        await self.until(p, "(document.querySelector('.sudo-text') || {}).textContent.length > 60", 8000)
        self.note('sudo', 'first line starts: %s' % (await self.text(p, '.sudo-text'))[:40])
        await self.click(p, '.sudo-skip')
        await p.wait_for_timeout(300)
        self.note('sudo', 'skip closes it: %s' % (not await self.exists(p, '.sudo')))
        self.note('boot', 'count reads %s' % await self.text(p, '#network'))
        await p.context.close()

    # a fault: its ticket opens the terminal, a wrong procedure is refused, the right one opens the repair and fixes it
    async def fault(self):
        p = await self.page()
        await p.evaluate('trySpawnAnomaly()')
        self.note('fault', 'ticket: %s' % await self.newest_alert(p))
        await self.click(p, '.alert.crit')
        await p.wait_for_timeout(300)
        crosshair = await p.evaluate('highlighted.length === 1 && highlighted[0] === selected')
        self.note('fault', 'ticket opens terminal: %s, crosshair on it: %s' % (await p.evaluate(PANEL_OPEN), crosshair))
        self.note('fault', 'status: %s' % await self.text(p, '#status'))
        await self.until(p, "!!document.querySelector('.term-file')", 6000)
        kind = await p.evaluate('selected.anomalyType')
        wrong = next(f for t, f in FIX.items() if t != kind)
        await self.click(p, file_sel(wrong))
        await p.wait_for_timeout(3500)
        self.note('fault', 'wrong procedure opens a repair: %s' % await self.shown(p, 'repairModal'))
        await self.until(p, '!!document.querySelector(%r)' % file_sel(FIX[kind]), 6000)
        await self.click(p, file_sel(FIX[kind]))
        opened = await self.until(p, self.shown_js('repairModal'), 8000)
        frame = await p.evaluate("document.getElementById('repairFrame').src")
        self.note('fault', 'right procedure opens its repair: %s, the right game: %s' % (opened, ('type=' + kind) in frame))
        await p.evaluate("window.postMessage({type:'repair-complete'}, '*')")
        await p.wait_for_timeout(400)
        self.note('fault', 'after repair: %s, alert: %s' % (await self.text(p, '#status'), await self.newest_alert(p)))
        await p.wait_for_timeout(2000)
        self.note('fault', 'terminal closes itself after: %s' % (not await p.evaluate(PANEL_OPEN)))
        # the rings aren't clickable: a click on the canvas opens nothing
        await p.mouse.click(720, 300)
        await p.wait_for_timeout(200)
        self.note('fault', 'clicking the rings opens a terminal: %s' % await p.evaluate(PANEL_OPEN))
        await p.context.close()

    # each celestial event: ticket, SUDO's line, emergency script, abort and reopen, result
    async def events(self):
        for kind, (trigger, script, modal, won) in EVENTS.items():
            p = await self.page()
            await p.evaluate(trigger)
            ok = await self.until(p, "!!document.querySelector('.alert.emergency')", 12000)
            self.note(kind, 'ticket: %s' % (await self.newest_alert(p) if ok else 'NONE'))
            if not ok:
                await p.context.close()
                continue
            # SUDO types its lines out, so wait until it's well past the part compared
            await self.until(p, "(document.querySelector('.sudo.on .sudo-text') || {textContent: ''}).textContent.length > 60", 8000)
            self.note(kind, 'sudo says: %s' % (await self.text(p, '.sudo.on .sudo-text'))[:40])
            await self.click(p, '.alert.emergency')
            await self.until(p, '!!document.querySelector(%r)' % file_sel(script), 6000)
            self.note(kind, 'terminal: %s' % await self.text(p, '#satName'))
            await self.click(p, file_sel(script))
            opened = await self.until(p, self.shown_js(modal), 10000)
            await p.wait_for_timeout(500)  # SUDO notices the window on its next check, four times a second
            self.note(kind, 'script opens its minigame: %s, sudo line gone: %s' % (opened, not await self.exists(p, '.sudo.on')))
            await self.click(p, '#%s [data-abort]' % modal)
            await p.wait_for_timeout(400)
            self.note(kind, 'abort returns to waiting: %s' % await p.evaluate("!!activeEvent && activeEvent.phase === 'pending'"))
            await self.click(p, '.alert.emergency')
            await self.until(p, '!!document.querySelector(%r)' % file_sel(script), 6000)
            await self.click(p, file_sel(script))
            await self.until(p, self.shown_js(modal), 10000)
            await p.evaluate("window.postMessage(%s, '*')" % won)
            await p.wait_for_timeout(600)
            self.note(kind, 'won: %s · count %s · event over: %s' % (
                await self.newest_alert(p), await self.text(p, '#network'), await p.evaluate('!activeEvent')))
            await p.context.close()

    # the creature: corrupts SUDO, sends tentacles, and leaves
    async def creature(self):
        p = await self.page()
        await p.evaluate('triggerKraken()')
        await p.wait_for_timeout(4500)
        self.note('creature', 'tentacles out: %s, sudo corrupted: %s' % (
            await p.evaluate('kraken.tentacles.length > 0'), await self.exists(p, '.sudo-corrupt')))
        self.note('creature', 'ticket: %s' % await self.newest_alert(p))
        await p.evaluate('activeEvent.left = 1')
        gone = await self.until(p, '!activeEvent', 4000)
        await p.wait_for_timeout(1800)
        self.note('creature', 'leaves: %s, sudo recovers: %s' % (gone, (await self.text(p, '.sudo.on .sudo-text'))[:24]))
        await p.context.close()

    # a science request: it arrives, dives, pays on downlink
    async def science(self):
        p = await self.page()
        await p.evaluate("pushScience('penguins', true)")
        await p.wait_for_timeout(300)
        self.note('science', 'card: %s' % await self.text(p, '.science-ticket .alert-body'))
        await self.click(p, '.science-ticket')
        opened = await self.until(p, self.shown_js('scienceModal'), 6000)
        src = await p.evaluate("document.getElementById('scienceFrame').src")
        self.note('science', 'dives into its window: %s, window: %s' % (opened, src.split('?')[1].split('&')[0]))
        await p.evaluate("window.postMessage({type:'science-complete', found: 4, total: 4, wrong: 0}, '*')")
        await p.wait_for_timeout(300)
        self.note('science', 'paid: %s · credits %s' % (await self.text(p, '.science-note'), await self.text(p, '#credits span')))
        await p.evaluate("window.postMessage({type:'science-close'}, '*')")
        await p.wait_for_timeout(500)
        self.note('science', 'window closes: %s' % (not await self.shown(p, 'scienceModal')))
        await p.context.close()

    # a replacement launch: LAUNCH appears, dives to the pad, pays and restores on deploy
    async def launch(self):
        p = await self.page()
        await p.evaluate('satellites[5].lost = true; satellites[6].lost = true; earn(15)')
        await p.wait_for_timeout(700)
        self.note('launch', 'button shows: %s' % await p.evaluate("!document.getElementById('launch').hidden"))
        await p.evaluate("document.querySelectorAll('.sudo').forEach(e => e.remove()); document.getElementById('launch').click()")
        opened = await self.until(p, self.shown_js('launchModal'), 6000)
        src = await p.evaluate("document.getElementById('launchFrame').src")
        self.note('launch', 'opens launch control: %s, count=%s' % (opened, src.split('count=')[1].split('&')[0] if 'count=' in src else '?'))
        await p.evaluate("window.postMessage({type:'launch-complete'}, '*'); window.postMessage({type:'launch-close'}, '*')")
        await p.wait_for_timeout(600)
        self.note('launch', 'after deploy: credits %s, lost %s, window closed: %s' % (
            await self.text(p, '#credits span'), await p.evaluate('satellites.filter(s => s.lost).length'),
            not await self.shown(p, 'launchModal')))
        await p.context.close()

    # losing everything, then relaunching the constellation
    async def relaunch(self):
        p = await self.page()
        await p.evaluate("satellites.slice(1).forEach(s => s.lost = true); trySpawnAnomaly()")
        await self.click(p, '.alert.crit')
        await p.wait_for_timeout(300)
        await p.evaluate("window.postMessage({type:'repair-failed'}, '*')")
        await p.wait_for_timeout(500)
        self.note('relaunch', 'total loss shows: %s' % await self.shown(p, 'gameOver'))
        await self.click(p, '#restartAll')
        await p.wait_for_timeout(500)
        self.note('relaunch', 'after relaunch: %s, credits %s' % (await self.text(p, '#network'), await self.text(p, '#credits span')))
        await p.context.close()

    # every minigame renders its title and its board, with no errors. Some boards are a canvas or SVG, others are
    # built from elements (CPU Overload's process list, the bit-flip registers), so either counts.
    async def minigames(self):
        catalog = open(os.path.join(REPO, 'src/repair/shared/catalog.js')).read()
        for game in re.findall(r"\['(\w+)', '", catalog):
            p = await self.page('react.html?type=' + game)
            await p.wait_for_timeout(700)
            title = await p.evaluate("(document.querySelector('.board h1') || {}).textContent || 'NO TITLE'")
            board = await p.evaluate(
                "!!document.querySelector('.board canvas, .board svg') || document.querySelector('.board').querySelectorAll('*').length > 40")
            self.note('minigame', '%s: %s · board rendered: %s' % (game, title, board))
            await p.context.close()

    async def run(self):
        for part in (self.walkthrough, self.fault, self.events, self.creature, self.science, self.launch, self.relaunch, self.minigames):
            try:
                await part()
            except Exception as e:
                self.note(part.__name__, 'CHECK FAILED: %s' % str(e).splitlines()[0])
        self.log.append('%-10s %d' % ('errors', len(self.errors)))
        self.log += ['%-10s %s' % ('error', e) for e in self.errors]
        return self.log


async def record(url):
    async with async_playwright() as p:
        try:
            browser = await p.chromium.launch(channel='chrome')
        except Exception:
            browser = await p.chromium.launch()
        try:
            return await Session(browser, url).run()
        finally:
            await browser.close()


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    ap.add_argument('--base', default='HEAD', help='git ref to compare against (default: HEAD)')
    ap.add_argument('--only', action='store_true', help='test the working copy alone and print its record')
    args = ap.parse_args()
    tmp = tempfile.mkdtemp(prefix='regress-')
    try:
        print('building the working copy…', flush=True)
        build(REPO, os.path.join(tmp, 'new'))
        new_server, new_url = serve(os.path.join(tmp, 'new'))
        print('playing it…', flush=True)
        new = asyncio.run(record(new_url))
        if args.only:
            print('\n'.join(new))
            return 1 if any(line.startswith(('error ', 'CHECK FAILED')) or 'CHECK FAILED' in line for line in new) else 0
        print('building %s…' % args.base, flush=True)
        build_base(args.base, os.path.join(tmp, 'base'), tmp)
        base_server, base_url = serve(os.path.join(tmp, 'base'))
        print('playing it…', flush=True)
        base = asyncio.run(record(base_url))
        diff = list(difflib.unified_diff(base, new, 'base (%s)' % args.base, 'working copy', lineterm='', n=0))
        print('\n%d checks · %s' % (len(new), 'no differences' if not diff else 'differences:'))
        if diff:
            print('\n'.join(line for line in diff[2:] if not line.startswith('@@')))
        new_server.shutdown()
        base_server.shutdown()
        return 1 if diff else 0
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == '__main__':
    sys.exit(main())
