# Lessons learnt

Problems found while play-testing Six Hundred, what caused them, how they were fixed, and why the fix works, plus the
engineering practices and tools used to build it safely. Each entry ends with a one-line takeaway for explaining it in an
interview.

---

## 1. "It's still broken" after a fix: stale browser cache

**Found while testing:** after the Missed Contact crosshair lag was fixed, the crosshair still lagged in the browser. Earlier, minigames had shown up blank for the same reason.

**Root cause:** `react.html` loads the minigame code as `react-app.jsx?v=<date>`. The local dev server (`python3 -m http.server`) sends a `Last-Modified` header, and browsers cache files like that on their own. The `?v=` value hadn't changed for a month, so the browser kept running the old file.

**Fix:** bump the `?v=` value in `react.html` on every change to `react-app.jsx` or `react-styles.css`.

**Why it works:** a different query string is a different URL, and a different URL is a separate cache entry, so the browser has to fetch the new file. This is called cache busting.

**Takeaway:** before debugging the code, confirm what the browser is actually running.

---

## 2. One pasted URL blanked every minigame

**Found while testing:** every minigame opened blank at once.

**Root cause:** a URL had been accidentally pasted into the middle of `react-app.jsx`, which is a syntax error. All minigames live in that one file, and it's compiled in the browser by Babel, so one error stops all of them.

**Fix:** removed the stray text. CI on GitHub now runs a syntax check (`esbuild`) on every push, so a broken file fails before it reaches the live site.

**Why it works:** the check finds the error at push time instead of a player finding it at play time.

**Takeaway:** one big file compiled at runtime is a single point of failure, so automated checks need to catch errors before deploy.

---

## 3. A minigame took ~10 seconds to appear (or stayed blank)

**Found while testing:** after clicking `burn_plan.py` in the terminal, the minigame took about 10 seconds to show. Once, the star tracker window stayed blank.

**Root cause:** every minigame opens a fresh page that downloads about 4.3 MB from unpkg, a free public CDN. That's React and ReactDOM development builds, plus the 3.1 MB Babel compiler. It then compiles all the JSX in the player's browser. When unpkg is slow, the player waits; when it hiccups, the page stays blank. The project's own files are only about 150 KB, so the host (Cloudflare Pages) wasn't the problem.

**Fix applied:** the minigame now loads in a hidden iframe while the terminal log plays (about 2 seconds). It tells the main page `repair-loaded` once it's compiled, and only starts its gameplay and timer when the main page sends `repair-start`, which happens when the window is actually on screen.

**Why it works:** the slow part (download and compile) overlaps with something the player is already watching. The handshake means no repair time ticks away while the game is hidden. Measured with a simulated 4-second CDN delay, 2 of the 4 seconds were hidden. On a normal connection the game appears 0.1 s after the window opens.

**Follow-up:** the JSX is now compiled once at deploy time and React ships as its production build, so Babel's 3.1 MB download is gone entirely (see #17).

**Takeaway:** hide unavoidable latency behind work the user is already watching, but never let hidden work spend the user's time. Measure before and after.

---

## 4. Arrow keys did nothing in the Debris minigame

**Found while testing:** Debris opened on its own, but ← → didn't move the ship.

**Root cause:** the pop-up opens without the player clicking anything, so keyboard focus stays on the main page. Key presses go to the document that has focus, not to the iframe inside it.

**Fix:** when the iframe finishes loading, the main page calls `frame.contentWindow.focus()`. The Solar Flare event does the same.

**Why it works:** focus is per document. Handing focus to the iframe sends key events there.

**Takeaway:** iframes don't receive keyboard input until they have focus, so a pop-up the user didn't click needs focus given to it in code.

---

## 5. The flare timer pauses when you switch tabs

**Found while testing:** a solar flare was running in one tab. After a few minutes in another tab, the flare picked up exactly where it left off.

**Root cause:** browsers stop calling `requestAnimationFrame` for hidden tabs. The flare's clock only advances inside that loop: each frame adds the time since the last frame, capped at 50 ms. No frames means no time passes.

**Decision:** keep it, on purpose. Using the real clock would make the game jump ahead when you come back. That's exactly the bug in Debris, which uses the real clock: leave for 30 seconds and you return to a free win. The catch is that `setTimeout` and `setInterval` keep running in hidden tabs (just throttled), so the main screen's satellite countdowns don't pause. That inconsistency is still open.

