# Squeek Deep

A complete single-player pixel-art mining roguelite built with Vite, React, TypeScript, and the original asset pack. Play Pip, fill your cheeks, survive the deep, and return your treasure to the surface. The real Squeekchain wheel powers the basket; Practice uses an offline simulation.

**The ready-to-serve export is `dist/index.html`.** Source, the supplied package manifest/lockfile, original runtime assets, and the export are included. There is no backend, account service, relay, or private configuration.

## Install and develop

Use Node 20 or newer and npm. The supplied dependency versions and build configuration are unchanged.

```sh
npm ci
npm run dev
```

Open Vite's printed local URL. The game loads original art from `public/assets`. Use the arrow keys or A/S/D to move and dig, Space/W/Up to jump, Q for the basket, E to spit, and P/Escape to pause. At the surface, walk to the chest or press F to deposit. Touch controls appear for a coarse pointer: the pad moves/digs, A jumps, B spits, and the top basket control calls your ride home.

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

Practice needs no wheel API and is labelled unranked. After an online visit finishes caching, the service worker supports an offline reload. Serving the local export also lets you launch Practice without an internet connection. Real-wheel failures show a resting winch and signal-loss text and never block mining. A battery in the entrance provides an initial return trip when the real wheel is resting.

## Modes, saves, and wallet

- Adventure uses persistent upgrades and hoard currency.
- Daily uses the UTC-date map seed and base stats. Its scores are separate.
- Practice uses a simulated 300rpm wheel, a quake every 90 seconds, and separate currency/upgrades.
- The leaderboard is local to this browser, top 20 per mode. Storage keys are `squeekdeep.v1.save` and `squeekdeep.v1.lb`.
- Wallet connection is optional. Named browser wallets use EIP-6963, with a `window.ethereum` fallback and phone wallet-browser links. Sign-in verifies the requested `personal_sign` message locally.
- A result can optionally be recorded on Sepolia. The game checks chain `0xaa36a7`, sends 0 ETH to the connected account itself, includes the specified run payload, and saves the submitted hash with an explorer link. No real transaction was sent during validation; the browser flow was checked with a mock provider.

## Validation performed

Production build and strict TypeScript checking passed. The pinned taste@1 probe passed **16/16** checks at 320, 390, and 1440px after corrections. The 390px first screen visibly contains Pip, the product identity, and Play.

Local validation exercised deterministic world generation, all six layers to 300m, cheek stages/capacity, digging, jumps, combat/spills/death, boulders, baskets, deposits, prices/upgrades, wheel parsing/failure/mode switching, quakes without a real-time wait, local ranking, and wallet cryptography/transaction guards. Chromium interaction checks covered a mine-and-return loop, retirement, persisted results/settings, dialogs/tabs, downloads, sharing, offline reload, touch controls, and mocked wallet rejection and Sepolia record flows.

The commands, observed results, six-domain Better Interface review, fixed findings, screenshots, and exact remaining limitations are in [`artifacts/validation.md`](artifacts/validation.md). WebKit could not launch on this machine: its MiniBrowser reported missing `liblcms2.so.2`. Physical iPhone/Android, native screen-reader, and physical-phone 60fps checks are not claimed.

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
