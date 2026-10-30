# Squeek Deep: implemented design

## Overview

Squeek Deep is a single-player hamster mining roguelite. The title screen pairs the original illustrated mine with a compact play menu; the game uses one 480×270 canvas, original sprite strips, warm wood controls, and a dark underground palette. Pip, the orange and cream hamster with a yellow helmet, is the visual focus. The supplied gameplay specification is preserved in `docs/GAMEPLAY.md`; the implementation lives in `src/`.

The main action is visible at 390px. Adventure, Daily, and Practice are distinct choices. Practice is explicitly simulated and unranked. The leaderboard clearly says its records belong to this browser.

## Colors

Canonical interface tokens are in `src/style.css`, using the asset palette's hex notation.

| Token | Value | Role |
| --- | --- | --- |
| `--bg` | `#110d15` | Page and outer mine background |
| `--surface` | `#1b1420` | Mobile title menu and dialogs |
| `--surface-raised` | `#271c27` | Inputs and inline explanations |
| `--text` | `#fff5e1` | Main text |
| `--muted` | `#c0aa9a` | Supporting text and quiet utilities |
| `--gold` | `#ffce40` | Treasure, selected tabs, links, main emphasis |
| `--green` | `#beffa0` | Powered wheel status |
| `--danger` | `#ff9a9a` | Storage failure notice |
| `--border` | `#49313b` | Structural separators |
| `--ink` | `#1e1218` | Pixel text outlines and sprite shadows |
| `--focus` | `#8ce6ff` | Three-pixel keyboard focus outline |

Gold buttons use the original gold nine-slice image with `#261706` text and a `#fbbb31` fallback background. Wood buttons use cream text over the supplied brown artwork. Status always includes a text label. The cheek fill moves from green to yellow to red, with a numeric load/capacity label and portrait stage.

Measured opaque pairs: muted/surface 8.10:1; focus/surface 12.74:1; gold-button text/central gold fill 10.15:1; cream/central wood fill 4.92:1. These measurements do not certify every pixel of image edges, gradients, disabled states, or the game canvas. See `artifacts/validation.md` for review limits.

## Typography

All interface and canvas text uses the supplied `public/assets/fonts/PixelifySans.ttf`, with sans-serif fallback. Its variable `wght` axis is 400–700; the interface uses 400 and 600. The font loads locally through `@font-face`; no font service is needed. Its OFL notice is in `public/FONT-LICENSE.txt` and in the export.

The six CSS size tokens are `--small:14px`, `--body:16px`, `--label:18px`, `--heading:24px`, `--title:36px`, and `--display:48px`. Body leading is 1.5; headings use 1.06–1.3. The title is 48px on desktop and 36px below 650px. Display tracking is −0.025em; body tracking is natural. Long transaction hashes wrap rather than truncate. Inputs are 16px. Tables and keyboard caps use tabular numerals. Canvas HUD text uses an intentionally smaller pixel scale, with larger DOM statistics below it.

## Layout

The spacing unit is 4px, with 8–12px within control groups and 20–32px between groups. The desktop container is at most 1280px, with 40px side margins; the mine section is at most 1120px. At 650px the margins become 16px, and at 359px they become 12px. The main art and control group share alignment edges.

The desktop title menu overlays the lower left of cover-fit key art. On phones the artwork precedes an opaque menu panel so Pip and the action remain visible without competing for space. At 1100px the art caption and secondary title fact disappear. No critical action is removed.

Game resolution is always 480×270. `ResizeObserver` chooses an integer CSS scale of 1–3. When the viewport is narrower than 480px, the mine viewport crops the canvas horizontally and shifts the world near its sides; pixels are never fractionally shrunk. The visible mine stays 270px tall at 1×. The camera follows vertically with the equivalent of a 0.15 lerp at 60Hz. Pixel smoothing is disabled in CSS and the drawing context.

Run statistics use four columns on desktop and two on mobile. Camp actions become a two-column grid with Deposit spanning the row. Shop purchase controls move below their description on narrow screens. Dialogs stay within 16px side margins and scroll vertically. At coarse pointers, the d-pad and A/B buttons appear below the mine, with basket and pause above; every game touch control is at least 56px and has `touch-action:none`. Keyboard hints disappear in that layout.

## Elevation and depth

The interface uses flat dark surfaces and structural separators. Buttons use the supplied pixel borders through CSS `border-image` with six-source-pixel slices expanded to 12px. They have no added drop shadow. Dialogs use a two-pixel brown border and a dark backdrop. Focus is an independent outline.

