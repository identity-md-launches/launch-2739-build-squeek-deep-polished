# SQUEEK DEEP — Game Design Spec (v1, for IMD build)

> A cheek-pouch mining roguelite powered by a real hamster wheel.
> You are **Pip**, an orange/cream Syrian hamster in a yellow miner helmet. Dig down through 6 earth layers, stuff your cheeks with seeds and gems, and haul them back to the surface hoard before a mole shade catches you. The real Squeekchain wheel powers your mine. Every 600s round settles as an earthquake that reshapes the deep.

Static site only: Vite + React + TypeScript, game rendered on a single `<canvas>`. No backend.
Persistence: localStorage only. External reads: the public Squeekchain API (CORS OK). Optional wallet: EIP-1193 (`window.ethereum`).

---

## 1. Core loop (one run ≈ 4–8 min)

1. **Surface camp.** Pip stands beside the wheel winch (`props/wheel_on|off`) and the hoard chest. The shop and leaderboard are here.
2. **Descend.** Dig left, right or down through a procedurally generated shaft world 15 tiles wide and 300 tiles deep.
3. **Collect.** Breaking ore tiles drops seeds and gems. Each pickup adds to cheek **load**, and Pip gets slower and fatter (cheek stages 0–3).
4. **Return.** Walk or jump back up, or call the **elevator basket**. The basket only works when the real wheel is ACTIVE.
5. **Deposit.** Cheek contents become **Hoard** (score and currency) at the surface chest. Play `coin.ogg` and a seed-shower particle effect.
6. **Upgrade.** Spend hoard in the shop. Then dive deeper.
7. **Run end.** The run ends when HP reaches 0 (you lose whatever is in your cheeks) or when you choose "Retire for today". Then show the results screen: max depth, total hoard, best single haul, share card, and an optional on-chain record.

**Score** = total deposited hoard value + max depth (m) × 5.
Leaderboard sort key: score. Depth is 1 tile = 1 m.

## 2. Controls

| Action | Keyboard | Touch (mobile; auto-shown when `pointer: coarse`) |
|---|---|---|
| Move | ← → / A D | left/right on-screen d-pad (bottom-left) |
| Dig | hold a direction against a solid tile; ↓/S digs down | d-pad ↓ / hold direction |
| Jump | Space / W / ↑ | big **A** button (bottom-right) |
| Spit (drop cheek load for a burst of speed + ×1.5 knockback on adjacent enemy) | E | **B** button |
| Call basket (wheel ACTIVE only) | Q | basket button (top-center, pulses when available) |
| Pause / shop at surface | Esc / P | pause icon (top-left) |

- Coyote time 90 ms, jump buffer 120 ms, variable jump height.
- All buttons must be ≥ 56 px. Use `touch-action: none` on the canvas. Never use the page scroll while playing.

## 3. World generation

- Grid: 15 columns × 300 rows. Tiles are 32 px (`tiles/tiles.png`).
- Internal resolution is 480×270, scaled by an integer factor with `image-rendering: pixelated`.
- The camera follows Pip vertically with 0.15 lerp.
- Seed: `hash(dateUTC + runIndex)`. Practice mode uses a random seed.
- The daily run uses the date seed, so the same map is shared by everyone (this makes the leaderboard fair).

Layers (row ranges; tile row in tiles.png):

| # | Layer | Depth (m) | Tile HP (hits) | Ore density | Main loot | Enemies |
|---|---|---|---|---|---|---|
| 0 | Topsoil | 0–40 | 1 | 10% | sunflower seed, pumpkin seed | root beetle |
| 1 | Clay | 40–90 | 2 | 12% | acorn_gold, walnut, amber | root beetle, mole shade |
| 2 | Stone | 90–150 | 3 | 12% | gold_nugget, fossil, emerald | mole shade, glow worm |
| 3 | Crystal cave | 150–210 | 3 | 16% | sapphire, amethyst, crystal_shard | crystal bat, glow worm |
| 4 | Fungal hollow | 210–260 | 2 | 14% | ruby, amethyst, chest (rare) | crystal bat, mole shade |
| 5 | Magma deep | 260–300 | 4 | 18% | magma_heart, ruby | magma slug, mole shade |

