# Worker validation: Squeek Deep

These are worker-run checks, not independent certification. The assignment's verifier checks paths and bytes; it does not establish gameplay behavior.

## Scope and decisions

The scaffold was replaced with the complete game in `src/`. The production export is `dist/index.html`, served with relative URLs and checked beneath `/preview/`. Original art/audio remain in `public/assets`. Existing dependency manifests, lockfile, Vite/TypeScript configuration, and protected paths were preserved.

Consequential choices: narrow screens crop an integer-scaled 480×270 canvas rather than shrink its pixels; camera positioning keeps Pip in the visible area. Practice has its own currency and upgrades, so simulated wheel power does not advance Adventure. Daily always uses base stats. An entrance battery gives a resting-wheel player an initial return opportunity. All rankings are explicitly local to the browser. Wallet rows use provider names and the brief's EIP-1193 flow; no SDK, relay, passkey service, or external icon pack was added.

## Checks and actual results

| Check | Command or method | Result |
| --- | --- | --- |
| Production + strict typecheck | `node scripts/build.mjs` with installed staging dependencies | Passed: existing `npm run build` runs `tsc --noEmit` then Vite. Export includes index, JS/CSS, all runtime art/audio/font, share background, font license, and offline worker. |
| Simulation and wallet primitives | `node test/scratch/unit.mjs` | 19 checks passed: deterministic 15×300 world, all loot/layer bands/caverns, Daily seed/base stats, digging/gravity/pickups, cheek limits/stages and immediate full warning, spit, damage/spills/i-frames/death, deposits/score, basket power/arrival, jump grace/buffer, boulders, quake reshaping/spawns, five enemy behaviors, live schema parsing, ranking, Keccak reference comparisons, three fresh signature recoveries, sign-in and Sepolia guards. |
| Extended integration | `node test/scratch/extra.mjs` | 4 checks passed: Practice makes no API requests and settles at 90 simulated seconds; 5/30s real polling; aborted live requests cannot overwrite Practice; failure becomes IDLE/signal lost; keyboard digging reaches all six layers and 300m. Time was advanced in the harness rather than waiting for a real round. |
| Chromium production flows | `node test/scratch/run-browser-suite.mjs` | Five sequential scripts exercise 31 grouped interaction checks; detailed coverage below. |
| Design probe | Pinned `taste.mjs --out test/scratch/taste` | 16/16 passed after fixes. Exact check results are in `artifacts/taste.json`. |
| Deep rendering/performance | `node test/scratch/deep-render.mjs` | Source-engine fixture renders all six layers using the real assets and canvas renderer. Timing results and their limits are recorded separately below. |
| Path/byte integrity | Git diff/path inspection and byte inventory | `dist/index.html` is included, not ignored. No dependency/cache tree or registry archive is in the submission. Protected configuration/dependencies are unchanged. See `artifacts/budget.json`. |

Scratch harnesses are intentionally excluded from the submission under the assignment's scratch rules. They transpile/import the real source or exercise the actual export. Fixtures are confined to validation contexts; no test balances, wallet keys, fake entries, or API fixtures ship in the application.

The five Chromium scripts cover:

- **11 production flows:** first-screen Play/font/assets, keyboard/modal focus, empty board and arrow-key tabs, digging/collection/basket/deposit, shop and pause settings, safe retirement/score/name, 1200×630 PNG download and native clipboard copy plus X intent, reload persistence, no-wallet recovery, 320/1440 reflow, and offline service-worker reload/Practice. Successful flows reported zero uncaught page errors and zero missing local resources.
- **6 touch checks:** coarse-pointer controls, all game targets at least 56px, a real held touch digging downward, B spit, basket return, pause/resume, and 320px overflow. Touch capability remained active at the end of the test. Related assertions are grouped where they share one interaction.
- **5 wallet checks:** named EIP-6963 discovery, rejected request recovery, fresh message signing/local recovery, wrong-chain prevention, and a 0-value self-transaction with the exact `SQDEEP|v1|score|depth|date|seedHash` payload, saved hash, and Sepolia explorer link. The provider was mocked; no real transaction was broadcast.
- **6 shop/API checks:** native Space activation, all six upgrade purchases with exact debits and changed health/capacity, a projected-height/progress settle causing a real in-game quake, Daily base stats and disabled purchases, separate Practice economy, and an uncharged IDLE basket with its recovery message.
- **3 recovery checks:** intentional asset 404 followed by a working main Reload action, visible 3px keyboard focus, and unavailable localStorage with continued Practice play. The intentional 404 is an error fixture, not a missing production asset.

