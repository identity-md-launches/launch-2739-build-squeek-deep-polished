# Reviewer follow-up: hint placement and control activation

Both reported findings reproduced in the supplied production export and were fixed in the existing implementation. This is a focused follow-up to the earlier A–G revision, not a rewrite. These are worker observations, not independent certification.

## Findings and corrections

| Finding | Reproduction before editing | Correction and recheck |
| --- | --- | --- |
| High: `44b4f7c31e586d3d3bbc40368839d9f178fad62898389a3859abc33999948a48` — first-dig hint hides health/hoard | Fresh Adventure at 390×844: hint bottom **215.375px**, HUD top **193.375px**. At 320×568: **176px** versus **158.667px**. At 1440×900: **716.094px** versus **662.094px**. After holding Down for 1.8s and choosing Pause → Show digging hint again, the overlap returned at 2m while unpaused. Screenshots confirmed the obstruction. | `src/style.css:1439` reserves 32/270 of the frame height plus 4px, using `inset-block-end: calc(11.852% + 4px)`. Removed the shared 10px offset and the phone 4px override (`src/style.css:1632`). Fresh and restored hints now clear both top and bottom HUD areas at all three sizes. Dismissal on first dig and its saved state remain intact. |
| Medium advisory: `f667c9bfdb14161bee5cfcf98b26313c32bae425d46d7117217f410d5c8946d7` — pointer-only touch controls | At 390px, real entrance digging collected load 1; Enter, Space and `element.click()` on Spit each left load 1 and boost 0. Pointer activation emptied the load and gave approximately 2s boost. At 320px the same sequence preserved load 2 until the pointer tap. | `src/main.tsx:573` retains pointer holds and adds Enter/Space press/release, blur release and a click-only 0.6s simulation-time pulse. The pulse lets movement/digging advance between simulation updates. Pointer-generated clicks and key repeats do not retrigger actions. `src/main.tsx:335` clears tracked inputs/timers on screen, modal or control-layout changes. Tests exercise actual movement, digging, jumping and spitting for all six buttons, including release, pulse-to-hold handoff, focus loss, pause and touchscreen taps. |

Reviewer responses are in the required root `.imd-responses.json`. No changes were made to the simulation, settlement service, wallet, Sepolia flow, save model, share implementation, asset pack or build/dependency configuration.

## Measurements on the rebuilt export

| Chromium viewport | Canvas bounds | Fresh/restored hint bottom | Bottom HUD starts | Clear gap |
| --- | --- | --- | --- | --- |
| 390×844 | x=0, y=0, 390×219.375 | 189.375px | 193.375px | 4.000px |
| 320×568 | x=0, y=0, 320×180 | 154.672px | 158.667px | 3.995px |
| 1440×900 | Full 960×540 canvas within viewport | 658.094px | 662.094px | 4.000px |

The 320px gap reflects browser subpixel rounding of the requested percentage. The full health/hoard panel is visible in both fresh and restored states. Phone targets for Pause, Call basket, the pad, Spit, Jump and camp actions are at least 48×48px and fit without scrolling. No horizontal document overflow was measured. Retire → Dig again returns the phone canvas to the top. The product and Play are visible on the first 390px title screen.

WebKit passed the same measurements at all three viewports. Its 320px fresh hint gap was 3.985px and its restored gap was 3.995px; other gaps were 4px. The final 320px WebKit screenshot was inspected and also shows all three hearts and the hoard below the hint.

## Checks actually run

| Check | Command/method | Result |
| --- | --- | --- |
| Production build and typecheck | `SQUEEK_BUILD_DEPS=/tmp/squeek-review-deps/node_modules node scripts/build.mjs` | Passed. The existing `npm run build` ran `tsc --noEmit && vite build`; the helper exported 72 files, including the offline worker. |
| Existing mechanics regressions | `SQUEEK_CHECK_DEPS=/tmp/squeek-review-deps/node_modules node scripts/check-revision.mjs` | **14/14 groups passed**, including settlement/error baselines, Practice reset, countdown, enemies, saved settings, shake/Daily determinism and safety basket/deposit/retirement. The prepared 30m IDLE/zero-battery case returned in **24.0167 simulated seconds**. |
| Chromium production interactions | `SQUEEK_PLAYWRIGHT=/tmp/squeek-review-browser/node_modules/playwright/index.mjs PLAYWRIGHT_BROWSERS_PATH=/tmp/squeek-review-browsers node scripts/check-controls.mjs` | **62 focused checks passed**: 30 at each phone size and 2 at desktop. Zero page/console errors or failed local resources. |
| WebKit production interactions | Same runner with `SQUEEK_REVIEW_BROWSER=webkit`, temporary browser/audio libraries and software graphics | **62 focused checks passed** at the same sizes. Zero page/console errors or missing assets. One canceled music-stream request per viewport is recorded separately below. |
| Pinned design probe | `IMD_PLAYWRIGHT=/tmp/squeek-review-browser/node_modules/playwright/index.mjs PLAYWRIGHT_BROWSERS_PATH=/tmp/squeek-review-browsers node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste` | **16/16 passed**, at 320/390/1440 plus reduced motion. The probe inspects the title screen; gameplay is checked separately by the control runner. |
| Export integrity | Checked every `dist/index.html` link and service-worker cache entry; compared every exported asset's SHA-256 against its `public/assets` source | Passed: relative index links, all 72 runtime files present, all art/audio/font hashes match their original sources. Export size **2,312,345 bytes**. |
| Source integrity | `git diff --check` and changed-path audit | Passed; protected configuration, dependencies, asset sources and directories remain unchanged. |