- Tile row 0–5 maps to the layers above.
- Cols 0 and 1 are solid variants. Pick one per cell with a hash.
- Col 2 is the dug-out background wall; draw it behind open cells.
- At solid/open boundaries, draw a 3 px dark shadow on the open cell's top, left and right edges, and a 1 px warm highlight on the floor edge. See `mock_gameplay_target.png`.
- Ore overlays (`props/ore_seeds.png`, `props/ore_gems.png`) are drawn on top of solid tiles. `props/rock_cracked.png` is an undiggable boulder (needs Pick level ≥ 3).
- Generation also places:
  - caverns: 2D value noise, threshold 0.68, from 120 m down
  - 1 lantern every ~25 m on a cavern wall (`props/lantern.png`, light radius 96 px)
  - a support beam frame (`props/beam.png`) at each layer boundary
- **Lighting.** The world below 20 m is dark. Use an offscreen darkness mask with radial gradients cut out of it:
  - Pip's helmet lamp: radius 110 px, rising to 150 with the Lamp upgrade
  - lanterns
  - glow worms
  - magma tiles: radius 40, flickering

  Ambient light falls from 1.0 at the surface to 0.25 at 300 m.
- Basket rope: draw a 1 px line from the surface winch to the basket.

## 4. Cheek-pouch mechanic (the signature)

- Capacity C: 10 units at base, +5 per Cheek upgrade (max 35).
- Item weight:

  | Item | Units |
  |---|---|
  | seed | 1 |
  | nut / acorn | 2 |
  | gem | 3 |
  | magma_heart | 5 |
  | chest | 6 |

- Load ratio r = load / C. Cheek stage = 0 (r < 0.25), 1 (< 0.60), 2 (< 0.90), 3 (≥ 0.90). Use `hamster/ham_cheeks.png` frames 0–3 for the HUD portrait.
- In the world, Pip's sprite scales X by 1 + 0.06 × stage.
- Effects of load:
  - walk speed = 96 px/s × (1 − 0.35 r)
  - jump velocity × (1 − 0.25 r)
  - dig time × (1 + 0.2 r)
- At 100%, no more pickups. Play `squeak.ogg` and show a "Cheeks full!" bubble.
- Value per unit:

  | Item | Value |
  |---|---|
  | seed | 5 |
  | acorn/walnut | 12 |
  | amber | 20 |
  | emerald/sapphire | 35 |
  | ruby/amethyst | 45 |
  | crystal_shard | 30 |
  | gold_nugget | 40 |
  | fossil | 60 |
  | magma_heart | 150 |
  | chest | 120 + random item |

  Depth multiplier on value: × (1 + depth/150).
- Damage while carrying load spills 30% of it (rounded up) as pickups that bounce away.
- **Spit (E):** drop the entire load as pickups. Gives +60% speed for 2 s and knocks back adjacent enemies.
- **Heart** pickup: +1 HP. **Battery** pickup: +20 s of basket charge, even when the wheel is IDLE.

## 5. Upgrades (surface shop, `ui/shop_panel.png`, icon slots `ui/slot.png`)

| Upgrade | Levels | Cost (hoard) | Effect |
|---|---|---|---|
| Cheek Stretch | 5 | 150, 400, 900, 1800, 3500 | capacity +5 |
| Pickaxe | 5 | 120, 350, 800, 1600, 3200 | dig time 0.45 s → −15%/lvl. Lvl 3 breaks boulders |
| Helmet Lamp | 3 | 200, 600, 1400 | light radius +20 px; reveals ore glints |
| Fur Armor | 3 | 250, 700, 1500 | max HP 3 → +1/lvl |
| Wheel Winch | 3 | 300, 900, 2000 | basket speed +30% and stops every 50 m |
| Lucky Whiskers | 3 | 400, 1000, 2400 | +5% rare-drop chance |

Upgrades persist across runs in practice mode and normal mode. They do not persist in the Daily run, which always starts at base stats and is scored separately ("Daily" leaderboard tab).

## 6. Enemies (`enemies/*.png`, 72×64 frames facing LEFT; flip X to face right)