## Better Interface: six-domain review

The pinned workflow and core principles for every domain were read and applied during implementation. Review used source inspection, the production export, the pinned probe, rendered screenshots, and scripted interaction. The original pixel-art direction and specified TTF remain authoritative.

| Domain | Coverage and evidence | Remaining boundary |
| --- | --- | --- |
| Accessibility | Native buttons, labelled name/volume fields, native modal focus containment/return, Escape, roving board tabs, named canvas and health picture, polite status/error text, 3px focus outline, 56px touch targets, reduced-motion guards. Keyboard help, tabs, shop Space activation, recovery, and focused Play were exercised. | No native screen-reader session, forced-colors device session, or physical assistive-input test. The visual action game is not presented as a text-only game. |
| Layout | First action and Pip visible at 390px; 320/390/1440 checks find no horizontal scroll, overlapping text, clipped text, or floating control over text. Game stats, camp actions, shop rows, and dialogs adapt. Touch basket is centered above the mine. | No exhaustive viewport, RTL, native 200% zoom, or translated-string testing. |
| Writing | Plain action labels, nearby keyboard/touch directions, explicit local leaderboard and simulated Practice, honest unavailable wheel/mint state, actionable wallet/clipboard/storage/asset failures, explicit testnet/gas wording. | English only. No claim of global ranking, verified on-chain score, or transaction confirmation. |
| Typography | Local Pixelify Sans loaded in Chromium. Font metadata confirms variable weight 400–700; UI uses 400/600. Six CSS sizes; probe sees four repeated sizes at 390 and 1440. Name/hash wrapping, stable numeric formatting, 16px inputs. | Canvas pixel text deliberately uses a smaller game scale. Other operating-system text rasterizers are untested. |
| Colors | Semantic palette from the art, selected/tab and wheel states include words, cheek fill has numbers/portrait. Final probe passes all measured contrast. Opaque foreground/fill pairs were calculated: cream/wood center 4.92:1, dark/gold center 10.15:1, muted/surface 8.10:1, focus/surface 12.74:1. | The probe explicitly leaves ten image/gradient/canvas text boxes unmeasured. Image edges, every pixel of a scrim, and disabled-opacity contrast are not certified. |
| UI details | Original nine-slice controls and atlas icons; loading, disabled, pressed, focus, empty, pending, success and recoverable failure states. Native dialogs and bounded motion. Original sprites, six terrain bands, light mask, shadows, particles, winch, basket and share card are implemented. | No physical-device audio listening or external wallet-app launch. Exact art appearance across browser engines is not established. |

## Findings fixed

| Source | Observed problem and impact | Correction / recheck |
| --- | --- | --- |
| `src/main.tsx:303` | Game Space handling swallowed a focused native button's activation. | Preserve Space/Enter on buttons. Browser shop test activates it with Space. |
| `src/main.tsx:608` | Main label wrapped at 390px; asset failure also needed a clear enabled recovery action. | Short Play label, compact loading label, and main gold Reload mine state. Final mobile screenshot and intentional-404 recovery test. |
| `src/wheel.ts:113` | An aborted request from the previous mode could complete after Practice started. | Generation checks on both success and failure; simulated abort race passes. Offline state avoids unnecessary failed requests when the browser reports it is offline. |
| `src/engine.ts:717` | Returning through the same shaft could leave Pip above the hole and falling again. | Choose supported camp ground; repeated battery/active returns pass. |
| `src/engine.ts:151` | Initial full warning was delayed; an exactly filling pickup needed immediate feedback. | Reset warning cooldown and announce on the pickup reaching capacity. Both full cases pass. |
| `src/main.tsx:244`, `src/engine.ts:158` | Paused/hidden games continued costly per-frame painting, and radial gradients were rebuilt repeatedly. | Paint active frames only; paused wheel updates repaint once per poll. Reuse one radial light texture and a terrain sheet invalidated by digging, quakes, basket clearing, or camera row changes. Engine timing limitations remain explicit. |
| `src/style.css:559` | Touch basket originally sat at the right rather than the requested top center. | Three-column grid with centered basket and leading Pause. Render-check JSON records actual centers. |
| `src/engine.ts:1280` | Slime/fire were initially represented by loot icons, inviting the wrong action. | Use cropped original worm/slug pixels so hazards differ from collectibles. |
| `src/style.css:267` | Probe could not resolve a gold nine-slice fill; a fallback initially filled transparent corners. | Actual gold fallback plus padding-box clipping; measured center contrast and final probe pass. |
| `src/engine.ts:1467` | Extra darkness offset drifted from the specified ambient endpoint. | Linear 1.0→0.25 ambient with the powered-light bonus; six-layer render review. |
| `src/main.tsx:785` | Health icons needed an explicit semantic image name. | Health picture has a role and changing numeric label; browser health assertions pass. |
| `src/main.tsx:510` | A/B and sound controls needed their visible labels included in their accessible names. | Accessible names now include A/B and Sound on/off; final touch and sound controls were rechecked. |

