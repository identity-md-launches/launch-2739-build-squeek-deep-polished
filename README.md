# Squeek Deep

A complete single-player pixel-art mining roguelite built with Vite, React, TypeScript, and the original asset pack. Play Pip, fill your cheeks, survive the deep, and return your treasure to the surface. The real Squeekchain wheel powers the basket; Practice uses an offline simulation.

**The ready-to-serve export is `dist/index.html`.** Source, the supplied package manifest/lockfile, original runtime assets, and the export are included. There is no backend, account service, relay, or private configuration.

## Install and develop

Use Node 20 or newer and npm. The supplied dependency versions and build configuration are unchanged.

```sh
npm ci
npm run dev
```

Open Vite's printed local URL. The game loads original art from `public/assets`. Use the arrow keys or A/S/D to move and dig, Space/W/Up to jump, Q for the basket, E to spit, and P/Escape to pause. At the surface, walk to the chest or press F to deposit. Touch controls appear on narrow screens or with a coarse pointer: hold the pad to move/dig, tap Jump or Spit, and use Call basket below the full-width canvas. Pause opens settings, including Off/Low/Normal screen shake and the first-dig hint.

The hint sits above the health and hoard HUD, including when shown again in Settings. Focused pad, Jump, and Spit buttons also accept Enter/Space holds. Click-only activation gives a brief 0.6s pulse measured in game time, and focus loss or pause releases it.

## Rebuild the production export

```sh
node scripts/build.mjs
```

The release helper installs the existing lockfile in a temporary directory, runs the existing `npm run build` (`tsc --noEmit` followed by `vite build`), writes `dist/`, and generates an offline service worker that caches the complete runtime export. Dependencies and caches never enter the submission tree.

If dependencies are already installed, reuse them:

```sh
SQUEEK_BUILD_DEPS="$PWD/node_modules" node scripts/build.mjs
```

The helper preserves the supplied `package.json`, `package-lock.json`, `vite.config.ts`, and `tsconfig.json`. It omits only the duplicate PNG title and the two reference-only mock/example screenshots from the production export. Their original source files remain in `public/assets`. All gameplay sprites, audio, font, share background, and UI art remain complete.

For an independent typecheck after installing:

```sh
npx tsc --noEmit
```

## Preview and static hosting

```sh
npm run preview -- --host 127.0.0.1
```

Serve the contents of `dist/` over HTTP or HTTPS. Vite's base is `./`, all runtime paths work below a hosting subpath, and the service worker scopes itself to that path. There are no history routes or server rewrites. An ordinary static server also works; opening an HTML file directly does not provide a service-worker origin.

Practice needs no wheel API and is labelled unranked. After an online visit finishes caching, the service worker supports an offline reload. Serving the local export also lets you launch Practice without an internet connection. Real-wheel failures show a resting winch and signal-loss text and never block mining. Even with an IDLE wheel and zero battery, the safety basket returns at 40px/s. Wheel power or a battery makes the ride faster.

## Modes, saves, and wallet

- Adventure uses persistent upgrades and hoard currency.
- Daily uses the UTC-date map seed and base stats. Its scores are separate.
- Practice uses a simulated 300rpm wheel, a quake every 90 seconds, and separate currency/upgrades.
- Adventure/Daily quake only when the settled-round anchor increases. A 2-second rumble warns first; paused settlements coalesce to one. Errors and reconnection establish a silent baseline.
- The round countdown follows genesis/600-second clock math; supply is formatted as compact 18-decimal SQK.
- Shake defaults to Low. Reduced motion in settings or the operating system forces it off; these settings and the first-dig hint are saved.
- The leaderboard is local to this browser, top 20 per mode. Storage keys are `squeekdeep.v1.save` and `squeekdeep.v1.lb`.
- Wallet connection is optional. Named browser wallets use EIP-6963, with a `window.ethereum` fallback and phone wallet-browser links. Sign-in verifies the requested `personal_sign` message locally.
- A result can optionally be recorded on Sepolia. The game checks chain `0xaa36a7`, sends 0 ETH to the connected account itself, includes the specified run payload, and saves the submitted hash with an explorer link. The earlier release checked this flow with a mock provider; no real transaction was sent.

