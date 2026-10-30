import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
const require = createRequire(
  process.env.SQUEEK_CHECK_DEPS
    ? join(resolve(process.env.SQUEEK_CHECK_DEPS), "__resolver.cjs")
    : import.meta.url,
);
const ts = require("typescript");
const root = fileURLToPath(new URL("../", import.meta.url));
const temp = mkdtempSync(join(tmpdir(), "squeekdeep-check-"));
process.on("exit", () => rmSync(temp, { recursive: true, force: true }));
import { readFileSync, writeFileSync } from "node:fs";
for (const name of ["wheel", "model", "assets", "engine"]) {
  const code = ts
    .transpileModule(readFileSync(join(root, `src/${name}.ts`), "utf8"), {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ES2022,
      },
    })
    .outputText.replace(/from "\.\/(\w+)"/g, 'from "./$1.mjs"');
  writeFileSync(join(temp, `${name}.mjs`), code);
}
const {
  initialWheel,
  parseStatus,
  didSettle,
  WheelService,
  roundClock,
  formatMinted,
} = await import(pathToFileURL(join(temp, "wheel.mjs")).href);
const { Game, SURFACE } = await import(
  pathToFileURL(join(temp, "engine.mjs")).href
);
const { BASE, freshSave, readSave } = await import(
  pathToFileURL(join(temp, "model.mjs")).href
);
const results = [];
async function test(name, run) {
  await run();
  results.push({ name, passed: true });
  console.log("PASS", name);
}
const signal = (
  round,
  active = "ACTIVE",
  height = 100,
  progress = 990000000,
) => ({
  builder: {
    anchor: { settledThroughRound: String(round) },
    projected: { blockHeight: String(height), blockProgress: String(progress) },
  },
  measurement: { coreStatus: active, rpmMilli: "300000" },
});
await test("Only settled rounds trigger; first sample, blocks, idle, batches and regressions", () => {
  const a = parseStatus(signal(626), initialWheel());
  assert.equal(didSettle(initialWheel(), a), false);
  const b = parseStatus(signal(626, "ACTIVE", 103, 0), a);
  assert.equal(didSettle(a, b), false);
  const c = parseStatus(signal(629, "IDLE", 103, 0), b);
  assert.equal(didSettle(b, c), true);
  const d = parseStatus(signal(629, "ACTIVE", 150, 990000000), c);
  assert.equal(didSettle(c, d), false);
  const e = parseStatus(signal(627, "IDLE", 150), d);
  assert.equal(e.settledRound, 629);
  assert.equal(didSettle(d, e), false);
  assert.throws(() =>
    parseStatus({ measurement: { coreStatus: "ACTIVE" } }, e),
  );
});
await test("API initial failure and recovery establish baseline without quake or timestamp write", async () => {
  const events = [];
  const s = new WheelService((w, q) => events.push({ w: { ...w }, q }));
  s.fetchJSON = async () => {
    throw Error("offline");
  };
  await s.status();
  assert.equal(s.state.updated, 0);
  s.fetchJSON = async () => signal(626);
  await s.status();
  assert.equal(events.at(-1).q, false);
  const good = s.state.updated;
  s.fetchJSON = async () => {
    throw Error("offline");
  };
  await s.status();
  assert.equal(s.state.updated, good);
  s.fetchJSON = async () => signal(629);
  await s.status();
  assert.equal(events.at(-1).q, false);
  s.fetchJSON = async () => signal(630, "IDLE");
  await s.status();
  assert.equal(events.at(-1).q, true);
  s.stop();
});
await test("Practice quakes once per 90s and resets IDLE synchronously for Adventure; core once", async () => {
  const realInterval = globalThis.setInterval,
    realClear = globalThis.clearInterval,
    realNow = Date.now;
  let time = 100000000,
    clockTicks = [],
    coreCalls = 0;
  Date.now = () => time;
  globalThis.setInterval = (fn) => {
    clockTicks.push(fn);
    return clockTicks.length;
  };
  globalThis.clearInterval = () => {};
  try {
    const events = [];
    const s = new WheelService((w, q) => events.push({ w: { ...w }, q }));
    s.fetchJSON = async (path) => {
      if (path === "core") {
        coreCalls++;
        return {
          configuration: {
            genesisTimestamp: "1793022600",
            roundDuration: "600",
          },
        };
      }
      if (path === "status") return signal(626);
      return { supply: { totalMintedBaseUnits: "17231449240000000000000000" } };
    };
    s.start(true);
    assert.equal(s.state.active, true);
    time += 90000;
    clockTicks[0]();
    clockTicks[0]();
    assert.equal(events.filter((x) => x.q).length, 1);
    time += 90000;
    clockTicks[0]();
    assert.equal(events.filter((x) => x.q).length, 2);
    s.start(false);
    assert.equal(s.state.active, false);
    assert.equal(s.state.settledRound, null);
    assert.equal(events.at(-1).w.active, false);
    await new Promise((resolve) => setImmediate(resolve));
    s.start(false);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(coreCalls, 1);
    s.stop();
  } finally {
    globalThis.setInterval = realInterval;
    globalThis.clearInterval = realClear;
    Date.now = realNow;
  }
});
await test("Countdown follows genesis at boundaries and never projected/economy state", () => {
  for (const offset of [0, 1, 599, 600, 601, 1376, 600000]) {
    const now = 1793022600 + offset;
    const c = roundClock(now, 1793022600, 600);
    assert.equal(c.currentRound, Math.floor(offset / 600) + 1);
    assert.equal(c.remaining, 600 - (offset % 600));
  }
  assert.equal(roundClock(1793022600, 1793022600, 600).label, "10:00");
  assert.equal(roundClock(1793023199, 1793022600, 600).label, "0:01");
});
await test("18-decimal SQK is compact, including exact sample", () => {
  assert.equal(formatMinted("17231449240000000000000000"), "17.23M SQK");
  assert.equal(formatMinted("1"), "0.00 SQK");
  assert.equal(formatMinted(undefined), "Unavailable");
});
let storage = {};
globalThis.localStorage = {
  getItem: (k) => storage[k] ?? null,
  setItem: (k, v) => (storage[k] = v),
};
await test("Save migration: default Low, saved shake and first dig hint", () => {
  assert.equal(freshSave().settings.screenShake, "low");
  assert.equal(freshSave().hintSeen, false);
  storage["squeekdeep.v1.save"] = JSON.stringify({
    settings: { reducedMotion: true, screenShake: "normal" },
    hintSeen: true,
  });
  assert.equal(readSave().settings.screenShake, "normal");
  assert.equal(readSave().settings.reducedMotion, true);
  assert.equal(readSave().hintSeen, true);
  storage["squeekdeep.v1.save"] = JSON.stringify({
    settings: { screenShake: "bad" },
  });
  assert.equal(readSave().settings.screenShake, "low");
});
const context = new Proxy(
  {
    createRadialGradient: () => ({ addColorStop() {} }),
    measureText: (t) => ({ width: t.length * 5 }),
  },
  { get: (obj, k) => (k in obj ? obj[k] : () => {}) },
);
const canvas = () => ({ width: 480, height: 270, getContext: () => context });
globalThis.document = { createElement: canvas };
const images = new Proxy({}, { get: () => ({ width: 480, height: 80 }) });
function game(mode = "normal", levels = BASE) {
  const deposits = [],
    ends = [];
  const g = new Game(
    canvas(),
    images,
    (e) => ends.push(e),
    (value, mode) => deposits.push({ value, mode }),
  );
  g.start(mode, levels);
  return { g, deposits, ends };
}
await test("Keep 25 initial enemies; at most one spawn per quake and cap 3 near player", () => {
  const { g } = game();
  assert.equal(g.enemies.length, 25);
  g.p.y = SURFACE + 30 * 32;
  for (let i = 0; i < 25; i++) {
    const count = g.enemies.filter(
        (e) => e.hp > 0 && Math.abs(e.y - g.p.y) <= 15 * 32,
      ).length,
      all = g.enemies.length;
    g.earthquake();
    assert.equal(g.enemies.length - all, count < 3 ? 1 : 0);
  }
  assert.ok(
    g.enemies.filter((e) => e.hp > 0 && Math.abs(e.y - g.p.y) <= 15 * 32)
      .length <= 3,
  );
});
await test("Enemy cap includes the full 15-row boundary at fractional player depth", () => {
  const { g } = game();
  g.p.y = SURFACE + 30.75 * 32;
  g.enemies = g.enemies.slice(0, 3).map((e) => ({ ...e, y: g.p.y + 15 * 32 }));
  g.earthquake();
  assert.equal(g.enemies.length, 3);
});
await test("Settlement warns for 2s; pause freezes quake, coalesces backlog to 1", () => {
  const { g } = game();
  g.paused = true;
  g.setWheel({ ...initialWheel(), settledRound: 627 }, true);
  g.setWheel({ ...initialWheel(), settledRound: 628 }, true);
  assert.equal(g.pendingQuakes, 1);
  for (let i = 0; i < 300; i++) g.update(1 / 60);
  assert.equal(g.quakes, 0);
  g.paused = false;
  g.update(1 / 60);
  assert.equal(g.snapshot().message, "Rumble... round settling");
  for (let i = 0; i < 119; i++) g.update(1 / 60);
  assert.equal(g.quakes, 0);
  for (let i = 0; i < 3; i++) g.update(1 / 60);
  assert.equal(g.quakes, 1);
  assert.equal(g.pendingQuakes, 0);
});
await test("Safety basket at 30m, IDLE with zero battery returns and banks in <=25s", () => {
  const { g, deposits, ends } = game();
  g.p.y = SURFACE + 30 * 32;
  g.inventory = [{ item: 0, value: 125 }];
  g.battery = 0;
  g.wheel = initialWheel();
  g.callBasket();
  assert.equal(g.riding, true);
  let elapsed = 0;
  while (g.riding && elapsed < 25) {
    g.update(1 / 60);
    elapsed += 1 / 60;
  }
  assert.ok(g.atCamp);
  assert.ok(elapsed <= 25);
  assert.equal(g.battery, 0);
  assert.equal(g.hoard, 125);
  assert.equal(deposits[0].value, 125);
  g.finish(true);
  assert.equal(ends[0].hoard, 125);
  console.log("return seconds", elapsed);
});
await test("Deposit by walking, F key, explicit button path, and safe retirement all bank", () => {
  for (const method of ["walk", "f", "button", "retire"]) {
    const { g, deposits, ends } = game();
    g.inventory = [{ item: 0, value: 80 }];
    g.p.x = method === "walk" ? 80 : 176;
    if (method === "walk") g.update(1 / 60);
    if (method === "f") g.press("f");
    if (method === "button") g.deposit();
    if (method === "retire") g.finish(true);
    assert.equal(deposits[0].value, 80);
    if (method === "retire") assert.equal(ends[0].hoard, 80);
  }
});
await test("Jump/landing stretch and the actual 8px pickup hop render correctly", () => {
  const { g } = game();
  const poses = [];
  const drawSprite = g.sprite.bind(g);
  g.sprite = (...args) => {
    if (
      args[1].startsWith("hamster/ham_") &&
      args[1] !== "hamster/ham_cheeks.png"
    )
      poses.push(args);
    return drawSprite(...args);
  };
  g.press(" ");
  g.update(1 / 60);
  g.draw();
  assert.ok(g.p.vy < -360);
  assert.equal(poses.at(-1)[7], 64 * 0.88);
  assert.equal(poses.at(-1)[8], 64 * 1.12);
  g.release(" ");
  let landed = false;
  for (let i = 0; i < 120; i++) {
    g.update(1 / 60);
    if (g.landSquash > 0) {
      g.draw();
      assert.equal(poses.at(-1)[7], 64 * 1.15);
      assert.equal(poses.at(-1)[8], 64 * 0.85);
      landed = true;
      break;
    }
  }
  assert.equal(landed, true);
  g.drops = [];
  g.inventory = [];
  g.jumpStretch = g.landSquash = 0;
  g.spawnDrop(0, g.p.x, g.p.y - 12, 0, 5, 0);
  g.updateDrops(0);
  assert.equal(g.p.hop, 0.22);
  assert.equal(g.value, 5);
  g.p.hop = 0.11;
  g.draw();
  assert.equal(poses.at(-1)[6], g.p.y + 2 - 8);
});
await test("Shake is <=3 CSS px at Normal at every scale, low half, off/reduced 0; decays in 0.6s", () => {
  const { g } = game();
  g.earthquake();
  for (const scale of [2, 3, 390 / 480, 320 / 480]) {
    g.screenScale = scale;
    g.screenShake = "normal";
    for (let i = 0; i <= 60; i++) {
      g.shake = 0.6 - i * 0.01;
      g.seconds = i * 0.01;
      const { x, y } = g.shakeOffset();
      assert.ok(Math.abs(x * scale) <= 3);
      assert.ok(Math.abs(y * scale) <= 3);
      assert.ok(Math.hypot(x * scale, y * scale) <= 3 + 1e-10);
    }
  }
  g.shake = 0.6;
  g.screenShake = "low";
  let p = g.shakeOffset();
  assert.ok(Math.abs(p.x * g.screenScale) <= 1.5);
  g.screenShake = "off";
  assert.deepEqual(g.shakeOffset(), { x: 0, y: 0 });
  g.screenShake = "normal";
  g.reducedMotion = true;
  assert.deepEqual(g.shakeOffset(), { x: 0, y: 0 });
  g.reducedMotion = false;
  g.shake = 0.6;
  for (let i = 0; i < 37; i++) g.update(1 / 60);
  assert.equal(g.shake, 0);
  g.damage(1, 0);
  assert.equal(g.shake, 0.15);
  assert.equal(g.shakePower, 1);
});
await test("Daily identical inputs/seed and different render counts with Off vs Normal produce identical world after 2 quakes", () => {
  const a = game("daily").g,
    b = game("daily").g;
  a.screenShake = "off";
  b.screenShake = "normal";
  for (let quake = 0; quake < 2; quake++) {
    a.earthquake();
    b.earthquake();
    a.press("d");
    b.press("d");
    for (let i = 0; i < 120; i++) {
      a.update(1 / 60);
      b.update(1 / 60);
      a.draw();
      b.draw();
      b.draw();
      b.draw();
    }
    a.release("d");
    b.release("d");
  }
  assert.deepEqual(a.world, b.world);
  assert.deepEqual(a.enemies, b.enemies);
  assert.deepEqual(a.drops, b.drops);
});
console.log(`${results.length} regression groups passed.`);