The title uses a dark scrim over its artwork on desktop. At mobile sizes its text sits on a solid surface. Underground open/solid joins have a three-pixel shadow and one-pixel warm floor edge. Below 20m, an offscreen mask combines depth-dependent ambient light with helmet, lantern, worm, and flickering magma light. A twelve-row offscreen terrain sheet is reused between digs, basket clearing, quakes, and camera row changes. Radial lights reuse a single cached texture, and magma emissions share a cached glow sheet with per-frame flicker. Paused simulation redraws only when wheel data updates. None of the reference mock screenshots is used as gameplay.

## Shapes

Pixel artwork supplies the game's silhouettes, props, tiles, icons, and button borders. Forms and panels keep square edges. Keyboard caps have a two-pixel radius. The only primitive canvas marks are functional lighting masks, the basket rope, crack feedback, particles, gauge marks, and shadows; actors and scenery always use the supplied images.

## Components and states

| Component or pattern | Source | Use and states |
| --- | --- | --- |
| `Button` / `.pixel-button` | `src/main.tsx`, `src/style.css` | Gold primary, wood secondary, green available variant; native disabled, hover, press, focus states |
| `Item` / `.item-icon` | `src/main.tsx` | Original 16-icon atlas, decorative to assistive technology |
| `Dialog` | `src/main.tsx` | Native modal focus containment and restoration, Escape, backdrop, named close control |
| Title menu | `src/main.tsx` | Loading, ready, asset failure with reload, three game modes |
| Mine viewport | `src/engine.ts` | Integer scaling, active/idle winch, six tile rows, animated actors, cheek stages, HUD, darkness |
| Camp panel | `src/main.tsx` | Deposit enabled only with a load; shop, safe retirement, editable miner name, remembered last depth |
| Shop | `src/main.tsx`, `src/model.ts` | Six upgrades, level/limit and cost; unaffordable/maxed/Daily purchases disabled; success text |
| Pause/settings | `src/main.tsx` | Resume, help, surface shop, music/effects sliders, reduced motion; settings persist |
| Hoard board | `src/main.tsx`, `src/model.ts` | Local top 20 per mode, keyboard-operated tabs, empty state, transaction links |
| Wallet sheet | `src/wallet.ts`, `src/main.tsx` | EIP-6963 names or `window.ethereum`, phone wallet-browser links, pending/rejected/disconnected states |
| Results/share | `src/share.ts`, `src/main.tsx` | Actual run totals; 1200×630 share card, download, clipboard recovery, X intent, optional Sepolia record |

Game shortcuts are documented beside the viewport and in Help. Native buttons retain Space/Enter activation. Menus pause simulation; loss of focus also pauses and clears held inputs. Wheel polling continues and settled rounds queue until play resumes. Reduced motion removes shake, wheel rotation, squash, cheek wobble, and pickup hops; essential gameplay motion remains.

## Game rules and persistence

`src/model.ts` owns the item weights/values, layer ranges/hits/ore, deterministic world generator, prices, and storage schemas. `src/engine.ts` implements movement, jumping, combat, collection, return travel, deposits, run termination, and rendering. `src/wheel.ts` reads the public Squeekchain status and economy endpoints with 4-second timeouts and 5/30-second polling. Practice makes no API requests and settles every simulated 90 seconds. Aborted requests from an old mode cannot overwrite a new mode.

`squeekdeep.v1.save` stores settings, name, last depth, and separate Adventure/Practice hoards and upgrades. Daily always uses base stats and can contribute deposited currency to the Adventure hoard. `squeekdeep.v1.lb` stores at most 20 entries per mode. There are no seeded fake scores. Run score is deposited value plus maximum depth × 5. A starter battery in the entrance provides an initial return opportunity when the wheel is idle.

Wallet sign-in signs the specified nonce/time message and verifies the recovered address locally. The optional record requires Sepolia (`0xaa36a7`), checks the actual selected chain and account, and sends 0 ETH to the same address with UTF-8 run data. No key is requested or stored. Practice records stay local. A submitted hash is labelled as submitted, with confirmation left to the explorer.

## Reuse rules

- Use the six existing type sizes, palette tokens, original atlas icons, and `Button` variants. Keep the main action gold and use natural-case labels.
- Start another modal with `Dialog`; preserve native focus, Escape, and the named close control.
- Keep runtime art beneath `public/assets`, preserve nearest-neighbour rendering, and use sprite frame dimensions from the supplied manifest.
- Keep wallet actions optional, show real wheel failures as failures, and label local/simulated information plainly.
- Do not replace actors with CSS shapes, use the gameplay reference as a scene, add remote fonts, imply a global leaderboard, or make a mainnet transaction.

Design guidance: Better Interface by Jakub Krehel (MIT), with documentation guidance adapted from Paul Bakaus's Impeccable (Apache-2.0). The original game design and assets remain the visual authority.
