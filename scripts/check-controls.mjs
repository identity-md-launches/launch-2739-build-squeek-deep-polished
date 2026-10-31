// Regression checks for the HUD hint and native activation of the touch controls.
// Uses the production export and test-only access to React's existing Game ref.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const playwright = await (process.env.SQUEEK_PLAYWRIGHT
  ? import(pathToFileURL(resolve(process.env.SQUEEK_PLAYWRIGHT)).href)
  : import("playwright"));
const browserName = process.env.SQUEEK_REVIEW_BROWSER || "chromium";
const root = resolve("dist");
const out = resolve("test/scratch/control-review", browserName);
await mkdir(out, { recursive: true });
const types = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".png": "image/png", ".webp": "image/webp", ".ogg": "audio/ogg",
  ".ttf": "font/ttf", ".json": "application/json",
};
const server = createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  const path = resolve(root, pathname.replace(/^\/preview\//, "") || "index.html");
  if (!path.startsWith(root + sep)) { res.writeHead(404).end(); return; }
  try {
    const data = await readFile(path);
    res.writeHead(200, { "Content-Type": types[extname(path)] || "application/octet-stream" });
    res.end(data);
  } catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
let browser;
const results = [];

async function attachGame(page) {
  await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    let fiber = canvas[Object.keys(canvas).find(k => k.startsWith("__reactFiber"))];
    while (fiber) {
      let hook = fiber.memoizedState;
      while (hook) {
        const value = hook.memoizedState?.current;
        if (typeof value?.snapshot === "function" && typeof value?.press === "function") {
          window.reviewGame = value;
          const press = value.press.bind(value);
          value.press = key => { window.reviewPresses.push(key); press(key); };
          window.reviewPresses = [];
          return;
        }
        hook = hook.next;
      }
      fiber = fiber.return;
    }
    throw Error("Game ref not found");
  });
}

async function measureHint(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector("canvas").getBoundingClientRect();
    const hint = document.querySelector(".first-dig-hint").getBoundingClientRect();
    const hudTop = canvas.top + (270 - 32) / 270 * canvas.height;
    return { canvas: canvas.toJSON(), hint: hint.toJSON(), hudTop,
      gap: hudTop - hint.bottom, scrollWidth: document.documentElement.scrollWidth,
      paused: window.reviewGame.paused, depth: window.reviewGame.depth };
  });
}

function checkHint(bounds, viewport) {
  assert.ok(bounds.gap >= 3.9, "Hint must clear the full bottom 32 logical pixels");
  assert.ok(bounds.hint.top >= bounds.canvas.top + 36 / 270 * bounds.canvas.height,
    "Hint must also clear the top HUD");
  assert.ok(bounds.hint.left >= 0 && bounds.hint.right <= viewport.width);
  assert.ok(bounds.canvas.left >= 0 && bounds.canvas.right <= viewport.width);
  assert.ok(bounds.scrollWidth <= viewport.width);
  assert.equal(bounds.paused, false);
}

const controls = [
  ["Jump up", "arrowup", "jump"],
  ["Move and dig left", "arrowleft", "left"],
  ["Dig down", "arrowdown", "down"],
  ["Move and dig right", "arrowright", "right"],
  ["Spit cheek contents", "e", "spit"],
  ["Jump", " ", "jump"],
];

