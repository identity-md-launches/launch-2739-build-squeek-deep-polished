# Squeek Deep: implemented design

## Overview

Squeek Deep is a single-player hamster mining roguelite. Its visual idea is Pip’s warm, wooden surface camp above a progressively darker pixel-art mine. The existing key art, sprites, font, and audio in `public/assets` supply every runtime asset. Adventure, Daily, and offline Practice remain separate modes; scores are explicitly local to this browser.

The title screen pairs the illustrated mine with a compact play menu. The game renders at 480×270 logical pixels. Phone play puts the complete canvas at the top edge, followed by large wood controls. Results and Game Over use the same mine illustration, Pip sprite strips, wood frame, and parchment score panel.

## Colors

Canonical tokens are in `src/style.css`; retain their hex notation.

| Token              | Value     | Use                                     |
| ------------------ | --------- | --------------------------------------- |
| `--bg`             | `#110d15` | Page and outside the mine               |
| `--surface`        | `#1b1420` | Title menu and general dialogs          |
| `--surface-raised` | `#271c27` | Inputs and explanations                 |
| `--text`           | `#fff5e1` | Primary text and wood button labels     |
| `--muted`          | `#c0aa9a` | Supporting text                         |
| `--gold`           | `#ffce40` | Treasure, links, selected tabs, warning |
| `--green`          | `#beffa0` | Powered wheel status                    |
| `--danger`         | `#ff9a9a` | Storage error                           |
| `--border`         | `#49313b` | Structural separators                   |
| `--ink`            | `#1e1218` | Pixel outlines and parchment text       |
| `--focus`          | `#8ce6ff` | 3px keyboard outline                    |

The shop scopes `--muted` to `#67432a` and `--border` to `#b18452`, uses ink text, and changes its focus outline to `#31517d`. Its parchment is the actual `ui/shop_panel.png`, not a flat CSS background. Gold buttons use `#261706` text over the supplied gold art, with a `#fbbb31` fallback clipped to the padding box. Wheel status and cheek capacity include words/numbers as well as color.

Measurements from the decoded art centers and declared foregrounds: cream/wood `#9e5a27` **4.92:1**; gold-button text/`#fbbb31` **10.15:1**; muted/surface **8.10:1**; focus/surface **12.74:1**; ink/parchment `#f7d59c` **12.95:1**; shop muted/parchment **6.20:1**. These pairs do not certify every image edge, disabled opacity, scrim, or canvas pixel.

## Typography

The local `assets/fonts/PixelifySans.ttf` supplies Pixelify Sans, with sans-serif fallback. The interface uses weights 400/600 and disables font synthesis. Keep the six size tokens: small 14px, body 16px, label 18px, heading 24px, title 36px, display 48px. Body leading is 1.5; headings use 1.06–1.3 and balanced wrapping. Desktop title tracking is −0.025em; body tracking is natural.

The title becomes 36px below 650px. Results headings become 24px on phones. Name fields remain 16px to avoid mobile input zoom. Hashes wrap rather than truncate. Tables, run statistics, shop balances, and scores use tabular numerals. Canvas HUD lettering keeps its smaller logical pixel scale; readable DOM statistics are available in Run details.

## Layout

Spacing uses 4px steps, normally 8–12px within groups and 20–32px between them. The outer desktop container is at most 1280px with 40px side margins. The game section is at most 1120px, or 960px below 1100px. Title-page margins become 16px below 650px and 12px below 359px. Phone gameplay alone uses the full viewport width.

The desktop title menu overlays the lower left of the key art. On phones, the art precedes an opaque menu; Pip, the product, and Play are on the first 390px-wide screen. The secondary art caption disappears below 1100px.

`ResizeObserver` in `src/main.tsx` selects integer game scales 1–3 when space allows, and **available width / 480** below 480px. No part of the 480×270 canvas is cropped. CSS `image-rendering: pixelated` and disabled canvas smoothing preserve the art. Observed phone canvases: **390×219.375** and **320×180**, both at `x=0, y=0`. Every screen change scrolls to the top.

The first-dig hint reserves the bottom **32 logical canvas pixels** for health and hoard. `.first-dig-hint` uses `inset-block-end: calc(11.852% + 4px)` at every breakpoint (32/270 of the game-frame height plus a 4px gap); phone rules only adjust its horizontal inset and internal spacing. The same position applies when Settings restores the hint underground. It remains nonblocking and dismisses on the first actual dig.

At widths up to 650px, gameplay hides the outer header/footer and its duplicate heading. Pause and Call basket sit directly below the canvas; the 48px directional pad, Spit, and Jump follow. The three camp actions share one row, wrapping their labels inside their targets. Primary controls fit at 320×568. Secondary statistics, bank/supply data, leaderboard, wallet, and miner name remain in a native Camp & run details disclosure, collapsed on phones and initially expanded on desktop. On desktop the run statistics form four columns; the narrow disclosure uses two. Keyboard hints remain on desktop.

Shop purchase controls move below their descriptions on phones. Dialogs stay within 16px side margins and scroll internally. Results actions use a two-column phone grid with Share spanning the row.

## Elevation & depth

Supplied nine-slice artwork provides depth rather than added shadows. Buttons normally use six source pixels expanded to 12px; compact phone game controls use 8px borders. The shop specifically draws `ui/shop_panel.png` with **6px source slices at 12px**, transparent CSS background, and pixelated rendering. Other dialogs keep their dark surfaces and backdrop. Results use a `hud_bar` frame and parchment score panel over subdued existing key art.