**Why capping the frame time matters:** without the 50 ms cap, a single long frame (from a stall or a returning tab) would teleport the simulation forward.

**Takeaway:** choose simulated time or wall-clock time deliberately, cap the frame delta, and remember that browsers throttle background tabs differently for animation frames and for timers.

---

## 6. A Missed Contact pass never ended

**Found while testing:** in fast-forwarded test runs, some passes ran forever. The satellite never "set" below the horizon.

**Root cause:** the satellite's position along the pass is computed with `atan`. On high passes where the real satellite trailed the prediction, the angle approaches the asymptote and never drops below the 10° elevation mask, so the "loss of signal" condition never fires.

**Fix:** added a hard end: the pass is over at `t >= pass.D + 4` seconds, whatever the geometry.

**Why it works:** the game no longer depends on a geometric condition that some inputs can never reach. Verified with 20 fast-forwarded passes: all ended, with no errors.

**Takeaway:** every state machine needs a guaranteed exit. Test edge cases with a fast-forwarded clock rather than real-time play.

---

## 7. The antenna crosshair lagged behind the mouse

**Found while testing:** moving the mouse quickly in Missed Contact left the crosshair trailing behind the cursor.

**Root cause:** the antenna had a realistic slew-rate limit (a maximum turning speed), so it chased the cursor instead of following it.