try {
  browser = await playwright[browserName].launch({ headless: true });
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }, { width: 1440, height: 900 }]) {
    const mobile = viewport.width < 650;
    const context = await browser.newContext({ viewport, hasTouch: mobile, serviceWorkers: "block" });
    // Stable fixtures isolate input/layout from the public wheel. No wallet calls.
    await context.route("https://api.squeekchain.com/**", route => {
      const name = new URL(route.request().url()).pathname.split("/").pop();
      const fixture = name === "core"
        ? { configuration: { genesisTimestamp: "1793022600", roundDuration: "600" } }
        : name === "status"
          ? { builder: { anchor: { settledThroughRound: "626" } }, measurement: { coreStatus: "IDLE", rpmMilli: "0" } }
          : { supply: { totalMintedBaseUnits: "17231449240000000000000000" } };
      return route.fulfill({ json: fixture });
    });
    const page = await context.newPage();
    const errors = [], checks = [], cancelledRequests = [];
    let reloading = false;
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", e => { if (e.type() === "error") errors.push(e.text()); });
    page.on("response", r => { if (r.url().startsWith("http://127.0.0.1:") && r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
    page.on("requestfailed", r => {
      if (!r.url().startsWith("http://127.0.0.1:")) return;
      const reason = r.failure()?.errorText || "Unknown network failure";
      // WebKit reports cancelled media requests with a different label than Chromium.
      if (/ABORTED/.test(reason) || reason === "Load request cancelled")
        cancelledRequests.push({ resource: new URL(r.url()).pathname, reason, duringReload: reloading });
      else errors.push(`${reason}: ${r.url()}`);
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/preview/`);
    const play = page.getByRole("button", { name: "Play adventure", exact: true });
    await play.waitFor({ state: "visible" });
    const playBox = await play.boundingBox();
    assert.ok(playBox.y + playBox.height <= viewport.height, "Main action on first screen");
    await page.screenshot({ path: `${out}/title-${viewport.width}.png` });
    await play.click();
    await page.locator(".first-dig-hint").waitFor({ state: "visible" });
    await page.waitForFunction(() => {
      const bounds = document.querySelector("canvas").getBoundingClientRect();
      return bounds.height >= 100 && bounds.left >= 0 && bounds.right <= innerWidth;
    });
    await attachGame(page);
    const fresh = await measureHint(page);
    checkHint(fresh, viewport);
    if (mobile) assert.ok(fresh.canvas.top >= 0 && fresh.canvas.top <= 60);
    const targets = await page.locator(".touch-top button, .touch-controls button, .camp-actions button").evaluateAll(els =>
      els.filter(el => el.getBoundingClientRect().width).map(el => ({ label: el.getAttribute("aria-label") || el.textContent, ...el.getBoundingClientRect().toJSON() })));
    if (mobile) for (const box of targets) {
      assert.ok(box.width >= 48 && box.height >= 48, box.label);
      assert.ok(box.bottom <= viewport.height, `${box.label} below fold`);
    }
    await page.screenshot({ path: `${out}/hint-${viewport.width}.png` });
    await page.keyboard.down("ArrowDown");
    await page.waitForFunction(() => window.reviewGame.load > 0 && window.reviewGame.depth > 0);
    await page.keyboard.up("ArrowDown");
    await page.locator(".first-dig-hint").waitFor({ state: "hidden" });
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("squeekdeep.v1.save")).hintSeen), true);
    assert.ok(await page.evaluate(() => window.reviewGame.load > 0));
    await page.getByRole("button", { name: /^Pause/ }).filter({ visible: true }).click();
    await page.getByRole("button", { name: "Show digging hint again" }).click();
    await page.locator("dialog").waitFor({ state: "hidden" });
    const restored = await measureHint(page);
    checkHint(restored, viewport);
    assert.ok(restored.depth > 0, "Hint restored underground");
    await page.screenshot({ path: `${out}/restored-${viewport.width}.png` });
    checks.push("Fresh hint and Settings-restored hint clear both HUD strips; first dig persists dismissal");

    if (mobile) {
      for (const [label, key, action] of controls) {
        const button = page.getByRole("button", { name: label, exact: true });
        for (const activation of ["Enter", "Space", "click-only", "pointer"]) {
          await button.focus();
          await page.evaluate(action => {
            const game = window.reviewGame;
            game.start("normal", game.levels);
            if (action === "spit") game.inventory = [{ item: 0, value: 5 }];
            window.reviewPresses = [];
          }, action);
          // A fresh map rebuilds the terrain cache; let the first render finish.
          await page.waitForFunction(() => window.reviewGame.seconds >= 0.1);
          if (activation === "click-only") await button.evaluate(el => el.click());
          else if (activation === "pointer") {
            const b = await button.boundingBox();
            await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
            await page.mouse.down();
          } else {
            await page.keyboard.down(activation);
            await page.keyboard.down(activation); // autorepeat must not retrigger the action
          }
          assert.equal(await page.evaluate(key => window.reviewGame.keys.has(key), key), true, `${label}: ${activation} press`);
          const began = await page.evaluate(() => window.reviewGame.seconds);
          if (activation === "click-only") await page.waitForFunction(key => !window.reviewGame.keys.has(key), key);
          else await page.waitForFunction(began => window.reviewGame.seconds - began >= 0.6, began);
          const effect = await page.evaluate(() => ({ x: window.reviewGame.p.x, y: window.reviewGame.p.y, dug: window.reviewGame.hasDug, load: window.reviewGame.load, boost: window.reviewGame.p.boost, seconds: window.reviewGame.seconds, keys: [...window.reviewGame.keys] }));
          if (action === "left") assert.ok(effect.x < 176);
          if (action === "right") assert.ok(effect.x > 176);
          if (action === "down") assert.ok(effect.dug, `${label}: ${activation}, ${JSON.stringify(effect)}`);
          if (action === "jump") assert.ok(effect.y < 160);
          if (action === "spit") { assert.equal(effect.load, 0); assert.ok(effect.boost > 0); }
          if (activation === "pointer") await page.mouse.up();
          else if (activation !== "click-only") await page.keyboard.up(activation);
          assert.equal(await page.evaluate(key => window.reviewGame.keys.has(key), key), false, `${label}: ${activation} release`);
          assert.deepEqual(await page.evaluate(() => window.reviewPresses), [key], "One press per activation, including pointer-generated click");
          checks.push(`${label}: ${activation} performs ${action}, releases, no duplicate`);
        }
      }
      const down = page.getByRole("button", { name: "Dig down", exact: true });
      await down.focus();
      await page.keyboard.down("Enter");
      await page.keyboard.press("Tab");
      assert.equal(await page.evaluate(() => window.reviewGame.keys.has("arrowdown")), false);
      await page.keyboard.up("Enter");
      checks.push("Keyboard hold releases on blur");
      await down.focus();
      await down.evaluate(el => el.click());
      await page.keyboard.down("Enter");
      await page.waitForTimeout(700);
      assert.equal(await page.evaluate(() => window.reviewGame.keys.has("arrowdown")), true);
      await page.keyboard.up("Enter");
      checks.push("A real hold replaces a click-only pulse without an early timeout release");
      await down.evaluate(el => el.click());
      await page.keyboard.press("p");
      await page.locator("dialog").waitFor({ state: "visible" });
      assert.equal(await page.evaluate(() => window.reviewGame.keys.size), 0);
      await page.getByRole("button", { name: "Keep digging", exact: true }).click();
      await page.waitForTimeout(700);
      assert.equal(await page.evaluate(() => window.reviewGame.keys.size), 0);
      checks.push("Pause cancels held/pulsed controls without replay on resume");
      const spit = page.getByRole("button", { name: "Spit cheek contents", exact: true });
      await page.evaluate(() => { window.reviewGame.inventory = [{ item: 0, value: 5 }]; window.reviewPresses = []; });
      await spit.tap();
      assert.equal(await page.evaluate(() => window.reviewGame.load), 0);
      assert.deepEqual(await page.evaluate(() => window.reviewPresses), ["e"]);
      checks.push("Emulated touchscreen Spit tap fires once");
      await down.focus();
      await page.keyboard.down("Enter");
      await page.screenshot({ path: `${out}/focus-${viewport.width}.png` });
      await page.keyboard.up("Enter");
    }

    await page.evaluate(() => window.reviewGame.start("normal", window.reviewGame.levels));
    await page.getByRole("button", { name: "Retire safely", exact: true }).click();
    await page.getByRole("button", { name: "Dig again", exact: true }).click();
    if (mobile) assert.ok((await page.locator("canvas").boundingBox()).y <= 60);
    await page.keyboard.down("ArrowDown");
    await page.waitForFunction(() => window.reviewGame.hasDug);
    await page.keyboard.up("ArrowDown");
    await page.locator(".first-dig-hint").waitFor({ state: "hidden" });
    reloading = true;
    await page.reload();
    reloading = false;
    await page.getByRole("button", { name: "Play adventure", exact: true }).click();
    assert.equal(await page.locator(".first-dig-hint").count(), 0);
    checks.push("Retire → Dig again restores top; dismissed hint stays hidden after reload");
    assert.deepEqual(errors, []);
    results.push({ browser: browserName, viewport, fresh, restored, targets, checks, errors, cancelledRequests });
    console.log("PASS", browserName, `${viewport.width}x${viewport.height}`, `${checks.length} checks`, `HUD gap ${fresh.gap.toFixed(2)}px`);
    await context.close();
  }
  await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2) + "\n");
} finally {
  await browser?.close();
  await new Promise(r => server.close(r));
}