Depth darkness starts at 10m. Its alpha is `min(0.9, 0.35 + depth / 300 * 0.55)`; the player light radius is `96 + lamp * 20`, multiplied by 1.1 while the wheel is ACTIVE. Lantern, glow-worm, and magma lights remain. Terrain and light textures are cached; structural changes invalidate the terrain cache.

Camp props reuse existing art: wood UI panels and beam crops form crates and a sign, the key art provides a fern crop, and the original lantern and ore sprites decorate the camp. An ore pile grows logarithmically with the saved bank, up to twelve small piles.

## Shapes

Keep the original pixel silhouettes, square form fields, sprite icons, and wood/parchment borders. Keyboard caps alone have a 2px radius. Primitive canvas marks are functional masks, rope, particles, gauge marks, cracks, and shadows; characters and scenery use the original images.

## Components

| Pattern                   | Source                          | Behavior                                                                                                            |
| ------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `Button`, `.pixel-button` | `src/main.tsx`, `src/style.css` | Native gold/wood/green buttons; disabled, hover, press, and focus states                                            |
| `Item`                    | `src/main.tsx`                  | Decorative icons from the existing item atlas                                                                       |
| `Dialog`                  | `src/main.tsx`                  | Native modal; named close button, Escape, focus containment and return                                              |
| `.shop-dialog`            | `src/style.css`                 | Parchment nine-slice, six upgrade rows, balance, disabled/maxed/Daily states                                        |
| `.run-details`            | `src/main.tsx`                  | Native disclosure for secondary run and camp information                                                            |
| `.first-dig-hint`         | `src/main.tsx`                  | Nonblocking overlay; keyboard/touch directions; hides after first actual dig                                        |
| Pause/settings            | `src/main.tsx`, `src/model.ts`  | Volume, persisted Off/Low/Normal shake, reduced motion, Show digging hint again                                     |
| Settlement sequence       | `src/wheel.ts`, `src/engine.ts` | Settled-round increase → 2s banner/low rumble/light dust → quake/bell/falling dust/terrain changes                  |
| Pip                       | `src/engine.ts`                 | Idle blink every 3–5s for 0.12s, 0.12s jump stretch, 0.1s landing squash, 10% cheek width per stage, 8px pickup hop |
| Results/share             | `src/main.tsx`, `src/share.ts`  | Banked run totals, original-art PNG download/copy, X intent, optional Sepolia record                                |

Screen shake defaults to Low. Normal is at most 3 CSS pixels, Low at most 1.5, with a 0.6s quadratic decay; hurt shake is at most 1px for 0.15s. Translation is divided by the canvas CSS scale, and uses sine/cosine without consuming gameplay randomness. Reduced motion in settings or the system forces shake off, disables wheel rotation, and removes cheek wobble, jump/landing squash, and pickup hops. Button press scaling is 0.96 for 150ms only when the system permits motion.

Menus and lost focus pause the simulation and clear held input. A paused mine queues at most one settlement; an existing warning also coalesces later notices. The warning and quake wait for active play. Native buttons retain Space/Enter behavior. The `touchButton` pattern in `src/main.tsx` holds its mapped game input on pointer or Enter/Space press and releases on key/pointer release, cancellation, or blur. A click-only assistive activation gives a 0.6s simulation-time pulse so movement/digging can advance even with a slow renderer; pointer-generated clicks and key autorepeat do not trigger a second action. A new hold cancels the pulse timer; leaving the screen, opening a modal, or removing the controls clears tracked input. Physical keyboard codes support arrows and WASD independent of the active keyboard layout; composing letter events are ignored while arrows remain usable with an IME.

## Persistence and data

`squeekdeep.v1.save` stores settings (including `screenShake`), `hintSeen`, name, last depth, and separate Adventure/Practice hoards and upgrades. Old saves migrate to Low shake and an unseen hint. `squeekdeep.v1.lb` keeps top 20 runs per mode. Daily retains the shared UTC-date seed and base stats.

The wheel polls public status every 5s and economy every 30s, with 4s timeouts. Only `builder.anchor.settledThroughRound` increasing after a good baseline can trigger a quake. First samples, errors, recovery, projected blocks/progress, and economy updates cannot. A batch increase produces one event. `/v1/core` is requested once per service lifetime; the countdown uses wall time, genesis 1793022600 and duration 600 as fallbacks. Mint supply is converted from 18-decimal base units to compact SQK.

An IDLE wheel with no battery still offers the safety basket at 40px/s; power/batteries preserve the existing faster route. Return automatically deposits, and walking to the chest, F, Deposit haul, and Retire safely remain available. Quakes add at most one enemy and none with three already alive within ±15 rows. The 25 initial enemies remain.

Optional wallet discovery/sign-in, share flows, and Sepolia-only zero-value self-records are unchanged. No mainnet approvals or transactions are introduced.

## Reuse rules

- Start with the existing six type sizes, semantic colors, atlas icons, and native buttons. Use gold for the main action and natural-case labels.
- Reuse `Dialog` for a modal and native `details` for secondary information. Keep keyboard focus and target sizes intact.
- Keep runtime art under `public/assets`, respect sprite frame dimensions, and retain pixelated rendering. Compose existing sprites instead of adding external images.
- Keep stateful information explicit: local rankings, simulated Practice, unavailable live data, compact token units, and Sepolia gas wording.
- Keep visual randomness separate from seeded gameplay. Do not replace a real settlement with a projected block or use wheel progress as the clock.

Design guidance: Jakub Krehel’s Better Interface (MIT), with documentation guidance adapted from Paul Bakaus’s Impeccable (Apache-2.0). Notices/licenses remain in `docs/DESIGN-GUIDANCE-*`. Current follow-up coverage and limitations are in `artifacts/control-review.md`; earlier A–G validation remains in `artifacts/validation.md`.