**Fix:** removed the slew limit, so the antenna points exactly where you drag. Bumping `?v=` was also needed before the fix showed up (see #1).

**Why it works:** direct manipulation has to feel one-to-one. Any smoothing between the hand and the pointer reads as lag.

**Takeaway:** realism loses to responsiveness when the player is directly controlling something.

---

## 8. The Hamming code puzzle could be brute-forced

**Found while testing:** flipping bits left to right without thinking eventually fixed every register.

**Root cause:** a wrong guess cost nothing, so trying every position was always a valid strategy.

**Fix:** each wrong bit position costs a time penalty (5 s), charged once per position per satellite.

**Why it works:** guessing now costs more than reading the checksum, so the intended skill wins. Charging only once per position avoids punishing someone for toggling the same bit back.

**Takeaway:** if guessing is free, the puzzle is button-mashing, so put a cost on each distinct wrong attempt.

---

## 9. Solar alignment felt unfair: instant failure, then too easy

**Found while testing:**
- The sun sometimes spawned on the far side of the satellite, so the game failed before you could read the instructions.
- The array kept charging even when it was nowhere near the sun.

**Root cause:** charging efficiency used `cos(angle)`, which stays positive out to wide angles, so the array charged far off the sun. The starting angle was unbounded, and the fail check started immediately.

**Fix:**
- Efficiency became `cos(angle)^5`, which moves the charge/drain break-even point from about 63° to about 31.5°.
- The starting sun offset is limited to 20–40°.
- Failure is only possible after a 12-second grace period.

**Why it works:** the curve matches what looks right on screen, and the player always gets time to read before anything can go wrong.

**Takeaway:** tune physics to what feels fair, and when the same complaint comes back, push the same parameter further instead of inventing a new theory.

---

## 10. Clicking an older alert didn't show the crosshair

**Found while testing:** clicking the newest SCID-UI alert highlighted its satellite, but clicking an older one did nothing.

**Root cause:** the highlight had a rule to switch itself off when its satellite was the one open in the side panel. That rule was meant for "you clicked the satellite, so hide the highlight", but it also fired when you clicked the alert for an already-open satellite, so the highlight vanished the instant it appeared.

**Fix:** the highlight now clears only on an explicit event: clicking a satellite on the rings, or the satellite being lost.

**Why it works:** the highlight's lifetime is tied to user actions, not inferred from other state.

**Takeaway:** implicit "if X then hide Y" rules collide with each other, so derive UI state from explicit events.

---

## 11. Dismissing an alert lost track of the problem

**Found while testing:** after closing an alert with ×, there were two red satellites and no way to tell what was wrong with either.

**Root cause:** dismissing the notification removed the only on-screen record of the problem.

**Fix:** problem alerts have no ×. They leave only when the satellite is fixed or lost. "Recovered" and "signal lost" alerts can still be dismissed, and fade on their own.

**Why it works:** the alert's lifetime matches the problem's lifetime.

**Takeaway:** dismissing a notification shouldn't dismiss the underlying problem.

---

## 12. The flare spectrum contradicted its own instructions

**Found while testing:** the instructions said "keep the noise under the yellow line", but the line inside your signal's strip always poked above it, even when the link was fine.

**Root cause:** the spectrum drew your own signal's peak along with the noise, so the strip always looked "over the limit". Your signal also looked identical to other operators' signals.

**Fix:** the spectrum now plots only noise. Your signal is shown as the shaded strip instead of as a peak.

**Why it works:** the chart now shows exactly the quantity being compared to the threshold.

**Takeaway:** a threshold line only makes sense if the plotted value is the thing being compared to it.

---

## 13. Git: editor boilerplate in a merge commit, and a stale local `main`

**Found while working:**
- A `git merge` opened an editor for the commit message. The session got stuck, and finishing it from another command saved git's template comment lines as the commit message.
- Later, local `main` was behind GitHub, because dev had been merged into main through a pull request on GitHub.

**Fix:**
- Use `git merge --no-edit` (or `-m "message"`) so no editor opens.
- Run `git fetch` and branch from `origin/main` rather than the local `main`.

**Why it works:** non-interactive commands can't get stuck waiting for an editor. Pull-request merges happen on the remote, so only a fetch brings them down.

**Takeaway:** script git non-interactively, and fetch before branching from a shared branch.

---

## 14. Power Bus got stuck, and CLEAR SELECTION did nothing

**Found while testing:** Load 1 was committed with 3V + 10V. The two buses left (7V and 12V) couldn't power Load 2 or Load 3 in any combination, and CLEAR SELECTION didn't undo anything.

**Root cause, two bugs:**
- The puzzle generator is supposed to make every load have exactly one valid bus combination. It retries random puzzles until one passes, but gave up after 60 tries and served the last one anyway. Simulating 4,000 games showed that happened **45% of the time**. In this puzzle, Load 1 accepted both 3V + 10V and 12V on its own, so the "wrong right answer" used up buses the other loads needed.
- CLEAR SELECTION only cleared buses picked but not yet committed. With nothing picked, it had nothing to clear.

**Fix:**
- Raised the retry limit to 2,000. The same simulation shows ambiguous puzzles effectively never get through, and generation is still instant.
- CLEAR SELECTION now also undoes committed loads, so any dead end can be reset.

**Why it works:** the uniqueness check was right all along, but the retry budget was too small for how often random puzzles fail it. Measuring the failure rate gave the number to fix.

**Takeaway:** a "retry until valid, else fall back" generator is only as good as its fallback rate. Measure how often the fallback fires, and always give the player a way out of a dead end.

---

## 15. No way back out of an event minigame

**Found while testing:** once a solar flare's minigame opened, there was no way to back out of it and return later.

**Root cause:** event windows were built as one-way trips: open the minigame, wait for its result. The event only had two states, "waiting" and "running", and nothing could move it from running back to waiting.

**Fix:** event windows got a × that **aborts** the attempt. The event goes back to waiting, its countdown resumes, the CRITICAL ticket shows the countdown again, and clicking it allows a fresh try. The terminal prints "procedure aborted", for satellite repairs too. Event minigames also now load hidden behind the emergency log, using the same load → reveal → start handshake as satellite repairs (#3), so they appear instantly.

**Why it works:** "abort" is now an explicit transition back to the earlier state, so leaving a window can't strand the event. Sharing one launcher between satellite repairs and events means both get the same loading behaviour and the same exit.

**Takeaway:** every modal needs an exit, and every exit needs a defined state to return to. Draw the state machine and check that each state has a way out.

---

## 16. A new emergency opened on the previous emergency's terminal

**Found while testing:** clicking the NORAD debris ticket showed the terminal with no scripts to click. It was still showing the log from the gamma-ray burst handled earlier.

**Root cause:** the terminal started a fresh session only when it switched from a satellite to the ops computer. Going from one emergency to another counted as "already on the ops computer", so the old session stayed, and its file list had scrolled out of view above the long log.

**Fix:** the terminal remembers which emergency its session belongs to. A different emergency gets a fresh session. The same emergency (after an abort) keeps its history but lists the scripts again, so they're always on screen.

**Why it works:** the session is tied to the thing it's for (this event), not just the kind of thing (any event).

**Takeaway:** when caching or reusing state, key it on the specific item it belongs to, not on a category it shares with other items.

---

## 17. Splitting two 1,200-line files into modules, with a build step

**The starting point:** the whole game lived in two files.
- `index.html` held about 1,200 lines: the page, all the CSS, and the main script with dozens of one-line functions and ~20 shared variables.
- `react-app.jsx` held all 13 minigames.

That worked, but every change touched a giant file. A single typo stopped everything: a misplaced `//` comment broke the main script twice in one week. On top of that, every minigame compiled itself in the browser with Babel downloaded from a CDN (#3), and cache busting meant bumping `?v=` by hand (#1).

**What was done:**
- **Vite** builds the site. Cloudflare Pages runs `npm run build` on every push and serves the `dist/` folder.
- **The minigames** became one file per game under `src/repair/`, plus shared pieces (frame, header, helpers, game catalog). A script cut the file at each top-level function and worked out each file's imports from what it actually uses.
- **The main page** became modules under `src/main/`, one per feature: constellation, side panel, terminal, minigame launcher, alerts, anomalies, and an `events/` folder.
  - Splitting it by hand risked breaking references, so a script used a real JavaScript parser (acorn) to assign each top-level statement to a module and to generate imports and exports.
  - It also reported every place one module would write another module's variable. ES module imports are read-only, so those writes have to change.
- **Shared state:**
  - The three values several modules both read and change (the open satellite and the crosshair targets) moved into one small `state.js`.
  - The relaunch button now calls each module's own reset function instead of reaching into its variables.
- **Console hooks:** module code doesn't put anything on `window`, so the console commands used for testing (`triggerFlare()`, `activeEvent`, …) are exposed deliberately, in one clearly marked block.
- **Tooling:**
  - Prettier reformatted the one-liners into readable code.
  - ESLint confirmed there were zero undefined names across all modules.
  - CI now runs the real production build, so a syntax error or a missing export fails before deploy.

**How behaviour was proven unchanged:** one regression script ran 51 checks against the old version (an untouched checkout of the previous branch) and the new build side by side. It covered repairs through the terminal, alerts and crosshairs, all three celestial events, the creature, relaunch, every minigame rendering, and a bot solving CPU Overload. Result: **51 checks, 0 differences**, and no errors in either.

**What it bought:**
- Each minigame now opens in about 0.03 s, down from 0.3–1 s, and from up to 10 s when the CDN was slow.
- About 4.3 MB of CDN downloads per minigame became one 200 KB bundle (66 KB compressed).
- There is no dependency on an outside CDN at runtime.
- Cache busting is automatic, because built files get content hashes in their names.
- `index.html` went from 1,213 lines to 64.

**Takeaway:** refactor a working prototype with tools, not by hand. A parser-driven split doesn't miss a reference. A linter proves nothing is undefined. And the same behavioural tests run against old and new builds prove nothing changed. That last part is what makes a big refactor safe to ship.

---

## 18. Making it work on phones without changing the laptop at all

**The goal:** fix the phone layout, which had alerts covering the screen, 18px tap targets and an unreadable title, with a hard rule that the laptop experience must not change by a single pixel.

**How:**
- Phone styles live in a CSS media query. Phone-specific React layout uses `matchMedia` through a small `usePhone()` hook.
- **The leak found in review:** a width-only query (`max-width: 600px`) also matches laptops whose browser window is narrowed, split-screened or zoomed in (250% zoom on a 1440px laptop leaves about 576px). Those users would have got the phone layout.
- **The fix:** `(max-width: 600px) and (pointer: coarse)`. "Coarse pointer" means a finger, so mice and trackpads never match, whatever the window size or zoom.

**How it was proven:**
- 57 laptop screenshots (4 window sizes, all 11 minigames) were taken from the old and new production builds and compared pixel by pixel. They were identical.
- The 51-check behaviour test was also run against both builds.
- To make screenshots comparable at all (see #20), randomness was seeded, the clock was paused and stepped by hand, and CSS animations were turned off.

**Takeaway:** responsive design is about capabilities, not just screen width. And "I didn't break desktop" is a claim you can prove with deterministic before/after screenshot diffs.

---

## 19. Two iPhone Safari gotchas

- **Auto-zoom on text boxes:** iOS Safari zooms the whole page when you tap an input whose font is smaller than 16px. The CPU Overload command box was 12px. **Fix:** 16px on phones only.
- **`100vh` isn't the visible height:** on iOS Safari, `vh` includes the area behind the browser toolbars, so a window sized to 97vh can sit partly under the toolbar. **Fix:** dynamic viewport units (`97dvh`), with the `vh` line kept as a fallback for older browsers. That wasn't enough: the window was still *centred* in a fixed box that included the toolbar area, so on the phone its bottom stayed out of sight. **Final fix:** on phones the minigame window is pinned to the top and fills exactly the visible screen.

**Takeaway:** mobile Safari has its own rules. Testing in a desktop browser's phone emulator won't show either problem, so check on a real device.

---

## 20. Making automated tests trustworthy (flaky tests)

**Found while testing:** comparisons between two builds kept showing "differences" that weren't real.

**Causes, all in the tests rather than the game:**
- The dev server reloaded the page mid-test because a file had just been saved.
- CSS animations and the canvas run on real time even under a fake test clock.
- A check read "the top alert" while random everyday alerts kept arriving.
- A countdown read "1:00" or "0:59" depending on when its once-a-second tick landed.

**Fixes:**
- Test against production builds, not the dev server.
- Seed the random number generator, and pause the clock so it only moves when the test says so.
- Turn animations off for screenshots.
- Look for the expected alert rather than assuming its position.
- Normalise values that depend on timing.
- Run the *baseline* twice: if the same build differs from itself, the test is flaky, not the change.

**Takeaway:** a test that sometimes fails on unchanged code is worse than no test. Control the sources of nondeterminism (time, randomness, animation, ordering) before trusting a diff.

---

## 21. Security check: secrets, cost exposure, and what was public

**The check:**
- Scanned every file **and the full git history** for API keys, tokens, passwords and private keys. Found none.
- The game makes no network calls.
- The site is purely static on Cloudflare Pages: no server functions, and free unlimited static bandwidth. A traffic spike can't cost money.
- CI has a $0 spending limit by default.
- `npm audit` on shipped dependencies: 0 vulnerabilities.

**What was actually exposed:** before the Vite build (#17), Cloudflare published the **whole repository folder**, so the README, this file, `scripts/` and the CI config were all publicly downloadable from the site. Nothing secret, but more than intended. With a build step, only the built `dist/` folder is deployed.

**Minor, not fixed:** the game accepts `postMessage` results from any window. Someone embedding the site could fake a win, but only in their own browser, since there's no server or shared state.

**Takeaway:** check git history, not just current files, for secrets. Know exactly what your deploy publishes. A build output folder is a security boundary as well as a performance one.

---

## 22. A bug I couldn't reproduce: the side panel wouldn't scroll on an iPhone

**Found while testing:** on a real iPhone (Safari), the satellite side panel wouldn't scroll, so the terminal at its bottom was unreachable. Every test on the Mac passed, including Chrome's phone emulation and WebKit (Safari's engine) run headless.

**What didn't work, three educated guesses, each deployed and tested on the phone:**
- Removing the scroll box nested inside the panel.
- Sizing the panel with the visible-height unit (`dvh`).
- Removing the slide-in `transform` (a known WebKit quirk).

None of them fixed it.

**What did work: getting data from the real device.** Safari Web Inspector, connected to the iPhone by cable, ran small diagnostics live on the phone:
- **The setup was fine:** the panel was open, on top, set to scroll, and its content was 456px taller than the screen.
- **The touch was fine:** every touch landed inside the panel, and nothing on the page cancelled it.
- **Code could scroll it:** setting `panel.scrollTop = 200` from code moved it instantly.
- **Each remaining suspect was ruled out with a one-line live test:** the page-level `overflow: hidden`, the animated canvas behind the panel, and scroll containment.

So the browser received the swipe, nothing blocked it, the panel could scroll, and iOS still didn't turn the swipe into scrolling. That's a WebKit quirk outside the page's control.

**Fix:** on phones only (narrow + touch screen), the panel scrolls itself, using the one thing proven to work on the device.
- Touch handlers set `scrollTop` as the finger drags.
- A flick keeps gliding, with friction.
- A touch that moves less than 6px still counts as a tap, so buttons and terminal files keep working.

Laptops never run this code, and the pixel audit (#18) confirmed they're unchanged. The same scroller (now in `src/shared/`) also scrolls the minigame windows on phones. It leaves alone any drag that starts on a game board, so dragging the antenna or the solar array still plays the game.

**Takeaway:** when a bug only appears on one device, stop guessing after the first miss and **instrument the real device**. Then reduce it by elimination: what works, what doesn't, one variable at a time. If the root cause is in the platform, build a narrow, well-scoped workaround around what you've *proven* works.

---

## 23. Practice: how every change is tested (regression suite, pixel audit, feature checks)

The game has no unit tests. It's a canvas, iframes and timers, and most bugs live in how those interact. So changes are tested from the outside, the way a player uses the game, using three Playwright scripts that drive a real headless browser. They're run locally for now, not yet in the repo or CI.

**1. Behaviour regression (`regress.py`, 51 checks).**
- The script plays the game like a player:
  - boot, and the console test hooks;
  - click a satellite and run the procedure in the terminal; the minigame opens and the fix is reported;
  - every celestial event: right ticket, crosshairs on the right satellites, wrong script rejected, right script accepted, abort and reopen, result and satellite count;
  - the creature: tentacles out, zap, grab, take, retreat;
  - relaunch resets everything;
  - all 11 minigames render, and a bot solves CPU Overload;
  - no JavaScript errors anywhere.
- **The trick is that it runs twice,** against a build of the last commit and against the new build, and compares the two records line by line. Nothing needs hand-written expected values: the old version *is* the expected value. Any line that differs is either an intended change or a regression.
- Values that are random by design (which satellite, exact timings) are reduced to what matters, e.g. "7 satellites pulsed" rather than which 7.

**2. Pixel audit (`pixel_audit.py`, 57 screenshots).** The main screen at 4 window sizes and every minigame at 3, from old and new builds, compared pixel by pixel. It made "the laptop didn't change at all" (#18) provable instead of a feeling. To be repeatable it seeds randomness, pauses the clock, and turns off animations (#20).

**3. Feature checks, when old vs new is *supposed* to differ.** Comparing against the old build can't test something new, like the pixel-art sun. So a new feature gets its own checks of the behaviour that matters: the sun is absent before a flare, *creeps* in (its edge measured moving 20 → 60 → 84 → 100 px, never jumping), erupts toward the Earth, survives an abort, creeps out after a win or a loss, and never appears for other events.

**Triaging a failure, two real examples:**
- **The test was wrong, not the game.** Two sun checks failed because they measured a 12px strip at the screen edge, which the sun crosses in one frame, so a smooth creep looked like a jump. The check was rewritten to measure where the sun's edge is. The code was never changed to satisfy the test.
- **The difference was noise.** One regression line differed (alerts on screen just after relaunch), and it was the *old* build that had the extra alert. Re-running only that step 8 times on each build gave identical results: a random everyday alert had landed in the window. Classified as noise, not a regression.

**Takeaway:** test the product the way it's used, compare against the last known-good version so the old build is the expected result, and when a check fails, first ask whether it measured the right thing, then whether the difference is real.

---

## 24. Practice: procedurally generated scenes (seeded noise, dithering, spaced placement)

Every science request draws a fresh scene: penguin colonies on sea ice, whales, wildfires, flamingo lakes, airbases, oil spills, dark fishing fleets, a supernova field, an exoplanet's light curve. The pixel-art sun during a solar flare uses the same techniques. None of it uses a library. It's about 20 lines of maths, hand-written, plus a renderer per scene.

**The short answer, if asked "how did you generate it?":**
> Seeded value noise summed over several octaves (fractal Brownian motion) for the terrain, quantised into a small fixed palette with ordered (Bayer) dithering for the pixel-art look, and rejection sampling with a minimum distance (a cheap version of Poisson-disc sampling) to place things. I chose those because they're deterministic (the same seed gives the same scene, so tests reproduce), dependency-free, fast enough at low resolution to run every frame, and the spacing guarantees a fair puzzle: targets never overlap decoys.

**The pieces, and why each one:**
- **A seeded random number generator (mulberry32).** A 32-bit generator in a few lines: each call scrambles a counter with multiplies and shifts. `Math.random()` can't be seeded, and a seed means a scene can be regenerated exactly. That made the screenshot and test runs repeatable (#20).
- **Value noise.** A hash gives a pseudo-random value at every integer grid point. The classic shader hash, `fract(sin(x·127.1 + y·311.7) · 43758.5453)`, is used here. Between grid points the value is blended with a smoothstep curve, 3t² − 2t³, so there are no visible creases.
  - **Why value noise rather than Perlin or simplex:** Perlin (gradient) noise is smoother and has fewer grid artefacts, and simplex scales better to 3D and beyond. At 240×150 pixel art the difference is invisible, and value noise is about 15 lines.
- **Fractal Brownian motion (fBm).** Several layers ("octaves") of noise are summed, each at double the frequency and half the amplitude. Large shapes get small detail on top, the way coastlines, clouds and terrain look in nature.
  - The ice-shelf edge, sea-ice texture, forest canopy, cloud decks and the sun's granulation are all fBm.
  - Wrapping the grid coordinates (a period) makes it tile, which lets the ocean's swell animate seamlessly.
- **Stretched and rotated coordinates.** Sampling noise as (x/9, y/1.4) stretches it into wind-blown ripples on the ice. Rotating coordinates into the wind's frame gives the radar view its wind streaks.
- **Ordered (Bayer) dithering.** Each pixel's continuous value (brightness, depth, heat) is snapped to one of a few palette colours. A 4×4 threshold matrix nudges the rounding pixel by pixel, so gradients become patterned rather than banded. It's the classic retro look, and it keeps every scene in a deliberate palette.
- **Placement by rejection sampling with a minimum distance.** Throw a random point; reject it if it's within *d* of anything already placed; repeat, with a cap on tries.
  - It's a simple stand-in for Poisson-disc sampling. Bridson's algorithm would be more even and faster at scale, but for fewer than 30 objects the simple version is plenty.
  - It guarantees colonies don't touch rocks, aircraft don't overlap, and every target can be marked.
  - The aircraft scene places its targets first, so they always get room (a bug found by generating a dozen bases: one had only 2 targets).
- **Implicit shapes with noisy edges.** A blob is "distance from centre ÷ radius < 1 + noise", which gives ragged colonies, rocks and oil slicks. An oil slick is an ellipse stretched along the wind and tapered downwind. Aircraft are point lists in their own frame, rotated into place, with a shadow offset.
- **Real physics where it matters (the astronomy scenes):**
  - *Exoplanet:*
    - transit depth = (R_planet / R_star)²;
    - orbit size from Kepler's third law, a³ = M·P² (AU, solar masses, years);
    - transit duration ≈ (P/π)·asin(R_star / a);
    - a limb-darkened dip floor;
    - photometric noise approximated as Gaussian by summing four uniforms (Irwin–Hall);
    - slow starspot modulation, and flares that decay exponentially;
    - the result works the period out from the player's own taps (least squares), and the equilibrium temperature from T_star·√(R_star / 2a)·(1 − albedo)^¼.
  - *Supernova:*
    - every star is drawn through the same Gaussian blur (the telescope's point-spread function), while cosmic-ray hits are single sharp pixels; that difference is the clue the player learns;
    - galaxies are a steep bulge (a Sérsic-style profile) plus an exponential disc;
    - brightness is tone-mapped with 1 − e^(−kI);
    - the distance shown uses Hubble's law, d = cz/H₀.
  - *The sun:* limb darkening (brightness ∝ μ^0.4, where μ = √(1 − r²)), corona streamers from noise around the limb (computed once per frame into a table rather than per pixel), and particles for the eruption.

**Takeaway:** procedural generation is a few small, well-understood building blocks (a seeded RNG, layered noise, quantisation, spaced sampling) chosen for the constraints at hand. Determinism is the one that pays off most, because it's what makes generated content testable.

---

## 25. Practice: bots that prove every minigame can be finished

A minigame that looks right but can't be completed is the worst kind of bug. Players just think they're bad at it. So new games were checked by **bots that play them through the screen, like a person**: they read pixels and move the mouse, with no access to the game's internals.

- **Exoplanet:** the bot reads the light-curve chart's pixels, finds columns sitting well below the median brightness (a dip), and taps there. It finished on both runs, and the derived numbers checked out against Kepler's law (e.g. a 2.01-day period and 0.029 AU orbit imply a 0.8 solar-mass star, the K-type host it had picked).
- **Interstellar:** the bot finds the object by its colour, moves the mouse onto it each frame, and waits for the data bar to reach 100%.
- **Surveys:** a bot marks, downlinks and reads the result line. Play-testing on a 13" laptop showed the survey window cut off at the bottom; measuring the layout at four window sizes confirmed it: the DOWNLINK button sat below the bottom of the window. The view now sizes itself to the window's height, and the same measurement confirmed the fix at every size.
- **SUDO's walkthrough:** a bot plays the whole tutorial as a newcomer (#26) and found two real bugs: a crash before the first line appeared, and a way for the walkthrough to hang.

**When a bot failed, the bot was usually wrong first:**
- the interstellar bot chased the red reticle and the yellow light curve, because they matched its colour test;
- it also clicked in the wrong place, because Playwright reports positions inside an iframe in page coordinates and the window offset was added twice.

Each was fixed in the bot, never in the game, and confirmed by running the game itself.

**Takeaway:** "it renders" isn't "it works". A black-box bot that plays through the real UI proves a game can be finished, and when a bot disagrees with the game, debug the bot before the game.

---

## 26. Practice: SUDO's walkthrough as a step machine that watches the game

SUDO, the sarcastic onboard computer, walks a first-time player through their first fault, their first science request and a goodbye. It's built as a small state machine.

- **Steps as data.** Each step has its line, an optional nudge (shown after 10 s of waiting), and either a NEXT target (for lines you read) or a condition (for things you do). Adding or reordering steps is editing a table, not rewriting logic.
- **It watches; it doesn't wire in.** Rather than adding callbacks to the alerts, panel, terminal and launcher, the walkthrough checks the game's visible state four times a second: is this satellite highlighted? Is its panel open? Is the repair window showing? Is the fault cleared? The rest of the game knows almost nothing about it.
- **One flag pauses the rest of the game.** A single `state.intro` flag is checked by the existing gates (random faults, science requests, celestial events), so nothing new appears mid-tutorial. The tutorial fault's countdown is frozen until its repair opens, so a slow reader can't lose it.
- **The bug the bot found:** the walkthrough moved on when it *saw the repair window open*. A window that opened and closed between two checks (a quarter-second apart) was never seen, and the walkthrough hung on that step forever.
  - **The fix:** move on from durable outcomes (the fault is cleared, or the satellite is lost), not just momentary ones (a window is showing).
  - This is the polling version of the difference between level-triggered and edge-triggered events: when you sample state, trust conditions that persist, not transitions you might miss.
- **Feedback changed the design.** The first version moved on by itself after a few seconds. Play-testing showed new players need time to read, so the lines you read now wait for NEXT, and only the "do this" steps move on by themselves.
- **Shown once,** remembered in the browser's storage. Storage can be blocked (private browsing), so every read and write is wrapped and fails safely: the walkthrough just shows again.

**Takeaway:** for a tutorial over an existing app, observe state rather than threading hooks through every module, and when you observe by sampling, make transitions depend on states that persist, not on moments you might sample past.

---

## Checked and fine

- **Events can no longer freeze the game:** this used to be a known issue (an event window that failed to load had no way out). Every event window now has a × that aborts back to the ticket (#15), and a ticket that runs out resolves the event, so an event always ends.
- **Case-sensitive asset paths:** macOS ignores upper/lower case in file names, but Cloudflare's Linux servers don't. Every asset reference was checked against the exact file name on disk, and all of them are committed to git.
- **Babel 8:** before the build step, `react.html` loaded an unpinned Babel from a CDN, so a future major release would have loaded automatically. Babel 8 was tested against all the minigames and they compiled fine. Since #17 there is no Babel or CDN at runtime, and React's version is pinned in `package.json`.

## Known issues, not fixed yet

- **Debris can be won by switching tabs,** because it uses wall-clock time (see #5).
- **Thermal and Power don't fit the repair window on small laptop screens,** so EXECUTE can be out of reach.