## Validation performed

The review follow-up reproduced and fixed both the HUD-obscuring hint and pointer-only touch controls. Its production build/typecheck and all **14** existing regression groups passed. Chromium and WebKit each passed **62** focused interaction/layout checks across 390×844, 320×568, and 1440×900 with no page/console errors or missing local assets. The pinned design probe passed **16/16**. WebKit's canceled music-stream requests are recorded separately; physical audio playback was not verified. Reproduction measurements, final evidence, six-domain coverage, and limitations are in [`artifacts/control-review.md`](artifacts/control-review.md); reviewer responses are in [`.imd-responses.json`](.imd-responses.json).

The earlier A–G revision's 25-minute live observations and broader wallet/share checks remain historical evidence in [`artifacts/validation.md`](artifacts/validation.md). This focused follow-up does not claim to have repeated those observations or sent any transaction.

Run the delivered deterministic regression suite after installing the unchanged dependencies:

```sh
node scripts/check-revision.mjs
```

It imports the real TypeScript source in a temporary directory and checks settlement baselines/errors/batches, Practice reset/timing, clock math, mint formatting, saved settings, the enemy cap, warning/pause behavior, the 30m safety basket, deposit/retirement, jumping, bounded shake, and identical Daily worlds with shake Off versus Normal. It uses a stub canvas for simulation/render-call checks; browser screenshots are separate evidence.

Run the focused production-browser regression with Playwright installed outside the repository (no project dependency changes):

```sh
npm install --prefix /tmp/squeek-controls-tools playwright@1
PLAYWRIGHT_BROWSERS_PATH=/tmp/squeek-controls-browsers /tmp/squeek-controls-tools/node_modules/.bin/playwright install chromium
SQUEEK_PLAYWRIGHT=/tmp/squeek-controls-tools/node_modules/playwright/index.mjs PLAYWRIGHT_BROWSERS_PATH=/tmp/squeek-controls-browsers node scripts/check-controls.mjs
```

The runner serves `dist/` at a subpath and closes its server/browser when done. It checks fresh/restored hint geometry, first-dig persistence, all six controls through four activation methods, release/blur/pause, duplicate suppression, touchscreen Spit, and retirement/restart scroll. It uses stable wheel fixtures and test-only access to the existing Game ref; no production debug hook or wallet call is added. Results/screenshots go to `test/scratch/control-review/`. Set `SQUEEK_REVIEW_BROWSER=webkit` to repeat with WebKit when its browser and platform libraries are installed.

The earlier release's browser checks covered all six upgrades, IME-style input, Game Over, PNG sharing, offline reload, and mocked wallet sign-in/Sepolia records. Those flows and their source remain unchanged in this follow-up.

Physical devices, native screen readers, native 200% zoom, and physical audio listening remain unperformed. Do not interpret the automated checks as certification of those cases.

## Project map

- `src/engine.ts`: simulation, input, physics, enemies, lighting, sprite rendering.
- `src/model.ts`: seeded world, items, layers, upgrades, persistence.
- `src/wheel.ts`: live polling, timeouts, round detection, Practice simulation.
- `src/wallet.ts`: discovery, message verification, optional Sepolia transaction.
- `src/share.ts`: original-art 1200×630 PNG card, clipboard, download, X intent.
- `src/main.tsx`, `src/style.css`: screens, accessible menus, touch controls, design tokens.
- `DESIGN.md`: final implemented design system and responsive behavior.
- `docs/GAMEPLAY.md`: original gameplay/asset specification.

Art & audio: original for Squeek Deep. Font: Pixelify Sans (SIL OFL 1.1); see `public/FONT-LICENSE.txt`. Design-guide attribution and licenses are retained in `docs/DESIGN-GUIDANCE-*`.