| Enemy | HP | Damage | Speed | Behavior |
|---|---|---|---|---|
| Root Beetle | 1 | 1 | 40 px/s | Patrols the floor and turns at walls and ledges. Dies when stomped (jump on top) or hit by a dig swing. |
| Mole Shade | 3 | 1 | 55 px/s | Ghost mole that passes through soil. Draw at alpha 0.85 with a purple tint. Drifts toward Pip when within 160 px. **Telegraph:** frame 1 for 0.6 s, then lunges (frame 2) at 220 px/s for 0.35 s. Avoid by jumping or by moving out of the line. Repelled by lantern light (won't enter a lantern radius). |
| Glow Worm | 2 | 1 | 25 px/s | Crawls on ceilings and walls; drops a slime blob every 3 s. Its lantern is a light source. Killing it drops amber. |
| Crystal Bat | 1 | 1 | 90 px/s | Sleeps hanging (frame 0) until Pip is within 120 px. Then swoops in a sine path and returns to its perch after 3 s. Animate frames 0,1,2,1. |
| Magma Slug | 4 | 2 | 20 px/s | Slow. Leaves a burning trail for 2.5 s that does 1 damage on touch. Immune to stomp. |

- Pip's HP is 3. Each hit gives 1.2 s of invulnerability (blink) and plays hurt frames 0→1, with knockback of 140 px/s. At 0 HP, play hurt frame 2 (dizzy) and end the run.
- Dig swing hits enemies in front of Pip for 1 damage.
- Spawn budget: 1 enemy per 12 m of depth, plus 1 extra for every earthquake survived.

## 7. Real wheel integration (Squeekchain)

Poll `https://api.squeekchain.com/v1/status` every 5 s and `https://api.squeekchain.com/v1/economy/state` every 30 s. Fetch with a 4 s timeout.

- `coreStatus`:
  - `ACTIVE`: the winch is powered. Use `props/wheel_on.png` with a spark flicker. Elevator basket is available (Q). The world gets a +10% light bonus. Play `power_on.ogg` on the transition from IDLE.
  - `IDLE`: no power. Use `wheel_off.png`. The basket is only available with battery charge. Play `power_off.ogg` on the transition.
  - `COUNTER_FAULT` or fetch error: same as IDLE, plus a small "wheel signal lost" chip. Never block play.
- `measurement.rpmMilli / 1000` = RPM, shown in the HUD.
  - Basket speed = 60 + min(RPM, 600) × 0.4 px/s.
  - Wheel sprite rotation speed ∝ RPM.
- **Round settle = Earthquake.** Track `builder.projected.blockHeight`. When it increases (a round of about 600 s settled), or when `blockProgress/1e9` wraps from > 0.9 to < 0.1:
  - screen shake: 2.5 s, amplitude 6 px
  - play `quake.ogg` and `bell.ogg`
  - rocks fall: 8–14 random solid tiles crumble into open cells below Pip's layer
  - spawn 1–2 enemies
  - re-seed ore in already-dug rows: +6 ore tiles

  This is a "living mine": it changes on real chain time. Countdown to the next quake is (1 − blockProgress/1e9) × 600 s, shown in the HUD as `ROUND m:ss`.
- Show `supply.totalMintedBaseUnits` (formatted) on the surface camp board as "Squeek minted".
- **Practice mode toggle:** simulates the API (ACTIVE at 300 rpm, quake every 90 s). Fully offline.

## 8. Wallet sign-in + optional on-chain record

- "Connect wallet" button (`ui/btn_wood.png`) at the surface camp. Uses EIP-1193 `eth_requestAccounts`.
- Then `personal_sign` the message `Squeek Deep sign-in\nAddress: <addr>\nNonce: <random>\nTime: <iso>`. Verify locally with the recovered address.
- After signing, the player name shows as `0xabcd…1234`. A player can also type a name.
- Optional **"Record run on Sepolia"** on the results screen:
  - switch to chainId `0xaa36a7`
  - send a **0-value** tx to the player's own address, with data = UTF-8 hex of `SQDEEP|v1|<score>|<depth>|<date>|<seedHash>`
  - show the tx hash with a sepolia.etherscan.io link
  - store the hash with the leaderboard entry and show a ⛓ badge

  This is never required.
- The game never asks for mainnet transactions and never handles private keys.

## 9. Leaderboard (localStorage)

- Key `squeekdeep.v1.lb`. Store the top 20 for each tab.
- Tabs: **All-time**, **Daily (seeded)**, **Practice** (not ranked).
- Entry: `{name, addr?, score, depth, hoard, date, txHash?}`.
- Other persistent keys:
  - `squeekdeep.v1.save`: upgrades, total hoard, settings (music/SFX volume, show touch controls)
  - stats
- Pip "remembers" the player: the surface camp greeting references the last run, for example "Back again! Last time you reached 142 m".

## 10. Share card to X

- Results screen → "Share" draws on an offscreen 1200×630 canvas:
  - background: `assets/share/share_bg.png`
  - text zone: x 470–1160, y 60–570
  - title "SQUEEK DEEP" in gold
  - DEPTH, HOARD, best haul, wheel status at end, date
  - font: Pixelify Sans, with a 2–4 px dark outline

  Layout reference: `share/share_card_example.png`.
- Buttons:
  - Download PNG.
  - Copy image (Clipboard API where supported).
  - Open `https://x.com/intent/tweet?text=<encoded>`. Text: `I dug {depth}m deep and hoarded {hoard} seeds in Squeek Deep 🐹⛏ powered by a real hamster wheel on @Squeekchain #SqueekDeep <url>`. Tell the user to attach the downloaded image.

## 11. Screens and UI

Title → Surface camp (hub) → Run → Results.

- **Title screen:**
  - `keyart/title_keyart.webp` (fallback `.png`), cover-fit
  - buttons: Play / Daily / Practice / Leaderboard / How to play
- **HUD:**
  - top-left: wheel chip (`WHEEL ACTIVE 412rpm`, green / IDLE, grey), round countdown, depth
  - top-right: cheek meter (`ui/cheek_meter.png`). Fill the inner slot, x 37–99 and y 15–24 px of the 115×40 sprite (about x 32% to 86% and y 38% to 60%), with green → yellow → red by r. Portrait swaps by cheek stage.
  - bottom-left: `ui/hud_bar.png` with item counts (16 px icons from `items/items.png`) and hearts
  - right edge: `ui/depth_gauge.png` with a marker
- **Panels:** all panels and buttons use 9-slice with a 6 px border at 2× or 3× integer scale. Button art:
  - `btn_gold`: primary
  - `btn_green`: confirm
  - `btn_wood`: secondary
- Font: `assets/fonts/PixelifySans.ttf` (SIL OFL) via `@font-face`.
- Feedback ("juice"): dig particles in the layer color, a hit-stop of 40 ms, item pickup magnet (radius 24 px), number popups, and screen shake.
- **Audio:**
  - Use the provided `audio/*.ogg` files. Fall back to WebAudio-synth beeps if decoding fails.
  - Unlock audio on the first user gesture.
  - Music at 40% volume by default; there is a mute toggle.

## 12. Asset manifest (all paths under `/assets`, see `assets/manifest.json`)

| File | Frame / size | Frames (order) | Use |
|---|---|---|---|
| keyart/title_keyart.webp/.png | 1280×720 | – | title screen |
| hamster/ham_idle.png | 80×80 strip | 4 | idle 6 fps, faces right |
| hamster/ham_walk.png | 80×80 | 4 | walk 8–10 fps (contact, pass, contact, pass) |
| hamster/ham_walk6.png | 80×80 | 6 | smoother walk at 12 fps (optional, use instead of ham_walk) |
| hamster/ham_dig.png | 80×80 | 4 | pickaxe swing 12 fps (side) |
| hamster/ham_dig_down.png | 80×80 | 4 | dig straight down at 12 fps: 0 wind-up, 1 swing, 2 impact (spark + chips), 3 recover |
| hamster/ham_jump.png | 80×80 | 4 | 0 crouch, 1 takeoff, 2 air, 3 land |
| hamster/ham_hurt.png | 80×80 | 3 | 0 flinch, 1 knockback, 2 dizzy |
| hamster/ham_ride.png | 80×80 | 4 | in basket at 6 fps (sway left, center, sway right, center; rope from top) |
| hamster/ham_cheeks.png | 80×80 | 4 | cheek stage 0–3 portrait |
| enemies/{mole_shade,root_beetle,glow_worm,crystal_bat,magma_slug}.png | 72×64 | 3 each | face left; mole 0 float, 1 telegraph, 2 lunge (mole_shade is a translucent ghost and uses partial alpha, so draw it as-is, ideally at globalAlpha 0.85 with a slow ±2 px bob); bat 0,1,2,1 |
| tiles/tiles.png | 32×32 grid 3×6 | rows: topsoil, clay, stone, crystal, fungal, magma; cols: solidA, solidB, dug wall | world |
| items/items.png | 32×32 strip | 16: seed_sunflower, seed_pumpkin, acorn_gold, walnut, amber, emerald, sapphire, ruby, amethyst, crystal_shard, gold_nugget, fossil, magma_heart, heart, battery, chest | pickups and icons |
| props/ore_seeds.png, ore_gems.png, rock_cracked.png | 32×32 | – | ore overlays, boulder |
| props/wheel_on.png 103×71, wheel_off.png 102×63 | – | – | surface winch |
| props/lantern.png 29×74, beam.png 119×72 | – | – | cave decor |
| props/basket_ride_alt.png 68×87 | – | – | basket with Pip, alternative to ham_ride |
| ui/hud_bar 125×42, shop_panel 116×61, cheek_meter 115×40, btn_gold 69×38, btn_green 81×38, btn_wood 49×38, depth_gauge 20×56, slot 45×46 | – | – | UI (9-slice, 6 px border) at 1x. `ui/2x/*` and `ui/3x/*` hold the same art, nearest-neighbour upscaled (borders 12 px and 18 px), for crisp HUDs at 960×540 and 1440×810 without runtime smoothing |
| share/share_bg.png | 1200×630 | – | share card background |
| audio/*.ogg | – | dig, break, pickup_seed, pickup_gem, squeak, hurt, coin, upgrade, click, bell, quake, power_on, power_off, music_loop | SFX and music |
| fonts/PixelifySans.ttf | – | – | UI font |
| palette.png | 128 colors | – | shared palette (all sprites quantized to it) |
| mock_gameplay_target.png | 960×540 | – | reference for target look only |

- All sprites have transparent backgrounds. Bottom-center is the foot anchor.
- Draw with `ctx.imageSmoothingEnabled = false`.

**Palette:** shared 128 colors in `assets/palette.png` / manifest.json. Key UI colors:

| Name | Hex |
|---|---|
| gold | #FFCE40 |
| cream | #FFF5E1 |
| ink outline | #1E1218 |
| ACTIVE green | #BEFFA0 |
| crystal blue | #8CE6FF |
| panel brown | #5A3A22 |

### Asset pipeline v2 (2026-10-31)
The v1 pack is kept in `_v1_backup/`. The v2 art is produced by `tools/v2_hamster.py`, `v2_mole.py`, `v2_tiles.py` and `v2_ui.py`, which write to `work/v2/`. `tools/v2_install.py` then builds the 128-colour palette, quantises the assets, writes them into `assets/` (including `ui/2x` and `ui/3x`) and **merges** its entries into `manifest.json`. `tools/v2_preview.py` makes `preview.png` and the mock, `v2_compare.py` makes `compare.png`, and `v2_gif.py` makes the `anim_*.gif` files.
**Do not run `tools/build.py` again**: it overwrites the v2 assets and the manifest. If you must, run the v2 scripts again in that order afterwards, then re-add the extra entries (see `tools/manifest_extra.txt`).

## 13. Acceptance criteria

1. Loads in < 3 s on desktop. Reaches 60 fps on a mid-range phone at 480×270 internal resolution with an integer scale. No console errors.
2. Uses the provided sprites. No placeholder rectangles. The hamster has no bushy tail and keeps the yellow helmet.
3. Keyboard and touch both fully playable. The touch overlay appears only on touch devices.
4. All 6 layers, 5 enemies, the cheek stages and the shop work as specified. The daily seed is deterministic.
5. Wheel API handling:
   - ACTIVE/IDLE visibly changes the winch, basket availability and HUD within 5 s.
   - A quake fires on round settle.
   - The game works offline / on API failure (shows IDLE + "signal lost").
   - Practice mode simulates the API.
6. Wallet connect + sign works with MetaMask. The Sepolia record is optional, 0-value, and shows the tx link. Declining never breaks the game.
7. The leaderboard persists in localStorage with All-time / Daily / Practice tabs.
8. The share card renders at 1200×630 with correct numbers. The X intent link opens.
9. Audio plays after the first gesture. The mute toggle persists.
10. No fake copyright text. Credits screen: "Art & audio: original for Squeek Deep. Font: Pixelify Sans (OFL)".