## Feature coverage

| Brief group | Implementation / evidence |
| --- | --- |
| Original assets, 480×270, 32px tiles, 15×300, integer scale | Asset loader and canvas renderer; export resource checks and render facts. Reference mock is not gameplay. |
| Six layers, daily seed, ore/loot, caverns, lanterns, beams, boulders | `src/model.ts`, `src/engine.ts`; deterministic world, boulder and full-depth simulation tests; six-layer render fixture. |
| Cheeks, weights/values/depth multiplier, mobility changes, spit/spills, heart/battery | Engine and item table; simulation and actual mining/touch checks. |
| Jump grace/buffer/variable height, digging, damage, i-frames, death, return/deposit/retirement | Engine; simulation cases plus actual mine-return-results browser flow. |
| All six persistent upgrades; Daily base | Exact model prices and six real UI purchases; Daily/Practice isolation tests. |
| Five enemy behaviors and loot | Engine; behavior simulation and source-engine renders. Physical play-balancing is not independently established. |
| Real wheel, RPM, basket power/speed, lost signal, round/countdown, mint count | Actual public response shape checked; parser/polling/abort/failure tests, ACTIVE/IDLE and quake browser fixtures. |
| Practice offline 300rpm and 90s quake | No-request/timer simulation and actual cached offline reload/play. |
| Optional wallet, nonce/time sign-in, Sepolia memo record | Local crypto reference checks and production UI with a mock provider. Real extension/app transaction approval remains unperformed. |
| Local board, save/settings, greeting | Real completed run survives reload; name/mute/reduced-motion/levels/currency persisted. No fabricated scores. |
| Share image/download/copy/X | Actual 1200×630 downloaded PNG inspected; clipboard copy and intent checked. Post was not sent. |
| Screens, HUD, sprite animations, effects, lighting, original audio | Actual export/engine render review and source. Audio paths load without errors; physical playback quality not claimed. |
| Metadata, first phone screen, final docs/export | Final probe, screenshots, `DESIGN.md`, README and export inventory. |



### Final rendering samples

These are engine-only magma-scene samples on this shared host, using 120 requestAnimationFrame updates per condition. They do not include React UI or establish a physical phone result.

| CPU emulation | Median update + draw | P95 update + draw | Median frame interval |
| --- | --- | --- | --- |
| 1× | 5.80ms | 78.50ms | 16.70ms |
| 4× | 20.00ms | 192.30ms | 49.90ms |

Large timing spikes remain in this host run, and the 4× emulation exceeds a 16.67ms frame budget. The 60fps mid-phone target is not certified by this measurement. The implementation uses bounded particles/pickups, nearby enemy updates, terrain/glow caches, and a 480×270 raster; physical-device profiling remains outstanding.

## Limitations

WebKit launch was attempted. Its MiniBrowser exited 127 with `error while loading shared libraries: liblcms2.so.2: cannot open shared object file`. Safari/iPhone behavior is therefore unverified. Chromium emulation does not stand in for a physical phone, native zoom, screen reader, mobile wallet app, or actual wallet transaction. No real 600-second round was awaited; settle transitions and Practice's 90-second timer were tested with fixtures/time advancement.

No physical mid-range phone was available, so 60fps and a sub-three-second cold phone load are not certified. Performance samples are source-engine lab measurements, not an end-to-end phone claim. The exact final samples are retained in `artifacts/performance.json`. Initial concurrent tight-loop measurements showed scheduling spikes and were not used as a phone-FPS result; the final probe uses requestAnimationFrame in a separate browser.

A first-ever network-free visit needs the static export to be served locally; automatic offline reload needs an earlier successful service-worker cache and a supported secure origin. Clipboard image copying depends on browser support/permission; its failure points to the working PNG download. The application never substitutes fake active wheel data for a failed public API.
