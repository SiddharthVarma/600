# Lessons learnt

Problems found while play-testing Six Hundred, what caused them, how they were fixed, and why the fix works.
Each entry ends with a one-line takeaway for explaining it in an interview.

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

**Next step:** compile the JSX once at deploy time with esbuild and use React's production build. Babel's 3.1 MB download goes away entirely.

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

## Checked and fine

- **Case-sensitive asset paths:** macOS ignores upper/lower case in file names, but Cloudflare's Linux servers don't. Every asset reference was checked against the exact file name on disk, and all of them are committed to git.
- **Babel 8:** `react.html` doesn't pin Babel's version, so a future major release would load automatically. Babel 8 was tested against all the minigames, and they compile and run fine. Pinning versions is still on the to-do list.

## Known issues, not fixed yet

- **An event can freeze the game.** If an event's minigame fails to load or crashes, the event never ends: there's no close button, and clicks stay blocked. Proposed fix: a backup timer that ends the event after its length plus about 20 seconds.
- **Debris can be won by switching tabs,** because it uses wall-clock time (see #5).
- **Thermal and Power don't fit the repair window on small laptop screens,** so EXECUTE can be out of reach.