The browser runner manages its own bounded local server under `/preview/`, uses stable wheel API fixtures, and closes browser/server on completion. Fresh/returned hint checks use real Play, digging and Settings interactions. Isolated action checks reset the existing Game instance and seed a one-item inventory for Spit through test-only React-ref access; no production debug interface is shipped. Held-input checks allow the game simulation to advance before asserting effects; this matters on the software-rendered browser. Pointer taps and click-only activation remain real DOM events.

The WebKit runner initially lacked graphics/audio libraries; installing them in temporary storage allowed the final tests above to run. Its network instrumentation reported `Load request cancelled` for `music_loop.ogg` once per viewport. These media cancellations are retained in `cancelledRequests`, separately from page/console errors and missing-resource failures. The export includes the original audio file and its hash was checked; physical audio output was not verified. No application audio code was changed to accommodate the test environment.

## Better Interface coverage

The pinned workflow, core principles of all six domains, focus/keyboard guidance, design-probe definitions, and documentation method were read and applied to the changed surfaces. Existing pixel art, six-size typography and color tokens were retained. `DESIGN.md` now records the actual HUD inset and activation behavior.

| Domain | Coverage and findings | Limits |
| --- | --- | --- |
| Accessibility — Checked | Native named controls, Enter/Space holds, click-only activation, focus/blur/release, repeated-key suppression, pause/resume, touchscreen Spit and 48px targets. The cyan focus indicator on Dig down was viewed in the production screenshot. Fixed the shared pointer-only handler. | Click-only events model assistive activation; no native screen-reader or switch-device session was performed. The action canvas is not a text-only game. |
| Layout — Checked | Fresh and restored hint/HUD bounds at 390×844, 320×568 and 1440×900; complete canvas, visible controls, no horizontal overflow, restart at top. Fixed the shared hint offset; viewed title, both phone hints, underground hint and desktop hint. | No native 200% zoom, physical safe-area/landscape device, translated locale or exhaustive intermediate widths. |
| Writing — Checked | Existing keyboard/touch directions and action labels still match the actions. Hint remains dismissible through the first dig and can be shown again in Settings. | English only; no copy redesign or unrelated flow changes. |
| Typography — Checked | Existing Pixelify Sans and six size tokens retained. Hint text wraps within its frame at both phone widths, without clipping or HUD overlap. Probe reports one family and weights 400/600. | Canvas text remains small at fractional phone scale; no cross-platform rasterizer certification. |
| Colors — Checked within scope | Existing surface/text/focus colors retained. Probe passes all solid text/background pairs it can resolve; gameplay screenshot shows visible focus and health/hoard. | The probe explicitly leaves 10 title text boxes over images/canvas/gradients unmeasured. No new contrast ratio or exhaustive sprite/image-edge measurement is claimed. |
| UI — Checked | Existing wood-panel art, Pip hint sprite, target sizes and button focus retained. Held, released, repeated, cancelled-by-focus/pause and click-only states checked. No animation, external asset or new visual system added. | No physical audio listening, native mobile hardware or slowed animation-inspector session. |

## Evidence and limits

`control-review.json` records before/after measurements and browser results; `control-taste.json` records the current probe checks. Screenshots prefixed `control-` belong to this follow-up. The other screenshots, live-service/Adventure logs, wallet/share walkthrough and broad visual measurements in `validation.md` are historical evidence from the earlier A–G revision.

Useful screenshots: `screenshots/control-before-hint-390.png` (reproduced obstruction), `control-hint-390.png`, `control-hint-320.png`, `control-hint-1440.png`, `control-restored-390.png`, `control-focus-390.png`, `control-title-390.png`, and `control-webkit-hint-320.png` (all under `screenshots/`).

The 25-minute live-wheel observations were not repeated for these two findings. No real wallet signature, transaction or approval, external message or publication was performed. Mainnet and Sepolia transaction code remain byte-for-byte unchanged. Dependencies, Playwright, browser libraries and caches used for verification stayed in temporary storage outside the submission. This scoped review does not certify physical devices, native Chinese IME, assistive technology or every canvas pixel.

**Complete for the stated follow-up scope.** Both findings are answered, the final source/export passed the checks above, and the requested documentation and static export are present. Submission bytes and the final path audit are recorded in `control-budget.json`; no ignore file was changed.
